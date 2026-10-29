import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { db } from '@/db/database';
import { useOnline } from '@/lib/network';
import { supabase } from '@/lib/supabase';
import { useRemote } from '@/lib/use-remote';
import { isConnectionProblem, within } from '@/lib/within';
import { useWorkingLocation } from '@/session/location-provider';
import { useSession } from '@/session/session-provider';
import {
  countRunStatus,
  finishCountRun,
  openCountRuns,
  startCountRun,
  type SharedRun,
  type SharedRunPurpose,
} from '@/vendor/partslogic/shared/floor';

import { CountStore, type BinCount, type RunWorkflow } from './count-store';
import { runProgress, type RunProgress } from './run-progress';
import { RunStore, type CountRun, type RunBinPlan } from './run-store';

// How long a run's calls wait on PartsLogic (a whole location's bins come back), and how often the bin
// list asks again what the others have done while it's on screen.
const RUN_WAIT_MS = 8000;
const POLL_MS = 20_000;

// How a run ended on this phone: alone (only this phone had it), for everyone, left to the others (it stays
// open for them), or closed after someone else finished it.
export type RunEnd = 'alone' | 'everyone' | 'left' | 'closed';
export type RunNotice = { tone: 'ok' | 'warn' | 'stop'; text: string };

const RUN_PURPOSE: Record<RunWorkflow, SharedRunPurpose> = { 'stock-take': 'stock_take', 'opening-stock': 'opening' };
const workflowOf = (run: SharedRun): RunWorkflow => (run.purpose === 'opening' ? 'opening-stock' : 'stock-take');
const nounOf = (workflow: RunWorkflow) => (workflow === 'opening-stock' ? 'opening stock' : 'stock take');
// "a stock take", "opening stock".
const aNounOf = (workflow: RunWorkflow) => (workflow === 'opening-stock' ? 'opening stock' : 'a stock take');
const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

// This phone's copy of a run PartsLogic has. startedBy is who started it when it was someone else.
function sharedCopy(run: SharedRun, userId: string, locationName: string | null, startedBy: string | null): CountRun {
  const at = new Date().toISOString();
  return {
    runId: run.runId,
    userId,
    workflow: workflowOf(run),
    locationId: run.locationId,
    locationName,
    bins: run.bins.map((bin) => ({ binId: bin.binId, code: bin.code })),
    startedAt: run.startedAt || at,
    finishedAt: null,
    shared: true,
    startedBy,
    status: run,
    statusAt: at,
  };
}

// A stock take or opening-stock run: plan it, count it bin by bin (each bin is a bin count carrying the run
// id, through useBinCount), pause and resume it, and finish it. Both start from Stock take, so the open run
// of the asked-for kind comes first, then any open run. refresh changes whenever one of its counts moves
// on, so the progress is read again.
// With signal a run is shared: PartsLogic keeps its list, so several people count it on their own phones,
// one person per bin. Starting one where one is already open joins that instead. While watching (the bin
// list is on screen), what the others have done is asked for every 20 seconds and kept on the phone.
// Without signal a run is this phone's alone, as before.
export function useCountRun(workflow: RunWorkflow, refresh: unknown, watching: boolean) {
  const { state } = useSession();
  const userId = state.status === 'member' ? state.member.userId : null;
  const { location } = useWorkingLocation();
  const online = useOnline();
  const runs = useMemo(() => new RunStore(db()), []);
  const counts = useMemo(() => new CountStore(db()), []);

  const [run, setRun] = useState<CountRun | null | undefined>(undefined);
  const [runCounts, setRunCounts] = useState<BinCount[]>([]);
  const [finished, setFinished] = useState<{ run: CountRun; progress: RunProgress; end: RunEnd } | null>(null);
  const [notice, setNotice] = useState<RunNotice | null>(null);
  const [busy, setBusy] = useState(false);
  // A start or finish waiting on PartsLogic, so a second tap before it answers does nothing.
  const working = useRef(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const open = (await runs.open(userId, workflow)) ?? (await runs.open(userId));
    setRunCounts(open ? await counts.inRun(open.runId) : []);
    setRun(open);
  }, [runs, counts, userId, workflow]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load, refresh]);

  // Asks PartsLogic where every bin stands and keeps it. No signal keeps the last word.
  const syncStatus = useCallback(
    async (runId: string) => {
      try {
        const status = await within(countRunStatus(supabase, runId), RUN_WAIT_MS);
        const at = new Date().toISOString();
        await runs.saveStatus(runId, status, at);
        setRun((current) => (current && current.runId === runId ? { ...current, status, statusAt: at } : current));
      } catch {
        // Shown as of statusAt.
      }
    },
    [runs],
  );

  // Only while the bin list is on screen: refresh also changes with every scan of a bin being counted.
  const sharedId = run?.shared ? run.runId : null;
  useEffect(() => {
    if (!sharedId || !online || !watching) return;
    void Promise.resolve().then(() => syncStatus(sharedId));
    const timer = setInterval(() => void syncStatus(sharedId), POLL_MS);
    return () => clearInterval(timer);
  }, [sharedId, online, watching, refresh, syncStatus]);

  const progress = useMemo(() => (run ? runProgress(run, runCounts) : null), [run, runCounts]);

  async function keep(next: CountRun) {
    await runs.create(next);
    setRunCounts(await counts.inRun(next.runId));
    setRun(next);
  }

  return {
    loaded: run !== undefined,
    run: run ?? null,
    progress,
    finished,
    notice,
    busy,
    online,
    dismissNotice: () => setNotice(null),

    // Starts a run of these bins in the working location, as a stock take or opening stock. With signal
    // PartsLogic has it too, or hands back the one already open there, which this phone joins.
    async start(bins: RunBinPlan[], as: RunWorkflow) {
      if (!userId || !location || bins.length === 0 || working.current) return;
      const runId = Crypto.randomUUID();
      setNotice(null);
      if (online) {
        working.current = true;
        setBusy(true);
        try {
          const shared = await within(
            startCountRun(supabase, { runId, locationId: location.id, purpose: RUN_PURPOSE[as], binIds: bins.map((bin) => bin.binId) }),
            RUN_WAIT_MS,
          );
          await keep(sharedCopy(shared, userId, location.name, shared.created ? null : shared.startedBy));
          if (!shared.created) {
            setNotice({
              tone: 'warn',
              text: `${shared.startedBy} had already started ${aNounOf(workflowOf(shared))} here, so you’ve joined it`,
            });
          }
          return;
        } catch (error) {
          if (!isConnectionProblem(error)) {
            setNotice({ tone: 'stop', text: messageOf(error) });
            return;
          }
          setNotice({ tone: 'warn', text: `No signal · only this phone has this ${nounOf(as)}` });
        } finally {
          working.current = false;
          setBusy(false);
        }
      }
      await keep({
        runId,
        userId,
        workflow: as,
        locationId: location.id,
        locationName: location.name,
        bins,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        shared: false,
        startedBy: null,
        status: null,
        statusAt: null,
      });
    },

    // Joins a run someone else started here: its list and where it stands come with it.
    async join(shared: SharedRun) {
      if (!userId || !location) return;
      setNotice(null);
      await keep(sharedCopy(shared, userId, location.name, shared.startedBy));
    },

    // Ends the run on this phone. A shared run ends for everyone (needs signal) or is left to the others,
    // who carry on; one someone else already finished just closes. Says whether it ended.
    async finish(how: 'everyone' | 'here'): Promise<boolean> {
      if (!run || !progress || working.current) return false;
      let ending = run;
      let end: RunEnd = !run.shared ? 'alone' : progress.closed ? 'closed' : how === 'everyone' ? 'everyone' : 'left';
      if (end === 'everyone') {
        working.current = true;
        setBusy(true);
        try {
          const status = await within(finishCountRun(supabase, run.runId), RUN_WAIT_MS);
          ending = { ...run, status, statusAt: new Date().toISOString() };
        } catch (error) {
          // PartsLogic no longer has it: nobody else can be counting it, so it just ends here.
          if ((error as { code?: string }).code === 'P0002') {
            end = 'alone';
          } else {
            setNotice({
              tone: 'stop',
              text: isConnectionProblem(error) ? 'No signal · finishing it for everyone needs signal' : messageOf(error),
            });
            return false;
          }
        } finally {
          working.current = false;
          setBusy(false);
        }
      }
      await runs.finish(run.runId);
      setNotice(null);
      setFinished({ run: { ...ending, finishedAt: new Date().toISOString() }, progress: runProgress(ending, runCounts), end });
      setRun(null);
      return true;
    },

    dismissFinished: () => setFinished(null),
  };
}

// The stock takes and opening-stock runs open in a location now, to join. Needs signal; none without it.
export function useJoinableRuns(locationId: number | null, online: boolean): SharedRun[] {
  // Read the id here, not inside the loader (the React Compiler reads what a callback uses while rendering).
  const id = locationId ?? 0;
  const remote = useRemote(locationId !== null && online ? `open-runs:${locationId}` : null, () =>
    within(openCountRuns(supabase, id), RUN_WAIT_MS),
  );
  return remote.data ?? [];
}
