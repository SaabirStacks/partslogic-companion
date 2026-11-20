import { call } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readNumber, readRecord, readString } from '../core/read';

// Finding a vehicle in the list by hand: any words of its make, model, type, engine code, fuel, first year or engine
// size. Every word typed must match. Used to match a registration to a vehicle before a lookup provider is connected.

export type VehicleMatch = {
  id: number;
  label: string;
  fuel: string | null;
  engineCc: number | null;
  powerPs: number | null;
  engineCode: string | null;
  yearFrom: number | null;
  yearTo: number | null;
};

export function findVehicles(supabase: Client, search: string, limit = 12): Promise<VehicleMatch[]> {
  return call(supabase.rpc('vehicle_find', { p_search: search, p_limit: limit }), (data) =>
    readArray(data).flatMap((item) => {
      const row = readRecord(item);
      const id = readNumber(row?.id);
      if (!row || id == null) return [];
      return [
        {
          id,
          label: readString(row.label) ?? '',
          fuel: readString(row.fuel),
          engineCc: readNumber(row.engine_cc),
          powerPs: readNumber(row.power_ps),
          engineCode: readString(row.engine_code),
          yearFrom: readNumber(row.year_from),
          yearTo: readNumber(row.year_to),
        },
      ];
    }),
  );
}
