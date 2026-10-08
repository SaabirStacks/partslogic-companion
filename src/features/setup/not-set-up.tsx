import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { EmptyState } from '@/ui/empty-state';

// Shown instead of the app when it was built without its connection settings, so staff see what to do
// rather than the app closing on launch.
export function NotSetUp({ problems }: { problems: string[] }) {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <EmptyState
      icon="warning"
      title="PartsLogic isn’t set up on this phone"
      body="This copy of the app was built without its connection settings. Ask whoever sent you the app for the latest version.">
      <Text selectable className="text-center text-sm text-mist-ink">
        {problems.join('\n')}
      </Text>
    </EmptyState>
  );
}
