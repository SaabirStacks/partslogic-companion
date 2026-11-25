import type { Json } from '@partslogic/db-types';

import { readNumber, readRecord, readString } from '../core/read';

// A sales order's delivery address, read once for the order page and the Picking page's To pack (S5b). Its own file so
// picking and orders can both read it without importing each other.

export type SalesOrderAddress = { id: number; kind: string; name: string | null; lines: string; town: string | null; county: string | null; postcode: string | null };

export function readSalesOrderAddress(value: Json | undefined): SalesOrderAddress | null {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  if (!row || id == null) return null;
  return {
    id,
    kind: readString(row.kind) ?? 'main',
    name: readString(row.name),
    lines: readString(row.lines) ?? '',
    town: readString(row.town),
    county: readString(row.county),
    postcode: readString(row.postcode),
  };
}

// An address in the lines it is written on, and in one line for a list or a sentence.
export function addressLines(address: SalesOrderAddress | null, typed?: string | null): string[] {
  if (!address) return (typed ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
  return [...address.lines.split('\n').map((line) => line.trim()), [address.town, address.postcode].filter(Boolean).join(' ')].filter(Boolean);
}

// Where a delivery goes, short: the town and the postcode's first half ("Shipley BD18"), or a typed address's last line.
export function deliveryPlace(address: SalesOrderAddress | null, typed?: string | null): string {
  return address ? [address.town, address.postcode?.split(' ')[0]].filter(Boolean).join(' ') : (addressLines(null, typed).at(-1) ?? '');
}
