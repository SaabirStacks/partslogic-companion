import type { Href } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';

import { CountStore, type BinCount, type CountWorkflow, type RunWorkflow } from '@/features/count/count-store';
import { runCountText, runProgress } from '@/features/count/run-progress';
import { RunStore, type CountRun } from '@/features/count/run-store';
import { DeliveryStore } from '@/features/receive/delivery-store';
import { clock, plural } from '@/lib/format';
import { liveWorkflow } from '@/workflows/catalogue';
import { visibleLines } from '@/vendor/partslogic/shared/bin-session';

// Work left open on this phone: a delivery still being received, a bin still being counted, a stock take
// or opening-stock run paused part way (its bin being counted, if any, is part of it).
export type OpenWork =
  | { kind: 'delivery'; from: string | null; units: number; startedAt: string }
  | { kind: 'count'; workflow: CountWorkflow; bin: string; units: number; startedAt: string }
  | { kind: 'run'; runId: string; workflow: RunWorkflow; counted: number; total: number; counting: string | null; startedAt: string };

// A run's resume row, from its counts on this phone.
export function runWork(run: CountRun, counts: BinCount[]): OpenWork {
  const progress = runProgress(run, counts);
  const counting = progress.bins.find((bin) => bin.state === 'counting')?.code ?? null;
  return { kind: 'run', runId: run.runId, workflow: run.workflow, counted: progress.counted, total: progress.total, counting, startedAt: run.startedAt };
}

export async function readOpenWork(database: SQLiteDatabase, userId: string): Promise<OpenWork[]> {
  const deliveries = new DeliveryStore(database);
  const counts = new CountStore(database);
  const [delivery, count, runs] = await Promise.all([deliveries.open(userId), counts.open(userId), new RunStore(database).allOpen(userId)]);
  const work: OpenWork[] = [];
  if (delivery) {
    const lines = await deliveries.lines(delivery.documentId);
    work.push({
      kind: 'delivery',
      from: delivery.sender?.name ?? null,
      units: lines.reduce((sum, line) => sum + line.qty, 0),
      startedAt: delivery.startedAt,
    });
  }
  for (const run of runs) work.push(runWork(run, await counts.inRun(run.runId)));
  // A bin being counted for a run is already on the run's row.
  if (count && !runs.some((run) => run.runId === count.runId)) {
    const units = visibleLines(count.session).reduce((sum, line) => sum + line.qty, 0);
    work.push({ kind: 'count', workflow: count.workflow, bin: count.binCode, units, startedAt: count.startedAt });
  }
  return work;
}

// Tells resume rows apart (there can be two runs).
export const openWorkKey = (work: OpenWork) => (work.kind === 'run' ? `run:${work.runId}` : work.kind);

// The resume row's words: what's open, and how far it got.
export function resumeText(work: OpenWork): { title: string; detail: string; href: Href } {
  if (work.kind === 'run') {
    const progress = runCountText(work);
    return {
      title: liveWorkflow(work.workflow).label,
      detail: work.counting ? `Counting ${work.counting} · ${progress}` : `${progress} · started ${clock(work.startedAt)}`,
      href: { pathname: '/count', params: { purpose: work.workflow } },
    };
  }
  const detail = `${plural(work.units, 'unit', 'units')} · started ${clock(work.startedAt)}`;
  return work.kind === 'delivery'
    ? { title: work.from ? `Delivery from ${work.from}` : 'Delivery', detail, href: '/receive' }
    : { title: `Bin ${work.bin}`, detail, href: '/count' };
}
