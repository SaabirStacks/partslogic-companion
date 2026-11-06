# imports

Supplier price lists in: upload, column mapping (a supplier's profile), preview, the batch run in chunks, and
the report with quarantined rows. Brand matching during an upload uses `catalogue/brands.ts`.

## Files here
- `mapping.ts`: pure mapping logic (vehicle applications, an example vehicle and the ordering quantities included): `IMPORT_TARGETS`, `suggestMapping`, `specToMapping`, `buildSpec`,
  `validateMapping`, `readImportSpec`, `headersFor`, `DEFAULT_MAPPING_SETTINGS`. No database calls.
- `profiles.ts`: `getImportProfile`, `saveImportProfile`.
- `batches.ts`: `previewImport`, `beginImport`, `appendImportRows`, `finishImport`, `cancelImport`,
  `getImportReport`, `listImportBatches`, `listQuarantinedRows`, `importProgress`.
- `upload-runs.ts`: re-running a past upload under the current mapping: `listUploadRuns`, `startRerun`,
  `confirmRerun`, `cancelRerun`, `undoRerun`, their readers and wording (`describeRerunOutcome`,
  `rerunProgress`).

## Elsewhere
- Pages: `app/uploads/page.tsx`, `app/uploads/new/page.tsx`, `app/uploads/[batchId]/page.tsx`.
- Components: `components/shadcn-studio/blocks/uploads/` (`upload-wizard.tsx` is 1,100 lines; `column-mapper.tsx`, `check-panel.tsx`,
  `row-preview.tsx`, `sheet-preview.tsx`, `upload-list.tsx`, `upload-report.tsx`, `upload-bits.tsx`, `rerun-panel.tsx`).
- Server actions: `app/uploads/actions.ts`.
- API: `app/api/v1/uploads/`.
- File reading in the browser: `lib/imports/` (`read-file.ts`, `csv.ts`, `table.ts`, `parse.worker.ts`).
- Database (schema `ingest`, entry points in `public`): `import_profile`, `save_import_profile`,
  `import_preview`, `import_begin`, `import_append_rows`, `import_finish`, `import_cancel`, `import_report`,
  `import_batches`, `import_quarantined`; tables `ingest.batches`, `raw_rows`, `staged_rows`, `profiles`;
  `ingest.apply_batch_chunk`. Re-runs: `upload_runs`, `rerun_upload`, `rerun_confirm`, `rerun_cancel`,
  `rerun_undo`; tables `ingest.batch_runs`, `run_rows`; `ingest.rerun_next_chunk` (cron). Vehicle applications:
  `ingest.read_applications`, `ingest.application_make`; matched later from `catalogue.vehicle_text_checks`. SQL tests:
  `supabase/tests/70_add_and_upload.sql`, `109_claim_withdrawals.sql`, `113_upload_reruns.sql`, `116_vehicle_applications.sql`,
  `117_sheet_quantities.sql`. Ordering quantities are saved on the price by `ingest.publish_price`.
- Tests: `tests/shared/imports.test.ts`, `tests/shared/upload-runs.test.ts`, `tests/imports/table.test.ts`,
  `tests/uploads/rerun-panel.test.ts`, `tests/api/add-and-upload.test.ts`.
- Docs: `docs/UPLOADS.md`; `docs/PLAN.md` section 6 (ingestion pipeline).

## Rules
- Raw rows are stored exactly as received; mapping and validation happen in SQL in 1,000-row chunks.
- The supplier is always known at upload; brand and EAN may be missing, so never drop brandless rows.
