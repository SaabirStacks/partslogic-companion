# pricing

Sell prices: retail and trade price tiers per part (with dates), and margin rules by company, brand, category
or part that give rule prices.

## Files here
- `price-tiers.ts`: `getPartPricing`, `savePriceTier`, `deletePriceTier`, `PRICE_TIERS`, `priceTierStatus`.
- `rules.ts`: `listPricingRules`, `savePricingRule`, `getPartPricingRules`, `rulePrice` (preview that mirrors
  `public.round_sell_price`), `labelParts`.
- `sell-price-history.ts`: `getSellPriceHistory` (every change to a typed selling price, newest first).

## Elsewhere
- Part modal: `components/shadcn-studio/blocks/part-detail/tabs/pricing-tab.tsx`, `components/shadcn-studio/blocks/part-detail/margin-rules.tsx`,
  `components/shadcn-studio/blocks/part-detail/price-history-panel.tsx` (its Your prices tab; the other two are purchasing's).
- Settings › Pricing: `components/shadcn-studio/blocks/organisation-settings/pricing-section.tsx`.
- Server actions in `app/inventory/actions.ts`: `loadPartPricing`, `loadSellPriceHistory`, `savePrice`, `removePrice`,
  `loadPartPricingRules`, `savePartMargins`; in `app/settings/actions.ts`: `saveRule`, `removeRule`.
- API: `app/api/v1/inventory/[partId]/prices/`. Helpers: `lib/api/price-input.ts`.
- Database: tables `inventory_prices`, `pricing_rules`, `inventory_price_changes` (every change to a typed price,
  append-only, written by the trigger on `inventory_prices`); `part_pricing_rules`, `round_sell_price`,
  `bought_in_sell_price` (the rule price of a part bought at a given cost: for a part off the stock list, or one
  not yet in the catalogue, by its brand; Sales uses it, SQL test `162_sourcing.sql`),
  `part_sell_price_history`; supplier prices come from imports (`supplier_prices`). SQL tests:
  `supabase/tests/60_settings.sql`, `80_surcharges.sql`, `96_stock_cost_pricing.sql`, `126_price_history.sql`.
- Tests: `tests/settings/rule-price.test.ts` (checks `rulePrice` agrees with SQL), `tests/shared/pricing/sell-price-history.test.ts`.
- Docs: `docs/SETTINGS_AND_PRICING.md`.

## Rules
- The database does the rounding; `rulePrice` only previews it and must stay in step with `round_sell_price`.
- Company, brand and category rules need an admin; a part's margins need an editor.

## Depends on
- `company` (VAT and rounding).
