import '@/global.css';

import { BarlowCondensed_600SemiBold } from '@expo-google-fonts/barlow-condensed/600SemiBold';
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed/700Bold';
import { BarlowCondensed_800ExtraBold } from '@expo-google-fonts/barlow-condensed/800ExtraBold';
import { useFonts } from 'expo-font';
import { router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';

import { Gallery } from '@/dev/gallery';
import { NotSetUp } from '@/features/setup/not-set-up';
import { publicConfig } from '@/lib/config';
import { OutboxProvider } from '@/queue/outbox-provider';
import { ScanIndexProvider } from '@/scan/scan-index-provider';
import { LocationProvider } from '@/session/location-provider';
import { SessionProvider, useSession } from '@/session/session-provider';
import { Icon } from '@/ui/icon';
import { colour, themeVars, type Scheme } from '@/ui/palette';
import { PressablePlate } from '@/ui/plate';
import { navigationTheme, useScheme } from '@/ui/theme';

/*
 * Direction: safety signage (impeccable direction contract, candidate 6 of 7, seed c57f0597, degraded).
 *
 * THESIS      Every state is a sign staff already obey: blue means do this, green means done or sent,
 *             yellow means check it (unknown, reorder, waiting), red means stop (out of stock, refused,
 *             error). It refuses the grouped-list "Settings" app with grey helper text.
 * OWN-WORLD   Concrete-grey ground in light mode, near-black in dark. Sign plates: flat colour, a 2-3 px
 *             edge, 6 px corners, no shadows or gradients. ISO 7010 hues tuned for contrast (palette.ts).
 *             Barlow Condensed 600-800 for codes, quantities, job names and buttons; the system face for
 *             small detail. Pictograms are SF Symbols / Material symbols, bold.
 * STORY       Open the app, see the jobs as signs, tap one, scan, read the result plate at a glance, finish
 *             with one thumb; the board shows what's waiting or done.
 * FIRST VIEW  The board: wordmark plate, location plate, sync plate, a yellow resume plate when work is
 *             open, then the jobs as blue signs (Add part black). A viewer sees one Look up sign.
 * JOB SCREEN  Camera on the top part with a yellow reticle; the result plate rises over its bottom edge;
 *             the tally and lines below; one full-width action plate pinned at the bottom.
 * SIGNATURE   The result plate rises in 160 ms with a haptic matched to its colour; with Reduce Motion
 *             on it switches in place.
 * FINISH      Unreviewed and undocumented is unfinished: the build ends with the finish review, the
 *             verdict and DESIGN.md.
 */

SplashScreen.preventAutoHideAsync();

// Each weight is its own family on SDK 57 (one family with several faces needs SDK 58).
const FONTS = { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold };

export default function RootLayout() {
  const scheme = useScheme();
  // If the font can't load, the app carries on in the system face rather than staying on the splash.
  const [fontsLoaded, fontError] = useFonts(FONTS);
  const fontsReady = fontsLoaded || fontError !== null;

  // On the web the app is only the dev review gallery: the phone screens drawn from fixtures, for
  // screenshots at phone size. Nothing on the web signs in or keeps data.
  if (Platform.OS === 'web') return fontsReady ? <Gallery /> : null;

  return (
    <ThemeProvider value={navigationTheme(scheme)}>
      <View style={themeVars(scheme)} className="flex-1 bg-ground">
        {!fontsReady ? null : publicConfig.ok ? (
          <SessionProvider>
            <LocationProvider>
              <OutboxProvider>
                <ScanIndexProvider>
                  <RootStack scheme={scheme} />
                </ScanIndexProvider>
              </OutboxProvider>
            </LocationProvider>
          </SessionProvider>
        ) : (
          <NotSetUp problems={publicConfig.problems} />
        )}
      </View>
    </ThemeProvider>
  );
}

// A job's native header: its name in the sign face on the ground colour, the system back control, and
// Look up on the right so a part can be checked mid-job without losing the job.
function jobHeader(scheme: Scheme, title: string, quickLookUp = true) {
  return {
    headerShown: true,
    title: title.toUpperCase(),
    headerTitleStyle: { fontFamily: 'BarlowCondensed_800ExtraBold', fontSize: 24, color: colour(scheme, 'ink') },
    headerStyle: { backgroundColor: colour(scheme, 'ground') },
    headerTintColor: colour(scheme, 'ink'),
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal' as const,
    headerRight: quickLookUp ? () => <QuickLookUp /> : undefined,
  };
}

function QuickLookUp() {
  return (
    <PressablePlate accessibilityLabel="Look up a part" onPress={() => router.push('/lookup')} className="h-11 w-11 items-center justify-center">
      <Icon name="lookup" size={22} />
    </PressablePlate>
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
        <Stack.Screen name="lookup" options={jobHeader(scheme, 'Look up', false)} />
        <Stack.Screen name="part/[id]" options={jobHeader(scheme, 'Part')} />
        <Stack.Screen name="receive" options={jobHeader(scheme, 'Receive')} />
        <Stack.Screen name="count" options={jobHeader(scheme, 'Put away & count')} />
        <Stack.Screen name="sync" options={jobHeader(scheme, 'Sync', false)} />
        <Stack.Screen name="account" options={{ ...SHEET, sheetAllowedDetents: [0.6, 1] }} />
        <Stack.Screen name="location" options={{ ...SHEET, sheetAllowedDetents: [0.5, 1] }} />
        <Stack.Screen name="move" options={{ ...SHEET, sheetAllowedDetents: [0.85, 1] }} />
        <Stack.Screen name="quick-add" options={{ ...SHEET, sheetAllowedDetents: [0.85, 1] }} />
      </Stack.Protected>
    </Stack>
  );
}
