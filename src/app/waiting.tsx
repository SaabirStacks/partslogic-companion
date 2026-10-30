import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

import { NeedsLocation } from '@/features/location/needs-location';
import { useWaiting } from '@/features/put-away/use-waiting';
import { WaitingView } from '@/features/put-away/waiting-view';
import { useOnline } from '@/lib/network';
import { useWorkingLocation } from '@/session/location-provider';

// What's waiting to be put away in the working location's Unbinned bin, opened from Put away. Tapping a
// part with a shelf goes back to Put away counting that shelf.
export default function Waiting() {
  const { location } = useWorkingLocation();
  const online = useOnline();
  const waiting = useWaiting(online && location ? location.id : null);

  // Coming back after putting something away shows what's left.
  const firstFocus = useRef(true);
  const { reload } = waiting;
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      reload();
    }, [reload]),
  );

  if (!location) return <NeedsLocation />;
  return (
    <WaitingView
      rows={waiting.rows}
      loading={online && waiting.loading}
      failed={waiting.failed}
      online={online}
      limit={waiting.limit}
      onRetry={waiting.reload}
      onRow={(row) =>
        row.shelf
          ? router.navigate({
              pathname: '/count',
              params: { purpose: 'put-away', binId: String(row.shelf.binId), bin: row.shelf.code, location: location.code },
            })
          : router.push({ pathname: '/part/[id]', params: { id: String(row.partId) } })
      }
    />
  );
}
