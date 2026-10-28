import { useMemo } from 'react';

import { db } from '@/db/database';
import { SavedLists } from '@/db/saved-lists';
import { supabase } from '@/lib/supabase';
import { useRemote } from '@/lib/use-remote';
import { dataError } from '@/vendor/partslogic/shared/errors';
import { listLocationBins } from '@/vendor/partslogic/shared/settings';

import { binChoices, lastCountedByBin, type BinChoice, type PostedCount } from './bin-choices';

// How far back "Counted 3 Oct" looks: the newest posted counts of the location, enough for every bin.
const POSTED_COUNTS = 5000;

async function postedCounts(locationId: number): Promise<PostedCount[]> {
  const { data, error } = await supabase
    .from('stocktakes')
    .select('kind, bin_ids, posted_at')
    .eq('location_id', locationId)
    .eq('status', 'posted')
    .not('posted_at', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(POSTED_COUNTS);
  if (error) throw dataError(error);
  return (data ?? []).flatMap((row) => (row.posted_at ? [{ kind: row.kind, binIds: row.bin_ids, postedAt: row.posted_at }] : []));
}

// The location's shelf bins, with when each was last counted, saving a copy each time so the list still
// shows without signal (with when it was saved).
async function loadBins(saved: SavedLists, locationId: number): Promise<{ choices: BinChoice[]; savedAt: string | null }> {
  const key = `bins:${locationId}`;
  try {
    const [bins, posted] = await Promise.all([listLocationBins(supabase, locationId), postedCounts(locationId)]);
    const choices = binChoices(bins, lastCountedByBin(posted, bins.map((bin) => bin.id)));
    await saved.save(key, choices);
    return { choices, savedAt: null };
  } catch (error) {
    const copy = await saved.read<BinChoice[]>(key);
    if (copy) return { choices: copy.value, savedAt: copy.savedAt };
    throw error;
  }
}

export function useBinChoices(locationId: number | null) {
  const saved = useMemo(() => new SavedLists(db()), []);
  const remote = useRemote(locationId !== null ? `bins:${locationId}` : null, () => loadBins(saved, locationId!));
  return {
    choices: remote.data?.choices ?? [],
    savedAt: remote.data?.savedAt ?? null,
    loading: remote.loading && !remote.data,
    failed: remote.error !== undefined,
    reload: remote.reload,
  };
}
