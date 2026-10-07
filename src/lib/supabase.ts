import 'react-native-url-polyfill/auto';

import type { Database } from '@partslogic/db-types';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { LargeSecureStore } from './large-secure-store';

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not set. Copy .env.example to .env.local and fill it in.`);
  return value;
}

// Expo inlines EXPO_PUBLIC_ variables at build time, so they must be read as written here (no destructuring).
// Both are safe to ship: the publishable key only reaches what row-level security allows.
const url = required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL);
const publishableKey = required('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

export const supabase = createClient<Database>(url, publishableKey, {
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// From Supabase's React Native guide: refresh the session only while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
