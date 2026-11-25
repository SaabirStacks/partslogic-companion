import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readNumber, readRecord } from '../core/read';

// The numbers beside the side menu's items: the work waiting on someone here, each the same count as the tab its
// item opens (docs/design-checks/shell.md, the count deck). public.menu_counts() works them out for the signed-in
// person and leaves out any page their role or permissions don't open.

export const MENU_COUNT_KEYS = [
  'enquiries',
  'sales_orders',
  'picking',
  'purchase_orders',
  'goods_receipts',
  'stock_counts',
  'price_checks',
  'supplier_returns',
  'cores',
  'supplier_bills',
  'supplier_payments',
  'feedback',
] as const;
export type MenuCountKey = (typeof MENU_COUNT_KEYS)[number];

// Only the counts the person may see; a missing key shows nothing, like a zero.
export type MenuCounts = Partial<Record<MenuCountKey, number>>;

export function readMenuCounts(data: Json | undefined): MenuCounts {
  const row = readRecord(data);
  const counts: MenuCounts = {};
  for (const key of MENU_COUNT_KEYS) {
    const value = readNumber(row?.[key]);
    if (value != null && value > 0) counts[key] = Math.floor(value);
  }
  return counts;
}

export async function getMenuCounts(supabase: Client): Promise<MenuCounts> {
  return call(supabase.rpc('menu_counts'), readMenuCounts);
}
