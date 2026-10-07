import { router } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';

import { useWorkingLocation } from '@/session/location-provider';
import { useSession } from '@/session/session-provider';
import { Icon } from '@/ui/icon';
import { cx } from '@/ui/cx';

function Row({ label, value, onPress, last }: { label: string; value: string; onPress?: () => void; last?: boolean }) {
  const content = (
    <>
      <Text className="text-base text-ink">{label}</Text>
      <View className="shrink flex-row items-center gap-1.5">
        <Text numberOfLines={1} className="shrink text-right text-base text-quiet-ink">
          {value}
        </Text>
        {onPress ? <Icon name="chevron" size={12} colour="quiet-ink" /> : null}
      </View>
    </>
  );
  const frame = cx('min-h-12 flex-row items-center justify-between gap-4 px-4 py-3', !last && 'border-b border-hairline');
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}. Change`} onPress={onPress} className={cx(frame, 'active:bg-canvas')}>
      {content}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={`${label}: ${value}`} className={frame}>
      {content}
    </View>
  );
}

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

// Who is signed in on this phone, where they're working, and sign out. Shown on Outbox (counters and up)
// and on Account (viewers).
export function AccountSection() {
  const { state, signOut } = useSession();
  const { location } = useWorkingLocation();
  if (state.status !== 'member') return null;

  function confirmSignOut() {
    Alert.alert('Sign out of PartsLogic?', "You'll need your email and password to sign back in.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <View className="gap-2 px-4 pb-10 pt-2">
      <Text accessibilityRole="header" className="px-4 text-sm font-semibold text-quiet-ink">
        Account
      </Text>
      <View className="overflow-hidden rounded-xl bg-paper">
        <Row label="Signed in as" value={state.email} />
        <Row label="Role" value={capitalise(state.member.role)} />
        <Row label="Location" value={location?.name ?? 'Not chosen'} onPress={() => router.push('/location')} />
        <Row label="Workspace" value={state.member.workspaceName} last />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        onPress={confirmSignOut}
        className="mt-6 h-12 items-center justify-center rounded-xl bg-paper active:opacity-70">
        <Text className="text-base font-semibold text-out">Sign out</Text>
      </Pressable>
    </View>
  );
}
