import type { Href } from 'expo-router';

import type { IconName } from '@/ui/icons';
import { roleAtLeast, type AppRole } from '@/vendor/partslogic/shared/members';

export type Job = {
  id: 'lookup' | 'receive' | 'count';
  label: string;
  icon: IconName;
  href: Href;
  // Blue for a job; black for one with no state of its own.
  tone: 'mandatory' | 'plain';
  // The least role that may do it; PartsLogic's row-level security makes the same call on the server.
  minRole: AppRole;
};

// The jobs on the board, in the order they're drawn. The first leads the board as a wide sign.
export const JOBS: readonly Job[] = [
  { id: 'lookup', label: 'Look up', icon: 'lookup', href: '/lookup', tone: 'mandatory', minRole: 'viewer' },
  { id: 'receive', label: 'Receive', icon: 'receive', href: '/receive', tone: 'mandatory', minRole: 'counter' },
  { id: 'count', label: 'Put away & count', icon: 'count', href: '/count', tone: 'mandatory', minRole: 'counter' },
];

// Viewers can only look parts up; counters and above get every job.
export function jobsFor(role: AppRole): Job[] {
  return JOBS.filter((job) => roleAtLeast(role, job.minRole));
}
