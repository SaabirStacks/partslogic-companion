import type { Json } from '@partslogic/db-types';

import { call, readHistoryEvents, type HistoryEvent } from '../core/call';
import type { Client } from '../core/client';
import { DataError, dataError } from '../core/errors';
import { readArray, readBoolean, readNumber, readRecord, readString, readStrings, type JsonRecord } from '../core/read';

// Supplier bills (docs/SUPPLIER_BILLS.md; purchasing step 17a). A draft is entered by picking the deliveries it covers,
// whose lines fill in at the prices we expected; lines are corrected to what the bill says, and recording needs their
// number, the date, a due date, the net and VAT, and lines adding up to the net. Differences are then accepted or
// queried. Every rule lives in SQL (public.*supplier_bill*); this file shapes what is sent and read.

export const SUPPLIER_BILL_STATUSES = ['draft', 'recorded'] as const;
export type SupplierBillStatus = (typeof SUPPLIER_BILL_STATUSES)[number];

// The list's groups: a recorded bill with differences still to decide is "to review".
export const SUPPLIER_BILL_GROUPS = ['draft', 'to_review', 'recorded'] as const;
export type SupplierBillGroup = (typeof SUPPLIER_BILL_GROUPS)[number];

export function isSupplierBillGroup(value: unknown): value is SupplierBillGroup {
  return typeof value === 'string' && (SUPPLIER_BILL_GROUPS as readonly string[]).includes(value);
}

// When a supplier's bills fall due, as Xero has it.
export const BILL_TERMS_KINDS = [
  'days_after_bill_date',
  'days_after_bill_month',
  'of_current_month',
  'of_following_month',
] as const;
export type BillTermsKind = (typeof BILL_TERMS_KINDS)[number];
export type BillTerms = { kind: BillTermsKind; day: number };

export function isBillTermsKind(value: unknown): value is BillTermsKind {
  return typeof value === 'string' && (BILL_TERMS_KINDS as readonly string[]).includes(value);
}

export const BILL_LINE_KINDS = ['part', 'surcharge', 'carriage', 'other'] as const;
export type BillLineKind = (typeof BILL_LINE_KINDS)[number];
export type BillDecisionKind = 'accepted' | 'queried';

// lines_dont_add_up: the lines' total isn't the net. vat_differs: the VAT isn't near our rate on the net.
// no_due_date: no due date (the supplier has no terms). duplicate_reference: their number is already recorded.
export const BILL_WARNINGS = ['lines_dont_add_up', 'vat_differs', 'no_due_date', 'duplicate_reference'] as const;
export type BillWarning = (typeof BILL_WARNINGS)[number];

export type BillPart = { id: number; brand: string | null; number: string; description: string | null };

export type SupplierBillLine = {
  id: number;
  lineNo: number;
  kind: BillLineKind;
  receiptId: string | null;
  part: BillPart | null;
  // Units and price per unit as billed (parts and surcharges), against what we expected.
  qty: number | null;
  unitPrice: number | null;
  expectedQty: number | null;
  expectedPrice: number | null;
  net: number;
  // Null: nothing was expected (carriage nobody typed, another line).
  expectedNet: number | null;
  difference: number;
  // A difference to decide; within the tolerance (5p a line) it isn't one.
  flagged: boolean;
  withinTolerance: boolean;
  description: string | null;
  decision: { kind: BillDecisionKind; note: string | null; at: string; by: string } | null;
  credited: number;
  queryOpen: number;
};

export type SupplierBillReceipt = {
  id: string;
  number: string;
  reference: string | null;
  receivedAt: string;
  locationCode: string | null;
  checked: boolean;
  checkedByBill: boolean;
  value: number;
};

// A delivery from the supplier not yet on any bill.
export type UnbilledDelivery = {
  id: string;
  number: string;
  reference: string | null;
  receivedAt: string;
  checked: boolean;
  value: number;
  // Its number or reference appears in the bill's number or notes.
  mentioned: boolean;
};

export type SupplierBillDetail = {
  id: string;
  number: string;
  status: SupplierBillStatus;
  reference: string | null;
  notes: string | null;
  billDate: string | null;
  dueOn: string | null;
  net: number | null;
  vat: number | null;
  gross: number | null;
  needsReview: boolean;
  createdAt: string;
  createdBy: string;
  recordedAt: string | null;
  recordedBy: string | null;
  supplier: { id: number; name: string; accountNumber: string | null; terms: BillTerms | null };
  receipts: SupplierBillReceipt[];
  lines: SupplierBillLine[];
  totals: {
    lines: number;
    linesNet: number;
    difference: number | null;
    vatRate: number;
    vatExpected: number;
    currency: string;
  };
  differences: { count: number; toDecide: number; over: number; under: number; queried: number; queryOpen: number };
  // Once recorded (step 17b): what's been paid and credited against it, and what's still to pay.
  payment: BillPaymentState | null;
  warnings: BillWarning[];
  openReceipts: UnbilledDelivery[];
  history: HistoryEvent[];
  can: {
    edit: boolean;
    record: boolean;
    reopen: boolean;
    delete: boolean;
    decide: boolean;
    pay: boolean;
    editNotes: boolean;
  };
};

export type BillAllocation = {
  paymentId: string;
  paymentNumber: string;
  paidOn: string;
  method: string;
  // A credit note used against the bill, or null for money paid.
  credit: { id: string; number: string; reference: string | null } | null;
  amount: number;
};

export type BillPaymentState = {
  paid: number;
  credited: number;
  open: number;
  overdue: boolean;
  allocations: BillAllocation[];
};

// The list's filters: its groups, and recorded bills by whether anything is still to pay.
export const SUPPLIER_BILL_FILTERS = [...SUPPLIER_BILL_GROUPS, 'unpaid', 'paid'] as const;
export type SupplierBillFilter = (typeof SUPPLIER_BILL_FILTERS)[number];

export type SupplierBillRow = {
  id: string;
  number: string;
  reference: string | null;
  status: SupplierBillStatus;
  group: SupplierBillGroup;
  supplier: { id: number; name: string };
  billDate: string | null;
  dueOn: string | null;
  net: number | null;
  vat: number | null;
  gross: number | null;
  overdue: boolean;
  receipts: string[];
  toDecide: number;
  queryOpen: number;
  // Recorded bills only (null on a draft).
  paid: number | null;
  open: number | null;
  createdAt: string;
};

export type UnbilledRow = Omit<UnbilledDelivery, 'mentioned'> & {
  supplier: { id: number; name: string };
  days: number;
};

export type SupplierBillList = {
  counts: {
    draft: number;
    toReview: number;
    recorded: number;
    unpaid: number;
    paid: number;
    overdue: number;
    unbilled: number;
  };
  totals: { recordedGross: number; owed: number; overdue: number; unbilledValue: number; unbilledOld: number };
  bills: SupplierBillRow[];
  unbilled: UnbilledRow[];
  currency: string;
  can: { edit: boolean };
};

export type BillChanges = {
  reference?: string | null;
  billDate?: string | null;
  dueOn?: string | null;
  net?: number | null;
  vat?: number | null;
  notes?: string | null;
};

export type NewBillLine = {
  kind: 'carriage' | 'other';
  net: number;
  description?: string | null;
  receiptId?: string | null;
};
export type BillLineChanges = { qty?: number; unitPrice?: number; net?: number; description?: string };

const num = (value: Json | undefined) => readNumber(value) ?? 0;

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}

export function readBillTerms(value: Json | undefined): BillTerms | null {
  const row = readRecord(value);
  const day = readNumber(row?.day);
  if (!row || !isBillTermsKind(row.kind) || day == null) return null;
  return { kind: row.kind, day };
}

function readLine(value: Json | undefined): SupplierBillLine | null {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  if (!row || id == null || !isOneOf(BILL_LINE_KINDS, row.kind)) return null;
  const part = readRecord(row.part);
  const partId = readNumber(part?.id);
  const decision = readRecord(row.decision);
  return {
    id,
    lineNo: num(row.line_no),
    kind: row.kind,
    receiptId: readString(row.receipt_id),
    part:
      part && partId != null
        ? {
            id: partId,
            brand: readString(part.brand),
            number: readString(part.number) ?? '',
            description: readString(part.description),
          }
        : null,
    qty: readNumber(row.qty),
    unitPrice: readNumber(row.unit_price),
    expectedQty: readNumber(row.expected_qty),
    expectedPrice: readNumber(row.expected_price),
    net: num(row.net),
    expectedNet: readNumber(row.expected_net),
    difference: num(row.difference),
    flagged: readBoolean(row.flagged) ?? false,
    withinTolerance: readBoolean(row.within_tolerance) ?? false,
    description: readString(row.description),
    decision:
      decision && (decision.kind === 'accepted' || decision.kind === 'queried')
        ? {
            kind: decision.kind,
            note: readString(decision.note),
            at: readString(decision.at) ?? '',
            by: readString(decision.by) ?? 'Someone',
          }
        : null,
    credited: num(row.credited),
    queryOpen: num(row.query_open),
  };
}

function readUnbilled(value: Json | undefined): UnbilledDelivery | null {
  const row = readRecord(value);
  const id = readString(row?.id);
  const number = readString(row?.number);
  if (!row || !id || !number) return null;
  return {
    id,
    number,
    reference: readString(row.reference),
    receivedAt: readString(row.received_at) ?? '',
    checked: readBoolean(row.checked) ?? false,
    value: num(row.value),
    mentioned: readBoolean(row.mentioned) ?? false,
  };
}

function readBillPayment(value: Json | undefined): BillPaymentState | null {
  const row = readRecord(value);
  if (!row) return null;
  return {
    paid: num(row.paid),
    credited: num(row.credited),
    open: num(row.open),
    overdue: readBoolean(row.overdue) ?? false,
    allocations: readArray(row.allocations).flatMap((item) => {
      const a = readRecord(item);
      const paymentId = readString(a?.payment_id);
      if (!a || !paymentId) return [];
      const creditId = readString(a.credit_id);
      return [
        {
          paymentId,
          paymentNumber: readString(a.payment_number) ?? '',
          paidOn: readString(a.paid_on) ?? '',
          method: readString(a.method) ?? 'other',
          credit: creditId
            ? { id: creditId, number: readString(a.credit_number) ?? '', reference: readString(a.credit_reference) }
            : null,
          amount: num(a.amount),
        },
      ];
    }),
  };
}

export function readSupplierBill(value: Json): SupplierBillDetail {
  const row = readRecord(value);
  const id = readString(row?.document_id);
  const number = readString(row?.number);
  const supplier = readRecord(row?.supplier);
  const supplierId = readNumber(supplier?.id);
  if (!row || !id || !number || !isOneOf(SUPPLIER_BILL_STATUSES, row.status) || supplierId == null) {
    throw new DataError('The bill could not be read.', 'P0002');
  }
  const totals: JsonRecord = readRecord(row.totals) ?? {};
  const diffs: JsonRecord = readRecord(row.differences) ?? {};
  const can: JsonRecord = readRecord(row.can) ?? {};
  return {
    id,
    number,
    status: row.status,
    reference: readString(row.reference),
    notes: readString(row.notes),
    billDate: readString(row.bill_date),
    dueOn: readString(row.due_on),
    net: readNumber(row.net),
    vat: readNumber(row.vat),
    gross: readNumber(row.gross),
    needsReview: readBoolean(row.needs_review) ?? false,
    createdAt: readString(row.created_at) ?? '',
    createdBy: readString(row.created_by) ?? 'Someone',
    recordedAt: readString(row.recorded_at),
    recordedBy: readString(row.recorded_by),
    supplier: {
      id: supplierId,
      name: readString(supplier?.name) ?? '',
      accountNumber: readString(supplier?.account_number),
      terms: readBillTerms(supplier?.terms),
    },
    receipts: readArray(row.receipts).flatMap((item) => {
      const r = readRecord(item);
      const rid = readString(r?.id);
      if (!r || !rid) return [];
      return [
        {
          id: rid,
          number: readString(r.number) ?? '',
          reference: readString(r.reference),
          receivedAt: readString(r.received_at) ?? '',
          locationCode: readString(r.location_code),
          checked: readBoolean(r.checked) ?? false,
          checkedByBill: readBoolean(r.checked_by_bill) ?? false,
          value: num(r.value),
        },
      ];
    }),
    lines: readArray(row.lines).flatMap((item) => readLine(item) ?? []),
    totals: {
      lines: num(totals.lines),
      linesNet: num(totals.lines_net),
      difference: readNumber(totals.difference),
      vatRate: num(totals.vat_rate),
      vatExpected: num(totals.vat_expected),
      currency: readString(totals.currency) ?? 'GBP',
    },
    differences: {
      count: num(diffs.count),
      toDecide: num(diffs.to_decide),
      over: num(diffs.over),
      under: num(diffs.under),
      queried: num(diffs.queried),
      queryOpen: num(diffs.query_open),
    },
    warnings: readStrings(row.warnings).filter((w): w is BillWarning => isOneOf(BILL_WARNINGS, w)),
    payment: readBillPayment(row.payment),
    openReceipts: readArray(row.open_receipts).flatMap((item) => readUnbilled(item) ?? []),
    history: readHistoryEvents(row.history),
    can: {
      edit: readBoolean(can.edit) ?? false,
      record: readBoolean(can.record) ?? false,
      reopen: readBoolean(can.reopen) ?? false,
      delete: readBoolean(can.delete) ?? false,
      decide: readBoolean(can.decide) ?? false,
      pay: readBoolean(can.pay) ?? false,
      editNotes: readBoolean(can.edit_notes) ?? false,
    },
  };
}

function readSupplierRef(value: Json | undefined) {
  const s = readRecord(value);
  return { id: readNumber(s?.id) ?? 0, name: readString(s?.name) ?? '' };
}

export function readSupplierBillList(value: Json): SupplierBillList {
  const row: JsonRecord = readRecord(value) ?? {};
  const counts = readRecord(row.counts);
  const totals = readRecord(row.totals);
  return {
    counts: {
      draft: num(counts?.draft),
      toReview: num(counts?.to_review),
      recorded: num(counts?.recorded),
      unpaid: num(counts?.unpaid),
      paid: num(counts?.paid),
      overdue: num(counts?.overdue),
      unbilled: num(counts?.unbilled),
    },
    totals: {
      recordedGross: num(totals?.recorded_gross),
      owed: num(totals?.owed),
      overdue: num(totals?.overdue),
      unbilledValue: num(totals?.unbilled_value),
      unbilledOld: num(totals?.unbilled_old),
    },
    bills: readArray(row.bills).flatMap((item) => {
      const b = readRecord(item);
      const id = readString(b?.id);
      const number = readString(b?.number);
      if (!b || !id || !number || !isOneOf(SUPPLIER_BILL_STATUSES, b.status) || !isSupplierBillGroup(b.group))
        return [];
      return [
        {
          id,
          number,
          reference: readString(b.reference),
          status: b.status,
          group: b.group,
          supplier: readSupplierRef(b.supplier),
          billDate: readString(b.bill_date),
          dueOn: readString(b.due_on),
          net: readNumber(b.net),
          vat: readNumber(b.vat),
          gross: readNumber(b.gross),
          overdue: readBoolean(b.overdue) ?? false,
          receipts: readStrings(b.receipts),
          toDecide: num(b.to_decide),
          queryOpen: num(b.query_open),
          paid: readNumber(b.paid),
          open: readNumber(b.open),
          createdAt: readString(b.created_at) ?? '',
        },
      ];
    }),
    unbilled: readArray(row.unbilled).flatMap((item) => {
      const u = readUnbilled(item);
      const r = readRecord(item);
      if (!u || !r) return [];
      const { mentioned: _mentioned, ...rest } = u;
      return [{ ...rest, supplier: readSupplierRef(r.supplier), days: num(r.days) }];
    }),
    currency: readString(row.currency) ?? 'GBP',
    can: { edit: readBoolean(readRecord(row.can)?.edit) ?? false },
  };
}

function changesJson(changes: BillChanges): Record<string, Json> {
  const p: Record<string, Json> = {};
  if (changes.reference !== undefined) p.reference = changes.reference;
  if (changes.billDate !== undefined) p.bill_date = changes.billDate;
  if (changes.dueOn !== undefined) p.due_on = changes.dueOn;
  if (changes.net !== undefined) p.net = changes.net;
  if (changes.vat !== undefined) p.vat = changes.vat;
  if (changes.notes !== undefined) p.notes = changes.notes;
  return p;
}

export async function listSupplierBills(
  supabase: Client,
  query: { group?: SupplierBillFilter | null; supplierId?: number | null; search?: string | null; limit?: number } = {},
): Promise<SupplierBillList> {
  return call(
    supabase.rpc('supplier_bill_list', {
      p_status: query.group ?? undefined,
      p_source: query.supplierId ?? undefined,
      p_search: query.search?.trim() || undefined,
      p_limit: query.limit,
    }),
    readSupplierBillList,
  );
}

export async function getSupplierBill(supabase: Client, billId: string): Promise<SupplierBillDetail> {
  return call(supabase.rpc('supplier_bill_detail', { p_bill: billId }), readSupplierBill);
}

// Starts a bill from a supplier, with the deliveries it covers. Returns its id and number.
export async function createSupplierBill(
  supabase: Client,
  supplierId: number,
  input: BillChanges & { receiptIds?: string[] } = {},
): Promise<{ id: string; number: string }> {
  const p = changesJson(input);
  if (input.receiptIds?.length) p.receipt_ids = input.receiptIds;
  return call(supabase.rpc('create_supplier_bill', { p_supplier: supplierId, p }), (data) => {
    const row = readRecord(data);
    const id = readString(row?.document_id);
    const number = readString(row?.number);
    if (!id || !number) throw new DataError('The bill was not started.', 'P0002');
    return { id, number };
  });
}

export async function saveSupplierBill(
  supabase: Client,
  billId: string,
  changes: BillChanges,
): Promise<SupplierBillDetail> {
  return call(supabase.rpc('save_supplier_bill', { p_bill: billId, p: changesJson(changes) }), readSupplierBill);
}

export async function addSupplierBillReceipts(
  supabase: Client,
  billId: string,
  receiptIds: string[],
): Promise<SupplierBillDetail> {
  return call(supabase.rpc('add_supplier_bill_receipts', { p_bill: billId, p_receipts: receiptIds }), readSupplierBill);
}

export async function removeSupplierBillReceipt(
  supabase: Client,
  billId: string,
  receiptId: string,
): Promise<SupplierBillDetail> {
  return call(supabase.rpc('remove_supplier_bill_receipt', { p_bill: billId, p_receipt: receiptId }), readSupplierBill);
}

export async function addSupplierBillLine(
  supabase: Client,
  billId: string,
  line: NewBillLine,
): Promise<SupplierBillDetail> {
  const p: Record<string, Json> = { kind: line.kind, net: line.net };
  if (line.description) p.description = line.description;
  if (line.receiptId) p.receipt_id = line.receiptId;
  return call(supabase.rpc('add_supplier_bill_line', { p_bill: billId, p }), readSupplierBill);
}

export async function saveSupplierBillLine(
  supabase: Client,
  lineId: number,
  changes: BillLineChanges,
): Promise<SupplierBillDetail> {
  const p: Record<string, Json> = {};
  if (changes.qty !== undefined) p.qty = changes.qty;
  if (changes.unitPrice !== undefined) p.unit_price = changes.unitPrice;
  if (changes.net !== undefined) p.net = changes.net;
  if (changes.description !== undefined) p.description = changes.description;
  return call(supabase.rpc('save_supplier_bill_line', { p_line: lineId, p }), readSupplierBill);
}

export async function removeSupplierBillLine(supabase: Client, lineId: number): Promise<SupplierBillDetail> {
  return call(supabase.rpc('remove_supplier_bill_line', { p_line: lineId }), readSupplierBill);
}

export async function deleteDraftSupplierBill(supabase: Client, billId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_draft_supplier_bill', { p_bill: billId });
  if (error) throw dataError(error);
}

export type BillStep = 'record' | 'reopen';

// Records it as printed, or puts it back to draft. Returns its detail.
export async function moveSupplierBill(supabase: Client, billId: string, step: BillStep): Promise<SupplierBillDetail> {
  return call(
    supabase.rpc(step === 'record' ? 'record_supplier_bill' : 'reopen_supplier_bill', { p_bill: billId }),
    readSupplierBill,
  );
}

// A recorded bill's difference: accepted, queried, or null to undo the decision.
export async function decideSupplierBillLine(
  supabase: Client,
  lineId: number,
  decision: BillDecisionKind | null,
  note?: string | null,
): Promise<SupplierBillDetail> {
  const p: Record<string, Json> = { decision };
  if (note) p.note = note;
  return call(supabase.rpc('decide_supplier_bill_line', { p_line: lineId, p }), readSupplierBill);
}

// A supplier's payment terms for bills, or null to clear them.
export async function saveSupplierBillTerms(
  supabase: Client,
  supplierId: number,
  terms: BillTerms | null,
): Promise<BillTerms | null> {
  return call(supabase.rpc('save_supplier_bill_terms', { p_source: supplierId, p: (terms as Json) ?? null }), (data) =>
    readBillTerms(data),
  );
}
