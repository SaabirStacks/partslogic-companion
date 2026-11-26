import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readBoolean, readNumber, readRecord, readString } from '../core/read';
import { readSetAsideOrders, type SetAsideOrder } from '../sales/orders';

// Where a part's stock is, at a glance (20261124090000: part_stock_glance): the Stock list's Available popover and
// the part beside the list read it. Every figure is worked out in the database, by the same rules as the list.

// When a bin was last counted, and by whom (a posted count run, or a count typed in the part window).
export type GlanceCount = { at: string; by: string };

// A bin holding the part. kind: an ordinary bin, the place's Unbinned (stock not yet put away), its Collection shelf,
// or another system bin.
export type GlanceBin = {
  binId: number;
  code: string;
  description: string | null;
  qty: number;
  // out (S5a-2a): the branch's Out for delivery bin, parts with a driver or a courier, still on the books
  kind: 'bin' | 'unbinned' | 'collection' | 'out' | 'system';
  counted: GlanceCount | null;
};

// A place with stock, a minimum, something set aside or something coming. belowReorder is Reorder's rule there.
export type GlancePlace = {
  locationId: number;
  location: string;
  onHand: number;
  setAside: number;
  minQty: number | null;
  maxQty: number | null;
  belowReorder: boolean;
  bins: GlanceBin[];
};

// What is still due on an open purchase order: its first date (the date the supplier last gave, else the order's
// expected date) and whether that has passed.
export type GlanceIncoming = {
  orderId: string;
  number: string;
  supplier: string | null;
  locationId: number | null;
  location: string | null;
  qty: number;
  due: string | null;
  late: boolean;
};

export type StockGlance = {
  partId: number;
  onHand: number;
  setAside: number;
  // on hand less set aside, never below none
  available: number;
  belowReorder: boolean;
  counted: (GlanceCount & { binId: number | null }) | null;
  places: GlancePlace[];
  // stock in a bin with no place (the system's Unassigned)
  elsewhere: { binId: number; code: string; qty: number }[];
  heldFor: SetAsideOrder[];
  incoming: GlanceIncoming[];
  // the last delivery that brought it in
  lastReceived: { at: string; qty: number; documentId: string | null; number: string | null } | null;
};

const BIN_KINDS: readonly GlanceBin['kind'][] = ['bin', 'unbinned', 'collection', 'out', 'system'];

function readCount(value: Json | undefined): GlanceCount | null {
  const count = readRecord(value);
  const at = readString(count?.at);
  return count && at ? { at, by: readString(count.by) ?? 'Someone' } : null;
}

export function readStockGlance(data: Json): StockGlance {
  const body = readRecord(data) ?? {};
  const onHand = readNumber(body.on_hand) ?? 0;
  const setAside = readNumber(body.set_aside) ?? 0;
  const counted = readCount(body.counted);
  return {
    partId: readNumber(body.part_id) ?? 0,
    onHand,
    setAside,
    available: Math.max(onHand - setAside, 0),
    belowReorder: readBoolean(body.below_reorder) ?? false,
    counted: counted ? { ...counted, binId: readNumber(readRecord(body.counted)?.bin_id) } : null,
    places: readArray(body.places).flatMap((item) => {
      const place = readRecord(item);
      const locationId = readNumber(place?.location_id);
      if (!place || locationId == null) return [];
      return [
        {
          locationId,
          location: readString(place.location) ?? '',
          onHand: readNumber(place.on_hand) ?? 0,
          setAside: readNumber(place.set_aside) ?? 0,
          minQty: readNumber(place.min_qty),
          maxQty: readNumber(place.max_qty),
          belowReorder: readBoolean(place.below_reorder) ?? false,
          bins: readArray(place.bins).flatMap((value) => {
            const bin = readRecord(value);
            const binId = readNumber(bin?.bin_id);
            const qty = readNumber(bin?.qty);
            if (!bin || binId == null || qty == null) return [];
            const kind = BIN_KINDS.find((known) => known === bin.kind) ?? 'bin';
            return [
              {
                binId,
                code: readString(bin.code) ?? '',
                description: readString(bin.description),
                qty,
                kind,
                counted: readCount(bin.counted),
              },
            ];
          }),
        },
      ];
    }),
    elsewhere: readArray(body.elsewhere).flatMap((item) => {
      const bin = readRecord(item);
      const binId = readNumber(bin?.bin_id);
      const qty = readNumber(bin?.qty);
      return bin && binId != null && qty != null ? [{ binId, code: readString(bin.code) ?? '', qty }] : [];
    }),
    heldFor: readSetAsideOrders(body.held_for),
    incoming: readArray(body.incoming).flatMap((item) => {
      const line = readRecord(item);
      const orderId = readString(line?.order_id);
      if (!line || !orderId) return [];
      return [
        {
          orderId,
          number: readString(line.number) ?? '',
          supplier: readString(line.supplier),
          locationId: readNumber(line.location_id),
          location: readString(line.location),
          qty: readNumber(line.qty) ?? 0,
          due: readString(line.due),
          late: readBoolean(line.late) ?? false,
        },
      ];
    }),
    lastReceived: readLastReceived(body.last_received),
  };
}

function readLastReceived(value: Json | undefined): StockGlance['lastReceived'] {
  const last = readRecord(value);
  const at = readString(last?.at);
  if (!last || !at) return null;
  return { at, qty: readNumber(last.qty) ?? 0, documentId: readString(last.document_id), number: readString(last.number) };
}

export function getStockGlance(supabase: Client, partId: number): Promise<StockGlance> {
  return call(supabase.rpc('part_stock_glance', { p_part: partId }), readStockGlance);
}

// The lowest minimum across the places that have one, for "Reorder at 10"; null when no place has one.
export function glanceReorderAt(glance: Pick<StockGlance, 'places'>): number | null {
  const minimums = glance.places.flatMap((place) => (place.minQty == null ? [] : [place.minQty]));
  return minimums.length ? Math.min(...minimums) : null;
}
