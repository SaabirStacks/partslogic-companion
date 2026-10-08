import { View } from 'react-native';

import { useOnline } from '@/lib/network';

import { Icon } from './icon';
import { SignText } from './sign-text';

// A yellow strip, never a dialog: the app keeps working offline and says so in four words.
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <View accessibilityRole="alert" className="flex-row items-center gap-2 border-b-2 border-warning-edge bg-warning px-4 py-2">
      <Icon name="offline" size={18} colour="on-warning" />
      <SignText size="tag" ink="text-on-warning" className="flex-1">
        Offline · saving on this phone
      </SignText>
    </View>
  );
}
