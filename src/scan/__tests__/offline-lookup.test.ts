import type { ScanIndexEntry } from '@/vendor/partslogic/shared/floor';

import { lookupKeys, pickEntry } from '../offline-lookup';

const bin = (binId: number, label: string, locationCode: string): ScanIndexEntry => ({
  kind: 'bin',
  partId: null,
  binId,
  label,
  locationCode,
});
const part = (kind: ScanIndexEntry['kind'], partId: number | null): ScanIndexEntry => ({
  kind,
  partId,
  binId: null,
  label: null,
  locationCode: null,
});

describe('lookupKeys', () => {
  it('tries the code as written, as a GTIN-14, then as a part number', () => {
    expect(lookupKeys(' 4006381333931 ')).toEqual(['4006381333931', '04006381333931']);
    expect(lookupKeys('w 712/75')).toEqual(['W 712/75', 'W71275']);
  });
});

describe('pickEntry', () => {
  it('reads a plain bin code as a bin in the working location only', () => {
    const rows = [[bin(1, 'A-01', 'MAIN'), bin(2, 'A-01', 'SHOP')]];
    expect(pickEntry(rows, 'A-01', 'SHOP')).toEqual({ type: 'bin', binId: 2, bin: 'A-01', location: 'SHOP' });
    expect(pickEntry(rows, 'A-01', 'YARD')).toEqual({ type: 'unknown' });
  });

  it('reads a plain bin code without a working location only when one bin has it', () => {
    expect(pickEntry([[bin(1, 'A-01', 'MAIN')]], 'A-01', null)).toEqual({
      type: 'bin',
      binId: 1,
      bin: 'A-01',
      location: 'MAIN',
    });
    expect(pickEntry([[bin(1, 'A-01', 'MAIN'), bin(2, 'A-01', 'SHOP')]], 'A-01', null)).toEqual({ type: 'unknown' });
  });

  it('reads LOC/BIN as that bin wherever you are', () => {
    expect(pickEntry([[bin(2, 'SHOP/A-01', 'SHOP')]], 'SHOP/A-01', 'MAIN')).toEqual({
      type: 'bin',
      binId: 2,
      bin: 'SHOP/A-01',
      location: 'SHOP',
    });
  });

  it('skips ambiguous entries and takes the next one', () => {
    expect(pickEntry([[part('ambiguous', null), part('sku', 42)]], '123', 'MAIN')).toEqual({ type: 'part', partId: 42 });
    expect(pickEntry([[part('ambiguous', null)]], '123', 'MAIN')).toEqual({ type: 'unknown' });
  });

  it('prefers the code as written over its other keys', () => {
    expect(pickEntry([[part('label', 7)], [part('gtin', 8)]], 'X', 'MAIN')).toEqual({ type: 'part', partId: 7 });
  });
});
