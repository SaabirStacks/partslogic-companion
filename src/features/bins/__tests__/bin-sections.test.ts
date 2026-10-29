import type { BinChoice } from '@/features/count/bin-choices';

import { aisleOf, binSections } from '../bin-sections';

const bin = (binId: number, code: string): BinChoice => ({ binId, code, description: null, units: 0, lastCounted: null });
const bins = [bin(1, '00-A-01'), bin(2, '00-A-02'), bin(3, '02-A-01'), bin(4, '8-A-01'), bin(5, 'RACK')];

describe('aisleOf', () => {
  it('is the name up to the first dash', () => {
    expect(aisleOf('02-A-01')).toBe('02');
    expect(aisleOf('RACK')).toBe('RACK');
  });
});

describe('binSections', () => {
  it('groups bins by aisle while browsing, in the order given', () => {
    expect(binSections(bins, '').map((section) => [section.title, section.data.map((choice) => choice.code)])).toEqual([
      ['00', ['00-A-01', '00-A-02']],
      ['02', ['02-A-01']],
      ['8', ['8-A-01']],
      ['RACK', ['RACK']],
    ]);
  });

  it('lists matches together while searching, leaving out the bin stock is leaving', () => {
    expect(binSections(bins, '00a', new Set([1]))).toEqual([{ title: null, data: [bins[1]] }]);
    expect(binSections(bins, 'ZZ')).toEqual([]);
  });
});
