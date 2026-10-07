import type { InventoryRow } from '@/vendor/partslogic/shared/inventory';

// PartsLogic's stock badge rule (DESIGN.md, "Stock cell"): Out when a stocked part is at or below zero,
// Reorder when it is below its reorder level, never both.
export type StockBadge = 'out' | 'reorder' | null;

export function stockBadge(item: Pick<InventoryRow, 'isStocked' | 'onHand' | 'belowReorder'>): StockBadge {
  if (item.isStocked && item.onHand <= 0) return 'out';
  if (item.belowReorder) return 'reorder';
  return null;
}

export function formatMoney(amount: number | null, currency: string): string | null {
  if (amount == null) return null;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
}

export function formatQty(qty: number): string {
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(qty);
}
