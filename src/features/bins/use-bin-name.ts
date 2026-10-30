import { use, useCallback } from 'react';

import { LocationContext } from '@/session/location-provider';

import { binName } from './bin-name';

// binName with the phone's location filled in. Outside a location (the review gallery's loose parts),
// bins show as PartsLogic names them, less any location code.
export function useBinName(): (place: string) => string {
  const value = use(LocationContext);
  const location = value?.location ?? null;
  const locations = value?.locations;
  return useCallback((place: string) => binName(place, location, locations ?? []), [location, locations]);
}
