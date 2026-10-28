import type { SQLiteDatabase } from 'expo-sqlite';

import type { BinSession } from '@/vendor/partslogic/shared/bin-session';
import type { CountPurpose } from '@/vendor/partslogic/shared/floor';

// The workflows a bin count serves (see src/workflows/catalogue.ts). Stock take and Opening stock are runs
// of bin counts (run-store.ts); the other two count one bin at a time.
export type CountWorkflow = 'put-away' | 'stock-count' | 'stock-take' | 'opening-stock';
export type RunWorkflow = Extract<CountWorkflow, 'stock-take' | 'opening-stock'>;

const WORKFLOWS: readonly CountWorkflow[] = ['put-away', 'stock-count', 'stock-take', 'opening-stock'];
export const countWorkflow = (value: unknown): CountWorkflow =>
  WORKFLOWS.find((workflow) => workflow === value) ?? 'put-away';
export const isRunWorkflow = (workflow: CountWorkflow): workflow is RunWorkflow =>
  workflow === 'stock-take' || workflow === 'opening-stock';

// What PartsLogic records as the count's job (stocktakes.purpose), which also names it in the office.
// Opening stock books what's found as opening stock.
export const COUNT_PURPOSE: Record<CountWorkflow, CountPurpose> = {
  'put-away': 'put_away',
  'stock-count': 'stock_count',
  'stock-take': 'stock_take',
  'opening-stock': 'opening',
};

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
  workflow: CountWorkflow;
  // The stock take or opening-stock run this count belongs to, if any.
  runId: string | null;
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
  workflow: string;
  run_id: string | null;
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
  workflow: countWorkflow(row.workflow),
  runId: row.run_id,
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
      'SELECT * FROM bin_counts WHERE user_id = ? AND finished_at IS NOT NULL AND discarded = 0 ORDER BY finished_at DESC LIMIT ?',
      userId,
      limit,
    );
    return rows.map(toCount);
  }

  async create(count: BinCount): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO bin_counts (stocktake_id, user_id, bin_id, bin_code, location, started_at, session, labels, workflow, run_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      count.stocktakeId,
      count.userId,
      count.binId,
      count.binCode,
      count.location,
      count.startedAt,
      JSON.stringify(count.session),
      JSON.stringify(count.labels),
      count.workflow,
      count.runId,
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

  // Every count of a run on this phone, open or finished (not the ones thrown away).
  async inRun(runId: string): Promise<BinCount[]> {
    const rows = await this.db.getAllAsync<Row>('SELECT * FROM bin_counts WHERE run_id = ? AND discarded = 0 ORDER BY started_at', runId);
    return rows.map(toCount);
  }

  async discard(stocktakeId: string): Promise<void> {
    await this.db.runAsync('UPDATE bin_counts SET discarded = 1 WHERE stocktake_id = ?', stocktakeId);
  }
}
