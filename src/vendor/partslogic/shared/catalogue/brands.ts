import type { Database } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { dataError } from '../core/errors';
import { readArray, readNumber, readRecord, readString } from '../core/read';

export type BrandKind = Database['catalogue']['Enums']['brand_kind'];
// exact / prefix / alias / similar / contains for a search; "held" for the brands you hold most of.
export type BrandMatch = 'exact' | 'prefix' | 'alias' | 'similar' | 'contains' | 'held';

export type BrandOption = {
  brandId: number;
  name: string;
  kind: BrandKind;
  // The alias that matched, when the brand was found by another spelling.
  alias: string | null;
  match: BrandMatch;
  score: number;
  parts: number;
};

const BRAND_MATCHES: readonly BrandMatch[] = ['exact', 'prefix', 'alias', 'similar', 'contains', 'held'];

// Brands for a picker. An empty query lists the brands you hold most of.
export async function brandOptions(supabase: Client, query: string | null, limit = 12): Promise<BrandOption[]> {
  const { data, error } = await supabase.rpc('brand_options', {
    p_query: query?.trim() || undefined,
    p_limit: Math.min(Math.max(limit, 1), 50),
  });
  if (error) throw dataError(error);

  return (data ?? []).flatMap((row) => {
    const match = BRAND_MATCHES.find((value) => value === row.match);
    if (row.brand_id == null || row.name == null || row.kind == null || !match) return [];
    return [
      {
        brandId: row.brand_id,
        name: row.name,
        kind: row.kind,
        alias: row.alias,
        match,
        score: readNumber(row.score) ?? 0,
        parts: readNumber(row.parts) ?? 0,
      },
    ];
  });
}

export type BrandSuggestion = { brandId: number; name: string; match: string; parts: number };
export type BrandCheck = {
  name: string;
  brandId: number | null;
  brand: string | null;
  viaAlias: boolean;
  suggestions: BrandSuggestion[];
};

// Which of these names (a file's brand values, or its headers) are brands already, with near matches for
// the rest.
export async function checkBrands(supabase: Client, names: string[]): Promise<BrandCheck[]> {
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))].slice(0, 1000);
  if (unique.length === 0) return [];
  const { data, error } = await supabase.rpc('check_brands', { p_names: unique });
  if (error) throw dataError(error);
  return (data ?? []).flatMap((row) =>
    row.name == null
      ? []
      : [
          {
            name: row.name,
            brandId: row.brand_id,
            brand: row.brand,
            viaAlias: row.via_alias === true,
            suggestions: readArray(row.suggestions).flatMap((value) => {
              const item = readRecord(value);
              const brandId = readNumber(item?.brand_id);
              const name = readString(item?.name);
              return brandId == null || !name
                ? []
                : [{ brandId, name, match: readString(item?.match) ?? 'similar', parts: readNumber(item?.parts) ?? 0 }];
            }),
          },
        ],
  );
}

export async function createBrand(supabase: Client, name: string, confirm = false): Promise<number> {
  const { data, error } = await supabase.rpc('create_brand', { p_name: name.trim(), p_confirm: confirm });
  if (error) throw dataError(error);
  return data;
}

export async function aliasBrandName(supabase: Client, alias: string, brandId: number): Promise<void> {
  const { error } = await supabase.rpc('alias_brand_name', { p_alias: alias.trim(), p_brand: brandId });
  if (error) throw dataError(error);
}
