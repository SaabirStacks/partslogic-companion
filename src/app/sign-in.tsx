import { useNetworkState } from 'expo-network';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/session/session-provider';
import { Button } from '@/ui/button';
import { EntranceBoard } from '@/ui/entrance-board';
import { Field } from '@/ui/field';
import { Detail, SignText } from '@/ui/sign-text';
import { StatusStrip } from '@/ui/status-strip';

export default function SignIn() {
  const { checking, signIn } = useSession();
  const offline = useNetworkState().isInternetReachable === false;
  const passwordRef = useRef<TextInput>(null);

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
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="flex-grow justify-between gap-8 px-5 py-6">
          <View className="gap-8">
            <EntranceBoard />

            <View className="gap-4">
              <View className="gap-1">
                <SignText accessibilityRole="header" size="display" weight="heavy">
                  Sign in
                </SignText>
                <Detail>Same email and password as the back office.</Detail>
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
              {offline ? <StatusStrip tone="warning" icon="offline" text="Offline · connect to sign in" /> : null}
              {problem ? <StatusStrip tone="stop" icon="stop" text={problem} /> : null}
            </View>
          </View>

          <Button label={busy ? 'Signing in' : 'Sign in'} onPress={submit} busy={busy} disabled={!ready} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
