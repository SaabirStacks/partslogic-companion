import { supabase } from '@/lib/supabase';
import { useRemote } from '@/lib/use-remote';
import { dataError } from '@/vendor/partslogic/shared/errors';
import { listUnlocatedStock } from '@/vendor/partslogic/shared/floor';
import { listLocationBins } from '@/vendor/partslogic/shared/settings';

import { waitingRows, type StockLevel, type WaitingRow } from './waiting';

// Enough for a big delivery; the screen says when there's more.
const LIMIT = 200;

async function loadWaiting(locationId: number): Promise<WaitingRow[]> {
  const [lines, bins] = await Promise.all([listUnlocatedStock(supabase, locationId, LIMIT), listLocationBins(supabase, locationId)]);
  if (lines.length === 0) return [];
  const { data, error } = await supabase
    .from('stock_levels')
    .select('part_id, bin_id, qty')
    .in(
      'part_id',
      lines.map((line) => line.partId),
    )
    .gt('qty', 0);
  if (error) throw dataError(error);
  const levels: StockLevel[] = (data ?? []).map((row) => ({ partId: row.part_id, binId: row.bin_id, qty: Number(row.qty) }));
  const shelves = new Map(bins.filter((bin) => bin.isActive && !bin.isSystem).map((bin) => [bin.id, bin.code]));
  return waitingRows(lines, levels, shelves);
}

// What's waiting in the location's Unbinned bin, part by part. Needs signal.
export function useWaiting(locationId: number | null) {
  const remote = useRemote(locationId !== null ? `waiting:${locationId}` : null, () => loadWaiting(locationId!));
  return { rows: remote.data ?? [], loading: remote.loading && !remote.data, failed: remote.error !== undefined, reload: remote.reload, limit: LIMIT };
}
