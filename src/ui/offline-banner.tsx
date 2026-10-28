import { View } from 'react-native';

import { useOnline } from '@/lib/network';

import { Icon } from './icon';
import { Txt } from './text';

// A soft yellow strip, never a dialog: the app keeps working offline and says so in four words.
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <View accessibilityRole="alert" className="flex-row items-center gap-2 border-b border-edge bg-warn-soft px-4 py-2">
      <Icon name="offline" size={16} colour="warn-ink" />
      <Txt variant="caption" ink="text-warn-ink" className="flex-1 font-semibold">
        Offline · saving on this phone
      </Txt>
    </View>
  );
}
