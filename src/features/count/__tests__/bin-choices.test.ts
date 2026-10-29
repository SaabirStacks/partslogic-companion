import type { BinSummary } from '@/vendor/partslogic/shared/settings';

import { binChoices, countedShort, countedText, exactBin, filterBins, lastCountedByBin } from '../bin-choices';

const bin = (id: number, code: string, extra: Partial<BinSummary> = {}): BinSummary => ({
  id,
  code,
  description: null,
  isActive: true,
  isSystem: false,
  units: 0,
  parts: 0,
  ...extra,
});

describe('lastCountedByBin', () => {
  it('keeps the newest count of each bin, and a full stock take with no list counts every bin', () => {
    const last = lastCountedByBin(
      [
        { kind: 'bin', binIds: [1], postedAt: '2026-10-03T10:00:00Z' },
        { kind: 'bin', binIds: [1], postedAt: '2026-10-09T10:00:00Z' },
        { kind: 'full', binIds: null, postedAt: '2026-09-01T10:00:00Z' },
      ],
      [1, 2],
    );
    expect(last.get(1)).toBe('2026-10-09T10:00:00Z');
    expect(last.get(2)).toBe('2026-09-01T10:00:00Z');
    expect(last.get(3)).toBeUndefined();
  });
});

describe('binChoices', () => {
  it('lists shelf bins in label order, leaving out Unbinned and inactive bins', () => {
    const choices = binChoices(
      [bin(1, 'A-10'), bin(2, 'UNBINNED', { isSystem: true }), bin(3, 'A-2'), bin(4, 'B-01', { isActive: false })],
      new Map([[3, '2026-10-03T10:00:00Z']]),
    );
    expect(choices.map((choice) => choice.code)).toEqual(['A-2', 'A-10']);
    expect(choices[0].lastCounted).toBe('2026-10-03T10:00:00Z');
    expect(choices[1].lastCounted).toBeNull();
  });
});

describe('filterBins and exactBin', () => {
  const choices = binChoices([bin(1, 'A-01'), bin(2, 'A-02'), bin(3, 'BA-01')], new Map());

  it('puts names that start with what is typed first, ignoring case and dashes', () => {
    expect(filterBins(choices, 'a01').map((choice) => choice.code)).toEqual(['A-01', 'BA-01']);
    expect(filterBins(choices, '')).toHaveLength(3);
  });

  it('finds the bin a typed name means exactly', () => {
    expect(exactBin(choices, 'a 02')?.binId).toBe(2);
    expect(exactBin(choices, 'A-0')).toBeNull();
  });
});

describe('countedText', () => {
  const now = new Date('2026-10-28T12:00:00');

  it('says when a bin was last counted, briefly', () => {
    expect(countedText(null, now)).toBe('Never counted');
    expect(countedText('2026-10-28T08:00:00', now)).toBe('Counted today');
    expect(countedText('2026-10-03T08:00:00', now)).toBe('Counted 3 Oct');
    expect(countedText('2025-10-03T08:00:00', now)).toBe('Counted 3 Oct 2025');
  });
});

describe('countedShort', () => {
  const now = new Date('2026-10-28T12:00:00');

  it('says the same in a few letters, for a tile', () => {
    expect(countedShort(null, now)).toBe('Never');
    expect(countedShort('2026-10-28T08:00:00', now)).toBe('Today');
    expect(countedShort('2026-10-03T08:00:00', now)).toBe('3 Oct');
    expect(countedShort('2025-10-03T08:00:00', now)).toBe('3 Oct 2025');
  });
});
