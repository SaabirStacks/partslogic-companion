import type { BadgeState } from '@/ui/badge';
import { withYouWords } from '@/vendor/partslogic/shared/sales/delivery';
import type { LiveWorkflowId } from '@/workflows/catalogue';

import type { OpenWork } from './open-work';

// What waits for the outbound jobs at this branch (pick_job_status): units to pick, orders to pack; and the
// deliveries out with this driver (driver_deliveries), when known.
export type Outbound = { toPick: number; toPack: number; withYou?: number | null };

// The badge in a job's corner: its open work on this phone (amber; its Resume row says more), else what's
// waiting for it (blue). Put away counts what's in Unbinned (unbinned, null when not known); Pick the units to
// pick, Pack the orders to pack and Deliver the deliveries with you (outbound, null when not known). A stock take and an opening-stock run both
// start from Stock take, so both show there. null for nothing to say.
export function tileBadge(id: LiveWorkflowId, openWork: OpenWork[], unbinned: number | null, outbound: Outbound | null = null): BadgeState | null {
  for (const work of openWork) {
    if (work.kind === 'delivery' && id === 'receive') return { label: 'Open', tone: 'warn' };
    if (work.kind === 'count' && work.workflow === id) return { label: 'Counting', tone: 'warn', spoken: `counting bin ${work.bin}` };
    if (work.kind === 'run' && id === 'stock-take') {
      return { label: `${work.counted} of ${work.total}`, tone: 'warn', spoken: `${work.counted} of ${work.total} bins counted` };
    }
    if (work.kind === 'pick' && id === 'pick') {
      return { label: `${work.picked} of ${work.units}`, tone: 'warn', spoken: `${work.picked} of ${work.units} units picked` };
    }
  }
  const count = (n: number) => new Intl.NumberFormat('en-GB').format(n);
  if (id === 'pick' && outbound && outbound.toPick > 0) {
    return { label: `${count(outbound.toPick)} ${outbound.toPick === 1 ? 'unit' : 'units'}`, tone: 'action', spoken: `${outbound.toPick} ${outbound.toPick === 1 ? 'unit' : 'units'} to pick` };
  }
  if (id === 'pack' && outbound && outbound.toPack > 0) {
    return { label: `${count(outbound.toPack)} ${outbound.toPack === 1 ? 'order' : 'orders'}`, tone: 'action', spoken: `${outbound.toPack} ${outbound.toPack === 1 ? 'order' : 'orders'} to pack` };
  }
  const withYou = withYouWords(outbound?.withYou ?? 0);
  if (id === 'deliver' && withYou) {
    return { label: withYou, tone: 'action', spoken: `${outbound!.withYou} ${outbound!.withYou === 1 ? 'delivery' : 'deliveries'} with you` };
  }
  if (id === 'put-away' && unbinned !== null && unbinned > 0) {
    return { label: `${new Intl.NumberFormat('en-GB').format(unbinned)} waiting`, tone: 'action', spoken: `${unbinned} units waiting in Unbinned` };
  }
  return null;
}
