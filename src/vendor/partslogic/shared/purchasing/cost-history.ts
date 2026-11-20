import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { DataError, dataError } from '../core/errors';
import { readArray, readBoolean, readNumber, readRecord, readString } from '../core/read';

// A part's cost history (step 8): what was paid for each delivery, and each supplier's price changes. Every figure,
// the changes included, is worked out in SQL (public.part_cost_history); this file shapes what is read.

// Where a delivery's unit cost came from: checked from the delivery note; the order price, or the supplier's sheet
// price for units not on an order, until it is checked. Null when there was no price at all.
export type DeliveredCostBasis = 'checked' | 'order' | 'sheet';

const BASES = new Set<string>(['checked', 'order', 'sheet']);

export type PaidDelivery = {
  receiptId: string;
  receipt: string;
  receivedAt: string;
  supplierId: number;
  supplier: string;
  qty: number;
  unitCost: number | null;
  basis: DeliveredCostBasis | null;
  orderCost: number | null;
  sheetCost: number | null;
  flagged: boolean;
  reason: string | null;
  previousCost: number | null;
  // Up or down on the last delivery from the same supplier, in per cent.
  changePct: number | null;
};

export type SupplierPriceChange = {
  supplierId: number;
  supplier: string;
  cost: number;
  currency: string;
  listPrice: number | null;
  validFrom: string;
  // Null while it is their current price.
  validTo: string | null;
  // Step 3d/3c: ended by an upload's undo, started again by one, or ended because a full list delisted it.
  undone: boolean;
  restored: boolean;
  delisted: boolean;
  previousCost: number | null;
  changePct: number | null;
};

export type CostHistory = {
  partId: number;
  currency: string;
  paid: PaidDelivery[];
  supplierPrices: SupplierPriceChange[];
  more: { paid: boolean; supplierPrices: boolean };
};

function readBasis(value: Json | undefined): DeliveredCostBasis | null {
  const basis = readString(value);
  return basis && BASES.has(basis) ? (basis as DeliveredCostBasis) : null;
}

export function readCostHistory(data: Json): CostHistory {
  const row = readRecord(data);
  const partId = readNumber(row?.part_id);
  if (!row || partId == null) throw new DataError('That part could not be read.', 'P0002');
  const more = readRecord(row.more);
  return {
    partId,
    currency: readString(row.currency) ?? 'GBP',
    paid: readArray(row.paid).flatMap((item) => {
      const paid = readRecord(item);
      const receiptId = readString(paid?.receipt_id);
      const receipt = readString(paid?.receipt);
      const receivedAt = readString(paid?.received_at);
      const supplierId = readNumber(paid?.supplier_id);
      const supplier = readString(paid?.supplier);
      if (!paid || !receiptId || !receipt || !receivedAt || supplierId == null || !supplier) return [];
      return [
        {
          receiptId,
          receipt,
          receivedAt,
          supplierId,
          supplier,
          qty: readNumber(paid.qty) ?? 0,
          unitCost: readNumber(paid.unit_cost),
          basis: readBasis(paid.basis),
          orderCost: readNumber(paid.order_cost),
          sheetCost: readNumber(paid.sheet_cost),
          flagged: readBoolean(paid.flagged) ?? false,
          reason: readString(paid.reason),
          previousCost: readNumber(paid.previous_cost),
          changePct: readNumber(paid.change_pct),
        },
      ];
    }),
    supplierPrices: readArray(row.supplier_prices).flatMap((item) => {
      const price = readRecord(item);
      const supplierId = readNumber(price?.supplier_id);
      const supplier = readString(price?.supplier);
      const cost = readNumber(price?.cost);
      const validFrom = readString(price?.valid_from);
      if (!price || supplierId == null || !supplier || cost == null || !validFrom) return [];
      return [
        {
          supplierId,
          supplier,
          cost,
          currency: readString(price.currency) ?? 'GBP',
          listPrice: readNumber(price.list_price),
          validFrom,
          validTo: readString(price.valid_to),
          undone: readBoolean(price.undone) ?? false,
          restored: readBoolean(price.restored) ?? false,
          delisted: readBoolean(price.delisted) ?? false,
          previousCost: readNumber(price.previous_cost),
          changePct: readNumber(price.change_pct),
        },
      ];
    }),
    more: { paid: readBoolean(more?.paid) ?? false, supplierPrices: readBoolean(more?.supplier_prices) ?? false },
  };
}

export async function getCostHistory(supabase: Client, partId: number, limit?: number): Promise<CostHistory> {
  const { data, error } = await supabase.rpc('part_cost_history', {
    p_part: partId,
    ...(limit != null ? { p_limit: limit } : {}),
  });
  if (error) throw dataError(error);
  return readCostHistory(data);
}
