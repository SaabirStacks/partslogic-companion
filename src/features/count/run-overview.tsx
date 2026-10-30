import { useState, type ReactNode } from 'react';
import { FlatList, View } from 'react-native';

import { binsUnder } from '@/features/bins/bin-steps';
import { BinTiles } from '@/features/bins/bin-tiles';
import { BIN_VIEWS, type useBinBrowse } from '@/features/bins/use-bin-browse';
import { useStepBack } from '@/features/bins/use-step-back';
import { clock, plural, when } from '@/lib/format';
import { BottomBar } from '@/ui/action-bar';
import { Button } from '@/ui/button';
import { ConfirmSheet } from '@/ui/confirm-sheet';
import { cx } from '@/ui/cx';
import { Segmented } from '@/ui/segmented';
import type { ChipState } from '@/ui/status-chip';
import { StatusChip } from '@/ui/status-chip';
import { StatusStrip } from '@/ui/status-strip';
import { Card, PressableCard } from '@/ui/surface';
import { Txt } from '@/ui/text';

import type { BinChoice } from './bin-choices';
import { peopleText, runCountText, type RunBin, type RunProgress } from './run-progress';
import type { CountRun } from './run-store';

// A run small enough to read as one list doesn't offer Tab view.
const TILES_FROM = 13;

function chipOf(bin: RunBin): ChipState {
  if (bin.state === 'counting') return { tone: 'action', icon: 'waiting', label: 'Counting' };
  if (bin.state === 'taken') return { tone: 'neutral', icon: 'account', label: 'Taken' };
  if (bin.state === 'not-started') return { tone: 'neutral', icon: 'bin', label: 'Not started' };
  return bin.units === 0 ? { tone: 'ok', icon: 'sent', label: 'Empty' } : { tone: 'ok', icon: 'sent', label: 'Counted' };
}

// The line under a bin. A bin not started says what can be done with it: counted now, or once the bin
// being counted (counting) is finished.
function detailOf(bin: RunBin, counting: string | null): string {
  if (bin.state === 'counting') return `${plural(bin.units, 'unit', 'units')} scanned so far`;
  if (bin.state === 'taken') return `${bin.by ?? 'Someone'} is counting it`;
  if (bin.state === 'not-started') return counting ? `After ${counting}` : 'Tap to count';
  return [plural(bin.units, 'unit', 'units'), bin.by].filter(Boolean).join(' · ');
}

// What a bin's tile says under its name, in a word or two.
function tileDetail(bin: RunBin): string {
  if (bin.state === 'counting') return 'Counting';
  if (bin.state === 'taken') return `${bin.by ?? 'Someone'} has it`;
  if (bin.state === 'not-started') return 'To count';
  return bin.by ?? plural(bin.units, 'unit', 'units');
}

// A bin can be tapped to carry on with it, or to count it when nothing else is being counted here. One
// someone else is counting, or that's counted, can't.
const canTap = (bin: RunBin, counting: string | null, closed: boolean) =>
  !closed && (bin.state === 'counting' || (bin.state === 'not-started' && counting === null));

// Step 2 of a run: bin by bin. How far it's got, every planned bin with where it stands, and one main
// button that is always the next thing to do: carry on with the bin being counted, start the next one, or
// finish. Pause keeps the run on the board as a Resume row. Any bin not started can be tapped to count it
// out of order, once the bin being counted is finished (one bin at a time); a big run offers Tab view to
// go to an aisle, and then the next bin offered is the next one there. browse (Tab view or List view, and
// the aisle) is kept by the screen, so it's where it was after each bin. Finishing before every bin is
// counted asks first.
// A shared run (run.shared) shows the others too: who has counted each bin and who is counting one now
// (taken, one person per bin). Finishing it ends it for everyone, or leaves it to the others; once someone
// finishes it, it can only be closed.
export function RunOverview({
  noun,
  run,
  progress,
  browse,
  online,
  busy = false,
  notice,
  onBin,
  onPause,
  onFinish,
}: {
  noun: string;
  run: CountRun;
  progress: RunProgress;
  browse: ReturnType<typeof useBinBrowse>;
  online: boolean;
  busy?: boolean;
  // Above the bins: why a bin didn't start, or what happened when the run started.
  notice?: ReactNode;
  onBin: (bin: RunBin) => void;
  onPause: () => void;
  onFinish: (how: 'everyone' | 'here') => void;
}) {
  const share = progress.total > 0 ? progress.counted / progress.total : 0;
  const counting = progress.bins.find((bin) => bin.state === 'counting')?.code ?? null;
  const closed = progress.closed !== null;
  const [finishingEarly, setFinishingEarly] = useState(false);
  const tiles = progress.total >= TILES_FROM && browse.view === 'tabs';
  useStepBack(tiles && browse.inStep ? browse.back : null);

  const byId = new Map(progress.bins.map((bin) => [bin.binId, bin]));
  const asChoices: BinChoice[] = progress.bins.map((bin) => ({ binId: bin.binId, code: bin.code, description: null, units: bin.units, lastCounted: null }));
  // In an aisle (or shelf) in Tab view, the next bin is the next one there while it has one left.
  const here = tiles && browse.path.length > 0 ? new Set(binsUnder(asChoices, browse.path).map((bin) => bin.binId)) : null;
  const next =
    (progress.next?.state === 'counting' ? progress.next : null) ??
    (here ? progress.bins.find((bin) => bin.state === 'not-started' && here.has(bin.binId)) : undefined) ??
    progress.next;
  const counted = new Set(progress.bins.filter((bin) => bin.state === 'counted').map((bin) => bin.binId));
  const tap = (bin: RunBin) => {
    if (canTap(bin, counting, closed)) onBin(bin);
  };

  const started = [`Started ${when(run.startedAt)}`, run.startedBy ? `by ${run.startedBy}` : null].filter(Boolean).join(' · ');
  const left = progress.total - progress.counted;

  const header = (
    <View className="gap-3 pb-1">
      <View className="gap-1" accessible accessibilityRole="header" accessibilityLabel={`${runCountText(progress)} counted`}>
        <Txt variant="headline" className="font-extrabold">
          {runCountText(progress)}
        </Txt>
        <Txt variant="caption">{started}</Txt>
        {progress.others.length > 0 ? <Txt variant="caption">{`Counting with ${peopleText(progress.others)}`}</Txt> : null}
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-rule" importantForAccessibility="no">
        <View className="h-2 rounded-full bg-action" style={{ width: `${Math.round(share * 100)}%` }} />
      </View>
      {progress.closed ? (
        <StatusStrip
          tone="neutral"
          icon="stockTake"
          text={[`${progress.closed.by ?? 'Someone'} finished this ${noun}`, progress.closed.at ? clock(progress.closed.at) : null].filter(Boolean).join(' · ')}
        />
      ) : null}
      {run.shared && !online ? (
        <StatusStrip tone="warn" icon="offline" text={run.statusAt ? `No signal · the others’ bins as of ${clock(run.statusAt)}` : 'No signal · the others’ bins aren’t known yet'} />
      ) : null}
      {notice}
      {progress.total >= TILES_FROM ? <Segmented options={BIN_VIEWS} value={browse.view} onChange={browse.setView} /> : null}
      {tiles ? (
        <BinTiles
          bins={asChoices}
          path={browse.path}
          onPath={browse.setPath}
          onBin={(choice) => {
            const bin = byId.get(choice.binId);
            if (bin) tap(bin);
          }}
          chosen={counted}
          marks="counted"
          detail={(choice) => {
            const bin = byId.get(choice.binId);
            return bin ? tileDetail(bin) : null;
          }}
        />
      ) : null}
    </View>
  );

  return (
    <View className="flex-1 bg-ground">
      <FlatList
        style={{ flex: 1 }}
        data={tiles ? [] : progress.bins}
        keyExtractor={(bin) => String(bin.binId)}
        ListHeaderComponent={header}
        initialNumToRender={20}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, gap: 8 }}
        renderItem={({ item: bin }) => {
          const face = (
            <>
              <View className="flex-1 gap-0.5">
                <Txt variant="title" numberOfLines={1} className="font-extrabold">
                  {bin.code}
                </Txt>
                <Txt variant="caption" numberOfLines={1}>
                  {detailOf(bin, counting)}
                </Txt>
              </View>
              <StatusChip {...chipOf(bin)} />
            </>
          );
          const frame = cx('min-h-16 flex-row items-center gap-3 px-4 py-2.5', bin.state === 'counting' && 'border-2 border-ink');
          return !canTap(bin, counting, closed) ? (
            <Card accessible accessibilityLabel={`${bin.code}, ${chipOf(bin).label}, ${detailOf(bin, counting)}`} className={frame}>
              {face}
            </Card>
          ) : (
            <PressableCard
              accessibilityLabel={`${bin.code}, ${chipOf(bin).label}. ${bin.state === 'counting' ? 'Carry on' : 'Count it'}`}
              onPress={() => onBin(bin)}
              className={frame}>
              {face}
            </PressableCard>
          );
        }}
      />
      <BottomBar className="gap-2">
        <MainButton noun={noun} run={run} progress={progress} next={next} online={online} busy={busy} onBin={onBin} onFinish={onFinish} />
        {/* Once someone finished it there's only Close. */}
        {closed ? null : (
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button label="Pause" icon="waiting" variant="tinted" compact onPress={onPause} />
            </View>
            {progress.counted > 0 && left > 0 && next?.state !== 'counting' ? (
              <View className="flex-1">
                <Button label="Finish now" variant="tinted" compact onPress={() => setFinishingEarly(true)} />
              </View>
            ) : run.shared && progress.done && online ? (
              // In case finishing it for everyone can't get through: whoever has signal can finish it.
              <View className="flex-1">
                <Button label="Leave it open" variant="secondary" compact onPress={() => onFinish('here')} />
              </View>
            ) : null}
          </View>
        )}
      </BottomBar>
      <ConfirmSheet
        visible={finishingEarly}
        title={`Finish the ${noun} now?`}
        facts={[
          { value: progress.counted, label: 'counted', tone: 'ok' },
          { value: left, label: 'not counted', tone: 'warn' },
        ]}
        note={
          run.shared
            ? `Bins not counted keep the stock PartsLogic has for them. Finishing ends it for everyone counting it; leaving it lets the others carry on.`
            : 'Bins not counted keep the stock PartsLogic has for them.'
        }
        confirm={{
          label: run.shared ? `Finish for everyone at ${runCountText(progress)}` : `Finish at ${runCountText(progress)}`,
          onPress: () => {
            setFinishingEarly(false);
            onFinish('everyone');
          },
        }}
        alternative={
          run.shared
            ? {
                label: 'Leave it to the others',
                onPress: () => {
                  setFinishingEarly(false);
                  onFinish('here');
                },
              }
            : null
        }
        cancelLabel="Keep counting"
        onCancel={() => setFinishingEarly(false)}
      />
    </View>
  );
}

// The one thing to do next: carry on with the bin being counted, start the next one nobody has, finish, or
// (shared) close one someone else finished, or leave the last bins to the others counting them.
function MainButton({
  noun,
  run,
  progress,
  next,
  online,
  busy,
  onBin,
  onFinish,
}: {
  noun: string;
  run: CountRun;
  progress: RunProgress;
  next: RunBin | null;
  online: boolean;
  busy: boolean;
  onBin: (bin: RunBin) => void;
  onFinish: (how: 'everyone' | 'here') => void;
}) {
  const units = plural(progress.units, 'unit', 'units');
  if (progress.closed) return <Button label={`Close the ${noun}`} icon="check" onPress={() => onFinish('here')} />;
  if (next) {
    return <Button label={next.state === 'counting' ? `Carry on with ${next.code}` : `Start ${next.code}`} icon="count" busy={busy} onPress={() => onBin(next)} />;
  }
  if (progress.done) {
    // Every bin is counted; a shared run then ends for everyone, which needs signal. Without it this phone
    // can still put it away and leave the finishing to whoever has signal.
    if (run.shared && !online) return <Button label={`Leave it · ${units}`} icon="check" onPress={() => onFinish('here')} />;
    return <Button label={`Finish ${noun} · ${units}`} icon="check" busy={busy} onPress={() => onFinish('everyone')} />;
  }
  // Every bin left is being counted by someone else.
  const counting = [...new Set(progress.bins.flatMap((bin) => (bin.state === 'taken' && bin.by ? [bin.by] : [])))];
  return <Button label={`Leave the rest to ${peopleText(counting) || 'the others'}`} icon="check" onPress={() => onFinish('here')} />;
}
