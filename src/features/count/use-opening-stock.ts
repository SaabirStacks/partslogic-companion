import * as Crypto from 'expo-crypto';
import { useMemo } from 'react';

import { db } from '@/db/database';
import { SavedLists } from '@/db/saved-lists';
import { supabase } from '@/lib/supabase';
import { useRemote } from '@/lib/use-remote';
import { useOutbox } from '@/queue/outbox-provider';
import { openingStockStatus, type OpeningStockStatus } from '@/vendor/partslogic/shared/floor';

const key = (locationId: number) => `opening:${locationId}`;

// PartsLogic's word on the location, saving a copy so it still shows without signal.
async function load(saved: SavedLists, locationId: number): Promise<OpeningStockStatus | null> {
  try {
    const [status] = await openingStockStatus(supabase, locationId);
    await saved.save(key(locationId), status ?? null);
    return status ?? null;
  } catch (error) {
    const copy = await saved.read<OpeningStockStatus | null>(key(locationId));
    if (copy) return copy.value;
    throw error;
  }
}

// Whether the location's opening stock is done. known is false until PartsLogic (or a saved copy) has said,
// for instance before the office has applied the change that records it; then Opening stock stays offered
// and nothing is asked. markDone queues "it's fully set up" and shows it at once.
export function useOpeningStock(locationId: number | null) {
  const saved = useMemo(() => new SavedLists(db()), []);
  const outbox = useOutbox();
  const remote = useRemote(locationId !== null ? key(locationId) : null, () => load(saved, locationId!));
  const status = remote.data;
  return {
    known: status !== undefined,
    done: status?.doneAt != null,
    doneBy: status?.doneBy ?? null,
    async markDone() {
      if (locationId === null) return;
      await outbox.enqueue({ kind: 'opening_stock_done', clientId: Crypto.randomUUID(), locationId }, 'Location set up');
      await saved.save(key(locationId), { locationId, doneAt: new Date().toISOString(), doneBy: null } satisfies OpeningStockStatus);
      remote.reload();
    },
  };
}
