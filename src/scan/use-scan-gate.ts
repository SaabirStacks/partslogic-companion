import { useCallback, useMemo, useRef } from 'react';

import { emptyGate, gateRead, gateRelease, type GateState } from './scan-gate';

// The scan gate for one camera (see scan-gate.ts): read() says which camera read, if any, is a new scan;
// release() is called when scanning resumes after a pause.
export function useScanGate() {
  const state = useRef<GateState>(emptyGate);
  const read = useCallback((code: string, distance: number | null) => {
    const next = gateRead(state.current, code, Date.now(), distance);
    state.current = next.state;
    return next.accepted;
  }, []);
  const release = useCallback(() => {
    state.current = gateRelease(state.current, Date.now());
  }, []);
  return useMemo(() => ({ read, release }), [read, release]);
}
