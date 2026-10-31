import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { feel } from '@/feel/feel';
import { supabase } from '@/lib/supabase';
import { PersonView, type Outcome } from '@/features/people/person-view';
import { SetupCode } from '@/features/people/setup-code';
import { messageOf, usePeople } from '@/features/people/use-people';
import { useSession } from '@/session/session-provider';
import { Button } from '@/ui/button';
import { ConfirmSheet } from '@/ui/confirm-sheet';
import { Notice } from '@/ui/notice';
import { PlaceholderRows } from '@/ui/placeholder';
import { Scroll } from '@/ui/scroll';
import { TextSheet } from '@/ui/text-sheet';
import { roleAtLeast, type AppRole } from '@/vendor/partslogic/shared/members';
import {
  aRole,
  changePersonEmail,
  newSetupCode,
  personLabel,
  removePersonAccess,
  setPersonName,
  setPersonRole,
  type Person,
} from '@/vendor/partslogic/shared/people';

type Sheet = 'name' | 'email' | 'code' | 'remove' | { role: AppRole } | null;

// One person: their name and sign-in email, their role, a new set-up code if they've lost their password,
// and taking their access away. What can be changed follows the server's rules: never yourself (apart from
// your name, and an admin's own email), never someone above your role.
export default function PersonPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, retry } = useSession();
  const myRole: AppRole = state.status === 'member' ? state.member.role : 'viewer';
  const { data, error, loading, reload, online } = usePeople();
  const person = data?.find((candidate) => candidate.userId === id);

  const [sheet, setSheet] = useState<Sheet>(null);
  // How the last change went, shown under the header until the next one.
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  // A set-up code just made, shown once.
  const [code, setCode] = useState<string | null>(null);

  if (!person) {
    if (loading) {
      return (
        <View className="px-4 pt-3">
          <PlaceholderRows count={4} label="Loading" />
        </View>
      );
    }
    return (
      <Notice
        icon="people"
        tone={error ? 'stop' : 'neutral'}
        title={error ? 'Couldn’t load them' : online ? 'Not found' : 'Offline'}
        line={error ? messageOf(error) : online ? 'This account may have been removed.' : 'Connect to see and change people.'}>
        {online ? <Button label="Try again" icon="retry" variant="secondary" onPress={reload} /> : null}
      </Notice>
    );
  }

  const label = personLabel(person);

  // Runs one change, then reads People again so the page shows what PartsLogic now holds.
  async function change(run: () => Promise<void>, done: string): Promise<string | null> {
    setBusy(true);
    try {
      await run();
      setOutcome({ ok: true, text: done });
      feel('done');
      reload();
      return null;
    } catch (problem) {
      return messageOf(problem);
    } finally {
      setBusy(false);
    }
  }

  // A typed change: the sheet closes when it's saved and keeps the message when it isn't.
  async function save(run: () => Promise<void>, done: string): Promise<string | null> {
    const problem = await change(run, done);
    if (!problem) setSheet(null);
    return problem;
  }

  async function report(run: () => Promise<string | null>) {
    const problem = await run();
    if (problem) setOutcome({ ok: false, text: problem });
    setSheet(null);
  }

  const chooseRole = (role: AppRole) =>
    roleAtLeast(role, 'admin') ? setSheet({ role }) : void report(() => giveRole(person, role));
  const giveRole = (who: Person, role: AppRole) =>
    change(() => setPersonRole(supabase, who.userId, role), `${label} is now ${aRole(role)}`);

  const pendingRole = sheet && typeof sheet === 'object' ? sheet.role : null;

  if (code) {
    return (
      <Scroll className="bg-ground" contentContainerClassName="gap-3 px-4 pb-10 pt-3">
        <Stack.Screen options={{ title: label }} />
        <SetupCode person={person} code={code} />
        <Button label="Done" variant="secondary" onPress={() => setCode(null)} />
      </Scroll>
    );
  }

  return (
    <PersonView
      person={person}
      myRole={myRole}
      online={online}
      outcome={outcome}
      busy={busy}
      onName={() => setSheet('name')}
      onEmail={() => setSheet('email')}
      onRole={chooseRole}
      onNewCode={() => setSheet('code')}
      onRemove={() => setSheet('remove')}
      onRefresh={reload}>
      <Stack.Screen options={{ title: label }} />
      {/* Keyed so each opening starts from the current value. */}
      <TextSheet
        key={`name-${sheet === 'name'}`}
        visible={sheet === 'name'}
        title={person.isMe ? 'Your name' : `${label}’s name`}
        label="Name"
        initial={person.name ?? ''}
        note="Shown instead of the email address, on the phone and in the back office."
        input={{ autoCapitalize: 'words', autoComplete: 'name', textContentType: 'name' }}
        onSave={(name) =>
          save(async () => {
            await setPersonName(supabase, person.userId, name);
            if (person.isMe) retry();
          }, 'Name saved')
        }
        onCancel={() => setSheet(null)}
      />
      <TextSheet
        key={`email-${sheet === 'email'}`}
        visible={sheet === 'email'}
        title="Sign-in email"
        label="Email"
        initial={person.email}
        note="They sign in with the new address from now on. Their password stays the same."
        input={{ autoCapitalize: 'none', autoCorrect: false, keyboardType: 'email-address', autoComplete: 'email' }}
        onSave={(email) => save(() => changePersonEmail(supabase, person.userId, email), 'Email changed')}
        onCancel={() => setSheet(null)}
      />
      <ConfirmSheet
        visible={pendingRole !== null}
        title={pendingRole ? `Make ${label} ${aRole(pendingRole)}?` : ''}
        note={
          pendingRole === 'admin'
            ? 'Admins set margins, review catalogue links and manage people.'
            : pendingRole === 'owner'
              ? 'Owners can do everything, including company settings and managing other owners.'
              : 'Developers can do everything, and owners can’t change them.'
        }
        confirm={{ label: pendingRole ? `Make ${aRole(pendingRole)}` : 'Confirm', onPress: () => pendingRole && void report(() => giveRole(person, pendingRole)) }}
        onCancel={() => setSheet(null)}
      />
      <ConfirmSheet
        visible={sheet === 'code'}
        title={`New set-up code for ${label}?`}
        note="Their password stops working. They sign in with the new code, then choose a new password."
        confirm={{
          label: 'Make a new code',
          onPress: () =>
            void report(() =>
              change(async () => {
                const made = await newSetupCode(supabase, person.userId);
                setCode(made.code);
              }, 'New set-up code made'),
            ),
        }}
        onCancel={() => setSheet(null)}
      />
      <ConfirmSheet
        visible={sheet === 'remove'}
        title={`Remove ${label}’s access?`}
        note="They can still sign in, but see “No access yet” until someone gives them a role again. Nothing they did is lost."
        confirm={{
          label: 'Remove access',
          destructive: true,
          onPress: () => void report(() => change(() => removePersonAccess(supabase, person.userId), `${label} has no access now`)),
        }}
        onCancel={() => setSheet(null)}
      />
    </PersonView>
  );
}
