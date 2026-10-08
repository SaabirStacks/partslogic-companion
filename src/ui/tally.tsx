import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { cx } from './cx';
import { EASE_OUT } from './motion';
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
          <Ticking value={item.value} ink={TEXT_INK[item.tone ?? 'surface']} />
          <SignText size="tag" weight="bold" numberOfLines={1} ink="text-quiet-ink">
            {item.label}
          </SignText>
        </View>
      ))}
    </Plate>
  );
}

// A total that swells for a moment when it changes, so a scan is seen landing in the count. Not on first
// draw, and not with Reduce Motion on.
function Ticking({ value, ink }: { value: number | string; ink: string }) {
  const reduceMotion = useReducedMotion();
  const swell = useSharedValue(0);
  const shown = useRef(value);

  useEffect(() => {
    if (shown.current === value) return;
    shown.current = value;
    if (!reduceMotion) swell.set(withSequence(withTiming(1, { duration: 80 }), withTiming(0, { duration: 220, easing: EASE_OUT })));
  }, [value, reduceMotion, swell]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 + swell.get() * 0.14 }] }));

  return (
    <Animated.View style={[{ alignSelf: 'flex-start', transformOrigin: 'left bottom' }, style]}>
      <SignText size="display" weight="heavy" numberOfLines={1} ink={ink}>
        {value}
      </SignText>
    </Animated.View>
  );
}
