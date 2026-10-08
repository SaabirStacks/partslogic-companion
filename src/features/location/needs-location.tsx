import { router } from 'expo-router';

import { Button } from '@/ui/button';
import { Notice } from '@/ui/notice';

// Receiving and counting book stock into a location, so they ask for one first.
export function NeedsLocation() {
  return (
    <Notice icon="location" title="Choose a location">
      <Button label="Choose location" icon="location" onPress={() => router.push('/location')} />
    </Notice>
  );
}
