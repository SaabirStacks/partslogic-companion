import { STOCK_STATUSES, statusOf, stockBreakdown, stockByBin } from '../statuses';

test('every status sits in one of the three groups, and only unavailable stock is held or locked', () => {
  for (const status of Object.values(STOCK_STATUSES)) {
    expect(['available', 'reserved', 'unavailable']).toContain(status.group);
    expect(status.hold === null).toBe(status.group !== 'unavailable');
  }
  expect(Object.values(STOCK_STATUSES).filter((s) => s.group === 'reserved').map((s) => s.code)).toEqual(['RESV', 'XDOCK']);
});

test('stock without a status is available, as all of it is today', () => {
  expect(stockBreakdown(12, [{ qty: 8 }, { qty: 4 }])).toEqual({ onHand: 12, available: 12, reserved: 0, unavailable: 0, setAside: [] });
});

test('the three groups always add up to on hand', () => {
  const b = stockBreakdown(12, [
    { qty: 7, status: 'AVAIL' },
    { qty: 2, status: 'RESV' },
    { qty: 1, status: 'QAHOLD' },
    { qty: 1, status: 'DAMG' },
    { qty: 1, status: 'xdock' },
  ]);
  expect([b.available, b.reserved, b.unavailable]).toEqual([7, 3, 2]);
  expect(b.available + b.reserved + b.unavailable).toBe(b.onHand);
  expect(b.setAside.map((entry) => [entry.status.name, entry.qty])).toEqual([
    ['Reserved', 2],
    ['Cross-dock', 1],
    ['QA hold', 1],
    ['Damaged', 1],
  ]);
});

test('a status this phone does not know is locked, never sellable', () => {
  expect(statusOf('QUARANTINE')).toMatchObject({ group: 'unavailable', hold: 'locked', name: 'QUARANTINE' });
  expect(stockBreakdown(3, [{ qty: 3, status: 'QUARANTINE' }]).available).toBe(0);
});

test('a bin sent once per status becomes one row with what in it is set aside', () => {
  const rows = stockByBin([
    { binId: 1, place: 'A-01', qty: 6 },
    { binId: 1, place: 'A-01', qty: 2, status: 'RESV' },
    { binId: 2, place: 'C-03', qty: 4 },
  ]);
  expect(rows.map((row) => [row.line.place, row.qty, row.setAside.map((s) => s.status.code)])).toEqual([
    ['A-01', 8, ['RESV']],
    ['C-03', 4, []],
  ]);
});
