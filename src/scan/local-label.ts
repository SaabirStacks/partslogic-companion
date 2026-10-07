import { db } from '@/db/database';
import { savedPart } from '@/features/part/part-cache';
import { recentPartsPref } from '@/lib/prefs';

import { findOffline } from './scan-index';

// What the phone alone can say about a scanned code, instantly and without signal: a bin, a part (named
// when it has been looked up on this phone before), or nothing. The server still decides when it's sent.
export async function localLabel(
  code: string,
  locationCode: string | null,
): Promise<{ type: 'bin'; bin: string } | { type: 'part'; partId: number; label: string | null } | { type: 'unknown' }> {
  try {
    const hit = await findOffline(db(), code, locationCode);
    if (hit.type === 'bin') return { type: 'bin', bin: hit.bin };
    if (hit.type !== 'part') return { type: 'unknown' };
    const recent = recentPartsPref.get()?.find((part) => part.partId === hit.partId);
    if (recent) return { type: 'part', partId: hit.partId, label: `${recent.brand} ${recent.number}` };
    const saved = await savedPart(db(), hit.partId);
    return { type: 'part', partId: hit.partId, label: saved ? `${saved.detail.part.brand} ${saved.detail.part.number}` : null };
  } catch {
    return { type: 'unknown' };
  }
}
