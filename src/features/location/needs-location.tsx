import { router } from 'expo-router';

import { Button } from '@/ui/button';
import { EmptyState } from '@/ui/empty-state';

// Receiving and counting book stock into a location, so they ask for one first.
export function NeedsLocation({ reason }: { reason: string }) {
  return (
    <EmptyState icon="location" title="Choose a location first" body={reason}>
      <Button label="Choose location" onPress={() => router.push('/location')} />
    </EmptyState>
  );
}
