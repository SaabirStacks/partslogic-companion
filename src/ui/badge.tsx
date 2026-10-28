import { View } from 'react-native';

import { cx } from './cx';
import { Txt } from './text';

// A small word in a job's corner: amber for your own open work ("Open", "Counting", "1 of 4"), solid blue
// for work waiting to be done ("2 waiting"). The word carries it as well as the colour.
export type BadgeState = { label: string; tone: 'warn' | 'action'; spoken?: string };

export function Badge({ label, tone }: BadgeState) {
  return (
    <View className={cx('min-h-6 shrink items-center justify-center rounded-full px-2.5', tone === 'action' ? 'bg-action' : 'bg-warn-soft')}>
      <Txt variant="caption" numbers numberOfLines={1} ink={tone === 'action' ? 'text-on-action' : 'text-warn-ink'} className="text-[13px] font-bold">
        {label}
      </Txt>
    </View>
  );
}
