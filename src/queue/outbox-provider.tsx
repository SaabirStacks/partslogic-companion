import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { db } from '@/db/database';
import { useOnline } from '@/lib/network';
import { useSession } from '@/session/session-provider';
import type { QueueItem } from '@/vendor/partslogic/shared/bin-session';

import { sendQueued } from './handlers';
import { backoffMs, runOutbox } from './runner';
import { SqliteOutboxStore } from './sqlite-store';
import type { Coalesce, OutboxItem } from './types';

export type OutboxContextValue = {
  // Saves the work on the phone first, then sends it when it can.
  enqueue: (payload: QueueItem, label: string, coalesce?: Coalesce) => Promise<void>;
  // Unsent work, and work sent in the last 24 hours, newest first.
  items: OutboxItem[];
  waiting: number;
  needsAttention: number;
  lastSentAt: string | null;
  // The last passing failure (no signal, timeout), cleared once sending works again.
  lastProblem: string | null;
  retry: (clientId: string) => Promise<void>;
  sendNow: () => void;
};

// Exported so the dev review gallery can supply a fixture outbox.
export const OutboxContext = createContext<OutboxContextValue | null>(null);
const DAY_MS = 24 * 3600 * 1000;

export function OutboxProvider({ children }: { children: ReactNode }) {
  const { state } = useSession();
  const userId = state.status === 'member' ? state.member.userId : null;
  const online = useOnline();
  const store = useMemo(() => new SqliteOutboxStore(db()), []);

  const [items, setItems] = useState<OutboxItem[]>([]);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [lastProblem, setLastProblem] = useState<string | null>(null);

  const running = useRef(false);
  const again = useRef(false);
  const failures = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped by the backoff timer to wake the sender.
  const [wake, setWake] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const since = new Date(Date.now() - DAY_MS).toISOString();
    const recent = await store.recent(userId, since);
    setItems(recent);
  }, [store, userId]);

  // One sender at a time; work queued while it runs makes it go round again.
  const run = useCallback(async (): Promise<void> => {
    if (!userId) return;
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    if (timer.current) clearTimeout(timer.current);
    try {
      do {
        again.current = false;
        const report = await runOutbox(store, userId, sendQueued);
        if (report.sent > 0) setLastSentAt(new Date().toISOString());
        if (report.stoppedBy) {
          failures.current += 1;
          setLastProblem(report.stoppedBy);
          timer.current = setTimeout(() => setWake((count) => count + 1), backoffMs(failures.current));
          break;
        }
        failures.current = 0;
        setLastProblem(null);
      } while (again.current);
    } finally {
      running.current = false;
      await refresh();
    }
  }, [store, userId, refresh]);

  // Start: put back anything left mid-send by a closed app, then send.
  useEffect(() => {
    if (!userId) return;
    void store.recover().then(run);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [store, userId, run]);

  // Send as soon as the signal comes back, and when the backoff timer wakes the sender.
  useEffect(() => {
    if (online) void Promise.resolve().then(run);
  }, [online, wake, run]);

  // And whenever the app comes back to the front.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void run();
    });
    return () => subscription.remove();
  }, [run]);

  const enqueue = useCallback(
    async (payload: QueueItem, label: string, coalesce?: Coalesce) => {
      if (!userId) throw new Error('Sign in to save work.');
      await store.enqueue({ userId, payload, label }, coalesce);
      await refresh();
      if (online) void run();
    },
    [store, userId, online, refresh, run],
  );

  const retry = useCallback(
    async (clientId: string) => {
      await store.retry(clientId);
      await refresh();
      void run();
    },
    [store, refresh, run],
  );

  const value = useMemo(() => {
    const waiting = items.filter((item) => item.status === 'pending' || item.status === 'sending').length;
    const needsAttention = items.filter((item) => item.status === 'attention').length;
    return {
      enqueue,
      items,
      waiting,
      needsAttention,
      lastSentAt,
      lastProblem,
      retry,
      sendNow: () => void run(),
    };
  }, [enqueue, items, lastSentAt, lastProblem, retry, run]);

  return <OutboxContext value={value}>{children}</OutboxContext>;
}

export function useOutbox(): OutboxContextValue {
  const value = use(OutboxContext);
  if (!value) throw new Error('useOutbox must be used inside OutboxProvider.');
  return value;
}
