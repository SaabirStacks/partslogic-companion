import type { OutboxItem } from '@/queue/types';
import type { DriverDeliveries, DriverDelivery, SignatureStroke } from '@/vendor/partslogic/shared/sales/delivery';

// Delivering on the phone (S5a-2c): the list as last read with signal, less what this phone has already delivered
// or marked Not delivered, so a drop never shows twice while its send waits for signal. Pure, so it's tested
// without a phone.

// The orders this phone has queued Delivered or Not delivered for, unless PartsLogic refused it (then the order is
// still out, and Sync says why).
export function handledOrders(items: Pick<OutboxItem, 'payload' | 'status'>[]): Set<string> {
  const done = new Set<string>();
  for (const item of items) {
    const payload = item.payload;
    if ((payload.kind === 'deliver_signed' || payload.kind === 'not_delivered') && item.status !== 'attention') done.add(payload.orderId);
  }
  return done;
}

export function stillOut(list: DriverDeliveries, handled: Set<string>): DriverDelivery[] {
  return list.deliveries.filter((delivery) => !handled.has(delivery.orderId));
}

// A saved list, if it still reads as one (an app update may have changed its shape).
export function readSavedList(value: unknown): DriverDeliveries | null {
  const list = value as DriverDeliveries | null;
  return list && Array.isArray(list.deliveries) && list.deliveries.every((d) => typeof d?.orderId === 'string' && Array.isArray(d.lines)) ? list : null;
}

// What the receipt says while it waits, once sent, or when PartsLogic refused it.
export type SendState = 'waiting' | 'sending' | 'sent' | 'refused';
export function sendState(item: Pick<OutboxItem, 'status'> | null | undefined, online: boolean): SendState {
  if (item?.status === 'done') return 'sent';
  if (item?.status === 'attention') return 'refused';
  return online ? 'sending' : 'waiting';
}

// ------------------------------------------------------------------------------------------- the open drop
// What's been signed for one drop: kept with its order, so it comes back only to that drop.
export type Signing = { orderId: string; name: string; strokes: SignatureStroke[]; size: { width: number; height: number } };
// The drop open on this phone, whether Sign is showing, and what's been signed: kept on the phone (deliverDropPref),
// so going back a step, leaving Deliver or the app closing loses neither the name nor the signature (D5).
export type OpenDrop = { drop: DriverDelivery | null; signingOpen: boolean; signing: Signing | null };
export const NO_DROP: OpenDrop = { drop: null, signingOpen: false, signing: null };

export const emptySigning = (orderId: string): Signing => ({ orderId, name: '', strokes: [], size: { width: 0, height: 0 } });
const signingFor = (now: OpenDrop): Signing | null => (now.drop ? (now.signing?.orderId === now.drop.orderId ? now.signing : emptySigning(now.drop.orderId)) : null);

// Another drop starts with nothing signed; the same drop again keeps what was signed for it.
export const openDrop = (now: OpenDrop, drop: DriverDelivery): OpenDrop => ({
  drop,
  signingOpen: false,
  signing: now.signing?.orderId === drop.orderId ? now.signing : null,
});
export const closeDrop = (now: OpenDrop): OpenDrop => ({ ...now, drop: null, signingOpen: false });
// Get signature: Sign with whatever was signed for this drop already.
export const startSigning = (now: OpenDrop): OpenDrop => (now.drop ? { ...now, signingOpen: true, signing: signingFor(now) } : now);
export const stopSigning = (now: OpenDrop): OpenDrop => ({ ...now, signingOpen: false });
export const nameSigner = (now: OpenDrop, name: string): OpenDrop => {
  const was = signingFor(now);
  return was ? { ...now, signing: { ...was, name } } : now;
};
export const drawSignature = (now: OpenDrop, change: (strokes: SignatureStroke[]) => SignatureStroke[], size: Signing['size']): OpenDrop => {
  const was = signingFor(now);
  return was ? { ...now, signing: { ...was, strokes: change(was.strokes), size } } : now;
};
// Clear empties the pad and keeps the name.
export const clearSignature = (now: OpenDrop): OpenDrop => (now.signing ? { ...now, signing: { ...now.signing, strokes: [] } } : now);

// A saved drop, if it still reads as one (an app update may have changed its shape).
export function readOpenDrop(value: unknown): OpenDrop {
  const saved = value as OpenDrop | null;
  const drop = saved?.drop && typeof saved.drop.orderId === 'string' && Array.isArray(saved.drop.lines) ? saved.drop : null;
  const signing = drop && saved?.signing && saved.signing.orderId === drop.orderId && Array.isArray(saved.signing.strokes) ? saved.signing : null;
  return { drop, signingOpen: !!(drop && signing && saved?.signingOpen), signing };
}
