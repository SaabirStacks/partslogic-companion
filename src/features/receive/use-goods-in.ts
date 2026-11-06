import { useMemo } from 'react';

import { db } from '@/db/database';
import { SavedLists } from '@/db/saved-lists';
import { supabase } from '@/lib/supabase';
import { useRemote } from '@/lib/use-remote';
import { listExpectedDeliveries, listOpenOrderLines, type OpenOrderLine } from '@/vendor/partslogic/shared/purchasing';

import type { Delivery } from './delivery-store';
import { expectedToday, type ExpectedSupplier } from './open-orders';

// Loads from PartsLogic and keeps a copy on the phone, so it still shows without signal (with when it was saved).
// A failure with no saved copy (no signal and never loaded, or a PartsLogic without goods in against orders) reads
// as nothing known, and the screens carry on as before.
async function withCopy<T>(saved: SavedLists, key: string, load: () => Promise<T>): Promise<{ value: T; savedAt: string | null }> {
  try {
    const value = await load();
    await saved.save(key, value);
    return { value, savedAt: null };
  } catch (error) {
    const copy = await saved.read<T>(key);
    if (copy) return { value: copy.value, savedAt: copy.savedAt };
    throw error;
  }
}

// What a supplier's open orders still have due at the delivery's location, loaded when the delivery starts.
export function useOpenOrders(delivery: Delivery | null): { lines: OpenOrderLine[] | null; savedAt: string | null } {
  const saved = useMemo(() => new SavedLists(db()), []);
  const supplierId = delivery?.sender?.kind === 'supplier' ? delivery.sender.id : null;
  const locationId = delivery?.locationId ?? null;
  const key = supplierId != null && locationId != null ? `open-order-lines:${supplierId}:${locationId}` : null;
  const remote = useRemote(key ? `${key}:${delivery?.documentId}` : null, () =>
    withCopy(saved, key!, () => listOpenOrderLines(supabase, supplierId!, locationId!)),
  );
  if (!key || remote.data === undefined) return { lines: null, savedAt: null };
  return { lines: remote.data.value, savedAt: remote.data.savedAt };
}

// The suppliers expected today (or overdue) at a location, for Who's it from?.
export function useExpectedToday(locationId: number | null): ExpectedSupplier[] {
  const saved = useMemo(() => new SavedLists(db()), []);
  const key = locationId != null ? `expected-deliveries:${locationId}` : null;
  const remote = useRemote(key, () => withCopy(saved, key!, () => listExpectedDeliveries(supabase, locationId)));
  return useMemo(() => (remote.data ? expectedToday(remote.data.value) : []), [remote.data]);
}
