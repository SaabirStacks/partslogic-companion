import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { useWorkingLocation } from '@/session/location-provider';

import { Icon } from './icon';

// Header chip that shows the working location and opens the location sheet.
export function LocationChip() {
  const { location } = useWorkingLocation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={location ? `Working location: ${location.name}. Change` : 'Choose a working location'}
      hitSlop={8}
      onPress={() => router.push('/location')}
      className="max-w-[180px] flex-row items-center gap-1 rounded-full bg-mist px-3 py-1.5 active:opacity-70">
      <Icon name="location" size={14} colour="mist-ink" />
      <Text numberOfLines={1} className="shrink text-sm font-semibold text-mist-ink">
        {location ? location.name : 'Choose location'}
      </Text>
      <Icon name="chevron" size={12} colour="mist-ink" />
    </Pressable>
  );
}
