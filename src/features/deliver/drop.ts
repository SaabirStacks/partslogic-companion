import type { OutboxItem } from '@/queue/types';
import type { DriverDeliveries, DriverDelivery } from '@/vendor/partslogic/shared/sales/delivery';

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
