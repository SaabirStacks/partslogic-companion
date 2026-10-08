import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';

// Opens Quick add for an unknown code, from wherever it was scanned.
export function AddPartLink({ code }: { code: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add the part for ${code}`}
      hitSlop={8}
      onPress={() => router.push({ pathname: '/quick-add', params: { code } })}
      className="self-start py-1 active:opacity-70">
      <Text className="text-sm font-semibold text-mandatory-ink">Add part</Text>
    </Pressable>
  );
}
