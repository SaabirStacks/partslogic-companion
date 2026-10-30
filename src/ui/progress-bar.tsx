import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import type { WorkflowFamily } from '@/workflows/catalogue';

import { familyColours } from './family';
import { EASE_OUT } from './motion';

// How far through a job is, as a bar in the job's family colour (never blue, which means press). It fills
// to a new share smoothly when a bin is counted; with Reduce Motion it jumps.
export function ProgressBar({ share, family }: { share: number; family: WorkflowFamily }) {
  const reduceMotion = useReducedMotion();
  const target = Math.max(0, Math.min(1, share));
  const filled = useSharedValue(target);

  useEffect(() => {
    filled.set(reduceMotion ? target : withTiming(target, { duration: 420, easing: EASE_OUT }));
  }, [target, reduceMotion, filled]);

  const style = useAnimatedStyle(() => ({ width: `${filled.get() * 100}%` }));

  return (
    <View className="h-2 overflow-hidden rounded-full bg-rule" importantForAccessibility="no">
      <Animated.View style={style} className={`h-2 rounded-full ${familyColours(family).dot}`} />
    </View>
  );
}
