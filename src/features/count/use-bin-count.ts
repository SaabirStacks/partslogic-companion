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
  const [notice, setNotice] = useState<string | null>(null);

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
          setStart({ kind: 'message', title: 'That’s a part', body: 'Scan the bin label first, then the parts on the shelf.' });
        } else if (hit.type === 'unknown' && !hit.offline && location) {
          scanFeedback.unknown();
          setStart({ kind: 'create', code });
        } else {
          scanFeedback.unknown();
          setStart({
            kind: 'message',
            title: `${code} isn’t a bin we know`,
            body: online
              ? 'Choose a working location to create it, or check the label.'
              : 'It isn’t in the scan list saved on this phone. Check the label, or connect to create the bin.',
          });
        }
      } catch (error) {
        scanFeedback.failed();
        setStart({ kind: 'message', title: 'That didn’t work', body: (error as Error).message });
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
          setStart({
            kind: 'message',
            title: 'That code belongs to a part',
            body: `${made.brand} ${made.number} already uses it, so it can’t be a bin label.`,
          });
        }
      } catch (error) {
        setStart({ kind: 'message', title: 'The bin wasn’t created', body: (error as Error).message });
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
            ? `That’s this bin’s label. Scan the parts on the shelf.`
            : `${local.bin} is another bin. Finish this count first, then count that one.`,
        );
        return;
      }
      setNotice(null);
      scanFeedback.found();
      const labels =
        local.type === 'part' && local.label ? { ...count.labels, [code.trim()]: local.label } : count.labels;
      await apply(
        count,
        { type: 'scan', clientCountId: Crypto.randomUUID(), code, partId: local.type === 'part' ? local.partId : null },
        labels,
      );
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
      await load();
    },

    async discard() {
      if (!count) return;
      await store.discard(count.stocktakeId);
      await load();
    },
  };
}
