import type { IconName } from '@/ui/icons';
import type { Tone } from '@/ui/palette';

import type { GroupStatus } from './lines';

export type StatusSign = { text: string; icon: IconName; tone: Tone; problem: boolean };

// Where a scanned code stands, as a short sign: green once booked, yellow when the office has to look,
// red when PartsLogic refused it or it can't be sent. Waiting to send is normal, so it stays plain.
export function statusText(status: GroupStatus, reason: string | null): StatusSign {
  switch (status) {
    case 'booked':
      return { text: 'Booked', icon: 'sent', tone: 'safe', problem: false };
    case 'waiting':
      return { text: 'Waiting to send', icon: 'waiting', tone: 'surface', problem: false };
    case 'unknown':
      return { text: 'Unknown · kept for the office', icon: 'warning', tone: 'warning', problem: false };
    case 'void':
      return { text: 'Undo kept for the office', icon: 'warning', tone: 'warning', problem: false };
    case 'refused':
      return { text: reason ? `Refused · ${reason}` : 'Refused', icon: 'stop', tone: 'stop', problem: true };
    case 'attention':
      return { text: reason ? `Not sent · ${reason}` : 'Not sent', icon: 'stop', tone: 'stop', problem: true };
  }
}
