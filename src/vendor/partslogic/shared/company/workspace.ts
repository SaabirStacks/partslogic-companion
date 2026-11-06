import type { Database } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { DataError, dataError } from '../core/errors';
import { readNumber } from '../core/read';

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
