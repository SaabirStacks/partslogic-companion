import type { Database, Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { DataError, dataError } from '../core/errors';
import type { Page } from '../core/page';
import { readArray, readBoolean, readNumber, readRecord, readString, readStrings, type JsonRecord } from '../core/read';

export const INVENTORY_PAGE_SIZES = [10, 25, 50, 100] as const;
export type InventoryPageSize = (typeof INVENTORY_PAGE_SIZES)[number];

// Sort keys list_inventory accepts; a leading "-" means highest first.
export const INVENTORY_SORTS = ['brand', 'number', 'sku', 'on_hand', '-on_hand', 'best_cost', '-best_cost'] as const;
export type InventorySort = (typeof INVENTORY_SORTS)[number];

// The category filter's id for parts with no category.
export const UNCATEGORISED = -1;
// The supplier filter's "No supplier price": parts no supplier lists now (step 3c, after a full list delists them).
export const NO_SUPPLIER_PRICE = -1;

export type PartKind = Database['catalogue']['Enums']['part_kind'];

export type InventoryQuery = {
  search?: string | null;
  brandId?: number | null;
  categoryId?: number | null;
  binId?: number | null;
  supplierId?: number | null;
  inStock?: boolean | null;
  belowReorder?: boolean | null;
  // Parts with a typed price under their minimum margin.
  belowMargin?: boolean | null;
  sort?: InventorySort;
  limit: number;
  offset: number;
};

export type StockLine = { binId: number; place: string; qty: number };

// How the part is priced: sellPrice is what people pay at retail (typed, or worked out from the margin rules).
export type ItemPricing = {
  source: 'manual' | 'rule' | null;
  tradePrice: number | null;
  minMargin: number | null;
  // Retail margin on the sell price against the best cost.
  margin: number | null;
  belowMinMargin: boolean;
  // The exchange surcharge: a refundable deposit on the old unit, never part of the price or margin.
  surcharge: ItemSurcharge;
};

// amount: what the customer pays per unit, ex VAT (null: none). source 'manual' is typed for the part (an
// amount of null then means "none for this part"); 'supplier' is the best supplier's plus the uplift.
export type ItemSurcharge = {
  amount: number | null;
  source: 'manual' | 'supplier' | null;
  supplierAmount: number | null;
  supplierCode: string | null;
  uplift: number;
};

export type InventoryRow = {
  partId: number;
  partNumber: string;
  kind: PartKind;
  sku: string | null;
  // The name shown: typed by hand, else the product name enrichment found, else the price-sheet name.
  name: string | null;
  // The price-sheet name, when the part's detail carries it (lists leave it out).
  catalogueName?: string | null;
  brandId: number;
  brandName: string;
  categoryId: number | null;
  categoryName: string | null;
  sellPrice: number | null;
  pricing: ItemPricing;
  // The lowest minimum set for the part at any location (levels are per location); null when none is set.
  reorderLevel: number | null;
  isStocked: boolean;
  onHand: number;
  // Units set aside for confirmed sales orders: on hand less this is what can be sold.
  setAside: number;
  belowReorder: boolean;
  // The cheapest current supplier price.
  bestCost: number | null;
  bestCurrency: string | null;
  bestSupplierId: number | null;
  bestSupplierName: string | null;
  // What margins, rule prices and stock value use: the stock's cost while stock cost lots cover any of it
  // (costed units at their cost, the rest at bestCost), otherwise bestCost.
  unitCost: number | null;
  // Units the stock cost lots cover; 0 when unitCost is just the supplier price.
  costedQty: number;
  eans: string[];
  stock: StockLine[];
  updatedAt: string | null;
  // When Autodoc enrichment was last applied to the part; null when it never was.
  enrichedAt: string | null;
  // The cheapest supplier marks the line "while stocks last" (the Stock list says so; other lists leave it false).
  ending: boolean;
  // Being enriched now, or waiting in the enrichment queue (the Stock list says so; other lists leave it out).
  enrichment?: PartEnrichmentState | null;
  // Listed as an alternative to what was searched, and why (the Stock list's search; null for a direct match).
  match?: StockMatch | null;
};

// Why a row is an alternative to a searched part: how it relates, the OE number they share (via) and the part it
// is an alternative of.
export type StockMatch = {
  relation: 'same_oe' | 'same_group' | 'cross_reference' | 'replaces' | 'superseded_by';
  via: string | null;
  of: string | null;
};

const STOCK_RELATIONS: readonly StockMatch['relation'][] = ['same_oe', 'same_group', 'cross_reference', 'replaces', 'superseded_by'];

export function readStockMatch(value: JsonRecord | null): StockMatch | null {
  const relation = STOCK_RELATIONS.find((known) => known === value?.relation);
  return value && relation ? { relation, via: readString(value.via), of: readString(value.of) } : null;
}

// Why a row is an alternative, in a few words for the list and in full for a hover.
export function stockMatchReason(match: StockMatch): { short: string; full: string } {
  const of = match.of ?? 'the part searched';
  switch (match.relation) {
    case 'same_oe':
      return { short: `Same OE as ${of}`, full: `Made to the same OE number as ${of}${match.via ? `: ${match.via}` : ''}` };
    case 'same_group':
      return { short: `Same group as ${of}`, full: `In the same OE group as ${of}` };
    case 'cross_reference':
      return { short: `Cross-reference of ${of}`, full: `A cross-reference of ${of}` };
    case 'replaces':
      return { short: `Replaced by ${of}`, full: `An older part that ${of} replaces` };
    case 'superseded_by':
      return { short: `Replaces ${of}`, full: `The newer part that replaces ${of}` };
  }
}

// What a list says about a part and enrichment: a run or a queued job is working on it, or one is waiting.
export type PartEnrichmentState = 'running' | 'queued';

export type FilterOption = { id: number; label: string; count: number };
export type InventoryFilterOptions = {
  brands: FilterOption[];
  categories: FilterOption[];
  bins: FilterOption[];
  suppliers: FilterOption[];
};

export type InventoryItemChanges = {
  sku?: string | null;
  // Your own name for the part; null falls back to the catalogue description.
  displayName?: string | null;
  // The everyday retail price (break 1); other tiers are edited in pricing.
  sellPrice?: number | null;
  isStocked?: boolean;
  // Your own exchange surcharge (ex VAT): 0 for none, null to follow the supplier's.
  surcharge?: number | null;
};

const PART_KINDS = new Set<string>(['oe', 'aftermarket', 'oe_placeholder']);

export function inventoryPageSize(value: number): InventoryPageSize {
  return INVENTORY_PAGE_SIZES.find((size) => size === value) ?? 10;
}

export function isInventorySort(value: string): value is InventorySort {
  return (INVENTORY_SORTS as readonly string[]).includes(value);
}

// One page of your range. The database applies filters, sort and limit, and counts every match.
export async function listInventory(supabase: Client, query: InventoryQuery): Promise<Page<InventoryRow>> {
  const limit = inventoryPageSize(query.limit);
  const offset = Math.max(0, Math.floor(query.offset));
  const { data, error } = await supabase.rpc('list_inventory', {
    p_search: query.search?.trim() || undefined,
    p_brand_id: query.brandId ?? undefined,
    p_category_id: query.categoryId ?? undefined,
    p_bin_id: query.binId ?? undefined,
    p_source_id: query.supplierId ?? undefined,
    p_in_stock: query.inStock ?? undefined,
    p_below_reorder: query.belowReorder ?? undefined,
    p_below_margin: query.belowMargin ?? undefined,
    p_sort: query.sort ?? 'brand',
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw dataError(error);

  const rows = (data ?? []) as unknown as JsonRecord[];
  return {
    rows: rows.flatMap((row) => {
      const mapped = readInventoryRow(row);
      return mapped ? [mapped] : [];
    }),
    page: { limit, offset, total: readNumber(rows[0]?.total_count) ?? 0 },
  };
}

// The choices for each inventory filter, with ids and how many rows each would show.
export async function inventoryFilterOptions(supabase: Client): Promise<InventoryFilterOptions> {
  const { data, error } = await supabase.rpc('inventory_filter_options');
  if (error) throw dataError(error);

  const record = readRecord(data);
  return {
    brands: readOptions(record?.brands),
    categories: readOptions(record?.categories),
    bins: readOptions(record?.bins),
    suppliers: readOptions(record?.suppliers),
  };
}

// Saves your SKU, display name, sell price, reorder level and stocked flag for one part. Row-level security
// allows editors only: an update that touches nothing is told apart as "no such row" or "not allowed".
export async function updateInventoryItem(
  supabase: Client,
  partId: number,
  changes: InventoryItemChanges,
): Promise<void> {
  const values: Database['public']['Tables']['inventory_items']['Update'] = {};
  if (changes.sku !== undefined) values.own_sku = changes.sku?.trim() || null;
  if (changes.displayName !== undefined) values.description_override = changes.displayName?.trim() || null;
  if (changes.isStocked !== undefined) values.is_stocked = changes.isStocked;
  if (changes.surcharge !== undefined) values.surcharge = changes.surcharge;

  if (Object.keys(values).length > 0) {
    const { data, error } = await supabase.from('inventory_items').update(values).eq('part_id', partId).select('part_id');
    if (error?.code === '23505') throw new DataError('That SKU is already used by another part.', '23505');
    if (error) throw dataError(error);
    if (data.length === 0) await explainNoRow(supabase, partId);
  } else if (changes.sellPrice !== undefined) {
    await explainNoRow(supabase, partId, true);
  }

  if (changes.sellPrice !== undefined) {
    // set_sell_price takes null to clear the price; the generated types only say number.
    const { error } = await supabase.rpc('set_sell_price', { p_part: partId, p_price: changes.sellPrice as number });
    if (error) throw dataError(error);
  }
}

// After an update that touched nothing: is the row missing, or is the caller not allowed?
async function explainNoRow(supabase: Client, partId: number, onlyIfMissing = false): Promise<void> {
  const { count, error } = await supabase
    .from('inventory_items')
    .select('part_id', { count: 'exact', head: true })
    .eq('part_id', partId);
  if (error) throw dataError(error);
  if (!count) throw new DataError('That part is not in your inventory.', 'PGRST116');
  if (!onlyIfMissing) throw new DataError('You need the editor role to change inventory.', '42501');
}

// Maps one inventory_rows record (from list_inventory or part_detail) to the app's shape.
export function readInventoryRow(row: JsonRecord | null): InventoryRow | null {
  if (!row) return null;
  const partId = readNumber(row.part_id);
  const partNumber = readString(row.part_number);
  const brandId = readNumber(row.brand_id);
  const brandName = readString(row.brand_name);
  const kind = row.kind;
  if (partId == null || !partNumber || brandId == null || !brandName || typeof kind !== 'string' || !PART_KINDS.has(kind)) {
    return null;
  }

  return {
    partId,
    partNumber,
    kind: kind as PartKind,
    sku: readString(row.sku),
    name: readString(row.name),
    brandId,
    brandName,
    categoryId: readNumber(row.category_id),
    categoryName: readString(row.category_name),
    sellPrice: readNumber(row.sell_price),
    pricing: readItemPricing(readRecord(row.pricing)),
    reorderLevel: readNumber(row.reorder_level),
    isStocked: readBoolean(row.is_stocked) ?? false,
    onHand: readNumber(row.on_hand) ?? 0,
    setAside: readNumber(row.set_aside) ?? 0,
    belowReorder: readBoolean(row.below_reorder) ?? false,
    bestCost: readNumber(row.best_cost),
    bestCurrency: readString(row.best_currency),
    bestSupplierId: readNumber(row.best_source_id),
    bestSupplierName: readString(row.best_source_name),
    // Stock-list pages don't carry unit_cost; there it is the supplier price.
    unitCost: row.unit_cost === undefined ? readNumber(row.best_cost) : readNumber(row.unit_cost),
    costedQty: readNumber(row.costed_qty) ?? 0,
    catalogueName: readString(row.catalogue_name),
    eans: readStrings(row.eans),
    stock: readArray(row.stock).flatMap((item) => {
      const line = readRecord(item);
      const binId = readNumber(line?.bin_id);
      const place = readString(line?.place);
      const qty = readNumber(line?.qty);
      return binId == null || !place || qty == null ? [] : [{ binId, place, qty }];
    }),
    updatedAt: readString(row.updated_at),
    enrichedAt: readString(row.enriched_at),
    ending: readBoolean(row.ending) ?? false,
    enrichment: row.enrichment === 'running' || row.enrichment === 'queued' ? row.enrichment : null,
    match: readStockMatch(readRecord(row.match)),
  };
}

function readItemPricing(pricing: JsonRecord | null): ItemPricing {
  const source = readString(pricing?.sell_price_source);
  return {
    source: source === 'manual' || source === 'rule' ? source : null,
    tradePrice: readNumber(pricing?.trade_price),
    minMargin: readNumber(pricing?.min_margin),
    margin: readNumber(pricing?.margin),
    belowMinMargin: readBoolean(pricing?.below_min_margin) ?? false,
    surcharge: readItemSurcharge(pricing),
  };
}

function readItemSurcharge(pricing: JsonRecord | null): ItemSurcharge {
  const source = readString(pricing?.surcharge_source);
  return {
    amount: readNumber(pricing?.surcharge),
    source: source === 'manual' || source === 'supplier' ? source : null,
    supplierAmount: readNumber(pricing?.supplier_surcharge),
    supplierCode: readString(pricing?.supplier_surcharge_code),
    uplift: readNumber(pricing?.surcharge_uplift) ?? 0,
  };
}

function readOptions(value: Json | undefined): FilterOption[] {
  return readArray(value).flatMap((item) => {
    const option = readRecord(item);
    const id = readNumber(option?.id);
    const label = readString(option?.label);
    return id == null || !label ? [] : [{ id, label, count: readNumber(option?.count) ?? 0 }];
  });
}
