import type { OutboxItem } from '@/queue/types';

import { adjustmentTo, groupLines, lineStates, receiptNumber, type DeliveryLine } from '../lines';

const item = (status: OutboxItem['status'], lineIds: string[], result: unknown = null, lastError: string | null = null) =>
  ({
    clientId: `item-${lineIds.join()}`,
    status,
    result,
    lastError,
    payload: {
      kind: 'receipt_lines',
      clientId: 'x',
      documentId: 'R1',
      locationId: 1,
      lines: lineIds.map((clientLineId) => ({ clientLineId, code: 'c', qty: 1 })),
    },
  }) as unknown as OutboxItem;

const line = (clientLineId: string, code: string, qty: number, createdAt: string, label: string | null = null): DeliveryLine => ({
  clientLineId,
  code,
  qty,
  label,
  createdAt,
});

describe('lineStates', () => {
  it('reads what PartsLogic said about each line, and what is still waiting', () => {
    const states = lineStates(
      [
        item('done', ['a', 'b'], {
          number: 'GR-0042',
          lines: [
            { clientLineId: 'a', outcome: 'booked', reason: null },
            { clientLineId: 'b', outcome: 'unresolved', reason: null },
          ],
        }),
        item('attention', ['c'], null, 'Not allowed'),
        item('pending', ['d']),
      ],
      'R1',
    );
    expect(Object.fromEntries(states)).toEqual({
      a: { outcome: 'booked', reason: null },
      b: { outcome: 'unresolved', reason: null },
      c: { outcome: 'attention', reason: 'Not allowed' },
      d: { outcome: 'waiting', reason: null },
    });
  });

  it('finds the receipt number', () => {
    expect(receiptNumber([item('done', ['a'], { number: 'GR-0042', lines: [] })], 'R1')).toBe('GR-0042');
    expect(receiptNumber([item('pending', ['a'])], 'R1')).toBeNull();
  });
});

describe('groupLines', () => {
  it('totals each code, newest first, with undos taken off', () => {
    const groups = groupLines(
      [line('a', 'EAN1', 1, '10:00', 'BOSCH 1'), line('b', 'EAN2', 1, '10:01'), line('c', 'EAN1', 1, '10:02'), line('d', 'EAN1', -1, '10:03')],
      new Map(),
    );
    expect(groups.map((g) => [g.code, g.total, g.label, g.status])).toEqual([
      ['EAN1', 1, 'BOSCH 1', 'waiting'],
      ['EAN2', 1, null, 'waiting'],
    ]);
  });

  it('reports the most urgent status in a group', () => {
    const groups = groupLines(
      [line('a', 'EAN1', 1, '10:00'), line('b', 'EAN1', 1, '10:01')],
      new Map([
        ['a', { outcome: 'booked', reason: null }],
        ['b', { outcome: 'refused', reason: 'Too many' }],
      ]),
    );
    expect(groups[0]).toMatchObject({ status: 'refused', reason: 'Too many' });
  });
});

describe('adjustmentTo', () => {
  it('adds or takes back the difference to a typed total', () => {
    expect(adjustmentTo(10, 1)).toBe(9);
    expect(adjustmentTo(0, 3)).toBe(-3);
    expect(adjustmentTo(3, 3)).toBeNull();
    expect(adjustmentTo(2.5, 1)).toBeNull();
    expect(adjustmentTo(-1, 1)).toBeNull();
  });
});
