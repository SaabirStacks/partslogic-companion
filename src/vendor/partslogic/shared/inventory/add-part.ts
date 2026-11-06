import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { DataError, dataError } from '../core/errors';
import { readBoolean, readNumber, readRecord, readString } from '../core/read';
import type { PartKind } from './items';

// A catalogue search hit for the Add dialog, with whether it is already in your inventory.
export type PartToAdd = {
  partId: number;
  brand: string;
  number: string;
  kind: PartKind;
  description: string | null;
  matchType: string;
  score: number;
  inInventory: boolean;
  isStocked: boolean;
  onHand: number;
  sku: string | null;
  displayName: string | null;
  hasBarcode: boolean;
  imageUrl: string | null;
};

export type SkuCheck = {
  available: boolean;
  heldBy: { partId: number; brand: string; number: string } | null;
};

export type AddInventoryInput = {
  // A catalogue part, or a bare part from brand (id, or a name to create) + number.
  partId?: number | null;
  brandId?: number | null;
  brandName?: string | null;
  confirmNewBrand?: boolean;
  number?: string | null;
  description?: string | null;
  barcode?: string | null;
  sku?: string | null;
  displayName?: string | null;
  supplierId?: number | null;
  supplierCode?: string | null;
  cost?: number | null;
  // The supplier's exchange surcharge (ex VAT) with that cost; 0 clears it, leaving it out keeps theirs.
  surcharge?: number | null;
  opening?: { binId?: number | null; qty: number } | null;
};

export type AddInventoryResult = {
  partId: number;
  createdPart: boolean;
  createdBrand: boolean;
  wasInInventory: boolean;
  // A new part, or one with no photo: worth offering Autodoc.
  enrichSuggested: boolean;
};

// Catalogue search (barcode, part number, supplier code or description) for adding parts.
export async function findPartsToAdd(supabase: Client, query: string, maxResults = 12): Promise<PartToAdd[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase.rpc('find_parts_to_add', {
    q,
    max_results: Math.min(Math.max(maxResults, 1), 50),
  });
  if (error) throw dataError(error);

  return (data ?? []).flatMap((row) =>
    row.part_id == null || row.brand == null || row.number == null || row.kind == null
      ? []
      : [
          {
            partId: row.part_id,
            brand: row.brand,
            number: row.number,
            kind: row.kind,
            description: row.description,
            matchType: row.match_type ?? 'similar',
            score: readNumber(row.score) ?? 0,
            inInventory: row.in_inventory === true,
            isStocked: row.is_stocked === true,
            onHand: readNumber(row.on_hand) ?? 0,
            sku: row.sku,
            displayName: row.display_name,
            hasBarcode: row.has_barcode === true,
            imageUrl: row.image_url,
          },
        ],
  );
}

// Whether a SKU is free (ignoring case). partId: the part it is meant for, which may already hold it.
export async function skuAvailable(supabase: Client, sku: string, partId?: number | null): Promise<SkuCheck> {
  const { data, error } = await supabase.rpc('sku_available', { p_sku: sku, p_part: partId ?? undefined });
  if (error) throw dataError(error);
  const result = readRecord(data);
  const heldPart = readNumber(result?.part_id);
  const brand = readString(result?.brand);
  const number = readString(result?.number);
  return {
    available: readBoolean(result?.available) === true,
    heldBy: heldPart != null && brand && number ? { partId: heldPart, brand, number } : null,
  };
}

// Adds a part to your inventory in one transaction (see public.add_inventory_part). A new brand with near
// matches is refused with hint "confirm_new_brand" until confirmNewBrand is set.
export async function addInventoryPart(supabase: Client, input: AddInventoryInput): Promise<AddInventoryResult> {
  const payload: { [key: string]: Json } = {};
  const set = (key: string, value: Json | undefined) => {
    if (value !== undefined && value !== null && value !== '') payload[key] = value;
  };
  set('part_id', input.partId ?? null);
  set('brand_id', input.brandId ?? null);
  set('brand_name', input.brandName?.trim() ?? null);
  if (input.confirmNewBrand) payload.confirm_new_brand = true;
  set('number', input.number?.trim() ?? null);
  set('description', input.description?.trim() ?? null);
  set('barcode', input.barcode?.trim() ?? null);
  set('sku', input.sku?.trim() ?? null);
  set('display_name', input.displayName?.trim() ?? null);
  set('supplier_id', input.supplierId ?? null);
  set('supplier_code', input.supplierCode?.trim() ?? null);
  set('cost', input.cost ?? null);
  set('surcharge', input.surcharge ?? null);
  if (input.opening && input.opening.qty !== 0) {
    payload.opening = input.opening.binId != null ? { bin_id: input.opening.binId, qty: input.opening.qty } : { qty: input.opening.qty };
  }

  const { data, error } = await supabase.rpc('add_inventory_part', { p: payload });
  if (error) throw dataError(error);
  const result = readRecord(data);
  const partId = readNumber(result?.part_id);
  if (partId == null) throw new DataError('The part was not added.', 'P0001');
  return {
    partId,
    createdPart: readBoolean(result?.created_part) === true,
    createdBrand: readBoolean(result?.created_brand) === true,
    wasInInventory: readBoolean(result?.was_in_inventory) === true,
    enrichSuggested: readBoolean(result?.enrich_suggested) === true,
  };
}
