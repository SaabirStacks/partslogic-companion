import type { EnrichmentStatus } from '../catalogue/part-detail';
import type { Client } from '../core/client';
import { dataError } from '../core/errors';
import { readArray, readBoolean, readNumber, readRecord, readString, readStrings, type JsonRecord } from '../core/read';
import type { PartKind } from '../inventory/items';

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
  // The enabled sources a run goes down, in order, with each one's last result for this part.
  sources: EnrichmentSourceStep[];
  budgets: Partial<Record<'piloterr' | 'firecrawl', { limit: number; spent: number; remaining: number }>>;
  gaps: Partial<Record<'photo' | 'oe' | 'barcode' | 'category' | 'specs' | 'xrefs' | 'vehicles', boolean>>;
  // When the websites were last searched for this part (a search is reused for 30 days).
  webSearchedOn: string | null;
  webCredits: { search: number; aiPage: number; siteSearch: number; markdownPage: number; maxPages: number };
  // Pages a search found that may be this part, for a person to answer (never applied on their own).
  review: EnrichmentReview | null;
  // The part has a barcode, so an Autodoc run searches by it first (a second search, 2 credits more, when
  // Autodoc does not know the barcode).
  hasEan: boolean;
};

export type EnrichmentReview = {
  issueId: number;
  status: 'open' | 'in_review';
  // What was flagged for whoever fixes the price file.
  note: string | null;
  listings: EnrichmentListing[];
};

export type EnrichmentListingChoice = 'use' | 'same_brand' | 'wrong_brand' | 'not_this_part';

export type EnrichmentListing = {
  sourceId: number | null;
  source: string | null;
  // other_brand: our number under another brand; near_match: nearly our number under our brand;
  // ean_differs: our number and brand, but another barcode (not applied); ean_match: our barcode under another
  // brand or number (applied, listed so the name can be checked).
  why: 'other_brand' | 'near_match' | 'ean_differs' | 'ean_match';
  reason: 'variant' | 'leading_zeros' | 'look_alike' | null;
  brand: string;
  // The brand is one we know as its own, so it cannot be another name for ours.
  knownBrand: boolean;
  // The listing's brand is the part's own brand.
  brandIsOurs: boolean;
  number: string;
  url: string;
  title: string | null;
  // The barcodes (GTIN-14) the part has and the page names; set for the two barcode kinds.
  ourEans: string[];
  theirEans: string[];
  answer: 'wrong_brand' | null;
};

export type EnrichmentListingResult = { status: 'open' | 'in_review' | 'resolved' | 'dismissed'; remembered: boolean; alias: string | null };

export type EnrichmentSourceStep = {
  id: number;
  name: string;
  kind: 'autodoc' | 'brand_catalogue' | 'retailer';
  provider: 'piloterr' | 'firecrawl';
  domain: string | null;
  // websites: read with AI extraction, or by the Autodoc-family page reader (no AI)
  reader: 'ai' | 'autodoc_family' | null;
  // websites: found through the site's own search rather than the shared web search
  ownSearch: boolean;
  skip: string | null;
  last: { status: string; at: string | null; url: string | null } | null;
};

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
    sources: readArray(preview.sources).flatMap((value) => {
      const row = readRecord(value);
      const id = readNumber(row?.id);
      const name = readString(row?.name);
      const provider = readString(row?.provider);
      if (id == null || !name || (provider !== 'piloterr' && provider !== 'firecrawl')) return [];
      const last = readRecord(row?.last);
      const reader = readString(row?.reader);
      return [
        {
          id,
          name,
          kind: (readString(row?.kind) ?? 'retailer') as EnrichmentSourceStep['kind'],
          provider,
          domain: readString(row?.domain),
          reader: reader === 'autodoc_family' ? 'autodoc_family' : provider === 'firecrawl' ? 'ai' : null,
          ownSearch: readBoolean(row?.own_search) ?? false,
          skip: readString(row?.skip),
          last: last && readString(last.status)
            ? { status: readString(last.status) ?? '', at: readString(last.at), url: readString(last.url) }
            : null,
        },
      ];
    }),
    budgets: Object.fromEntries(
      (['piloterr', 'firecrawl'] as const).flatMap((provider) => {
        const row = readRecord(readRecord(preview.budgets)?.[provider]);
        const providerLimit = readNumber(row?.limit);
        return providerLimit == null
          ? []
          : [[provider, { limit: providerLimit, spent: readNumber(row?.spent) ?? 0, remaining: readNumber(row?.remaining) ?? 0 }]];
      })
    ),
    gaps: Object.fromEntries(
      Object.entries(readRecord(preview.gaps) ?? {}).flatMap(([key, value]) => (typeof value === 'boolean' ? [[key, value]] : []))
    ),
    webSearchedOn: readString(readRecord(preview.web_search)?.searched_at),
    webCredits: {
      search: readNumber(credits?.web_search) ?? 2,
      aiPage: readNumber(credits?.web_page) ?? 5,
      siteSearch: readNumber(credits?.site_search) ?? 1,
      markdownPage: readNumber(credits?.markdown_page) ?? 1,
      maxPages: readNumber(credits?.web_max_pages) ?? 3,
    },
    review: readEnrichmentReview(readRecord(preview.review)),
    hasEan: readBoolean(preview.has_ean) ?? false,
  };
}

const NEAR_REASONS = new Set(['variant', 'leading_zeros', 'look_alike']);
const LISTING_KINDS = new Set(['other_brand', 'near_match', 'ean_differs', 'ean_match']);

function readEnrichmentReview(review: JsonRecord | null): EnrichmentReview | null {
  const issueId = readNumber(review?.issue_id);
  if (!review || issueId == null) return null;
  const listings = readArray(review.listings).flatMap((value): EnrichmentListing[] => {
    const row = readRecord(value);
    const why = readString(row?.why);
    const url = readString(row?.url);
    const number = readString(row?.number);
    if (!row || !url || !number || !LISTING_KINDS.has(why ?? '')) return [];
    const reason = readString(row.reason);
    return [
      {
        sourceId: readNumber(row.source_id),
        source: readString(row.source),
        why: why as EnrichmentListing['why'],
        reason: reason && NEAR_REASONS.has(reason) ? (reason as EnrichmentListing['reason']) : null,
        brand: readString(row.brand) ?? 'Another brand',
        knownBrand: readBoolean(row.known_brand) ?? false,
        brandIsOurs: readBoolean(row.brand_is_ours) ?? false,
        number,
        url,
        title: readString(row.title),
        ourEans: readStrings(row.our_eans).filter(Boolean),
        theirEans: readStrings(row.their_eans).filter(Boolean),
        answer: readString(row.answer) === 'wrong_brand' ? 'wrong_brand' : null,
      },
    ];
  });
  return {
    issueId,
    status: readString(review.status) === 'in_review' ? 'in_review' : 'open',
    note: readString(review.note),
    listings,
  };
}

// A person's answer to one listing on a part's enrichment review (editors). 'use' and 'same_brand' remember
// the page, so the next run reads it without searching.
export async function resolveEnrichmentListing(
  supabase: Client,
  issueId: number,
  url: string,
  choice: EnrichmentListingChoice,
): Promise<EnrichmentListingResult> {
  const { data, error } = await supabase.rpc('enrichment_resolve_listing', { p_issue: issueId, p_url: url, p_choice: choice });
  if (error) throw dataError(error);
  const result = readRecord(data);
  const status = readString(result?.status);
  return {
    status: status === 'in_review' || status === 'resolved' || status === 'dismissed' ? status : 'open',
    remembered: readBoolean(result?.remembered) ?? false,
    alias: readString(result?.alias),
  };
}
