import { DataError } from '@/vendor/partslogic/shared/errors';

import { moveProblem, outcomeUnknown } from '../move-rules';

describe('moveProblem', () => {
  const base = { fromBinId: 1, toBinId: 2, qty: 3, available: 5 };

  it('accepts a move within what the bin holds', () => {
    expect(moveProblem(base)).toBeNull();
    expect(moveProblem({ ...base, qty: 5 })).toBeNull();
  });

  it('makes the same refusals as transfer_stock', () => {
    expect(moveProblem({ ...base, toBinId: null })).toMatch(/Scan or choose/);
    expect(moveProblem({ ...base, toBinId: 1 })).toMatch(/different bin/);
    expect(moveProblem({ ...base, qty: 0 })).toBe('Move at least one.');
    expect(moveProblem({ ...base, qty: 6 })).toBe('Only 5 in that bin.');
  });
});

describe('outcomeUnknown', () => {
  it('treats a lost reply as unknown, and a refusal as a plain no', () => {
    expect(outcomeUnknown(new Error('Network request failed'))).toBe(true);
    expect(outcomeUnknown(new DataError('Only 2 in that bin', 'P0001'))).toBe(false);
  });
});
