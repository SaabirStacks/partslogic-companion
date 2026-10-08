import { db } from '@/db/database';
import { supabase } from '@/lib/supabase';
import { getPartDetail, type PartDetail } from '@/vendor/partslogic/shared/catalogue';
import { classifyQueueError } from '@/vendor/partslogic/shared/errors';

import { savedPart, savePart } from './part-cache';

// savedAt is set when the copy came from this phone because there was no signal.
export type LoadedPart = { detail: PartDetail; savedAt: string | null };

// Fresh from PartsLogic when there's signal (and saved for later); the copy saved on this phone when not.
// Null when PartsLogic has no such part.
export async function loadPart(partId: number): Promise<LoadedPart | null> {
  try {
    const detail = await getPartDetail(supabase, partId);
    if (detail) await savePart(db(), detail);
    return detail ? { detail, savedAt: null } : null;
  } catch (error) {
    if (classifyQueueError(error as { code?: string; message?: string }) !== 'retry') throw error;
    const saved = await savedPart(db(), partId);
    if (!saved) throw error;
    return { detail: saved.detail, savedAt: saved.cachedAt };
  }
}
