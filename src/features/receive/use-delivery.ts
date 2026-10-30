import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { db } from '@/db/database';
import { feel } from '@/feel/feel';
import { deviceLabel } from '@/lib/device';
import { useOutbox } from '@/queue/outbox-provider';
import { feedbackFor } from '@/scan/feedback';
import { usePendingScan } from '@/scan/pending-scan';
import { checkScan, partLabel, worthRechecking, type ScanCheck } from '@/scan/resolve';
import { useWorkingLocation } from '@/session/location-provider';
import { useSession } from '@/session/session-provider';
import type { QueueItem } from '@/vendor/partslogic/shared/bin-session';

import { DeliveryStore, type Delivery } from './delivery-store';
import { adjustmentTo, groupLines, lineStates, receiptNumber, type DeliveryLine } from './lines';
import { receiptSummary } from './receipt';
import { deliveryName, receiptDetails, type Sender } from './sender';

// record_receipt_lines takes up to 500 lines a call.
const LINES_PER_CALL = 500;

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

// Receiving one delivery. It starts by saying who it's from, then takes one scan at a time: a scan is
// held (the camera pauses) until the person adds it, with its quantity, or skips it. Each added line is
// saved on the phone and queued at once (no waiting on signal), and what PartsLogic made of each line
// comes back through the outbox.
export function useDelivery() {
  const { state } = useSession();
  const userId = state.status === 'member' ? state.member.userId : null;
  const { location } = useWorkingLocation();
  const outbox = useOutbox();
  const store = useMemo(() => new DeliveryStore(db()), []);

  const [delivery, setDelivery] = useState<Delivery | null | undefined>(undefined);
  const [lines, setLines] = useState<DeliveryLine[]>([]);
  const [recent, setRecent] = useState<Delivery[]>([]);
  const [finished, setFinished] = useState<{ delivery: Delivery; lines: DeliveryLine[] } | null>(null);
  const [lastLine, setLastLine] = useState<DeliveryLine | null>(null);

  // A code is checked against the delivery's own location (a bin label never goes into a delivery: stock
  // lands in Unbinned).
  const scanLocation = location && (!delivery || location.id === delivery.locationId) ? location : null;
  const check = useCallback(
    async (code: string) => {
      const hit = await checkScan(code, scanLocation);
      feedbackFor(hit);
      return hit;
    },
    [scanLocation],
  );
  const held = usePendingScan<ScanCheck>({ check, recheck: worthRechecking });

  const load = useCallback(async () => {
    if (!userId) return;
    const open = await store.open(userId);
    const openLines = open ? await store.lines(open.documentId) : [];
    const done = await store.recent(userId);
    setDelivery(open);
    setLines(openLines);
    setRecent(done);
  }, [store, userId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const label = (current: Delivery, count: number) =>
    `Delivery from ${deliveryName(current.sender)} started\u00a0${time(current.startedAt)} · ${count} ${count === 1 ? 'line' : 'lines'}`;

  async function addLine(current: Delivery, code: string, qty: number, name: string | null) {
    const first = lines.length === 0;
    const line: DeliveryLine = { clientLineId: Crypto.randomUUID(), code, qty, label: name, createdAt: new Date().toISOString() };
    await store.addLine(current.documentId, line);
    const payload: QueueItem = {
      kind: 'receipt_lines',
      clientId: Crypto.randomUUID(),
      documentId: current.documentId,
      locationId: current.locationId,
      device: deviceLabel(),
      lines: [{ clientLineId: line.clientLineId, code, qty }],
    };
    await outbox.enqueue(payload, label(current, 1), (existing) =>
      existing.kind === 'receipt_lines' && existing.lines.length < LINES_PER_CALL
        ? {
            payload: { ...existing, lines: [...existing.lines, payload.lines[0]] },
            label: label(current, existing.lines.length + 1),
          }
        : null,
    );
    // Who it's from goes right behind the first lines, in the same stream: the receipt exists by then.
    const details = first ? receiptDetails(Crypto.randomUUID(), current.documentId, current.sender, current.reference) : null;
    if (details) await outbox.enqueue(details, `Delivery from ${deliveryName(current.sender)} · who it’s from`);
    setLines((previous) => [...previous, line]);
    setLastLine(line);
  }

  const documentId = delivery?.documentId ?? null;
  const states = useMemo(() => (documentId ? lineStates(outbox.items, documentId) : new Map()), [outbox.items, documentId]);
  const groups = useMemo(() => groupLines(lines, states), [lines, states]);
  const number = documentId ? receiptNumber(outbox.items, documentId) : null;
  const units = lines.reduce((sum, line) => sum + line.qty, 0);

  // The finished delivery's receipt fills in as PartsLogic answers.
  const finishedId = finished?.delivery.documentId ?? null;
  const finishedGroups = useMemo(
    () => (finished && finishedId ? groupLines(finished.lines, lineStates(outbox.items, finishedId)) : []),
    [finished, finishedId, outbox.items],
  );

  return {
    loaded: delivery !== undefined,
    delivery: delivery ?? null,
    groups,
    number,
    units,
    recent,
    finished: finished
      ? {
          delivery: finished.delivery,
          units: finished.lines.reduce((sum, line) => sum + line.qty, 0),
          number: finishedId ? receiptNumber(outbox.items, finishedId) : null,
          summary: receiptSummary(finishedGroups),
        }
      : null,
    held,
    lastLine,
    waiting: [...states.values()].filter((s) => s.outcome === 'waiting').length,
    problems: [...states.values()].filter((s) => s.outcome === 'attention' || s.outcome === 'refused').length,

    // Opens a new delivery in the working location, from who it's from (and its delivery note).
    async start(sender: Sender, reference: string | null) {
      if (!userId || !location) return;
      const opened: Delivery = {
        documentId: Crypto.randomUUID(),
        userId,
        locationId: location.id,
        locationName: location.name,
        sender,
        reference,
        startedAt: new Date().toISOString(),
        finishedAt: null,
      };
      await store.start(opened);
      setDelivery(opened);
      setLines([]);
      setFinished(null);
      setLastLine(null);
    },

    // A scanned or typed code: held until it's added or skipped. One at a time.
    scan(code: string) {
      if (delivery && !held.pending) void held.hold(code);
    },

    // Adds the held scan with its quantity.
    async confirm() {
      const scan = held.pending;
      if (!delivery || !scan?.hit || scan.hit.type === 'bin' || scan.hit.type === 'error') return;
      held.clear();
      await addLine(delivery, scan.code, scan.qty, scan.hit.type === 'part' ? partLabel(scan.hit) : null);
    },

    async change(code: string, qty: number, name: string | null) {
      if (delivery) await addLine(delivery, code, qty, name);
    },

    async setTotal(code: string, target: number, total: number, name: string | null) {
      const change = adjustmentTo(target, total);
      if (delivery && change !== null) await addLine(delivery, code, change, name);
    },

    async finish() {
      if (!delivery) return;
      await outbox.enqueue(
        { kind: 'close_receipt', clientId: Crypto.randomUUID(), documentId: delivery.documentId },
        `Finish delivery from ${deliveryName(delivery.sender)} started\u00a0${time(delivery.startedAt)}`,
      );
      await store.finish(delivery.documentId);
      feel('done');
      setFinished({ delivery: { ...delivery, finishedAt: new Date().toISOString() }, lines });
      setLastLine(null);
      held.clear();
      await load();
    },

    // Drops a delivery started by mistake, before anything was scanned (nothing reached PartsLogic).
    async cancel() {
      if (!delivery || lines.length > 0) return;
      await store.discardEmpty(delivery.documentId);
      held.clear();
      await load();
    },

    dismissFinished: () => setFinished(null),
  };
}
