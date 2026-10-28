import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { db } from '@/db/database';
import { useWorkingLocation } from '@/session/location-provider';
import { useSession } from '@/session/session-provider';

import { CountStore, type BinCount, type RunWorkflow } from './count-store';
import { runProgress, type RunProgress } from './run-progress';
import { RunStore, type CountRun, type RunBinPlan } from './run-store';

// A stock take or opening-stock run on this phone: plan it, count it bin by bin (each bin is a bin count
// carrying the run id, through useBinCount), pause and resume it, and finish it. Both start from Stock
// take, so the open run of the asked-for kind comes first, then any open run. refresh changes whenever one
// of its counts moves on, so the progress is read again.
export function useCountRun(workflow: RunWorkflow, refresh: unknown) {
  const { state } = useSession();
  const userId = state.status === 'member' ? state.member.userId : null;
  const { location } = useWorkingLocation();
  const runs = useMemo(() => new RunStore(db()), []);
  const counts = useMemo(() => new CountStore(db()), []);

  const [run, setRun] = useState<CountRun | null | undefined>(undefined);
  const [runCounts, setRunCounts] = useState<BinCount[]>([]);
  const [finished, setFinished] = useState<{ run: CountRun; progress: RunProgress } | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const open = (await runs.open(userId, workflow)) ?? (await runs.open(userId));
    setRunCounts(open ? await counts.inRun(open.runId) : []);
    setRun(open);
  }, [runs, counts, userId, workflow]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load, refresh]);

  const progress = useMemo(() => (run ? runProgress(run, runCounts) : null), [run, runCounts]);

  return {
    loaded: run !== undefined,
    run: run ?? null,
    progress,
    finished,

    // Starts a run of these bins in the working location, as a stock take or opening stock.
    async start(bins: RunBinPlan[], as: RunWorkflow) {
      if (!userId || !location || bins.length === 0) return;
      const created: CountRun = {
        runId: Crypto.randomUUID(),
        userId,
        workflow: as,
        locationId: location.id,
        locationName: location.name,
        bins,
        startedAt: new Date().toISOString(),
        finishedAt: null,
      };
      await runs.create(created);
      setRunCounts([]);
      setRun(created);
    },

    // Ends the run: every bin counted, or as many as were (the counts already went to PartsLogic one by one).
    async finish() {
      if (!run || !progress) return;
      await runs.finish(run.runId);
      setFinished({ run: { ...run, finishedAt: new Date().toISOString() }, progress });
      setRun(null);
    },

    dismissFinished: () => setFinished(null),
  };
}
