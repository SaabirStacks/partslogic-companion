# purchasing

Suppliers, the supplier catalogue and purchase orders today; goods in against orders, returns and Xero later. The first domain built on
the module pattern: its own `purchasing` schema behind thin `public` entry points.

## Files here
- `suppliers.ts`: the Suppliers pages: `listSuppliers`, `getSupplier`, `saveSupplier`, `setSupplierStatus`.
- `supplier-options.ts`: `listSupplierOptions` (every supplier picker, and the phone's "Who's it from?"),
  `createSupplier`.
- `catalogue.ts`: the supplier catalogue: `searchSupplierCatalogue` (one search over every supplier's lines and
  your range), `getPriceComparison` (a part beside its equivalents), the readers, `bestOffer`, `savingRatio`.
- `orders.ts`: purchase orders: `listPurchaseOrders`, `purchaseOrderCounts`, `getPurchaseOrder`, `createPurchaseOrder`,
  `addPurchaseOrderLines`, `addToOrders` (the catalogue's Add to order), `savePurchaseOrderLine`,
  `removePurchaseOrderLine`, `savePurchaseOrder`, `savePurchaseOrderVehicle`, `removePurchaseOrderVehicle`,
  `placePurchaseOrder`, `cancelPurchaseOrder`, `deleteDraftPurchaseOrder`, `vehicleOptions`, `readPurchaseOrder`.

## Elsewhere
- Pages: `app/suppliers/page.tsx`, `app/suppliers/new/page.tsx`, `app/suppliers/[id]/page.tsx`,
  `app/catalogue/page.tsx`, `app/purchase-orders/page.tsx`, `app/purchase-orders/[id]/page.tsx` (actions in
  `app/purchase-orders/actions.ts`).
- Components: `components/shadcn-studio/blocks/purchasing/` (`supplier-list.tsx`, `supplier-page.tsx`, `supplier-new.tsx`, `supplier-bits.tsx`;
  the catalogue's `catalogue-page.tsx`, `catalogue-bits.tsx`, `price-comparison.tsx`, `order-basket.tsx`; orders'
  `order-list.tsx`, `order-page.tsx`, `order-bits.tsx`); contacts and addresses come
  from `parties`; the catalogue opens parts in `part-detail/part-detail-dialog.tsx`.
- Server actions: `app/suppliers/actions.ts`; `app/catalogue/actions.ts` (`loadPriceComparison`);
  `loadSupplierOptions`, `addSupplier` in `app/inventory/actions.ts`.
- API: `app/api/v1/suppliers/`.
- Database: entry points `create_supplier`, `supplier_options`, `supplier_list`, `supplier_detail`,
  `save_supplier`, `set_supplier_status`, `supplier_catalogue`, `part_price_comparison`; schema `purchasing`
  (`suppliers`, `supplier_activity`, `supplier_last_upload`, `supplier_name`, `part_offers`,
  `catalogue_facts`). SQL tests: `supabase/tests/104_purchasing_boundary.sql` (the entry point allowlist),
  `105_purchasing_suppliers.sql`, `106_purchasing_supplier_pages.sql`, `114_purchasing_catalogue.sql`,
  `117_sheet_quantities.sql` (each offer's ordering quantities; worded by `orderingTerms` in
  `blocks/purchasing/catalogue-bits.tsx`), `119_purchase_orders.sql`.
- Tests: `tests/shared/purchasing/suppliers.test.ts`, `tests/shared/purchasing/catalogue.test.ts`,
  `tests/shared/purchasing/orders.test.ts`, `tests/purchasing/catalogue-page.test.ts`,
  `tests/purchasing/order-page.test.ts` (fixture `tests/support/purchase-order.ts`).
- Docs: `docs/PURCHASING_PROGRESS.md` (what shipped, the module contract, phone safety: read first);
  `docs/SUPPLIERS_AND_PURCHASING.md` (the full design; read only the section for your step);
  `docs/PURCHASE_ORDERS.md` (the build spec for purchase orders and company details, steps 5 and 6).

## Rules
- Apps call only the `public` entry points; nothing outside purchasing refers to its schema (guard test 104).
  A new entry point goes in that test's allowlist too.
- Hand-offs from inventory go through an inbox, never inside a receipt's transaction.

## Depends on
- `parties` (contacts and addresses); `inventory` (the `PartKind` type). In SQL the catalogue reuses the
  catalogue's `search_parts` and `part_alternatives` and pricing's `effective_sell_price`.
