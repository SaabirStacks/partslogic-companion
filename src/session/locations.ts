import type { Location } from '@/vendor/partslogic/shared/inventory';

import type { WorkingLocation } from '@/lib/prefs';

// The locations staff can work in. listLocations also returns stock with no location as a pseudo-location
// with id 0 (UNASSIGNED); nobody works "in" that.
export function workingLocations(locations: Location[]): WorkingLocation[] {
  return locations
    .filter((location) => location.id !== 0)
    .map((location) => ({ id: location.id, code: location.code, name: location.name }));
}

// The saved location if it still exists (refreshed in case it was renamed), the only location when there
// is just one, otherwise none until the person picks.
export function resolveWorkingLocation(
  saved: WorkingLocation | null,
  locations: WorkingLocation[],
): WorkingLocation | null {
  const current = saved ? locations.find((location) => location.id === saved.id) : undefined;
  if (current) return current;
  return locations.length === 1 ? locations[0] : null;
}
