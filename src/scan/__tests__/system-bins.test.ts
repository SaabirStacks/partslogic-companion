import { isSystemBin } from '../system-bins';

describe('isSystemBin', () => {
  it('knows the two bins PartsLogic never counts, however they are typed', () => {
    expect(isSystemBin('UNBINNED')).toBe(true);
    expect(isSystemBin(' unassigned ')).toBe(true);
    expect(isSystemBin('A-01')).toBe(false);
    expect(isSystemBin('UNBINNED-2')).toBe(false);
  });
});
