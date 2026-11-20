import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readBoolean, readNumber, readRecord, readString, type JsonRecord } from '../core/read';

// Retail customers: contact cards, never accounts (no balance, credit or terms). Found by phone, registration,
// name, email or postcode. The database tidies and checks every field.

export type RetailVehicle = { id: number; vrm: string; description: string | null };

export type RetailCard = {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  postcode: string | null;
  note: string | null;
  marketingOk: boolean;
  // The day the card was last used: cards older than the keeping time can be cleared.
  lastSeenOn: string;
  vehicles: RetailVehicle[];
};

export type RetailCardList = {
  total: number;
  // Every card, whatever the search.
  all: number;
  keepMonths: number;
  // Cards past the keeping time.
  expired: number;
  cards: RetailCard[];
};

// A card to add (no id) or change (with id: only the fields given change; null or '' clears one). Vehicles, when
// given, replace the card's vehicles.
export type RetailCardInput = {
  id?: number;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  postcode?: string | null;
  note?: string | null;
  marketingOk?: boolean;
  vehicles?: { vrm: string; description?: string | null }[];
};

export function readRetailCard(value: Json | undefined): RetailCard | null {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  if (!row || id == null) return null;
  return {
    id,
    name: readString(row.name),
    phone: readString(row.phone),
    email: readString(row.email),
    postcode: readString(row.postcode),
    note: readString(row.note),
    marketingOk: readBoolean(row.marketing_ok) ?? false,
    lastSeenOn: readString(row.last_seen_on) ?? '',
    vehicles: readArray(row.vehicles).flatMap((item) => {
      const vehicle = readRecord(item);
      const vehicleId = readNumber(vehicle?.id);
      const vrm = readString(vehicle?.vrm);
      if (!vehicle || vehicleId == null || !vrm) return [];
      return [{ id: vehicleId, vrm, description: readString(vehicle.description) }];
    }),
  };
}

export function readRetailCardList(value: Json): RetailCardList {
  const row: JsonRecord = readRecord(value) ?? {};
  return {
    total: readNumber(row.total) ?? 0,
    all: readNumber(row.all) ?? 0,
    keepMonths: readNumber(row.keep_months) ?? 36,
    expired: readNumber(row.expired) ?? 0,
    cards: readArray(row.cards).flatMap((item) => readRetailCard(item) ?? []),
  };
}

// Retail cards, the most recently used first (any member).
export async function listRetailCustomers(
  supabase: Client,
  query: { search?: string | null; limit?: number; offset?: number } = {},
): Promise<RetailCardList> {
  return call(
    supabase.rpc('retail_customer_list', {
      p_search: query.search?.trim() || undefined,
      p_limit: query.limit ?? 50,
      p_offset: query.offset ?? 0,
    }),
    readRetailCardList,
  );
}

// Adds a retail card or changes one (counter staff). Returns the card.
export async function saveRetailCustomer(supabase: Client, card: RetailCardInput): Promise<RetailCard> {
  const p: Record<string, Json> = {};
  if (card.id != null) p.id = card.id;
  for (const key of ['name', 'phone', 'email', 'postcode', 'note'] as const) {
    const value = card[key];
    if (value !== undefined) p[key] = value;
  }
  if (card.marketingOk !== undefined) p.marketing_ok = card.marketingOk;
  if (card.vehicles !== undefined) {
    p.vehicles = card.vehicles.map((vehicle) => ({ vrm: vehicle.vrm, description: vehicle.description ?? null }));
  }
  return call(supabase.rpc('save_retail_customer', { p }), (data) => {
    const saved = readRetailCard(data);
    if (!saved) throw new Error('The card could not be read back after saving.');
    return saved;
  });
}

// Erases a card when the customer asks (editors).
export async function eraseRetailCustomer(supabase: Client, cardId: number): Promise<void> {
  await call(supabase.rpc('erase_retail_customer', { p_id: cardId }), () => undefined);
}

// Erases every card past the keeping time (admins). Returns how many went.
export async function clearOldRetailCustomers(supabase: Client): Promise<number> {
  return call(supabase.rpc('clear_old_retail_customers'), (data) => readNumber(data) ?? 0);
}
