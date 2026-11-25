import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readBoolean, readNumber, readRecord, readString, readStrings } from '../core/read';
import { readEnquiryCustomer, type EnquiryCustomer } from './enquiries';
import { arrivesWords, orderInDestinationWords, readOrderInSuppliers, readTypedPurchaseLines, type OrderInSupplier, type TypedPurchaseLine } from './order-in';
import { HOLD_REASONS, type HoldReason } from './orders';
import { clockTime, dayAndTime, dayWords, moneyWords, sinceWords } from './words';

// Purchase orders › Customer lines (docs/SALES.md 13.13, canvas boards 6o and 6p). The sales order lines still to
// order, across every open sales order, grouped by the purchase order each would land on: one supplier and one branch
// per group, the supplier's draft there unless it was sent for approval, else a new draft. A buyer ticks lines across
// many sales orders and adds them in one go; each sales order goes through its own Order in rules in the database.

// ------------------------------------------------------------------------------------------- the queue

// The Purchase orders tab, as the address bar names it (?status=customer_lines).
export const CUSTOMER_LINES = 'customer_lines' as const;

export type CustomerLineOrder = {
  id: string;
  number: string;
  status: string;
  customer: EnquiryCustomer;
  customerPo: string | null;
  // What a retail customer has paid, against the order's total.
  paid: number;
  total: number;
  paymentRequired: boolean;
};

export type CustomerLinePromise = { arrivesOn: string; arrivesFrom: string | null; arrivesBy: string | null };

export type CustomerLine = {
  id: number;
  // Still to order (lines), what is on the shelf (in stock), or still to order (can't be added yet).
  units: number;
  // When it started waiting: the order's confirmation, or the line's own addition after it.
  since: string;
  position: number;
  order: CustomerLineOrder;
  part: { id: number; brand: string; number: string; description: string | null };
  location: { id: number; name: string } | null;
  // When the customer was told the part would arrive.
  promise: CustomerLinePromise | null;
  // Soonest arrival first; the preferred one marked. Costs only for people allowed to see margin.
  suppliers: OrderInSupplier[];
  // The offer's supplier, else the preferred, else the soonest.
  defaultSourceId: number | null;
  typed: TypedPurchaseLine[];
  // The line's price each, only for people allowed to see margin.
  unitPrice: number | null;
};

export const BLOCKED_REASONS = ['on_hold', 'payment', 'no_supplier', 'supplier_on_hold'] as const;
export type BlockedReason = (typeof BLOCKED_REASONS)[number];

export type BlockedCustomerLine = CustomerLine & {
  why: BlockedReason;
  holdReason: HoldReason | null;
  holdNote: string | null;
  // Every supplier that lists the part, when all of them are on hold.
  heldSuppliers: string[];
};

export type InStockCustomerLine = CustomerLine & { available: number };

// A draft with lines for customers on it, not sent for approval: someone has to place it.
export type DraftToPlace = {
  id: string;
  number: string;
  supplier: string;
  location: { id: number; name: string } | null;
  cutoffAt: string | null;
  lines: number;
};

export type CustomerLinesQueue = {
  now: string;
  canOrderIn: boolean;
  seeCost: boolean;
  location: { id: number; name: string } | null;
  lines: CustomerLine[];
  blocked: BlockedCustomerLine[];
  inStock: InStockCustomerLine[];
  drafts: DraftToPlace[];
};

function readPlace(value: Json | undefined): { id: number; name: string } | null {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  return row && id != null ? { id, name: readString(row.name) ?? '' } : null;
}

function readPromise(value: Json | undefined): CustomerLinePromise | null {
  const row = readRecord(value);
  const arrivesOn = readString(row?.arrives_on);
  return row && arrivesOn ? { arrivesOn, arrivesFrom: readString(row.arrives_from), arrivesBy: readString(row.arrives_by) } : null;
}

function readLine(item: Json): CustomerLine | null {
  const row = readRecord(item);
  const id = readNumber(row?.id);
  const order = readRecord(row?.order);
  const orderId = readString(order?.id);
  const part = readRecord(row?.part);
  const partId = readNumber(part?.id);
  if (!row || id == null || !order || !orderId || !part || partId == null) return null;
  return {
    id,
    units: readNumber(row.units) ?? 0,
    since: readString(row.since) ?? '',
    position: readNumber(row.position) ?? 0,
    order: {
      id: orderId,
      number: readString(order.number) ?? '',
      status: readString(order.status) ?? 'open',
      customer: readEnquiryCustomer(order.customer),
      customerPo: readString(order.customer_po),
      paid: readNumber(order.paid) ?? 0,
      total: readNumber(order.total) ?? 0,
      paymentRequired: readBoolean(order.payment_required) ?? false,
    },
    part: { id: partId, brand: readString(part.brand) ?? '', number: readString(part.number) ?? '', description: readString(part.description) },
    location: readPlace(row.location),
    promise: readPromise(row.promise),
    suppliers: readOrderInSuppliers(row.suppliers),
    defaultSourceId: readNumber(row.default_source_id),
    typed: readTypedPurchaseLines(row.typed),
    unitPrice: readNumber(row.unit_price),
  };
}

function readReason(value: Json | undefined): BlockedReason {
  return typeof value === 'string' && (BLOCKED_REASONS as readonly string[]).includes(value) ? (value as BlockedReason) : 'no_supplier';
}

function readHoldReason(value: Json | undefined): HoldReason | null {
  return typeof value === 'string' && (HOLD_REASONS as readonly string[]).includes(value) ? (value as HoldReason) : null;
}

export function readCustomerLinesQueue(data: Json): CustomerLinesQueue {
  const body = readRecord(data) ?? {};
  return {
    now: readString(body.now) ?? new Date().toISOString(),
    canOrderIn: readBoolean(body.can_order_in) ?? false,
    seeCost: readBoolean(body.see_cost) ?? false,
    location: readPlace(body.location),
    lines: readArray(body.lines).flatMap((item) => {
      const line = readLine(item);
      return line ? [line] : [];
    }),
    blocked: readArray(body.blocked).flatMap((item) => {
      const line = readLine(item);
      const row = readRecord(item);
      if (!line || !row) return [];
      return [{ ...line, why: readReason(row.why), holdReason: readHoldReason(row.hold_reason), holdNote: readString(row.hold_note), heldSuppliers: readStrings(row.held_suppliers) }];
    }),
    inStock: readArray(body.in_stock).flatMap((item) => {
      const line = readLine(item);
      const row = readRecord(item);
      return line && row ? [{ ...line, available: readNumber(row.available) ?? 0 }] : [];
    }),
    drafts: readArray(body.drafts).flatMap((item) => {
      const row = readRecord(item);
      const id = readString(row?.id);
      if (!row || !id) return [];
      return [
        {
          id,
          number: readString(row.number) ?? '',
          supplier: readString(row.supplier) ?? '',
          location: readPlace(row.location),
          cutoffAt: readString(row.cutoff_at),
          lines: readNumber(row.lines) ?? 0,
        },
      ];
    }),
  };
}

// ------------------------------------------------------------------------------------------- where each line goes

// Where a line goes: a supplier, or a line typed on a purchase order by hand before ordering in existed.
export type QueueChoice = { sourceId: number | null; linkLine: number | null };
export type QueueChoices = Record<number, QueueChoice>;

// The database's choice: the offer's supplier, else the preferred, else the soonest; a typed line is linked.
export function defaultQueueChoice(line: Pick<CustomerLine, 'defaultSourceId' | 'typed'>): QueueChoice {
  return { sourceId: line.defaultSourceId, linkLine: line.typed[0]?.poLineId ?? null };
}

export function queueChoice(line: CustomerLine, choices: QueueChoices): QueueChoice {
  return choices[line.id] ?? defaultQueueChoice(line);
}

// The suppliers a line can go to now.
export function usableSuppliers(line: Pick<CustomerLine, 'suppliers'>): OrderInSupplier[] {
  return line.suppliers.filter((supplier) => !supplier.onHold);
}

export type QueueGroup =
  | { kind: 'supplier'; key: string; supplier: OrderInSupplier; location: { id: number; name: string } | null; lines: CustomerLine[] }
  | { kind: 'typed'; key: string; typed: TypedPurchaseLine; location: { id: number; name: string } | null; lines: CustomerLine[] };

// The purchase order a line lands on, as a key: one supplier and one branch, or the typed line's purchase order.
export function queueKey(line: CustomerLine, choice: QueueChoice): string | null {
  if (choice.linkLine != null && line.typed.some((typed) => typed.poLineId === choice.linkLine)) {
    return `typed:${line.typed.find((typed) => typed.poLineId === choice.linkLine)?.poId}`;
  }
  const supplier = choice.sourceId != null ? usableSuppliers(line).find((row) => row.sourceId === choice.sourceId) : undefined;
  return supplier ? `supplier:${supplier.sourceId}:${line.location?.id ?? 0}` : null;
}

// When a group's purchase order has to be placed: its next order time, or never (no delivery times).
function groupCutoff(group: QueueGroup): number {
  if (group.kind === 'typed') return Number.MAX_SAFE_INTEGER - 1;
  const at = group.supplier.delivery?.cutoffAt;
  return at ? Date.parse(at) : Number.MAX_SAFE_INTEGER;
}

// One group per purchase order, soonest order time first; typed lines' purchase orders after, a supplier with no
// delivery times last. Lines keep their order (oldest first).
export function groupQueue(lines: CustomerLine[], choices: QueueChoices): QueueGroup[] {
  const groups = new Map<string, QueueGroup>();
  for (const line of lines) {
    const choice = queueChoice(line, choices);
    const key = queueKey(line, choice);
    if (!key) continue;
    const found = groups.get(key);
    if (found) {
      found.lines.push(line);
      continue;
    }
    const typed = key.startsWith('typed:') ? line.typed.find((row) => row.poLineId === choice.linkLine) : undefined;
    const supplier = usableSuppliers(line).find((row) => row.sourceId === choice.sourceId);
    if (typed) groups.set(key, { kind: 'typed', key, typed, location: line.location, lines: [line] });
    else if (supplier) groups.set(key, { kind: 'supplier', key, supplier, location: line.location, lines: [line] });
  }
  const name = (group: QueueGroup) => (group.kind === 'supplier' ? group.supplier.name : group.typed.poNumber);
  return [...groups.values()].sort(
    (a, b) => groupCutoff(a) - groupCutoff(b) || name(a).localeCompare(name(b)) || (a.location?.name ?? '').localeCompare(b.location?.name ?? ''),
  );
}

// More than one branch in the queue: each group names its branch.
export function queueBranches(groups: QueueGroup[]): number {
  return new Set(groups.map((group) => group.location?.id ?? 0)).size;
}

// ------------------------------------------------------------------------------------------- words

const lineWord = (n: number) => (n === 1 ? 'line' : 'lines');
const capital = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

// "16:00 today", "12:00 tomorrow".
function clockFirst(at: string, now: string): string {
  const words = dayAndTime(at, now);
  const cut = words.lastIndexOf(' ');
  return cut > 0 ? `${words.slice(cut + 1)} ${words.slice(0, cut)}` : words;
}

function isToday(at: string, now: string): boolean {
  return dayAndTime(at, now).startsWith('today ');
}

// The time left before an order time today: "40 min left", "1 h 40 min left". Null once it has passed, or when it
// is not today.
export function timeLeftWords(cutoffAt: string | null, now: string): string | null {
  if (!cutoffAt || !isToday(cutoffAt, now)) return null;
  const minutes = Math.floor((Date.parse(cutoffAt) - Date.parse(now)) / 60_000);
  if (Number.isNaN(minutes) || minutes <= 0) return null;
  if (minutes < 60) return `${minutes} min left`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} h${rest ? ` ${rest} min` : ''} left`;
}

// Pressure is weight, never colour: medium within two hours, semibold within 15 minutes.
export type QueueUrgency = 'none' | 'soon' | 'now';
export function queueUrgency(cutoffAt: string | null, now: string): QueueUrgency {
  if (!cutoffAt) return 'none';
  const minutes = (Date.parse(cutoffAt) - Date.parse(now)) / 60_000;
  if (Number.isNaN(minutes) || minutes <= 0) return 'none';
  return minutes <= 15 ? 'now' : minutes <= 120 ? 'soon' : 'none';
}

// A group's second line (board 6o): "Order by 16:00 today · 40 min left" then "arrives tomorrow 08:30–10:30". Once
// today's time has passed: "Missed 12:00 today · next order by 12:00 tomorrow". A supplier with no times says so.
export type QueueRun = { lead: string; rest: string | null; urgency: QueueUrgency; missed: boolean; noTimes: boolean };

export function queueRunWords(supplier: Pick<OrderInSupplier, 'delivery' | 'missedCutoffAt'>, now: string): QueueRun {
  const delivery = supplier.delivery;
  const arrives = arrivesWords(delivery, now);
  if (!delivery || !arrives) return { lead: 'Delivery times not set', rest: null, urgency: 'none', missed: false, noTimes: true };
  const rest = `arrives ${arrives}`;
  if (supplier.missedCutoffAt) {
    const next = delivery.cutoffAt ? ` · next order by ${clockFirst(delivery.cutoffAt, now)}` : '';
    return { lead: `Missed ${clockTime(supplier.missedCutoffAt)} today${next}`, rest, urgency: 'none', missed: true, noTimes: false };
  }
  if (!delivery.cutoffAt) return { lead: capital(rest), rest: null, urgency: 'none', missed: false, noTimes: false };
  const left = timeLeftWords(delivery.cutoffAt, now);
  return {
    lead: `Order by ${clockFirst(delivery.cutoffAt, now)}${left ? ` · ${left}` : ''}`,
    rest,
    urgency: queueUrgency(delivery.cutoffAt, now),
    missed: false,
    noTimes: false,
  };
}

// Customer lines' order time and arrival on one line, for a supplier row outside the queue (Reorder elsewhere): "Order
// by 16:00 tomorrow · arrives Tue 24 Nov 08:30–10:30", "Missed 12:00 today · arrives tomorrow 16:00–18:00".
export function queueRunLine(supplier: Pick<OrderInSupplier, 'delivery' | 'missedCutoffAt'>, now: string): string {
  const run = queueRunWords(supplier, now);
  if (run.noTimes || !run.rest) return run.lead;
  if (run.missed && supplier.missedCutoffAt) return `Missed ${clockTime(supplier.missedCutoffAt)} today · ${run.rest}`;
  return supplier.delivery?.cutoffAt ? `Order by ${clockFirst(supplier.delivery.cutoffAt, now)} · ${run.rest}` : run.lead;
}

// The group's label: "Pennine Parts" over "joins draft PO-000015 · 3 lines"; the branch in brackets when the queue
// spans more than one.
export function queueGroupWords(group: QueueGroup, branches: number): { name: string; destination: string; count: string } {
  const branch = branches > 1 && group.location ? ` (${group.location.name})` : '';
  const count = `${group.lines.length} ${lineWord(group.lines.length)}`;
  if (group.kind === 'typed') {
    return { name: `${group.typed.poNumber}${branch}`, destination: 'has a matching line added by hand', count };
  }
  return { name: `${group.supplier.name}${branch}`, destination: orderInDestinationWords(group.supplier), count };
}

// A line as the tick box and messages name it: "Brembo 09.C306.11 for SO-000065".
export function queueLineName(line: Pick<CustomerLine, 'part' | 'order'>): string {
  return `${line.part.brand} ${line.part.number} for ${line.order.number}`;
}

// The For cell: the customer, and under it the account and customer PO, or what a retail customer has paid.
export function queueForWords(order: CustomerLineOrder): { who: string; sub: string } {
  const customer = order.customer;
  if (customer.kind === 'account') {
    const code = customer.accountNumber ?? 'Account';
    return { who: customer.name ?? 'Account customer', sub: order.customerPo ? `${code} · customer PO ${order.customerPo}` : code };
  }
  const kind = customer.kind === 'card' ? 'Retail card' : 'Cash sale';
  const paid = order.paid > 0 ? `paid ${moneyWords(order.paid)}` : 'nothing paid yet';
  return { who: customer.name ?? kind, sub: `${kind} · ${paid}` };
}

// How long a line has waited: "25 min", "3 h", "2 days".
export function queueWaitingWords(line: Pick<CustomerLine, 'since'>, now: string): string {
  return sinceWords(line.since, now);
}

// When the chosen supplier would bring the part after what the customer was told. Null when on time or unknown.
export function laterThanPromised(line: Pick<CustomerLine, 'promise'>, supplier: Pick<OrderInSupplier, 'delivery'> | null | undefined): boolean {
  const promise = line.promise;
  const delivery = supplier?.delivery;
  if (!promise || !delivery?.arrivesOn) return false;
  if (delivery.arrivesOn !== promise.arrivesOn) return delivery.arrivesOn > promise.arrivesOn;
  const by = delivery.arrivesBy ?? delivery.arrivesFrom;
  const promised = promise.arrivesBy ?? promise.arrivesFrom;
  return by != null && promised != null && by > promised;
}

function promiseWhen(promise: CustomerLinePromise, now: string): string {
  return arrivesWords({ cutoffAt: null, arrivesOn: promise.arrivesOn, arrivesFrom: promise.arrivesFrom, arrivesBy: promise.arrivesBy }, now) ?? dayWords(promise.arrivesOn, now);
}

// Under the For cell when the chosen supplier is later than promised: "Promised today 16:00–18:00".
export function queuePromisedWords(line: CustomerLine, supplier: Pick<OrderInSupplier, 'delivery'> | null | undefined, now: string): string | null {
  return line.promise && laterThanPromised(line, supplier) ? `Promised ${promiseWhen(line.promise, now)}` : null;
}

// In the supplier menu: "Later than promised: Hillside Garage was told tomorrow 08:30–10:30".
export function queuePromiseNote(line: CustomerLine, supplier: Pick<OrderInSupplier, 'delivery'>, now: string): string | null {
  if (!line.promise || !laterThanPromised(line, supplier)) return null;
  return `Later than promised: ${queueForWords(line.order).who} was told ${promiseWhen(line.promise, now)}`;
}

// How many purchase orders a sales order's lines land on, with `line` going where `choice` says.
export function queueDeliveries(lines: CustomerLine[], choices: QueueChoices, line: CustomerLine, choice: QueueChoice = queueChoice(line, choices)): number {
  const keys = new Set<string>();
  for (const each of lines) {
    if (each.order.id !== line.order.id) continue;
    const key = queueKey(each, each.id === line.id ? choice : queueChoice(each, choices));
    if (key) keys.add(key);
  }
  return keys.size;
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const deliveriesWords = (n: number) => `${NUMBER_WORDS[n] ?? n} ${n === 1 ? 'delivery' : 'deliveries'}`;

// In the supplier menu, when choosing it would split the sales order: "Splits SO-000065 across two deliveries".
export function queueSplitNote(lines: CustomerLine[], choices: QueueChoices, line: CustomerLine, sourceId: number): string | null {
  const current = queueDeliveries(lines, choices, line);
  const next = queueDeliveries(lines, choices, line, { sourceId, linkLine: null });
  return next > 1 && next > current ? `Splits ${line.order.number} across ${deliveriesWords(next)}` : null;
}

// After another supplier is chosen (board 6p): "Brembo 09.C306.11 for SO-000065 now goes to GSF Car Parts. Parts for
// SO-000065 now come in two deliveries."
export function queueMovedWords(line: CustomerLine, supplier: string, deliveries: number): string {
  const split = deliveries > 1 ? ` Parts for ${line.order.number} now come in ${deliveriesWords(deliveries)}.` : '';
  return `${queueLineName(line)} now goes to ${supplier}.${split}`;
}

const HOLD_WORDS: Record<HoldReason, string> = {
  on_stop: 'account on stop',
  over_limit: 'over the credit limit',
  customer: 'waiting for the customer',
  cannot_supply: 'its parts can’t be supplied',
};

// Why a line can't be added yet, and whether it is a block (Out Red Ink) or something to do.
export function queueBlockedWords(line: BlockedCustomerLine): { text: string; red: boolean } {
  switch (line.why) {
    case 'payment':
      return { text: 'Payment needed before ordering in', red: false };
    case 'on_hold':
      return { text: `${line.order.number} is on hold${line.holdReason ? `: ${HOLD_WORDS[line.holdReason]}` : ''}`, red: true };
    case 'supplier_on_hold':
      return { text: line.heldSuppliers.length === 1 ? `${line.heldSuppliers[0]} is on hold` : 'Every supplier for this part is on hold', red: true };
    default:
      return { text: 'No supplier lists this part: record a supplier quote on the order', red: false };
  }
}

const BLOCKED_SHORT: Record<BlockedReason, string> = { payment: 'payment', on_hold: 'hold', no_supplier: 'no supplier', supplier_on_hold: 'supplier on hold' };

// The band over the list (board 6o): what waits, the time left to the soonest order time, the oldest line, and what
// can't be added yet.
export type QueueBand = {
  lines: number;
  orders: number;
  soonest: { key: string; supplier: string; cutoffAt: string; left: string | null } | null;
  oldest: { line: CustomerLine; age: string } | null;
  blocked: number;
  blockedWhy: string;
};

export function queueBand(queue: Pick<CustomerLinesQueue, 'lines' | 'blocked'>, groups: QueueGroup[], now: string): QueueBand {
  // The next order time still to come; after today's has passed, a supplier's next one (tomorrow's).
  const timed = groups.flatMap((group) =>
    group.kind === 'supplier' && group.supplier.delivery?.cutoffAt && Date.parse(group.supplier.delivery.cutoffAt) > Date.parse(now)
      ? [{ key: group.key, supplier: group.supplier.name, cutoffAt: group.supplier.delivery.cutoffAt }]
      : [],
  );
  const soonest = timed.sort((a, b) => Date.parse(a.cutoffAt) - Date.parse(b.cutoffAt))[0];
  const oldest = [...queue.lines].sort((a, b) => Date.parse(a.since) - Date.parse(b.since) || a.id - b.id)[0];
  const why = BLOCKED_REASONS.filter((reason) => queue.blocked.some((line) => line.why === reason)).map((reason) => BLOCKED_SHORT[reason]);
  return {
    lines: queue.lines.length,
    orders: new Set(queue.lines.map((line) => line.order.id)).size,
    soonest: soonest ? { ...soonest, left: timeLeftWords(soonest.cutoffAt, now) } : null,
    oldest: oldest ? { line: oldest, age: queueWaitingWords(oldest, now) } : null,
    blocked: queue.blocked.length,
    blockedWhy: why.length ? capital(why.join(', ')) : 'Nothing',
  };
}

// "16:00", or "12:00 tomorrow" when it is not today.
export function placeByWords(cutoffAt: string, now: string): string {
  return isToday(cutoffAt, now) ? clockTime(cutoffAt) : clockFirst(cutoffAt, now);
}

// ------------------------------------------------------------------------------------------- the selection

// The selection bar (board 6o): "3 lines selected" and where they go, "2 join draft PO-000015 for Pennine Parts, 1
// starts a draft for GSF Car Parts"; one line is named. A missed order time is said once, at the end; the branch is
// named when the queue spans more than one. Lines hidden by the filter are counted.
export function queueSelectionWords(
  groups: QueueGroup[],
  selected: ReadonlySet<number>,
  hidden: ReadonlySet<number> = new Set(),
  branches = 1,
): { lead: string; rest: string; add: string } | null {
  const picked = groups
    .map((group) => ({ group, lines: group.lines.filter((line) => selected.has(line.id)) }))
    .filter((entry) => entry.lines.length > 0);
  const n = picked.reduce((sum, entry) => sum + entry.lines.length, 0);
  if (n === 0) return null;
  const add = `Add ${n} ${lineWord(n)} to purchase orders`;
  const only = picked.length === 1 ? picked[0] : null;
  const amount = (k: number) => (only ? (n === 1 ? '' : n === 2 ? 'both ' : `all ${n} `) : `${k} `);
  const parts = picked.map(({ group, lines }) => {
    const k = lines.length;
    const one = only ? n === 1 : k === 1;
    if (group.kind === 'typed') return `${amount(k)}${one ? 'is' : 'are'} linked to ${group.typed.poNumber}`;
    const s = group.supplier;
    const name = `${s.name}${branches > 1 && group.location ? ` (${group.location.name})` : ''}`;
    return `${amount(k)}${s.draft ? `${one ? 'joins' : 'join'} draft ${s.draft.number} for ${name}` : `${one ? 'starts' : 'start'} a draft for ${name}`}`;
  });
  const missed = [
    ...new Set(picked.flatMap(({ group }) => (group.kind === 'supplier' && group.supplier.missedCutoffAt ? [clockTime(group.supplier.missedCutoffAt)] : []))),
  ];
  const late = missed.length
    ? ` · missed today’s ${missed.length > 1 ? `${missed.slice(0, -1).join(', ')} and ${missed[missed.length - 1]} order times` : `${missed[0]} order time`}`
    : '';
  const shown = [...selected].filter((id) => !hidden.has(id)).length;
  const lead = n === 1 && picked[0]?.lines[0] ? queueLineName(picked[0].lines[0]) : `${n} ${lineWord(n)} selected`;
  if (shown === 0) return { lead, rest: n === 1 ? 'hidden by the filter' : n === 2 ? 'both hidden by the filter' : `all ${n} hidden by the filter`, add };
  const notShown = n - shown;
  return { lead, rest: `${notShown > 0 ? `${notShown} not shown · ` : ''}${parts.join(', ')}${late}`, add };
}

// A sales order left part-selected: "SO-000065 also has Bosch 1 987 473 566", with the lines to select.
export function queuePartSelected(lines: CustomerLine[], selected: ReadonlySet<number>): { orderNumber: string; text: string; ids: number[] } | null {
  for (const line of lines) {
    if (!selected.has(line.id)) continue;
    const others = lines.filter((other) => other.order.id === line.order.id && !selected.has(other.id));
    if (others.length === 0) continue;
    const first = others[0]!;
    const text = others.length === 1 ? `${line.order.number} also has ${first.part.brand} ${first.part.number}` : `${line.order.number} also has ${others.length} more lines`;
    return { orderNumber: line.order.number, text, ids: others.map((other) => other.id) };
  }
  return null;
}

// ------------------------------------------------------------------------------------------- adding

export type QueueAdded = {
  orders: { id: string; number: string; supplier: string; new: boolean; lines: number; units: number; cutoffAt: string | null }[];
  linked: { id: string; number: string; units: number; part: string }[];
  // What Undo takes back, per sales order.
  links: { orderId: string; ids: number[] }[];
  failed: { lineId: number; orderId: string; order: string; part: string; message: string }[];
  units: number;
};

export function readQueueAdded(data: Json): QueueAdded {
  const body = readRecord(data) ?? {};
  return {
    orders: readArray(body.orders).flatMap((item) => {
      const row = readRecord(item);
      const id = readString(row?.id);
      if (!row || !id) return [];
      return [
        {
          id,
          number: readString(row.number) ?? '',
          supplier: readString(row.supplier) ?? '',
          new: readBoolean(row.new) ?? false,
          lines: readNumber(row.lines) ?? 0,
          units: readNumber(row.units) ?? 0,
          cutoffAt: readString(row.cutoff_at),
        },
      ];
    }),
    linked: readArray(body.linked).flatMap((item) => {
      const row = readRecord(item);
      const id = readString(row?.id);
      return row && id ? [{ id, number: readString(row.number) ?? '', units: readNumber(row.units) ?? 0, part: readString(row.part) ?? '' }] : [];
    }),
    links: readArray(body.links).flatMap((item) => {
      const row = readRecord(item);
      const orderId = readString(row?.order_id);
      const ids = readArray(row?.ids).flatMap((id) => (typeof id === 'number' ? [id] : []));
      return orderId && ids.length > 0 ? [{ orderId, ids }] : [];
    }),
    failed: readArray(body.failed).flatMap((item) => {
      const row = readRecord(item);
      const lineId = readNumber(row?.line_id);
      if (!row || lineId == null) return [];
      return [
        {
          lineId,
          orderId: readString(row.order_id) ?? '',
          order: readString(row.order) ?? '',
          part: readString(row.part) ?? '',
          message: readString(row.message) ?? 'It couldn’t be added',
        },
      ];
    }),
    units: readNumber(body.units) ?? 0,
  };
}

function failedWords(failed: QueueAdded['failed']): string {
  return failed
    .map((row) => {
      const message = row.message.replace(/\.$/, '');
      return message.includes(row.order) ? message : `${row.part} for ${row.order}: ${message}`;
    })
    .join('; ');
}

// The one message after Add (board 6p): "3 lines added: 2 to draft PO-000015 for Pennine Parts (place by 16:00), 1 to
// new draft PO-000016 for GSF Car Parts (place by 17:00)." What couldn't be added is named after it.
export function queueAddedWords(done: QueueAdded, now: string): { text: string; added: number } {
  const added = done.orders.reduce((sum, order) => sum + order.lines, 0) + done.linked.length;
  const placeBy = (order: QueueAdded['orders'][number]) => (order.cutoffAt ? ` (place by ${placeByWords(order.cutoffAt, now)})` : '');
  const draft = (order: QueueAdded['orders'][number]) => `${order.new ? 'new draft' : 'draft'} ${order.number} for ${order.supplier}`;
  const failed = done.failed.length ? ` ${done.failed.length} couldn’t be added: ${failedWords(done.failed)}.` : '';
  if (added === 0) return { text: `Couldn’t add the lines: ${failedWords(done.failed) || 'nothing was left to order'}.`, added };
  const first = done.orders[0];
  if (done.orders.length === 1 && done.linked.length === 0 && first) {
    return { text: `${added} ${lineWord(added)} added to ${draft(first)}${placeBy(first)}.${failed}`, added };
  }
  const parts = [
    ...done.orders.map((order) => `${order.lines} to ${draft(order)}${placeBy(order)}`),
    ...done.linked.map((line) => `${line.part} linked to ${line.number}`),
  ];
  return { text: `${added} ${lineWord(added)} added: ${parts.join(', ')}.${failed}`, added };
}

// The purchase order to place next after an Add: the soonest order time among those the lines went on.
export function queueNextToPlace(done: QueueAdded): QueueAdded['orders'][number] | null {
  const timed = done.orders.filter((order) => order.cutoffAt).sort((a, b) => Date.parse(a.cutoffAt!) - Date.parse(b.cutoffAt!));
  return timed[0] ?? done.orders[0] ?? null;
}

// A needs row under the band (board 6p) for a draft due to be placed within two hours: "PO-000015 for Pennine Parts is
// a draft, not yet placed · order by 16:00 today · 38 min left · 1 more line here would join it".
export function queueDraftNeeds(queue: Pick<CustomerLinesQueue, 'drafts'>, groups: QueueGroup[], now: string): { draft: DraftToPlace; text: string; left: string | null }[] {
  return queue.drafts.flatMap((draft) => {
    if (!draft.cutoffAt || queueUrgency(draft.cutoffAt, now) === 'none') return [];
    const more = groups.reduce(
      (sum, group) => sum + (group.kind === 'supplier' && group.supplier.draft?.id === draft.id ? group.lines.length : 0),
      0,
    );
    const left = timeLeftWords(draft.cutoffAt, now);
    const tail = more > 0 ? ` · ${more} more ${lineWord(more)} here would join it` : '';
    return [{ draft, left, text: `${draft.number} for ${draft.supplier} is a draft, not yet placed · order by ${clockFirst(draft.cutoffAt, now)}${tail}` }];
  });
}

// ------------------------------------------------------------------------------------------- calls

export type QueueAddChoice = { id: number; sourceId?: number | null; linkLine?: number | null };

export function queueAddFields(choices: QueueAddChoice[]): Json[] {
  return choices.map((choice) => {
    const p: { [key: string]: Json } = { id: choice.id };
    if (choice.linkLine != null) p.link_line = choice.linkLine;
    if (choice.sourceId != null) p.source_id = choice.sourceId;
    return p;
  });
}

// What Add sends for the ticked lines: where each goes.
export function queueAddChoices(lines: CustomerLine[], choices: QueueChoices, selected: ReadonlySet<number>): QueueAddChoice[] {
  return lines.flatMap((line): QueueAddChoice[] => {
    if (!selected.has(line.id)) return [];
    const choice = queueChoice(line, choices);
    if (choice.linkLine != null && line.typed.some((typed) => typed.poLineId === choice.linkLine)) return [{ id: line.id, linkLine: choice.linkLine, sourceId: choice.sourceId }];
    return choice.sourceId != null ? [{ id: line.id, sourceId: choice.sourceId }] : [];
  });
}

export function getCustomerLinesQueue(supabase: Client, locationId?: number | null): Promise<CustomerLinesQueue> {
  return call(supabase.rpc('purchase_orders_customer_lines', { p: locationId != null ? { location_id: locationId } : {} }), readCustomerLinesQueue);
}

export function addCustomerLines(supabase: Client, choices: QueueAddChoice[]): Promise<QueueAdded> {
  return call(supabase.rpc('purchase_orders_add_customer_lines', { p: { lines: queueAddFields(choices) } }), readQueueAdded);
}

// Undo, while the drafts are untouched: takes the lines back off and drops a draft the Add started and left empty.
export function undoCustomerLines(supabase: Client, links: QueueAdded['links']): Promise<void> {
  return call(
    supabase.rpc('purchase_orders_undo_customer_lines', { p: { links: links.map((link) => ({ order_id: link.orderId, ids: link.ids })) } }),
    () => undefined,
  );
}
