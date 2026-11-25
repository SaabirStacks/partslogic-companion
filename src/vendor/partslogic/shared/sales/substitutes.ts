import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readBoolean, readNumber, readRecord, readString } from '../core/read';
import { CUSTOMER_CHANNEL_PHRASE, CUSTOMER_CHANNELS, type CustomerAnswer, type CustomerChannel } from './cannot-supply';
import { dateWords, dayAndTime, quantityWords } from './words';

// Substitutes to return (S4b part three b, slice two b; docs/SALES.md 13.18, board 6r): Purchase orders' queue of the
// substitutes customers didn't want, and of any still waiting on a customer whose return-by date is two days away. By
// supplier, soonest return-by date first (owner, 21 November 2026). The database decides what is in it and when each
// is to be back by; these read it, word it and send Return to supplier and Accept into stock.

export const SUBSTITUTES = 'substitutes' as const;

export type SubstituteToReturn = {
  id: number;
  supplierId: number;
  supplier: string;
  partId: number;
  brand: string;
  number: string;
  description: string | null;
  units: number;
  // refused: the customer (or the account) didn't want it; held: still waiting on the customer.
  state: 'held' | 'refused';
  decidedAt: string | null;
  answer: CustomerAnswer | null;
  answeredVia: CustomerChannel | null;
  // How the failure ended, when it did: the line cancelled, the part reordered or replaced.
  clearedWhy: string | null;
  forPart: string;
  orderId: string;
  orderNumber: string;
  customer: string | null;
  receiptId: string;
  receiptNumber: string;
  receivedOn: string | null;
  poId: string;
  poNumber: string;
  locationId: number;
  location: string | null;
  returnBy: string | null;
  // Each, before VAT; only for someone who may see costs.
  unitCost: number | null;
};

export type SubstitutesQueue = { today: string | null; rows: SubstituteToReturn[]; canReturn: boolean };

const ANSWERS: readonly CustomerAnswer[] = ['same_part', 'equivalent', 'take_off'];

export function readSubstitutesQueue(data: Json): SubstitutesQueue {
  const body = readRecord(data) ?? {};
  const rows = readArray(body.rows).flatMap((item): SubstituteToReturn[] => {
    const r = readRecord(item);
    const id = readNumber(r?.id);
    const orderId = readString(r?.order_id);
    if (!r || id == null || !orderId) return [];
    const answer = readString(r.answer);
    const via = readString(r.answered_via);
    return [{
      id,
      supplierId: readNumber(r.supplier_id) ?? 0,
      supplier: readString(r.supplier) ?? '',
      partId: readNumber(r.part_id) ?? 0,
      brand: readString(r.brand) ?? '',
      number: readString(r.number) ?? '',
      description: readString(r.description),
      units: readNumber(r.units) ?? 0,
      state: r.state === 'held' ? 'held' : 'refused',
      decidedAt: readString(r.decided_at),
      answer: (ANSWERS as readonly string[]).includes(answer ?? '') ? (answer as CustomerAnswer) : null,
      answeredVia: (CUSTOMER_CHANNELS as readonly string[]).includes(via ?? '') ? (via as CustomerChannel) : null,
      clearedWhy: readString(r.cleared_why),
      forPart: readString(r.for_part) ?? '',
      orderId,
      orderNumber: readString(r.order_number) ?? '',
      customer: readString(r.customer),
      receiptId: readString(r.receipt_id) ?? '',
      receiptNumber: readString(r.receipt_number) ?? '',
      receivedOn: readString(r.received_on),
      poId: readString(r.po_id) ?? '',
      poNumber: readString(r.po_number) ?? '',
      locationId: readNumber(r.location_id) ?? 0,
      location: readString(r.location),
      returnBy: readString(r.return_by),
      unitCost: readNumber(r.unit_cost),
    }];
  });
  return { today: readString(body.today), rows, canReturn: readBoolean(body.can_return) ?? false };
}

// The queue by supplier, in the order the database gives it (soonest return-by first within each).
export type SubstituteGroup = { supplierId: number; supplier: string; rows: SubstituteToReturn[]; units: number; cost: number | null };

export function groupSubstitutes(rows: SubstituteToReturn[]): SubstituteGroup[] {
  const groups = new Map<number, SubstituteGroup>();
  for (const row of rows) {
    const group = groups.get(row.supplierId) ?? { supplierId: row.supplierId, supplier: row.supplier, rows: [], units: 0, cost: 0 };
    group.rows.push(row);
    group.units += row.units;
    group.cost = group.cost == null || row.unitCost == null ? null : group.cost + row.unitCost * row.units;
    groups.set(row.supplierId, group);
  }
  return [...groups.values()];
}

// Past its return-by date: the supplier may refuse it, so Accept into stock comes first and it starts unticked.
export function isPastReturnBy(row: Pick<SubstituteToReturn, 'returnBy'>, today: string | null): boolean {
  return row.returnBy != null && today != null && row.returnBy < today;
}

// Why it is in the queue, under the order: "Refused today 11:05: chose the same part elsewhere", "Taken off the
// order", or "Waiting for Hillside Garage's answer".
export function substituteWhyWords(row: SubstituteToReturn, now: string): string {
  if (row.state === 'held') return `Waiting for ${row.customer ?? 'the customer'}’s answer`;
  const when = row.decidedAt ? ` ${dayAndTime(row.decidedAt, now)}` : '';
  const via = row.answeredVia ? ` ${CUSTOMER_CHANNEL_PHRASE[row.answeredVia]}` : '';
  if (row.answer === 'same_part') return `Refused${when}${via}: chose ${row.forPart} from another supplier`;
  if (row.answer === 'take_off') return `Refused${when}${via}: taken off the order`;
  if (row.clearedWhy === 'cancelled') return `Line cancelled${when}`;
  if (row.clearedWhy === 'replaced') return `Replaced by another part${when}`;
  return `Not wanted${when}: the account takes parts off the order`;
}

// Return by: "Thu 3 Dec", or "↑ Overdue 2 days" once past.
export function returnByWords(row: Pick<SubstituteToReturn, 'returnBy'>, today: string | null): { text: string; late: boolean } {
  if (!row.returnBy) return { text: '', late: false };
  if (today && row.returnBy < today) {
    const days = Math.round((Date.parse(today) - Date.parse(row.returnBy)) / 86_400_000);
    return { text: `↑ Overdue ${days} ${days === 1 ? 'day' : 'days'}`, late: true };
  }
  return { text: dateWords(row.returnBy), late: false };
}

// After Return to supplier: "Added to RT-000004".
export function substitutesReturnedWords(returns: { number: string; supplier: string | null; units: number }[]): string {
  return `Added to ${returns.map((r) => r.number).join(', ')}`;
}

export function getSubstitutesQueue(supabase: Client): Promise<SubstitutesQueue> {
  return call(supabase.rpc('purchase_orders_substitutes', { p: {} }), readSubstitutesQueue);
}

export function returnSubstitutes(supabase: Client, ids: number[]): Promise<{ number: string; supplier: string | null; units: number; returnId: string }[]> {
  return call(supabase.rpc('return_substitutes', { p: { ids } }), (data) =>
    readArray(readRecord(data)?.returns).flatMap((item) => {
      const r = readRecord(item);
      const returnId = readString(r?.return_id);
      return r && returnId ? [{ number: readString(r.number) ?? '', supplier: readString(r.supplier), units: readNumber(r.units) ?? 0, returnId }] : [];
    }),
  );
}

export function keepSubstitutes(supabase: Client, ids: number[]): Promise<number> {
  return call(supabase.rpc('keep_substitutes', { p: { ids } }), (data) => readNumber(readRecord(data)?.kept) ?? 0);
}

// Undo of Return to supplier or Accept into stock: back to Substitutes to return (a returned one comes off its draft
// supplier return).
export function undoSubstitutes(supabase: Client, ids: number[]): Promise<number> {
  return call(supabase.rpc('undo_substitutes', { p: { ids } }), (data) => readNumber(readRecord(data)?.undone) ?? 0);
}

// The confirm before Return to supplier, Shopify-short: "Return 2 substitutes to GSF Car Parts?", one line on what
// happens, and the plain verb on the button.
export function returnConfirmWords(rows: Pick<SubstituteToReturn, 'units' | 'supplier' | 'location'>[]): { title: string; body: string; action: string } {
  const units = rows.reduce((sum, row) => sum + row.units, 0);
  const suppliers = [...new Set(rows.map((row) => row.supplier))];
  const to = suppliers.length === 1 ? suppliers[0]! : `${quantityWords(suppliers.length)} suppliers`;
  const what = `${quantityWords(units)} ${units === 1 ? 'substitute' : 'substitutes'}`;
  return {
    title: `Return ${what} to ${to}?`,
    body: `${units === 1 ? 'It goes' : 'They go'} on the draft supplier return as Wrongly supplied.`,
    action: 'Return',
  };
}
