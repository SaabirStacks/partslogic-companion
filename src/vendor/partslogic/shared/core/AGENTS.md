# core

What every domain uses. No database functions of its own.

## Files here
- `client.ts`: `Client`, the Supabase client typed from the generated database types. Every wrapper takes one.
- `errors.ts`: `DataError` (keeps the Postgres or PostgREST code and hint), `dataError()`, and
  `classifyQueueError` (retry or needs attention, for the phone's offline queue).
- `read.ts`: readers that narrow untyped JSON from the database (`readRecord`, `readString`, `readNumber`...)
  and `requireRecord` (throws a `DataError` when a function returns no object).
- `page.ts`: `Page<T>` and `PageInfo` for paged lists.

## Elsewhere
- Web: `lib/supabase/` (server, browser and admin clients), `lib/action-result.ts` (server action results),
  `lib/api/http.ts` and `lib/api/params.ts` (API route helpers and body and query readers), `lib/utils.ts`.
- Tests: `tests/api/http.test.ts`, `tests/api/params.test.ts`; `tests/support/fake-supabase.ts` is the test
  double every wrapper test uses.

## Rules
- A wrapper takes `supabase: Client` first and throws `dataError(error)` when the call fails.
- Read database JSON only through `read.ts`: anything malformed becomes null or an empty list, never a crash.
- Generic helpers only. Anything that knows a domain's shapes belongs in that domain.
