import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { dataError } from '../core/errors';
import { readArray, readNumber, readRecord, readString, readStrings, type JsonRecord } from '../core/read';

// Merging suppliers (step 2f): a supplier record added twice becomes one. An admin picks the record to keep and the
// duplicate to merge into it; everything the duplicate holds moves, and the duplicate is archived. There is no undo.
// The database decides what refuses a merge and counts what moves (purchasing.merge_blocker, merge_counts).

export type MergeParty = { supplierId: number; name: string };

// A merge that has happened. A long price list moves in the background: left counts the prices, codes and cost lots
// still to move, and state is 'moving' until none are.
export type SupplierMerge = {
  id: number;
  from: MergeParty;
  into: MergeParty;
  state: 'moving' | 'done';
  left: number;
  mergedAt: string;
  mergedBy: string | null;
  finishedAt: string | null;
  moved: MergeMoves;
  // The details the kept supplier took because it had none, as the screens' labels.
  fills: string[];
};

// What a merge moves, by kind. In a preview these are what would move; on a merge, what did.
export type MergeMoves = {
  orders: number;
  openOrders: number;
  deliveries: number;
  bills: number;
  creditNotes: number;
  payments: number;
  returns: number;
  statements: number;
  cores: number;
  priceSheets: number;
  // Current prices the duplicate lists, and how many of those parts the kept supplier lists too (its price stays
  // current and the duplicate's becomes history).
  prices: number;
  pricesBoth: number;
  codes: number;
  preferredParts: number;
  contacts: number;
  addresses: number;
};

export type SupplierMergePreview = {
  from: MergeParty & { status: string };
  into: MergeParty & { status: string };
  // Why it can't be merged now, in the database's words, or null when it can.
  blocker: string | null;
  moves: MergeMoves;
  fills: string[];
};

function readParty(value: Json | undefined): MergeParty | null {
  const party = readRecord(value);
  const supplierId = readNumber(party?.id);
  const name = readString(party?.name);
  return supplierId == null || !name ? null : { supplierId, name };
}

function readMoves(value: Json | undefined): MergeMoves {
  const moves: JsonRecord = readRecord(value) ?? {};
  const count = (key: string) => readNumber(moves[key]) ?? 0;
  return {
    orders: count('orders'),
    openOrders: count('open_orders'),
    deliveries: count('deliveries'),
    bills: count('bills'),
    creditNotes: count('credit_notes'),
    payments: count('payments'),
    returns: count('returns'),
    statements: count('statements'),
    cores: count('cores'),
    priceSheets: count('price_sheets'),
    // a finished merge counts what moved and what ended; a preview counts what is current
    prices: readNumber(moves.prices) ?? count('prices_moved'),
    pricesBoth: readNumber(moves.prices_both) ?? count('prices_ended'),
    codes: readNumber(moves.codes) ?? count('codes_moved'),
    preferredParts: count('preferred_parts'),
    contacts: count('contacts'),
    addresses: count('addresses'),
  };
}

export function readSupplierMerge(value: Json | undefined): SupplierMerge | null {
  const merge = readRecord(value);
  const id = readNumber(merge?.id);
  const from = readParty(merge?.from);
  const into = readParty(merge?.into);
  const mergedAt = readString(merge?.merged_at);
  if (!merge || id == null || !from || !into || !mergedAt) return null;
  return {
    id,
    from,
    into,
    state: merge.state === 'done' ? 'done' : 'moving',
    left: readNumber(merge.left) ?? 0,
    mergedAt,
    mergedBy: readString(merge.merged_by),
    finishedAt: readString(merge.finished_at),
    moved: readMoves(merge.moved),
    fills: readStrings(readRecord(merge.moved)?.fills),
  };
}

export function readSupplierMerges(value: Json | undefined): SupplierMerge[] {
  return readArray(value).flatMap((item) => readSupplierMerge(item) ?? []);
}

export function readSupplierMergePreview(value: Json | undefined): SupplierMergePreview | null {
  const preview = readRecord(value);
  const from = readParty(preview?.from);
  const into = readParty(preview?.into);
  if (!preview || !from || !into) return null;
  return {
    from: { ...from, status: readString(readRecord(preview.from)?.status) ?? 'active' },
    into: { ...into, status: readString(readRecord(preview.into)?.status) ?? 'active' },
    blocker: readString(preview.blocker),
    moves: readMoves(preview.moves),
    fills: readStrings(preview.fills),
  };
}

// What moves with the duplicate, as the lines the confirmation lists: only the kinds there are any of, in the order
// someone checks them (money first, then the price list, then the record itself).
export function mergeMoveLines(moves: MergeMoves): { label: string; count: number }[] {
  const lines: [string, number][] = [
    ['Purchase orders', moves.orders],
    ['Deliveries', moves.deliveries],
    ['Supplier invoices', moves.bills],
    ['Credit notes', moves.creditNotes],
    ['Payments', moves.payments],
    ['Returns', moves.returns],
    ['Statements', moves.statements],
    ['Exchange cores', moves.cores],
    ['Price sheets', moves.priceSheets],
    ['Prices', moves.prices],
    ['Supplier codes', moves.codes],
    ['Preferred parts', moves.preferredParts],
    ['Contacts', moves.contacts],
    ['Addresses', moves.addresses],
  ];
  return lines.filter(([, count]) => count > 0).map(([label, count]) => ({ label, count }));
}

// What merging one supplier into another would do (admins): what would move, and why it can't be done if it can't.
export async function previewSupplierMerge(supabase: Client, fromId: number, intoId: number): Promise<SupplierMergePreview> {
  const { data, error } = await supabase.rpc('supplier_merge_preview', { p_from: fromId, p_into: intoId });
  if (error) throw dataError(error);
  const preview = readSupplierMergePreview(data);
  if (!preview) throw new Error('The merge could not be previewed.');
  return preview;
}

// Merges the duplicate into the supplier to keep and archives the duplicate (admins). There is no undo.
export async function mergeSuppliers(supabase: Client, fromId: number, intoId: number): Promise<SupplierMerge> {
  const { data, error } = await supabase.rpc('merge_suppliers', { p_from: fromId, p_into: intoId });
  if (error) throw dataError(error);
  const merge = readSupplierMerge(data);
  if (!merge) throw new Error('The suppliers were merged, but the result could not be read back.');
  return merge;
}
