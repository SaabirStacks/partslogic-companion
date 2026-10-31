import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated';

import { useOnline } from '@/lib/network';

import { Icon } from './icon';
import { APPEAR, BANNER_IN, BANNER_OUT } from './motion';
import { Txt } from './text';

// How long "Back online" stays before the strip lifts away.
const BACK_MS = 2400;

// A soft yellow strip, never a dialog: the app keeps working offline and says so in four words. It drops in
// when signal goes. When signal comes back it turns green and says so (whatever was saved starts sending
// then), and lifts away a moment later. A screen opened with no signal just shows it.
export function OfflineBanner() {
  const online = useOnline();
  // Coming back online is a change from offline (React's "storing information from previous renders"
  // pattern); going offline again cancels it.
  const [wasOnline, setWasOnline] = useState(online);
  const [back, setBack] = useState(false);
  if (wasOnline !== online) {
    setWasOnline(online);
    setBack(online);
  }

  useEffect(() => {
    if (!back) return;
    const timer = setTimeout(() => setBack(false), BACK_MS);
    return () => clearTimeout(timer);
  }, [back]);

  return (
    <LayoutAnimationConfig skipEntering>
      {!online || back ? (
        <Animated.View entering={BANNER_IN} exiting={BANNER_OUT}>
          <View className="border-b border-edge bg-warn-soft">
            <Line icon="offline" ink="warn-ink" text="Offline · saving on this phone" />
            {back ? (
              // The green fades in over the yellow; classes go on a plain View inside the animated one.
              <Animated.View entering={APPEAR} style={StyleSheet.absoluteFill}>
                <View className="flex-1 justify-center bg-ok-soft">
                  <Line icon="sent" ink="ok-ink" text="Back online" />
                </View>
              </Animated.View>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </LayoutAnimationConfig>
  );
}

function Line({ icon, ink, text }: { icon: 'offline' | 'sent'; ink: 'warn-ink' | 'ok-ink'; text: string }) {
  return (
    <View accessibilityRole="alert" accessibilityLabel={text} className="flex-row items-center gap-2 px-4 py-2">
      <Icon name={icon} size={16} colour={ink} />
      <Txt variant="caption" ink={ink === 'ok-ink' ? 'text-ok-ink' : 'text-warn-ink'} className="flex-1 font-semibold">
        {text}
      </Txt>
    </View>
  );
}
