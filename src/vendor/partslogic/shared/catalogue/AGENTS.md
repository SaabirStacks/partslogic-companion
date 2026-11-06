# catalogue

The parts database: parts and their facts, OE numbers and cross-references (links with evidence and
confidence), fitments and vehicle texts, kits, barcodes, brands, search and the matching settings. Most of it
is the part modal.

## Files here
- `part-detail.ts`: `getPartDetail` (one part with its inventory row, prices, OE numbers, images, barcodes,
  enrichment state, tab counts and gaps) and its types; `ClaimState`.
- `part-tabs.ts`: the modal's tabs: `getPartAlternatives`, `getPartFitments`, `getPartVehicleTexts`,
  `getPartSpecs`, `getClaimSources` (where a fact or link came from).
- `references.ts`: `getPartReferences` (OE and cross-references), `reviewLink` (a curator verifies or rejects).
- `kits.ts`: `getPartKit`, `addKitComponent`, `removeKitComponent`.
- `search.ts`: `searchParts` (the whole catalogue by barcode, number or description).
- `barcodes.ts`: `gtin14`, `barcodeProblem`, `looksLikeBarcode`, `isRestrictedGtin`, `displayGtin`.
- `brands.ts`: `brandOptions`, `checkBrands`, `createBrand`, `aliasBrandName`.
- `engine-settings.ts`: `listEngineSettings` (matching thresholds).

## Elsewhere
- Part modal: `components/shadcn-studio/blocks/part-detail/` (`part-detail-dialog.tsx`, `part-header.tsx`, `part-store.tsx`, `bits.tsx`,
  `claim-badge.tsx`, `gap-strip.tsx`, and `tabs/` overview, references, specs, vehicles, alternatives, kit).
  The stock, pricing and enrich parts of the modal belong to inventory, pricing and enrichment.
- Brand picker: `components/shadcn-studio/blocks/add-part/brand-combobox.tsx`. Matching settings: `components/shadcn-studio/blocks/organisation-settings/matching-section.tsx`.
- Server actions in `app/inventory/actions.ts`: `loadPartDetail`, `loadPartAlternatives`, `loadPartFitments`,
  `loadPartVehicleTexts`, `loadPartReferences`, `loadPartSpecs`, `loadPartKit`, `loadClaimSources`, `findParts`,
  `loadBrandOptions`, `addKitPart`, `removeKitPart`, `reviewPartLink`. Brand actions for uploads are in
  `app/uploads/actions.ts` (`checkBrandNames`, `createBrandNamed`, `aliasBrand`).
- API: `app/api/v1/parts/` (detail, alternatives, fitments, references, specs, kit), `app/api/v1/brands/`.
- Helpers: `lib/gtin.ts` (re-exports barcodes), `lib/inventory-display.ts` (labels for claim states).
- Database (schema `catalogue`, entry points in `public`): `part_detail`, `part_alternatives_with_stock`,
  `part_fitments_for`, `part_vehicle_texts`, `part_references`, `part_specs`, `claim_sources`, `part_kit`,
  `add_kit_component`, `remove_kit_component`, `review_link`, `search_parts`, `brand_options`, `check_brands`,
  `create_brand`, `alias_brand_name`, `catalogue_settings`. Vehicle matching: `catalogue.match_vehicle_text`,
  `auto_match_vehicle_text`, `match_queued_vehicle_texts` (cron `vehicle-text-matching`, from
  `catalogue.vehicle_text_checks`), the view `catalogue.fitment_resolved`; see PLAN.md section 11.
  SQL tests: `supabase/tests/40_read_model.sql`, `50_part_modal.sql`, `115_vehicle_matching.sql`, `116_vehicle_applications.sql`.
- Tests: `tests/shared/references.test.ts`, `tests/imports/codes.test.ts` (barcodes and SKUs).
- Docs: `docs/PLAN.md` (catalogue and linking sections), `.cursor/plans/part-detail-modal.plan.md` (history).

## Rules
- Verdicts, confidence and link states come from SQL; the UI shows them and never recomputes them.
- Our own reference identifies a part; EAN is the main search key; Autodoc and Piloterr ids are never ours.

## Depends on
- `inventory` (the part's inventory row and `PartKind`).
