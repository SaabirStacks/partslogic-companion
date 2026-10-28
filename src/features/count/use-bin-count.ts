import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { db } from '@/db/database';
import { deviceLabel } from '@/lib/device';
import { useOnline } from '@/lib/network';
import { supabase } from '@/lib/supabase';
import { useOutbox } from '@/queue/outbox-provider';
import { feedbackFor, scanFeedback } from '@/scan/feedback';
import { usePendingScan } from '@/scan/pending-scan';
import { checkScan, partLabel, resolveCode, worthRechecking, type ScanCheck } from '@/scan/resolve';
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
import { ensureBin } from '@/vendor/partslogic/shared/floor';
import { looksLikeBarcode } from '@/vendor/partslogic/shared/gtin';

import { countLineOutcomes, countProgress } from './count-results';
import { CountStore, type BinCount, type CountWorkflow } from './count-store';

export type BinToCount = { binId: number; binCode: string; location: string | null };

// What the Count tab is waiting on before a count starts.
export type StartState =
  | { kind: 'idle' }
  | { kind: 'checking'; code: string }
  | { kind: 'create'; code: string }
  | { kind: 'message'; title: string; body: string };

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
  const [finished, setFinished] = useState<{ stocktakeId: string; binCode: string; units: number } | null>(null);

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

  async function begin(bin: BinToCount) {
    if (!userId) return;
    const stocktakeId = Crypto.randomUUID();
    const startedAt = new Date().toISOString();
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
      workflow,
    };
    await store.create(created);
    await outbox.enqueue(
      { kind: 'open_bin_count', clientId: Crypto.randomUUID(), stocktakeId, binId: bin.binId, startedAt, device: deviceLabel() },
      label(created),
    );
    setStart({ kind: 'idle' });
    held.clear();
    setLastScan(null);
    setFinished(null);
    setCount(created);
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

    // A typed (or scanned) code before a count: it must be a bin. Bins carry a name, not a barcode, so a
    // product barcode here is a slip, never a bin to create.
    async chooseBin(code: string) {
      setStart({ kind: 'checking', code });
      try {
        const hit = await resolveCode(code, location);
        if (hit.type === 'bin') {
          scanFeedback.found();
          await begin({ binId: hit.binId, binCode: hit.bin, location: hit.location });
        } else if (hit.type === 'part') {
          scanFeedback.unknown();
          setStart({ kind: 'message', title: 'That’s a part', body: 'Type the bin name' });
        } else if (looksLikeBarcode(code)) {
          scanFeedback.unknown();
          setStart({ kind: 'message', title: 'That’s a product barcode', body: 'Type the bin name' });
        } else if (hit.type === 'unknown' && !hit.offline && location) {
          scanFeedback.unknown();
          setStart({ kind: 'create', code });
        } else {
          scanFeedback.unknown();
          setStart({
            kind: 'message',
            title: `${code} isn’t a bin`,
            body: online ? 'Choose a location to create it' : 'Not in the scan list · connect to create it',
          });
        }
      } catch (error) {
        scanFeedback.failed();
        setStart({ kind: 'message', title: 'Didn’t work', body: (error as Error).message });
      }
    },

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
      });
      setLastScan(null);
      held.clear();
      await load();
    },

    dismissFinished: () => setFinished(null),

    async discard() {
      if (!count) return;
      await store.discard(count.stocktakeId);
      setLastScan(null);
      held.clear();
      await load();
    },
  };
}
