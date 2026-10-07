import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { db } from '@/db/database';
import { deviceLabel } from '@/lib/device';
import { useOutbox } from '@/queue/outbox-provider';
import { scanFeedback } from '@/scan/feedback';
import { localLabel } from '@/scan/local-label';
import { useWorkingLocation } from '@/session/location-provider';
import { useSession } from '@/session/session-provider';
import type { QueueItem } from '@/vendor/partslogic/shared/bin-session';

import { DeliveryStore, type Delivery } from './delivery-store';
import { adjustmentTo, groupLines, lineStates, receiptNumber, type DeliveryLine } from './lines';

// record_receipt_lines takes up to 500 lines a call.
const LINES_PER_CALL = 500;

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

// Receiving one delivery: every scan is saved on the phone and queued at once (no waiting on signal),
// and what PartsLogic made of each line comes back through the outbox.
export function useDelivery() {
  const { state } = useSession();
  const userId = state.status === 'member' ? state.member.userId : null;
  const { location } = useWorkingLocation();
  const outbox = useOutbox();
  const store = useMemo(() => new DeliveryStore(db()), []);

  const [delivery, setDelivery] = useState<Delivery | null | undefined>(undefined);
  const [lines, setLines] = useState<DeliveryLine[]>([]);
  const [recent, setRecent] = useState<Delivery[]>([]);
  const [finished, setFinished] = useState<{ delivery: Delivery; units: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastLine, setLastLine] = useState<DeliveryLine | null>(null);

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

  const label = (startedAt: string, count: number) =>
    `Delivery started ${time(startedAt)} · ${count} ${count === 1 ? 'line' : 'lines'}`;

  async function addLine(current: Delivery, code: string, qty: number, name: string | null) {
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
    await outbox.enqueue(payload, label(current.startedAt, 1), (existing) =>
      existing.kind === 'receipt_lines' && existing.lines.length < LINES_PER_CALL
        ? {
            payload: { ...existing, lines: [...existing.lines, payload.lines[0]] },
            label: label(current.startedAt, existing.lines.length + 1),
          }
        : null,
    );
    setLines((previous) => [...previous, line]);
    setLastLine(line);
  }

  const documentId = delivery?.documentId ?? null;
  const states = useMemo(() => (documentId ? lineStates(outbox.items, documentId) : new Map()), [outbox.items, documentId]);
  const groups = useMemo(() => groupLines(lines, states), [lines, states]);
  const number = documentId ? receiptNumber(outbox.items, documentId) : null;
  const units = lines.reduce((sum, line) => sum + line.qty, 0);

  return {
    loaded: delivery !== undefined,
    delivery: delivery ?? null,
    groups,
    number,
    units,
    recent,
    finished,
    notice,
    lastLine,
    waiting: [...states.values()].filter((s) => s.outcome === 'waiting').length,
    problems: [...states.values()].filter((s) => s.outcome === 'attention' || s.outcome === 'refused').length,

    async start() {
      if (!userId || !location) return;
      await store.start({
        documentId: Crypto.randomUUID(),
        userId,
        locationId: location.id,
        locationName: location.name,
        startedAt: new Date().toISOString(),
        finishedAt: null,
      });
      setFinished(null);
      setNotice(null);
      setLastLine(null);
      await load();
    },

    async scan(code: string) {
      if (!delivery) return;
      const sameLocation = location && location.id === delivery.locationId ? location.code : null;
      const local = await localLabel(code, sameLocation);
      if (local.type === 'bin') {
        scanFeedback.unknown();
        setNotice(`${local.bin} is a bin label. Deliveries go into Unbinned; put stock on shelves from the Count tab.`);
        return;
      }
      setNotice(null);
      scanFeedback.found();
      await addLine(delivery, code, 1, local.type === 'part' ? local.label : null);
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
      const clientId = Crypto.randomUUID();
      await outbox.enqueue(
        { kind: 'close_receipt', clientId, documentId: delivery.documentId },
        `Finish delivery started ${time(delivery.startedAt)}`,
      );
      await store.finish(delivery.documentId);
      setFinished({ delivery, units });
      setLastLine(null);
      setNotice(null);
      await load();
    },

    dismissFinished: () => setFinished(null),
  };
}
