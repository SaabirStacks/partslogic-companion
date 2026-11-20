import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readBoolean, readNumber, readRecord, readString, readStrings } from '../core/read';

// Developer panel › Parts (developers): the stock list with where each item came from, and removing ticked parts,
// each all or nothing, from the stock list only or completely, with a backup of every row. Rules in SQL
// (20261113190000: developer_parts, developer_remove_parts, developer_part_removals, developer_part_removal_backup).

export const PART_ORIGINS = ['all', 'hand', 'sheet', 'enrichment'] as const;
export type PartOriginView = (typeof PART_ORIGINS)[number];
export type PartOrigin = Exclude<PartOriginView, 'all'>;
export const PART_ORIGIN_LABELS: Record<PartOriginView, string> = {
  all: 'All',
  hand: 'Created by hand',
  sheet: 'From price sheets',
  enrichment: 'From enrichment',
};

export const PART_REMOVAL_MODES = ['stock_list', 'complete'] as const;
export type PartRemovalMode = (typeof PART_REMOVAL_MODES)[number];
export const PART_REMOVAL_MAX = 50;

export function isPartOriginView(value: unknown): value is PartOriginView {
  return typeof value === 'string' && (PART_ORIGINS as readonly string[]).includes(value);
}
export function isPartRemovalMode(value: unknown): value is PartRemovalMode {
  return typeof value === 'string' && (PART_REMOVAL_MODES as readonly string[]).includes(value);
}

export type DeveloperPartRow = {
  partId: number;
  origin: PartOrigin;
  addedAt: string | null;
  brand: string;
  number: string;
  description: string | null;
  isStocked: boolean;
  onHand: number;
  supplierPrices: number;
  // What stops it coming off the stock list, and what stops a complete delete (business records, merged parts).
  blockedBy: string[];
  blockedCompletelyBy: string[];
};

export type DeveloperParts = {
  rows: DeveloperPartRow[];
  total: number;
  counts: Record<PartOriginView, number>;
};

export type DeveloperPartsQuery = { origin?: PartOriginView; search?: string | null; limit?: number; offset?: number };

export type PartRemovalResult = {
  removed: { partId: number; brand: string; number: string; rows: number; removalId: number }[];
  refused: { partId: number; brand: string; number: string; reason: string }[];
};

export type PartRemoval = {
  id: number;
  partId: number;
  brand: string;
  number: string;
  mode: PartRemovalMode;
  rows: number;
  removedAt: string;
  removedBy: string | null;
};

const num = (value: Json | undefined) => readNumber(value) ?? 0;

function readOrigin(value: Json | undefined): PartOrigin {
  return value === 'sheet' || value === 'enrichment' ? value : 'hand';
}

export function readDeveloperParts(data: Json): DeveloperParts {
  const record = readRecord(data) ?? {};
  const counts = readRecord(record.counts) ?? {};
  return {
    total: num(record.total),
    counts: { all: num(counts.all), hand: num(counts.hand), sheet: num(counts.sheet), enrichment: num(counts.enrichment) },
    rows: readArray(record.rows).flatMap((item) => {
      const row = readRecord(item);
      const partId = readNumber(row?.part_id);
      const number = readString(row?.number);
      if (!row || partId == null || !number) return [];
      return [
        {
          partId,
          origin: readOrigin(row.origin),
          addedAt: readString(row.added_at),
          brand: readString(row.brand) ?? '',
          number,
          description: readString(row.description),
          isStocked: readBoolean(row.is_stocked) ?? false,
          onHand: num(row.on_hand),
          supplierPrices: num(row.supplier_prices),
          blockedBy: readStrings(row.blocked_by),
          blockedCompletelyBy: readStrings(row.blocked_completely_by),
        },
      ];
    }),
  };
}

export function readPartRemovalResult(data: Json): PartRemovalResult {
  const record = readRecord(data) ?? {};
  const part = (value: Json) => {
    const row = readRecord(value);
    return {
      partId: num(row?.part_id),
      brand: readString(row?.brand) ?? '',
      number: readString(row?.number) ?? '',
    };
  };
  return {
    removed: readArray(record.removed).map((item) => ({
      ...part(item),
      rows: num(readRecord(item)?.rows),
      removalId: num(readRecord(item)?.removal_id),
    })),
    refused: readArray(record.refused).map((item) => ({ ...part(item), reason: readString(readRecord(item)?.reason) ?? 'Refused' })),
  };
}

export function readPartRemovals(data: Json): PartRemoval[] {
  return readArray(data).flatMap((item) => {
    const row = readRecord(item);
    const id = readNumber(row?.id);
    const removedAt = readString(row?.removed_at);
    if (!row || id == null || !removedAt) return [];
    return [
      {
        id,
        partId: num(row.part_id),
        brand: readString(row.brand) ?? '',
        number: readString(row.number) ?? '',
        mode: row.mode === 'complete' ? 'complete' : 'stock_list',
        rows: num(row.rows),
        removedAt,
        removedBy: readString(row.removed_by),
      },
    ];
  });
}

export async function listDeveloperParts(supabase: Client, query: DeveloperPartsQuery = {}): Promise<DeveloperParts> {
  return call(
    supabase.rpc('developer_parts', {
      p: {
        origin: query.origin ?? 'all',
        search: query.search?.trim() || null,
        limit: query.limit ?? 50,
        offset: query.offset ?? 0,
      },
    }),
    readDeveloperParts,
  );
}

export async function removeDeveloperParts(
  supabase: Client,
  partIds: number[],
  mode: PartRemovalMode,
): Promise<PartRemovalResult> {
  return call(supabase.rpc('developer_remove_parts', { p_parts: partIds, p_mode: mode }), readPartRemovalResult);
}

export async function listPartRemovals(supabase: Client, limit = 20): Promise<PartRemoval[]> {
  return call(supabase.rpc('developer_part_removals', { p_limit: limit }), readPartRemovals);
}

// One removal's backup, every row it took by table, as the JSON file the panel downloads.
export async function getPartRemovalBackup(supabase: Client, removalId: number): Promise<Json> {
  return call(supabase.rpc('developer_part_removal_backup', { p_removal: removalId }), (data) => data);
}
