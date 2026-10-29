import { ActivityIndicator, View } from 'react-native';

import { plural } from '@/lib/format';
import { Button } from '@/ui/button';
import { Icon } from '@/ui/icon';
import { StatusStrip } from '@/ui/status-strip';
import { Card, PressableCard } from '@/ui/surface';
import { Txt } from '@/ui/text';
import { useColour } from '@/ui/theme';
import { Scroll } from '@/ui/scroll';

import type { WaitingRow } from './waiting';

// What's waiting in a location's Unbinned bin, part by part, biggest first. A part that already lives on a
// shelf says which, and tapping it starts putting away into that shelf; one with no shelf yet opens the
// part. Needs signal.
export function WaitingView({
  location,
  rows,
  loading,
  failed,
  online,
  limit,
  onRow,
  onRetry,
}: {
  location: string;
  rows: WaitingRow[];
  loading: boolean;
  failed: boolean;
  online: boolean;
  limit: number;
  onRow: (row: WaitingRow) => void;
  onRetry: () => void;
}) {
  const colourOf = useColour();
  const units = rows.reduce((sum, row) => sum + row.qty, 0);
  return (
    <Scroll className="flex-1 bg-ground" contentContainerClassName="gap-3 px-4 pt-4">
      <View className="gap-1" accessible accessibilityRole="header">
        <Txt variant="headline" numbers className="font-extrabold">
          {loading ? 'Waiting' : `${plural(units, 'unit', 'units')} waiting`}
        </Txt>
        <Txt variant="caption">{loading ? `In ${location} Unbinned` : `In ${location} Unbinned · ${plural(rows.length, 'part', 'parts')}`}</Txt>
      </View>

      {!online ? <StatusStrip tone="warn" icon="offline" text="What’s waiting shows when you’re back online" /> : null}
      {failed && rows.length === 0 && online ? (
        <>
          <StatusStrip tone="stop" icon="offline" text="Didn’t load" />
          <Button label="Try again" icon="retry" variant="secondary" onPress={onRetry} />
        </>
      ) : null}
      {loading ? (
        <View className="py-4">
          <ActivityIndicator color={colourOf('quiet-ink')} />
        </View>
      ) : null}
      {!loading && !failed && online && rows.length === 0 ? (
        <Card className="items-center gap-1 p-5">
          <Txt variant="label" className="font-bold">
            Nothing waiting
          </Txt>
          <Txt variant="caption">Everything delivered here is on a shelf</Txt>
        </Card>
      ) : null}

      <View className="gap-2">
        {rows.map((row) => (
          <PressableCard
            key={row.partId}
            accessibilityLabel={`${row.name}, ${plural(row.qty, 'unit', 'units')}. ${row.shelf ? `Put away on ${row.shelf.code}` : 'No shelf yet, open the part'}`}
            onPress={() => onRow(row)}
            className="min-h-16 flex-row items-center gap-3 px-4 py-2.5">
            <View className="flex-1 gap-0.5">
              <Txt variant="label" numberOfLines={1} className="font-bold">
                {row.name}
              </Txt>
              <Txt variant="caption" numberOfLines={1} ink={row.shelf ? 'text-action-ink' : 'text-quiet-ink'}>
                {row.shelf ? `Put away on ${row.shelf.code}` : 'No shelf yet'}
              </Txt>
            </View>
            <Txt variant="title" numbers className="font-extrabold">
              {String(row.qty)}
            </Txt>
            <Icon name="forward" size={16} colour="quiet-ink" />
          </PressableCard>
        ))}
      </View>
      {rows.length >= limit ? <Txt variant="caption" className="px-1">{`The ${limit} biggest; the rest are in the office’s Unlocated list`}</Txt> : null}
    </Scroll>
  );
}
