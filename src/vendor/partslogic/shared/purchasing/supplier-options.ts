import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { dataError } from '../core/errors';
import { readNumber, readRecord, readString } from '../core/read';

// A supplier's newest price sheet uploaded as a file.
export type SupplierUpload = {
  batchId: string;
  file: string;
  status: string;
  rows: number | null;
  createdAt: string;
};

export function readSupplierUpload(value: Json | undefined): SupplierUpload | null {
  const upload = readRecord(value);
  const batchId = readString(upload?.batch_id);
  const file = readString(upload?.file);
  const createdAt = readString(upload?.created_at);
  if (!batchId || !file || !createdAt) return null;
  return { batchId, file, status: readString(upload?.status) ?? 'uploaded', rows: readNumber(upload?.rows), createdAt };
}

// A supplier you buy from: price-list and manual sources, with whether a column mapping is saved. Archived
// suppliers aren't offered; one on hold is, marked as such.
export type SupplierOption = {
  supplierId: number;
  name: string;
  kind: string;
  hasProfile: boolean;
  lastUpload: SupplierUpload | null;
  status: 'active' | 'on_hold';
};

export async function listSupplierOptions(supabase: Client): Promise<SupplierOption[]> {
  const { data, error } = await supabase.rpc('supplier_options');
  if (error) throw dataError(error);
  return (data ?? []).flatMap((row) => {
    if (row.source_id == null || row.name == null) return [];
    return [
      {
        supplierId: row.source_id,
        name: row.name,
        kind: row.kind ?? 'price_list',
        hasProfile: row.has_profile === true,
        lastUpload: readSupplierUpload(row.last_upload),
        status: row.status === 'on_hold' ? 'on_hold' : 'active',
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
