import { ScrollView } from 'react-native';

import { NeedsLocation } from '@/features/location/needs-location';
import { useWorkingLocation } from '@/session/location-provider';
import { EmptyState } from '@/ui/empty-state';

export default function Count() {
  const { location } = useWorkingLocation();
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="flex-grow">
      {location ? (
        <EmptyState
          icon="count"
          title="Scan a bin to start"
          body={`Count a bin in ${location.name} to put stock away or check what's on the shelf. Counts are blind: you only see what you scan. Counting arrives in a later build.`}
        />
      ) : (
        <NeedsLocation reason="Bin labels are read in the location you're working in." />
      )}
    </ScrollView>
  );
}
