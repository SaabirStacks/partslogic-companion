import '@/global.css';

import { router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';

import { Gallery } from '@/dev/gallery';
import { NotSetUp } from '@/features/setup/not-set-up';
import { prepareFeel } from '@/feel/feel';
import { publicConfig } from '@/lib/config';
import { NetworkProvider } from '@/lib/network-provider';
import { OutboxProvider } from '@/queue/outbox-provider';
import { ScanIndexProvider } from '@/scan/scan-index-provider';
import { LocationProvider } from '@/session/location-provider';
import { SessionProvider, useSession } from '@/session/session-provider';
import { Icon } from '@/ui/icon';
import { colour, themeVars, type Scheme } from '@/ui/palette';
import { PressableCard } from '@/ui/surface';
import { navigationTheme, useScheme } from '@/ui/theme';
import { liveWorkflow } from '@/workflows/catalogue';

/*
 * Direction: the trade counter (the till look approved with the task screens mock-up).
 *
 * THESIS      Calm by default, like a good till: white cards on a light grey counter, near-black words, and
 *             colour with three jobs. Blue marks the button you're meant to press; green, yellow and red
 *             are states (done or sent, check it, stopped), shown as a word and a symbol on a soft chip;
 *             teal, violet and plum say which family a job is (goods in, stock, parts). Short sounds and
 *             haptics mark the moments that matter without looking (src/feel). DESIGN.md has the system.
 * OWN-WORLD   Light grey ground, white surfaces with 12 px corners and a hairline edge (graphite at night).
 *             The phone's own typeface in sentence case; quantities, codes and bins in tabular figures.
 *             Pictograms are SF Symbols / Material symbols, bold. Tokens in palette.ts, parts in surface.tsx,
 *             text.tsx and status-chip.tsx.
 * STORY       Every job starts by saying what it is (who a delivery is from, which bin), then scans one item
 *             at a time with a confirm card, and ends with a receipt.
 * FIRST VIEW  The board: the name and account, where this phone works and whether its work is sent, the
 *             search field (Look up), open work to resume, then the jobs as tiles under their families.
 * JOB SCREEN  A strip saying what the job is locked to; the camera with white aim marks; the result card
 *             rising over its bottom edge; the tally and lines below; one blue button pinned at the bottom.
 */

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useScheme();

  // Ready the sounds as the app opens, so the first scan beeps on time.
  useEffect(() => {
    if (Platform.OS !== 'web') prepareFeel();
  }, []);

  // On the web the app is only the dev review gallery: the phone screens drawn from fixtures, for
  // screenshots at phone size. Nothing on the web signs in or keeps data.
  if (Platform.OS === 'web') return <Gallery />;

  return (
    <ThemeProvider value={navigationTheme(scheme)}>
      <View style={themeVars(scheme)} className="flex-1 bg-ground">
        {publicConfig.ok ? (
          <NetworkProvider>
            <SessionProvider>
              <LocationProvider>
                <OutboxProvider>
                  <ScanIndexProvider>
                    <RootStack scheme={scheme} />
                  </ScanIndexProvider>
                </OutboxProvider>
              </LocationProvider>
            </SessionProvider>
          </NetworkProvider>
        ) : (
          <NotSetUp problems={publicConfig.problems} />
        )}
      </View>
    </ThemeProvider>
  );
}

// A job's native header: its name in bold on the ground colour, the system back control, and Look up on
// the right so a part can be checked mid-job without losing the job.
function jobHeader(scheme: Scheme, title: string, quickLookUp = true) {
  return {
    headerShown: true,
    title,
    headerTitleStyle: { fontSize: 19, fontWeight: '700' as const, color: colour(scheme, 'ink') },
    headerStyle: { backgroundColor: colour(scheme, 'ground') },
    headerTintColor: colour(scheme, 'ink'),
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal' as const,
    headerRight: quickLookUp ? () => <QuickLookUp /> : undefined,
  };
}

function QuickLookUp() {
  return (
    <PressableCard accessibilityLabel="Look up a part" onPress={() => router.push('/lookup')} className="h-11 w-11 items-center justify-center rounded-[10px]">
      <Icon name="lookup" size={20} />
    </PressableCard>
  );
}

const SHEET = { presentation: 'formSheet', sheetGrabberVisible: true } as const;

// Which screens exist depends on who is signed in; Expo Router moves between the groups as it changes.
function RootStack({ scheme }: { scheme: Scheme }) {
  const { state } = useSession();
  const status = state.status;

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync();
  }, [status]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colour(scheme, 'ground') } }}>
      <Stack.Protected guard={status === 'signed-out' || status === 'loading'}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'not-member' || status === 'unavailable'}>
        <Stack.Screen name="no-access" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'member'}>
        <Stack.Screen name="index" />
        <Stack.Screen name="lookup" options={jobHeader(scheme, liveWorkflow('lookup').label, false)} />
        <Stack.Screen name="part/[id]" options={jobHeader(scheme, 'Part')} />
        <Stack.Screen name="receive" options={jobHeader(scheme, liveWorkflow('receive').label)} />
        <Stack.Screen name="count" options={jobHeader(scheme, liveWorkflow('stock-count').label)} />
        <Stack.Screen name="waiting" options={jobHeader(scheme, 'To put away')} />
        <Stack.Screen name="sync" options={jobHeader(scheme, 'Sync', false)} />
        <Stack.Screen name="account" options={{ ...SHEET, sheetAllowedDetents: [0.6, 1] }} />
        <Stack.Screen name="location" options={{ ...SHEET, sheetAllowedDetents: [0.5, 1] }} />
        <Stack.Screen name="move" options={jobHeader(scheme, liveWorkflow('transfer').label)} />
        <Stack.Screen name="quick-add" options={jobHeader(scheme, liveWorkflow('add-part').label)} />
      </Stack.Protected>
    </Stack>
  );
}
