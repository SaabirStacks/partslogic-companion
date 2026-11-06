import type { Client } from '../core/client';
import { dataError } from '../core/errors';
import { readNumber } from '../core/read';

export type EngineSetting = { key: string; value: number; description: string; updatedAt: string };

export async function listEngineSettings(supabase: Client): Promise<EngineSetting[]> {
  const { data, error } = await supabase.rpc('catalogue_settings');
  if (error) throw dataError(error);
  return (data ?? []).flatMap((row) =>
    row.key == null || row.value == null
      ? []
      : [{ key: row.key, value: readNumber(row.value) ?? 0, description: row.description ?? '', updatedAt: row.updated_at ?? '' }],
  );
}
