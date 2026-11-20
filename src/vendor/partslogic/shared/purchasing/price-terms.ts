import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readNumber, readRecord, readString } from '../core/read';

// What a supplier's price can carry beyond one cost (sheet options, steps 13 and 3e): quantity breaks, and a price
// that starts on a later day. The database works out what an order pays; these are for showing.

// From `qty` units, each costs `cost`.
export type PriceBreak = { qty: number; cost: number };
// The supplier's price for the part from a later day (YYYY-MM-DD).
export type ScheduledPrice = { cost: number; startsOn: string };

export function readPriceBreaks(value: Json | undefined): PriceBreak[] {
  return readArray(value).flatMap((item) => {
    const entry = readRecord(item);
    const qty = readNumber(entry?.qty);
    const cost = readNumber(entry?.cost);
    return qty == null || cost == null ? [] : [{ qty, cost }];
  });
}

export function readScheduledPrice(value: Json | undefined): ScheduledPrice | null {
  const entry = readRecord(value);
  const cost = readNumber(entry?.cost);
  const startsOn = readString(entry?.starts_on);
  return cost == null || !startsOn ? null : { cost, startsOn };
}

// Which of these parts a supplier marks "while stocks last" now, as "partId:supplierId" keys.
export async function listEndingLines(supabase: Client, partIds: number[]): Promise<Set<string>> {
  if (partIds.length === 0) return new Set();
  return call(supabase.rpc('ending_lines', { p_parts: partIds }), (data) => {
    const keys = readArray(data).flatMap((item) => {
      const line = readRecord(item);
      const partId = readNumber(line?.part_id);
      const supplierId = readNumber(line?.source_id);
      return partId == null || supplierId == null ? [] : [`${partId}:${supplierId}`];
    });
    return new Set(keys);
  });
}
