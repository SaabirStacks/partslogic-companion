import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@partslogic/db-types';

import { dataError } from './errors';
import { readInventoryRow, type InventoryRow, type PartKind } from './inventory';
import { readArray, readBoolean, readNumber, readRecord, readString, readStrings, type JsonRecord } from './read';

type Client = SupabaseClient<Database>;

export type ClaimState = Database['catalogue']['Enums']['claim_state'];
export type EnrichmentStatus = Database['ingest']['Enums']['enrichment_status'];

const CLAIM_STATES = new Set<string>(['asserted', 'inferred', 'verified', 'rejected', 'conflict']);

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

export type PartAlternative = {
  partId: number;
  brand: string;
  number: string;
  kind: PartKind;
  relation: string;
  via: string | null;
  confidence: number;
  onHand: number;
  inRange: boolean;
  // For alternatives you stock: their best cost, retail price and margin.
  bestCost: number | null;
  sellPrice: number | null;
  margin: number | null;
};

export type PartFitment = {
  vehicleId: number;
  ktype: number | null;
  make: string;
  model: string;
  typeName: string | null;
  generation: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  engineCc: number | null;
  powerKw: number | null;
  fuel: string | null;
  state: ClaimState;
  confidence: number;
  matchMethod: string | null;
};

export type VehicleText = {
  fitmentId: number;
  text: string;
  qualifiers: JsonRecord;
  state: ClaimState;
  sources: number;
  matchedVehicles: number;
};

export type PartSearchResult = {
  partId: number;
  brand: string;
  number: string;
  kind: PartKind;
  description: string | null;
  matchType: string;
  score: number;
};

export type LinkedPart = {
  linkId: number;
  partId: number;
  brand: string;
  number: string;
  state: ClaimState;
  confidence: number;
};

export type OeReference = LinkedPart & {
  placeholder: boolean;
  sources: number;
  evidence: number;
  statedQuantity: number | null;
  basis: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
};

export type CrossReference = LinkedPart & { kind: PartKind; sources: number; inRange: boolean; onHand: number };

export type PartReferences = {
  oe: OeReference[];
  equivalentOe: (LinkedPart & { hubPartId: number })[];
  crossReferences: CrossReference[];
  supersessions: (LinkedPart & { relation: 'replaces' | 'superseded_by' })[];
  unattributed: { number: string; source: string | null; resolvedPartId: number | null }[];
  unattributedLabels: string[];
  barcodes: (Barcode & { evidence: number; firstSeen: string | null; lastSeen: string | null })[];
  aliases: { alias: string; kind: string; brand: string; source: string | null }[];
  labels: { code: string; type: string }[];
  identifiers: {
    tecdocAlias: string | null;
    autodocProductId: string | null;
    autodocUrl: string | null;
    external: { system: string; value: string }[];
  };
};

export type PartFact = {
  factId: number;
  field: string;
  value: Json;
  state: ClaimState;
  sources: number;
  evidence: number;
  firstSeen: string | null;
  lastSeen: string | null;
};

export type ClaimKind = 'fact' | 'link' | 'barcode' | 'fitment';

export type ClaimSource = {
  evidenceId: number | null;
  kind: 'evidence' | 'proposal';
  sourceId: number | null;
  source: string | null;
  sourceKind: string | null;
  batchId: string | null;
  fileName: string | null;
  rowNumber: number | null;
  manualBy: string | null;
  observedAt: string | null;
};

export type KitLine = {
  linkId: number;
  partId: number;
  brand: string;
  number: string;
  name: string | null;
  qty: number;
  state: ClaimState;
  inRange: boolean;
  onHand: number;
};

export type PartKit = { components: KitLine[]; usedIn: KitLine[] };

export type EnrichmentPreview = {
  partKind: PartKind | null;
  inRange: boolean;
  target: {
    id: number;
    status: EnrichmentStatus;
    attempts: number;
    creditsSpent: number;
    lastError: string | null;
    updatedAt: string | null;
  } | null;
  productUrl: string | null;
  // When a search last found nothing on Autodoc for this part (kept for 30 days); a new search then needs confirming.
  noMatchOn: string | null;
  makers: string[];
  vehicleListsFetched: boolean;
  queuedVehicleLists: number;
  budget: { limit: number; spent: number; remaining: number } | null;
  credits: { search: number; product: number; perMaker: number };
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

// Parts that can replace this one, with how much of each you hold. OE numbers are never alternatives.
export async function getPartAlternatives(supabase: Client, partId: number): Promise<PartAlternative[]> {
  const { data, error } = await supabase.rpc('part_alternatives_with_stock', { p_part: partId });
  if (error) throw dataError(error);

  return (data ?? []).flatMap((row) =>
    row.part_id == null || row.brand == null || row.number == null || row.kind == null || row.relation == null
      ? []
      : [
          {
            partId: row.part_id,
            brand: row.brand,
            number: row.number,
            kind: row.kind,
            relation: row.relation,
            via: row.via,
            confidence: readNumber(row.confidence) ?? 0,
            onHand: readNumber(row.on_hand) ?? 0,
            inRange: row.in_range ?? false,
            bestCost: readNumber(row.best_cost),
            sellPrice: readNumber(row.sell_price),
            margin: readNumber(row.margin),
          },
        ],
  );
}

// Vehicles the part fits, from the KType master.
export async function getPartFitments(supabase: Client, partId: number): Promise<PartFitment[]> {
  const { data, error } = await supabase.rpc('part_fitments_for', { p_part: partId });
  if (error) throw dataError(error);

  return (data ?? []).flatMap((row) =>
    row.vehicle_id == null || row.make == null || row.model == null || row.state == null
      ? []
      : [
          {
            vehicleId: row.vehicle_id,
            ktype: row.ktype,
            make: row.make,
            model: row.model,
            typeName: row.type_name,
            generation: row.generation,
            yearFrom: row.year_from,
            yearTo: row.year_to,
            engineCc: row.engine_cc,
            powerKw: readNumber(row.power_kw),
            fuel: row.fuel,
            state: row.state,
            confidence: readNumber(row.confidence) ?? 0,
            matchMethod: row.match_method,
          },
        ],
  );
}

// Vehicle lines as sources wrote them, with how many KType vehicles each matched.
export async function getPartVehicleTexts(supabase: Client, partId: number): Promise<VehicleText[]> {
  const { data, error } = await supabase.rpc('part_vehicle_texts', { p_part: partId });
  if (error) throw dataError(error);

  return (data ?? []).flatMap((row) =>
    row.fitment_id == null || row.vehicle_text == null || row.state == null
      ? []
      : [
          {
            fitmentId: row.fitment_id,
            text: row.vehicle_text,
            qualifiers: readRecord(row.qualifiers) ?? {},
            state: row.state,
            sources: row.sources ?? 0,
            matchedVehicles: row.matched_vehicles ?? 0,
          },
        ],
  );
}

// The References tab: OE numbers, cross-references, supersessions, barcodes, aliases and outside ids.
export async function getPartReferences(supabase: Client, partId: number): Promise<PartReferences> {
  const { data, error } = await supabase.rpc('part_references', { p_part: partId });
  if (error) throw dataError(error);

  const refs = readRecord(data);
  const identifiers = readRecord(refs?.identifiers);
  const productId = identifiers?.autodoc_product_id;
  return {
    oe: readArray(refs?.oe).flatMap((value) => {
      const row = readRecord(value);
      const linked = readLinked(row);
      if (!linked) return [];
      return [
        {
          ...linked,
          placeholder: row?.placeholder === true,
          sources: readNumber(row?.sources) ?? 0,
          evidence: readNumber(row?.evidence) ?? 0,
          statedQuantity: readNumber(row?.stated_quantity),
          basis: readString(row?.basis),
          firstSeen: readString(row?.first_seen),
          lastSeen: readString(row?.last_seen),
        },
      ];
    }),
    // A link between two of this part's own OE numbers is returned once from each end, so the same
    // link arrives twice. Keep the first (rows are already ordered by make and number).
    equivalentOe: uniqueBy(
      readArray(refs?.equivalent_oe).flatMap((value) => {
        const row = readRecord(value);
        const linked = readLinked(row);
        const hubPartId = readNumber(row?.hub_part_id);
        return linked && hubPartId != null ? [{ ...linked, hubPartId }] : [];
      }),
      (item) => item.linkId
    ),
    crossReferences: readArray(refs?.cross_references).flatMap((value) => {
      const row = readRecord(value);
      const linked = readLinked(row);
      const kind = readString(row?.kind);
      if (!linked || !kind) return [];
      return [
        {
          ...linked,
          kind: kind as PartKind,
          sources: readNumber(row?.sources) ?? 0,
          inRange: readBoolean(row?.in_range) ?? false,
          onHand: readNumber(row?.on_hand) ?? 0,
        },
      ];
    }),
    supersessions: readArray(refs?.supersessions).flatMap((value) => {
      const row = readRecord(value);
      const linked = readLinked(row);
      const relation = readString(row?.relation);
      return linked && (relation === 'replaces' || relation === 'superseded_by') ? [{ ...linked, relation }] : [];
    }),
    unattributed: readArray(refs?.unattributed).flatMap((value) => {
      const row = readRecord(value);
      const number = readString(row?.number);
      return number
        ? [{ number, source: readString(row?.source), resolvedPartId: readNumber(row?.resolved_part_id) }]
        : [];
    }),
    unattributedLabels: readStrings(refs?.unattributed_labels),
    barcodes: readArray(refs?.barcodes).flatMap((value) => {
      const row = readRecord(value);
      return readBarcode(row).map((barcode) => ({
        ...barcode,
        evidence: readNumber(row?.evidence) ?? 0,
        firstSeen: readString(row?.first_seen),
        lastSeen: readString(row?.last_seen),
      }));
    }),
    aliases: readArray(refs?.aliases).flatMap((value) => {
      const row = readRecord(value);
      const alias = readString(row?.alias);
      const brand = readString(row?.brand);
      return alias && brand
        ? [{ alias, brand, kind: readString(row?.kind) ?? 'product_code', source: readString(row?.source) }]
        : [];
    }),
    labels: readArray(refs?.labels).flatMap((value) => {
      const row = readRecord(value);
      const code = readString(row?.code);
      return code ? [{ code, type: readString(row?.type) ?? 'internal' }] : [];
    }),
    identifiers: {
      tecdocAlias: readString(identifiers?.tecdoc_alias),
      autodocProductId: typeof productId === 'number' ? String(productId) : readString(productId),
      autodocUrl: readString(identifiers?.autodoc_url),
      external: readArray(identifiers?.external).flatMap((value) => {
        const row = readRecord(value);
        const system = readString(row?.system);
        const ref = readString(row?.value);
        return system && ref ? [{ system, value: ref }] : [];
      }),
    },
  };
}

// Every fact about the part with its claim state and how many sources state it.
export async function getPartSpecs(supabase: Client, partId: number): Promise<PartFact[]> {
  const { data, error } = await supabase.rpc('part_specs', { p_part: partId });
  if (error) throw dataError(error);

  return (data ?? []).flatMap((row) =>
    row.fact_id == null || row.field == null || row.state == null
      ? []
      : [
          {
            factId: row.fact_id,
            field: row.field,
            value: row.value,
            state: row.state,
            sources: row.sources ?? 0,
            evidence: row.evidence ?? 0,
            firstSeen: row.first_seen,
            lastSeen: row.last_seen,
          },
        ],
  );
}

// Where a claim came from: the file and row of each piece of evidence, or the person who stated it.
export async function getClaimSources(supabase: Client, kind: ClaimKind, id: number): Promise<ClaimSource[]> {
  const { data, error } = await supabase.rpc('claim_sources', { p_kind: kind, p_id: id });
  if (error) throw dataError(error);

  return (data ?? []).map((row) => ({
    evidenceId: row.evidence_id,
    kind: row.kind === 'proposal' ? 'proposal' : 'evidence',
    sourceId: row.source_id,
    source: row.source,
    sourceKind: row.source_kind,
    batchId: row.batch_id,
    fileName: row.file_name,
    rowNumber: row.row_number,
    manualBy: row.manual_by,
    observedAt: row.observed_at,
  }));
}

// The Kit tab: the parts this kit is made of, and the kits this part belongs to.
export async function getPartKit(supabase: Client, partId: number): Promise<PartKit> {
  const { data, error } = await supabase.rpc('part_kit', { p_part: partId });
  if (error) throw dataError(error);

  const kit = readRecord(data);
  return { components: readKitLines(kit?.components), usedIn: readKitLines(kit?.used_in) };
}

// Adds a component to a kit (qty per kit). Returns the link id.
export async function addKitComponent(
  supabase: Client,
  input: { kitPartId: number; componentPartId: number; qty: number },
): Promise<number> {
  const { data, error } = await supabase.rpc('add_kit_component', {
    p_kit: input.kitPartId,
    p_component: input.componentPartId,
    p_qty: input.qty,
  });
  if (error) throw dataError(error);
  return data;
}

// Takes a component off a kit (the link is kept as rejected, with who removed it).
export async function removeKitComponent(supabase: Client, linkId: number): Promise<void> {
  const { error } = await supabase.rpc('remove_kit_component', { p_link: linkId });
  if (error) throw dataError(error);
}

// A curator confirms or rejects a link (OE number, cross-reference).
export async function reviewLink(supabase: Client, linkId: number, decision: 'verified' | 'rejected'): Promise<void> {
  const { error } = await supabase.rpc('review_link', { p_link: linkId, p_decision: decision });
  if (error) throw dataError(error);
}

// What an Autodoc enrichment run would do and cost for this part.
export async function getEnrichmentPreview(supabase: Client, partId: number): Promise<EnrichmentPreview | null> {
  const { data, error } = await supabase.rpc('enrichment_preview', { p_part: partId });
  if (error) throw dataError(error);
  return readEnrichmentPreview(readRecord(data));
}

export function readEnrichmentPreview(preview: JsonRecord | null): EnrichmentPreview | null {
  if (!preview) return null;
  const target = readRecord(preview.target);
  const targetId = readNumber(target?.id);
  const budget = readRecord(preview.budget);
  const limit = readNumber(budget?.limit);
  const credits = readRecord(preview.credits);
  return {
    partKind: (readString(preview.part_kind) as PartKind | null) ?? null,
    inRange: readBoolean(preview.in_range) ?? false,
    target:
      targetId != null
        ? {
            id: targetId,
            status: (readString(target?.status) ?? 'queued') as EnrichmentStatus,
            attempts: readNumber(target?.attempts) ?? 0,
            creditsSpent: readNumber(target?.credits_spent) ?? 0,
            lastError: readString(target?.last_error),
            updatedAt: readString(target?.updated_at),
          }
        : null,
    productUrl: readString(preview.product_url),
    noMatchOn: readString(preview.no_match_on),
    makers: readStrings(preview.makers),
    vehicleListsFetched: readBoolean(preview.vehicle_lists_fetched) ?? false,
    queuedVehicleLists: readNumber(preview.queued_vehicle_lists) ?? 0,
    budget:
      limit != null
        ? { limit, spent: readNumber(budget?.spent) ?? 0, remaining: readNumber(budget?.remaining) ?? 0 }
        : null,
    credits: {
      search: readNumber(credits?.search) ?? 2,
      product: readNumber(credits?.product) ?? 2,
      perMaker: readNumber(credits?.per_maker) ?? 2,
    },
  };
}

// Catalogue search by barcode, part number or description (the whole catalogue, not just your range).
export async function searchParts(supabase: Client, query: string, maxResults = 20): Promise<PartSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase.rpc('search_parts', { q, max_results: Math.min(Math.max(maxResults, 1), 100) });
  if (error) throw dataError(error);

  return (data ?? []).flatMap((row) =>
    row.part_id == null || row.brand == null || row.number == null || row.kind == null || row.match_type == null
      ? []
      : [
          {
            partId: row.part_id,
            brand: row.brand,
            number: row.number,
            kind: row.kind,
            description: row.description,
            matchType: row.match_type,
            score: readNumber(row.score) ?? 0,
          },
        ],
  );
}

// GTIN-14 as printed: 8, 12 and 13 digit codes lose their padding zeros.
export function displayGtin(gtin14: string): string {
  const trimmed = gtin14.replace(/^0+/, '');
  return [8, 12, 13].includes(trimmed.length) ? trimmed : gtin14;
}

function readBarcode(row: JsonRecord | null): Barcode[] {
  const id = readNumber(row?.id);
  const gtin14 = readString(row?.gtin14);
  const state = readString(row?.state);
  if (id == null || !gtin14 || !state || !CLAIM_STATES.has(state)) return [];
  return [{ id, gtin14, display: displayGtin(gtin14), state: state as ClaimState, sources: readNumber(row?.sources) ?? 0 }];
}

function uniqueBy<T>(items: T[], key: (item: T) => number): T[] {
  const seen = new Set<number>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function readLinked(row: JsonRecord | null): LinkedPart | null {
  const linkId = readNumber(row?.link_id);
  const partId = readNumber(row?.part_id);
  const brand = readString(row?.brand);
  const number = readString(row?.number);
  const state = readString(row?.state);
  if (linkId == null || partId == null || !brand || !number || !state || !CLAIM_STATES.has(state)) return null;
  return { linkId, partId, brand, number, state: state as ClaimState, confidence: readNumber(row?.confidence) ?? 0 };
}

function readKitLines(value: Json | undefined): KitLine[] {
  return readArray(value).flatMap((item) => {
    const row = readRecord(item);
    const linked = readLinked(row);
    if (!linked) return [];
    return [
      {
        linkId: linked.linkId,
        partId: linked.partId,
        brand: linked.brand,
        number: linked.number,
        name: readString(row?.name),
        qty: readNumber(row?.qty) ?? 1,
        state: linked.state,
        inRange: readBoolean(row?.in_range) ?? false,
        onHand: readNumber(row?.on_hand) ?? 0,
      },
    ];
  });
}

// Sets the Piloterr credit budget (admins). Spend is checked against it before every paid call.
export async function setEnrichmentBudget(supabase: Client, credits: number): Promise<void> {
  const { error } = await supabase.rpc('set_api_budget', { p_provider: 'piloterr', p_credit_limit: credits });
  if (error) throw dataError(error);
}
