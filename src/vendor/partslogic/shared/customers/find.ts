import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readBoolean, readNumber, readRecord, readString } from '../core/read';

// The customer picker other modules use (sales first): open trade accounts with their contacts, and retail cards,
// matched on a name, a contact, an account number, a phone number or a postcode.

export type CustomerMatchContact = { id: number; name: string | null; phone: string | null; isPrimary: boolean };

export type CustomerMatch =
  | {
      kind: 'account';
      partyId: number;
      accountId: number;
      accountNumber: string;
      name: string;
      // active or on_stop (closed accounts are left out), and why it is on stop.
      status: string;
      statusReason: string | null;
      postcode: string | null;
      contacts: CustomerMatchContact[];
    }
  | { kind: 'card'; id: number; name: string | null; phone: string | null; postcode: string | null };

export function readCustomerMatches(data: Json): CustomerMatch[] {
  return readArray(data).flatMap((item): CustomerMatch[] => {
    const row = readRecord(item);
    if (!row) return [];
    if (row.kind === 'card') {
      const id = readNumber(row.id);
      if (id == null) return [];
      return [{ kind: 'card', id, name: readString(row.name), phone: readString(row.phone), postcode: readString(row.postcode) }];
    }
    const partyId = readNumber(row.party_id);
    const accountId = readNumber(row.account_id);
    if (partyId == null || accountId == null) return [];
    return [
      {
        kind: 'account',
        partyId,
        accountId,
        accountNumber: readString(row.account_number) ?? '',
        name: readString(row.name) ?? '',
        status: readString(row.status) ?? 'active',
        statusReason: readString(row.status_reason),
        postcode: readString(row.postcode),
        contacts: readArray(row.contacts).flatMap((entry) => {
          const contact = readRecord(entry);
          const id = readNumber(contact?.id);
          if (!contact || id == null) return [];
          return [{ id, name: readString(contact.name), phone: readString(contact.phone), isPrimary: readBoolean(contact.is_primary) ?? false }];
        }),
      },
    ];
  });
}

export function findCustomers(supabase: Client, search: string, limit = 8): Promise<CustomerMatch[]> {
  return call(supabase.rpc('customer_find', { p_search: search, p_limit: limit }), readCustomerMatches);
}
