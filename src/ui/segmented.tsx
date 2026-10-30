import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { feel } from '@/feel/feel';

import { EASE_OUT, SLIDE_MS } from './motion';
import { Txt } from './text';

// The track's inner padding (p-1), which the white selector sits inside.
const INSET = 4;

// Two or three ways to look at one list (Supplier | Manufacturer): a grey track with the chosen one
// raised in white. Choosing another slides the white selector across to it, so the switch reads as one
// control moving; with Reduce Motion it moves at once.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [inner, setInner] = useState(0);
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const slot = inner / options.length;

  const x = useSharedValue(index * slot);
  const last = useRef(index);
  useEffect(() => {
    const moved = last.current !== index;
    last.current = index;
    // Only a change of choice slides; the first measurement (and a rotation) just places it.
    x.set(moved && !reduceMotion ? withTiming(index * slot, { duration: SLIDE_MS, easing: EASE_OUT }) : index * slot);
  }, [index, slot, reduceMotion, x]);

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View
      accessibilityRole="tablist"
      onLayout={(event) => setInner(event.nativeEvent.layout.width - INSET * 2)}
      className="flex-row rounded-card bg-rule p-1">
      {inner > 0 ? (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: INSET, bottom: INSET, left: INSET, width: slot }, thumb]}>
          {/* Classes and the shadow go on a plain View: NativeWind doesn't style Reanimated's views. */}
          <View style={RAISED} className="flex-1 rounded-[9px] bg-surface" />
        </Animated.View>
      ) : null}
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={option.label}
            onPress={() => {
              if (!on) feel('tick');
              onChange(option.value);
            }}
            className="min-h-11 flex-1 items-center justify-center rounded-[9px] px-2">
            <Txt variant="label" ink={on ? 'text-ink' : 'text-quiet-ink'} numberOfLines={1} className="font-bold">
              {option.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const RAISED = { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 } as const;
