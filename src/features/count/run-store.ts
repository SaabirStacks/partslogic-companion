import type { SQLiteDatabase } from 'expo-sqlite';

import type { SharedRun } from '@/vendor/partslogic/shared/floor';

import { countWorkflow, isRunWorkflow, type RunWorkflow } from './count-store';

export type RunBinPlan = { binId: number; code: string };

// A stock take or an opening-stock run on this phone: the bins planned for it, in the order they're
// counted. Each bin is then its own bin count carrying the run id (count-store.ts), which PartsLogic groups
// the same way.
//  - shared: PartsLogic has the run too (started or joined with signal), so several people count it, one
//    person per bin. Otherwise it's this phone's alone.
//  - startedBy: who started it, when it was someone else and this phone joined.
//  - status / statusAt: PartsLogic's last word on every bin (who is counting or counted it), and when.
export type CountRun = {
  runId: string;
  userId: string;
  workflow: RunWorkflow;
  locationId: number;
  locationName: string | null;
  bins: RunBinPlan[];
  startedAt: string;
  finishedAt: string | null;
  shared: boolean;
  startedBy: string | null;
  status: SharedRun | null;
  statusAt: string | null;
};

type Row = {
  run_id: string;
  user_id: string;
  workflow: string;
  location_id: number;
  location_name: string | null;
  bins: string;
  started_at: string;
  finished_at: string | null;
  shared: number;
  started_by: string | null;
  status: string | null;
  status_at: string | null;
};

function parseJson(text: string | null): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Only what this phone wrote, so a light check is enough: a saved status that doesn't look right is dropped.
function toStatus(value: unknown): SharedRun | null {
  const status = value as SharedRun | null;
  return status && typeof status.runId === 'string' && Array.isArray(status.bins) ? status : null;
}

function toRun(row: Row): CountRun | null {
  const workflow = countWorkflow(row.workflow);
  if (!isRunWorkflow(workflow)) return null;
  const planned = parseJson(row.bins);
  const bins = Array.isArray(planned)
    ? (planned as RunBinPlan[]).filter((bin) => typeof bin?.binId === 'number' && typeof bin.code === 'string')
    : [];
  return {
    runId: row.run_id,
    userId: row.user_id,
    workflow,
    locationId: row.location_id,
    locationName: row.location_name,
    bins,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    shared: row.shared === 1,
    startedBy: row.started_by,
    status: toStatus(parseJson(row.status)),
    statusAt: row.status_at,
  };
}

export class RunStore {
  constructor(private readonly db: SQLiteDatabase) {}

  // The run of this kind still open on this phone, or any open run when no kind is given (the board).
  async open(userId: string, workflow?: RunWorkflow): Promise<CountRun | null> {
    const row = workflow
      ? await this.db.getFirstAsync<Row>(
          'SELECT * FROM count_runs WHERE user_id = ? AND workflow = ? AND finished_at IS NULL ORDER BY started_at DESC LIMIT 1',
          userId,
          workflow,
        )
      : await this.db.getFirstAsync<Row>('SELECT * FROM count_runs WHERE user_id = ? AND finished_at IS NULL ORDER BY started_at DESC LIMIT 1', userId);
    return row ? toRun(row) : null;
  }

  // Every run still open on this phone, newest first (a stock take and an opening-stock run can both be).
  async allOpen(userId: string): Promise<CountRun[]> {
    const rows = await this.db.getAllAsync<Row>('SELECT * FROM count_runs WHERE user_id = ? AND finished_at IS NULL ORDER BY started_at DESC', userId);
    return rows.flatMap((row) => toRun(row) ?? []);
  }

  // A run joined again (it was finished here, or left) opens again with what PartsLogic says now.
  async create(run: CountRun): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO count_runs (run_id, user_id, workflow, location_id, location_name, bins, started_at, shared, started_by, status, status_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (run_id) DO UPDATE SET user_id = excluded.user_id, bins = excluded.bins, finished_at = NULL, shared = excluded.shared,
         started_by = excluded.started_by, status = excluded.status, status_at = excluded.status_at`,
      run.runId,
      run.userId,
      run.workflow,
      run.locationId,
      run.locationName,
      JSON.stringify(run.bins),
      run.startedAt,
      run.shared ? 1 : 0,
      run.startedBy,
      run.status ? JSON.stringify(run.status) : null,
      run.statusAt,
    );
  }

  async saveStatus(runId: string, status: SharedRun, at: string): Promise<void> {
    await this.db.runAsync('UPDATE count_runs SET status = ?, status_at = ? WHERE run_id = ?', JSON.stringify(status), at, runId);
  }

  async finish(runId: string): Promise<void> {
    await this.db.runAsync('UPDATE count_runs SET finished_at = ? WHERE run_id = ?', new Date().toISOString(), runId);
  }
}
