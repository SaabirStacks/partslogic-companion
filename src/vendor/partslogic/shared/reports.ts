import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@partslogic/db-types';

import { dataError } from './errors';
import { readNumber } from './read';

type Client = SupabaseClient<Database>;

export type InventorySummary = {
  items: number;
  stocked: number;
  inStock: number;
  outOfStock: number;
  belowReorder: number;
  stockValue: number;
  inStockWithoutPrice: number;
  currency: string;
  // Parts with a typed price under their minimum margin.
  belowMinMargin: number;
};

export type ValuationLine = {
  partId: number;
  number: string;
  onHand: number;
  unitCost: number | null;
  costBasis: 'last_receipt' | 'supplier_price' | 'unknown';
  value: number | null;
};

export type ReorderSuggestion = {
  partId: number;
  brand: string;
  number: string;
  // Null for the all-locations reorder level; set when one location is at or under its minimum.
  locationId: number | null;
  locationCode: string | null;
  onHand: number;
  reorderLevel: number;
  maxLevel: number | null;
  suggestedQty: number;
  bestCost: number | null;
  bestSupplier: string | null;
};

export type ZeroResultSearch = { query: string; searches: number; lastSearchedAt: string };

const COST_BASES = new Set(['last_receipt', 'supplier_price', 'unknown']);

// Range-wide totals for the dashboard.
export async function getInventorySummary(supabase: Client): Promise<InventorySummary> {
  const { data, error } = await supabase.from('inventory_summary').select('*').single();
  if (error) throw dataError(error);

  return {
    items: readNumber(data.items) ?? 0,
    stocked: readNumber(data.stocked) ?? 0,
    inStock: readNumber(data.in_stock) ?? 0,
    outOfStock: readNumber(data.out_of_stock) ?? 0,
    belowReorder: readNumber(data.below_reorder) ?? 0,
    stockValue: readNumber(data.stock_value) ?? 0,
    inStockWithoutPrice: readNumber(data.in_stock_without_price) ?? 0,
    currency: data.currency ?? 'GBP',
    belowMinMargin: readNumber(data.below_min_margin) ?? 0,
  };
}

// Value of stock on hand, largest first. Every stocked part has a line, so only the top `limit` come back.
export async function getStockValuation(supabase: Client, limit = 100): Promise<ValuationLine[]> {
  const { data, error } = await supabase.rpc('stock_valuation').limit(Math.min(Math.max(limit, 1), 1000));
  if (error) throw dataError(error);

  return (data ?? []).flatMap((row) =>
    row.part_id == null || row.number == null || !COST_BASES.has(row.cost_basis ?? '')
      ? []
      : [
          {
            partId: row.part_id,
            number: row.number,
            onHand: readNumber(row.on_hand) ?? 0,
            unitCost: readNumber(row.unit_cost),
            costBasis: row.cost_basis as ValuationLine['costBasis'],
            value: readNumber(row.value),
          },
        ],
  );
}

// Parts at or below their reorder level (all locations), and locations at or below their minimum.
export async function getReorderSuggestions(supabase: Client, limit = 100): Promise<ReorderSuggestion[]> {
  const { data, error } = await supabase.rpc('reorder_suggestions').limit(Math.min(Math.max(limit, 1), 1000));
  if (error) throw dataError(error);

  return (data ?? []).flatMap((row) =>
    row.part_id == null || row.brand == null || row.number == null
      ? []
      : [
          {
            partId: row.part_id,
            brand: row.brand,
            number: row.number,
            locationId: readNumber(row.location_id),
            locationCode: row.location_code,
            onHand: readNumber(row.on_hand) ?? 0,
            reorderLevel: readNumber(row.reorder_level) ?? 0,
            maxLevel: readNumber(row.max_level),
            suggestedQty: readNumber(row.suggested_qty) ?? 0,
            bestCost: readNumber(row.best_cost),
            bestSupplier: row.best_source,
          },
        ],
  );
}

// What people searched for and did not find, most frequent first.
export async function getZeroResultSearches(supabase: Client, limit = 50): Promise<ZeroResultSearch[]> {
  const { data, error } = await supabase
    .from('zero_result_searches')
    .select('query, searches, last_searched_at')
    .order('searches', { ascending: false })
    .order('last_searched_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));
  if (error) throw dataError(error);

  return (data ?? []).flatMap((row) =>
    row.query == null || row.last_searched_at == null
      ? []
      : [{ query: row.query, searches: readNumber(row.searches) ?? 0, lastSearchedAt: row.last_searched_at }],
  );
}
