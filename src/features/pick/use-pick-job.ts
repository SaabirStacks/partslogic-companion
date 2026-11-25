import * as Crypto from 'expo-crypto';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { db } from '@/db/database';
import { feel } from '@/feel/feel';
import { useOnline } from '@/lib/network';
import { supabase } from '@/lib/supabase';
import { useRemote } from '@/lib/use-remote';
import { useOutbox } from '@/queue/outbox-provider';
import { checkScan, type ScanCheck } from '@/scan/resolve';
import { useWorkingLocation } from '@/session/location-provider';
import { useSession } from '@/session/session-provider';
import { getPickJobStatus, startPickJob } from '@/vendor/partslogic/shared/sales/pick-jobs';
import type { CantScanReason, ShortPickReason } from '@/vendor/partslogic/shared/sales/picking';

import { fromServerJob, left, shortRow, tapRow, totals, unscanRow, type JobRow, type LocalPickJob } from './job';
import { PickStore } from './pick-store';
import { pickReceipt, refusedPicks } from './receipt';
import { pickMoment, pickScan, type PickCard, type PickCheck } from './scan-card';
import { partName, pickCardWords } from './words';

// The resolver's answer in the shape a pick job reads (scan-card.ts): a bin label by its code.
const toPickCheck = (check: ScanCheck): PickCheck => (check.type === 'bin' ? { type: 'bin', bin: check.bin } : check);

// A pick job on the phone (S5b). Starting needs signal, because PartsLogic claims the orders; from then on each scan
// is counted on the phone at once, saved, and queued as its row's total so far, so the job carries on without signal
// and every scan is sent in order when it's back (owner, 25 November 2026). A pick PartsLogic refuses then shows on
// the job's strip and its receipt.
export function usePickJob() {
  const { state } = useSession();
  const userId = state.status === 'member' ? state.member.userId : null;
  const { location } = useWorkingLocation();
  const online = useOnline();
  const outbox = useOutbox();
  const store = useMemo(() => new PickStore(db()), []);

  const [job, setJob] = useState<LocalPickJob | null | undefined>(undefined);
  const [card, setCard] = useState<{ key: string; card: PickCard } | null>(null);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const [ended, setEnded] = useState<LocalPickJob | null>(null);
  const [starting, setStarting] = useState<{ busy: boolean; problem: string | null }>({ busy: false, problem: null });
  // Scans arrive faster than saves: each one builds on the latest job, not the one the screen last drew.
  const latest = useRef<LocalPickJob | null>(null);

  useEffect(() => {
    if (!userId) return;
    let current = true;
    void store.open(userId).then((open) => {
      if (!current) return;
      latest.current = open;
      setJob(open);
    });
    return () => {
      current = false;
    };
  }, [store, userId]);

  // Before a job: what the branch has to pick, and the picker's own job if one runs on another phone.
  const locationId = location?.id ?? null;
  const status = useRemote(online && userId && job === null && !ended ? `pick-status:${locationId}` : null, () =>
    getPickJobStatus(supabase, { locationId }),
  );

  async function keep(next: LocalPickJob) {
    latest.current = next;
    setJob(next);
    await store.save(next);
  }

  // A row's units by one way of picking, as its total so far; a newer total waiting to send takes the older's place.
  async function sendRow(current: LocalPickJob, row: JobRow, method: 'scan' | 'tap') {
    if (row.binId === null) return;
    const target = method === 'scan' ? row.scanned : row.tapped;
    const cantScan: CantScanReason | undefined = method === 'tap' ? (row.tapReason ?? undefined) : undefined;
    const label = `Pick for ${row.order} · ${partName(row)} · ${target} ${method === 'scan' ? 'scanned' : 'without a scan'}`;
    await outbox.enqueue(
      { kind: 'pick_row', clientId: Crypto.randomUUID(), jobId: current.jobId, lineId: row.lineId, binId: row.binId, method, cantScan, target },
      label,
      // A newer total joins the one waiting only for the same way of picking, and for a tap the same reason, so each
      // unit is logged with the reason given for it (critique B).
      (existing) =>
        existing.kind === 'pick_row' && existing.method === method && existing.cantScan === cantScan ? { payload: { ...existing, target }, label } : null,
    );
  }

  const rowOf = (current: LocalPickJob, key: string) => current.rows.find((row) => row.key === key) ?? null;

  async function scan(code: string) {
    const current = latest.current;
    if (!current || current.endedAt) return;
    const check = await checkScan(code, location);
    // The job may have ended (or another started) while the code was checked: a late scan never reopens it.
    const now = latest.current;
    if (!now || now.jobId !== current.jobId) return;
    const { job: next, card: shown } = pickScan(now, toPickCheck(check));
    feel(pickMoment(shown));
    setCard({ key: Crypto.randomUUID(), card: shown });
    // iOS reads no live region: the result is said for VoiceOver as it shows (critique B).
    AccessibilityInfo.announceForAccessibility(pickCardWords(shown));
    if (shown.kind !== 'added') return;
    setLastKey(shown.row.key);
    await keep(next);
    await sendRow(next, shown.row, 'scan');
  }

  const mine = job ? refusedPicks(job, outbox.items) : [];

  return {
    loaded: job !== undefined,
    job: job ?? null,
    ended,
    receipt: ended ? pickReceipt(ended, outbox.items) : null,
    status,
    online,
    starting,
    card,
    totals: job ? totals(job) : null,
    lastRow: job && lastKey ? rowOf(job, lastKey) : null,
    refused: mine,

    // Start picking: carries on the picker's own job, or claims the next orders at the branch.
    async start() {
      if (!userId || starting.busy) return;
      setStarting({ busy: true, problem: null });
      try {
        const { job: claimed } = await startPickJob(supabase, { locationId });
        setStarting({ busy: false, problem: null });
        if (!claimed) return status.reload();
        feel('press');
        setEnded(null);
        setCard(null);
        setLastKey(null);
        await keep(fromServerJob(claimed, userId));
      } catch (error) {
        setStarting({ busy: false, problem: error instanceof Error ? error.message : String(error) });
      }
    },

    scan,
    dismissCard: () => setCard(null),

    // Can't scan: units picked by a tap, with why.
    async tap(key: string, qty: number, reason: CantScanReason) {
      const current = latest.current;
      if (!current) return;
      const next = tapRow(current, key, qty, reason);
      const row = rowOf(next, key);
      if (!row || next === current) return;
      feel('scan');
      setLastKey(key);
      setCard(null);
      await keep(next);
      await sendRow(next, row, 'tap');
    },

    // Undo the last scan: the last row's last unit goes back to its bin.
    async undoLast() {
      const current = latest.current;
      if (!current || !lastKey) return;
      const before = rowOf(current, lastKey);
      const next = unscanRow(current, lastKey);
      const row = rowOf(next, lastKey);
      if (!before || !row || next === current) return;
      feel('tick');
      setCard(null);
      await keep(next);
      await sendRow(next, row, before.scanned > row.scanned ? 'scan' : 'tap');
    },

    // Short pick: how many of the rest are here, and why the others aren't.
    async short(key: string, found: number, reason: ShortPickReason) {
      const current = latest.current;
      const before = current ? rowOf(current, key) : null;
      if (!current || !before || before.binId === null) return;
      const next = shortRow(current, key, found, reason);
      if (next === current) return;
      feel('press');
      setCard(null);
      await keep(next);
      await outbox.enqueue(
        { kind: 'pick_short', clientId: Crypto.randomUUID(), jobId: current.jobId, lineId: before.lineId, binId: before.binId, qty: left(before), found, reason },
        `Short pick for ${before.order} · ${partName(before)}`,
      );
    },

    // Finish or Stop: the job ends on the phone at once; PartsLogic lets its orders go when the end is sent, after
    // every row's picks.
    async end(how: 'finished' | 'stopped') {
      const current = latest.current;
      if (!current || current.endedAt) return;
      // No scan lands after this: the job is over on the phone before anything is saved or sent (critique B).
      latest.current = null;
      const closed: LocalPickJob = { ...current, endedAt: new Date().toISOString(), endedHow: how };
      await outbox.enqueue(
        { kind: 'pick_job_end', clientId: Crypto.randomUUID(), jobId: current.jobId, how },
        how === 'finished' ? 'Finish pick job' : 'Stop pick job',
      );
      await store.save(closed);
      if (userId) await store.prune(userId);
      feel('done');
      latest.current = null;
      setJob(null);
      setCard(null);
      setLastKey(null);
      setEnded(closed);
    },

    dismissEnded: () => {
      setEnded(null);
      status.reload();
    },
  };
}

export type PickJobState = ReturnType<typeof usePickJob>;
