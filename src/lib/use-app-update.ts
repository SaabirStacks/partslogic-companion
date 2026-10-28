import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState } from 'react-native';

// A new version published to phones (EAS Update). The phone checks when it opens (the default) and again
// whenever it comes back to the front, downloads it, and says so; Restart switches to it now instead of
// at the next cold start. Work in progress is saved on the phone, so restarting loses nothing.
export function useAppUpdate(): { ready: boolean; restart: () => void } {
  const { isUpdatePending } = Updates.useUpdates();

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      Updates.checkForUpdateAsync()
        .then((check) => (check.isAvailable ? Updates.fetchUpdateAsync() : null))
        .catch(() => {
          // No signal, or the update server is busy: the next open or return tries again.
        });
    });
    return () => subscription.remove();
  }, []);

  return {
    ready: isUpdatePending,
    restart: () => {
      Updates.reloadAsync().catch(() => {
        // Can't reload here (a development build): the update applies at the next start.
      });
    },
  };
}
