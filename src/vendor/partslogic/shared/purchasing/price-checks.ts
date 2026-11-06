import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { DataError, dataError } from '../core/errors';
import { readArray, readBoolean, readNumber, readRecord, readString } from '../core/read';

// Price checks: after a delivery has arrived and been matched to its orders, the office checks its prices from the
// delivery note. Every rule lives in SQL (public.save_price_check, docs/GOODS_IN.md); this file shapes what is sent
// and read.

export type PriceCheckRow = {
  receiptId: string;
  number: string;
  supplierId: number;
  supplier: string;
  deliveryNote: string | null;
  locationCode: string | null;
  receivedAt: string;
  parts: number;
  units: number;
  // At the order prices (an extra at the sheet price), or at the checked prices once checked.
  value: number;
  checkedAt: string | null;
  checkedBy: string | null;
  flagged: number;
};

export type PriceCheckPart = {
  partId: number;
  brand: string;
  number: string;
  description: string | null;
  supplierCode: string | null;
  qty: number;
  // How much of it filled an order; the rest was extra.
  matched: number;
  // The agreed order price of what it filled (weighted when several orders); null for an extra.
  orderCost: number | null;
  sheetCost: number | null;
  lastPaid: number | null;
  lastPaidAt: string | null;
  // Once checked: the note's price, whether it was flagged, and why it was accepted.
  unitCost: number | null;
  flagged: boolean;
  reason: string | null;
};

export type PriceCheckDetail = {
  receiptId: string;
  number: string;
  status: string;
  deliveryNote: string | null;
  receivedAt: string;
  by: string;
  supplier: { id: number; name: string } | null;
  location: { id: number; code: string; name: string } | null;
  reversed: boolean;
  thresholdPct: number;
  currency: string;
  orders: { id: string; number: string; carriage: number; ourReference: string | null }[];
  parts: PriceCheckPart[];
  checkedAt: string | null;
  checkedBy: string | null;
  carriageCharged: number | null;
  canCheck: boolean;
};

export type PriceCheckInput = {
  lines: { partId: number; unitCost: number; reason?: string | null }[];
  carriageCharged?: number | null;
};

// The price a part starts at: what was checked, else the order price, else the sheet price.
export function startingPrice(part: PriceCheckPart): number | null {
  return part.unitCost ?? part.orderCost ?? part.sheetCost;
}

// The same test as the database (purchasing.price_flagged): more than the threshold off the order price.
export function priceFlagged(cost: number, orderCost: number | null, thresholdPct: number): boolean {
  return orderCost != null && orderCost > 0 && (Math.abs(cost - orderCost) / orderCost) * 100 > thresholdPct;
}

function readPart(value: Json): PriceCheckPart | null {
  const row = readRecord(value);
  const partId = readNumber(row?.part_id);
  if (!row || partId == null) return null;
  return {
    partId,
    brand: readString(row.brand) ?? '',
    number: readString(row.number) ?? '',
    description: readString(row.description),
    supplierCode: readString(row.supplier_code),
    qty: readNumber(row.qty) ?? 0,
    matched: readNumber(row.matched) ?? 0,
    orderCost: readNumber(row.order_cost),
    sheetCost: readNumber(row.sheet_cost),
    lastPaid: readNumber(row.last_paid),
    lastPaidAt: readString(row.last_paid_at),
    unitCost: readNumber(row.unit_cost),
    flagged: readBoolean(row.flagged) ?? false,
    reason: readString(row.reason),
  };
}

export function readPriceCheck(value: Json | null | undefined): PriceCheckDetail {
  const row = readRecord(value ?? undefined);
  const receiptId = readString(row?.document_id);
  const number = readString(row?.number);
  if (!row || !receiptId || !number) throw new DataError('The delivery could not be read.', 'P0002');
  const supplier = readRecord(row.supplier);
  const supplierId = readNumber(supplier?.id);
  const location = readRecord(row.location);
  const locationId = readNumber(location?.id);
  return {
    receiptId,
    number,
    status: readString(row.status) ?? 'posted',
    deliveryNote: readString(row.delivery_note),
    receivedAt: readString(row.received_at) ?? '',
    by: readString(row.by) ?? 'Someone',
    supplier: supplier && supplierId != null ? { id: supplierId, name: readString(supplier.name) ?? '' } : null,
    location: location && locationId != null ? { id: locationId, code: readString(location.code) ?? '', name: readString(location.name) ?? '' } : null,
    reversed: readBoolean(row.reversed) ?? false,
    thresholdPct: readNumber(row.threshold_pct) ?? 5,
    currency: readString(row.currency) ?? 'GBP',
    orders: readArray(row.orders).flatMap((item) => {
      const order = readRecord(item);
      const id = readString(order?.document_id);
      const orderNumber = readString(order?.number);
      if (!order || !id || !orderNumber) return [];
      return [{ id, number: orderNumber, carriage: readNumber(order.carriage) ?? 0, ourReference: readString(order.our_reference) }];
    }),
    parts: readArray(row.parts).flatMap((item) => readPart(item) ?? []),
    checkedAt: readString(row.checked_at),
    checkedBy: readString(row.checked_by),
    carriageCharged: readNumber(row.carriage_charged),
    canCheck: readBoolean(readRecord(row.can)?.check) ?? false,
  };
}

export async function listPriceChecks(supabase: Client, checked = false): Promise<PriceCheckRow[]> {
  const { data, error } = await supabase.rpc('price_check_list', { p_checked: checked });
  if (error) throw dataError(error);
  return (data ?? []).map((row) => ({
    receiptId: row.document_id,
    number: row.number,
    supplierId: row.source_id,
    supplier: row.supplier,
    deliveryNote: row.delivery_note ?? null,
    locationCode: row.location_code ?? null,
    receivedAt: row.received_at,
    parts: row.parts ?? 0,
    units: readNumber(row.units) ?? 0,
    value: readNumber(row.value) ?? 0,
    checkedAt: row.checked_at ?? null,
    checkedBy: row.checked_by ?? null,
    flagged: row.flagged ?? 0,
  }));
}

export async function getPriceCheck(supabase: Client, receiptId: string): Promise<PriceCheckDetail> {
  const { data, error } = await supabase.rpc('price_check_detail', { p_receipt: receiptId });
  if (error) throw dataError(error);
  return readPriceCheck(data as Json);
}

export async function savePriceCheck(supabase: Client, receiptId: string, input: PriceCheckInput): Promise<PriceCheckDetail> {
  const p: Record<string, Json> = {
    lines: input.lines.map((line) => {
      const out: Record<string, Json> = { part_id: line.partId, unit_cost: line.unitCost };
      if (line.reason) out.reason = line.reason;
      return out;
    }),
  };
  if (input.carriageCharged !== undefined) p.carriage_charged = input.carriageCharged;
  const { data, error } = await supabase.rpc('save_price_check', { p_receipt: receiptId, p });
  if (error) throw dataError(error);
  return readPriceCheck(data as Json);
}
