import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { db } from '@/db/database';
import { useOnline } from '@/lib/network';
import { scanIndexPref, type ScanIndexState } from '@/lib/prefs';
import { useSession } from '@/session/session-provider';
import { roleAtLeast } from '@/vendor/partslogic/shared/members';

import { syncScanIndex } from './scan-index';

export type ScanIndexContextValue = {
  saved: ScanIndexState | null;
  // Codes downloaded so far while an update runs, otherwise null.
  progress: number | null;
  failed: boolean;
  update: () => void;
};

// Exported so the dev review gallery can supply a fixture scan list.
export const ScanIndexContext = createContext<ScanIndexContextValue | null>(null);
const EVERY_MS = 15 * 60 * 1000;

// Keeps this phone's offline scan list in step with PartsLogic: on start, when the signal comes back, and
// every 15 minutes while the app is open. Counters and up only (the list is theirs to scan against).
export function ScanIndexProvider({ children }: { children: ReactNode }) {
  const { state } = useSession();
  const online = useOnline();
  const allowed = state.status === 'member' && roleAtLeast(state.member.role, 'counter');

  const [saved, setSaved] = useState<ScanIndexState | null>(() => scanIndexPref.get());
  const [progress, setProgress] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);

  const update = useCallback(async () => {
    if (!allowed || busy.current) return;
    busy.current = true;
    try {
      await syncScanIndex(db(), (codes) => setProgress(codes));
      setSaved(scanIndexPref.get());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
      setProgress(null);
    }
  }, [allowed]);

  useEffect(() => {
    if (!allowed || !online) return;
    void Promise.resolve().then(update);
    const interval = setInterval(() => void update(), EVERY_MS);
    return () => clearInterval(interval);
  }, [allowed, online, update]);

  const value = useMemo(() => ({ saved, progress, failed, update: () => void update() }), [saved, progress, failed, update]);
  return <ScanIndexContext value={value}>{children}</ScanIndexContext>;
}

export function useScanIndex(): ScanIndexContextValue {
  const value = use(ScanIndexContext);
  if (!value) throw new Error('useScanIndex must be used inside ScanIndexProvider.');
  return value;
}
