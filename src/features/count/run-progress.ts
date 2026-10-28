import { visibleLines } from '@/vendor/partslogic/shared/bin-session';

import type { BinChoice } from './bin-choices';
import type { BinCount } from './count-store';
import type { CountRun, RunBinPlan } from './run-store';

// Where one planned bin of a run stands on this phone.
export type RunBinState = 'counted' | 'counting' | 'not-started';
export type RunBin = RunBinPlan & { state: RunBinState; units: number; stocktakeId: string | null };

export type RunProgress = {
  bins: RunBin[];
  counted: number;
  total: number;
  units: number;
  // The bin the main button is for: the one being counted, else the first not started; null when done.
  next: RunBin | null;
  done: boolean;
};

const unitsOf = (count: BinCount) => visibleLines(count.session).reduce((sum, line) => sum + line.qty, 0);

// A run's bins with their states, from the run's counts on this phone. A bin counted twice keeps its latest
// count; an open count makes it "counting".
export function runProgress(run: CountRun, counts: BinCount[]): RunProgress {
  const latest = new Map<number, BinCount>();
  for (const count of counts) {
    if (count.runId !== run.runId) continue;
    const seen = latest.get(count.binId);
    if (!seen || count.startedAt >= seen.startedAt) latest.set(count.binId, count);
  }
  const bins: RunBin[] = run.bins.map((plan) => {
    const count = latest.get(plan.binId);
    if (!count) return { ...plan, state: 'not-started', units: 0, stocktakeId: null };
    return { ...plan, state: count.finishedAt ? 'counted' : 'counting', units: unitsOf(count), stocktakeId: count.stocktakeId };
  });
  const counted = bins.filter((bin) => bin.state === 'counted').length;
  const next = bins.find((bin) => bin.state === 'counting') ?? bins.find((bin) => bin.state === 'not-started') ?? null;
  return {
    bins,
    counted,
    total: bins.length,
    units: bins.reduce((sum, bin) => sum + (bin.state === 'counted' ? bin.units : 0), 0),
    next,
    done: bins.length > 0 && counted === bins.length,
  };
}

// The three ways to plan a run: every bin in the location, a hand-picked set, or only bins never counted.
export type RunPlan = 'every' | 'choose' | 'never';

export function planBins(plan: RunPlan, choices: BinChoice[], chosen: ReadonlySet<number>): RunBinPlan[] {
  const picked =
    plan === 'every' ? choices : plan === 'never' ? choices.filter((choice) => !choice.lastCounted) : choices.filter((choice) => chosen.has(choice.binId));
  return picked.map((choice) => ({ binId: choice.binId, code: choice.code }));
}

// "1 of 4 bins".
export const runCountText = (progress: Pick<RunProgress, 'counted' | 'total'>) =>
  `${progress.counted} of ${progress.total} ${progress.total === 1 ? 'bin' : 'bins'}`;
