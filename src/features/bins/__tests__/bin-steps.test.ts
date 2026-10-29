import type { BinChoice } from '@/features/count/bin-choices';

import { binParts, binStep, binsUnder } from '../bin-steps';

let nextId = 1;
const bin = (code: string): BinChoice => ({ binId: nextId++, code, description: null, units: 0, lastCounted: null });
// As MAIN will be: even aisles 00 to 24 (8 standing in for 08), letters A to E, numbers 01 to 10.
const aisles = ['00', '02', '04', '06', '8', '10', '12', '14', '16', '18', '20', '22', '24'];
const main = aisles.flatMap((aisle) =>
  ['A', 'B', 'C', 'D', 'E'].flatMap((letter) =>
    Array.from({ length: 10 }, (_, n) => bin(`${aisle}-${letter}-${String(n + 1).padStart(2, '0')}`)),
  ),
);
const labels = (path: string[], bins: BinChoice[] = main) => binStep(bins, path).tiles.map((tile) => tile.label);

describe('binParts', () => {
  it('splits a name at its dashes, in capitals', () => {
    expect(binParts('02-B-03')).toEqual(['02', 'B', '03']);
    expect(binParts('02-b -03')).toEqual(['02', 'B', '03']);
    expect(binParts('RACK')).toEqual(['RACK']);
  });
});

describe('binStep', () => {
  it('starts with every aisle, in number order, asking for the aisle', () => {
    const step = binStep(main, []);
    expect(step.tiles.map((tile) => tile.label)).toEqual(aisles);
    expect(step.shown).toEqual(['?', '?', '?']);
    expect(step.ask).toBe('aisle');
    expect(step.count).toBe(650);
    expect(step.tiles[0]).toMatchObject({ bin: null, path: ['00'] });
    expect(step.tiles[0].bins).toHaveLength(50);
  });

  it('then the letters in that aisle, then its numbers, each number being one bin', () => {
    const letters = binStep(main, ['02']);
    expect(letters.tiles.map((tile) => tile.label)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(letters.shown).toEqual(['02', '?', '?']);
    expect(letters.ask).toBe('letter');

    const numbers = binStep(main, ['02', 'B']);
    expect(numbers.tiles.map((tile) => tile.label)).toEqual(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']);
    expect(numbers.shown).toEqual(['02', 'B', '?']);
    expect(numbers.ask).toBe('number');
    expect(numbers.tiles[2].bin?.code).toBe('02-B-03');
  });

  it('only offers what the location has', () => {
    const few = [bin('02-A-01'), bin('8-A-01'), bin('8-A-02'), bin('8-C-01')];
    expect(labels([], few)).toEqual(['02', '8']);
    expect(labels(['8'], few)).toEqual(['A', 'C']);
    expect(labels(['02'], few)).toEqual(['A']);
  });

  it('handles names of other shapes', () => {
    const odd = [bin('RACK'), bin('02-A'), bin('02-A-01'), bin('02-A-02'), bin('TOP-1')];
    const root = binStep(odd, []);
    expect(root.tiles.map((tile) => [tile.label, tile.bin?.code ?? null])).toEqual([
      ['02', null],
      ['RACK', 'RACK'],
      ['TOP', null],
    ]);
    // 02-A is a bin and the start of others: its tile opens the next step, where 02-A is a tile of its own.
    expect(binStep(odd, ['02']).tiles.map((tile) => [tile.label, tile.bin?.code ?? null])).toEqual([['A', null]]);
    const inside = binStep(odd, ['02', 'A']);
    expect(inside.tiles.map((tile) => [tile.label, tile.bin?.code ?? null])).toEqual([
      ['02-A', '02-A'],
      ['01', '02-A-01'],
      ['02', '02-A-02'],
    ]);
    expect(inside.ask).toBe('number');
    expect(binStep(odd, ['TOP']).ask).toBe('number');
  });

  it('shows nothing under parts no bin has (the list changed)', () => {
    const gone = binStep(main, ['99']);
    expect(gone.tiles).toEqual([]);
    expect(gone.shown).toEqual(['99']);
    expect(gone.count).toBe(0);
  });
});

describe('binsUnder', () => {
  it('is every bin under the parts chosen', () => {
    expect(binsUnder(main, ['02', 'B'])).toHaveLength(10);
    expect(binsUnder(main, ['02'])).toHaveLength(50);
    expect(binsUnder(main, [])).toHaveLength(650);
  });
});
