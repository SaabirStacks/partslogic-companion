# enrichment

Filling a part's gaps (photo, OE numbers, barcode, category, specs, cross-references, vehicles) from approved
sources: Autodoc through Piloterr, and websites through Firecrawl, within credit budgets.

**The catalogue only (owner, 13 November 2026):** what a source finds is recorded in the catalogue (facts, barcodes,
photos, OE numbers, links) and never puts a part on the stock list; `ingest.apply_staged_row` skips the stock-list
item for a catalogue feed (migration `20261113170000_enrichment_catalogue_only`, SQL test
`142_enrichment_catalogue_only.sql`). Price sheets and parts added by hand still put the part in your range.

## Files here
- `sources.ts`: the source list and website profiles: `listEnrichmentSources`, `saveEnrichmentSource`,
  `reorderEnrichmentSources`, `removeEnrichmentSource`, `saveWebProfile`, `listWebProfileVersions`, spec keys,
  page reads, `reapplyWebPage`, and the backfill (`estimateBackfill`, `queueBackfill`, `getBackfillStatus`,
  `cancelBackfill`).
- `preview.ts`: `getEnrichmentPreview` (what a run would do and cost for a part, and the pages waiting for a
  person's answer) and `resolveEnrichmentListing` (that answer).
- `budget.ts`: `getEnrichmentBudget`, `setEnrichmentBudget`, `resetEnrichmentBudgetPeriod`, `listEnrichmentRuns`.

## Elsewhere
- Part modal: `components/shadcn-studio/blocks/part-detail/enrich-panel.tsx`. Settings › Enrichment: `components/shadcn-studio/blocks/organisation-settings/`
  `enrichment-section.tsx`, `enrichment-source-sheet.tsx` (800 lines), `enrichment-vocabulary.tsx`, `budget-card.tsx`.
- Server actions: `app/settings/enrichment-actions.ts`; `saveBudget`, `startBudgetPeriod` in
  `app/settings/actions.ts`; `loadEnrichmentPreview`, `saveEnrichmentBudget` in `app/inventory/actions.ts`.
- A run from the web: `app/api/v1/parts/[partId]/enrichment/route.ts` → `lib/enrichment/` → `packages/enrichment/`
  (`run.ts` orchestrates the steps; `provider.ts` is the `EnrichmentProvider` interface).
- Shared with the Edge Function (no imports, so both runtimes can use them): `supabase/functions/_shared/`
  `autodoc.ts`, `firecrawl.ts`, `web-enrichment.ts`, `enrichment-job.ts`; `lib/piloterr/autodoc.ts` re-exports.
- Queued runs: `supabase/functions/enrichment-runner/` (pg_cron every minute).
- Database: `enrichment_preview`, `enrichment_sources`, `save_enrichment_source`, `reorder_enrichment_sources`,
  `remove_enrichment_source`, `save_web_profile`, `web_profile_versions`, `spec_keys`, `save_spec_key`,
  `unmapped_spec_labels`, `enrichment_source_pages`, `web_page_detail`, `reapply_web_page`,
  `enrichment_backfill_estimate`, `queue_enrichment_backfill`, `enrichment_backfill_status`,
  `cancel_enrichment_backfill`, `enrichment_budget`, `set_api_budget`, `reset_api_budget_period`,
  `enrichment_activity`, `enrichment_resolve_listing`; `ingest.spend_credits`, `ingest.store_api_response`, `ingest.apply_enrichment`.
  Saved answers (slice 1 of `docs/ENRICHMENT_OVERHAUL.md`): `ingest.enrichment_answers`, `enrichment_save_answer`,
  `enrichment_apply_answer`, `enrichment_held`, `enrichment_settle`, `ingest.apply_vehicle_answer`,
  `ingest.reset_stuck_enrichment` (SQL test `149_enrichment_answers.sql`).
  Background runs (slice 2): `ingest.enrichment_runs`, `enrichment_run_start`, `enrichment_run_progress`,
  `enrichment_run_finish` (server only), `enrichment_run_status`, `enrichment_running` (any member),
  `ingest.part_enrichment_state` (the Stock list's `enrichment` key) (SQL test `150_enrichment_background_runs.sql`).
  Wrappers `runs.ts` (`getEnrichmentRun`, `getEnrichmentRunning`); the server's side in `lib/enrichment/background.ts`
  (`startEnrichmentRun`, `runEnrichmentInBackground`); the progress shape in `lib/enrichment/run-state.ts`
  (`reduceRunState`, `readRunState`, `runActivity`, `readRunResult`; tests `tests/enrichment/run-state.test.ts`);
  the header's indicator in `blocks/application-shell-19/enrichment-activity.tsx`.
  Gap-only runs and names (slices 3 and 4): `ingest.source_fills` (what a source can fill; `fills` on each source of
  `enrichment_chain` and `enrichment_preview`), gaps `name` and `description`, `catalogue.display_name` and
  `catalogue.searchable_name` (the name lists show and search), `enrichment_reapply_saved` (saved pages applied
  again, admin) with `ingest.reading_rules` (SQL test `151_enrichment_gaps_and_names.sql`). Wrapper `saved.ts`
  (`reapplySavedPages`); the gap rules for screens in `lib/enrichment/gaps.ts` (`wantedGaps`, `sourceCanFill`,
  from `web-enrichment.ts`); the Settings card `organisation-settings/saved-pages-card.tsx`.
  Find on Autodoc (slice 6): the page `app/catalogue/autodoc/`, actions `app/catalogue/autodoc-actions.ts`, the screen
  `blocks/purchasing/autodoc-search.tsx`, the paid side `lib/enrichment/autodoc-search.ts` (`searchAutodoc`,
  `openAutodocResult`), the wrapper `autodoc-search.ts` (`getSavedAutodocSearch`, `readAutodocSearch`,
  `autodocResultName`), `autodocSearchByKeyword` and `keywordSearchQuery` in `_shared/autodoc.ts`. Database:
  `ingest.autodoc_searches`, `autodoc_search_saved` (any member), `autodoc_search_save` and `autodoc_open_result`
  (server only), `ingest.autodoc_search_cards` (SQL test `153_autodoc_search.sql`; unit test
  `tests/enrichment/autodoc-search.test.ts`). A run kept to one provider: `onlyProvider` on the chain, `provider` on
  the part's enrichment route.
  The brand decision: `enrichment_listing_product` (the product as a listed page has it), the `page_brand` answer of
  `enrichment_resolve_listing` (the part moves to the page's brand), `enrichment_apply_held` (the saved page applied
  after an answer); wrappers `getListingProduct`, `applyHeldPage` in `preview.ts`; `loadListingProduct` in
  `app/inventory/actions.ts`; `ListedProduct` in `enrich-panel.tsx` (SQL test `154_autodoc_brand_review.sql`).
  A page that was for another part (target status `mismatch`) is not read again: `enrichment_begin` forgets it and
  the run searches, and `enrichment_preview` offers no page, so its cost includes the search (owner, 24 November
  2026; migration 20261124150000, SQL test `185_enrichment_wrong_page.sql`). A part skipped because a part on the same
  OE number was filled is named through `ingest.oe_sibling_enriched_part`, which the skip rule reads too.
  SQL tests: `supabase/tests/93_enrichment_sources.sql`, `94_onlinecarparts.sql`, `110_number_matching.sql`,
  `111_ean_matching.sql`, `112_glued_brand_code.sql`.
- Tests: `tests/enrichment/` (chain, job, run, web), `tests/piloterr/autodoc.test.ts`.
- Docs: `docs/web-enrichment.md`, `docs/autodoc-enrichment.md`, `docs/autodoc-product-mapping.md`, `piloterr.md`;
  the overhaul's audit, plan and decisions: `docs/ENRICHMENT_OVERHAUL.md`.

## Rules
- Every paid Piloterr, Firecrawl or Apify call is preceded by `ingest.spend_credits`; store every response with
  `ingest.store_api_response`, then `ingest.apply_enrichment`. Provider JSON is mapped in SQL, never written
  to the catalogue from TypeScript.
- API keys live only in Edge Functions and server code; never log keys or full responses.

## Depends on
- `catalogue` (enrichment status types), `inventory` (`PartKind`).
