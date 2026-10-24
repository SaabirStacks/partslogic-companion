import * as Haptics from 'expo-haptics';

import type { ScanCheck } from './resolve';

// One haptic per scan outcome, so staff can keep their eyes on the shelf.
export const scanFeedback = {
  found: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  unknown: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  failed: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};

// The haptic for a held scan's answer: a part, something to check (unknown, unchecked or a bin), or an error.
export function feedbackFor(check: ScanCheck) {
  if (check.type === 'part') scanFeedback.found();
  else if (check.type === 'error') scanFeedback.failed();
  else scanFeedback.unknown();
}
