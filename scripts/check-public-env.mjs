#!/usr/bin/env node
// Stops a build or update that lacks the app's two public settings, so it can't ship an app that closes
// on launch. EAS runs it before every build (the eas-build-post-install script in package.json) and before
// every update (.eas/workflows/update-preview.yml). Run it yourself with: npm run check:env
//
// It finds values the way Expo CLI does: the environment first, then .env.local, then .env.
// The same rules as checkPublicConfig in src/lib/config.ts, which the app applies when it starts.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sources = [
  process.env,
  ...['.env.local', '.env']
    .map((file) => path.join(root, file))
    .filter((file) => existsSync(file))
    .map((file) => parseEnv(readFileSync(file, 'utf8'))),
];
const valueOf = (name) => sources.map((source) => source[name]?.trim()).find(Boolean) ?? '';

const url = valueOf('EXPO_PUBLIC_SUPABASE_URL');
const publishableKey = valueOf('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
const problems = [];
if (!url) problems.push('EXPO_PUBLIC_SUPABASE_URL is not set');
else if (!/^https?:\/\//.test(url)) problems.push('EXPO_PUBLIC_SUPABASE_URL must start with https://');
if (!publishableKey) problems.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set');

if (problems.length > 0) {
  console.error('The app would close on launch without its public settings:');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('Set them in .env (committed) or as EAS environment variables. See docs/DEPLOY.md.');
  process.exit(1);
}
console.log(`Public app settings found (${new URL(url).host}).`);
