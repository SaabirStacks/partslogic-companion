# locations

Locations and their bins: codes, the bin tree (aisle, level, bin from codes like `00-A-01`), the unassigned bin
and system bins.

## Files here
- `locations.ts`: `listLocations` (every location with its bins, for stock forms), `createLocation`,
  `listLocationSummaries`, `updateLocation`, `deleteLocation`.
- `bins.ts`: `createBin`, `createBins`, `listLocationBins`, `listLocationBinTree`, `updateBin`, `deleteBin`.

## Elsewhere
- Screen: Settings › Locations (`components/shadcn-studio/blocks/organisation-settings/locations-section.tsx`, 1,000 lines).
- Server actions in `app/settings/actions.ts`: `loadBins`, `loadBinTree`, `addLocation`, `saveLocation`,
  `removeLocation`, `addBins`, `saveBin`, `removeBin`; in `app/inventory/actions.ts`: `loadLocations`,
  `addLocation`, `addBin` (adding one from a stock form).
- API: `app/api/v1/locations/` (and `[locationId]/bins`).
- Helpers: `lib/bin-codes.ts` (bin code ranges).
- Database: tables `locations`, `bins`; view `bin_places`; `location_overview`, `location_bins`,
  `location_bin_tree`, `create_bins`. SQL tests: `supabase/tests/60_settings.sql`, `102_location_bin_tree.sql`.
- Tests: `tests/settings/bin-codes.test.ts`.
- Docs: `docs/SETTINGS_TIMEOUTS_AND_BIN_TREE.md`.

## Rules
- Deleting a bin or location moves its stock to the unassigned or unbinned bin; nothing is lost. System bins
  can't be changed or removed.
- Opening stock per location belongs to `floor`.
