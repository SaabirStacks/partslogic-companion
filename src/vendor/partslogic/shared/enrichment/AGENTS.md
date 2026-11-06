# enrichment

Filling a part's gaps (photo, OE numbers, barcode, category, specs, cross-references, vehicles) from approved
sources: Autodoc through Piloterr, and websites through Firecrawl, within credit budgets.

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
  SQL tests: `supabase/tests/93_enrichment_sources.sql`, `94_onlinecarparts.sql`, `110_number_matching.sql`,
  `111_ean_matching.sql`, `112_glued_brand_code.sql`.
- Tests: `tests/enrichment/` (chain, job, run, web), `tests/piloterr/autodoc.test.ts`.
- Docs: `docs/web-enrichment.md`, `docs/autodoc-enrichment.md`, `docs/autodoc-product-mapping.md`, `piloterr.md`.

## Rules
- Every paid Piloterr, Firecrawl or Apify call is preceded by `ingest.spend_credits`; store every response with
  `ingest.store_api_response`, then `ingest.apply_enrichment`. Provider JSON is mapped in SQL, never written
  to the catalogue from TypeScript.
- API keys live only in Edge Functions and server code; never log keys or full responses.

## Depends on
- `catalogue` (enrichment status types), `inventory` (`PartKind`).
