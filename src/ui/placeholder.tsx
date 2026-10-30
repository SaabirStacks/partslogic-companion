import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

// Grey rows the shape of the list that's on its way (suppliers, bins, what's waiting), so a screen keeps
// its layout while it loads instead of a lone spinner. They breathe slowly; with Reduce Motion they stay
// still.
export function PlaceholderRows({ count = 4, label = 'Loading' }: { count?: number; label?: string }) {
  const reduceMotion = useReducedMotion();
  const glow = useSharedValue(0);

  useEffect(() => {
    if (!reduceMotion) glow.set(withRepeat(withTiming(1, { duration: 900 }), -1, true));
  }, [reduceMotion, glow]);

  const style = useAnimatedStyle(() => ({ opacity: 0.55 + glow.get() * 0.35 }));

  return (
    <View accessible accessibilityLabel={label} accessibilityRole="progressbar" className="gap-2">
      {Array.from({ length: count }, (_, index) => (
        <Animated.View key={index} style={style}>
          <View className="h-14 rounded-card bg-rule" />
        </Animated.View>
      ))}
    </View>
  );
}
