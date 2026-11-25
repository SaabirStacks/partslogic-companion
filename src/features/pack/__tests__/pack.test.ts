import type { PackingOrder } from '@/vendor/partslogic/shared/sales/picking';

import { boxTotals, inBox, openBox, packMethod, scanIntoBox, setLine, stepLine } from '../pack';
import { boxCount, packingDetail } from '../words';

const order: PackingOrder = {
  orderId: 'o15',
  order: 'SO-000015',
  customer: 'Northway Fleet Services',
  urgent: false,
  units: 3,
  address: null,
  addressText: '12 Mill Lane, Shipley BD18 3AB',
  lines: [
    { lineId: 1, part: { id: 6, brand: 'MANN-FILTER', number: 'C 35 154', description: null }, qty: 2 },
    { lineId: 2, part: { id: 9, brand: 'BOSCH', number: '0 986 452 041', description: 'Oil filter' }, qty: 1 },
  ],
};

describe('packing a delivery on the phone', () => {
  it('scans each part into the box until every unit is in', () => {
    let box = openBox(order);
    expect(boxTotals(box)).toEqual({ units: 3, inBox: 0, ready: false });
    box = scanIntoBox(box, 6).box;
    expect(boxCount(box.lines[0])).toBe('1 of 2 in the box');
    const second = scanIntoBox(box, 6);
    expect(second.outcome).toMatchObject({ kind: 'added', complete: true });
    expect(scanIntoBox(second.box, 6).outcome).toMatchObject({ kind: 'spare' });
    expect(scanIntoBox(second.box, 77).outcome).toEqual({ kind: 'not_on_order' });
    box = scanIntoBox(second.box, 9).box;
    expect(boxTotals(box)).toEqual({ units: 3, inBox: 3, ready: true });
    expect(packMethod(box)).toBe('scan');
  });

  it('puts a part in without a scan, and takes one out', () => {
    let box = stepLine(openBox(order), 2, 1);
    expect(inBox(box.lines[1])).toBe(1);
    expect(stepLine(box, 2, 1)).toBe(box);
    expect(packMethod(box)).toBe('tap');
    box = setLine(box, 1, 5);
    expect(box.lines[0]).toMatchObject({ scanned: 0, tapped: 2 });
    box = stepLine(box, 1, -1);
    expect(inBox(box.lines[0])).toBe(1);
    expect(setLine(box, 1, -1)).toBe(box);
  });

  it('says where it goes', () => {
    expect(packingDetail(order)).toMatch(/^Northway Fleet Services · /);
  });
});
