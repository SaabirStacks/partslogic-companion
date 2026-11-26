import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readBoolean, readNumber, readRecord, readString, type JsonRecord } from '../core/read';
import { NOT_PACKED, parcelsWords } from './packing';
import { clockTime, londonDaysAgo, moneyWords, quantityWords, shortDate } from './words';

// Handover (S5a-2a, docs/design-checks/handover.md; docs/SALES.md 6.5 and 13.23). The parts on the collection and
// delivery shelf go to the customer: a collection is marked collected; a delivery is sent out, with a driver or by a
// courier, then marked delivered. Stock leaves the books only at Collected or Delivered. Not delivered brings the parts
// back to the shelf with a reason; each step is undone on the day. The database decides all of it; these wrappers hand
// it the words and read its answers, and the words below are the copy deck's (signed off 25 November 2026).

export const HANDOVER_HOWS = ['collection', 'delivery', 'courier'] as const;
export type HandoverHow = (typeof HANDOVER_HOWS)[number];
export const HANDOVER_STATES = ['collected', 'out', 'delivered', 'not_delivered'] as const;
export type HandoverState = (typeof HANDOVER_STATES)[number];

// Why a delivery didn't happen, in the window's order. S5a-2b adds Refused.
export const NOT_DELIVERED_REASONS = ['no_one_in', 'closed', 'address_not_found', 'out_of_time', 'other'] as const;
export type NotDeliveredReason = (typeof NOT_DELIVERED_REASONS)[number];
export const NOT_DELIVERED_REASON_LABELS: Record<NotDeliveredReason, string> = {
  no_one_in: 'No one in',
  // garages close; "No one in" is for homes
  closed: 'Closed',
  address_not_found: 'Address not found',
  out_of_time: 'Ran out of time',
  other: 'Other',
};

// The steps the toast's Undo takes back.
export const HANDOVER_STEPS = ['collected', 'sent_out', 'delivered', 'not_delivered'] as const;
export type HandoverStep = (typeof HANDOVER_STEPS)[number];

// Lengths the database keeps (sales.handovers).
export const COLLECTED_BY_MAX = 80;
export const DRIVER_NAME_MAX = 80;
export const CARRIER_MAX = 60;
export const TRACKING_MAX = 60;
export const NOT_DELIVERED_NOTE_MAX = 300;

// Carriers offered as the courier's box is typed in; any other can be typed.
export const CARRIERS = ['DPD', 'Royal Mail', 'Parcelforce', 'UPS', 'DHL', 'Evri'] as const;

// A Ready for collection order waiting this many days on the shelf reads in amber (SALES.md 12, case 8).
export const SHELF_AGE_WARN_DAYS = 5;

export type Handover = {
  id: number;
  how: HandoverHow;
  state: HandoverState;
  collectedBy: string | null;
  driver: string | null;
  carrier: string | null;
  tracking: string | null;
  packed: boolean;
  parcels: number | null;
  sentAt: string | null;
  doneAt: string | null;
  notDeliveredAt: string | null;
  reason: NotDeliveredReason | null;
  note: string | null;
  // when its latest step happened, and who took it
  at: string;
  by: string | null;
  units: number;
  // made today: Not collected and Not delivered can take it back
  today: boolean;
  // proof of delivery (S5a-2c): who signed at the door and when; none for a delivery marked on the web
  signedBy: string | null;
  signedAt: string | null;
  lines: { lineId: number; qty: number }[];
};

function oneOf<T extends string>(values: readonly T[], value: Json | undefined): T | null {
  return typeof value === 'string' && (values as readonly string[]).includes(value) ? (value as T) : null;
}

export function readHandover(value: Json | undefined): Handover | null {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  const how = oneOf(HANDOVER_HOWS, row?.how);
  const state = oneOf(HANDOVER_STATES, row?.state);
  if (!row || id == null || !how || !state) return null;
  return {
    id,
    how,
    state,
    collectedBy: readString(row.collected_by),
    driver: readString(row.driver),
    carrier: readString(row.carrier),
    tracking: readString(row.tracking),
    packed: readBoolean(row.packed) ?? false,
    parcels: readNumber(row.parcels),
    sentAt: readString(row.sent_at),
    doneAt: readString(row.done_at),
    notDeliveredAt: readString(row.not_delivered_at),
    reason: oneOf(NOT_DELIVERED_REASONS, row.reason),
    note: readString(row.note),
    at: readString(row.at) ?? '',
    by: readString(row.by),
    units: readNumber(row.units) ?? 0,
    today: readBoolean(row.today) ?? false,
    signedBy: readString(row.signed_by),
    signedAt: readString(row.signed_at),
    lines: readArray(row.lines).flatMap((item) => {
      const line = readRecord(item);
      const lineId = readNumber(line?.line_id);
      return line && lineId != null ? [{ lineId, qty: readNumber(line.qty) ?? 0 }] : [];
    }),
  };
}

export function readHandovers(value: Json | undefined): Handover[] {
  return readArray(value).flatMap((item) => readHandover(item) ?? []);
}

// ------------------------------------------------------------------------------------------------ the calls
export type HandoverResult = { orderId: string; handoverIds: number[]; units: number; status: string | null; fulfilment: string | null };

function readResult(orderId: string) {
  return (value: Json): HandoverResult => {
    const row = readRecord(value) ?? {};
    return {
      orderId: readString(row.order_id) ?? orderId,
      handoverIds: readArray(row.handover_ids).flatMap((id) => (typeof id === 'number' ? [id] : [])),
      units: readNumber(row.units) ?? 0,
      status: readString(row.status),
      fulfilment: readString(row.fulfilment),
    };
  };
}

// Text the database keeps only when there is some.
function given(value: string | null | undefined): string | undefined {
  const text = value?.trim();
  return text ? text : undefined;
}

// Mark collected: everything on the shelf for a collection; who collected is optional.
export function collectOrder(supabase: Client, input: { orderId: string; collectedBy?: string | null }): Promise<HandoverResult> {
  const p: { [key: string]: Json } = { order_id: input.orderId };
  const who = given(input.collectedBy);
  if (who) p.collected_by = who;
  return call(supabase.rpc('sales_order_collect', { p }), readResult(input.orderId));
}

// Send out: our driver (a member, or a typed name), or a courier and its tracking number; all optional.
export function sendOutOrder(
  supabase: Client,
  input: { orderId: string; driverId?: string | null; driverName?: string | null; carrier?: string | null; tracking?: string | null },
): Promise<HandoverResult> {
  const p: { [key: string]: Json } = { order_id: input.orderId };
  if (input.driverId) p.driver_id = input.driverId;
  else if (given(input.driverName)) p.driver_name = given(input.driverName)!;
  if (given(input.carrier)) p.carrier = given(input.carrier)!;
  if (given(input.tracking)) p.tracking = given(input.tracking)!;
  return call(supabase.rpc('sales_order_send_out', { p }), readResult(input.orderId));
}

export function deliverOrder(supabase: Client, orderId: string): Promise<HandoverResult> {
  return call(supabase.rpc('sales_order_deliver', { p_order: orderId }), readResult(orderId));
}

export function markNotDelivered(
  supabase: Client,
  input: { orderId: string; reason: NotDeliveredReason; note?: string | null },
): Promise<HandoverResult> {
  const p: { [key: string]: Json } = { order_id: input.orderId, reason: input.reason };
  if (input.reason === 'other' && given(input.note)) p.note = given(input.note)!;
  return call(supabase.rpc('sales_order_not_delivered', { p }), readResult(input.orderId));
}

export function markNotCollected(supabase: Client, orderId: string): Promise<HandoverResult> {
  return call(supabase.rpc('sales_order_not_collected', { p_order: orderId }), readResult(orderId));
}

// The toast's Undo: one step back for the handovers it just made.
export function undoHandover(supabase: Client, input: { orderId: string; handoverIds: number[]; step: HandoverStep }): Promise<HandoverResult> {
  return call(
    supabase.rpc('sales_order_undo_handover', { p: { handover_ids: input.handoverIds, step: input.step } }),
    readResult(input.orderId),
  );
}

// ------------------------------------------------------------------------------------------------ the words
export const MARK_COLLECTED = 'Mark collected';
export const SEND_OUT = 'Send out';
export const MARK_DELIVERED = 'Mark delivered';
export const NOT_COLLECTED = 'Not collected';
export const NOT_DELIVERED = 'Not delivered';
export const PRINT_NOTE = 'Print note';

// A part in the handover windows, as the deck, the preview and the lines table put it: the part, then "× 2" (critique
// round 2: the windows had the Pack window's "2 × part").
export function handoverLineWords(line: { part: { brand: string; number: string }; qty: number }): string {
  return `${`${line.part.brand} ${line.part.number}`.trim()} × ${quantityWords(line.qty)}`;
}

// Whether an order's Collection or Delivery note can be printed: an open, held or completed order with parts on the
// shelf, or one handed over (not one whose delivery came back). The order page and the list's preview ask the same
// (owner, 25 November 2026: "Print note on the order and from the Ready lists").
export function canPrintNote(order: { status: string; onShelf: number; latest: Pick<Handover, 'state'> | null }): boolean {
  const live = order.status === 'open' || order.status === 'on_hold' || order.status === 'completed';
  return live && (order.onShelf > 0 || (order.latest != null && order.latest.state !== 'not_delivered'));
}
export const PRINT_DELIVERY_NOTE = 'Print delivery note';
// The Mark collected window's own tick, as Send out's (owner, 25 November 2026): the customer signs at the counter.
export const PRINT_COLLECTION_NOTE = 'Print collection note';

// A customer who pays before taking the parts and still owes (owner, 25 November 2026: a warning, not a stop, until
// payments come with invoices in S6): "Not paid yet · £238.80 to pay".
export function notPaidWords(toPay: number): string {
  return `Not paid yet · ${moneyWords(toPay)} to pay`;
}

// Proof of delivery (S5a-2c): who signed at the door, or that nobody did. "Signed by Jo Smith" · "No signature".
export const NO_SIGNATURE = 'No signature';
export function signedWords(signedBy: string | null): string {
  return signedBy ? `Signed by ${signedBy}` : NO_SIGNATURE;
}

export const COLLECTED_TOAST = 'Order collected';
export const SENT_OUT_TOAST = 'Order sent out';
export const DELIVERED_TOAST = 'Order delivered';
export const BACK_ON_SHELF_TOAST = 'Back on the shelf';

export const COLLECTED_BY_LABEL = 'Collected by';
export const DRIVER_LABEL = 'Driver';
export const DRIVER_PLACEHOLDER = 'Choose or type a name';
export const CARRIER_LABEL = 'Carrier';
export const TRACKING_LABEL = 'Tracking number';
export const REASON_LABEL = 'Reason';
export const NOTE_LABEL = 'Note';
export const NOT_DELIVERED_LINE = 'The parts go back on the shelf.';
export const NOT_PACKED_LINE = `${NOT_PACKED} · goes loose`;

export const markCollectedTitle = (order: string) => `Mark ${order} as collected`;
export const sendOutTitle = (order: string) => `Send out ${order}`;
export const notDeliveredTitle = (order: string) => `${NOT_DELIVERED} · ${order}`;

const units = (n: number) => `${quantityWords(n)} ${n === 1 ? 'unit' : 'units'}`;

// When the handing over happened: "10:42" today, "24 Nov 10:42" before.
export function handoverTime(at: string, now: string): string {
  if (!at) return '';
  return londonDaysAgo(at, now) === 0 ? clockTime(at) : `${shortDate(at, now)} ${clockTime(at)}`;
}

// Part of the order in the window: "2 of 3 units on the shelf · 1 stays on the order"; null when it is all there.
export function partHereWords(here: number, of: number): string | null {
  if (here >= of || of <= 0) return null;
  const rest = of - here;
  return `${quantityWords(here)} of ${units(of)} on the shelf · ${quantityWords(rest)} ${rest === 1 ? 'stays' : 'stay'} on the order`;
}

// The courier and its tracking number: "DPD · 1Z999AA10123456784".
export function carrierWords(h: Pick<Handover, 'carrier' | 'tracking'>): string | null {
  return [h.carrier, h.tracking].filter(Boolean).join(' · ') || null;
}

// The line after the order's pills (the copy deck): who and when, for the order's latest handover.
// "Collected by Sam Patel · 10:42", "Collected by Sam Patel · 2 of 3 units · 10:42", "Sent out with Dave Hughes · 10:42",
// "Sent out by DPD · 1Z999AA10123456784 · 10:42", "Delivered · 14:05".
// short: the list row's line, without the tracking number (it is on the order page).
// signature: false leaves who signed off (the printed note, where the signature or the lines to sign say it).
export function handoverLine(h: Handover, now: string, orderUnits?: number, short = false, signature = true): string | null {
  const when = handoverTime(h.at, now);
  const part = orderUnits != null && h.units < orderUnits ? `${quantityWords(h.units)} of ${units(orderUnits)}` : null;
  switch (h.state) {
    case 'collected':
      return [h.collectedBy ? `Collected by ${h.collectedBy}` : 'Collected', part, when].filter(Boolean).join(' · ');
    case 'out': {
      const lead = h.how === 'courier' ? (h.carrier ? `Sent out by ${h.carrier}` : 'Sent out') : h.driver ? `Sent out with ${h.driver}` : 'Sent out';
      return [lead, h.how === 'courier' && !short ? h.tracking : null, part, when].filter(Boolean).join(' · ');
    }
    case 'delivered':
      // Our own delivery says who signed, or that nobody did (marked on the web); a courier's proof is the courier's.
      return ['Delivered', h.how === 'delivery' && signature ? signedWords(h.signedBy) : null, part, when].filter(Boolean).join(' · ');
    case 'not_delivered':
      return null;
  }
}

// The need row after Not delivered (amber): "Not delivered · No one in · 15:20", Other's note in its place.
export function notDeliveredWords(h: Pick<Handover, 'reason' | 'note' | 'at'>, now: string): string {
  const why = h.reason === 'other' ? (h.note ?? NOT_DELIVERED_REASON_LABELS.other) : h.reason ? NOT_DELIVERED_REASON_LABELS[h.reason] : null;
  return [NOT_DELIVERED, why, handoverTime(h.at, now)].filter(Boolean).join(' · ');
}

// A line's stage once parts left the shelf: "Out for delivery", "Collected", "Delivered", "2 of 3 delivered".
export function lineHandedWords(line: { quantity: number; supplied: number; sentOut: number }, method: HandoverHow): string | null {
  const done = method === 'collection' ? 'collected' : 'delivered';
  if (line.supplied >= line.quantity && line.quantity > 0) return method === 'collection' ? 'Collected' : 'Delivered';
  if (line.supplied > 0) return `${quantityWords(line.supplied)} of ${quantityWords(line.quantity)} ${done}`;
  if (line.sentOut > 0) return line.sentOut >= line.quantity ? 'Out for delivery' : `${quantityWords(line.sentOut)} of ${quantityWords(line.quantity)} out for delivery`;
  return null;
}

// A Ready for collection order's wait: "On the shelf 6 days", amber from 5 days; nothing on its first day.
export function shelfAge(readySince: string | null, now: string): { text: string; warn: boolean } | null {
  if (!readySince) return null;
  const days = londonDaysAgo(readySince, now);
  if (days < 1) return null;
  return { text: `On the shelf ${days} ${days === 1 ? 'day' : 'days'}`, warn: days >= SHELF_AGE_WARN_DAYS };
}

// The note a handover prints: a Collection note or a Delivery note, by the order's method.
export function noteTitle(method: HandoverHow): string {
  return method === 'collection' ? 'Collection note' : 'Delivery note';
}

// What the Not delivered window says when it can't be saved, or null when it can.
export function notDeliveredProblem(reason: NotDeliveredReason | null, note: string): string | null {
  if (!reason) return 'Choose a reason.';
  if (reason === 'other' && note.trim().length < 3) return 'Say what happened.';
  if (note.trim().length > NOT_DELIVERED_NOTE_MAX) return `Keep it to ${NOT_DELIVERED_NOTE_MAX} characters.`;
  return null;
}

// The order's history lines for handovers (sentences, as the rest of the history), or null for another event.
export function handoverEventText(event: string, detail: JsonRecord): string | null {
  const num = (key: string) => (typeof detail[key] === 'number' ? (detail[key] as number) : 0);
  const text = (key: string) => (typeof detail[key] === 'string' ? (detail[key] as string) : '');
  switch (event) {
    case 'collected':
      return `${text('by_name') ? `Collected by ${text('by_name')}` : 'Collected'}: ${units(num('units'))}.`;
    case 'sent_out': {
      const how = text('carrier')
        ? `Sent out by ${[text('carrier'), text('tracking')].filter(Boolean).join(' · ')}`
        : text('driver')
          ? `Sent out with ${text('driver')}`
          : 'Sent out';
      const packed = detail.packed === true && num('parcels') > 0 ? ` in ${parcelsWords(num('parcels'))}` : detail.packed === false ? ', loose' : '';
      return `${how}: ${units(num('units'))}${packed}.`;
    }
    case 'delivered':
      // "Delivered, signed by Jo Smith: 3 units." · "Delivered, no signature: 3 units." (S5a-2c)
      return text('signed_by')
        ? `Delivered, signed by ${text('signed_by')}: ${units(num('units'))}.`
        : detail.no_signature === true
          ? `Delivered, no signature: ${units(num('units'))}.`
          : `Delivered: ${units(num('units'))}.`;
    case 'not_delivered': {
      const reason = text('reason');
      const why = reason === 'other' && text('note') ? text('note') : (NOT_DELIVERED_REASONS as readonly string[]).includes(reason) ? NOT_DELIVERED_REASON_LABELS[reason as NotDeliveredReason] : '';
      return `Not delivered${why ? ` · ${why}` : ''}: ${units(num('units'))} back on the shelf.`;
    }
    case 'not_collected':
      return `Not collected: ${units(num('units'))} back on the shelf.`;
    case 'send_out_undone':
      return `Send out undone: ${units(num('units'))} back on the shelf.`;
    case 'delivery_undone':
      return `Delivery undone: ${units(num('units'))} out for delivery again.`;
    case 'not_delivered_undone':
      return 'Not delivered undone.';
    case 'completed':
      return 'Completed: everything supplied.';
    case 'reopened':
      return 'Open again.';
    default:
      return null;
  }
}
