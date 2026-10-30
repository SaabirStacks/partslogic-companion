import { View } from 'react-native';

import { cx } from './cx';
import type { Tone } from './palette';
import { Card, TONE_TEXT } from './surface';
import { Txt } from './text';
import { Ticking } from './ticking';

export type TallyItem = { value: number | string; label: string; tone?: Tone };

// The running totals of a job in big numbers (24 units · 7 codes · 1 to check), side by side on one card.
// A total with a state carries its tone's colour as well as its word.
export function Tally({ items }: { items: TallyItem[] }) {
  return (
    <Card accessible accessibilityLabel={items.map((item) => `${item.value} ${item.label}`).join(', ')} className="flex-row">
      {items.map((item, index) => (
        <View key={item.label} className={cx('flex-1 gap-0.5 px-3 py-2.5', index > 0 && 'border-l border-rule')}>
          <Ticking value={item.value} variant="headline" ink={TONE_TEXT[item.tone ?? 'neutral']} className="font-extrabold" />
          <Txt variant="section" numberOfLines={2}>
            {item.label}
          </Txt>
        </View>
      ))}
    </Card>
  );
}
