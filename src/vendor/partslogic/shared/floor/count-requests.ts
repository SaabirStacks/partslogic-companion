import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readBoolean, readNumber, readRecord, readString } from '../core/read';

// Parts to count because a stock figure was found to be wrong: today, a sales order line confirmed as in stock
// here when the system showed none (docs/SALES.md 13.8). A request leaves the list when the part is next counted
// at that branch; an editor can take one off that needs no count.

export const COUNT_REQUEST_REASON_LABELS: Record<string, string> = {
  not_counted: 'not counted yet',
  other_bin: 'found in another bin',
  not_booked_in: 'delivered and not booked in',
  other: 'other',
};

export type CountRequest = {
  id: number;
  partId: number;
  brand: string;
  number: string;
  description: string | null;
  location: string;
  // Units the stock figure did not cover.
  quantity: number;
  reason: string;
  note: string | null;
  // The document that raised it: a sales order.
  document: { id: string; number: string; docType: string } | null;
  raisedAt: string;
  raisedBy: string | null;
};

export type CountRequestList = { rows: CountRequest[]; canRemove: boolean };

export function readCountRequests(data: Json): CountRequestList {
  const body = readRecord(data) ?? {};
  return {
    rows: readArray(body.rows).flatMap((item) => {
      const row = readRecord(item);
      const id = readNumber(row?.id);
      const partId = readNumber(row?.part_id);
      if (!row || id == null || partId == null) return [];
      const document = readRecord(row.document);
      const documentId = readString(document?.id);
      return [
        {
          id,
          partId,
          brand: readString(row.brand) ?? '',
          number: readString(row.number) ?? '',
          description: readString(row.description),
          location: readString(row.location) ?? '',
          quantity: readNumber(row.quantity) ?? 0,
          reason: readString(row.reason) ?? 'other',
          note: readString(row.note),
          document: document && documentId ? { id: documentId, number: readString(document.number) ?? '', docType: readString(document.doc_type) ?? '' } : null,
          raisedAt: readString(row.raised_at) ?? '',
          raisedBy: readString(row.raised_by),
        },
      ];
    }),
    canRemove: readBoolean(body.can_remove) ?? false,
  };
}

export function listCountRequests(supabase: Client): Promise<CountRequestList> {
  return call(supabase.rpc('count_request_list'), readCountRequests);
}

export function removeCountRequest(supabase: Client, id: number): Promise<void> {
  return call(supabase.rpc('count_request_remove', { p_id: id }), () => undefined);
}

// Why a part is on the list: "Reason: not counted yet", or the note typed for Other.
export function countRequestReason(request: Pick<CountRequest, 'reason' | 'note'>): string {
  return `Reason: ${request.reason === 'other' && request.note ? request.note : (COUNT_REQUEST_REASON_LABELS[request.reason] ?? request.reason)}`;
}
