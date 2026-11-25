import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { DataError, dataError } from '../core/errors';
import { readArray, readNumber, readRecord, readString } from '../core/read';

// Views a person saves for a list (20261124090000: saved_views): a name and the list's settings, theirs alone and on
// every device they sign in on. Only the Stock list has them for now; its settings are read by stock-views.ts.

export type SavedViewList = 'stock';

export type SavedView = {
  id: number;
  list: SavedViewList;
  name: string;
  params: Json;
  position: number;
  updatedAt: string | null;
};

// The longest name a view takes, and how many views a list takes.
export const SAVED_VIEW_NAME_MAX = 60;
export const SAVED_VIEWS_MAX = 30;

export function readSavedView(data: Json | undefined): SavedView | null {
  const view = readRecord(data);
  const id = readNumber(view?.id);
  const name = readString(view?.name);
  if (!view || id == null || !name || view.list !== 'stock') return null;
  return {
    id,
    list: 'stock',
    name,
    params: view.params ?? {},
    position: readNumber(view.position) ?? 0,
    updatedAt: readString(view.updated_at),
  };
}

function readSavedViewOrThrow(data: Json): SavedView {
  const view = readSavedView(data);
  if (!view) throw new DataError('The view could not be read back.', 'PGRST116');
  return view;
}

export function listSavedViews(supabase: Client, list: SavedViewList): Promise<SavedView[]> {
  return call(supabase.rpc('saved_views', { p_list: list }), (data) =>
    readArray(data).flatMap((item) => {
      const view = readSavedView(item);
      return view ? [view] : [];
    }),
  );
}

// A new view (no id), or new settings and name for one already saved (id).
export function saveView(
  supabase: Client,
  view: { list: SavedViewList; name: string; params: Json; id?: number | null },
): Promise<SavedView> {
  return call(
    supabase.rpc('save_view', { p_list: view.list, p_name: view.name, p_params: view.params, p_id: view.id ?? null }),
    readSavedViewOrThrow,
  );
}

export function renameView(supabase: Client, id: number, name: string): Promise<SavedView> {
  return call(supabase.rpc('rename_view', { p_id: id, p_name: name }), readSavedViewOrThrow);
}

export async function deleteView(supabase: Client, id: number): Promise<void> {
  const { error } = await supabase.rpc('delete_view', { p_id: id });
  if (error) throw dataError(error);
}
