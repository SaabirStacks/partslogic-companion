import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { DataError, dataError } from '../core/errors';
import { readArray, readBoolean, readNumber, readRecord, readString, requireRecord, type JsonRecord } from '../core/read';
import type { CountPurpose } from './counts';

// A stock take or opening-stock run several people count together (count_runs), as count_run_status gives
// it: every planned bin, in order, with where it stands. active is false for a count nobody has scanned
// into for 2 hours, which no longer holds its bin; mine is the caller's own count.
export type SharedRunPurpose = Extract<CountPurpose, 'stock_take' | 'opening'>;
export type SharedRunBinState = 'not_started' | 'counting' | 'counted';
export type SharedRunBin = {
  binId: number;
  code: string;
  state: SharedRunBinState;
  active: boolean;
  by: string | null;
  mine: boolean;
  stocktakeId: string | null;
  units: number;
};
export type SharedRun = {
  runId: string;
  locationId: number;
  purpose: SharedRunPurpose;
  status: 'open' | 'finished';
  startedAt: string;
  startedBy: string;
  finishedAt: string | null;
  finishedBy: string | null;
  bins: SharedRunBin[];
};

const RUN_BIN_STATES: readonly SharedRunBinState[] = ['not_started', 'counting', 'counted'];

function sharedRunBin(item: Json): SharedRunBin | null {
  const row = readRecord(item);
  const binId = readNumber(row?.bin_id);
  const code = readString(row?.code);
  if (!row || binId == null || !code) return null;
  const state = RUN_BIN_STATES.find((value) => value === row.state) ?? 'not_started';
  return {
    binId,
    code,
    state,
    active: readBoolean(row.active) === true,
    by: readString(row.by),
    mine: readBoolean(row.mine) === true,
    stocktakeId: readString(row.stocktake_id),
    units: readNumber(row.units) ?? 0,
  };
}

function sharedRun(data: unknown): SharedRun {
  const row = requireRecord(data, 'The stock take could not be read.');
  const runId = readString(row.run_id);
  const locationId = readNumber(row.location_id);
  if (!runId || locationId == null) throw new DataError('The stock take could not be read.', 'P0001');
  return {
    runId,
    locationId,
    purpose: row.purpose === 'opening' ? 'opening' : 'stock_take',
    status: row.status === 'finished' ? 'finished' : 'open',
    startedAt: readString(row.started_at) ?? '',
    startedBy: readString(row.started_by) ?? 'Someone',
    finishedAt: readString(row.finished_at),
    finishedBy: readString(row.finished_by),
    bins: readArray(row.bins).flatMap((item) => sharedRunBin(item) ?? []),
  };
}

// Starts a shared stock take or opening-stock run of these bins, or joins the one already open in the
// location for the same job (created false, with that run's id). Needs signal.
export async function startCountRun(
  supabase: Client,
  input: { runId: string; locationId: number; purpose: SharedRunPurpose; binIds: number[] },
): Promise<SharedRun & { created: boolean }> {
  const { data, error } = await supabase.rpc('start_count_run', {
    p_run: input.runId,
    p_location: input.locationId,
    p_purpose: input.purpose,
    p_bins: input.binIds,
  });
  if (error) throw dataError(error);
  return { ...sharedRun(data), created: readBoolean(readRecord(data as Json)?.created) === true };
}

// Where a shared run stands now: who is counting or has counted each bin.
export async function countRunStatus(supabase: Client, runId: string): Promise<SharedRun> {
  const { data, error } = await supabase.rpc('count_run_status', { p_run: runId });
  if (error) throw dataError(error);
  return sharedRun(data);
}

// A location's open stock takes and opening-stock runs, oldest first, to join.
export async function openCountRuns(supabase: Client, locationId: number): Promise<SharedRun[]> {
  const { data, error } = await supabase.rpc('open_count_runs', { p_location: locationId });
  if (error) throw dataError(error);
  return readArray(data as Json).map((item) => sharedRun(item));
}

// Ends a shared run for everyone; counts still open on it can still finish. Safe to repeat.
export async function finishCountRun(supabase: Client, runId: string): Promise<SharedRun> {
  const { data, error } = await supabase.rpc('finish_count_run', { p_run: runId });
  if (error) throw dataError(error);
  return sharedRun(data);
}
