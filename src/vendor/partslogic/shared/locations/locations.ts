import type { Database } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { DataError, dataError } from '../core/errors';
import { readNumber } from '../core/read';

export type Location = {
  id: number;
  code: string;
  name: string;
  bins: { id: number; code: string; place: string; isActive: boolean; isSystem: boolean }[];
};

// Every location with its bins, for stock forms. The unassigned bin comes back as its own location.
export async function listLocations(supabase: Client): Promise<Location[]> {
  const { data, error } = await supabase
    .from('bin_places')
    .select('bin_id, bin_code, location_id, location_code, location_name, place, is_active, is_system')
    .order('location_code', { ascending: true, nullsFirst: true })
    .order('bin_code', { ascending: true });
  if (error) throw dataError(error);

  const locations = new Map<number, Location>();
  for (const row of data ?? []) {
    if (row.bin_id == null || row.bin_code == null || row.place == null) continue;
    const id = row.location_id ?? 0;
    const location = locations.get(id) ?? {
      id,
      code: row.location_code ?? 'UNASSIGNED',
      name: row.location_name ?? 'Unassigned',
      bins: [],
    };
    location.bins.push({
      id: row.bin_id,
      code: row.bin_code,
      place: row.place,
      isActive: row.is_active ?? true,
      isSystem: row.is_system ?? false,
    });
    locations.set(id, location);
  }
  return [...locations.values()];
}

// Adds a location. Postgres gives every new location an unbinned bin to put stock in straight away.
// Every location, by code: for pickers (where an order is delivered).
export type LocationOption = { id: number; code: string; name: string };
export async function listLocationOptions(supabase: Client): Promise<LocationOption[]> {
  const { data, error } = await supabase.from('locations').select('id, code, name').order('code');
  if (error) throw dataError(error);
  return (data ?? []).map((row) => ({ id: row.id, code: row.code, name: row.name }));
}

export async function createLocation(supabase: Client, input: { code: string; name: string }): Promise<number> {
  const { data, error } = await supabase
    .from('locations')
    .insert({ code: input.code.trim().toUpperCase(), name: input.name.trim() })
    .select('id')
    .single();
  if (error) throw dataError(error);
  return data.id;
}

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

export async function updateLocation(
  supabase: Client,
  locationId: number,
  // addressId: where its deliveries go, one of the company's sites; null for the registered office.
  changes: { code?: string; name?: string; addressId?: number | null },
): Promise<void> {
  const values: Database['public']['Tables']['locations']['Update'] = {};
  if (changes.code !== undefined) values.code = changes.code.trim().toUpperCase();
  if (changes.name !== undefined) values.name = changes.name.trim();
  if (changes.addressId !== undefined) values.address_id = changes.addressId;
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
