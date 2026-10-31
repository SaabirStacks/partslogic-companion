import type { Session } from '@supabase/supabase-js';
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { memberPref } from '@/lib/prefs';
import { supabase } from '@/lib/supabase';
import { getCurrentMember, type AppRole } from '@/vendor/partslogic/shared/members';
import { finishSetup, tidySetupCode } from '@/vendor/partslogic/shared/people';

import {
  fromCache,
  memberState,
  passwordProblem,
  signInProblem,
  stateAfterLookup,
  toCache,
  type MemberLookup,
  type SessionState,
} from './session-state';

export type SessionContextValue = {
  // What the app shows. While a developer previews another role, the member here has that role, so every
  // screen shows what that role would see.
  state: SessionState;
  // True while the member lookup is running (after sign-in, or "Check again").
  checking: boolean;
  // Resolves to a message for the person when sign-in fails, otherwise null.
  signIn: (email: string, password: string) => Promise<string | null>;
  // After a set-up code: saves their own password. A message when it wasn't saved, otherwise null.
  choosePassword: (password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  // Looks the member up again (Check again, or after their name changes).
  retry: () => void;
  // The signed-in person's own role, whatever is being previewed.
  realRole: AppRole | null;
  // The role a developer is previewing the app as, or null.
  previewRole: AppRole | null;
  setPreviewRole: (role: AppRole | null) => void;
};

type Lookup = { userId: string; attempt: number; result: MemberLookup };

// Exported so the dev review gallery can supply a fixture session.
export const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  // undefined until the stored session has been read.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Kept in memory only: restarting the app always shows a developer their own role again.
  const [preview, setPreview] = useState<{ userId: string; role: AppRole } | null>(null);

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
        if (result.ok) memberPref.set(result.member ? toCache(result.member) : null);
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

  const real: SessionState = useMemo(() => {
    if (session === undefined) return { status: 'loading' };
    if (!userId) return { status: 'signed-out' };
    if (latest) return stateAfterLookup(email, latest.result, cached);
    return cached ? memberState(email, cached) : { status: 'loading' };
  }, [session, userId, email, latest, cached]);

  const realRole = real.status === 'member' ? real.member.role : null;
  // Only a developer previews, and only as the person who started it.
  const previewRole = realRole === 'developer' && preview?.userId === userId ? preview.role : null;
  const state: SessionState = useMemo(
    () => (previewRole && real.status === 'member' ? { ...real, member: { ...real.member, role: previewRole } } : real),
    [real, previewRole],
  );

  const setPreviewRole = useCallback(
    (role: AppRole | null) => setPreview(role && userId && role !== 'developer' ? { userId, role } : null),
    [userId],
  );

  // A set-up code is typed in capitals with dashes (K7MQ-4XPA-2RHT); if the password as typed is refused,
  // try it written that way, so "k7mq 4xpa 2rht" works too.
  const signIn = useCallback(async (address: string, password: string) => {
    const credentials = { email: address.trim(), password };
    let { error } = await supabase.auth.signInWithPassword(credentials);
    const code = tidySetupCode(password);
    if (error?.code === 'invalid_credentials' && code !== password) {
      ({ error } = await supabase.auth.signInWithPassword({ ...credentials, password: code }));
    }
    return error ? signInProblem(error) : null;
  }, []);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  const choosePassword = useCallback(
    async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return passwordProblem(error);
      try {
        await finishSetup(supabase);
      } catch {
        return "Your password is saved, but PartsLogic didn't hear back. Try again.";
      }
      retry();
      return null;
    },
    [retry],
  );

  // This phone only, so it works with no signal and leaves the back office signed in elsewhere.
  const signOut = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'local' });
    memberPref.set(null);
    setPreview(null);
  }, []);

  const value = useMemo(
    () => ({ state, checking, signIn, choosePassword, signOut, retry, realRole, previewRole, setPreviewRole }),
    [state, checking, signIn, choosePassword, signOut, retry, realRole, previewRole, setPreviewRole],
  );
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionContextValue {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider.');
  return value;
}
