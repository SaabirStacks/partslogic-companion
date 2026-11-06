import type { Client } from '../core/client';
import { dataError } from '../core/errors';
import { readNumber, readRecord, requireRecord, type JsonRecord } from '../core/read';

export type PendingPutAway = {
  binId: number;
  place: string;
  locationId: number | null;
  parts: number;
  units: number;
};

export type UnresolvedCode = {
  code: string;
  qty: number;
  lines: number;
  receipts: number;
  counts: number;
  lastSeen: string;
  // receipt numbers and counted bins it was scanned in (up to five)
  sources: string[];
};

export type UnlocatedLine = {
  partId: number;
  brand: string;
  number: string;
  qty: number;
  binId: number;
  place: string;
};

export type UnlocatedSummary = { parts: number; qty: number };

// Codes the floor scanned that matched nothing, one row per code, newest first.
export async function listUnresolvedCodes(supabase: Client, limit = 100): Promise<UnresolvedCode[]> {
  const { data, error } = await supabase.rpc('floor_unresolved', { p_limit: limit });
  if (error) throw dataError(error);
  return (data ?? []).map((row) => ({
    code: row.code,
    qty: Number(row.qty),
    lines: Number(row.lines),
    receipts: Number(row.receipts),
    counts: Number(row.counts),
    lastSeen: row.last_seen,
    sources: row.sources ?? [],
  }));
}

// Stock not yet in a bin, per pool bin (each location's UNBINNED, and UNASSIGNED).
export async function listPendingPutAway(supabase: Client): Promise<PendingPutAway[]> {
  const { data, error } = await supabase.rpc('pending_put_away');
  if (error) throw dataError(error);
  return (data ?? []).map((row) => ({
    binId: row.bin_id,
    place: row.place,
    locationId: row.location_id,
    parts: Number(row.parts),
    units: Number(row.units),
  }));
}

// Keeps the code on the part (barcode or label) and books every line waiting on it.
export async function linkFloorCode(supabase: Client, code: string, partId: number): Promise<{ healed: number }> {
  const { data, error } = await supabase.rpc('link_floor_code', { p_code: code, p_part: partId });
  if (error) throw dataError(error);
  return { healed: readNumber(readRecord(data)?.healed) ?? 0 };
}

export async function voidFloorCode(supabase: Client, code: string): Promise<{ voided: number }> {
  const { data, error } = await supabase.rpc('void_floor_code', { p_code: code });
  if (error) throw dataError(error);
  return { voided: readNumber(readRecord(data)?.voided) ?? 0 };
}

export async function listUnlocatedStock(supabase: Client, locationId?: number | null, limit = 50): Promise<UnlocatedLine[]> {
  const { data, error } = await supabase.rpc('unlocated_stock', { p_location: locationId ?? undefined, p_limit: limit });
  if (error) throw dataError(error);
  return (data ?? []).map((row) => ({
    partId: row.part_id,
    brand: row.brand,
    number: row.number,
    qty: Number(row.qty),
    binId: row.bin_id,
    place: row.place,
  }));
}

export async function unlocatedStockSummary(supabase: Client, locationId?: number | null): Promise<UnlocatedSummary> {
  const { data, error } = await supabase.rpc('unlocated_stock_summary', { p_location: locationId ?? undefined });
  if (error) throw dataError(error);
  const row = readRecord(data);
  return { parts: readNumber(row?.parts) ?? 0, qty: readNumber(row?.qty) ?? 0 };
}

// Writes off chosen parts from one pool bin (Unassigned, or a location's Unbinned).
export async function writeOffUnlocated(
  supabase: Client,
  binId: number,
  partIds: number[],
): Promise<{ parts: number; qty: number }> {
  const { data, error } = await supabase.rpc('write_off_unlocated', { p_bin: binId, p_parts: partIds });
  if (error) throw dataError(error);
  const row = requireRecord(data, 'The write-off failed.');
  return { parts: readNumber(row.parts) ?? 0, qty: readNumber(row.qty) ?? 0 };
}
