# inventory

The parts you hold: the inventory table, stock levels by bin, movements, adjustments and transfers, min/max per
location, stock cost lots, adding a part to your range and a supplier's code for a part.

## Files here
- `items.ts`: `listInventory`, `inventoryFilterOptions`, `updateInventoryItem`, `readInventoryRow`, the page
  sizes and sorts, `PartKind`.
- `stock.ts`: `setStockCount`, `adjustStock`, `transferStock`, `listMovements`.
- `levels.ts`: `listLocationLevels`, `setLocationLevel` (min/max per location).
- `stock-costs.ts`: `getStockCosts`, `saveStockCostLot`, `removeStockCostLot`.
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
- Helpers: `lib/api/inventory-query.ts`, `lib/api/add-part-input.ts`, `lib/inventory-display.ts` (formatters
  the companion also copies), `lib/sku.ts`.
- Database: `list_inventory`, `inventory_filter_options`, `set_sell_price`, `set_stock_count`, `adjust_stock`,
  `transfer_stock`, `find_parts_to_add`, `sku_available`, `add_inventory_part`, `part_stock_costs`,
  `save_stock_cost_lot`, `remove_stock_cost_lot`, `set_supplier_code`, `remove_supplier_code`; tables and views
  `inventory_items`, `inventory_rows`, `stock_levels`, `stock_movements`, `stock_movement_history`,
  `inventory_location_levels`, `inventory_item_stats` (trigger-written only).
  SQL tests: `supabase/tests/70_add_and_upload.sql`, `95_stock_cost_lots.sql`, `96_stock_cost_pricing.sql`.
- Tests: `tests/shared/stock-cost.test.ts`, `tests/api/routes.test.ts`, `tests/api/add-and-upload.test.ts`.

## Rules
- Stock changes go through `stock_levels` and the functions above; `stock_movements` is append-only.
- `inventory_item_stats` is written only by its triggers. Don't recompute on-hand or totals in TypeScript.

## Depends on
- `core`. `index.ts` also re-exports `listLocations` and `Location` from `locations` for the companion.
