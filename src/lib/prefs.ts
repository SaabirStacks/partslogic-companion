import { Storage } from 'expo-sqlite/kv-store';

// Small per-device settings that must survive a restart and work offline, stored as JSON.
function pref<T>(key: string) {
  return {
    get(): T | null {
      try {
        const raw = Storage.getItemSync(key);
        return raw ? (JSON.parse(raw) as T) : null;
      } catch {
        return null;
      }
    },
    set(value: T | null): void {
      if (value == null) Storage.removeItemSync(key);
      else Storage.setItemSync(key, JSON.stringify(value));
    },
  };
}

export type WorkingLocation = { id: number; code: string; name: string };
// name and needsPassword arrived with People (31 Oct 2026); members cached before then have neither.
export type CachedMember = {
  userId: string;
  role: string;
  name?: string | null;
  needsPassword?: boolean;
  workspaceName: string;
  currency: string;
  // Saved since permissions came to PartsLogic; a member saved before reads as none and no limit until next loaded.
  permissions?: string[];
  orderLimit?: number | null;
};

export const memberPref = pref<CachedMember>('member');
export const locationsPref = pref<WorkingLocation[]>('locations');
export const workingLocationPref = pref<WorkingLocation>('working-location');

export type RecentPart = { partId: number; brand: string; number: string; description: string | null };
export const recentPartsPref = pref<RecentPart[]>('recent-parts');

export const installIdPref = pref<string>('install-id');
export type ScanIndexState = { version: string; syncedAt: string; codes: number };
export const scanIndexPref = pref<ScanIndexState>('scan-index');

// How bins are browsed when choosing one: a part of the name at a time (Tab view) or one long list.
export type BinView = 'tabs' | 'list';
export const binViewPref = pref<BinView>('bin-view');

// Whether the app makes sounds (scans, warnings, finished jobs). Unset means on; haptics stay either way.
export const soundsPref = pref<boolean>('sounds');
// The delivery being packed on this phone, with what is in the box so far (src/features/pack/pack.ts), so leaving the
// screen or closing the app loses nothing. Kept as plain JSON so this file needs no feature's types.
export const packBoxPref = pref<unknown>('pack-box');
// The driver's list as last read with signal (src/features/deliver), so the drop, its address and its parts are
// there at a door with none. Plain JSON, as packBoxPref.
export const deliveriesPref = pref<unknown>('deliveries');
