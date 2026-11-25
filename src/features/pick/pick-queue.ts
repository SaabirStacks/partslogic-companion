import type { Client } from '@/vendor/partslogic/shared/core/client';
import { getPickJob, endPickJob, unscanPick } from '@/vendor/partslogic/shared/sales/pick-jobs';
import { pickLine } from '@/vendor/partslogic/shared/sales/picking';
import type { PickQueueItem } from '@/queue/items';

type Item<K extends PickQueueItem['kind']> = Extract<PickQueueItem, { kind: K }>;

// Sending a pick job's queued work. PartsLogic adds each pick of a row to the one before it, so a call sent twice
// (its answer lost to a bad signal) would pick a unit twice. Each send reads the job first and sends only the
// difference between the row's total on the phone and in PartsLogic: sent again, it sends nothing.

const same = (item: Item<'pick_row'> | Item<'pick_short'>) => (pick: { lineId: number; binId: number }) =>
  pick.lineId === item.lineId && pick.binId === item.binId;

export async function sendPickRow(supabase: Client, item: Item<'pick_row'>) {
  const job = await getPickJob(supabase, item.jobId);
  const mine = (job?.picked ?? []).filter((pick) => same(item)(pick) && pick.method === item.method && pick.short === 0);
  const have = mine.reduce((sum, pick) => sum + pick.qty, 0);
  const change = item.target - have;
  if (change > 0) {
    return pickLine(supabase, {
      lineId: item.lineId,
      binId: item.binId,
      qty: change,
      jobId: item.jobId,
      method: item.method,
      cantScan: item.method === 'tap' ? item.cantScan : undefined,
    });
  }
  // Fewer on the phone (a scan taken back): the newest picks give the units back to the bin.
  let back = -change;
  for (const pick of [...mine].reverse()) {
    if (back <= 0) break;
    const qty = Math.min(back, pick.qty);
    await unscanPick(supabase, { pickId: pick.pickId, qty });
    back -= qty;
  }
  return { picked: change };
}

// A short pick already in PartsLogic for this row, with this reason, is this one sent before.
export async function sendPickShort(supabase: Client, item: Item<'pick_short'>) {
  const job = await getPickJob(supabase, item.jobId);
  const sent = (job?.picked ?? []).find((pick) => same(item)(pick) && pick.short > 0 && pick.reason === item.reason);
  if (sent) return { pickId: sent.pickId, picked: sent.qty, short: sent.short };
  // The phone's own pick, as a scan: what was found is moved as the web's short pick moves it.
  return pickLine(supabase, {
    lineId: item.lineId,
    binId: item.binId,
    qty: item.qty,
    found: item.found,
    reason: item.reason,
    jobId: item.jobId,
    method: 'scan',
  });
}

// Ending a job twice ends it once: PartsLogic leaves an ended job as it was.
export function sendPickJobEnd(supabase: Client, item: Item<'pick_job_end'>) {
  return endPickJob(supabase, { jobId: item.jobId, how: item.how });
}
