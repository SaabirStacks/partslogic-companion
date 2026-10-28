import type { SQLiteDatabase } from 'expo-sqlite';

import { countWorkflow, isRunWorkflow, type RunWorkflow } from './count-store';

export type RunBinPlan = { binId: number; code: string };

// A stock take or an opening-stock run on this phone: the bins planned for it, in the order they're
// counted. Each bin is then its own bin count carrying the run id (count-store.ts), which PartsLogic groups
// the same way.
export type CountRun = {
  runId: string;
  userId: string;
  workflow: RunWorkflow;
  locationId: number;
  locationName: string | null;
  bins: RunBinPlan[];
  startedAt: string;
  finishedAt: string | null;
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
};

function toRun(row: Row): CountRun | null {
  const workflow = countWorkflow(row.workflow);
  if (!isRunWorkflow(workflow)) return null;
  let bins: RunBinPlan[] = [];
  try {
    bins = (JSON.parse(row.bins) as RunBinPlan[]).filter((bin) => typeof bin.binId === 'number' && typeof bin.code === 'string');
  } catch {
    bins = [];
  }
  return {
    runId: row.run_id,
    userId: row.user_id,
    workflow,
    locationId: row.location_id,
    locationName: row.location_name,
    bins,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
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

  async create(run: CountRun): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO count_runs (run_id, user_id, workflow, location_id, location_name, bins, started_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      run.runId,
      run.userId,
      run.workflow,
      run.locationId,
      run.locationName,
      JSON.stringify(run.bins),
      run.startedAt,
    );
  }

  async finish(runId: string): Promise<void> {
    await this.db.runAsync('UPDATE count_runs SET finished_at = ? WHERE run_id = ?', new Date().toISOString(), runId);
  }
}
