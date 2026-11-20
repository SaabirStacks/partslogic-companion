import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { dataError } from '../core/errors';
import type { Page } from '../core/page';
import { readArray, readNumber, readRecord, readString, readStrings } from '../core/read';
import { readInventoryRow, type FilterOption, type InventoryRow, type PartKind } from './items';

// The Stock list, fast (docs/TABLES_AND_PERFORMANCE.md): a page for a set of filters, and what the filters offer.
// The database does the filtering, sorting and counting (20261113230000: stock_list, stock_list_options); this
// file is the filter model the screen, the page address and the badges share.

export const STOCK_LIST_PAGE_SIZES = [25, 50, 100, 200] as const;
export type StockListPageSize = (typeof STOCK_LIST_PAGE_SIZES)[number];

// A leading "-" means highest (or newest) first.
export const STOCK_LIST_SORTS = ['brand', 'number', 'sku', 'on_hand', '-on_hand', 'best_cost', '-best_cost', '-added'] as const;
export type StockListSort = (typeof STOCK_LIST_SORTS)[number];

const PART_KIND_VALUES = ['aftermarket', 'oe', 'oe_placeholder'] as const satisfies readonly PartKind[];
export const PART_KIND_LABELS: Record<PartKind, string> = {
  aftermarket: 'Aftermarket',
  oe: 'OE',
  oe_placeholder: 'OE number only',
};

// Every filter is optional; a missing one doesn't narrow the list. A yes/no filter is true, false or missing.
export type StockListFilters = {
  brands?: number[];
  // -1 (UNCATEGORISED) is "no category".
  categories?: number[];
  kinds?: PartKind[];
  inRange?: boolean;
  stock?: 'in' | 'out';
  onHandMin?: number;
  onHandMax?: number;
  locations?: number[];
  bins?: number[];
  belowReorder?: boolean;
  costMin?: number;
  costMax?: number;
  belowMargin?: boolean;
  suppliers?: number[];
  noSupplierPrice?: boolean;
  // No longer listed by a supplier that used to list it.
  delisted?: boolean;
  hasBarcode?: boolean;
  enriched?: boolean;
  // Dates as YYYY-MM-DD.
  addedFrom?: string;
  addedTo?: string;
};

export type StockListQuery = {
  search?: string | null;
  filters?: StockListFilters;
  sort?: StockListSort;
  limit: number;
  offset: number;
};

export type StockBrandOption = FilterOption & { aliases: string[] };
export type BinOption = FilterOption & { locationId: number | null };
export type StockListOptions = {
  totals: { all: number; inRange: number; inStock: number; outOfStock: number };
  brands: StockBrandOption[];
  categories: FilterOption[];
  kinds: { id: PartKind; count: number }[];
  locations: FilterOption[];
  bins: BinOption[];
  suppliers: FilterOption[];
};

export function stockListPageSize(value: number): StockListPageSize {
  return STOCK_LIST_PAGE_SIZES.find((size) => size === value) ?? STOCK_LIST_PAGE_SIZES[0];
}

export function isStockListSort(value: string): value is StockListSort {
  return (STOCK_LIST_SORTS as readonly string[]).includes(value);
}

const ID_LISTS = ['brands', 'categories', 'locations', 'bins', 'suppliers'] as const;
const FLAGS = ['inRange', 'belowReorder', 'belowMargin', 'noSupplierPrice', 'delisted', 'hasBarcode', 'enriched'] as const;
const NUMBERS = ['onHandMin', 'onHandMax', 'costMin', 'costMax'] as const;
const DATES = ['addedFrom', 'addedTo'] as const;
type IdList = (typeof ID_LISTS)[number];
type Flag = (typeof FLAGS)[number];
type NumberKey = (typeof NUMBERS)[number];
type DateKey = (typeof DATES)[number];

const snake = (key: string) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
const isDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

// The same filters with everything empty or malformed dropped, so two ways of saying "no filter" compare equal.
export function tidyStockFilters(filters: StockListFilters): StockListFilters {
  const tidy: StockListFilters = {};
  for (const key of ID_LISTS) {
    const ids = [...new Set((filters[key] ?? []).filter((id) => Number.isSafeInteger(id)))].sort((a, b) => a - b);
    if (ids.length > 0) tidy[key] = ids;
  }
  const kinds = PART_KIND_VALUES.filter((kind) => filters.kinds?.includes(kind));
  if (kinds.length > 0) tidy.kinds = kinds;
  for (const key of FLAGS) if (typeof filters[key] === 'boolean') tidy[key] = filters[key];
  // "not delisted" isn't a filter the list offers
  if (tidy.delisted === false) delete tidy.delisted;
  if (filters.stock === 'in' || filters.stock === 'out') tidy.stock = filters.stock;
  for (const key of NUMBERS) {
    const value = filters[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) tidy[key] = value;
  }
  for (const key of DATES) if (isDate(filters[key])) tidy[key] = filters[key];
  return tidy;
}

// How many filters are on (a list of three brands is one filter).
export function countStockFilters(filters: StockListFilters): number {
  return Object.keys(tidyStockFilters(filters)).length;
}

// What stock_list takes: its p object.
export function stockListParams(query: StockListQuery): { [key: string]: Json } {
  const params: { [key: string]: Json } = {
    limit: stockListPageSize(query.limit),
    offset: Math.max(0, Math.floor(query.offset)),
    sort: query.sort ?? 'brand',
  };
  const search = query.search?.trim();
  if (search) params.search = search.slice(0, 120);
  for (const [key, value] of Object.entries(tidyStockFilters(query.filters ?? {}))) params[snake(key)] = value as Json;
  return params;
}

// Filters in a page address, short enough to read and share: ?brands=4,9&stock=in&cost=10-25&barcode=no
const FLAG_PARAMS: Record<Flag, string> = {
  inRange: 'range',
  belowReorder: 'reorder',
  belowMargin: 'margin',
  noSupplierPrice: 'unpriced',
  delisted: 'delisted',
  hasBarcode: 'barcode',
  enriched: 'online',
};
const RANGE_PARAMS = { onHand: ['onHandMin', 'onHandMax'], cost: ['costMin', 'costMax'] } as const satisfies Record<
  string,
  readonly [NumberKey, NumberKey]
>;

export function stockFiltersToParams(filters: StockListFilters): Record<string, string> {
  const tidy = tidyStockFilters(filters);
  const params: Record<string, string> = {};
  for (const key of ID_LISTS) if (tidy[key]) params[key] = tidy[key].join(',');
  if (tidy.kinds) params.kinds = tidy.kinds.join(',');
  for (const key of FLAGS) if (tidy[key] !== undefined) params[FLAG_PARAMS[key]] = tidy[key] ? 'yes' : 'no';
  if (tidy.stock) params.stock = tidy.stock;
  for (const [name, [min, max]] of Object.entries(RANGE_PARAMS)) {
    if (tidy[min] !== undefined || tidy[max] !== undefined) params[name] = `${tidy[min] ?? ''}-${tidy[max] ?? ''}`;
  }
  if (tidy.addedFrom || tidy.addedTo) params.added = `${tidy.addedFrom ?? ''}_${tidy.addedTo ?? ''}`;
  return params;
}

type ParamSource = { get(name: string): string | null } | Record<string, string | string[] | undefined>;

function paramReader(source: ParamSource): (name: string) => string | null {
  if (typeof (source as { get?: unknown }).get === 'function') return (name) => (source as { get(n: string): string | null }).get(name);
  return (name) => {
    const value = (source as Record<string, string | string[] | undefined>)[name];
    return typeof value === 'string' ? value : null;
  };
}

export function stockFiltersFromParams(source: ParamSource): StockListFilters {
  const get = paramReader(source);
  const filters: StockListFilters = {};
  const ids = (value: string | null) =>
    (value ?? '').split(',').filter((part) => /^-?\d{1,15}$/.test(part)).map(Number);
  for (const key of ID_LISTS) filters[key] = ids(get(key));
  filters.kinds = (get('kinds') ?? '').split(',').filter((kind): kind is PartKind => (PART_KIND_VALUES as readonly string[]).includes(kind));
  for (const key of FLAGS) {
    const value = get(FLAG_PARAMS[key]);
    if (value === 'yes' || value === 'no') filters[key] = value === 'yes';
  }
  const stock = get('stock');
  if (stock === 'in' || stock === 'out') filters.stock = stock;
  for (const [name, [min, max]] of Object.entries(RANGE_PARAMS)) {
    const match = /^(\d+(?:\.\d+)?)?-(\d+(?:\.\d+)?)?$/.exec(get(name) ?? '');
    if (match?.[1]) filters[min] = Number(match[1]);
    if (match?.[2]) filters[max] = Number(match[2]);
  }
  const [from, to] = (get('added') ?? '').split('_');
  if (isDate(from)) filters.addedFrom = from;
  if (isDate(to)) filters.addedTo = to;
  return tidyStockFilters(filters);
}

// One badge per active filter, each able to take itself off. A list of up to three values gets a badge per value;
// a longer one gets a single badge ("5 brands").
export type StockFilterBadge = {
  key: string;
  // Which group of the filter panel it belongs to, so the panel can open there.
  group: 'part' | 'stock' | 'cost' | 'dates';
  label: string;
  without: StockListFilters;
};

export type StockFilterWords = { money: (value: number) => string; qty: (value: number) => string; date: (value: string) => string };

const LIST_WORDS: Record<IdList, { one: string; many: string; group: StockFilterBadge['group'] }> = {
  brands: { one: 'Brand', many: 'brands', group: 'part' },
  categories: { one: 'Category', many: 'categories', group: 'part' },
  locations: { one: 'Location', many: 'locations', group: 'stock' },
  bins: { one: 'Bin', many: 'bins', group: 'stock' },
  suppliers: { one: 'Supplier', many: 'suppliers', group: 'cost' },
};
const FLAG_WORDS: Record<Flag, { yes: string; no: string; group: StockFilterBadge['group'] }> = {
  inRange: { yes: 'In range', no: 'Not in range', group: 'part' },
  hasBarcode: { yes: 'Has a barcode', no: 'No barcode', group: 'part' },
  enriched: { yes: 'Looked up online', no: 'Not looked up online', group: 'part' },
  belowReorder: { yes: 'Below reorder level', no: 'Not below reorder level', group: 'stock' },
  belowMargin: { yes: 'Below margin', no: 'Not below margin', group: 'cost' },
  noSupplierPrice: { yes: 'No supplier price', no: 'Has a supplier price', group: 'cost' },
  delisted: { yes: 'No longer listed', no: 'No longer listed', group: 'cost' },
};

function rangeLabel(name: string, min: string | undefined, max: string | undefined): string {
  if (min !== undefined && max !== undefined) return min === max ? `${name} ${min}` : `${name} ${min} to ${max}`;
  return min !== undefined ? `${name} ${min} or more` : `${name} up to ${max}`;
}

export function stockFilterBadges(
  filters: StockListFilters,
  options: StockListOptions | null,
  words: StockFilterWords,
): StockFilterBadge[] {
  const tidy = tidyStockFilters(filters);
  const badges: StockFilterBadge[] = [];
  const drop = (...keys: (keyof StockListFilters)[]) => {
    const next = { ...tidy };
    for (const key of keys) delete next[key];
    return next;
  };

  for (const key of ID_LISTS) {
    const ids = tidy[key];
    if (!ids) continue;
    const word = LIST_WORDS[key];
    if (ids.length > 3) {
      badges.push({ key, group: word.group, label: `${ids.length} ${word.many}`, without: drop(key) });
      continue;
    }
    const names = new Map<number, string>((options?.[key] ?? []).map((option) => [option.id, option.label]));
    for (const id of ids) {
      const rest = ids.filter((other) => other !== id);
      badges.push({
        key: `${key}:${id}`,
        group: word.group,
        label: `${word.one}: ${names.get(id) ?? (key === 'categories' && id === -1 ? 'Uncategorised' : `#${id}`)}`,
        without: rest.length > 0 ? { ...tidy, [key]: rest } : drop(key),
      });
    }
  }
  for (const kind of tidy.kinds ?? []) {
    const rest = (tidy.kinds ?? []).filter((other) => other !== kind);
    badges.push({
      key: `kinds:${kind}`,
      group: 'part',
      label: `Kind: ${PART_KIND_LABELS[kind]}`,
      without: rest.length > 0 ? { ...tidy, kinds: rest } : drop('kinds'),
    });
  }
  for (const key of FLAGS) {
    const value = tidy[key];
    if (value === undefined) continue;
    badges.push({ key, group: FLAG_WORDS[key].group, label: value ? FLAG_WORDS[key].yes : FLAG_WORDS[key].no, without: drop(key) });
  }
  if (tidy.stock) {
    badges.push({ key: 'stock', group: 'stock', label: tidy.stock === 'in' ? 'In stock' : 'Out of stock', without: drop('stock') });
  }
  if (tidy.onHandMin !== undefined || tidy.onHandMax !== undefined) {
    badges.push({
      key: 'onHand',
      group: 'stock',
      label: rangeLabel(
        'On hand',
        tidy.onHandMin === undefined ? undefined : words.qty(tidy.onHandMin),
        tidy.onHandMax === undefined ? undefined : words.qty(tidy.onHandMax),
      ),
      without: drop('onHandMin', 'onHandMax'),
    });
  }
  if (tidy.costMin !== undefined || tidy.costMax !== undefined) {
    badges.push({
      key: 'cost',
      group: 'cost',
      label: rangeLabel(
        'Cost',
        tidy.costMin === undefined ? undefined : words.money(tidy.costMin),
        tidy.costMax === undefined ? undefined : words.money(tidy.costMax),
      ),
      without: drop('costMin', 'costMax'),
    });
  }
  if (tidy.addedFrom || tidy.addedTo) {
    const from = tidy.addedFrom ? words.date(tidy.addedFrom) : null;
    const to = tidy.addedTo ? words.date(tidy.addedTo) : null;
    badges.push({
      key: 'added',
      group: 'dates',
      label: from && to ? (from === to ? `Added ${from}` : `Added ${from} to ${to}`) : from ? `Added from ${from}` : `Added up to ${to}`,
      without: drop('addedFrom', 'addedTo'),
    });
  }
  return badges;
}

function readOption(value: Json): FilterOption | null {
  const option = readRecord(value);
  const id = readNumber(option?.id);
  const label = readString(option?.label);
  return id == null || !label ? null : { id, label, count: readNumber(option?.count) ?? 0 };
}

function readOptionList(value: Json | undefined): FilterOption[] {
  return readArray(value).flatMap((item) => {
    const option = readOption(item);
    return option ? [option] : [];
  });
}

// One page of the Stock list, with what a search for a number found beyond its direct matches.
export type StockListPage = Page<InventoryRow> & {
  alternatives: {
    // Rows in the list (all pages) that are alternatives to what was searched.
    listed: number;
    // Alternatives suppliers list that are not on the stock list.
    elsewhere: number;
  };
};

export function readStockList(data: Json): StockListPage {
  const record = readRecord(data) ?? {};
  const alternatives = readRecord(record.alternatives);
  return {
    alternatives: { listed: readNumber(alternatives?.listed) ?? 0, elsewhere: readNumber(alternatives?.elsewhere) ?? 0 },
    rows: readArray(record.rows).flatMap((item) => {
      const row = readInventoryRow(readRecord(item));
      return row ? [row] : [];
    }),
    page: {
      limit: readNumber(record.limit) ?? STOCK_LIST_PAGE_SIZES[0],
      offset: readNumber(record.offset) ?? 0,
      total: readNumber(record.total) ?? 0,
    },
  };
}

export function readStockListOptions(data: Json): StockListOptions {
  const record = readRecord(data) ?? {};
  const totals = readRecord(record.totals) ?? {};
  const count = (value: Json | undefined) => readNumber(value) ?? 0;
  return {
    totals: {
      all: count(totals.all),
      inRange: count(totals.in_range),
      inStock: count(totals.in_stock),
      outOfStock: count(totals.out_of_stock),
    },
    brands: readArray(record.brands).flatMap((item) => {
      const option = readOption(item);
      return option ? [{ ...option, aliases: readStrings(readRecord(item)?.aliases) }] : [];
    }),
    categories: readOptionList(record.categories),
    kinds: readArray(record.kinds).flatMap((item) => {
      const kind = readRecord(item);
      const id = PART_KIND_VALUES.find((value) => value === kind?.id);
      return id ? [{ id, count: count(kind?.count) }] : [];
    }),
    locations: readOptionList(record.locations),
    bins: readArray(record.bins).flatMap((item) => {
      const option = readOption(item);
      return option ? [{ ...option, locationId: readNumber(readRecord(item)?.location_id) }] : [];
    }),
    suppliers: readOptionList(record.suppliers),
  };
}

// One page of the Stock list. The database filters, sorts and counts every match.
export async function listStock(supabase: Client, query: StockListQuery): Promise<StockListPage> {
  return call(supabase.rpc('stock_list', { p: stockListParams(query) }), readStockList);
}

// Records a search that found nothing, for the report of what people look for and do not find.
export async function logEmptySearch(supabase: Client, search: string): Promise<void> {
  const { error } = await supabase.rpc('log_search', { p_query: search, p_results: 0 });
  if (error) throw dataError(error);
}

export async function getStockListOptions(supabase: Client): Promise<StockListOptions> {
  return call(supabase.rpc('stock_list_options'), readStockListOptions);
}
