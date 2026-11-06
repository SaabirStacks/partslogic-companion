# company

The company's own settings: one `workspace` row with name, currency, VAT rate, whether retail prices include
VAT, price rounding and the exchange surcharge uplift; and who the company is on documents (a printed purchase
order): one company, one logo, one trading name.

## Files here
- `workspace.ts`: `getWorkspace`, `updateWorkspace` (owners only), `PRICE_ROUNDINGS`, `isPriceRounding`.
- `details.ts`: `getCompanyDetails`, `saveCompanyDetails` (owners only), `readCompanyDetails`, `REGISTERED_IN`; the
  logo: `replaceCompanyLogo`, `removeCompanyLogo`, `companyLogoUrl`, `logoPathFor`, `LOGO_BUCKET`, `LOGO_TYPES`,
  `LOGO_MAX_BYTES`. Sites (delivery addresses) are saved with `savePartySite` in `parties`.

## Elsewhere
- Screen: Settings › Company (`components/shadcn-studio/blocks/organisation-settings/company-section.tsx`), in `app/settings/page.tsx`.
- Screens: Settings › Company › the Documents cards (`organisation-settings/company-documents.tsx`); Settings ›
  Locations › Delivery addresses (`organisation-settings/delivery-sites.tsx`).
- Server actions: `saveCompany` in `app/settings/actions.ts`; `saveCompanyDocuments`, `uploadCompanyLogo`,
  `deleteCompanyLogo`, `saveDeliverySite`, `removeDeliverySite`, `setLocationDelivery` in
  `app/settings/company-actions.ts`.
- Database: the `workspace` table (row-level security lets only the owner change it; `party_id`, `registered_in`,
  `logo_path`, `order_terms`); `round_sell_price`; `company_details`, `save_company_details`; `locations.address_id`
  (a trigger keeps it to the company's sites); bucket `branding`. SQL tests: `supabase/tests/118_company_details.sql`.
- Tests: `tests/shared/company.test.ts`, `tests/settings/company-documents.test.ts`.
- Docs: `docs/SETTINGS_AND_PRICING.md`; `docs/PURCHASE_ORDERS.md` (company details).

## Used by
- `pricing` (rounding and VAT for rule prices); the companion reads `workspace` directly.
