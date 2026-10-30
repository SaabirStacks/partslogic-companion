import { View } from 'react-native';

import { clock, plural } from '@/lib/format';
import { Button } from '@/ui/button';
import { ReceiptCard } from '@/ui/receipt';
import { StatusStrip } from '@/ui/status-strip';
import { Card } from '@/ui/surface';
import { Txt } from '@/ui/text';
import { Scroll } from '@/ui/scroll';
import { BottomBar } from '@/ui/action-bar';

import type { RunProgress } from './run-progress';
import type { RunEnd } from './use-count-run';
import type { CountRun } from './run-store';

// The question after opening stock: is the location fully set up? Yes marks its opening stock done, so it
// isn't offered there again; Not yet leaves it open for another run (a big location goes aisle by aisle).
export type SetUpQuestion = {
  location: string;
  answer: 'ask' | 'yes' | 'not-yet';
  onYes: () => void;
  onNotYet: () => void;
};

// Step 3 of a run: a receipt like a delivery's. How many bins and units, and anything for the office to
// check (a count that needs review or didn't go through). After opening stock it asks setUp.
// A shared run's totals are everyone's, with this phone's own bins as "You counted"; end says how it ended
// (left to the others, it stays open for them).
export function RunReceipt({
  title,
  run,
  progress,
  end = 'alone',
  toCheck,
  setUp,
  onDone,
}: {
  // "Stock take", "Opening stock".
  title: string;
  run: CountRun;
  progress: RunProgress;
  end?: RunEnd;
  toCheck: number;
  setUp?: SetUpQuestion | null;
  onDone: () => void;
}) {
  const span = run.finishedAt ? `${clock(run.startedAt)}–${clock(run.finishedAt)}` : clock(run.startedAt);
  const left = end === 'left';
  const rows: [string, string][] = [
    ['Bins counted', `${progress.counted} of ${progress.total}`],
    ...(end === 'alone' ? [] : ([['You counted', plural(progress.mine, 'bin', 'bins')]] as [string, string][])),
    ['Units counted', String(progress.units)],
    ...(toCheck > 0 ? ([['For the office to check', String(toCheck)]] as [string, string][]) : []),
  ];
  return (
    <View className="flex-1 bg-ground">
      <Scroll toEdge={setUp?.answer === 'ask'} contentContainerClassName="flex-grow justify-center gap-4 px-4 pt-6">
        <ReceiptCard
          chip={{
            tone: toCheck > 0 ? 'warn' : left ? 'neutral' : 'ok',
            icon: toCheck > 0 ? 'warning' : left ? 'account' : 'sent',
            label: [left ? 'Left to the others' : 'Finished', toCheck > 0 ? 'to check' : null].filter(Boolean).join(' · '),
          }}
          reference={plural(progress.counted, 'bin', 'bins')}
          line={span}
          rows={rows.map(([label, value]) => ({ label, value, tone: label.startsWith('For the office') ? 'warn' : undefined }))}
          accessibilityLabel={`${title} ${left ? 'left to the others' : 'finished'}. ${plural(progress.counted, 'bin', 'bins')}, ${plural(progress.units, 'unit', 'units')}`}
        />
        {left ? <StatusStrip tone="neutral" icon="stockTake" text={`The ${title.toLowerCase()} stays open for the others to finish`} /> : null}
        {setUp?.answer === 'ask' ? (
          <Card className="gap-3 p-4">
            <View className="gap-1">
              <Txt variant="title" className="font-extrabold">Is this location fully set up?</Txt>
              <Txt variant="caption">Yes, and opening stock won’t be offered here again. Not yet, and you can set up the rest another time.</Txt>
            </View>
            <Button label="Yes, it’s set up" icon="check" onPress={setUp.onYes} />
            <Button label="Not yet" variant="secondary" onPress={setUp.onNotYet} />
          </Card>
        ) : setUp?.answer === 'yes' ? (
          <StatusStrip tone="ok" icon="sent" text="Set up · opening stock is done" />
        ) : setUp?.answer === 'not-yet' ? (
          <StatusStrip tone="neutral" icon="opening" text="Opening stock stays open for another run" />
        ) : null}
      </Scroll>
      {/* While the set-up question waits, its answer is the way on (Not yet is the way out). */}
      {setUp?.answer === 'ask' ? null : (
        <BottomBar>
          <Button label="Done" icon="check" onPress={onDone} />
        </BottomBar>
      )}
    </View>
  );
}
