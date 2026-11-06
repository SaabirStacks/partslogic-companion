import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { dataError } from '../core/errors';
import { readArray, readBoolean, readNumber, readRecord, readString, requireRecord, type JsonRecord } from '../core/read';

// Who a goods receipt came from: one of your suppliers, or a manufacturer that delivered direct.
export type ReceiptSupplier = { sourceId: number; name: string };
export type ReceiptManufacturer = { brandId: number; name: string };

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

// Says who a delivery came from and its delivery note: a supplier or a manufacturer (not both), and the note
// number (up to 60 characters). Each call sets all three, so leaving one out clears it. Counters change an
// open receipt; once it is closed, only an editor can.
export async function setReceiptDetails(
  supabase: Client,
  input: { documentId: string; sourceId?: number | null; brandId?: number | null; reference?: string | null },
): Promise<{ documentId: string; number: string; sourceId: number | null; brandId: number | null; reference: string | null }> {
  const { data, error } = await supabase.rpc('set_receipt_details', {
    p_document: input.documentId,
    p_source: input.sourceId ?? undefined,
    p_brand: input.brandId ?? undefined,
    p_reference: input.reference ?? undefined,
  });
  if (error) throw dataError(error);
  const row = requireRecord(data, 'The delivery details could not be saved.');
  return {
    documentId: readString(row.document_id) ?? input.documentId,
    number: readString(row.number) ?? '',
    sourceId: readNumber(row.source_id),
    brandId: readNumber(row.brand_id),
    reference: readString(row.reference),
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
