import type { Database } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { DataError, dataError } from '../core/errors';
import { readNumber, readRecord, type JsonRecord } from '../core/read';

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

export type BinSummary = {
  id: number;
  code: string;
  description: string | null;
  isActive: boolean;
  isSystem: boolean;
  units: number;
  parts: number;
};

// One level of a location's bins, split from their codes (00-A-01 is aisle 00, level A, bin 01). A group
// counts what sits under it; parts are distinct parts, so a part in two bins of an aisle counts once.
export type BinTreeEntry =
  | {
      kind: 'group';
      path: string[];
      label: string;
      bins: number;
      activeBins: number;
      stockedBins: number;
      units: number;
      parts: number;
    }
  | { kind: 'bin'; label: string; bin: BinSummary };

export type BinsCreated = { created: number; skipped: number; skippedCodes: string[] };

export async function listLocationBins(supabase: Client, locationId: number): Promise<BinSummary[]> {
  const { data, error } = await supabase.rpc('location_bins', { p_location: locationId });
  if (error) throw dataError(error);
  return (data ?? []).flatMap((row) =>
    row.bin_id == null || row.code == null
      ? []
      : [
          {
            id: row.bin_id,
            code: row.code,
            description: row.description,
            isActive: row.is_active ?? true,
            isSystem: row.is_system ?? false,
            units: readNumber(row.units) ?? 0,
            parts: row.parts ?? 0,
          },
        ],
  );
}

// What sits one level below `path` in a location: the top level when the path is empty.
export async function listLocationBinTree(
  supabase: Client,
  locationId: number,
  path: string[] = [],
): Promise<BinTreeEntry[]> {
  const { data, error } = await supabase.rpc('location_bin_tree', { p_location: locationId, p_path: path });
  if (error) throw dataError(error);
  return (data ?? []).flatMap((row): BinTreeEntry[] => {
    if (row.label == null) return [];
    if (row.kind === 'bin') {
      if (row.bin_id == null || row.code == null) return [];
      return [
        {
          kind: 'bin',
          label: row.label,
          bin: {
            id: row.bin_id,
            code: row.code,
            description: row.description,
            isActive: row.is_active ?? true,
            isSystem: row.is_system ?? false,
            units: readNumber(row.units) ?? 0,
            parts: row.parts ?? 0,
          },
        },
      ];
    }
    return [
      {
        kind: 'group',
        path: row.path ?? [...path, row.label],
        label: row.label,
        bins: row.bins ?? 0,
        activeBins: row.active_bins ?? 0,
        stockedBins: row.stocked_bins ?? 0,
        units: readNumber(row.units) ?? 0,
        parts: row.parts ?? 0,
      },
    ];
  });
}

// Adds many bins to a location; codes the location already has are skipped.
export async function createBins(supabase: Client, locationId: number, codes: string[]): Promise<BinsCreated> {
  const { data, error } = await supabase.rpc('create_bins', { p_location: locationId, p_codes: codes });
  if (error) throw dataError(error);
  const record = readRecord(data);
  const skippedCodes = Array.isArray(record?.skipped_codes)
    ? record.skipped_codes.filter((code): code is string => typeof code === 'string')
    : [];
  return { created: readNumber(record?.created) ?? 0, skipped: readNumber(record?.skipped) ?? 0, skippedCodes };
}

export async function updateBin(
  supabase: Client,
  binId: number,
  changes: { code?: string; description?: string | null; isActive?: boolean },
): Promise<void> {
  const values: Database['public']['Tables']['bins']['Update'] = {};
  if (changes.code !== undefined) values.code = changes.code.trim().toUpperCase();
  if (changes.description !== undefined) values.description = changes.description?.trim() || null;
  if (changes.isActive !== undefined) values.is_active = changes.isActive;
  const { data, error } = await supabase.from('bins').update(values).eq('id', binId).eq('is_system', false).select('id');
  if (error) throw dataError(error);
  if (!data.length) throw new DataError('That bin cannot be changed (it may be a system bin), or you need the editor role.', '42501');
}

// Removes a bin. Stock in it moves to the location's unbinned bin.
export async function deleteBin(supabase: Client, binId: number): Promise<void> {
  const { data, error } = await supabase.from('bins').delete().eq('id', binId).eq('is_system', false).select('id');
  if (error) throw dataError(error);
  if (!data.length) throw new DataError('That bin cannot be removed (it may be a system bin), or you need the editor role.', '42501');
}
