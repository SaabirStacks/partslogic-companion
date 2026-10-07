import type { ScanIndexEntry } from '@/vendor/partslogic/shared/floor';
import { gtin14 } from '@/vendor/partslogic/shared/gtin';

import { normalisePartNumber } from './normalise';

export type OfflineHit =
  | { type: 'bin'; binId: number; bin: string; location: string }
  | { type: 'part'; partId: number }
  | { type: 'unknown' };

// The keys a scanned code is looked up by in the offline list, in order: as written, as a GTIN-14, as a
// normalised part number (the rule in PartsLogic's .cursor/rules/40-mobile.mdc).
export function lookupKeys(code: string): string[] {
  const keys = [code.trim().toUpperCase(), gtin14(code), normalisePartNumber(code)];
  return keys.filter((key, index): key is string => !!key && keys.indexOf(key) === index);
}

// The first entry that isn't ambiguous wins. A plain bin code only means a bin in the working location;
// "LOC/BIN" names a bin anywhere. Anything else is left to the server when the work is sent.
export function pickEntry(rows: ScanIndexEntry[][], code: string, locationCode: string | null): OfflineHit {
  const qualified = code.includes('/');
  for (const entries of rows) {
    const bins = entries.filter((entry) => entry.kind === 'bin');
    for (const entry of entries) {
      if (entry.kind === 'ambiguous') continue;
      if (entry.kind === 'bin') {
        if (entry.binId == null || !entry.locationCode) continue;
        const here = locationCode ? entry.locationCode === locationCode : bins.length === 1;
        if (!qualified && !here) continue;
        return { type: 'bin', binId: entry.binId, bin: entry.label ?? code, location: entry.locationCode };
      }
      if (entry.partId != null) return { type: 'part', partId: entry.partId };
    }
  }
  return { type: 'unknown' };
}
