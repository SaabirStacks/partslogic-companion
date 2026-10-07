import type { BinCountCommit, CountLineResult } from '@/vendor/partslogic/shared/floor';

import type { OutboxItem } from '@/queue/types';

// What PartsLogic said about each scanned code in a count (from the newest totals it accepted).
export function countLineOutcomes(items: OutboxItem[], stocktakeId: string): Map<string, CountLineResult['outcome']> {
  const outcomes = new Map<string, CountLineResult['outcome']>();
  // items are newest first; the newest accepted snapshot has the latest word on every line.
  for (const item of items) {
    if (item.status !== 'done' || item.payload.kind !== 'bin_count_lines' || item.payload.stocktakeId !== stocktakeId) continue;
    const lines = (item.result as { lines?: CountLineResult[] } | null)?.lines ?? [];
    for (const line of lines) if (!outcomes.has(line.clientCountId)) outcomes.set(line.clientCountId, line.outcome);
  }
  return outcomes;
}

export type CountProgress =
  | { stage: 'waiting' }
  | { stage: 'attention'; reason: string | null }
  | { stage: 'done'; result: BinCountCommit };

// Where a finished count stands: still on the phone, stuck, or completed with what it changed.
export function countProgress(items: OutboxItem[], stocktakeId: string): CountProgress {
  const stream = items.filter((item) => 'stocktakeId' in item.payload && item.payload.stocktakeId === stocktakeId);
  const stuck = stream.find((item) => item.status === 'attention');
  if (stuck) return { stage: 'attention', reason: stuck.lastError };
  const commit = stream.find((item) => item.payload.kind === 'commit_bin_count' && item.status === 'done');
  return commit ? { stage: 'done', result: commit.result as BinCountCommit } : { stage: 'waiting' };
}
