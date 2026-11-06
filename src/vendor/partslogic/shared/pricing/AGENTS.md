# pricing

Sell prices: retail and trade price tiers per part (with dates), and margin rules by company, brand, category
or part that give rule prices.

## Files here
- `price-tiers.ts`: `getPartPricing`, `savePriceTier`, `deletePriceTier`, `PRICE_TIERS`, `priceTierStatus`.
- `rules.ts`: `listPricingRules`, `savePricingRule`, `getPartPricingRules`, `rulePrice` (preview that mirrors
  `public.round_sell_price`), `labelParts`.

## Elsewhere
- Part modal: `components/shadcn-studio/blocks/part-detail/tabs/pricing-tab.tsx`, `components/shadcn-studio/blocks/part-detail/margin-rules.tsx`.
- Settings › Pricing: `components/shadcn-studio/blocks/organisation-settings/pricing-section.tsx`.
- Server actions in `app/inventory/actions.ts`: `loadPartPricing`, `savePrice`, `removePrice`,
  `loadPartPricingRules`, `savePartMargins`; in `app/settings/actions.ts`: `saveRule`, `removeRule`.
- API: `app/api/v1/inventory/[partId]/prices/`. Helpers: `lib/api/price-input.ts`.
- Database: tables `inventory_prices`, `pricing_rules`; `part_pricing_rules`, `round_sell_price`; supplier
  prices come from imports (`supplier_prices`). SQL tests: `supabase/tests/60_settings.sql`, `80_surcharges.sql`,
  `96_stock_cost_pricing.sql`.
- Tests: `tests/settings/rule-price.test.ts` (checks `rulePrice` agrees with SQL).
- Docs: `docs/SETTINGS_AND_PRICING.md`.

## Rules
- The database does the rounding; `rulePrice` only previews it and must stay in step with `round_sell_price`.
- Company, brand and category rules need an admin; a part's margins need an editor.

## Depends on
- `company` (VAT and rounding).
