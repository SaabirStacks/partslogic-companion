import { useRef, useState } from 'react';
import { View, type TextInputInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useOnline } from '@/lib/network';
import { useSession } from '@/session/session-provider';
import { passwordCheck, MIN_PASSWORD } from '@/session/session-state';
import { Button } from '@/ui/button';
import { Field } from '@/ui/field';
import { KeyboardScreen } from '@/ui/keyboard-screen';
import { Scroll } from '@/ui/scroll';
import { StatusStrip } from '@/ui/status-strip';
import { Txt } from '@/ui/text';
import { Wordmark } from '@/ui/wordmark';

// Straight after signing in with a set-up code: the person chooses their own password before anything
// else, so the code an admin saw stops working.
export default function ChoosePassword() {
  const { state, choosePassword, signOut } = useSession();
  const online = useOnline();
  const againRef = useRef<TextInputInstance>(null);
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const name = state.status === 'choose-password' ? state.member.name : null;
  const check = passwordCheck(password, again);
  const ready = online && check === null && again === password;

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setProblem(null);
    const message = await choosePassword(password);
    setBusy(false);
    if (message) setProblem(message);
  }

  return (
    <SafeAreaView className="flex-1 bg-ground">
      <KeyboardScreen>
        <Scroll toEdge={false} contentContainerClassName="flex-grow justify-between gap-8 px-5 pt-6">
          <View className="gap-8">
            <Wordmark />
            <View className="gap-4">
              <View className="gap-1">
                <Txt accessibilityRole="header" variant="headline" className="font-extrabold">
                  {name ? `Welcome, ${name.split(' ')[0]}` : 'Choose your password'}
                </Txt>
                <Txt variant="caption">
                  {`You signed in with a set-up code. Choose your own password now: at least ${MIN_PASSWORD} characters. You’ll use it here and in the back office.`}
                </Txt>
              </View>
              <Field
                label="New password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => againRef.current?.focus()}
                editable={!busy}
              />
              <Field
                ref={againRef}
                label="Same password again"
                value={again}
                onChangeText={setAgain}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="go"
                onSubmitEditing={submit}
                editable={!busy}
              />
              {!online ? <StatusStrip tone="warn" icon="offline" text="Offline · connect to save your password" /> : null}
              {password !== '' && check ? <StatusStrip tone="neutral" icon="key" text={check} /> : null}
              {problem ? <StatusStrip tone="stop" icon="stop" text={problem} /> : null}
            </View>
          </View>
          <View className="gap-2">
            <Button label={busy ? 'Saving' : 'Save password'} icon="key" onPress={submit} busy={busy} disabled={!ready} />
            <Button label="Sign out" variant="secondary" onPress={signOut} disabled={busy} />
          </View>
        </Scroll>
      </KeyboardScreen>
    </SafeAreaView>
  );
}
