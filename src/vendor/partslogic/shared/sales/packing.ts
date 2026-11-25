import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readBoolean, readNumber, readRecord, readString, type JsonRecord } from '../core/read';
import { quantityWords } from './words';

// Packing (S5b-1, docs/design-checks/phone-picking.md). A delivery or courier order reaches To pack once every unit it
// wants is on the collection and delivery shelf; Packed records the parcels, and the order reads Ready for delivery.
// Unpack takes it back to To pack. A pack stands only while it covers what is on the shelf: a unit picked or undone
// after it sends the order back to To pack. The database decides all of it; these read its answers and word them.

export const PACK_METHODS = ['web', 'scan', 'tap'] as const;
export type PackMethod = (typeof PACK_METHODS)[number];

// How many parcels Packed takes: 1 to 99, starting at 1 (owner, 25 November 2026).
export const PARCELS_MIN = 1;
export const PARCELS_MAX = 99;

// The order's standing pack, on the order page and the phone's receipt.
export type OrderPack = {
  id: number;
  parcels: number;
  units: number;
  packedAt: string;
  method: PackMethod;
  packedBy: string | null;
  // False once the order changed after it was packed: it is To pack again.
  covers: boolean;
};

export function readOrderPack(value: Json | undefined): OrderPack | null {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  if (!row || id == null) return null;
  const method = readString(row.method);
  return {
    id,
    parcels: readNumber(row.parcels) ?? 1,
    units: readNumber(row.units) ?? 0,
    packedAt: readString(row.packed_at) ?? '',
    method: (PACK_METHODS as readonly string[]).includes(method ?? '') ? (method as PackMethod) : 'web',
    packedBy: readString(row.packed_by),
    covers: readBoolean(row.covers) ?? false,
  };
}

export type PackResult = { packId: number; orderId: string; parcels: number; fulfilment: string | null };

export function packOrder(supabase: Client, pack: { orderId: string; parcels: number; method?: PackMethod }): Promise<PackResult> {
  const p: { [key: string]: Json } = { order_id: pack.orderId, parcels: pack.parcels };
  if (pack.method) p.method = pack.method;
  return call(supabase.rpc('sales_order_pack', { p }), (value) => {
    const row = readRecord(value) ?? {};
    return {
      packId: readNumber(row.pack_id) ?? 0,
      orderId: readString(row.order_id) ?? pack.orderId,
      parcels: readNumber(row.parcels) ?? pack.parcels,
      fulfilment: readString(row.fulfilment),
    };
  });
}

export function unpackOrder(supabase: Client, orderId: string): Promise<{ orderId: string; fulfilment: string | null }> {
  return call(supabase.rpc('sales_order_unpack', { p_order: orderId }), (value) => {
    const row = readRecord(value) ?? {};
    return { orderId: readString(row.order_id) ?? orderId, fulfilment: readString(row.fulfilment) };
  });
}

// ------------------------------------------------------------------------------------------------ the words
// The copy deck (docs/design-checks/phone-picking.md, signed off 25 November 2026).

export function parcelsWords(parcels: number): string {
  return `${parcels} ${parcels === 1 ? 'parcel' : 'parcels'}`;
}

// What the Parcels box says when it can't be saved, or null when it can. An empty box waits and says nothing.
export function parcelsProblem(typed: string): string | null {
  const text = typed.trim();
  if (text === '') return null;
  if (/^-\d+$/.test(text)) return 'At least 1.';
  // Digits only: a number box also takes "2e1" and "1.0", which are not a count of parcels.
  if (!/^\d+$/.test(text)) return 'Type a whole number.';
  const n = Number(text);
  if (n < PARCELS_MIN) return 'At least 1.';
  if (n > PARCELS_MAX) return `Up to ${PARCELS_MAX}.`;
  return null;
}

// The Pack window's title: "Pack SO-000015".
export function packTitle(order: string): string {
  return `Pack ${order}`;
}

// A packed order, on the order page and the receipt: "2 parcels · packed by Alex".
export function packedWords(pack: Pick<OrderPack, 'parcels' | 'packedBy'>): string {
  return [parcelsWords(pack.parcels), pack.packedBy ? `packed by ${pack.packedBy}` : null].filter(Boolean).join(' · ');
}

export const PACKED_TOAST = 'Order packed';
export const UNPACKED_TOAST = 'Order unpacked';

export function packFailedLine(reason: string): string {
  return `Not packed · ${reason}`;
}

// The order's history lines for packing, or null for an event that is not packing's.
export function packingEventText(event: string, detail: JsonRecord): string | null {
  switch (event) {
    case 'packed': {
      const parcels = typeof detail.parcels === 'number' ? detail.parcels : 1;
      const units = typeof detail.units === 'number' ? detail.units : 0;
      return `Packed: ${quantityWords(units)} ${units === 1 ? 'unit' : 'units'} in ${parcelsWords(parcels)}.`;
    }
    case 'unpacked':
      return 'Unpacked.';
    default:
      return null;
  }
}
