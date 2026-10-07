import { supabase } from '@/lib/supabase';
import { classifyQueueError } from '@/vendor/partslogic/shared/errors';
import { resolveScan, type ScanHit } from '@/vendor/partslogic/shared/floor';

// What a scanned or typed code turned out to be. "offline" means it couldn't be checked right now.
export type Resolved = ScanHit | { type: 'offline'; code: string };

export async function resolveCode(code: string, locationId: number | null): Promise<Resolved> {
  try {
    return await resolveScan(supabase, code, locationId);
  } catch (error) {
    if (classifyQueueError(error as { code?: string; message?: string }) === 'retry') return { type: 'offline', code };
    throw error;
  }
}
