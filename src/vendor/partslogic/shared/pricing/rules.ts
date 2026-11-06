import type { Json } from '@partslogic/db-types';

import { isPriceRounding, type PriceRounding } from '../company/workspace';
import type { Client } from '../core/client';
import { DataError, dataError } from '../core/errors';
import { readBoolean, readNumber, readRecord, readString, type JsonRecord } from '../core/read';

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
