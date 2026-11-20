import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { DataError } from '../core/errors';
import { readArray, readBoolean, readNumber, readRecord, readString } from '../core/read';
import { call } from './documents';

// An order's journey for its page (the order as the hub): how far it has got (ordered, delivered, prices checked,
// billed, paid), each delivery with its price check and bill, the bills and payments, the money, and the one next
// step. Worked out in SQL (purchasing.order_trail, 20261112090000); this file reads it.

export const TRAIL_STAGES = ['ordered', 'delivered', 'priced', 'billed', 'paid'] as const;
export type TrailStageKey = (typeof TRAIL_STAGES)[number];
// done; part: some of it; todo: it's this stage's turn; waiting: an earlier stage comes first; skipped: cancelled.
export const TRAIL_STATES = ['done', 'part', 'todo', 'waiting', 'skipped'] as const;
export type TrailState = (typeof TRAIL_STATES)[number];
export type TrailStage = { key: TrailStageKey; state: TrailState };

// checked: a price check; by_bill: its bill checked it when recorded; on_bill: checked when its draft bill is
// recorded; to_check: waiting for a price check or a bill.
export const DELIVERY_PRICE_STATES = ['checked', 'by_bill', 'on_bill', 'to_check'] as const;
export type DeliveryPriceState = (typeof DELIVERY_PRICE_STATES)[number];

export const NEXT_STEPS = ['place', 'receive', 'create_bill', 'finish_bill', 'pay', 'done'] as const;
export type OrderNextStep = (typeof NEXT_STEPS)[number];

export type TrailDelivery = {
  id: string;
  number: string;
  at: string;
  deliveryNote: string | null;
  units: number;
  value: number;
  price: DeliveryPriceState;
  bill: { id: string; number: string; status: 'draft' | 'recorded' } | null;
};

export type TrailBill = {
  id: string;
  number: string;
  status: 'draft' | 'recorded';
  // Their invoice number.
  reference: string | null;
  billDate: string | null;
  dueOn: string | null;
  gross: number;
  paid: number;
  credited: number;
  // Recorded bills only: what's still to pay.
  open: number | null;
  overdue: boolean;
};

export type TrailPayment = { id: string; number: string; paidOn: string; amount: number };

export type OrderTrail = {
  stages: TrailStage[];
  deliveries: TrailDelivery[];
  bills: TrailBill[];
  payments: TrailPayment[];
  money: { ordered: number; received: number; billed: number; paid: number; credited: number; owed: number; unbilled: number };
  counts: { deliveries: number; unbilled: number; toCheck: number; linesDue: number; extras: number };
  next: { step: OrderNextStep; billId: string | null } | null;
};

function oneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

function billStatus(value: unknown): 'draft' | 'recorded' | null {
  return value === 'draft' || value === 'recorded' ? value : null;
}

export const EMPTY_TRAIL: OrderTrail = {
  stages: TRAIL_STAGES.map((key) => ({ key, state: 'waiting' })),
  deliveries: [],
  bills: [],
  payments: [],
  money: { ordered: 0, received: 0, billed: 0, paid: 0, credited: 0, owed: 0, unbilled: 0 },
  counts: { deliveries: 0, unbilled: 0, toCheck: 0, linesDue: 0, extras: 0 },
  next: null,
};

export function readOrderTrail(value: Json | undefined): OrderTrail {
  const row = readRecord(value);
  if (!row) return EMPTY_TRAIL;
  const states = new Map<TrailStageKey, TrailState>();
  for (const item of readArray(row.stages)) {
    const stage = readRecord(item);
    if (stage && oneOf(TRAIL_STAGES, stage.key) && oneOf(TRAIL_STATES, stage.state)) states.set(stage.key, stage.state);
  }
  const money = readRecord(row.money);
  const counts = readRecord(row.counts);
  const next = readRecord(row.next);
  return {
    // Always all five, in order, so the trail never loses a stage.
    stages: TRAIL_STAGES.map((key) => ({ key, state: states.get(key) ?? 'waiting' })),
    deliveries: readArray(row.deliveries).flatMap((item) => {
      const d = readRecord(item);
      const id = readString(d?.id);
      const number = readString(d?.number);
      if (!d || !id || !number) return [];
      const bill = readRecord(d.bill);
      const billId = readString(bill?.id);
      const billNumber = readString(bill?.number);
      const status = billStatus(bill?.status);
      return [
        {
          id,
          number,
          at: readString(d.at) ?? '',
          deliveryNote: readString(d.delivery_note),
          units: readNumber(d.units) ?? 0,
          value: readNumber(d.value) ?? 0,
          price: oneOf(DELIVERY_PRICE_STATES, d.price) ? d.price : 'to_check',
          bill: billId && billNumber && status ? { id: billId, number: billNumber, status } : null,
        },
      ];
    }),
    bills: readArray(row.bills).flatMap((item) => {
      const b = readRecord(item);
      const id = readString(b?.id);
      const number = readString(b?.number);
      const status = billStatus(b?.status);
      if (!b || !id || !number || !status) return [];
      return [
        {
          id,
          number,
          status,
          reference: readString(b.reference),
          billDate: readString(b.bill_date),
          dueOn: readString(b.due_on),
          gross: readNumber(b.gross) ?? 0,
          paid: readNumber(b.paid) ?? 0,
          credited: readNumber(b.credited) ?? 0,
          open: readNumber(b.open),
          overdue: readBoolean(b.overdue) ?? false,
        },
      ];
    }),
    payments: readArray(row.payments).flatMap((item) => {
      const p = readRecord(item);
      const id = readString(p?.id);
      const number = readString(p?.number);
      if (!p || !id || !number) return [];
      return [{ id, number, paidOn: readString(p.paid_on) ?? '', amount: readNumber(p.amount) ?? 0 }];
    }),
    money: {
      ordered: readNumber(money?.ordered) ?? 0,
      received: readNumber(money?.received) ?? 0,
      billed: readNumber(money?.billed) ?? 0,
      paid: readNumber(money?.paid) ?? 0,
      credited: readNumber(money?.credited) ?? 0,
      owed: readNumber(money?.owed) ?? 0,
      unbilled: readNumber(money?.unbilled) ?? 0,
    },
    counts: {
      deliveries: readNumber(counts?.deliveries) ?? 0,
      unbilled: readNumber(counts?.unbilled) ?? 0,
      toCheck: readNumber(counts?.to_check) ?? 0,
      linesDue: readNumber(counts?.lines_due) ?? 0,
      extras: readNumber(counts?.extras) ?? 0,
    },
    next: next && oneOf(NEXT_STEPS, next.step) ? { step: next.step, billId: readString(next.bill_id) } : null,
  };
}

// One click from a received order to its bill: a draft bill for the deliveries not yet billed, every line, price and
// carriage filled in. Editors. Returns the new bill.
export async function createBillFromOrder(supabase: Client, orderId: string): Promise<{ billId: string; number: string }> {
  return call(supabase.rpc('create_bill_from_order', { p_order: orderId }), (data) => {
    const row = readRecord(data);
    const billId = readString(row?.bill_id);
    const number = readString(row?.number);
    if (!billId || !number) throw new DataError('The new bill could not be read.', 'P0002');
    return { billId, number };
  });
}
