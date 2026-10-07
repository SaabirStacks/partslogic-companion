import type { InventoryRow } from '@/vendor/partslogic/shared/inventory';
import { formatMoney } from '@/vendor/partslogic/web/inventory-display';

// PartsLogic's stock badge rule (DESIGN.md, "Stock cell"): Out when a stocked part is at or below zero,
// Reorder when it is below its reorder level, never both.
export type StockBadge = 'out' | 'reorder' | null;

export function stockBadge(item: Pick<InventoryRow, 'isStocked' | 'onHand' | 'belowReorder'>): StockBadge {
  if (item.isStocked && item.onHand <= 0) return 'out';
  if (item.belowReorder) return 'reorder';
  return null;
}

// Figures are formatted by the web app's own helpers (copied in from PartsLogic's lib/inventory-display.ts),
// so the phone and the back office show money and quantities the same way.
export { formatQty } from '@/vendor/partslogic/web/inventory-display';

// A price, or nothing when there isn't one.
export function formatPrice(amount: number | null, currency: string): string | null {
  return amount == null ? null : formatMoney(amount, currency);
}
