import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@partslogic/db-types';

import { DataError, dataError } from './errors';
import { readArray, readBoolean, readNumber, readRecord, readString, type JsonRecord } from './read';

type Client = SupabaseClient<Database>;

// The floor doors the companion app and the back office call: scanning, bins, receipts, bin counts, quick
// add, the offline index, review and reversal. Every write is idempotent on an id the device makes, so a
// replayed queue item is success, not an error (see packages/shared/src/bin-session.ts for the queue).

export type FloorDocumentKind = 'goods_receipt' | 'bin_count';

export type ScanHit =
  | { type: 'bin'; binId: number; bin: string; location: string }
  | { type: 'part'; partId: number; brand: string; number: string }
  | { type: 'unknown'; code: string };

// One code in the offline index. Entries are in resolve_scan's order: bin, label, GTIN, SKU, part number,
// supplier code. "ambiguous" means the server would not pick one part for it either.
export type ScanIndexKind = 'bin' | 'label' | 'gtin' | 'sku' | 'number' | 'supplier_code' | 'ambiguous';
export type ScanIndexEntry = {
  kind: ScanIndexKind;
  partId: number | null;
  binId: number | null;
  label: string | null;
  locationCode: string | null;
};
export type ScanIndexRow = { codeKey: string; entries: ScanIndexEntry[] };

// Why a document needs review. Receipts: lines that came after it was closed, no working location, a line of
// more than 50, an undo that was refused. Counts: the bin changed while it was counted, more than 50 units
// found, scans voided after the count.
export type FloorReviewReason =
  | 'late_lines'
  | 'no_location'
  | 'large_quantity'
  | 'refused_undo'
  | 'partial'
  | 'large_found'
  | 'voided_scans';

export type FloorActivityRow = {
  id: string;
  kind: FloorDocumentKind;
  number: string;
  status: string;
  needsReview: boolean;
  partial: boolean;
  createdAt: string;
  createdBy: string | null;
  by: string | null;
  locationId: number | null;
  place: string | null;
  lines: number;
  unresolved: number;
  // receipts: units received, net of undos
  units: number;
  // counts: units drawn from the pool onto the shelf, sent back to UNBINNED, and found
  putAway: number;
  returned: number;
  found: number;
  reversedBy: string | null;
  continues: string | null;
  reasons: FloorReviewReason[];
};

export type FloorLine = {
  id: number;
  code: string | null;
  partId: number | null;
  brand: string | null;
  number: string | null;
  qty: number;
  status: 'counted' | 'unresolved' | 'void';
  at: string;
};

// A bin count's effect on one part: what the bin held when the count opened, what was counted, and the
// change the count made to the bin.
export type FloorChange = {
  partId: number;
  brand: string;
  number: string;
  expected: number;
  counted: number;
  change: number;
};

export type FloorDocument = FloorActivityRow & { items: FloorLine[]; changes: FloorChange[] };

export type PendingPutAway = {
  binId: number;
  place: string;
  locationId: number | null;
  parts: number;
  units: number;
};

export type UnresolvedCode = {
  code: string;
  qty: number;
  lines: number;
  receipts: number;
  counts: number;
  lastSeen: string;
  // receipt numbers and counted bins it was scanned in (up to five)
  sources: string[];
};

export type UnlocatedLine = {
  partId: number;
  brand: string;
  number: string;
  qty: number;
  binId: number;
  place: string;
};

export type UnlocatedSummary = { parts: number; qty: number };

export type ReceiptLineResult = {
  clientLineId: string;
  outcome: 'booked' | 'unresolved' | 'void' | 'duplicate' | 'skipped' | 'refused';
  reason: string | null;
  partId: number | null;
  qty: number | null;
};

export type ReceiptResult = {
  documentId: string;
  number: string;
  status: string;
  continuation: { documentId: string; number: string } | null;
  recorded: number;
  unresolved: number;
  refused: number;
  needsReview: boolean;
  lines: ReceiptLineResult[];
};

export type CountLineResult = {
  clientCountId: string;
  outcome: 'counted' | 'unresolved' | 'updated' | 'duplicate' | 'skipped';
  reason: string | null;
  partId: number | null;
};

export type BinCountCommit = {
  stocktakeId: string;
  status: string;
  duplicate: boolean;
  partial: boolean;
  needsReview: boolean;
  putAway: number;
  returned: number;
  found: number;
  unresolved: number;
};

export type QuickAddResult =
  | {
      status: 'added';
      partId: number;
      createdPart: boolean;
      createdBrand: boolean;
      wasInInventory: boolean;
      enrichSuggested: boolean;
      healed: number;
    }
  | {
      status: 'conflict';
      conflict: 'barcode_held' | 'label_held';
      code: string;
      holder: { partId: number; brand: string; number: string } | null;
    };

function requireRecord(data: unknown, message: string): JsonRecord {
  const record = readRecord(data as Json);
  if (!record) throw new DataError(message, 'P0001');
  return record;
}

export async function resolveScan(supabase: Client, code: string, locationId?: number | null): Promise<ScanHit> {
  const { data, error } = await supabase.rpc('resolve_scan', { p_code: code, p_location: locationId ?? undefined });
  if (error) throw dataError(error);
  const row = requireRecord(data, 'Scan failed.');
  const type = readString(row.type);
  if (type === 'bin') {
    const binId = readNumber(row.bin_id);
    const bin = readString(row.bin);
    const location = readString(row.location);
    if (binId == null || !bin || !location) throw new DataError('Scan failed.', 'P0001');
    return { type: 'bin', binId, bin, location };
  }
  if (type === 'part') {
    const partId = readNumber(row.part_id);
    const brand = readString(row.brand);
    const number = readString(row.number);
    if (partId == null || !brand || !number) throw new DataError('Scan failed.', 'P0001');
    return { type: 'part', partId, brand, number };
  }
  return { type: 'unknown', code: readString(row.code) ?? code };
}

// Finds or creates a bin in the working location. A code that already means a part in your range comes back
// as that part instead.
export async function ensureBin(
  supabase: Client,
  locationId: number,
  code: string,
): Promise<
  | { type: 'bin'; binId: number; code: string; created: boolean }
  | { type: 'part'; partId: number; brand: string; number: string }
> {
  const { data, error } = await supabase.rpc('ensure_bin', { p_location: locationId, p_code: code });
  if (error) throw dataError(error);
  const row = requireRecord(data, 'The bin could not be created.');
  const partId = readNumber(row.part_id);
  if (partId != null) {
    return { type: 'part', partId, brand: readString(row.brand) ?? '', number: readString(row.number) ?? '' };
  }
  const binId = readNumber(row.bin_id);
  if (binId == null) throw new DataError('The bin could not be created.', 'P0001');
  return { type: 'bin', binId, code: readString(row.code) ?? code, created: readBoolean(row.created) === true };
}

export async function openBinCount(
  supabase: Client,
  input: { stocktakeId: string; binId: number; device?: string; startedAt?: string },
): Promise<{ stocktakeId: string; status: string; created: boolean; needsReview: boolean }> {
  const { data, error } = await supabase.rpc('open_bin_count', {
    p_stocktake: input.stocktakeId,
    p_bin: input.binId,
    p_device: input.device,
    p_started_at: input.startedAt,
  });
  if (error) throw dataError(error);
  const row = requireRecord(data, 'The count could not be opened.');
  return {
    stocktakeId: readString(row.stocktake_id) ?? input.stocktakeId,
    status: readString(row.status) ?? 'counting',
    created: readBoolean(row.created) === true,
    needsReview: readBoolean(row.needs_review) === true,
  };
}

function countLine(item: Json): CountLineResult | null {
  const row = readRecord(item);
  const clientCountId = readString(row?.client_count_id);
  if (!row || !clientCountId) return null;
  const outcome: CountLineResult['outcome'] = readBoolean(row.skipped)
    ? 'skipped'
    : readBoolean(row.updated)
      ? 'updated'
      : readBoolean(row.duplicate)
        ? 'duplicate'
        : readString(row.status) === 'unresolved'
          ? 'unresolved'
          : 'counted';
  return { clientCountId, outcome, reason: readString(row.reason), partId: readNumber(row.part_id) };
}

// Sends the session's running totals, one line per scanned code. A total sent again replaces the earlier
// one while the count is open, and 0 removes the line.
export async function recordCounts(
  supabase: Client,
  input: {
    stocktakeId: string;
    binId: number;
    lines: { clientCountId: string; code: string; qty: number; device?: string }[];
  },
): Promise<{ recorded: number; updated: number; skippedBins: number; lines: CountLineResult[] }> {
  const { data, error } = await supabase.rpc('record_counts', {
    p_stocktake: input.stocktakeId,
    p_bin: input.binId,
    p_lines: input.lines.map((line) => ({
      client_count_id: line.clientCountId,
      code: line.code,
      qty: line.qty,
      device: line.device ?? null,
    })),
  });
  if (error) throw dataError(error);
  const row = requireRecord(data, 'The counts could not be recorded.');
  return {
    recorded: readNumber(row.recorded) ?? 0,
    updated: readNumber(row.updated) ?? 0,
    skippedBins: readNumber(row.skipped_bins) ?? 0,
    lines: readArray(row.results).flatMap((item) => countLine(item) ?? []),
  };
}

export async function commitBinCount(supabase: Client, stocktakeId: string, confirmEmpty = false): Promise<BinCountCommit> {
  const { data, error } = await supabase.rpc('commit_bin_count', {
    p_stocktake: stocktakeId,
    p_confirm_empty: confirmEmpty,
  });
  if (error) throw dataError(error);
  const row = requireRecord(data, 'The count could not be committed.');
  return {
    stocktakeId: readString(row.stocktake_id) ?? stocktakeId,
    status: readString(row.status) ?? 'posted',
    duplicate: readBoolean(row.duplicate) === true,
    partial: readBoolean(row.partial) === true,
    needsReview: readBoolean(row.needs_review) === true,
    putAway: readNumber(row.put_away) ?? 0,
    returned: readNumber(row.returned) ?? 0,
    found: readNumber(row.found) ?? 0,
    unresolved: readNumber(row.unresolved) ?? 0,
  };
}

function receiptLine(item: Json): ReceiptLineResult | null {
  const row = readRecord(item);
  const clientLineId = readString(row?.client_line_id);
  if (!row || !clientLineId) return null;
  const status = readString(row.status);
  const outcome: ReceiptLineResult['outcome'] = readBoolean(row.duplicate)
    ? 'duplicate'
    : readBoolean(row.refused)
      ? 'refused'
      : readBoolean(row.skipped)
        ? 'skipped'
        : status === 'void'
          ? 'void'
          : status === 'unresolved'
            ? 'unresolved'
            : 'booked';
  return {
    clientLineId,
    outcome,
    reason: readString(row.reason),
    partId: readNumber(row.part_id),
    qty: readNumber(row.qty),
  };
}

// Opens or resumes a goods receipt. locationId is the phone's working location; null books to Unassigned
// and sends the receipt to review.
export async function recordReceiptLines(
  supabase: Client,
  input: {
    documentId: string;
    locationId: number | null;
    device?: string;
    lines: { clientLineId: string; code: string; qty: number }[];
  },
): Promise<ReceiptResult> {
  const { data, error } = await supabase.rpc('record_receipt_lines', {
    p_document: input.documentId,
    // The function takes null (no working location); the generated type doesn't say so.
    p_location: input.locationId as number,
    p_device: input.device,
    p_lines: input.lines.map((line) => ({ client_line_id: line.clientLineId, code: line.code, qty: line.qty })),
  });
  if (error) throw dataError(error);
  const row = requireRecord(data, 'The receipt could not be recorded.');
  const continuation = readRecord(row.continuation);
  const continuationId = readString(continuation?.document_id);
  return {
    documentId: readString(row.document_id) ?? input.documentId,
    number: readString(row.number) ?? '',
    status: readString(row.status) ?? 'open',
    continuation: continuationId ? { documentId: continuationId, number: readString(continuation?.number) ?? '' } : null,
    recorded: readNumber(row.recorded) ?? 0,
    unresolved: readNumber(row.unresolved) ?? 0,
    refused: readNumber(row.refused) ?? 0,
    needsReview: readBoolean(row.needs_review) === true,
    lines: readArray(row.results).flatMap((item) => receiptLine(item) ?? []),
  };
}

// Closes a goods receipt and any continuation its late lines opened.
export async function closeStockDocument(
  supabase: Client,
  documentId: string,
): Promise<{ documentId: string; number: string; status: string }> {
  const { data, error } = await supabase.rpc('close_stock_document', { p_document: documentId });
  if (error) throw dataError(error);
  const row = requireRecord(data, 'The receipt could not be closed.');
  return {
    documentId: readString(row.document_id) ?? documentId,
    number: readString(row.number) ?? '',
    status: readString(row.status) ?? 'posted',
  };
}

// Creates (or finds) a part from a brand and number and keeps the scanned code on it. A code another part
// already holds comes back as a conflict, and nothing is created.
export async function quickAddPart(
  supabase: Client,
  input: { brandId?: number; brandName?: string; number: string; code?: string; confirmNewBrand?: boolean },
): Promise<QuickAddResult> {
  const payload: Record<string, Json> = { number: input.number };
  if (input.brandId != null) payload.brand_id = input.brandId;
  if (input.brandName) payload.brand_name = input.brandName;
  if (input.code) payload.code = input.code;
  if (input.confirmNewBrand) payload.confirm_new_brand = true;
  const { data, error } = await supabase.rpc('quick_add_part', { p: payload });
  if (error) throw dataError(error);
  const row = requireRecord(data, 'The part was not added.');
  const conflict = readString(row.conflict);
  if (conflict === 'barcode_held' || conflict === 'label_held') {
    const holder = readRecord(row.holder);
    const holderId = readNumber(holder?.part_id);
    return {
      status: 'conflict',
      conflict,
      code: readString(row.code) ?? input.code ?? '',
      holder:
        holderId != null
          ? { partId: holderId, brand: readString(holder?.brand) ?? '', number: readString(holder?.number) ?? '' }
          : null,
    };
  }
  const partId = readNumber(row.part_id);
  if (partId == null) throw new DataError('The part was not added.', 'P0001');
  return {
    status: 'added',
    partId,
    createdPart: readBoolean(row.created_part) === true,
    createdBrand: readBoolean(row.created_brand) === true,
    wasInInventory: readBoolean(row.was_in_inventory) === true,
    enrichSuggested: readBoolean(row.enrich_suggested) === true,
    healed: readNumber(row.healed) ?? 0,
  };
}

const SCAN_KINDS = new Set<string>(['bin', 'label', 'gtin', 'sku', 'number', 'supplier_code', 'ambiguous']);

// One page of the offline index, keyed by code. Pass the last codeKey of a page as `after` for the next one;
// an empty page is the end.
export async function scanIndexPage(supabase: Client, after?: string | null, limit = 5000): Promise<ScanIndexRow[]> {
  const { data, error } = await supabase.rpc('scan_index', { p_after: after ?? undefined, p_limit: limit });
  if (error) throw dataError(error);
  return (data ?? []).map((row) => ({
    codeKey: row.code_key,
    entries: readArray(row.entries).flatMap((item) => {
      const entry = readRecord(item);
      const kind = readString(entry?.kind);
      if (!entry || !kind || !SCAN_KINDS.has(kind)) return [];
      return [
        {
          kind: kind as ScanIndexKind,
          partId: readNumber(entry.part_id),
          binId: readNumber(entry.bin_id),
          label: readString(entry.label),
          locationCode: readString(entry.location_code),
        },
      ];
    }),
  }));
}

// Changes whenever the index could have changed (including deletions and merges): refetch it all then.
export async function scanIndexVersion(supabase: Client): Promise<string | null> {
  const { data, error } = await supabase.rpc('scan_index_version');
  if (error) throw dataError(error);
  return typeof data === 'string' ? data : null;
}

const REASONS = new Set<string>(['late_lines', 'no_location', 'large_quantity', 'refused_undo', 'partial', 'large_found', 'voided_scans']);

function activityRow(item: Json | undefined): FloorActivityRow | null {
  const row = readRecord(item);
  const id = readString(row?.id);
  const kind = readString(row?.kind);
  if (!row || !id || (kind !== 'goods_receipt' && kind !== 'bin_count')) return null;
  return {
    id,
    kind,
    number: readString(row.number) ?? '',
    status: readString(row.status) ?? '',
    needsReview: readBoolean(row.needs_review) === true,
    partial: readBoolean(row.partial) === true,
    createdAt: readString(row.created_at) ?? '',
    createdBy: readString(row.created_by),
    by: readString(row.by),
    locationId: readNumber(row.location_id),
    place: readString(row.place),
    lines: readNumber(row.lines) ?? 0,
    unresolved: readNumber(row.unresolved) ?? 0,
    units: readNumber(row.units) ?? 0,
    putAway: readNumber(row.put_away) ?? 0,
    returned: readNumber(row.returned) ?? 0,
    found: readNumber(row.found) ?? 0,
    reversedBy: readString(row.reversed_by),
    continues: readString(row.continues),
    reasons: readArray(row.reasons).flatMap((reason) =>
      typeof reason === 'string' && REASONS.has(reason) ? [reason as FloorReviewReason] : [],
    ),
  };
}

// Goods receipts or bin counts, newest first. Pass the oldest createdAt shown as `before` for the next page.
export async function floorActivity(
  supabase: Client,
  kind: FloorDocumentKind,
  limit = 50,
  before?: string | null,
): Promise<FloorActivityRow[]> {
  const { data, error } = await supabase.rpc('floor_activity', {
    p_kind: kind,
    p_limit: limit,
    p_before: before ?? undefined,
  });
  if (error) throw dataError(error);
  return readArray(data).flatMap((item) => activityRow(item) ?? []);
}

// One receipt or bin count with its lines (and, for a count, what it changed part by part), or null.
export async function getFloorDocument(supabase: Client, kind: FloorDocumentKind, id: string): Promise<FloorDocument | null> {
  const { data, error } = await supabase.rpc('floor_document', { p_kind: kind, p_id: id });
  if (error) throw dataError(error);
  const row = activityRow(data);
  const record = readRecord(data);
  if (!row || !record) return null;
  return {
    ...row,
    items: readArray(record.lines).flatMap((item) => {
      const line = readRecord(item);
      const lineId = readNumber(line?.id);
      const status = readString(line?.status);
      if (!line || lineId == null || (status !== 'counted' && status !== 'unresolved' && status !== 'void')) return [];
      return [
        {
          id: lineId,
          code: readString(line.code),
          partId: readNumber(line.part_id),
          brand: readString(line.brand),
          number: readString(line.number),
          qty: readNumber(line.qty) ?? 0,
          status,
          at: readString(line.at) ?? '',
        },
      ];
    }),
    changes: readArray(record.changes).flatMap((item) => {
      const change = readRecord(item);
      const partId = readNumber(change?.part_id);
      if (!change || partId == null) return [];
      return [
        {
          partId,
          brand: readString(change.brand) ?? '',
          number: readString(change.number) ?? '',
          expected: readNumber(change.expected) ?? 0,
          counted: readNumber(change.counted) ?? 0,
          change: readNumber(change.change) ?? 0,
        },
      ];
    }),
  };
}

// Posts a reversal; refused with a plain message once the stock has moved on.
export async function reverseFloorChange(
  supabase: Client,
  kind: FloorDocumentKind,
  id: string,
  reason: string,
): Promise<{ documentId: string; number: string }> {
  const { data, error } = await supabase.rpc('reverse_floor_change', { p_kind: kind, p_id: id, p_reason: reason });
  if (error) throw dataError(error);
  const row = requireRecord(data, 'The change could not be reversed.');
  return { documentId: readString(row.document_id) ?? '', number: readString(row.number) ?? '' };
}

export async function markFloorReviewed(supabase: Client, kind: FloorDocumentKind, id: string): Promise<void> {
  const { error } = await supabase.rpc('mark_floor_reviewed', { p_kind: kind, p_id: id });
  if (error) throw dataError(error);
}

// Codes the floor scanned that matched nothing, one row per code, newest first.
export async function listUnresolvedCodes(supabase: Client, limit = 100): Promise<UnresolvedCode[]> {
  const { data, error } = await supabase.rpc('floor_unresolved', { p_limit: limit });
  if (error) throw dataError(error);
  return (data ?? []).map((row) => ({
    code: row.code,
    qty: Number(row.qty),
    lines: Number(row.lines),
    receipts: Number(row.receipts),
    counts: Number(row.counts),
    lastSeen: row.last_seen,
    sources: row.sources ?? [],
  }));
}

// Stock not yet in a bin, per pool bin (each location's UNBINNED, and UNASSIGNED).
export async function listPendingPutAway(supabase: Client): Promise<PendingPutAway[]> {
  const { data, error } = await supabase.rpc('pending_put_away');
  if (error) throw dataError(error);
  return (data ?? []).map((row) => ({
    binId: row.bin_id,
    place: row.place,
    locationId: row.location_id,
    parts: Number(row.parts),
    units: Number(row.units),
  }));
}

// Keeps the code on the part (barcode or label) and books every line waiting on it.
export async function linkFloorCode(supabase: Client, code: string, partId: number): Promise<{ healed: number }> {
  const { data, error } = await supabase.rpc('link_floor_code', { p_code: code, p_part: partId });
  if (error) throw dataError(error);
  return { healed: readNumber(readRecord(data)?.healed) ?? 0 };
}

export async function voidFloorCode(supabase: Client, code: string): Promise<{ voided: number }> {
  const { data, error } = await supabase.rpc('void_floor_code', { p_code: code });
  if (error) throw dataError(error);
  return { voided: readNumber(readRecord(data)?.voided) ?? 0 };
}

export async function listUnlocatedStock(supabase: Client, locationId?: number | null, limit = 50): Promise<UnlocatedLine[]> {
  const { data, error } = await supabase.rpc('unlocated_stock', { p_location: locationId ?? undefined, p_limit: limit });
  if (error) throw dataError(error);
  return (data ?? []).map((row) => ({
    partId: row.part_id,
    brand: row.brand,
    number: row.number,
    qty: Number(row.qty),
    binId: row.bin_id,
    place: row.place,
  }));
}

export async function unlocatedStockSummary(supabase: Client, locationId?: number | null): Promise<UnlocatedSummary> {
  const { data, error } = await supabase.rpc('unlocated_stock_summary', { p_location: locationId ?? undefined });
  if (error) throw dataError(error);
  const row = readRecord(data);
  return { parts: readNumber(row?.parts) ?? 0, qty: readNumber(row?.qty) ?? 0 };
}

// Writes off chosen parts from one pool bin (Unassigned, or a location's Unbinned).
export async function writeOffUnlocated(
  supabase: Client,
  binId: number,
  partIds: number[],
): Promise<{ parts: number; qty: number }> {
  const { data, error } = await supabase.rpc('write_off_unlocated', { p_bin: binId, p_parts: partIds });
  if (error) throw dataError(error);
  const row = requireRecord(data, 'The write-off failed.');
  return { parts: readNumber(row.parts) ?? 0, qty: readNumber(row.qty) ?? 0 };
}
