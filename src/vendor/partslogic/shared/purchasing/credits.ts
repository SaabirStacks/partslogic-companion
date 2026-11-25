import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { DataError, dataError } from '../core/errors';
import { readArray, readBoolean, readNumber, readRecord, readString, readStrings } from '../core/read';
import { call, readDocumentEvents, type DocumentEvent } from './documents';
import { isReturnReason, type ReturnReason } from './return-terms';
import { isSupplierStatus, type SupplierStatus } from './suppliers';

// Supplier credit notes (docs/RETURNS_AND_CORES.md; purchasing step 15b). A draft is entered and set against the
// supplier's sent return lines (or other lines, for anything not returned); recording it needs their number, the
// date, the net and VAT as printed, and lines adding up to the net. Every rule lives in SQL (public.*supplier_credit*);
// this file shapes what is sent and read.

export const SUPPLIER_CREDIT_STATUSES = ['draft', 'recorded'] as const;
export type SupplierCreditStatus = (typeof SUPPLIER_CREDIT_STATUSES)[number];
// A credit note's badge word (owner, 23 November 2026): Draft, then To review while the accounts need to look (as a
// bill), then Recorded. One badge, never two side by side. The state comes from STATUS_WORD_STATES.
export function creditBadgeWord(status: SupplierCreditStatus, needsReview: boolean): 'Draft' | 'To review' | 'Recorded' {
  if (status === 'draft') return 'Draft';
  return needsReview ? 'To review' : 'Recorded';
}

export function isSupplierCreditStatus(value: unknown): value is SupplierCreditStatus {
  return typeof value === 'string' && (SUPPLIER_CREDIT_STATUSES as readonly string[]).includes(value);
}

// more_than_waiting: more units than the return line still has open. more_than_expected / less_than_expected: the
// amount against what those units should be credited.
export type CreditLineWarning = 'more_than_waiting' | 'more_than_expected' | 'less_than_expected';
// lines_dont_add_up: the lines' total isn't the net. vat_differs: the VAT isn't near our rate on the net.
// other_lines: lines not for a return, flagged for the accounts. duplicate_reference: their number is already recorded.
export type CreditWarning =
  | 'lines_dont_add_up'
  | 'vat_differs'
  | 'more_than_expected'
  | 'more_than_waiting'
  | 'other_lines'
  | 'duplicate_reference';

const LINE_WARNINGS: readonly CreditLineWarning[] = ['more_than_waiting', 'more_than_expected', 'less_than_expected'];
const CREDIT_WARNINGS: readonly CreditWarning[] = [
  'lines_dont_add_up',
  'vat_differs',
  'more_than_expected',
  'more_than_waiting',
  'other_lines',
  'duplicate_reference',
];

export type CreditPart = { partId: number; brand: string; number: string; description: string | null };

// The return line a credit line is set against.
export type CreditReturnLine = CreditPart & {
  id: number;
  lineNo: number;
  returnId: string;
  returnNumber: string;
  // Their return number.
  theirReturn: string | null;
  reason: ReturnReason;
  qty: number;
  unitCost: number | null;
  handlingPct: number;
  unitsOpen: number;
};

export type SupplierCreditLine = {
  id: number;
  lineNo: number;
  kind: 'return' | 'other';
  // Units credited (lines for a return; 0 tops up a short credit).
  qty: number | null;
  amount: number;
  description: string | null;
  // What those units should be credited, given other recorded credit notes. Null with no price, or for other lines.
  expected: number | null;
  returnLine: CreditReturnLine | null;
  // The queried bill line an other line credits (step 17).
  billLine: { id: number; billId: string; billNumber: string; theirBill: string | null; queryOpen: number } | null;
  warnings: CreditLineWarning[];
};

// A sent return line still waiting for credit, offered on a draft.
export type OpenReturnLine = CreditPart & {
  returnLineId: number;
  lineNo: number;
  returnId: string;
  returnNumber: string;
  theirReturn: string | null;
  sentAt: string | null;
  daysWaiting: number | null;
  reason: ReturnReason;
  qty: number;
  unitsOpen: number;
  short: number;
  unitCost: number | null;
  handlingPct: number;
  // What they should credit for the units open (and any short). Null with no price.
  amount: number | null;
  // Its return's number or their return number appears in this note's number or notes.
  mentioned: boolean;
};

export type SupplierCreditDetail = {
  id: string;
  number: string;
  status: SupplierCreditStatus;
  // Their credit note number.
  reference: string | null;
  notes: string | null;
  creditDate: string | null;
  // As printed on their credit note.
  net: number | null;
  vat: number | null;
  gross: number | null;
  needsReview: boolean;
  createdAt: string;
  createdBy: string;
  recordedAt: string | null;
  recordedBy: string | null;
  supplier: { id: number; name: string; status: SupplierStatus; accountNumber: string | null };
  lines: SupplierCreditLine[];
  totals: {
    lines: number;
    linesNet: number;
    // The net less what the lines add up to. Null until the net is typed.
    difference: number | null;
    vatRate: number;
    // VAT at our rate on the net (or the lines, before the net is typed).
    vatExpected: number;
    currency: string;
  };
  warnings: CreditWarning[];
  // On a draft only.
  openLines: OpenReturnLine[];
  // Recorded only (step 17b): how much has been used paying their bills, and what's still available.
  use: {
    used: number;
    available: number;
    payments: { id: string; number: string; paidOn: string; amount: number }[];
  } | null;
  history: DocumentEvent[];
  can: { edit: boolean; record: boolean; reopen: boolean; delete: boolean; editNotes: boolean };
};

export type SupplierCreditRow = {
  id: string;
  number: string;
  status: SupplierCreditStatus;
  reference: string | null;
  needsReview: boolean;
  supplierId: number;
  supplier: string;
  creditDate: string | null;
  net: number | null;
  vat: number | null;
  gross: number | null;
  linesNet: number;
  // The returns it credits, by number.
  returns: string[];
  createdAt: string;
  recordedAt: string | null;
};

export type SupplierCreditList = {
  counts: Record<SupplierCreditStatus, number>;
  currency: string;
  credits: SupplierCreditRow[];
};

export type SupplierCreditQuery = {
  status?: SupplierCreditStatus;
  supplierId?: number;
  search?: string;
  limit?: number;
};

// A line against a return line (units default to those open, the amount to what they should credit), or another line.
function readCreditUse(value: Json | undefined): SupplierCreditDetail['use'] {
  const row = readRecord(value);
  if (!row) return null;
  return {
    used: readNumber(row.used) ?? 0,
    available: readNumber(row.available) ?? 0,
    payments: readArray(row.payments).flatMap((item) => {
      const p = readRecord(item);
      const id = readString(p?.id);
      if (!p || !id) return [];
      return [
        {
          id,
          number: readString(p.number) ?? '',
          paidOn: readString(p.paid_on) ?? '',
          amount: readNumber(p.amount) ?? 0,
        },
      ];
    }),
  };
}

function readBillLineRef(value: Json | undefined): SupplierCreditLine['billLine'] {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  const billId = readString(row?.bill_id);
  if (!row || id == null || !billId) return null;
  return {
    id,
    billId,
    billNumber: readString(row.bill_number) ?? '',
    theirBill: readString(row.their_bill),
    queryOpen: readNumber(row.query_open) ?? 0,
  };
}

export type NewCreditLine =
  | { returnLineId: number; qty?: number; amount?: number }
  | { billLineId: number; amount?: number }
  | { description: string; amount: number };

export type CreditLineChanges = { qty?: number; amount?: number; description?: string | null };

export type CreditChanges = {
  reference?: string | null;
  // yyyy-mm-dd.
  creditDate?: string | null;
  net?: number | null;
  vat?: number | null;
  notes?: string | null;
};

// record: recorded at once (the quick credit on a return): a net not given is the lines' total, VAT not given is at
// our rate on it.
export type NewSupplierCredit = CreditChanges & { lines?: NewCreditLine[]; record?: boolean };

export type CreditStarted = { id: string; number: string; status: SupplierCreditStatus };

export type CreditStep = 'record' | 'reopen';

function readPart(row: Record<string, Json | undefined>): CreditPart {
  return {
    partId: readNumber(row.part_id) ?? 0,
    brand: readString(row.brand) ?? '',
    number: readString(row.number) ?? '',
    description: readString(row.description),
  };
}

function readReason(value: Json | undefined): ReturnReason | null {
  const reason = readString(value);
  return isReturnReason(reason) ? reason : null;
}

function readReturnLine(value: Json | undefined): CreditReturnLine | null {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  const returnId = readString(row?.return_id);
  const reason = readReason(row?.reason);
  if (!row || id == null || !returnId || !reason) return null;
  return {
    ...readPart(row),
    id,
    lineNo: readNumber(row.line_no) ?? 0,
    returnId,
    returnNumber: readString(row.return_number) ?? '',
    theirReturn: readString(row.their_return),
    reason,
    qty: readNumber(row.qty) ?? 0,
    unitCost: readNumber(row.unit_cost),
    handlingPct: readNumber(row.handling_pct) ?? 0,
    unitsOpen: readNumber(row.units_open) ?? 0,
  };
}

function readLine(value: Json): SupplierCreditLine | null {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  if (!row || id == null) return null;
  return {
    id,
    lineNo: readNumber(row.line_no) ?? 0,
    kind: readString(row.kind) === 'other' ? 'other' : 'return',
    qty: readNumber(row.qty),
    amount: readNumber(row.amount) ?? 0,
    description: readString(row.description),
    expected: readNumber(row.expected),
    returnLine: readReturnLine(row.return_line),
    billLine: readBillLineRef(row.bill_line),
    warnings: readStrings(row.warnings).filter((item): item is CreditLineWarning =>
      (LINE_WARNINGS as readonly string[]).includes(item),
    ),
  };
}

function readOpenLine(value: Json): OpenReturnLine | null {
  const row = readRecord(value);
  const returnLineId = readNumber(row?.return_line_id);
  const returnId = readString(row?.return_id);
  const reason = readReason(row?.reason);
  if (!row || returnLineId == null || !returnId || !reason) return null;
  return {
    ...readPart(row),
    returnLineId,
    lineNo: readNumber(row.line_no) ?? 0,
    returnId,
    returnNumber: readString(row.return_number) ?? '',
    theirReturn: readString(row.their_return),
    sentAt: readString(row.sent_at),
    daysWaiting: readNumber(row.days_waiting),
    reason,
    qty: readNumber(row.qty) ?? 0,
    unitsOpen: readNumber(row.units_open) ?? 0,
    short: readNumber(row.short) ?? 0,
    unitCost: readNumber(row.unit_cost),
    handlingPct: readNumber(row.handling_pct) ?? 0,
    amount: readNumber(row.amount),
    mentioned: readBoolean(row.mentioned) ?? false,
  };
}

export function readSupplierCredit(value: Json | null | undefined): SupplierCreditDetail {
  const row = readRecord(value ?? undefined);
  const id = readString(row?.document_id);
  const number = readString(row?.number);
  const status = readString(row?.status);
  const supplier = readRecord(row?.supplier);
  const supplierId = readNumber(supplier?.id);
  if (!row || !id || !number || !isSupplierCreditStatus(status) || !supplier || supplierId == null) {
    throw new DataError('The credit note could not be read.', 'P0002');
  }
  const supplierStatus = readString(supplier.status);
  const totals = readRecord(row.totals);
  const can = readRecord(row.can);
  return {
    id,
    number,
    status,
    reference: readString(row.reference),
    notes: readString(row.notes),
    creditDate: readString(row.credit_date),
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
      name: readString(supplier.name) ?? '',
      status: isSupplierStatus(supplierStatus) ? supplierStatus : 'active',
      accountNumber: readString(supplier.account_number),
    },
    lines: readArray(row.lines).flatMap((item) => readLine(item) ?? []),
    totals: {
      lines: readNumber(totals?.lines) ?? 0,
      linesNet: readNumber(totals?.lines_net) ?? 0,
      difference: readNumber(totals?.difference),
      vatRate: readNumber(totals?.vat_rate) ?? 0,
      vatExpected: readNumber(totals?.vat_expected) ?? 0,
      currency: readString(totals?.currency) ?? 'GBP',
    },
    warnings: readStrings(row.warnings).filter((item): item is CreditWarning =>
      (CREDIT_WARNINGS as readonly string[]).includes(item),
    ),
    openLines: readArray(row.open_lines).flatMap((item) => readOpenLine(item) ?? []),
    use: readCreditUse(row.use),
    history: readDocumentEvents(row.history),
    can: {
      edit: readBoolean(can?.edit) ?? false,
      record: readBoolean(can?.record) ?? false,
      reopen: readBoolean(can?.reopen) ?? false,
      delete: readBoolean(can?.delete) ?? false,
      editNotes: readBoolean(can?.edit_notes) ?? false,
    },
  };
}

export function readSupplierCreditList(value: Json): SupplierCreditList {
  const row = readRecord(value);
  const counts = readRecord(row?.counts);
  return {
    counts: Object.fromEntries(
      SUPPLIER_CREDIT_STATUSES.map((status) => [status, readNumber(counts?.[status]) ?? 0]),
    ) as Record<SupplierCreditStatus, number>,
    currency: readString(row?.currency) ?? 'GBP',
    credits: readArray(row?.credits).flatMap((item) => {
      const credit = readRecord(item);
      const id = readString(credit?.document_id);
      const number = readString(credit?.number);
      const status = readString(credit?.status);
      const supplier = readRecord(credit?.supplier);
      const supplierId = readNumber(supplier?.id);
      if (!credit || !id || !number || !isSupplierCreditStatus(status) || !supplier || supplierId == null) return [];
      return [
        {
          id,
          number,
          status,
          reference: readString(credit.reference),
          needsReview: readBoolean(credit.needs_review) ?? false,
          supplierId,
          supplier: readString(supplier.name) ?? '',
          creditDate: readString(credit.credit_date),
          net: readNumber(credit.net),
          vat: readNumber(credit.vat),
          gross: readNumber(credit.gross),
          linesNet: readNumber(credit.lines_net) ?? 0,
          returns: readStrings(credit.returns),
          createdAt: readString(credit.created_at) ?? '',
          recordedAt: readString(credit.recorded_at),
        },
      ];
    }),
  };
}

function lineJson(line: NewCreditLine): Record<string, Json> {
  if ('returnLineId' in line) {
    const out: Record<string, Json> = { return_line_id: line.returnLineId };
    if (line.qty != null) out.qty = line.qty;
    if (line.amount != null) out.amount = line.amount;
    return out;
  }
  if ('billLineId' in line) {
    const out: Record<string, Json> = { bill_line_id: line.billLineId };
    if (line.amount != null) out.amount = line.amount;
    return out;
  }
  return { description: line.description, amount: line.amount };
}

function changesJson(changes: CreditChanges): Record<string, Json> {
  const p: Record<string, Json> = {};
  if (changes.reference !== undefined) p.reference = changes.reference;
  if (changes.creditDate !== undefined) p.credit_date = changes.creditDate;
  if (changes.net !== undefined) p.net = changes.net;
  if (changes.vat !== undefined) p.vat = changes.vat;
  if (changes.notes !== undefined) p.notes = changes.notes;
  return p;
}

export async function listSupplierCredits(
  supabase: Client,
  query: SupplierCreditQuery = {},
): Promise<SupplierCreditList> {
  return call(
    supabase.rpc('supplier_credit_list', {
      p_status: query.status,
      p_source: query.supplierId,
      p_search: query.search?.trim() || undefined,
      p_limit: query.limit,
    }),
    readSupplierCreditList,
  );
}

export async function getSupplierCredit(supabase: Client, creditId: string): Promise<SupplierCreditDetail> {
  return call(supabase.rpc('supplier_credit_detail', { p_credit: creditId }), readSupplierCredit);
}

// Starts a credit note from a supplier; with record, records it at once.
export async function createSupplierCredit(
  supabase: Client,
  supplierId: number,
  input: NewSupplierCredit = {},
): Promise<CreditStarted> {
  const p = changesJson(input);
  if (input.lines) p.lines = input.lines.map(lineJson);
  if (input.record) p.record = true;
  return call(supabase.rpc('create_supplier_credit', { p_supplier: supplierId, p }), (data) => {
    const row = readRecord(data);
    const id = readString(row?.document_id);
    const number = readString(row?.number);
    const status = readString(row?.status);
    if (!row || !id || !number || !isSupplierCreditStatus(status)) {
      throw new DataError('The credit note was not started.', 'P0002');
    }
    return { id, number, status };
  });
}

export async function saveSupplierCredit(
  supabase: Client,
  creditId: string,
  changes: CreditChanges,
): Promise<SupplierCreditDetail> {
  return call(
    supabase.rpc('save_supplier_credit', { p_credit: creditId, p: changesJson(changes) }),
    readSupplierCredit,
  );
}

export async function addSupplierCreditLines(
  supabase: Client,
  creditId: string,
  lines: NewCreditLine[],
): Promise<SupplierCreditDetail> {
  return call(
    supabase.rpc('add_supplier_credit_lines', { p_credit: creditId, p_lines: lines.map(lineJson) }),
    readSupplierCredit,
  );
}

export async function saveSupplierCreditLine(
  supabase: Client,
  lineId: number,
  changes: CreditLineChanges,
): Promise<SupplierCreditDetail> {
  const p: Record<string, Json> = {};
  if (changes.qty !== undefined) p.qty = changes.qty;
  if (changes.amount !== undefined) p.amount = changes.amount;
  if (changes.description !== undefined) p.description = changes.description;
  return call(supabase.rpc('save_supplier_credit_line', { p_line: lineId, p }), readSupplierCredit);
}

export async function removeSupplierCreditLine(supabase: Client, lineId: number): Promise<SupplierCreditDetail> {
  return call(supabase.rpc('remove_supplier_credit_line', { p_line: lineId }), readSupplierCredit);
}

export async function deleteDraftSupplierCredit(supabase: Client, creditId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_draft_supplier_credit', { p_credit: creditId });
  if (error) throw dataError(error);
}

const STEP_FUNCTIONS = {
  record: 'record_supplier_credit',
  reopen: 'reopen_supplier_credit',
} as const satisfies Record<CreditStep, string>;

// Records it, or puts it back to draft. Returns its detail.
export async function moveSupplierCredit(
  supabase: Client,
  creditId: string,
  step: CreditStep,
): Promise<SupplierCreditDetail> {
  return call(supabase.rpc(STEP_FUNCTIONS[step], { p_credit: creditId }), readSupplierCredit);
}
