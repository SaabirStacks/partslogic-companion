import { countOfStream, discardPlan } from '../discard';
import type { OutboxItem, OutboxStatus } from '../types';

const item = (clientId: string, seq: number, streamKey: string, status: OutboxStatus): OutboxItem => ({
  clientId,
  seq,
  userId: 'u',
  streamKey,
  kind: 'open_bin_count',
  payload: { kind: 'open_bin_count', clientId, stocktakeId: 'S1', binId: 1, startedAt: '' },
  label: clientId,
  status,
  attempts: 0,
  lastError: null,
  result: null,
  createdAt: '',
  updatedAt: '',
});

describe('discardPlan', () => {
  const items = [
    item('sent', 1, 'count:S1', 'done'),
    item('open', 2, 'count:S1', 'attention'),
    item('totals', 3, 'count:S1', 'pending'),
    item('finish', 4, 'count:S1', 'pending'),
    item('other', 5, 'count:S2', 'pending'),
  ];

  it('throws away the refused item and what waits behind it in its stream, nothing else', () => {
    expect(discardPlan(items, 'open').map((row) => row.clientId)).toEqual(['open', 'totals', 'finish']);
  });

  it('only discards a refused item', () => {
    expect(discardPlan(items, 'totals')).toEqual([]);
    expect(discardPlan(items, 'sent')).toEqual([]);
    expect(discardPlan(items, 'missing')).toEqual([]);
  });

  it('never throws away something already being sent', () => {
    const sending = [item('open', 2, 'count:S1', 'attention'), item('totals', 3, 'count:S1', 'sending')];
    expect(discardPlan(sending, 'open').map((row) => row.clientId)).toEqual(['open']);
  });
});

describe('countOfStream', () => {
  it('names the bin count a stream belongs to', () => {
    expect(countOfStream('count:S1')).toBe('S1');
    expect(countOfStream('receipt:R1')).toBeNull();
  });
});
