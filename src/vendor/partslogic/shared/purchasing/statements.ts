import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { DataError, dataError } from '../core/errors';
import { readArray, readBoolean, readNumber, readRecord, readString, type JsonRecord } from '../core/read';

// Checking a supplier's statement (docs/SUPPLIER_BILLS.md, step 17c): their closing balance against our bills, credit
// notes and payments up to its date; ours ticked, theirs typed and chased. Every rule lives in SQL
// (public.*statement*); this file shapes what is sent and read.

export type StatementFigures = {
  theirs: number;
  ours: number;
  ticked: number;
  // On ours, not ticked (a payment that hadn't reached them).
  oursOnly: number;
  oursOnlyCount: number;
  // Only on theirs, not yet counted as ours.
  theirsOnly: number;
  toChase: number;
  fromBefore: number;
  unexplained: number;
};

export const THEIR_ITEM_KINDS = ['invoice', 'credit', 'payment', 'other'] as const;
export type TheirItemKind = (typeof THEIR_ITEM_KINDS)[number];

export function isTheirItemKind(value: unknown): value is TheirItemKind {
  return typeof value === 'string' && (THEIR_ITEM_KINDS as readonly string[]).includes(value);
}

export type OurStatementItem = {
  kind: 'bill' | 'credit' | 'payment';
  documentId: string;
  number: string;
  reference: string | null;
  date: string;
  // Signed: a bill adds to what we owe, a credit note or payment takes away.
  amount: number;
  ticked: boolean;
};

export type TheirStatementItem = {
  id: number;
  date: string;
  reference: string | null;
  kind: TheirItemKind;
  amount: number;
  status: 'to_chase' | 'matched' | 'cleared';
  clearedReason: string | null;
  matched: { id: string; number: string; docType: string; reference: string | null } | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
};

export type SupplierStatementDetail = {
  id: number;
  statementDate: string;
  closingBalance: number;
  fromBefore: number;
  notes: string | null;
  createdAt: string;
  createdBy: string;
  supplier: { id: number; name: string; accountNumber: string | null };
  figures: StatementFigures;
  ours: OurStatementItem[];
  theirs: TheirStatementItem[];
  // Their recorded bills and credit notes an item only on theirs can be matched to.
  candidates: {
    id: string;
    kind: 'bill' | 'credit';
    number: string;
    reference: string | null;
    date: string;
    amount: number;
  }[];
  currency: string;
  can: { edit: boolean };
};

export type SupplierStatementRow = {
  id: number;
  statementDate: string;
  closingBalance: number;
  supplier: { id: number; name: string };
  figures: StatementFigures;
};

export type StatementChanges = {
  statementDate?: string;
  closingBalance?: number;
  fromBefore?: number;
  notes?: string | null;
};

const num = (value: Json | undefined) => readNumber(value) ?? 0;

export function readStatementFigures(value: Json | undefined): StatementFigures {
  const row: JsonRecord = readRecord(value) ?? {};
  return {
    theirs: num(row.theirs),
    ours: num(row.ours),
    ticked: num(row.ticked),
    oursOnly: num(row.ours_only),
    oursOnlyCount: num(row.ours_only_count),
    theirsOnly: num(row.theirs_only),
    toChase: num(row.to_chase),
    fromBefore: num(row.from_before),
    unexplained: num(row.unexplained),
  };
}

export function readSupplierStatement(value: Json): SupplierStatementDetail {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  if (!row || id == null) throw new DataError('The statement could not be read.', 'P0002');
  const supplier = readRecord(row.supplier);
  return {
    id,
    statementDate: readString(row.statement_date) ?? '',
    closingBalance: num(row.closing_balance),
    fromBefore: num(row.from_before),
    notes: readString(row.notes),
    createdAt: readString(row.created_at) ?? '',
    createdBy: readString(row.created_by) ?? 'Someone',
    supplier: {
      id: num(supplier?.id),
      name: readString(supplier?.name) ?? '',
      accountNumber: readString(supplier?.account_number),
    },
    figures: readStatementFigures(row.figures),
    ours: readArray(row.ours).flatMap((item) => {
      const o = readRecord(item);
      const documentId = readString(o?.document_id);
      if (!o || !documentId || (o.kind !== 'bill' && o.kind !== 'credit' && o.kind !== 'payment')) return [];
      return [
        {
          kind: o.kind,
          documentId,
          number: readString(o.number) ?? '',
          reference: readString(o.reference),
          date: readString(o.date) ?? '',
          amount: num(o.amount),
          ticked: readBoolean(o.ticked) ?? false,
        },
      ];
    }),
    theirs: readArray(row.theirs).flatMap((item) => {
      const t = readRecord(item);
      const tid = readNumber(t?.id);
      if (!t || tid == null || !isTheirItemKind(t.kind)) return [];
      const status = t.status === 'matched' || t.status === 'cleared' ? t.status : 'to_chase';
      const matched = readRecord(t.matched);
      const matchedId = readString(matched?.id);
      return [
        {
          id: tid,
          date: readString(t.date) ?? '',
          reference: readString(t.reference),
          kind: t.kind,
          amount: num(t.amount),
          status,
          clearedReason: readString(t.cleared_reason),
          matched:
            matched && matchedId
              ? {
                  id: matchedId,
                  number: readString(matched.number) ?? '',
                  docType: readString(matched.doc_type) ?? '',
                  reference: readString(matched.reference),
                }
              : null,
          resolvedAt: readString(t.resolved_at),
          resolvedBy: readString(t.resolved_by),
        },
      ];
    }),
    candidates: readArray(row.candidates).flatMap((item) => {
      const c = readRecord(item);
      const cid = readString(c?.id);
      if (!c || !cid || (c.kind !== 'bill' && c.kind !== 'credit')) return [];
      return [
        {
          id: cid,
          kind: c.kind,
          number: readString(c.number) ?? '',
          reference: readString(c.reference),
          date: readString(c.date) ?? '',
          amount: num(c.amount),
        },
      ];
    }),
    currency: readString(row.currency) ?? 'GBP',
    can: { edit: readBoolean(readRecord(row.can)?.edit) ?? false },
  };
}

export async function listSupplierStatements(
  supabase: Client,
  supplierId?: number | null,
): Promise<{ statements: SupplierStatementRow[]; toChase: number; currency: string; canEdit: boolean }> {
  return call(supabase.rpc('supplier_statement_list', { p_source: supplierId ?? undefined }), (data) => {
    const row = readRecord(data);
    return {
      statements: readArray(row?.statements).flatMap((item) => {
        const s = readRecord(item);
        const id = readNumber(s?.id);
        if (!s || id == null) return [];
        const supplier = readRecord(s.supplier);
        return [
          {
            id,
            statementDate: readString(s.statement_date) ?? '',
            closingBalance: num(s.closing_balance),
            supplier: { id: num(supplier?.id), name: readString(supplier?.name) ?? '' },
            figures: readStatementFigures(s.figures),
          },
        ];
      }),
      toChase: num(row?.to_chase),
      currency: readString(row?.currency) ?? 'GBP',
      canEdit: readBoolean(readRecord(row?.can)?.edit) ?? false,
    };
  });
}

export async function getSupplierStatement(supabase: Client, statementId: number): Promise<SupplierStatementDetail> {
  return call(supabase.rpc('supplier_statement_detail', { p_statement: statementId }), readSupplierStatement);
}

function changesJson(changes: StatementChanges): Record<string, Json> {
  const p: Record<string, Json> = {};
  if (changes.statementDate !== undefined) p.statement_date = changes.statementDate;
  if (changes.closingBalance !== undefined) p.closing_balance = changes.closingBalance;
  if (changes.fromBefore !== undefined) p.from_before = changes.fromBefore;
  if (changes.notes !== undefined) p.notes = changes.notes;
  return p;
}

// Starts checking a statement. Returns its id.
export async function createSupplierStatement(
  supabase: Client,
  supplierId: number,
  statement: StatementChanges & { statementDate: string; closingBalance: number },
): Promise<number> {
  return call(
    supabase.rpc('create_supplier_statement', { p_source: supplierId, p: changesJson(statement) }),
    (data) => {
      const id = readNumber(data);
      if (id == null) throw new DataError('The statement was not started.', 'P0002');
      return id;
    },
  );
}

export async function saveSupplierStatement(supabase: Client, statementId: number, changes: StatementChanges) {
  return call(
    supabase.rpc('save_supplier_statement', { p_statement: statementId, p: changesJson(changes) }),
    readSupplierStatement,
  );
}

export async function tickStatementItems(supabase: Client, statementId: number, documentIds: string[], on: boolean) {
  return call(
    supabase.rpc('tick_statement_items', { p_statement: statementId, p_documents: documentIds, p_on: on }),
    readSupplierStatement,
  );
}

export async function addStatementItem(
  supabase: Client,
  statementId: number,
  item: { date: string; reference?: string | null; kind: TheirItemKind; amount: number },
) {
  const p: Record<string, Json> = { date: item.date, kind: item.kind, amount: item.amount };
  if (item.reference) p.reference = item.reference;
  return call(supabase.rpc('add_statement_item', { p_statement: statementId, p }), readSupplierStatement);
}

// Matches an item only on theirs to a document we entered, clears it with a reason, or chases it again.
export async function resolveStatementItem(
  supabase: Client,
  itemId: number,
  resolution: { documentId: string } | { clearedReason: string } | { reopen: true },
) {
  const p: Record<string, Json> =
    'documentId' in resolution
      ? { document_id: resolution.documentId }
      : 'clearedReason' in resolution
        ? { cleared_reason: resolution.clearedReason }
        : { reopen: true };
  return call(supabase.rpc('resolve_statement_item', { p_item: itemId, p }), readSupplierStatement);
}

export async function removeStatementItem(supabase: Client, itemId: number) {
  return call(supabase.rpc('remove_statement_item', { p_item: itemId }), readSupplierStatement);
}

export async function deleteSupplierStatement(supabase: Client, statementId: number): Promise<void> {
  const { error } = await supabase.rpc('delete_supplier_statement', { p_statement: statementId });
  if (error) throw dataError(error);
}
