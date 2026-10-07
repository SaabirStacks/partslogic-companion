import { Stack } from 'expo-router';

import { LocationChip } from './location-chip';

// Each tab is its own native stack, so it gets a native header (a large title on iOS) and later screens
// can push inside the tab without losing its place.
export function TabStack({ title, showLocation = true }: { title: string; showLocation?: boolean }) {
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerShadowVisible: false,
        headerRight: showLocation ? () => <LocationChip /> : undefined,
      }}>
      <Stack.Screen name="index" options={{ title }} />
    </Stack>
  );
}
