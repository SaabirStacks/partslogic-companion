import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { dataError } from '../core/errors';
import { readArray, readBoolean, readNumber, readRecord, readString } from '../core/read';

// Searching Autodoc from the Catalogue (slice 6 of docs/ENRICHMENT_OVERHAUL.md). A search page is paid for once
// and saved; these read the saved copy in our own shape. The server does the paid call and the opening
// (lib/enrichment/autodoc-search.ts).

// What one page of search results costs, in Piloterr credits. Charged once: the page is then read from its saved copy.
export const AUTODOC_SEARCH_CREDITS = 2;

// A saved search is shown again for this long before a screen offers to search afresh.
export const AUTODOC_SEARCH_FRESH_DAYS = 30;

export type AutodocSearchResult = {
  // Autodoc's page for the product: what identifies a result within a search.
  productUrl: string;
  brand: string;
  reference: string;
  name: string | null;
  // The product type ("Brake caliper").
  genericName: string | null;
  image: string | null;
  // The shop's price on the day of the search: a guide, never a cost.
  price: number | null;
  availability: string | null;
  // The catalogue part this result already is, when the catalogue holds it.
  partId: number | null;
  // That part is on the stock list.
  inRange: boolean;
  // That part has been enriched.
  enriched: boolean;
};

export type AutodocSearch = {
  id: number;
  keyword: string;
  page: number;
  searchedAt: string | null;
  // Autodoc has a further page of results.
  hasMore: boolean;
  results: AutodocSearchResult[];
};

export function readAutodocSearch(value: Json | null | undefined): AutodocSearch | null {
  const search = readRecord(value ?? null);
  const id = readNumber(search?.id);
  if (!search || id == null) return null;
  return {
    id,
    keyword: readString(search.keyword) ?? '',
    page: readNumber(search.page) ?? 1,
    searchedAt: readString(search.searched_at),
    hasMore: readBoolean(search.has_more) ?? false,
    results: readArray(search.results).flatMap((item) => {
      const row = readRecord(item);
      const productUrl = readString(row?.product_url);
      const reference = readString(row?.reference);
      if (!productUrl || !reference) return [];
      return [
        {
          productUrl,
          brand: readString(row?.brand) ?? '',
          reference,
          name: readString(row?.name),
          genericName: readString(row?.generic_name),
          image: readString(row?.image),
          price: readNumber(row?.price),
          availability: readString(row?.availability),
          partId: readNumber(row?.part_id),
          inRange: readBoolean(row?.in_range) ?? false,
          enriched: readBoolean(row?.enriched) ?? false,
        },
      ];
    }),
  };
}

// The saved copy of a search page, or null when it has not been searched yet (any member; nothing is spent).
export async function getSavedAutodocSearch(supabase: Client, keyword: string, page = 1): Promise<AutodocSearch | null> {
  const { data, error } = await supabase.rpc('autodoc_search_saved', { p_keyword: keyword, p_page: page });
  if (error) throw dataError(error);
  return readAutodocSearch(data);
}

// What a result is called in a list: Autodoc's name without the brand it starts with.
export function autodocResultName(result: Pick<AutodocSearchResult, 'name' | 'genericName' | 'brand'>): string {
  const name = result.name ?? result.genericName ?? '';
  const brand = result.brand.trim();
  const rest = brand && name.toLowerCase().startsWith(brand.toLowerCase()) ? name.slice(brand.length).trim() : name;
  return rest || result.genericName || name;
}
