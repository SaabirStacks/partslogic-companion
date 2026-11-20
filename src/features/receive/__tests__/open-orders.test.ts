import type { ExpectedDelivery, OpenOrderLine } from '@/vendor/partslogic/shared/purchasing';

import type { LineGroup } from '../lines';
import { checkCounts, checkText, customerNotice, customerParts, deliveryCheck, expectedText, expectedToday, onOpenOrder, putAsideLines, receiptShares } from '../open-orders';

const due = (partId: number, qty: number, extra: Partial<OpenOrderLine> = {}): OpenOrderLine => ({
  orderId: 'o1', number: 'PO-000014', ourReference: 'STOCK', expectedOn: '2026-11-09', expectedFrom: null, expectedBy: null,
  expectedRun: null, lineId: partId, partId, brand: 'MINTEX', partNumber: `MDB${partId}`, supplierCode: null, description: null,
  reference: null, due: qty, packQty: 1, unit: null, ...extra,
});
const group = (code: string, partId: number | null, total: number, label: string | null = null): LineGroup => ({
  code, label, partId, total, status: 'booked', reason: null, lastAt: '',
});

// Monday 9 November 2026, mid-afternoon in London.
const NOW = new Date('2026-11-09T15:00:00Z');

describe('onOpenOrder', () => {
  it('says whether a scanned part is on an open order, or that it can’t tell', () => {
    expect(onOpenOrder(1, [due(1, 2)])).toBe(true);
    expect(onOpenOrder(9, [due(1, 2)])).toBe(false);
    expect(onOpenOrder(1, null)).toBeNull();
    expect(onOpenOrder(null, [due(1, 2)])).toBeNull();
  });
});

describe('deliveryCheck', () => {
  it('compares what was counted with what is due: short, over, not ordered, not here, OK', () => {
    const rows = deliveryCheck(
      [group('5012345', 1, 4), group('MDB2', 2, 1), group('WB55', 9, 1, 'BGA WB55'), group('???', null, 3), group('MDB3', 3, 3)],
      [due(1, 4), due(2, 2), due(3, 1), due(4, 1), due(5, 1, { expectedOn: '2026-11-12' })],
      NOW,
    );
    expect(rows.map((row) => [row.partNumber, row.verdict])).toEqual([
      ['MDB2', 'short'],
      ['MDB3', 'over'],
      ['BGA WB55', 'not_ordered'],
      ['MDB4', 'not_arrived'],
      ['MDB1', 'matched'],
    ]);
    expect(checkCounts(rows)).toEqual({ matched: 1, short: 1, over: 1, notOrdered: 1, notArrived: 1 });
  });

  it('nets undos, and names the job a part is for', () => {
    const [row] = deliveryCheck([group('MDB1', 1, 1)], [due(1, 1, { reference: 'AB12 CDE' })], NOW);
    expect(row).toMatchObject({ verdict: 'matched', references: ['AB12 CDE'] });
  });

  it('words each verdict', () => {
    const rows = deliveryCheck([group('MDB1', 1, 2), group('MDB2', 2, 5)], [due(1, 4), due(2, 2)], NOW);
    expect(rows.map(checkText)).toEqual(['2 counted · 4 due · 2 stay on order', '5 counted · 2 due · 3 extra']);
    expect(checkText({ ...rows[0]!, counted: 3 })).toBe('3 counted · 4 due · 1 stays on order');
  });
});

describe('expectedToday', () => {
  const row = (id: string, supplierId: number, supplier: string, dueGroup: ExpectedDelivery['due'], from: string | null): ExpectedDelivery => ({
    id, number: id, supplierId, supplier, locationId: 359, locationCode: 'EM12', ourReference: null, expectedOn: '2026-11-09',
    expectedFrom: from, expectedBy: from ? '15:00' : null, expectedRun: from ? 'Afternoon van' : null, linesDue: 1, unitsDue: 1,
    placedAt: null, due: dueGroup,
  });

  it('gives one entry per supplier due today or overdue: overdue first, then by when the van comes', () => {
    const suppliers = expectedToday([
      row('PO-1', 2, 'FPS', 'today', '13:00'),
      row('PO-2', 2, 'FPS', 'today', '08:00'),
      row('PO-3', 5, 'Comline', 'overdue', null),
      row('PO-4', 7, 'BGA', 'tomorrow', '08:00'),
    ]);
    expect(suppliers.map((supplier) => [supplier.name, supplier.orders, supplier.overdue, supplier.window])).toEqual([
      ['Comline', 1, true, null],
      ['FPS', 2, false, '08:00–15:00'],
    ]);
    expect(suppliers.map(expectedText)).toEqual(['1 order overdue', '2 orders due today · 08:00–15:00']);
  });
});

describe('goods in for customers (S4b)', () => {
  const open = [
    due(1, 2, { forOrder: 'SO-000051', forCustomer: 'Aire Road Garage' }),
    due(1, 1, { forOrder: 'SO-000058', forCustomer: 'Bradford Taxis' }),
    due(1, 1),
    due(2, 1, { forOrder: 'SO-000061', forCustomer: 'Hillside Garage' }),
    due(2, 4),
  ];

  it('says who a scanned part is for, without a quantity', () => {
    expect(customerNotice(2, open)).toBe('For SO-000061 · Hillside Garage');
    expect(customerNotice(1, open)).toBe('For SO-000051 and SO-000058');
    expect(customerNotice(3, open)).toBeNull();
    expect(customerNotice(2, null)).toBeNull();
  });

  it('splits a count at Check, customers first, then Unbinned, and adds it up for the receipt', () => {
    const rows = deliveryCheck([group('MDB1', 1, 3), group('MDB2', 2, 5)], open, NOW);
    expect(customerParts(rows)).toBe(2);
    const short = rows.find((row) => row.partId === 1)!;
    expect(putAsideLines(short).map((line) => line.text)).toEqual(['Put 2 aside for SO-000051 · Aire Road Garage', 'Put 1 aside for SO-000058 · Bradford Taxis']);
    const matched = rows.find((row) => row.partId === 2)!;
    expect(putAsideLines(matched).map((line) => line.text)).toEqual(['Put 1 aside for SO-000061 · Hillside Garage', '4 into Unbinned']);
    expect(receiptShares(rows)).toEqual([
      { order: 'SO-000051', customer: 'Aire Road Garage', units: 2 },
      { order: 'SO-000058', customer: 'Bradford Taxis', units: 1 },
      { order: 'SO-000061', customer: 'Hillside Garage', units: 1 },
    ]);
  });
});
