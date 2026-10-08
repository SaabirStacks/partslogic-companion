import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { countResultText, countSummary } from '@/features/count/result-text';
import { useBinCount } from '@/features/count/use-bin-count';
import { NeedsLocation } from '@/features/location/needs-location';
import { AddPartLink } from '@/features/quick-add/add-part-link';
import { clock, plural } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useRemote } from '@/lib/use-remote';
import { useWorkingLocation } from '@/session/location-provider';
import { ActionBar } from '@/ui/action-bar';
import { Button } from '@/ui/button';
import { ConfirmSheet } from '@/ui/confirm-sheet';
import { Icon } from '@/ui/icon';
import { JobBanner } from '@/ui/job-banner';
import { JobScreen } from '@/ui/job-screen';
import { LineRow } from '@/ui/line-row';
import { ON_TONE, Plate, PressablePlate, TEXT_ON } from '@/ui/plate';
import { Quantity } from '@/ui/quantity';
import { ScanResultCard } from '@/ui/scan-result-card';
import { SectionLabel } from '@/ui/section-label';
import { Detail, SignText } from '@/ui/sign-text';
import { StatusStrip } from '@/ui/status-strip';
import { Tally } from '@/ui/tally';
import { unlocatedStockSummary } from '@/vendor/partslogic/shared/floor';

type Counting = ReturnType<typeof useBinCount>;

// Put away & count: scan a bin and its code locks in, then scan every part on the shelf, blind. Finishing
// pulls what was counted out of Unbinned onto the shelf and sends anything not scanned back to Unbinned.
export default function Count() {
  const counting = useBinCount();
  const params = useLocalSearchParams<{ binId?: string; bin?: string; location?: string }>();
  const { begin, loaded, count } = counting;
  // The "Count this bin" request already acted on, so a re-render can't start it twice.
  const handled = useRef<string | null>(null);

  // "Count bin" from Look up.
  useEffect(() => {
    const binId = Number(params.binId);
    if (!loaded || count || !Number.isInteger(binId) || binId <= 0 || !params.bin) return;
    if (handled.current === params.binId) return;
    handled.current = params.binId!;
    router.setParams({ binId: undefined, bin: undefined, location: undefined });
    void Promise.resolve().then(() => begin({ binId, binCode: params.bin!, location: params.location ?? null }));
  }, [loaded, count, params.binId, params.bin, params.location, begin]);

  if (!loaded) return <View className="flex-1 bg-ground" />;
  if (counting.finished && !count) return <Result counting={counting} />;
  return count ? <CountingBin counting={counting} /> : <Start counting={counting} />;
}

function Start({ counting }: { counting: Counting }) {
  const { location } = useWorkingLocation();
  // Read the id here, not inside the loader: the React Compiler reads what a callback uses while the screen
  // renders, so `location!.id` in the callback crashed before a location was chosen.
  const locationId = location?.id ?? null;
  const unbinned = useRemote(locationId !== null && counting.online ? `unbinned:${locationId}` : null, () =>
    unlocatedStockSummary(supabase, locationId),
  );
  const { start } = counting;

  if (!location) return <NeedsLocation />;

  return (
    <JobScreen
      placeholder="Bin label, for example A-01"
      scanEnabled={start.kind !== 'checking'}
      onScan={(code) => void counting.chooseBin(code)}
      banner={<JobBanner title="Scan a bin label" detail={location.name} />}
      result={<StartAnswer counting={counting} locationName={location.name} />}>
      {unbinned.data && unbinned.data.parts > 0 ? (
        <Tally
          items={[
            { value: unbinned.data.qty, label: 'Unbinned units', tone: 'warning' },
            { value: unbinned.data.parts, label: 'Parts' },
          ]}
        />
      ) : null}
      {counting.recent.length > 0 ? (
        <>
          <SectionLabel>Counted on this phone</SectionLabel>
          {counting.recent.map((item) => {
            const result = countResultText(counting.progressOf(item.stocktakeId));
            const face = (
              <>
                <View className="flex-1">
                  <SignText size="label" weight="heavy">{`Bin ${item.binCode}`}</SignText>
                  <Detail ink={result.problem ? 'text-stop-ink' : 'text-quiet-ink'} numberOfLines={2}>
                    {result.text}
                  </Detail>
                </View>
                {item.finishedAt ? <Detail>{clock(item.finishedAt)}</Detail> : null}
              </>
            );
            return result.problem ? (
              <PressablePlate
                key={item.stocktakeId}
                tone="surface"
                accessibilityLabel={`Bin ${item.binCode}, ${result.text}. Open Sync`}
                onPress={() => router.navigate('/sync')}
                className="min-h-16 flex-row items-center gap-3 px-3 py-2">
                {face}
                <Icon name="forward" size={16} />
              </PressablePlate>
            ) : (
              <Plate key={item.stocktakeId} className="min-h-16 flex-row items-center gap-3 px-3 py-2">
                {face}
              </Plate>
            );
          })}
        </>
      ) : null}
    </JobScreen>
  );
}

function StartAnswer({ counting, locationName }: { counting: Counting; locationName: string }) {
  const { start } = counting;
  switch (start.kind) {
    case 'checking':
      return <ScanResultCard tone="surface" status={{ icon: 'waiting', label: 'Checking' }} title={start.code} />;
    case 'create':
      return (
        <ScanResultCard key={start.code} tone="warning" status={{ icon: 'bin', label: `Not a bin in ${locationName}` }} title={start.code}>
          <Button label={`Create bin ${start.code}`} icon="plus" compact onPress={() => void counting.createBin(start.code)} />
          <Button label="Cancel" variant="secondary" compact onPress={counting.resetStart} />
        </ScanResultCard>
      );
    case 'message':
      return (
        <ScanResultCard key={start.title} tone="warning" status={{ icon: 'warning', label: 'Not started' }} title={start.title} detail={start.body}>
          <Button label="OK" variant="secondary" compact onPress={counting.resetStart} />
        </ScanResultCard>
      );
    default:
      return null;
  }
}

function CountingBin({ counting }: { counting: Counting }) {
  const count = counting.count!;
  const progress = counting.progressOf(count.stocktakeId);
  const [confirming, setConfirming] = useState<'finish' | 'discard' | null>(null);
  const empty = counting.lines.length === 0;

  return (
    <>
      <JobScreen
        placeholder="Barcode or part number"
        onScan={(code) => void counting.scan(code)}
        banner={<JobBanner size="display" title={`Bin ${count.binCode}`} detail={[count.location, 'Blind count'].filter(Boolean).join(' · ')} />}
        result={<LastScan counting={counting} />}
        action={
          <ActionBar
            label={empty ? 'Bin is empty' : `Finish · ${plural(counting.units, 'unit', 'units')}`}
            icon="check"
            onPress={() => setConfirming('finish')}
            secondary={{ label: 'Discard this count', icon: 'close', onPress: () => setConfirming('discard') }}
          />
        }>
        {progress.stage === 'attention' ? (
          <StatusStrip tone="stop" icon="stop" text={progress.reason ? `Not sent · ${progress.reason}` : 'Not sent'} />
        ) : null}
        <Tally
          items={[
            { value: counting.units, label: 'Units' },
            { value: counting.lines.length, label: 'Parts' },
          ]}
        />
        {[...counting.lines].reverse().map((line) => {
          const name = count.labels[line.code] ?? line.code;
          const unknown = counting.outcomes.get(line.clientCountId) === 'unresolved';
          return (
            <LineRow
              key={line.clientCountId}
              name={name}
              code={name !== line.code ? line.code : null}
              status={unknown ? { text: 'Unknown · kept for the office', icon: 'warning', tone: 'warning' } : null}
              quantity={
                <Quantity
                  total={line.qty}
                  name={name}
                  onStep={(change) => void counting.step(line.clientCountId, change)}
                  onSet={(qty) => void counting.setQty(line.clientCountId, qty)}
                />
              }>
              {unknown ? <AddPartLink code={line.code} /> : null}
            </LineRow>
          );
        })}
      </JobScreen>
      <ConfirmSheet
        visible={confirming === 'finish'}
        title={empty ? `Is bin ${count.binCode} empty?` : `Finish bin ${count.binCode}?`}
        facts={
          empty
            ? undefined
            : [
                { value: counting.units, label: 'Units' },
                { value: counting.lines.length, label: 'Parts' },
              ]
        }
        note={empty ? 'Everything PartsLogic has in it goes back to Unbinned.' : 'Anything not scanned goes back to Unbinned.'}
        confirm={{
          label: empty ? 'Yes, it’s empty' : `Finish · ${plural(counting.units, 'unit', 'units')}`,
          onPress: () => {
            setConfirming(null);
            void counting.finish();
          },
        }}
        cancelLabel="Keep counting"
        onCancel={() => setConfirming(null)}
      />
      <ConfirmSheet
        visible={confirming === 'discard'}
        title="Discard this count?"
        note="Nothing scanned is kept."
        confirm={{
          label: 'Discard',
          destructive: true,
          onPress: () => {
            setConfirming(null);
            void counting.discard();
          },
        }}
        cancelLabel="Keep counting"
        onCancel={() => setConfirming(null)}
      />
    </>
  );
}

// The plate for the scan that just landed: the part and how many of it are counted now.
function LastScan({ counting }: { counting: Counting }) {
  const { notice, lastScan, count } = counting;
  if (notice) {
    return <ScanResultCard key={notice.detail} tone="warning" status={{ icon: 'bin', label: 'Not counted' }} title={notice.title} detail={notice.detail} />;
  }
  if (!lastScan || !count) return null;
  const line = counting.lines.find((candidate) => candidate.code === lastScan.code);
  if (!line) return null;
  const name = count.labels[line.code] ?? line.code;
  const unknown = counting.outcomes.get(line.clientCountId) === 'unresolved' || !count.labels[line.code];
  return (
    <ScanResultCard
      key={lastScan.key}
      tone={unknown ? 'warning' : 'safe'}
      status={unknown ? { icon: 'warning', label: 'Counted · unknown code' } : { icon: 'sent', label: 'Counted' }}
      title={name}
      detail={name !== line.code ? line.code : null}
      quantity={{ value: String(line.qty), label: 'Counted' }}
    />
  );
}

// After Finish: what the count did, in big numbers, filling in as PartsLogic answers.
function Result({ counting }: { counting: Counting }) {
  const finished = counting.finished!;
  const summary = countSummary(counting.progressOf(finished.stocktakeId));
  return (
    <ScrollView className="bg-ground" contentContainerClassName="flex-grow justify-center gap-4 px-4 py-8">
      <Plate tone={summary.tone} heavy className="gap-2 p-4">
        <View className="flex-row items-center gap-2">
          <Icon name={summary.icon} size={20} colour={ON_TONE[summary.tone]} />
          <SignText size="label" ink={TEXT_ON[summary.tone]} numberOfLines={2} className="flex-1">
            {summary.label}
          </SignText>
        </View>
        <SignText accessibilityRole="header" size="hero" weight="heavy" ink={TEXT_ON[summary.tone]}>
          {`Bin ${finished.binCode}`}
        </SignText>
      </Plate>
      <Tally items={summary.items.length > 0 ? summary.items : [{ value: finished.units, label: 'Counted' }]} />
      <Button label="Count next bin" icon="count" onPress={counting.dismissFinished} />
      <Button label="Board" variant="secondary" onPress={() => router.dismissTo('/')} />
    </ScrollView>
  );
}
