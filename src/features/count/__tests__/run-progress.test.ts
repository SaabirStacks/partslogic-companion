import { emptyBinSession, reduceBinSession } from '@/vendor/partslogic/shared/bin-session';

import type { BinChoice } from '../bin-choices';
import type { BinCount } from '../count-store';
import { planBins, runCountText, runProgress } from '../run-progress';
import type { CountRun } from '../run-store';

const run: CountRun = {
  runId: 'run-1',
  userId: 'u',
  workflow: 'stock-take',
  locationId: 1,
  locationName: 'Main',
  bins: [
    { binId: 1, code: 'A-01' },
    { binId: 2, code: 'A-02' },
    { binId: 3, code: 'B-01' },
  ],
  startedAt: '2026-10-28T10:02:00Z',
  finishedAt: null,
};

// A count of a bin in the run with `qty` of one part, finished or still open.
function count(binId: number, qty: number, finished: boolean, startedAt = '2026-10-28T10:05:00Z', runId: string | null = 'run-1'): BinCount {
  const session = [
    { type: 'scan' as const, clientCountId: `c${binId}`, code: 'X' },
    { type: 'set_qty' as const, clientCountId: `c${binId}`, qty },
  ].reduce(reduceBinSession, emptyBinSession(`s${binId}-${startedAt}`, startedAt));
  return {
    stocktakeId: `s${binId}-${startedAt}`,
    userId: 'u',
    binId,
    binCode: `B${binId}`,
    location: 'MAIN',
    startedAt,
    session,
    labels: {},
    finishedAt: finished ? '2026-10-28T10:10:00Z' : null,
    workflow: 'stock-take',
    runId,
  };
}

describe('runProgress', () => {
  it('marks each bin counted, counting or not started, and offers the open one next', () => {
    const progress = runProgress(run, [count(1, 18, true), count(2, 6, false)]);
    expect(progress.bins.map((bin) => [bin.code, bin.state, bin.units])).toEqual([
      ['A-01', 'counted', 18],
      ['A-02', 'counting', 6],
      ['B-01', 'not-started', 0],
    ]);
    expect(progress.next?.code).toBe('A-02');
    expect(runCountText(progress)).toBe('1 of 3 bins');
    expect(progress.units).toBe(18);
    expect(progress.done).toBe(false);
  });

  it('offers the first bin not started when none is open, and is done when all are counted', () => {
    expect(runProgress(run, [count(1, 18, true)]).next?.code).toBe('A-02');
    const all = runProgress(run, [count(1, 18, true), count(2, 9, true), count(3, 0, true)]);
    expect(all.done).toBe(true);
    expect(all.next).toBeNull();
    expect(all.units).toBe(27);
  });

  it('keeps the latest count of a bin counted twice, and ignores counts of other runs', () => {
    const progress = runProgress(run, [
      count(1, 18, true, '2026-10-28T10:05:00Z'),
      count(1, 20, true, '2026-10-28T10:30:00Z'),
      count(2, 99, true, '2026-10-28T10:05:00Z', 'other-run'),
    ]);
    expect(progress.bins[0].units).toBe(20);
    expect(progress.bins[1].state).toBe('not-started');
  });
});

describe('planBins', () => {
  const choices: BinChoice[] = [
    { binId: 1, code: 'A-01', description: null, units: 18, lastCounted: '2026-10-03T10:00:00Z' },
    { binId: 2, code: 'A-02', description: null, units: 9, lastCounted: null },
    { binId: 3, code: 'B-01', description: null, units: 0, lastCounted: null },
  ];

  it('plans every bin, only bins never counted, or a hand-picked set', () => {
    expect(planBins('every', choices, new Set()).map((bin) => bin.code)).toEqual(['A-01', 'A-02', 'B-01']);
    expect(planBins('never', choices, new Set()).map((bin) => bin.code)).toEqual(['A-02', 'B-01']);
    expect(planBins('choose', choices, new Set([3, 1])).map((bin) => bin.code)).toEqual(['A-01', 'B-01']);
  });
});
