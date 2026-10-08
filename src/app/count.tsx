import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { countResultText } from '@/features/count/result-text';
import { useBinCount } from '@/features/count/use-bin-count';
import { NeedsLocation } from '@/features/location/needs-location';
import { AddPartLink } from '@/features/quick-add/add-part-link';
import { useRemote } from '@/lib/use-remote';
import { supabase } from '@/lib/supabase';
import { CameraScanner } from '@/scan/camera-scanner';
import { ScanField } from '@/scan/scan-field';
import { useWorkingLocation } from '@/session/location-provider';
import { Button } from '@/ui/button';
import { cx } from '@/ui/cx';
import { ListGroup, ListRow } from '@/ui/list';
import { Panel } from '@/ui/panel';
import { Quantity } from '@/ui/quantity';
import { Screen } from '@/ui/screen';
import { useColour } from '@/ui/theme';
import { unlocatedStockSummary } from '@/vendor/partslogic/shared/floor';

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export default function Count() {
  const counting = useBinCount();
  const params = useLocalSearchParams<{ binId?: string; bin?: string; location?: string }>();
  const { begin, loaded, count } = counting;
  // The "Count this bin" request already acted on, so a re-render can't start it twice.
  const handled = useRef<string | null>(null);

  // "Count this bin" from Look up.
  useEffect(() => {
    const binId = Number(params.binId);
    if (!loaded || count || !Number.isInteger(binId) || binId <= 0 || !params.bin) return;
    if (handled.current === params.binId) return;
    handled.current = params.binId!;
    router.setParams({ binId: undefined, bin: undefined, location: undefined });
    void Promise.resolve().then(() => begin({ binId, binCode: params.bin!, location: params.location ?? null }));
  }, [loaded, count, params.binId, params.bin, params.location, begin]);

  if (!loaded) return <Screen>{null}</Screen>;
  return count ? <Counting counting={counting} /> : <Start counting={counting} />;
}

type CountingApi = ReturnType<typeof useBinCount>;

function Start({ counting }: { counting: CountingApi }) {
  const { location } = useWorkingLocation();
  const colourOf = useColour();
  // Read the id here, not inside the loader: the React Compiler reads what a callback uses while the screen
  // renders, so `location!.id` in the callback crashed before a location was chosen.
  const locationId = location?.id ?? null;
  const unbinned = useRemote(locationId !== null && counting.online ? `unbinned:${locationId}` : null, () =>
    unlocatedStockSummary(supabase, locationId),
  );
  const { start } = counting;

  if (!location) return <Screen><NeedsLocation reason="Bin labels are read in the location you’re working in." /></Screen>;

  return (
    <Screen>
      <View className="gap-3 px-4 pb-10 pt-2">
        <View className="gap-1 px-1">
          <Text accessibilityRole="header" className="text-lg font-semibold text-ink">
            Scan a bin to start
          </Text>
          <Text className="text-sm leading-5 text-quiet-ink">
            Then scan every part on its shelf. Counts are blind: you only see what you scan. Counting a bin also puts
            away stock waiting in Unbinned.
          </Text>
          {unbinned.data && unbinned.data.parts > 0 ? (
            <Text className="text-sm tabular-nums text-mandatory-ink">
              Unbinned in {location.name}: {plural(unbinned.data.parts, 'part', 'parts')} ·{' '}
              {plural(unbinned.data.qty, 'unit', 'units')}
            </Text>
          ) : null}
        </View>

        <View className="h-48 overflow-hidden rounded-plate">
          <CameraScanner
          enabled={start.kind !== 'checking'}
          onScan={(code) => void counting.chooseBin(code)}
        />
        </View>
        <ScanField placeholder="Bin label, for example A-01" onSubmit={(code) => void counting.chooseBin(code)} />

        {start.kind === 'checking' ? (
          <View className="flex-row items-center gap-3 px-1 py-2">
            <ActivityIndicator color={colourOf('quiet-ink')} />
            <Text className="text-base text-quiet-ink">Checking {start.code}</Text>
          </View>
        ) : null}
        {start.kind === 'create' ? (
          <Panel icon="count" title={`${start.code} isn’t a bin in ${location.name}`} body="Create it and start counting?">
            <Button label={`Create bin ${start.code}`} onPress={() => void counting.createBin(start.code)} />
            <Button label="Cancel" variant="secondary" onPress={counting.resetStart} />
          </Panel>
        ) : null}
        {start.kind === 'message' ? (
          <Panel icon="warning" title={start.title} body={start.body}>
            <Button label="OK" variant="secondary" onPress={counting.resetStart} />
          </Panel>
        ) : null}

        {counting.recent.length > 0 ? (
          <View className="mt-3">
            <ListGroup title="Counted on this phone">
              {counting.recent.map((item, index) => {
                const result = countResultText(counting.progressOf(item.stocktakeId));
                return (
                  <ListRow
                    key={item.stocktakeId}
                    label={`Bin ${item.binCode}`}
                    value={item.finishedAt ? time(item.finishedAt) : undefined}
                    detail={result.text}
                    onPress={result.problem ? () => router.navigate('/sync') : undefined}
                    last={index === counting.recent.length - 1}
                  />
                );
              })}
            </ListGroup>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function Counting({ counting }: { counting: CountingApi }) {
  const count = counting.count!;
  const progress = counting.progressOf(count.stocktakeId);

  function confirmFinish() {
    const empty = counting.lines.length === 0;
    Alert.alert(
      empty ? `Is bin ${count.binCode} empty?` : `Finish counting ${count.binCode}?`,
      empty
        ? 'Everything PartsLogic has in this bin goes back to Unbinned.'
        : `${plural(counting.lines.length, 'part', 'parts')}, ${plural(counting.units, 'unit', 'units')}. Anything not scanned goes back to Unbinned.`,
      [
        { text: 'Keep counting', style: 'cancel' },
        { text: empty ? 'Yes, it’s empty' : 'Finish', onPress: () => void counting.finish() },
      ],
    );
  }

  function confirmDiscard() {
    Alert.alert(
      'Discard this count?',
      'Nothing you scanned is kept. If PartsLogic already opened the count, it’s cancelled automatically later.',
      [
        { text: 'Keep counting', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => void counting.discard() },
      ],
    );
  }

  return (
    <Screen>
      <View className="gap-3 px-4 pb-10 pt-2">
        <View accessible className="gap-0.5 px-1">
          <Text accessibilityRole="header" className="text-lg font-semibold text-ink">
            Bin {count.binCode}
          </Text>
          <Text className="text-sm tabular-nums text-quiet-ink">
            {[count.location, 'Blind count', `started ${time(count.startedAt)}`].filter(Boolean).join(' · ')}
          </Text>
          {progress.stage === 'attention' ? (
            <Text className="text-sm text-stop-ink">Not sent: {progress.reason ?? 'PartsLogic refused it'}</Text>
          ) : null}
        </View>

        <View className="h-40 overflow-hidden rounded-plate">
          <CameraScanner onScan={(code) => void counting.scan(code)} />
        </View>
        <ScanField placeholder="Barcode or part number" onSubmit={(code) => void counting.scan(code)} />

        {counting.notice ? <Panel icon="warning" title="Not counted" body={counting.notice} /> : null}

        <Button label={counting.lines.length === 0 ? 'Bin is empty' : 'Finish count'} onPress={confirmFinish} />

        {counting.lines.length > 0 ? (
          <ListGroup title={`Counted · ${plural(counting.units, 'unit', 'units')}`}>
            {[...counting.lines].reverse().map((line, index, shown) => {
              const name = count.labels[line.code] ?? line.code;
              const unknown = counting.outcomes.get(line.clientCountId) === 'unresolved';
              return (
                <View
                  key={line.clientCountId}
                  className={cx('flex-row items-center gap-3 px-4 py-3', index < shown.length - 1 && 'border-b border-rule')}>
                  <View className="flex-1 gap-0.5">
                    <Text numberOfLines={1} className="text-base tabular-nums text-ink">
                      {name}
                    </Text>
                    {name !== line.code ? <Text className="text-sm tabular-nums text-quiet-ink">{line.code}</Text> : null}
                    {unknown ? (
                      <>
                        <Text className="text-sm text-quiet-ink">Unknown code: kept for the office to match</Text>
                        <AddPartLink code={line.code} />
                      </>
                    ) : null}
                  </View>
                  <Quantity
                    total={line.qty}
                    name={name}
                    onStep={(change) => void counting.step(line.clientCountId, change)}
                    onSet={(qty) => void counting.setQty(line.clientCountId, qty)}
                  />
                </View>
              );
            })}
          </ListGroup>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Discard this count"
          onPress={confirmDiscard}
          className="mt-4 h-12 items-center justify-center rounded-xl active:opacity-70">
          <Text className="text-base font-semibold text-stop-ink">Discard count</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
