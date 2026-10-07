import type { SQLiteDatabase } from 'expo-sqlite';

import { scanIndexPref } from '@/lib/prefs';
import { supabase } from '@/lib/supabase';
import { scanIndexPage, scanIndexVersion, type ScanIndexEntry } from '@/vendor/partslogic/shared/floor';

import { lookupKeys, pickEntry, type OfflineHit } from './offline-lookup';

// Rows per INSERT: 200 rows × 2 values stays well inside SQLite's bound-parameter limit.
const ROWS_PER_INSERT = 200;

export async function findOffline(db: SQLiteDatabase, code: string, locationCode: string | null): Promise<OfflineHit> {
  const rows: ScanIndexEntry[][] = [];
  for (const key of lookupKeys(code)) {
    const row = await db.getFirstAsync<{ entries: string }>('SELECT entries FROM scan_codes WHERE code_key = ?', key);
    if (row) rows.push(JSON.parse(row.entries) as ScanIndexEntry[]);
  }
  return pickEntry(rows, code, locationCode);
}

// Downloads the whole scan list into a side table, then swaps it in at once, so a half-finished download
// never replaces a good list. Skipped when PartsLogic says nothing has changed.
export async function syncScanIndex(
  db: SQLiteDatabase,
  onProgress?: (codes: number) => void,
): Promise<'unchanged' | 'updated'> {
  const version = await scanIndexVersion(supabase);
  if (!version) return 'unchanged';
  if (version === scanIndexPref.get()?.version) return 'unchanged';

  await db.runAsync('DELETE FROM scan_codes_next');
  let after: string | null = null;
  let total = 0;
  for (;;) {
    const page = await scanIndexPage(supabase, after, 5000);
    if (page.length === 0) break;
    await db.withTransactionAsync(async () => {
      for (let start = 0; start < page.length; start += ROWS_PER_INSERT) {
        const chunk = page.slice(start, start + ROWS_PER_INSERT);
        await db.runAsync(
          `INSERT OR REPLACE INTO scan_codes_next (code_key, entries) VALUES ${chunk.map(() => '(?, ?)').join(', ')}`,
          chunk.flatMap((row) => [row.codeKey, JSON.stringify(row.entries)]),
        );
      }
    });
    total += page.length;
    after = page[page.length - 1].codeKey;
    onProgress?.(total);
  }

  await db.withTransactionAsync(async () => {
    await db.execAsync(
      'DELETE FROM scan_codes; INSERT INTO scan_codes SELECT code_key, entries FROM scan_codes_next; DELETE FROM scan_codes_next;',
    );
  });
  scanIndexPref.set({ version, syncedAt: new Date().toISOString(), codes: total });
  return 'updated';
}
