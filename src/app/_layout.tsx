import '@/global.css';

import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';

import { OutboxProvider } from '@/queue/outbox-provider';
import { ScanIndexProvider } from '@/scan/scan-index-provider';
import { LocationProvider } from '@/session/location-provider';
import { SessionProvider, useSession } from '@/session/session-provider';
import { themeVars } from '@/ui/palette';
import { navigationTheme, useScheme } from '@/ui/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useScheme();
  return (
    <ThemeProvider value={navigationTheme(scheme)}>
      <View style={themeVars(scheme)} className="flex-1 bg-canvas">
        <SessionProvider>
          <LocationProvider>
            <OutboxProvider>
              <ScanIndexProvider>
                <RootStack />
              </ScanIndexProvider>
            </OutboxProvider>
          </LocationProvider>
        </SessionProvider>
      </View>
    </ThemeProvider>
  );
}

// Which screens exist depends on who is signed in; Expo Router moves between the groups as it changes.
function RootStack() {
  const { state } = useSession();
  const status = state.status;

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync();
  }, [status]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'signed-out' || status === 'loading'}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'not-member' || status === 'unavailable'}>
        <Stack.Screen name="no-access" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'member'}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="location"
          options={{ presentation: 'formSheet', sheetAllowedDetents: [0.5, 1], sheetGrabberVisible: true }}
        />
      </Stack.Protected>
    </Stack>
  );
}
