import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@partslogic/db-types';

import { dataError } from './errors';
import { readNumber, readRecord, readString } from './read';

type Client = SupabaseClient<Database>;

export type SupplierUpload = {
  batchId: string;
  file: string;
  status: string;
  rows: number | null;
  createdAt: string;
};

// A supplier you buy from: price-list and manual sources, with whether a column mapping is saved.
export type SupplierOption = {
  supplierId: number;
  name: string;
  kind: string;
  hasProfile: boolean;
  lastUpload: SupplierUpload | null;
};

export async function listSupplierOptions(supabase: Client): Promise<SupplierOption[]> {
  const { data, error } = await supabase.rpc('supplier_options');
  if (error) throw dataError(error);
  return (data ?? []).flatMap((row) => {
    if (row.source_id == null || row.name == null) return [];
    const last = readRecord(row.last_upload);
    const batchId = readString(last?.batch_id);
    const file = readString(last?.file);
    const createdAt = readString(last?.created_at);
    return [
      {
        supplierId: row.source_id,
        name: row.name,
        kind: row.kind ?? 'price_list',
        hasProfile: row.has_profile === true,
        lastUpload:
          batchId && file && createdAt
            ? { batchId, file, status: readString(last?.status) ?? 'uploaded', rows: readNumber(last?.rows), createdAt }
            : null,
      },
    ];
  });
}

// Creates a supplier (editors). Returns its id.
export async function createSupplier(supabase: Client, name: string): Promise<number> {
  const { data, error } = await supabase.rpc('create_supplier', { p_name: name.trim() });
  if (error) throw dataError(error);
  return data;
}

// Sets the supplier's own code for a part (refused when the supplier uses it for another part).
export async function setSupplierCode(supabase: Client, partId: number, supplierId: number, code: string): Promise<void> {
  const { error } = await supabase.rpc('set_supplier_code', { p_part: partId, p_source: supplierId, p_code: code.trim() });
  if (error) throw dataError(error);
}

export async function removeSupplierCode(supabase: Client, supplierId: number, code: string): Promise<void> {
  const { error } = await supabase.rpc('remove_supplier_code', { p_source: supplierId, p_code: code });
  if (error) throw dataError(error);
}
