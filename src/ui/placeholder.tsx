import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

// Grey shapes of what's on its way (a list, a part, a row of bins), breathing slowly so the screen keeps its
// layout while it loads instead of showing a lone spinner. With Reduce Motion they stay still. The shapes
// are plain Views with classes inside one animated View (NativeWind doesn't style Reanimated's views).
export function Breathing({ label = 'Loading', children }: { label?: string; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const glow = useSharedValue(0);

  useEffect(() => {
    if (!reduceMotion) glow.set(withRepeat(withTiming(1, { duration: 900 }), -1, true));
  }, [reduceMotion, glow]);

  const style = useAnimatedStyle(() => ({ opacity: 0.55 + glow.get() * 0.35 }));

  return (
    <Animated.View accessible accessibilityLabel={label} accessibilityRole="progressbar" style={style}>
      {children}
    </Animated.View>
  );
}

// A list on its way: rows the height of the real ones.
export function PlaceholderRows({ count = 4, label = 'Loading' }: { count?: number; label?: string }) {
  return (
    <Breathing label={label}>
      <View className="gap-2">
        {Array.from({ length: count }, (_, index) => (
          <View key={index} className="h-14 rounded-card bg-rule" />
        ))}
      </View>
    </Breathing>
  );
}

// Bins on their way, as the chips they'll be.
export function PlaceholderChips({ count = 3, label = 'Loading bins' }: { count?: number; label?: string }) {
  return (
    <Breathing label={label}>
      <View className="flex-row flex-wrap gap-2">
        {Array.from({ length: count }, (_, index) => (
          <View key={index} className="h-12 w-24 rounded-card bg-rule" />
        ))}
      </View>
    </Breathing>
  );
}
