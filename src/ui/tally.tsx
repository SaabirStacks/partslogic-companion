import { View } from 'react-native';

import { cx } from './cx';
import type { Tone } from './palette';
import { Plate, TEXT_INK } from './plate';
import { SignText } from './sign-text';

export type TallyItem = { value: number | string; label: string; tone?: Tone };

// The running totals of a job in big numbers (24 units · 7 codes · 1 to check), side by side on one plate.
// A count with a state carries its tone's colour as well as its word.
export function Tally({ items }: { items: TallyItem[] }) {
  return (
    <Plate accessible accessibilityLabel={items.map((item) => `${item.value} ${item.label}`).join(', ')} className="flex-row">
      {items.map((item, index) => (
        <View key={item.label} className={cx('flex-1 px-3 py-2', index > 0 && 'border-l-2 border-rule')}>
          <SignText size="display" weight="heavy" numberOfLines={1} ink={TEXT_INK[item.tone ?? 'surface']}>
            {item.value}
          </SignText>
          <SignText size="tag" weight="bold" numberOfLines={1} ink="text-quiet-ink">
            {item.label}
          </SignText>
        </View>
      ))}
    </Plate>
  );
}
