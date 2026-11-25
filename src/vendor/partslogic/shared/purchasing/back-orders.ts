import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { DataError } from '../core/errors';
import { readArray, readBoolean, readNumber, readRecord, readString } from '../core/read';
import { call } from './documents';

// Back-orders (step 14): lines still due on open orders, chasing the supplier for a date, cancelling with a reason, and
// how each supplier performs. Every rule is in SQL (20261112120000: purchasing.back_orders, supplier_performance); this
// file reads it and sends the choices.

// In the order the database lists them: three count against the supplier (Out of stock, Lead time too long, No longer
// stocks it), then the maker discontinuing a part and our own reasons, which don't (owner, 21 November 2026).
export const BACK_ORDER_REASONS = ['no_stock', 'too_slow', 'discontinued', 'maker_discontinued', 'mistake', 'not_needed'] as const;
export type BackOrderReasonCode = (typeof BACK_ORDER_REASONS)[number];
export type BackOrderReason = { code: BackOrderReasonCode; label: string; supplierFault: boolean };

export type BackOrderRow = {
  lineId: number;
  order: { id: string; number: string; status: string; ourReference: string | null };
  supplier: { id: number; name: string; phone: string | null };
  location: string | null;
  part: { id: number; brand: string; number: string; description: string | null };
  ordered: number;
  received: number;
  due: number;
  unitCost: number;
  value: number;
  placedAt: string | null;
  waitingDays: number;
  // The order's expected date (as placed), the date they last gave, and the one that counts: theirs, else ours.
  expectedOn: string | null;
  promisedOn: string | null;
  chaseBy: string | null;
  chase: { at: string; note: string | null; promisedOn: string | null; by: string | null } | null;
  // Part received, or past its date. An order placed today for tomorrow isn't a back-order yet.
  backOrder: boolean;
  // Past the date that counts, or no date at all.
  toChase: boolean;
  // The customers waiting on the line (S4b part three b): each sales order, what was promised, and what the customer
  // was last told. Lines for customers come first in the list.
  forCustomers: WaitingCustomer[];
};

export type WaitingCustomer = {
  orderId: string;
  number: string;
  customer: string | null;
  units: number;
  expectedOn: string | null;
  expectedFrom: string | null;
  expectedBy: string | null;
  late: boolean;
  toldAt: string | null;
  toldKind: 'late' | 'new_day' | null;
  toldDue: string | null;
  // The counter's step still to take: tell the customer it is late, or the new day.
  need: 'tell_late' | 'tell_new_day' | null;
  // What the account does if the part can't be supplied (Accept substitute says what will happen).
  ifCannotSupply: 'same_part' | 'equivalent' | 'ask' | 'take_off';
};

function readWaitingCustomers(value: Json | undefined): WaitingCustomer[] {
  return readArray(value).flatMap((item) => {
    const w = readRecord(item);
    const orderId = readString(w?.order_id);
    if (!w || !orderId) return [];
    const kind = readString(w.told_kind);
    const need = readString(w.need);
    return [{
      orderId,
      number: readString(w.number) ?? '',
      customer: readString(w.customer),
      units: readNumber(w.units) ?? 0,
      expectedOn: readString(w.expected_on),
      expectedFrom: readString(w.expected_from),
      expectedBy: readString(w.expected_by),
      late: readBoolean(w.late) ?? false,
      toldAt: readString(w.told_at),
      toldKind: kind === 'late' || kind === 'new_day' ? kind : null,
      toldDue: readString(w.told_due),
      need: need === 'tell_late' || need === 'tell_new_day' ? need : null,
      ifCannotSupply: (['same_part', 'equivalent', 'ask', 'take_off'] as const).find((v) => v === w.if_cannot_supply) ?? 'ask',
    }];
  });
}

export type BackOrderList = {
  rows: BackOrderRow[];
  totals: { lines: number; value: number; toChase: number; suppliers: number; oldestDays: number };
  reasons: BackOrderReason[];
};

export type BackOrderQuery = { supplierId?: number | null; locationId?: number | null; toChase?: boolean };

// What cancelling returns: enough to order the part elsewhere.
export type CancelledLine = {
  orderId: string;
  partId: number;
  locationId: number | null;
  qty: number;
  supplierId: number;
  // The customers who were waiting on the units (S4b part three): each sales order, and whether the units are now
  // Cannot supply on it with who acts next (purchasing reorders, the counter asks, replaces or takes it off), or back
  // to order for a reason of ours.
  forCustomers: CancelledForCustomer[];
};
export type CancelledForCustomer = {
  orderId: string;
  number: string;
  customer: string | null;
  cannotSupply: boolean;
  step: 'reorder' | 'ask' | 'answer' | 'replace' | 'take_off' | null;
};

function readCancelledForCustomers(value: Json | undefined): CancelledForCustomer[] {
  const steps = ['reorder', 'ask', 'answer', 'replace', 'take_off'] as const;
  return readArray(value).flatMap((item) => {
    const row = readRecord(item);
    const orderId = readString(row?.order_id);
    const number = readString(row?.number);
    if (!row || !orderId || !number) return [];
    const step = steps.find((s) => s === row.step) ?? null;
    return [{ orderId, number, customer: readString(row.customer), cannotSupply: readBoolean(row.cannot_supply) ?? false, step }];
  });
}

export type PerformanceMiss = {
  order: string;
  part: string;
  expectedOn: string | null;
  wanted: number;
  received: number;
  firstOn: string | null;
  why: 'late' | 'short' | 'late_and_short';
};

export type PerformanceWindow = {
  from: string;
  to: string;
  lines: number;
  enough: boolean;
  onTime: number;
  inFull: number;
  otif: number;
  leadDays: number | null;
  promisedDays: number | null;
  pricesChecked: number;
  pricesOk: number;
  receivedLines: number;
  returnedLines: number;
  misses: PerformanceMiss[];
};

// The customer lines a supplier let down in the last 90 days (S4b part three b, slice three c; board 6r line 34):
// counted, those the maker discontinued (shown, not counted), by reason, and the sales orders affected, newest first.
// A supplier on hold is an account matter and isn't listed (owner, 22 November 2026).
export type SupplierLetDowns = {
  counted: number;
  notCounted: number;
  byReason: { reason: string; label: string; lines: number }[];
  orders: { orderId: string; number: string; customer: string | null; label: string; counted: boolean }[];
  // Every order affected; `orders` holds the five newest.
  orderCount: number;
};

export type SupplierPerformance = { current: PerformanceWindow; previous: PerformanceWindow; minLines: number; letDown: SupplierLetDowns };

export function readSupplierLetDowns(value: Json | undefined): SupplierLetDowns {
  const row = readRecord(value);
  const orders = readArray(row?.orders).flatMap((item) => {
    const o = readRecord(item);
    const orderId = readString(o?.order_id);
    const number = readString(o?.number);
    return o && orderId && number
      ? [{ orderId, number, customer: readString(o.customer), label: readString(o.label) ?? 'Closed short', counted: readBoolean(o.counted) ?? true }]
      : [];
  });
  return {
    counted: readNumber(row?.counted) ?? 0,
    notCounted: readNumber(row?.not_counted) ?? 0,
    byReason: readArray(row?.by_reason).flatMap((item) => {
      const r = readRecord(item);
      const reason = readString(r?.reason);
      const label = readString(r?.label);
      return r && reason && label ? [{ reason, label, lines: readNumber(r.lines) ?? 0 }] : [];
    }),
    orders,
    // Before 20261122170000 every order came back and there was no count.
    orderCount: Math.max(readNumber(row?.order_count) ?? orders.length, orders.length),
  };
}

// Standard terms (Shopify, Cal.com, Steep say "Cancelled"; owner, 22 November 2026, after the copy review).
export const LET_DOWN_LABEL = 'Lines cancelled for customers';

// The tile's sub-line: what isn't counted, or nothing.
export function letDownSubWords(letDown: Pick<SupplierLetDowns, 'notCounted'>): string | null {
  return letDown.notCounted > 0 ? `${letDown.notCounted} discontinued by the maker, not counted` : null;
}

// One reason and its count, kept together: "Out of stock 2".
export function letDownReasonWords(reason: Pick<SupplierLetDowns['byReason'][number], 'label' | 'lines'>): string {
  return `${reason.label} ${reason.lines}`;
}

// Under the heading, a list read as one: "Out of stock 2, Lead time too long 1" (a comma, which a line may end on and a
// screen reader pauses at).
export function letDownReasonsWords(letDown: Pick<SupplierLetDowns, 'byReason'>): string {
  return letDown.byReason.map(letDownReasonWords).join(', ');
}

// After the five newest orders: "2 more orders".
export function letDownMoreWords(more: number): string | null {
  return more > 0 ? `${more} more ${more === 1 ? 'order' : 'orders'}` : null;
}

// One sales order's reason, kept whole on the screen: "Out of stock", "Discontinued by the maker, not counted".
export function letDownOrderReason(order: Pick<SupplierLetDowns['orders'][number], 'label' | 'counted'>): string {
  return `${order.label}${order.counted ? '' : ', not counted'}`;
}

// One sales order's detail after its link: "Hillside Garage · Out of stock", or "… · Discontinued by the maker, not
// counted".
export function letDownOrderWords(order: Pick<SupplierLetDowns['orders'][number], 'customer' | 'label' | 'counted'>): string {
  return [order.customer, letDownOrderReason(order)].filter(Boolean).join(' · ');
}

function isReason(value: unknown): value is BackOrderReasonCode {
  return typeof value === 'string' && (BACK_ORDER_REASONS as readonly string[]).includes(value);
}

export function readBackOrderReasons(value: Json | undefined): BackOrderReason[] {
  return readArray(value).flatMap((item) => {
    const r = readRecord(item);
    if (!r || !isReason(r.code)) return [];
    return [{ code: r.code, label: readString(r.label) ?? r.code, supplierFault: readBoolean(r.supplier_fault) ?? true }];
  });
}

export function readBackOrderRows(value: Json | undefined): BackOrderRow[] {
  return readArray(value).flatMap((item) => {
    const r = readRecord(item);
    const lineId = readNumber(r?.line_id);
    const order = readRecord(r?.order);
    const supplier = readRecord(r?.supplier);
    const part = readRecord(r?.part);
    const orderId = readString(order?.id);
    const supplierId = readNumber(supplier?.id);
    const partId = readNumber(part?.id);
    if (!r || lineId == null || !order || !orderId || !supplier || supplierId == null || !part || partId == null) return [];
    const chase = readRecord(r.chase);
    return [
      {
        lineId,
        order: {
          id: orderId,
          number: readString(order.number) ?? '',
          status: readString(order.status) ?? 'placed',
          ourReference: readString(order.our_reference),
        },
        supplier: { id: supplierId, name: readString(supplier.name) ?? '', phone: readString(supplier.phone) },
        location: readString(r.location),
        part: {
          id: partId,
          brand: readString(part.brand) ?? '',
          number: readString(part.number) ?? '',
          description: readString(part.description),
        },
        ordered: readNumber(r.ordered) ?? 0,
        received: readNumber(r.received) ?? 0,
        due: readNumber(r.due) ?? 0,
        unitCost: readNumber(r.unit_cost) ?? 0,
        value: readNumber(r.value) ?? 0,
        placedAt: readString(r.placed_at),
        waitingDays: readNumber(r.waiting_days) ?? 0,
        expectedOn: readString(r.expected_on),
        promisedOn: readString(r.promised_on),
        chaseBy: readString(r.chase_by),
        chase: chase
          ? {
              at: readString(chase.at) ?? '',
              note: readString(chase.note),
              promisedOn: readString(chase.promised_on),
              by: readString(chase.by),
            }
          : null,
        backOrder: readBoolean(r.back_order) ?? true,
        toChase: readBoolean(r.to_chase) ?? false,
        forCustomers: readWaitingCustomers(r.for_customers),
      },
    ];
  });
}

export function readBackOrderList(value: Json | undefined): BackOrderList {
  const row = readRecord(value);
  const totals = readRecord(row?.totals);
  return {
    rows: readBackOrderRows(row?.rows),
    totals: {
      lines: readNumber(totals?.lines) ?? 0,
      value: readNumber(totals?.value) ?? 0,
      toChase: readNumber(totals?.to_chase) ?? 0,
      suppliers: readNumber(totals?.suppliers) ?? 0,
      oldestDays: readNumber(totals?.oldest_days) ?? 0,
    },
    reasons: readBackOrderReasons(row?.reasons),
  };
}

function readWindow(value: Json | undefined): PerformanceWindow {
  const w = readRecord(value);
  return {
    from: readString(w?.from) ?? '',
    to: readString(w?.to) ?? '',
    lines: readNumber(w?.lines) ?? 0,
    enough: readBoolean(w?.enough) ?? false,
    onTime: readNumber(w?.on_time) ?? 0,
    inFull: readNumber(w?.in_full) ?? 0,
    otif: readNumber(w?.otif) ?? 0,
    leadDays: readNumber(w?.lead_days),
    promisedDays: readNumber(w?.promised_days),
    pricesChecked: readNumber(w?.prices_checked) ?? 0,
    pricesOk: readNumber(w?.prices_ok) ?? 0,
    receivedLines: readNumber(w?.received_lines) ?? 0,
    returnedLines: readNumber(w?.returned_lines) ?? 0,
    misses: readArray(w?.misses).flatMap((item) => {
      const m = readRecord(item);
      const why = readString(m?.why);
      if (!m || (why !== 'late' && why !== 'short' && why !== 'late_and_short')) return [];
      return [
        {
          order: readString(m.order) ?? '',
          part: readString(m.part) ?? '',
          expectedOn: readString(m.expected_on),
          wanted: readNumber(m.wanted) ?? 0,
          received: readNumber(m.received) ?? 0,
          firstOn: readString(m.first_on),
          why,
        },
      ];
    }),
  };
}

export function readSupplierPerformance(value: Json | undefined): SupplierPerformance {
  const row = readRecord(value);
  return {
    current: readWindow(row?.current),
    previous: readWindow(row?.previous),
    minLines: readNumber(row?.min_lines) ?? 10,
    letDown: readSupplierLetDowns(row?.let_down),
  };
}

// A share as a whole percentage, or null when there's nothing to share.
export function percentOf(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

export async function listBackOrders(supabase: Client, query: BackOrderQuery = {}): Promise<BackOrderList> {
  return call(
    supabase.rpc('back_order_lines', {
      p_source: query.supplierId ?? undefined,
      p_location: query.locationId ?? undefined,
      p_to_chase: query.toChase ?? false,
    }),
    readBackOrderList,
  );
}

// What the supplier said about one or more lines: the date they gave (or none) and a note. Editors.
export async function chaseBackOrderLines(
  supabase: Client,
  lineIds: number[],
  said: { promisedOn: string | null; note: string | null },
): Promise<number> {
  const p: Record<string, Json> = {};
  if (said.promisedOn) p.promised_on = said.promisedOn;
  if (said.note) p.note = said.note;
  return call(supabase.rpc('chase_back_order_lines', { p_lines: lineIds, p }), (data) => readNumber(readRecord(data)?.chased) ?? 0);
}

// Cancels a line's units still due with a reason. Editors. Returns what ordering it elsewhere needs.
export async function cancelBackOrderLine(
  supabase: Client,
  lineId: number,
  input: { reason: BackOrderReasonCode; qty?: number | null; note?: string | null },
): Promise<CancelledLine> {
  const p: Record<string, Json> = { reason: input.reason };
  if (input.qty != null) p.qty = input.qty;
  if (input.note) p.note = input.note;
  return call(supabase.rpc('cancel_back_order_line', { p_line: lineId, p }), (data) => {
    const row = readRecord(data);
    const orderId = readString(row?.order_id);
    const partId = readNumber(row?.part_id);
    const supplierId = readNumber(row?.supplier_id);
    if (!orderId || partId == null || supplierId == null) throw new DataError('The cancelled line could not be read.', 'P0002');
    return {
      orderId,
      partId,
      locationId: readNumber(row?.location_id),
      qty: readNumber(row?.qty) ?? 0,
      supplierId,
      forCustomers: readCancelledForCustomers(row?.for_customers),
    };
  });
}

export async function saveSupplierBackOrders(supabase: Client, supplierId: number, holds: boolean): Promise<boolean> {
  return call(supabase.rpc('save_supplier_back_orders', { p_source: supplierId, p_holds: holds }), (data) =>
    readBoolean(readRecord(data)?.holds_back_orders) ?? holds,
  );
}

export async function getSupplierPerformance(supabase: Client, supplierId: number): Promise<SupplierPerformance> {
  return call(supabase.rpc('supplier_performance', { p_source: supplierId }), readSupplierPerformance);
}

// The suppliers list's column: lines due in the last 90 days and how many came on time and in full.
export async function supplierScores(supabase: Client, supplierIds: number[]): Promise<Map<number, { lines: number; otif: number }>> {
  if (supplierIds.length === 0) return new Map();
  return call(supabase.rpc('supplier_scores', { p_sources: supplierIds }), (data) => {
    const out = new Map<number, { lines: number; otif: number }>();
    for (const item of readArray(data)) {
      const row = readRecord(item);
      const id = readNumber(row?.source_id);
      if (id != null) out.set(id, { lines: readNumber(row?.lines) ?? 0, otif: readNumber(row?.otif) ?? 0 });
    }
    return out;
  });
}
