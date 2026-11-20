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
- `categories.ts`: the house category tree: `getCategoryTree`, `getUnmappedWordings`, `mapCategoryWording`,
  `createCategory`, `renameCategory`, `removeCategory`, `setPartCategory`, and the pure helpers `categoryTrails`
  and `assignableCategories`.

## Elsewhere
- Part modal: `components/shadcn-studio/blocks/part-detail/` (`part-detail-dialog.tsx`, `part-header.tsx`, `part-store.tsx`, `bits.tsx`,
  `claim-badge.tsx`, `gap-strip.tsx`, and `tabs/` overview, references, specs, vehicles, alternatives, kit).
  The stock, pricing and enrich parts of the modal belong to inventory, pricing and enrichment.
- Brand picker: `components/shadcn-studio/blocks/add-part/brand-combobox.tsx`. Matching settings: `components/shadcn-studio/blocks/organisation-settings/matching-section.tsx`.
- Server actions in `app/inventory/actions.ts`: `loadPartDetail`, `loadPartAlternatives`, `loadPartFitments`,
  `loadPartVehicleTexts`, `loadPartReferences`, `loadPartSpecs`, `loadPartKit`, `loadClaimSources`, `findParts`,
  `loadBrandOptions`, `addKitPart`, `removeKitPart`, `reviewPartLink`. Brand actions for uploads are in
  `app/uploads/actions.ts` (`checkBrandNames`, `createBrandNamed`, `aliasBrand`).
- Categories (slice 5 of `docs/ENRICHMENT_OVERHAUL.md`): the page `app/categories/` (`page.tsx`, `actions.ts`), the
  screen `components/shadcn-studio/blocks/categories/` (`categories-screen.tsx`: wordings to map and the tree;
  `category-picker.tsx`, also used by the part modal's Overview). `loadCategoryOptions` and `savePartCategory` are in
  `app/inventory/actions.ts`. Database: tables `catalogue.categories` (three levels at most; triggers
  `categories_keep_tree`, `categories_move_children`), `catalogue.category_aliases` (other names, with `token_key`),
  `catalogue.category_work` (the background's queue); `catalogue.match_category`, `ensure_category_path`,
  `assert_category_trail`, `category_for_part`, `categorise_chunk`, `categorise_next` (cron `categorise-parts`);
  entry points `category_tree`, `unmapped_category_wordings`, `map_category_wording`, `create_category`,
  `rename_category`, `remove_category`, `set_part_category`. A part sits only on a category with nothing beneath it
  (trigger `parts_category_is_product_type`). SQL test `152_category_tree.sql`; unit test
  `tests/categories/categories.test.ts`.
- API: `app/api/v1/parts/` (detail, alternatives, fitments, references, specs, kit), `app/api/v1/brands/`.
- Helpers: `lib/gtin.ts` (re-exports barcodes), `lib/inventory-display.ts` (labels for claim states).
- Database (schema `catalogue`, entry points in `public`): `part_detail`, `part_alternatives_with_stock`,
  `part_fitments_for`, `part_vehicle_texts`, `part_references`, `part_specs`, `claim_sources`, `part_kit`,
  `add_kit_component`, `remove_kit_component`, `review_link`, `search_parts`, `brand_options`, `check_brands`,
  `create_brand`, `alias_brand_name`, `catalogue_settings`. Vehicle matching: `catalogue.match_vehicle_text`,
  `auto_match_vehicle_text`, `match_queued_vehicle_texts` (cron `vehicle-text-matching`, from
  `catalogue.vehicle_text_checks`), the view `catalogue.fitment_resolved`; see PLAN.md section 11.
  Vehicle names and healing (`20261118090000_vehicle_healing.sql`, docs/SALES.md 10.2b): `catalogue.platform_words`
  words a vehicle's platform text for a reader and every name is built with it (the stored text is never changed);
  `catalogue.vehicle_names` (what a lookup provider calls a vehicle) and `catalogue.vehicle_heals` (the log: named,
  filled, differs) are written only by `public.vrm_heal`, which runs from a trigger when a registration lookup is
  matched and `public.vrm_like_for_like` agrees; `vehicle_heal_log` reads the log (editors and up). SQL test
  `164_vehicle_healing.sql`.
  SQL tests: `supabase/tests/40_read_model.sql`, `50_part_modal.sql`, `115_vehicle_matching.sql`, `116_vehicle_applications.sql`.
- Tests: `tests/shared/references.test.ts`, `tests/imports/codes.test.ts` (barcodes and SKUs).
- Docs: `docs/PLAN.md` (catalogue and linking sections), `.cursor/plans/part-detail-modal.plan.md` (history).

## Rules
- Verdicts, confidence and link states come from SQL; the UI shows them and never recomputes them.
- Our own reference identifies a part; EAN is the main search key; Autodoc and Piloterr ids are never ours.

## Depends on
- `inventory` (the part's inventory row and `PartKind`).
