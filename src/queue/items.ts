import type { QueueItem as FloorQueueItem } from '@/vendor/partslogic/shared/bin-session';
import type { CantScanReason, ShortPickReason } from '@/vendor/partslogic/shared/sales/picking';

// Everything the phone queues: PartsLogic's floor work (bin counts, deliveries, new parts), and the outbound jobs
// (S5b), which live on the phone. A pick's scans are sent as the row's total so far, not one call per scan: a
// replay after a lost answer, or two queued totals, then come to the same count in PartsLogic (pick-queue.ts).
export type PickQueueItem =
  // A row's units picked by scan, or by tap with why it couldn't be scanned, as the total so far.
  | {
      kind: 'pick_row';
      clientId: string;
      jobId: string;
      lineId: number;
      binId: number;
      method: 'scan' | 'tap';
      cantScan?: CantScanReason;
      target: number;
    }
  // Short pick: of qty still to pick, found were here; the reason says why the rest weren't.
  | { kind: 'pick_short'; clientId: string; jobId: string; lineId: number; binId: number; qty: number; found: number; reason: ShortPickReason }
  | { kind: 'pick_job_end'; clientId: string; jobId: string; how: 'finished' | 'stopped' };

// Packed on the phone: how many parcels, and whether every part was scanned into the box or some were tapped.
export type PackQueueItem = { kind: 'pack_order'; clientId: string; orderId: string; parcels: number; method: 'scan' | 'tap' };

export type QueueItem = FloorQueueItem | PickQueueItem | PackQueueItem;
export type QueueKind = QueueItem['kind'];
