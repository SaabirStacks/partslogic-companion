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
export type CachedMember = { userId: string; role: string; workspaceName: string; currency: string };

export const memberPref = pref<CachedMember>('member');
export const locationsPref = pref<WorkingLocation[]>('locations');
export const workingLocationPref = pref<WorkingLocation>('working-location');

export type RecentPart = { partId: number; brand: string; number: string; description: string | null };
export const recentPartsPref = pref<RecentPart[]>('recent-parts');

export const installIdPref = pref<string>('install-id');
export type ScanIndexState = { version: string; syncedAt: string; codes: number };
export const scanIndexPref = pref<ScanIndexState>('scan-index');
