import type { Client } from '../core/client';
import { DataError, dataError } from '../core/errors';
import { readNumber, readRecord, readString } from '../core/read';
import { readImportSpec, type ImportSpec } from './mapping';

export type ImportProfile = { id: number; code: string; version: number; spec: ImportSpec; createdAt: string | null };

export async function getImportProfile(supabase: Client, supplierId: number): Promise<ImportProfile | null> {
  const { data, error } = await supabase.rpc('import_profile', { p_source: supplierId });
  if (error) throw dataError(error);
  const profile = readRecord(data);
  const id = readNumber(profile?.id);
  const code = readString(profile?.code);
  const version = readNumber(profile?.version);
  const spec = readImportSpec(profile?.spec);
  if (id == null || !code || version == null || !spec) return null;
  return { id, code, version, spec, createdAt: readString(profile?.created_at) };
}

export async function saveImportProfile(
  supabase: Client,
  supplierId: number,
  spec: ImportSpec,
): Promise<{ id: number; code: string; version: number; unchanged: boolean }> {
  const { data, error } = await supabase.rpc('save_import_profile', { p_source: supplierId, p_spec: spec });
  if (error) throw dataError(error);
  const saved = readRecord(data);
  const id = readNumber(saved?.id);
  const code = readString(saved?.code);
  const version = readNumber(saved?.version);
  if (id == null || !code || version == null) throw new DataError('The mapping was not saved.', 'P0001');
  return { id, code, version, unchanged: saved?.unchanged === true };
}
