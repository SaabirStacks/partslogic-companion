import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { DataError, dataError } from '../core/errors';
import { readArray, readBoolean, readNumber, readRecord, readString } from '../core/read';
import { isPriceTier, type PriceTierName } from './price-tiers';

// Every change to a typed selling price (inventory_prices), newest first, kept by the database whoever made it. Prices
// worked out by margin rules aren't stored: they follow cost, and the cost history shows what moved them.

export type SellPriceChangeKind = 'added' | 'changed' | 'removed';

const KINDS = new Set<string>(['added', 'changed', 'removed']);

export type SellPriceChange = {
  id: number;
  change: SellPriceChangeKind;
  tier: PriceTierName;
  minQty: number;
  oldPrice: number | null;
  newPrice: number | null;
  activeFrom: string | null;
  activeTo: string | null;
  by: string | null;
  at: string;
};

export type SellPriceHistory = {
  partId: number;
  currency: string;
  changes: SellPriceChange[];
  // More changes than were asked for exist.
  more: boolean;
};

export function readSellPriceHistory(data: Json): SellPriceHistory {
  const row = readRecord(data);
  const partId = readNumber(row?.part_id);
  if (!row || partId == null) throw new DataError('That part could not be read.', 'P0002');
  return {
    partId,
    currency: readString(row.currency) ?? 'GBP',
    changes: readArray(row.changes).flatMap((item) => {
      const change = readRecord(item);
      const id = readNumber(change?.id);
      const kind = readString(change?.change);
      const tier = readString(change?.tier);
      const at = readString(change?.at);
      if (!change || id == null || !kind || !KINDS.has(kind) || !tier || !isPriceTier(tier) || !at) return [];
      return [
        {
          id,
          change: kind as SellPriceChangeKind,
          tier,
          minQty: readNumber(change.min_qty) ?? 1,
          oldPrice: readNumber(change.old_price),
          newPrice: readNumber(change.new_price),
          activeFrom: readString(change.active_from),
          activeTo: readString(change.active_to),
          by: readString(change.by),
          at,
        },
      ];
    }),
    more: readBoolean(row.more) ?? false,
  };
}

export async function getSellPriceHistory(supabase: Client, partId: number, limit?: number): Promise<SellPriceHistory> {
  const { data, error } = await supabase.rpc('part_sell_price_history', {
    p_part: partId,
    ...(limit != null ? { p_limit: limit } : {}),
  });
  if (error) throw dataError(error);
  return readSellPriceHistory(data);
}
