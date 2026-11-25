import type { PickJob } from '@/vendor/partslogic/shared/sales/pick-jobs';

import { bins, done, fromServerJob, left, scanPart, shortRow, tapRow, totals, unscanRow } from '../job';
import { bannerDetail, bannerTitle, countOf, goBack, receiptLine, rowState } from '../words';

const part = (id: number, number: string) => ({ id, brand: 'MANN-FILTER', number, description: null });
const row = (over: Partial<PickJob['rows'][number]>) => ({
  lineId: 1, orderId: 'o19', order: 'SO-000019', customer: null, urgent: false, part: part(6, 'C 35 154'),
  binId: 2, bin: 'B-02', qty: 2, notFound: null, picker: null, ...over,
});
const job = (over: Partial<PickJob> = {}): PickJob => ({
  id: 'j1', locationId: 1, location: 'Leeds branch', startedAt: '2026-11-25T08:00:00Z', endedAt: null, endedHow: null,
  orders: [
    { id: 'o19', number: 'SO-000019', customer: 'Northway', urgent: false, method: 'delivery', fulfilment: 'to_pick' },
    { id: 'o21', number: 'SO-000021', customer: null, urgent: false, method: 'collection', fulfilment: 'to_pick' },
  ],
  rows: [
    row({}),
    row({ lineId: 2, orderId: 'o21', order: 'SO-000021', part: part(6, 'C 35 154'), qty: 1 }),
    row({ lineId: 3, orderId: 'o21', order: 'SO-000021', part: part(9, 'HU 816 x'), binId: 3, bin: 'C-02', qty: 1 }),
  ],
  picked: [],
  now: '2026-11-25T08:00:00Z',
  ...over,
});

describe('a pick job on the phone', () => {
  it('walks the bins in order, the bin to go to first', () => {
    const local = fromServerJob(job(), 'u1');
    expect(bins(local)).toEqual({ now: 'B-02', next: 'C-02' });
    expect(bannerTitle('B-02')).toBe('B-02');
    expect(bannerDetail('C-02', 'B-02', totals(local))).toBe('Next: C-02 · 2 orders · 4 units');
    expect(bannerDetail(null, 'C-02', totals(local))).toBe('Last bin · 2 orders · 4 units');
    expect(bannerTitle(null)).toBe('All picked');
  });

  it('adds each scan to the first row still to pick, then the next order', () => {
    let local = fromServerJob(job(), 'u1');
    const first = scanPart(local, 6);
    expect(first.outcome).toMatchObject({ kind: 'added', complete: false, row: { order: 'SO-000019', scanned: 1 } });
    local = scanPart(first.job, 6).job;
    expect(done(local.rows[0])).toBe(true);
    const third = scanPart(local, 6);
    expect(third.outcome).toMatchObject({ kind: 'added', complete: true, row: { order: 'SO-000021' } });
    // Every unit of it picked: a spare goes back.
    expect(scanPart(third.job, 6).outcome).toMatchObject({ kind: 'spare', want: 3 });
    expect(scanPart(third.job, 77).outcome).toEqual({ kind: 'not_on_pick' });
    expect(bins(third.job)).toEqual({ now: 'C-02', next: null });
  });

  it('taps, takes back and short picks a row', () => {
    let local = fromServerJob(job(), 'u1');
    local = tapRow(local, '1:2', 5, 'label');
    expect(local.rows[0]).toMatchObject({ tapped: 2, tapReason: 'label' });
    local = unscanRow(local, '1:2');
    expect(local.rows[0]).toMatchObject({ tapped: 1 });
    expect(rowState(local.rows[0])).toEqual({ text: '1 without a scan · Label worn or missing', tone: 'neutral' });
    local = shortRow(local, '1:2', 0, 'bin_empty');
    expect(left(local.rows[0])).toBe(0);
    expect(rowState(local.rows[0])).toEqual({ text: '1 short · Bin empty', tone: 'warn' });
    // Found must be less than what is left: all of it is a pick, not a short pick.
    expect(shortRow(local, '2:2', 1, 'damaged').rows[1].short).toBeNull();
    expect(totals(local)).toEqual({ units: 4, picked: 1, short: 1, left: 2, orders: 2 });
    expect(receiptLine(totals(local))).toBe('1 picked · 1 short · 2 orders');
    expect(goBack(2)).toBe('2 units not picked go back to To pick.');
    expect(goBack(1)).toBe('1 unit not picked goes back to To pick.');
  });

  it('carries on a job from PartsLogic, each row counting what it picked', () => {
    const resumed = fromServerJob(
      job({
        rows: [row({ qty: 1 }), row({ lineId: 3, orderId: 'o21', order: 'SO-000021', part: part(9, 'HU 816 x'), binId: 3, bin: 'C-02', qty: 1, notFound: { qty: 1, reason: 'bin_empty', binId: 3, bin: 'C-02', at: null } })],
        picked: [
          { pickId: 9, lineId: 1, orderId: 'o19', binId: 2, bin: 'B-02', partId: 6, qty: 1, short: 0, reason: null, method: 'scan' },
          { pickId: 10, lineId: 2, orderId: 'o21', binId: 2, bin: 'B-02', partId: 6, qty: 1, short: 0, reason: null, method: 'tap' },
          { pickId: 11, lineId: 3, orderId: 'o21', binId: 3, bin: 'C-02', partId: 9, qty: 0, short: 1, reason: 'bin_empty', method: 'scan' },
        ],
      }),
      'u1',
    );
    expect(resumed.rows.map((r) => [r.key, r.want, r.scanned, r.tapped, countOf(r)])).toEqual([
      ['1:2', 2, 1, 0, '1 of 2'],
      ['3:3', 1, 0, 0, '0 of 1'],
      ['2:2', 1, 0, 1, '1 of 1'],
    ]);
    expect(resumed.rows[1].short).toEqual({ found: 0, reason: 'bin_empty' });
    expect(totals(resumed)).toMatchObject({ units: 4, picked: 2, short: 1, left: 1 });
  });

  it('leaves a row with no bin for a count', () => {
    const local = fromServerJob(job({ rows: [row({ binId: null, bin: null })] }), 'u1');
    expect(totals(local).units).toBe(0);
    expect(bins(local).now).toBeNull();
    expect(rowState(local.rows[0])?.text).toBe('Not in a bin on the books · count first');
  });
});
