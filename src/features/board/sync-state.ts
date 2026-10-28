import type { IconName } from '@/ui/icons';

export type SyncState = { tone: 'ok' | 'warn' | 'stop'; icon: IconName; label: string };

// The sync pill on the board: red when PartsLogic refused something, yellow while work waits
// (with the no-signal pictogram when that's why), green when everything has been sent.
export function syncState({
  waiting,
  needsAttention,
  online,
}: {
  waiting: number;
  needsAttention: number;
  online: boolean;
}): SyncState {
  if (needsAttention > 0) {
    return { tone: 'stop', icon: 'stop', label: `${needsAttention} ${needsAttention === 1 ? 'problem' : 'problems'}` };
  }
  if (waiting > 0) return { tone: 'warn', icon: online ? 'waiting' : 'offline', label: `${waiting} waiting` };
  if (!online) return { tone: 'warn', icon: 'offline', label: 'Offline' };
  return { tone: 'ok', icon: 'sent', label: 'All sent' };
}
