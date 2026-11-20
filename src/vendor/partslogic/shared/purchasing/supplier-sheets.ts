import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readNumber, readRecord, readString } from '../core/read';

// A supplier's price sheets (step 12): each upload with what it changed and the stocked parts whose cost moved more
// than 10%, and how fresh their last sheet is against how often they should send one. Rules in SQL
// (20261113090000: supplier_price_sheets, purchasing.sheet_freshness, save_supplier_sheet_schedule).

export type SheetFreshness = {
  // How often they should send a sheet, in days; null: no reminder.
  everyDays: number | null;
  lastAt: string | null;
  ageDays: number | null;
  // Days past due; 0 when one is expected and none has come; null when it isn't overdue or there's no schedule.
  overdueDays: number | null;
};

export type SheetChanges = {
  written: number;
  new: number;
  up: number;
  down: number;
  // Multiples, list price or surcharge changed, cost didn't.
  other: number;
  unchanged: number;
  averageChange: number | null;
};

export type SheetMover = {
  partId: number;
  brand: string | null;
  number: string;
  description: string | null;
  was: number;
  now: number;
  change: number;
  onHand: number;
  sell: number | null;
  // At today's sell price, at the old and the new cost.
  marginWas: number | null;
  marginNow: number | null;
};

export type PriceSheet = {
  batchId: string;
  file: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  by: string | null;
  rows: number;
  applied: number;
  setAside: number;
  changes: SheetChanges;
  // Stocked parts whose cost moved more than 10%; movers lists the 25 biggest.
  stockedMoved: number;
  movers: SheetMover[];
  // Set when the upload was undone (step 3d): its prices stay in the history, marked undone.
  undoneAt: string | null;
};

export type SupplierPriceSheets = { sheets: PriceSheet[]; freshness: SheetFreshness };

const num = (value: Json | undefined) => readNumber(value) ?? 0;

export function readSheetFreshness(value: Json | undefined): SheetFreshness {
  const record = readRecord(value) ?? {};
  return {
    everyDays: readNumber(record.every_days),
    lastAt: readString(record.last_at),
    ageDays: readNumber(record.age_days),
    overdueDays: readNumber(record.overdue_days),
  };
}

function readChanges(value: Json | undefined): SheetChanges {
  const record = readRecord(value) ?? {};
  return {
    written: num(record.written),
    new: num(record.new),
    up: num(record.up),
    down: num(record.down),
    other: num(record.other),
    unchanged: num(record.unchanged),
    averageChange: readNumber(record.average_change),
  };
}

// One sheet of supplier_price_sheets (also the sheet upload_changes returns). Null when it isn't one.
export function readPriceSheet(item: Json | undefined): PriceSheet | null {
  const sheet = readRecord(item);
  const batchId = readString(sheet?.batch_id);
  if (!sheet || !batchId) return null;
  return {
    batchId,
    file: readString(sheet.file) ?? 'Price sheet',
    status: readString(sheet.status) ?? 'completed',
    createdAt: readString(sheet.created_at) ?? '',
    completedAt: readString(sheet.completed_at),
    by: readString(sheet.by),
    rows: num(sheet.rows),
    applied: num(sheet.applied),
    setAside: num(sheet.set_aside),
    changes: readChanges(sheet.changes),
    stockedMoved: num(sheet.stocked_moved),
    undoneAt: readString(sheet.undone_at),
    movers: readArray(sheet.movers).flatMap((m) => {
      const mover = readRecord(m);
      const partId = readNumber(mover?.part_id);
      const number = readString(mover?.number);
      const was = readNumber(mover?.was);
      const now = readNumber(mover?.now);
      if (!mover || partId == null || !number || was == null || now == null) return [];
      return [
        {
          partId,
          brand: readString(mover.brand),
          number,
          description: readString(mover.description),
          was,
          now,
          change: num(mover.change),
          onHand: num(mover.on_hand),
          sell: readNumber(mover.sell),
          marginWas: readNumber(mover.margin_was),
          marginNow: readNumber(mover.margin_now),
        },
      ];
    }),
  };
}

export function readSupplierPriceSheets(data: Json): SupplierPriceSheets {
  const record = readRecord(data) ?? {};
  return {
    freshness: readSheetFreshness(record.freshness),
    sheets: readArray(record.sheets).flatMap((item) => {
      const sheet = readPriceSheet(item);
      return sheet ? [sheet] : [];
    }),
  };
}

export async function getSupplierPriceSheets(supabase: Client, supplierId: number): Promise<SupplierPriceSheets | null> {
  return call(supabase.rpc('supplier_price_sheets', { p_source: supplierId }), (data) =>
    data == null ? null : readSupplierPriceSheets(data),
  );
}

// Editors: how often they should send a sheet (null: no reminder). Returns the freshness.
export async function saveSupplierSheetSchedule(
  supabase: Client,
  supplierId: number,
  everyDays: number | null,
): Promise<SheetFreshness> {
  return call(
    supabase.rpc('save_supplier_sheet_schedule', {
      p_source: supplierId,
      // Null clears the reminder; the generated type has no null for a plain integer argument.
      p_every_days: everyDays as number,
    }),
    readSheetFreshness,
  );
}
