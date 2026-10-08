import type { StockBadge as Badge } from '@/features/part/stock';

import { Plate, TEXT_ON } from './plate';
import { SignText } from './sign-text';

// Out is a red stop plate and Reorder a yellow check-it plate, each with its word (never colour alone).
// PartsLogic's rule decides which (features/part/stock.ts).
export function StockBadge({ badge }: { badge: Badge }) {
  if (!badge) return null;
  const tone = badge === 'out' ? 'stop' : 'warning';
  return (
    <Plate tone={tone} className="px-2 py-0.5">
      <SignText size="tag" weight="heavy" ink={TEXT_ON[tone]}>
        {badge === 'out' ? 'Out' : 'Reorder'}
      </SignText>
    </Plate>
  );
}
