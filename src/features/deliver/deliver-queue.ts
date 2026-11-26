import type { Client } from '@/vendor/partslogic/shared/core/client';
import { deliverSigned } from '@/vendor/partslogic/shared/sales/delivery';
import { markNotDelivered } from '@/vendor/partslogic/shared/sales/handover';
import type { DeliverQueueItem } from '@/queue/items';

// Signed at the door, sent when there's signal. PartsLogic knows the client id, so a second send (the first one's
// answer lost) answers as the first did and delivers once.
export function sendDeliverSigned(supabase: Client, item: Extract<DeliverQueueItem, { kind: 'deliver_signed' }>) {
  return deliverSigned(supabase, { orderId: item.orderId, clientId: item.clientId, name: item.name, strokes: item.strokes, signedAt: item.signedAt });
}

// Not delivered: the parts come back to the shelf with why. A refusal (the office marked it already) waits in Sync
// with PartsLogic's words, for the driver to ring the office.
export function sendNotDelivered(supabase: Client, item: Extract<DeliverQueueItem, { kind: 'not_delivered' }>) {
  return markNotDelivered(supabase, { orderId: item.orderId, reason: item.reason, note: item.note ?? null });
}
