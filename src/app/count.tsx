import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { countWorkflow, type CountWorkflow } from '@/features/count/count-store';
import { CountReceipt } from '@/features/count/count-receipt';
import { countResultText, countSummary } from '@/features/count/result-text';
import { useBinCount } from '@/features/count/use-bin-count';
import { useBinChoices } from '@/features/count/use-bin-choices';
import { WhichBinView } from '@/features/count/which-bin';
import { NeedsLocation } from '@/features/location/needs-location';
import { AddPartLink } from '@/features/quick-add/add-part-link';
import { clock, plural } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useRemote } from '@/lib/use-remote';
import { useWorkingLocation } from '@/session/location-provider';
import { ActionBar } from '@/ui/action-bar';
import { Button } from '@/ui/button';
import { ConfirmScanCard } from '@/ui/confirm-scan-card';
import { ConfirmSheet } from '@/ui/confirm-sheet';
import { Icon } from '@/ui/icon';
import { JobBanner } from '@/ui/job-banner';
import { JobScreen } from '@/ui/job-screen';
import { LineRow } from '@/ui/line-row';
import { Card, PressableCard } from '@/ui/surface';
import { Quantity } from '@/ui/quantity';
import { ScanResultCard } from '@/ui/scan-result-card';
import { SectionLabel } from '@/ui/section-label';
import { Txt } from '@/ui/text';
import { StatusStrip } from '@/ui/status-strip';
import { Tally } from '@/ui/tally';
import { unlocatedStockSummary } from '@/vendor/partslogic/shared/floor';
import { liveWorkflow } from '@/workflows/catalogue';

type Counting = ReturnType<typeof useBinCount>;

// Put away and Stock count, one screen: choose a bin and it locks in, then scan every part on the shelf,
// blind. Finishing pulls what was counted out of Unbinned onto the shelf and sends anything not scanned back
// to Unbinned. purpose says which workflow the board opened; a count left open keeps its own.
export default function Count() {
  const params = useLocalSearchParams<{ purpose?: string; binId?: string; bin?: string; location?: string }>();
  const counting = useBinCount(countWorkflow(params.purpose));
  const { begin, loaded, count } = counting;
  const title = liveWorkflow(count?.workflow ?? countWorkflow(params.purpose)).label.toUpperCase();
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
  return (
    <>
      <Stack.Screen options={{ title }} />
      {counting.finished && !count ? (
        <Result counting={counting} />
      ) : count ? (
        <CountingBin counting={counting} />
      ) : (
        <Start counting={counting} purpose={countWorkflow(params.purpose)} />
      )}
    </>
  );
}

function Start({ counting, purpose }: { counting: Counting; purpose: CountWorkflow }) {
  const { location } = useWorkingLocation();
  // Read the id here, not inside the loader: the React Compiler reads what a callback uses while the screen
  // renders, so `location!.id` in the callback crashed before a location was chosen.
  const locationId = location?.id ?? null;
  const bins = useBinChoices(locationId);
  // Putting away starts from what's waiting in Unbinned, so it shows how much is there.
  const unbinned = useRemote(purpose === 'put-away' && locationId !== null && counting.online ? `unbinned:${locationId}` : null, () =>
    unlocatedStockSummary(supabase, locationId),
  );

  if (!location) return <NeedsLocation />;

  return (
    <WhichBinView
      list={bins}
      online={counting.online}
      waiting={unbinned.data ? { units: unbinned.data.qty, location: location.name } : null}
      onChoose={(bin) => void counting.begin({ binId: bin.binId, binCode: bin.code, location: location.code })}
      onCreate={(code) => void counting.createBin(code)}
      notice={<StartAnswer counting={counting} locationName={location.name} />}
      footer={<CountedHere counting={counting} />}
    />
  );
}

// Counts finished on this phone, so a problem with one is a tap from Sync.
function CountedHere({ counting }: { counting: Counting }) {
  if (counting.recent.length === 0) return null;
  return (
    <>
      <SectionLabel>Counted on this phone</SectionLabel>
      {counting.recent.map((item) => {
        const result = countResultText(counting.progressOf(item.stocktakeId));
        const face = (
          <>
            <View className="flex-1">
              <Txt variant="label" className="font-bold">{`Bin ${item.binCode}`}</Txt>
              <Txt variant="caption" ink={result.problem ? 'text-stop-ink' : 'text-quiet-ink'} numberOfLines={2}>
                {result.text}
              </Txt>
            </View>
            {item.finishedAt ? <Txt variant="caption">{clock(item.finishedAt)}</Txt> : null}
          </>
        );
        return result.problem ? (
          <PressableCard
            key={item.stocktakeId}
            accessibilityLabel={`Bin ${item.binCode}, ${result.text}. Open Sync`}
            onPress={() => router.navigate('/sync')}
            className="min-h-16 flex-row items-center gap-3 px-4 py-2">
            {face}
            <Icon name="forward" size={16} colour="quiet-ink" />
          </PressableCard>
        ) : (
          <Card key={item.stocktakeId} className="min-h-16 flex-row items-center gap-3 px-4 py-2">
            {face}
          </Card>
        );
      })}
    </>
  );
}

function StartAnswer({ counting, locationName }: { counting: Counting; locationName: string }) {
  const { start } = counting;
  switch (start.kind) {
    case 'checking':
      return <ScanResultCard tone="neutral" status={{ icon: 'waiting', label: 'Checking' }} title={start.code} />;
    case 'message':
      return (
        <ScanResultCard key={start.title} tone="warn" status={{ icon: 'warning', label: 'Not started' }} title={start.title} detail={start.body}>
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
        scanEnabled={!counting.held.pending}
        onScan={counting.scan}
        banner={<JobBanner size="headline" title={`Bin ${count.binCode}`} detail={[count.location, 'Blind count'].filter(Boolean).join(' · ')} />}
        result={<LastScan counting={counting} />}
        action={
          // While a scan waits on Count or Skip, it's the only decision on screen.
          counting.held.pending ? null : (
            <ActionBar
              label={empty ? 'Bin is empty' : `Finish · ${plural(counting.units, 'unit', 'units')}`}
              icon="check"
              onPress={() => setConfirming('finish')}
              secondary={{ label: 'Discard this count', icon: 'close', onPress: () => setConfirming('discard') }}
            />
          )
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
              status={unknown ? { text: 'Unknown · kept for the office', icon: 'warning', tone: 'warn' } : null}
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

// The card over the camera's edge: the scan being held for a decision, or else the part just counted and
// how many of it are counted now.
function LastScan({ counting }: { counting: Counting }) {
  const { held, lastScan, count } = counting;
  if (held.pending) {
    return (
      <ConfirmScanCard
        pending={held.pending}
        verb="Count"
        onConfirm={() => void counting.confirm()}
        onSkip={held.clear}
        onStep={held.step}
        onSet={held.setQty}
        onRetry={() => void held.retry()}
        addPart={<AddPartLink code={held.pending.code} />}
      />
    );
  }
  if (!lastScan || !count) return null;
  const line = counting.lines.find((candidate) => candidate.code === lastScan.code);
  if (!line) return null;
  const name = count.labels[line.code] ?? line.code;
  const unknown = counting.outcomes.get(line.clientCountId) === 'unresolved' || !count.labels[line.code];
  return (
    <ScanResultCard
      key={lastScan.key}
      tone={unknown ? 'warn' : 'ok'}
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
      <CountReceipt binCode={finished.binCode} summary={summary} units={finished.units} />
      <Button label="Count next bin" icon="count" onPress={counting.dismissFinished} />
      <Button label="Board" variant="secondary" onPress={() => router.dismissTo('/')} />
    </ScrollView>
  );
}
