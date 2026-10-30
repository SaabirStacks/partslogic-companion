import { View } from 'react-native';

import { cx } from './cx';
import { Icon } from './icon';
import { PressableCard } from './surface';
import { Txt } from './text';

// One option in a list you pick from (a location, a supplier, a bin): its name, at most one line under it,
// and a dark outline with a tick when it's the one chosen. Colour stays for the button that acts on the
// choice, so a chosen row is marked by shape, not by blue.
export function Choice({
  title,
  detail,
  selected = false,
  onPress,
  accessibilityLabel,
}: {
  title: string;
  detail?: string | null;
  selected?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <PressableCard
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={accessibilityLabel ?? (detail ? `${title}, ${detail}` : title)}
      haptic="tick"
      onPress={onPress}
      className={cx('min-h-14 flex-row items-center gap-3 px-4 py-2.5', selected && 'border-2 border-ink')}>
      <View className="flex-1 gap-0.5">
        <Txt variant="label" numberOfLines={1} className="font-bold">
          {title}
        </Txt>
        {detail ? (
          <Txt variant="caption" numberOfLines={1}>
            {detail}
          </Txt>
        ) : null}
      </View>
      {selected ? (
        <View className="h-6 w-6 items-center justify-center rounded-full bg-ink">
          <Icon name="check" size={13} colour="surface" />
        </View>
      ) : null}
    </PressableCard>
  );
}
