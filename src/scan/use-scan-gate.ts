import { useCallback, useRef } from 'react';

import { acceptScan, type SeenCode } from './scan-gate';

// Returns a function that says whether a camera read is a new scan (see scan-gate.ts).
export function useScanGate(): (code: string) => boolean {
  const last = useRef<SeenCode>(null);
  return useCallback((code: string) => {
    const now = Date.now();
    const accepted = acceptScan(last.current, code, now);
    last.current = { code, seenAt: now };
    return accepted;
  }, []);
}
