import type { Database } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { dataError } from '../core/errors';
import { readArray, readBoolean, readNumber, readRecord, readString, readStrings, type JsonRecord } from '../core/read';
import { readInventoryRow, type InventoryRow, type PartKind } from '../inventory/items';
import { displayGtin } from './barcodes';

export type ClaimState = Database['catalogue']['Enums']['claim_state'];
export type EnrichmentStatus = Database['ingest']['Enums']['enrichment_status'];

export const CLAIM_STATES = new Set<string>(['asserted', 'inferred', 'verified', 'rejected', 'conflict']);

export type SupplierPrice = {
  supplierId: number;
  supplier: string;
  cost: number;
  currency: string;
  listPrice: number | null;
  packQty: number | null;
  since: string | null;
  // The supplier's own code for the part (FPS "BK1003A" for TRW BK1003), when known.
  supplierCode: string | null;
  // The supplier's exchange surcharge per unit (ex VAT, refunded when the old unit goes back) and the code
  // of its invoice line.
  surcharge: number | null;
  surchargeCode: string | null;
};

export type OeNumber = {
  id: number;
  brand: string;
  number: string;
  unconfirmed: boolean;
  confidence: number | null;
};

export type PartImage = {
  id: number;
  url: string;
  size: 'thumb' | 'large' | 'unknown';
  position: number;
  licence: 'unverified' | 'licensed' | 'own';
};

export type Barcode = { id: number; gtin14: string; display: string; state: ClaimState; sources: number };

export type EnrichmentState = {
  targetId: number;
  provider: string;
  status: EnrichmentStatus;
  productUrl: string | null;
  updatedAt: string | null;
  lastError: string | null;
  creditsSpent: number;
};

export type PartCounts = {
  oe: number;
  xrefs: number;
  facts: number;
  specs: number;
  vehicles: number;
  kit: number;
  movements: number;
  images: number;
  barcodes: number;
};

// Kinds of data the part is missing; enrichment can fill most of them.
export type PartGaps = {
  photo: boolean;
  oe: boolean;
  barcode: boolean;
  category: boolean;
  specs: boolean;
  vehicles: boolean;
};

export type PartDetail = {
  part: {
    id: number;
    brandId: number;
    brand: string;
    number: string;
    kind: PartKind;
    description: string | null;
    tecdocAlias: string | null;
    categoryId: number | null;
    redirectedFrom: number | null;
  };
  // Null when the part is in the catalogue but not in your range.
  item: InventoryRow | null;
  // Your own name for the part, when one is set (item.name falls back to the catalogue description).
  displayName: string | null;
  categoryTrail: string[];
  sourceCategory: string | null;
  images: PartImage[];
  barcodes: Barcode[];
  prices: SupplierPrice[];
  oeNumbers: OeNumber[];
  enrichment: EnrichmentState | null;
  counts: PartCounts;
  gaps: PartGaps;
  openIssues: number;
};

// One part with its inventory row, prices, OE numbers, images, barcodes, enrichment state, per-tab counts and
// the gaps enrichment could fill. Null when the part does not exist; a merged part returns the survivor.
export async function getPartDetail(supabase: Client, partId: number): Promise<PartDetail | null> {
  const { data, error } = await supabase.rpc('part_detail', { p_part: partId });
  if (error) throw dataError(error);

  const detail = readRecord(data);
  const part = readRecord(detail?.part);
  const id = readNumber(part?.id);
  const brandId = readNumber(part?.brand_id);
  const brand = readString(part?.brand);
  const number = readString(part?.number);
  const kind = readString(part?.kind);
  if (id == null || brandId == null || !brand || !number || !kind) return null;

  const counts = readRecord(detail?.counts);
  const gaps = readRecord(detail?.gaps);
  const enrichment = readRecord(detail?.enrichment);
  const targetId = readNumber(enrichment?.target_id);
  const status = readString(enrichment?.status);

  return {
    part: {
      id,
      brandId,
      brand,
      number,
      kind: kind as PartKind,
      description: readString(part?.description),
      tecdocAlias: readString(part?.tecdoc_alias),
      categoryId: readNumber(part?.category_id),
      redirectedFrom: readNumber(part?.redirected_from),
    },
    item: readInventoryRow(readRecord(detail?.item)),
    displayName: readString(detail?.display_name),
    categoryTrail: readStrings(detail?.category_trail),
    sourceCategory: readString(detail?.source_category),
    images: readArray(detail?.images).flatMap((value) => {
      const image = readRecord(value);
      const imageId = readNumber(image?.id);
      const url = readString(image?.url);
      if (imageId == null || !url) return [];
      return [
        {
          id: imageId,
          url,
          size: (readString(image?.size) ?? 'unknown') as PartImage['size'],
          position: readNumber(image?.position) ?? 0,
          licence: (readString(image?.licence) ?? 'unverified') as PartImage['licence'],
        },
      ];
    }),
    barcodes: readArray(detail?.barcodes).flatMap((value) => readBarcode(readRecord(value))),
    prices: readArray(detail?.prices).flatMap((value) => {
      const price = readRecord(value);
      const supplierId = readNumber(price?.source_id);
      const supplier = readString(price?.source);
      const cost = readNumber(price?.cost);
      const currency = readString(price?.currency);
      if (supplierId == null || !supplier || cost == null || !currency) return [];
      return [
        {
          supplierId,
          supplier,
          cost,
          currency,
          listPrice: readNumber(price?.list_price),
          packQty: readNumber(price?.pack_qty),
          since: readString(price?.since),
          supplierCode: readString(price?.supplier_code),
          surcharge: readNumber(price?.surcharge),
          surchargeCode: readString(price?.surcharge_code),
        },
      ];
    }),
    oeNumbers: readArray(detail?.oe_numbers).flatMap((value) => {
      const oe = readRecord(value);
      const oeId = readNumber(oe?.id);
      const oeBrand = readString(oe?.brand);
      const oeNumber = readString(oe?.number);
      if (oeId == null || !oeBrand || !oeNumber) return [];
      return [
        {
          id: oeId,
          brand: oeBrand,
          number: oeNumber,
          unconfirmed: oe?.placeholder === true,
          confidence: readNumber(oe?.confidence),
        },
      ];
    }),
    enrichment:
      targetId != null && status
        ? {
            targetId,
            provider: readString(enrichment?.provider) ?? 'piloterr',
            status: status as EnrichmentStatus,
            productUrl: readString(enrichment?.product_url),
            updatedAt: readString(enrichment?.updated_at),
            lastError: readString(enrichment?.last_error),
            creditsSpent: readNumber(enrichment?.credits_spent) ?? 0,
          }
        : null,
    counts: {
      oe: readNumber(counts?.oe) ?? 0,
      xrefs: readNumber(counts?.xrefs) ?? 0,
      facts: readNumber(counts?.facts) ?? 0,
      specs: readNumber(counts?.specs) ?? 0,
      vehicles: readNumber(counts?.vehicles) ?? 0,
      kit: readNumber(counts?.kit) ?? 0,
      movements: readNumber(counts?.movements) ?? 0,
      images: readNumber(counts?.images) ?? 0,
      barcodes: readNumber(counts?.barcodes) ?? 0,
    },
    gaps: {
      photo: readBoolean(gaps?.photo) ?? true,
      oe: readBoolean(gaps?.oe) ?? true,
      barcode: readBoolean(gaps?.barcode) ?? true,
      category: readBoolean(gaps?.category) ?? true,
      specs: readBoolean(gaps?.specs) ?? true,
      vehicles: readBoolean(gaps?.vehicles) ?? true,
    },
    openIssues: readNumber(detail?.open_issues) ?? 0,
  };
}

export function readBarcode(row: JsonRecord | null): Barcode[] {
  const id = readNumber(row?.id);
  const gtin14 = readString(row?.gtin14);
  const state = readString(row?.state);
  if (id == null || !gtin14 || !state || !CLAIM_STATES.has(state)) return [];
  return [{ id, gtin14, display: displayGtin(gtin14), state: state as ClaimState, sources: readNumber(row?.sources) ?? 0 }];
}
