import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef } from 'react';
import Animated from 'react-native-reanimated';

import { loadPart } from '@/features/part/load-part';
import { PartSkeleton } from '@/features/part/part-skeleton';
import { PartView } from '@/features/part/part-view';
import { useRemote } from '@/lib/use-remote';
import { Button } from '@/ui/button';
import { APPEAR } from '@/ui/motion';
import { Notice } from '@/ui/notice';
import { classifyQueueError } from '@/vendor/partslogic/shared/errors';

// The whole part, one tap from any scan. Nothing about stock is hidden (see PartView).
export default function PartCard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const partId = Number(id);
  const valid = Number.isInteger(partId) && partId > 0;
  const { data, error, loading, reload } = useRemote(valid ? `part:${partId}` : null, () => loadPart(partId));

  // Coming back from Move (or anywhere else) shows the stock as it is now.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      reload();
    }, [reload]),
  );

  if (!valid || data === null) return <Notice icon="lookup" tone="warn" title="Part not found" line="It may have been merged or removed." />;
  // The part fades in over its skeleton when it arrives; a pull to refresh keeps it on screen.
  if (data) {
    return (
      <Animated.View entering={APPEAR} style={{ flex: 1 }}>
        <PartView detail={data.detail} savedAt={data.savedAt} onRefresh={reload} refreshing={loading} />
      </Animated.View>
    );
  }
  if (error && !loading) {
    const offline = classifyQueueError(error as { code?: string; message?: string }) === 'retry';
    return (
      <Notice
        icon={offline ? 'offline' : 'stop'}
        tone={offline ? 'warn' : 'stop'}
        title={offline ? 'No signal' : 'Didn’t load'}
        line={offline ? 'This part isn’t saved on this phone yet.' : (error as Error).message}>
        <Button label="Try again" icon="retry" variant="tinted" onPress={reload} />
      </Notice>
    );
  }
  return <PartSkeleton />;
}
