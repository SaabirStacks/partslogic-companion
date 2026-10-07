import { Text, View } from 'react-native';

import { useOnline } from '@/lib/network';

import { Icon } from './icon';

// A thin line, never a dialog: the app keeps working offline and says so.
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <View accessibilityRole="alert" className="mx-4 mb-2 mt-1 flex-row items-center gap-2 rounded-xl bg-mist px-4 py-2.5">
      <Icon name="offline" size={16} colour="mist-ink" />
      <Text className="flex-1 text-sm text-mist-ink">Offline. Work is saved on this phone and sends when you’re back.</Text>
    </View>
  );
}
