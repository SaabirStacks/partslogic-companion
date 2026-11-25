import * as Crypto from 'expo-crypto';
import { useState } from 'react';

import { feel } from '@/feel/feel';
import { useOnline } from '@/lib/network';
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
  const [box, setBox] = useState<Box | null>(null);
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
      if (!box) return;
      const check = await checkScan(code, location);
      let shown: PackCard;
      let next = box;
      if (check.type === 'part') {
        const { box: after, outcome } = scanIntoBox(box, check.partId);
        next = after;
        shown = outcome.kind === 'not_on_order' ? { kind: 'not_on_order', scanned: `${check.brand} ${check.number}`.trim() } : outcome;
      } else if (check.type === 'bin') shown = { kind: 'bin', bin: check.bin };
      else if (check.type === 'unknown') shown = { kind: 'not_on_order', scanned: check.code };
      else if (check.type === 'offline') shown = { kind: 'offline', code: check.code };
      else shown = { kind: 'error', code: check.code, message: check.message };
      feel(shown.kind === 'added' ? 'scan' : shown.kind === 'error' ? 'refused' : 'unknown');
      setBox(next);
      setCard({ key: Crypto.randomUUID(), card: shown });
    },

    step(lineId: number, change: 1 | -1) {
      if (box) setBox(stepLine(box, lineId, change));
    },
    set(lineId: number, target: number) {
      if (box) setBox(setLine(box, lineId, target));
    },

    async pack(parcels: number) {
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
