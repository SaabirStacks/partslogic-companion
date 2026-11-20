import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readNumber, readRecord, readString } from '../core/read';
import { readPriceSheet, type PriceSheet } from '../purchasing/supplier-sheets';
import { readDelistingSummary, readImportReport, type DelistingSummary, type ImportReport, type UndoSummary } from './batches';

// What an upload changed (step 3d): its price changes as the supplier's Price sheets tab counts them, its delisting and
// undo, the supplier codes it moved to another part (an editor confirms one as a supersession or dismisses it), and the
// supersessions it stated. Undo puts back the prices it replaced and the lines it delisted, keeping every price as
// history. Rules in SQL (20261113210000: upload_changes, decide_code_move, undo_upload).

export type ChangedPart = { partId: number; brand: string; number: string };

export type CodeMove = {
  id: number;
  code: string;
  status: 'open' | 'confirmed' | 'dismissed';
  from: ChangedPart;
  to: ChangedPart;
  movedAt: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
};

// "old is replaced by new" (a supersedes link from new to old).
export type Supersession = { linkId: number; state: string; replacement: ChangedPart; replaced: ChangedPart };

export type UploadChanges = {
  batchId: string;
  sheet: PriceSheet | null;
  delisting: DelistingSummary | null;
  undo: UndoSummary | null;
  codeMoves: CodeMove[];
  supersessions: Supersession[];
};

function readPart(value: Json | undefined): ChangedPart {
  const part = readRecord(value);
  return { partId: readNumber(part?.part_id) ?? 0, brand: readString(part?.brand) ?? '', number: readString(part?.number) ?? '' };
}

export function readUploadChanges(data: Json): UploadChanges | null {
  const record = readRecord(data);
  const batchId = readString(record?.batch_id);
  if (!record || !batchId) return null;
  const undo = readRecord(record.undo);
  return {
    batchId,
    sheet: readPriceSheet(record.sheet),
    delisting: readDelistingSummary(record.delisting),
    undo: undo
      ? { closed: readNumber(undo.closed) ?? 0, restored: readNumber(undo.restored) ?? 0, relisted: readNumber(undo.relisted) ?? 0 }
      : null,
    codeMoves: readArray(record.code_moves).flatMap((item) => {
      const move = readRecord(item);
      const id = readNumber(move?.id);
      if (!move || id == null) return [];
      const status = move.status === 'confirmed' || move.status === 'dismissed' ? move.status : 'open';
      return [
        {
          id,
          code: readString(move.code) ?? '',
          status,
          from: readPart(move.from),
          to: readPart(move.to),
          movedAt: readString(move.moved_at),
          decidedAt: readString(move.decided_at),
          decidedBy: readString(move.decided_by),
        },
      ];
    }),
    supersessions: readArray(record.supersessions).flatMap((item) => {
      const row = readRecord(item);
      const linkId = readNumber(row?.link_id);
      if (!row || linkId == null) return [];
      return [{ linkId, state: readString(row.state) ?? 'stated', replacement: readPart(row.new), replaced: readPart(row.old) }];
    }),
  };
}

export async function getUploadChanges(supabase: Client, batchId: string): Promise<UploadChanges | null> {
  return call(supabase.rpc('upload_changes', { p_batch: batchId }), readUploadChanges);
}

// Editors: a moved code is a supersession (true: the new part replaces the old) or not (false).
export async function decideCodeMove(supabase: Client, moveId: number, confirm: boolean): Promise<void> {
  await call(supabase.rpc('decide_code_move', { p_move: moveId, p_confirm: confirm }), () => null);
}

// Editors: undo the supplier's latest upload (within 30 days). Returns the upload report.
export async function undoUpload(supabase: Client, batchId: string): Promise<ImportReport | null> {
  return call(supabase.rpc('undo_upload', { p_batch: batchId }), readImportReport);
}
