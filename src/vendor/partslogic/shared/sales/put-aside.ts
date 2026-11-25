import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readNumber, readRecord, readString, type JsonRecord } from '../core/read';
import type { EnquiryCustomer } from './enquiries';
import { quantityWords } from './words';

// Goods in for customers (S4b part one, docs/SALES.md 13.12, boards 6m and 6n). A delivery fills the purchase order
// lines for customers first; what lands on a customer's line is set aside for the sales line and moved onto the
// location's collection and delivery shelf. An order whose every open unit is on the shelf is Ready, for collection
// or for delivery by its method. The database decides all of it; these read its answers and put them in words.

export type DeliveryMethodLike = 'collection' | 'delivery' | 'courier';

// A delivery that put units aside for an order, for its linked documents.
export type PutAsideReceipt = { documentId: string; number: string; units: number; location: string | null; at: string | null };

export function readPutAsideReceipts(value: Json | undefined): PutAsideReceipt[] {
  return readArray(value).flatMap((item) => {
    const row = readRecord(item);
    const documentId = readString(row?.document_id);
    const number = readString(row?.number);
    if (!row || !documentId || !number) return [];
    return [{ documentId, number, units: readNumber(row.units) ?? 0, location: readString(row.location), at: readString(row.at) }];
  });
}

// The stage pill of a ready order: "Ready for collection", "Ready for delivery".
export function readyLabel(method: DeliveryMethodLike): string {
  return method === 'collection' ? 'Ready for collection' : 'Ready for delivery';
}

// Whether the customer of a ready collection still has to be told: the message has not been copied since the last
// part was put aside.
export function readyToTell(order: {
  fulfilment: string | null;
  delivery: { method: DeliveryMethodLike };
  putAsideAt: string | null;
  readyMessageAt: string | null;
}): boolean {
  if (order.fulfilment !== 'ready' || order.delivery.method !== 'collection') return false;
  if (!order.readyMessageAt) return true;
  return order.putAsideAt != null && order.putAsideAt > order.readyMessageAt;
}

// The first name to greet: the account's contact, or the retail card's or caller's name.
export function greetingName(customer: Pick<EnquiryCustomer, 'kind' | 'name' | 'contactName' | 'mainContact'>): string | null {
  // A person is greeted by first name: the order's contact, else the account's main contact. An account with no contact
  // on file gets a plain "Hello", never its company name ("Hello Hill Street Garage" reads as a mail merge).
  const name = customer.kind === 'account' ? (customer.contactName ?? customer.mainContact ?? null) : customer.kind === 'card' || customer.kind === 'caller' ? customer.name : null;
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
}

// Who to ring and on what number: the order's contact (or the typed caller), else the account's main contact.
export function customerToRing(customer: Pick<EnquiryCustomer, 'kind' | 'name' | 'contactName' | 'phone' | 'mainContact' | 'mainPhone'>): { name: string | null; phone: string } | null {
  if (customer.phone) return { name: customer.kind === 'account' ? (customer.contactName ?? null) : customer.name, phone: customer.phone };
  if (customer.kind === 'account' && customer.mainPhone) return { name: customer.mainContact ?? null, phone: customer.mainPhone };
  return null;
}

// The message Copy message puts on the clipboard: "Hello Priya, the parts for YJ20 KLM on order SO-000051 (ARG-7781)
// are ready to collect from Central." Nothing is sent from the app.
export function readyMessage(order: {
  number: string;
  customer: Pick<EnquiryCustomer, 'kind' | 'name' | 'contactName'>;
  customerPo: string | null;
  registrations: string[];
  location: { name: string } | null;
}): string {
  const name = greetingName(order.customer);
  const plates = order.registrations.length ? ` for ${order.registrations.join(', ')}` : '';
  const po = order.customerPo ? ` (${order.customerPo})` : '';
  const from = order.location ? ` from ${order.location.name}` : '';
  return `Hello${name ? ` ${name}` : ''}, the parts${plates} on order ${order.number}${po} are ready to collect${from}.`;
}

// The toast after copying: "Message copied. Paste it into WhatsApp or a text to Priya."
export function readyCopiedWords(customer: Pick<EnquiryCustomer, 'kind' | 'name' | 'contactName'>): string {
  return `Message copied. Paste it into WhatsApp or a text to ${greetingName(customer) ?? (customer.name?.trim() || 'the customer')}.`;
}

// A ready order's need line and the words after its pills.
export function readyNeedWords(location: { name: string } | null): string {
  return `Every part is put aside${location ? ` at ${location.name}` : ''}, ready to collect.`;
}

// The history lines goods in writes on an order.
export function putAsideEventText(event: string, detail: JsonRecord): string | null {
  const text = (key: string) => (typeof detail[key] === 'string' ? (detail[key] as string) : '');
  const n = typeof detail.units === 'number' ? detail.units : 0;
  const part = [text('brand'), text('number')].filter(Boolean).join(' ');
  const units = `${quantityWords(n)} ${n === 1 ? 'unit' : 'units'}`;
  switch (event) {
    case 'put_aside': {
      const at = text('location') ? ` at ${text('location')}` : '';
      const from = text('po') ? ` from ${text('po')}${text('receipt') ? ` (${text('receipt')})` : ''}` : text('receipt') ? ` from ${text('receipt')}` : '';
      return `${part || 'A part'} × ${quantityWords(n)} put aside${at}${from}.`;
    }
    case 'put_aside_undone': {
      const lead = `${part ? `${part} × ${quantityWords(n)}` : units} taken back off the shelf`;
      switch (detail.why) {
        case 'receipt_reversed':
          return `${lead}: ${text('receipt') || 'the delivery'} reversed.`;
        case 'released':
          return `${lead}: no longer needed on this order.`;
        default:
          return `${lead}: ${text('receipt') || 'the delivery'} was changed.`;
      }
    }
    case 'ready_message_copied':
      return 'Ready message copied.';
    default:
      return null;
  }
}

// Copy message: writes the copy to the order's history, so the need to tell the customer leaves.
export function markReadyMessageCopied(supabase: Client, orderId: string): Promise<void> {
  return call(supabase.rpc('sales_order_ready_copied', { p_order: orderId }), () => undefined);
}
