# reports

Read-only figures: inventory summary, stock valuation, reorder suggestions and zero-result searches.

## Files here
- `reports.ts`: `getInventorySummary`, `getStockValuation`, `getReorderSuggestions`, `getZeroResultSearches`.

## Elsewhere
- API only: `app/api/v1/reports/` (`summary`, `valuation`, `reorder`, `zero-result-searches`). No screen yet.
- Database: views `inventory_summary`, `zero_result_searches`; `stock_valuation`, `reorder_suggestions`.

## Rules
- The database computes every figure; format them, never recalculate.
