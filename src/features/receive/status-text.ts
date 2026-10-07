import type { GroupStatus } from './lines';

// Plain words for where a scanned code stands, and whether a person needs to act.
export function statusText(status: GroupStatus, reason: string | null): { text: string; problem: boolean } {
  switch (status) {
    case 'booked':
      return { text: 'Booked into Unbinned', problem: false };
    case 'waiting':
      return { text: 'Saved, waiting to send', problem: false };
    case 'unknown':
      return { text: 'Unknown barcode: kept for the office to match, or add the part', problem: false };
    case 'void':
      return { text: 'Undo kept for the office to review', problem: false };
    case 'refused':
      return { text: reason ? `Refused: ${reason}` : 'Refused', problem: true };
    case 'attention':
      return { text: reason ? `Not sent: ${reason}` : 'Not sent', problem: true };
  }
}
