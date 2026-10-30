import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { setSoundsEnabled, soundsEnabled } from '@/feel/feel';
import { useOutbox } from '@/queue/outbox-provider';
import { useWorkingLocation } from '@/session/location-provider';
import { useSession } from '@/session/session-provider';
import { Button } from '@/ui/button';
import { ConfirmSheet } from '@/ui/confirm-sheet';
import { Fact, Facts, FactSwitch } from '@/ui/facts';
import { Txt } from '@/ui/text';

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

// Who is signed in on this phone, where they're working, this phone's sounds, and sign out.
export function AccountSection() {
  const { state, signOut } = useSession();
  const { location } = useWorkingLocation();
  const { waiting, needsAttention } = useOutbox();
  const [confirming, setConfirming] = useState(false);
  const [sounds, setSounds] = useState(soundsEnabled);
  if (state.status !== 'member') return null;
  const unsent = waiting + needsAttention;

  return (
    <View className="gap-4 px-4 pb-10 pt-6">
      <Txt accessibilityRole="header" variant="headline">
        Account
      </Txt>
      <Facts>
        <Fact label="Signed in" value={state.email} />
        <Fact label="Role" value={capitalise(state.member.role)} />
        <Fact label="Location" value={location?.name ?? 'Not chosen'} onPress={() => router.push('/location')} />
        <Fact label="Workspace" value={state.member.workspaceName} last />
      </Facts>
      <Facts>
        <FactSwitch
          label="Sounds"
          detail="Beeps for scans, warnings and finished jobs. The silent switch turns them off too."
          value={sounds}
          onChange={(on) => {
            setSounds(on);
            setSoundsEnabled(on);
          }}
          last
        />
      </Facts>
      <Button label="Sign out" icon="signOut" variant="destructive" onPress={() => setConfirming(true)} />
      <ConfirmSheet
        visible={confirming}
        title="Sign out?"
        facts={unsent > 0 ? [{ value: unsent, label: 'Not sent yet', tone: 'warn' }] : undefined}
        note={unsent > 0 ? `${unsent === 1 ? 'It stays' : 'They stay'} on this phone and send when you sign back in.` : null}
        confirm={{ label: 'Sign out', destructive: true, onPress: () => void signOut() }}
        onCancel={() => setConfirming(false)}
      />
    </View>
  );
}
