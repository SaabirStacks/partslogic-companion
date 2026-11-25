import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readBoolean, readNumber, readRecord, readString, type JsonRecord } from '../core/read';
import {
  CANNOT_SUPPLY_PREFERENCE_LABELS,
  CANNOT_SUPPLY_PREFERENCES,
  isCannotSupplyPreference,
  type CannotSupplyPreference,
} from '../customers/cannot-supply';
import type { EnquiryCustomer } from './enquiries';
import { PART_FITS, type PartFit } from './offers';
import { greetingName } from './put-aside';
import { dateWords, dayAndTime, moneyWords, quantityWords } from './words';

// Cannot supply (docs/SALES.md 13.14, board 6q). When Purchasing cancels or closes short a line it ordered for a
// customer, for a reason that is the supplier's fault, those units can't be supplied. The account's preference says
// who acts first; the database decides the next step on each failure and these wrappers read it, word it and send
// the counter's answers. Copying the message counts as asking or telling the customer; nothing is sent from the app.

// The customer's answer when asked: the three preferences that act, and wait (only while the suppliers listing the
// part are on hold; slice three a).
export const CUSTOMER_ANSWERS = ['same_part', 'equivalent', 'take_off', 'wait'] as const;
export type CustomerAnswer = (typeof CUSTOMER_ANSWERS)[number];
export function isCustomerAnswer(value: unknown): value is CustomerAnswer {
  return typeof value === 'string' && (CUSTOMER_ANSWERS as readonly string[]).includes(value);
}
export const CUSTOMER_ANSWER_LABELS: Record<CustomerAnswer, string> = {
  same_part: CANNOT_SUPPLY_PREFERENCE_LABELS.same_part,
  equivalent: CANNOT_SUPPLY_PREFERENCE_LABELS.equivalent,
  take_off: CANNOT_SUPPLY_PREFERENCE_LABELS.take_off,
  wait: 'Wait for the supplier',
};

// How the customer was asked, answered or told. Copy message records 'message'.
export const CUSTOMER_CHANNELS = ['message', 'phone', 'whatsapp', 'counter', 'email'] as const;
export type CustomerChannel = (typeof CUSTOMER_CHANNELS)[number];
export const CUSTOMER_CHANNEL_LABELS: Record<CustomerChannel, string> = {
  message: 'Message copied',
  phone: 'Phone',
  whatsapp: 'WhatsApp',
  counter: 'Counter',
  email: 'Email',
};
export function isCustomerChannel(value: unknown): value is CustomerChannel {
  return typeof value === 'string' && (CUSTOMER_CHANNELS as readonly string[]).includes(value);
}
// How it came, inside a sentence: "on WhatsApp", "at the counter".
export const CUSTOMER_CHANNEL_PHRASE: Record<CustomerChannel, string> = {
  message: 'by message',
  phone: 'by phone',
  whatsapp: 'on WhatsApp',
  counter: 'at the counter',
  email: 'by email',
};

// The next step on a failure, and who takes it: purchasing reorders; the counter asks, records the answer, replaces
// the part or takes it off. wait: the customer chose to wait for a supplier on hold, and nothing is due until the day
// to ask again.
export const FAILURE_STEPS = ['reorder', 'ask', 'answer', 'replace', 'take_off', 'wait'] as const;
export type FailureStep = (typeof FAILURE_STEPS)[number];
export function failureHolder(step: FailureStep): 'purchasing' | 'counter' {
  return step === 'reorder' ? 'purchasing' : 'counter';
}

// Where a replacement's units come from.
export type ReplacedSupply = 'stock' | 'branch' | 'order_in';
const REPLACED_SUPPLIES: readonly ReplacedSupply[] = ['stock', 'branch', 'order_in'];
export function readReplacedSupply(value: Json | undefined): ReplacedSupply {
  return (REPLACED_SUPPLIES as readonly string[]).includes(value as string) ? (value as ReplacedSupply) : 'stock';
}

// The line that replaced a part, as an order's failures carry it while the customer is still to be told: where its
// units come from, and once ordered in, the purchase order it is on.
export type ReplacedPart = {
  lineId: number;
  part: string;
  supply: ReplacedSupply;
  setAside: number;
  place: string | null;
  po: { poId: string; poNumber: string; state: string; supplier: string | null; expectedOn: string | null } | null;
};

export function readReplacedPart(value: Json | undefined): ReplacedPart | null {
  const row = readRecord(value);
  const lineId = readNumber(row?.line_id);
  if (!row || lineId == null) return null;
  const po = readRecord(row.po);
  const poId = readString(po?.po_id);
  return {
    lineId,
    part: readString(row.part) ?? '',
    supply: readReplacedSupply(row.supply),
    setAside: readNumber(row.set_aside) ?? 0,
    place: readString(row.place),
    po: po && poId
      ? { poId, poNumber: readString(po.po_number) ?? '', state: readString(po.state) ?? 'drafted', supplier: readString(po.supplier), expectedOn: readString(po.expected_on) }
      : null,
  };
}

// A substitute the supplier sent in place of the part (S4b part three b, slice two b): held for the order while the
// customer decides (set aside, nobody else's to sell), then used, refused (to Substitutes to return), returned or kept
// as stock. price is what it costs this customer; margin only for someone who may see it.
export const SUBSTITUTE_STATES = ['held', 'used', 'refused', 'returned', 'stocked'] as const;
export type SubstituteState = (typeof SUBSTITUTE_STATES)[number];
export type HeldSubstitute = {
  id: number;
  partId: number;
  part: string;
  brand: string;
  number: string;
  description: string | null;
  units: number;
  state: SubstituteState;
  place: string | null;
  receiptNumber: string;
  receivedOn: string | null;
  returnBy: string | null;
  price: number | null;
  margin: number | null;
  fit: PartFit | null;
};

export function readHeldSubstitute(value: Json | undefined): HeldSubstitute | null {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  const partId = readNumber(row?.part_id);
  if (!row || id == null || partId == null) return null;
  return {
    id,
    partId,
    part: readString(row.part) ?? '',
    brand: readString(row.brand) ?? '',
    number: readString(row.number) ?? '',
    description: readString(row.description),
    units: readNumber(row.units) ?? 0,
    state: oneOf(SUBSTITUTE_STATES, row.state) ?? 'held',
    place: readString(row.place),
    receiptNumber: readString(row.receipt_number) ?? '',
    receivedOn: readString(row.received_on),
    returnBy: readString(row.return_by),
    price: readNumber(row.price),
    margin: readNumber(row.margin),
    fit: oneOf(PART_FITS, row.fit),
  };
}

// The supplier on hold a part waits on (slice three a): since when, and the day the counter would ask again if the
// customer chose to wait today.
export type SupplierHold = { sourceId: number; supplier: string; since: string | null; checkOn: string | null };

export const SUPPLIER_ON_HOLD = 'supplier_on_hold' as const;

export type LineFailure = {
  id: number;
  lineId: number;
  part: string;
  brand: string;
  number: string;
  description: string | null;
  units: number;
  // The purchase order that let the customer down, and its supplier. Empty for a supplier on hold: nothing was ordered.
  poId: string;
  poNumber: string;
  supplier: string | null;
  sourceId: number | null;
  // The cancel reason (null when an order was closed short without one), its label, and whether the maker discontinued
  // the part or the reason counts against the supplier.
  reason: string | null;
  reasonLabel: string;
  maker: boolean;
  supplierFault: boolean;
  preference: CannotSupplyPreference;
  // Null once settled.
  step: FailureStep | null;
  // Whether another active supplier lists the part (the same part can be reordered).
  otherSupplier: boolean;
  askedAt: string | null;
  askedVia: CustomerChannel | null;
  askedBy: string | null;
  answer: CustomerAnswer | null;
  answeredAt: string | null;
  answeredVia: CustomerChannel | null;
  toldAt: string | null;
  toldVia: CustomerChannel | null;
  clearedAt: string | null;
  clearedWhy: 'reordered' | 'cancelled' | 'settled' | 'replaced' | null;
  createdAt: string;
  // The purchase order it is on again, once reordered.
  reordered: { poId: string; poNumber: string; state: string; supplier: string | null; expectedOn: string | null } | null;
  // The line that replaced it (Replace part), while the customer is still to be told.
  replaced: ReplacedPart | null;
  // The substitute the supplier sent in its place, when one was (reason 'substituted').
  substitute: HeldSubstitute | null;
  // While only suppliers on hold list the part: which one, so the customer may wait (answer 4).
  hold: SupplierHold | null;
  // The day the counter asks again, when the customer chose to wait.
  askAgainOn: string | null;
  // Asked, and no answer by the end of the next working day.
  answerOverdue: boolean;
};

export type OrderPreference = {
  value: CannotSupplyPreference;
  // Where it comes from: this order's own choice, the account, or a walk-in sale (always asks first).
  from: 'order' | 'account' | 'walk_in';
  account: CannotSupplyPreference | null;
};

// An order's Cannot supply in brief, for the orders list.
// reorder: of the units, those with purchasing to reorder, which the list's To order figure already counts.
// substitutes: of the units, those waiting on the customer to agree to a substitute.
// onHold: units waiting on a supplier on hold, with the counter (not counted in units: they are in To order).
// askedAt: when the customer was asked, while the answer is awaited; answerOverdue past the next working day;
// askAgainOn: the day to ask a customer who chose to wait; heldSupplier: the supplier on hold; takeOffUnits: units the
// customer asked to take off, takeOffWhole when that is all of their lines.
export type OrderFailureSummary = {
  units: number;
  reorder: number;
  substitutes: number;
  onHold: number;
  step: FailureStep | null;
  since: string | null;
  tell: boolean;
  askedAt: string | null;
  askedVia: CustomerChannel | null;
  answerOverdue: boolean;
  askAgainOn: string | null;
  heldSupplier: string | null;
  takeOffUnits: number;
  takeOffWhole: boolean;
};

function oneOf<T extends string>(values: readonly T[], value: Json | undefined): T | null {
  return typeof value === 'string' && (values as readonly string[]).includes(value) ? (value as T) : null;
}

function readLineFailure(value: Json | undefined): LineFailure | null {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  const lineId = readNumber(row?.line_id);
  if (!row || id == null || lineId == null) return null;
  const hold = readRecord(row.hold);
  const holdSource = readNumber(hold?.source_id);
  const again = readRecord(row.reordered);
  const againId = readString(again?.po_id);
  const why = row.cleared_why;
  return {
    id,
    lineId,
    part: readString(row.part) ?? '',
    brand: readString(row.brand) ?? '',
    number: readString(row.number) ?? '',
    description: readString(row.description),
    units: readNumber(row.units) ?? 0,
    poId: readString(row.po_id) ?? '',
    poNumber: readString(row.po_number) ?? '',
    supplier: readString(row.supplier),
    sourceId: readNumber(row.source_id),
    reason: readString(row.reason),
    reasonLabel: readString(row.reason_label) ?? 'Closed short',
    maker: readBoolean(row.maker) ?? false,
    supplierFault: readBoolean(row.supplier_fault) ?? true,
    preference: oneOf(CANNOT_SUPPLY_PREFERENCES, row.preference) ?? 'ask',
    step: oneOf(FAILURE_STEPS, row.step),
    otherSupplier: readBoolean(row.other_supplier) ?? false,
    askedAt: readString(row.asked_at),
    askedVia: oneOf(CUSTOMER_CHANNELS, row.asked_via),
    askedBy: readString(row.asked_by),
    answer: oneOf(CUSTOMER_ANSWERS, row.answer),
    answeredAt: readString(row.answered_at),
    answeredVia: oneOf(CUSTOMER_CHANNELS, row.answered_via),
    toldAt: readString(row.told_at),
    toldVia: oneOf(CUSTOMER_CHANNELS, row.told_via),
    clearedAt: readString(row.cleared_at),
    clearedWhy: why === 'reordered' || why === 'cancelled' || why === 'settled' || why === 'replaced' ? why : null,
    createdAt: readString(row.created_at) ?? '',
    reordered: again && againId
      ? {
          poId: againId,
          poNumber: readString(again.po_number) ?? '',
          state: readString(again.state) ?? 'drafted',
          supplier: readString(again.supplier),
          expectedOn: readString(again.expected_on),
        }
      : null,
    replaced: readReplacedPart(row.replaced),
    substitute: readHeldSubstitute(row.substitute),
    hold: hold && holdSource != null
      ? { sourceId: holdSource, supplier: readString(hold.supplier) ?? '', since: readString(hold.since), checkOn: readString(hold.check_on) }
      : null,
    askAgainOn: readString(row.ask_again_on),
    answerOverdue: readBoolean(row.answer_overdue) ?? false,
  };
}

export function readLineFailures(value: Json | undefined): LineFailure[] {
  return readArray(value).flatMap((item) => readLineFailure(item) ?? []);
}

export function readOrderPreference(value: Json | undefined): OrderPreference {
  const row = readRecord(value);
  const from = row?.from;
  return {
    value: oneOf(CANNOT_SUPPLY_PREFERENCES, row?.value) ?? 'ask',
    from: from === 'order' || from === 'account' ? from : 'walk_in',
    account: oneOf(CANNOT_SUPPLY_PREFERENCES, row?.account),
  };
}

// The sales order an enquiry led to that can't be supplied (S4b part three b, slice three c): the order, the units,
// the part when only one line, and its failure summary for the sales order list's own step words.
export type EnquiryOrderNeed = {
  orderId: string;
  number: string;
  units: number;
  part: string | null;
  // The line's quantity when one line (20261122170000), so the enquiry words it as the order does.
  quantity: number | null;
  summary: OrderFailureSummary | null;
};

export function readEnquiryOrderNeed(value: Json | undefined): EnquiryOrderNeed | null {
  const row = readRecord(value);
  const orderId = readString(row?.order_id);
  const number = readString(row?.number);
  if (!row || !orderId || !number) return null;
  return {
    orderId,
    number,
    units: readNumber(row.units) ?? 0,
    part: readString(row.part),
    quantity: readNumber(row.quantity) ?? null,
    summary: readOrderFailureSummary(row.summary),
  };
}

// Per request of an enquiry, the units on its own open order lines that can't be supplied, and the units ordered
// (slice three c, after its audit): a request says it only for its own line, never for its order's other lines.
export type EnquiryRequestFailure = { requestId: number; units: number; quantity: number };

export function readEnquiryRequestFailures(value: Json | undefined): EnquiryRequestFailure[] {
  return readArray(value).flatMap((item) => {
    const row = readRecord(item);
    const requestId = readNumber(row?.request_id);
    const units = readNumber(row?.units) ?? 0;
    return row && requestId != null && units > 0 ? [{ requestId, units, quantity: readNumber(row.quantity) ?? units }] : [];
  });
}

export function readOrderFailureSummary(value: Json | undefined): OrderFailureSummary | null {
  const row = readRecord(value);
  if (!row) return null;
  return {
    units: readNumber(row.units) ?? 0,
    reorder: readNumber(row.reorder) ?? 0,
    substitutes: readNumber(row.substitutes) ?? 0,
    onHold: readNumber(row.on_hold) ?? 0,
    step: oneOf(FAILURE_STEPS, row.step),
    since: readString(row.since),
    tell: readBoolean(row.tell) ?? false,
    askedAt: readString(row.asked_at),
    askedVia: oneOf(CUSTOMER_CHANNELS, row.asked_via),
    answerOverdue: readBoolean(row.answer_overdue) ?? false,
    askAgainOn: readString(row.ask_again_on),
    heldSupplier: readString(row.held_supplier),
    takeOffUnits: readNumber(row.take_off_units) ?? 0,
    takeOffWhole: readBoolean(row.take_off_whole) ?? true,
  };
}

// The failures still open, and those the customer is still to be told about: reordered and placed, or replaced (the
// database lists a replacement only once it is due: nobody asked first, or ordered in and placed).
export function openFailures(failures: LineFailure[]): LineFailure[] {
  return failures.filter((f) => f.step != null);
}
export function failuresToTell(failures: LineFailure[]): LineFailure[] {
  return failures.filter((f) => f.step == null && !f.toldAt
    && ((f.clearedWhy === 'reordered' && f.reordered != null && f.reordered.state !== 'drafted') || (f.clearedWhy === 'replaced' && f.replaced != null)));
}

// A failure waiting on the customer to agree to the substitute held for it.
export function substituteToAgree(failure: LineFailure): boolean {
  return failure.step != null && failure.substitute?.state === 'held';
}

// Units waiting on a supplier on hold (slice three a): not Cannot supply, they stay To order.
export function onSupplierHold(failure: Pick<LineFailure, 'reason'>): boolean {
  return failure.reason === SUPPLIER_ON_HOLD;
}

const unitWords = (n: number) => `${quantityWords(n)} ${n === 1 ? 'unit' : 'units'}`;

// What a let-down is, in a few words, for need rows and the preview (Shopify and Faire style: the fact, then one
// detail). The supplier and purchase order are in the Where cell. "3 of 6 MANN-FILTER C 35 154 can’t be supplied · Out
// of stock", "YUASA YBX5096 × 2 can’t be supplied · Out of stock", "BOSCH 0986494714 can’t be ordered · Calder Parts on
// hold", "APEC PAD1570 sent in place of 1 of 2 DELPHI LP2166". lineQuantity is the line's quantity, when known.
export function failureWords(failure: LineFailure, lineQuantity?: number, withReason = true): string {
  const what =
    lineQuantity != null && failure.units < lineQuantity
      ? `${quantityWords(failure.units)} of ${quantityWords(lineQuantity)} ${failure.part}`
      : failure.units > 1
        ? `${failure.part} × ${quantityWords(failure.units)}`
        : failure.part;
  if (failure.substitute?.state === 'held') return `${failure.substitute.part} sent in place of ${what}`;
  if (failure.substitute) return withReason ? `${what} can’t be supplied · substitute going back` : `${what} can’t be supplied`;
  if (onSupplierHold(failure)) return withReason ? `${what} can’t be ordered · ${failure.hold?.supplier ?? failure.supplier ?? 'the supplier'} on hold` : `${what} can’t be ordered`;
  if (!withReason) return `${what} can’t be supplied`;
  return `${what} can’t be supplied · ${failure.reason == null ? `${failure.poNumber} closed short` : failure.reasonLabel}`;
}

// A customer asked and not yet answering: "No reply yet · asked today 10:05 by WhatsApp", or "↑ No reply since Wed 18
// Nov 09:45" past the next working day. The sales order and the purchase order that let them down say it alike.
export function replyWords(asked: { askedAt: string | null; askedVia: string | null; answerOverdue: boolean }, now?: string): string {
  const when = asked.askedAt && now ? dayAndTime(asked.askedAt, now) : '';
  if (asked.answerOverdue) return `↑ No reply since ${when || 'the ask'}`;
  const how = isCustomerChannel(asked.askedVia) ? ` ${CUSTOMER_CHANNEL_PHRASE[asked.askedVia]}` : '';
  return `No reply yet · asked${when ? ` ${when}` : ''}${how}`;
}

// Where a let-down stands, as one short detail after failureWords (empty when the button says it all): "No reply yet ·
// asked today 10:05 by WhatsApp", "↑ No reply since Wed 18 Nov", "Return by Thu 26 Nov", "Customer waiting · ask again
// Tue 24 Nov", "With purchasing". The customer's name is on the page already; the step's verb is on its button.
export function failureStepWords(failure: LineFailure, now?: string): string {
  const when = failure.askedAt && now ? dayAndTime(failure.askedAt, now) : '';
  switch (failure.step) {
    case 'wait':
      return `${failure.hold?.supplier ?? failure.supplier ?? 'The supplier'} on hold · ask again ${failure.askAgainOn ? dateWords(failure.askAgainOn) : 'in two working days'}`;
    case 'reorder':
      return 'With purchasing';
    case 'ask':
      if (substituteToAgree(failure)) return failure.substitute?.returnBy ? `Agree by ${dateWords(daysBefore(failure.substitute.returnBy, 2))}` : '';
      if (failure.answer === 'wait') return `${failure.hold?.supplier ?? failure.supplier ?? 'The supplier'} still on hold`;
      return failure.maker ? 'Discontinued' : failure.preference === 'same_part' && !failure.otherSupplier ? 'No other supplier lists it' : '';
    case 'answer':
      return replyWords(failure, now);
    case 'replace':
      return failure.answer === 'equivalent' ? 'Customer chose an equivalent' : 'Account takes an equivalent';
    case 'take_off':
      return failure.answer === 'take_off' ? 'Customer asked to remove' : 'Account removes';
    default:
      return '';
  }
}

// A need row's one detail after the fact (owner, 22 November 2026: the fact and one detail): where the ask stands
// ("No reply yet · asked …"), or nothing for a step its button or the line after the pills says (Replace part, Remove
// 2, With purchasing), so the row gives the reason instead.
export function failureNeedStep(failure: LineFailure, now?: string): string {
  return failure.step === 'replace' || failure.step === 'take_off' || failure.step === 'reorder' ? '' : failureStepWords(failure, now);
}

// A need row as one line: "2 of 6 SKF VKMA 01250 can’t be supplied · No reply yet · asked today 10:05", or with the
// reason when there is no step to say: "3 of 6 MANN-FILTER C 35 154 can’t be supplied · Out of stock".
export function failureNeedWords(failure: LineFailure, lineQuantity?: number, now?: string): string {
  const step = failureNeedStep(failure, now);
  return [failureWords(failure, lineQuantity, !step), step].filter(Boolean).join(' · ');
}

// The words for a reordered part the customer is still to be told about: "On PO-000012 for Leeds Motor Spares, due
// Fri 20 Nov."
export function reorderedWords(failure: LineFailure): string {
  const again = failure.reordered;
  if (!again) return '';
  const due = again.expectedOn ? `, due ${dateWords(again.expectedOn)}` : '';
  return `${failure.part} is on ${again.poNumber}${again.supplier ? ` for ${again.supplier}` : ''}${due}.`;
}

// The need row for a part replaced that the customer is still to hear about: "Bosch 1 987 473 566 was replaced by
// Febi 170933, on PO-000012 for GSF Car Parts, due Fri 20 Nov." or "…, set aside at Central."
export function replacedWords(failure: LineFailure): string {
  const done = failure.replaced;
  if (!done) return '';
  if (done.supply === 'order_in') {
    const po = done.po;
    if (!po) return `${failure.part} was replaced by ${done.part}, to order in.`;
    return `${failure.part} was replaced by ${done.part}, on ${po.poNumber}${po.supplier ? ` for ${po.supplier}` : ''}${po.expectedOn ? `, due ${dateWords(po.expectedOn)}` : ''}.`;
  }
  return `${failure.part} was replaced by ${done.part}${done.setAside > 0 ? `, set aside${done.place ? ` at ${done.place}` : ''}` : ''}.`;
}

// The customer's sentence for a part replaced: never the supplier's name. "Bosch 1 987 473 566 can’t be supplied, so
// we’ve put in Febi 170933, an equivalent that fits: it’s on order and due Fri 20 Nov."
export function replacedSentence(failure: LineFailure): string {
  const done = failure.replaced;
  if (!done) return '';
  const tail =
    done.supply === 'order_in'
      ? done.po?.expectedOn
        ? `: it’s on order and due ${dateWords(done.po.expectedOn)}`
        : ': it’s on order'
      : done.setAside > 0
        ? ': it’s set aside for you'
        : '';
  return `${failure.part} can’t be supplied, so we’ve put in ${done.part}, an equivalent that fits${tail}.`;
}

type MessageOrder = {
  number: string;
  customer: Pick<EnquiryCustomer, 'kind' | 'name' | 'contactName'>;
  customerPo: string | null;
  registrations: string[];
  // For a substitute's price in the message: the order's lines and how prices are shown.
  lines?: { id: number; unitPrice: number; quantity?: number; setAside?: number }[];
  priceBasis?: 'account' | 'trade' | 'retail';
  figures?: { vatRate: number };
};

function partsList(parts: string[]): string {
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : (parts[0] ?? 'a part');
}

// The order as the customer knows it: their own order number first, ours after ("on your order HSG-4431 (our
// SO-000019)").
function orderWords(order: MessageOrder): string {
  const plates = order.registrations.length ? ` for ${order.registrations.join(', ')}` : '';
  return order.customerPo ? `${plates} on your order ${order.customerPo} (our ${order.number})` : `${plates} on order ${order.number}`;
}

// How much of a line a failure is, for the customer: "3 of the 6 " when only some units are let down, else nothing.
function shareWords(order: MessageOrder, f: Pick<LineFailure, 'lineId' | 'units'>): string {
  const quantity = order.lines?.find((line) => line.id === f.lineId)?.quantity;
  return quantity != null && f.units < quantity ? `${quantityWords(f.units)} of the ${quantityWords(quantity)} ` : '';
}

// The part as the customer reads it, with its share of the line: "the Bosch 1 987 473 566 (wear sensor)", or "3 of the
// 6 Bosch 1 987 473 566 (wear sensor)" when only some units are let down.
function sharedPart(order: MessageOrder, f: LineFailure): string {
  const share = shareWords(order, f);
  return share ? `${share}${partForCustomer(f).replace(/^the /, '')}` : partForCustomer(f);
}

// What still comes of the same line: " The other 3 are set aside for you." Only when they are.
function restOfLineWords(order: MessageOrder, f: Pick<LineFailure, 'lineId' | 'units'>): string {
  const line = order.lines?.find((item) => item.id === f.lineId);
  if (!line?.quantity || f.units >= line.quantity || !line.setAside) return '';
  const rest = Math.min(line.setAside, line.quantity - f.units);
  return rest === 1 ? ' The other one is set aside for you.' : ` The other ${quantityWords(rest)} are set aside for you.`;
}

// Each message numbers only the answers it offers, 1 to n, in this order: the same part from another supplier, an
// equivalent (or the substitute), take it off the order, wait (owner, 22 November 2026: a gap read as broken). Record
// answer numbers them the same way from the same failures.
export function answerNumber(failures: LineFailure[], answer: CustomerAnswer): number {
  return answerChoices(failures).indexOf(answer) + 1;
}

// The answers a set of failures can take: the same part only when another supplier lists one of them; wait only when
// every part waits on a supplier on hold.
export function answerChoices(failures: LineFailure[]): CustomerAnswer[] {
  const wait = failures.length > 0 && failures.every((f) => f.hold != null && f.substitute == null);
  return [
    ...(failures.some((f) => f.otherSupplier && !f.maker) ? (['same_part'] as const) : []),
    'equivalent',
    'take_off',
    ...(wait ? (['wait'] as const) : []),
  ];
}

// What a part costs the customer, as the message says it: ex VAT for trade, with VAT for retail.
function shownPrice(order: MessageOrder, price: number): string {
  const retail = order.priceBasis === 'retail';
  return `${moneyWords(retail ? price * (1 + (order.figures?.vatRate ?? 0)) : price)}${retail ? '' : ' ex VAT'}`;
}

// The part named for the customer: "the Bosch 1 987 473 566 (wear sensor)".
function partForCustomer(f: Pick<LineFailure, 'brand' | 'number' | 'description' | 'part'>): string {
  return f.description ? `the ${f.brand} ${f.number} (${f.description.toLowerCase()})` : f.part;
}

// The sentence for a substitute: "Our supplier sent Textar 98044800 in place of the Bosch 1 987 473 566 (wear sensor)
// for YK19 HNC on your order HG-2304 (our SO-000061). The Textar fits YK19 HNC and is £13.90 ex VAT rather than £14.20."
// The substitute is named, not "it", so the price can't be read as the original's. With no registration on the order
// the fit can't be checked, so the message asks for one.
function substituteSentence(order: MessageOrder, f: LineFailure, named: boolean): string {
  const sub = f.substitute!;
  const plate = order.registrations[0];
  const the = sub.brand ? `The ${sub.brand}` : sub.part;
  const fits = plate && (sub.fit === 'fits' || sub.fit === 'via_alternative') ? `${the} fits ${plate}` : null;
  const was = order.lines?.find((line) => line.id === f.lineId)?.unitPrice ?? null;
  const price =
    sub.price == null || was == null
      ? null
      : sub.price < was
        ? `is ${shownPrice(order, sub.price)} rather than ${shownPrice(order, was).replace(' ex VAT', '')}`
        : `is the same price, ${shownPrice(order, was)}`;
  const second = fits && price ? `${fits} and ${price}.` : fits ? `${fits}.` : price ? `${the} ${price}.` : '';
  const check = plate ? '' : ' Send us the registration and we’ll check it fits.';
  // How long it can be held: two days before it must go back, so there is time to send it.
  const until = sub.returnBy ? ` We can hold it for you until ${dateWords(daysBefore(sub.returnBy, 2))}.` : '';
  return `Our supplier sent ${sub.part} in place of ${sharedPart(order, f)}${named ? orderWords(order) : ''}.${restOfLineWords(order, f)}${second ? ` ${second}` : ''}${check}${until}`;
}

// A date some days before another, as yyyy-mm-dd.
function daysBefore(date: string, days: number): string {
  const at = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() - days);
  return at.toISOString().slice(0, 10);
}

// What a substitute held for the order was offered as, repeated in Record answer: "APEC PAD1570 · fits YK19 HNC ·
// £21.05 ex VAT rather than £24.56". Null unless exactly one substitute is to agree.
export function substituteOfferWords(order: MessageOrder, failures: LineFailure[]): string | null {
  const subs = failures.filter((f) => f.substitute?.state === 'held');
  if (subs.length !== 1) return null;
  const f = subs[0]!;
  const sub = f.substitute!;
  const plate = order.registrations[0];
  const fits = plate && (sub.fit === 'fits' || sub.fit === 'via_alternative') ? `fits ${plate}` : null;
  const was = order.lines?.find((line) => line.id === f.lineId)?.unitPrice ?? null;
  const price =
    sub.price == null || was == null
      ? null
      : sub.price < was
        ? `${shownPrice(order, sub.price)} rather than ${shownPrice(order, was).replace(' ex VAT', '')}`
        : `the same price, ${shownPrice(order, was)}`;
  return [sub.part, fits, price].filter(Boolean).join(' · ');
}

// Ask customer: the message Copy message puts on the clipboard, numbered as Record answer numbers it. "Hello Priya.
// Sorry, our supplier can’t supply the Bosch 1 987 473 566 for YK19 HNC on your order HG-2304 (our SO-000061). Reply 1
// for the same part from another supplier, 2 for an equivalent that fits, or 3 to take it off the order." The first choice is left out when no other supplier lists any of the parts; 2 and 3 keep their numbers. A
// substitute held for the order is offered as 2: "Reply 1 for the Bosch from another supplier, 2 to use the Textar, or 3
// to take it off the order."
//
// A supplier on hold: "Hello Amir. Sorry, the Bosch 0 986 494 714 (front brake pads) for BD17 XKP on order SO-000063
// can’t be ordered at the moment. Reply 2 for an equivalent that fits, 3 to take it off the order, or 4 to wait until
// we can order it (we’ll check with you on Mon 23 Nov)."
export function askMessage(order: MessageOrder, failures: LineFailure[], restSetAside: boolean): string {
  const name = greetingName(order.customer);
  const subs = failures.filter((f) => f.substitute?.state === 'held');
  const held = failures.filter((f) => f.substitute?.state !== 'held' && onSupplierHold(f));
  const plain = failures.filter((f) => f.substitute?.state !== 'held' && !onSupplierHold(f));
  const parts = [...new Set(failures.map((f) => f.part))];
  // "it" for one part, "them" for several, or for some units of one ("3 of the 6 …").
  const one = parts.length === 1 && failures.every((f) => f.units === 1 || !shareWords(order, f));
  const sentences: string[] = [];
  if (plain.length) {
    const plainParts = [...new Map(plain.map((f) => [f.part, f])).values()];
    const one = plainParts.length === 1 ? plainParts[0]! : null;
    const named = one ? sharedPart(order, one) : partsList(plainParts.map((f) => f.part));
    sentences.push(`Sorry, our supplier can’t supply ${named}${orderWords(order)}.${one ? restOfLineWords(order, one) : ''}`);
  }
  if (held.length) {
    const heldParts = [...new Map(held.map((f) => [f.part, f])).values()];
    const one = heldParts.length === 1 ? heldParts[0]! : null;
    const named = one ? sharedPart(order, one) : partsList(heldParts.map((f) => f.part));
    sentences.push(`${plain.length ? 'And' : 'Sorry,'} ${named}${plain.length ? '' : orderWords(order)} can’t be ordered at the moment.${one ? restOfLineWords(order, one) : ''}`);
  }
  subs.forEach((f, i) => sentences.push(substituteSentence(order, f, i === 0 && !plain.length)));
  const single = subs.length === 1 && !plain.length ? subs[0]! : null;
  const choices = answerChoices(failures).map((answer, i) => {
    const n = i + 1;
    if (answer === 'same_part') return `${n} for ${single ? `the ${single.brand}` : 'the same part'} from another supplier`;
    if (answer === 'equivalent') return single ? `${n} to use the ${single.substitute!.brand}` : `${n} for an equivalent that fits`;
    if (answer === 'wait') {
      const day = failures.find((f) => f.hold?.checkOn)?.hold?.checkOn;
      return `${n} to wait until we can order ${one ? 'it' : 'them'}${day ? ` (we’ll check with you on ${dateWords(day)})` : ''}`;
    }
    return `${n} to take ${one ? 'it' : 'them'} off the order`;
  });
  const list = choices.length > 1 ? `${choices.slice(0, -1).join(', ')}, or ${choices[choices.length - 1]}` : choices[0];
  const body = sentences.join(' ');
  const rest = !restSetAside ? '' : / set aside for you\./.test(body) ? ' So is the rest of your order.' : ' The rest of your order is set aside.';
  return `Hello${name ? ` ${name}` : ''}. ${body}${rest} Reply ${list}.`;
}

// What to say on the phone or at the counter: the message's own sentences, without the greeting and the reply
// numbers (the counter reads the choices from the answers below it).
export function askScript(order: MessageOrder, failures: LineFailure[]): string {
  const message = askMessage(order, failures, false);
  return message.replace(/^Hello[^.]*\. /, '').replace(/ Reply .*$/, '');
}

// When and how the customer was asked, for Record answer: "asked today 10:05 by phone".
export function askedWords(failures: LineFailure[], now: string): string | null {
  const asked = failures.filter((f) => f.askedAt).sort((a, b) => (a.askedAt! < b.askedAt! ? 1 : -1))[0];
  if (!asked?.askedAt) return null;
  const how = asked.askedVia ? ` ${CUSTOMER_CHANNEL_PHRASE[asked.askedVia]}` : '';
  return `asked ${dayAndTime(asked.askedAt, now)}${how}`;
}

// The help under each answer in Record answer, one short line as Instacart words its choices ("Your shopper will look
// for the most similar item"). For a substitute held for the order, the answers name it.
export function answerHelp(answer: CustomerAnswer, failures: LineFailure[], order?: MessageOrder): { label: string; help: string } {
  const sub = failures.length === 1 && failures[0]!.substitute?.state === 'held' ? failures[0]! : null;
  // Removing part of a line: how many come off and how many stay.
  const { removed, stay } = (() => {
    const f = failures.length === 1 ? failures[0]! : null;
    const quantity = f ? order?.lines?.find((line) => line.id === f.lineId)?.quantity : undefined;
    return f && quantity != null && f.units < quantity ? { removed: f.units, stay: quantity - f.units } : { removed: 0, stay: 0 };
  })();
  if (sub) {
    const held = sub.substitute!;
    const back = `${held.brand || held.part} goes back to ${sub.supplier ?? 'the supplier'}`;
    if (answer === 'same_part') return { label: CANNOT_SUPPLY_PREFERENCE_LABELS.same_part, help: `Purchasing reorders it; ${back}.` };
    if (answer === 'equivalent') return { label: `Use ${held.part}`, help: 'At the lower of the two prices.' };
    return { label: CANNOT_SUPPLY_PREFERENCE_LABELS.take_off, help: removed ? `Remove ${quantityWords(removed)}; ${quantityWords(stay)} ${stay === 1 ? 'stays' : 'stay'}. ${back}.` : `${back}.` };
  }
  const hold = failures.find((f) => f.hold)?.hold ?? null;
  if (answer === 'wait') {
    const supplier = hold?.supplier || 'the supplier';
    return { label: `Wait for ${supplier}`, help: `Ask again ${hold?.checkOn ? dateWords(hold.checkOn) : 'in two working days'}.` };
  }
  const help: Record<Exclude<CustomerAnswer, 'wait'>, string> = {
    same_part: 'Purchasing reorders it elsewhere.',
    equivalent: 'The counter picks a part that fits.',
    take_off: stay ? `Remove ${quantityWords(removed)}; ${quantityWords(stay)} ${stay === 1 ? 'stays' : 'stay'}.` : 'The line is cancelled.',
  };
  return { label: CUSTOMER_ANSWER_LABELS[answer], help: help[answer] };
}

// Tell customer, once the part is on a placed purchase order again: "Hello Priya, Bosch 1 987 473 566 for YK19 HNC on
// order SO-000061 is on order again and due Fri 20 Nov. Sorry for the wait." A part replaced gets its own sentence
// (replacedSentence), and the order is named once.
export function tellMessage(order: MessageOrder, failures: LineFailure[]): string {
  const name = greetingName(order.customer);
  const again = failures.filter((f) => f.clearedWhy !== 'replaced');
  const replaced = failures.filter((f) => f.clearedWhy === 'replaced' && f.replaced);
  const sentences: string[] = [];
  if (again.length) {
    const parts = [...new Set(again.map((f) => f.part))];
    const days = [...new Set(again.map((f) => f.reordered?.expectedOn).filter((d): d is string => !!d))];
    const due = days.length === 1 && days[0] ? ` and due ${dateWords(days[0])}` : '';
    sentences.push(`${partsList(parts)}${orderWords(order)} ${parts.length === 1 ? 'is' : 'are'} on order again${due}.`);
  }
  replaced.forEach((f, i) => {
    const sentence = replacedSentence(f);
    sentences.push(i === 0 && !again.length ? sentence.replace(f.part, `${f.part}${orderWords(order)}`) : sentence);
  });
  return `Hello${name ? ` ${name}` : ''}, ${sentences.join(' ')} Sorry for the wait.`;
}

// The order's history lines for Cannot supply. Returns null for an event that isn't one of these (and for a hold
// that isn't for Cannot supply, which the order's own words cover).
export function cannotSupplyEventText(event: string, detail: JsonRecord): string | null {
  const text = (key: string) => (typeof detail[key] === 'string' ? (detail[key] as string) : '');
  const parts = Array.isArray(detail.parts) ? (detail.parts as unknown[]).filter((p): p is string => typeof p === 'string') : [];
  const via = isCustomerChannel(detail.via) ? ` ${CUSTOMER_CHANNEL_PHRASE[detail.via]}` : '';
  const what = parts.length ? partsList(parts) : 'a part that can’t be supplied';
  switch (event) {
    case 'cannot_supply': {
      const n = typeof detail.units === 'number' ? detail.units : 0;
      return `${text('supplier') || 'The supplier'} can’t supply ${unitWords(n)} of ${text('part')} on ${text('po')} (${text('reason') || 'Closed short'}).`;
    }
    case 'customer_asked':
      return `Asked the customer about ${what}${via}.`;
    case 'customer_ask_undone':
      return `Ask about ${what} undone.`;
    case 'customer_answered': {
      const answer = isCustomerAnswer(detail.answer) ? CUSTOMER_ANSWER_LABELS[detail.answer].toLowerCase() : 'recorded';
      const until = detail.answer === 'wait' && text('until') ? `; we’ll ask again ${dateWords(text('until'))}` : '';
      return `Customer’s answer for ${what}${via}: ${answer}${until}.`;
    }
    case 'supplier_held': {
      const n = typeof detail.units === 'number' ? detail.units : 0;
      return `${text('part')} (${unitWords(n)}) can’t be ordered: ${text('supplier') || 'the supplier'} is on hold.`;
    }
    case 'customer_told':
      return `Customer told about ${what}${via}.`;
    case 'substitute_held': {
      const n = typeof detail.units === 'number' ? detail.units : 0;
      return `${text('supplier') || 'The supplier'} sent ${text('part')} as a substitute for ${text('for')} (${unitWords(n)}) on ${text('receipt') || text('po')}: held${text('place') ? ` at ${text('place')}` : ''} for the customer to agree.`;
    }
    case 'substitute_returned': {
      const n = typeof detail.units === 'number' ? detail.units : 0;
      return `${text('part')} (${unitWords(n)}) returned to the supplier${text('return') ? ` on ${text('return')}` : ''}.`;
    }
    case 'substitute_stocked': {
      const n = typeof detail.units === 'number' ? detail.units : 0;
      return `${text('part')} (${unitWords(n)}) accepted into stock.`;
    }
    case 'substitute_return_undone': {
      const n = typeof detail.units === 'number' ? detail.units : 0;
      return `${text('part')} (${unitWords(n)}) taken off ${text('return') || 'the supplier return'}: back in Substitutes to return.`;
    }
    case 'substitute_stock_undone': {
      const n = typeof detail.units === 'number' ? detail.units : 0;
      return `Accept into stock undone for ${text('part')} (${unitWords(n)}): back in Substitutes to return.`;
    }
    case 'cannot_supply_preference': {
      const now = isCannotSupplyPreference(detail.now) ? CANNOT_SUPPLY_PREFERENCE_LABELS[detail.now].toLowerCase() : 'ask first';
      return isCannotSupplyPreference(detail.to)
        ? `If a part can’t be supplied on this order: ${now}.`
        : `If a part can’t be supplied: back to the account’s setting (${now}).`;
    }
    case 'held':
      return detail.reason === 'cannot_supply'
        ? `Put on hold: ${text('part') || 'a part'} can’t be supplied and nothing else on the order can move.`
        : null;
    case 'hold_lifted':
      return text('po') ? `Off hold: ${text('po')} placed.` : 'Off hold: the order can move again.';
    default:
      return null;
  }
}

// The counter's steps. Each returns once the database has recorded it.
export function askCustomer(supabase: Client, orderId: string, via: CustomerChannel): Promise<void> {
  return call(supabase.rpc('sales_order_ask_customer', { p_id: orderId, p: { via } }), () => undefined);
}

export function recordCustomerAnswer(
  supabase: Client,
  orderId: string,
  answer: { answer: CustomerAnswer; via: CustomerChannel; failureId?: number | null },
): Promise<void> {
  const p: { [key: string]: Json } = { answer: answer.answer, via: answer.via };
  if (answer.failureId != null) p.failure_id = answer.failureId;
  return call(supabase.rpc('sales_order_record_answer', { p_id: orderId, p }), () => undefined);
}

// Undo of an ask recorded by mistake (the last one, within half an hour).
export function undoAskCustomer(supabase: Client, orderId: string): Promise<void> {
  return call(supabase.rpc('sales_order_undo_ask', { p_id: orderId }), () => undefined);
}

export function tellCustomer(supabase: Client, orderId: string, via: CustomerChannel): Promise<void> {
  return call(supabase.rpc('sales_order_tell_customer', { p_id: orderId, p: { via } }), () => undefined);
}

// This order's own answer to "if a part can't be supplied"; null follows the account again.
export function setOrderCannotSupply(supabase: Client, orderId: string, value: CannotSupplyPreference | null): Promise<void> {
  return call(supabase.rpc('sales_order_set_cannot_supply', { p_id: orderId, p_value: value }), () => undefined);
}
