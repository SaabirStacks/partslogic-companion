import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@partslogic/db-types';

import { DataError, dataError } from './errors';
import type { AppRole } from './members';
import { readBoolean, readNumber, readRecord, readString } from './read';

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------------------------- company

export const PRICE_ROUNDINGS = ['up_1p', 'up_5p', 'up_10p', 'end_99p', 'end_49_99p'] as const;
export type PriceRounding = (typeof PRICE_ROUNDINGS)[number];

export type Workspace = {
  name: string;
  currency: string;
  vatRate: number;
  retailIncludesVat: boolean;
  priceRounding: PriceRounding;
  // Added to a supplier's exchange surcharge to give the customer's (0.05 = 5%).
  surchargeUplift: number;
};

export type WorkspaceChanges = Partial<Workspace>;

export function isPriceRounding(value: string): value is PriceRounding {
  return (PRICE_ROUNDINGS as readonly string[]).includes(value);
}

// The company's own settings: name, currency, VAT and how rule prices are rounded.
export async function getWorkspace(supabase: Client): Promise<Workspace> {
  const { data, error } = await supabase
    .from('workspace')
    .select('name, currency, vat_rate, retail_includes_vat, price_rounding, surcharge_uplift')
    .single();
  if (error) throw dataError(error);
  return {
    name: data.name,
    currency: data.currency,
    vatRate: readNumber(data.vat_rate) ?? 0.2,
    retailIncludesVat: data.retail_includes_vat,
    priceRounding: isPriceRounding(data.price_rounding) ? data.price_rounding : 'up_1p',
    surchargeUplift: readNumber(data.surcharge_uplift) ?? 0.05,
  };
}

// Changes company settings (owners only; row-level security refuses anyone else).
export async function updateWorkspace(supabase: Client, changes: WorkspaceChanges): Promise<Workspace> {
  const values: Database['public']['Tables']['workspace']['Update'] = {};
  if (changes.name !== undefined) values.name = changes.name.trim();
  if (changes.currency !== undefined) values.currency = changes.currency.trim().toUpperCase();
  if (changes.vatRate !== undefined) values.vat_rate = changes.vatRate;
  if (changes.retailIncludesVat !== undefined) values.retail_includes_vat = changes.retailIncludesVat;
  if (changes.priceRounding !== undefined) values.price_rounding = changes.priceRounding;
  if (changes.surchargeUplift !== undefined) values.surcharge_uplift = changes.surchargeUplift;
  if (Object.keys(values).length > 0) {
    const { data, error } = await supabase.from('workspace').update(values).eq('id', true).select('id');
    if (error) throw dataError(error);
    if (!data.length) throw new DataError('Only the owner can change company settings.', '42501');
  }
  return getWorkspace(supabase);
}

// ---------------------------------------------------------------------------------------------- pricing rules

export type RuleScope = 'company' | 'brand' | 'category' | 'part';

export type PricingRule = {
  id: number;
  scope: RuleScope;
  scopeId: number | null;
  minMargin: number | null;
  retailMargin: number | null;
  tradeMargin: number | null;
  updatedAt: string;
};

export type RuleMargins = { minMargin: number | null; retailMargin: number | null; tradeMargin: number | null };

export type PartPricingRules = {
  effective: {
    minMargin: number | null;
    minFrom: RuleScope | null;
    retailMargin: number | null;
    retailFrom: RuleScope | null;
    tradeMargin: number | null;
    tradeFrom: RuleScope | null;
  };
  own: RuleMargins | null;
  rulePrices: { retail: number | null; trade: number | null };
  workspace: { vatRate: number; retailIncludesVat: boolean; priceRounding: PriceRounding; currency: string };
};

const SCOPES = new Set<string>(['company', 'brand', 'category', 'part']);

function scopeOf(row: { brand_id: number | null; category_id: number | null; part_id: number | null }): {
  scope: RuleScope;
  scopeId: number | null;
} {
  if (row.part_id != null) return { scope: 'part', scopeId: row.part_id };
  if (row.category_id != null) return { scope: 'category', scopeId: row.category_id };
  if (row.brand_id != null) return { scope: 'brand', scopeId: row.brand_id };
  return { scope: 'company', scopeId: null };
}

// Every pricing rule, company first.
export async function listPricingRules(supabase: Client): Promise<PricingRule[]> {
  const { data, error } = await supabase
    .from('pricing_rules')
    .select('id, brand_id, category_id, part_id, min_margin, retail_margin, trade_margin, updated_at')
    .order('id');
  if (error) throw dataError(error);
  const order: Record<RuleScope, number> = { company: 0, brand: 1, category: 2, part: 3 };
  return (data ?? [])
    .map((row) => ({
      id: row.id,
      ...scopeOf(row),
      minMargin: readNumber(row.min_margin),
      retailMargin: readNumber(row.retail_margin),
      tradeMargin: readNumber(row.trade_margin),
      updatedAt: row.updated_at,
    }))
    .sort((a, b) => order[a.scope] - order[b.scope] || a.id - b.id);
}

// Sets the margins for one scope. Brand, category and part rules with no margin left are removed; the
// company rule always stays. Company, brand and category need an admin; a part needs an editor.
export async function savePricingRule(
  supabase: Client,
  scope: RuleScope,
  scopeId: number | null,
  margins: RuleMargins,
): Promise<void> {
  if (!SCOPES.has(scope)) throw new DataError('Unknown rule scope.', '22023');
  if ((scope === 'company') !== (scopeId == null)) throw new DataError('Only the company rule has no scope.', '22023');
  const values = {
    min_margin: margins.minMargin,
    retail_margin: margins.retailMargin,
    trade_margin: margins.tradeMargin,
  };
  const column = scope === 'brand' ? 'brand_id' : scope === 'category' ? 'category_id' : scope === 'part' ? 'part_id' : null;

  let query = supabase.from('pricing_rules').select('id');
  query =
    column == null
      ? query.is('brand_id', null).is('category_id', null).is('part_id', null)
      : query.eq(column, scopeId as number);
  const { data: existing, error: readError } = await query.maybeSingle();
  if (readError) throw dataError(readError);

  const empty = margins.minMargin == null && margins.retailMargin == null && margins.tradeMargin == null;
  if (existing && empty && scope !== 'company') {
    const { data, error } = await supabase.from('pricing_rules').delete().eq('id', existing.id).select('id');
    if (error) throw dataError(error);
    if (!data.length) throw notAllowed(scope);
    return;
  }
  if (existing) {
    const { data, error } = await supabase.from('pricing_rules').update(values).eq('id', existing.id).select('id');
    if (error) throw dataError(error);
    if (!data.length) throw notAllowed(scope);
    return;
  }
  if (empty) return;
  const { error } = await supabase.from('pricing_rules').insert({ ...values, ...(column ? { [column]: scopeId } : {}) });
  if (error) throw dataError(error);
}

function notAllowed(scope: RuleScope): DataError {
  return new DataError(
    scope === 'part'
      ? 'You need the editor role to change a part’s margins.'
      : 'You need the admin role to change company, brand or category margins.',
    '42501',
  );
}

// The margins that apply to one part (with where each comes from), its own rule and the prices the rules give.
export async function getPartPricingRules(supabase: Client, partId: number): Promise<PartPricingRules> {
  const { data, error } = await supabase.rpc('part_pricing_rules', { p_part: partId });
  if (error) throw dataError(error);
  const record = readRecord(data);
  const effective = readRecord(record?.effective);
  const own = readRecord(record?.own);
  const prices = readRecord(record?.rule_prices);
  const workspace = readRecord(record?.workspace);
  const scope = (value: Json | undefined) => {
    const text = readString(value);
    return text && SCOPES.has(text) ? (text as RuleScope) : null;
  };
  const rounding = readString(workspace?.price_rounding) ?? 'up_1p';
  return {
    effective: {
      minMargin: readNumber(effective?.min_margin),
      minFrom: scope(effective?.min_from),
      retailMargin: readNumber(effective?.retail_margin),
      retailFrom: scope(effective?.retail_from),
      tradeMargin: readNumber(effective?.trade_margin),
      tradeFrom: scope(effective?.trade_from),
    },
    own: own
      ? {
          minMargin: readNumber(own.min_margin),
          retailMargin: readNumber(own.retail_margin),
          tradeMargin: readNumber(own.trade_margin),
        }
      : null,
    rulePrices: { retail: readNumber(prices?.retail), trade: readNumber(prices?.trade) },
    workspace: {
      vatRate: readNumber(workspace?.vat_rate) ?? 0.2,
      retailIncludesVat: readBoolean(workspace?.retail_includes_vat) ?? true,
      priceRounding: isPriceRounding(rounding) ? rounding : 'up_1p',
      currency: readString(workspace?.currency) ?? 'GBP',
    },
  };
}

// The price a margin gives, rounded the way the workspace says (mirrors public.round_sell_price), for
// previews on the settings page. Prices are without VAT.
export function rulePrice(
  cost: number,
  margin: number,
  tier: 'retail' | 'trade',
  settings: { vatRate: number; retailIncludesVat: boolean; priceRounding: PriceRounding },
): number {
  const raw = cost / (1 - margin);
  const factor = tier === 'retail' && settings.retailIncludesVat ? 1 + settings.vatRate : 1;
  const shown = raw * factor;
  const whole = Math.floor(shown);
  const ceilTo = (step: number) => Math.ceil(Math.round(shown / step * 1e6) / 1e6) * step;
  let rounded: number;
  switch (settings.priceRounding) {
    case 'up_5p':
      rounded = ceilTo(0.05);
      break;
    case 'up_10p':
      rounded = ceilTo(0.1);
      break;
    case 'end_99p':
      rounded = shown <= whole + 0.99 ? whole + 0.99 : whole + 1.99;
      break;
    case 'end_49_99p':
      rounded = shown <= whole + 0.49 ? whole + 0.49 : shown <= whole + 0.99 ? whole + 0.99 : whole + 1.49;
      break;
    default:
      rounded = ceilTo(0.01);
  }
  return Math.round((rounded / factor) * 10000) / 10000;
}

// ---------------------------------------------------------------------------------------------- locations and bins

export type LocationSummary = {
  id: number;
  code: string;
  name: string;
  bins: number;
  activeBins: number;
  stockedBins: number;
  units: number;
  parts: number;
};

export type BinSummary = {
  id: number;
  code: string;
  description: string | null;
  isActive: boolean;
  isSystem: boolean;
  units: number;
  parts: number;
};

export type BinsCreated = { created: number; skipped: number; skippedCodes: string[] };

export async function listLocationSummaries(supabase: Client): Promise<LocationSummary[]> {
  const { data, error } = await supabase.rpc('location_overview');
  if (error) throw dataError(error);
  return (data ?? []).flatMap((row) =>
    row.location_id == null || row.code == null || row.name == null
      ? []
      : [
          {
            id: row.location_id,
            code: row.code,
            name: row.name,
            bins: row.bins ?? 0,
            activeBins: row.active_bins ?? 0,
            stockedBins: row.stocked_bins ?? 0,
            units: readNumber(row.units) ?? 0,
            parts: row.parts ?? 0,
          },
        ],
  );
}

export async function listLocationBins(supabase: Client, locationId: number): Promise<BinSummary[]> {
  const { data, error } = await supabase.rpc('location_bins', { p_location: locationId });
  if (error) throw dataError(error);
  return (data ?? []).flatMap((row) =>
    row.bin_id == null || row.code == null
      ? []
      : [
          {
            id: row.bin_id,
            code: row.code,
            description: row.description,
            isActive: row.is_active ?? true,
            isSystem: row.is_system ?? false,
            units: readNumber(row.units) ?? 0,
            parts: row.parts ?? 0,
          },
        ],
  );
}

// Adds many bins to a location; codes the location already has are skipped.
export async function createBins(supabase: Client, locationId: number, codes: string[]): Promise<BinsCreated> {
  const { data, error } = await supabase.rpc('create_bins', { p_location: locationId, p_codes: codes });
  if (error) throw dataError(error);
  const record = readRecord(data);
  const skippedCodes = Array.isArray(record?.skipped_codes)
    ? record.skipped_codes.filter((code): code is string => typeof code === 'string')
    : [];
  return { created: readNumber(record?.created) ?? 0, skipped: readNumber(record?.skipped) ?? 0, skippedCodes };
}

export async function updateLocation(
  supabase: Client,
  locationId: number,
  changes: { code?: string; name?: string },
): Promise<void> {
  const values: Database['public']['Tables']['locations']['Update'] = {};
  if (changes.code !== undefined) values.code = changes.code.trim().toUpperCase();
  if (changes.name !== undefined) values.name = changes.name.trim();
  const { data, error } = await supabase.from('locations').update(values).eq('id', locationId).select('id');
  if (error) throw dataError(error);
  if (!data.length) throw new DataError('That location no longer exists, or you need the editor role.', '42501');
}

// Removes a location and its bins. Stock in them moves to the unassigned bin, so nothing is lost.
export async function deleteLocation(supabase: Client, locationId: number): Promise<void> {
  const { data, error } = await supabase.from('locations').delete().eq('id', locationId).select('id');
  if (error) throw dataError(error);
  if (!data.length) throw new DataError('That location no longer exists, or you need the editor role.', '42501');
}

export async function updateBin(
  supabase: Client,
  binId: number,
  changes: { code?: string; description?: string | null; isActive?: boolean },
): Promise<void> {
  const values: Database['public']['Tables']['bins']['Update'] = {};
  if (changes.code !== undefined) values.code = changes.code.trim().toUpperCase();
  if (changes.description !== undefined) values.description = changes.description?.trim() || null;
  if (changes.isActive !== undefined) values.is_active = changes.isActive;
  const { data, error } = await supabase.from('bins').update(values).eq('id', binId).eq('is_system', false).select('id');
  if (error) throw dataError(error);
  if (!data.length) throw new DataError('That bin cannot be changed (it may be a system bin), or you need the editor role.', '42501');
}

// Removes a bin. Stock in it moves to the location's unbinned bin.
export async function deleteBin(supabase: Client, binId: number): Promise<void> {
  const { data, error } = await supabase.from('bins').delete().eq('id', binId).eq('is_system', false).select('id');
  if (error) throw dataError(error);
  if (!data.length) throw new DataError('That bin cannot be removed (it may be a system bin), or you need the editor role.', '42501');
}

// ---------------------------------------------------------------------------------------------- people

export async function setMemberRole(supabase: Client, userId: string, role: AppRole): Promise<void> {
  const { data, error } = await supabase.from('members').update({ role }).eq('user_id', userId).select('user_id');
  if (error) throw dataError(error);
  if (!data.length) throw new DataError('You need the admin role to change roles (and the owner role to make an owner).', '42501');
}

// ---------------------------------------------------------------------------------------------- Autodoc and engine

export type EnrichmentBudget = {
  limit: number | null;
  // Spend counts from here; null means since the first call.
  periodStart: string | null;
  spent: number;
  allTime: number;
  charged: number;
  refunded: number;
  updatedAt: string | null;
};

export type EnrichmentRunSummary = {
  targetId: number;
  partId: number;
  brand: string;
  number: string;
  status: string;
  credits: number;
  lastError: string | null;
  productUrl: string | null;
  updatedAt: string;
};

export type EngineSetting = { key: string; value: number; description: string; updatedAt: string };

export async function getEnrichmentBudget(supabase: Client): Promise<EnrichmentBudget | null> {
  const { data, error } = await supabase.rpc('enrichment_budget');
  if (error) throw dataError(error);
  const record = readRecord(data);
  if (!record) return null;
  return {
    limit: readNumber(record.limit),
    periodStart: readString(record.period_start),
    spent: readNumber(record.spent) ?? 0,
    allTime: readNumber(record.all_time) ?? readNumber(record.spent) ?? 0,
    charged: readNumber(record.charged) ?? 0,
    refunded: readNumber(record.refunded) ?? 0,
    updatedAt: readString(record.updated_at),
  };
}

// Starts a new budget period now: spend counts from zero again (admins). The ledger keeps every call.
export async function resetEnrichmentBudgetPeriod(supabase: Client): Promise<void> {
  const { error } = await supabase.rpc('reset_api_budget_period', { p_provider: 'piloterr' });
  if (error) throw dataError(error);
}

export async function listEnrichmentRuns(supabase: Client, limit = 50): Promise<EnrichmentRunSummary[]> {
  const { data, error } = await supabase.rpc('enrichment_activity', { p_limit: limit });
  if (error) throw dataError(error);
  return (data ?? []).flatMap((row) =>
    row.target_id == null || row.part_id == null || row.brand == null || row.number == null || row.status == null || row.updated_at == null
      ? []
      : [
          {
            targetId: row.target_id,
            partId: row.part_id,
            brand: row.brand,
            number: row.number,
            status: row.status,
            credits: readNumber(row.credits) ?? 0,
            lastError: row.last_error,
            productUrl: row.product_url,
            updatedAt: row.updated_at,
          },
        ],
  );
}

export async function listEngineSettings(supabase: Client): Promise<EngineSetting[]> {
  const { data, error } = await supabase.rpc('catalogue_settings');
  if (error) throw dataError(error);
  return (data ?? []).flatMap((row) =>
    row.key == null || row.value == null
      ? []
      : [{ key: row.key, value: readNumber(row.value) ?? 0, description: row.description ?? '', updatedAt: row.updated_at ?? '' }],
  );
}

// "BGA BK1405" labels for parts, for lists of part-level rules.
export async function labelParts(supabase: Client, partIds: number[]): Promise<Record<number, string>> {
  if (!partIds.length) return {};
  const { data, error } = await supabase
    .from('inventory_rows')
    .select('part_id, brand_name, part_number')
    .in('part_id', partIds.slice(0, 500));
  if (error) throw dataError(error);
  return Object.fromEntries(
    (data ?? []).flatMap((row) =>
      row.part_id == null ? [] : [[row.part_id, `${row.brand_name ?? ''} ${row.part_number ?? ''}`.trim()]],
    ),
  );
}
