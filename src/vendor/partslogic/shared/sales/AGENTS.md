# sales

Selling: enquiries (slice S1), offers with Find parts (S2a) and sending the quote (S2b) now; sales orders, invoices, payments and credit notes as each slice
of `docs/SALES.md` is built. On the module pattern: its own `sales` schema behind thin `public` entry points.

## Files here
- `enquiries.ts`: the enquiry wrappers and readers: `listEnquiries` (views, rows grouped by next move), `getEnquiry`,
  `listEnquiryOwners`, `createEnquiry` (no draft: saved at once), `saveEnquiry`, `assignEnquiries`, `deleteEnquiry`,
  `saveEnquiryVehicle`, `removeEnquiryVehicle`, `saveEnquiryRequest`, `removeEnquiryRequest`, `logEnquiryContact`,
  `setEnquiryStatus`, `closeEnquiryRequest`, `reopenEnquiryRequest`, `closeEnquiry`, `reopenEnquiry`,
  `mergeEnquiries`, `getEnquiryPulse` (counts and who replied, for the list's new-activity banner), `touchEnquiry`
  (who has it open), `listRecentEnquiryCustomers`, `makeRetailCardFromCaller`, `splitEnquiryRequest`; the lists `ENQUIRY_VIEWS`, `ENQUIRY_STATUSES`, `ENQUIRY_CHANNELS`, `NEXT_MOVES`, `REQUEST_OUTCOMES`;
  `enquiryFields` (camelCase to the database's names, leaving out what was not given).
- `channels.ts`: `ENQUIRY_CHANNELS` (how an enquiry arrives, and how a customer says yes), shared by the two files
  below.
- `offers.ts`: offers and Find parts: `findPartsForRequest` (one read: search, fit, stock by branch, suppliers and
  arrival, the customer's price), `addEnquiryOffer`, `saveEnquiryOffer`, `removeEnquiryOffer`, `acceptEnquiryOffer`,
  `unacceptEnquiryOffer`, `refreshEnquiryOffer`; the readers `readEnquiryOffer`, `readEnquiryQuote`,
  `readFoundParts`. An enquiry's requests each carry `state` and `offers`; the enquiry carries `quote`.
  Quotes (S2b): `sendEnquiryQuote` (how: whatsapp, email, print or phone; nothing is sent by PartsLogic),
  `unsendEnquiryQuote` (Undo), `reviewEnquiryPrices` and `requoteEnquiry` (an expired quote: keep the quoted prices,
  which is a price override, or use today's). An offer is `sent` when it went at its price today; a request's state
  is `quoted` when every offer on it is sent; `quote` carries `unsent`, the last quote's `sentAt`, `how`,
  `validUntil`, `expired`, and `validUntilNew` (the date a quote sent now would hold until). The words are in
  `words.ts`: `quoteBody`, `quoteText`, `offerPromiseWords` (the customer's words: never the supplier),
  `requestCaption`, `rowProgress`, `quoteSentWords`, `dateWords`.
- `sourcing.ts`: sourcing a part that is not listed (S2c): `recordSupplierQuote` (the part, the supplier's price
  and the offer in one step), `priceSupplierQuote` (the selling price before saving), `askSupplier` (logs the
  request; the enquiry waits on the supplier), `markRequestToSource` (a search found nothing), and the words
  `supplierAskText`, `supplierQuotePriceWords`. An offer made from a quote carries `supplierQuote`; a request's
  state can be `to_source`; the enquiry carries `canRecordSupplierQuote`.
- `photos.ts`: photos on a request (S2c): `addEnquiryPhoto`, `removeEnquiryPhoto` (returns the file's place so
  the caller removes the file), `photoProblem`, `enquiryPhotoPath`, `photoName`, `photoSourceWords`,
  `ENQUIRY_PHOTO_BUCKET`. A request carries `photos`; an enquiry vehicle carries `imageUrl`, the registration
  lookup's picture of the model while its link works. `sourcing.ts` also has the Autodoc search from Find parts:
  `logAutodocSearch`, `autodocOfferWords`, `AutodocSearchOffer`; the enquiry carries `canSearchAutodoc`.
- `words.ts`: pure wording the web and the phone share: labels for views, statuses, groups, channels and outcomes;
  `enquiryStepLine` (the line under a status), `dayAndTime`, `durationWords`, `agoWords` (UK time, from the
  database's clock), `logEntryCaption`, `lastContactLine`, `enquiryEventText`, `deliveryWords`, `foundAvailability`,
  `offerAvailability`, `offerChangedWords`, `matchWords`, `requestSummary`, `moneyWords`, `marginWords`, `PART_FIT_WORDS`,
  `REQUEST_STATE_LABELS`, `splitWanted` (a request that
  names several things, as pieces to split).
- `orders.ts`: sales orders, part one (docs/SALES.md 13.7): `listSalesOrders` (views `mine`, `drafts`, `all_open`,
  `completed`), `getSalesOrder`, `previewEnquiryOrder`, `createOrderFromEnquiry`, `saveSalesOrder` (customer PO number,
  delivery), `saveSalesOrderLine`, `removeSalesOrderLine`, `cancelSalesOrder` (`returned` to the enquiry or `lost` with
  a reason); the readers, and the wording: `orderRowSub`, `orderCustomerSub`, `orderStateWords`, `orderStepWords`,
  `cancelledWords`, `orderLineWhere` (what the shelf holds now; "If ordered by 16:00, arrives tomorrow" for a part to
  order in), `orderEventText`, `deliverySummary`, `addressLines`, `orderTrailSub`, `orderMarginSub`. An enquiry
  request carries `order` (id, number, status) and the enquiry `canCreateOrder` and `orders`.
- `order-in.ts`: ordering in (S4a, docs/SALES.md 13.11): `previewOrderIn` (the choices for every line still to order,
  or one line), `orderIn` (lines, a retail customer's payment taken, an admin's reason to order in unpaid),
  `undoOrderIn`; Confirm takes the same choices through `orderConfirmFields` (`orderIn`, `payment`). The readers
  `readSupplyLinks` (a line's `supplyLinks`: drafted, awaiting approval, approved, ordered, arrived, done),
  `readLinkedPurchaseOrders` (the order's `purchaseOrders`), `readPaymentTaken`, `readOrderInOptions`; the words
  `supplyWhere`, `supplyNeedWords` (one need per purchase order), `linkedPurchaseOrderWords`, `orderedInWords`,
  `orderInDestinationWords`, `orderInRunWords`, `orderInHelpWords`, `paymentTakenWords`. A line carries `onPo`,
  `arrived` and `stillToOrder`; the order's `figures` carry `stillToOrder`, `drafted`, `ordered`, `arrived`, and the
  order `canOrderIn`, `canOrderInUnpaid`, `canPlaceOrders`, `canApproveOrders`. Fulfilment adds `drafted`, `ordered`
  and `arrived`.
- `put-aside.ts`: goods in for customers (S4b part one, docs/SALES.md 13.12, boards 6m and 6n): `readPutAsideReceipts`
  (the order's `putAsideReceipts`), `readyLabel`, `readyToTell` (a ready collection not told since the last part was
  put aside), `readyMessage` (the text Copy message puts on the clipboard), `readyCopiedWords`, `readyNeedWords`,
  `putAsideEventText` (history lines `put_aside`, `put_aside_undone`, `ready_message_copied`) and
  `markReadyMessageCopied`. `orders.ts` adds fulfilment `ready`, `fulfilmentLabel`, `readyStateWords`, a line's and the
  figures' `onShelf`, the row's `onShelf`, the detail's `putAsideAt` and `readyMessageAt`, and the groups `on_order`
  (a placed purchase order) and `put_aside` (the collection and delivery shelf). Action `readyMessageCopied` in
  `app/sales-orders/actions.ts`. Database: migration `20261120100000_sales_goods_in.sql` (table
  `sales.order_put_aside`; `sales.put_aside_receipt`, `sales.receipt_reversing`, `sales.shift_stock`,
  `sales.order_on_shelf`; entry point `sales_order_ready_copied`); SQL test `171_sales_goods_in.sql`; demo seed
  `11-goods-in.sql`; screens `sales-order-ready` and `purchase-order-receive`.

## Elsewhere
- Pages: `app/enquiries/page.tsx` (the worklist; view, filter, group and page live in the address; `?new=1` opens
  New enquiry; filters are `owner`, `channel` and `group`), `app/enquiries/[id]/page.tsx`
  (`?do=reply|call|follow_up|phone` starts that step), `page-access.tsx`
  (sign-in and membership). Server actions: `app/enquiries/actions.ts` (each returns the enquiry as it now stands).
  Input readers: `lib/api/enquiry-input.ts`.
- Components: `components/shadcn-studio/blocks/sales/`, each built to its canvas boards (design canvas screens 1 to 3
  with their states and components boards): `enquiry-list.tsx` (views, Filters with chips, the View menu, groups,
  the selection bar that replaces the table header, the new-activity banner, the preview sheet, keys N J K Space
  Enter L A F X ?; `groupMeaning`, `activityWords`), `new-enquiry.tsx` (the window that saves from the first thing
  typed), `enquiry-page.tsx` (facts band with details and Copy, the quote figure, the contact log and its composer, Mark as
  duplicate), `enquiry-requests.tsx` (the requests table: offers, Accepted, changing an offer, Split, Close),
  `enquiry-quote.tsx` (Send quote, Email quote, Review prices, the printed quote; its page is
  `app/enquiries/[id]/quote`, outside the app frame so the browser prints the sheet alone),
  `find-parts.tsx` (the Find parts window, board 4: sizes and styles taken from the canvas markup), `enquiry-sourcing.tsx` (the ways to source a request, Record supplier quote, Ask a supplier: boards 3 and 3d), `enquiry-photos.tsx` (photo chips, the viewer, dropping and pasting; uploads go from the browser to the `enquiry-photos` bucket), `enquiry-controls.tsx` (assign picker, owner select, follow-up menu, notice,
  the close window, Find vehicle, the shortcuts window), `enquiry-bits.tsx` (status pill, step line, segments,
  channel choice, the customer picker). The record frame and table parts come from `blocks/records/`.
- Database: schema `sales` (`settings`, `lost_reasons`, `enquiries`, `enquiry_vehicles`, `enquiry_requests`,
  `enquiry_log`, `enquiry_viewers`, `offers`, `quotes` (every quote sent; the latest is the enquiry's); internals `price`, `pricing`, `fit`, `stock_at`, `branch`, `request_vehicle`,
  `offers_json`, `quote_json`, `position_of`, `standing` (where an enquiry stands: the one answer the list and the page both read),
  `set_status`, `settle`, `enquiry_for_change`, `check_customer`, `check_owner`, `customer_json`, `event`,
  `add_working_days`, `vehicle_label`, `phone_key`, `only_keys`). An enquiry is a `public.documents` row of type
  `enquiry` (ENQ-000001); what the system did goes to `public.document_events`. Entry points: `enquiry_create`,
  `enquiry_save`, `enquiry_assign`, `enquiry_delete`, `enquiry_save_vehicle`, `enquiry_remove_vehicle`,
  `enquiry_save_request`, `enquiry_remove_request`, `enquiry_log_contact`, `enquiry_set_status`,
  `enquiry_close_request`, `enquiry_reopen_request`, `enquiry_close`, `enquiry_reopen`, `enquiry_merge`,
  `enquiry_list`, `enquiry_detail`, `enquiry_owners`, `enquiry_pulse`, `enquiry_touch`, `enquiry_recent_customers`,
  `enquiry_caller_to_card`, `enquiry_split_request`, `enquiry_find_parts`, `enquiry_add_offer`, `enquiry_save_offer`,
  `enquiry_remove_offer`, `enquiry_accept_offer`, `enquiry_unaccept_offer`, `enquiry_refresh_offer`,
  `enquiry_supplier_quote_price`, `enquiry_record_supplier_quote`, `enquiry_ask_supplier`, `enquiry_source_request`,
  `enquiry_add_photo`, `enquiry_remove_photo` (table `sales.request_photos`), `enquiry_log_autodoc_search`
  (sourcing, S2c: table `sales.supplier_quotes`; a part off the stock list is priced by `sales.price` from
  `part_best_cost`, a purchasing entry point, and `bought_in_sell_price`, pricing), and `vehicle_find`
  (catalogue vehicles by any words). Vehicle healing (`20261118090000_vehicle_healing.sql`, suite `164_vehicle_healing.sql`,
  docs/SALES.md 10.2b): an enquiry vehicle carries `variant`, `year` and `spec` (`sales.vehicle_extras`); the car's year
  (`public.vrm_cars`, `sales.request_car_year`) makes a part listed only for other years read `other_years`
  (`sales.fit(vehicle, part, year)`, `sales.other_year_parts`); names are worded by `catalogue.platform_words`.
  Migrations `20261117170000_sales_autodoc_search.sql`, `20261117160000_sales_pictures.sql` (also `public.vrm_images`,
  `vrm_image`, `vrm_image_record`: the lookup's picture link per plate), `20261117150000_sales_sourcing.sql`, `20261117110000_sales_quotes.sql`, `20261117100000_sales_offers.sql` and `20261117090000_sales_enquiries.sql`. SQL tests:
  `supabase/tests/156_sales_boundary.sql` (the entry point allowlist), `157_enquiries.sql`, `158_offers.sql`, `159_quotes.sql`, `162_sourcing.sql`, `163_pictures.sql`.
- Tests: `tests/shared/sales/enquiries.test.ts` (wrappers, readers, wording), `tests/shared/sales/offers.test.ts`, `tests/shared/sales/quotes.test.ts`, `tests/shared/sales/sourcing.test.ts`, `tests/sales/input.test.ts` (input
  readers and the screens' small decisions).
- Sales orders: pages `app/sales-orders/page.tsx` (view, filter, branch and page in the address) and
  `app/sales-orders/[id]/page.tsx`; actions `app/sales-orders/actions.ts`; screens
  `components/shadcn-studio/blocks/sales/order-list.tsx`, `order-page.tsx` (the page with its line sheet, delivery,
  PO number and cancel windows) and `create-order.tsx` (opened from the enquiry). The trail strip is
  `blocks/records/trail.tsx`, shared with purchase orders. Database: `sales.orders`, `sales.order_lines`,
  `sales.enquiry_requests.order_id`; entry points `enquiry_order_preview`, `enquiry_create_order`, `sales_order_list`,
  `sales_order_detail`, `sales_order_save`, `sales_order_save_line`, `sales_order_remove_line`, `sales_order_cancel`
  (permission `sales_orders.cancel`); an account's terms and balance come through `customer_account_terms` and
  `customer_account_balance`. Migration `20261118100000_sales_orders.sql`; SQL test `165_sales_orders.sql`; unit test
  `tests/shared/sales/orders.test.ts`; demo seed `09-sales-orders.sql`. Boards 5e, 6d and 6e.
- Sales orders, part two (docs/SALES.md 13.8, boards 6f, 6g, 5f, 5g): `orders.ts` adds `previewOrderConfirm`,
  `confirmSalesOrder` (short lines to set aside anyway, with one reason), `checkOrderCredit`, `overrideOrderHold`,
  `cancelSalesOrderLine`, `setAsideOrderLine`, `getPartSetAside`, list filters (`SalesOrderFilters`), and the wording:
  `orderStockWords`, `holdWords`, `confirmHoldWords`, `stillHeldWords`, `confirmLineWords`, `confirmSummaryWords`,
  `orderOpenedWords`, `orderLineGroups` and `confirmedLineWhere` (a confirmed order's lines by where they stand).
  Views gain `to_order`, `to_pick`, `on_hold`. Actions `loadConfirmPreview`, `confirmOrder`, `checkCredit`,
  `overrideHold`, `cancelLine`, `setAsideLine`, `loadPartSetAside`. `order-page.tsx` holds the Confirm and Override
  windows and the grouped lines; `order-list.tsx` the Filters popover and the row preview. Database: columns on
  `sales.orders` (confirmed, hold, override, shelf reason) and `sales.order_lines` (`allocated`, `without_stock`,
  `in_stock_here`, `cancelled_at`); internals `on_hand_at`, `set_aside_at`, `stock_at` (now what is available),
  `free_for_line` (first confirmed first), `order_credit`, `open_orders_total`, `order_take_stock`, `order_release`,
  `order_open`, `hold_json`; entry points `sales_order_confirm_preview`, `sales_order_confirm`,
  `sales_order_check_credit`, `sales_order_override_hold` (permission `sales_orders.override_hold`, admins),
  `sales_order_cancel_line`, `sales_order_set_aside_line`, `part_set_aside`, and for the rest of the app
  `stock_set_aside` and `stock_set_aside_of`. The credit check reads customers through `customer_sale_check` and
  `customer_account_standing`. Parts to count are `public.count_requests` (floor's card). Migration
  `20261118110000_sales_order_confirm.sql`; SQL test `166_sales_order_confirm.sql`.
- Sales orders, part three (docs/SALES.md 13.9, boards 6h and 6i): `orders.ts` adds `previewNewSale`,
  `createSalesOrder` (`NewSale`), `discardSalesOrder`, `setSalesOrderCaller`, `findPartsForOrder`
  (`OrderFoundParts`), `addSalesOrderLine` (`NewSalesOrderLine`, `OrderLineAdded`), `holdSalesOrder`,
  `releaseSalesOrderHold`, the hold reason `customer` with its note, who and what it keeps, and the wording
  `holdRowWords`, `lineAddedWords`, `overLimitWords`, `newSaleStopWords`. `FoundPart.line` marks a part already on the
  order. Actions `loadNewSalePreview`, `createSale`, `discardOrder`, `nameCustomer`, `loadOrderParts`, `addLine`,
  `holdOrder`, `releaseHold`. Screens `new-sale.tsx` (New sale), `order-find-parts.tsx` (Add line), and in
  `order-page.tsx` the empty draft, Put on hold, Release hold and Customer details. `find-parts.tsx` exports what both
  Find parts windows share: `useFoundRows`, `FoundFilters`, `FoundHead`, `Row` (with an `action` cell),
  `BranchChoice`, `SupplierMenu`, `DetailsSheet`. `CustomerPicker` takes `cashSale`; `orderCustomerName` reads "Cash
  sale". `components/ui/radio-group.tsx` (shadcn, unified radix-ui). Database: `sales.orders.hold_note` and `hold_by`,
  table `sales.order_vehicles`; internals `find_parts` (the one search, wrapped by `enquiry_find_parts`),
  `order_vehicle`, `new_sale_plates`, `order_after_change`; entry points `sales_order_create_preview`,
  `sales_order_create`, `sales_order_set_caller`, `sales_order_discard`, `sales_order_find_parts`,
  `sales_order_add_line`, `sales_order_hold`, `sales_order_release_hold`. Migration
  `20261118120000_sales_order_direct.sql`; SQL test `167_sales_order_direct.sql`.
- Part three refined (docs/SALES.md 13.10, board 6j): lost-sale reasons end in Other (`LostReason.needsNote`;
  `sales.lost_reasons.needs_note`), which asks what happened when closing a request or enquiry (`CloseDialog` in
  `enquiry-controls.tsx` sends `note`) and when cancelling an order as lost (`cancelSalesOrder` sends `note`;
  `sales.orders.cancel_note`). An order made with New sale is cancelled as Made in error (`CANCEL_OUTCOMES` adds
  `error`). `offers.ts` adds `isMatchedPart` (Exact match pinned first in both Find parts windows, by `useFoundRows`);
  `orders.ts` adds `heldByAddWords` and `onOrderWhere` (Add line's "On this order" rows). `record-frame.tsx`: a need's
  action may be `onSelect`. `order-page.tsx`: F opens Add line, the empty draft, inc VAT for retail prices, the
  cash sale's need line, `CustomerDetails` (a popover), `ChoiceCard`. `CustomerPicker` takes typing on its trigger.
  Database: patched `enquiry_close_request`, `enquiry_close`, `enquiry_detail`, `sales_order_cancel`,
  `sales_order_detail`, `sales.cancelled_json`. Migration `20261119090000_sales_lost_other.sql`; SQL test
  `168_sales_lost_other.sql`. Polish: `WhatHappenedField` and `noteNext` (`enquiry-controls.tsx`) are the one
  What happened box; `SalesOrderDetail.contactable` and `OrderConfirmPreview.contactable` say whether a cash sale's
  customer can be rung (`sales_order_confirm` needs a phone number for a part to order). Migration
  `20261119100000_sales_cash_sale_contact.sql`; SQL test `169_sales_cash_sale_contact.sql`.
- Demo: `scripts/demo/seed/05-enquiries.sql`, `06-offers.sql` (a second branch, delivery times, fitments, offers); screens under "Sales" in `scripts/demo/screens.mjs`.
- Docs: `docs/SALES.md` (the plan; section 13.1 says what S1 built and what it left out), `DESIGN.md` "Sales:
  enquiries and orders" (how the screens look and behave).

## Rules
- Apps call only the `public` entry points. Sales names no other module's schema: customers are read through
  `customer_briefs` and `customer_find` (guard test 156). A new entry point goes in that test's allowlist.
- Where an enquiry stands (its group, and the reason under its status) is decided only in `sales.standing`; screens
  put it in words with `enquiryStepLine` and never work it out.
- The status moves because of what staff do. Screens never set a closed status: a request is closed with an outcome
  and the enquiry follows.
- Counter staff and up work enquiries; anyone signed in reads them. The database checks every one.
- Nothing is sent from the app: a message is logged as it is.
- Registration lookup (`lookup.ts`, docs/SALES.md 10.2a): `sales.settings.vrm_provider` is `vdg`. A new plate is
  looked up in the background by the `vrm-lookup` Edge Function (`supabase/functions/vrm-lookup`, reader in
  `_shared/vrm.ts`), which holds the provider's key as the secret `VDG_API_KEY`: never in the repo or an app.
  `lookUpRegistration` never throws for provider trouble (a failed lookup is a plate still to match by hand);
  `plateCandidates` lists what an unmatched lookup could be. The database scores the answer against the vehicle
  list (`vehicle_candidates_for_vrm`, `vrm_lookup_begin`, `vrm_lookup_finish`, `vrm_candidates`; the service-only
  `vrm_lookup_record`). Only a few fields are kept, for a day; the provider's full answer is never stored. A plate
  matched to a vehicle, by lookup or by hand (Find vehicle), is remembered in `vrm_lookups` and fills in next time
  at no cost. A match is also learned for the whole provider model (`vrm_model_key`, `vrm_pair`, pairings in
  `catalogue.vehicle_text_matches` under keys starting `vrm:`): the system's pick as `auto`, a person's choice as
  `manual`, which wins. Our vehicles' own fields are never changed by a lookup. Rows of our list that read the same
  are noted in `vrm_vehicle_twins`. SQL tests `160_vrm_lookup.sql`, `161_vrm_pairing.sql`; unit test
  `tests/sales/vrm-lookup.test.ts`.
- The screens follow the canvas: a control or a line of words that is not on a board for that screen is not added
  without asking the owner (owner, 17 November 2026).
- An offer's price is worked out in the database for this customer (`customer_price` for an account's part in the
  range, otherwise the trade or retail price); a screen never sends one with a new offer. A different price needs the
  "Change offer prices" permission and a reason. Cost and margin are sent only to a person with "See cost and margin".
- Suppliers, their costs and delivery times come through purchasing's `part_suppliers`. The supply link
  (`sales.order_supply`, ordering in) is the one place sales reads and writes purchase order lines: its functions
  (`supply_rows`, `order_in_apply`, `trim_supply`, `move_supply` and the others listed in suite 156) and the
  purchasing functions that keep it honest are the meeting point; nothing else in sales names `purchasing` or
  `ingest`, and nothing names `customers`. An arrival time is said only where the supplier's delivery times are set.
- Goods in fills a customer's purchase order line first and puts what lands on it aside on the location's collection
  and delivery shelf (`COLLECTION`); the database works it out again whenever a delivery is matched again, and a
  reversal takes it back first. Screens never work out what is on the shelf: they read `onShelf`. "Set aside" is held
  for an order; "put aside" is placing it on the shelf.
- Ordering in never places an order: a counter person adds a customer's parts to the supplier's draft for the order's
  branch (never one sent for approval or approved), each on its own line with the reference "SO-000061 · HG-2291"
  (the order and the customer's PO, never a name); someone who may place orders places it. A retail customer pays
  in full first (`sales.payments_taken`), unless someone with "Order in without payment" gives a reason. A failure
  to draft at Confirm never undoes the confirm.
- A screen is built from the canvas board's own markup (sizes, weights, which button style), not from its text
  alone (owner, 17 November 2026, after buttons came out the wrong size).
- A retail card belongs to customers: sales keeps only its id, so an erased card leaves no details behind here.

## Depends on
- `customers` (`customer_briefs`, `customer_find`, `customer_price`, retail cards), `purchasing` (`part_suppliers`),
  `pricing` (`effective_sell_price`), `inventory` (stock levels and bins), `parties` (contacts), `catalogue` (vehicles),
  `people` (members), the shared `documents` header and `document_events`.
