import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { dataError } from '../core/errors';
import { readArray, readBoolean, readNumber, readRecord, readString } from '../core/read';
import { APP_ROLES, type AppRole } from './members';
import { isPermissionKey, PERMISSION_AREAS, PERMISSION_KEYS, type PermissionArea, type PermissionKey } from './permissions';

// What an owner sets for each person: permissions that differ from the role, and an order limit (Settings, People).

export type Permission = {
  key: PermissionKey;
  area: PermissionArea;
  label: string;
  description: string;
  // The lowest role that has it without an owner switching it on.
  minRole: AppRole;
  // A permission it needs first (placing an order needs building one).
  requires: PermissionKey | null;
};

export type PersonPermission = {
  allowed: boolean;
  // What their role alone gives.
  fromRole: boolean;
  // An owner switched it away from the role.
  changed: boolean;
  // Switched on, but waiting on this other permission.
  heldBy: PermissionKey | null;
};

export const ORDER_LIMIT_KINDS = ['company', 'own', 'none'] as const;
export type OrderLimitKind = (typeof ORDER_LIMIT_KINDS)[number];

export type PersonAccess = {
  userId: string;
  role: AppRole;
  // Owners and developers have every permission and no limit: nothing to set.
  fixed: boolean;
  permissions: Record<PermissionKey, PersonPermission>;
  orderLimit: { kind: OrderLimitKind; amount: number | null; effective: number | null };
};

export type PeopleAccess = {
  currency: string;
  companyOrderLimit: number | null;
  permissions: Permission[];
  people: PersonAccess[];
};

function isRole(value: Json | undefined): value is AppRole {
  return typeof value === 'string' && (APP_ROLES as readonly string[]).includes(value);
}

export function readPeopleAccess(data: Json | undefined): PeopleAccess {
  const row = readRecord(data);
  const permissions = readArray(row?.permissions).flatMap((item): Permission[] => {
    const p = readRecord(item);
    const key = p?.key;
    const area = readString(p?.area);
    const minRole = p?.min_role;
    if (!p || !isPermissionKey(key) || !isRole(minRole) || !(PERMISSION_AREAS as readonly string[]).includes(area ?? '')) return [];
    return [
      {
        key,
        area: area as PermissionArea,
        label: readString(p.label) ?? key,
        description: readString(p.description) ?? '',
        minRole,
        requires: isPermissionKey(p.requires) ? p.requires : null,
      },
    ];
  });
  const people = readArray(row?.people).flatMap((item): PersonAccess[] => {
    const p = readRecord(item);
    const userId = readString(p?.user_id);
    const role = p?.role;
    if (!p || !userId || !isRole(role)) return [];
    const theirs = readRecord(p.permissions);
    const limit = readRecord(p.order_limit);
    const kind = readString(limit?.kind);
    return [
      {
        userId,
        role,
        fixed: readBoolean(p.fixed) ?? false,
        permissions: Object.fromEntries(
          PERMISSION_KEYS.map((key) => {
            const one = readRecord(theirs?.[key]);
            return [
              key,
              {
                allowed: readBoolean(one?.allowed) ?? false,
                fromRole: readBoolean(one?.from_role) ?? false,
                changed: readBoolean(one?.changed) ?? false,
                heldBy: isPermissionKey(one?.held_by) ? one.held_by : null,
              },
            ];
          }),
        ) as Record<PermissionKey, PersonPermission>,
        orderLimit: {
          kind: (ORDER_LIMIT_KINDS as readonly string[]).includes(kind ?? '') ? (kind as OrderLimitKind) : 'company',
          amount: readNumber(limit?.amount),
          effective: readNumber(limit?.effective),
        },
      },
    ];
  });
  return {
    currency: readString(row?.currency) ?? 'GBP',
    companyOrderLimit: readNumber(row?.company_order_limit),
    permissions,
    people,
  };
}

// Owners: every permission, the company's order limit and where each person stands.
export async function getPeopleAccess(supabase: Client): Promise<PeopleAccess> {
  const { data, error } = await supabase.rpc('people_access');
  if (error) throw dataError(error);
  return readPeopleAccess(data);
}

// Owners: switches a permission for a person. Null puts it back to what the role gives.
export async function setPersonPermission(
  supabase: Client,
  userId: string,
  key: PermissionKey,
  allowed: boolean | null,
): Promise<PeopleAccess> {
  // The generated types say boolean; null is how it goes back to the role.
  const { data, error } = await supabase.rpc('set_person_permission', { p_user: userId, p_key: key, p_allowed: allowed as boolean });
  if (error) throw dataError(error);
  return readPeopleAccess(data);
}

// Owners: a person's order limit: the company's, their own amount, or none.
export async function setPersonOrderLimit(
  supabase: Client,
  userId: string,
  kind: OrderLimitKind,
  amount?: number,
): Promise<PeopleAccess> {
  const { data, error } = await supabase.rpc('set_person_order_limit', {
    p_user: userId,
    p_kind: kind,
    p_amount: kind === 'own' ? amount : undefined,
  });
  if (error) throw dataError(error);
  return readPeopleAccess(data);
}

// Owners: the company's order limit before VAT. Null is no limit.
export async function saveOrderLimit(supabase: Client, amount: number | null): Promise<PeopleAccess> {
  const { data, error } = await supabase.rpc('save_order_limit', { p_amount: amount as number });
  if (error) throw dataError(error);
  return readPeopleAccess(data);
}

// How a person's permissions differ from their role, for the people list: "2 changed".
export function changedPermissions(person: PersonAccess): number {
  return PERMISSION_KEYS.filter((key) => person.permissions[key].changed).length;
}
