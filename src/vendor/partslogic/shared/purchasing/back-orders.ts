import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { DataError } from '../core/errors';
import { readArray, readBoolean, readNumber, readRecord, readString } from '../core/read';
import { call } from './documents';

// Back-orders (step 14): lines still due on open orders, chasing the supplier for a date, cancelling with a reason, and
// how each supplier performs. Every rule is in SQL (20261112120000: purchasing.back_orders, supplier_performance); this
// file reads it and sends the choices.

export const BACK_ORDER_REASONS = ['discontinued', 'no_stock', 'too_slow', 'mistake', 'not_needed'] as const;
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
};

export type BackOrderList = {
  rows: BackOrderRow[];
  totals: { lines: number; value: number; toChase: number; suppliers: number; oldestDays: number };
  reasons: BackOrderReason[];
};

export type BackOrderQuery = { supplierId?: number | null; locationId?: number | null; toChase?: boolean };

// What cancelling returns: enough to order the part elsewhere.
export type CancelledLine = { orderId: string; partId: number; locationId: number | null; qty: number; supplierId: number };

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

export type SupplierPerformance = { current: PerformanceWindow; previous: PerformanceWindow; minLines: number };

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
  return { current: readWindow(row?.current), previous: readWindow(row?.previous), minLines: readNumber(row?.min_lines) ?? 10 };
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
    return { orderId, partId, locationId: readNumber(row?.location_id), qty: readNumber(row?.qty) ?? 0, supplierId };
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
