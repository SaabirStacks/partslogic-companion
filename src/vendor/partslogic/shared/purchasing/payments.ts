import type { Json } from '@partslogic/db-types';

import { call, readHistoryEvents, type HistoryEvent } from '../core/call';
import type { Client } from '../core/client';
import { DataError } from '../core/errors';
import { readArray, readBoolean, readNumber, readRecord, readString, readStrings, type JsonRecord } from '../core/read';
import { readBillTerms, type BillTerms } from './bills';

// Paying suppliers (docs/SUPPLIER_BILLS.md, step 17b): what each supplier is owed, aged; a payment set against their
// bills with their credit notes used first; voiding one. Every rule lives in SQL (public.*supplier_pay*); this file
// shapes what is sent and read.

export const PAYMENT_METHODS = ['bank_transfer', 'card', 'direct_debit', 'cheque', 'cash', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && (PAYMENT_METHODS as readonly string[]).includes(value);
}

// What a supplier is owed on their recorded bills, aged by days past the due date, and their unused credit.
export type Payables = {
  owed: number;
  bills: number;
  notDue: number;
  d1to30: number;
  d31to60: number;
  d61to90: number;
  d90plus: number;
  overdue: number;
  overdueBills: number;
  dueThisMonth: number;
  oldestDue: string | null;
  creditAvailable: number;
};

export type PayablesList = {
  suppliers: (Payables & { id: number; name: string })[];
  totals: Omit<Payables, 'bills' | 'oldestDue'>;
  currency: string;
  can: { pay: boolean };
};

export type PayBill = {
  id: string;
  number: string;
  reference: string | null;
  billDate: string | null;
  dueOn: string | null;
  gross: number;
  paid: number;
  credited: number;
  open: number;
  daysOverdue: number;
  needsReview: boolean;
};

export type PayCredit = {
  id: string;
  number: string;
  reference: string | null;
  creditDate: string | null;
  gross: number;
  used: number;
  available: number;
};

export type PayOptions = {
  supplier: { id: number; name: string; accountNumber: string | null; terms: BillTerms | null };
  bills: PayBill[];
  credits: PayCredit[];
  payables: Payables;
  currency: string;
  can: { pay: boolean };
};

export type SupplierPaymentDetail = {
  id: string;
  number: string;
  status: 'recorded' | 'voided';
  reference: string | null;
  notes: string | null;
  paidOn: string;
  amount: number;
  method: PaymentMethod;
  creditsUsed: number;
  voided: { at: string; by: string; reason: string } | null;
  createdAt: string;
  createdBy: string;
  supplier: { id: number; name: string; accountNumber: string | null };
  bills: {
    id: string;
    number: string;
    reference: string | null;
    billDate: string | null;
    dueOn: string | null;
    gross: number;
    paid: number;
    credited: number;
    open: number | null;
  }[];
  credits: {
    id: string;
    number: string;
    reference: string | null;
    creditDate: string | null;
    gross: number;
    used: number;
  }[];
  history: HistoryEvent[];
  currency: string;
  can: { void: boolean };
};

export type SupplierPaymentRow = {
  id: string;
  number: string;
  reference: string | null;
  status: 'recorded' | 'voided';
  supplier: { id: number; name: string };
  paidOn: string;
  amount: number;
  method: PaymentMethod;
  creditsUsed: number;
  bills: string[];
};

export type NewSupplierPayment = {
  paidOn?: string | null;
  method: PaymentMethod;
  reference?: string | null;
  notes?: string | null;
  // What each bill is settled by, in the order to settle them; credit notes are taken off first.
  bills: { billId: string; amount?: number }[];
  credits?: { creditId: string; amount?: number }[];
};

const num = (value: Json | undefined) => readNumber(value) ?? 0;

export function readPayables(value: Json | undefined): Payables {
  const row: JsonRecord = readRecord(value) ?? {};
  return {
    owed: num(row.owed),
    bills: num(row.bills),
    notDue: num(row.not_due),
    d1to30: num(row.d1_30),
    d31to60: num(row.d31_60),
    d61to90: num(row.d61_90),
    d90plus: num(row.d90_plus),
    overdue: num(row.overdue),
    overdueBills: num(row.overdue_bills),
    dueThisMonth: num(row.due_this_month),
    oldestDue: readString(row.oldest_due),
    creditAvailable: num(row.credit_available),
  };
}

export function readPayablesList(value: Json): PayablesList {
  const row: JsonRecord = readRecord(value) ?? {};
  const { bills: _b, oldestDue: _o, ...totals } = readPayables(row.totals);
  return {
    suppliers: readArray(row.suppliers).flatMap((item) => {
      const s = readRecord(item);
      const id = readNumber(s?.id);
      if (!s || id == null) return [];
      return [{ id, name: readString(s.name) ?? '', ...readPayables(item) }];
    }),
    totals,
    currency: readString(row.currency) ?? 'GBP',
    can: { pay: readBoolean(readRecord(row.can)?.pay) ?? false },
  };
}

export function readPayOptions(value: Json): PayOptions {
  const row: JsonRecord = readRecord(value) ?? {};
  const supplier = readRecord(row.supplier);
  return {
    supplier: {
      id: num(supplier?.id),
      name: readString(supplier?.name) ?? '',
      accountNumber: readString(supplier?.account_number),
      terms: readBillTerms(supplier?.terms),
    },
    bills: readArray(row.bills).flatMap((item) => {
      const b = readRecord(item);
      const id = readString(b?.id);
      if (!b || !id) return [];
      return [
        {
          id,
          number: readString(b.number) ?? '',
          reference: readString(b.reference),
          billDate: readString(b.bill_date),
          dueOn: readString(b.due_on),
          gross: num(b.gross),
          paid: num(b.paid),
          credited: num(b.credited),
          open: num(b.open),
          daysOverdue: num(b.days_overdue),
          needsReview: readBoolean(b.needs_review) ?? false,
        },
      ];
    }),
    credits: readArray(row.credits).flatMap((item) => {
      const c = readRecord(item);
      const id = readString(c?.id);
      if (!c || !id) return [];
      return [
        {
          id,
          number: readString(c.number) ?? '',
          reference: readString(c.reference),
          creditDate: readString(c.credit_date),
          gross: num(c.gross),
          used: num(c.used),
          available: num(c.available),
        },
      ];
    }),
    payables: readPayables(row.payables),
    currency: readString(row.currency) ?? 'GBP',
    can: { pay: readBoolean(readRecord(row.can)?.pay) ?? false },
  };
}

function readMethod(value: Json | undefined): PaymentMethod {
  return isPaymentMethod(value) ? value : 'other';
}

export function readSupplierPayment(value: Json): SupplierPaymentDetail {
  const row = readRecord(value);
  const id = readString(row?.document_id);
  const number = readString(row?.number);
  if (!row || !id || !number) throw new DataError('The payment could not be read.', 'P0002');
  const supplier = readRecord(row.supplier);
  const voided = readRecord(row.voided);
  return {
    id,
    number,
    status: row.status === 'voided' ? 'voided' : 'recorded',
    reference: readString(row.reference),
    notes: readString(row.notes),
    paidOn: readString(row.paid_on) ?? '',
    amount: num(row.amount),
    method: readMethod(row.method),
    creditsUsed: num(row.credits_used),
    voided: voided
      ? {
          at: readString(voided.at) ?? '',
          by: readString(voided.by) ?? 'Someone',
          reason: readString(voided.reason) ?? '',
        }
      : null,
    createdAt: readString(row.created_at) ?? '',
    createdBy: readString(row.created_by) ?? 'Someone',
    supplier: {
      id: num(supplier?.id),
      name: readString(supplier?.name) ?? '',
      accountNumber: readString(supplier?.account_number),
    },
    bills: readArray(row.bills).flatMap((item) => {
      const b = readRecord(item);
      const bid = readString(b?.id);
      if (!b || !bid) return [];
      return [
        {
          id: bid,
          number: readString(b.number) ?? '',
          reference: readString(b.reference),
          billDate: readString(b.bill_date),
          dueOn: readString(b.due_on),
          gross: num(b.gross),
          paid: num(b.paid),
          credited: num(b.credited),
          open: readNumber(b.open),
        },
      ];
    }),
    credits: readArray(row.credits).flatMap((item) => {
      const c = readRecord(item);
      const cid = readString(c?.id);
      if (!c || !cid) return [];
      return [
        {
          id: cid,
          number: readString(c.number) ?? '',
          reference: readString(c.reference),
          creditDate: readString(c.credit_date),
          gross: num(c.gross),
          used: num(c.used),
        },
      ];
    }),
    history: readHistoryEvents(row.history),
    currency: readString(row.currency) ?? 'GBP',
    can: { void: readBoolean(readRecord(row.can)?.void) ?? false },
  };
}

export function readPaymentRow(value: Json | undefined): SupplierPaymentRow | null {
  const p = readRecord(value);
  const id = readString(p?.id);
  const number = readString(p?.number);
  if (!p || !id || !number) return null;
  const supplier = readRecord(p.supplier);
  return {
    id,
    number,
    reference: readString(p.reference),
    status: p.status === 'voided' ? 'voided' : 'recorded',
    supplier: { id: num(supplier?.id), name: readString(supplier?.name) ?? '' },
    paidOn: readString(p.paid_on) ?? '',
    amount: num(p.amount),
    method: readMethod(p.method),
    creditsUsed: num(p.credits_used),
    bills: readStrings(p.bills),
  };
}

export async function listSupplierPayables(supabase: Client): Promise<PayablesList> {
  return call(supabase.rpc('supplier_payables_list'), readPayablesList);
}

export async function getPayOptions(supabase: Client, supplierId: number): Promise<PayOptions> {
  return call(supabase.rpc('supplier_pay_options', { p_source: supplierId }), readPayOptions);
}

export async function getSupplierPayment(supabase: Client, paymentId: string): Promise<SupplierPaymentDetail> {
  return call(supabase.rpc('supplier_payment_detail', { p_payment: paymentId }), readSupplierPayment);
}

export async function listSupplierPayments(
  supabase: Client,
  query: { supplierId?: number | null; search?: string | null; limit?: number } = {},
): Promise<{ payments: SupplierPaymentRow[]; currency: string }> {
  return call(
    supabase.rpc('supplier_payment_list', {
      p_source: query.supplierId ?? undefined,
      p_search: query.search?.trim() || undefined,
      p_limit: query.limit,
    }),
    (data) => {
      const row = readRecord(data);
      return {
        payments: readArray(row?.payments).flatMap((item) => readPaymentRow(item) ?? []),
        currency: readString(row?.currency) ?? 'GBP',
      };
    },
  );
}

// Pays a supplier. Returns the payment.
export async function recordSupplierPayment(
  supabase: Client,
  supplierId: number,
  payment: NewSupplierPayment,
): Promise<SupplierPaymentDetail> {
  const p: Record<string, Json> = {
    method: payment.method,
    bills: payment.bills.map((b) =>
      b.amount != null ? { bill_id: b.billId, amount: b.amount } : { bill_id: b.billId },
    ),
  };
  if (payment.paidOn) p.paid_on = payment.paidOn;
  if (payment.reference) p.reference = payment.reference;
  if (payment.notes) p.notes = payment.notes;
  if (payment.credits?.length)
    p.credits = payment.credits.map((c) =>
      c.amount != null ? { credit_id: c.creditId, amount: c.amount } : { credit_id: c.creditId },
    );
  return call(supabase.rpc('record_supplier_payment', { p_source: supplierId, p }), readSupplierPayment);
}

export async function voidSupplierPayment(
  supabase: Client,
  paymentId: string,
  reason: string,
): Promise<SupplierPaymentDetail> {
  return call(supabase.rpc('void_supplier_payment', { p_payment: paymentId, p_reason: reason }), readSupplierPayment);
}
