import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { cx } from './cx';
import { Icon } from './icon';
import type { IconName } from './icons';
import { EASE_OUT, LAND_MS, SWEEP_MS } from './motion';
import type { Tone } from './palette';
import { SOFT, TONE_INK, TONE_TEXT } from './surface';
import { Txt } from './text';

export type ChipState = { tone: Tone; icon: IconName; label: string };

// A state in words, with its symbol, on its soft colour: "In stock", "Reorder", "3 waiting". Never colour
// alone. Large is for a scan result, read at arm's length.
//
// When the state changes on screen (PartsLogic answering: Sending to Delivery booked, Counting to
// Counted), the new colour sweeps in from the symbol's side as the old one draws back, and the symbol
// lands. A chip that arrives already in its state just shows it. Reduce Motion shows the new state at once.
export function StatusChip({ tone, icon, label, large = false }: ChipState & { large?: boolean }) {
  const reduceMotion = useReducedMotion();
  // The colour it showed before, painted over the new one and drawn back (React's "storing information
  // from previous renders" pattern).
  const [shown, setShown] = useState(tone);
  const [was, setWas] = useState<Tone | null>(null);
  if (shown !== tone) {
    setWas(shown);
    setShown(tone);
  }

  const cover = useSharedValue(0);
  const land = useSharedValue(1);
  const last = useRef(tone);
  useEffect(() => {
    if (last.current === tone) return;
    last.current = tone;
    if (reduceMotion) return;
    cover.set(1);
    cover.set(withTiming(0, { duration: SWEEP_MS, easing: EASE_OUT }));
    land.set(0.55);
    land.set(withTiming(1, { duration: LAND_MS, easing: EASE_OUT }));
  }, [tone, reduceMotion, cover, land]);

  const coverStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: cover.get() }] }));
  const landStyle = useAnimatedStyle(() => ({ transform: [{ scale: land.get() }] }));

  return (
    <View
      accessible
      accessibilityLabel={label}
      className={cx('flex-row items-center self-start overflow-hidden rounded-chip', SOFT[tone], large ? 'gap-2 px-3 py-1.5' : 'gap-1.5 px-2.5 py-1')}>
      {was ? (
        // Classes go on a plain View inside: NativeWind doesn't style Reanimated's views.
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transformOrigin: 'right' }, coverStyle]}>
          <View className={cx('flex-1', SOFT[was])} />
        </Animated.View>
      ) : null}
      <Animated.View style={landStyle}>
        <Icon name={icon} size={large ? 20 : 16} colour={tone === 'neutral' ? 'quiet-ink' : TONE_INK[tone]} />
      </Animated.View>
      <Txt variant={large ? 'label' : 'caption'} ink={tone === 'neutral' ? 'text-quiet-ink' : TONE_TEXT[tone]} className="font-semibold" numberOfLines={1}>
        {label}
      </Txt>
    </View>
  );
}
