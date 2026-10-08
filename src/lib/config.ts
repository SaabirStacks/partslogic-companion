// The two public settings the app needs to reach PartsLogic. They come from .env (committed) or .env.local,
// and Expo writes them into the app when it bundles, so they must be read exactly as written below
// (process.env.NAME, no destructuring). Both are safe to ship: the publishable key only reaches what
// row-level security allows. scripts/check-public-env.mjs stops a build or update that lacks them.

export type PublicConfig =
  | { ok: true; url: string; publishableKey: string }
  | { ok: false; problems: string[] };

export function checkPublicConfig(raw: { url?: string; publishableKey?: string }): PublicConfig {
  const url = raw.url?.trim() ?? '';
  const publishableKey = raw.publishableKey?.trim() ?? '';
  const problems: string[] = [];
  if (!url) problems.push('EXPO_PUBLIC_SUPABASE_URL is not set');
  else if (!/^https?:\/\//.test(url)) problems.push('EXPO_PUBLIC_SUPABASE_URL must start with https://');
  if (!publishableKey) problems.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set');
  return problems.length > 0 ? { ok: false, problems } : { ok: true, url, publishableKey };
}

export const publicConfig = checkPublicConfig({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});
