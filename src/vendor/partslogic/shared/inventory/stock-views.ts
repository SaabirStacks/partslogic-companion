import type { Json } from '@partslogic/db-types';

import { readNumber, readRecord, readString } from '../core/read';
import type { FilterOption, InventoryRow, StockLine } from './items';
import type { SavedView } from './saved-views';
import {
  isStockListSort,
  stockListPageSize,
  tidyStockFilters,
  type StockListFilters,
  type StockListOptions,
  type StockListPageSize,
  type StockListSort,
} from './stock-list';

// The Stock list's views and quick filters (docs/design-checks/inventory.md, board 1): the four views everyone has,
// the views a person saves, the words each quick chip shows, and the On order column's figure.

// ---------------------------------------------------------------------------------------------- views

// The keys the views everyone has set. Picking one of those views changes only these; the other filters stay.
export const VIEW_FILTER_KEYS = ['stock', 'belowReorder', 'belowMargin'] as const;
type ViewFilterKey = (typeof VIEW_FILTER_KEYS)[number];

export type StockBuiltInView = {
  id: 'all' | 'in_stock' | 'below_reorder' | 'below_margin';
  label: string;
  set: Pick<StockListFilters, ViewFilterKey>;
  // its count, from stock_list_options' totals
  count: (totals: StockListOptions['totals']) => number;
};

export const STOCK_BUILT_IN_VIEWS: readonly StockBuiltInView[] = [
  { id: 'all', label: 'All', set: {}, count: (totals) => totals.all },
  { id: 'in_stock', label: 'In stock', set: { stock: 'in' }, count: (totals) => totals.inStock },
  { id: 'below_reorder', label: 'Below reorder', set: { belowReorder: true }, count: (totals) => totals.belowReorder },
  { id: 'below_margin', label: 'Below margin', set: { belowMargin: true }, count: (totals) => totals.belowMargin },
];

// The view everyone has that these filters are in, or null when the view keys match none of them.
export function builtInViewOf(filters: StockListFilters): StockBuiltInView | null {
  const tidy = tidyStockFilters(filters);
  return STOCK_BUILT_IN_VIEWS.find((view) => VIEW_FILTER_KEYS.every((key) => tidy[key] === view.set[key])) ?? null;
}

// The filters with a view everyone has picked: its keys replaced, the rest kept.
export function withBuiltInView(filters: StockListFilters, view: StockBuiltInView): StockListFilters {
  const rest: StockListFilters = { ...filters };
  for (const key of VIEW_FILTER_KEYS) delete rest[key];
  return tidyStockFilters({ ...rest, ...view.set });
}

// What a saved view keeps: the search, filters, sort and page size.
export type StockViewSettings = {
  search: string;
  filters: StockListFilters;
  sort: StockListSort;
  pageSize: StockListPageSize;
};

export function stockViewParams(settings: StockViewSettings): Json {
  return {
    v: 1,
    search: settings.search.trim().slice(0, 120),
    filters: tidyStockFilters(settings.filters) as Json,
    sort: settings.sort,
    page_size: settings.pageSize,
  };
}

export function readStockViewSettings(params: Json): StockViewSettings {
  const record = readRecord(params) ?? {};
  const sort = readString(record.sort) ?? 'brand';
  return {
    search: (readString(record.search) ?? '').trim().slice(0, 120),
    filters: tidyStockFilters((readRecord(record.filters) ?? {}) as StockListFilters),
    sort: isStockListSort(sort) ? sort : 'brand',
    pageSize: stockListPageSize(readNumber(record.page_size) ?? 0),
  };
}

// Two settings say the same list: the same search (ignoring case and spaces at the ends), filters, sort and size.
export function sameStockView(a: StockViewSettings, b: StockViewSettings): boolean {
  return (
    a.search.trim().toLowerCase() === b.search.trim().toLowerCase() &&
    a.sort === b.sort &&
    a.pageSize === b.pageSize &&
    JSON.stringify(sortedFilters(a.filters)) === JSON.stringify(sortedFilters(b.filters))
  );
}

function sortedFilters(filters: StockListFilters): [string, unknown][] {
  return Object.entries(tidyStockFilters(filters)).sort(([x], [y]) => x.localeCompare(y));
}

// Which saved view the list is in: the one picked, as saved or changed since; else one whose settings it matches.
export function savedViewState(
  views: readonly SavedView[],
  pickedId: number | null,
  current: StockViewSettings,
): { view: SavedView; changed: boolean } | null {
  const picked = pickedId == null ? undefined : views.find((view) => view.id === pickedId);
  if (picked) return { view: picked, changed: !sameStockView(readStockViewSettings(picked.params), current) };
  const match = views.find((view) => sameStockView(readStockViewSettings(view.params), current));
  return match ? { view: match, changed: false } : null;
}

// ---------------------------------------------------------------------------------------------- quick chips

export const STOCK_CHIP_KEYS = ['brands', 'categories', 'locations', 'suppliers'] as const;
export type StockChipKey = (typeof STOCK_CHIP_KEYS)[number];

export const STOCK_CHIP_WORDS: Record<StockChipKey, { label: string; many: string }> = {
  brands: { label: 'Brand', many: 'brands' },
  categories: { label: 'Category', many: 'categories' },
  locations: { label: 'Location', many: 'locations' },
  suppliers: { label: 'Supplier', many: 'suppliers' },
};

// What a chip says after its label: one or two names ("Bosch, MANN"), three or more as a count ("3 brands"); null
// when the chip has nothing picked.
export function chipValue(names: readonly string[], many: string): string | null {
  if (names.length === 0) return null;
  return names.length <= 2 ? names.join(', ') : `${names.length} ${many}`;
}

// The names of the ids a chip holds, from the list's options ("Uncategorised" for no category; "…" until they load).
export function chipNames(key: StockChipKey, filters: StockListFilters, options: StockListOptions | null): string[] {
  const ids = tidyStockFilters(filters)[key] ?? [];
  const names = new Map<number, string>((options?.[key] ?? []).map((option) => [option.id, option.label]));
  return ids.map((id) => names.get(id) ?? (key === 'categories' && id === -1 ? 'Uncategorised' : '…'));
}

// The Stock chip's choices: what can be sold, the reorder rule and what is on order.
export type StockChipChoice = 'in' | 'out' | 'belowReorder' | 'onOrder' | 'nothingOnOrder';

export const STOCK_CHIP_CHOICES: readonly { id: StockChipChoice; label: string }[] = [
  { id: 'in', label: 'In stock' },
  { id: 'out', label: 'Out of stock' },
  { id: 'belowReorder', label: 'Below reorder' },
  { id: 'onOrder', label: 'On order' },
  { id: 'nothingOnOrder', label: 'Nothing on order' },
];

export function stockChipChosen(filters: StockListFilters): StockChipChoice[] {
  const tidy = tidyStockFilters(filters);
  const chosen: StockChipChoice[] = [];
  if (tidy.stock === 'in') chosen.push('in');
  if (tidy.stock === 'out') chosen.push('out');
  if (tidy.belowReorder === true) chosen.push('belowReorder');
  if (tidy.onOrder === true) chosen.push('onOrder');
  if (tidy.onOrder === false) chosen.push('nothingOnOrder');
  return chosen;
}

// Ticks or unticks one of the Stock chip's choices. In and Out exclude each other, as do On order and Nothing on order.
export function toggleStockChoice(filters: StockListFilters, choice: StockChipChoice): StockListFilters {
  const next: StockListFilters = { ...tidyStockFilters(filters) };
  const on = stockChipChosen(next).includes(choice);
  if (choice === 'in' || choice === 'out') {
    if (on) delete next.stock;
    else next.stock = choice;
  } else if (choice === 'belowReorder') {
    if (on) delete next.belowReorder;
    else next.belowReorder = true;
  } else if (on) {
    delete next.onOrder;
  } else {
    next.onOrder = choice === 'onOrder';
  }
  return tidyStockFilters(next);
}

// The Stock chip's value, leaving out what the open view already says ("In stock" under the In stock view).
export function stockChipValue(filters: StockListFilters): string | null {
  const view = builtInViewOf(filters);
  const said = new Set(view ? Object.keys(view.set) : []);
  const labels = stockChipChosen(filters)
    .filter((choice) => !((choice === 'in' || choice === 'out') && said.has('stock')) && !(choice === 'belowReorder' && said.has('belowReorder')))
    .map((choice) => STOCK_CHIP_CHOICES.find((item) => item.id === choice)?.label ?? choice);
  return labels.length ? labels.join(', ') : null;
}

// ---------------------------------------------------------------------------------------------- on order

// The On order column's figure: what is due and its first date, or, when some is past its date, how many are late
// and since when (shown with ↑). Null when nothing is on order.
export function onOrderFigure(
  row: Pick<InventoryRow, 'onOrder' | 'onOrderDue' | 'onOrderLate'>,
): { qty: number; due: string | null; late: boolean } | null {
  if (row.onOrder <= 0) return null;
  return row.onOrderLate > 0
    ? { qty: row.onOrderLate, due: row.onOrderDue, late: true }
    : { qty: row.onOrder, due: row.onOrderDue, late: false };
}

// The On order figure's second line in the part beside the list and the window, the same facts as the column: "due 28
// Nov"; "↑ due 19 Nov" when all of it is late; "↑ 2 due 19 Nov" when only some is (the late quantity, the total being
// the figure above it).
export function onOrderSubline(
  row: Pick<InventoryRow, 'onOrder' | 'onOrderDue' | 'onOrderLate'>,
  day: (value: string) => string,
): string | null {
  const figure = onOrderFigure(row);
  if (!figure?.due) return null;
  if (!figure.late) return `due ${day(figure.due)}`;
  return figure.qty >= row.onOrder ? `↑ due ${day(figure.due)}` : `↑ ${figure.qty} due ${day(figure.due)}`;
}

// ---------------------------------------------------------------------------------------------- added dates

// Quick picks for "Added to the Stock list" in the Filters panel: each sets the first day and leaves the last open, so
// "Last 30 days" is today and the 29 days before it. Dates are the list's own YYYY-MM-DD days.
export type AddedQuickPick = { id: '7' | '30' | '90' | 'year'; label: string };

export const ADDED_QUICK_PICKS: readonly AddedQuickPick[] = [
  { id: '7', label: 'Last 7 days' },
  { id: '30', label: 'Last 30 days' },
  { id: '90', label: 'Last 90 days' },
  { id: 'year', label: 'This year' },
];

export function addedQuickPickFrom(pick: AddedQuickPick['id'], today: string): string {
  if (pick === 'year') return `${today.slice(0, 4)}-01-01`;
  const day = new Date(`${today}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - Number(pick) + 1);
  return day.toISOString().slice(0, 10);
}

// The quick pick these filters are, if any: its first day and no last day.
export function addedQuickPickOf(
  filters: Pick<StockListFilters, 'addedFrom' | 'addedTo'>,
  today: string,
): AddedQuickPick['id'] | null {
  if (!filters.addedFrom || filters.addedTo) return null;
  return ADDED_QUICK_PICKS.find((pick) => addedQuickPickFrom(pick.id, today) === filters.addedFrom)?.id ?? null;
}

// ---------------------------------------------------------------------------------------------- figure colours

// The colour each stock figure takes where it stands alone (the part beside the list, the part window), by the status
// families (DESIGN.md): Available is stock in hand (ready), or waiting when below the reorder level, or blocked when
// nothing can be sold; On order is waiting while anything is due; Set aside blocks when more is held than is here.
// The list's own cells keep plain figures with a badge only for what needs attention.
export type FigureTone = 'ready' | 'waiting' | 'blocked' | 'neutral';

export function stockFigureTones(
  row: Pick<InventoryRow, 'isStocked' | 'onHand' | 'setAside' | 'belowReorder' | 'onOrder'>,
): { available: FigureTone; onOrder: FigureTone; setAside: FigureTone } {
  const available = Math.max(row.onHand - row.setAside, 0);
  const word = row.isStocked && available <= 0 ? 'Out' : row.belowReorder ? 'Reorder' : null;
  return {
    available: word === 'Out' ? 'blocked' : word === 'Reorder' ? 'waiting' : available > 0 ? 'ready' : 'neutral',
    onOrder: row.onOrder > 0 ? 'waiting' : 'neutral',
    setAside: row.setAside > Math.max(row.onHand, 0) ? 'blocked' : 'neutral',
  };
}

// ---------------------------------------------------------------------------------------------- bins

// A bin as people say it: its code, "Unbinned" for stock not yet put away, "Collection" for stock waiting at the
// counter (the system's UNBINNED and COLLECTION bins).
export function binWord(line: Pick<StockLine, 'system' | 'code' | 'place'>): string {
  if (line.system && line.code === 'UNBINNED') return 'Unbinned';
  if (line.system && line.code === 'COLLECTION') return 'Collection';
  return line.code ?? line.place;
}

// The main location: the one with the most parts in stock (the lowest id on a tie). Null with one location or none,
// when a bin never needs its location named.
export function mainLocationId(locations: readonly Pick<FilterOption, 'id' | 'count'>[]): number | null {
  if (locations.length < 2) return null;
  return [...locations].sort((a, b) => b.count - a.count || a.id - b.id)[0]?.id ?? null;
}

// The bin a row shows (real bins before the system's, then the one with most units), how many other bins hold the
// part, and its location's code only when that says something: the part is at more than one location, or away from
// the main one ("A-01 · BRADFORD", the bin first so a cut label keeps it). Codes repeat between locations, so a bare
// code there would mislead.
export function firstBin(lines: readonly StockLine[], mainLocation: number | null): { label: string; more: number } | null {
  const held = lines.filter((line) => line.qty > 0);
  const ordered = [...held].sort((a, b) => Number(a.system ?? false) - Number(b.system ?? false) || b.qty - a.qty);
  const first = ordered[0];
  if (!first) return null;
  const bin = binWord(first);
  const where = first.place.includes('/') ? first.place.slice(0, first.place.indexOf('/')) : null;
  const locations = new Set(held.map((line) => line.locationId ?? line.place.split('/')[0]));
  const away = first.locationId != null && first.locationId !== mainLocation;
  const named = mainLocation != null && where != null && (locations.size > 1 || away);
  return { label: named ? `${bin} · ${where}` : bin, more: ordered.length - 1 };
}
