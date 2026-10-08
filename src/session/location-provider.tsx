import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { locationsPref, workingLocationPref, type WorkingLocation } from '@/lib/prefs';
import { supabase } from '@/lib/supabase';
import { listLocations } from '@/vendor/partslogic/shared/inventory';

import { resolveWorkingLocation, workingLocations } from './locations';
import { useSession } from './session-provider';

// loading: fetching the list. ready: the list is current. stale: the fetch failed, so the list is the
// one this phone saved last time (possibly empty).
export type LocationsStatus = 'loading' | 'ready' | 'stale';

export type LocationContextValue = {
  location: WorkingLocation | null;
  locations: WorkingLocation[];
  status: LocationsStatus;
  choose: (location: WorkingLocation) => void;
  refresh: () => void;
};

// Exported so the dev review gallery can supply a fixture location.
export const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const { state } = useSession();
  const memberId = state.status === 'member' ? state.member.userId : null;

  const [locations, setLocations] = useState<WorkingLocation[]>(() => locationsPref.get() ?? []);
  const [location, setLocation] = useState<WorkingLocation | null>(() => workingLocationPref.get());
  const [attempt, setAttempt] = useState(0);
  // The outcome of the last fetch; status is derived from it, so the effect never sets state directly.
  const [fetched, setFetched] = useState<{ memberId: string; attempt: number; ok: boolean } | null>(null);

  useEffect(() => {
    if (!memberId) return;
    let cancelled = false;

    listLocations(supabase).then(
      (rows) => {
        if (cancelled) return;
        const next = workingLocations(rows);
        const resolved = resolveWorkingLocation(workingLocationPref.get(), next);
        locationsPref.set(next);
        workingLocationPref.set(resolved);
        setLocations(next);
        setLocation(resolved);
        setFetched({ memberId, attempt, ok: true });
      },
      () => {
        if (!cancelled) setFetched({ memberId, attempt, ok: false });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [memberId, attempt]);

  const current = fetched && fetched.memberId === memberId && fetched.attempt === attempt ? fetched : null;
  const status: LocationsStatus = current ? (current.ok ? 'ready' : 'stale') : 'loading';

  const choose = useCallback((next: WorkingLocation) => {
    workingLocationPref.set(next);
    setLocation(next);
  }, []);

  const refresh = useCallback(() => setAttempt((count) => count + 1), []);

  const value = useMemo(
    () => ({ location, locations, status, choose, refresh }),
    [location, locations, status, choose, refresh],
  );
  return <LocationContext value={value}>{children}</LocationContext>;
}

export function useWorkingLocation(): LocationContextValue {
  const value = use(LocationContext);
  if (!value) throw new Error('useWorkingLocation must be used inside LocationProvider.');
  return value;
}
