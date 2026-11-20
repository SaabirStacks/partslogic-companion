import {
  compareDelivery,
  customerOrdersFor,
  customerOrdersWords,
  localDate,
  windowText,
  type CustomerShare,
  type DeliveryCheckRow,
  type ExpectedDelivery,
  type OpenOrderLine,
} from '@/vendor/partslogic/shared/purchasing';

import type { LineGroup } from './lines';

// Goods in against orders on the phone (PartsLogic docs/GOODS_IN.md): count first, then compare. While scanning,
// the ordered quantities are never shown; a part on none of the supplier's open orders is pointed out (that checks
// the product, not the quantity). At Done, what was counted is compared with what is still due.

// Whether a scanned part is on one of the supplier's open orders for this location. Null when it can't be told:
// the open orders didn't load, or the code isn't a known part.
export function onOpenOrder(partId: number | null | undefined, open: readonly OpenOrderLine[] | null): boolean | null {
  if (open == null || partId == null) return null;
  return open.some((line) => line.partId === partId);
}

// The comparison at Done: one row per part counted or due by today. Parts counted that the supplier's orders don't
// list keep the name they were scanned as. Unknown codes aren't compared (the office matches them).
export function deliveryCheck(groups: readonly LineGroup[], open: readonly OpenOrderLine[], now: Date): DeliveryCheckRow[] {
  const known = groups.filter((group): group is LineGroup & { partId: number } => group.partId != null);
  const ordered = new Set(open.map((line) => line.partId));
  const labels = new Map(
    known.filter((group) => !ordered.has(group.partId)).map((group) => [group.partId, { brand: '', partNumber: group.label ?? group.code }]),
  );
  return compareDelivery(
    known.map((group) => ({ partId: group.partId, qty: group.total })),
    open,
    labels,
    localDate(now),
  );
}

export type CheckCounts = { matched: number; short: number; over: number; notOrdered: number; notArrived: number };

export function checkCounts(rows: readonly DeliveryCheckRow[]): CheckCounts {
  const counts: CheckCounts = { matched: 0, short: 0, over: 0, notOrdered: 0, notArrived: 0 };
  for (const row of rows) {
    if (row.verdict === 'matched') counts.matched += 1;
    else if (row.verdict === 'short') counts.short += 1;
    else if (row.verdict === 'over') counts.over += 1;
    else if (row.verdict === 'not_ordered') counts.notOrdered += 1;
    else counts.notArrived += 1;
  }
  return counts;
}

// What a row says under the part: "2 counted · 4 due · 2 stay on order".
export function checkText(row: DeliveryCheckRow): string {
  switch (row.verdict) {
    case 'matched':
      return `${row.counted} counted · all that was due`;
    case 'short':
      return `${row.counted} counted · ${row.due} due · ${row.due - row.counted} ${row.due - row.counted === 1 ? 'stays' : 'stay'} on order`;
    case 'over':
      return `${row.counted} counted · ${row.due} due · ${row.counted - row.due} extra`;
    case 'not_ordered':
      return `${row.counted} counted · not on an order · kept as extra`;
    case 'not_arrived':
      return `None counted · ${row.due} due today`;
  }
}

// Goods in for customers (PartsLogic docs/SALES.md 13.12): a part due on a customer's sales order is put aside for it
// on the collection and delivery shelf when the delivery is matched. While scanning, the card says who the part is
// for, never how many, so the count stays blind: "For SO-000061 · Hillside Garage".
export function customerNotice(partId: number | null | undefined, open: readonly OpenOrderLine[] | null): string | null {
  if (partId == null || !open) return null;
  return customerOrdersWords(customerOrdersFor(partId, open));
}

// At Check: how many parts go to customers, for the strip, and the lines under one part's card ("Put 2 aside for
// SO-000051 · Aire Road Garage", then "4 into Unbinned").
export function customerParts(rows: readonly DeliveryCheckRow[]): number {
  return rows.filter((row) => (row.putAside ?? []).some((share) => share.units > 0)).length;
}

export function putAsideLines(row: DeliveryCheckRow): { text: string; strong: boolean }[] {
  const shares = (row.putAside ?? []).filter((share) => share.units > 0);
  if (shares.length === 0) return [];
  const put = shares.reduce((sum, share) => sum + share.units, 0);
  const rest = row.counted - put;
  return [
    ...shares.map((share) => ({ text: `Put ${share.units} aside for ${share.order}${share.customer ? ` · ${share.customer}` : ''}`, strong: true })),
    ...(rest > 0 ? [{ text: `${rest} into Unbinned`, strong: false }] : []),
  ];
}

// The receipt's split: every customer's order and how many it takes, across the delivery's parts.
export function receiptShares(rows: readonly DeliveryCheckRow[]): CustomerShare[] {
  const byOrder = new Map<string, CustomerShare>();
  for (const share of rows.flatMap((row) => row.putAside ?? [])) {
    if (share.units <= 0) continue;
    const current = byOrder.get(share.order) ?? { order: share.order, customer: share.customer, units: 0 };
    current.units += share.units;
    byOrder.set(share.order, current);
  }
  return [...byOrder.values()].sort((a, b) => a.order.localeCompare(b.order));
}

// A supplier expected today at this location: how many orders, overdue or not, and the earliest van.
export type ExpectedSupplier = { supplierId: number; name: string; orders: number; overdue: boolean; window: string | null; run: string | null };

// Orders due today or overdue, one entry per supplier: overdue first, then by when the van comes.
export function expectedToday(rows: readonly ExpectedDelivery[]): ExpectedSupplier[] {
  const bySupplier = new Map<number, ExpectedSupplier & { from: string }>();
  for (const row of rows) {
    if (row.due !== 'overdue' && row.due !== 'today') continue;
    const current = bySupplier.get(row.supplierId);
    const from = row.expectedFrom ?? '99:99';
    if (!current) {
      bySupplier.set(row.supplierId, {
        supplierId: row.supplierId,
        name: row.supplier,
        orders: 1,
        overdue: row.due === 'overdue',
        window: windowText(row.expectedFrom, row.expectedBy),
        run: row.expectedRun,
        from,
      });
      continue;
    }
    current.orders += 1;
    current.overdue = current.overdue || row.due === 'overdue';
    if (from < current.from) {
      current.from = from;
      current.window = windowText(row.expectedFrom, row.expectedBy);
      current.run = row.expectedRun;
    }
  }
  return [...bySupplier.values()]
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.from.localeCompare(b.from) || a.name.localeCompare(b.name))
    .map(({ from: _from, ...supplier }) => supplier);
}

// "2 orders due · 13:00–15:00" or "1 order overdue".
export function expectedText(supplier: ExpectedSupplier): string {
  const orders = `${supplier.orders} ${supplier.orders === 1 ? 'order' : 'orders'}`;
  if (supplier.overdue) return `${orders} overdue`;
  return [`${orders} due today`, supplier.window ?? supplier.run].filter(Boolean).join(' · ');
}
