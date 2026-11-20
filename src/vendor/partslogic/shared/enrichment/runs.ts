import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { dataError } from '../core/errors';
import { readArray, readNumber, readRecord, readString } from '../core/read';

// An enrichment run someone started from a part (slice 2 of docs/ENRICHMENT_OVERHAUL.md). The server does the
// work after it has answered and writes its progress to the run; these read it back. state is the progress as
// the panel draws it and result is how the run ended: both are the web app's own shapes, kept as JSON here.

export type EnrichmentRunStatus = 'running' | 'done' | 'failed';

export type EnrichmentRunRecord = {
  id: number;
  partId: number;
  status: EnrichmentRunStatus;
  options: Json;
  state: Json;
  result: Json | null;
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
  // Who started it, by display name.
  by: string | null;
};

// A run in progress somewhere in the company, for the header.
export type EnrichmentRunningRun = {
  id: number;
  partId: number;
  brand: string;
  number: string;
  startedAt: string;
  state: Json;
  by: string | null;
};

export type EnrichmentRunning = {
  runs: EnrichmentRunningRun[];
  // Parts waiting in the queue (quick-add and the bulk queue), not started by a person from a part.
  queued: number;
};

export function readEnrichmentRun(value: Json | undefined): EnrichmentRunRecord | null {
  const run = readRecord(value);
  const id = readNumber(run?.id);
  const partId = readNumber(run?.part_id);
  const startedAt = readString(run?.started_at);
  if (!run || id == null || partId == null || !startedAt) return null;
  return {
    id,
    partId,
    status: run.status === 'done' || run.status === 'failed' ? run.status : 'running',
    options: run.options ?? {},
    state: run.state ?? {},
    result: run.result ?? null,
    startedAt,
    updatedAt: readString(run.updated_at) ?? startedAt,
    finishedAt: readString(run.finished_at),
    by: readString(run.by),
  };
}

export function readEnrichmentRunning(value: Json | undefined): EnrichmentRunning {
  const running = readRecord(value);
  return {
    runs: readArray(running?.runs).flatMap((item) => {
      const run = readRecord(item);
      const id = readNumber(run?.id);
      const partId = readNumber(run?.part_id);
      const number = readString(run?.number);
      const startedAt = readString(run?.started_at);
      if (!run || id == null || partId == null || !number || !startedAt) return [];
      return [{ id, partId, brand: readString(run.brand) ?? '', number, startedAt, state: run.state ?? {}, by: readString(run.by) }];
    }),
    queued: readNumber(running?.queued) ?? 0,
  };
}

// A part's newest run, or null when it has never had one (any member).
export async function getEnrichmentRun(supabase: Client, partId: number): Promise<EnrichmentRunRecord | null> {
  const { data, error } = await supabase.rpc('enrichment_run_status', { p_part: partId });
  if (error) throw dataError(error);
  return readEnrichmentRun(data);
}

// The runs in progress and how many parts wait in the queue (any member).
export async function getEnrichmentRunning(supabase: Client): Promise<EnrichmentRunning> {
  const { data, error } = await supabase.rpc('enrichment_running');
  if (error) throw dataError(error);
  return readEnrichmentRunning(data);
}
