// A database call that failed, keeping the Postgres or PostgREST error code so callers can tell
// "you may not do that" (42501) from "that would break a rule" (P0001, 23505, ...). The hint carries a
// machine-readable follow-up when a function sets one (for example "confirm_new_brand").
export class DataError extends Error {
  readonly code: string | null;
  readonly hint: string | null;

  constructor(message: string, code?: string | null, hint?: string | null) {
    super(message);
    this.name = 'DataError';
    this.code = code ?? null;
    this.hint = hint ?? null;
  }
}

export function dataError(error: { message: string; code?: string | null; hint?: string | null }): DataError {
  return new DataError(error.message, error.code, error.hint);
}

export type QueueErrorKind = 'retry' | 'needs_attention';

// Passing trouble: timeouts, serialisation and deadlocks, locks, lost or refused connections, an expired
// session token, PostgREST unable to reach the database.
const RETRY_CODES = new Set([
  '57014',
  '40001',
  '40P01',
  '55P03',
  '53300',
  '53400',
  '57P01',
  '57P03',
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  'PGRST000',
  'PGRST001',
  'PGRST002',
  'PGRST301',
]);

// Something a person has to look at: no permission (a role revoked while offline), a broken rule, a missing
// row, a state that no longer allows it.
const ATTENTION_CODES = new Set(['42501', '23505', '22023', '22003', 'P0001', 'P0002', '23514', '23503', '55000']);

// Offline queue: retry later, or surface to the counter. Never drop the item.
export function classifyQueueError(error: { code?: string | null; message?: string }): QueueErrorKind {
  const code = error.code ?? '';
  if (RETRY_CODES.has(code)) return 'retry';
  if (ATTENTION_CODES.has(code)) return 'needs_attention';
  if (/network|fetch|load failed|timeout|timed out|temporar|econnreset|unavailable/i.test(error.message ?? '')) return 'retry';
  return 'needs_attention';
}
