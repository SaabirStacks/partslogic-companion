import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { db } from '@/db/database';
import { deviceLabel } from '@/lib/device';
import { useOnline } from '@/lib/network';
import { supabase } from '@/lib/supabase';
import { isConnectionProblem, within } from '@/lib/within';
import { unsentOfCount } from '@/queue/discard';
import { useOutbox } from '@/queue/outbox-provider';
import { feedbackFor } from '@/scan/feedback';
import { usePendingScan } from '@/scan/pending-scan';
import { checkScan, partLabel, worthRechecking, type ScanCheck } from '@/scan/resolve';
import { isSystemBin } from '@/scan/system-bins';
import { useWorkingLocation } from '@/session/location-provider';
import { useSession } from '@/session/session-provider';
import {
  emptyBinSession,
  reduceBinSession,
  sessionLines,
  visibleLines,
  type BinSessionAction,
  type QueueItem,
} from '@/vendor/partslogic/shared/bin-session';
import { ensureBin, openBinCount } from '@/vendor/partslogic/shared/floor';

import { countLineOutcomes, countProgress } from './count-results';
import { COUNT_PURPOSE, CountStore, type BinCount, type CountWorkflow } from './count-store';
import { refusalText } from './start-refusal';

export type BinToCount = { binId: number; binCode: string; location: string | null };

// What the Count tab is waiting on before a count starts.
export type StartState =
  | { kind: 'idle' }
  | { kind: 'checking'; code: string }
  | { kind: 'message'; title: string; body: string };

// How long starting a bin waits on PartsLogic before it's queued, as it would be without signal.
const OPEN_WAIT_MS = 5000;

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

// A blind count of one bin, which is also how stock is put away. The phone keeps the running totals
// (the vendored BinSession), saves them after every scan, and queues them: open, totals, commit, in order.
// Expected quantities are never fetched.
// workflow is what a count started here becomes (Put away or Stock count); a count left open keeps its own.
export function useBinCount(workflow: CountWorkflow) {
  const { state } = useSession();
  const userId = state.status === 'member' ? state.member.userId : null;
  const { location } = useWorkingLocation();
  const online = useOnline();
  const outbox = useOutbox();
  const store = useMemo(() => new CountStore(db()), []);

  const [count, setCount] = useState<BinCount | null | undefined>(undefined);
  const [recent, setRecent] = useState<BinCount[]>([]);
  const [start, setStart] = useState<StartState>({ kind: 'idle' });
  // A bin being opened with PartsLogic, so a second tap while it answers doesn't start another.
  const opening = useRef(false);
  // The scan waiting on Count or Skip (the camera pauses on it), and the scan last counted. key is new for
  // every scan, so the result card rises even when the same part is scanned again.
  const check = useCallback(
    async (code: string) => {
      const hit = await checkScan(code, location);
      feedbackFor(hit);
      return hit;
    },
    [location],
  );
  const held = usePendingScan<ScanCheck>({ check, recheck: worthRechecking });
  const [lastScan, setLastScan] = useState<{ key: string; code: string } | null>(null);
  // The count just finished, for the result screen.
  const [finished, setFinished] = useState<{ stocktakeId: string; binCode: string; units: number; runId: string | null } | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const open = await store.open(userId);
    const done = await store.recent(userId);
    setCount(open);
    setRecent(done);
  }, [store, userId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const label = (current: BinCount) => `Count of bin ${current.binCode} started ${time(current.startedAt)}`;

  // Saves the new totals and queues them, replacing totals not yet sent (PartsLogic takes the latest).
  async function apply(current: BinCount, action: BinSessionAction | BinSessionAction[], labels = current.labels) {
    const session = (Array.isArray(action) ? action : [action]).reduce(reduceBinSession, current.session);
    await store.save(current.stocktakeId, session, labels);
    const payload: QueueItem = {
      kind: 'bin_count_lines',
      clientId: Crypto.randomUUID(),
      stocktakeId: current.stocktakeId,
      binId: current.binId,
      lines: sessionLines(session),
    };
    await outbox.enqueue(payload, label(current), (existing) =>
      existing.kind === 'bin_count_lines' ? { payload: { ...existing, lines: payload.lines }, label: label(current) } : null,
    );
    setCount({ ...current, session, labels });
  }

  // Starts a blind count of one bin; runId (and the run's own workflow) when it's one bin of a stock take or
  // opening-stock run. With signal PartsLogic opens it first, so a bin someone else is counting (or one a
  // finished run can't take) is refused here, not later in Sync. Without signal, or if PartsLogic is slow,
  // it's queued like any other work and checked when it's sent. The queued open is safe either way: one
  // already open is recognised by its id. Says whether the count started.
  async function begin(bin: BinToCount, runId: string | null = null, as: CountWorkflow = workflow): Promise<boolean> {
    if (!userId || opening.current) return false;
    // PartsLogic refuses to count its system bins, and the refusal would block Sync, so never start one.
    if (isSystemBin(bin.binCode)) {
      setStart({ kind: 'message', title: `${bin.binCode.trim().toUpperCase()} is a system bin`, body: 'PartsLogic doesn’t count UNBINNED or UNASSIGNED. Pick a shelf bin instead.' });
      return false;
    }
    opening.current = true;
    try {
      const stocktakeId = Crypto.randomUUID();
      const startedAt = new Date().toISOString();
      const open = { stocktakeId, binId: bin.binId, startedAt, device: deviceLabel(), purpose: COUNT_PURPOSE[as], ...(runId ? { runId } : {}) };
      if (online) {
        setStart({ kind: 'checking', code: bin.binCode });
        try {
          await within(openBinCount(supabase, open), OPEN_WAIT_MS);
        } catch (error) {
          if (!isConnectionProblem(error)) {
            const refusal = refusalText(error instanceof Error ? error.message : String(error));
            setStart({ kind: 'message', title: refusal.title, body: refusal.body });
            return false;
          }
        }
      }
      const session = reduceBinSession(emptyBinSession(stocktakeId, startedAt), {
        type: 'lock_bin',
        binId: bin.binId,
        binCode: bin.binCode,
        locationId: location?.id ?? 0,
      });
      const created: BinCount = {
        stocktakeId,
        userId,
        binId: bin.binId,
        binCode: bin.binCode,
        location: bin.location,
        startedAt,
        session,
        labels: {},
        finishedAt: null,
        workflow: as,
        runId,
      };
      await store.create(created);
      await outbox.enqueue({ kind: 'open_bin_count', clientId: Crypto.randomUUID(), ...open }, label(created));
      setStart({ kind: 'idle' });
      held.clear();
      setLastScan(null);
      setFinished(null);
      setCount(created);
      return true;
    } finally {
      opening.current = false;
    }
  }

  const stocktakeId = count?.stocktakeId ?? null;
  const outcomes = useMemo(
    () => (stocktakeId ? countLineOutcomes(outbox.items, stocktakeId) : new Map()),
    [outbox.items, stocktakeId],
  );

  return {
    loaded: count !== undefined,
    count: count ?? null,
    lines: count ? visibleLines(count.session) : [],
    units: count ? visibleLines(count.session).reduce((sum, line) => sum + line.qty, 0) : 0,
    outcomes,
    recent,
    start,
    held,
    lastScan,
    finished,
    online,
    progressOf: (id: string) => countProgress(outbox.items, id),

    // Creates the bin in the working location (needs signal: the count needs its id).
    async createBin(code: string) {
      if (!location) return;
      setStart({ kind: 'checking', code });
      try {
        const made = await ensureBin(supabase, location.id, code);
        if (made.type === 'bin') {
          await begin({ binId: made.binId, binCode: made.code, location: location.code });
        } else {
          setStart({ kind: 'message', title: 'That code is a part', body: `${made.brand} ${made.number} uses it` });
        }
      } catch (error) {
        setStart({ kind: 'message', title: 'Bin not created', body: (error as Error).message });
      }
    },

    begin,
    resetStart: () => setStart({ kind: 'idle' }),

    // A scanned or typed code during a count: held until it's counted or skipped. One at a time.
    scan(code: string) {
      if (count && !held.pending) void held.hold(code);
    },

    // Counts the held scan with its quantity, adding to the part's line when it's already on the shelf list.
    async confirm() {
      const scan = held.pending;
      if (!count || !scan?.hit || scan.hit.type === 'bin' || scan.hit.type === 'error') return;
      held.clear();
      const code = scan.code.trim();
      const labels = scan.hit.type === 'part' ? { ...count.labels, [code]: partLabel(scan.hit) } : count.labels;
      const existing = count.session.lines.find((line) => line.code === code);
      const clientCountId = existing?.clientCountId ?? Crypto.randomUUID();
      const actions: BinSessionAction[] = existing
        ? [{ type: 'set_qty', clientCountId, qty: existing.qty + scan.qty }]
        : [
            { type: 'scan', clientCountId, code, partId: scan.hit.type === 'part' ? scan.hit.partId : null },
            { type: 'set_qty', clientCountId, qty: scan.qty },
          ];
      await apply(count, actions, labels);
      setLastScan({ key: Crypto.randomUUID(), code });
    },

    async step(clientCountId: string, change: 1 | -1) {
      if (count) await apply(count, { type: change === 1 ? 'increment' : 'decrement', clientCountId });
    },

    async setQty(clientCountId: string, qty: number) {
      if (count && Number.isInteger(qty) && qty >= 0) await apply(count, { type: 'set_qty', clientCountId, qty });
    },

    async finish() {
      if (!count) return;
      const confirmEmpty = visibleLines(count.session).length === 0;
      await outbox.enqueue(
        { kind: 'commit_bin_count', clientId: Crypto.randomUUID(), stocktakeId: count.stocktakeId, confirmEmpty },
        `Finish count of bin ${count.binCode}`,
      );
      await store.finish(count.stocktakeId);
      setFinished({
        stocktakeId: count.stocktakeId,
        binCode: count.binCode,
        units: visibleLines(count.session).reduce((sum, line) => sum + line.qty, 0),
        runId: count.runId,
      });
      setLastScan(null);
      held.clear();
      await load();
    },

    dismissFinished: () => setFinished(null),

    // Throws the count away, in PartsLogic too: it may already have it (it opens as the count starts, with
    // signal), and there it would show in progress and hold the bin. What wasn't sent yet no longer needs
    // sending; the discard goes last in the count's stream, and does nothing if PartsLogic never got it.
    async discard() {
      if (!count) return;
      await outbox.forget(unsentOfCount(outbox.items, count.stocktakeId));
      await outbox.enqueue({ kind: 'discard_bin_count', clientId: Crypto.randomUUID(), stocktakeId: count.stocktakeId }, `Discard count of bin ${count.binCode}`);
      await store.discard(count.stocktakeId);
      setLastScan(null);
      held.clear();
      await load();
    },
  };
}
