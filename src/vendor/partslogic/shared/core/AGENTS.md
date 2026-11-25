# core

What every domain uses. No database functions of its own.

## Files here
- `call.ts`: `call` (await an RPC, read its data or throw a DataError) and `readHistoryEvents` (a history of
  events with who and when), shared by purchasing's documents and customers' accounts.
- `client.ts`: `Client`, the Supabase client typed from the generated database types. Every wrapper takes one.
- `errors.ts`: `DataError` (keeps the Postgres or PostgREST code and hint), `dataError()`, and
  `classifyQueueError` (retry or needs attention, for the phone's offline queue).
- `read.ts`: readers that narrow untyped JSON from the database (`readRecord`, `readString`, `readNumber`...)
  and `requireRecord` (throws a `DataError` when a function returns no object).
- `page.ts`: `Page<T>` and `PageInfo` for paged lists.
- `status.ts`: the six badge states (`STATUS_STATES`: not started, ended, our move, waiting, ready, stops work),
  `BadgeTone` (a state or `plain` for a data pill) and `STATUS_FAMILY` (the colour each state draws in). Each
  domain maps its own statuses to a state (`*_STATUS_STATES`); the web draws them with `StatusBadge`
  (`components/shadcn-studio/blocks/records/status-badge.tsx`). See `docs/design-checks/status-colours.md`.

## Elsewhere
- Web: `lib/supabase/` (server, browser and admin clients), `lib/action-result.ts` (server action results),
  `lib/api/http.ts` and `lib/api/params.ts` (API route helpers and body and query readers), `lib/utils.ts`.
- Tests: `tests/api/http.test.ts`, `tests/api/params.test.ts`, `tests/shared/core/status.test.ts` (every domain's
  state map); `tests/support/fake-supabase.ts` is the test
  double every wrapper test uses.

## Rules
- A wrapper takes `supabase: Client` first and throws `dataError(error)` when the call fails.
- Read database JSON only through `read.ts`: anything malformed becomes null or an empty list, never a crash.
- Generic helpers only. Anything that knows a domain's shapes belongs in that domain.
