import type { SQLiteDatabase } from 'expo-sqlite';

import type { BinSession } from '@/vendor/partslogic/shared/bin-session';

export type BinCount = {
  stocktakeId: string;
  userId: string;
  binId: number;
  binCode: string;
  location: string | null;
  startedAt: string;
  session: BinSession;
  labels: Record<string, string>;
  finishedAt: string | null;
};

type Row = {
  stocktake_id: string;
  user_id: string;
  bin_id: number;
  bin_code: string;
  location: string | null;
  started_at: string;
  session: string;
  labels: string;
  finished_at: string | null;
};

const toCount = (row: Row): BinCount => ({
  stocktakeId: row.stocktake_id,
  userId: row.user_id,
  binId: row.bin_id,
  binCode: row.bin_code,
  location: row.location,
  startedAt: row.started_at,
  session: JSON.parse(row.session) as BinSession,
  labels: JSON.parse(row.labels) as Record<string, string>,
  finishedAt: row.finished_at,
});

// Bin counts on this phone. The session is saved after every scan, so a count survives the app closing.
export class CountStore {
  constructor(private readonly db: SQLiteDatabase) {}

  async open(userId: string): Promise<BinCount | null> {
    const row = await this.db.getFirstAsync<Row>(
      'SELECT * FROM bin_counts WHERE user_id = ? AND finished_at IS NULL AND discarded = 0 ORDER BY started_at DESC LIMIT 1',
      userId,
    );
    return row ? toCount(row) : null;
  }

  async recent(userId: string, limit = 10): Promise<BinCount[]> {
    const rows = await this.db.getAllAsync<Row>(
      'SELECT * FROM bin_counts WHERE user_id = ? AND finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT ?',
      userId,
      limit,
    );
    return rows.map(toCount);
  }

  async create(count: BinCount): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO bin_counts (stocktake_id, user_id, bin_id, bin_code, location, started_at, session, labels)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      count.stocktakeId,
      count.userId,
      count.binId,
      count.binCode,
      count.location,
      count.startedAt,
      JSON.stringify(count.session),
      JSON.stringify(count.labels),
    );
  }

  async save(stocktakeId: string, session: BinSession, labels: Record<string, string>): Promise<void> {
    await this.db.runAsync(
      'UPDATE bin_counts SET session = ?, labels = ? WHERE stocktake_id = ?',
      JSON.stringify(session),
      JSON.stringify(labels),
      stocktakeId,
    );
  }

  async finish(stocktakeId: string): Promise<void> {
    await this.db.runAsync('UPDATE bin_counts SET finished_at = ? WHERE stocktake_id = ?', new Date().toISOString(), stocktakeId);
  }

  async discard(stocktakeId: string): Promise<void> {
    await this.db.runAsync('UPDATE bin_counts SET discarded = 1 WHERE stocktake_id = ?', stocktakeId);
  }
}
