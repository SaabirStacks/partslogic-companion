import { useRef, useState } from 'react';
import { View, type TextInputInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useOnline } from '@/lib/network';
import { useSession } from '@/session/session-provider';
import { Button } from '@/ui/button';
import { Field } from '@/ui/field';
import { Txt } from '@/ui/text';
import { StatusStrip } from '@/ui/status-strip';
import { Wordmark } from '@/ui/wordmark';
import { KeyboardScreen } from '@/ui/keyboard-screen';
import { Scroll } from '@/ui/scroll';

export default function SignIn() {
  const { checking, signIn } = useSession();
  const offline = !useOnline();
  const passwordRef = useRef<TextInputInstance>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const busy = submitting || checking;
  const ready = email.trim() !== '' && password !== '' && !offline;

  async function submit() {
    if (!ready || busy) return;
    setProblem(null);
    setSubmitting(true);
    const message = await signIn(email, password);
    setSubmitting(false);
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
                  Sign in
                </Txt>
                <Txt variant="caption">Same email and password as the back office.</Txt>
              </View>
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                textContentType="username"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => passwordRef.current?.focus()}
                editable={!busy}
              />
              <Field
                ref={passwordRef}
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={submit}
                editable={!busy}
              />
              {offline ? <StatusStrip tone="warn" icon="offline" text="Offline · connect to sign in" /> : null}
              {problem ? <StatusStrip tone="stop" icon="stop" text={problem} /> : null}
            </View>
          </View>

          <Button label={busy ? 'Signing in' : 'Sign in'} onPress={submit} busy={busy} disabled={!ready} />
        </Scroll>
      </KeyboardScreen>
    </SafeAreaView>
  );
}
