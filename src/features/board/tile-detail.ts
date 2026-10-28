import { runCountText } from '@/features/count/run-progress';
import { plural } from '@/lib/format';
import type { LiveWorkflowId } from '@/workflows/catalogue';

import type { OpenWork } from './open-work';

// The one line under a job's tile: its open work on this phone (a run says how far it got; its Resume row
// names the bin being counted), else what's waiting for it. Put away shows what's in Unbinned (unbinned, null when not known). null for nothing to say.
export function tileDetail(id: LiveWorkflowId, openWork: OpenWork[], unbinned: number | null): string | null {
  for (const work of openWork) {
    if (work.kind === 'delivery' && id === 'receive') return `Open · ${plural(work.units, 'unit', 'units')}`;
    if (work.kind === 'count' && work.workflow === id) return `Counting ${work.bin}`;
    if (work.kind === 'run' && work.workflow === id) return runCountText(work);
  }
  if (id === 'put-away' && unbinned !== null && unbinned > 0) return `${unbinned} in Unbinned`;
  return null;
}
