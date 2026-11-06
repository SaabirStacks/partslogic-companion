import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { DataError, dataError } from '../core/errors';
import { readBoolean, readNumber, readRecord, readString, requireRecord, type JsonRecord } from '../core/read';

export type QuickAddResult =
  | {
      status: 'added';
      partId: number;
      createdPart: boolean;
      createdBrand: boolean;
      wasInInventory: boolean;
      enrichSuggested: boolean;
      healed: number;
    }
  | {
      status: 'conflict';
      conflict: 'barcode_held' | 'label_held';
      code: string;
      holder: { partId: number; brand: string; number: string } | null;
    };

// Creates (or finds) a part from a brand and number and keeps the scanned code on it. A code another part
// already holds comes back as a conflict, and nothing is created.
export async function quickAddPart(
  supabase: Client,
  input: { brandId?: number; brandName?: string; number: string; code?: string; confirmNewBrand?: boolean },
): Promise<QuickAddResult> {
  const payload: Record<string, Json> = { number: input.number };
  if (input.brandId != null) payload.brand_id = input.brandId;
  if (input.brandName) payload.brand_name = input.brandName;
  if (input.code) payload.code = input.code;
  if (input.confirmNewBrand) payload.confirm_new_brand = true;
  const { data, error } = await supabase.rpc('quick_add_part', { p: payload });
  if (error) throw dataError(error);
  const row = requireRecord(data, 'The part was not added.');
  const conflict = readString(row.conflict);
  if (conflict === 'barcode_held' || conflict === 'label_held') {
    const holder = readRecord(row.holder);
    const holderId = readNumber(holder?.part_id);
    return {
      status: 'conflict',
      conflict,
      code: readString(row.code) ?? input.code ?? '',
      holder:
        holderId != null
          ? { partId: holderId, brand: readString(holder?.brand) ?? '', number: readString(holder?.number) ?? '' }
          : null,
    };
  }
  const partId = readNumber(row.part_id);
  if (partId == null) throw new DataError('The part was not added.', 'P0001');
  return {
    status: 'added',
    partId,
    createdPart: readBoolean(row.created_part) === true,
    createdBrand: readBoolean(row.created_brand) === true,
    wasInInventory: readBoolean(row.was_in_inventory) === true,
    enrichSuggested: readBoolean(row.enrich_suggested) === true,
    healed: readNumber(row.healed) ?? 0,
  };
}
