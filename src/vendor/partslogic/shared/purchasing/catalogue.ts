import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { dataError } from '../core/errors';
import type { Page } from '../core/page';
import { readArray, readBoolean, readNumber, readRecord, readString } from '../core/read';
import type { PartKind } from '../inventory/items';
import { isSupplierStatus, type SupplierStatus } from './suppliers';

// The supplier catalogue: every supplier's current price lines and your range in one search, with each part's
// price from each supplier and its cheaper equivalents from other brands. Every rule lives in SQL
// (public.supplier_catalogue, public.part_price_comparison); this file reads what they return.

// One supplier's current price for a part. usable: the supplier isn't archived and the price is in the
// workspace currency, so it can be ordered and compared; only a usable offer can be the best.
export type SupplierOffer = {
  supplierId: number;
  supplier: string;
  status: SupplierStatus;
  code: string | null;
  cost: number;
  currency: string;
  // Sold in multiples of this (a box of 10 is ordered 10, 20, 30); 1 when the sheet doesn't say.
  packQty: number;
  // The rest of what the sheet says about ordering, each null when it adds nothing: the fewest that can be
  // ordered, the fewest from the supplier's central warehouse, units in their box (information only), and the
  // unit of issue when it isn't each (PR, SET, KIT).
  minQty: number | null;
  centralMinQty: number | null;
  boxQty: number | null;
  unit: string | null;
  // Units on placed orders with this supplier.
  onOrder: number;
  listPrice: number | null;
  surcharge: number | null;
  since: string | null;
  usable: boolean;
};

// How a search found the row: the search's own match kinds, 'oe' for a part made to an OE number that was
// searched, and 'listed' for a supplier's line shown without a search.
export type CatalogueMatch =
  | 'barcode'
  | 'exact'
  | 'supplier_code'
  | 'starts_with'
  | 'similar'
  | 'description'
  | 'oe'
  | 'listed';

// A cheaper equivalent from another brand (same OE number, a cross-reference or a supersession).
export type CheaperEquivalent = {
  partId: number;
  brand: string;
  number: string;
  // Shown beside the suggestion: one OE number can be shared by different products, so a person checks.
  description: string | null;
  relation: string;
  cost: number;
  supplierId: number | null;
  supplier: string | null;
};

// The figures a catalogue row and a comparison row share.
export type CatalogueFacts = {
  offers: SupplierOffer[];
  bestCost: number | null;
  bestSupplierId: number | null;
  inRange: boolean;
  isStocked: boolean;
  onHand: number;
  sellPrice: number | null;
  margin: number | null;
};

export type CatalogueRow = CatalogueFacts & {
  partId: number;
  brandId: number;
  brand: string;
  number: string;
  kind: PartKind;
  description: string | null;
  category: string | null;
  match: CatalogueMatch;
  // For an 'oe' match: the OE number it is made to ("VW 1K0615301AA").
  via: string | null;
  // How many equivalents from other brands a supplier prices.
  equivalents: number;
  cheaper: CheaperEquivalent | null;
};

export type CatalogueQuery = {
  search?: string | null;
  supplierId?: number | null;
  brandId?: number | null;
  inRange?: boolean | null;
  limit?: number;
  offset?: number;
};

// One row of a part's price comparison: the part itself ('this') or one of its alternatives.
export type ComparisonRow = CatalogueFacts & {
  partId: number;
  brand: string;
  number: string;
  kind: PartKind;
  description: string | null;
  relation: string;
  via: string | null;
  confidence: number;
  cheapest: boolean;
};

const MATCHES = new Set<string>(['barcode', 'exact', 'supplier_code', 'starts_with', 'similar', 'description', 'oe', 'listed']);

export function readOffers(value: Json | undefined): SupplierOffer[] {
  return readArray(value).flatMap((item): SupplierOffer[] => {
    const offer = readRecord(item);
    const supplierId = readNumber(offer?.source_id);
    const supplier = readString(offer?.supplier);
    const cost = readNumber(offer?.cost);
    if (!offer || supplierId == null || !supplier || cost == null) return [];
    const status = readString(offer.status);
    return [
      {
        supplierId,
        supplier,
        status: isSupplierStatus(status) ? status : 'active',
        code: readString(offer.code),
        cost,
        currency: readString(offer.currency) ?? 'GBP',
        packQty: Math.max(readNumber(offer.pack_qty) ?? 1, 1),
        minQty: readNumber(offer.min_qty),
        centralMinQty: readNumber(offer.central_min_qty),
        boxQty: readNumber(offer.box_qty),
        unit: readString(offer.unit),
        onOrder: readNumber(offer.on_order) ?? 0,
        listPrice: readNumber(offer.list_price),
        surcharge: readNumber(offer.surcharge),
        since: readString(offer.since),
        usable: readBoolean(offer.usable) ?? false,
      },
    ];
  });
}

function readCheaper(value: Json | undefined): CheaperEquivalent | null {
  const row = readRecord(value);
  const partId = readNumber(row?.part_id);
  const cost = readNumber(row?.cost);
  const brand = readString(row?.brand);
  const number = readString(row?.number);
  if (!row || partId == null || cost == null || !brand || !number) return null;
  return {
    partId,
    brand,
    number,
    description: readString(row.description),
    relation: readString(row.relation) ?? 'same_oe',
    cost,
    supplierId: readNumber(row.source_id),
    supplier: readString(row.supplier),
  };
}

type FactsRow = {
  offers?: Json;
  best_cost?: number | null;
  best_source_id?: number | null;
  in_range?: boolean | null;
  is_stocked?: boolean | null;
  on_hand?: number | null;
  sell_price?: number | null;
  margin?: number | null;
};

function readFacts(row: FactsRow): CatalogueFacts {
  return {
    offers: readOffers(row.offers),
    bestCost: readNumber(row.best_cost),
    bestSupplierId: readNumber(row.best_source_id),
    inRange: row.in_range ?? false,
    isStocked: row.is_stocked ?? false,
    onHand: readNumber(row.on_hand) ?? 0,
    sellPrice: readNumber(row.sell_price),
    margin: readNumber(row.margin),
  };
}

type CatalogueRpcRow = FactsRow & {
  part_id?: number | null;
  brand_id?: number | null;
  brand?: string | null;
  number?: string | null;
  kind?: string | null;
  description?: string | null;
  category?: string | null;
  match_type?: string | null;
  via?: string | null;
  equivalents?: number | null;
  cheaper?: Json;
  total_count?: number | null;
};

export function readCatalogueRow(row: CatalogueRpcRow): CatalogueRow | null {
  const partId = readNumber(row.part_id);
  const brandId = readNumber(row.brand_id);
  if (partId == null || brandId == null || !row.brand || !row.number) return null;
  return {
    ...readFacts(row),
    partId,
    brandId,
    brand: row.brand,
    number: row.number,
    kind: (row.kind ?? 'aftermarket') as PartKind,
    description: row.description ?? null,
    category: row.category ?? null,
    match: MATCHES.has(row.match_type ?? '') ? (row.match_type as CatalogueMatch) : 'description',
    via: row.via ?? null,
    equivalents: readNumber(row.equivalents) ?? 0,
    cheaper: readCheaper(row.cheaper),
  };
}

type ComparisonRpcRow = FactsRow & {
  part_id?: number | null;
  brand?: string | null;
  number?: string | null;
  kind?: string | null;
  description?: string | null;
  relation?: string | null;
  via?: string | null;
  confidence?: number | null;
  cheapest?: boolean | null;
};

export function readComparisonRow(row: ComparisonRpcRow): ComparisonRow | null {
  const partId = readNumber(row.part_id);
  if (partId == null || !row.brand || !row.number) return null;
  return {
    ...readFacts(row),
    partId,
    brand: row.brand,
    number: row.number,
    kind: (row.kind ?? 'aftermarket') as PartKind,
    description: row.description ?? null,
    relation: row.relation ?? 'this',
    via: row.via ?? null,
    confidence: readNumber(row.confidence) ?? 0,
    cheapest: row.cheapest ?? false,
  };
}

export const CATALOGUE_PAGE_SIZES = [25, 50, 100] as const;

// The supplier catalogue: a search over every supplier's lines and your range, or one supplier's lines. Nothing
// is listed until there is a search or a supplier.
export async function searchSupplierCatalogue(supabase: Client, query: CatalogueQuery): Promise<Page<CatalogueRow>> {
  const limit = query.limit ?? 25;
  const offset = query.offset ?? 0;
  const search = query.search?.trim() || undefined;
  if (!search && query.supplierId == null) return { rows: [], page: { limit, offset, total: 0 } };
  const { data, error } = await supabase.rpc('supplier_catalogue', {
    p_search: search,
    p_source: query.supplierId ?? undefined,
    p_brand: query.brandId ?? undefined,
    p_in_range: query.inRange ?? undefined,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw dataError(error);
  const rows = (data ?? []).flatMap((row) => readCatalogueRow(row) ?? []);
  return { rows, page: { limit, offset, total: readNumber(data?.[0]?.total_count) ?? 0 } };
}

// A part beside the parts that can replace it, each with every supplier's price, cheapest first.
export async function getPriceComparison(supabase: Client, partId: number): Promise<ComparisonRow[]> {
  const { data, error } = await supabase.rpc('part_price_comparison', { p_part: partId });
  if (error) throw dataError(error);
  return (data ?? []).flatMap((row) => readComparisonRow(row) ?? []);
}

// The best usable offer, or null. Offers arrive cheapest usable first.
export function bestOffer(offers: SupplierOffer[]): SupplierOffer | null {
  return offers.find((offer) => offer.usable) ?? null;
}

// How much cheaper an equivalent is than the row's best cost, as a fraction (0.15 = 15% cheaper).
export function savingRatio(bestCost: number | null, cheaperCost: number): number | null {
  if (bestCost == null || bestCost <= 0) return null;
  return Math.max(0, (bestCost - cheaperCost) / bestCost);
}
