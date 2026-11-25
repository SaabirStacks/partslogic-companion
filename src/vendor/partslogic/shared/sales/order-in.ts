import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readBoolean, readNumber, readRecord, readString, readStrings } from '../core/read';
import { readOfferDelivery, type OfferDelivery } from './offers';
import { clockTime, dayAndTime, dayWords, deliveryWords, moneyWords, quantityWords } from './words';

// Ordering in (docs/SALES.md 13.11, canvas boards 6k and 6l). A confirmed order puts the parts it is short of on the
// supplier's draft purchase order for its branch, and keeps each purchase order as a linked document. The supply
// link says where each unit stands: drafted, awaiting approval, ordered, arrived. Every rule is the database's.

// ------------------------------------------------------------------------------------------- where a unit stands

export const SUPPLY_STATES = ['drafted', 'awaiting_approval', 'approved', 'ordered', 'arrived', 'done'] as const;
export type SupplyState = (typeof SUPPLY_STATES)[number];
export const SUPPLY_STATE_LABELS: Record<SupplyState, string> = {
  drafted: 'Drafted',
  awaiting_approval: 'Awaiting approval',
  approved: 'Approved',
  ordered: 'Ordered',
  arrived: 'Arrived',
  done: 'Set aside',
};

type Expected = { expectedOn: string | null; expectedFrom: string | null; expectedBy: string | null };
type PurchaseTiming = Expected & {
  approvalRequestedAt: string | null;
  placedAt: string | null;
  // Days past the date due, while units are still to come; null when not late.
  lateDays: number | null;
  // A draft's next delivery run, and the order-by time it has missed since its units went on.
  nextDelivery: OfferDelivery | null;
  missedCutoffAt: string | null;
};

// One link from a sales line to a purchase order line. `units` are still to come; `arrived` came and wait to be set aside.
export type SupplyLink = PurchaseTiming & {
  id: number;
  poId: string;
  poNumber: string;
  poStatus: string;
  state: SupplyState;
  supplierId: number | null;
  supplier: string;
  qty: number;
  units: number;
  arrived: number;
  at: string | null;
  // Only for a person allowed to see cost.
  unitCost: number | null;
};

// A purchase order the sales order waits on, for Linked documents and the needs list.
export type LinkedPurchaseOrder = PurchaseTiming & {
  id: string;
  number: string;
  status: string;
  state: SupplyState;
  supplierId: number | null;
  supplier: string;
  lines: number;
  units: number;
  arrived: number;
};

export const TAKEN_PAYMENT_METHODS = ['card', 'cash', 'bank_transfer'] as const;
export type TakenPaymentMethod = (typeof TAKEN_PAYMENT_METHODS)[number];
export const TAKEN_PAYMENT_LABELS: Record<TakenPaymentMethod, string> = { card: 'Card', cash: 'Cash', bank_transfer: 'Bank transfer' };

// What a retail customer has paid towards the order. `needed`: a part can't be ordered in until the rest is paid.
export type PaymentTaken = {
  required: boolean;
  needed: boolean;
  totalInc: number;
  taken: number;
  short: number;
  unpaidReason: string | null;
  unpaidAt: string | null;
  unpaidBy: string | null;
  // An admin may order in without payment, with a reason.
  canSkip: boolean;
  entries: { amount: number; method: TakenPaymentMethod; at: string; by: string | null }[];
};

// ------------------------------------------------------------------------------------------- choosing where from

export type OrderInSupplier = {
  sourceId: number;
  name: string;
  preferred: boolean;
  // The supplier the part was offered from.
  offer: boolean;
  onHold: boolean;
  delivery: OfferDelivery | null;
  missedCutoffAt: string | null;
  // The draft the part would join, or the draft that is waiting for approval, so a new one starts.
  draft: { id: string; number: string } | null;
  waiting: { id: string; number: string; approval: string } | null;
  cost: number | null;
};

// A line typed on a purchase order by hand for this order, before ordering in existed.
export type TypedPurchaseLine = { poLineId: number; poId: string; poNumber: string; status: string; qty: number; free: number; reference: string | null };

export type OrderInLine = {
  id: number;
  partId: number;
  brand: string;
  number: string;
  description: string | null;
  units: number;
  offerSourceId: number | null;
  // Soonest arrival first; the preferred one marked.
  suppliers: OrderInSupplier[];
  // The offer's supplier, else the preferred, else the soonest; null when nobody can take the order.
  defaultSourceId: number | null;
  typed: TypedPurchaseLine[];
};

export type OrderInOptions = {
  lines: OrderInLine[];
  // What each purchase order line will say: "SO-000061 · HG-2291".
  reference: string;
  location: { id: number; name: string } | null;
  payment: PaymentTaken;
};

export type OrderInPreview = OrderInOptions & { id: string; number: string; customer: string | null; registrations: string[] };

// One part to order in: from a supplier, or by linking a line typed by hand (and any units left from the supplier).
export type OrderInChoice = { id: number; sourceId?: number | null; units?: number | null; linkLine?: number | null };
export type PaymentInput = { amount: number; method: TakenPaymentMethod };

export type OrderedIn = {
  orders: { id: string; number: string; supplier: string; units: number; lines: number; new: boolean }[];
  linked: { id: string; number: string; units: number; part: string }[];
  // The links made, for Undo.
  links: number[];
  units: number;
};

// ------------------------------------------------------------------------------------------- readers

function readTiming(row: { [key: string]: Json | undefined }): PurchaseTiming {
  return {
    approvalRequestedAt: readString(row.approval_requested_at),
    placedAt: readString(row.placed_at),
    expectedOn: readString(row.expected_on),
    expectedFrom: readString(row.expected_from),
    expectedBy: readString(row.expected_by),
    lateDays: readNumber(row.late_days),
    nextDelivery: readOfferDelivery(row.next_delivery),
    missedCutoffAt: readString(row.missed_cutoff_at),
  };
}

function readState(value: Json | undefined): SupplyState {
  return typeof value === 'string' && (SUPPLY_STATES as readonly string[]).includes(value) ? (value as SupplyState) : 'drafted';
}

export function readSupplyLinks(value: Json | undefined): SupplyLink[] {
  return readArray(value).flatMap((item) => {
    const row = readRecord(item);
    const id = readNumber(row?.id);
    const poId = readString(row?.po_id);
    if (!row || id == null || !poId) return [];
    return [
      {
        ...readTiming(row),
        id,
        poId,
        poNumber: readString(row.po_number) ?? '',
        poStatus: readString(row.po_status) ?? 'draft',
        state: readState(row.state),
        supplierId: readNumber(row.supplier_id),
        supplier: readString(row.supplier) ?? '',
        qty: readNumber(row.qty) ?? 0,
        units: readNumber(row.units) ?? 0,
        arrived: readNumber(row.arrived) ?? 0,
        at: readString(row.at),
        unitCost: readNumber(row.unit_cost),
      },
    ];
  });
}

export function readLinkedPurchaseOrders(value: Json | undefined): LinkedPurchaseOrder[] {
  return readArray(value).flatMap((item) => {
    const row = readRecord(item);
    const id = readString(row?.id);
    if (!row || !id) return [];
    return [
      {
        ...readTiming(row),
        id,
        number: readString(row.number) ?? '',
        status: readString(row.status) ?? 'draft',
        state: readState(row.state),
        supplierId: readNumber(row.supplier_id),
        supplier: readString(row.supplier) ?? '',
        lines: readNumber(row.lines) ?? 0,
        units: readNumber(row.units) ?? 0,
        arrived: readNumber(row.arrived) ?? 0,
      },
    ];
  });
}

function readMethod(value: Json | undefined): TakenPaymentMethod {
  return typeof value === 'string' && (TAKEN_PAYMENT_METHODS as readonly string[]).includes(value) ? (value as TakenPaymentMethod) : 'card';
}

export function readPaymentTaken(value: Json | undefined): PaymentTaken {
  const row = readRecord(value) ?? {};
  return {
    required: readBoolean(row.required) ?? false,
    needed: readBoolean(row.needed) ?? false,
    totalInc: readNumber(row.total_inc) ?? 0,
    taken: readNumber(row.taken) ?? 0,
    short: readNumber(row.short) ?? 0,
    unpaidReason: readString(row.unpaid_reason),
    unpaidAt: readString(row.unpaid_at),
    unpaidBy: readString(row.unpaid_by),
    canSkip: readBoolean(row.can_skip) ?? false,
    entries: readArray(row.entries).flatMap((item) => {
      const entry = readRecord(item);
      const at = readString(entry?.at);
      return entry && at ? [{ amount: readNumber(entry.amount) ?? 0, method: readMethod(entry.method), at, by: readString(entry.by) }] : [];
    }),
  };
}

function readPair(value: Json | undefined): { id: string; number: string } | null {
  const row = readRecord(value);
  const id = readString(row?.id);
  return row && id ? { id, number: readString(row.number) ?? '' } : null;
}

// The suppliers that list a part, as Order in and Customer lines read them.
export function readOrderInSuppliers(value: Json | undefined): OrderInSupplier[] {
  return readArray(value).flatMap((entry) => {
    const supplier = readRecord(entry);
    const sourceId = readNumber(supplier?.source_id);
    if (!supplier || sourceId == null) return [];
    const waiting = readRecord(supplier.waiting);
    const waitingId = readString(waiting?.id);
    return [
      {
        sourceId,
        name: readString(supplier.name) ?? '',
        preferred: readBoolean(supplier.preferred) ?? false,
        offer: readBoolean(supplier.offer) ?? false,
        onHold: readBoolean(supplier.on_hold) ?? false,
        delivery: readOfferDelivery(supplier.delivery),
        missedCutoffAt: readString(supplier.missed_cutoff_at),
        draft: readPair(supplier.draft),
        waiting: waiting && waitingId ? { id: waitingId, number: readString(waiting.number) ?? '', approval: readString(waiting.approval) ?? 'requested' } : null,
        cost: readNumber(supplier.cost),
      },
    ];
  });
}

// Lines typed on a purchase order by hand that name the sales order.
export function readTypedPurchaseLines(value: Json | undefined): TypedPurchaseLine[] {
  return readArray(value).flatMap((entry) => {
    const typed = readRecord(entry);
    const poLineId = readNumber(typed?.po_line_id);
    const poId = readString(typed?.po_id);
    if (!typed || poLineId == null || !poId) return [];
    return [
      {
        poLineId,
        poId,
        poNumber: readString(typed.po_number) ?? '',
        status: readString(typed.status) ?? 'draft',
        qty: readNumber(typed.qty) ?? 0,
        free: readNumber(typed.free) ?? 0,
        reference: readString(typed.reference),
      },
    ];
  });
}

export function readOrderInOptions(value: Json | undefined): OrderInOptions {
  const body = readRecord(value) ?? {};
  const location = readRecord(body.location);
  const locationId = readNumber(location?.id);
  return {
    lines: readArray(body.lines).flatMap((item) => {
      const row = readRecord(item);
      const id = readNumber(row?.id);
      const partId = readNumber(row?.part_id);
      if (!row || id == null || partId == null) return [];
      return [
        {
          id,
          partId,
          brand: readString(row.brand) ?? '',
          number: readString(row.number) ?? '',
          description: readString(row.description),
          units: readNumber(row.units) ?? 0,
          offerSourceId: readNumber(row.offer_source_id),
          suppliers: readOrderInSuppliers(row.suppliers),
          defaultSourceId: readNumber(row.default_source_id),
          typed: readTypedPurchaseLines(row.typed),
        },
      ];
    }),
    reference: readString(body.reference) ?? '',
    location: location && locationId != null ? { id: locationId, name: readString(location.name) ?? '' } : null,
    payment: readPaymentTaken(body.payment),
  };
}

export function readOrderInPreview(data: Json): OrderInPreview {
  const body = readRecord(data) ?? {};
  return {
    ...readOrderInOptions(data),
    id: readString(body.id) ?? '',
    number: readString(body.number) ?? '',
    customer: readString(body.customer),
    registrations: readStrings(body.registrations),
  };
}

export function readOrderedIn(value: Json | undefined): OrderedIn | null {
  const body = readRecord(value);
  if (!body) return null;
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
          units: readNumber(row.units) ?? 0,
          lines: readNumber(row.lines) ?? 0,
          new: readBoolean(row.new) ?? false,
        },
      ];
    }),
    linked: readArray(body.linked).flatMap((item) => {
      const row = readRecord(item);
      const id = readString(row?.id);
      return row && id ? [{ id, number: readString(row.number) ?? '', units: readNumber(row.units) ?? 0, part: readString(row.part) ?? '' }] : [];
    }),
    links: readArray(body.links).flatMap((item) => (typeof item === 'number' ? [item] : [])),
    units: readNumber(body.units) ?? 0,
  };
}

// ------------------------------------------------------------------------------------------- calls

export function orderInChoiceFields(choices: OrderInChoice[]): Json[] {
  return choices.map((choice) => {
    const p: { [key: string]: Json } = { id: choice.id };
    if (choice.sourceId != null) p.source_id = choice.sourceId;
    if (choice.units != null) p.units = choice.units;
    if (choice.linkLine != null) p.link_line = choice.linkLine;
    return p;
  });
}

export function paymentFields(payment: PaymentInput): { [key: string]: Json } {
  return { amount: Math.round(payment.amount * 100) / 100, method: payment.method };
}

export function orderInFields(input: { lines: OrderInChoice[]; payment?: PaymentInput | null; unpaidReason?: string | null }): { [key: string]: Json } {
  const p: { [key: string]: Json } = { lines: orderInChoiceFields(input.lines) };
  if (input.payment) p.payment = paymentFields(input.payment);
  if (input.unpaidReason?.trim()) p.unpaid_reason = input.unpaidReason.trim();
  return p;
}

// The choices for Order in: every line still to order, or one line (its Where cell's Order in).
export function previewOrderIn(supabase: Client, orderId: string, lineId?: number | null): Promise<OrderInPreview> {
  return call(supabase.rpc('sales_order_order_in_preview', lineId != null ? { p_id: orderId, p_line: lineId } : { p_id: orderId }), readOrderInPreview);
}

export function orderIn(supabase: Client, orderId: string, input: { lines: OrderInChoice[]; payment?: PaymentInput | null; unpaidReason?: string | null }): Promise<OrderedIn> {
  return call(supabase.rpc('sales_order_order_in', { p_id: orderId, p: orderInFields(input) }), (data) => readOrderedIn(data) ?? { orders: [], linked: [], links: [], units: 0 });
}

// Undo, while the drafts are untouched: takes the units back off and drops a draft the order started and left empty.
export function undoOrderIn(supabase: Client, orderId: string, links: number[]): Promise<void> {
  return call(supabase.rpc('sales_order_undo_order_in', { p_id: orderId, p_links: links }), () => undefined);
}

// ------------------------------------------------------------------------------------------- words

const unitWords = (n: number) => `${quantityWords(n)} ${n === 1 ? 'unit' : 'units'}`;

function timeWords(at: string, now: string): string {
  const words = dayAndTime(at, now);
  return words.startsWith('today ') ? words.slice(6) : words;
}

// "16:00 today", "tomorrow 16:00".
function orderByWords(at: string, now: string): string {
  const words = dayAndTime(at, now);
  return words.startsWith('today ') ? `${words.slice(6)} today` : words;
}

function windowWords(timing: Expected): string {
  return timing.expectedFrom && timing.expectedBy ? ` ${timing.expectedFrom}–${timing.expectedBy}` : timing.expectedFrom ? ` from ${timing.expectedFrom}` : '';
}

// When a draft's units would arrive if it were placed in time: "tomorrow 08:30–10:30". Null without delivery times.
export function arrivesWords(delivery: OfferDelivery | null, now: string): string | null {
  if (!delivery?.arrivesOn) return null;
  const window = delivery.arrivesFrom && delivery.arrivesBy ? ` ${delivery.arrivesFrom}–${delivery.arrivesBy}` : delivery.arrivesFrom ? ` from ${delivery.arrivesFrom}` : '';
  return `${dayWords(delivery.arrivesOn, now)}${window}`;
}

// A placed order's due date: "due tomorrow 08:30–10:30", "↑ Due yesterday" when late.
function dueWords(timing: PurchaseTiming, now: string): { text: string; late: boolean } {
  if (!timing.expectedOn) return { text: 'no date given', late: false };
  if (timing.lateDays != null && timing.lateDays > 0) return { text: `↑ Due ${dayWords(timing.expectedOn, now)}`, late: true };
  return { text: `due ${dayWords(timing.expectedOn, now)}${windowWords(timing)}`, late: false };
}

// The Where cell for units on a purchase order (board 6l): the state with the order number (a link on the page), and
// under it the supplier with what happens next.
export function supplyWhere(link: Pick<SupplyLink, 'state' | 'supplier' | 'units' | 'arrived'> & PurchaseTiming, now: string): { state: string; sub: string; late: boolean } {
  const state = SUPPLY_STATE_LABELS[link.state];
  if (link.state === 'drafted') {
    const next = link.nextDelivery;
    if (link.missedCutoffAt) {
      const arrives = arrivesWords(next, now);
      return { state, sub: `Missed ${clockTime(link.missedCutoffAt)}${arrives ? ` · now arrives ${arrives}` : ''}`, late: false };
    }
    if (next?.cutoffAt) return { state, sub: `${link.supplier} · order by ${orderByWords(next.cutoffAt, now)}`, late: false };
    return { state, sub: `${link.supplier} · ${deliveryWords(next, null, now)}`, late: false };
  }
  if (link.state === 'awaiting_approval') {
    return { state, sub: `${link.supplier}${link.approvalRequestedAt ? ` · sent ${timeWords(link.approvalRequestedAt, now)}` : ''}`, late: false };
  }
  if (link.state === 'approved') return { state, sub: `${link.supplier} · not placed yet`, late: false };
  if (link.state === 'ordered') {
    const due = dueWords(link, now);
    return { state, sub: due.late ? due.text : `${link.supplier} · ${due.text}`, late: due.late };
  }
  if (link.state === 'arrived') return { state, sub: `${unitWords(link.arrived)} ${link.arrived === 1 ? 'waits' : 'wait'} to be set aside`, late: false };
  return { state, sub: '', late: false };
}

// The needs list line for one purchase order the sales order waits on (board 6l). Null when nothing is needed: an
// ordered purchase order on time waits for the delivery.
export function supplyNeedWords(po: LinkedPurchaseOrder, now: string): string | null {
  const units = unitWords(po.units);
  const arrives = arrivesWords(po.nextDelivery, now);
  if (po.state === 'drafted') {
    if (po.missedCutoffAt) return `${po.number} missed ${clockTime(po.missedCutoffAt)}: placed now, ${po.units === 1 ? 'it arrives' : 'they arrive'} ${arrives ?? 'on the next delivery'}.`;
    const by = po.nextDelivery?.cutoffAt ? timeWords(po.nextDelivery.cutoffAt, now) : null;
    return `${units} ${po.units === 1 ? 'is' : 'are'} on draft ${po.number} for ${po.supplier} and not ordered yet.${by && arrives ? ` Placed by ${by}, ${po.units === 1 ? 'it arrives' : 'they arrive'} ${arrives}.` : ''}`;
  }
  if (po.state === 'awaiting_approval') {
    const by = po.nextDelivery?.cutoffAt ? timeWords(po.nextDelivery.cutoffAt, now) : null;
    const when = by && arrives ? ` If it is approved and placed by ${by}, ${po.units === 1 ? 'it arrives' : 'they arrive'} ${arrives.replace(/ \d\d:\d\d.*$/, '')}.` : '';
    return `${po.number} is waiting for approval, so ${units} ${po.units === 1 ? 'is' : 'are'} not ordered yet.${when}`;
  }
  if (po.state === 'approved') return `${po.number} is approved and not placed yet, so ${units} ${po.units === 1 ? 'is' : 'are'} not ordered yet.`;
  if (po.state === 'ordered' && po.lateDays != null && po.lateDays > 0) {
    return `${po.number} is ${po.lateDays === 1 ? 'a day' : `${po.lateDays} days`} late for ${units}.`;
  }
  if (po.arrived > 0) return `${unitWords(po.arrived)} arrived on ${po.number}: set ${po.arrived === 1 ? 'it' : 'them'} aside on the line.`;
  return null;
}

// Linked documents: "Purchase order · Draft · Pennine Parts · 2 lines for this order".
export function linkedPurchaseOrderWords(po: LinkedPurchaseOrder): string {
  const state =
    po.status === 'draft'
      ? po.state === 'awaiting_approval'
        ? 'Awaiting approval'
        : po.state === 'approved'
          ? 'Approved'
          : 'Draft'
      : po.status === 'part_received'
        ? 'Part received'
        : po.status === 'received'
          ? 'Received'
          : po.status === 'placed'
            ? 'Placed'
            : po.status.charAt(0).toUpperCase() + po.status.slice(1).replace(/_/g, ' ');
  return ['Purchase order', state, po.supplier, `${po.lines} ${po.lines === 1 ? 'line' : 'lines'} for this order`].filter(Boolean).join(' · ');
}

// The one message after ordering in (board 6l): "2 units added to draft PO-000007 for Pennine Parts."
export function orderedInWords(done: OrderedIn): string {
  const parts = [
    ...done.orders.map((order) => `${unitWords(order.units)} ${order.new ? 'on new draft' : 'added to draft'} ${order.number} for ${order.supplier}`),
    ...done.linked.map((line) => `${unitWords(line.units)} linked to ${line.number}`),
  ];
  if (parts.length === 0) return 'Nothing was ordered in.';
  const text = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : (parts[0] ?? '');
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

// After Confirm, the part of the message about ordering in: "2 on draft PO-000007 for Pennine Parts".
export function orderedInShortWords(done: OrderedIn): string {
  const parts = [
    ...done.orders.map((order) => `${quantityWords(order.units)} on ${order.new ? 'new ' : ''}draft ${order.number} for ${order.supplier}`),
    ...done.linked.map((line) => `${quantityWords(line.units)} linked to ${line.number}`),
  ];
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : (parts[0] ?? '');
}

// Under a supplier in the Order in rows: "Order by 16:00 · arrives tomorrow 08:30–10:30", or "Delivery times not set".
export function orderInRunWords(supplier: Pick<OrderInSupplier, 'delivery' | 'missedCutoffAt'>, now: string): string {
  return deliveryWords(supplier.delivery, supplier.missedCutoffAt, now);
}

// A supplier in the supplier menu (Order in and Customer lines): "Order by 16:00 · arrives tomorrow 08:30–10:30 ·
// joins draft PO-000015", or "Missed 12:00 today · arrives tomorrow 16:00–18:00 · starts a draft".
export function supplierMenuWords(supplier: Pick<OrderInSupplier, 'delivery' | 'missedCutoffAt' | 'draft' | 'waiting'>, now: string): string {
  const arrives = arrivesWords(supplier.delivery, now);
  const run = supplier.missedCutoffAt && arrives ? `Missed ${clockTime(supplier.missedCutoffAt)} today · arrives ${arrives}` : orderInRunWords(supplier, now);
  return `${run} · ${orderInDestinationWords(supplier)}`;
}

// Where the parts go: "joins draft PO-000007", "starts a draft", "starts a draft: PO-000007 is awaiting approval".
export function orderInDestinationWords(supplier: Pick<OrderInSupplier, 'draft' | 'waiting'>): string {
  if (supplier.draft) return `joins draft ${supplier.draft.number}`;
  if (supplier.waiting) return `starts a draft: ${supplier.waiting.number} is ${supplier.waiting.approval === 'approved' ? 'approved and not placed' : 'awaiting approval'}`;
  return 'starts a draft';
}

// The help under the Order in tick box (board 6l).
export function orderInHelpWords(options: Pick<OrderInOptions, 'reference' | 'location'>, registrations: string[], parts: number): string {
  const [number, po] = options.reference.split(' · ');
  const place = options.location?.name ?? 'this branch';
  const lead = parts === 1 ? 'It joins' : 'Each joins';
  const plates = registrations.length > 0 ? `; ${registrations.join(', ')} ${registrations.length === 1 ? 'goes' : 'go'} on its vehicles` : '';
  return `${lead} the supplier’s draft for ${place} with ${number}${po ? ` and customer PO ${po}` : ''}${plates}. Someone who may place orders places it.`;
}

// Payment taken, for the order's history and the Customer card: "£57.59 by card".
export function paymentTakenWords(entry: { amount: number; method: TakenPaymentMethod }): string {
  return `${moneyWords(entry.amount)} by ${TAKEN_PAYMENT_LABELS[entry.method].toLowerCase()}`;
}
