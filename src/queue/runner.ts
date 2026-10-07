import { classifyQueueError } from '@/vendor/partslogic/shared/errors';
import type { QueueItem } from '@/vendor/partslogic/shared/bin-session';

import type { OutboxStore } from './store';

export type Send = (payload: QueueItem) => Promise<unknown>;

export type RunReport = {
  sent: number;
  // Set when a passing failure (no signal, timeout) stopped the run; try again later.
  stoppedBy: string | null;
  needsAttention: number;
};

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

// Sends this user's queued work, oldest first. Within a stream, order is kept: an item needing attention
// holds back the rest of its stream (they depend on it) but not other streams. A passing failure stops
// the whole run, because the next item would fail the same way. Nothing is ever dropped.
export async function runOutbox(store: OutboxStore, userId: string, send: Send): Promise<RunReport> {
  const report: RunReport = { sent: 0, stoppedBy: null, needsAttention: 0 };
  const blocked = new Set<string>();

  for (const item of await store.open(userId)) {
    if (item.status === 'attention' || blocked.has(item.streamKey)) {
      blocked.add(item.streamKey);
      if (item.status === 'attention') report.needsAttention += 1;
      continue;
    }

    const claimed = await store.claim(item.clientId);
    if (!claimed) continue;

    try {
      const result = await send(claimed.payload);
      await store.done(claimed.clientId, result ?? null);
      report.sent += 1;
    } catch (error) {
      const message = messageOf(error);
      if (classifyQueueError(error as { code?: string; message?: string }) === 'retry') {
        await store.release(claimed.clientId, message);
        report.stoppedBy = message;
        return report;
      }
      await store.attention(claimed.clientId, message);
      blocked.add(claimed.streamKey);
      report.needsAttention += 1;
    }
  }
  return report;
}

// Seconds to wait before the next try after a passing failure: 2, 4, 8 ... up to a minute.
export function backoffMs(failures: number): number {
  return Math.min(60_000, 1000 * 2 ** Math.max(1, failures));
}
