import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { readArray, readBoolean, readNumber, readRecord, readString } from '../core/read';
import { call } from './documents';

// Extra units: what a delivery brought beyond its orders (too many of an ordered part, or a part not on the order),
// and dealing with them: keep and pay (on the order), or send back (a draft return). The rules are in SQL
// (public.deal_with_extras, purchasing.order_extras, 20261112090000); this file reads them. The choice is sent by
// dealWithOrderExtras (goods-in.ts), beside Receive and Close short.

export type OrderExtra = {
  receiptId: string;
  // The delivery's number (GR-).
  receipt: string;
  receivedAt: string;
  partId: number;
  brand: string;
  number: string;
  description: string | null;
  // false: a part that wasn't ordered at all.
  onOrder: boolean;
  extra: number;
  returned: number;
  toDeal: number;
  // Each: the delivery's checked price, else the sheet, else the order.
  unitCost: number | null;
  // The returns any were sent back on.
  returns: { id: string; number: string; status: string }[];
};

export type ExtrasAction = 'keep' | 'return';

export function readOrderExtras(value: Json | undefined): OrderExtra[] {
  return readArray(value).flatMap((item) => {
    const e = readRecord(item);
    const receiptId = readString(e?.receipt_id);
    const receipt = readString(e?.receipt);
    const partId = readNumber(e?.part_id);
    const number = readString(e?.number);
    if (!e || !receiptId || !receipt || partId == null || !number) return [];
    return [
      {
        receiptId,
        receipt,
        receivedAt: readString(e.received_at) ?? '',
        partId,
        brand: readString(e.brand) ?? '',
        number,
        description: readString(e.description),
        onOrder: readBoolean(e.on_order) ?? true,
        extra: readNumber(e.extra) ?? 0,
        returned: readNumber(e.returned) ?? 0,
        toDeal: readNumber(e.to_deal) ?? 0,
        unitCost: readNumber(e.unit_cost),
        returns: readArray(e.returns).flatMap((r) => {
          const ret = readRecord(r);
          const id = readString(ret?.id);
          const retNumber = readString(ret?.number);
          return ret && id && retNumber ? [{ id, number: retNumber, status: readString(ret.status) ?? 'draft' }] : [];
        }),
      },
    ];
  });
}

// The order list's mark: extra units still to deal with on each order that has some.
export async function orderExtrasToDeal(supabase: Client, orderIds: string[]): Promise<Map<string, number>> {
  if (orderIds.length === 0) return new Map();
  return call(supabase.rpc('order_extras_to_deal', { p_orders: orderIds }), (data) => {
    const out = new Map<string, number>();
    for (const item of readArray(data)) {
      const row = readRecord(item);
      const id = readString(row?.document_id);
      const units = readNumber(row?.units);
      if (id && units != null && units > 0) out.set(id, units);
    }
    return out;
  });
}

// Accepting a part that wasn't ordered as a substitute for a line customers are waiting for (S4b part three b, board
// 6r): the window says what happens for each customer, by the account's preference. An account that takes an
// equivalent gets it at once at the lower of the two prices; one that takes parts off the order sends it to
// Substitutes to return; any other is held for the customer to agree. The database does it; these are the words.
type SubstituteFor = { number: string; customer: string | null; ifCannotSupply: 'same_part' | 'equivalent' | 'ask' | 'take_off' };

export function substituteAcceptWords(
  sub: { brand: string; number: string },
  part: { brand: string; number: string },
  customers: SubstituteFor[],
): { title: string; description: string; lines: string[]; button: string } {
  const name = `${sub.brand} ${sub.number}`;
  const was = `${part.brand} ${part.number}`;
  const line = (c: SubstituteFor): string => {
    const who = c.customer ?? 'The customer';
    if (c.ifCannotSupply === 'equivalent') return `${who} takes an equivalent that fits: it replaces ${was} on ${c.number} at the lower of the two prices, and the customer is told.`;
    if (c.ifCannotSupply === 'take_off') return `${who} takes parts off the order: it goes to Substitutes to return, and the counter cancels the line on ${c.number}.`;
    return `It is held for ${c.number}, set aside and not for sale, while ${who} is asked. If the answer is no, it goes to Substitutes to return.`;
  };
  const [only] = customers;
  const single = customers.length === 1 && only ? only : null;
  return {
    title: single
      ? single.ifCannotSupply === 'equivalent'
        ? `Use ${name} for ${single.number}?`
        : single.ifCannotSupply === 'take_off'
          ? `Accept ${name} as a substitute?`
          : `Hold ${name} for ${single.number}?`
      : `Accept ${name} as a substitute?`,
    description: single
      ? `For ${single.number}${single.customer ? ` · ${single.customer}` : ''} · sent in place of ${was}`
      : `Sent in place of ${was}, which ${customers.length} customer orders are waiting for`,
    lines: customers.map(line),
    button: single
      ? single.ifCannotSupply === 'equivalent'
        ? `Use for ${single.number}`
        : single.ifCannotSupply === 'take_off'
          ? 'Accept substitute'
          : `Hold for ${single.number}`
      : 'Accept substitute',
  };
}
