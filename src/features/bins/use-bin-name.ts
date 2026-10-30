import { useCallback } from 'react';

import { useWorkingLocation } from '@/session/location-provider';

import { binName } from './bin-name';

// binName with the phone's location filled in.
export function useBinName(): (place: string) => string {
  const { location, locations } = useWorkingLocation();
  return useCallback((place: string) => binName(place, location, locations), [location, locations]);
}
