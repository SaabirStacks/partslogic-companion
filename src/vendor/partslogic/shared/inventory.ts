import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@partslogic/db-types';

import { DataError, dataError } from './errors';
import { readArray, readBoolean, readNumber, readRecord, readString, readStrings, type JsonRecord } from './read';

type Client = SupabaseClient<Database>;

export const INVENTORY_PAGE_SIZES = [10, 25, 50, 100] as const;
export type InventoryPageSize = (typeof INVENTORY_PAGE_SIZES)[number];

// Sort keys list_inventory accepts; a leading "-" means highest first.
export const INVENTORY_SORTS = ['brand', 'number', 'sku', 'on_hand', '-on_hand', 'best_cost', '-best_cost'] as const;
export type InventorySort = (typeof INVENTORY_SORTS)[number];

// The category filter's id for parts with no category.
export const UNCATEGORISED = -1;

export type PartKind = Database['catalogue']['Enums']['part_kind'];
export type MovementReason = Database['public']['Enums']['movement_reason'];

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
  name: string | null;
  brandId: number;
  brandName: string;
  categoryId: number | null;
  categoryName: string | null;
  sellPrice: number | null;
  pricing: ItemPricing;
  reorderLevel: number | null;
  isStocked: boolean;
  onHand: number;
  belowReorder: boolean;
  bestCost: number | null;
  bestCurrency: string | null;
  bestSupplierId: number | null;
  bestSupplierName: string | null;
  eans: string[];
  stock: StockLine[];
  updatedAt: string | null;
  // When Autodoc enrichment was last applied to the part; null when it never was.
  enrichedAt: string | null;
};

export type PageInfo = { limit: number; offset: number; total: number };
export type Page<T> = { rows: T[]; page: PageInfo };

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
  reorderLevel?: number | null;
  isStocked?: boolean;
  // Your own exchange surcharge (ex VAT): 0 for none, null to follow the supplier's.
  surcharge?: number | null;
};

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

export type LocationLevel = {
  locationId: number;
  locationCode: string;
  locationName: string;
  minQty: number;
  maxQty: number | null;
  onHand: number;
  belowMin: boolean;
};

export type Location = {
  id: number;
  code: string;
  name: string;
  bins: { id: number; code: string; place: string; isActive: boolean; isSystem: boolean }[];
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
  if (changes.reorderLevel !== undefined) values.reorder_level = changes.reorderLevel;
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

// Every location with its bins, for stock forms. The unassigned bin comes back as its own location.
export async function listLocations(supabase: Client): Promise<Location[]> {
  const { data, error } = await supabase
    .from('bin_places')
    .select('bin_id, bin_code, location_id, location_code, location_name, place, is_active, is_system')
    .order('location_code', { ascending: true, nullsFirst: true })
    .order('bin_code', { ascending: true });
  if (error) throw dataError(error);

  const locations = new Map<number, Location>();
  for (const row of data ?? []) {
    if (row.bin_id == null || row.bin_code == null || row.place == null) continue;
    const id = row.location_id ?? 0;
    const location = locations.get(id) ?? {
      id,
      code: row.location_code ?? 'UNASSIGNED',
      name: row.location_name ?? 'Unassigned',
      bins: [],
    };
    location.bins.push({
      id: row.bin_id,
      code: row.bin_code,
      place: row.place,
      isActive: row.is_active ?? true,
      isSystem: row.is_system ?? false,
    });
    locations.set(id, location);
  }
  return [...locations.values()];
}

// Minimum and maximum stock per location for one part, with what each location holds now.
export async function listLocationLevels(supabase: Client, partId: number): Promise<LocationLevel[]> {
  const [levels, stock] = await Promise.all([
    supabase
      .from('inventory_location_levels')
      .select('location_id, min_qty, max_qty, locations(code, name)')
      .eq('part_id', partId),
    supabase.from('stock_levels').select('qty, bins(location_id)').eq('part_id', partId),
  ]);
  if (levels.error) throw dataError(levels.error);
  if (stock.error) throw dataError(stock.error);

  const onHand = new Map<number, number>();
  for (const line of stock.data ?? []) {
    const locationId = line.bins?.location_id;
    if (locationId == null) continue;
    onHand.set(locationId, (onHand.get(locationId) ?? 0) + (readNumber(line.qty) ?? 0));
  }

  return (levels.data ?? [])
    .flatMap((row) => {
      if (!row.locations) return [];
      const minQty = readNumber(row.min_qty) ?? 0;
      const held = onHand.get(row.location_id) ?? 0;
      return [
        {
          locationId: row.location_id,
          locationCode: row.locations.code,
          locationName: row.locations.name,
          minQty,
          maxQty: readNumber(row.max_qty),
          onHand: held,
          belowMin: held <= minQty,
        },
      ];
    })
    .sort((a, b) => a.locationCode.localeCompare(b.locationCode));
}

// Sets one location's minimum and maximum for a part; null for both removes the row.
export async function setLocationLevel(
  supabase: Client,
  input: { partId: number; locationId: number; minQty: number | null; maxQty: number | null },
): Promise<void> {
  if (input.minQty == null && input.maxQty == null) {
    const { error } = await supabase
      .from('inventory_location_levels')
      .delete()
      .eq('part_id', input.partId)
      .eq('location_id', input.locationId);
    if (error) throw dataError(error);
    return;
  }
  const { data, error } = await supabase
    .from('inventory_location_levels')
    .upsert(
      { part_id: input.partId, location_id: input.locationId, min_qty: input.minQty ?? 0, max_qty: input.maxQty },
      { onConflict: 'part_id,location_id' },
    )
    .select('part_id');
  if (error) throw dataError(error);
  if (!data?.length) throw new DataError('You need the editor role to change stock levels.', '42501');
}

// Adds a location. Postgres gives every new location an unbinned bin to put stock in straight away.
export async function createLocation(supabase: Client, input: { code: string; name: string }): Promise<number> {
  const { data, error } = await supabase
    .from('locations')
    .insert({ code: input.code.trim().toUpperCase(), name: input.name.trim() })
    .select('id')
    .single();
  if (error) throw dataError(error);
  return data.id;
}

// Adds a bin to a location. Returns the bin id.
export async function createBin(
  supabase: Client,
  input: { locationId: number; code: string; description?: string | null },
): Promise<number> {
  const { data, error } = await supabase
    .from('bins')
    .insert({ location_id: input.locationId, code: input.code.trim().toUpperCase(), description: input.description ?? null })
    .select('id')
    .single();
  if (error) throw dataError(error);
  return data.id;
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
    belowReorder: readBoolean(row.below_reorder) ?? false,
    bestCost: readNumber(row.best_cost),
    bestCurrency: readString(row.best_currency),
    bestSupplierId: readNumber(row.best_source_id),
    bestSupplierName: readString(row.best_source_name),
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
