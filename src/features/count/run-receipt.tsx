import { ScrollView, View } from 'react-native';

import { clock, plural } from '@/lib/format';
import { Button } from '@/ui/button';
import { StatusChip } from '@/ui/status-chip';
import { Card } from '@/ui/surface';
import { Txt } from '@/ui/text';

import type { RunProgress } from './run-progress';
import type { CountRun } from './run-store';

// Step 3 of a run: a receipt like a delivery's. How many bins and units, and anything for the office to
// check (a count that needs review or didn't go through).
export function RunReceipt({
  title,
  run,
  progress,
  toCheck,
  onDone,
}: {
  // "Stock take", "Opening stock".
  title: string;
  run: CountRun;
  progress: RunProgress;
  toCheck: number;
  onDone: () => void;
}) {
  const span = run.finishedAt ? `${clock(run.startedAt)}–${clock(run.finishedAt)}` : clock(run.startedAt);
  const rows: [string, string][] = [
    ['Bins counted', `${progress.counted} of ${progress.total}`],
    ['Units counted', String(progress.units)],
    ...(toCheck > 0 ? ([['For the office to check', String(toCheck)]] as [string, string][]) : []),
  ];
  return (
    <View className="flex-1 bg-ground">
      <ScrollView contentContainerClassName="flex-grow justify-center gap-4 px-4 py-6">
        <Card accessible accessibilityLabel={`${title} done. ${plural(progress.counted, 'bin', 'bins')}, ${plural(progress.units, 'unit', 'units')}`} className="gap-4 p-5">
          <View className="items-center gap-2">
            <StatusChip tone={toCheck > 0 ? 'warn' : 'ok'} icon={toCheck > 0 ? 'warning' : 'sent'} label={toCheck > 0 ? `${title} done · to check` : `${title} done`} />
            <Txt accessibilityRole="header" variant="display" className="text-center">
              {plural(progress.counted, 'bin', 'bins')}
            </Txt>
            <Txt variant="caption" numbers className="text-center">
              {[run.locationName, span].filter(Boolean).join(' · ')}
            </Txt>
          </View>
          <View className="border-t border-rule pt-1">
            {rows.map(([label, value]) => (
              <View key={label} className="min-h-11 flex-row items-center justify-between gap-3">
                <Txt variant="body" numberOfLines={1} className="flex-1">
                  {label}
                </Txt>
                <Txt variant="label" numbers className="font-extrabold">
                  {value}
                </Txt>
              </View>
            ))}
          </View>
        </Card>
      </ScrollView>
      <View className="px-4 pb-6">
        <Button label="Done" icon="check" onPress={onDone} />
      </View>
    </View>
  );
}
