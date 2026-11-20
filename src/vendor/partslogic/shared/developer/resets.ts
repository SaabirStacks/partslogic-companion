import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readBoolean, readNumber, readRecord, readString } from '../core/read';

// Area resets for setting a company up (developers only). Every rule is in SQL (20261112150000_developer_tools:
// developer.pieces, developer.included, public.developer_reset_*): the database says what an area takes with it, counts
// it, pages out the backup, refuses a backup that doesn't match, and deletes in short steps. This file reads and sends.

export const RESET_AREAS = ['stock', 'purchasing', 'suppliers', 'customers'] as const;
export type ResetArea = (typeof RESET_AREAS)[number];

export const RESET_AREA_LABELS: Record<ResetArea, string> = {
  stock: 'Stock list',
  purchasing: 'Purchasing',
  suppliers: 'Suppliers',
  customers: 'Customers',
};

export function isResetArea(value: unknown): value is ResetArea {
  return typeof value === 'string' && (RESET_AREAS as readonly string[]).includes(value);
}

export type ResetPiece = { n: number; area: ResetArea; label: string; table: string; rows: number };

export type ResetRunSummary = {
  id: number;
  area: ResetArea;
  label: string;
  total: number;
  deleted: number;
  startedAt: string;
};

export type ResetHistoryEntry = {
  id: number;
  areas: ResetArea[];
  deleted: number;
  status: 'running' | 'done';
  startedAt: string;
  finishedAt: string | null;
  backupSha256: string;
  backupRows: number;
  by: string;
};

export type ResetPreview = {
  area: ResetArea;
  label: string;
  // Every area the reset clears, in order: anything hanging on the area first.
  areas: { area: ResetArea; label: string }[];
  pieces: ResetPiece[];
  total: number;
  // Suppliers a Suppliers reset leaves, and why (the catalogue rests on them).
  kept: { name: string; reason: string }[];
  // A reset still running, of any area, to carry on with.
  running: ResetRunSummary | null;
  history: ResetHistoryEntry[];
};

export type BackupPage = { n: number; label: string; table: string; rows: Json[]; next: string | null };

export type ResetStep = { id: number; done: boolean; deleted: number; total: number; left: number; at: string | null };

function readArea(value: Json | undefined): ResetArea | null {
  return isResetArea(value) ? value : null;
}

export function readResetPreview(data: Json): ResetPreview {
  const record = readRecord(data) ?? {};
  const area = readArea(record.area) ?? 'purchasing';
  const running = readRecord(record.running);
  return {
    area,
    label: readString(record.label) ?? RESET_AREA_LABELS[area],
    areas: readArray(record.areas).flatMap((item) => {
      const entry = readRecord(item);
      const key = readArea(entry?.area);
      return key ? [{ area: key, label: readString(entry?.label) ?? RESET_AREA_LABELS[key] }] : [];
    }),
    pieces: readArray(record.pieces).flatMap((item) => {
      const piece = readRecord(item);
      const n = readNumber(piece?.n);
      const pieceArea = readArea(piece?.area);
      if (!piece || n === null || !pieceArea) return [];
      return [
        {
          n,
          area: pieceArea,
          label: readString(piece.label) ?? '',
          table: readString(piece.table) ?? '',
          rows: readNumber(piece.rows) ?? 0,
        },
      ];
    }),
    total: readNumber(record.total) ?? 0,
    kept: readArray(record.kept).flatMap((item) => {
      const entry = readRecord(item);
      const name = readString(entry?.name);
      return name ? [{ name, reason: readString(entry?.reason) ?? '' }] : [];
    }),
    running:
      running && readNumber(running.id) !== null
        ? {
            id: readNumber(running.id) ?? 0,
            area: readArea(running.area) ?? area,
            label: readString(running.label) ?? '',
            total: readNumber(running.total) ?? 0,
            deleted: readNumber(running.deleted) ?? 0,
            startedAt: readString(running.started_at) ?? '',
          }
        : null,
    history: readArray(record.history).flatMap((item) => {
      const entry = readRecord(item);
      const id = readNumber(entry?.id);
      if (!entry || id === null) return [];
      return [
        {
          id,
          areas: readArray(entry.areas).flatMap((a) => (isResetArea(a) ? [a] : [])),
          deleted: readNumber(entry.deleted) ?? 0,
          status: entry.status === 'running' ? 'running' : 'done',
          startedAt: readString(entry.started_at) ?? '',
          finishedAt: readString(entry.finished_at),
          backupSha256: readString(entry.backup_sha256) ?? '',
          backupRows: readNumber(entry.backup_rows) ?? 0,
          by: readString(entry.by) ?? 'Someone',
        },
      ];
    }),
  };
}

export function readBackupPage(data: Json): BackupPage {
  const record = readRecord(data) ?? {};
  return {
    n: readNumber(record.n) ?? 0,
    label: readString(record.label) ?? '',
    table: readString(record.table) ?? '',
    rows: readArray(record.rows),
    next: readString(record.next),
  };
}

export function readResetStep(data: Json): ResetStep {
  const record = readRecord(data) ?? {};
  return {
    id: readNumber(record.id) ?? 0,
    done: readBoolean(record.done) ?? false,
    deleted: readNumber(record.deleted) ?? 0,
    total: readNumber(record.total) ?? 0,
    left: readNumber(record.left) ?? 0,
    at: readString(record.at),
  };
}

// How far a reset has got, 0 to 1. Removing selling prices writes price history the reset then clears, so a run can
// delete more rows than it counted at the start: progress is what has gone against what has gone plus what is left.
export function resetProgress(step: Pick<ResetStep, 'deleted' | 'left' | 'done'>): number {
  if (step.done) return 1;
  const seen = step.deleted + step.left;
  return seen > 0 ? Math.min(step.deleted / seen, 1) : 0;
}

export async function previewReset(supabase: Client, area: ResetArea): Promise<ResetPreview> {
  return call(supabase.rpc('developer_reset_preview', { p_area: area }), readResetPreview);
}

// One page of the backup: piece n's rows after `after` (null for the first page).
export async function getBackupPage(
  supabase: Client,
  area: ResetArea,
  piece: number,
  after: string | null,
  limit = 2000,
): Promise<BackupPage> {
  return call(
    supabase.rpc('developer_backup_page', {
      p_area: area,
      p_piece: piece,
      p_limit: limit,
      ...(after ? { p_after: after } : {}),
    }),
    readBackupPage,
  );
}

export type ResetConfirmation = { confirm: string; backupSha256: string; backupRows: number; backupBytes: number };

export async function startReset(supabase: Client, area: ResetArea, confirmation: ResetConfirmation): Promise<number> {
  return call(
    supabase.rpc('developer_start_reset', {
      p_area: area,
      p: {
        confirm: confirmation.confirm,
        backup_sha256: confirmation.backupSha256,
        backup_rows: confirmation.backupRows,
        backup_bytes: confirmation.backupBytes,
      },
    }),
    (data) => readNumber(data) ?? 0,
  );
}

export async function runResetStep(supabase: Client, runId: number): Promise<ResetStep> {
  return call(supabase.rpc('developer_reset_step', { p_run: runId }), readResetStep);
}
