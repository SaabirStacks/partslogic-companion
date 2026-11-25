import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readBoolean, readNumber, readRecord, readString } from '../core/read';
import { PICK_METHODS, SHORT_PICK_REASONS, readPickingRow, type PickMethod, type PickingRow, type ShortPickReason } from './picking';

// Pick jobs (S5b-1, docs/design-checks/phone-picking.md): the phone's claimed batch. Start picking takes the next orders
// at the branch (urgent first, then the oldest, up to 10) and holds them for the picker, so two pickers never walk the
// same bins; Finish or Stop lets them go, and so do two quiet hours. Each scan goes through pickLine with the job. The
// database decides the claim, the order of the rows and what stands; these read its answers.

export const PICK_JOB_ENDINGS = ['finished', 'stopped', 'expired'] as const;
export type PickJobEnding = (typeof PICK_JOB_ENDINGS)[number];

// Before a job: what the branch has to pick and pack, and the picker's own job if one is running.
export type PickJobStatus = {
  locationId: number | null;
  location: string | null;
  toPick: number;
  orders: number;
  // Orders nobody holds, which Start picking would take from.
  freeOrders: number;
  toPack: number;
  job: { id: string; picked: number; toPick: number } | null;
  canPick: boolean;
  now: string;
};

export type PickJobOrder = { id: string; number: string; customer: string | null; urgent: boolean; method: string; fulfilment: string | null };

export type PickJobPick = {
  pickId: number;
  lineId: number;
  orderId: string;
  binId: number;
  bin: string;
  partId: number;
  qty: number;
  short: number;
  reason: ShortPickReason | null;
  method: PickMethod;
};

export type PickJob = {
  id: string;
  locationId: number | null;
  location: string | null;
  startedAt: string;
  endedAt: string | null;
  endedHow: PickJobEnding | null;
  orders: PickJobOrder[];
  // Still to pick, in walking order, urgent first.
  rows: PickingRow[];
  // What the job has picked and still stands.
  picked: PickJobPick[];
  now: string;
};

function oneOf<T extends string>(values: readonly T[], value: Json | undefined): T | null {
  return typeof value === 'string' && (values as readonly string[]).includes(value) ? (value as T) : null;
}

export function readPickJobStatus(value: Json): PickJobStatus {
  const row = readRecord(value) ?? {};
  const job = readRecord(row.job);
  const jobId = readString(job?.id);
  return {
    locationId: readNumber(row.location_id),
    location: readString(row.location),
    toPick: readNumber(row.to_pick) ?? 0,
    orders: readNumber(row.orders) ?? 0,
    freeOrders: readNumber(row.free_orders) ?? 0,
    toPack: readNumber(row.to_pack) ?? 0,
    job: job && jobId ? { id: jobId, picked: readNumber(job.picked) ?? 0, toPick: readNumber(job.to_pick) ?? 0 } : null,
    canPick: readBoolean(row.can_pick) ?? false,
    now: readString(row.now) ?? new Date().toISOString(),
  };
}

export function readPickJob(value: Json | undefined): PickJob | null {
  const row = readRecord(value);
  const id = readString(row?.id);
  if (!row || !id) return null;
  return {
    id,
    locationId: readNumber(row.location_id),
    location: readString(row.location),
    startedAt: readString(row.started_at) ?? '',
    endedAt: readString(row.ended_at),
    endedHow: oneOf(PICK_JOB_ENDINGS, row.ended_how),
    orders: readArray(row.orders).flatMap((item) => {
      const order = readRecord(item);
      const orderId = readString(order?.id);
      if (!order || !orderId) return [];
      return [
        {
          id: orderId,
          number: readString(order.number) ?? '',
          customer: readString(order.customer),
          urgent: readBoolean(order.urgent) ?? false,
          method: readString(order.method) ?? 'collection',
          fulfilment: readString(order.fulfilment),
        },
      ];
    }),
    rows: readArray(row.rows).flatMap(readPickingRow),
    picked: readArray(row.picked).flatMap((item) => {
      const pick = readRecord(item);
      const pickId = readNumber(pick?.pick_id);
      const lineId = readNumber(pick?.line_id);
      const orderId = readString(pick?.order_id);
      const binId = readNumber(pick?.bin_id);
      if (!pick || pickId == null || lineId == null || !orderId || binId == null) return [];
      return [
        {
          pickId,
          lineId,
          orderId,
          binId,
          bin: readString(pick.bin) ?? '',
          partId: readNumber(pick.part_id) ?? 0,
          qty: readNumber(pick.qty) ?? 0,
          short: readNumber(pick.short) ?? 0,
          reason: oneOf(SHORT_PICK_REASONS, pick.reason),
          method: oneOf(PICK_METHODS, pick.method) ?? 'scan',
        },
      ];
    }),
    now: readString(row.now) ?? new Date().toISOString(),
  };
}

export function getPickJobStatus(supabase: Client, options: { locationId?: number | null } = {}): Promise<PickJobStatus> {
  const p: { [key: string]: Json } = {};
  if (options.locationId != null) p.location_id = options.locationId;
  return call(supabase.rpc('pick_job_status', { p }), readPickJobStatus);
}

// Start picking: carries on the picker's own job, or claims the next orders. job is null when nothing is free to pick.
export function startPickJob(supabase: Client, options: { locationId?: number | null } = {}): Promise<{ job: PickJob | null; resumed: boolean }> {
  const p: { [key: string]: Json } = {};
  if (options.locationId != null) p.location_id = options.locationId;
  return call(supabase.rpc('pick_job_start', { p }), (value) => {
    const row = readRecord(value) ?? {};
    return { job: readPickJob(row.job), resumed: readBoolean(row.resumed) ?? false };
  });
}

export function getPickJob(supabase: Client, jobId: string): Promise<PickJob | null> {
  return call(supabase.rpc('pick_job', { p_job: jobId }), (value) => readPickJob(value));
}

// Finish or Stop: the job's orders are free again; what it picked stays picked and goes into each order's history.
export function endPickJob(
  supabase: Client,
  end: { jobId: string; how: Exclude<PickJobEnding, 'expired'> },
): Promise<{ job: PickJob | null; pickedUnits: number; shortUnits: number }> {
  return call(supabase.rpc('pick_job_end', { p: { job_id: end.jobId, how: end.how } }), (value) => {
    const row = readRecord(value) ?? {};
    return { job: readPickJob(value), pickedUnits: readNumber(row.picked_units) ?? 0, shortUnits: readNumber(row.short_units) ?? 0 };
  });
}

// Take back the last scan of a row (or qty of them): those units go back to their bin.
export function unscanPick(supabase: Client, unscan: { pickId: number; qty?: number }): Promise<{ pickId: number; returned: number; qty: number }> {
  const p: { [key: string]: Json } = { pick_id: unscan.pickId };
  if (unscan.qty != null) p.qty = unscan.qty;
  return call(supabase.rpc('pick_job_unscan', { p }), (value) => {
    const row = readRecord(value) ?? {};
    return { pickId: readNumber(row.pick_id) ?? unscan.pickId, returned: readNumber(row.returned) ?? 0, qty: readNumber(row.qty) ?? 0 };
  });
}
