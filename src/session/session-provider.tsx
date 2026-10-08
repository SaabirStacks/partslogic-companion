import type { Session } from '@supabase/supabase-js';
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { memberPref } from '@/lib/prefs';
import { supabase } from '@/lib/supabase';
import { getCurrentMember } from '@/vendor/partslogic/shared/members';

import { fromCache, signInProblem, stateAfterLookup, type MemberLookup, type SessionState } from './session-state';

export type SessionContextValue = {
  state: SessionState;
  // True while the member lookup is running (after sign-in, or "Check again").
  checking: boolean;
  // Resolves to a message for the person when sign-in fails, otherwise null.
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  retry: () => void;
};

type Lookup = { userId: string; attempt: number; result: MemberLookup };

// Exported so the dev review gallery can supply a fixture session.
export const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  // undefined until the stored session has been read.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    // Only store the session here: Supabase warns against calling it from inside this callback.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;
  const email = session?.user.email ?? '';

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getCurrentMember(supabase, userId)
      .then(
        (member): MemberLookup => ({ ok: true, member }),
        (): MemberLookup => ({ ok: false }),
      )
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          const { member } = result;
          memberPref.set(
            member
              ? { userId, role: member.role, workspaceName: member.workspaceName, currency: member.currency }
              : null,
          );
        }
        setLookup({ userId, attempt, result });
      });
    return () => {
      cancelled = true;
    };
  }, [userId, attempt]);

  // The latest answer for this user, even from an earlier attempt, so "Check again" keeps the screen.
  const latest = lookup && lookup.userId === userId ? lookup : null;
  // Used before the first answer and when a lookup fails; a successful lookup always wins.
  const cached = useMemo(() => (userId ? fromCache(memberPref.get(), userId) : null), [userId]);
  const checking = userId !== null && latest?.attempt !== attempt;

  const state: SessionState = useMemo(() => {
    if (session === undefined) return { status: 'loading' };
    if (!userId) return { status: 'signed-out' };
    if (latest) return stateAfterLookup(email, latest.result, cached);
    return cached ? { status: 'member', email, member: cached } : { status: 'loading' };
  }, [session, userId, email, latest, cached]);

  const signIn = useCallback(async (address: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: address.trim(), password });
    return error ? signInProblem(error) : null;
  }, []);

  // This phone only, so it works with no signal and leaves the back office signed in elsewhere.
  const signOut = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'local' });
    memberPref.set(null);
  }, []);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  const value = useMemo(
    () => ({ state, checking, signIn, signOut, retry }),
    [state, checking, signIn, signOut, retry],
  );
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionContextValue {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider.');
  return value;
}
