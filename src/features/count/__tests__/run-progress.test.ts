import { emptyBinSession, reduceBinSession } from '@/vendor/partslogic/shared/bin-session';
import type { SharedRun, SharedRunBin } from '@/vendor/partslogic/shared/floor';

import type { BinChoice } from '../bin-choices';
import type { BinCount } from '../count-store';
import { peopleText, planBins, runCountText, runProgress } from '../run-progress';
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
  shared: false,
  startedBy: null,
  status: null,
  statusAt: null,
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

describe('runProgress, shared with others', () => {
  // PartsLogic's word on the three bins: A-01 counted by Sam, A-02 being counted by Ali, B-01 not started.
  const there = (overrides: Partial<SharedRunBin>[] = []): SharedRun => ({
    runId: 'run-1',
    locationId: 1,
    purpose: 'stock_take',
    status: 'open',
    startedAt: '2026-10-28T10:00:00Z',
    startedBy: 'Sam',
    finishedAt: null,
    finishedBy: null,
    bins: [
      { binId: 1, code: 'A-01', state: 'counted', active: false, by: 'Sam', mine: false, stocktakeId: 'x1', units: 12 },
      { binId: 2, code: 'A-02', state: 'counting', active: true, by: 'Ali', mine: false, stocktakeId: 'x2', units: 3 },
      { binId: 3, code: 'B-01', state: 'not_started', active: false, by: null, mine: false, stocktakeId: null, units: 0 },
    ].map((bin, index) => ({ ...bin, ...overrides[index] }) as SharedRunBin),
  });
  const shared = (status: SharedRun | null) => ({ ...run, shared: true, startedBy: 'Sam', status, statusAt: '2026-10-28T10:20:00Z' });

  it('shows bins counted and being counted by others, and offers the first bin nobody has', () => {
    const progress = runProgress(shared(there()), []);
    expect(progress.bins.map((bin) => [bin.code, bin.state, bin.units, bin.by])).toEqual([
      ['A-01', 'counted', 12, 'Sam'],
      ['A-02', 'taken', 3, 'Ali'],
      ['B-01', 'not-started', 0, null],
    ]);
    expect(progress.next?.code).toBe('B-01');
    expect(progress.counted).toBe(1);
    expect(progress.mine).toBe(0);
    expect(progress.units).toBe(12);
    expect(progress.others).toEqual(['Sam', 'Ali']);
    expect(progress.closed).toBeNull();
  });

  it('puts this phone’s own counts first', () => {
    const progress = runProgress(shared(there()), [count(1, 20, true), count(3, 4, false)]);
    expect(progress.bins.map((bin) => [bin.state, bin.units, bin.by])).toEqual([
      ['counted', 20, null],
      ['taken', 3, 'Ali'],
      ['counting', 4, null],
    ]);
    expect(progress.mine).toBe(1);
    expect(progress.next?.code).toBe('B-01');
  });

  it('lets a bin go when its count has had no scan for 2 hours, or is the caller’s own from elsewhere', () => {
    expect(runProgress(shared(there([{}, { active: false }])), []).bins[1].state).toBe('not-started');
    expect(runProgress(shared(there([{}, { mine: true }])), []).bins[1].state).toBe('not-started');
    // Counted by the same person on another phone: counted, but not by someone else.
    expect(runProgress(shared(there([{ mine: true }])), []).bins[0]).toMatchObject({ state: 'counted', by: null });
  });

  it('is done when everyone together has counted every bin, and says who finished it', () => {
    const all = there([{}, { state: 'counted', active: false }, { state: 'counted', by: 'Ali', stocktakeId: 'x3', units: 1 }]);
    expect(runProgress(shared(all), []).done).toBe(true);
    const finished = runProgress(shared({ ...all, status: 'finished', finishedBy: 'Ali', finishedAt: '2026-10-28T11:00:00Z' }), []);
    expect(finished.closed).toEqual({ by: 'Ali', at: '2026-10-28T11:00:00Z' });
  });

  it('ignores PartsLogic’s word for a run this phone keeps alone, or for another run', () => {
    expect(runProgress({ ...run, status: there() }, []).bins.every((bin) => bin.state === 'not-started')).toBe(true);
    expect(runProgress(shared({ ...there(), runId: 'other' }), []).counted).toBe(0);
  });
});

describe('peopleText', () => {
  it('names up to three people, then counts the rest', () => {
    expect(peopleText([])).toBe('');
    expect(peopleText(['Sam'])).toBe('Sam');
    expect(peopleText(['Sam', 'Ali'])).toBe('Sam and Ali');
    expect(peopleText(['Sam', 'Ali', 'Jo'])).toBe('Sam, Ali and Jo');
    expect(peopleText(['Sam', 'Ali', 'Jo', 'Kim'])).toBe('Sam, Ali and 2 others');
  });
});
