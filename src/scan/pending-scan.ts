import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

// One scan waiting on the person: while it's here the camera stays paused, the result card shows what was
// scanned and how many, and nothing is recorded until they confirm it (or skip it). hit is null while the
// code is still being checked. Any job that records scans uses it: Receive and Count today, Pick and Pack
// later.
export type PendingScan<Hit> = { key: string; code: string; hit: Hit | null; qty: number };

export type PendingAction<Hit> =
  | { type: 'check'; key: string; code: string }
  | { type: 'found'; key: string; hit: Hit }
  | { type: 'step'; change: 1 | -1 }
  | { type: 'set'; qty: number }
  | { type: 'clear' };

export function pendingReducer<Hit>(state: PendingScan<Hit> | null, action: PendingAction<Hit>): PendingScan<Hit> | null {
  switch (action.type) {
    case 'check':
      return { key: action.key, code: action.code, hit: null, qty: 1 };
    case 'found':
      // An answer for a scan that has since been skipped or replaced is dropped.
      return state && state.key === action.key ? { ...state, hit: action.hit } : state;
    case 'step':
      return state ? { ...state, qty: Math.max(1, state.qty + action.change) } : state;
    case 'set':
      return state && Number.isInteger(action.qty) && action.qty >= 1 ? { ...state, qty: action.qty } : state;
    case 'clear':
      return null;
  }
}

let nextKey = 0;

// check answers what a code is and must never throw. recheck says which answers are worth asking again when
// the screen comes back into view: an unknown code someone has just gone off to add as a part.
export function usePendingScan<Hit>({ check, recheck }: { check: (code: string) => Promise<Hit>; recheck?: (hit: Hit) => boolean }) {
  const [pending, dispatch] = useReducer(pendingReducer<Hit>, null);

  const hold = useCallback(
    async (code: string) => {
      const key = String(++nextKey);
      dispatch({ type: 'check', key, code });
      dispatch({ type: 'found', key, hit: await check(code) });
    },
    [check],
  );

  // Asks again about the scan being held, keeping its quantity.
  const retry = useCallback(async () => {
    if (!pending) return;
    dispatch({ type: 'found', key: pending.key, hit: await check(pending.code) });
  }, [pending, check]);

  // On coming back into view (not on every change to the scan), so the focus callback reads the latest scan
  // through a ref.
  const latest = useRef<{ pending: PendingScan<Hit> | null; retry: () => Promise<void> } | null>(null);
  useEffect(() => {
    latest.current = { pending, retry };
  });
  useFocusEffect(
    useCallback(() => {
      const held = latest.current?.pending;
      if (held?.hit && recheck?.(held.hit)) void latest.current?.retry();
    }, [recheck]),
  );

  return useMemo(
    () => ({
      pending,
      hold,
      retry,
      step: (change: 1 | -1) => dispatch({ type: 'step', change }),
      setQty: (qty: number) => dispatch({ type: 'set', qty }),
      clear: () => dispatch({ type: 'clear' }),
    }),
    [pending, hold, retry],
  );
}
