import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@partslogic/db-types';

import { dataError } from './errors';
import { readArray, readBoolean, readNumber, readRecord, readString } from './read';

type Client = SupabaseClient<Database>;

// A party's contacts and addresses: shared core, used by suppliers now and customers later. The database
// tidies and checks every field; these only shape what is sent and read back.

export type PartyContact = {
  id: number;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  isPrimary: boolean;
};

// A contact to add (no id) or change (with id: only the fields given change; null or '' clears one).
export type ContactInput = {
  id?: number;
  name?: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  isPrimary?: boolean;
};

export const PARTY_ADDRESS_KINDS = ['main', 'returns', 'remittance'] as const;
export type PartyAddressKind = (typeof PARTY_ADDRESS_KINDS)[number];

export function isPartyAddressKind(value: unknown): value is PartyAddressKind {
  return typeof value === 'string' && (PARTY_ADDRESS_KINDS as readonly string[]).includes(value);
}

// Lines are separated by newlines, up to 4 of them.
export type PartyAddress = {
  kind: PartyAddressKind;
  lines: string;
  town: string | null;
  county: string | null;
  postcode: string | null;
};

const CONTACT_KEYS: Record<Exclude<keyof ContactInput, 'id'>, string> = {
  name: 'name',
  role: 'role',
  email: 'email',
  phone: 'phone',
  mobile: 'mobile',
  isPrimary: 'is_primary',
};

export function readContacts(value: Json | undefined): PartyContact[] {
  return readArray(value).flatMap((item) => {
    const row = readRecord(item);
    const id = readNumber(row?.id);
    const name = readString(row?.name);
    if (!row || id == null || !name) return [];
    return [
      {
        id,
        name,
        role: readString(row.role),
        email: readString(row.email),
        phone: readString(row.phone),
        mobile: readString(row.mobile),
        isPrimary: readBoolean(row.is_primary) ?? false,
      },
    ];
  });
}

export function readAddresses(value: Json | undefined): PartyAddress[] {
  return readArray(value).flatMap((item) => {
    const row = readRecord(item);
    const kind = row?.kind;
    const lines = readString(row?.lines);
    if (!row || !isPartyAddressKind(kind) || !lines) return [];
    return [{ kind, lines, town: readString(row.town), county: readString(row.county), postcode: readString(row.postcode) }];
  });
}

// Adds a contact to a party, or changes one (editors). Returns the party's contacts, the primary first.
export async function savePartyContact(supabase: Client, partyId: number, contact: ContactInput): Promise<PartyContact[]> {
  const p: Record<string, Json> = { party_id: partyId };
  if (contact.id != null) p.id = contact.id;
  for (const key of Object.keys(CONTACT_KEYS) as (keyof typeof CONTACT_KEYS)[]) {
    const value = contact[key];
    if (value !== undefined) p[CONTACT_KEYS[key]] = value;
  }
  const { data, error } = await supabase.rpc('save_party_contact', { p });
  if (error) throw dataError(error);
  return readContacts(data);
}

// Removes a contact (editors). Returns the party's remaining contacts.
export async function removePartyContact(supabase: Client, contactId: number): Promise<PartyContact[]> {
  const { data, error } = await supabase.rpc('remove_party_contact', { p_id: contactId });
  if (error) throw dataError(error);
  return readContacts(data);
}

// Sets a party's main, returns or remittance address, replacing the one there (editors). Returns its addresses.
export async function savePartyAddress(supabase: Client, partyId: number, address: PartyAddress): Promise<PartyAddress[]> {
  const { data, error } = await supabase.rpc('save_party_address', {
    p: {
      party_id: partyId,
      kind: address.kind,
      lines: address.lines,
      town: address.town,
      county: address.county,
      postcode: address.postcode,
    },
  });
  if (error) throw dataError(error);
  return readAddresses(data);
}

// Clears a party's address of one kind (editors). Returns the addresses left.
export async function removePartyAddress(supabase: Client, partyId: number, kind: PartyAddressKind): Promise<PartyAddress[]> {
  const { data, error } = await supabase.rpc('remove_party_address', { p_party: partyId, p_kind: kind });
  if (error) throw dataError(error);
  return readAddresses(data);
}
