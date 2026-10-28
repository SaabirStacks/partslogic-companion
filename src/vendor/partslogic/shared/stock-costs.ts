import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@partslogic/db-types';

import { dataError } from './errors';
import { readArray, readNumber, readRecord, readString } from './read';

type Client = SupabaseClient<Database>;

// Some of the units in stock, from one supplier at one unit cost, entered by hand. Price lists keep setting each
// supplier's current price; lots say what the stock on the shelf actually cost.
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
// than are in stock. Returns the part's stock costs.
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
