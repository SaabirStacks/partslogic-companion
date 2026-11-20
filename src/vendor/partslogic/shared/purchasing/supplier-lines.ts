import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readBoolean, readArray, readNumber, readRecord, readString } from '../core/read';
import { readPriceBreaks, readScheduledPrice, type PriceBreak, type ScheduledPrice } from './price-terms';

// A supplier's catalogue on their page (step 11): their current lines with the price each replaced, filters, search,
// sorting and paging, and preferred supplier for many lines at once. Rules in SQL (20261113090000: supplier_lines,
// set_preferred_supplier_lines), and the lines no longer listed (step 3c, 20261113150000: the delisted view).

export const SUPPLIER_LINE_VIEWS = ['all', 'in_range', 'up', 'down', 'cheaper', 'delisted'] as const;
export type SupplierLineView = (typeof SUPPLIER_LINE_VIEWS)[number];
export const SUPPLIER_LINE_SORTS = ['part', 'cost', 'change'] as const;
export type SupplierLineSort = (typeof SUPPLIER_LINE_SORTS)[number];

export function isSupplierLineView(value: unknown): value is SupplierLineView {
  return typeof value === 'string' && (SUPPLIER_LINE_VIEWS as readonly string[]).includes(value);
}
export function isSupplierLineSort(value: unknown): value is SupplierLineSort {
  return typeof value === 'string' && (SUPPLIER_LINE_SORTS as readonly string[]).includes(value);
}

export type SupplierLine = {
  partId: number;
  brandId: number | null;
  brand: string;
  number: string;
  description: string | null;
  category: string | null;
  code: string | null;
  cost: number;
  // The price it replaced, the change from it (a ratio) and when the current price started.
  was: number | null;
  change: number | null;
  since: string | null;
  listPrice: number | null;
  surcharge: number | null;
  // The multiple it's sold in (1 when the sheet gives none), as the Supplier catalogue reads it.
  packQty: number;
  minQty: number | null;
  centralMinQty: number | null;
  boxQty: number | null;
  unit: string | null;
  inRange: boolean;
  isStocked: boolean;
  onHand: number;
  onOrder: number;
  sell: number | null;
  // At this supplier's cost.
  margin: number | null;
  preferred: boolean;
  // Another supplier's lower price for the same part; for a line no longer listed, the cheapest other supplier.
  cheaper: { supplierId: number; supplier: string; cost: number } | null;
  // False for a line no longer listed (the delisted view): cost is its last price, delistedAt when it stopped.
  listed: boolean;
  delistedAt: string | null;
  // Sheet options: quantity breaks, the "while stocks last" mark, and a price waiting to start on a later day.
  breaks: PriceBreak[];
  ending: boolean;
  scheduled: ScheduledPrice | null;
};

export type SupplierLines = {
  rows: SupplierLine[];
  total: number;
  counts: Record<SupplierLineView, number>;
  currency: string;
};

export type SupplierLineQuery = {
  search?: string | null;
  view?: SupplierLineView;
  brandId?: number | null;
  sort?: SupplierLineSort;
  desc?: boolean;
  limit?: number;
  offset?: number;
};

const num = (value: Json | undefined) => readNumber(value) ?? 0;

export function readSupplierLines(data: Json): SupplierLines {
  const record = readRecord(data) ?? {};
  const counts = readRecord(record.counts) ?? {};
  return {
    currency: readString(record.currency) ?? 'GBP',
    total: num(record.total),
    counts: {
      all: num(counts.all),
      in_range: num(counts.in_range),
      up: num(counts.up),
      down: num(counts.down),
      cheaper: num(counts.cheaper),
      delisted: num(counts.delisted),
    },
    rows: readArray(record.rows).flatMap((item) => {
      const row = readRecord(item);
      const partId = readNumber(row?.part_id);
      const number = readString(row?.number);
      const cost = readNumber(row?.cost);
      if (!row || partId == null || !number || cost == null) return [];
      const cheaper = readRecord(row.cheaper);
      const cheaperId = readNumber(cheaper?.source_id);
      const cheaperCost = readNumber(cheaper?.cost);
      return [
        {
          partId,
          brandId: readNumber(row.brand_id),
          brand: readString(row.brand) ?? '',
          number,
          description: readString(row.description),
          category: readString(row.category),
          code: readString(row.code),
          cost,
          was: readNumber(row.was),
          change: readNumber(row.change),
          since: readString(row.since),
          listPrice: readNumber(row.list_price),
          surcharge: readNumber(row.surcharge),
          packQty: Math.max(readNumber(row.pack_qty) ?? 1, 1),
          minQty: readNumber(row.min_qty),
          centralMinQty: readNumber(row.central_min_qty),
          boxQty: readNumber(row.box_qty),
          unit: readString(row.unit),
          inRange: readBoolean(row.in_range) ?? false,
          isStocked: readBoolean(row.is_stocked) ?? false,
          onHand: num(row.on_hand),
          onOrder: num(row.on_order),
          sell: readNumber(row.sell),
          margin: readNumber(row.margin),
          preferred: readBoolean(row.preferred) ?? false,
          cheaper:
            cheaperId != null && cheaperCost != null
              ? { supplierId: cheaperId, supplier: readString(cheaper?.supplier) ?? 'Another supplier', cost: cheaperCost }
              : null,
          listed: readBoolean(row.listed) ?? true,
          delistedAt: readString(row.delisted_at),
          breaks: readPriceBreaks(row.breaks),
          ending: readBoolean(row.ending) ?? false,
          scheduled: readScheduledPrice(row.scheduled),
        },
      ];
    }),
  };
}

export async function getSupplierLines(
  supabase: Client,
  supplierId: number,
  query: SupplierLineQuery = {},
): Promise<SupplierLines | null> {
  return call(
    supabase.rpc('supplier_lines', {
      p_source: supplierId,
      p: {
        search: query.search ?? null,
        view: query.view ?? 'all',
        brand_id: query.brandId ?? null,
        sort: query.sort ?? 'part',
        desc: query.desc ?? false,
        limit: query.limit ?? 50,
        offset: query.offset ?? 0,
      },
    }),
    (data) => (data == null ? null : readSupplierLines(data)),
  );
}

// Editors: make this supplier the preferred one for these parts (at most 500); parts not in your range are skipped.
export async function setPreferredSupplierLines(
  supabase: Client,
  supplierId: number,
  partIds: number[],
): Promise<{ set: number; skipped: number }> {
  return call(supabase.rpc('set_preferred_supplier_lines', { p_source: supplierId, p_parts: partIds }), (data) => {
    const record = readRecord(data) ?? {};
    return { set: num(record.set), skipped: num(record.skipped) };
  });
}

// The Catalogue tab's export: the filtered lines as rows of a spreadsheet, prices per unit ex VAT.
export const SUPPLIER_LINE_EXPORT_MAX = 10000;
export const SUPPLIER_LINE_CSV_HEADERS = [
  'Brand',
  'Part number',
  'Description',
  'Supplier code',
  'Cost',
  'Previous cost',
  'Change %',
  'Price since',
  'List price',
  'Surcharge',
  'Sold in',
  'Minimum',
  'In your range',
  'Stocked',
  'On hand',
  'On order',
  'Sell price',
  'Margin %',
  'Preferred',
  'Cheaper supplier',
  'Cheaper cost',
] as const;

const fixed = (value: number | null, places: number) => (value == null ? '' : value.toFixed(places));

export function supplierLineCsvRows(lines: SupplierLine[]): string[][] {
  return lines.map((line) => [
    line.brand,
    line.number,
    line.description ?? '',
    line.code ?? '',
    fixed(line.cost, 4),
    fixed(line.was, 4),
    line.change == null ? '' : (line.change * 100).toFixed(1),
    line.since ? line.since.slice(0, 10) : '',
    fixed(line.listPrice, 4),
    fixed(line.surcharge, 2),
    String(line.packQty),
    line.minQty == null ? '' : String(line.minQty),
    line.inRange ? 'Yes' : 'No',
    line.isStocked ? 'Yes' : 'No',
    String(line.onHand),
    String(line.onOrder),
    fixed(line.sell, 2),
    line.margin == null ? '' : (line.margin * 100).toFixed(1),
    line.preferred ? 'Yes' : 'No',
    line.cheaper?.supplier ?? '',
    fixed(line.cheaper?.cost ?? null, 4),
  ]);
}
