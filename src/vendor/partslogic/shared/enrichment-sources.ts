import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@partslogic/db-types';

import { dataError } from './errors';
import { readArray, readBoolean, readNumber, readRecord, readString, readStrings, type JsonRecord } from './read';

// The enrichment source list (Organisation › Enrichment): where parts are enriched from, in order, each
// website's extraction profile, the spec vocabulary, page reads and the backfill. See docs/web-enrichment.md.

type Client = SupabaseClient<Database>;

export type SourceKind = 'autodoc' | 'brand_catalogue' | 'retailer';

export type WebProfileSpecInput = {
  fields: string[];
  hints?: Record<string, string>;
  spec_keys?: string[] | null;
  spec_aliases?: Record<string, string>;
  page_pattern?: string | null;
  prompt?: string | null;
  reader?: 'ai' | 'autodoc_family';
  search_url?: string | null;
  xref_brands?: 'known' | 'all';
};

export type WebProfileSpec = Required<Omit<WebProfileSpecInput, 'spec_keys' | 'page_pattern' | 'prompt' | 'search_url'>> & {
  contract: number;
  spec_keys: string[] | null;
  page_pattern: string | null;
  prompt: string | null;
  search_url: string | null;
};

export type SourceStats = {
  applied: number;
  notFound: number;
  mismatch: number;
  failed: number;
  credits: number;
  lastReadAt: string | null;
};

export type EnrichmentSource = {
  id: number;
  name: string;
  kind: SourceKind;
  provider: 'piloterr' | 'firecrawl';
  domain: string | null;
  brands: { id: number; name: string }[];
  position: number;
  enabled: boolean;
  notes: string | null;
  profile: { code: string; version: number; createdAt: string | null; spec: WebProfileSpec } | null;
  last30Days: SourceStats;
  updatedAt: string | null;
};

export type WebProfileVersion = {
  code: string;
  version: number;
  isActive: boolean;
  createdAt: string | null;
  by: string | null;
  spec: WebProfileSpec;
  pages: number;
};

export type SpecKeyRow = {
  key: string;
  label: string;
  type: 'number' | 'text' | 'enum' | 'boolean';
  unit: string | null;
  allowedValues: string[] | null;
  aliases: string[];
  description: string | null;
  parts: number;
};

export type UnmappedLabel = {
  sourceId: number;
  source: string;
  label: string;
  sample: string | null;
  pages: number;
  lastSeen: string | null;
};

export type SourcePageRead = {
  id: number;
  partId: number;
  brand: string;
  number: string;
  url: string | null;
  status: 'preview' | 'applied' | 'mismatch' | 'failed';
  credits: number;
  detail: string | null;
  dropped: number;
  unmapped: number;
  profileVersion: number | null;
  stored: boolean;
  createdAt: string;
};

export type WebPageDetail = {
  id: number;
  partId: number;
  sourceId: number;
  url: string | null;
  status: SourcePageRead['status'];
  detail: string | null;
  credits: number;
  profile: { code: string | null; version: number | null };
  schemaHash: string | null;
  dropped: { path: string; reason: string }[];
  unmappedSpecs: { label: string; value: string }[];
  createdAt: string | null;
  extracted: JsonRecord | null;
  // what applying it does: the extracted values mapped onto the contract and the vocabulary
  canonical: JsonRecord | null;
  matchesPart: boolean | null;
};

export type BackfillScope = 'in_stock' | 'sold_12m' | 'all';

export type BackfillStatus = {
  queued: number;
  running: number;
  done30Days: number;
  failed30Days: number;
  deferred: number;
  lastFinishedAt: string | null;
};

function readSpec(value: unknown): WebProfileSpec {
  const spec = readRecord(value as Json) ?? {};
  const record = (input: unknown): Record<string, string> =>
    Object.fromEntries(
      Object.entries(readRecord(input as Json) ?? {}).flatMap(([key, v]) => (typeof v === 'string' ? [[key, v]] : [])),
    );
  return {
    contract: readNumber(spec.contract) ?? 1,
    fields: readStrings(spec.fields),
    hints: record(spec.hints),
    spec_keys: Array.isArray(spec.spec_keys) ? readStrings(spec.spec_keys) : null,
    spec_aliases: record(spec.spec_aliases),
    page_pattern: readString(spec.page_pattern),
    prompt: readString(spec.prompt),
    reader: readString(spec.reader) === 'autodoc_family' ? 'autodoc_family' : 'ai',
    search_url: readString(spec.search_url),
    xref_brands: readString(spec.xref_brands) === 'all' ? 'all' : 'known',
  };
}

function readSource(value: unknown): EnrichmentSource | null {
  const row = readRecord(value as Json);
  const id = readNumber(row?.id);
  const name = readString(row?.name);
  const provider = readString(row?.provider);
  if (!row || id == null || !name || (provider !== 'piloterr' && provider !== 'firecrawl')) return null;
  const profile = readRecord(row.profile);
  const stats = readRecord(row.last_30_days);
  return {
    id,
    name,
    kind: (readString(row.kind) ?? 'retailer') as SourceKind,
    provider,
    domain: readString(row.domain),
    brands: readArray(row.brands).flatMap((b) => {
      const brand = readRecord(b);
      const brandId = readNumber(brand?.id);
      const brandName = readString(brand?.name);
      return brandId != null && brandName ? [{ id: brandId, name: brandName }] : [];
    }),
    position: readNumber(row.position) ?? 0,
    enabled: readBoolean(row.enabled) ?? false,
    notes: readString(row.notes),
    profile:
      profile && readString(profile.code)
        ? {
            code: readString(profile.code) ?? '',
            version: readNumber(profile.version) ?? 1,
            createdAt: readString(profile.created_at),
            spec: readSpec(profile.spec),
          }
        : null,
    last30Days: {
      applied: readNumber(stats?.applied) ?? 0,
      notFound: readNumber(stats?.not_found) ?? 0,
      mismatch: readNumber(stats?.mismatch) ?? 0,
      failed: readNumber(stats?.failed) ?? 0,
      credits: readNumber(stats?.credits) ?? 0,
      lastReadAt: readString(stats?.last_read_at),
    },
    updatedAt: readString(row.updated_at),
  };
}

export async function listEnrichmentSources(supabase: Client): Promise<EnrichmentSource[]> {
  const { data, error } = await supabase.rpc('enrichment_sources');
  if (error) throw dataError(error);
  return readArray(data).flatMap((row) => readSource(row) ?? []);
}

// Adds a website (id null) or changes one (admins). Autodoc only takes enabled and notes.
export async function saveEnrichmentSource(
  supabase: Client,
  input: {
    id: number | null;
    name: string;
    kind: SourceKind;
    domain: string | null;
    brandIds?: number[] | null;
    enabled: boolean;
    notes?: string | null;
  },
): Promise<number> {
  const { data, error } = await supabase.rpc('save_enrichment_source', {
    p_id: input.id as number,
    p_name: input.name,
    p_kind: input.kind,
    p_domain: input.domain as string,
    p_brand_ids: (input.brandIds ?? null) as number[],
    p_enabled: input.enabled,
    p_notes: (input.notes ?? null) as string,
  });
  if (error) throw dataError(error);
  return readNumber(readRecord(data)?.id) ?? input.id ?? 0;
}

export async function reorderEnrichmentSources(supabase: Client, ids: number[]): Promise<void> {
  const { error } = await supabase.rpc('reorder_enrichment_sources', { p_ids: ids });
  if (error) throw dataError(error);
}

// A site with page reads is switched off rather than removed, so its evidence keeps its source.
export async function removeEnrichmentSource(supabase: Client, id: number): Promise<'removed' | 'disabled'> {
  const { data, error } = await supabase.rpc('remove_enrichment_source', { p_id: id });
  if (error) throw dataError(error);
  return data === 'disabled' ? 'disabled' : 'removed';
}

// Saves a website's extraction profile as a new version (admins); checked against the contract in SQL.
export async function saveWebProfile(
  supabase: Client,
  sourceId: number,
  spec: WebProfileSpecInput,
): Promise<{ code: string; version: number }> {
  const { data, error } = await supabase.rpc('save_web_profile', { p_source: sourceId, p_spec: spec as unknown as Json });
  if (error) throw dataError(error);
  const saved = readRecord(data);
  return { code: readString(saved?.code) ?? '', version: readNumber(saved?.version) ?? 0 };
}

export async function listWebProfileVersions(supabase: Client, sourceId: number): Promise<WebProfileVersion[]> {
  const { data, error } = await supabase.rpc('web_profile_versions', { p_source: sourceId });
  if (error) throw dataError(error);
  return readArray(data).flatMap((value) => {
    const row = readRecord(value);
    const code = readString(row?.code);
    const version = readNumber(row?.version);
    if (!row || !code || version == null) return [];
    return [
      {
        code,
        version,
        isActive: readBoolean(row.is_active) ?? false,
        createdAt: readString(row.created_at),
        by: readString(row.by),
        spec: readSpec(row.spec),
        pages: readNumber(row.pages) ?? 0,
      },
    ];
  });
}

export async function listSpecKeys(supabase: Client): Promise<SpecKeyRow[]> {
  const { data, error } = await supabase.rpc('spec_keys');
  if (error) throw dataError(error);
  return readArray(data).flatMap((value) => {
    const row = readRecord(value);
    const key = readString(row?.key);
    const label = readString(row?.label);
    if (!row || !key || !label) return [];
    const type = readString(row.type);
    return [
      {
        key,
        label,
        type: type === 'number' || type === 'enum' || type === 'boolean' ? type : 'text',
        unit: readString(row.unit),
        allowedValues: Array.isArray(row.allowed_values) ? readStrings(row.allowed_values) : null,
        aliases: readStrings(row.aliases),
        description: readString(row.description),
        parts: readNumber(row.parts) ?? 0,
      },
    ];
  });
}

export async function saveSpecKey(
  supabase: Client,
  input: {
    key: string;
    label: string;
    type: SpecKeyRow['type'];
    unit?: string | null;
    allowedValues?: string[] | null;
    aliases?: string[];
    description?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.rpc('save_spec_key', {
    p_key: input.key,
    p_label: input.label,
    p_type: input.type,
    p_unit: (input.unit ?? null) as string,
    p_allowed_values: (input.allowedValues ?? null) as string[],
    p_aliases: input.aliases ?? [],
    p_description: (input.description ?? null) as string,
  });
  if (error) throw dataError(error);
}

export async function listUnmappedSpecLabels(supabase: Client, sourceId?: number | null): Promise<UnmappedLabel[]> {
  const { data, error } = await supabase.rpc('unmapped_spec_labels', { p_source: (sourceId ?? null) as number });
  if (error) throw dataError(error);
  return readArray(data).flatMap((value) => {
    const row = readRecord(value);
    const sourceIdRead = readNumber(row?.source_id);
    const label = readString(row?.label);
    if (!row || sourceIdRead == null || !label) return [];
    return [
      {
        sourceId: sourceIdRead,
        source: readString(row.source) ?? '',
        label,
        sample: readString(row.sample),
        pages: readNumber(row.pages) ?? 0,
        lastSeen: readString(row.last_seen),
      },
    ];
  });
}

export async function listSourcePageReads(supabase: Client, sourceId: number, limit = 25): Promise<SourcePageRead[]> {
  const { data, error } = await supabase.rpc('enrichment_source_pages', { p_source: sourceId, p_limit: limit });
  if (error) throw dataError(error);
  return readArray(data).flatMap((value) => {
    const row = readRecord(value);
    const id = readNumber(row?.id);
    const partId = readNumber(row?.part_id);
    const createdAt = readString(row?.created_at);
    if (!row || id == null || partId == null || !createdAt) return [];
    return [
      {
        id,
        partId,
        brand: readString(row.brand) ?? '',
        number: readString(row.number) ?? '',
        url: readString(row.url),
        status: (readString(row.status) ?? 'failed') as SourcePageRead['status'],
        credits: readNumber(row.credits) ?? 0,
        detail: readString(row.detail),
        dropped: readNumber(row.dropped) ?? 0,
        unmapped: readNumber(row.unmapped) ?? 0,
        profileVersion: readNumber(row.profile_version),
        stored: readBoolean(row.stored) ?? false,
        createdAt,
      },
    ];
  });
}

export async function getWebPageDetail(supabase: Client, pageId: number): Promise<WebPageDetail | null> {
  const { data, error } = await supabase.rpc('web_page_detail', { p_page: pageId });
  if (error) throw dataError(error);
  const row = readRecord(data);
  const id = readNumber(row?.id);
  const partId = readNumber(row?.part_id);
  const sourceId = readNumber(row?.source_id);
  if (!row || id == null || partId == null || sourceId == null) return null;
  const profile = readRecord(row.profile);
  return {
    id,
    partId,
    sourceId,
    url: readString(row.url),
    status: (readString(row.status) ?? 'failed') as WebPageDetail['status'],
    detail: readString(row.detail),
    credits: readNumber(row.credits) ?? 0,
    profile: { code: readString(profile?.code), version: readNumber(profile?.version) },
    schemaHash: readString(row.schema_hash),
    dropped: readArray(row.dropped).flatMap((d) => {
      const item = readRecord(d);
      return item ? [{ path: readString(item.path) ?? '', reason: readString(item.reason) ?? '' }] : [];
    }),
    unmappedSpecs: readArray(row.unmapped_specs).flatMap((u) => {
      const item = readRecord(u);
      return item ? [{ label: readString(item.label) ?? '', value: readString(item.value) ?? '' }] : [];
    }),
    createdAt: readString(row.created_at),
    extracted: readRecord(row.extracted),
    canonical: readRecord(row.canonical),
    matchesPart: readBoolean(row.matches_part),
  };
}

// Applies a test read, or a stored page again after a mapping change (editors). No credits are spent.
export async function reapplyWebPage(supabase: Client, pageId: number): Promise<{ status: string }> {
  const { data, error } = await supabase.rpc('reapply_web_page', { p_page: pageId });
  if (error) throw dataError(error);
  return { status: readString(readRecord(data)?.status) ?? 'failed' };
}

export async function estimateBackfill(supabase: Client, scope: BackfillScope): Promise<{ parts: number; credits: number }> {
  const { data, error } = await supabase.rpc('enrichment_backfill_estimate', { p_scope: scope });
  if (error) throw dataError(error);
  const row = readRecord(data);
  return { parts: readNumber(row?.parts) ?? 0, credits: readNumber(row?.credits) ?? 0 };
}

export async function queueBackfill(supabase: Client, scope: BackfillScope, limit: number): Promise<number> {
  const { data, error } = await supabase.rpc('queue_enrichment_backfill', { p_scope: scope, p_limit: limit });
  if (error) throw dataError(error);
  return readNumber(readRecord(data)?.queued) ?? 0;
}

export async function getBackfillStatus(supabase: Client): Promise<BackfillStatus | null> {
  const { data, error } = await supabase.rpc('enrichment_backfill_status');
  if (error) throw dataError(error);
  const row = readRecord(data);
  if (!row) return null;
  return {
    queued: readNumber(row.queued) ?? 0,
    running: readNumber(row.running) ?? 0,
    done30Days: readNumber(row.done_30d) ?? 0,
    failed30Days: readNumber(row.failed_30d) ?? 0,
    deferred: readNumber(row.deferred) ?? 0,
    lastFinishedAt: readString(row.last_finished_at),
  };
}

export async function cancelBackfill(supabase: Client): Promise<number> {
  const { data, error } = await supabase.rpc('cancel_enrichment_backfill');
  if (error) throw dataError(error);
  return typeof data === 'number' ? data : 0;
}
