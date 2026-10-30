import { View } from 'react-native';
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated';

import { useOnline } from '@/lib/network';

import { Icon } from './icon';
import { BANNER_IN, BANNER_OUT } from './motion';
import { Txt } from './text';

// A soft yellow strip, never a dialog: the app keeps working offline and says so in four words. It drops in
// when signal goes and lifts away when it's back; a screen opened with no signal just shows it.
export function OfflineBanner() {
  const online = useOnline();
  return (
    <LayoutAnimationConfig skipEntering>
      {online ? null : (
        <Animated.View entering={BANNER_IN} exiting={BANNER_OUT}>
          <View accessibilityRole="alert" className="flex-row items-center gap-2 border-b border-edge bg-warn-soft px-4 py-2">
            <Icon name="offline" size={16} colour="warn-ink" />
            <Txt variant="caption" ink="text-warn-ink" className="flex-1 font-semibold">
              Offline · saving on this phone
            </Txt>
          </View>
        </Animated.View>
      )}
    </LayoutAnimationConfig>
  );
}
