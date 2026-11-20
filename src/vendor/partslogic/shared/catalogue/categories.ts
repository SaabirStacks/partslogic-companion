import type { Client } from '../core/client';
import { dataError } from '../core/errors';
import { readArray, readBoolean, readNumber, readRecord, readString, readStrings } from '../core/read';

// The house category tree (slice 5 of docs/ENRICHMENT_OVERHAUL.md): three levels at most (group, sub-group,
// product type), a part only on a category with nothing beneath it. The database keeps the rules; these read the
// tree, the wordings nothing maps yet, and make the changes a person asks for.

export type CategoryNode = {
  id: number;
  parentId: number | null;
  name: string;
  // 1 group, 2 sub-group, 3 product type
  level: number;
  // Parts that sit on this category itself.
  parts: number;
  // Nothing beneath it, so a part can sit on it.
  assignable: boolean;
};

export type CategoryTree = {
  // In display order: each group followed by what is beneath it.
  categories: CategoryNode[];
  // Parts are being categorised in the background.
  working: boolean;
};

export type UnmappedWording = {
  // A supplier's category wording, or the price-sheet name of parts that carry no such wording.
  kind: 'supplier_category' | 'name';
  wording: string;
  // Parts without a category that carry it.
  parts: number;
  // The house category its words come closest to, when one is close.
  suggestion: { id: number; trail: string[]; score: number } | null;
};

export type UnmappedWordings = {
  wordings: UnmappedWording[];
  // Stocked parts without a category.
  uncategorised: number;
  working: boolean;
};

export type CategoryOption = { id: number; trail: string[] };

export type PartCategory = { categoryId: number | null; trail: string[]; byHand: boolean };

// The whole tree (any member).
export async function getCategoryTree(supabase: Client): Promise<CategoryTree> {
  const { data, error } = await supabase.rpc('category_tree');
  if (error) throw dataError(error);
  const tree = readRecord(data);
  return {
    categories: readArray(tree?.categories).flatMap((value) => {
      const row = readRecord(value);
      const id = readNumber(row?.id);
      const name = readString(row?.name);
      if (id == null || name == null) return [];
      return [
        {
          id,
          parentId: readNumber(row?.parent_id),
          name,
          level: readNumber(row?.level) ?? 1,
          parts: readNumber(row?.parts) ?? 0,
          assignable: readBoolean(row?.assignable) ?? false,
        },
      ];
    }),
    working: readBoolean(tree?.working) ?? false,
  };
}

// The wordings nothing maps yet, most parts first (any member).
export async function getUnmappedWordings(supabase: Client, limit = 100): Promise<UnmappedWordings> {
  const { data, error } = await supabase.rpc('unmapped_category_wordings', { p_limit: limit });
  if (error) throw dataError(error);
  const list = readRecord(data);
  return {
    wordings: readArray(list?.wordings).flatMap((value) => {
      const row = readRecord(value);
      const wording = readString(row?.wording);
      if (wording == null) return [];
      const suggestion = readRecord(row?.suggestion);
      const suggested = readNumber(suggestion?.id);
      return [
        {
          kind: row?.kind === 'name' ? ('name' as const) : ('supplier_category' as const),
          wording,
          parts: readNumber(row?.parts) ?? 0,
          suggestion:
            suggested != null
              ? { id: suggested, trail: readStrings(suggestion?.trail), score: readNumber(suggestion?.score) ?? 0 }
              : null,
        },
      ];
    }),
    uncategorised: readNumber(list?.uncategorised) ?? 0,
    working: readBoolean(list?.working) ?? false,
  };
}

// Says a wording means a house category (catalogue curator). parts were categorised at once; more is true when
// the rest follow in the background.
export async function mapCategoryWording(
  supabase: Client,
  wording: string,
  categoryId: number,
): Promise<{ parts: number; more: boolean }> {
  const { data, error } = await supabase.rpc('map_category_wording', { p_wording: wording, p_category: categoryId });
  if (error) throw dataError(error);
  const done = readRecord(data);
  return { parts: readNumber(done?.parts) ?? 0, more: readBoolean(done?.more) ?? false };
}

// Adds a category beneath another, or a group when parentId is null (catalogue curator). Returns its id.
export async function createCategory(supabase: Client, parentId: number | null, name: string): Promise<number> {
  // The generated type has no null for the parent; the function takes one for a group.
  const { data, error } = await supabase.rpc('create_category', { p_parent: parentId as number, p_name: name });
  if (error) throw dataError(error);
  return data as number;
}

export async function renameCategory(supabase: Client, categoryId: number, name: string): Promise<void> {
  const { error } = await supabase.rpc('rename_category', { p_category: categoryId, p_name: name });
  if (error) throw dataError(error);
}

// Removes a category that holds no parts and has nothing beneath it (catalogue curator).
export async function removeCategory(supabase: Client, categoryId: number): Promise<void> {
  const { error } = await supabase.rpc('remove_category', { p_category: categoryId });
  if (error) throw dataError(error);
}

// Sets a part's category by hand (editor); null clears the hand-set one, so the found category applies again.
export async function setPartCategory(supabase: Client, partId: number, categoryId: number | null): Promise<PartCategory> {
  const { data, error } = await supabase.rpc('set_part_category', { p_part: partId, p_category: categoryId as number });
  if (error) throw dataError(error);
  const set = readRecord(data);
  return {
    categoryId: readNumber(set?.category_id),
    trail: readStrings(set?.trail),
    byHand: readBoolean(set?.by_hand) ?? false,
  };
}

// Each category's names from its group down, by id.
export function categoryTrails(categories: CategoryNode[]): Map<number, string[]> {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const trails = new Map<number, string[]>();
  for (const category of categories) {
    const trail: string[] = [];
    let at: CategoryNode | undefined = category;
    // three levels at most; the guard only stops a broken tree from looping
    for (let depth = 0; at && depth < 8; depth++) {
      trail.unshift(at.name);
      at = at.parentId != null ? byId.get(at.parentId) : undefined;
    }
    trails.set(category.id, trail);
  }
  return trails;
}

// The categories a part can sit on, in display order, each with its trail.
export function assignableCategories(categories: CategoryNode[]): CategoryOption[] {
  const trails = categoryTrails(categories);
  return categories.filter((category) => category.assignable).map((category) => ({ id: category.id, trail: trails.get(category.id) ?? [category.name] }));
}
