import type { IconName } from '@/ui/icons';

export type SyncState = { tone: 'safe' | 'warning' | 'stop'; icon: IconName; label: string };

// The sync plate on the board, as a sign: red when PartsLogic refused something, yellow while work waits
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
  if (waiting > 0) return { tone: 'warning', icon: online ? 'waiting' : 'offline', label: `${waiting} waiting` };
  if (!online) return { tone: 'warning', icon: 'offline', label: 'Offline' };
  return { tone: 'safe', icon: 'sent', label: 'All sent' };
}
