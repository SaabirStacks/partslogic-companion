import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { cx } from './cx';
import { Icon } from './icon';
import { Card } from './surface';
import { Txt } from './text';

// Label-and-value lines on one card: account details, prices, codes. Labels are quiet, values bold. A line
// you can press says so with a chevron.
export function Facts({ children }: { children: ReactNode }) {
  return <Card className="overflow-hidden">{children}</Card>;
}

export function Fact({
  label,
  value,
  onPress,
  last = false,
  selectable = false,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  last?: boolean;
  selectable?: boolean;
}) {
  const frame = cx('min-h-14 flex-row items-center gap-3 px-4 py-2', !last && 'border-b border-rule');
  const face = (
    <>
      <Txt variant="caption" className="w-28">
        {label}
      </Txt>
      <Txt variant="label" selectable={selectable} numbers numberOfLines={2} className="flex-1 text-right">
        {value}
      </Txt>
      {onPress ? <Icon name="forward" size={16} colour="quiet-ink" /> : null}
    </>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}. Change`} onPress={onPress} className={cx(frame, 'active:bg-rule')}>
      {face}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={`${label}: ${value}`} className={frame}>
      {face}
    </View>
  );
}
