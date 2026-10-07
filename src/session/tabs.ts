import { roleAtLeast, type AppRole } from '@/vendor/partslogic/shared/members';

export type TabName = 'lookup' | 'receive' | 'count' | 'outbox' | 'account';

// Counters and above get every job. Viewers can only look parts up, so their account (and sign out)
// moves to its own tab instead of the outbox.
export function visibleTabs(role: AppRole): TabName[] {
  return roleAtLeast(role, 'counter') ? ['lookup', 'receive', 'count', 'outbox'] : ['lookup', 'account'];
}
