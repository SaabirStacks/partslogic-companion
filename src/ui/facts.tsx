import type { ReactNode } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { cx } from './cx';
import { Icon } from './icon';
import { Card } from './surface';
import { Txt } from './text';
import { useColour } from './theme';

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
      <Txt variant="caption" ink="text-label" className="w-28">
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

// A line that turns something on or off for this phone: what it is, one line on what it does, and the
// system switch (its own look and haptic on each phone), with the on colour from the palette.
export function FactSwitch({
  label,
  detail,
  value,
  onChange,
  last = false,
}: {
  label: string;
  detail: string;
  value: boolean;
  onChange: (on: boolean) => void;
  last?: boolean;
}) {
  const colourOf = useColour();
  return (
    <View className={cx('min-h-16 flex-row items-center gap-3 px-4 py-3', !last && 'border-b border-rule')}>
      <View className="flex-1 gap-0.5">
        <Txt variant="label" className="font-bold">
          {label}
        </Txt>
        <Txt variant="caption">{detail}</Txt>
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityHint={detail}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colourOf('ok'), false: colourOf('edge') }}
        ios_backgroundColor={colourOf('edge')}
      />
    </View>
  );
}
