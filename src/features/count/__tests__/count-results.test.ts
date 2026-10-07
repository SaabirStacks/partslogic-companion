import type { OutboxItem } from '@/queue/types';

import { countLineOutcomes, countProgress } from '../count-results';

const item = (kind: string, status: OutboxItem['status'], result: unknown = null, lastError: string | null = null) =>
  ({ status, result, lastError, payload: { kind, clientId: kind, stocktakeId: 'S1' } }) as unknown as OutboxItem;

describe('countLineOutcomes', () => {
  it('takes the newest accepted answer for each line', () => {
    const outcomes = countLineOutcomes(
      [
        item('bin_count_lines', 'done', { lines: [{ clientCountId: 'a', outcome: 'updated' }] }),
        item('bin_count_lines', 'done', {
          lines: [
            { clientCountId: 'a', outcome: 'counted' },
            { clientCountId: 'b', outcome: 'unresolved' },
          ],
        }),
      ],
      'S1',
    );
    expect(Object.fromEntries(outcomes)).toEqual({ a: 'updated', b: 'unresolved' });
  });
});

describe('countProgress', () => {
  it('reports a stuck count, a completed one, or one still on the phone', () => {
    expect(countProgress([item('open_bin_count', 'attention', null, 'Bin is inactive')], 'S1')).toEqual({
      stage: 'attention',
      reason: 'Bin is inactive',
    });
    const result = { putAway: 3, returned: 1, found: 0, unresolved: 0, partial: false, needsReview: false };
    expect(countProgress([item('commit_bin_count', 'done', result)], 'S1')).toEqual({ stage: 'done', result });
    expect(countProgress([item('commit_bin_count', 'pending')], 'S1')).toEqual({ stage: 'waiting' });
  });
});
