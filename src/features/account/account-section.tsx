import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { setSoundsEnabled, soundsEnabled } from '@/feel/feel';
import { PreviewStrip } from '@/features/developer/preview-strip';
import { useOnline } from '@/lib/network';
import { supabase } from '@/lib/supabase';
import { useOutbox } from '@/queue/outbox-provider';
import { useWorkingLocation } from '@/session/location-provider';
import { useSession } from '@/session/session-provider';
import { Button } from '@/ui/button';
import { ConfirmSheet } from '@/ui/confirm-sheet';
import { Fact, FactLink, Facts, FactSwitch } from '@/ui/facts';
import { Txt } from '@/ui/text';
import { TextSheet } from '@/ui/text-sheet';
import { roleAtLeast } from '@/vendor/partslogic/shared/members';
import { roleName, setPersonName } from '@/vendor/partslogic/shared/people';

// Who is signed in on this phone (and their name, which they can change), where they're working, this
// phone's sounds, People for admins, Developer for developers, and sign out.
export function AccountSection() {
  const { state, signOut, retry, realRole } = useSession();
  const { location } = useWorkingLocation();
  const { waiting, needsAttention } = useOutbox();
  const online = useOnline();
  const [confirming, setConfirming] = useState(false);
  const [naming, setNaming] = useState(false);
  const [sounds, setSounds] = useState(soundsEnabled);
  if (state.status !== 'member') return null;
  const unsent = waiting + needsAttention;
  const { member } = state;
  const managesPeople = roleAtLeast(member.role, 'admin');

  async function saveName(name: string): Promise<string | null> {
    try {
      await setPersonName(supabase, member.userId, name);
      retry();
      setNaming(false);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  return (
    <View className="gap-4 px-4 pb-10 pt-6">
      <Txt accessibilityRole="header" variant="headline">
        Account
      </Txt>
      <PreviewStrip />
      <Facts>
        <Fact label="Name" value={member.name ?? 'Add your name'} onPress={online ? () => setNaming(true) : undefined} />
        <Fact label="Signed in" value={state.email} />
        <Fact label="Role" value={roleName(realRole ?? member.role)} />
        <Fact label="Location" value={location?.name ?? 'Not chosen'} onPress={() => router.push('/location')} />
        <Fact label="Workspace" value={member.workspaceName} last />
      </Facts>
      {managesPeople || realRole === 'developer' ? (
        <Facts>
          {managesPeople ? (
            <FactLink
              icon="people"
              label="People"
              detail="Add people, give roles and set-up codes"
              onPress={() => router.push('/people')}
              last={realRole !== 'developer'}
            />
          ) : null}
          {realRole === 'developer' ? (
            <FactLink icon="developer" label="Developer" detail="App version, connection, sync, preview as a role" onPress={() => router.push('/developer')} last />
          ) : null}
        </Facts>
      ) : null}
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
      {/* Keyed so each opening starts from the current name. */}
      <TextSheet
        key={`name-${naming}`}
        visible={naming}
        title="Your name"
        label="Name"
        initial={member.name ?? ''}
        note="Shown instead of your email address, on the phone and in the back office."
        input={{ autoCapitalize: 'words', autoComplete: 'name', textContentType: 'name' }}
        onSave={saveName}
        onCancel={() => setNaming(false)}
      />
    </View>
  );
}
