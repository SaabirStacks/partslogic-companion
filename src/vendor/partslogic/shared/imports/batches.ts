import type { Database, Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { dataError } from '../core/errors';
import { readArray, readNumber, readRecord, readString, readStrings, type JsonRecord } from '../core/read';
import type { ImportSpec } from './mapping';

export type ImportIssue = {
  level: 'error' | 'warning' | 'skipped';
  field: string | null;
  message: string;
  value: string | null;
};
export type PreviewRow = { row: number; mapped: JsonRecord; issues: ImportIssue[] };
export type ImportPreview = { brandColumns: { [header: string]: string }; missingOptionalFields: string[]; rows: PreviewRow[] };

function readIssues(value: Json | undefined): ImportIssue[] {
  return readArray(value).flatMap((item) => {
    const issue = readRecord(item);
    const level = readString(issue?.level);
    const message = readString(issue?.message) ?? readString(issue?.error);
    if (!message) return [];
    return [
      {
        level: level === 'warning' || level === 'skipped' ? level : 'error',
        field: readString(issue?.field),
        message,
        value: readString(issue?.value),
      },
    ];
  });
}

function readStringMap(value: Json | undefined): { [key: string]: string } {
  const record = readRecord(value);
  if (!record) return {};
  return Object.fromEntries(Object.entries(record).flatMap(([key, item]) => (typeof item === 'string' ? [[key, item]] : [])));
}

// Runs the real mapper (ingest.map_row) over sample rows, so the preview is exactly what the import does.
export async function previewImport(
  supabase: Client,
  spec: ImportSpec,
  rows: { [header: string]: string }[],
): Promise<ImportPreview> {
  const { data, error } = await supabase.rpc('import_preview', { p_spec: spec, p_rows: rows.slice(0, 50) });
  if (error) throw dataError(error);
  const preview = readRecord(data);
  return {
    brandColumns: readStringMap(preview?.brand_columns),
    missingOptionalFields: readStrings(preview?.missing_optional_fields),
    rows: readArray(preview?.rows).flatMap((value) => {
      const row = readRecord(value);
      const index = readNumber(row?.row);
      return index == null ? [] : [{ row: index, mapped: readRecord(row?.mapped) ?? {}, issues: readIssues(row?.issues) }];
    }),
  };
}

export type ImportStatus = Database['ingest']['Enums']['batch_status'];
export type ImportBatch = {
  id: string;
  supplierId: number;
  supplier: string;
  fileName: string;
  kind: 'upload' | 'landing';
  status: ImportStatus;
  rowCount: number;
  mappedThrough: number;
  appliedThrough: number;
  rowsApplied: number;
  rowsQuarantined: number;
  createdBy: string | null;
  createdAt: string;
  completedAt: string | null;
  error: string | null;
};
export type ImportDetails = {
  oe: { linked: number; likely: number; unattributed: number };
  supplierCodes: number;
  // rows that carried an exchange surcharge
  surcharges: number;
  skippedValuesTotal: number;
  skippedValuesTop: { value: string; rows: number }[];
};
export type ImportReport = ImportBatch & {
  received: number | null;
  staged: number;
  rowsWarning: number;
  brandColumns: { [header: string]: string };
  unrecognisedColumns: string[];
  missingOptionalFields: string[];
  profile: { code: string; version: number } | null;
  startedAt: string | null;
  details: ImportDetails | null;
};
export type QuarantinedRow = { rowNumber: number; stage: 'mapping' | 'applying'; reasons: ImportIssue[]; cells: { [header: string]: string } };

const IMPORT_STATUSES: readonly ImportStatus[] = [
  'uploaded', 'parsing', 'mapping', 'resolving', 'linking', 'publishing', 'completed', 'failed',
];

function readStatus(value: Json | undefined): ImportStatus {
  return IMPORT_STATUSES.find((status) => status === value) ?? 'uploaded';
}

function readBatch(row: JsonRecord | null): ImportBatch | null {
  const id = readString(row?.id);
  const supplierId = readNumber(row?.source_id);
  const supplier = readString(row?.source);
  const fileName = readString(row?.file_name);
  const createdAt = readString(row?.created_at);
  if (!id || supplierId == null || !supplier || !fileName || !createdAt) return null;
  return {
    id,
    supplierId,
    supplier,
    fileName,
    kind: row?.kind === 'upload' ? 'upload' : 'landing',
    status: readStatus(row?.status),
    rowCount: readNumber(row?.row_count) ?? 0,
    mappedThrough: readNumber(row?.mapped_through) ?? 0,
    appliedThrough: readNumber(row?.applied_through) ?? 0,
    rowsApplied: readNumber(row?.rows_applied) ?? 0,
    rowsQuarantined: readNumber(row?.rows_quarantined) ?? 0,
    createdBy: readString(row?.created_by),
    createdAt,
    completedAt: readString(row?.completed_at),
    error: readString(row?.error),
  };
}

export function readImportReport(value: Json | undefined): ImportReport | null {
  const report = readRecord(value);
  const batch = readBatch(report);
  if (!report || !batch) return null;
  const details = readRecord(report.details);
  const oe = readRecord(details?.oe);
  const profile = readRecord(report.profile);
  const profileCode = readString(profile?.code);
  const profileVersion = readNumber(profile?.version);
  const unrecognised = report.unrecognised_columns;
  return {
    ...batch,
    received: readNumber(report.received),
    staged: readNumber(report.staged) ?? 0,
    rowsWarning: readNumber(report.rows_warning) ?? 0,
    brandColumns: readStringMap(report.brand_columns),
    // uploads store a list; landing imports a {column: filled rows} object
    unrecognisedColumns: Array.isArray(unrecognised) ? readStrings(unrecognised) : Object.keys(readRecord(unrecognised) ?? {}),
    missingOptionalFields: readStrings(report.missing_optional_fields),
    profile: profileCode && profileVersion != null ? { code: profileCode, version: profileVersion } : null,
    startedAt: readString(report.started_at),
    details: details
      ? {
          oe: {
            linked: readNumber(oe?.linked) ?? 0,
            likely: readNumber(oe?.likely) ?? 0,
            unattributed: readNumber(oe?.unattributed) ?? 0,
          },
          supplierCodes: readNumber(details.supplier_codes) ?? 0,
          surcharges: readNumber(details.surcharges) ?? 0,
          skippedValuesTotal: readNumber(details.skipped_values_total) ?? 0,
          skippedValuesTop: readArray(details.skipped_values_top).flatMap((item) => {
            const top = readRecord(item);
            const value = readString(top?.value);
            return value ? [{ value, rows: readNumber(top?.rows) ?? 0 }] : [];
          }),
        }
      : null,
  };
}

export type ImportStart = { supplierId: number; fileName: string; sha256: string; rowCount: number; headers: string[] };

export async function beginImport(supabase: Client, input: ImportStart): Promise<string> {
  const { data, error } = await supabase.rpc('import_begin', {
    p_source: input.supplierId,
    p_file_name: input.fileName,
    p_sha256: input.sha256,
    p_row_count: input.rowCount,
    p_headers: input.headers,
  });
  if (error) throw dataError(error);
  return data;
}

// Sends rows firstRow.. of an open upload (at most 2,000). Returns how many were new.
export async function appendImportRows(
  supabase: Client,
  batchId: string,
  firstRow: number,
  rows: { [header: string]: string }[],
): Promise<number> {
  const { data, error } = await supabase.rpc('import_append_rows', { p_batch: batchId, p_first_row: firstRow, p_rows: rows });
  if (error) throw dataError(error);
  return data;
}

export async function finishImport(supabase: Client, batchId: string): Promise<ImportReport | null> {
  const { data, error } = await supabase.rpc('import_finish', { p_batch: batchId });
  if (error) throw dataError(error);
  return readImportReport(data);
}

export async function cancelImport(supabase: Client, batchId: string): Promise<void> {
  const { error } = await supabase.rpc('import_cancel', { p_batch: batchId });
  if (error) throw dataError(error);
}

export async function getImportReport(supabase: Client, batchId: string, details = false): Promise<ImportReport | null> {
  const { data, error } = await supabase.rpc('import_report', { p_batch: batchId, p_details: details });
  if (error) throw dataError(error);
  return readImportReport(data);
}

export async function listImportBatches(supabase: Client, limit = 50): Promise<ImportBatch[]> {
  const { data, error } = await supabase.rpc('import_batches', { p_limit: limit });
  if (error) throw dataError(error);
  return (data ?? []).flatMap((row) => {
    const batch = readBatch(readRecord(row));
    return batch ? [batch] : [];
  });
}

export async function listQuarantinedRows(
  supabase: Client,
  batchId: string,
  limit = 25,
  offset = 0,
): Promise<{ rows: QuarantinedRow[]; total: number }> {
  const { data, error } = await supabase.rpc('import_quarantined', { p_batch: batchId, p_limit: limit, p_offset: offset });
  if (error) throw dataError(error);
  const list = data ?? [];
  return {
    total: readNumber(list[0]?.total) ?? 0,
    rows: list.flatMap((row) =>
      row.row_number == null
        ? []
        : [
            {
              rowNumber: row.row_number,
              stage: row.stage === 'applying' ? 'applying' : 'mapping',
              reasons: readIssues(row.reasons),
              cells: readStringMap(row.cells),
            },
          ],
    ),
  };
}

// Where a batch is, as one number from 0 to 1. Mapping is about a sixth of the work (1 ms a row against
// 5 ms to apply one).
export function importProgress(batch: Pick<ImportBatch, 'status' | 'rowCount' | 'mappedThrough' | 'appliedThrough'> & {
  received?: number | null;
}): { stage: 'receiving' | 'mapping' | 'applying' | 'done' | 'failed'; fraction: number } {
  const rows = Math.max(batch.rowCount, 1);
  switch (batch.status) {
    case 'completed':
      return { stage: 'done', fraction: 1 };
    case 'failed':
      return { stage: 'failed', fraction: Math.min(batch.appliedThrough / rows, 1) };
    case 'uploaded':
    case 'parsing':
      return { stage: 'receiving', fraction: 0 };
    case 'mapping':
    case 'resolving':
      return { stage: 'mapping', fraction: 0.15 * Math.min(batch.mappedThrough / rows, 1) };
    default:
      return { stage: 'applying', fraction: 0.15 + 0.85 * Math.min(batch.appliedThrough / rows, 1) };
  }
}
