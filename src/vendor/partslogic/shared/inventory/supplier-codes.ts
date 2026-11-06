import type { Client } from '../core/client';
import { dataError } from '../core/errors';

// Sets the supplier's own code for a part (refused when the supplier uses it for another part).
export async function setSupplierCode(supabase: Client, partId: number, supplierId: number, code: string): Promise<void> {
  const { error } = await supabase.rpc('set_supplier_code', { p_part: partId, p_source: supplierId, p_code: code.trim() });
  if (error) throw dataError(error);
}

export async function removeSupplierCode(supabase: Client, supplierId: number, code: string): Promise<void> {
  const { error } = await supabase.rpc('remove_supplier_code', { p_source: supplierId, p_code: code });
  if (error) throw dataError(error);
}
