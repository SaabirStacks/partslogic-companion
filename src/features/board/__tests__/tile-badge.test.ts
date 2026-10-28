import type { OpenWork } from '../open-work';
import { tileBadge } from '../tile-badge';

const startedAt = '2026-10-29T09:14:00.000Z';
const work: OpenWork[] = [
  { kind: 'delivery', from: 'BGA', units: 12, startedAt },
  { kind: 'count', workflow: 'stock-count', bin: 'A-01', units: 3, startedAt },
  { kind: 'run', runId: 'r1', workflow: 'stock-take', counted: 1, total: 4, counting: null, startedAt },
];

describe('tileBadge', () => {
  it('marks each job with its own open work, in amber', () => {
    expect(tileBadge('receive', work, null)).toEqual({ label: 'Open', tone: 'warn' });
    expect(tileBadge('stock-count', work, null)).toMatchObject({ label: 'Counting', tone: 'warn', spoken: 'counting bin A-01' });
    expect(tileBadge('stock-take', work, null)).toMatchObject({ label: '1 of 4', tone: 'warn' });
    expect(tileBadge('transfer', work, null)).toBeNull();
  });

  it('shows an opening-stock run on Stock take, where it starts', () => {
    const opening: OpenWork = { kind: 'run', runId: 'r2', workflow: 'opening-stock', counted: 0, total: 2, counting: 'B-02', startedAt };
    expect(tileBadge('stock-take', [opening], null)).toMatchObject({ label: '0 of 2' });
  });

  it('shows Put away what is waiting in Unbinned in blue, unless a put away is open', () => {
    expect(tileBadge('put-away', [], 1240)).toMatchObject({ label: '1,240 waiting', tone: 'action' });
    expect(tileBadge('put-away', [], 0)).toBeNull();
    expect(tileBadge('put-away', [], null)).toBeNull();
    expect(tileBadge('put-away', [{ kind: 'count', workflow: 'put-away', bin: 'C-03', units: 1, startedAt }], 24)).toMatchObject({ label: 'Counting' });
  });
});
