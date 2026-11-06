import type { Client } from '../core/client';
import { dataError } from '../core/errors';
import { readNumber, readString, requireRecord, type JsonRecord } from '../core/read';

// Where a location's opening stock stands: done (when, by whom) or still being set up (doneAt null).
export type OpeningStockStatus = { locationId: number; doneAt: string | null; doneBy: string | null };

function openingStock(row: { location_id?: number | null; done_at?: string | null; done_by?: string | null }, fallback?: number): OpeningStockStatus | null {
  const locationId = row.location_id ?? fallback;
  if (locationId == null) return null;
  return { locationId, doneAt: row.done_at ?? null, doneBy: row.done_by ?? null };
}

// Every location's opening stock, or one location's.
export async function openingStockStatus(supabase: Client, locationId?: number): Promise<OpeningStockStatus[]> {
  const { data, error } = await supabase.rpc('opening_stock_status', { p_location: locationId });
  if (error) throw dataError(error);
  return (data ?? []).flatMap((row) => openingStock(row) ?? []);
}

// Marks a location's opening stock done (it's fully set up), so it's no longer offered there. Counter and
// up; the first time is kept.
export async function markOpeningStockDone(supabase: Client, locationId: number): Promise<OpeningStockStatus> {
  const { data, error } = await supabase.rpc('mark_opening_stock_done', { p_location: locationId });
  if (error) throw dataError(error);
  const row = requireRecord(data, 'The location could not be marked set up.');
  return openingStock({ location_id: readNumber(row.location_id), done_at: readString(row.done_at), done_by: readString(row.done_by) }, locationId)!;
}

// Offers opening stock at a location again (a missed aisle, a setup gone wrong). Editors and up.
export async function reopenOpeningStock(supabase: Client, locationId: number): Promise<OpeningStockStatus> {
  const { error } = await supabase.rpc('reopen_opening_stock', { p_location: locationId });
  if (error) throw dataError(error);
  return { locationId, doneAt: null, doneBy: null };
}
