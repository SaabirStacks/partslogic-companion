import type { QueueItem } from '@/vendor/partslogic/shared/bin-session';

// pending: waiting to send. sending: claimed by the runner (reset to pending if the app stopped
// mid-send; the server recognises replays). attention: refused by the server, needs a person.
// done: accepted by the server.
export type OutboxStatus = 'pending' | 'sending' | 'attention' | 'done';

export type OutboxItem = {
  clientId: string;
  seq: number;
  userId: string;
  streamKey: string;
  kind: QueueItem['kind'];
  payload: QueueItem;
  // What the Outbox tab shows for it, for example "Delivery GR-0042 · 3 lines".
  label: string;
  status: OutboxStatus;
  attempts: number;
  lastError: string | null;
  result: unknown;
  createdAt: string;
  updatedAt: string;
};

export type NewOutboxItem = { userId: string; payload: QueueItem; label: string };

// Lets an item join the newest unsent item of the same stream and kind instead of adding another call:
// receipt lines append, a bin count's running totals replace. Return null to add a new item instead.
export type Coalesce = (existing: QueueItem) => { payload: QueueItem; label: string } | null;
