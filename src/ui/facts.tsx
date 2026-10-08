import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { cx } from './cx';
import { Icon } from './icon';
import { Plate } from './plate';
import { SignText } from './sign-text';

// Label-and-value lines on one plate: account details, prices, codes. Values are signs (big, condensed);
// labels are small. A line you can press says so with a chevron.
export function Facts({ children }: { children: ReactNode }) {
  return <Plate className="overflow-hidden">{children}</Plate>;
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
  const frame = cx('min-h-14 flex-row items-center gap-3 px-3 py-2', !last && 'border-b-2 border-rule');
  const face = (
    <>
      <SignText size="tag" ink="text-quiet-ink" className="w-28">
        {label}
      </SignText>
      <SignText size="label" weight="heavy" caps={false} selectable={selectable} numberOfLines={2} className="flex-1 text-right">
        {value}
      </SignText>
      {onPress ? <Icon name="forward" size={16} /> : null}
    </>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}. Change`} onPress={onPress} className={cx(frame, 'active:opacity-75')}>
      {face}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={`${label}: ${value}`} className={frame}>
      {face}
    </View>
  );
}
