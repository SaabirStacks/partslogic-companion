import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readBoolean, readNumber, readRecord, readString, type JsonRecord } from '../core/read';
import { CUSTOMER_CHANNEL_LABELS, CUSTOMER_CHANNELS, type CustomerChannel } from './cannot-supply';
import type { EnquiryCustomer } from './enquiries';
import { greetingName } from './put-aside';
import { dateWords, dayAndTime, dayWords } from './words';

// A late line (docs/SALES.md 13.16, board 6r). A part bought for a customer is late when that supplier's delivery is
// received without it, or an hour after the promised window if nothing came (owner, 21 November 2026). The database
// works it out from the order's day and window, the latest follow-up and the deliveries matched; these wrappers read
// it, word it and record that the customer was told. A late line is a need for the counter, never a hold and never
// red. Copying the message counts as telling the customer; nothing is sent from the app.

// The counter's step on a late line: tell the customer it is late, or give the new day a supplier promised.
export const LATE_NEEDS = ['tell_late', 'tell_new_day'] as const;
export type LateNeed = (typeof LATE_NEEDS)[number];

export type LateLine = {
  lineId: number;
  poLineId: number;
  part: string;
  brand: string;
  number: string;
  description: string | null;
  units: number;
  poId: string;
  poNumber: string;
  supplier: string | null;
  // What the supplier promised when the order was placed.
  expectedOn: string | null;
  expectedFrom: string | null;
  expectedBy: string | null;
  // The latest follow-up: the new day it gave (if any), when, and who recorded it.
  promisedOn: string | null;
  followedUpAt: string | null;
  followedUpBy: string | null;
  // The day it now waits for, whether it is late, since when, and why.
  dueOn: string | null;
  late: boolean;
  lateSince: string | null;
  cause: 'delivered_without' | 'no_delivery' | null;
  // What the customer was last told: that it is late (for the day it was due) or the new day.
  toldAt: string | null;
  toldVia: CustomerChannel | null;
  toldKind: 'late' | 'new_day' | null;
  toldDue: string | null;
  need: LateNeed | null;
};

// An order's late lines in brief, for the Sales orders list.
export type OrderLateSummary = {
  lines: number;
  tell: number;
  step: LateNeed | null;
  part: string | null;
  dueOn: string | null;
  dueFrom: string | null;
  dueBy: string | null;
  revised: boolean;
};

function oneOf<T extends string>(values: readonly T[], value: Json | undefined): T | null {
  return typeof value === 'string' && (values as readonly string[]).includes(value) ? (value as T) : null;
}

function readLateLine(value: Json | undefined): LateLine | null {
  const row = readRecord(value);
  const lineId = readNumber(row?.line_id);
  const poLineId = readNumber(row?.po_line_id);
  const poId = readString(row?.po_id);
  if (!row || lineId == null || poLineId == null || !poId) return null;
  return {
    lineId,
    poLineId,
    part: readString(row.part) ?? '',
    brand: readString(row.brand) ?? '',
    number: readString(row.number) ?? '',
    description: readString(row.description),
    units: readNumber(row.units) ?? 0,
    poId,
    poNumber: readString(row.po_number) ?? '',
    supplier: readString(row.supplier),
    expectedOn: readString(row.expected_on),
    expectedFrom: readString(row.expected_from),
    expectedBy: readString(row.expected_by),
    promisedOn: readString(row.promised_on),
    followedUpAt: readString(row.followed_up_at),
    followedUpBy: readString(row.followed_up_by),
    dueOn: readString(row.due_on),
    late: readBoolean(row.late) ?? false,
    lateSince: readString(row.late_since),
    cause: oneOf(['delivered_without', 'no_delivery'] as const, row.cause),
    toldAt: readString(row.told_at),
    toldVia: oneOf(CUSTOMER_CHANNELS, row.told_via),
    toldKind: oneOf(['late', 'new_day'] as const, row.told_kind),
    toldDue: readString(row.told_due),
    need: oneOf(LATE_NEEDS, row.need),
  };
}

export function readLateLines(value: Json | undefined): LateLine[] {
  return readArray(value).map(readLateLine).filter((l): l is LateLine => l != null);
}

export function readOrderLateSummary(value: Json | undefined): OrderLateSummary | null {
  const row = readRecord(value);
  if (!row) return null;
  return {
    lines: readNumber(row.lines) ?? 0,
    tell: readNumber(row.tell) ?? 0,
    step: oneOf(LATE_NEEDS, row.step),
    part: readString(row.part),
    dueOn: readString(row.due_on),
    dueFrom: readString(row.due_from),
    dueBy: readString(row.due_by),
    revised: readBoolean(row.revised) ?? false,
  };
}

// The late lines the counter is to tell the customer about.
export function lateLinesToTell(lines: LateLine[]): LateLine[] {
  return lines.filter((l) => l.need != null);
}

const DAY = 86_400_000;
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to.slice(0, 10)}T12:00:00Z`) - Date.parse(`${from.slice(0, 10)}T12:00:00Z`)) / DAY);
}
function todayKey(now: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(now));
}

// The Where cell's second line, one wording for late everywhere: "↑ Due today 08:30–10:30" on the day, then
// "↑ Overdue 3 days"; once a revised day has passed, "↑ Overdue 1 day · revised ETA Mon 23 Nov". Before it is late:
// "due Mon 23 Nov · revised ETA" or "due today 08:30–10:30 · not received yet".
export function lateDueWords(line: Pick<LateLine, 'late' | 'dueOn' | 'promisedOn' | 'expectedFrom' | 'expectedBy'>, now: string): string {
  if (!line.dueOn) return 'no date given';
  const window = !line.promisedOn && line.expectedFrom && line.expectedBy ? ` ${line.expectedFrom}–${line.expectedBy}` : '';
  const days = daysBetween(line.dueOn, todayKey(now));
  if (line.late) {
    if (days <= 0) return `↑ Due today${window}`;
    const overdue = `↑ Overdue ${days} ${days === 1 ? 'day' : 'days'}`;
    return line.promisedOn ? `${overdue} · revised ETA ${dateWords(line.promisedOn)}` : overdue;
  }
  if (line.promisedOn) return `due ${dayWords(line.dueOn, now)} · revised ETA`;
  return days === 0 ? `due today${window} · not received yet` : `due ${dayWords(line.dueOn, now)}${window}`;
}

// What the customer was last told, for the Where cell: "Told today 10:41 · WhatsApp"; "Told Sat 21 Nov: new day
// Mon 23 Nov · WhatsApp".
export function lateToldWords(line: Pick<LateLine, 'toldAt' | 'toldVia' | 'toldKind' | 'toldDue'>, now: string): string | null {
  if (!line.toldAt) return null;
  const via = line.toldVia ? ` · ${CUSTOMER_CHANNEL_LABELS[line.toldVia]}` : '';
  const at = dayAndTime(line.toldAt, now);
  if (line.toldKind === 'new_day' && line.toldDue) return `Told ${at.replace(/ \d\d:\d\d$/, '')}: new day ${dateWords(line.toldDue)}${via}`;
  return `Told ${at}${via}`;
}

// The need row for the counter. "Hillside Garage hasn’t been told: Bosch 1 987 473 566 didn’t arrive as promised."
// A revised day: "Hillside Garage was told Bosch 1 987 473 566 is late, not the new day, Mon 23 Nov." Late again after a
// new day was given: "Hillside Garage was told Bosch 1 987 473 566 would come Mon 23 Nov; it hasn’t arrived."
export function lateNeedWords(line: LateLine, customer: string): string {
  if (line.need === 'tell_new_day') {
    const day = line.promisedOn ? dateWords(line.promisedOn) : 'the new day';
    return line.toldKind === 'late'
      ? `${customer} was told ${line.part} is late, not the new day, ${day}.`
      : `${customer} hasn’t been told the new day for ${line.part}: ${day}.`;
  }
  if (line.toldKind === 'new_day' && line.toldDue && line.toldDue === line.dueOn) {
    return `${customer} was told ${line.part} would come ${dateWords(line.toldDue)}; it hasn’t arrived.`;
  }
  return line.cause === 'no_delivery' && line.expectedBy && !line.promisedOn
    ? `${customer} hasn’t been told: no delivery came for ${line.part} by ${addHour(line.expectedBy)}.`
    : `${customer} hasn’t been told: ${line.part} didn’t arrive as promised.`;
}

function addHour(time: string): string {
  const [h, m] = time.split(':').map((x) => Number.parseInt(x, 10));
  if (h == null || m == null || Number.isNaN(h) || Number.isNaN(m)) return time;
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Purchasing's step, in words on the counter's order (a buyer's Follow up is a button only on purchasing's screens).
// "Purchasing hasn’t followed up yet." "Purchasing followed up today 11:05 (Dana Hughes): no new day yet."
export function latePurchasingWords(line: LateLine, now: string): string {
  if (!line.followedUpAt) return 'Purchasing hasn’t followed up yet.';
  const by = line.followedUpBy ? ` (${line.followedUpBy})` : '';
  const after = line.promisedOn && !line.late ? `: due ${dateWords(line.promisedOn)}` : line.late ? ': no new day yet' : '';
  return `Purchasing followed up ${dayAndTime(line.followedUpAt, now)}${by}${after}.`;
}

type MessageOrder = {
  number: string;
  customer: Pick<EnquiryCustomer, 'kind' | 'name' | 'contactName'>;
  customerPo: string | null;
  registrations: string[];
};

function partsList(parts: string[]): string {
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : (parts[0] ?? 'a part');
}

function named(line: LateLine): string {
  return line.description ? `the ${line.description.charAt(0).toLowerCase()}${line.description.slice(1)} (${line.part})` : line.part;
}

function orderWords(order: MessageOrder): string {
  const plates = order.registrations.length ? ` for ${order.registrations.join(', ')}` : '';
  // The customer's own order number first, ours after, as in every customer message.
  return order.customerPo ? `${plates} on your order ${order.customerPo} (our ${order.number})` : `${plates} on order ${order.number}`;
}

// The message Tell customer copies, in the customer's words: no supplier names, no order times, a new day only once a
// supplier gave one. "Hello Priya, the wear sensor (Bosch 1 987 473 566) for YK19 HNC on order SO-000061 (HG-2304)
// didn’t arrive as promised. We’re checking with our supplier and will tell you the new day as soon as we have it.
// Sorry for the wait." A new day: "… is now due Mon 23 Nov (it was due Wed 18 Nov). Sorry for the wait."
export function lateMessage(order: MessageOrder, lines: LateLine[]): string {
  const name = greetingName(order.customer);
  const hello = `Hello${name ? ` ${name}` : ''},`;
  const newDay = lines.filter((l) => l.need === 'tell_new_day');
  const again = lines.filter((l) => l.need === 'tell_late' && l.toldKind === 'new_day' && l.toldDue === l.dueOn);
  const first = lines.filter((l) => l.need === 'tell_late' && !again.includes(l));
  const sentences: string[] = [];
  const verb = (xs: LateLine[], one: string, many: string) => (xs.length === 1 ? one : many);
  if (first.length) {
    sentences.push(`${partsList(first.map(named))}${orderWords(order)} didn’t arrive as promised.`);
  }
  if (again.length) {
    const was = [...new Set(again.map((l) => l.dueOn).filter((d): d is string => !!d))];
    const due = was.length === 1 && was[0] ? ` (${verb(again, 'it', 'they')} ${verb(again, 'was', 'were')} due ${dateWords(was[0])})` : '';
    sentences.push(`${partsList(again.map(named))}${first.length ? '' : orderWords(order)} still ${verb(again, 'hasn’t', 'haven’t')} arrived${due}.`);
  }
  if (first.length || again.length) sentences.push('We’re checking with our supplier and will tell you the new day as soon as we have it.');
  for (const l of newDay) {
    const was = l.expectedOn ? ` (it was due ${dateWords(l.expectedOn)})` : '';
    sentences.push(`${named(l)}${first.length || again.length ? '' : orderWords(order)} is now due ${l.promisedOn ? dateWords(l.promisedOn) : 'a new day'}${was}.`);
  }
  return `${hello} ${sentences.join(' ')} Sorry for the wait.`;
}

// The order's history line for a late line told. Null for any other event.
export function lateEventText(event: string, detail: JsonRecord): string | null {
  if (event !== 'customer_told_late') return null;
  const parts = Array.isArray(detail.parts) ? (detail.parts as unknown[]).filter((p): p is string => typeof p === 'string') : [];
  const via = typeof detail.via === 'string' && (CUSTOMER_CHANNELS as readonly string[]).includes(detail.via)
    ? ` (${CUSTOMER_CHANNEL_LABELS[detail.via as CustomerChannel]})` : '';
  return `Customer told ${parts.length ? partsList(parts) : 'a part'} is late${via}.`;
}

// The Sales orders list's step under Fulfilment: "↑ Due today 08:30–10:30 · Bosch 1 987 473 566".
export function orderLateWords(summary: OrderLateSummary, now: string): string | null {
  if (!summary.step && summary.lines === 0) return null;
  const part = summary.part ? ` · ${summary.part}` : '';
  if (summary.step === 'tell_new_day' && summary.lines === 0) return `New day from the supplier${part}`;
  const due = summary.dueOn
    ? lateDueWords({ late: true, dueOn: summary.dueOn, promisedOn: summary.revised ? summary.dueOn : null, expectedFrom: summary.dueFrom, expectedBy: summary.dueBy }, now)
    : '↑ Late';
  return `${due.replace(/ · revised ETA.*$/, '')}${part}`;
}


// The counter tells the customer: every late line and every new day on the order, by the channel chosen.
export function tellLate(supabase: Client, orderId: string, via: CustomerChannel): Promise<void> {
  return call(supabase.rpc('sales_order_tell_late', { p_id: orderId, p: { via } }), () => undefined);
}
