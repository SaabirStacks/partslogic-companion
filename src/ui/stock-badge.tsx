import { Text, View } from 'react-native';

import type { StockBadge as Badge } from '@/features/part/stock';

// Out in red at 10%, Reorder in amber at 20% with a 60% border, as in PartsLogic's DESIGN.md.
export function StockBadge({ badge }: { badge: Badge }) {
  if (badge === 'out') {
    return (
      <View className="rounded-full bg-out/10 px-2.5 py-0.5">
        <Text className="text-sm font-semibold text-out">Out</Text>
      </View>
    );
  }
  if (badge === 'reorder') {
    return (
      <View className="rounded-full border border-reorder/60 bg-reorder/20 px-2.5 py-0.5">
        <Text className="text-sm font-semibold text-reorder-ink">Reorder</Text>
      </View>
    );
  }
  return null;
}
