# reports

Read-only figures: inventory summary, stock valuation, reorder suggestions, zero-result searches and the side menu's
counts.

## Files here
- `reports.ts`: `getInventorySummary`, `getStockValuation`, `getReorderSuggestions`, `getZeroResultSearches`.
- `menu-counts.ts`: `getMenuCounts` and `readMenuCounts` (public.menu_counts): the number beside each side-menu item,
  keyed by `MENU_COUNT_KEYS`, only the counts the person may see and only above 0.

## Elsewhere
- API only: `app/api/v1/reports/` (`summary`, `valuation`, `reorder`, `zero-result-searches`). No screen yet.
- The side menu reads the counts from `GET /api/v1/reports/menu-counts` in
  `components/shadcn-studio/blocks/application-shell-19/menu-counts.tsx`; which item shows which key is in `menu.ts`.
- Database: views `inventory_summary`, `zero_result_searches`; `stock_valuation`, `reorder_suggestions`;
  `menu_counts` (migration `20261123100000_shell_menu_counts`, suite `182_shell_menu_counts`).

## Rules
- The database computes every figure; format them, never recalculate.
