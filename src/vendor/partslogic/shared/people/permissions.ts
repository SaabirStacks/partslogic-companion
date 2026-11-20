import type { Json } from '@partslogic/db-types';

import { readNumber, readRecord, readStrings } from '../core/read';

// What an owner can switch per person (public.permissions). A new one is a row there and its key here.
export const PERMISSION_KEYS = [
  'orders.build',
  'orders.place',
  'orders.approve',
  'orders.cancel',
  'suppliers.manage',
  'price_sheets.upload',
  'deliveries.price_checks',
  'bills.record',
  'payments.record',
  'returns.settle',
  'statements.check',
  'quotes.see_margin',
  'quotes.override_price',
] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export function isPermissionKey(value: unknown): value is PermissionKey {
  return typeof value === 'string' && (PERMISSION_KEYS as readonly string[]).includes(value);
}

export const PERMISSION_AREAS = ['purchasing', 'money', 'sales'] as const;
export type PermissionArea = (typeof PERMISSION_AREAS)[number];
export const PERMISSION_AREA_LABELS: Record<PermissionArea, string> = { purchasing: 'Purchasing', money: 'Money', sales: 'Sales' };

// What the signed-in person may do, read once with their role (public.my_access).
export type MyAccess = {
  permissions: PermissionKey[];
  // The most they may place an order for before VAT; null is no limit.
  orderLimit: number | null;
};

export const NO_ACCESS: MyAccess = { permissions: [], orderLimit: null };

export function readMyAccess(data: Json | undefined): MyAccess {
  const row = readRecord(data);
  return {
    permissions: readStrings(row?.permissions).filter(isPermissionKey),
    orderLimit: readNumber(row?.order_limit),
  };
}

// True when the person has the permission. Screens ask this instead of the role for anything a permission covers.
export function can(member: { permissions: readonly PermissionKey[] } | null | undefined, key: PermissionKey): boolean {
  return member?.permissions.includes(key) ?? false;
}
