import type { OutboxStore } from '../store';
import { streamKeyOf } from '../stream';
import type { Coalesce, NewOutboxItem, OutboxItem } from '../types';

// The SQLite store's rules, in memory, for tests.
export class MemoryStore implements OutboxStore {
  items: OutboxItem[] = [];
  private seq = 0;

  async enqueue(item: NewOutboxItem, coalesce?: Coalesce) {
    const streamKey = streamKeyOf(item.payload);
    const newest = [...this.items].reverse().find((row) => row.streamKey === streamKey && row.status !== 'done');
    if (coalesce && newest && newest.status === 'pending' && newest.kind === item.payload.kind) {
      const merged = coalesce(newest.payload);
      if (merged) {
        newest.payload = merged.payload;
        newest.label = merged.label;
        return;
      }
    }
    this.seq += 1;
    this.items.push({
      clientId: item.payload.clientId,
      seq: this.seq,
      userId: item.userId,
      streamKey,
      kind: item.payload.kind,
      payload: item.payload,
      label: item.label,
      status: 'pending',
      attempts: 0,
      lastError: null,
      result: null,
      createdAt: '',
      updatedAt: '',
    });
  }

  async open(userId: string) {
    return this.items.filter((row) => row.userId === userId && (row.status === 'pending' || row.status === 'attention'));
  }

  private find(clientId: string) {
    return this.items.find((row) => row.clientId === clientId);
  }

  async claim(clientId: string) {
    const row = this.find(clientId);
    if (!row || row.status !== 'pending') return null;
    row.status = 'sending';
    return { ...row };
  }

  async done(clientId: string, result: unknown) {
    Object.assign(this.find(clientId)!, { status: 'done', result, lastError: null });
  }

  async attention(clientId: string, error: string) {
    Object.assign(this.find(clientId)!, { status: 'attention', lastError: error });
  }

  async release(clientId: string, error: string) {
    const row = this.find(clientId)!;
    Object.assign(row, { status: 'pending', lastError: error, attempts: row.attempts + 1 });
  }

  async retry(clientId: string) {
    Object.assign(this.find(clientId)!, { status: 'pending', lastError: null });
  }

  async recent(userId: string) {
    return this.items.filter((row) => row.userId === userId);
  }

  async recover() {
    for (const row of this.items) if (row.status === 'sending') row.status = 'pending';
  }
}
