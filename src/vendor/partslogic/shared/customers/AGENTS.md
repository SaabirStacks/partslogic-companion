# customers

Everyone the business sells to: trade accounts (payment terms, credit limits, discount tiers and deals, status) and
retail contact cards (never accounts). Built on the module pattern: its own `customers` schema behind thin `public`
entry points. Sales (next) reads it to price, check credit and invoice.

## Files here
- `accounts.ts`: trade accounts: `listCustomers` (with counts and totals; each row's `partyId` is how other modules
  point at an account), `getCustomer`, `createCustomerAccount`,
  `saveCustomerAccount`, `setCustomerStatus`, `checkCustomerSale` (whether an amount may go on account), the readers,
  `TRADE_TYPES`, `CUSTOMER_STATUSES`, `SALE_BLOCKS`.
- `discounts.ts`: payment terms, discount tiers and rules, what an account pays: `getCustomerSetup`,
  `savePaymentTerms`, `saveDiscountTier`, `saveDiscountRule`, `removeDiscountRule`, `getCustomerPrice`,
  `saveCustomerSettings`, `paymentTermsText`, `discountText`.
- `find.ts`: `findCustomers`, the picker other modules use (sales first): open trade accounts with their contacts,
  and retail cards, matched on a name, a contact, an account number, a phone number or a postcode.
- `retail.ts`: retail cards: `listRetailCustomers`, `saveRetailCustomer`, `eraseRetailCustomer`,
  `clearOldRetailCustomers`.

## Elsewhere
- Pages: `app/customers/page.tsx` (trade accounts by status, and the Retail cards tab), `app/customers/new/page.tsx`,
  `app/customers/[id]/page.tsx` (the tabbed account), `app/customers/setup/page.tsx` (terms and discounts);
  `app/customers/page-access.tsx` (sign-in and membership for all four). Server actions: `app/customers/actions.ts`
  (`findCustomerAccounts` is the account picker other pages use: the cores page now, sales later); input readers
  `lib/api/customer-input.ts`.
- Components: `components/shadcn-studio/blocks/customers/` (`customer-list.tsx`, `customer-page.tsx`,
  `customer-settings.tsx`, `customer-new.tsx`, `customer-setup.tsx`, `discount-rules.tsx` (a tier's rules or an
  account's deals), `retail-cards.tsx`, `customer-bits.tsx`); the record frame shared with suppliers in
  `components/shadcn-studio/blocks/records/` (`record-frame.tsx`, `month-bars.tsx`, `list-summary.tsx`,
  `data-table.tsx`, `table-tools.tsx`, `planned.tsx` (placeholders for figures a later module fills), `format.ts`); contacts and addresses from `parties`.
- Database: schema `customers` (`accounts`, `account_events`, `payment_terms`, `discount_tiers`, `discount_rules`,
  `retail_contacts`, `retail_vehicles`, `retail_erasures`, `settings`; internals `price_for`, `due_date`,
  `account_balance` (0 until sales), `rule_json`, `rule_list`, `card_json`, `phone_key`). Entry points:
  `customer_setup`, `save_payment_terms`, `save_discount_tier`, `save_discount_rule`, `remove_discount_rule`,
  `customer_list`, `customer_detail`, `create_customer_account`, `save_customer_account`, `set_customer_status`,
  `customer_price`, `customer_sale_check`, `retail_customer_list`, `save_retail_customer`, `erase_retail_customer`,
  `clear_old_retail_customers`, `save_customer_settings`, and two read-only ones for other modules: `customer_briefs`
  (names and statuses by party, cards by id) and `customer_find` (the picker). Sales orders also read
  `customer_account_terms`, `customer_account_balance` and `customer_account_standing` (status, its reason and since
  when, for a credit hold's wording). SQL tests: `supabase/tests/129_customers_boundary.sql`
  (the entry point allowlist), `130_customers.sql`.
- Tests: `tests/shared/customers/accounts.test.ts`, `discounts.test.ts`, `retail.test.ts`;
  `tests/customers/input.test.ts` (input readers and the record formats).
- Docs: `docs/CUSTOMERS.md` (decisions, the gaps in the trade, the pricing rule, the sale check, the record pages).

## Rules
- Apps call only the `public` entry points; nothing outside customers refers to its schema, and it refers to no other
  module (guard test 129). A new entry point goes in that test's allowlist too.
- Admins set the money (terms, limits, tiers, deals, lifting a stop); editors open and edit accounts and put them on
  stop; counter staff keep contacts, delivery sites and retail cards. The database checks every one.
- Which rule prices a part is decided only in `customers.price_for`; screens show its answer.
- Retail cards hold personal data: kept for the set time after last use, erased on request, erasures logged without
  the details.

## Depends on
- `parties` (identity, contacts, addresses, delivery sites); `catalogue` (brands, categories, parts); `pricing`
  (`effective_sell_price`, `part_margins`); `inventory` (stock cost).
