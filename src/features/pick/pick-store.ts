import type { SQLiteDatabase } from 'expo-sqlite';

import type { LocalPickJob } from './job';

type Row = { job_id: string; user_id: string; job: string; started_at: string; ended_at: string | null };

// The picker's job, kept on the phone so it carries on without signal and after the app closes. One open job per
// person, as PartsLogic holds it; an ended one stays until the next starts, for its receipt.
export class PickStore {
  constructor(private readonly db: SQLiteDatabase) {}

  async open(userId: string): Promise<LocalPickJob | null> {
    const row = await this.db.getFirstAsync<Row>(
      'SELECT * FROM pick_jobs WHERE user_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1',
      userId,
    );
    return row ? (JSON.parse(row.job) as LocalPickJob) : null;
  }

  async save(job: LocalPickJob): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO pick_jobs (job_id, user_id, job, started_at, ended_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (job_id) DO UPDATE SET job = excluded.job, ended_at = excluded.ended_at`,
      job.jobId,
      job.userId,
      JSON.stringify(job),
      job.startedAt,
      job.endedAt,
    );
  }

  // Ended jobs, but the last, are forgotten: their work is in PartsLogic (or in Sync until it is).
  async prune(userId: string): Promise<void> {
    await this.db.runAsync(
      `DELETE FROM pick_jobs WHERE user_id = ? AND ended_at IS NOT NULL
         AND job_id NOT IN (SELECT job_id FROM pick_jobs WHERE user_id = ? ORDER BY started_at DESC LIMIT 1)`,
      userId,
      userId,
    );
  }
}
