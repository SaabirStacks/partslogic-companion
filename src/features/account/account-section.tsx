import { router } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';

import { useOutbox } from '@/queue/outbox-provider';
import { useWorkingLocation } from '@/session/location-provider';
import { useSession } from '@/session/session-provider';
import { ListGroup, ListRow } from '@/ui/list';

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

// Who is signed in on this phone, where they're working, and sign out. Shown on Outbox (counters and up)
// and on Account (viewers).
export function AccountSection() {
  const { state, signOut } = useSession();
  const { location } = useWorkingLocation();
  const { waiting, needsAttention } = useOutbox();
  if (state.status !== 'member') return null;

  function confirmSignOut() {
    const unsent = waiting + needsAttention;
    const message =
      unsent > 0
        ? `${unsent} ${unsent === 1 ? 'item hasn’t' : 'items haven’t'} been sent yet. ${unsent === 1 ? 'It stays' : 'They stay'} on this phone and send when you sign back in.`
        : "You'll need your email and password to sign back in.";
    Alert.alert('Sign out of PartsLogic?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <View className="gap-6 px-4 pb-10 pt-2">
      <ListGroup title="Account">
        <ListRow label="Signed in as" value={state.email} />
        <ListRow label="Role" value={capitalise(state.member.role)} />
        <ListRow label="Location" value={location?.name ?? 'Not chosen'} onPress={() => router.push('/location')} />
        <ListRow label="Workspace" value={state.member.workspaceName} last />
      </ListGroup>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        onPress={confirmSignOut}
        className="h-12 items-center justify-center rounded-xl bg-plate active:opacity-70">
        <Text className="text-base font-semibold text-stop-ink">Sign out</Text>
      </Pressable>
    </View>
  );
}
