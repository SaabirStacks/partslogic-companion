import { useNetworkState } from 'expo-network';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/session/session-provider';
import { Button } from '@/ui/button';
import { useColour } from '@/ui/theme';

const FIELD = 'h-12 rounded-xl border border-rule bg-plate px-4 text-base text-ink focus:border-focus';

export default function SignIn() {
  const { checking, signIn } = useSession();
  const colourOf = useColour();
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
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="flex-grow justify-center gap-8 px-6 py-12">
          <View className="gap-2">
            <Text accessibilityRole="header" className="text-3xl font-bold text-ink">
              PartsLogic
            </Text>
            <Text className="text-base leading-6 text-quiet-ink">
              Sign in with the email and password you use for the back office.
            </Text>
          </View>

          <View className="gap-4">
            <View className="gap-1.5">
              <Text nativeID="email-label" className="text-sm font-semibold text-ink">
                Email
              </Text>
              <TextInput
                accessibilityLabelledBy="email-label"
                accessibilityLabel="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                textContentType="username"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                editable={!busy}
                placeholderTextColor={colourOf('quiet-ink')}
                className={FIELD}
              />
            </View>
            <View className="gap-1.5">
              <Text nativeID="password-label" className="text-sm font-semibold text-ink">
                Password
              </Text>
              <TextInput
                ref={passwordRef}
                accessibilityLabelledBy="password-label"
                accessibilityLabel="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={submit}
                editable={!busy}
                className={FIELD}
              />
            </View>
            {offline ? (
              <Text accessibilityRole="alert" className="text-base text-stop-ink">
                You’re offline. Connect to sign in.
              </Text>
            ) : null}
            {problem ? (
              <Text accessibilityRole="alert" className="text-base text-stop-ink">
                {problem}
              </Text>
            ) : null}
          </View>

          <Button label={busy ? 'Signing in' : 'Sign in'} onPress={submit} busy={busy} disabled={!ready} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
