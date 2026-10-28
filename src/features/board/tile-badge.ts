import type { BadgeState } from '@/ui/badge';
import type { LiveWorkflowId } from '@/workflows/catalogue';

import type { OpenWork } from './open-work';

// The badge in a job's corner: its open work on this phone (amber; its Resume row says more), else what's
// waiting for it (blue). Put away counts what's in Unbinned (unbinned, null when not known). A stock take
// and an opening-stock run both start from Stock take, so both show there. null for nothing to say.
export function tileBadge(id: LiveWorkflowId, openWork: OpenWork[], unbinned: number | null): BadgeState | null {
  for (const work of openWork) {
    if (work.kind === 'delivery' && id === 'receive') return { label: 'Open', tone: 'warn' };
    if (work.kind === 'count' && work.workflow === id) return { label: 'Counting', tone: 'warn', spoken: `counting bin ${work.bin}` };
    if (work.kind === 'run' && id === 'stock-take') {
      return { label: `${work.counted} of ${work.total}`, tone: 'warn', spoken: `${work.counted} of ${work.total} bins counted` };
    }
  }
  if (id === 'put-away' && unbinned !== null && unbinned > 0) {
    return { label: `${new Intl.NumberFormat('en-GB').format(unbinned)} waiting`, tone: 'action', spoken: `${unbinned} units waiting in Unbinned` };
  }
  return null;
}
