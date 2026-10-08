import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { db } from '@/db/database';
import { deviceLabel } from '@/lib/device';
import { useOnline } from '@/lib/network';
import { supabase } from '@/lib/supabase';
import { useOutbox } from '@/queue/outbox-provider';
import { scanFeedback } from '@/scan/feedback';
import { localLabel } from '@/scan/local-label';
import { resolveCode } from '@/scan/resolve';
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

import { countLineOutcomes, countProgress } from './count-results';
import { CountStore, type BinCount } from './count-store';

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
export function useBinCount() {
  const { state } = useSession();
  const userId = state.status === 'member' ? state.member.userId : null;
  const { location } = useWorkingLocation();
  const online = useOnline();
  const outbox = useOutbox();
  const store = useMemo(() => new CountStore(db()), []);

  const [count, setCount] = useState<BinCount | null | undefined>(undefined);
  const [recent, setRecent] = useState<BinCount[]>([]);
  const [start, setStart] = useState<StartState>({ kind: 'idle' });
  // A scan that wasn't counted (a bin label), and the scan that was.
  const [notice, setNotice] = useState<{ title: string; detail: string } | null>(null);
  // key is new for every scan, so the result plate rises even when the same part is scanned again.
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
  async function apply(current: BinCount, action: BinSessionAction, labels = current.labels) {
    const session = reduceBinSession(current.session, action);
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
    };
    await store.create(created);
    await outbox.enqueue(
      { kind: 'open_bin_count', clientId: Crypto.randomUUID(), stocktakeId, binId: bin.binId, startedAt, device: deviceLabel() },
      label(created),
    );
    setStart({ kind: 'idle' });
    setNotice(null);
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
    notice,
    lastScan,
    finished,
    online,
    progressOf: (id: string) => countProgress(outbox.items, id),

    // A scanned or typed code before a count: it must be a bin.
    async chooseBin(code: string) {
      setStart({ kind: 'checking', code });
      try {
        const hit = await resolveCode(code, location);
        if (hit.type === 'bin') {
          scanFeedback.found();
          await begin({ binId: hit.binId, binCode: hit.bin, location: hit.location });
        } else if (hit.type === 'part') {
          scanFeedback.unknown();
          setStart({ kind: 'message', title: 'That’s a part', body: 'Scan the bin label first' });
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

    // A scanned or typed code during a count.
    async scan(code: string) {
      if (!count) return;
      const local = await localLabel(code, location?.code ?? null);
      if (local.type === 'bin') {
        scanFeedback.unknown();
        setNotice(
          local.bin.toUpperCase() === count.binCode.toUpperCase()
            ? { title: local.bin, detail: 'This bin’s label · scan the parts' }
            : { title: local.bin, detail: 'Another bin · finish this one first' },
        );
        return;
      }
      setNotice(null);
      scanFeedback.found();
      const labels =
        local.type === 'part' && local.label ? { ...count.labels, [code.trim()]: local.label } : count.labels;
      const clientCountId = Crypto.randomUUID();
      await apply(count, { type: 'scan', clientCountId, code, partId: local.type === 'part' ? local.partId : null }, labels);
      setLastScan({ key: clientCountId, code: code.trim() });
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
      setNotice(null);
      await load();
    },

    dismissFinished: () => setFinished(null),

    async discard() {
      if (!count) return;
      await store.discard(count.stocktakeId);
      setLastScan(null);
      setNotice(null);
      await load();
    },
  };
}
