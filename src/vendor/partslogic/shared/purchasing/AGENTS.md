# purchasing

Suppliers, the supplier catalogue, purchase orders, goods in against orders, price checks, reordering, a part's
cost history, returns to suppliers, supplier credits, exchange cores, supplier bills, payments and statement checks
today; Xero later. The first domain built on
the module pattern: its own `purchasing` schema behind thin `public` entry points.

## Files here
- `suppliers.ts`: the Suppliers pages: `listSuppliers`, `getSupplier`, `saveSupplier`, `setSupplierStatus`.
- Badge states (docs/design-checks/status-colours.md): `SUPPLIER_STATUS_STATES` (`suppliers.ts`),
  `PURCHASE_ORDER_STATUS_STATES` and `ORDER_APPROVAL_BADGE_STATES` (`orders.ts`), `CORE_STATUS_STATES` (`cores.ts`),
  `billBadgeWord` (`bills.ts`: Draft, To review, Unpaid, Paid); returns and credits below.
- `supplier-merge.ts`: merging a duplicate supplier into the one kept (step 2f, admins): `previewSupplierMerge` (what
  would move, and what refuses it), `mergeSuppliers`, `mergeMoveLines` (the confirmation's lines), `readSupplierMerge`
  (also read into `SupplierDetail.mergedInto` and `.merges`). Screen: `blocks/purchasing/merge-supplier-dialog.tsx`,
  opened from the supplier page's menu; actions `loadSupplierMergePreview`, `mergeSupplierInto` in
  `app/suppliers/actions.ts`. Database: `supplier_merge_preview`, `merge_suppliers`, `supplier_merged_since`, schema
  `purchasing` (`supplier_merges`, `merge_blocker`, `merge_counts`, `merge_fills`, `merge_json`, `merge_move_chunk`,
  `merge_next_chunk`, the job `purchasing-supplier-merges`). SQL tests: `supabase/tests/148_merge_suppliers.sql`;
  unit tests: `tests/purchasing/supplier-merge.test.ts`. See `docs/PURCHASING_PROGRESS.md`, "2f. Merge suppliers".
- `supplier-options.ts`: `listSupplierOptions` (every supplier picker, and the phone's "Who's it from?"),
  `createSupplier`.
- `catalogue.ts`: the supplier catalogue: `searchSupplierCatalogue` (one search over every supplier's lines and
  your range), `getPriceComparison` (a part beside its equivalents), the readers, `bestOffer`, `savingRatio`.
- `orders.ts`: purchase orders: `listPurchaseOrders`, `purchaseOrderCounts` (with `customerLines`, the count of the
  Customer lines tab, whose queue lives in `sales/customer-lines.ts`), `getPurchaseOrder`, `createPurchaseOrder`,
  `addPurchaseOrderLines`, `addToOrders` (the catalogue's Add to order), `savePurchaseOrderLine`,
  `removePurchaseOrderLine`, `movePurchaseOrderLine` (a draft line to another supplier's draft, step 3c), `savePurchaseOrder`, `savePurchaseOrderVehicle`, `removePurchaseOrderVehicle`,
  `placePurchaseOrder`, `cancelPurchaseOrder`, `deleteDraftPurchaseOrder`, `vehicleOptions`, `readPurchaseOrder`.
- `order-export.ts` (copy for a portal, the CSV, `recordPurchaseOrderExport`); `placed-via.ts` (`isPlacedVia`).
- `delivery-terms.ts`: a supplier's delivery terms and next delivery, and their wording.
- `goods-in.ts`: the Expected list, receiving and closing short on the web, a receipt's order matches.
- `price-checks.ts`: Price checks (`listPriceChecks`, `getPriceCheck`, `savePriceCheck`, `priceFlagged`).
- `reorder.ts`: the reorder list and the part's Order (`listReorderSuggestions`, `getPartReorder`,
  `setPreferredSupplier`, `addReorderLines`, `groupReorder`); the Reorder window's cards and words
  (`groupReorderByDraft`: one card per supplier and location; `REORDER_REASON_WORDS`, `reorderLevelWords`,
  `reorderPackWords`, `reorderLinesWord`, `reorderOfferNote`; `reorderLevel`, the level bar's segments).
- `cost-history.ts`: the part's cost history (`getCostHistory`: what was paid per delivery, supplier price changes).
- `return-terms.ts`: return reasons (`RETURN_REASONS`: NR, WAR, DI, WS; `RETURN_LINE_REASONS` adds CORE, which only
  the cores page puts on a return) and their terms for the company or a supplier (`getReturnTerms`, `saveReturnTerms`,
  `termsInForce`; CORE's days allowed are a supplier's core window).
- `returns.ts`: returns to a supplier (`listSupplierReturns`, `getSupplierReturn`, `getPartReturnOptions`,
  `returnToSupplier`, `addSupplierReturnLines`, `saveSupplierReturnLine`, `removeSupplierReturnLine`,
  `saveSupplierReturn`, `deleteDraftSupplierReturn`, `moveSupplierReturn` for Ready, back to draft, Sent and undo;
  once sent, each line's balance, `settleSupplierReturnLine` and `undoSupplierReturnOutcome`).
  `SUPPLIER_RETURN_STATUS_STATES`: each return status's badge state.
- `credits.ts`: supplier credit notes (`listSupplierCredits`, `getSupplierCredit`, `createSupplierCredit` (the quick
  credit records at once), `saveSupplierCredit`, `addSupplierCreditLines`, `saveSupplierCreditLine`,
  `removeSupplierCreditLine`, `deleteDraftSupplierCredit`, `moveSupplierCredit` for Record and back to draft).
  `creditBadgeWord`: a credit note's one badge (Draft, To review, Recorded).
- `documents.ts`: what orders, returns and credits share: `call` and `readDocumentEvents`, now kept in the core
  (`core/call.ts`) and re-exported here under the same names.
- `supplier-overview.ts`: the supplier page's figures and the Suppliers list's money columns (`getSupplierOverview`,
  `getSupplierFigures`: 12 months by month, open and late orders, owed to us, price checks, drafts, price movement,
  needs, activity, deliveries, and its cores figures).
- `bills.ts`: supplier bills (step 17a): `listSupplierBills` (with the deliveries not billed yet), `getSupplierBill`,
  `createSupplierBill`, `saveSupplierBill`, `addSupplierBillReceipts`, `removeSupplierBillReceipt`, `addSupplierBillLine`,
  `saveSupplierBillLine`, `removeSupplierBillLine`, `deleteDraftSupplierBill`, `moveSupplierBill` (record, back to draft),
  `decideSupplierBillLine` (accept, query, undo), `saveSupplierBillTerms`; `readBillTerms` (shared with
  `supplier-overview.ts`, which reads each supplier's bills summary).
- `order-trail.ts`: the order as the hub: `readOrderTrail` (an order's stages, deliveries with their price check and
  bill, bills, payments, money and next step, read into `PurchaseOrderDetail.trail`), `createBillFromOrder`.
- `back-orders.ts`: back-orders and supplier performance (step 14): `listBackOrders`, `chaseBackOrderLines`,
  each row's `forCustomers` (S4b part three b, docs/SALES.md 13.16: who waits on the line, what was promised and
  whether the customer was told, and the account's `ifCannotSupply`; read by sales through `back_order_lines` and the
  order's `back_orders` in `purchase_order_detail`, lines for customers first, shown as the For column in
  `blocks/purchasing/back-order-bits.tsx`),
  `cancelBackOrderLine`, `saveSupplierBackOrders`, `getSupplierPerformance`, `supplierScores`, `percentOf`; the
  substitute is `acceptSubstitute` in `goods-in.ts`. Cannot supply (S4b part three, docs/SALES.md 13.14): reasons in
  two groups (`BACK_ORDER_REASONS` adds `maker_discontinued`; `ReasonSelect` in `blocks/purchasing/back-order-bits.tsx`
  is shared by Cancel and Close short), a cancel returns `forCustomers` (which sales orders were waiting and what
  happens next), and `closePurchaseOrderShort` takes a reason code. Purchasing says why it closed units through the
  transaction setting `purchasing.close_reason`, which `sales.supply_line_changed` reads.
- `supplier-lines.ts`: a supplier's Catalogue tab (step 11; the `delisted` view, No longer listed, from step 3c): `getSupplierLines` (their current lines with the price each
  replaced, views, search, sort, paging), `setPreferredSupplierLines`, and the export's `SUPPLIER_LINE_CSV_HEADERS` and
  `supplierLineCsvRows` (up to `SUPPLIER_LINE_EXPORT_MAX` lines).
- Order approvals (`orders.ts`): `requestOrderApproval`, `decideOrderApproval`, `PurchaseOrderDetail.approval`
  (`needed` means placing now would be refused for this person) and `can.requestApproval` / `can.approve`; the list's
  `AWAITING_APPROVAL` view and `PurchaseOrderCounts.awaitingApproval`. Screen: `blocks/purchasing/order-approval.tsx`.
  The limit and every rule are in the database (`purchasing.clear_order_total`); see `docs/PERMISSIONS.md`.
- The order page's lines are `blocks/purchasing/order-lines.tsx` (`LinesCard`: the ruled grid, cell inputs, the
  warning marks and each line's panel, and the add row whose part cell is the search; `lineChecks` words each warning
  and names its fix); `order-page.tsx` holds the frame, the supplier and delivery card, details,
  vehicles and the Mark as placed dialog. `receive-dialog.tsx` is Receive on the web (board 6m): one count per part
  with the customers' orders it fills first (`receiveParts`), `receivedLines`, `receiveCheck`, and the result's
  `receiptOutcome` and `receiptSummary`. A delivery's `putAside` (`ReceiptPutAside`, `receiptPutAsideWords` in
  `orders.ts`) says what it put aside for customers; `OpenOrderLine.forOrder` and `forCustomer` say who a line is for.
  For the phone, `goods-in.ts` adds `customerOrdersFor` and `customerOrdersWords` (who a scanned part is for, no
  quantity) and `customerShares`; `compareDelivery` fills `DeliveryCheckRow.putAside`, a preview of what the database
  will set aside, customers' lines first.
- `price-terms.ts`: what a sheet says about a price beyond the unit cost (steps 13 and 3e): `readPriceBreaks`
  (`[{qty, cost}]`), `readScheduledPrice` (a price waiting for its start date), `listEndingLines` (`ending_lines`, the
  reorder list's while-stocks-last flag). `SupplierOffer` and `SupplierLine` carry `breaks`, `ending` and `scheduled`;
  the screens word them with `priceTerms` in `blocks/purchasing/catalogue-bits.tsx`. An order line takes the break its
  quantity reaches in the database (`purchasing.cost_at`), never in the app.
- `supplier-sheets.ts`: a supplier's Price sheets tab (step 12): `getSupplierPriceSheets` (each sheet's changes and the
  stocked parts that moved more than 10%), `saveSupplierSheetSchedule`, `readSheetFreshness` (shared with
  `supplier-overview.ts`).
- `order-extras.ts`: extra units on an order: `readOrderExtras` (into `PurchaseOrderDetail.extras`),
  `substituteAcceptWords` (the window before a substitute is accepted for a line customers wait on, S4b part three b:
  hold, use at once or send to Substitutes to return, by each account's preference; docs/SALES.md 13.18),
  `orderExtrasToDeal` (the order list's mark); the choice is sent by `dealWithOrderExtras` in `goods-in.ts`.
- `payments.ts`: paying suppliers (step 17b): `listSupplierPayables` (aged, per supplier), `getPayOptions`,
  `recordSupplierPayment` (credit notes used first), `getSupplierPayment`, `listSupplierPayments`, `voidSupplierPayment`.
- `statements.ts`: statement checks (step 17c): `listSupplierStatements`, `getSupplierStatement`,
  `createSupplierStatement`, `saveSupplierStatement`, `tickStatementItems`, `addStatementItem`, `resolveStatementItem`,
  `removeStatementItem`, `deleteSupplierStatement`.
- `cores.ts`: exchange cores (step 16): `listCores` (the cores page: counts, old units by view, the shelf by supplier
  with the collection prompt), `listCoreDeposits` (surcharges paid, owed back by delivery and part), `bookInCores`,
  `checkCore`, `saveCore`, `deleteCore`, `sendCores` (onto each supplier's draft return as CORE lines),
  `writeOffCoreDeposit`, `undoCoreDepositLoss`, `saveCoreRule`; `readCoreFigures` (one supplier's cores, shared with
  `supplier-overview.ts`).

## Elsewhere
- Pages: `app/suppliers/page.tsx`, `app/suppliers/new/page.tsx`, `app/suppliers/[id]/page.tsx`,
  `app/catalogue/page.tsx`, `app/purchase-orders/page.tsx`, `app/purchase-orders/[id]/page.tsx` (actions in
  `app/purchase-orders/actions.ts`), `app/returns/page.tsx`, `app/returns/[id]/page.tsx` and the return note
  `app/returns/[id]/pdf/route.ts` (actions in `app/returns/actions.ts`); `app/supplier-credits/page.tsx` and
  `app/supplier-credits/[id]/page.tsx` (actions in `app/supplier-credits/actions.ts`); `app/cores/page.tsx` (actions in
  `app/cores/actions.ts`, input readers in `lib/api/core-input.ts`); `app/supplier-bills/page.tsx` and
  `app/supplier-bills/[id]/page.tsx` (actions in `app/supplier-bills/actions.ts`, input readers in
  `lib/api/bill-input.ts`); `app/supplier-payments/page.tsx`, `new/page.tsx`, `[id]/page.tsx` and the remittance
  advice `[id]/pdf/route.ts`, and `app/supplier-statements/[id]/page.tsx` (actions in `app/supplier-payments/actions.ts`,
  input readers in `lib/api/payment-input.ts`); Settings › Returns for the company's terms.
- Components: `components/shadcn-studio/blocks/purchasing/` (`supplier-list.tsx` (totals band, money columns, sorting,
  pager), `supplier-page.tsx` (the tabbed record: Overview, Financials, Orders, Deliveries, Returns and credits,
  Catalogue, Price sheets, Details, on the shared frame in `blocks/records/`), `supplier-catalogue-tab.tsx` (their lines,
  ticks to add to an order or make preferred, export), `supplier-sheets-tab.tsx` (the schedule and each sheet's
  changes), `supplier-details.tsx` (the Details tab's details and status cards), `supplier-new.tsx`, `supplier-bits.tsx`
  (`ChangeFigure`, the status badge); the Catalogue tab's export `app/suppliers/[id]/catalogue-csv/route.ts`
  (actions `loadSupplierLines`, `preferSupplierLines`, `loadSupplierPriceSheets`, `saveSheetSchedule` in
  `app/suppliers/actions.ts`);
  the catalogue's `catalogue-page.tsx` (on the shared data table, with `catalogue-columns.tsx`; data through `loadCatalogue`;
  its **Find on Autodoc** button leads to `/catalogue/autodoc`, which belongs to enrichment: see that card), `catalogue-bits.tsx`, `price-comparison.tsx`, `order-basket.tsx`; orders'
  `order-list.tsx`, `order-page.tsx` (the order on the record frame, its next step), `order-trail.tsx` (the trail,
  money band, needs, Bills and payments panel, each delivery's bill), `order-extras.tsx` (Over-delivered items: Accept,
  Return to supplier, Substitute for), `order-bits.tsx`; back-orders' `back-order-bits.tsx` (rows, Follow up, Cancel,
  reorder elsewhere, the order's Outstanding items), `back-order-list.tsx` (the Back-orders tab),
  `supplier-performance.tsx` (Performance panel, Back-orders setting); `expected-list.tsx`, `receipt-orders.tsx`,
  `delivery-terms-card.tsx`; `price-check-list.tsx`, `price-check-page.tsx`; `reorder-sheet.tsx`; returns'
  `return-list.tsx`, `return-page.tsx`, `return-bits.tsx`, `return-terms-card.tsx`, `return-delivery-dialog.tsx`,
  `return-settle.tsx` (a sent line's credit and its menu), `return-credit-dialog.tsx` (the quick credit); credits'
  `credit-list.tsx`, `credit-page.tsx`, `credit-bits.tsx`; cores' `core-list.tsx` (the page, the shelf, surcharges
  paid), `core-dialogs.tsx` (book in, change), `core-bits.tsx` (labels, the check, the customer picker, the
  collection rule), `core-tabs.ts`; bills' `bill-list.tsx` (the list, Not billed yet, New bill), `bill-page.tsx` (a
  bill on the record frame: their invoice, a panel per delivery, differences, carriage and other charges),
  `bill-bits.tsx` (status pill, terms wording, history, the Payment terms card), `bill-tabs.ts`; payments'
  `payables-page.tsx` (What you owe, Payments, Statements, Check a statement), `payables-tabs.ts`, `pay-page.tsx`,
  `payment-page.tsx`, `payment-bits.tsx`, `statement-page.tsx`; `blur-input.tsx`, shared by both pages); `part-detail/part-picker.tsx` (choose a
  catalogue part, shared with the enrichment sheet); the
  part modal's `part-detail/order-button.tsx`, `part-detail/return-button.tsx` and `part-detail/price-history-panel.tsx` (its Supplier prices and What you paid
  tabs); contacts and addresses come
  from `parties`; the catalogue opens parts in `part-detail/part-detail-dialog.tsx`.
- Server actions: `app/suppliers/actions.ts`; `app/catalogue/actions.ts` (`loadPriceComparison`);
  `app/price-checks/actions.ts`; `loadPartReorder`, `loadPartCostHistory` and the reorder actions in
  `app/purchase-orders/actions.ts`;
  `loadSupplierOptions`, `addSupplier` in `app/inventory/actions.ts`.
- Printed documents: `lib/documents/purchase-order-pdf.tsx`, `supplier-return-pdf.tsx` and `remittance-pdf.tsx`, sharing the page, company
  block and legal footer in `pdf-bits.tsx` and the logo and response in `pdf-files.ts`.
- API: `app/api/v1/suppliers/`.
- Database: entry points `create_supplier`, `supplier_options`, `supplier_list`, `supplier_detail`,
  `save_supplier`, `set_supplier_status` (putting a supplier on hold, or taking it off, fires sales'
  `suppliers_hold_follow`: confirmed sales lines only it lists wait on it, docs/SALES.md 13.19), `supplier_catalogue`,
  `part_price_comparison`; schema `purchasing`
  (`suppliers`, `supplier_activity`, `supplier_last_upload`, `supplier_name`, `part_offers`,
  `catalogue_facts`). SQL tests: `supabase/tests/104_purchasing_boundary.sql` (the entry point allowlist),
  `105_purchasing_suppliers.sql`, `106_purchasing_supplier_pages.sql`, `114_purchasing_catalogue.sql`,
  `117_sheet_quantities.sql` (each offer's ordering quantities; worded by `orderingTerms` in
  `blocks/purchasing/catalogue-bits.tsx`), `119_purchase_orders.sql`, `120_delivery_terms.sql`,
  `121_receiving_against_orders.sql`, `122_price_checks.sql`, `123_over_deliveries.sql`,
  `124_reorder_into_orders.sql`, `125_delivery_cost_lots.sql` (a delivery's cost lots: `purchasing.delivered_cost`,
  `refresh_receipt_lots`), `126_price_history.sql` (`part_cost_history`), `127_supplier_returns.sql` (return terms, returns: Ready, back to draft,
  sent), `128_supplier_credits.sql` (credit notes, settling lines, settled returns), `131_supplier_overview.sql`
  (`supplier_overview`, `supplier_figures`; internals `receipt_value`, `supplier_receipts`, `supplier_open_orders`,
  `supplier_owed`), `132_exchange_cores.sql` (surcharges owed back, old units, CORE lines on returns, the supplier
  page's cores needs; internals `receipt_surcharges`, `core_deposits`, `core_window`, `core_rule`, `supplier_cores`,
  `core_supplier`, view `core_states`), `133_supplier_bills.sql` (terms and due dates, bills from deliveries, the 5p
  tolerance, recording, accept and query, credits against a query, back to draft; view `bill_line_balances`),
  `134_supplier_payments.sql` (`bill_balances`, `credit_balances`, `supplier_payables`), `135_supplier_statements.sql`
  (`supplier_ledger`, `statement_figures`), `136_order_hub.sql` (`order_deliveries`, `order_trail`,
  `create_bill_from_order`; extras: `order_extras`, `receipt_extras_open`, `supplier_extra_orders`, table
  `extra_returns`, `deal_with_extras`, `order_extras_to_deal`), `137_back_orders.sql` (`back_orders`, `line_chases`,
  `line_cancellations`, `supplier_performance`), `139_supplier_lines_and_sheets.sql` (`supplier_lines`,
  `set_preferred_supplier_lines`, `supplier_price_sheets`, `save_supplier_sheet_schedule`, internal
  `sheet_freshness`, the need `price_sheet_overdue`). The full entry point list is in 104.
- Tests: `tests/shared/purchasing/suppliers.test.ts`, `tests/shared/purchasing/catalogue.test.ts`,
  `tests/shared/purchasing/orders.test.ts`, `delivery-terms.test.ts`, `goods-in.test.ts`, `reorder.test.ts`, `reorder-window.test.ts`,
  `cost-history.test.ts`, `returns.test.ts`, `return-terms.test.ts`, `credits.test.ts`, `supplier-overview.test.ts`,
  `cores.test.ts`, `tests/purchasing/cores.test.ts` (input readers), `bills.test.ts` and `payments.test.ts` (fixtures
  `tests/support/supplier-*.json`), `tests/purchasing/bills.test.ts`, `tests/purchasing/payments.test.ts`,
  `tests/purchasing/supplier-lines.test.ts` (the Catalogue and Price sheets tabs),
  `tests/purchasing/catalogue-page.test.ts`, `tests/purchasing/returns.test.ts` (fixtures `tests/support/supplier-return.ts`,
  `tests/support/company.ts`), `tests/purchasing/credits.test.ts` (fixture `tests/support/supplier-credit.ts`),
  `tests/purchasing/order-page.test.ts` (fixture `tests/support/purchase-order.ts`), `tests/purchasing/order-trail.test.ts`
  (fixture `tests/support/purchase-order-trail.json`), `tests/purchasing/order-extras.test.ts` (fixture
  `tests/support/purchase-order-extras.json`), `tests/purchasing/back-orders.test.ts`.
- Docs: `docs/CUSTOMERS.md` section 6 (the record pages suppliers and customers share);
  `docs/PURCHASING_PROGRESS.md` (what shipped, the module contract, phone safety: read first);
  `docs/SUPPLIERS_AND_PURCHASING.md` (the full design; read only the section for your step);
  `docs/PURCHASE_ORDERS.md` (the build spec for purchase orders and company details, steps 5 and 6);
  `docs/RETURNS_AND_CORES.md` (returns and exchange cores, steps 15 and 16); `docs/SUPPLIER_BILLS.md` (bills, payments
  and statements, step 17).

## Rules
- Apps call only the `public` entry points; nothing outside purchasing refers to its schema (guard test 104).
  A new entry point goes in that test's allowlist too.
- Hand-offs from inventory go through an inbox, never inside a receipt's transaction.
- A purchase order line can be for a customer's sales order (ordering in, `sales.order_supply`, docs/SALES.md 13.11).
  Such a line is never merged with another (`add_line` takes `own_line` and skips linked lines), keeps the sales
  order's reference (`save_purchase_order_line` refuses a new one), moves with its link (`move_purchase_order_line`),
  and tells the sales order when it is removed, its draft deleted, its quantity lowered, units cancelled or closed
  short, or the order cancelled or placed (triggers on the link and on `purchase_order_lines`, and calls in
  `cancel_purchase_order` and `place_purchase_order`). `purchase_order_detail` gives each line `for_order` and
  `released_for`, the order `customer_orders`, and each vehicle its `sales_order`; fit is checked against that
  order's lines only. A draft started by ordering in has origin `sales`. Words: `customerLineCount`,
  `customerLinesWords`.
- A supplier's performance lists the customer lines it let down in 90 days (`supplier_performance.let_down`,
  `readSupplierLetDowns`; words `letDownReasonsWords`, `letDownSubWords`, `letDownOrderWords`, `LET_DOWN_LABEL`):
  counted, those the maker discontinued (listed, not counted), by reason, and the five newest sales orders affected
  with `orderCount` for all of them (`letDownMoreWords`). A supplier on
  hold isn't listed. Read from sales through `sales.supplier_let_downs` (docs/SALES.md 13.22).
- A purchase order that let customers down lists them (`purchase_order_detail.let_downs`, `readPurchaseLetDowns`):
  who acts next and a reorder while it is a draft. Reorder elsewhere adds through Customer lines' own entry point,
  never a new one, so nothing can buy the part twice (docs/SALES.md 13.21).

## Depends on
- `parties` (contacts and addresses); `inventory` (the `PartKind` type). In SQL the catalogue reuses the
  catalogue's `search_parts` and `part_alternatives` and pricing's `effective_sell_price`.
- For other modules: `public.part_suppliers(parts[])` gives the suppliers that list each part now, with cost, the
  preferred flag, the next order-by time and arrival, and today's order time when it has passed. Sales reads it for
  Find parts and offers (migration `20261117100000_sales_offers.sql`; guard test 104). `public.part_best_cost(part)`
  gives the lowest current cost among suppliers that are not archived; Sales prices a part off the stock list from
  it (migration `20261117150000_sales_sourcing.sql`).
