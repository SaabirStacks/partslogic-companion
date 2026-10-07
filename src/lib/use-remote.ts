import { useCallback, useEffect, useEffectEvent, useState } from 'react';

type Outcome<T> =
  | { key: string; attempt: number; ok: true; data: T }
  | { key: string; attempt: number; ok: false; error: unknown };

// Loads data for a key (null means nothing to load). While reloading it keeps showing the last data
// for the same key, and an answer that arrives for an old key is ignored.
export function useRemote<T>(key: string | null, load: () => Promise<T>) {
  const [outcome, setOutcome] = useState<Outcome<T> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const run = useEffectEvent(load);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    run().then(
      (data) => {
        if (!cancelled) setOutcome({ key, attempt, ok: true, data });
      },
      (error: unknown) => {
        if (!cancelled) setOutcome({ key, attempt, ok: false, error });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key, attempt]);

  const current = outcome && outcome.key === key ? outcome : null;
  const reload = useCallback(() => setAttempt((count) => count + 1), []);
  return {
    data: current?.ok ? current.data : undefined,
    error: current && !current.ok ? current.error : undefined,
    loading: key !== null && current?.attempt !== attempt,
    reload,
  };
}
