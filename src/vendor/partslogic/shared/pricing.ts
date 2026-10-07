import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@partslogic/db-types';

import { DataError, dataError } from './errors';
import { readNumber } from './read';

type Client = SupabaseClient<Database>;

export type PriceTierName = Database['public']['Enums']['price_tier'];
export const PRICE_TIERS: readonly PriceTierName[] = ['retail', 'trade'];

// One sell price row: tier, quantity break and active dates. Prices are stored without VAT.
export type PriceTier = {
  id: number;
  tier: PriceTierName;
  minQty: number;
  price: number;
  activeFrom: string;
  activeTo: string | null;
  status: 'active' | 'scheduled' | 'expired';
};

export type PriceTierInput = {
  id?: number | null;
  tier: PriceTierName;
  minQty: number;
  price: number;
  activeFrom?: string | null;
  activeTo?: string | null;
};

export type PartPricing = { tiers: PriceTier[]; vatRate: number; currency: string };

export function isPriceTier(value: string): value is PriceTierName {
  return (PRICE_TIERS as readonly string[]).includes(value);
}

// Whether a row applies today, starts later, or has ended. Dates are calendar days (YYYY-MM-DD).
export function priceTierStatus(activeFrom: string, activeTo: string | null, today: string): PriceTier['status'] {
  if (activeFrom > today) return 'scheduled';
  if (activeTo != null && activeTo < today) return 'expired';
  return 'active';
}

// A part's sell price tiers with the VAT rate and currency to show them in.
export async function getPartPricing(supabase: Client, partId: number, today = isoDay(new Date())): Promise<PartPricing> {
  const [tiers, workspace] = await Promise.all([
    supabase
      .from('inventory_prices')
      .select('id, tier, min_qty, price, active_from, active_to')
      .eq('part_id', partId)
      .order('tier')
      .order('min_qty')
      .order('active_from', { ascending: false }),
    supabase.from('workspace').select('vat_rate, currency').maybeSingle(),
  ]);
  if (tiers.error) throw dataError(tiers.error);
  if (workspace.error) throw dataError(workspace.error);

  return {
    tiers: (tiers.data ?? []).map((row) => ({
      id: row.id,
      tier: row.tier,
      minQty: readNumber(row.min_qty) ?? 1,
      price: readNumber(row.price) ?? 0,
      activeFrom: row.active_from,
      activeTo: row.active_to,
      status: priceTierStatus(row.active_from, row.active_to, today),
    })),
    vatRate: readNumber(workspace.data?.vat_rate) ?? 0.2,
    currency: workspace.data?.currency ?? 'GBP',
  };
}

// Adds a price row, or changes one when input.id is set. Returns the row id.
export async function savePriceTier(supabase: Client, partId: number, input: PriceTierInput): Promise<number> {
  const values = {
    tier: input.tier,
    min_qty: input.minQty,
    price: input.price,
    active_to: input.activeTo ?? null,
    ...(input.activeFrom ? { active_from: input.activeFrom } : {}),
  };
  if (input.id != null) {
    const { data, error } = await supabase
      .from('inventory_prices')
      .update(values)
      .eq('id', input.id)
      .eq('part_id', partId)
      .select('id');
    if (error) throw dataError(error);
    if (!data.length) throw await notChanged(supabase, input.id);
    return input.id;
  }
  const { data, error } = await supabase
    .from('inventory_prices')
    .insert({ part_id: partId, ...values })
    .select('id')
    .single();
  if (error) throw dataError(error);
  return data.id;
}

// Removes one price row.
export async function deletePriceTier(supabase: Client, partId: number, priceId: number): Promise<void> {
  const { data, error } = await supabase
    .from('inventory_prices')
    .delete()
    .eq('id', priceId)
    .eq('part_id', partId)
    .select('id');
  if (error) throw dataError(error);
  if (!data.length) throw await notChanged(supabase, priceId);
}

async function notChanged(supabase: Client, priceId: number): Promise<DataError> {
  const { count, error } = await supabase
    .from('inventory_prices')
    .select('id', { count: 'exact', head: true })
    .eq('id', priceId);
  if (error) return dataError(error);
  return count
    ? new DataError('You need the editor role to change prices.', '42501')
    : new DataError('That price no longer exists.', 'PGRST116');
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}
