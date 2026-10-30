import { binName, otherLocationName } from '../bin-name';

const MAIN = { id: 1, code: 'EM12', name: 'MAIN' };
const RETAIL = { id: 2, code: 'EM13', name: 'RETAIL' };
const ALL = [MAIN, RETAIL];

describe('binName', () => {
  it('drops the phone’s own location', () => {
    expect(binName('EM12/00-A-01', MAIN, ALL)).toBe('00-A-01');
  });

  it('keeps another location’s name, never its code', () => {
    expect(binName('EM13/02-B-04', MAIN, ALL)).toBe('RETAIL · 02-B-04');
  });

  it('writes the system bins as words', () => {
    expect(binName('EM12/UNBINNED', MAIN, ALL)).toBe('Unbinned');
    expect(binName('Unassigned', MAIN, ALL)).toBe('Unassigned');
    expect(binName('EM13/UNBINNED', MAIN, ALL)).toBe('RETAIL · Unbinned');
  });

  it('leaves a bare bin name alone', () => {
    expect(binName('A-01', MAIN, ALL)).toBe('A-01');
  });

  it('shows just the bin when the location isn’t known', () => {
    expect(binName('EM99/00-A-01', MAIN, ALL)).toBe('00-A-01');
    expect(binName('EM12/00-A-01', null, [])).toBe('00-A-01');
  });
});

describe('otherLocationName', () => {
  it('names another location and stays quiet about this one', () => {
    expect(otherLocationName('EM13', MAIN, ALL)).toBe('RETAIL');
    expect(otherLocationName('EM12', MAIN, ALL)).toBeNull();
    expect(otherLocationName(null, MAIN, ALL)).toBeNull();
  });
});
