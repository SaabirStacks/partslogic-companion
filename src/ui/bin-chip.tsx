import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { cx } from './cx';
import { pickColours } from './family';
import { Icon } from './icon';
import { TICK_IN } from './motion';
import { Card, PressableCard } from './surface';
import { Txt } from './text';

const BIN = pickColours('bin');

// A bin as a small label: its code and, when it holds stock, how many (A-01 ×4). A chosen bin gets the
// mark of any choice in a list, in a bin's violet: an outline, a soft fill and a tick.
export function BinChip({
  code,
  qty,
  selected = false,
  onPress,
}: {
  code: string;
  qty?: number | string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const label = qty === undefined ? code : `${code}, ${qty}`;
  const face = (
    <View className="flex-row items-center gap-1.5">
      {selected ? (
        <Animated.View entering={TICK_IN}>
          <View className={cx('h-5 w-5 items-center justify-center rounded-full', BIN.dot)}>
            <Icon name="check" size={11} colour="surface" />
          </View>
        </Animated.View>
      ) : null}
      <Txt variant="label" className="font-bold">
        {code}
      </Txt>
      {qty !== undefined ? (
        <Txt variant="label" numbers ink="text-quiet-ink">
          ×{qty}
        </Txt>
      ) : null}
    </View>
  );
  const frame = 'min-h-12 justify-center px-3';
  return onPress ? (
    <PressableCard haptic="tick" chosen={selected ? BIN : null} accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} className={frame}>
      {face}
    </PressableCard>
  ) : (
    <Card accessible accessibilityLabel={label} className={frame}>
      {face}
    </Card>
  );
}
