import * as Haptics from 'expo-haptics';

import type { Haptic } from './moments';

const PLAY: Record<Haptic, () => Promise<void>> = {
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  selection: () => Haptics.selectionAsync(),
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
};

// A phone without a vibration motor (or with system haptics off) simply stays still.
export function playHaptic(haptic: Haptic): void {
  PLAY[haptic]().catch(() => undefined);
}
