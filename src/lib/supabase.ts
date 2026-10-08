import 'react-native-url-polyfill/auto';

import type { Database } from '@partslogic/db-types';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { publicConfig } from './config';
import { LargeSecureStore } from './large-secure-store';

// Without its settings the app shows a set-up screen (src/app/_layout.tsx) and never uses this client.
// The placeholders only stop this import from crashing the app before that screen can appear.
const settings = publicConfig.ok
  ? publicConfig
  : { url: 'https://not-configured.invalid', publishableKey: 'not-configured' };

export const supabase = createClient<Database>(settings.url, settings.publishableKey, {
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: publicConfig.ok,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// From Supabase's React Native guide: refresh the session only while the app is in the foreground.
if (publicConfig.ok) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
