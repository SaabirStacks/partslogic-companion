import type { UnlocatedLine } from '@/vendor/partslogic/shared/floor';

import { waitingRows } from '../waiting';

const line = (partId: number, qty: number): UnlocatedLine => ({ partId, brand: 'Bosch', number: `P${partId}`, qty, binId: 99, place: 'MAIN/UNBINNED' });

describe('waitingRows', () => {
  const shelves = new Map([
    [1, 'A-01'],
    [2, 'A-02'],
    [3, 'B-01'],
  ]);

  it('names each waiting part with the shelf holding most of it, in the order PartsLogic sent', () => {
    const rows = waitingRows(
      [line(10, 4), line(11, 2), line(12, 1)],
      [
        { partId: 10, binId: 1, qty: 2 },
        { partId: 10, binId: 2, qty: 6 },
        { partId: 11, binId: 99, qty: 2 },
        { partId: 11, binId: 3, qty: 0 },
      ],
      shelves,
    );
    expect(rows.map((row) => [row.name, row.qty, row.shelf?.code ?? null])).toEqual([
      ['Bosch P10', 4, 'A-02'],
      ['Bosch P11', 2, null],
      ['Bosch P12', 1, null],
    ]);
  });

  it('breaks a tie by shelf name', () => {
    const [row] = waitingRows([line(10, 1)], [{ partId: 10, binId: 3, qty: 5 }, { partId: 10, binId: 1, qty: 5 }], shelves);
    expect(row.shelf).toEqual({ binId: 1, code: 'A-01' });
  });
});
