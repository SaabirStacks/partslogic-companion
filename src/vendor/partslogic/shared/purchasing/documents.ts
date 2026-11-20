import { call, readHistoryEvents, type HistoryEvent } from '../core/call';

// What purchasing's documents (orders, returns, credit notes) share: reading an RPC's answer, and their history.
// Both live in the core, so other modules read theirs the same way.

// An entry in a document's history (public.document_events): what happened, its detail, when and who.
export type DocumentEvent = HistoryEvent;

export { call };
export const readDocumentEvents = readHistoryEvents;
