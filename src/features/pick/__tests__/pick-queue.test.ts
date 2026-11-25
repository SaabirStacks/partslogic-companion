import { endPickJob, getPickJob, unscanPick } from '@/vendor/partslogic/shared/sales/pick-jobs';
import { pickLine } from '@/vendor/partslogic/shared/sales/picking';
import { packOrder } from '@/vendor/partslogic/shared/sales/packing';
import { DataError } from '@/vendor/partslogic/shared/errors';

import { sendQueued } from '@/queue/handlers';
import { streamKeyOf } from '@/queue/stream';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/vendor/partslogic/shared/sales/pick-jobs', () => ({ getPickJob: jest.fn(), endPickJob: jest.fn(), unscanPick: jest.fn() }));
jest.mock('@/vendor/partslogic/shared/sales/picking', () => ({ pickLine: jest.fn() }));
jest.mock('@/vendor/partslogic/shared/sales/packing', () => ({ packOrder: jest.fn() }));

const pick = (over: object) => ({ pickId: 9, lineId: 31, orderId: 'o', binId: 4, bin: 'B-02', partId: 6, qty: 1, short: 0, reason: null, method: 'scan', ...over });
const withPicks = (picked: object[]) => jest.mocked(getPickJob).mockResolvedValue({ picked } as never);
const scans = (target: number) => ({ kind: 'pick_row', clientId: 'c', jobId: 'j1', lineId: 31, binId: 4, method: 'scan', target }) as const;

beforeEach(() => jest.resetAllMocks());

describe('sending a row’s scans as its total', () => {
  it('sends only what PartsLogic does not have yet', async () => {
    withPicks([pick({ qty: 1 })]);
    await sendQueued(scans(3));
    expect(pickLine).toHaveBeenCalledWith({}, { lineId: 31, binId: 4, qty: 2, jobId: 'j1', method: 'scan', cantScan: undefined });
  });

  it('sends nothing when it was sent before and the answer was lost', async () => {
    withPicks([pick({ qty: 3 })]);
    await expect(sendQueued(scans(3))).resolves.toEqual({ picked: 0 });
    expect(pickLine).not.toHaveBeenCalled();
    expect(unscanPick).not.toHaveBeenCalled();
  });

  it('gives units back to the bin when the phone took a scan back', async () => {
    withPicks([pick({ pickId: 8, qty: 1 }), pick({ pickId: 9, qty: 2 })]);
    await sendQueued(scans(0));
    expect(unscanPick).toHaveBeenNthCalledWith(1, {}, { pickId: 9, qty: 2 });
    expect(unscanPick).toHaveBeenNthCalledWith(2, {}, { pickId: 8, qty: 1 });
  });

  it('counts taps apart from scans, with why', async () => {
    withPicks([pick({ qty: 2 })]);
    await sendQueued({ ...scans(1), method: 'tap', cantScan: 'label' });
    expect(pickLine).toHaveBeenCalledWith({}, { lineId: 31, binId: 4, qty: 1, jobId: 'j1', method: 'tap', cantScan: 'label' });
  });

  it('sends nothing when PartsLogic gives no job to compare with', async () => {
    jest.mocked(getPickJob).mockResolvedValue(null);
    await expect(sendQueued(scans(2))).rejects.toThrow('no pick job');
    expect(pickLine).not.toHaveBeenCalled();
  });

  it('lets PartsLogic’s refusal through, for the receipt', async () => {
    withPicks([]);
    jest.mocked(pickLine).mockRejectedValue(new DataError('Only 0 in D-01 on the books. Count the bin, then pick.', '22023'));
    await expect(sendQueued(scans(1))).rejects.toThrow('Only 0 in D-01');
  });
});

describe('a short pick, the end and Packed', () => {
  const short = { kind: 'pick_short', clientId: 'c', jobId: 'j1', lineId: 31, binId: 4, qty: 2, found: 0, reason: 'bin_empty' } as const;

  it('sends a short pick once', async () => {
    withPicks([]);
    await sendQueued(short);
    expect(pickLine).toHaveBeenCalledWith({}, { lineId: 31, binId: 4, qty: 2, found: 0, reason: 'bin_empty', jobId: 'j1', method: 'scan' });
    jest.mocked(pickLine).mockClear();
    withPicks([pick({ qty: 0, short: 2, reason: 'bin_empty' })]);
    await sendQueued(short);
    expect(pickLine).not.toHaveBeenCalled();
  });

  it('ends the job, and packs an order already packed as asked', async () => {
    await sendQueued({ kind: 'pick_job_end', clientId: 'c', jobId: 'j1', how: 'stopped' });
    expect(endPickJob).toHaveBeenCalledWith({}, { jobId: 'j1', how: 'stopped' });
    jest.mocked(packOrder).mockRejectedValue(new DataError('This order is already packed', '22023'));
    await expect(sendQueued({ kind: 'pack_order', clientId: 'c', orderId: 'o15', parcels: 2, method: 'scan' })).resolves.toMatchObject({ already: true });
    jest.mocked(packOrder).mockRejectedValue(new DataError('Pick every part first', '22023'));
    await expect(sendQueued({ kind: 'pack_order', clientId: 'c', orderId: 'o15', parcels: 2, method: 'scan' })).rejects.toThrow('Pick every part first');
  });

  it('keeps each row in its own stream and the end after them', () => {
    expect(streamKeyOf(scans(1))).toBe('pick:j1:31:4');
    expect(streamKeyOf(short)).toBe('pick:j1:31:4');
    expect(streamKeyOf({ kind: 'pick_job_end', clientId: 'c', jobId: 'j1', how: 'finished' })).toBe('pick:j1');
    expect(streamKeyOf({ kind: 'pack_order', clientId: 'c', orderId: 'o15', parcels: 1, method: 'tap' })).toBe('pack:o15');
  });
});
