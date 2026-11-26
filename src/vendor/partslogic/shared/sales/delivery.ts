import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readBoolean, readNumber, readRecord, readString } from '../core/read';
import { addressLines, deliveryPlace, readSalesOrderAddress, type SalesOrderAddress } from './address';
import { handoverTime } from './handover';
import { NOT_PACKED, parcelsWords } from './packing';
import { clockTime, quantityWords } from './words';

// Proof of delivery (S5a-2c, docs/SALES.md 13.25, docs/design-checks/proof-of-delivery.md). The driver's phone lists
// what is out for delivery from their branch, theirs first; at the door the customer types their name and signs with
// a finger, and that delivers the order. A phone with no signal keeps the signed delivery and sends it later, with a
// client id so a second send is the same delivery. The database decides it all; these read its answers and word them.

// ------------------------------------------------------------------------------------------------ the signature
// A signature is strokes of [x, y] points on a pad 1000 wide and 400 high, whatever the phone's size, so every
// surface draws it the same.
export const SIGN_PAD = { width: 1000, height: 400 } as const;
export type SignaturePoint = [number, number];
export type SignatureStroke = SignaturePoint[];

// The points scaled to the pad by one factor, so the signature keeps its shape whatever the phone's pad (critique:
// scaling across and down apart stretched it 1.4 times wide at 390), and centred on the pad; rounded, out-of-pad
// points pulled to its edge, empty strokes dropped.
export function padStrokes(strokes: SignatureStroke[], size: { width: number; height: number }): SignatureStroke[] {
  const scale = size.width > 0 && size.height > 0 ? Math.min(SIGN_PAD.width / size.width, SIGN_PAD.height / size.height) : 1;
  const dx = size.width > 0 ? (SIGN_PAD.width - size.width * scale) / 2 : 0;
  const dy = size.height > 0 ? (SIGN_PAD.height - size.height * scale) / 2 : 0;
  const clamp = (v: number, max: number) => Math.min(max, Math.max(0, Math.round(v)));
  return strokes
    .map((stroke) => stroke.map(([x, y]): SignaturePoint => [clamp(x * scale + dx, SIGN_PAD.width), clamp(y * scale + dy, SIGN_PAD.height)]))
    .filter((stroke) => stroke.length > 0);
}

export function signaturePoints(strokes: SignatureStroke[]): number {
  return strokes.reduce((sum, stroke) => sum + stroke.length, 0);
}

// The strokes as one SVG path ("M 10 10 L 200 120 …"), for the phone's pad, the order page and the printed note. A
// stroke of one point is drawn as a dot.
export function signaturePath(strokes: SignatureStroke[]): string {
  return strokes
    .filter((stroke) => stroke.length > 0)
    .map((stroke) => {
      const [first, ...rest] = stroke;
      const start = `M ${first![0]} ${first![1]}`;
      return rest.length === 0 ? `${start} L ${first![0] + 0.5} ${first![1]}` : `${start} ${rest.map(([x, y]) => `L ${x} ${y}`).join(' ')}`;
    })
    .join(' ');
}

// What still stops Delivered, the name first, as the database says it.
export const NAME_NEEDED = 'Type the name of the person signing.';
export const SIGNATURE_NEEDED = 'Ask the customer to sign.';
export const SIGNED_NAME_MAX = 80;
export function signingProblem(name: string, strokes: SignatureStroke[]): { field: 'name' | 'signature'; message: string } | null {
  const tidy = name.replace(/\s+/g, ' ').trim();
  if (!tidy) return { field: 'name', message: NAME_NEEDED };
  if (tidy.length > SIGNED_NAME_MAX) return { field: 'name', message: `Keep the name to ${SIGNED_NAME_MAX} characters.` };
  if (signaturePoints(strokes) < 2) return { field: 'signature', message: SIGNATURE_NEEDED };
  return null;
}

// ------------------------------------------------------------------------------------------------ the driver's list
export type DeliveryLine = { lineId: number; part: { id: number | null; brand: string; number: string; description: string | null }; qty: number };

export type DriverDelivery = {
  orderId: string;
  order: string;
  customer: string | null;
  phone: string | null;
  address: SalesOrderAddress | null;
  addressText: string | null;
  // sent out with the signed-in member
  mine: boolean;
  driver: string | null;
  sentAt: string;
  packed: boolean;
  parcels: number | null;
  units: number;
  lines: DeliveryLine[];
};

export type DriverDeliveries = { locationId: number | null; location: string | null; deliveries: DriverDelivery[]; now: string };

function readDeliveryLine(value: Json | undefined): DeliveryLine | null {
  const row = readRecord(value);
  const lineId = readNumber(row?.line_id);
  const part = readRecord(row?.part);
  if (!row || lineId == null || !part) return null;
  return {
    lineId,
    part: { id: readNumber(part.id), brand: readString(part.brand) ?? '', number: readString(part.number) ?? '', description: readString(part.description) },
    qty: readNumber(row.qty) ?? 0,
  };
}

export function readDriverDelivery(value: Json | undefined): DriverDelivery | null {
  const row = readRecord(value);
  const orderId = readString(row?.order_id);
  if (!row || !orderId) return null;
  return {
    orderId,
    order: readString(row.order) ?? '',
    customer: readString(row.customer),
    phone: readString(row.phone),
    address: readSalesOrderAddress(row.address),
    addressText: readString(row.address_text),
    mine: readBoolean(row.mine) ?? false,
    driver: readString(row.driver),
    sentAt: readString(row.sent_at) ?? '',
    packed: readBoolean(row.packed) ?? false,
    parcels: readNumber(row.parcels),
    units: readNumber(row.units) ?? 0,
    lines: readArray(row.lines).flatMap((line) => readDeliveryLine(line) ?? []),
  };
}

export function readDriverDeliveries(value: Json | undefined): DriverDeliveries {
  const row = readRecord(value);
  return {
    locationId: readNumber(row?.location_id),
    location: readString(row?.location),
    deliveries: readArray(row?.deliveries).flatMap((item) => readDriverDelivery(item) ?? []),
    now: readString(row?.now) ?? new Date().toISOString(),
  };
}

export async function getDriverDeliveries(supabase: Client, input: { locationId?: number | null } = {}): Promise<DriverDeliveries> {
  const p = input.locationId != null ? { location_id: input.locationId } : {};
  return call(supabase.rpc('driver_deliveries', { p }), readDriverDeliveries);
}

// The list in its two sections: the driver's own, then the rest of the branch's.
export function deliverySections(list: DriverDelivery[]): { mine: DriverDelivery[]; others: DriverDelivery[] } {
  return { mine: list.filter((d) => d.mine), others: list.filter((d) => !d.mine) };
}

// --------------------------------------------------------------------------------------------- signed at the door
export type SignedDelivery = { orderId: string; clientId: string; name: string; strokes: SignatureStroke[]; signedAt: string };
export type SignedResult = { orderId: string; units: number; status: string | null; replay: boolean };

export function readSignedResult(value: Json | undefined): SignedResult {
  const row = readRecord(value);
  return {
    orderId: readString(row?.order_id) ?? '',
    units: readNumber(row?.units) ?? 0,
    status: readString(row?.status),
    replay: readBoolean(row?.replay) ?? false,
  };
}

export async function deliverSigned(supabase: Client, input: SignedDelivery): Promise<SignedResult> {
  const p = {
    order_id: input.orderId,
    client_id: input.clientId,
    name: input.name.replace(/\s+/g, ' ').trim(),
    strokes: input.strokes,
    signed_at: input.signedAt,
  };
  return call(supabase.rpc('sales_order_deliver_signed', { p: p as unknown as Json }), readSignedResult);
}

// The signature to draw on the reprinted Delivery note (staff only).
export type DeliveryProof = { handoverId: number; name: string; signedAt: string; strokes: SignatureStroke[] };

export function readStrokes(value: Json | undefined): SignatureStroke[] {
  return readArray(value).flatMap((stroke) => {
    const points = readArray(stroke).flatMap((point): SignaturePoint[] => {
      const pair = readArray(point);
      const x = readNumber(pair[0]);
      const y = readNumber(pair[1]);
      return x == null || y == null ? [] : [[x, y]];
    });
    return points.length ? [points] : [];
  });
}

export function readDeliveryProofs(value: Json | undefined): DeliveryProof[] {
  return readArray(value).flatMap((item) => {
    const row = readRecord(item);
    const handoverId = readNumber(row?.handover_id);
    if (!row || handoverId == null) return [];
    return [{ handoverId, name: readString(row.name) ?? '', signedAt: readString(row.signed_at) ?? '', strokes: readStrokes(row.strokes) }];
  });
}

export async function getDeliveryProofs(supabase: Client, orderId: string): Promise<DeliveryProof[]> {
  return call(supabase.rpc('sales_order_delivery_proof', { p_order: orderId }), readDeliveryProofs);
}

// --------------------------------------------------------------------------------------------- the copy deck's words
// (Signed off 26 November 2026.)
export const DELIVER = 'Deliver';
export const WITH_YOU = 'With you';
export const GET_SIGNATURE = 'Get signature';
export const SIGN_HERE = 'Sign here';
export const CLEAR_SIGNATURE = 'Clear';
export const DELIVERED = 'Delivered';
export const SIGNED_NAME_LABEL = 'Name';
export const NEXT_DELIVERY = 'Next delivery';
export const CALL_CUSTOMER = 'Call';
export const WAITING_FOR_SIGNAL = 'Waiting for signal';
export const SENDS_WHEN_ONLINE = 'Sends when back online.';
export const NOTHING_OUT = { title: 'Nothing out for delivery', description: 'Orders appear here once sent out.' } as const;
// What the customer agrees to, above the pad and on the note under the signature (owner, 26 November 2026).
export const RECEIVED_STATEMENT = 'Received in good condition';
// A signed delivery PartsLogic refused (the office got there first, or undid it): the record, not the parts, didn't
// happen, so not "Not delivered" (owner, 26 November 2026).
export const NOT_RECORDED = 'Not recorded';
export const RING_THE_OFFICE = 'Ring the office.';

// "Out from Leeds branch"; just "Out" when the branch isn't known.
export function outFromWords(location: string | null): string {
  return location ? `Out from ${location}` : 'Out';
}

// The board's tile: "3 drops" (owner, 26 November 2026: "3 with you" was cut on phones 375 wide); nothing when there
// are none. A screen reader hears dropsSpoken: "3 deliveries with you".
export function dropsWords(count: number): string | null {
  return count > 0 ? `${count} ${count === 1 ? 'drop' : 'drops'}` : null;
}
export function dropsSpoken(count: number): string {
  return `${count} ${count === 1 ? 'delivery' : 'deliveries'} with you`;
}

// A row's second line: "Shipley BD18 · 2 parcels", or "Not packed" for one sent loose.
export function deliveryRowLine(d: Pick<DriverDelivery, 'address' | 'addressText' | 'packed' | 'parcels'>): string {
  return [deliveryPlace(d.address, d.addressText), d.packed && d.parcels ? parcelsWords(d.parcels) : NOT_PACKED].filter(Boolean).join(' · ');
}

// A row's third line: "SO-000015 · sent 09:12", or "sent 25 Nov 09:12" before today.
export function deliverySentWords(d: Pick<DriverDelivery, 'order' | 'sentAt'>, now: string): string {
  return [d.order, d.sentAt ? `sent ${handoverTime(d.sentAt, now)}` : null].filter(Boolean).join(' · ');
}

// The address on the drop screen, a line at a time.
export function deliveryAddressLines(d: Pick<DriverDelivery, 'address' | 'addressText'>): string[] {
  return addressLines(d.address, d.addressText);
}

// "Sign for SO-000015" and its line, "3 units · 2 parcels".
export function signTitle(order: string): string {
  return `Sign for ${order}`;
}
export function signLine(d: Pick<DriverDelivery, 'units' | 'packed' | 'parcels'>): string {
  return [`${quantityWords(d.units)} ${d.units === 1 ? 'unit' : 'units'}`, d.packed && d.parcels ? parcelsWords(d.parcels) : NOT_PACKED].join(' · ');
}

// A part at the drop: "MONROE G16494 × 2".
export function deliveryLineWords(line: DeliveryLine): string {
  return `${`${line.part.brand} ${line.part.number}`.trim()} × ${quantityWords(line.qty)}`;
}

// The receipt's line: "Signed by Jo Smith · 14:05".
export function signedReceiptWords(name: string, at: string, now: string): string {
  return [`Signed by ${name.replace(/\s+/g, ' ').trim()}`, handoverTime(at, now)].filter(Boolean).join(' · ');
}

// The reprinted Delivery note: "Received by Jo Smith · 26 Nov 2026 14:05" (paper keeps the year).
export function receivedByWords(name: string, signedAt: string): string {
  const then = new Date(signedAt);
  const when = Number.isNaN(then.getTime())
    ? ''
    : `${new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric' }).format(then)} ${clockTime(signedAt)}`;
  return [`Received by ${name}`, when].filter(Boolean).join(' · ');
}
