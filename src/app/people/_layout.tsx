import { Stack } from 'expo-router';

import { CloseButton } from '@/ui/close-button';
import { headerOptions } from '@/ui/header';
import { colour } from '@/ui/palette';
import { useScheme } from '@/ui/theme';

// People opens over the Account sheet as its own stack: the list, a person's page, and adding a person.
export default function PeopleLayout() {
  const scheme = useScheme();
  return (
    <Stack screenOptions={{ ...headerOptions(scheme, 'People'), contentStyle: { backgroundColor: colour(scheme, 'ground') } }}>
      <Stack.Screen name="index" options={{ title: 'People', headerLeft: () => <CloseButton label="Close People" /> }} />
      <Stack.Screen name="[id]" options={{ title: '' }} />
      <Stack.Screen name="add" options={{ title: 'Add a person' }} />
    </Stack>
  );
}

