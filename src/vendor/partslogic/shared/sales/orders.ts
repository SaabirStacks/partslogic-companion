import type { Json } from '@partslogic/db-types';

import type { StatusState } from '../core/status';

import { call, readHistoryEvents, type HistoryEvent } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readBoolean, readNumber, readRecord, readString, readStrings, type JsonRecord } from '../core/read';
import { readEnquiryCustomer, readEnquiryOwner, type EnquiryCustomer, type EnquiryCustomerInput, type EnquiryOwner } from './enquiries';
import { OFFER_SUPPLIES, PART_FITS, readFoundParts, readOfferDelivery, type FoundParts, type OfferDelivery, type OfferSupply, type PartFit, type PriceBasis } from './offers';
import {
  TAKEN_PAYMENT_LABELS,
  orderInChoiceFields,
  paymentFields,
  readLinkedPurchaseOrders,
  readOrderedIn,
  readOrderInOptions,
  readPaymentTaken,
  readSupplyLinks,
  supplyWhere,
  type LinkedPurchaseOrder,
  type OrderedIn,
  type OrderInChoice,
  type OrderInOptions,
  type PaymentInput,
  type TakenPaymentMethod,
  type PaymentTaken,
  type SupplyLink,
  orderedInShortWords,
} from './order-in';
import { putAsideEventText, readPutAsideReceipts, readyLabel, readyNeedWords, readyToTell, type PutAsideReceipt } from './put-aside';
import {
  CUSTOMER_CHANNEL_PHRASE,
  cannotSupplyEventText,
  failuresToTell,
  readLineFailures,
  readOrderFailureSummary,
  onSupplierHold,
  readOrderPreference,
  substituteToAgree,
  type LineFailure,
  type OrderFailureSummary,
  type OrderPreference,
} from './cannot-supply';
import { lateEventText, readLateLines, readOrderLateSummary, type LateLine, type OrderLateSummary } from './late';
import { addressLines, deliveryPlace, readSalesOrderAddress, type SalesOrderAddress } from './address';
import { NO_STOCK_ON_RECORD, notFoundWords, pickingEventText, readNotFound, type NotFound, type PackingOrder, type PickingOrder, type PickingRow } from './picking';
import { NOT_PACKED, packingEventText, parcelsWords, readOrderPack, type OrderPack } from './packing';
import { handoverEventText, readHandover, readHandovers, type Handover } from './handover';
import { replaceEventText } from './replace';
import { clockTime, dateWords, dayAndTime, daysFromToday, deliveryWords, moneyWords, nearDayWords, PART_FIT_WORDS, quantityWords } from './words';

// Sales orders (docs/SALES.md, sections 6, 13.7 and 13.8). An order is made from the accepted offers on an enquiry
// and starts as a draft, which holds no stock. Confirming it runs the credit check and sets stock aside; what is
// short is to order. The database makes every decision; these wrappers hand it the words and read its answers.

export const SALES_ORDER_VIEWS = [
  'mine', 'drafts', 'to_order', 'to_pick', 'to_pack', 'ready_collection', 'ready_delivery', 'out_for_delivery', 'on_hold', 'action_required', 'all_open', 'completed',
] as const;
export type SalesOrderView = (typeof SALES_ORDER_VIEWS)[number];
export function isSalesOrderView(value: string): value is SalesOrderView {
  return (SALES_ORDER_VIEWS as readonly string[]).includes(value);
}
export const SALES_ORDER_VIEW_LABELS: Record<SalesOrderView, string> = {
  mine: 'Mine',
  drafts: 'Drafts',
  to_order: 'To order',
  to_pick: 'To pick',
  // Deliveries with every unit picked, not yet packed (S5b-1).
  to_pack: 'To pack',
  // Handover (S5a-2a): the pill's own words, each row with its one button.
  ready_collection: 'Ready for collection',
  ready_delivery: 'Ready for delivery',
  out_for_delivery: 'Out for delivery',
  on_hold: 'On hold',
  // The orders where the counter must act now on a part a supplier let down (Faire's "Action required").
  action_required: 'Action required',
  all_open: 'All open',
  completed: 'Completed',
};

export const SALES_ORDER_STATUSES = ['draft', 'open', 'on_hold', 'completed', 'cancelled'] as const;
export type SalesOrderStatus = (typeof SALES_ORDER_STATUSES)[number];
// The pill an order wears until its lines have stages of their own. On hold is the only one that blocks work.
export const SALES_ORDER_STATUS_WORDS: Record<SalesOrderStatus, { label: string; tone: StatusState }> = {
  draft: { label: 'Draft', tone: 'not_started' },
  open: { label: 'Open', tone: 'active' },
  on_hold: { label: 'On hold', tone: 'blocked' },
  completed: { label: 'Completed', tone: 'ready' },
  cancelled: { label: 'Cancelled', tone: 'ended' },
};

export const DELIVERY_METHODS = ['collection', 'delivery', 'courier'] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];
export const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = { collection: 'Collection', delivery: 'Our delivery', courier: 'Courier' };
// One word for the list's Method column.
export const DELIVERY_METHOD_SHORT: Record<DeliveryMethod, string> = { collection: 'Collection', delivery: 'Delivery', courier: 'Courier' };

export const ORDER_PAYMENTS = ['on_account', 'not_invoiced'] as const;
export type OrderPayment = (typeof ORDER_PAYMENTS)[number];
export const ORDER_PAYMENT_LABELS: Record<OrderPayment, string> = { on_account: 'On account', not_invoiced: 'Not invoiced' };
// Nothing is invoiced yet, so payment has not started (docs/design-checks/status-colours.md).
export const ORDER_PAYMENT_STATES: Record<OrderPayment, StatusState> = { on_account: 'not_started', not_invoiced: 'not_started' };

// What became of a cancelled order's requests: returned to the enquiry, still accepted, or lost with a reason.
// returned: back to its enquiry. lost: a lost sale, with a reason. error: made in error (an order made with New sale;
// not counted as a lost sale).
export const CANCEL_OUTCOMES = ['returned', 'lost', 'error'] as const;
export type CancelOutcome = (typeof CANCEL_OUTCOMES)[number];
export type OrderCancelled = { outcome: CancelOutcome; reason: string | null; enquiry: string | null; at: string; by: string | null };

// How far a confirmed order's stock has got: its least-advanced line. To order: a unit is still short. To pick:
// everything it wants is set aside.
// Where a confirmed order's stock stands, the furthest behind first: parts still to order, then on a draft purchase
// order, ordered, arrived and waiting to be set aside, all set aside to pick, and every unit on the collection and
// delivery shelf (Ready, S4b: "Ready for collection" or "Ready for delivery", by the order's method).
// to_agree: the counter's move after a supplier let the customer down (ask, act on the answer, or chase a reply past
// the next working day); awaiting_reply: asked, and the reply isn't due yet; waiting: the customer chose to wait for a
// supplier on hold. An order with an answer due is never Ready, nor Ordered.
// to_pack (S5b-1): a delivery or courier order with every unit on the shelf and not yet packed; packed, it is Ready.
// out (S5a-2a): everything still held is with the driver or the courier.
export const ORDER_FULFILMENTS = ['to_order', 'drafted', 'ordered', 'arrived', 'to_agree', 'awaiting_reply', 'waiting', 'to_pick', 'to_pack', 'ready', 'out'] as const;
export type OrderFulfilment = (typeof ORDER_FULFILMENTS)[number];
export const ORDER_FULFILMENT_LABELS: Record<OrderFulfilment, string> = {
  to_order: 'To order',
  drafted: 'Drafted',
  // "On order", the order page's own word for units on a placed purchase order: "Ordered" is an enquiry's settled sale.
  ordered: 'On order',
  arrived: 'Arrived',
  // Named for who holds the next move, in the words Enquiries already uses for them (NEXT_MOVE_LABELS): the counter's
  // (Needs action: ask, act on the answer, chase a late reply), or the order is waiting on the customer's reply, or on
  // a supplier on hold.
  to_agree: 'Needs action',
  awaiting_reply: 'Waiting on customer',
  waiting: 'Waiting on supplier',
  to_pick: 'To pick',
  to_pack: 'To pack',
  ready: 'Ready',
  out: 'Out for delivery',
};

// Each stage's badge state (docs/design-checks/status-colours.md): our move blue, waiting on a supplier or the
// customer amber, ready green.
export const ORDER_FULFILMENT_STATES: Record<OrderFulfilment, StatusState> = {
  to_order: 'active',
  drafted: 'active',
  ordered: 'waiting',
  arrived: 'active',
  to_agree: 'active',
  awaiting_reply: 'waiting',
  waiting: 'waiting',
  to_pick: 'active',
  to_pack: 'active',
  ready: 'ready',
  out: 'active',
};

// The stage pill's words: a ready order says how it reaches the customer.
export function fulfilmentLabel(fulfilment: OrderFulfilment, method: DeliveryMethod): string {
  return fulfilment === 'ready' ? readyLabel(method) : ORDER_FULFILMENT_LABELS[fulfilment];
}

// Part supplied (S5a-2a, the copy deck): part of the order reached the customer and the rest is still on its way to
// the shelf. The pill says so; the line after it says what the rest waits on. Ready, To pack and Out for delivery keep
// their own words, as their next move is a handover.
export const PART_SUPPLIED = 'Part supplied';

export function orderStageWords(fulfilment: OrderFulfilment, method: DeliveryMethod, supplied: number): { label: string; tone: StatusState } {
  if (supplied > 0 && fulfilment !== 'ready' && fulfilment !== 'to_pack' && fulfilment !== 'out') return { label: PART_SUPPLIED, tone: 'active' };
  return { label: fulfilmentLabel(fulfilment, method), tone: ORDER_FULFILMENT_STATES[fulfilment] };
}

// Why a confirmed order cannot move. The credit check sets on_stop and over_limit; a person sets customer (waiting
// for the customer), with a note saying what would release it.
// Cannot supply (S4b part three): every unit left on the order can't be supplied, so nothing on it can move; the hold
// lifts by itself.
export const HOLD_REASONS = ['on_stop', 'over_limit', 'customer', 'cannot_supply'] as const;
export type HoldReason = (typeof HOLD_REASONS)[number];
export type CreditHoldReason = Exclude<HoldReason, 'customer' | 'cannot_supply'>;
export type OrderHold = {
  reason: HoldReason;
  at: string | null;
  // A hold put on by hand: what is needed to release it, and who put it on.
  note: string | null;
  by: string | null;
  // Units the order keeps set aside while it is held, and the branch they are at.
  kept: number;
  place: string | null;
  // The account, the reason recorded on it and since when (on stop); the limit and how far over (over the limit).
  name: string | null;
  statusReason: string | null;
  since: string | null;
  limit: number | null;
  overBy: number | null;
  // Cannot supply: the part, the purchase order and its supplier.
  part: string | null;
  po: string | null;
  poId: string | null;
  supplier: string | null;
};

// Why a short line was confirmed as in stock here (the stock figure is wrong).
export const SHELF_REASONS = ['not_counted', 'other_bin', 'not_booked_in', 'other'] as const;
export type ShelfReason = (typeof SHELF_REASONS)[number];
export const SHELF_REASON_LABELS: Record<ShelfReason, string> = {
  not_counted: 'Not counted yet',
  other_bin: 'Found in another bin',
  not_booked_in: 'Delivered and not booked in',
  other: 'Other',
};

// The delivery address lives in address.ts (S5b), read by picking too; its names stay exported here.
export { addressLines, type SalesOrderAddress } from './address';

export type SalesOrderRow = {
  id: string;
  number: string;
  status: SalesOrderStatus;
  // What the row is waiting for: confirm, while it is a draft.
  step: 'confirm' | null;
  // Once confirmed: how far its stock has got, and the units on each side.
  fulfilment: OrderFulfilment | null;
  toOrder: number;
  // Set aside in bins, to pick; and on the collection and delivery shelf, put there by goods in (S4b) or picked
  // (S5a-1, of which `picked`); and the order marked urgent.
  toPick: number;
  onShelf: number;
  picked: number;
  // Handed over (S5a-2a): out for delivery and supplied units, when a collection became ready, and the latest handover.
  sentOut: number;
  supplied: number;
  readySince: string | null;
  handover: Handover | null;
  // A delivery's place ("Leeds LS11") and its standing pack's parcels, for the delivery views' line (S5a-2a).
  deliverTo: string | null;
  parcels: number | null;
  urgent: boolean;
  hold: OrderHold | null;
  registrations: string[];
  lineCount: number;
  units: number;
  customer: EnquiryCustomer;
  customerPo: string | null;
  method: DeliveryMethod;
  payment: OrderPayment;
  // Before VAT, and with it.
  total: number;
  totalInc: number;
  // When it reached its present status.
  statusAt: string;
  createdAt: string;
  owner: EnquiryOwner | null;
  location: { id: number; name: string } | null;
  cancelled: OrderCancelled | null;
  // Units that can't be supplied and the next step, or a reordered part the customer is still to be told about.
  cannotSupply: OrderFailureSummary | null;
  // A part bought for the customer that is late, or has a new day from the supplier (S4b part three b).
  late: OrderLateSummary | null;
};

export type SalesOrderList = {
  view: SalesOrderView;
  rows: SalesOrderRow[];
  total: number;
  // Units still to pick across the list's branch (or every branch), counted as the Picking page counts them (S5a-1).
  toPickUnits: number;
  // The rows in each view, whatever is typed in the filter.
  views: {
    mine: number; drafts: number; toOrder: number; toPick: number; toPack: number;
    readyCollection: number; readyDelivery: number; outForDelivery: number;
    onHold: number; actionRequired: number; allOpen: number;
  };
  summary: { open: number; needsAction: number; drafts: number; onHold: number; withCustomer: number; actionRequired: number };
  locations: { id: number; name: string }[];
  // The people who own an open order, for the Owner filter.
  owners: EnquiryOwner[];
  me: string | null;
  now: string;
};

export type SalesOrderLine = {
  id: number;
  partId: number;
  brand: string;
  number: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  // Where it was to come from when it was offered, and what is on that shelf now.
  supply: OfferSupply;
  locationId: number | null;
  location: string | null;
  sourceId: number | null;
  supplier: string | null;
  onHandNow: number | null;
  delivery: OfferDelivery | null;
  missedCutoffAt: string | null;
  fit: PartFit | null;
  registration: string | null;
  requestId: number | null;
  // On a confirmed order: units set aside at its branch, units still to order, and how many of the set-aside units
  // the stock figure did not cover (confirmed as in stock here).
  setAside: number;
  toOrder: number;
  withoutStock: number;
  cancelled: boolean;
  // Units taken off the line after the order was confirmed (shown in the Removed group).
  removed: number;
  // The branch its stock is set aside at, with what that shelf holds and can still sell, and the bin holding most.
  place: string | null;
  onHand: number;
  available: number;
  bin: string | null;
  binQty: number | null;
  // Units of a line that is to order which the shelf can now give it.
  canSetAside: number;
  // Of the set-aside units, those on the collection and delivery shelf now: goods in's (S4b) and picked (S5a-1). Set
  // aside and on the shelf leave out what was supplied or is out for delivery (S5a-2a), which these say.
  onShelf: number;
  supplied: number;
  sentOut: number;
  // Of those, the units picked from bins, and a short pick still open (S5a-1).
  picked: number;
  notFound: NotFound | null;
  // Of the units to order: on purchase orders, arrived and waiting to be set aside, and still to order (ordering in).
  onPo: number;
  arrived: number;
  stillToOrder: number;
  // Units a supplier let the customer down on (S4b part three): not to order until the customer or the account says.
  cannotSupply: number;
  supplyLinks: SupplyLink[];
  // Only for a person allowed to see cost and margin.
  unitCost: number | null;
  margin: number | null;
};

// Packed (S5b-1) is on a delivery's or courier order's trail only; a collection has no such step.
export const ORDER_TRAIL_STAGES = ['confirmed', 'stock', 'picked', 'packed', 'supplied', 'invoiced', 'paid'] as const;
export type OrderTrailStage = (typeof ORDER_TRAIL_STAGES)[number];
// out: on the handover stage (S5a-2a), the units with the driver or the courier.
export type OrderTrailNode = { key: OrderTrailStage; state: 'done' | 'now' | 'todo'; done: number | null; of: number | null; at: string | null; out?: number | null };

export type SalesOrderDetail = {
  id: string;
  number: string;
  status: SalesOrderStatus;
  step: 'confirm' | null;
  fulfilment: OrderFulfilment | null;
  payment: OrderPayment;
  statusAt: string;
  createdAt: string;
  confirmedAt: string | null;
  createdBy: string | null;
  location: { id: number; name: string } | null;
  owner: EnquiryOwner | null;
  customer: EnquiryCustomer;
  customerPo: string | null;
  poRequired: boolean;
  // The account's payment terms, when it is an account.
  terms: { name: string; kind: string; days: number } | null;
  registrations: string[];
  delivery: { method: DeliveryMethod; address: SalesOrderAddress | null; addressText: string | null };
  // The account's own addresses, to choose a delivery from. Empty for anyone else, whose address is typed.
  addresses: SalesOrderAddress[];
  enquiry: { id: string; number: string; status: string; openRequests: number; toSource: number } | null;
  trail: OrderTrailNode[];
  figures: {
    subtotal: number;
    vatRate: number;
    vat: number;
    totalInc: number;
    invoiced: number;
    lineCount: number;
    units: number;
    setAside: number;
    // Of those, on the collection and delivery shelf now (S4b); handed over (S5a-2a): out for delivery, and supplied.
    onShelf: number;
    sentOut: number;
    supplied: number;
    toOrder: number;
    withoutStock: number;
    // Of the units to order: still to order, on draft purchase orders, ordered, and arrived waiting to be set aside.
    stillToOrder: number;
    drafted: number;
    ordered: number;
    arrived: number;
    // Margin only for a person allowed to see cost; estimated while a line is still to be ordered in.
    margin: number | null;
    marginAmount: number | null;
    marginEstimated: boolean;
    // Only for an account with a credit limit: what would be left if this order went ahead.
    credit: { limit: number; availableAfter: number } | null;
  };
  lines: SalesOrderLine[];
  // Newest first.
  history: HistoryEvent[];
  cancelled: OrderCancelled | null;
  hold: OrderHold | null;
  // Its lines stand somewhere: it is open, or on hold with its stock kept.
  staged: boolean;
  // Made with New sale, with no enquiry behind it; and whether anybody is named on it (a cash sale has nobody).
  direct: boolean;
  hasCustomer: boolean;
  // Whether someone can be rung when a part arrives: an account, a retail card, or a phone number (a name alone is not).
  contactable: boolean;
  // The vehicles a New sale was made for, each with what it was matched to.
  vehicles: { registration: string; label: string | null }[];
  // Why lines were confirmed as in stock here, when any were.
  shelf: { reason: ShelfReason; note: string | null } | null;
  // The reasons a sale is lost for, to choose from when cancelling.
  reasons: { code: string; label: string; needsNote: boolean }[];
  priceBasis: PriceBasis;
  canSeeMargin: boolean;
  // Delivery and the PO number, on any order that is not finished.
  canEdit: boolean;
  canConfirm: boolean;
  canCheckCredit: boolean;
  canOverride: boolean;
  canCancel: boolean;
  canAddLine: boolean;
  canHold: boolean;
  canRelease: boolean;
  // A draft made with New sale that has no lines.
  canDiscard: boolean;
  // A name and phone number can be typed in: the order is for no account and no retail card.
  canName: boolean;
  // Ordering in: the purchase orders it waits on, what a retail customer has paid, and who may do what.
  purchaseOrders: LinkedPurchaseOrder[];
  paymentTaken: PaymentTaken;
  // Goods in (S4b): the deliveries that put units aside for it, when the last was, and when the ready message was
  // last copied.
  putAsideReceipts: PutAsideReceipt[];
  putAsideAt: string | null;
  readyMessageAt: string | null;
  // Picked first (S5a-1).
  urgent: boolean;
  // Packed (S5b-1): the standing pack, and who holds the order in a pick job on a phone.
  pack: OrderPack | null;
  picker: string | null;
  // Handover (S5a-2a): the order's handovers, newest first, and whether this viewer may hand over or take one back.
  handovers: Handover[];
  canHandOver: boolean;
  canOrderIn: boolean;
  // Units the counter may order in: still to order, leaving out parts that can't be supplied (purchasing reorders those).
  orderInUnits: number;
  canOrderInUnpaid: boolean;
  canBuildOrders: boolean;
  canPlaceOrders: boolean;
  canApproveOrders: boolean;
  // Cannot supply (S4b part three): each failure, what the order does when a part can't be supplied, and whether this
  // person may save an answer as the account's preference.
  failures: LineFailure[];
  // Parts bought for this order that are late or have a new day (S4b part three b), and what the customer was told.
  late: LateLine[];
  ifCannotSupply: OrderPreference;
  canEditAccount: boolean;
  now: string;
};

// What confirming a draft would do, before it is done.
export type OrderConfirmLine = {
  id: number;
  brand: string;
  number: string;
  quantity: number;
  place: string | null;
  onHand: number;
  available: number;
  // How many the shelf would set aside, and how many are short.
  takes: number;
  short: number;
  // The orders holding what is on the shelf, when the shelf is not empty but cannot cover this line.
  heldBy: { id: string; number: string; quantity: number }[];
};
export type OrderCredit = {
  name: string | null;
  blockedBy: CreditHoldReason | 'closed' | null;
  hasCredit: boolean;
  statusReason: string | null;
  since: string | null;
  limit: number;
  availableAfter: number;
  overBy: number;
};
export type OrderConfirmPreview = {
  number: string;
  customer: EnquiryCustomer;
  totalInc: number;
  location: string | null;
  lines: OrderConfirmLine[];
  // Null for a customer with no account.
  credit: OrderCredit | null;
  poMissing: boolean;
  // A cash sale with no name or number: it can be confirmed only while nothing has to be ordered in.
  noCustomer: boolean;
  // Whether someone can be rung when a part arrives; Confirm asks for a name and number when not.
  contactable: boolean;
  // Where each short line would be ordered from, and what a retail customer has to pay first.
  orderIn: OrderInOptions | null;
};
// What confirming, checking credit again or overriding a hold did.
export type OrderOpened =
  | {
      status: 'open';
      setAside: number;
      toOrder: number;
      withoutStock: number;
      location: string | null;
      // Confirm's ordering in: what went on purchase orders, or why nothing did (the order is confirmed either way).
      orderIn: OrderedIn | null;
      orderInError: string | null;
    }
  | { status: 'on_hold'; hold: OrderHold };

// A part's stock as sales sees it: per branch, and each order holding it.
export type PartSetAside = {
  places: { locationId: number; location: string; onHand: number; setAside: number; available: number }[];
  orders: SetAsideOrder[];
};

// An order holding a part: a confirmed line's allocation, or a substitute held while the customer decides.
export type SetAsideOrder = {
  id: string;
  number: string;
  quantity: number;
  withoutStock: number;
  substitute: boolean;
  location: string | null;
  confirmedAt: string | null;
  customer: EnquiryCustomer;
};

// What Create order would make from an enquiry, before it is made.
export type EnquiryOrderPreview = {
  lines: { offerId: number; requestId: number; brand: string; number: string; quantity: number; lineTotal: number }[];
  subtotal: number;
  vatRate: number;
  vat: number;
  totalInc: number;
  customer: EnquiryCustomer;
  registrations: string[];
  poRequired: boolean;
  canCreate: boolean;
};

function oneOf<T extends string>(values: readonly T[], value: Json | undefined, fallback: T): T {
  return typeof value === 'string' && (values as readonly string[]).includes(value) ? (value as T) : fallback;
}

function readPlace(value: Json | undefined): { id: number; name: string } | null {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  return row && id != null ? { id, name: readString(row.name) ?? '' } : null;
}

function readCancelled(value: Json | undefined): OrderCancelled | null {
  const row = readRecord(value);
  const at = readString(row?.at);
  if (!row || !at) return null;
  return { outcome: oneOf(CANCEL_OUTCOMES, row.outcome, 'lost'), reason: readString(row.reason), enquiry: readString(row.enquiry), at, by: readString(row.by) };
}

function readHold(value: Json | undefined): OrderHold | null {
  const row = readRecord(value);
  const reason = HOLD_REASONS.find((item) => item === row?.reason);
  if (!row || !reason) return null;
  return {
    reason,
    at: readString(row.at),
    note: readString(row.note),
    by: readString(row.by),
    kept: readNumber(row.kept) ?? 0,
    place: readString(row.place),
    name: readString(row.name),
    statusReason: readString(row.status_reason),
    since: readString(row.since),
    limit: readNumber(row.limit),
    overBy: readNumber(row.over_by),
    part: readString(row.part),
    po: readString(row.po),
    poId: readString(row.po_id),
    supplier: readString(row.supplier),
  };
}

function readFulfilment(value: Json | undefined): OrderFulfilment | null {
  return typeof value === 'string' && (ORDER_FULFILMENTS as readonly string[]).includes(value) ? (value as OrderFulfilment) : null;
}

export function readSalesOrderRow(value: Json | undefined): SalesOrderRow | null {
  const row = readRecord(value);
  const id = readString(row?.id);
  const number = readString(row?.number);
  if (!row || !id || !number) return null;
  return {
    id,
    number,
    status: oneOf(SALES_ORDER_STATUSES, row.status, 'draft'),
    step: row.step === 'confirm' ? 'confirm' : null,
    fulfilment: readFulfilment(row.fulfilment),
    toOrder: readNumber(row.to_order) ?? 0,
    toPick: readNumber(row.to_pick) ?? 0,
    onShelf: readNumber(row.here) ?? readNumber(row.on_shelf) ?? 0,
    picked: readNumber(row.picked) ?? 0,
    sentOut: readNumber(row.sent_out) ?? 0,
    supplied: readNumber(row.supplied) ?? 0,
    readySince: readString(row.ready_since),
    handover: readHandover(row.handover),
    deliverTo: row.address != null || row.address_text != null ? deliveryPlace(readSalesOrderAddress(row.address), readString(row.address_text)) || null : null,
    parcels: readNumber(row.parcels),
    urgent: readBoolean(row.urgent) ?? false,
    hold: readHold(row.hold),
    registrations: readStrings(row.registrations),
    lineCount: readNumber(row.line_count) ?? 0,
    units: readNumber(row.units) ?? 0,
    customer: readEnquiryCustomer(row.customer),
    customerPo: readString(row.customer_po),
    method: oneOf(DELIVERY_METHODS, row.method, 'collection'),
    payment: oneOf(ORDER_PAYMENTS, row.payment, 'not_invoiced'),
    total: readNumber(row.total) ?? 0,
    totalInc: readNumber(row.total_inc) ?? 0,
    statusAt: readString(row.status_at) ?? '',
    createdAt: readString(row.created_at) ?? '',
    owner: readEnquiryOwner(row.owner),
    location: readPlace(row.location),
    cancelled: readCancelled(row.cancelled),
    cannotSupply: readOrderFailureSummary(row.cannot_supply),
    late: readOrderLateSummary(row.late),
  };
}

export function readSalesOrderList(data: Json): SalesOrderList {
  const body = readRecord(data) ?? {};
  const views = readRecord(body.views) ?? {};
  const summary = readRecord(body.summary) ?? {};
  return {
    view: oneOf(SALES_ORDER_VIEWS, body.view, 'all_open'),
    rows: readArray(body.rows).flatMap((item) => readSalesOrderRow(item) ?? []),
    total: readNumber(body.total) ?? 0,
    toPickUnits: readNumber(body.to_pick_units) ?? 0,
    views: {
      mine: readNumber(views.mine) ?? 0,
      drafts: readNumber(views.drafts) ?? 0,
      toOrder: readNumber(views.to_order) ?? 0,
      toPick: readNumber(views.to_pick) ?? 0,
      toPack: readNumber(views.to_pack) ?? 0,
      readyCollection: readNumber(views.ready_collection) ?? 0,
      readyDelivery: readNumber(views.ready_delivery) ?? 0,
      outForDelivery: readNumber(views.out_for_delivery) ?? 0,
      onHold: readNumber(views.on_hold) ?? 0,
      actionRequired: readNumber(views.action_required) ?? 0,
      allOpen: readNumber(views.all_open) ?? 0,
    },
    summary: {
      open: readNumber(summary.open) ?? 0,
      needsAction: readNumber(summary.needs_action) ?? 0,
      drafts: readNumber(summary.drafts) ?? 0,
      onHold: readNumber(summary.on_hold) ?? 0,
      withCustomer: readNumber(summary.with_customer) ?? 0,
      actionRequired: readNumber(summary.action_required) ?? 0,
    },
    locations: readArray(body.locations).flatMap((item) => readPlace(item) ?? []),
    owners: readArray(body.owners).flatMap((item) => readEnquiryOwner(item) ?? []),
    me: readString(body.me),
    now: readString(body.now) ?? new Date().toISOString(),
  };
}

function readLine(value: Json | undefined): SalesOrderLine | null {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  const partId = readNumber(row?.part_id);
  if (!row || id == null || partId == null) return null;
  return {
    id,
    partId,
    brand: readString(row.brand) ?? '',
    number: readString(row.number) ?? '',
    description: readString(row.description),
    quantity: readNumber(row.quantity) ?? 1,
    unitPrice: readNumber(row.unit_price) ?? 0,
    lineTotal: readNumber(row.line_total) ?? 0,
    supply: oneOf(OFFER_SUPPLIES, row.supply, 'stock'),
    locationId: readNumber(row.location_id),
    location: readString(row.location),
    sourceId: readNumber(row.source_id),
    supplier: readString(row.supplier),
    onHandNow: readNumber(row.on_hand_now),
    delivery: readOfferDelivery(row.delivery),
    missedCutoffAt: readString(row.missed_cutoff_at),
    fit: typeof row.fit === 'string' && (PART_FITS as readonly string[]).includes(row.fit) ? (row.fit as PartFit) : null,
    registration: readString(row.registration),
    requestId: readNumber(row.request_id),
    // still with us: set aside less what left the shelf (S5a-2a)
    setAside: (readNumber(row.set_aside) ?? 0) - (readNumber(row.supplied) ?? 0) - (readNumber(row.sent_out) ?? 0),
    toOrder: readNumber(row.to_order) ?? 0,
    withoutStock: readNumber(row.without_stock) ?? 0,
    cancelled: readBoolean(row.cancelled) ?? false,
    removed: readNumber(row.removed) ?? 0,
    place: readString(row.place),
    onHand: readNumber(row.on_hand) ?? 0,
    available: readNumber(row.available) ?? 0,
    bin: readString(row.bin),
    binQty: readNumber(row.bin_qty),
    canSetAside: readNumber(row.can_set_aside) ?? 0,
    onShelf: readNumber(row.here) ?? readNumber(row.on_shelf) ?? 0,
    supplied: readNumber(row.supplied) ?? 0,
    sentOut: readNumber(row.sent_out) ?? 0,
    picked: readNumber(row.picked) ?? 0,
    notFound: readNotFound(row.not_found),
    onPo: readNumber(row.on_po) ?? 0,
    arrived: readNumber(row.arrived) ?? 0,
    stillToOrder: readNumber(row.still_to_order) ?? readNumber(row.to_order) ?? 0,
    cannotSupply: readNumber(row.cannot_supply) ?? 0,
    supplyLinks: readSupplyLinks(row.supply_links),
    unitCost: readNumber(row.unit_cost),
    margin: readNumber(row.margin),
  };
}

export function readSalesOrderDetail(data: Json): SalesOrderDetail | null {
  const body = readRecord(data);
  const id = readString(body?.id);
  const number = readString(body?.number);
  if (!body || !id || !number) return null;
  const delivery = readRecord(body.delivery) ?? {};
  const enquiry = readRecord(body.enquiry);
  const figures = readRecord(body.figures) ?? {};
  const credit = readRecord(figures.credit);
  const terms = readRecord(body.terms);
  const shelf = readRecord(body.shelf);
  return {
    id,
    number,
    status: oneOf(SALES_ORDER_STATUSES, body.status, 'draft'),
    step: body.step === 'confirm' ? 'confirm' : null,
    fulfilment: readFulfilment(body.fulfilment),
    payment: oneOf(ORDER_PAYMENTS, body.payment, 'not_invoiced'),
    statusAt: readString(body.status_at) ?? '',
    createdAt: readString(body.created_at) ?? '',
    confirmedAt: readString(body.confirmed_at),
    createdBy: readString(body.created_by),
    location: readPlace(body.location),
    owner: readEnquiryOwner(body.owner),
    customer: readEnquiryCustomer(body.customer),
    customerPo: readString(body.customer_po),
    poRequired: readBoolean(body.po_required) ?? false,
    terms: terms ? { name: readString(terms.name) ?? '', kind: readString(terms.kind) ?? '', days: readNumber(terms.days) ?? 0 } : null,
    registrations: readStrings(body.registrations),
    delivery: { method: oneOf(DELIVERY_METHODS, delivery.method, 'collection'), address: readSalesOrderAddress(delivery.address), addressText: readString(delivery.address_text) },
    addresses: readArray(body.addresses).flatMap((item) => readSalesOrderAddress(item) ?? []),
    enquiry:
      enquiry && readString(enquiry.id)
        ? {
            id: readString(enquiry.id) ?? '',
            number: readString(enquiry.number) ?? '',
            status: readString(enquiry.status) ?? '',
            openRequests: readNumber(enquiry.open_requests) ?? 0,
            toSource: readNumber(enquiry.to_source) ?? 0,
          }
        : null,
    trail: readArray(body.trail).flatMap((item) => {
      const node = readRecord(item);
      const key = node ? oneOf(ORDER_TRAIL_STAGES, node.key, 'confirmed') : null;
      if (!node || !key || node.key !== key) return [];
      return [{ key, state: oneOf(['done', 'now', 'todo'] as const, node.state, 'todo'), done: readNumber(node.done), of: readNumber(node.of), at: readString(node.at), out: readNumber(node.out) }];
    }),
    figures: {
      subtotal: readNumber(figures.subtotal) ?? 0,
      vatRate: readNumber(figures.vat_rate) ?? 0,
      vat: readNumber(figures.vat) ?? 0,
      totalInc: readNumber(figures.total_inc) ?? 0,
      invoiced: readNumber(figures.invoiced) ?? 0,
      lineCount: readNumber(figures.line_count) ?? 0,
      units: readNumber(figures.units) ?? 0,
      setAside: (readNumber(figures.set_aside) ?? 0) - (readNumber(figures.supplied) ?? 0) - (readNumber(figures.sent_out) ?? 0),
      onShelf: readNumber(figures.here) ?? readNumber(figures.on_shelf) ?? 0,
      sentOut: readNumber(figures.sent_out) ?? 0,
      supplied: readNumber(figures.supplied) ?? 0,
      toOrder: readNumber(figures.to_order) ?? 0,
      withoutStock: readNumber(figures.without_stock) ?? 0,
      stillToOrder: readNumber(figures.still_to_order) ?? readNumber(figures.to_order) ?? 0,
      drafted: readNumber(figures.drafted) ?? 0,
      ordered: readNumber(figures.ordered) ?? 0,
      arrived: readNumber(figures.arrived) ?? 0,
      margin: readNumber(figures.margin),
      marginAmount: readNumber(figures.margin_amount),
      marginEstimated: readBoolean(figures.margin_estimated) ?? false,
      credit: credit ? { limit: readNumber(credit.limit) ?? 0, availableAfter: readNumber(credit.available_after) ?? 0 } : null,
    },
    lines: readArray(body.lines).flatMap((item) => readLine(item) ?? []),
    history: readHistoryEvents(body.history),
    cancelled: readCancelled(body.cancelled),
    hold: readHold(body.hold),
    staged: readBoolean(body.staged) ?? false,
    direct: readBoolean(body.direct) ?? false,
    hasCustomer: readBoolean(body.has_customer) ?? true,
    contactable: readBoolean(body.contactable) ?? readBoolean(body.has_customer) ?? true,
    vehicles: readArray(body.vehicles).flatMap((item) => {
      const vehicle = readRecord(item);
      const registration = readString(vehicle?.registration);
      return vehicle && registration ? [{ registration, label: readString(vehicle.label) }] : [];
    }),
    shelf: shelf ? { reason: oneOf(SHELF_REASONS, shelf.reason, 'other'), note: readString(shelf.note) } : null,
    reasons: readArray(body.reasons).flatMap((item) => {
      const reason = readRecord(item);
      const code = readString(reason?.code);
      return reason && code ? [{ code, label: readString(reason.label) ?? code, needsNote: readBoolean(reason.needs_note) ?? false }] : [];
    }),
    priceBasis: oneOf(['account', 'trade', 'retail'] as const, body.price_basis, 'trade'),
    canSeeMargin: readBoolean(body.can_see_margin) ?? false,
    canEdit: readBoolean(body.can_edit) ?? false,
    canConfirm: readBoolean(body.can_confirm) ?? false,
    canCheckCredit: readBoolean(body.can_check_credit) ?? false,
    canOverride: readBoolean(body.can_override) ?? false,
    canCancel: readBoolean(body.can_cancel) ?? false,
    canAddLine: readBoolean(body.can_add_line) ?? false,
    canHold: readBoolean(body.can_hold) ?? false,
    canRelease: readBoolean(body.can_release) ?? false,
    canDiscard: readBoolean(body.can_discard) ?? false,
    canName: readBoolean(body.can_name) ?? false,
    purchaseOrders: readLinkedPurchaseOrders(body.purchase_orders),
    paymentTaken: readPaymentTaken(body.payment_taken),
    putAsideReceipts: readPutAsideReceipts(body.put_aside_receipts),
    putAsideAt: readString(body.put_aside_at),
    readyMessageAt: readString(body.ready_message_at),
    urgent: readBoolean(body.urgent) ?? false,
    pack: readOrderPack(body.pack),
    picker: readString(body.picker),
    handovers: readHandovers(body.handovers),
    canHandOver: readBoolean(body.can_hand_over) ?? false,
    canOrderIn: readBoolean(body.can_order_in) ?? false,
    orderInUnits: readNumber(body.order_in_units) ?? readNumber(figures.still_to_order) ?? 0,
    canOrderInUnpaid: readBoolean(body.can_order_in_unpaid) ?? false,
    canBuildOrders: readBoolean(body.can_build_orders) ?? false,
    canPlaceOrders: readBoolean(body.can_place_orders) ?? false,
    canApproveOrders: readBoolean(body.can_approve_orders) ?? false,
    failures: readLineFailures(body.failures),
    late: readLateLines(body.late),
    ifCannotSupply: readOrderPreference(body.if_cannot_supply),
    canEditAccount: readBoolean(body.can_edit_account) ?? false,
    now: readString(body.now) ?? new Date().toISOString(),
  };
}

export function readOrderCredit(value: Json | undefined): OrderCredit | null {
  const row = readRecord(value);
  if (!row) return null;
  const blocked = row.blocked_by;
  return {
    name: readString(row.name),
    blockedBy: blocked === 'on_stop' || blocked === 'over_limit' || blocked === 'closed' ? blocked : null,
    hasCredit: readBoolean(row.has_credit) ?? false,
    statusReason: readString(row.status_reason),
    since: readString(row.since),
    limit: readNumber(row.limit) ?? 0,
    availableAfter: readNumber(row.available_after) ?? 0,
    overBy: readNumber(row.over_by) ?? 0,
  };
}

export function readOrderConfirmPreview(data: Json): OrderConfirmPreview {
  const body = readRecord(data) ?? {};
  return {
    number: readString(body.number) ?? '',
    customer: readEnquiryCustomer(body.customer),
    totalInc: readNumber(body.total_inc) ?? 0,
    location: readString(body.location),
    lines: readArray(body.lines).flatMap((item) => {
      const line = readRecord(item);
      const id = readNumber(line?.id);
      if (!line || id == null) return [];
      return [
        {
          id,
          brand: readString(line.brand) ?? '',
          number: readString(line.number) ?? '',
          quantity: readNumber(line.quantity) ?? 1,
          place: readString(line.place),
          onHand: readNumber(line.on_hand) ?? 0,
          available: readNumber(line.available) ?? 0,
          takes: readNumber(line.takes) ?? 0,
          short: readNumber(line.short) ?? 0,
          heldBy: readArray(line.held_by).flatMap((held) => {
            const order = readRecord(held);
            const orderId = readString(order?.id);
            return order && orderId ? [{ id: orderId, number: readString(order.number) ?? '', quantity: readNumber(order.quantity) ?? 0 }] : [];
          }),
        },
      ];
    }),
    credit: readOrderCredit(body.credit),
    poMissing: readBoolean(body.po_missing) ?? false,
    noCustomer: readBoolean(body.no_customer) ?? false,
    contactable: readBoolean(body.contactable) ?? !(readBoolean(body.no_customer) ?? false),
    orderIn: readRecord(body.order_in) ? readOrderInOptions(body.order_in) : null,
  };
}

export function readOrderOpened(data: Json): OrderOpened {
  const body = readRecord(data) ?? {};
  const hold = body.status === 'on_hold' ? readHold(body) : null;
  if (hold) return { status: 'on_hold', hold };
  return {
    status: 'open',
    setAside: readNumber(body.set_aside) ?? 0,
    toOrder: readNumber(body.to_order) ?? 0,
    withoutStock: readNumber(body.without_stock) ?? 0,
    location: readString(body.location),
    orderIn: readOrderedIn(body.order_in),
    orderInError: readString(body.order_in_error),
  };
}

export function readPartSetAside(data: Json): PartSetAside {
  const body = readRecord(data) ?? {};
  return {
    places: readArray(body.places).flatMap((item) => {
      const row = readRecord(item);
      const locationId = readNumber(row?.location_id);
      if (!row || locationId == null) return [];
      return [{ locationId, location: readString(row.location) ?? '', onHand: readNumber(row.on_hand) ?? 0, setAside: readNumber(row.set_aside) ?? 0, available: readNumber(row.available) ?? 0 }];
    }),
    orders: readSetAsideOrders(body.orders),
  };
}

export function readSetAsideOrders(value: Json | undefined): SetAsideOrder[] {
  return readArray(value).flatMap((item) => {
    const row = readRecord(item);
    const id = readString(row?.id);
    if (!row || !id) return [];
    return [
      {
        id,
        number: readString(row.number) ?? '',
        quantity: readNumber(row.quantity) ?? 0,
        withoutStock: readNumber(row.without_stock) ?? 0,
        substitute: readBoolean(row.substitute) ?? false,
        location: readString(row.location),
        confirmedAt: readString(row.confirmed_at),
        customer: readEnquiryCustomer(row.customer),
      },
    ];
  });
}

export function readEnquiryOrderPreview(data: Json): EnquiryOrderPreview {
  const body = readRecord(data) ?? {};
  return {
    lines: readArray(body.lines).flatMap((item) => {
      const line = readRecord(item);
      const offerId = readNumber(line?.offer_id);
      const requestId = readNumber(line?.request_id);
      if (!line || offerId == null || requestId == null) return [];
      return [{ offerId, requestId, brand: readString(line.brand) ?? '', number: readString(line.number) ?? '', quantity: readNumber(line.quantity) ?? 1, lineTotal: readNumber(line.line_total) ?? 0 }];
    }),
    subtotal: readNumber(body.subtotal) ?? 0,
    vatRate: readNumber(body.vat_rate) ?? 0,
    vat: readNumber(body.vat) ?? 0,
    totalInc: readNumber(body.total_inc) ?? 0,
    customer: readEnquiryCustomer(body.customer),
    registrations: readStrings(body.registrations),
    poRequired: readBoolean(body.po_required) ?? false,
    canCreate: readBoolean(body.can_create) ?? false,
  };
}

// ------------------------------------------------------------------------------------------- calls

export function listSalesOrders(
  supabase: Client,
  options: { view?: SalesOrderView; search?: string; locationId?: number | null; limit?: number; offset?: number; filters?: SalesOrderFilters } = {},
): Promise<SalesOrderList> {
  const args: { p_view: string; p_search?: string; p_location?: number; p_limit?: number; p_offset?: number; p_filters?: Json } = { p_view: options.view ?? 'all_open' };
  if (options.search?.trim()) args.p_search = options.search.trim();
  if (options.locationId != null) args.p_location = options.locationId;
  if (options.limit != null) args.p_limit = options.limit;
  if (options.offset != null) args.p_offset = options.offset;
  const filters = salesOrderFilterFields(options.filters ?? {});
  if (Object.keys(filters).length > 0) args.p_filters = filters;
  return call(supabase.rpc('sales_order_list', args), readSalesOrderList);
}

// What the Filters button narrows the list by. An owner is a person's id, or "none" for orders nobody owns.
export type SalesOrderFilters = { method?: DeliveryMethod | null; payment?: OrderPayment | null; owner?: string | null };

export function salesOrderFilterFields(filters: SalesOrderFilters): { [key: string]: Json } {
  const p: { [key: string]: Json } = {};
  if (filters.method) p.method = filters.method;
  if (filters.payment) p.payment = filters.payment;
  if (filters.owner) p.owner = filters.owner;
  return p;
}

export function getSalesOrder(supabase: Client, id: string): Promise<SalesOrderDetail | null> {
  return call(supabase.rpc('sales_order_detail', { p_id: id }), readSalesOrderDetail);
}

export function previewEnquiryOrder(supabase: Client, enquiryId: string): Promise<EnquiryOrderPreview> {
  return call(supabase.rpc('enquiry_order_preview', { p_id: enquiryId }), readEnquiryOrderPreview);
}

// Makes a draft order from every accepted offer on the enquiry's open requests.
export function createOrderFromEnquiry(supabase: Client, enquiryId: string, order: { customerPo?: string | null } = {}): Promise<{ id: string; number: string }> {
  const p: { [key: string]: Json } = {};
  if (order.customerPo?.trim()) p.customer_po = order.customerPo;
  return call(supabase.rpc('enquiry_create_order', { p_id: enquiryId, p }), (data) => {
    const row = readRecord(data) ?? {};
    return { id: readString(row.id) ?? '', number: readString(row.number) ?? '' };
  });
}

// What can change on a draft besides its lines. A delivery or a courier has one of the account's addresses or a
// typed one; a collection has neither.
export type SalesOrderChanges = { customerPo?: string | null; delivery?: { method: DeliveryMethod; addressId?: number | null; addressText?: string | null } };

export function salesOrderFields(changes: SalesOrderChanges): { [key: string]: Json } {
  const p: { [key: string]: Json } = {};
  if (changes.customerPo !== undefined) p.customer_po = changes.customerPo ?? '';
  if (changes.delivery) {
    p.method = changes.delivery.method;
    if (changes.delivery.method !== 'collection') {
      if (changes.delivery.addressId != null) p.address_id = changes.delivery.addressId;
      else if (changes.delivery.addressText?.trim()) p.address_text = changes.delivery.addressText;
    }
  }
  return p;
}

export function saveSalesOrder(supabase: Client, id: string, changes: SalesOrderChanges): Promise<void> {
  return call(supabase.rpc('sales_order_save', { p_id: id, p: salesOrderFields(changes) }), () => undefined);
}

export function saveSalesOrderLine(supabase: Client, lineId: number, quantity: number): Promise<void> {
  return call(supabase.rpc('sales_order_save_line', { p_line: lineId, p_quantity: quantity }), () => undefined);
}

export function removeSalesOrderLine(supabase: Client, lineId: number): Promise<void> {
  return call(supabase.rpc('sales_order_remove_line', { p_line: lineId }), () => undefined);
}

export function cancelSalesOrder(supabase: Client, id: string, how: { outcome: CancelOutcome; reason?: string | null; note?: string | null }): Promise<void> {
  const p: { [key: string]: Json } = { outcome: how.outcome };
  if (how.outcome === 'lost' && how.reason) p.reason = how.reason;
  if (how.outcome === 'lost' && how.note?.trim()) p.note = how.note;
  return call(supabase.rpc('sales_order_cancel', { p_id: id, p }), () => undefined);
}

export function previewOrderConfirm(supabase: Client, id: string): Promise<OrderConfirmPreview> {
  return call(supabase.rpc('sales_order_confirm_preview', { p_id: id }), readOrderConfirmPreview);
}

// The short lines to set aside anyway, with the one reason the stock figure is wrong (and a note, for Other); and the
// parts to put on purchase orders once it is open, with a retail customer's payment.
export type OrderConfirmChoices = {
  inStock?: number[];
  reason?: ShelfReason | null;
  note?: string | null;
  orderIn?: OrderInChoice[];
  payment?: PaymentInput | null;
};

export function orderConfirmFields(choices: OrderConfirmChoices): { [key: string]: Json } {
  const p: { [key: string]: Json } = {};
  if (choices.orderIn?.length) p.order_in = orderInChoiceFields(choices.orderIn);
  if (choices.orderIn?.length && choices.payment) p.payment = paymentFields(choices.payment);
  if (!choices.inStock?.length) return p;
  p.in_stock = choices.inStock;
  if (choices.reason) p.reason = choices.reason;
  if (choices.reason === 'other' && choices.note?.trim()) p.note = choices.note;
  return p;
}

export function confirmSalesOrder(supabase: Client, id: string, choices: OrderConfirmChoices = {}): Promise<OrderOpened> {
  return call(supabase.rpc('sales_order_confirm', { p_id: id, p: orderConfirmFields(choices) }), readOrderOpened);
}

export function checkOrderCredit(supabase: Client, id: string): Promise<OrderOpened> {
  return call(supabase.rpc('sales_order_check_credit', { p_id: id }), readOrderOpened);
}

export function overrideOrderHold(supabase: Client, id: string, reason: string): Promise<OrderOpened> {
  return call(supabase.rpc('sales_order_override_hold', { p_id: id, p_reason: reason }), readOrderOpened);
}

export function cancelSalesOrderLine(supabase: Client, lineId: number): Promise<void> {
  return call(supabase.rpc('sales_order_cancel_line', { p_line: lineId }), () => undefined);
}

// Sets aside stock that has arrived for a line that is to order. Returns how many units it took.
export function setAsideOrderLine(supabase: Client, lineId: number): Promise<number> {
  return call(supabase.rpc('sales_order_set_aside_line', { p_line: lineId }), (data) => readNumber(data) ?? 0);
}

// ------------------------------------------------------------------------------------------- an order with no enquiry

// New sale: who it is for (nobody, for a cash sale), the vehicles, and the branch.
export type NewSale = EnquiryCustomerInput & { locationId?: number | null; registrations?: string[] };

export function newSaleFields(sale: NewSale): { [key: string]: Json } {
  const p: { [key: string]: Json } = {};
  if (sale.partyId != null) {
    p.party_id = sale.partyId;
    if (sale.contactId != null) p.contact_id = sale.contactId;
  } else if (sale.retailContactId != null) {
    p.retail_contact_id = sale.retailContactId;
  } else {
    if (sale.callerName?.trim()) p.caller_name = sale.callerName;
    if (sale.callerPhone?.trim()) p.caller_phone = sale.callerPhone;
  }
  if (sale.locationId != null) p.location_id = sale.locationId;
  const plates = (sale.registrations ?? []).map((plate) => plate.trim()).filter(Boolean);
  if (plates.length > 0) p.registrations = plates;
  return p;
}

// What New sale shows before the order is made: the customer and terms, when the account went on stop, and what
// each registration is matched to. Nothing is saved and nothing is looked up outside.
export type NewSalePreview = {
  customer: EnquiryCustomer;
  terms: { name: string; kind: string; days: number } | null;
  stoppedSince: string | null;
  vehicles: { registration: string; label: string | null }[];
};

export function readNewSalePreview(data: Json): NewSalePreview {
  const body = readRecord(data) ?? {};
  const terms = readRecord(body.terms);
  return {
    customer: readEnquiryCustomer(body.customer),
    terms: terms ? { name: readString(terms.name) ?? '', kind: readString(terms.kind) ?? '', days: readNumber(terms.days) ?? 0 } : null,
    stoppedSince: readString(body.stopped_since),
    vehicles: readArray(body.vehicles).flatMap((item) => {
      const vehicle = readRecord(item);
      const registration = readString(vehicle?.registration);
      return vehicle && registration ? [{ registration, label: readString(vehicle.label) }] : [];
    }),
  };
}

export function previewNewSale(supabase: Client, sale: Pick<NewSale, 'partyId' | 'contactId' | 'retailContactId' | 'registrations'> = {}): Promise<NewSalePreview> {
  const p = newSaleFields(sale);
  return call(supabase.rpc('sales_order_create_preview', { p }), readNewSalePreview);
}

export function createSalesOrder(supabase: Client, sale: NewSale = {}): Promise<{ id: string; number: string }> {
  return call(supabase.rpc('sales_order_create', { p: newSaleFields(sale) }), (data) => {
    const row = readRecord(data) ?? {};
    return { id: readString(row.id) ?? '', number: readString(row.number) ?? '' };
  });
}

export function discardSalesOrder(supabase: Client, id: string): Promise<void> {
  return call(supabase.rpc('sales_order_discard', { p_id: id }), () => undefined);
}

export function setSalesOrderCaller(supabase: Client, id: string, name: string, phone: string): Promise<void> {
  return call(supabase.rpc('sales_order_set_caller', { p_id: id, p_name: name, p_phone: phone }), () => undefined);
}

// Find parts on an order: the enquiry's search, with the order it adds to and the credit the account has left.
export type OrderFoundParts = FoundParts & {
  orderId: string;
  number: string;
  status: SalesOrderStatus;
  staged: boolean;
  lines: number;
  vatRate: number;
  // Only for an account with a credit limit: what is left with the order as it stands, VAT included.
  credit: { name: string | null; limit: number; available: number } | null;
};

export function readOrderFoundParts(data: Json): OrderFoundParts {
  const body = readRecord(data) ?? {};
  const credit = readRecord(body.credit);
  return {
    ...readFoundParts(data),
    orderId: readString(body.order_id) ?? '',
    number: readString(body.number) ?? '',
    status: oneOf(SALES_ORDER_STATUSES, body.status, 'draft'),
    staged: readBoolean(body.staged) ?? false,
    lines: readNumber(body.lines) ?? 0,
    vatRate: readNumber(body.vat_rate) ?? 0,
    credit: credit && readNumber(credit.limit) != null ? { name: readString(credit.name), limit: readNumber(credit.limit) ?? 0, available: readNumber(credit.available) ?? 0 } : null,
  };
}

export function findPartsForOrder(supabase: Client, orderId: string, search?: string | null): Promise<OrderFoundParts> {
  return call(supabase.rpc('sales_order_find_parts', { p_order: orderId, p_search: search?.trim() || null }), readOrderFoundParts);
}

// A part for an order: from this branch when it has any, from a named supplier, or from another branch.
export type NewSalesOrderLine = { partId: number; quantity?: number; sourceId?: number | null; locationId?: number | null; branchPlan?: 'collect' | 'move' | null };

export function orderLineFields(line: NewSalesOrderLine): { [key: string]: Json } {
  const p: { [key: string]: Json } = { part_id: line.partId };
  if (line.quantity != null) p.quantity = line.quantity;
  if (line.locationId != null) {
    p.location_id = line.locationId;
    if (line.branchPlan) p.branch_plan = line.branchPlan;
  } else if (line.sourceId != null) p.source_id = line.sourceId;
  return p;
}

// What adding did: the line as it now stands, how many this press added, and the order's standing afterwards.
export type OrderLineAdded = {
  lineId: number;
  part: string;
  quantity: number;
  added: number;
  setAside: number;
  toOrder: number;
  place: string | null;
  status: SalesOrderStatus;
  staged: boolean;
  hold: OrderHold | null;
};

export function readOrderLineAdded(data: Json): OrderLineAdded {
  const body = readRecord(data) ?? {};
  return {
    lineId: readNumber(body.line_id) ?? 0,
    part: readString(body.part) ?? '',
    quantity: readNumber(body.quantity) ?? 1,
    added: readNumber(body.added) ?? 1,
    setAside: readNumber(body.set_aside) ?? 0,
    toOrder: readNumber(body.to_order) ?? 0,
    place: readString(body.place),
    status: oneOf(SALES_ORDER_STATUSES, body.status, 'draft'),
    staged: readBoolean(body.staged) ?? false,
    hold: readHold(body.hold),
  };
}

export function addSalesOrderLine(supabase: Client, orderId: string, line: NewSalesOrderLine): Promise<OrderLineAdded> {
  return call(supabase.rpc('sales_order_add_line', { p_order: orderId, p: orderLineFields(line) }), readOrderLineAdded);
}

export function holdSalesOrder(supabase: Client, id: string, note: string): Promise<void> {
  return call(supabase.rpc('sales_order_hold', { p_id: id, p_note: note }), () => undefined);
}

export function releaseSalesOrderHold(supabase: Client, id: string): Promise<OrderOpened> {
  return call(supabase.rpc('sales_order_release_hold', { p_id: id }), readOrderOpened);
}

export function getPartSetAside(supabase: Client, partId: number): Promise<PartSetAside> {
  return call(supabase.rpc('part_set_aside', { p_part: partId }), readPartSetAside);
}

// ------------------------------------------------------------------------------------------- words

// Under the order number in the list: "YK19 HNC · 3 lines", "2 vehicles · 4 lines", or just "1 line" with no vehicle.
export function orderRowSub(row: Pick<SalesOrderRow, 'registrations' | 'lineCount'>): string {
  const plates = row.registrations.length;
  const vehicle = plates === 0 ? null : plates === 1 ? row.registrations[0] : `${plates} vehicles`;
  return [vehicle, `${row.lineCount} ${row.lineCount === 1 ? 'line' : 'lines'}`].filter(Boolean).join(' · ');
}

// Under the customer's name in the list: "Account C00014 · customer PO HG-2291", "Retail card · 07700 900412". It
// is always "customer PO", so it is never read as one of our purchase orders.
export function orderCustomerSub(row: Pick<SalesOrderRow, 'customer' | 'customerPo'>): string {
  const customer = row.customer;
  const who =
    customer.kind === 'account'
      ? `Account ${customer.accountNumber ?? ''}`.trim()
      : customer.kind === 'card'
        ? ['Retail card', customer.phone].filter(Boolean).join(' · ')
        : customer.kind === 'erased'
          ? 'Details erased'
          : (customer.phone ?? '');
  return [who, row.customerPo ? `customer PO ${row.customerPo}` : null].filter(Boolean).join(' · ');
}

// What a confirmed order is waiting for, in units: "2 units to order · 2 to pick", "3 units to pick".
export function orderStockWords(toOrder: number, toPick: number, joiner = ' · '): string {
  const units = (n: number) => `${quantityWords(n)} ${n === 1 ? 'unit' : 'units'}`;
  if (toOrder > 0 && toPick > 0) return `${units(toOrder)} to order${joiner}${quantityWords(toPick)} to pick`;
  if (toOrder > 0) return `${units(toOrder)} to order`;
  if (toPick > 0) return `${units(toPick)} to pick`;
  return '';
}

// The line after the pills on the order page: "Needs action · 2 units on draft PO-000007, 2 to pick". An order on
// hold says why in its alert, not here. Ordered units that are on time ask nothing: the order waits for the delivery.
// Units only suppliers on hold list (slice three a) are said as that, not as to order: "Needs action · 1 unit waits on
// a supplier on hold"; once the customer chose to wait, "Waiting for Calder Parts to come off hold · ask Hill Street
// Garage again Tue 24 Nov". The counter's step leads and the stock words follow after a dot: "Needs action · ask Hill
// Street Garage: 1 substitute to agree · 1 put aside".
// What is on the collection and delivery shelf, by how it got there (Picking critique round 2: picked units read as
// goods in's "put aside"): "2 picked", "1 put aside", "2 picked, 1 put aside"; withUnit names the unit on the first.
export function shelfWords(onShelf: number, picked: number, withUnit = false): string {
  const byPick = Math.min(Math.max(picked, 0), onShelf);
  const byGoodsIn = onShelf - byPick;
  const unit = (n: number) => (withUnit ? ` ${n === 1 ? 'unit' : 'units'}` : '');
  const parts = [byPick > 0 ? [byPick, 'picked'] : null, byGoodsIn > 0 ? [byGoodsIn, 'put aside'] : null].filter(
    (part): part is [number, string] => part != null,
  );
  return parts.map(([n, how], i) => `${quantityWords(n)}${i === 0 ? unit(n) : ''} ${how}`).join(', ');
}

export function orderStateWords(
  order: Pick<SalesOrderDetail, 'status' | 'cancelled' | 'figures'> & { purchaseOrders?: LinkedPurchaseOrder[]; failures?: LineFailure[]; lines?: SalesOrderLine[]; hold?: OrderHold | null; now?: string },
): string {
  if (order.status === 'draft') return 'Not confirmed · nothing set aside or ordered';
  if (order.status === 'cancelled') return order.cancelled ? `Cancelled · ${cancelledWords(order.cancelled).why}` : 'Cancelled';
  // The list's lead words, worked out from the order's own failures, so the page and the list say the same. The page
  // says why where the need row doesn't ("Remove 2 · customer asked"), and leaves "3 can’t be supplied" to the need row
  // under it.
  const failed = summariseFailures(order.failures ?? [], order.lines ?? []);
  const { lead: stepLead } = failureLead(failed, order.now);
  const stepFailure = (order.failures ?? []).find((f) => f.step != null && f.step === failed?.step);
  // The customer's answer, else the account's default (one name for the setting: "default").
  const byAnswer: Partial<Record<NonNullable<OrderFailureSummary['step']>, [LineFailure['answer'], string]>> = {
    replace: ['equivalent', 'customer chose an equivalent'],
    take_off: ['take_off', 'customer asked'],
    reorder: ['same_part', 'customer chose the same part'],
  };
  const rule = failed?.step ? byAnswer[failed.step] : undefined;
  const why = rule ? (stepFailure?.answer === rule[0] ? rule[1] : 'the account’s default') : null;
  const step = failed?.step === 'ask' ? 'Ask customer' : why ? `${stepLead} · ${why}` : stepLead;
  if (order.status === 'on_hold') return failed?.step ? step : order.hold ? holdRowWords(order.hold) : '';
  if (order.status !== 'open') return '';
  const open = (order.failures ?? []).filter((f) => f.step != null);
  const held = open.filter((f) => f.step !== 'reorder' && onSupplierHold(f));
  const waiting = held.filter((f) => f.step === 'wait');
  const asking = held.filter((f) => f.step !== 'wait').reduce((sum, f) => sum + f.units, 0);
  const waitUnits = waiting.reduce((sum, f) => sum + f.units, 0);
  const { drafted, ordered, arrived, setAside, onShelf } = order.figures;
  const picked = (order.lines ?? []).filter((line) => !line.cancelled).reduce((sum, line) => sum + (line.picked ?? 0), 0);
  // A part purchasing is reordering after a let-down (Customer lines) is purchasing's step, not the counter's.
  const reorder = open.filter((f) => f.step === 'reorder' && !onSupplierHold(f)).reduce((sum, f) => sum + f.units, 0);
  const stillToOrder = Math.max(order.figures.stillToOrder - asking - waitUnits - reorder, 0);
  // Units goods in put on the collection shelf are set aside but not to pick (S4b): they wait for the customer.
  const toPick = Math.max(setAside - onShelf, 0);
  const drafts = (order.purchaseOrders ?? []).filter((po) => po.status === 'draft' && po.units > 0);
  const parts = [
    stillToOrder > 0 ? `${quantityWords(stillToOrder)} to order` : null,
    drafted > 0 ? `${quantityWords(drafted)} on ${drafts.length === 1 && drafts[0] ? `draft ${drafts[0].number}` : 'draft purchase orders'}` : null,
    arrived > 0 ? `${quantityWords(arrived)} arrived to set aside` : null,
    toPick > 0 ? `${quantityWords(toPick)} to pick` : null,
  ].filter((part): part is string => part != null);
  const first = (text: string, n: number) => text.replace(quantityWords(n), `${quantityWords(n)} ${n === 1 ? 'unit' : 'units'}`);
  const lead = [stillToOrder, drafted, arrived, toPick].find((n) => n > 0) ?? 0;
  const shelf = onShelf > 0 ? `, ${shelfWords(onShelf, picked)}` : '';
  const [head, ...rest] = parts;
  const tail = `${shelf}${ordered > 0 ? `, ${quantityWords(ordered)} ordered` : ''}`;
  const stock = head
    ? `${[first(head, lead), ...rest].join(', ')}${tail}`
    : onShelf > 0
      ? `${shelfWords(onShelf, picked, true)}${ordered > 0 ? `, ${quantityWords(ordered)} ordered` : ''}`
      : tail.replace(/^, /, '');
  if (step) return `${step}${stock ? ` · ${stock}` : ''}`;
  // The pill says the stage; the line says what it is made of, as the list does.
  if (head) return stock;
  return ordered > 0 ? `Waiting for delivery · ${quantityWords(ordered)} ${ordered === 1 ? 'unit' : 'units'} ordered${shelf}` : '';
}

// The line after the pills on a ready order (board 6n): a collection asks for the customer to be told until the
// message is copied; a delivery waits for the run (S5). customerName is the name the page shows, or null for a cash
// sale with no name ("tell the customer", not "tell Cash sale": critique round 2).
export function readyStateWords(
  order: Pick<SalesOrderDetail, 'fulfilment' | 'delivery' | 'location' | 'putAsideAt' | 'readyMessageAt'> & { pack?: OrderPack | null },
  customerName: string | null,
): string {
  if (order.delivery.method === 'collection') {
    return readyToTell(order) ? `Needs action · tell ${customerName ?? 'the customer'}` : readyNeedWords(order.location).replace(/\.$/, '');
  }
  const summary = deliverySummary(order);
  const to = summary.indexOf(' to ');
  const at = order.location ? ` at ${order.location.name}` : '';
  const kind = order.delivery.method === 'courier' ? 'courier' : 'delivery';
  // Packed (S5b-1): "2 parcels packed at Leeds"; the header already says where the delivery goes.
  if (order.pack?.covers) return `${parcelsWords(order.pack.parcels)} packed${at}`;
  return `Every part is put aside${at} for ${kind}${to >= 0 ? summary.slice(to) : ''}`;
}

// The words under the pill in the list, in two parts: the lead (the next move) and the rest (the stock words). tone
// says how the lead is set: 'move' for the counter's own step (medium ink), 'late' for a reply past the next working
// day (bold ink with "↑"), null for words that only report (quiet ink).
export type OrderStepParts = { lead: string; tone: 'move' | 'late' | null; rest: string };

// The lead words when a supplier let the customer down, the same on the list, the preview and the line after the pills
// (one function, so they can't drift apart): "Ask customer · 3 can’t be supplied", "No reply yet · asked today 09:05",
// "↑ No reply since Wed 18 Nov", "Replace part", "Remove 2" ("Cancel line" for all of it), "Calder Parts on hold · ask
// again Tue 24 Nov", "With purchasing", "Tell customer · back on order".
export function failureLead(failed: OrderFailureSummary | null | undefined, now?: string): { lead: string; tone: OrderStepParts['tone'] } {
  if (!failed) return { lead: '', tone: null };
  const agree = failed.substitutes;
  const plain = failed.units - agree;
  const since = failed.askedAt && now ? dayAndTime(failed.askedAt, now) : null;
  const about = [
    agree > 0 ? `${quantityWords(agree)} ${agree === 1 ? 'substitute' : 'substitutes'} to agree` : null,
    failed.onHold > 0 ? `${failed.heldSupplier ?? 'a supplier'} on hold` : null,
    plain > 0 ? `${quantityWords(plain)} can’t be supplied` : null,
  ].filter(Boolean).join(', ');
  switch (failed.step) {
    case 'ask':
      return { lead: `Ask customer${about ? ` · ${about}` : ''}`, tone: 'move' };
    case 'answer':
      return failed.answerOverdue
        ? { lead: `↑ No reply since ${since ?? 'the ask'}`, tone: 'late' }
        : { lead: `No reply yet${since ? ` · asked ${since}${failed.askedVia ? ` ${CUSTOMER_CHANNEL_PHRASE[failed.askedVia]}` : ''}` : ''}`, tone: null };
    case 'replace':
      return { lead: 'Replace part', tone: 'move' };
    case 'take_off':
      return { lead: failed.takeOffWhole || !failed.takeOffUnits ? 'Cancel line' : `Remove ${quantityWords(failed.takeOffUnits)}`, tone: 'move' };
    case 'wait':
      return { lead: `${failed.heldSupplier ?? 'The supplier'} on hold${failed.askAgainOn ? ` · ask again ${dateWords(failed.askAgainOn)}` : ''}`, tone: null };
    case 'reorder':
      return { lead: 'With purchasing', tone: null };
    default:
      return failed.tell ? { lead: 'Tell customer · back on order', tone: 'move' } : { lead: '', tone: null };
  }
}


// The list's summary of an order's failures, worked out from the order page's own failures (the same numbers the
// database gives the list), so the page leads with the same words.
export function summariseFailures(failures: LineFailure[], lines: Pick<SalesOrderLine, 'id' | 'quantity'>[] = []): OrderFailureSummary | null {
  const open = failures.filter((f) => f.step != null);
  const tell = failuresToTell(failures).length > 0;
  if (!open.length && !tell) return null;
  const sum = (list: LineFailure[]) => list.reduce((n, f) => n + f.units, 0);
  const order: NonNullable<OrderFailureSummary['step']>[] = ['ask', 'answer', 'replace', 'take_off', 'wait', 'reorder'];
  const step = order.find((key) => open.some((f) => f.step === key)) ?? null;
  const answering = open.filter((f) => f.step === 'answer');
  const takeOff = open.filter((f) => f.step === 'take_off');
  const held = open.find((f) => onSupplierHold(f));
  return {
    units: sum(open.filter((f) => !onSupplierHold(f))),
    reorder: sum(open.filter((f) => f.step === 'reorder' && !onSupplierHold(f))),
    substitutes: sum(open.filter(substituteToAgree)),
    onHold: sum(open.filter((f) => onSupplierHold(f) && (f.step === 'ask' || f.step === 'answer' || f.step === 'wait'))),
    step,
    since: open.map((f) => f.createdAt).filter((at): at is string => !!at).sort()[0] ?? null,
    tell,
    askedAt: answering.map((f) => f.askedAt).filter((at): at is string => !!at).sort().at(-1) ?? null,
    askedVia: [...answering].sort((a, b) => ((a.askedAt ?? '') < (b.askedAt ?? '') ? 1 : -1))[0]?.askedVia ?? null,
    answerOverdue: open.some((f) => f.answerOverdue),
    askAgainOn: open.filter((f) => f.step === 'wait').map((f) => f.askAgainOn).filter((d): d is string => !!d).sort()[0] ?? null,
    heldSupplier: held?.hold?.supplier ?? held?.supplier ?? null,
    takeOffUnits: sum(takeOff),
    takeOffWhole: takeOff.every((f) => f.units >= (lines.find((line) => line.id === f.lineId)?.quantity ?? f.units)),
  };
}

export function orderStepParts(
  row: Pick<SalesOrderRow, 'status' | 'cancelled' | 'toOrder' | 'toPick' | 'hold'> & {
    onShelf?: number;
    picked?: number;
    cannotSupply?: OrderFailureSummary | null;
    fulfilment?: OrderFulfilment | null;
    method?: DeliveryMethod;
    parcels?: number | null;
    deliverTo?: string | null;
  },
  now?: string,
): OrderStepParts {
  if (row.status === 'draft') return { lead: '', tone: null, rest: 'Not confirmed' };
  // A delivery ready or out says where it goes, and a packed one its parcels, as Picking's To pack does ("1 parcel ·
  // Leeds LS11"); it is loaded by parcel, not by what was picked (critique round 1).
  if (row.status === 'open' && row.method && row.method !== 'collection' && (row.fulfilment === 'ready' || row.fulfilment === 'out')) {
    const parcels = row.fulfilment === 'ready' && row.parcels ? parcelsWords(row.parcels) : null;
    return { lead: '', tone: null, rest: [parcels, row.deliverTo].filter(Boolean).join(' · ') };
  }
  if (row.status === 'open') {
    const shelf = row.onShelf ?? 0;
    const failed = row.cannotSupply;
    // A unit that can't be supplied is said once: the To order figure leaves out those purchasing is reordering.
    // Units waiting on a supplier on hold are said as that, not as To order.
    const held = failed?.onHold ?? 0;
    const stock = orderStockWords(Math.max(row.toOrder - (failed?.reorder ?? 0) - held, 0), row.toPick);
    // A supplier let the customer down (S4b part three): the next move leads, then what it is about, then the stock
    // words. "Ask customer · 1 substitute to agree", "Ask customer · Calder Parts on hold", "No reply yet · asked today
    // 09:05" ("↑ No reply since …" past the next working day), "Calder Parts on hold · ask again Tue 24 Nov", "Replace
    // part", "Remove 2" (or "Cancel line" for all of it); purchasing's reorder is "1 can’t be supplied"; a part back
    // on order, "Tell the customer · back on order".
    const { lead, tone } = failureLead(failed, now);
    // "2 units put aside" when that is all; "1 unit to pick · 1 picked" beside the rest.
    const rest = shelf === 0 ? stock : stock ? `${stock} · ${shelfWords(shelf, row.picked ?? 0)}` : shelfWords(shelf, row.picked ?? 0, true);
    return { lead, tone, rest };
  }
  // On hold for a part that can't be supplied: its step leads (Replace part, Remove 2, With purchasing), as on an open
  // order; any other hold says its reason.
  if (row.status === 'on_hold') {
    if (row.cannotSupply?.step) return { ...failureLead(row.cannotSupply, now), rest: '' };
    return { lead: '', tone: null, rest: row.hold ? holdRowWords(row.hold) : '' };
  }
  if (row.status === 'cancelled' && row.cancelled) {
    const words = cancelledWords(row.cancelled);
    return { lead: '', tone: null, rest: [words.why, words.who].filter(Boolean).join(' · ') };
  }
  return { lead: '', tone: null, rest: '' };
}

// The same words as one line: "Ask customer · Calder Parts on hold · 1 unit to pick".
export function orderStepWords(
  row: Parameters<typeof orderStepParts>[0],
  now?: string,
): string {
  const parts = orderStepParts(row, now);
  return [parts.lead, parts.rest].filter(Boolean).join(' · ');
}

export const HOLD_REASON_LABELS: Record<HoldReason, string> = {
  on_stop: 'Account on stop',
  over_limit: 'Over the credit limit',
  customer: 'Waiting for the customer',
  cannot_supply: 'Cannot supply',
};

// A held order's reason in the list, never cut short: a hold put on by hand says what would release it, a credit
// hold says who can clear it.
export function holdRowWords(hold: OrderHold): string {
  if (hold.reason === 'customer') return hold.note ? `${HOLD_REASON_LABELS.customer}: ${hold.note}` : HOLD_REASON_LABELS.customer;
  if (hold.reason === 'cannot_supply') return hold.part ? `${HOLD_REASON_LABELS.cannot_supply}: ${hold.part}` : HOLD_REASON_LABELS.cannot_supply;
  return `${HOLD_REASON_LABELS[hold.reason]} · an admin can override`;
}

// What a held order keeps: "2 units stay set aside at Central" or, when it holds none, "No stock is set aside".
function holdKeepsWords(hold: OrderHold): string {
  if (hold.kept <= 0) return 'No stock is set aside.';
  const units = `${quantityWords(hold.kept)} ${hold.kept === 1 ? 'unit stays' : 'units stay'} set aside${hold.place ? ` at ${hold.place}` : ''}`;
  return hold.reason === 'customer' || hold.reason === 'cannot_supply' ? `${units}.` : `${units}; nothing more is set aside.`;
}

// Why the account cannot take the order, as a sentence: "On stop since 2 Nov: invoices overdue." or "This order
// takes Hillside Garage £212.40 over its £2,500.00 limit."
function creditBlockWords(block: { reason: CreditHoldReason; name: string | null; statusReason: string | null; since: string | null; limit: number | null; overBy: number | null }): string {
  const name = block.name ?? 'the account';
  if (block.reason === 'over_limit') {
    return block.overBy != null && block.limit != null
      ? `This order takes ${name} ${moneyWords(block.overBy)} over its ${moneyWords(block.limit)} limit.`
      : `This order takes ${name} over its credit limit.`;
  }
  const since = block.since ? ` since ${dateWords(block.since.slice(0, 10))}` : '';
  return block.statusReason ? `On stop${since}: ${block.statusReason}.` : `${name} is on stop${since}.`;
}

// The alert on an order on hold: what in bold, then why, that nothing is set aside, and who to ask.
export function holdWords(hold: OrderHold, canOverride: boolean, now?: string): { strong: string; rest: string } {
  if (hold.reason === 'customer') {
    const note = hold.note ? `${hold.note.replace(/[.\s]+$/, '')}. ` : '';
    const who = hold.by ? ` Put on by ${hold.by}${hold.at ? `, ${dayAndTime(hold.at, now ?? new Date().toISOString())}` : ''}.` : '';
    return { strong: 'On hold: waiting for the customer.', rest: `${note}${holdKeepsWords(hold)}${who}` };
  }
  if (hold.reason === 'cannot_supply') return { strong: 'On hold', rest: 'until the part is reordered, replaced or removed.' };
  const strong = hold.reason === 'on_stop' ? 'On hold: account on stop.' : 'On hold: over the credit limit.';
  return { strong, rest: `${creditBlockWords({ ...hold, reason: hold.reason })} ${holdKeepsWords(hold)}${canOverride ? '' : ' Ask an admin to override the hold.'}` };
}

// The message after a line is added: "Brembo P 85 126 × 1 added. 1 unit set aside at Central." A draft holds
// nothing, so it says only "added".
export function lineAddedWords(added: OrderLineAdded): string {
  const head = `${added.part} × ${quantityWords(added.added)} added.`;
  if (!added.staged) return head;
  const units = (n: number) => `${quantityWords(n)} ${n === 1 ? 'unit' : 'units'}`;
  // What this press did to the stock: the units added are the last on the line, so what is to order comes from them first.
  const toOrder = Math.min(added.added, added.toOrder);
  const setAside = added.added - toOrder;
  const parts = [setAside > 0 ? `${units(setAside)} set aside${added.place ? ` at ${added.place}` : ''}` : null, toOrder > 0 ? `${units(toOrder)} to order` : null].filter(Boolean);
  return `${head}${parts.length ? ` ${parts.join(', ')}.` : ''}`;
}

// The one message when an add puts the order on hold (board 6j): the hold first, then what the add did.
export function heldByAddWords(number: string, added: OrderLineAdded): { title: string; description: string } | null {
  if (!added.hold) return null;
  return {
    title: `${number} is on hold: ${HOLD_REASON_LABELS[added.hold.reason].toLowerCase()}.`,
    description: `${added.part} × ${quantityWords(added.added)} added. ${holdKeepsWords(added.hold)}`,
  };
}

// A line already on the order, in Add line before anything is typed: what it holds, in the window's two lines.
export function onOrderWhere(line: SalesOrderLine, staged: boolean, now: string): { main: string; sub: string } {
  if (!staged) return orderLineWhere(line, now);
  const place = line.place ?? 'This branch';
  const main = [line.setAside > 0 ? `Set aside ${quantityWords(line.setAside)}` : null, line.toOrder > 0 ? `${line.setAside > 0 ? 'to' : 'To'} order ${quantityWords(line.toOrder)}` : null]
    .filter(Boolean)
    .join(' · ');
  return { main: main || place, sub: line.bin ? `Bin ${line.bin} · ${place}` : place };
}

// In Find parts on a confirmed order: what adding this many of a part would do to the account's credit. Null while
// it stays within the limit.
export function overLimitWords(credit: { name: string | null; limit: number; available: number }, price: number, quantity: number, vatRate: number): string | null {
  const gross = Math.round(price * quantity * (1 + vatRate) * 100) / 100;
  const over = Math.round((gross - credit.available) * 100) / 100;
  if (over <= 0) return null;
  return `Takes ${credit.name ?? 'the account'} ${moneyWords(over)} over its ${moneyWords(credit.limit)} limit. Adding it puts the order on hold; what is set aside stays set aside.`;
}

// New sale, when the account chosen is on stop: said in the words the hold will use.
export function newSaleStopWords(standing: { reason: string | null; since: string | null }): string {
  const since = standing.since ? ` since ${dateWords(standing.since.slice(0, 10))}` : '';
  return `On stop${since}${standing.reason ? `: ${standing.reason.replace(/[.\s]+$/, '')}` : ''}. An order on this account goes on hold until an admin overrides it.`;
}

// The warning in the Confirm window when the account cannot take the order.
export function confirmHoldWords(credit: OrderCredit): { strong: string; rest: string } | null {
  if (credit.blockedBy !== 'on_stop' && credit.blockedBy !== 'over_limit') return null;
  const name = credit.name ?? 'The account';
  const strong = credit.blockedBy === 'on_stop' ? `${name} is on stop.` : `${creditBlockWords({ reason: 'over_limit', name: credit.name, statusReason: null, since: null, limit: credit.limit, overBy: credit.overBy })}`;
  return { strong, rest: 'The order will go on hold. No stock is set aside until an admin overrides the hold.' };
}

// The message after Check credit again finds the account as it was.
export function stillHeldWords(hold: OrderHold): string {
  if (hold.reason === 'customer') return 'The order is still on hold.';
  return hold.reason === 'on_stop' ? `${hold.name ?? 'The account'} is still on stop.` : `${hold.name ?? 'The account'} is still over its credit limit.`;
}

// What confirming will do with a line, under its part in the Confirm window. Written in the future: nothing is
// set aside until Confirm order is pressed. A unit on the shelf that another order holds is named with that order.
export function confirmLineWords(line: OrderConfirmLine, onHold: boolean): string {
  const place = line.place ?? 'this branch';
  const short = line.short > 0 ? ` · ${quantityWords(line.short)} short` : '';
  if (onHold) return `${quantityWords(line.available)} available at ${place} · not set aside while on hold`;
  if (line.takes > 0) return `Sets aside ${quantityWords(line.takes)} of ${quantityWords(line.available)} at ${place}${short}`;
  if (line.heldBy.length > 0) {
    return `${quantityWords(line.onHand)} on the shelf at ${place}, set aside for ${line.heldBy.map((order) => order.number).join(', ')}${short}`;
  }
  return `${line.onHand > 0 ? 'None left' : 'None on the shelf'} at ${place}${short}`;
}

// The summary at the top of the Confirm window: "2 lines, all in stock", "1 line in stock · 2 short".
export function confirmSummaryWords(lines: OrderConfirmLine[]): string {
  const short = lines.filter((line) => line.short > 0).length;
  const covered = lines.length - short;
  const count = (n: number) => `${n} ${n === 1 ? 'line' : 'lines'}`;
  if (short === 0) return `${count(lines.length)}, all in stock`;
  if (covered === 0) return `${count(short)}, all short`;
  return `${count(covered)} in stock · ${short} short`;
}

// The message straight after an order opens: "SO-000061 confirmed. 2 units set aside at Central, 2 to order."
export function orderOpenedWords(number: string, opened: Extract<OrderOpened, { status: 'open' }>, verb = 'confirmed'): string {
  const units = (n: number) => `${quantityWords(n)} ${n === 1 ? 'unit' : 'units'}`;
  const at = opened.location ? ` at ${opened.location}` : '';
  // Units Confirm put on purchase orders are no longer "to order": "SO-000061 confirmed: 2 set aside at Central, 2 on draft PO-000007 for Pennine Parts."
  const ordered = opened.orderIn?.units ?? 0;
  const left = Math.max(opened.toOrder - ordered, 0);
  const parts = [
    opened.setAside > 0 ? `${units(opened.setAside)} set aside${at}` : null,
    ordered > 0 ? orderedInShortWords(opened.orderIn!) : null,
    left > 0 ? `${opened.setAside > 0 || ordered > 0 ? quantityWords(left) : units(left)} to order` : null,
  ].filter(Boolean);
  if (ordered > 0) return `${number} ${verb}: ${parts.join(', ')}.`;
  return `${number} ${verb}.${parts.length ? ` ${parts.join(', ')}.` : ''}`;
}

// A confirmed order's lines as the page groups them, by where they stand: Ready to pick (set aside in bins), To
// order (still to order, or on a purchase order not placed yet), On order (on a placed purchase order), Put aside
// (on the collection and delivery shelf, S4b), Cannot supply (a supplier let the customer down, S4b part three),
// Substitute to agree (the supplier sent another part, held while the customer decides) and Removed (cancelled lines,
// and units taken off a line after confirming, as Shopify shows them). A line split
// across them shows in each group, with the quantity on each side.
export type OrderLinePart = { line: SalesOrderLine; quantity: number; lineTotal: number };
export type OrderLineGroup = {
  key: 'cannot_supply' | 'substitute' | 'to_pick' | 'to_order' | 'on_order' | 'put_aside' | 'out' | 'supplied' | 'removed';
  label: string;
  sub: string;
  parts: OrderLinePart[];
};

// A link on a placed purchase order: its units are on order, no longer to order.
function isPlacedLink(link: SupplyLink): boolean {
  return link.state === 'ordered' || link.state === 'arrived';
}

// Of a line's units to order, those on placed purchase orders.
function onOrderUnits(line: SalesOrderLine): number {
  return line.supplyLinks.filter(isPlacedLink).reduce((sum, link) => sum + link.units + link.arrived, 0);
}

export function orderLineGroups(lines: SalesOrderLine[], failures: LineFailure[] = [], method: DeliveryMethod = 'collection'): OrderLineGroup[] {
  const part = (line: SalesOrderLine, quantity: number): OrderLinePart => ({ line, quantity, lineTotal: Math.round(quantity * line.unitPrice * 100) / 100 });
  const live = lines.filter((line) => !line.cancelled);
  // units waiting on the customer to agree to a substitute held for them
  const agreeing = (line: SalesOrderLine) => failures.filter((f) => f.lineId === line.id && substituteToAgree(f)).reduce((sum, f) => sum + f.units, 0);
  const substitutes = live.filter((line) => agreeing(line) > 0).map((line) => part(line, agreeing(line)));
  const failed = live.filter((line) => line.cannotSupply - agreeing(line) > 0).map((line) => part(line, line.cannotSupply - agreeing(line)));
  const pick = live.filter((line) => line.setAside - line.onShelf > 0).map((line) => part(line, line.setAside - line.onShelf));
  const toOrder = (line: SalesOrderLine) => line.toOrder - onOrderUnits(line) - line.cannotSupply;
  const order = live.filter((line) => toOrder(line) > 0).map((line) => part(line, toOrder(line)));
  const onOrder = live.filter((line) => Math.min(onOrderUnits(line), line.toOrder) > 0).map((line) => part(line, Math.min(onOrderUnits(line), line.toOrder)));
  const shelf = live.filter((line) => line.onShelf > 0).map((line) => part(line, line.onShelf));
  // Handed over (S5a-2a): with the driver or the courier, and supplied (collected or delivered).
  const out = live.filter((line) => line.sentOut > 0).map((line) => part(line, line.sentOut));
  const supplied = live.filter((line) => line.supplied > 0).map((line) => part(line, line.supplied));
  const removed = [...lines.filter((line) => line.cancelled).map((line) => part(line, line.quantity)), ...live.filter((line) => line.removed > 0).map((line) => part(line, line.removed))];
  const units = (parts: OrderLinePart[]) => {
    const n = parts.reduce((sum, row) => sum + row.quantity, 0);
    return `${quantityWords(n)} ${n === 1 ? 'unit' : 'units'}`;
  };
  const placesOf = (parts: OrderLinePart[]) => [...new Set(parts.map((row) => row.line.place).filter(Boolean))];
  const places = placesOf(pick);
  const shelves = placesOf(shelf);
  const groups: OrderLineGroup[] = [];
  if (failed.length) {
    const pos = [...new Set(failures.filter((f) => f.step != null && !onSupplierHold(f) && f.poNumber).map((f) => f.poNumber))];
    groups.push({ key: 'cannot_supply', label: 'Cannot supply', sub: units(failed), parts: failed });
  }
  if (substitutes.length) {
    const held = [...new Set(failures.filter(substituteToAgree).map((f) => f.substitute?.place).filter(Boolean))];
    groups.push({ key: 'substitute', label: 'Substitute to agree', sub: `${units(substitutes)} held${held.length === 1 ? ` at ${held[0]}` : ''} while the customer decides`, parts: substitutes });
  }
  if (pick.length) groups.push({ key: 'to_pick', label: 'Ready to pick', sub: `${units(pick)}, set aside${places.length === 1 ? ` at ${places[0]}` : ''}`, parts: pick });
  if (order.length) {
    // A part only suppliers on hold list stays To order (slice three a), but can't be ordered yet: the group says so.
    const heldLines = new Set(failures.filter((f) => f.step != null && f.step !== 'reorder' && onSupplierHold(f)).map((f) => f.lineId));
    const held = order.filter((row) => heldLines.has(row.line.id)).reduce((sum, row) => sum + row.quantity, 0);
    const total = order.reduce((sum, row) => sum + row.quantity, 0);
    // Every part here waits on a supplier on hold: "Can’t order yet"; some do: "To order · 1 can’t be ordered yet".
    const heldWords = held === 0 || held === total ? null : `${quantityWords(held)} can’t be ordered yet`;
    const supply = supplyGroupWords(order.filter((row) => !heldLines.has(row.line.id)).map((row) => row.line), false);
    groups.push({ key: 'to_order', label: held > 0 && held === total ? 'Can’t order yet' : 'To order', sub: [units(order), heldWords, supply].filter(Boolean).join(' · '), parts: order });
  }
  if (onOrder.length) groups.push({ key: 'on_order', label: 'On order', sub: [units(onOrder), supplyGroupWords(onOrder.map((row) => row.line), true)].filter(Boolean).join(' '), parts: onOrder });
  if (shelf.length) {
    // Picked when every unit there came from a bin (S5a-1), else Put aside (goods in, S4b).
    const allPicked = shelf.every((row) => row.line.picked > 0 && row.line.picked >= row.line.onShelf);
    groups.push({ key: 'put_aside', label: allPicked ? 'Picked' : 'Put aside', sub: `${units(shelf)} on the collection and delivery shelf${shelves.length === 1 ? ` at ${shelves[0]}` : ''}`, parts: shelf });
  }
  if (out.length) groups.push({ key: 'out', label: 'Out for delivery', sub: units(out), parts: out });
  if (supplied.length) groups.push({ key: 'supplied', label: method === 'collection' ? 'Collected' : 'Delivered', sub: units(supplied), parts: supplied });
  if (removed.length) groups.push({ key: 'removed', label: 'Removed', sub: units(removed), parts: removed });
  return groups;
}

// Whether an open order has a part set aside here that is in a bin to pick (a part set aside without stock is counted
// first). The order page's filled Pick and the Sales orders preview's both ask this, so they never disagree (RF4).
export function orderHasPartsToPick(order: Pick<SalesOrderDetail, 'status' | 'staged' | 'lines' | 'failures'>): boolean {
  if (order.status !== 'open' || !order.staged) return false;
  return orderLineGroups(order.lines, order.failures).find((group) => group.key === 'to_pick')?.parts.some((part) => part.line.withoutStock === 0) ?? false;
}

// Picking for one order, at its branch: where every Pick for an order goes (owner, 25 November 2026).
// The order as the Pack window shows it (S5b-1): each part on the shelf, going in the box, under the customer's name as
// the page already words it. The database decides whether it is to pack; this only lists what is there.
export function orderToPack(order: Pick<SalesOrderDetail, 'id' | 'number' | 'urgent' | 'delivery' | 'lines' | 'figures'>, customer: string): PackingOrder {
  return {
    orderId: order.id,
    order: order.number,
    customer,
    urgent: order.urgent,
    units: order.figures.onShelf,
    address: order.delivery.address,
    addressText: order.delivery.addressText,
    lines: order.lines
      .filter((line) => !line.cancelled && line.onShelf > 0)
      .map((line) => ({ lineId: line.id, part: { id: line.partId, brand: line.brand, number: line.number, description: line.description }, qty: line.onShelf })),
  };
}

// Who an order or enquiry is for, by name: a sales order with nobody named is a cash sale. Shared by the pages and the
// printed notes, so both name the customer alike.
export function customerName(customer: EnquiryCustomer, none = 'No customer yet'): string {
  if (customer.kind === 'erased') return 'Erased customer';
  if (customer.kind === 'none') return none;
  return customer.name ?? customer.phone ?? 'No name';
}

export function orderCustomerName(customer: EnquiryCustomer): string {
  return customerName(customer, 'Cash sale');
}

// The order as the handover windows show it (S5a-2a): what is on the shelf now, line by line, and how much of the order
// is still to hand over, so Mark collected and Send out can say when only part of it is there.
export type HandOverOrder = PackingOrder & {
  method: DeliveryMethod;
  // units not yet supplied or out, across the order's lines
  toHandOver: number;
  // the standing pack's parcels, or null when it goes loose
  parcels: number | null;
  // what a customer who pays before taking the parts still owes, or null (the Mark collected window's warning)
  toPay: number | null;
};

export function orderToHandOver(
  order: Pick<SalesOrderDetail, 'id' | 'number' | 'urgent' | 'delivery' | 'lines' | 'figures' | 'pack'> & { paymentTaken?: SalesOrderDetail['paymentTaken'] },
  customer: string,
): HandOverOrder {
  const live = order.lines.filter((line) => !line.cancelled);
  return {
    ...orderToPack(order, customer),
    method: order.delivery.method,
    toHandOver: live.reduce((sum, line) => sum + Math.max(line.quantity - line.supplied - line.sentOut, 0), 0),
    parcels: order.pack?.covers ? order.pack.parcels : null,
    toPay: order.paymentTaken?.required && order.paymentTaken.short > 0 ? order.paymentTaken.short : null,
  };
}

export function pickingOrderHref(orderId: string, locationId: number | null): string {
  return `/picking?order=${orderId}${locationId != null ? `&branch=${locationId}` : ''}`;
}

// The words after a group's units when they are on purchase orders. To order: "on draft PO-000007", "PO-000007
// awaiting approval". On order: "on PO-000007", "on 2 purchase orders".
function supplyGroupWords(lines: SalesOrderLine[], placed: boolean): string {
  if (placed) {
    const pos = [...new Set(lines.flatMap((line) => line.supplyLinks.filter(isPlacedLink).map((link) => link.poNumber)))];
    return pos.length === 1 ? `on ${pos[0]}` : pos.length > 1 ? `on ${pos.length} purchase orders` : '';
  }
  const links = lines.flatMap((line) => line.supplyLinks.filter((link) => !isPlacedLink(link) && (link.units > 0 || link.arrived > 0)));
  if (links.length === 0) return '';
  const still = lines.reduce((sum, line) => sum + line.stillToOrder, 0);
  const pos = [...new Set(links.map((link) => link.poNumber))];
  const states = [...new Set(links.map((link) => link.state))];
  if (pos.length === 1 && states.length === 1 && still === 0) {
    const po = pos[0];
    switch (states[0]) {
      case 'drafted':
        return `on draft ${po}`;
      case 'awaiting_approval':
        return `${po} awaiting approval`;
      case 'approved':
        return `${po} approved, not placed`;
      case 'ordered':
        return `ordered on ${po}`;
      case 'arrived':
        return `arrived on ${po}`;
      default:
        return '';
    }
  }
  const on = links.reduce((sum, link) => sum + link.units + link.arrived, 0);
  return [`${quantityWords(on)} on ${pos.length === 1 ? pos[0] : 'purchase orders'}`, still > 0 ? `${quantityWords(still)} still to order` : null].filter(Boolean).join(', ');
}

// Why an order was cancelled, or that it went back to its enquiry; and when and by whom: "18 Nov, Sam Okafor".
export function cancelledWords(cancelled: OrderCancelled): { why: string; who: string } {
  const why =
    cancelled.outcome === 'returned' ? `Returned to ${cancelled.enquiry ?? 'the enquiry'}` : cancelled.outcome === 'error' ? 'Made in error' : (cancelled.reason ?? 'Sale lost');
  return { why, who: [dateWords(cancelled.at.slice(0, 10)), cancelled.by].filter(Boolean).join(', ') };
}

export function addressOneLine(address: SalesOrderAddress): string {
  return [address.name, ...addressLines(address)].filter(Boolean).join(', ');
}

// The printed pick list, one page per order (owner, 25 November 2026): the orders in the order To pick lists them,
// urgent first, then the oldest (by number), each with its rows in the walking order the list already has.
export function pickSheetOrders(rows: readonly PickingRow[]): { orderId: string; order: string; customer: string | null; urgent: boolean; rows: PickingRow[] }[] {
  const byOrder = new Map<string, { orderId: string; order: string; customer: string | null; urgent: boolean; rows: PickingRow[] }>();
  for (const row of rows) {
    const sheet = byOrder.get(row.orderId) ?? { orderId: row.orderId, order: row.order, customer: row.customer, urgent: row.urgent, rows: [] };
    sheet.rows.push(row);
    byOrder.set(row.orderId, sheet);
  }
  return [...byOrder.values()].sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.order.localeCompare(b.order, 'en-GB', { numeric: true }));
}

// An order's page heading lines: how it goes ("Our delivery to Leeds LS10", "Collection from Leeds branch") and its
// references ("Customer PO HSG-4410 · YJ20 KLM"), each empty when there is nothing to say.
export function pickSheetLines(order: PickingOrder | null, location: string | null): { how: string; refs: string } {
  const how = order ? howItGoes(order.method, order.deliverTo, location) : '';
  // The registration labelled, so it isn't read as part of the PO (owner, 25 November 2026).
  const refs = order ? [order.customerPo ? `Customer PO ${order.customerPo}` : null, ...order.registrations.map((reg) => `Reg ${reg}`)].filter(Boolean).join(' · ') : '';
  return { how, refs };
}

// How the order reaches the customer, in the header: "Our delivery to Leeds LS12", "Collection from Central".
export function deliverySummary(order: Pick<SalesOrderDetail, 'delivery' | 'location'>): string {
  const { method, address, addressText } = order.delivery;
  return howItGoes(method, deliveryPlace(address, addressText), order.location?.name ?? null);
}

// The one wording of how an order goes, for the order's header and the pick sheet alike.
function howItGoes(method: DeliveryMethod, place: string | null, location: string | null): string {
  if (method === 'collection') return location ? `Collection from ${location}` : 'Collection';
  return place ? `${DELIVERY_METHOD_LABELS[method]} to ${place}` : DELIVERY_METHOD_LABELS[method];
}

// When a part would arrive if it were ordered from the line's supplier now: "If ordered by 16:00, arrives tomorrow".
function ifOrderedWords(line: SalesOrderLine, now: string): string {
  if (!line.delivery?.arrivesOn) return 'Delivery times not set';
  if (line.missedCutoffAt) return deliveryWords(line.delivery, line.missedCutoffAt, now);
  if (!line.delivery.cutoffAt) return deliveryWords(line.delivery, null, now);
  const cutoff = new Date(line.delivery.cutoffAt).toDateString() === new Date(now).toDateString() ? clockTime(line.delivery.cutoffAt) : null;
  const words = deliveryWords(line.delivery, null, now);
  const arrives = words.slice(words.indexOf('· ') + 2);
  return cutoff ? `If ordered by ${cutoff}, ${arrives}` : words.replace('Order by ', 'If ordered by ').replace(' · ', ', ');
}

// Where one side of a confirmed line stands, in two lines. Set aside: the branch, and the bin that holds it (or
// that the stock figure did not cover it, and why). To order: the supplier it was offered from and when it would
// arrive; when the shelf can now cover it, `available` says how many, for the Set aside step.
// With ordering in, units on a purchase order read "Drafted · PO-000007" (the number a link, `po`) with the supplier
// and what happens next under it; units still to order offer Order in (`orderIn`, how many).
// blocked: the line can't be supplied (red ink, as everything that stops work). orderIn is what the counter may order
// in from the line's Where cell: nothing on a line with units that can't be supplied, which purchasing reorders.
export type ConfirmedWhere = {
  main: string;
  sub: string;
  available: number;
  po?: { id: string; number: string } | null;
  orderIn?: number;
  late?: boolean;
  blocked?: boolean;
  // Change answer belongs in the cell (a customer who chose to wait may change the answer).
  answer?: boolean;
  // A substitute's return-by date, after the sub: bold ink with the up arrow inside the last two days, never red.
  due?: { text: string; late: boolean } | null;
};

// A held substitute's one date for the counter (agree by, two days before it must go back): "Agree by Thu 26 Nov";
// from the day before, "↑ Agree by tomorrow" or "↑ Agree by today"; once passed, "↑ Agree by Wed 18 Nov" (the arrow
// says it is late).
export function substituteDueWords(returnBy: string | null, now: string): { text: string; late: boolean } | null {
  if (!returnBy) return null;
  const agreeBy = agreeByDate(returnBy);
  const days = daysFromToday(agreeBy, now);
  if (days < 0) return { text: `↑ Agree by ${dateWords(agreeBy)}`, late: true };
  if (days === 0) return { text: '↑ Agree by today', late: true };
  if (days === 1) return { text: '↑ Agree by tomorrow', late: true };
  return { text: `Agree by ${dateWords(agreeBy)}`, late: false };
}

// The one date the counter works to for a substitute: the customer agrees by two days before it must go back to the
// supplier, so there is time to send it (the message offers to hold it until then).
export function agreeByDate(returnBy: string): string {
  const at = new Date(`${returnBy.slice(0, 10)}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() - 2);
  return at.toISOString().slice(0, 10);
}

export function confirmedLineWhere(
  part: OrderLinePart,
  group: OrderLineGroup['key'],
  shelf: SalesOrderDetail['shelf'],
  now: string,
  failures: LineFailure[] = [],
): ConfirmedWhere {
  const line = part.line;
  // removed, and handed over: the group's own label says it (Out for delivery, Collected, Delivered)
  if (group === 'removed' || group === 'out' || group === 'supplied') return { main: '', sub: '', available: 0 };
  if (group === 'substitute') {
    const f = failures.find((x) => x.lineId === line.id && substituteToAgree(x));
    const sub = f?.substitute;
    if (!sub) return { main: 'Substitute to agree', sub: '', available: 0 };
    const fit = sub.fit ? PART_FIT_WORDS[sub.fit] : null;
    return {
      main: `${sub.part} held${sub.place ? ` · ${sub.place}` : ''}`,
      sub: [`Substitute for ${line.brand} ${line.number}`, fit?.label ?? null].filter(Boolean).join(' · '),
      available: 0,
      due: substituteDueWords(sub.returnBy, now),
    };
  }
  if (group === 'cannot_supply') {
    const open = failures.filter((f) => f.lineId === line.id && f.step != null);
    const [first] = open;
    if (!first) return { main: 'Cannot supply', sub: '', available: 0 };
    // The group says Cannot supply; the cell says why, in red, and from whom.
    return { main: first.reason == null ? 'Closed short' : (first.reasonLabel ?? 'Cannot supply'), po: { id: first.poId, number: first.poNumber }, sub: first.supplier ?? '', available: 0, blocked: true };
  }
  if (group === 'put_aside') {
    const how = line.picked > 0 && line.picked >= line.onShelf ? 'Picked' : 'Put aside';
    return { main: `${how}${line.place ? ` · ${line.place}` : ''}`, sub: 'Collection and delivery shelf', available: 0 };
  }
  if (group === 'to_order' || group === 'on_order') {
    const placed = group === 'on_order';
    const links = line.supplyLinks.filter((link) => isPlacedLink(link) === placed && (link.units > 0 || link.arrived > 0));
    const [link] = links;
    if (links.length === 1 && link) {
      const where = supplyWhere(link, now);
      const still = placed ? 0 : line.stillToOrder;
      const arrived = link.state === 'ordered' && link.arrived > 0 ? `${quantityWords(link.arrived)} arrived · ` : '';
      const available = link.arrived > 0 ? line.canSetAside : 0;
      if (still > 0) {
        return { main: `${quantityWords(link.units + link.arrived)} ${where.state.toLowerCase()}`, po: { id: link.poId, number: link.poNumber }, sub: `${quantityWords(still)} more to order`, orderIn: line.cannotSupply > 0 ? 0 : still, available };
      }
      return { main: where.state, po: { id: link.poId, number: link.poNumber }, sub: `${arrived}${where.sub}`, late: where.late, available };
    }
    if (links.length > 1) {
      const on = links.reduce((sum, link) => sum + link.units + link.arrived, 0);
      const still = placed ? 0 : line.stillToOrder;
      return {
        main: `${quantityWords(on)} on ${links.length} purchase orders`,
        sub: [links.map((link) => `${link.poNumber} ${supplyWhere(link, now).state.toLowerCase()}`).join(' · '), still > 0 ? `${quantityWords(still)} more to order` : null].filter(Boolean).join(' · '),
        orderIn: still > 0 && line.cannotSupply === 0 ? still : 0,
        late: links.some((link) => supplyWhere(link, now).late),
        available: links.some((link) => link.arrived > 0) ? line.canSetAside : 0,
      };
    }
  }
  if (group === 'to_pick') {
    if (line.withoutStock > 0) {
      const why = shelf ? (shelf.reason === 'other' && shelf.note ? shelf.note : SHELF_REASON_LABELS[shelf.reason].toLowerCase()) : null;
      return { main: line.place ?? 'This branch', sub: `${NO_STOCK_ON_RECORD}${why ? ` · Reason: ${why}` : ''}`, available: 0 };
    }
    // A short pick still open says so, not what the books say the bin holds (critique r1: "holds 1" under "not found").
    if (line.notFound) return { main: line.place ?? 'This branch', sub: notFoundWords(line.notFound), available: 0 };
    const holds = line.bin && line.binQty != null ? `Bin ${line.bin} holds ${quantityWords(line.binQty)}` : `${quantityWords(line.onHand)} on hand`;
    return { main: line.place ?? 'This branch', sub: holds, available: 0 };
  }
  // Only suppliers on hold list the part (slice three a): "Calder Parts on hold · since Mon 16 Nov · no other supplier",
  // and once the customer chose to wait, "Calder Parts on hold · since Mon 16 Nov · customer waiting · ask again Tue 24
  // Nov". The line can't move either way: red, as Cannot supply's is.
  const held = failures.find((f) => f.lineId === line.id && f.step != null && f.step !== 'reorder' && onSupplierHold(f));
  if (held && line.canSetAside === 0) {
    const supplier = held.hold?.supplier ?? held.supplier ?? 'The supplier';
    const since = held.hold?.since ? `since ${nearDayWords(held.hold.since, now)}` : null;
    if (held.step === 'wait') {
      // The customer may change the answer at any time: Record answer sits in the cell.
      const again = held.askAgainOn ? `ask again ${dateWords(held.askAgainOn)}` : null;
      return { main: `${supplier} on hold`, sub: [since, 'customer waiting', again].filter(Boolean).join(' · '), available: 0, orderIn: 0, blocked: true, answer: true };
    }
    return { main: `${supplier} on hold`, sub: [since, 'no other supplier lists it'].filter(Boolean).join(' · '), available: 0, orderIn: 0, blocked: true };
  }
  if (line.canSetAside > 0) return { main: 'To order', sub: `${quantityWords(line.canSetAside)} now available at ${line.place ?? 'this branch'}`, available: line.canSetAside, orderIn: line.cannotSupply > 0 ? 0 : line.stillToOrder };
  return { main: 'To order', sub: line.sourceId != null ? `${line.supplier ?? 'Supplier'} · ${ifOrderedWords(line, now)}` : '', available: 0, orderIn: line.cannotSupply > 0 ? 0 : line.stillToOrder };
}

// Where a line of a draft, or of an order on hold, would come from, in two lines. Nothing is set aside or ordered
// for it, so a part to be ordered in says when it would arrive if it were ordered, not when it will.
export function orderLineWhere(line: SalesOrderLine, now: string): { main: string; sub: string } {
  const ifOrdered = (): string => ifOrderedWords(line, now);
  if (line.supply === 'order_in') return { main: `Order in · ${line.supplier ?? 'supplier'}`, sub: ifOrdered() };
  const onHand = line.onHandNow ?? 0;
  const place = line.location ?? 'This branch';
  if (line.quantity > onHand) {
    const short = `${quantityWords(onHand)} in stock, ${quantityWords(line.quantity - onHand)} to order in`;
    return { main: place, sub: line.sourceId != null && line.delivery?.arrivesOn ? `${short} · ${ifOrdered()}` : short };
  }
  return { main: place, sub: `${quantityWords(onHand)} in stock` };
}

export const ORDER_TRAIL_LABELS: Record<OrderTrailStage, string> = {
  confirmed: 'Confirmed',
  stock: 'Stock',
  picked: 'Picked',
  packed: 'Packed',
  supplied: 'Supplied',
  invoiced: 'Invoiced',
  paid: 'Paid',
};

// The line under a trail stage: a state only, never a step.
// A stage's name on the trail: the handover stage is Collected or Delivered by the order's method (S5a-2a).
export function orderTrailLabel(key: OrderTrailStage, method?: DeliveryMethod): string {
  if (key === 'supplied' && method) return method === 'collection' ? 'Collected' : 'Delivered';
  return ORDER_TRAIL_LABELS[key];
}

// packed: what is packed on the shelf, or what went once handed over (out for delivery or delivered): Packed says the
// parcels, or Not packed for a delivery sent loose, never the pill's Ready for delivery again (S5a-2a, critique round 2).
// handed: something has left the shelf (collected, out or delivered), so Picked says what was picked rather than what
// is on the shelf (critique round 1).
export function orderTrailSub(node: OrderTrailNode, now?: string, method?: DeliveryMethod, packed?: { parcels: number | null } | null, handed = false): string {
  const count = node.of != null ? `${quantityWords(node.done ?? 0)} of ${quantityWords(node.of)}` : '';
  switch (node.key) {
    case 'confirmed':
      return node.state === 'done' ? (node.at && now ? dayAndTime(node.at, now) : 'Done') : 'Not yet';
    case 'stock':
      return (node.done ?? 0) > 0 ? `${count} set aside` : 'Nothing set aside';
    case 'picked':
      return (node.done ?? 0) > 0 ? `${count} ${handed ? 'picked' : 'on the shelf'}` : count;
    case 'packed':
      if (packed) return node.state === 'done' && packed.parcels ? parcelsWords(packed.parcels) : NOT_PACKED;
      return node.state === 'done' ? 'Ready for delivery' : node.state === 'now' ? 'To pack' : 'Not yet';
    case 'supplied': {
      // Out for delivery is the stage under way (the copy deck); then how much reached the customer.
      if ((node.out ?? 0) > 0) return 'Out for delivery';
      const done = method === 'collection' ? 'collected' : method ? 'delivered' : 'supplied';
      return (node.done ?? 0) > 0 ? `${count} ${done}` : count;
    }
    case 'invoiced':
      return 'Nothing yet';
    case 'paid':
      return 'Nothing due yet';
  }
}

// An order's history line: what happened, as a sentence.
export function orderEventText(event: string, detail: JsonRecord): string {
  const goodsIn = putAsideEventText(event, detail);
  if (goodsIn != null) return goodsIn;
  const failed = cannotSupplyEventText(event, detail);
  if (failed != null) return failed;
  const late = lateEventText(event, detail);
  if (late != null) return late;
  const replaced = replaceEventText(event, detail);
  if (replaced != null) return replaced;
  const picking = pickingEventText(event, detail);
  if (picking != null) return picking;
  const packing = packingEventText(event, detail);
  if (packing != null) return packing;
  const handover = handoverEventText(event, detail);
  if (handover != null) return handover;
  const text = (key: string) => (typeof detail[key] === 'string' ? (detail[key] as string) : '');
  const count = (key: string) => (typeof detail[key] === 'number' ? (detail[key] as number) : null);
  const units = (n: number) => `${quantityWords(n)} ${n === 1 ? 'unit' : 'units'}`;
  const shelfWords = (reason: string, note: string) =>
    reason === 'other' && note ? note : (SHELF_REASONS as readonly string[]).includes(reason) ? SHELF_REASON_LABELS[reason as ShelfReason].toLowerCase() : 'no reason given';
  switch (event) {
    case 'created': {
      const lines = count('lines');
      const offers = lines != null ? ` with ${lines} accepted ${lines === 1 ? 'offer' : 'offers'}` : '';
      return text('enquiry') ? `Created from ${text('enquiry')}${offers}.` : detail.direct === true ? 'Created as a new sale.' : 'Created.';
    }
    case 'line_added':
      return `${text('part')} × ${quantityWords(count('quantity') ?? 1)} added.`;
    case 'customer_named':
      return `Customer named: ${text('name')}.`;
    case 'held_by_hand':
      return `Put on hold: waiting for the customer. ${text('note').replace(/[.\s]+$/, '')}.`;
    case 'po_changed': {
      const lead = !text('from')
        ? `Customer PO number added: ${text('to')}.`
        : !text('to')
          ? `Customer PO number ${text('from')} removed.`
          : `Customer PO number changed from ${text('from')} to ${text('to')}.`;
      const list = (key: string) => (Array.isArray(detail[key]) ? (detail[key] as unknown[]).filter((item): item is string => typeof item === 'string') : []);
      const updated = list('updated');
      const kept = list('kept');
      return `${lead}${updated.length ? ` The reference on draft ${updated.join(', ')} changed too.` : ''}${kept.length ? ` ${kept.join(', ')} ${kept.length === 1 ? 'was' : 'were'} already placed and ${kept.length === 1 ? 'keeps' : 'keep'} what was sent.` : ''}`;
    }
    case 'ordered_in': {
      const orders = Array.isArray(detail.orders) ? (detail.orders as JsonRecord[]) : [];
      const linked = Array.isArray(detail.linked) ? (detail.linked as JsonRecord[]) : [];
      const parts = [
        ...orders.map((order) => {
          const lines = typeof order.lines === 'number' ? order.lines : 1;
          return `${lines} ${lines === 1 ? 'line' : 'lines'} ${order.new === true ? 'on new draft' : 'added to draft'} ${String(order.number ?? '')} for ${String(order.supplier ?? 'the supplier')}`;
        }),
        ...linked.map((line) => `${String(line.part ?? 'a part')} linked to ${String(line.number ?? 'a purchase order')}`),
      ];
      const plates = Array.isArray(detail.registrations) ? (detail.registrations as unknown[]).filter((item): item is string => typeof item === 'string') : [];
      const withs = [text('customer_po') ? `customer PO ${text('customer_po')}` : null, plates.length ? plates.join(', ') : null].filter(Boolean);
      const sentence = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : (parts[0] ?? 'Ordered in');
      const from = text('via') === 'customer_lines' ? ' from Purchase orders › Customer lines' : '';
      return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}${withs.length ? `, with ${withs.join(' and ')}` : ''}${from}.`;
    }
    case 'order_in_undone': {
      const orders = Array.isArray(detail.orders) ? (detail.orders as JsonRecord[]) : [];
      return `Ordering in undone: ${orders.map((order) => `${units(typeof order.units === 'number' ? order.units : 0)} taken off ${String(order.number ?? '')}`).join(', ')}.`;
    }
    case 'supply_removed': {
      const n = count('units') ?? 0;
      const what = `${units(n)} of ${text('part')}`;
      const again = `${n === 1 ? 'it is' : 'they are'} to order again`;
      switch (detail.why) {
        case 'draft_deleted':
          return `Draft ${text('po')} deleted: ${what} ${n === 1 ? 'is' : 'are'} to order again.`;
        case 'po_cancelled':
          return `${text('po')} cancelled: ${what} ${n === 1 ? 'is' : 'are'} to order again.`;
        case 'not_coming':
          return `${text('po')} won’t send ${what}: ${again}.`;
        case 'lowered':
          return `${text('po')} lowered by ${units(n)} of ${text('part')}: ${again}.`;
        default:
          return `${what} removed from ${text('po')}: ${again}.`;
      }
    }
    case 'supply_trimmed': {
      const off = Array.isArray(detail.off) ? (detail.off as JsonRecord[]) : [];
      const stock = Array.isArray(detail.for_stock) ? (detail.for_stock as JsonRecord[]) : [];
      const n = (row: JsonRecord) => (typeof row.units === 'number' ? row.units : 0);
      const parts = [
        ...off.map((row) => `${units(n(row))} of ${text('part')} taken off draft ${String(row.number ?? '')}`),
        ...stock.map((row) => `${units(n(row))} on ${String(row.number ?? '')} ${n(row) === 1 ? 'arrives' : 'arrive'} as stock`),
      ];
      return `${parts.join('; ').replace(/^./, (c) => c.toUpperCase())}.`;
    }
    case 'supply_moved':
      return `${text('part')} moved from ${text('from')} to ${text('to')} for ${text('supplier')}.`;
    case 'supply_placed': {
      const n = count('units') ?? 0;
      return `${text('po')} placed: ${units(n)} ${text('expected_on') ? `due ${dateWords(text('expected_on'))}` : 'ordered'}.`;
    }
    case 'payment_taken': {
      const method = typeof detail.method === 'string' && detail.method in TAKEN_PAYMENT_LABELS ? TAKEN_PAYMENT_LABELS[detail.method as TakenPaymentMethod].toLowerCase() : 'card';
      return `Payment taken: ${moneyWords(count('amount') ?? 0)} by ${method}.`;
    }
    case 'order_in_unpaid':
      return `Ordered in before payment: ${text('reason').replace(/[.\s]+$/, '')}.`;
    case 'delivery_changed':
      return detail.address_changed === true ? `${text('to')} address changed.` : `Delivery changed from ${text('from')} to ${text('to')}.`;
    case 'line_changed': {
      const held = count('set_aside');
      return `Quantity of ${text('part')} changed from ${quantityWords(count('from') ?? 0)} to ${quantityWords(count('to') ?? 0)}.${held != null ? ` ${quantityWords(held)} set aside.` : ''}`;
    }
    case 'confirmed':
    case 'hold_cleared':
    case 'hold_released':
    case 'hold_overridden': {
      const stock = [
        (count('set_aside') ?? 0) > 0 ? `${units(count('set_aside') ?? 0)} set aside${text('location') ? ` at ${text('location')}` : ''}` : null,
        (count('to_order') ?? 0) > 0 ? `${quantityWords(count('to_order') ?? 0)} to order` : null,
      ].filter(Boolean).join(', ');
      const shelf = (count('without_stock') ?? 0) > 0
        ? ` ${units(count('without_stock') ?? 0)} set aside without stock: ${shelfWords(text('shelf_reason'), text('shelf_note'))}.`
        : '';
      const credit = count('credit_before');
      const lead =
        event === 'hold_overridden'
          ? `Hold overridden: ${text('reason')}.`
          : event === 'hold_released'
            ? 'Hold released.'
            : event === 'hold_cleared'
            ? 'Credit check passed. The hold is cleared.'
            : `Confirmed.${credit != null ? ` Credit check passed: ${moneyWords(credit)} available before this order.` : ''}`;
      return `${lead}${stock ? ` ${stock.charAt(0).toUpperCase()}${stock.slice(1)}.` : ''}${shelf}`;
    }
    case 'held': {
      const kept = count('kept') ?? 0;
      const lead = detail.at_confirm === false ? 'Put on hold.' : 'Confirmed and put on hold.';
      return `${lead} ${creditBlockWords({
        reason: detail.reason === 'over_limit' ? 'over_limit' : 'on_stop',
        name: text('name') || null,
        statusReason: text('status_reason') || null,
        since: text('since') || null,
        limit: count('limit'),
        overBy: count('over_by'),
      })}${kept > 0 ? ` ${units(kept)} ${kept === 1 ? 'stays' : 'stay'} set aside.` : ''}`;
    }
    case 'set_aside':
      return `${units(count('quantity') ?? 0)} of ${text('part')} set aside${text('location') ? ` at ${text('location')}` : ''}.`;
    case 'line_cancelled': {
      const released = count('released') ?? 0;
      return `${text('part')} × ${quantityWords(count('quantity') ?? 1)} cancelled.${released > 0 ? ` ${units(released)} available again.` : ''}${detail.request === false ? '' : ' Its request is back on the enquiry.'}`;
    }
    case 'line_removed':
      return `${text('part')} × ${quantityWords(count('quantity') ?? 1)} removed.${detail.request === false ? '' : ' Its request is back on the enquiry.'}`;
    case 'cancelled': {
      const released = count('released') ?? 0;
      const freed = released > 0 ? ` ${units(released)} available again.` : '';
      if (detail.outcome === 'error') return `Cancelled: made in error.${freed}`;
      return detail.outcome === 'returned'
        ? `Cancelled. Its requests went back to ${text('enquiry') || 'the enquiry'}, still accepted.${freed}`
        : `Cancelled as a lost sale: ${text('reason').replace(/[.\s]+$/, '') || 'no reason given'}.${freed}`;
    }
    default:
      return `${event.charAt(0).toUpperCase()}${event.slice(1).replace(/_/g, ' ')}.`;
  }
}

// The figures line for margin: "£41.52 · order-in line estimated". orderIn is how many lines are to be ordered in.
export function orderMarginSub(figures: SalesOrderDetail['figures'], orderIn = 1): string {
  return [figures.marginAmount != null ? moneyWords(figures.marginAmount) : null, figures.marginEstimated ? `order-in ${orderIn === 1 ? 'line' : 'lines'} estimated` : null]
    .filter(Boolean)
    .join(' · ');
}
