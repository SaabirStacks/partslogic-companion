import type { Client } from '../core/client';
import { DataError, dataError } from '../core/errors';
import { readArray, readNumber, readRecord, readString, requireRecord, type JsonRecord } from '../core/read';

export type ScanHit =
  | { type: 'bin'; binId: number; bin: string; location: string }
  | { type: 'part'; partId: number; brand: string; number: string }
  | { type: 'unknown'; code: string };

// One code in the offline index. Entries are in resolve_scan's order: bin, label, GTIN, SKU, part number,
// supplier code. "ambiguous" means the server would not pick one part for it either.
export type ScanIndexKind = 'bin' | 'label' | 'gtin' | 'sku' | 'number' | 'supplier_code' | 'ambiguous';
export type ScanIndexEntry = {
  kind: ScanIndexKind;
  partId: number | null;
  binId: number | null;
  label: string | null;
  locationCode: string | null;
};
export type ScanIndexRow = { codeKey: string; entries: ScanIndexEntry[] };

export async function resolveScan(supabase: Client, code: string, locationId?: number | null): Promise<ScanHit> {
  const { data, error } = await supabase.rpc('resolve_scan', { p_code: code, p_location: locationId ?? undefined });
  if (error) throw dataError(error);
  const row = requireRecord(data, 'Scan failed.');
  const type = readString(row.type);
  if (type === 'bin') {
    const binId = readNumber(row.bin_id);
    const bin = readString(row.bin);
    const location = readString(row.location);
    if (binId == null || !bin || !location) throw new DataError('Scan failed.', 'P0001');
    return { type: 'bin', binId, bin, location };
  }
  if (type === 'part') {
    const partId = readNumber(row.part_id);
    const brand = readString(row.brand);
    const number = readString(row.number);
    if (partId == null || !brand || !number) throw new DataError('Scan failed.', 'P0001');
    return { type: 'part', partId, brand, number };
  }
  return { type: 'unknown', code: readString(row.code) ?? code };
}

const SCAN_KINDS = new Set<string>(['bin', 'label', 'gtin', 'sku', 'number', 'supplier_code', 'ambiguous']);

// One page of the offline index, keyed by code. Pass the last codeKey of a page as `after` for the next one;
// an empty page is the end.
export async function scanIndexPage(supabase: Client, after?: string | null, limit = 5000): Promise<ScanIndexRow[]> {
  const { data, error } = await supabase.rpc('scan_index', { p_after: after ?? undefined, p_limit: limit });
  if (error) throw dataError(error);
  return (data ?? []).map((row) => ({
    codeKey: row.code_key,
    entries: readArray(row.entries).flatMap((item) => {
      const entry = readRecord(item);
      const kind = readString(entry?.kind);
      if (!entry || !kind || !SCAN_KINDS.has(kind)) return [];
      return [
        {
          kind: kind as ScanIndexKind,
          partId: readNumber(entry.part_id),
          binId: readNumber(entry.bin_id),
          label: readString(entry.label),
          locationCode: readString(entry.location_code),
        },
      ];
    }),
  }));
}

// Changes whenever the index could have changed (including deletions and merges): refetch it all then.
export async function scanIndexVersion(supabase: Client): Promise<string | null> {
  const { data, error } = await supabase.rpc('scan_index_version');
  if (error) throw dataError(error);
  return typeof data === 'string' ? data : null;
}
