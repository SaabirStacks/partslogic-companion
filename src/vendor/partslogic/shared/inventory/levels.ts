import type { Client } from '../core/client';
import { DataError, dataError } from '../core/errors';
import { readNumber } from '../core/read';

export type LocationLevel = {
  locationId: number;
  locationCode: string;
  locationName: string;
  minQty: number;
  maxQty: number | null;
  onHand: number;
  belowMin: boolean;
};

// Minimum and maximum stock per location for one part, with what each location holds now.
export async function listLocationLevels(supabase: Client, partId: number): Promise<LocationLevel[]> {
  const [levels, stock] = await Promise.all([
    supabase
      .from('inventory_location_levels')
      .select('location_id, min_qty, max_qty, locations(code, name)')
      .eq('part_id', partId),
    supabase.from('stock_levels').select('qty, bins(location_id)').eq('part_id', partId),
  ]);
  if (levels.error) throw dataError(levels.error);
  if (stock.error) throw dataError(stock.error);

  const onHand = new Map<number, number>();
  for (const line of stock.data ?? []) {
    const locationId = line.bins?.location_id;
    if (locationId == null) continue;
    onHand.set(locationId, (onHand.get(locationId) ?? 0) + (readNumber(line.qty) ?? 0));
  }

  return (levels.data ?? [])
    .flatMap((row) => {
      if (!row.locations) return [];
      const minQty = readNumber(row.min_qty) ?? 0;
      const held = onHand.get(row.location_id) ?? 0;
      return [
        {
          locationId: row.location_id,
          locationCode: row.locations.code,
          locationName: row.locations.name,
          minQty,
          maxQty: readNumber(row.max_qty),
          onHand: held,
          belowMin: held <= minQty,
        },
      ];
    })
    .sort((a, b) => a.locationCode.localeCompare(b.locationCode));
}

// Sets one location's minimum and maximum for a part; null for both removes the row.
export async function setLocationLevel(
  supabase: Client,
  input: { partId: number; locationId: number; minQty: number | null; maxQty: number | null },
): Promise<void> {
  if (input.minQty == null && input.maxQty == null) {
    const { error } = await supabase
      .from('inventory_location_levels')
      .delete()
      .eq('part_id', input.partId)
      .eq('location_id', input.locationId);
    if (error) throw dataError(error);
    return;
  }
  const { data, error } = await supabase
    .from('inventory_location_levels')
    .upsert(
      { part_id: input.partId, location_id: input.locationId, min_qty: input.minQty ?? 0, max_qty: input.maxQty },
      { onConflict: 'part_id,location_id' },
    )
    .select('part_id');
  if (error) throw dataError(error);
  if (!data?.length) throw new DataError('You need the editor role to change stock levels.', '42501');
}
