import { db } from '@/db/database';
import type { WorkingLocation } from '@/lib/prefs';
import { supabase } from '@/lib/supabase';
import { isConnectionProblem, within } from '@/lib/within';
import { savedPart } from '@/features/part/part-cache';
import { resolveScan, type ScanHit } from '@/vendor/partslogic/shared/floor';

import { findOffline } from './scan-index';

// What a scanned or typed code turned out to be. offline: true means it came from the list saved on this
// phone (the server checks again when work is sent). "offline" means it couldn't be checked at all.
export type Resolved = (ScanHit & { offline: boolean }) | { type: 'offline'; code: string };

// How long a scan waits on PartsLogic before the phone's own list answers instead. A bad signal shouldn't
// hold the person at the shelf.
const SERVER_WAIT_MS = 3000;

export async function resolveCode(code: string, location: WorkingLocation | null): Promise<Resolved> {
  try {
    return { ...(await within(resolveScan(supabase, code, location?.id ?? null), SERVER_WAIT_MS, 'The lookup timed out')), offline: false };
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

// resolveCode for a scan a job is holding: never throws, so the card always gets an answer.
export type ScanCheck = Resolved | { type: 'error'; code: string; message: string };

export async function checkScan(code: string, location: WorkingLocation | null): Promise<ScanCheck> {
  try {
    return await resolveCode(code, location);
  } catch (error) {
    return { type: 'error', code, message: (error as Error).message };
  }
}

// The name a job shows for a scanned part: brand and number, or the number alone when only the phone's
// list knew it (PartsLogic names it when the line is sent).
export function partLabel(hit: Extract<ScanCheck, { type: 'part' }>): string {
  return hit.brand ? `${hit.brand} ${hit.number}` : hit.number;
}

// Asking again is worth it for a code PartsLogic didn't know or couldn't check: someone may have just added
// it as a part, or the signal may be back.
export const worthRechecking = (check: ScanCheck) => check.type === 'unknown' || check.type === 'offline';
