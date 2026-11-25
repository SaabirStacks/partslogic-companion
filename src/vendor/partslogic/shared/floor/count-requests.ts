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
  // A Bin empty short pick (S5a-1): the bin is in the note.
  not_in_bin: 'not found in its bin',
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

// A row's first words: why the figure is wrong. A part a picker didn't find in its bin (Bin empty or Wrong part) says
// where ("Not found in B-02"); every other request came from Confirm's set aside without stock (critique round 4: every
// row began "Set aside without stock", a short pick's too). The reason follows only where it adds something.
export function countRequestLine(request: Pick<CountRequest, 'reason' | 'note'>): { lead: string; reason: string | null } {
  if (request.reason === 'not_in_bin') {
    const where = request.note && request.note.trim().toUpperCase() !== 'UNBINNED' ? `Not found in ${request.note}` : 'Not found when picked';
    return { lead: where, reason: null };
  }
  return { lead: 'Set aside without stock', reason: countRequestReason(request) };
}

// Why a part is on the list: "Reason: not counted yet", the note typed for Other, or the bin a picker found empty
// ("Reason: not found in B-02"; stock not yet put away reads "not found when picked").
export function countRequestReason(request: Pick<CountRequest, 'reason' | 'note'>): string {
  if (request.reason === 'not_in_bin' && request.note) {
    return `Reason: ${request.note.trim().toUpperCase() === 'UNBINNED' ? 'not found when picked' : `not found in ${request.note}`}`;
  }
  return `Reason: ${request.reason === 'other' && request.note ? request.note : (COUNT_REQUEST_REASON_LABELS[request.reason] ?? request.reason)}`;
}
