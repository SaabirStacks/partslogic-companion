import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { cx } from './cx';
import { pickColours, type PickKind } from './family';
import { Icon } from './icon';
import { TICK_IN } from './motion';
import { PressableCard } from './surface';
import { Txt } from './text';

// One option in a list you pick from (a location, a supplier, a bin): its name, at most one line under it,
// and, when it's the one chosen, an outline, a soft fill and a tick in the colour of what's chosen (pick:
// a bin violet, a supplier teal, a brand plum, a location blue; family.ts). The outline and tick carry it
// without the colour.
export function Choice({
  title,
  detail,
  selected = false,
  pick,
  onPress,
  accessibilityLabel,
}: {
  title: string;
  detail?: string | null;
  selected?: boolean;
  // What's being chosen, which sets the colour it's marked in.
  pick: PickKind;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const colours = pickColours(pick);
  return (
    <PressableCard
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={accessibilityLabel ?? (detail ? `${title}, ${detail}` : title)}
      haptic="tick"
      onPress={onPress}
      chosen={selected ? colours : null}
      className="min-h-14 flex-row items-center gap-3 px-4 py-2.5">
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
        <Animated.View entering={TICK_IN}>
          <View className={cx('h-6 w-6 items-center justify-center rounded-full', colours.dot)}>
            <Icon name="check" size={13} colour="surface" />
          </View>
        </Animated.View>
      ) : null}
    </PressableCard>
  );
}
