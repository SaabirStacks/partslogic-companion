import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { DataError, dataError } from '../core/errors';
import { readArray, readBoolean, readNumber, readRecord, readString, requireRecord, type JsonRecord } from '../core/read';

// Which job a bin count was. stock_take and opening counts can belong to a run: the bin counts of one stock
// take, or of setting up opening stock. Opening counts book the stock they find as opening stock.
export type CountPurpose = 'put_away' | 'stock_count' | 'stock_take' | 'opening';
export const COUNT_PURPOSES: readonly CountPurpose[] = ['put_away', 'stock_count', 'stock_take', 'opening'];

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

// Opens a blind count of one bin. purpose names the job; runId groups the counts of one stock take or
// opening-stock run (only those two take one).
export async function openBinCount(
  supabase: Client,
  input: { stocktakeId: string; binId: number; device?: string; startedAt?: string; purpose?: CountPurpose; runId?: string },
): Promise<{ stocktakeId: string; status: string; created: boolean; needsReview: boolean }> {
  const { data, error } = await supabase.rpc('open_bin_count', {
    p_stocktake: input.stocktakeId,
    p_bin: input.binId,
    p_device: input.device,
    p_started_at: input.startedAt,
    p_purpose: input.purpose,
    p_run: input.runId,
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

// Cancels a bin count that was discarded on the phone, so it no longer shows in progress or holds its bin.
// Only the person counting it (or an editor), only while it's still being counted. Safe to repeat: one
// already cancelled, or never opened, comes back discarded false.
export async function discardBinCount(supabase: Client, stocktakeId: string): Promise<{ stocktakeId: string; discarded: boolean }> {
  const { data, error } = await supabase.rpc('discard_bin_count', { p_stocktake: stocktakeId });
  if (error) throw dataError(error);
  const row = requireRecord(data, 'The count could not be discarded.');
  return { stocktakeId: readString(row.stocktake_id) ?? stocktakeId, discarded: readBoolean(row.discarded) === true };
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
