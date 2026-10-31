import type { AppRole, CurrentMember } from '@/vendor/partslogic/shared/members';
import { APP_ROLES } from '@/vendor/partslogic/shared/members';

import type { CachedMember } from '@/lib/prefs';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  // Signed in, but this account is not a PartsLogic member.
  | { status: 'not-member'; email: string }
  // Signed in, PartsLogic can't be reached, and this phone has never loaded the member.
  | { status: 'unavailable'; email: string }
  // Signed in with a set-up code: they choose their own password before anything else.
  | { status: 'choose-password'; email: string; member: CurrentMember }
  | { status: 'member'; email: string; member: CurrentMember };

export type MemberLookup = { ok: true; member: CurrentMember | null } | { ok: false };

function isRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value);
}

export function fromCache(cached: CachedMember | null, userId: string): CurrentMember | null {
  if (!cached || cached.userId !== userId || !isRole(cached.role)) return null;
  return {
    userId,
    role: cached.role,
    name: cached.name ?? null,
    needsPassword: cached.needsPassword ?? false,
    workspaceName: cached.workspaceName,
    currency: cached.currency,
  };
}

// The member as this phone keeps it, for signing in again with no signal.
export function toCache(member: CurrentMember): CachedMember {
  return {
    userId: member.userId,
    role: member.role,
    name: member.name,
    needsPassword: member.needsPassword,
    workspaceName: member.workspaceName,
    currency: member.currency,
  };
}

// A member is shown the app, unless they're still on a set-up code.
export function memberState(email: string, member: CurrentMember): SessionState {
  return member.needsPassword ? { status: 'choose-password', email, member } : { status: 'member', email, member };
}

// What the app shows once the member lookup finishes. A failed lookup falls back to the member this phone
// last loaded for the same user, so staff can keep working with no signal.
export function stateAfterLookup(email: string, lookup: MemberLookup, cached: CurrentMember | null): SessionState {
  if (lookup.ok) {
    return lookup.member ? memberState(email, lookup.member) : { status: 'not-member', email };
  }
  return cached ? memberState(email, cached) : { status: 'unavailable', email };
}

// Plain wording for a failed sign-in.
export function signInProblem(error: { code?: string; name?: string; message: string; status?: number }): string {
  if (error.code === 'invalid_credentials') return "That email and password don't match.";
  if (error.code === 'email_not_confirmed') return 'Confirm your email address first, then sign in.';
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) {
    return "Can't reach PartsLogic. Check your signal and try again.";
  }
  return error.message;
}

// Plain wording for a password that wasn't saved.
export function passwordProblem(error: { code?: string; name?: string; message: string; status?: number }): string {
  if (error.code === 'weak_password') return 'That password is too easy to guess. Use a longer one, with letters and numbers.';
  if (error.code === 'same_password') return 'Choose a password that’s different from your set-up code.';
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) {
    return "Can't reach PartsLogic. Check your signal and try again.";
  }
  return error.message;
}

// The shortest password the phone accepts; PartsLogic may ask for more.
export const MIN_PASSWORD = 8;

// Why a new password can't be saved yet, or null when it can.
export function passwordCheck(password: string, again: string): string | null {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (again !== '' && again !== password) return 'The two passwords don’t match.';
  return null;
}
