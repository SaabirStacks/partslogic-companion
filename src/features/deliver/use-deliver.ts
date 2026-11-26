import * as Crypto from 'expo-crypto';
import { useEffect, useState } from 'react';

import { feel } from '@/feel/feel';
import { useOnline } from '@/lib/network';
import { deliveriesPref } from '@/lib/prefs';
import { supabase } from '@/lib/supabase';
import { useRemote } from '@/lib/use-remote';
import { useOutbox } from '@/queue/outbox-provider';
import { useWorkingLocation } from '@/session/location-provider';
import {
  getDriverDeliveries,
  padStrokes,
  signedReceiptWords,
  signingProblem,
  type DriverDelivery,
  type SignatureStroke,
} from '@/vendor/partslogic/shared/sales/delivery';
import { NOT_DELIVERED_REASON_LABELS, notDeliveredProblem, type NotDeliveredReason } from '@/vendor/partslogic/shared/sales/handover';

import { handledOrders, readSavedList, sendState, stillOut } from './drop';

// The branch's deliveries out with our drivers (driver_deliveries), the signed-in driver's first. Read with signal and
// kept on the phone (deliveriesPref), so the list, the address and the parts are there at a door with none; what this
// phone has already delivered or marked Not delivered drops off it at once. The board's Deliver tile reads it too.
export function useDriverList(enabled = true) {
  const { location } = useWorkingLocation();
  const online = useOnline();
  const { items } = useOutbox();
  const locationId = location?.id ?? null;
  const remote = useRemote(enabled && online ? `deliveries:${locationId}` : null, () => getDriverDeliveries(supabase, { locationId }));
  const [saved, setSaved] = useState(() => readSavedList(deliveriesPref.get()));
  // A fresh read becomes the list the phone falls back on (React's "storing information from previous renders"),
  // and is kept for the next time there's no signal.
  if (remote.data && remote.data !== saved) setSaved(remote.data);
  useEffect(() => {
    if (remote.data) deliveriesPref.set(remote.data);
  }, [remote.data]);
  const list = remote.data ?? saved;
  const handled = handledOrders(items);
  return {
    online,
    location: list?.location ?? location?.name ?? null,
    now: list?.now ?? new Date().toISOString(),
    // null until a list has been read on this phone
    deliveries: list ? stillOut(list, handled) : null,
    // shown from the phone while there's no signal, or while a fresh read is on its way
    saved: !remote.data && !!saved,
    problem: remote.error instanceof Error ? remote.error.message : null,
    reload: remote.reload,
  };
}

export type Signing = { name: string; strokes: SignatureStroke[]; size: { width: number; height: number } };
export type SigningProblem = ReturnType<typeof signingProblem>;
export type Handed =
  | { kind: 'delivered'; delivery: DriverDelivery; clientId: string; name: string; signedAt: string }
  | { kind: 'not_delivered'; delivery: DriverDelivery; clientId: string; reason: NotDeliveredReason };

const EMPTY_SIGNING: Signing = { name: '', strokes: [], size: { width: 0, height: 0 } };

// Delivering on the phone (S5a-2c): the list, one drop at a time, Sign (a name and a finger's signature, both needed),
// then the receipt. Delivered and Not delivered go into the outbox and are sent as soon as there's signal; the receipt
// follows what PartsLogic answers.
export function useDeliver() {
  const outbox = useOutbox();
  const list = useDriverList();
  const [drop, setDrop] = useState<DriverDelivery | null>(null);
  const [signingOpen, setSigningOpen] = useState(false);
  const [signing, setSigning] = useState<Signing>(EMPTY_SIGNING);
  const [problem, setProblem] = useState<SigningProblem>(null);
  const [handed, setHanded] = useState<Handed | null>(null);

  const item = handed ? outbox.items.find((candidate) => candidate.clientId === handed.clientId) : null;

  return {
    list,
    drop,
    signing: signingOpen ? signing : null,
    problem,
    handed: handed ? { ...handed, state: sendState(item, list.online), refusal: item?.status === 'attention' ? item.lastError : null } : null,

    open(delivery: DriverDelivery) {
      feel('press');
      setDrop(delivery);
    },
    close() {
      setDrop(null);
      setSigningOpen(false);
    },

    sign() {
      feel('press');
      setSigning(EMPTY_SIGNING);
      setProblem(null);
      setSigningOpen(true);
    },
    back() {
      setSigningOpen(false);
      setProblem(null);
    },
    name(name: string) {
      setSigning((now) => ({ ...now, name }));
      setProblem((now) => (now?.field === 'name' ? null : now));
    },
    draw(change: (now: SignatureStroke[]) => SignatureStroke[], size: { width: number; height: number }) {
      setSigning((now) => ({ ...now, strokes: change(now.strokes), size }));
      setProblem((now) => (now?.field === 'signature' ? null : now));
    },
    // Clear empties the pad and keeps the name (D5).
    clear() {
      feel('tick');
      setSigning((now) => ({ ...now, strokes: [] }));
    },

    // Delivered: held until a name and a signature, the name asked for first (D3).
    async delivered() {
      if (!drop) return;
      const wrong = signingProblem(signing.name, signing.strokes);
      if (wrong) {
        feel('unknown');
        setProblem(wrong);
        return;
      }
      const clientId = Crypto.randomUUID();
      const signedAt = new Date().toISOString();
      const name = signing.name.replace(/\s+/g, ' ').trim();
      await outbox.enqueue(
        { kind: 'deliver_signed', clientId, orderId: drop.orderId, name, strokes: padStrokes(signing.strokes, signing.size), signedAt },
        `Delivered ${drop.order} · ${signedReceiptWords(name, signedAt, signedAt)}`,
      );
      feel('done');
      setHanded({ kind: 'delivered', delivery: drop, clientId, name, signedAt });
      setDrop(null);
      setSigningOpen(false);
      setSigning(EMPTY_SIGNING);
    },

    // Not delivered, with why (Other needs a note): the parts come back to the shelf once it's sent.
    async notDelivered(reason: NotDeliveredReason | null, note: string): Promise<string | null> {
      if (!drop) return null;
      const wrong = notDeliveredProblem(reason, note);
      if (wrong || !reason) return wrong;
      const clientId = Crypto.randomUUID();
      await outbox.enqueue(
        { kind: 'not_delivered', clientId, orderId: drop.orderId, reason, ...(reason === 'other' ? { note: note.trim() } : {}) },
        `Not delivered ${drop.order} · ${reason === 'other' ? note.trim() : NOT_DELIVERED_REASON_LABELS[reason]}`,
      );
      feel('done');
      setHanded({ kind: 'not_delivered', delivery: drop, clientId, reason });
      setDrop(null);
      setSigningOpen(false);
      return null;
    },

    next() {
      setHanded(null);
      list.reload();
    },
  };
}

export type DeliverState = ReturnType<typeof useDeliver>;
