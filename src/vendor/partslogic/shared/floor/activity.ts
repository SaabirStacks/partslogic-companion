import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { dataError } from '../core/errors';
import { readArray, readBoolean, readNumber, readRecord, readString, requireRecord, type JsonRecord } from '../core/read';
import { COUNT_PURPOSES, type CountPurpose } from './counts';
import type { ReceiptManufacturer, ReceiptSupplier } from './receipts';

export type FloorDocumentKind = 'goods_receipt' | 'bin_count';

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

export type CountRun = { id: string; startedAt: string; bins: number };

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
  // receipts: who it came from and the delivery note (a continuation shows its receipt's)
  supplier: ReceiptSupplier | null;
  manufacturer: ReceiptManufacturer | null;
  reference: string | null;
  // counts: which job it was (null for counts from before this was recorded) and the run it belongs to
  purpose: CountPurpose | null;
  run: CountRun | null;
  // counts: how many earlier tries at the bin this one restarts (they show only in its log), and when the
  // first of them started
  tries: number;
  firstStartedAt: string | null;
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

// An earlier try at a bin count, restarted before it finished: set aside, its scans kept for the record.
export type CountTry = {
  id: string;
  startedAt: string;
  status: string;
  by: string | null;
  device: string | null;
  scans: number;
  units: number;
};

export type FloorDocument = FloorActivityRow & { items: FloorLine[]; changes: FloorChange[]; earlierTries: CountTry[] };

const REASONS = new Set<string>(['late_lines', 'no_location', 'large_quantity', 'refused_undo', 'partial', 'large_found', 'voided_scans']);

function countPurpose(value: Json | undefined): CountPurpose | null {
  const purpose = readString(value);
  return purpose && (COUNT_PURPOSES as readonly string[]).includes(purpose) ? (purpose as CountPurpose) : null;
}

function receiptSupplier(value: Json | undefined): ReceiptSupplier | null {
  const row = readRecord(value);
  const sourceId = readNumber(row?.source_id);
  const name = readString(row?.name);
  return sourceId != null && name ? { sourceId, name } : null;
}

function receiptManufacturer(value: Json | undefined): ReceiptManufacturer | null {
  const row = readRecord(value);
  const brandId = readNumber(row?.brand_id);
  const name = readString(row?.name);
  return brandId != null && name ? { brandId, name } : null;
}

function countRun(value: Json | undefined): CountRun | null {
  const row = readRecord(value);
  const id = readString(row?.id);
  return row && id ? { id, startedAt: readString(row.started_at) ?? '', bins: readNumber(row.bins) ?? 0 } : null;
}

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
    supplier: receiptSupplier(row.supplier),
    manufacturer: receiptManufacturer(row.manufacturer),
    reference: readString(row.reference),
    purpose: countPurpose(row.purpose),
    run: countRun(row.run),
    tries: readNumber(row.tries) ?? 0,
    firstStartedAt: readString(row.first_started_at),
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
    earlierTries: readArray(record.earlier_tries).flatMap((item) => {
      const earlier = readRecord(item);
      const id = readString(earlier?.id);
      if (!earlier || !id) return [];
      return [
        {
          id,
          startedAt: readString(earlier.started_at) ?? '',
          status: readString(earlier.status) ?? 'cancelled',
          by: readString(earlier.by),
          device: readString(earlier.device),
          scans: readNumber(earlier.scans) ?? 0,
          units: readNumber(earlier.units) ?? 0,
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
