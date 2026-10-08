import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef } from 'react';
import { View } from 'react-native';

import { loadPart } from '@/features/part/load-part';
import { PartView } from '@/features/part/part-view';
import { useRemote } from '@/lib/use-remote';
import { Button } from '@/ui/button';
import { Notice } from '@/ui/notice';
import { Plate } from '@/ui/plate';
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

  if (!valid || data === null) return <Notice icon="lookup" tone="warning" title="Part not found" line="It may have been merged or removed." />;
  if (data) return <PartView detail={data.detail} savedAt={data.savedAt} />;
  if (error && !loading) {
    const offline = classifyQueueError(error as { code?: string; message?: string }) === 'retry';
    return (
      <Notice
        icon={offline ? 'offline' : 'stop'}
        tone={offline ? 'warning' : 'stop'}
        title={offline ? 'No signal' : 'Didn’t load'}
        line={offline ? 'This part isn’t saved on this phone yet.' : (error as Error).message}>
        <Button label="Try again" icon="retry" variant="secondary" onPress={reload} />
      </Notice>
    );
  }
  return <Skeleton />;
}

function Skeleton() {
  return (
    <View accessibilityLabel="Loading part" className="gap-3 bg-ground px-3 pt-3">
      <Plate className="h-24" />
      <Plate className="h-28" />
      <Plate className="h-16" />
      <Plate className="h-16" />
    </View>
  );
}
