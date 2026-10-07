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
  | { status: 'member'; email: string; member: CurrentMember };

export type MemberLookup = { ok: true; member: CurrentMember | null } | { ok: false };

function isRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value);
}

export function fromCache(cached: CachedMember | null, userId: string): CurrentMember | null {
  if (!cached || cached.userId !== userId || !isRole(cached.role)) return null;
  return { userId, role: cached.role, workspaceName: cached.workspaceName, currency: cached.currency };
}

// What the app shows once the member lookup finishes. A failed lookup falls back to the member this phone
// last loaded for the same user, so staff can keep working with no signal.
export function stateAfterLookup(email: string, lookup: MemberLookup, cached: CurrentMember | null): SessionState {
  if (lookup.ok) {
    return lookup.member ? { status: 'member', email, member: lookup.member } : { status: 'not-member', email };
  }
  return cached ? { status: 'member', email, member: cached } : { status: 'unavailable', email };
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
