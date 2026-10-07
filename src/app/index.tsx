import { Text, View } from 'react-native';

// Placeholder until Phase 1 adds sign-in and the Look up, Receive, Count and Outbox tabs.
export default function Index() {
  return (
    <View className="flex-1 items-center justify-center gap-2 bg-canvas px-6">
      <Text className="text-2xl font-semibold text-ink">PartsLogic</Text>
      <Text className="text-center text-base text-quiet-ink">
        Foundations are in place. Sign-in and the job tabs arrive in Phase 1.
      </Text>
    </View>
  );
}
