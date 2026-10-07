import { ScrollView } from 'react-native';

import { NeedsLocation } from '@/features/location/needs-location';
import { useWorkingLocation } from '@/session/location-provider';
import { EmptyState } from '@/ui/empty-state';

export default function Receive() {
  const { location } = useWorkingLocation();
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="flex-grow">
      {location ? (
        <EmptyState
          icon="receive"
          title="No delivery open"
          body={`Deliveries you scan here go into ${location.name}'s Unbinned bin, ready to put away. Receiving arrives in a later build.`}
        />
      ) : (
        <NeedsLocation reason="A delivery is booked into the location you're working in." />
      )}
    </ScrollView>
  );
}
