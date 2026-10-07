import type { Coalesce, NewOutboxItem, OutboxItem } from './types';

// Where queued work lives. The app uses SQLite (sqlite-store.ts); tests use memory.
export interface OutboxStore {
  enqueue(item: NewOutboxItem, coalesce?: Coalesce): Promise<void>;
  // Unsent items for this user (pending and attention), oldest first.
  open(userId: string): Promise<OutboxItem[]>;
  // Claims a pending item for sending and returns its latest payload, or null if it is no longer pending.
  claim(clientId: string): Promise<OutboxItem | null>;
  done(clientId: string, result: unknown): Promise<void>;
  attention(clientId: string, error: string): Promise<void>;
  // Back to pending after a passing failure, counting the attempt.
  release(clientId: string, error: string): Promise<void>;
  // A person asked to try an item that needed attention again.
  retry(clientId: string): Promise<void>;
  // Everything for the Outbox tab: unsent items, and items sent since `since`.
  recent(userId: string, since: string): Promise<OutboxItem[]>;
  // After a restart, items left mid-send go back to pending.
  recover(): Promise<void>;
}
