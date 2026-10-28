import type { OpenWork } from '../open-work';
import { tileDetail } from '../tile-detail';

const startedAt = '2026-10-29T09:14:00.000Z';
const work: OpenWork[] = [
  { kind: 'delivery', from: 'BGA', units: 12, startedAt },
  { kind: 'count', workflow: 'stock-count', bin: 'A-01', units: 3, startedAt },
  { kind: 'run', runId: 'r1', workflow: 'stock-take', counted: 1, total: 4, counting: null, startedAt },
  { kind: 'run', runId: 'r2', workflow: 'opening-stock', counted: 0, total: 2, counting: 'B-02', startedAt },
];

describe('tileDetail', () => {
  it('shows each job its own open work or progress', () => {
    expect(tileDetail('receive', work, null)).toBe('Open · 12 units');
    expect(tileDetail('stock-count', work, null)).toBe('Counting A-01');
    expect(tileDetail('stock-take', work, null)).toBe('1 of 4 bins');
    expect(tileDetail('opening-stock', work, null)).toBe('0 of 2 bins');
    expect(tileDetail('transfer', work, null)).toBeNull();
  });

  it('shows Put away what is waiting in Unbinned, unless a put away is open', () => {
    expect(tileDetail('put-away', [], 24)).toBe('24 in Unbinned');
    expect(tileDetail('put-away', [], 0)).toBeNull();
    expect(tileDetail('put-away', [], null)).toBeNull();
    expect(tileDetail('put-away', [{ kind: 'count', workflow: 'put-away', bin: 'C-03', units: 1, startedAt }], 24)).toBe('Counting C-03');
  });
});
