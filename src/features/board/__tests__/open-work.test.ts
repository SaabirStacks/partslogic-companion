import { clock } from '@/lib/format';

import type { BinCount } from '@/features/count/count-store';
import type { CountRun } from '@/features/count/run-store';
import { emptyBinSession } from '@/vendor/partslogic/shared/bin-session';

import { openWorkKey, resumeText, runWork } from '../open-work';

const startedAt = '2026-10-08T09:14:00.000Z';

describe('resumeText', () => {
  it('describes an open delivery by who it is from', () => {
    expect(resumeText({ kind: 'delivery', from: 'BGA', units: 12, startedAt })).toMatchObject({ title: 'Delivery from BGA' });
  });

  it('describes a delivery started before the phone asked who it was from', () => {
    expect(resumeText({ kind: 'delivery', from: null, units: 12, startedAt })).toEqual({
      title: 'Delivery',
      detail: `12 units · started ${clock(startedAt)}`,
      href: '/receive',
    });
  });

  it('describes an open bin count by its bin', () => {
    expect(resumeText({ kind: 'count', bin: 'A-01', units: 1, startedAt })).toEqual({
      title: 'Bin A-01',
      detail: `1 unit · started ${clock(startedAt)}`,
      href: '/count',
    });
  });

  it('describes a paused stock take by how far it got, and the bin being counted if one is', () => {
    const run = { kind: 'run' as const, runId: 'r1', workflow: 'stock-take' as const, counted: 1, total: 4, startedAt };
    expect(resumeText({ ...run, counting: null })).toEqual({
      title: 'Stock take',
      detail: `1 of 4 bins · started ${clock(startedAt)}`,
      href: { pathname: '/count', params: { purpose: 'stock-take' } },
    });
    expect(resumeText({ ...run, workflow: 'opening-stock', counting: 'A-02' })).toMatchObject({ title: 'Opening stock', detail: 'Counting A-02 · 1 of 4 bins' });
  });
});

describe('runWork', () => {
  const run: CountRun = {
    runId: 'r1',
    userId: 'u',
    workflow: 'opening-stock',
    locationId: 1,
    locationName: 'Main',
    bins: [
      { binId: 1, code: 'A-01' },
      { binId: 2, code: 'A-02' },
    ],
    startedAt,
    finishedAt: null,
  };
  const count = (binId: number, finished: boolean): BinCount => ({
    stocktakeId: `s${binId}`,
    userId: 'u',
    binId,
    binCode: `A-0${binId}`,
    location: 'MAIN',
    startedAt,
    session: emptyBinSession(`s${binId}`, startedAt),
    labels: {},
    finishedAt: finished ? startedAt : null,
    workflow: 'opening-stock',
    runId: 'r1',
  });

  it('counts the bins done and names the one being counted', () => {
    expect(runWork(run, [count(1, true), count(2, false)])).toEqual({
      kind: 'run',
      runId: 'r1',
      workflow: 'opening-stock',
      counted: 1,
      total: 2,
      counting: 'A-02',
      startedAt,
    });
  });

  it('keeps two runs apart on the board', () => {
    expect(openWorkKey(runWork(run, []))).toBe('run:r1');
    expect(openWorkKey({ kind: 'count', bin: 'A-01', units: 1, startedAt })).toBe('count');
  });
});
