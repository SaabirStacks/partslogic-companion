# inventory

The parts you hold: the inventory table, stock levels by bin, movements, adjustments and transfers, min/max per
location, stock cost lots, adding a part to your range and a supplier's code for a part.

## Files here
- `stock-list.ts`: the fast Stock list (docs/TABLES_AND_PERFORMANCE.md): `listStock`, `getStockListOptions`, the filter
  model (`StockListFilters`, `tidyStockFilters`, `stockListParams`), filters in a page address
  (`stockFiltersToParams`, `stockFiltersFromParams`) and the active-filter badges (`stockFilterBadges`).
- Set aside (sales orders, docs/SALES.md 13.8): an inventory row carries `setAside`, units confirmed sales orders hold
  and substitutes held for a customer (`sales.set_aside_lines`, read by `stock_set_aside_of`, `sales.set_aside_at` and
  `part_set_aside` alike); the Available column leads with what can be sold (`availableOf`), the In stock filter and
  reorder (`purchasing.reorder_lines`) work from it, and the part window's Stock tab lists what holds it
  (`getPartSetAside`, in the sales domain).
- Below reorder is one rule (20261124090000): `purchasing.stock_position` (free at a place, on order, on drafts) judged
  by `purchasing.needs_reorder`; `public.part_below_reorder` and `purchasing.parts_below_reorder` give it to
  `inventory_rows`, `stock_list` and `stock_list_options`, so the list, the part window and the Reorder sheet agree.
- On order: each Stock list row and the part window's row carry `onOrder`, `onOrderDue` and `onOrderLate`
  (`purchasing.parts_due`, from `purchasing.back_orders`; `part_detail` reads them through `part_stock_extras`);
  `onOrderFigure` gives the column's figure.
- `stock-glance.ts`: `getStockGlance` (`part_stock_glance`): places, bins with when each was counted, stock in no place,
  what holds it, what is coming and the last delivery, for the Available popover and the part beside the list.
- `saved-views.ts`: `listSavedViews`, `saveView`, `renameView`, `deleteView` (`saved_views` and its four functions;
  each person's own). `stock-views.ts`: the Stock list's views (`STOCK_BUILT_IN_VIEWS`, `builtInViewOf`,
  `withBuiltInView`), saved view settings (`stockViewParams`, `readStockViewSettings`, `sameStockView`,
  `savedViewState`) and the quick chips' words (`chipValue`, `chipNames`, `stockChipValue`, `toggleStockChoice`).
- `items.ts`: `stockBadgeWord` (Out or Reorder, for the Stock list and the part window), `listInventory`, `inventoryFilterOptions`, `updateInventoryItem`, `readInventoryRow`, the page
  sizes and sorts, `PartKind`.
- `stock.ts`: `setStockCount`, `adjustStock`, `transferStock`, `listMovements`.
- `levels.ts`: `listLocationLevels`, `setLocationLevel` (min/max per location).
- `stock-costs.ts`: `getStockCosts`, `saveStockCostLot`, `removeStockCostLot`. Lots are typed in by hand or put there
  by a delivery (purchasing's `refresh_receipt_lots`, step 8); a delivery's lot is corrected in Price checks.
- `add-part.ts`: `findPartsToAdd`, `skuAvailable`, `addInventoryPart`.
- `supplier-codes.ts`: `setSupplierCode`, `removeSupplierCode`.

## Elsewhere
- Inventory table: `app/page.tsx` with `components/shadcn-studio/blocks/inventory-table/inventory-table.tsx` (1,300 lines; read the part you need).
- Add part dialog: `components/shadcn-studio/blocks/add-part/` (`add-part-dialog.tsx`, `find-step.tsx`, `create-step.tsx`, `details-step.tsx`,
  `step-layout.tsx`); `brand-combobox.tsx` is catalogue's.
- Part modal stock: `components/shadcn-studio/blocks/part-detail/tabs/stock-tab.tsx` (1,100 lines), `stock-cost-panel.tsx`, `bin-picker.tsx`,
  `surcharge-panel.tsx`.
- Server actions in `app/inventory/actions.ts`: `loadInventoryPage`, `loadMovements`, `loadLocationLevels`,
  `saveLocationLevel`, `searchPartsToAdd`, `checkSku`, `addToInventory`, `saveSupplierCode`, `deleteSupplierCode`,
  `saveInventoryItem`, `setBinCount`, `adjustBinStock`, `moveStock`, `loadStockCosts`, `saveStockCost`,
  `removeStockCost`.
- API: `app/api/v1/inventory/` (list, filters, item, levels, movements), `app/api/v1/stock/` (adjustments,
  counts, transfers).
- Screen: `components/shadcn-studio/blocks/inventory-table/` (`inventory-table.tsx` the Stock list screen,
  `stock-columns.tsx`, `stock-views-bar.tsx` the views and saved views, `stock-filter-bar.tsx` the search and quick
  chips, `available-popover.tsx` the Available cell and its popover, `part-peek.tsx` the part beside the list,
  `stock-filter-sheet.tsx` the Filters panel (`figure-tone.ts` the state colours of stock figures), `scope-switch.tsx`) on the shared data table
  (`components/shadcn-studio/blocks/data-table/`); server actions `loadStockList`, `loadStockListOptions`
  (`app/inventory/actions.ts`, with `loadStockGlance`, `loadStockViews`, `saveStockView`, `renameStockView`,
  `deleteStockView`); tests `tests/shell/stock-list-screen.test.ts`, `tests/shared/stock-views.test.ts`; SQL test
  `183_stock_list_rework.sql`; design checks `scripts/design-checks/inventory.mjs` (docs/design-checks/inventory.md).
- Helpers: `lib/api/inventory-query.ts`, `lib/api/add-part-input.ts`, `lib/inventory-display.ts` (formatters
  the companion also copies), `lib/sku.ts`.
- Database: `stock_list`, `stock_list_options` (the web's Stock list; `public.inventory_index` is its index table,
  written only by triggers on `inventory_items`, `catalogue.parts` and `catalogue.brands`; SQL tests
  `145_stock_list.sql`; unit tests `tests/shared/stock-list.test.ts`). A search for a number also answers with
  alternatives (slice 7 of `docs/ENRICHMENT_OVERHAUL.md`): `catalogue.search_seeds`, `catalogue.search_alternatives`,
  rows' `match` and the page's `alternatives` (`StockListPage`, `StockMatch`, `stockMatchReason`, `logEmptySearch`;
  SQL test `155_stock_search_alternatives.sql`, unit test `tests/shared/stock-match.test.ts`). `list_inventory`, `inventory_filter_options`
  (the phone and the API still read these two), `set_sell_price`, `set_stock_count`, `adjust_stock`,
  `transfer_stock`, `find_parts_to_add`, `sku_available`, `add_inventory_part` (its core, `add_part_core`, also
  makes a catalogue part with a supplier price and leaves the stock list alone when `stock_list` is false: Sales
  uses that for a supplier's quote), `part_stock_costs`,
  `save_stock_cost_lot`, `remove_stock_cost_lot`, `set_supplier_code`, `remove_supplier_code`; tables and views
  `inventory_items`, `inventory_rows`, `stock_levels`, `stock_movements`, `stock_movement_history`,
  `inventory_location_levels`, `inventory_item_stats` (trigger-written only).
  SQL tests: `supabase/tests/70_add_and_upload.sql`, `95_stock_cost_lots.sql`, `96_stock_cost_pricing.sql`,
  `125_delivery_cost_lots.sql` (a delivery's lots).
- Tests: `tests/shared/stock-cost.test.ts`, `tests/shared/stock-costs.test.ts`, `tests/api/routes.test.ts`,
  `tests/api/add-and-upload.test.ts`.

## Rules
- Stock changes go through `stock_levels` and the functions above; `stock_movements` is append-only.
- `inventory_item_stats` is written only by its triggers. Don't recompute on-hand or totals in TypeScript.

## Depends on
- `core`. `index.ts` also re-exports `listLocations` and `Location` from `locations` for the companion.
