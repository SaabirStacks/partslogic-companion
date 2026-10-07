import type { SQLiteDatabase } from 'expo-sqlite';

import type { QueueItem } from '@/vendor/partslogic/shared/bin-session';

import type { OutboxStore } from './store';
import { streamKeyOf } from './stream';
import type { Coalesce, NewOutboxItem, OutboxItem, OutboxStatus } from './types';

type Row = {
  seq: number;
  client_id: string;
  user_id: string;
  stream_key: string;
  kind: QueueItem['kind'];
  payload: string;
  label: string;
  status: OutboxStatus;
  attempts: number;
  last_error: string | null;
  result: string | null;
  created_at: string;
  updated_at: string;
};

function toItem(row: Row): OutboxItem {
  return {
    clientId: row.client_id,
    seq: row.seq,
    userId: row.user_id,
    streamKey: row.stream_key,
    kind: row.kind,
    payload: JSON.parse(row.payload) as QueueItem,
    label: row.label,
    status: row.status,
    attempts: row.attempts,
    lastError: row.last_error,
    result: row.result ? JSON.parse(row.result) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const now = () => new Date().toISOString();

// The outbox in the phone's SQLite database. Each statement is atomic, so an item the runner has claimed
// can never be changed by a scan arriving at the same moment.
export class SqliteOutboxStore implements OutboxStore {
  constructor(private readonly db: SQLiteDatabase) {}

  async enqueue(item: NewOutboxItem, coalesce?: Coalesce) {
    const streamKey = streamKeyOf(item.payload);
    if (coalesce) {
      const newest = await this.db.getFirstAsync<Row>(
        `SELECT * FROM outbox WHERE stream_key = ? AND status != 'done' ORDER BY seq DESC LIMIT 1`,
        streamKey,
      );
      if (newest && newest.status === 'pending' && newest.kind === item.payload.kind) {
        const merged = coalesce(JSON.parse(newest.payload) as QueueItem);
        if (merged) {
          const { changes } = await this.db.runAsync(
            `UPDATE outbox SET payload = ?, label = ?, updated_at = ? WHERE seq = ? AND status = 'pending'`,
            JSON.stringify(merged.payload),
            merged.label,
            now(),
            newest.seq,
          );
          if (changes === 1) return;
        }
      }
    }
    const at = now();
    await this.db.runAsync(
      `INSERT INTO outbox (client_id, user_id, stream_key, kind, payload, label, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      item.payload.clientId,
      item.userId,
      streamKey,
      item.payload.kind,
      JSON.stringify(item.payload),
      item.label,
      at,
      at,
    );
  }

  async open(userId: string) {
    const rows = await this.db.getAllAsync<Row>(
      `SELECT * FROM outbox WHERE user_id = ? AND status IN ('pending', 'attention') ORDER BY seq`,
      userId,
    );
    return rows.map(toItem);
  }

  async claim(clientId: string) {
    const { changes } = await this.db.runAsync(
      `UPDATE outbox SET status = 'sending', updated_at = ? WHERE client_id = ? AND status = 'pending'`,
      now(),
      clientId,
    );
    if (changes !== 1) return null;
    const row = await this.db.getFirstAsync<Row>(`SELECT * FROM outbox WHERE client_id = ?`, clientId);
    return row ? toItem(row) : null;
  }

  async done(clientId: string, result: unknown) {
    await this.db.runAsync(
      `UPDATE outbox SET status = 'done', result = ?, last_error = NULL, updated_at = ? WHERE client_id = ?`,
      JSON.stringify(result ?? null),
      now(),
      clientId,
    );
  }

  async attention(clientId: string, error: string) {
    await this.db.runAsync(
      `UPDATE outbox SET status = 'attention', last_error = ?, updated_at = ? WHERE client_id = ?`,
      error,
      now(),
      clientId,
    );
  }

  async release(clientId: string, error: string) {
    await this.db.runAsync(
      `UPDATE outbox SET status = 'pending', attempts = attempts + 1, last_error = ?, updated_at = ? WHERE client_id = ?`,
      error,
      now(),
      clientId,
    );
  }

  async retry(clientId: string) {
    await this.db.runAsync(
      `UPDATE outbox SET status = 'pending', last_error = NULL, updated_at = ? WHERE client_id = ? AND status = 'attention'`,
      now(),
      clientId,
    );
  }

  async recent(userId: string, since: string) {
    const rows = await this.db.getAllAsync<Row>(
      `SELECT * FROM outbox WHERE user_id = ? AND (status != 'done' OR updated_at >= ?) ORDER BY seq DESC LIMIT 200`,
      userId,
      since,
    );
    return rows.map(toItem);
  }

  async recover() {
    await this.db.runAsync(`UPDATE outbox SET status = 'pending' WHERE status = 'sending'`);
    // Keep a week of sent work for the Outbox tab and for screens that show what the server said.
    await this.db.runAsync(
      `DELETE FROM outbox WHERE status = 'done' AND updated_at < ?`,
      new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    );
  }
}
