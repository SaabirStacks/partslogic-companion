import { useState } from 'react';
import { View } from 'react-native';

import { clock, plural } from '@/lib/format';
import { Button } from '@/ui/button';
import { ConfirmSheet } from '@/ui/confirm-sheet';
import { cx } from '@/ui/cx';
import type { ChipState } from '@/ui/status-chip';
import { StatusChip } from '@/ui/status-chip';
import { Card, PressableCard } from '@/ui/surface';
import { Txt } from '@/ui/text';
import { Scroll } from '@/ui/scroll';
import { BottomBar } from '@/ui/action-bar';

import { runCountText, type RunBin, type RunProgress } from './run-progress';
import type { CountRun } from './run-store';

function chipOf(bin: RunBin): ChipState {
  if (bin.state === 'counting') return { tone: 'action', icon: 'waiting', label: 'Counting' };
  if (bin.state === 'not-started') return { tone: 'neutral', icon: 'bin', label: 'Not started' };
  return bin.units === 0 ? { tone: 'ok', icon: 'sent', label: 'Empty' } : { tone: 'ok', icon: 'sent', label: 'Counted' };
}

// The line under a bin. A bin not started says what can be done with it: counted now, or once the bin
// being counted (counting) is finished.
function detailOf(bin: RunBin, counting: string | null): string {
  if (bin.state === 'counting') return `${plural(bin.units, 'unit', 'units')} scanned so far`;
  if (bin.state === 'not-started') return counting ? `After ${counting}` : 'Tap to count';
  return plural(bin.units, 'unit', 'units');
}

// Step 2 of a run: bin by bin. How far it's got, every planned bin with where it stands, and one main
// button that is always the next thing to do: carry on with the bin being counted, start the next one, or
// finish. Pause keeps the run on the board as a Resume row. Any bin not started can be tapped to count it
// out of order, once the bin being counted is finished (one bin at a time). Finishing before every bin is
// counted asks first.
export function RunOverview({
  noun,
  run,
  progress,
  onBin,
  onPause,
  onFinish,
}: {
  noun: string;
  run: CountRun;
  progress: RunProgress;
  onBin: (bin: RunBin) => void;
  onPause: () => void;
  onFinish: () => void;
}) {
  const share = progress.total > 0 ? progress.counted / progress.total : 0;
  const next = progress.next;
  const counting = progress.bins.find((bin) => bin.state === 'counting')?.code ?? null;
  const [finishingEarly, setFinishingEarly] = useState(false);
  return (
    <View className="flex-1 bg-ground">
      <Scroll toEdge={false} contentContainerClassName="gap-3 px-4 pt-4">
        <View className="gap-1" accessible accessibilityRole="header" accessibilityLabel={`${runCountText(progress)} counted`}>
          <Txt variant="headline" className="font-extrabold">
            {runCountText(progress)}
          </Txt>
          <Txt variant="caption">{[run.locationName, `started ${clock(run.startedAt)}`].filter(Boolean).join(' · ')}</Txt>
        </View>
        <View className="h-2 overflow-hidden rounded-full bg-rule" importantForAccessibility="no">
          <View className="h-2 rounded-full bg-action" style={{ width: `${Math.round(share * 100)}%` }} />
        </View>

        <View className="gap-2">
          {progress.bins.map((bin) => {
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
            const pressable = bin.state === 'counting' || (bin.state === 'not-started' && counting === null);
            return !pressable ? (
              <Card key={bin.binId} accessible accessibilityLabel={`${bin.code}, ${chipOf(bin).label}, ${detailOf(bin, counting)}`} className={frame}>
                {face}
              </Card>
            ) : (
              <PressableCard
                key={bin.binId}
                accessibilityLabel={`${bin.code}, ${chipOf(bin).label}. ${bin.state === 'counting' ? 'Carry on' : 'Count it'}`}
                onPress={() => onBin(bin)}
                className={frame}>
                {face}
              </PressableCard>
            );
          })}
        </View>
      </Scroll>
      <BottomBar className="gap-2">
        {next ? (
          <Button label={next.state === 'counting' ? `Carry on with ${next.code}` : `Start ${next.code}`} icon="count" onPress={() => onBin(next)} />
        ) : (
          <Button label={`Finish ${noun} · ${plural(progress.units, 'unit', 'units')}`} icon="check" onPress={onFinish} />
        )}
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Button label="Pause" icon="waiting" variant="secondary" compact onPress={onPause} />
          </View>
          {next && progress.counted > 0 && next.state !== 'counting' ? (
            <View className="flex-1">
              <Button label="Finish now" variant="secondary" compact onPress={() => setFinishingEarly(true)} />
            </View>
          ) : null}
        </View>
      </BottomBar>
      <ConfirmSheet
        visible={finishingEarly}
        title={`Finish the ${noun} now?`}
        facts={[
          { value: progress.counted, label: 'counted', tone: 'ok' },
          { value: progress.total - progress.counted, label: 'not counted', tone: 'warn' },
        ]}
        note="Bins not counted keep the stock PartsLogic has for them."
        confirm={{
          label: `Finish at ${runCountText(progress)}`,
          onPress: () => {
            setFinishingEarly(false);
            onFinish();
          },
        }}
        cancelLabel="Keep counting"
        onCancel={() => setFinishingEarly(false)}
      />
    </View>
  );
}
