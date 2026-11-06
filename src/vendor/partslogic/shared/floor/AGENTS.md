# floor

The shop floor, for the companion app and the back office: scanning, goods receipts, bin counts, shared stock
takes, opening stock, quick add, the offline scan index, and review and reversal of what was booked.

## Files here
- `scan.ts`: `resolveScan`, `scanIndexPage`, `scanIndexVersion` (the offline index).
- `receipts.ts`: `recordReceiptLines`, `setReceiptDetails`, `closeStockDocument`.
- `counts.ts`: `ensureBin`, `openBinCount`, `recordCounts`, `commitBinCount`, `discardBinCount`, `COUNT_PURPOSES`.
- `count-runs.ts`: shared stock takes: `startCountRun`, `openCountRuns`, `countRunStatus`, `finishCountRun`.
- `opening-stock.ts`: `openingStockStatus`, `markOpeningStockDone`, `reopenOpeningStock`.
- `quick-add.ts`: `quickAddPart`.
- `activity.ts`: `floorActivity`, `getFloorDocument`, `reverseFloorChange`, `markFloorReviewed`.
- `unresolved.ts`: `listUnresolvedCodes`, `linkFloorCode`, `voidFloorCode`, `listPendingPutAway`,
  `listUnlocatedStock`, `unlocatedStockSummary`, `writeOffUnlocated`.
- `bin-session.ts`: the phone's count session and offline queue items (pure, no database calls).

## Elsewhere
- Pages: `app/goods-receipts/page.tsx`, `app/stock-counts/page.tsx`.
- Components: `components/shadcn-studio/blocks/stock-documents/` (`stock-document-list.tsx`, `document-sheet.tsx`, `document-bits.tsx`,
  `put-away-list.tsx`); opening stock in `components/shadcn-studio/blocks/organisation-settings/locations-section.tsx`.
- Server actions: `app/inventory/stock-document-actions.ts` (`loadOlderDocuments`, `loadDocument`,
  `reverseDocument`, `markReviewed`, `linkCode`, `voidCode`); `loadOpeningStock` and
  `reopenLocationOpeningStock` in `app/settings/actions.ts`.
- Database: `resolve_scan`, `scan_index`, `scan_index_version`, `record_receipt_lines`, `set_receipt_details`,
  `close_stock_document`, `ensure_bin`, `open_bin_count`, `record_counts`, `commit_bin_count`,
  `discard_bin_count`, `start_count_run`, `open_count_runs`, `count_run_status`, `finish_count_run`,
  `opening_stock_status`, `mark_opening_stock_done`, `reopen_opening_stock`, `quick_add_part`,
  `floor_activity`, `floor_document`, `reverse_floor_change`, `mark_floor_reviewed`, `floor_unresolved`,
  `link_floor_code`, `void_floor_code`, `pending_put_away`, `unlocated_stock`, `unlocated_stock_summary`,
  `write_off_unlocated`; tables `documents`, `stock_document_lines`, `stocktakes`.
  SQL tests: `supabase/tests/90_putaway.sql`, `91_floor.sql`, `92_floor_fixes.sql`, `97_floor_sessions.sql`,
  `98_shared_count_runs.sql`, `99_opening_stock_done.sql`, `100_discard_bin_count.sql`,
  `101_bin_count_restarts.sql`, `103_document_tables_rename.sql`.
- Tests: `tests/shared/bin-session.test.ts`, `floor-sessions.test.ts`, `shared-count-runs.test.ts`,
  `opening-stock.test.ts`, `bin-count-restarts.test.ts`.
- Docs: `docs/STOCK_DOCUMENTS.md`, `docs/SETTINGS_TIMEOUTS_AND_BIN_TREE.md`.

## Rules
- Every write is idempotent on an id the device makes, so a replayed queue item is success, not an error.
- The phone uses almost everything here: only add; never rename or remove a name, argument or field.

## How the companion app uses these
- Expo with `expo-camera` (CameraView barcode scanning), `expo-sqlite` for the offline queue and
  `expo-secure-store` for the Supabase session.
- Device-generated UUIDs: `client_count_id` / `client_line_id` / document and stock-take ids before
  the item is queued. A duplicate id is success, not an error.
- Queue wrappers live in `packages/shared/src/floor/` (`bin-session.ts` and the floor wrappers). Classify failures with
  `classifyQueueError`: retry or needs attention. Never drop queued work.
- One scan entry point: `resolve_scan(code, locationId)`; with a working location a plain bin code
  only ever means a bin there. The server always re-resolves.
- Offline index: page `scan_index(after, limit)` by `codeKey` until a page is empty; each code carries
  its entries in precedence order (bin, label, GTIN, SKU, part number, supplier code). Look a scan up
  by `upper(code)`, by its GTIN-14 (`gtin14` in packages/shared) and by its normalised part number;
  the first entry that isn't `ambiguous` wins, otherwise leave it to the server. Refetch everything when
  `scan_index_version` changes.
- Receiving: ask who the delivery is from before the first scan (`supplier_options` or
  `brand_options`), then `record_receipt_lines` (batches up to 500; each line comes back booked,
  unresolved, duplicate, skipped, refused or void), `set_receipt_details` after the first lines
  (supplier or manufacturer, and the delivery note), then `close_stock_document`.
- Opening stock is offered only where `opening_stock_status` says it isn't done. On finishing an
  opening-stock run, ask whether the location is fully set up; Yes queues `opening_stock_done`
  (`mark_opening_stock_done`).
- Shared stock takes and opening stock: `open_count_runs` to join one open in the location, else
  `start_count_run` with the planned bins (it hands back the open one if someone started it first);
  `count_run_status` for who has each bin; `finish_count_run` for everyone. Taking a bin needs signal:
  call `open_bin_count` online first, and show its refusal ("Sam is counting that bin").
- Counting: `ensure_bin`, `open_bin_count` with the job (`purpose`: put_away, stock_count, stock_take,
  opening) and, for a stock take or opening stock, the run's `run_id`; `record_counts` with the
  session's running totals from `sessionLines` (a resent total replaces the earlier one; 0 voids it),
  then `commit_bin_count` (`confirmEmpty` when nothing was scanned). Discard queues
  `discard_bin_count` last in the count's stream, so PartsLogic cancels it too.
- New parts: `quick_add_part`. A barcode another part already holds comes back as
  `{ status: 'conflict' }` with the holder, and nothing is created; show it, don't retry it.
- Screens and navigation follow the user's role from `public.members` (getCurrentMember in packages/shared).
- Never bundle service keys or third-party keys.
