import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { countWorkflow, isRunWorkflow, type CountWorkflow, type RunWorkflow } from '@/features/count/count-store';
import { RunOverview } from '@/features/count/run-overview';
import { RunPlanView } from '@/features/count/run-plan';
import { runCountText } from '@/features/count/run-progress';
import { RunReceipt, type SetUpQuestion } from '@/features/count/run-receipt';
import { useCountRun, useJoinableRuns, type RunNotice } from '@/features/count/use-count-run';
import { useOpeningStock } from '@/features/count/use-opening-stock';
import { CountReceipt } from '@/features/count/count-receipt';
import { countResultText, countSummary } from '@/features/count/result-text';
import { useBinCount } from '@/features/count/use-bin-count';
import { useBinChoices } from '@/features/count/use-bin-choices';
import { WhichBinView } from '@/features/count/which-bin';
import { useBinBrowse } from '@/features/bins/use-bin-browse';
import { NeedsLocation } from '@/features/location/needs-location';
import { AddPartLink } from '@/features/quick-add/add-part-link';
import { plural, when } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useRemote } from '@/lib/use-remote';
import { useWorkingLocation } from '@/session/location-provider';
import { ActionBar, BottomBar } from '@/ui/action-bar';
import { Button } from '@/ui/button';
import { ConfirmScanCard } from '@/ui/confirm-scan-card';
import { ConfirmSheet } from '@/ui/confirm-sheet';
import { Icon } from '@/ui/icon';
import { JobBanner } from '@/ui/job-banner';
import { JobScreen } from '@/ui/job-screen';
import { LineRow } from '@/ui/line-row';
import { APPEAR } from '@/ui/motion';
import { Card, PressableCard } from '@/ui/surface';
import { Quantity } from '@/ui/quantity';
import { ScanResultCard } from '@/ui/scan-result-card';
import { SectionLabel } from '@/ui/section-label';
import { Txt } from '@/ui/text';
import { StatusStrip } from '@/ui/status-strip';
import { Tally } from '@/ui/tally';
import { Scroll } from '@/ui/scroll';
import { unlocatedStockSummary } from '@/vendor/partslogic/shared/floor';
import { liveWorkflow } from '@/workflows/catalogue';

type Counting = ReturnType<typeof useBinCount>;

// Every bin count, one screen: Put away and Stock count choose a bin and it locks in, then scan every part
// on the shelf, blind. Finishing pulls what was counted out of Unbinned onto the shelf and sends anything
// not scanned back to Unbinned. Stock take and Opening stock are a planned run of such counts (RunFlow).
// purpose says which workflow the board opened; a count left open keeps its own.
export default function Count() {
  const params = useLocalSearchParams<{ purpose?: string; binId?: string; bin?: string; location?: string }>();
  const counting = useBinCount(countWorkflow(params.purpose));
  const { begin, loaded, count } = counting;
  const workflow = count?.workflow ?? countWorkflow(params.purpose);
  const title = liveWorkflow(workflow).label;
  // The "Count this bin" request already acted on, so a re-render can't start it twice.
  const handled = useRef<string | null>(null);

  // "Count bin" from Look up, or a shelf from what's waiting to put away.
  useEffect(() => {
    // Once the request is cleared it's forgotten, so the same bin can be asked for again later.
    if (!params.binId) {
      handled.current = null;
      return;
    }
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
      {/* A run names its screen itself: Stock take can open an opening-stock run. */}
      {isRunWorkflow(workflow) ? null : <Stack.Screen options={{ title }} />}
      {isRunWorkflow(workflow) ? (
        <RunFlow workflow={workflow} counting={counting} />
      ) : counting.finished && !count ? (
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
      onWaiting={purpose === 'put-away' ? () => router.push('/waiting') : undefined}
      notice={<StartAnswer counting={counting} />}
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
            {item.finishedAt ? <Txt variant="caption">{when(item.finishedAt)}</Txt> : null}
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

function StartAnswer({ counting }: { counting: Counting }) {
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

// A stock take or opening stock: plan the bins, then count them one by one (each bin is the same blind
// count as below, carrying the run's id), pause and resume from the board, and finish with a receipt.
function RunFlow({ workflow, counting }: { workflow: RunWorkflow; counting: Counting }) {
  const { location } = useWorkingLocation();
  const [overview, setOverview] = useState(false);
  // Tab view or List view of the run's bins, and the aisle, kept while bins are counted one after another.
  const browse = useBinBrowse();
  // Read again whenever one of the run's counts starts, moves on or finishes, or a bin was refused (someone
  // else has it). The others' bins are asked for while the bin list is on screen.
  const runFlow = useCountRun(
    workflow,
    `${counting.count?.stocktakeId ?? ''}:${counting.units}:${counting.recent.length}:${counting.start.kind}`,
    overview || !counting.count,
  );
  const planning = runFlow.loaded && !runFlow.run;
  const bins = useBinChoices(planning ? (location?.id ?? null) : null);
  const joinable = useJoinableRuns(planning && !runFlow.finished ? (location?.id ?? null) : null, runFlow.online);
  const opening = useOpeningStock(location?.id ?? null);
  // The answer to "Is the location fully set up?" after opening stock.
  const [setUp, setSetUp] = useState<SetUpQuestion['answer']>('ask');
  // Named for the run on screen (or finished), else for the job asked for.
  const shown = runFlow.finished?.run.workflow ?? runFlow.run?.workflow ?? workflow;
  const label = liveWorkflow(shown).label;
  const noun = label.toLowerCase();

  return (
    <>
      <Stack.Screen options={{ title: runFlow.run || runFlow.finished ? label : liveWorkflow('stock-take').label }} />
      <RunStep
        runFlow={runFlow}
        counting={counting}
        workflow={workflow}
        label={label}
        noun={noun}
        bins={bins}
        joinable={joinable}
        browse={browse}
        overview={overview}
        setOverview={setOverview}
        openingOffered={!opening.done}
        setUp={
          // Asked only where PartsLogic records it and the location isn't done already, and not of someone
          // leaving the rest to the others.
          runFlow.finished?.run.workflow === 'opening-stock' && runFlow.finished.end !== 'left' && opening.known && (!opening.done || setUp === 'yes') && location
            ? {
                location: location.name,
                answer: setUp,
                onYes: () => {
                  setSetUp('yes');
                  void opening.markDone();
                },
                onNotYet: () => setSetUp('not-yet'),
              }
            : null
        }
      />
    </>
  );
}

function RunStep({
  runFlow,
  counting,
  workflow,
  label,
  noun,
  bins,
  joinable,
  browse,
  overview,
  setOverview,
  openingOffered,
  setUp,
}: {
  runFlow: ReturnType<typeof useCountRun>;
  counting: Counting;
  workflow: RunWorkflow;
  label: string;
  noun: string;
  bins: ReturnType<typeof useBinChoices>;
  joinable: ReturnType<typeof useJoinableRuns>;
  browse: ReturnType<typeof useBinBrowse>;
  overview: boolean;
  setOverview: (shown: boolean) => void;
  openingOffered: boolean;
  setUp: SetUpQuestion | null;
}) {
  const { location } = useWorkingLocation();
  if (!runFlow.loaded) return <View className="flex-1 bg-ground" />;

  if (runFlow.finished) {
    const { run, progress, end } = runFlow.finished;
    const toCheck = progress.bins.filter((bin) => {
      if (!bin.stocktakeId) return false;
      const sent = counting.progressOf(bin.stocktakeId);
      return sent.stage === 'attention' || (sent.stage === 'done' && (sent.result.needsReview || sent.result.partial));
    }).length;
    return (
      <RunReceipt
        title={label}
        run={run}
        progress={progress}
        end={end}
        toCheck={toCheck}
        setUp={setUp}
        onDone={() => {
          runFlow.dismissFinished();
          router.dismissTo('/');
        }}
      />
    );
  }

  const run = runFlow.run;
  if (!run) {
    if (!location) return <NeedsLocation />;
    return (
      <RunPlanView
        initial={workflow}
        openingOffered={openingOffered}
        list={bins}
        joinable={joinable}
        busy={runFlow.busy}
        notice={<RunNoticeStrip notice={runFlow.notice} />}
        onJoin={(shared) => void runFlow.join(shared)}
        onStart={(planned, as) => void runFlow.start(planned, as)}
      />
    );
  }

  const progress = runFlow.progress!;
  if (counting.count && counting.count.runId === run.runId && !overview) {
    return <CountingBin counting={counting} run={{ text: `${label} · ${runCountText(progress)}`, onOverview: () => setOverview(true) }} />;
  }
  return (
    <RunOverview
      noun={noun}
      run={run}
      progress={progress}
      browse={browse}
      online={runFlow.online}
      busy={runFlow.busy || counting.start.kind === 'checking'}
      notice={
        <>
          <RunNoticeStrip notice={runFlow.notice} />
          {location ? <StartAnswer counting={counting} /> : null}
        </>
      }
      onBin={(bin) => {
        if (bin.state === 'counting') {
          setOverview(false);
          return;
        }
        void counting.begin({ binId: bin.binId, binCode: bin.code, location: location?.code ?? null }, run.runId, run.workflow).then((started) => {
          if (started) setOverview(false);
        });
      }}
      onPause={() => router.back()}
      onFinish={(how) => void runFlow.finish(how)}
    />
  );
}

// What happened when a run started, joined or tried to finish.
function RunNoticeStrip({ notice }: { notice: RunNotice | null }) {
  if (!notice) return null;
  const icon = notice.text.startsWith('No signal')
    ? 'offline'
    : notice.tone === 'ok'
      ? 'sent'
      : notice.tone === 'neutral'
        ? 'stockTake'
        : notice.tone === 'warn'
          ? 'warning'
          : 'stop';
  // News about the run (someone joined, it was finished) fades in when it arrives.
  return (
    <Animated.View key={notice.text} entering={APPEAR}>
      <StatusStrip tone={notice.tone} icon={icon} text={notice.text} />
    </Animated.View>
  );
}

function CountingBin({ counting, run }: { counting: Counting; run?: { text: string; onOverview: () => void } }) {
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
        banner={<JobBanner size="headline" family={liveWorkflow(count.workflow).family} title={`Bin ${count.binCode}`} detail={[run?.text, 'Blind count'].filter(Boolean).join(' · ')} />}
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
        {run ? <Button label="All bins" icon="stockTake" variant="tinted" compact onPress={run.onOverview} /> : null}
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
    <View className="flex-1 bg-ground">
      <Scroll toEdge={false} contentContainerClassName="flex-grow justify-center gap-4 px-4 pt-6">
        <CountReceipt binCode={finished.binCode} summary={summary} units={finished.units} />
      </Scroll>
      <BottomBar className="gap-2">
        <Button label="Count next bin" icon="count" onPress={counting.dismissFinished} />
        <Button label="Board" variant="secondary" onPress={() => router.dismissTo('/')} />
      </BottomBar>
    </View>
  );
}
