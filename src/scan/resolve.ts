import { db } from '@/db/database';
import type { WorkingLocation } from '@/lib/prefs';
import { supabase } from '@/lib/supabase';
import { savedPart } from '@/features/part/part-cache';
import { classifyQueueError } from '@/vendor/partslogic/shared/errors';
import { resolveScan, type ScanHit } from '@/vendor/partslogic/shared/floor';

import { findOffline } from './scan-index';

// What a scanned or typed code turned out to be. offline: true means it came from the list saved on this
// phone (the server checks again when work is sent). "offline" means it couldn't be checked at all.
export type Resolved = (ScanHit & { offline: boolean }) | { type: 'offline'; code: string };

const isConnectionProblem = (error: unknown) => classifyQueueError(error as { code?: string; message?: string }) === 'retry';

export async function resolveCode(code: string, location: WorkingLocation | null): Promise<Resolved> {
  try {
    return { ...(await resolveScan(supabase, code, location?.id ?? null)), offline: false };
  } catch (error) {
    if (!isConnectionProblem(error)) throw error;
  }

  const hit = await findOffline(db(), code, location?.code ?? null);
  if (hit.type === 'bin') return { ...hit, offline: true };
  if (hit.type === 'part') {
    const saved = await savedPart(db(), hit.partId);
    return {
      type: 'part',
      partId: hit.partId,
      brand: saved?.detail.part.brand ?? '',
      number: saved?.detail.part.number ?? `Part ${hit.partId}`,
      offline: true,
    };
  }
  return { type: 'offline', code };
}
