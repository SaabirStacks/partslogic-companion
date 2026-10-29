import { visibleLines } from '@/vendor/partslogic/shared/bin-session';

import type { BinChoice } from './bin-choices';
import type { BinCount } from './count-store';
import type { CountRun, RunBinPlan } from './run-store';

// Where one planned bin of a run stands. taken: someone else is counting it now (one person per bin).
export type RunBinState = 'counted' | 'counting' | 'taken' | 'not-started';
// by: who else counted it, or is counting it; null for this phone's own.
export type RunBin = RunBinPlan & { state: RunBinState; units: number; stocktakeId: string | null; by: string | null };

export type RunProgress = {
  bins: RunBin[];
  // Counted by anyone, and by this phone.
  counted: number;
  mine: number;
  total: number;
  units: number;
  // The bin the main button is for: the one being counted here, else the first nobody has started; null
  // when there's none.
  next: RunBin | null;
  done: boolean;
  // Everyone else who counted or is counting a bin of it, in the order they first appear.
  others: string[];
  // Someone finished the run for everyone (only a shared run).
  closed: { by: string | null; at: string | null } | null;
};

const unitsOf = (count: BinCount) => visibleLines(count.session).reduce((sum, line) => sum + line.qty, 0);

// A run's bins with their states. This phone's own counts come first: a bin counted twice keeps its latest
// count, and an open one is "counting". For a shared run, every other bin is as PartsLogic last said
// (run.status): counted by someone, being counted by someone else (only while they're active: a count left
// for 2 hours lets its bin go), or not started.
export function runProgress(run: CountRun, counts: BinCount[]): RunProgress {
  const latest = new Map<number, BinCount>();
  for (const count of counts) {
    if (count.runId !== run.runId) continue;
    const seen = latest.get(count.binId);
    if (!seen || count.startedAt >= seen.startedAt) latest.set(count.binId, count);
  }
  const shared = run.shared && run.status?.runId === run.runId ? run.status : null;
  const word = new Map((shared?.bins ?? []).map((bin) => [bin.binId, bin]));

  const bins: RunBin[] = run.bins.map((plan) => {
    const count = latest.get(plan.binId);
    if (count) {
      return { ...plan, state: count.finishedAt ? 'counted' : 'counting', units: unitsOf(count), stocktakeId: count.stocktakeId, by: null };
    }
    const there = word.get(plan.binId);
    const by = there && !there.mine ? there.by : null;
    if (there?.state === 'counted') return { ...plan, state: 'counted', units: there.units, stocktakeId: there.stocktakeId, by };
    if (there?.state === 'counting' && there.active && !there.mine) {
      return { ...plan, state: 'taken', units: there.units, stocktakeId: there.stocktakeId, by };
    }
    return { ...plan, state: 'not-started', units: 0, stocktakeId: null, by: null };
  });

  const counted = bins.filter((bin) => bin.state === 'counted').length;
  const others: string[] = [];
  for (const bin of bins) if (bin.by && (bin.state === 'counted' || bin.state === 'taken') && !others.includes(bin.by)) others.push(bin.by);
  return {
    bins,
    counted,
    mine: bins.filter((bin) => bin.state === 'counted' && bin.by === null && latest.has(bin.binId)).length,
    total: bins.length,
    units: bins.reduce((sum, bin) => sum + (bin.state === 'counted' ? bin.units : 0), 0),
    next: bins.find((bin) => bin.state === 'counting') ?? bins.find((bin) => bin.state === 'not-started') ?? null,
    done: bins.length > 0 && counted === bins.length,
    others,
    closed: shared?.status === 'finished' ? { by: shared.finishedBy, at: shared.finishedAt } : null,
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

// "Sam", "Sam and Ali", "Sam, Ali and 2 others".
export function peopleText(names: readonly string[]): string {
  if (names.length <= 2) return names.join(' and ');
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} others`;
}
