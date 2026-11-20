import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { dataError } from '../core/errors';
import { readArray, readNumber, readRecord, readString } from '../core/read';
import type { ExtrasAction } from './order-extras';
import { readPurchaseOrder, type PurchaseOrderDetail } from './orders';

// Goods in against orders: what is expected, and (slice G2) receiving against orders. Every rule lives in SQL
// (public.expected_deliveries and the receiving entry points, docs/GOODS_IN.md); this file shapes what is sent and read.

export const DUE_GROUPS = ['overdue', 'today', 'tomorrow', 'later', 'no_date'] as const;
export type DueGroup = (typeof DUE_GROUPS)[number];

export function isDueGroup(value: unknown): value is DueGroup {
  return typeof value === 'string' && (DUE_GROUPS as readonly string[]).includes(value);
}

// A placed order still to arrive, with when and how much.
export type ExpectedDelivery = {
  id: string;
  number: string;
  supplierId: number;
  supplier: string;
  locationId: number | null;
  locationCode: string | null;
  ourReference: string | null;
  expectedOn: string | null;
  expectedFrom: string | null;
  expectedBy: string | null;
  expectedRun: string | null;
  linesDue: number;
  unitsDue: number;
  placedAt: string | null;
  due: DueGroup;
};

export async function listExpectedDeliveries(supabase: Client, locationId?: number | null): Promise<ExpectedDelivery[]> {
  const { data, error } = await supabase.rpc('expected_deliveries', { p_location: locationId ?? undefined });
  if (error) throw dataError(error);
  return (data ?? []).flatMap((row): ExpectedDelivery[] =>
    isDueGroup(row.due)
      ? [
          {
            id: row.document_id,
            number: row.number,
            supplierId: row.source_id,
            supplier: row.supplier,
            locationId: row.location_id ?? null,
            locationCode: row.location_code ?? null,
            ourReference: row.our_reference ?? null,
            expectedOn: row.expected_on ?? null,
            expectedFrom: row.expected_from ?? null,
            expectedBy: row.expected_by ?? null,
            expectedRun: row.expected_run ?? null,
            linesDue: row.lines_due ?? 0,
            unitsDue: readNumber(row.units_due) ?? 0,
            placedAt: row.placed_at ?? null,
            due: row.due,
          },
        ]
      : [],
  );
}

// The rows in each group, keeping their order.
export function groupExpected(rows: readonly ExpectedDelivery[]): Record<DueGroup, ExpectedDelivery[]> {
  const out = { overdue: [], today: [], tomorrow: [], later: [], no_date: [] } as Record<DueGroup, ExpectedDelivery[]>;
  for (const row of rows) out[row.due].push(row);
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Receiving against orders (G2)
// ---------------------------------------------------------------------------------------------------------------

// What a delivery checked off on paper brought: counted quantities per order line (0 or missing for what didn't come).
export type ReceiveInput = { deliveryNote?: string | null; lines: { lineId: number; qty: number }[] };

// What one goods receipt filled.
export type ReceiptMatch = {
  receiptId: string;
  matchedAt: string | null;
  orders: { id: string; number: string; status: string; ourReference: string | null; units: number }[];
  // What it brought that no open order wanted.
  extraUnits: number;
  extraParts: number;
  // Waiting for the matcher (it runs every 15 seconds), or stuck after five tries (Match again).
  waiting: boolean;
  stuck: boolean;
};

// A line still due from a supplier at a location: what the phone compares a delivery with.
export type OpenOrderLine = {
  orderId: string;
  number: string;
  ourReference: string | null;
  expectedOn: string | null;
  expectedFrom: string | null;
  expectedBy: string | null;
  expectedRun: string | null;
  lineId: number;
  partId: number;
  brand: string;
  partNumber: string;
  supplierCode: string | null;
  description: string | null;
  reference: string | null;
  due: number;
  packQty: number;
  unit: string | null;
  // The sales order and customer the line is for (S4b), when it is a customer's line; those come first.
  // Optional, so code that builds lines by hand (the web's Receive, the phone's tests) keeps working.
  forOrder?: string | null;
  forCustomer?: string | null;
};

export async function receivePurchaseOrder(supabase: Client, orderId: string, input: ReceiveInput): Promise<PurchaseOrderDetail> {
  const p: Record<string, Json> = { lines: input.lines.filter((line) => line.qty > 0).map((line) => ({ line_id: line.lineId, qty: line.qty })) };
  if (input.deliveryNote != null) p.delivery_note = input.deliveryNote;
  const { data, error } = await supabase.rpc('receive_purchase_order', { p_order: orderId, p });
  if (error) throw dataError(error);
  return readPurchaseOrder(data as Json);
}

export async function closePurchaseOrderShort(supabase: Client, orderId: string, reason: string): Promise<PurchaseOrderDetail> {
  const { data, error } = await supabase.rpc('close_purchase_order_short', { p_order: orderId, p_reason: reason });
  if (error) throw dataError(error);
  return readPurchaseOrder(data as Json);
}

// Keep and pay, or send back, some of one part's extras on one of the order's deliveries. Editors.
export async function dealWithOrderExtras(
  supabase: Client,
  orderId: string,
  choice: { receiptId: string; partId: number; units: number; action: ExtrasAction },
): Promise<PurchaseOrderDetail> {
  const { data, error } = await supabase.rpc('deal_with_extras', {
    p_order: orderId,
    p: { receipt_id: choice.receiptId, part_id: choice.partId, units: choice.units, action: choice.action },
  });
  if (error) throw dataError(error);
  return readPurchaseOrder(data as Json);
}

// An extra of another part from one of the order's deliveries fills a short line. Editors.
export async function acceptSubstitute(
  supabase: Client,
  orderId: string,
  choice: { lineId: number; receiptId: string; partId: number; units: number },
): Promise<PurchaseOrderDetail> {
  const { data, error } = await supabase.rpc('accept_substitute', {
    p_order: orderId,
    p: { line_id: choice.lineId, receipt_id: choice.receiptId, part_id: choice.partId, units: choice.units },
  });
  if (error) throw dataError(error);
  return readPurchaseOrder(data as Json);
}

function readMatchOrders(value: Json | undefined): ReceiptMatch['orders'] {
  return readArray(value).flatMap((item) => {
    const row = readRecord(item);
    const id = readString(row?.document_id);
    const number = readString(row?.number);
    if (!row || !id || !number) return [];
    return [{ id, number, status: readString(row.status) ?? 'placed', ourReference: readString(row.our_reference), units: readNumber(row.units) ?? 0 }];
  });
}

export async function receiptOrderMatches(supabase: Client, receiptIds: string[]): Promise<ReceiptMatch[]> {
  if (receiptIds.length === 0) return [];
  const { data, error } = await supabase.rpc('receipt_order_matches', { p_receipts: receiptIds });
  if (error) throw dataError(error);
  return (data ?? []).map((row) => ({
    receiptId: row.document_id,
    matchedAt: row.matched_at ?? null,
    orders: readMatchOrders(row.orders),
    extraUnits: readNumber(row.extra_units) ?? 0,
    extraParts: row.extra_parts ?? 0,
    waiting: row.waiting ?? false,
    stuck: row.stuck ?? false,
  }));
}

// Match again. Returns the orders it filled and its extras.
export async function rematchReceipt(supabase: Client, receiptId: string): Promise<{ orders: string[]; extraUnits: number }> {
  const { data, error } = await supabase.rpc('rematch_receipt', { p_receipt: receiptId });
  if (error) throw dataError(error);
  const row = readRecord(data as Json);
  return { orders: readArray(row?.orders).flatMap((item) => readString(item) ?? []), extraUnits: readNumber(row?.extra_units) ?? 0 };
}

export async function listOpenOrderLines(supabase: Client, supplierId: number, locationId: number): Promise<OpenOrderLine[]> {
  const { data, error } = await supabase.rpc('open_order_lines', { p_source: supplierId, p_location: locationId });
  if (error) throw dataError(error);
  return (data ?? []).map((row) => ({
    orderId: row.document_id,
    number: row.number,
    ourReference: row.our_reference ?? null,
    expectedOn: row.expected_on ?? null,
    expectedFrom: row.expected_from ?? null,
    expectedBy: row.expected_by ?? null,
    expectedRun: row.expected_run ?? null,
    lineId: row.line_id,
    partId: row.part_id,
    brand: row.brand,
    partNumber: row.part_number,
    supplierCode: row.supplier_code ?? null,
    description: row.description ?? null,
    reference: row.reference ?? null,
    due: readNumber(row.due) ?? 0,
    packQty: Math.max(readNumber(row.pack_qty) ?? 1, 1),
    unit: row.unit ?? null,
    forOrder: row.for_order ?? null,
    forCustomer: row.for_customer ?? null,
  }));
}

// ---------------------------------------------------------------------------------------------------------------
// Count first, then compare: what the phone shows at Done
// ---------------------------------------------------------------------------------------------------------------

export type CountedPart = { partId: number; qty: number };

export type DeliveryCheckRow = {
  partId: number;
  brand: string;
  partNumber: string;
  counted: number;
  due: number;
  // matched: all that was due came; short: less came; over: more came than was due; not_ordered: on no open order;
  // not_arrived: due but none counted.
  verdict: 'matched' | 'short' | 'over' | 'not_ordered' | 'not_arrived';
  // The references of the orders it fills (a registration or a customer), so job parts are put aside.
  references: string[];
  orders: string[];
  // What of the count would go to customers' sales orders (S4b), customers' lines first as the database fills them:
  // a preview for the phone's Check screen; the database decides when the delivery is matched.
  putAside?: CustomerShare[];
};

// A customer's sales order a part is for, and (in a count) how many units it would take.
export type CustomerShare = { order: string; customer: string | null; units: number };

// The customers' orders a part is due for, customer lines first, without quantities (the count stays blind).
export function customerOrdersFor(partId: number, open: readonly OpenOrderLine[]): Omit<CustomerShare, 'units'>[] {
  const seen = new Map<string, string | null>();
  for (const line of open) {
    if (line.partId !== partId || !line.forOrder || line.due <= 0) continue;
    if (!seen.has(line.forOrder)) seen.set(line.forOrder, line.forCustomer ?? null);
  }
  return [...seen].map(([order, customer]) => ({ order, customer }));
}

// "For SO-000061 · Hillside Garage", or "For SO-000051 and SO-000058" when it is for more than one order.
export function customerOrdersWords(orders: readonly Omit<CustomerShare, 'units'>[]): string | null {
  const [first] = orders;
  if (!first) return null;
  if (orders.length === 1) return `For ${first.order}${first.customer ? ` · ${first.customer}` : ''}`;
  const numbers = orders.map((row) => row.order);
  return `For ${numbers.slice(0, -1).join(', ')} and ${numbers[numbers.length - 1]}`;
}

// How a count of one part splits: what each customer's order would take, in the order the lines are listed
// (customers' lines first, the earliest linked first), up to what each still has due.
export function customerShares(qty: number, lines: readonly OpenOrderLine[]): CustomerShare[] {
  const shares = new Map<string, CustomerShare>();
  let left = qty;
  for (const line of lines) {
    if (left <= 0) break;
    if (!line.forOrder || line.due <= 0) continue;
    const take = Math.min(left, line.due);
    const share = shares.get(line.forOrder) ?? { order: line.forOrder, customer: line.forCustomer ?? null, units: 0 };
    share.units += take;
    shares.set(line.forOrder, share);
    left -= take;
  }
  return [...shares.values()];
}

// Compares what was counted with what is still due from that supplier. Parts on no open order are "not ordered";
// lines due with nothing counted are "not arrived" only when they were due by today (others weren't expected yet).
export function compareDelivery(
  counted: readonly CountedPart[],
  open: readonly OpenOrderLine[],
  labels: ReadonlyMap<number, { brand: string; partNumber: string }> = new Map(),
  today?: string,
): DeliveryCheckRow[] {
  const countedBy = new Map<number, number>();
  for (const line of counted) countedBy.set(line.partId, (countedBy.get(line.partId) ?? 0) + line.qty);
  const dueBy = new Map<number, OpenOrderLine[]>();
  for (const line of open) dueBy.set(line.partId, [...(dueBy.get(line.partId) ?? []), line]);

  const rows: DeliveryCheckRow[] = [];
  for (const [partId, qty] of countedBy) {
    if (qty <= 0) continue;
    const lines = dueBy.get(partId) ?? [];
    const due = lines.reduce((sum, line) => sum + line.due, 0);
    const first = lines[0];
    const label = labels.get(partId) ?? { brand: first?.brand ?? '', partNumber: first?.partNumber ?? String(partId) };
    // The orders it fills, in the order matching fills them, until the count runs out.
    let left = qty;
    const filled = lines.filter((line) => {
      if (left <= 0) return false;
      left -= line.due;
      return true;
    });
    rows.push({
      partId,
      brand: label.brand,
      partNumber: label.partNumber,
      counted: qty,
      due,
      verdict: due === 0 ? 'not_ordered' : qty < due ? 'short' : qty > due ? 'over' : 'matched',
      references: [...new Set(filled.flatMap((line) => [line.reference, line.ourReference]).filter((ref): ref is string => !!ref && ref !== 'STOCK'))],
      orders: [...new Set(filled.map((line) => line.number))],
      putAside: customerShares(qty, lines),
    });
  }
  for (const [partId, lines] of dueBy) {
    if ((countedBy.get(partId) ?? 0) > 0) continue;
    if (today && !lines.some((line) => line.expectedOn != null && line.expectedOn <= today)) continue;
    const first = lines[0];
    if (!first) continue;
    rows.push({
      partId,
      brand: first.brand,
      partNumber: first.partNumber,
      counted: 0,
      due: lines.reduce((sum, line) => sum + line.due, 0),
      verdict: 'not_arrived',
      references: [],
      orders: [...new Set(lines.map((line) => line.number))],
      putAside: [],
    });
  }
  const rank: Record<DeliveryCheckRow['verdict'], number> = { short: 0, over: 1, not_ordered: 2, not_arrived: 3, matched: 4 };
  return rows.sort((a, b) => rank[a.verdict] - rank[b.verdict] || a.partNumber.localeCompare(b.partNumber));
}
