import type { Client } from '../core/client';
import { dataError } from '../core/errors';
import { readNumber } from '../core/read';
import type { PartKind } from '../inventory/items';

export type PartSearchResult = {
  partId: number;
  brand: string;
  number: string;
  kind: PartKind;
  description: string | null;
  matchType: string;
  score: number;
};

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
