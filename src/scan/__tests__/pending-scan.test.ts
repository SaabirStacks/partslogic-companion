import { pendingReducer, type PendingScan } from '../pending-scan';

type Hit = { type: 'part'; partId: number };
const reduce = (state: PendingScan<Hit> | null, ...actions: Parameters<typeof pendingReducer<Hit>>[1][]) =>
  actions.reduce(pendingReducer<Hit>, state);

describe('pendingReducer', () => {
  it('holds a scan as one, waiting on its check', () => {
    expect(reduce(null, { type: 'check', key: '1', code: 'A' })).toEqual({ key: '1', code: 'A', hit: null, qty: 1 });
  });

  it('takes the answer for the scan it holds', () => {
    const held = reduce(null, { type: 'check', key: '1', code: 'A' }, { type: 'found', key: '1', hit: { type: 'part', partId: 7 } });
    expect(held?.hit).toEqual({ type: 'part', partId: 7 });
  });

  it('drops an answer for a scan already skipped or replaced', () => {
    const replaced = reduce(
      null,
      { type: 'check', key: '1', code: 'A' },
      { type: 'check', key: '2', code: 'B' },
      { type: 'found', key: '1', hit: { type: 'part', partId: 7 } },
    );
    expect(replaced).toEqual({ key: '2', code: 'B', hit: null, qty: 1 });
    expect(reduce(null, { type: 'check', key: '1', code: 'A' }, { type: 'clear' }, { type: 'found', key: '1', hit: { type: 'part', partId: 7 } })).toBeNull();
  });

  it('never lets the quantity fall below one', () => {
    const held = reduce(null, { type: 'check', key: '1', code: 'A' });
    expect(reduce(held, { type: 'step', change: -1 })?.qty).toBe(1);
    expect(reduce(held, { type: 'step', change: 1 }, { type: 'step', change: 1 })?.qty).toBe(3);
    expect(reduce(held, { type: 'set', qty: 12 })?.qty).toBe(12);
    expect(reduce(held, { type: 'set', qty: 0 })?.qty).toBe(1);
    expect(reduce(held, { type: 'set', qty: 2.5 })?.qty).toBe(1);
  });

  it('lets the scan go on clear', () => {
    expect(reduce(reduce(null, { type: 'check', key: '1', code: 'A' }), { type: 'clear' })).toBeNull();
  });
});
