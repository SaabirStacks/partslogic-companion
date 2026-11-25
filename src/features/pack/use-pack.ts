import * as Crypto from 'expo-crypto';
import { useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { feel } from '@/feel/feel';
import { useOnline } from '@/lib/network';
import { packBoxPref } from '@/lib/prefs';
import { supabase } from '@/lib/supabase';
import { useRemote } from '@/lib/use-remote';
import { useOutbox } from '@/queue/outbox-provider';
import { checkScan } from '@/scan/resolve';
import { useWorkingLocation } from '@/session/location-provider';
import { packFailedLine, parcelsWords } from '@/vendor/partslogic/shared/sales/packing';
import { getPickingList, type PackingOrder } from '@/vendor/partslogic/shared/sales/picking';

import { boxTotals, openBox, packMethod, scanIntoBox, setLine, stepLine, type Box, type BoxLine } from './pack';

export type PackCard =
  | { kind: 'added'; line: BoxLine; complete: boolean }
  | { kind: 'spare'; line: BoxLine }
  | { kind: 'not_on_order'; scanned: string }
  | { kind: 'bin'; bin: string }
  | { kind: 'offline'; code: string }
  | { kind: 'error'; code: string; message: string };

// Packing deliveries on the phone (S5b): the branch's To pack list (it needs signal), then one order at a time, each
// part scanned into the box, the parcels, and Packed, which is saved and sent as soon as there's signal (sent twice,
// it packs once). The receipt follows what PartsLogic answers.
export function usePack() {
  const { location } = useWorkingLocation();
  const online = useOnline();
  const outbox = useOutbox();
  const locationId = location?.id ?? null;
  // The box survives leaving the screen and the app closing (packBoxPref); scans arriving while one is being checked
  // build on the latest box, not the one the screen last drew (critique B).
  const [box, setBoxState] = useState<Box | null>(() => readBox(packBoxPref.get()));
  const latest = useRef<Box | null>(box);
  const setBox = (next: Box | null) => {
    latest.current = next;
    setBoxState(next);
    packBoxPref.set(next);
  };
  const [card, setCard] = useState<{ key: string; card: PackCard } | null>(null);
  const [packed, setPacked] = useState<{ order: PackingOrder; parcels: number; clientId: string } | null>(null);

  const list = useRemote(online && !box && !packed ? `to-pack:${locationId}` : null, () => getPickingList(supabase, { view: 'to_pack', locationId }));

  const item = packed ? outbox.items.find((candidate) => candidate.clientId === packed.clientId) : null;
  const sent = item?.status === 'done';
  const refused = item?.status === 'attention' ? packFailedLine(item.lastError ?? 'Not packed') : null;

  return {
    online,
    list,
    box,
    totals: box ? boxTotals(box) : null,
    card,
    packed: packed ? { ...packed, words: parcelsWords(packed.parcels), sent, refused } : null,

    open(order: PackingOrder) {
      feel('press');
      setBox(openBox(order));
      setCard(null);
    },
    close() {
      setBox(null);
      setCard(null);
    },

    async scan(code: string) {
      const open = latest.current;
      if (!open) return;
      const check = await checkScan(code, location);
      // The box may have been closed, packed or changed while the code was checked.
      const now = latest.current;
      if (!now || now.order.orderId !== open.order.orderId) return;
      let shown: PackCard;
      let next = now;
      if (check.type === 'part') {
        const { box: after, outcome } = scanIntoBox(now, check.partId);
        next = after;
        shown = outcome.kind === 'not_on_order' ? { kind: 'not_on_order', scanned: `${check.brand} ${check.number}`.trim() } : outcome;
      } else if (check.type === 'bin') shown = { kind: 'bin', bin: check.bin };
      else if (check.type === 'unknown') shown = { kind: 'not_on_order', scanned: check.code };
      else if (check.type === 'offline') shown = { kind: 'offline', code: check.code };
      else shown = { kind: 'error', code: check.code, message: check.message };
      feel(shown.kind === 'added' ? 'scan' : shown.kind === 'error' ? 'refused' : 'unknown');
      setBox(next);
      setCard({ key: Crypto.randomUUID(), card: shown });
      // iOS reads no live region: the result is said for VoiceOver as it shows (critique B).
      AccessibilityInfo.announceForAccessibility(packCardWords(shown));
    },

    step(lineId: number, change: 1 | -1) {
      if (latest.current) setBox(stepLine(latest.current, lineId, change));
    },
    set(lineId: number, target: number) {
      if (latest.current) setBox(setLine(latest.current, lineId, target));
    },

    async pack(parcels: number) {
      const box = latest.current;
      if (!box || !boxTotals(box).ready) return;
      const clientId = Crypto.randomUUID();
      await outbox.enqueue(
        { kind: 'pack_order', clientId, orderId: box.order.orderId, parcels, method: packMethod(box) },
        `Pack ${box.order.order} · ${parcelsWords(parcels)}`,
      );
      feel('done');
      setPacked({ order: box.order, parcels, clientId });
      setBox(null);
      setCard(null);
    },

    next() {
      setPacked(null);
      list.reload();
    },
  };
}

export type PackState = ReturnType<typeof usePack>;

// A saved box, if it still reads as one (an app update may have changed its shape).
function readBox(value: unknown): Box | null {
  const box = value as Box | null;
  return box && box.order && Array.isArray(box.lines) && typeof box.order.orderId === 'string' ? box : null;
}

// The scan card in a few words, for VoiceOver.
function packCardWords(card: PackCard): string {
  switch (card.kind) {
    case 'added':
      return `${card.complete ? 'All in the box' : 'In the box'}, ${card.line.part.brand} ${card.line.part.number}, ${card.line.scanned + card.line.tapped} of ${card.line.qty}`;
    case 'spare':
      return `All ${card.line.qty} in the box. Put the spare back`;
    case 'not_on_order':
      return `Not on this order: ${card.scanned}`;
    case 'bin':
      return 'A bin label. Scan the part';
    case 'offline':
    case 'error':
      return `Not checked: ${card.code}`;
  }
}
