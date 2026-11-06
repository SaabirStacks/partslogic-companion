import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { dataError } from '../core/errors';
import { readArray, readNumber, readRecord, readString } from '../core/read';
import { isPlacedVia, type PlacedVia } from './placed-via';

// A supplier's delivery terms: carriage, free delivery, minimum order, how to order, and delivery runs (the van
// timetable). Every rule lives in SQL (public.save_supplier_delivery_terms, purchasing.next_arrival,
// docs/GOODS_IN.md); this file shapes what is sent and read.

// ISO weekdays: 1 is Monday, 7 is Sunday.
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export const WEEKDAY_SHORT: Record<Weekday, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };

// One van: orders in by orderBy ("10:30") catch it; it arrives leadDays run days later (0 = the same day).
export type DeliveryRun = {
  id?: number;
  name: string;
  orderBy: string;
  leadDays: number;
  arrivesFrom: string | null;
  arrivesBy: string | null;
  days: Weekday[];
};

export type DeliveryTerms = {
  carriageCharge: number | null;
  // Goods ex VAT at or over which carriage is free.
  freeDeliveryAt: number | null;
  minOrderValue: number | null;
  orderMethod: PlacedVia | null;
  portalUrl: string | null;
  orderPhone: string | null;
  orderEmail: string | null;
  runs: DeliveryRun[];
};

// Only the fields given change; null clears one. runs replaces the whole timetable.
export type DeliveryTermsChanges = Partial<Omit<DeliveryTerms, 'runs'>> & { runs?: DeliveryRun[] };

// The next cut-off for a supplier, and when an order placed now should arrive.
export type NextDelivery = {
  runId: number;
  run: string;
  cutoffAt: string;
  arrivesOn: string;
  arrivesFrom: string | null;
  arrivesBy: string | null;
};

export const EMPTY_DELIVERY_TERMS: DeliveryTerms = {
  carriageCharge: null,
  freeDeliveryAt: null,
  minOrderValue: null,
  orderMethod: null,
  portalUrl: null,
  orderPhone: null,
  orderEmail: null,
  runs: [],
};

function isWeekday(value: unknown): value is Weekday {
  return typeof value === 'number' && (WEEKDAYS as readonly number[]).includes(value);
}

function readRun(value: Json): DeliveryRun | null {
  const row = readRecord(value);
  const name = readString(row?.name);
  const orderBy = readString(row?.order_by);
  if (!row || !name || !orderBy) return null;
  return {
    id: readNumber(row.id) ?? undefined,
    name,
    orderBy,
    leadDays: readNumber(row.lead_days) ?? 1,
    arrivesFrom: readString(row.arrives_from),
    arrivesBy: readString(row.arrives_by),
    days: readArray(row.days).map((day) => readNumber(day)).filter(isWeekday),
  };
}

export function readDeliveryTerms(value: Json | null | undefined): DeliveryTerms {
  const row = readRecord(value ?? undefined);
  if (!row) return EMPTY_DELIVERY_TERMS;
  const method = readString(row.order_method);
  return {
    carriageCharge: readNumber(row.carriage_charge),
    freeDeliveryAt: readNumber(row.free_delivery_at),
    minOrderValue: readNumber(row.min_order_value),
    orderMethod: isPlacedVia(method) ? method : null,
    portalUrl: readString(row.portal_url),
    orderPhone: readString(row.order_phone),
    orderEmail: readString(row.order_email),
    runs: readArray(row.runs).flatMap((item) => readRun(item) ?? []),
  };
}

export function readNextDelivery(value: Json | null | undefined): NextDelivery | null {
  const row = readRecord(value ?? undefined);
  const runId = readNumber(row?.run_id);
  const run = readString(row?.run);
  const cutoffAt = readString(row?.cutoff_at);
  const arrivesOn = readString(row?.arrives_on);
  if (!row || runId == null || !run || !cutoffAt || !arrivesOn) return null;
  return { runId, run, cutoffAt, arrivesOn, arrivesFrom: readString(row.arrives_from), arrivesBy: readString(row.arrives_by) };
}

function runJson(run: DeliveryRun): Record<string, Json> {
  return {
    name: run.name,
    order_by: run.orderBy,
    lead_days: run.leadDays,
    arrives_from: run.arrivesFrom,
    arrives_by: run.arrivesBy,
    days: [...run.days],
  };
}

export function deliveryTermsJson(changes: DeliveryTermsChanges): Record<string, Json> {
  const p: Record<string, Json> = {};
  const keys: [keyof Omit<DeliveryTermsChanges, 'runs'>, string][] = [
    ['carriageCharge', 'carriage_charge'],
    ['freeDeliveryAt', 'free_delivery_at'],
    ['minOrderValue', 'min_order_value'],
    ['orderMethod', 'order_method'],
    ['portalUrl', 'portal_url'],
    ['orderPhone', 'order_phone'],
    ['orderEmail', 'order_email'],
  ];
  for (const [key, column] of keys) {
    if (changes[key] !== undefined) p[column] = changes[key] as Json;
  }
  if (changes.runs !== undefined) p.runs = changes.runs.map(runJson);
  return p;
}

// Saves a supplier's terms. Returns the terms as saved.
export async function saveSupplierDeliveryTerms(supabase: Client, supplierId: number, changes: DeliveryTermsChanges): Promise<DeliveryTerms> {
  const { data, error } = await supabase.rpc('save_supplier_delivery_terms', { p_source: supplierId, p: deliveryTermsJson(changes) });
  if (error) throw dataError(error);
  return readDeliveryTerms(readRecord(data as Json)?.delivery);
}

export async function supplierNextDelivery(supabase: Client, supplierId: number, at?: Date): Promise<NextDelivery | null> {
  const { data, error } = await supabase.rpc('supplier_next_delivery', { p_source: supplierId, p_at: at?.toISOString() });
  if (error) throw dataError(error);
  return readNextDelivery(data as Json);
}

// "Mon–Fri", "Mon–Sat", "Mon, Wed, Fri", "Every day".
export function runDaysText(days: readonly Weekday[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (sorted.length === 7) return 'Every day';
  if (first === undefined || last === undefined) return 'No days';
  if (sorted.length >= 3 && last - first === sorted.length - 1) return `${WEEKDAY_SHORT[first]}–${WEEKDAY_SHORT[last]}`;
  return sorted.map((day) => WEEKDAY_SHORT[day]).join(', ');
}

// "Same day", "Next delivery day", "3 delivery days later".
export function leadText(leadDays: number): string {
  if (leadDays <= 0) return 'Same day';
  if (leadDays === 1) return 'Next delivery day';
  return `${leadDays} delivery days later`;
}

// "13:00–15:00", "by 10:00", "from 13:00", or null.
export function windowText(from: string | null, by: string | null): string | null {
  if (from && by) return `${from}–${by}`;
  if (by) return `by ${by}`;
  if (from) return `from ${from}`;
  return null;
}

// Cut-offs and windows are local times where the company is (workspace.time_zone).
export const DEFAULT_TIME_ZONE = 'Europe/London';

// The calendar date (YYYY-MM-DD) at a moment, in a time zone.
export function localDate(at: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// "today", "tomorrow", or "Mon 9 Nov".
export function dayText(isoDate: string, now: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  const today = localDate(now, timeZone);
  if (isoDate === today) return 'today';
  if (isoDate === addDays(today, 1)) return 'tomorrow';
  if (isoDate === addDays(today, -1)) return 'yesterday';
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${isoDate}T12:00:00Z`),
  );
}

// "today, 13:00–15:00" or "Tue 10 Nov".
export function arrivalText(isoDate: string, from: string | null, by: string | null, now: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  const window = windowText(from, by);
  return `${dayText(isoDate, now, timeZone)}${window ? `, ${window}` : ''}`;
}

// "10:30 today (Afternoon van, 42 minutes left)" or "16:30 Mon 9 Nov (Morning van)".
export function cutoffText(next: NextDelivery, now: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  const cutoff = new Date(next.cutoffAt);
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).format(cutoff);
  const minutes = Math.ceil((cutoff.getTime() - now.getTime()) / 60_000);
  const left = minutes > 0 && minutes < 120 ? `, ${minutes === 1 ? '1 minute' : `${minutes} minutes`} left` : '';
  return `${time} ${dayText(localDate(cutoff, timeZone), now, timeZone)} (${next.run}${left})`;
}
