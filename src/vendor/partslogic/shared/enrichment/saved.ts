import type { Client } from '../core/client';
import { dataError } from '../core/errors';
import { readNumber, readRecord } from '../core/read';

// Saved Autodoc pages applied again under today's reading rules (slice 3 of docs/ENRICHMENT_OVERHAUL.md). A page
// is paid for once; when the rules that read it improve (names, descriptions, the barcode rule), it is applied
// again from what was saved, with no call and no charge.

export type SavedPagesPass = {
  applied: number;
  // Still another part's page under today's rules.
  refused: number;
  failed: number;
  // Pages still to apply after this pass.
  remaining: number;
};

// Applies up to `limit` saved pages again (admin). A limit of 0 only counts what there is to apply.
export async function reapplySavedPages(supabase: Client, limit: number): Promise<SavedPagesPass> {
  const { data, error } = await supabase.rpc('enrichment_reapply_saved', { p_limit: limit });
  if (error) throw dataError(error);
  const pass = readRecord(data);
  return {
    applied: readNumber(pass?.applied) ?? 0,
    refused: readNumber(pass?.refused) ?? 0,
    failed: readNumber(pass?.failed) ?? 0,
    remaining: readNumber(pass?.remaining) ?? 0,
  };
}
