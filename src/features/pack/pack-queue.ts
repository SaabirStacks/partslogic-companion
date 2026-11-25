import type { Client } from '@/vendor/partslogic/shared/core/client';
import { packOrder } from '@/vendor/partslogic/shared/sales/packing';
import type { PackQueueItem } from '@/queue/items';

// PartsLogic's answer when an order is packed already: this Packed, sent before, whose answer was lost.
const ALREADY_PACKED = 'This order is already packed';

// Packed, sent when there's signal. Sent twice, the second finds it packed, which is what was asked.
export async function sendPackOrder(supabase: Client, item: PackQueueItem) {
  try {
    return await packOrder(supabase, { orderId: item.orderId, parcels: item.parcels, method: item.method });
  } catch (error) {
    if (error instanceof Error && error.message === ALREADY_PACKED) return { orderId: item.orderId, parcels: item.parcels, fulfilment: 'ready', already: true };
    throw error;
  }
}
