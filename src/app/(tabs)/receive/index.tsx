import { router } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';

import { NeedsLocation } from '@/features/location/needs-location';
import type { LineGroup } from '@/features/receive/lines';
import { statusText } from '@/features/receive/status-text';
import { useDelivery } from '@/features/receive/use-delivery';
import { CameraScanner } from '@/scan/camera-scanner';
import { ScanField } from '@/scan/scan-field';
import { useWorkingLocation } from '@/session/location-provider';
import { Button } from '@/ui/button';
import { cx } from '@/ui/cx';
import { EmptyState } from '@/ui/empty-state';
import { ListGroup, ListRow } from '@/ui/list';
import { Panel } from '@/ui/panel';
import { Quantity } from '@/ui/quantity';
import { Screen } from '@/ui/screen';

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export default function Receive() {
  const { location } = useWorkingLocation();
  const receiving = useDelivery();
  const { delivery, finished } = receiving;

  if (!receiving.loaded) return <Screen>{null}</Screen>;

  if (finished && !delivery) {
    return (
      <Screen>
        <View className="gap-4 px-4 pt-2">
          <Panel
            icon="sent"
            iconColour="tint"
            title="Delivery finished"
            body={`${plural(finished.units, 'unit goes', 'units go')} into ${finished.delivery.locationName ?? 'the'} Unbinned bin. Put them on the shelves by counting each bin.`}>
            <Button label="Put away now" onPress={() => router.navigate('/count')} />
            <Button label="Start another delivery" variant="secondary" onPress={() => void receiving.start()} />
          </Panel>
        </View>
      </Screen>
    );
  }

  if (!delivery) {
    if (!location) return <Screen><NeedsLocation reason="A delivery is booked into the location you’re working in." /></Screen>;
    return (
      <Screen>
        <EmptyState
          icon="receive"
          title="No delivery open"
          body={`Scan each box as it comes in. Stock goes into ${location.name}’s Unbinned bin, ready to put away. It works with no signal.`}>
          <Button label="Start a delivery" onPress={() => void receiving.start()} />
        </EmptyState>
        {receiving.recent.length > 0 ? (
          <View className="px-4 pb-10">
            <ListGroup title="Finished on this phone">
              {receiving.recent.map((item, index) => (
                <ListRow
                  key={item.documentId}
                  label={`Started ${time(item.startedAt)}`}
                  detail={item.locationName}
                  value={item.finishedAt ? `Finished ${time(item.finishedAt)}` : undefined}
                  last={index === receiving.recent.length - 1}
                />
              ))}
            </ListGroup>
          </View>
        ) : null}
      </Screen>
    );
  }

  function confirmFinish() {
    const unknown = receiving.groups.filter((group) => group.status === 'unknown').length;
    Alert.alert(
      'Finish this delivery?',
      [
        `${plural(receiving.groups.length, 'code', 'codes')}, ${plural(receiving.units, 'unit', 'units')}.`,
        unknown > 0 ? `${plural(unknown, 'unknown barcode stays', 'unknown barcodes stay')} for the office to match.` : null,
        'Anything scanned later starts a new delivery.',
      ]
        .filter(Boolean)
        .join(' '),
      [
        { text: 'Keep scanning', style: 'cancel' },
        { text: 'Finish', onPress: () => void receiving.finish() },
      ],
    );
  }

  return (
    <Screen>
      <View className="gap-3 px-4 pb-10 pt-2">
        <View accessible className="gap-0.5 px-1">
          <Text accessibilityRole="header" className="text-lg font-semibold text-ink">
            {receiving.number ? `Delivery ${receiving.number}` : `Delivery started ${time(delivery.startedAt)}`}
          </Text>
          <Text className="text-sm tabular-nums text-quiet-ink">
            {[delivery.locationName, plural(receiving.groups.length, 'code', 'codes'), plural(receiving.units, 'unit', 'units')]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <Text className={cx('text-sm', receiving.problems > 0 ? 'text-out' : 'text-quiet-ink')}>
            {receiving.problems > 0
              ? `${plural(receiving.problems, 'line needs', 'lines need')} attention`
              : receiving.waiting > 0
                ? `${plural(receiving.waiting, 'line', 'lines')} saved, waiting to send`
                : receiving.groups.length > 0
                  ? 'Everything scanned has reached PartsLogic'
                  : 'Scan the first box'}
          </Text>
        </View>

        <CameraScanner className="h-40" onScan={(code) => void receiving.scan(code)} />
        <ScanField placeholder="Barcode or part number" onSubmit={(code) => void receiving.scan(code)} />

        {receiving.notice ? <Panel icon="warning" title="Not added" body={receiving.notice} /> : null}

        {receiving.lastLine && receiving.lastLine.qty > 0 ? (
          <View className="flex-row items-center justify-between gap-3 rounded-xl bg-mist px-4 py-2">
            <Text numberOfLines={1} className="shrink text-base tabular-nums text-mist-ink">
              +1 {receiving.lastLine.label ?? receiving.lastLine.code}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Undo the last scan"
              hitSlop={8}
              onPress={() => {
                const line = receiving.lastLine;
                if (line) void receiving.change(line.code, -1, line.label);
              }}
              className="h-11 justify-center px-2 active:opacity-70">
              <Text className="text-base font-semibold text-tint">Undo</Text>
            </Pressable>
          </View>
        ) : null}

        {receiving.groups.length > 0 ? (
          <>
            <Button label="Finish delivery" onPress={confirmFinish} />
            <ListGroup title="Scanned">
              {receiving.groups.map((group, index) => (
                <GroupRow key={group.code} group={group} receiving={receiving} last={index === receiving.groups.length - 1} />
              ))}
            </ListGroup>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

function GroupRow({
  group,
  receiving,
  last,
}: {
  group: LineGroup;
  receiving: ReturnType<typeof useDelivery>;
  last: boolean;
}) {
  const status = statusText(group.status, group.reason);
  const name = group.label ?? group.code;
  return (
    <View className={cx('flex-row items-center gap-3 px-4 py-3', !last && 'border-b border-hairline')}>
      <View className="flex-1 gap-0.5">
        <Text numberOfLines={1} className="text-base tabular-nums text-ink">
          {name}
        </Text>
        {group.label ? <Text className="text-sm tabular-nums text-quiet-ink">{group.code}</Text> : null}
        <Text className={cx('text-sm', status.problem ? 'text-out' : 'text-quiet-ink')}>{status.text}</Text>
      </View>
      <Quantity
        total={group.total}
        name={name}
        onStep={(change) => void receiving.change(group.code, change, group.label)}
        onSet={(target) => void receiving.setTotal(group.code, target, group.total, group.label)}
      />
    </View>
  );
}
