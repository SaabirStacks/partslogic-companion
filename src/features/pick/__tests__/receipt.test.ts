import type { OutboxItem } from '@/queue/types';
import type { PickJob } from '@/vendor/partslogic/shared/sales/pick-jobs';

import { fromServerJob, scanPart } from '../job';
import { pickReceipt } from '../receipt';

const part = (id: number, number: string) => ({ id, brand: 'MANN-FILTER', number, description: null });
const job: PickJob = {
  id: 'j1',
  locationId: 1,
  location: 'Leeds branch',
  startedAt: '2026-11-25T08:00:00Z',
  endedAt: null,
  endedHow: null,
  orders: [
    { id: 'o19', number: 'SO-000019', customer: null, urgent: false, method: 'delivery', fulfilment: 'to_pick' },
    { id: 'o21', number: 'SO-000021', customer: null, urgent: false, method: 'collection', fulfilment: 'to_pick' },
  ],
  rows: [
    { lineId: 1, orderId: 'o19', order: 'SO-000019', customer: null, urgent: false, part: part(6, 'C 35 154'), binId: 2, bin: 'B-02', qty: 1, notFound: null, picker: null },
    { lineId: 2, orderId: 'o21', order: 'SO-000021', customer: null, urgent: false, part: part(9, 'HU 816 x'), binId: 4, bin: 'D-01', qty: 1, notFound: null, picker: null },
  ],
  picked: [],
  now: '2026-11-25T08:00:00Z',
};

const item = (over: Partial<OutboxItem>): OutboxItem => ({
  clientId: 'c',
  seq: 1,
  userId: 'u1',
  streamKey: 's',
  kind: 'pick_row',
  payload: { kind: 'pick_row', clientId: 'c', jobId: 'j1', lineId: 1, binId: 2, method: 'scan', target: 1 },
  label: '',
  status: 'pending',
  attempts: 0,
  lastError: null,
  result: null,
  createdAt: '',
  updatedAt: '',
  ...over,
});

describe('the pick receipt', () => {
  const local = scanPart(fromServerJob(job, 'u1'), 6).job;

  it('is sending until PartsLogic has the end, then gives each order its stage', () => {
    expect(pickReceipt(local, [item({})])).toMatchObject({ state: 'sending', line: '1 picked · 2 orders' });
    const end = item({
      clientId: 'e',
      kind: 'pick_job_end',
      status: 'done',
      payload: { kind: 'pick_job_end', clientId: 'e', jobId: 'j1', how: 'stopped' },
      result: { job: { ...job, orders: [{ ...job.orders[0], fulfilment: 'to_pack' }, { ...job.orders[1], fulfilment: 'to_pick' }] }, pickedUnits: 1, shortUnits: 0 },
    });
    const receipt = pickReceipt(local, [item({ status: 'done' }), end]);
    expect(receipt.state).toBe('sent');
    expect(receipt.orders).toEqual([
      { id: 'o19', number: 'SO-000019', stage: 'To pack' },
      { id: 'o21', number: 'SO-000021', stage: 'To pick' },
    ]);
  });

  it('names a pick PartsLogic refused, with its order, and leaves other jobs out', () => {
    const refused = item({
      clientId: 'r',
      status: 'attention',
      lastError: 'Only 0 in D-01 on the books. Count the bin, then pick.',
      payload: { kind: 'pick_row', clientId: 'r', jobId: 'j1', lineId: 2, binId: 4, method: 'tap', cantScan: 'label', target: 1 },
    });
    const other = item({ clientId: 'x', status: 'attention', payload: { kind: 'pick_row', clientId: 'x', jobId: 'other', lineId: 2, binId: 4, method: 'scan', target: 1 } });
    const receipt = pickReceipt(local, [refused, other]);
    expect(receipt.state).toBe('check');
    expect(receipt.refused).toEqual([{ key: 'r', order: 'SO-000021', reason: 'Only 0 in D-01 on the books. Count the bin, then pick.' }]);
  });
});
