import type { SQLiteDatabase } from 'expo-sqlite';

import type { PartDetail } from '@/vendor/partslogic/shared/catalogue';

// The last 200 part cards opened on this phone, for looking parts up with no signal.
const KEEP = 200;

export async function savePart(db: SQLiteDatabase, detail: PartDetail): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO part_cache (part_id, detail, cached_at) VALUES (?, ?, ?)',
    detail.part.id,
    JSON.stringify(detail),
    new Date().toISOString(),
  );
  await db.runAsync(
    'DELETE FROM part_cache WHERE part_id NOT IN (SELECT part_id FROM part_cache ORDER BY cached_at DESC LIMIT ?)',
    KEEP,
  );
}

export async function savedPart(
  db: SQLiteDatabase,
  partId: number,
): Promise<{ detail: PartDetail; cachedAt: string } | null> {
  const row = await db.getFirstAsync<{ detail: string; cached_at: string }>(
    'SELECT detail, cached_at FROM part_cache WHERE part_id = ?',
    partId,
  );
  return row ? { detail: JSON.parse(row.detail) as PartDetail, cachedAt: row.cached_at } : null;
}
