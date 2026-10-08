import { formatPrice, formatQty, stockBadge } from '@/features/part/stock';
import type { IconName } from '@/ui/icons';
import type { Tone } from '@/ui/palette';
import type { PartDetail } from '@/vendor/partslogic/shared/catalogue';

export type PartAnswer = {
  tone: Tone;
  status: { icon: IconName; label: string };
  name: string | null;
  onHand: string | null;
  // The bins holding the most, as many as fit on the plate, and how many more there are.
  bins: { binId: number; place: string; qty: string }[];
  moreBins: number;
  price: string | null;
};

const SHOWN_BINS = 3;

// What a scanned part's plate says. Its colour is the stock sign: red when out, yellow when it needs
// reordering (PartsLogic's own rule, see stock.ts), white otherwise.
export function partAnswer(detail: PartDetail, currency: string): PartAnswer {
  const { item } = detail;
  const name = detail.displayName ?? detail.part.description;
  if (!item) {
    return { tone: 'surface', status: { icon: 'close', label: 'Not in your range' }, name, onHand: null, bins: [], moreBins: 0, price: null };
  }
  const badge = stockBadge(item);
  const stocked = item.stock.filter((line) => line.qty > 0).sort((a, b) => b.qty - a.qty);
  return {
    tone: badge === 'out' ? 'stop' : badge === 'reorder' ? 'warning' : 'surface',
    status:
      badge === 'out'
        ? { icon: 'stop', label: 'Out of stock' }
        : badge === 'reorder'
          ? { icon: 'warning', label: 'Reorder' }
          : item.onHand > 0
            ? { icon: 'check', label: 'In stock' }
            : { icon: 'close', label: 'None on hand' },
    name,
    onHand: formatQty(item.onHand),
    bins: stocked.slice(0, SHOWN_BINS).map((line) => ({ binId: line.binId, place: line.place, qty: formatQty(line.qty) })),
    moreBins: Math.max(0, stocked.length - SHOWN_BINS),
    price: formatPrice(item.sellPrice, currency),
  };
}
