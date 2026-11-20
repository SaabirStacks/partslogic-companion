import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { dataError } from '../core/errors';
import { readArray, readNumber, readRecord, readString } from '../core/read';

// Where a lot's unit cost came from: typed in by hand; the order price, or the supplier's sheet price for units not on
// an order, until the delivery's prices are checked; or checked from the delivery note.
export type StockCostBasis = 'typed' | 'order' | 'sheet' | 'checked';

const BASES = new Set<string>(['typed', 'order', 'sheet', 'checked']);

// Some of the units in stock, from one supplier at one unit cost: typed in by hand, or put there by a delivery. Price
// lists keep setting each supplier's current price; lots say what the stock on the shelf actually cost.
export type StockCostLot = {
  id: number;
  supplierId: number;
  supplier: string;
  qty: number;
  unitCost: number;
  currency: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  basis: StockCostBasis;
  // The delivery the units came in on (its goods receipt), for lots put there by a delivery. Its price is corrected
  // in Price checks, not by hand.
  receiptId: string | null;
  receipt: string | null;
  receivedQty: number | null;
};

export type StockCosts = {
  onHand: number;
  // Units the lots cover. More than onHand when stock has gone down since the lots were entered.
  costed: number;
  averageCost: number | null;
  currency: string;
  lots: StockCostLot[];
};

export type StockCostLotInput = {
  id?: number | null;
  supplierId: number;
  qty: number;
  unitCost: number;
  note?: string | null;
};

function readBasis(value: Json | undefined): StockCostBasis {
  const basis = readString(value);
  return basis && BASES.has(basis) ? (basis as StockCostBasis) : 'typed';
}

function readStockCosts(data: Json | null): StockCosts {
  const record = readRecord(data ?? undefined);
  return {
    onHand: readNumber(record?.on_hand) ?? 0,
    costed: readNumber(record?.costed) ?? 0,
    averageCost: readNumber(record?.average_cost),
    currency: readString(record?.currency) ?? 'GBP',
    lots: readArray(record?.lots).flatMap((value) => {
      const lot = readRecord(value);
      const id = readNumber(lot?.id);
      const supplierId = readNumber(lot?.supplier_id);
      const supplier = readString(lot?.supplier);
      const qty = readNumber(lot?.qty);
      const unitCost = readNumber(lot?.unit_cost);
      if (id == null || supplierId == null || !supplier || qty == null || unitCost == null) return [];
      return [
        {
          id,
          supplierId,
          supplier,
          qty,
          unitCost,
          currency: readString(lot?.currency) ?? 'GBP',
          note: readString(lot?.note),
          createdAt: readString(lot?.created_at) ?? '',
          updatedAt: readString(lot?.updated_at) ?? '',
          basis: readBasis(lot?.basis),
          receiptId: readString(lot?.document_id),
          receipt: readString(lot?.receipt),
          receivedQty: readNumber(lot?.received_qty),
        },
      ];
    }),
  };
}

export async function getStockCosts(supabase: Client, partId: number): Promise<StockCosts> {
  const { data, error } = await supabase.rpc('part_stock_costs', { p_part: partId });
  if (error) throw dataError(error);
  return readStockCosts(data);
}

// Adds a lot, or changes one when input.id is set (editors). Refused when the part's lots would cover more units
// than are in stock, or when the lot came in on a delivery. Returns the part's stock costs.
export async function saveStockCostLot(supabase: Client, partId: number, input: StockCostLotInput): Promise<StockCosts> {
  const { data, error } = await supabase.rpc('save_stock_cost_lot', {
    p_part: partId,
    p_source: input.supplierId,
    p_qty: input.qty,
    p_unit_cost: input.unitCost,
    ...(input.note?.trim() ? { p_note: input.note.trim() } : {}),
    ...(input.id != null ? { p_id: input.id } : {}),
  });
  if (error) throw dataError(error);
  return readStockCosts(data);
}

export async function removeStockCostLot(supabase: Client, lotId: number): Promise<StockCosts> {
  const { data, error } = await supabase.rpc('remove_stock_cost_lot', { p_id: lotId });
  if (error) throw dataError(error);
  return readStockCosts(data);
}
