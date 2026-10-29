import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';

// Android's back button goes back a step (onBack) instead of leaving the screen, while there's a step to
// go back to (onBack isn't null) and only while this screen is the one in front.
export function useStepBack(onBack: (() => void) | null) {
  useFocusEffect(
    useCallback(() => {
      if (!onBack) return;
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        onBack();
        return true;
      });
      return () => subscription.remove();
    }, [onBack]),
  );
}
