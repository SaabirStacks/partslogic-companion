import { clock } from '@/lib/format';

import type { Delivery } from '../delivery-store';
import type { GroupStatus, LineGroup } from '../lines';
import { receiptLine, receiptSummary } from '../receipt';

const group = (code: string, status: GroupStatus): LineGroup => ({ code, label: null, total: 1, status, reason: null, lastAt: '' });

describe('receiptSummary', () => {
  it('is booked once PartsLogic has every line, counting codes and unknowns', () => {
    expect(receiptSummary([group('A', 'booked'), group('B', 'unknown'), group('C', 'booked')])).toEqual({
      state: 'booked',
      codes: 3,
      unknown: 1,
    });
  });

  it('is still sending while any line is on the phone', () => {
    expect(receiptSummary([group('A', 'booked'), group('B', 'waiting')]).state).toBe('sending');
  });

  it('asks for a check when a line was refused or could not be sent', () => {
    expect(receiptSummary([group('A', 'waiting'), group('B', 'refused')]).state).toBe('check');
    expect(receiptSummary([group('A', 'attention')]).state).toBe('check');
  });
});

describe('receiptLine', () => {
  const delivery: Delivery = {
    documentId: 'R1',
    userId: 'u',
    locationId: 1,
    locationName: 'Main',
    sender: { kind: 'supplier', id: 7, name: 'BGA' },
    reference: 'DN 448210',
    startedAt: '2026-10-28T09:12:00.000Z',
    finishedAt: '2026-10-28T09:31:00.000Z',
  };

  it('names the sender, the delivery note and the time it took', () => {
    expect(receiptLine(delivery)).toBe(`BGA · DN 448210 · ${clock(delivery.startedAt)}–${clock(delivery.finishedAt!)}`);
  });

  it('leaves out what a delivery started before the phone asked does not have', () => {
    expect(receiptLine({ ...delivery, sender: null, reference: null, finishedAt: null })).toBe(`Delivery · ${clock(delivery.startedAt)}`);
  });
});
