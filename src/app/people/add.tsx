import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { View, type TextInputInstance } from 'react-native';

import { feel } from '@/feel/feel';
import { useOnline } from '@/lib/network';
import { supabase } from '@/lib/supabase';
import { firstName } from '@/features/people/people-text';
import { RoleChoices } from '@/features/people/role-choices';
import { SetupCode } from '@/features/people/setup-code';
import { messageOf } from '@/features/people/use-people';
import { useSession } from '@/session/session-provider';
import { ActionBar } from '@/ui/action-bar';
import { Field } from '@/ui/field';
import { KeyboardScreen } from '@/ui/keyboard-screen';
import { Scroll } from '@/ui/scroll';
import { SectionLabel } from '@/ui/section-label';
import { StatusStrip } from '@/ui/status-strip';
import type { AppRole } from '@/vendor/partslogic/shared/members';
import { addPerson, rolesYouCanGive } from '@/vendor/partslogic/shared/people';

// Adding someone: their name, the email they'll sign in with, and their role. PartsLogic makes the account
// and hands back a one-time set-up code to give them; no email is sent.
export default function AddPerson() {
  const { state } = useSession();
  const online = useOnline();
  const myRole: AppRole = state.status === 'member' ? state.member.role : 'viewer';
  const roles = rolesYouCanGive(myRole);
  const emailRef = useRef<TextInputInstance>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  // Most people at the counter count and move stock, so that's where it starts.
  const [role, setRole] = useState<AppRole | null>(roles.includes('counter') ? 'counter' : (roles[0] ?? null));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [made, setMade] = useState<{ name: string | null; email: string; code: string } | null>(null);

  if (made) {
    return (
      <View className="flex-1 bg-ground">
        <Scroll contentContainerClassName="gap-3 px-4 pb-6 pt-3">
          <StatusStrip tone="ok" icon="sent" text={`${made.name ?? made.email} can sign in now`} />
          <SetupCode person={made} code={made.code} />
        </Scroll>
        <ActionBar label="Done" icon="check" onPress={() => router.back()} />
      </View>
    );
  }

  const ready = online && email.trim() !== '' && role !== null;
  const who = firstName(name);

  async function submit() {
    if (!ready || busy || !role) return;
    setBusy(true);
    setProblem(null);
    try {
      const result = await addPerson(supabase, { email: email.trim(), name: name.trim(), role });
      feel('done');
      setMade({ name: name.trim() || null, email: email.trim().toLowerCase(), code: result.code });
    } catch (error) {
      setProblem(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardScreen>
      <Scroll contentContainerClassName="gap-4 px-4 pb-6 pt-3">
        {!online ? <StatusStrip tone="warn" icon="offline" text="Offline · connect to add people" /> : null}
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => emailRef.current?.focus()}
          editable={!busy}
        />
        <Field
          ref={emailRef}
          label="Email they sign in with"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          returnKeyType="done"
          editable={!busy}
        />
        <SectionLabel>Role</SectionLabel>
        <RoleChoices roles={roles} value={role} onChoose={setRole} disabled={busy} />
        {problem ? <StatusStrip tone="stop" icon="stop" text={problem} /> : null}
      </Scroll>
      <ActionBar label={who ? `Add ${who}` : 'Add person'} icon="addPerson" onPress={submit} busy={busy} disabled={!ready} />
    </KeyboardScreen>
  );
}
