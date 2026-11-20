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
