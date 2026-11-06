import type { Database } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { dataError } from '../core/errors';
import type { Page } from '../core/page';
import { readNumber } from '../core/read';
import { inventoryPageSize } from './items';

export type MovementReason = Database['public']['Enums']['movement_reason'];

export type StockAdjustment = {
  binId: number;
  partId: number;
  qty: number;
  reason: Exclude<MovementReason, 'stocktake' | 'transfer_in' | 'transfer_out'>;
  reference?: string | null;
  unitCost?: number | null;
};

export type StockTransfer = {
  fromBinId: number;
  toBinId: number;
  partId: number;
  qty: number;
  reference?: string | null;
};

export type StockMovement = {
  id: number;
  createdAt: string;
  qtyDelta: number;
  reason: MovementReason;
  reference: string | null;
  unitCost: number | null;
  binId: number | null;
  place: string | null;
  // Stock on hand after this movement: across all bins, and in this bin.
  partTotal: number | null;
  binTotal: number | null;
  createdBy: string | null;
};

export type MovementFilter = { binId?: number | null; reason?: MovementReason | null };

// Records "there are qty of this part in this bin" as one adjustment. Returns the new quantity.
export async function setStockCount(
  supabase: Client,
  input: { binId: number; partId: number; qty: number; reference?: string | null },
): Promise<number> {
  const { data, error } = await supabase.rpc('set_stock_count', {
    p_bin: input.binId,
    p_part: input.partId,
    p_qty: input.qty,
    p_reference: input.reference ?? undefined,
  });
  if (error) throw dataError(error);
  return readNumber(data) ?? input.qty;
}

// Books stock in or out of a bin (receipt, sale, adjustment, returns). Returns the movement id.
export async function adjustStock(supabase: Client, input: StockAdjustment): Promise<number> {
  const { data, error } = await supabase.rpc('adjust_stock', {
    p_bin: input.binId,
    p_part: input.partId,
    p_qty_delta: input.qty,
    p_reason: input.reason,
    p_reference: input.reference ?? undefined,
    p_unit_cost: input.unitCost ?? undefined,
  });
  if (error) throw dataError(error);
  return data;
}

// Moves stock from one bin to another.
export async function transferStock(supabase: Client, input: StockTransfer): Promise<void> {
  const { error } = await supabase.rpc('transfer_stock', {
    p_from_bin: input.fromBinId,
    p_to_bin: input.toBinId,
    p_part: input.partId,
    p_qty: input.qty,
    p_reference: input.reference ?? undefined,
  });
  if (error) throw dataError(error);
}

// A part's stock ledger, newest first. Sales and returns are movements until orders exist.
export async function listMovements(
  supabase: Client,
  partId: number,
  paging: { limit: number; offset: number },
  filter: MovementFilter = {},
): Promise<Page<StockMovement>> {
  const limit = inventoryPageSize(paging.limit);
  const offset = Math.max(0, Math.floor(paging.offset));
  let query = supabase
    .from('stock_movement_history')
    .select('id, created_at, qty_delta, reason, reference, unit_cost, bin_id, place, part_total, bin_total, created_by', {
      count: 'exact',
    })
    .eq('part_id', partId);
  if (filter.binId != null) query = query.eq('bin_id', filter.binId);
  if (filter.reason) query = query.eq('reason', filter.reason);
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw dataError(error);

  return {
    rows: (data ?? []).flatMap((row) =>
      row.id == null || row.created_at == null || row.reason == null
        ? []
        : [
            {
              id: row.id,
              createdAt: row.created_at,
              qtyDelta: readNumber(row.qty_delta) ?? 0,
              reason: row.reason,
              reference: row.reference,
              unitCost: readNumber(row.unit_cost),
              binId: row.bin_id,
              place: row.place,
              partTotal: readNumber(row.part_total),
              binTotal: readNumber(row.bin_total),
              createdBy: row.created_by,
            },
          ],
    ),
    page: { limit, offset, total: count ?? 0 },
  };
}
