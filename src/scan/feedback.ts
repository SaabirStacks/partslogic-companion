import * as Haptics from 'expo-haptics';

// One haptic per scan outcome, so staff can keep their eyes on the shelf.
export const scanFeedback = {
  found: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  unknown: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  failed: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};
