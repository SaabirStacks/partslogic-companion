import type { Json } from '@partslogic/db-types';

import { dataError } from './errors';
import { readArray, readRecord, readString, type JsonRecord } from './read';

// Awaits an RPC and reads its data, turning a database error into a DataError.
export async function call<T>(
  work: PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>,
  read: (data: Json) => T,
): Promise<T> {
  const { data, error } = await work;
  if (error) throw dataError(error);
  return read(data as Json);
}

// An entry in a history the database keeps (a document's events, a trade account's): what happened, its detail,
// when and who.
export type HistoryEvent = { event: string; detail: JsonRecord; at: string; by: string };

export function readHistoryEvents(value: Json | undefined): HistoryEvent[] {
  return readArray(value).flatMap((item) => {
    const event = readRecord(item);
    const name = readString(event?.event);
    if (!event || !name) return [];
    return [
      {
        event: name,
        detail: readRecord(event.detail) ?? {},
        at: readString(event.at) ?? '',
        by: readString(event.by) ?? 'Someone',
      },
    ];
  });
}
