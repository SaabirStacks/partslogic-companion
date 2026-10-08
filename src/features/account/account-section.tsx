import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useOutbox } from '@/queue/outbox-provider';
import { useWorkingLocation } from '@/session/location-provider';
import { useSession } from '@/session/session-provider';
import { Button } from '@/ui/button';
import { ConfirmSheet } from '@/ui/confirm-sheet';
import { Fact, Facts } from '@/ui/facts';
import { SignText } from '@/ui/sign-text';

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

// Who is signed in on this phone, where they're working, and sign out.
export function AccountSection() {
  const { state, signOut } = useSession();
  const { location } = useWorkingLocation();
  const { waiting, needsAttention } = useOutbox();
  const [confirming, setConfirming] = useState(false);
  if (state.status !== 'member') return null;
  const unsent = waiting + needsAttention;

  return (
    <View className="gap-4 px-4 pb-10 pt-6">
      <SignText accessibilityRole="header" size="headline" weight="heavy">
        Account
      </SignText>
      <Facts>
        <Fact label="Signed in" value={state.email} />
        <Fact label="Role" value={capitalise(state.member.role)} />
        <Fact label="Location" value={location?.name ?? 'Not chosen'} onPress={() => router.push('/location')} />
        <Fact label="Workspace" value={state.member.workspaceName} last />
      </Facts>
      <Button label="Sign out" icon="signOut" variant="destructive" onPress={() => setConfirming(true)} />
      <ConfirmSheet
        visible={confirming}
        title="Sign out?"
        facts={unsent > 0 ? [{ value: unsent, label: 'Not sent yet', tone: 'warning' }] : undefined}
        note={unsent > 0 ? `${unsent === 1 ? 'It stays' : 'They stay'} on this phone and send when you sign back in.` : null}
        confirm={{ label: 'Sign out', destructive: true, onPress: () => void signOut() }}
        onCancel={() => setConfirming(false)}
      />
    </View>
  );
}
