import type { WorkingLocation } from '@/lib/prefs';

const SYSTEM_BINS: Record<string, string> = { UNBINNED: 'Unbinned', UNASSIGNED: 'Unassigned' };

// How a bin is written on screen. PartsLogic names a bin LOC/BIN ("EM12/00-A-01"), but the phone's own
// location shows once, on the board, so a bin there is just its name ("00-A-01"). A bin in another
// location keeps that location's name in front ("RETAIL · 00-A-01"), so stock elsewhere isn't mistaken for
// stock here. Location codes never reach the screen, and the system bins read as words ("Unbinned").
export function binName(place: string, here: Pick<WorkingLocation, 'code'> | null, locations: readonly WorkingLocation[] = []): string {
  const slash = place.indexOf('/');
  const code = slash >= 0 ? place.slice(0, slash) : null;
  const bin = slash >= 0 ? place.slice(slash + 1) : place;
  const shown = SYSTEM_BINS[bin.trim().toUpperCase()] ?? bin;
  if (!code || (here && code === here.code)) return shown;
  const other = locations.find((location) => location.code === code);
  return other ? `${other.name} · ${shown}` : shown;
}

// The name of the location a bin is in, when it isn't the phone's own (null when it is, or unknown).
export function otherLocationName(code: string | null | undefined, here: Pick<WorkingLocation, 'code'> | null, locations: readonly WorkingLocation[] = []): string | null {
  if (!code || (here && code === here.code)) return null;
  return locations.find((location) => location.code === code)?.name ?? null;
}
