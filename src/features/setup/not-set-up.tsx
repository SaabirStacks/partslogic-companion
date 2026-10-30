import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Txt } from '@/ui/text';
import { Notice } from '@/ui/notice';

// Shown instead of the app when it was built without its connection settings, so staff see what to do
// rather than the app closing on launch.
export function NotSetUp({ problems }: { problems: string[] }) {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-ground">
      <Notice icon="stop" tone="stop" title="Not set up" line="Ask for the latest version of the app.">
        <Txt variant="caption" selectable className="text-center text-[13px] leading-[18px]">
          {`For whoever sets up the app: ${problems.join('; ')}`}
        </Txt>
      </Notice>
    </SafeAreaView>
  );
}
