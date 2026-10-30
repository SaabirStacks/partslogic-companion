import { useEffect, useRef } from 'react';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { EASE_OUT } from './motion';
import { Txt, type TxtProps } from './text';

// A number that swells for a moment when it changes, so a scan or a tap on − / + is seen landing: totals,
// a line's quantity, what's on hand. Not on first draw, and not with Reduce Motion on. It grows from the
// corner given, so it never pushes against whatever sits on its other side.
export function Ticking({
  value,
  origin = 'left bottom',
  ...text
}: { value: number | string; origin?: 'left bottom' | 'center' | 'right bottom' } & Omit<TxtProps, 'children'>) {
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
    <Animated.View style={[{ alignSelf: origin === 'center' ? 'center' : 'flex-start', transformOrigin: origin }, style]}>
      <Txt numbers numberOfLines={1} {...text}>
        {value}
      </Txt>
    </Animated.View>
  );
}
