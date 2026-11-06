import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { dataError, DataError } from '../core/errors';
import { readArray, readBoolean, readNumber, readRecord, readString, type JsonRecord } from '../core/read';

// ---------------------------------------------------------------------------------------------------------
// Re-running a past upload under the supplier's current mapping (docs/SUPPLIERS_AND_PURCHASING.md 5.5a).
// Every rule lives in SQL (public.rerun_upload and friends); this file reads what they return and calls them.
// ---------------------------------------------------------------------------------------------------------

// replace: take back what the old reading claimed and state the new one. add_only: only add; nothing is withdrawn.
export type RerunMode = 'replace' | 'add_only';

export const RERUN_STATUSES = [
  'mapping', 'review', 'applying', 'completed', 'cancelled', 'failed', 'undoing', 'undone',
] as const;
export type RerunStatus = (typeof RERUN_STATUSES)[number];

// How the stored rows sorted under the new mapping. unreadable rows are left as they were.
export type RerunCounts = { new: number; changed: number; retry: number; unchanged: number; unreadable: number };

// A field that differs between the old and the new reading, and on how many rows.
export type RerunFieldChange = { field: string; rows: number };

// One difference on a sample row. from and to are the JSON text of the value, as the database cut it.
export type RerunSampleChange = { field: string; from: string | null; to: string | null };
export type RerunSample = { row: number; kind: 'changed' | 'new'; changes: RerunSampleChange[] };

export type RerunOutcome = {
  applied: number;
  warnings: number;
  failed: number;
  pricesChanged: number;
  pricesEnded: number;
  pricesKeptNewer: number;
  codesDropped: number;
  codesKeptNewer: number;
  claimsWithdrawn: number;
  claimsAdded: number;
  issuesClosed: number;
  stopped: boolean;
};

export type RerunUndoOutcome = { restored: number; pricesRemoved: number; pricesReopened: number; failed: number };

export type MappingVersion = { code: string; version: number };

export type UploadRun = {
  id: number;
  batchId: string;
  status: RerunStatus;
  mode: RerunMode;
  profile: MappingVersion | null;
  priorProfile: MappingVersion | null;
  rowCount: number;
  mappedThrough: number;
  counts: RerunCounts;
  fieldChanges: RerunFieldChange[];
  samples: RerunSample[];
  rowsTotal: number;
  rowsDone: number;
  outcome: RerunOutcome;
  undoOutcome: RerunUndoOutcome;
  error: string | null;
  createdByEmail: string | null;
  createdAt: string | null;
  confirmedAt: string | null;
  finishedAt: string | null;
  undoneAt: string | null;
  undoneByEmail: string | null;
  canUndo: boolean;
  // finished uploads from the same supplier that are newer than this one (their prices and codes are kept)
  newerUploads: number;
};

export type UploadRuns = {
  batchId: string;
  // why the upload can't be re-run now, or null when it can
  blocker: string | null;
  // the supplier's active mapping, and the one this upload last stood under
  currentProfile: MappingVersion | null;
  uploadProfile: MappingVersion | null;
  runs: UploadRun[];
};

function count(record: JsonRecord | null, key: string): number {
  return readNumber(record?.[key]) ?? 0;
}

function readVersion(value: Json | undefined): MappingVersion | null {
  const record = readRecord(value);
  const code = readString(record?.code);
  const version = readNumber(record?.version);
  return code && version != null ? { code, version } : null;
}

export function readRerunOutcome(value: Json | undefined): RerunOutcome {
  const record = readRecord(value);
  return {
    applied: count(record, 'applied'),
    warnings: count(record, 'warnings'),
    failed: count(record, 'failed'),
    pricesChanged: count(record, 'prices_changed'),
    pricesEnded: count(record, 'prices_ended'),
    pricesKeptNewer: count(record, 'prices_kept_newer'),
    codesDropped: count(record, 'codes_dropped'),
    codesKeptNewer: count(record, 'codes_kept_newer'),
    claimsWithdrawn: count(record, 'claims_withdrawn'),
    claimsAdded: count(record, 'claims_added'),
    issuesClosed: count(record, 'issues_closed'),
    stopped: readBoolean(record?.stopped) === true,
  };
}

export function readRerunUndoOutcome(value: Json | undefined): RerunUndoOutcome {
  const record = readRecord(value);
  return {
    restored: count(record, 'restored'),
    pricesRemoved: count(record, 'prices_removed'),
    pricesReopened: count(record, 'prices_reopened'),
    failed: count(record, 'undo_failed'),
  };
}

function readSamples(value: Json | undefined): RerunSample[] {
  return readArray(value).flatMap((item) => {
    const sample = readRecord(item);
    const row = readNumber(sample?.row);
    if (row == null) return [];
    const changes = readArray(sample?.changes).flatMap((change): RerunSampleChange[] => {
      const record = readRecord(change);
      const field = readString(record?.field);
      if (!field) return [];
      const from = record?.from;
      const to = record?.to;
      return [{ field, from: typeof from === 'string' ? from : null, to: typeof to === 'string' ? to : null }];
    });
    return [{ row, kind: sample?.kind === 'new' ? 'new' : 'changed', changes }];
  });
}

export function readUploadRun(value: Json | undefined): UploadRun | null {
  const run = readRecord(value);
  const id = readNumber(run?.id);
  const batchId = readString(run?.batch_id);
  const status = RERUN_STATUSES.find((candidate) => candidate === run?.status);
  if (!run || id == null || !batchId || !status) return null;
  const counts = readRecord(run.counts);
  return {
    id,
    batchId,
    status,
    mode: run.mode === 'add_only' ? 'add_only' : 'replace',
    profile: readVersion(run.profile),
    priorProfile: readVersion(run.prior_profile),
    rowCount: readNumber(run.row_count) ?? 0,
    mappedThrough: readNumber(run.mapped_through) ?? 0,
    counts: {
      new: count(counts, 'new'),
      changed: count(counts, 'changed'),
      retry: count(counts, 'retry'),
      unchanged: count(counts, 'unchanged'),
      unreadable: count(counts, 'unreadable'),
    },
    fieldChanges: readArray(run.field_changes).flatMap((item) => {
      const record = readRecord(item);
      const field = readString(record?.field);
      return field ? [{ field, rows: count(record, 'rows') }] : [];
    }),
    samples: readSamples(run.samples),
    rowsTotal: readNumber(run.rows_total) ?? 0,
    rowsDone: readNumber(run.rows_done) ?? 0,
    outcome: readRerunOutcome(run.outcome),
    undoOutcome: readRerunUndoOutcome(run.undo_outcome),
    error: readString(run.error),
    createdByEmail: readString(run.created_by_email),
    createdAt: readString(run.created_at),
    confirmedAt: readString(run.confirmed_at),
    finishedAt: readString(run.finished_at),
    undoneAt: readString(run.undone_at),
    undoneByEmail: readString(run.undone_by_email),
    canUndo: run.can_undo === true,
    newerUploads: readNumber(run.newer_uploads) ?? 0,
  };
}

export function readUploadRuns(value: Json | undefined): UploadRuns | null {
  const record = readRecord(value);
  const batchId = readString(record?.batch_id);
  if (!record || !batchId) return null;
  return {
    batchId,
    blocker: readString(record.blocker),
    currentProfile: readVersion(record.current_profile),
    uploadProfile: readVersion(record.upload_profile),
    runs: readArray(record.runs).flatMap((item) => {
      const run = readUploadRun(item);
      return run ? [run] : [];
    }),
  };
}

// The rows a re-run would add or change (the ones the confirmation applies).
export function rerunRowsToApply(counts: RerunCounts): number {
  return counts.new + counts.changed + counts.retry;
}

// Mapping, applying and undoing happen in the background; the page polls while a run is in one of them.
export function isRerunBusy(run: Pick<UploadRun, 'status'>): boolean {
  return run.status === 'mapping' || run.status === 'applying' || run.status === 'undoing';
}

// Where a run is, as one number from 0 to 1 for its current stage (mapping, applying or undoing).
export function rerunProgress(
  run: Pick<UploadRun, 'status' | 'rowCount' | 'mappedThrough' | 'rowsTotal' | 'rowsDone'>,
): { stage: RerunStatus; fraction: number } {
  switch (run.status) {
    case 'mapping':
      return { stage: run.status, fraction: Math.min(run.mappedThrough / Math.max(run.rowCount, 1), 1) };
    case 'applying':
    case 'undoing':
      return { stage: run.status, fraction: Math.min(run.rowsDone / Math.max(run.rowsTotal, 1), 1) };
    case 'review':
    case 'completed':
    case 'undone':
      return { stage: run.status, fraction: 1 };
    default:
      return { stage: run.status, fraction: 0 };
  }
}

function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;
}

// What a finished (or stopped) run did, one short phrase for each thing that happened; nothing for what didn't.
export function describeRerunOutcome(outcome: RerunOutcome): string[] {
  const lines: string[] = [];
  if (outcome.applied > 0) lines.push(`${plural(outcome.applied, 'row', 'rows')} applied`);
  if (outcome.warnings > 0) lines.push(`${plural(outcome.warnings, 'row', 'rows')} applied with a note`);
  if (outcome.pricesChanged > 0) lines.push(`${plural(outcome.pricesChanged, 'price', 'prices')} published`);
  if (outcome.pricesEnded > 0) lines.push(`${plural(outcome.pricesEnded, 'price', 'prices')} closed on a part the row no longer names`);
  if (outcome.pricesKeptNewer > 0) lines.push(`${plural(outcome.pricesKeptNewer, 'price', 'prices')} kept from a newer upload`);
  if (outcome.codesDropped > 0) lines.push(`${plural(outcome.codesDropped, 'supplier code', 'supplier codes')} taken back`);
  if (outcome.codesKeptNewer > 0) lines.push(`${plural(outcome.codesKeptNewer, 'supplier code', 'supplier codes')} kept from a newer upload`);
  if (outcome.claimsWithdrawn > 0) lines.push(`${plural(outcome.claimsWithdrawn, 'claim', 'claims')} taken back`);
  if (outcome.claimsAdded > 0) lines.push(`${plural(outcome.claimsAdded, 'claim', 'claims')} stated`);
  if (outcome.issuesClosed > 0) lines.push(`${plural(outcome.issuesClosed, 'set-aside note', 'set-aside notes')} settled`);
  if (outcome.failed > 0) lines.push(`${plural(outcome.failed, 'row', 'rows')} could not be applied and stayed as they were`);
  return lines;
}

// What an undo put back.
export function describeRerunUndo(outcome: RerunUndoOutcome): string[] {
  const lines: string[] = [];
  if (outcome.restored > 0) lines.push(`${plural(outcome.restored, 'row', 'rows')} put back`);
  if (outcome.pricesRemoved > 0) lines.push(`${plural(outcome.pricesRemoved, 'price', 'prices')} removed`);
  if (outcome.pricesReopened > 0) lines.push(`${plural(outcome.pricesReopened, 'earlier price', 'earlier prices')} open again`);
  if (outcome.failed > 0) lines.push(`${plural(outcome.failed, 'row', 'rows')} could not be put back`);
  return lines;
}

// A value from a sample change, as a person would read it. The database sends the JSON text of the value, cut
// at 120 characters ("\"12.50\"", "12.5", "null").
export function rerunValueText(value: string | null): string {
  if (value == null || value === 'null') return 'nothing';
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed === 'string') return parsed === '' ? 'nothing' : parsed;
    if (typeof parsed === 'number' || typeof parsed === 'boolean') return String(parsed);
    return value;
  } catch {
    return value.replace(/^"/, '');
  }
}

// ---------------------------------------------------------------------------------------------------------
// Database calls
// ---------------------------------------------------------------------------------------------------------

function mustRead(value: Json | undefined, what: string): UploadRun {
  const run = readUploadRun(value);
  if (!run) throw new DataError(`The database did not return the ${what}.`, 'P0001');
  return run;
}

// An upload's re-runs, newest first, and whether it can be re-run now.
export async function listUploadRuns(supabase: Client, batchId: string): Promise<UploadRuns | null> {
  const { data, error } = await supabase.rpc('upload_runs', { p_batch: batchId });
  if (error) throw dataError(error);
  return readUploadRuns(data);
}

// Starts a re-run (editors and up). It maps the rows in the background and waits for confirmation.
export async function startRerun(supabase: Client, batchId: string, mode: RerunMode): Promise<UploadRun> {
  const { data, error } = await supabase.rpc('rerun_upload', { p_batch: batchId, p_mode: mode });
  if (error) throw dataError(error);
  return mustRead(data, 'new re-run');
}

export async function confirmRerun(supabase: Client, runId: number): Promise<UploadRun> {
  const { data, error } = await supabase.rpc('rerun_confirm', { p_run: runId });
  if (error) throw dataError(error);
  return mustRead(data, 're-run');
}

// Dismisses a run that is mapping or waiting, or stops one that is applying.
export async function cancelRerun(supabase: Client, runId: number): Promise<UploadRun> {
  const { data, error } = await supabase.rpc('rerun_cancel', { p_run: runId });
  if (error) throw dataError(error);
  return mustRead(data, 're-run');
}

// Puts a finished run back, in the background. Only an upload's latest run can be undone.
export async function undoRerun(supabase: Client, runId: number): Promise<UploadRun> {
  const { data, error } = await supabase.rpc('rerun_undo', { p_run: runId });
  if (error) throw dataError(error);
  return mustRead(data, 're-run');
}
