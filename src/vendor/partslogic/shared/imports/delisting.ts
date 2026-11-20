import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readBoolean, readNumber, readRecord, readString, readStrings } from '../core/read';
import { readListScope, type DelistState, type ListScope } from './batches';

// A full list's delisting check (step 3c): the supplier's lines the sheet doesn't mention, stocked parts first, each with
// the cheapest other supplier, and settling it (mark them no longer listed, or keep them). Rules in SQL
// (20261113150000: delisting_lines, settle_delisting).

export type DelistingLine = {
  priceId: number;
  partId: number;
  brand: string;
  number: string;
  description: string | null;
  code: string | null;
  cost: number;
  currency: string;
  isStocked: boolean;
  onHand: number;
  // The cheapest other supplier listing the part now; null when there is none.
  other: { supplierId: number; supplier: string; cost: number } | null;
  // Closed by this upload (after it was confirmed).
  closed: boolean;
};

export type Delisting = {
  batchId: string;
  supplierId: number;
  file: string;
  state: DelistState | null;
  scope: ListScope;
  brands: string[] | null;
  inScope: number;
  listed: number;
  lines: number;
  delisted: number;
  decidedAt: string | null;
  decidedBy: string | null;
  total: number;
  stocked: number;
  // Stocked parts that no other supplier lists.
  stockedNoOther: number;
  rows: DelistingLine[];
};

export const DELISTING_PAGE = 50;

function readState(value: Json | undefined): DelistState | null {
  return value === 'check' || value === 'closing' || value === 'done' || value === 'kept' ? value : null;
}

export function readDelisting(value: Json | undefined): Delisting | null {
  const record = readRecord(value);
  const batchId = readString(record?.batch_id);
  const supplierId = readNumber(record?.source_id);
  if (!record || !batchId || supplierId == null) return null;
  const num = (key: string) => readNumber(record[key]) ?? 0;
  return {
    batchId,
    supplierId,
    file: readString(record.file) ?? 'Price list',
    state: readState(record.state),
    scope: readListScope(record.scope),
    brands: Array.isArray(record.brands) ? readStrings(record.brands) : null,
    inScope: num('in_scope'),
    listed: num('listed'),
    lines: num('lines'),
    delisted: num('delisted'),
    decidedAt: readString(record.decided_at),
    decidedBy: readString(record.decided_by),
    total: num('total'),
    stocked: num('stocked'),
    stockedNoOther: num('stocked_no_other'),
    rows: readArray(record.rows).flatMap((item) => {
      const row = readRecord(item);
      const priceId = readNumber(row?.price_id);
      const partId = readNumber(row?.part_id);
      const number = readString(row?.number);
      const cost = readNumber(row?.cost);
      if (!row || priceId == null || partId == null || !number || cost == null) return [];
      const other = readRecord(row.other);
      const otherId = readNumber(other?.source_id);
      const otherName = readString(other?.supplier);
      const otherCost = readNumber(other?.cost);
      return [
        {
          priceId,
          partId,
          brand: readString(row.brand) ?? '',
          number,
          description: readString(row.description),
          code: readString(row.code),
          cost,
          currency: readString(row.currency) ?? 'GBP',
          isStocked: readBoolean(row.is_stocked) ?? false,
          onHand: readNumber(row.on_hand) ?? 0,
          other: otherId != null && otherName && otherCost != null ? { supplierId: otherId, supplier: otherName, cost: otherCost } : null,
          closed: readBoolean(row.closed) ?? false,
        },
      ];
    }),
  };
}

export async function getDelisting(
  supabase: Client,
  batchId: string,
  page: { limit?: number; offset?: number } = {},
): Promise<Delisting | null> {
  return call(
    supabase.rpc('delisting_lines', {
      p_batch: batchId,
      p: { limit: page.limit ?? DELISTING_PAGE, offset: page.offset ?? 0 },
    }),
    readDelisting,
  );
}

// Editors: true marks the lines no longer listed; false keeps them (the sheet is treated as an update).
export async function settleDelisting(supabase: Client, batchId: string, delist: boolean): Promise<Delisting | null> {
  return call(supabase.rpc('settle_delisting', { p_batch: batchId, p_delist: delist }), readDelisting);
}

// What a sheet covers, in words, for the wizard, the report and the supplier's Price sheets tab.
export const LIST_SCOPE_LABELS: Record<ListScope, string> = {
  update: 'Update',
  full_supplier: 'Full price list',
  full_brands: 'Full list for its brands',
};

// The scope of a check in a sentence: "for Bosch and TRW" / "for this supplier".
export function delistingScopeText(scope: ListScope, brands: string[] | null): string {
  if (scope !== 'full_brands' || !brands || brands.length === 0) return 'for this supplier';
  if (brands.length === 1) return `for ${brands[0]}`;
  if (brands.length <= 3) return `for ${brands.slice(0, -1).join(', ')} and ${brands[brands.length - 1]}`;
  return `for ${brands.length} brands`;
}
