import { View } from 'react-native';

import { plural } from '@/lib/format';
import { BottomBar } from '@/ui/action-bar';
import { Button } from '@/ui/button';
import { Card } from '@/ui/surface';
import { Scroll } from '@/ui/scroll';
import { StatusChip, type ChipState } from '@/ui/status-chip';
import { StatusStrip } from '@/ui/status-strip';
import { Tally } from '@/ui/tally';
import { Txt } from '@/ui/text';
import type { DeliveryCheckRow } from '@/vendor/partslogic/shared/purchasing';

import { checkCounts, checkText } from './open-orders';

const VERDICT: Record<DeliveryCheckRow['verdict'], ChipState> = {
  matched: { tone: 'ok', icon: 'check', label: 'OK' },
  short: { tone: 'warn', icon: 'warning', label: 'Short' },
  over: { tone: 'warn', icon: 'warning', label: 'Over' },
  not_ordered: { tone: 'warn', icon: 'warning', label: 'Not ordered' },
  not_arrived: { tone: 'neutral', icon: 'waiting', label: 'Not here' },
};

// Done, before Finish: what was counted against what the supplier's open orders still have due. Short, over and
// not-ordered lines come first. Parts for a job say who they're for, so they're put aside rather than shelved.
// Recount goes back to scanning; Finish books the delivery as counted.
export function DeliveryCheck({
  supplier,
  rows,
  units,
  unknown,
  savedAt,
  onRecount,
  onFinish,
}: {
  supplier: string;
  rows: DeliveryCheckRow[];
  units: number;
  unknown: number;
  // When the open orders were saved, if they came from the phone's copy (no signal).
  savedAt: string | null;
  onRecount: () => void;
  onFinish: () => void;
}) {
  const counts = checkCounts(rows);
  const differences = counts.short + counts.over + counts.notOrdered;
  return (
    <View className="flex-1 bg-ground">
      <Scroll toEdge={false} contentContainerClassName="gap-3 px-4 pt-4">
        <Txt accessibilityRole="header" variant="headline" className="font-extrabold">
          Check the delivery
        </Txt>
        <Txt variant="caption">
          {differences === 0
            ? `Everything counted matches what ${supplier} has due.`
            : `${plural(differences, 'line differs', 'lines differ')} from what ${supplier} has due. Recount, or finish as counted.`}
        </Txt>
        <Tally
          items={[
            { value: counts.matched, label: 'OK', tone: counts.matched > 0 ? 'ok' : undefined },
            { value: counts.short, label: 'Short', tone: counts.short > 0 ? 'warn' : undefined },
            { value: counts.over + counts.notOrdered, label: 'Over', tone: counts.over + counts.notOrdered > 0 ? 'warn' : undefined },
          ]}
        />
        {savedAt ? <StatusStrip tone="warn" icon="offline" text="No signal · compared with the orders saved when the delivery started" /> : null}
        {unknown > 0 ? <StatusStrip tone="neutral" icon="warning" text={`${plural(unknown, 'unknown code isn’t', 'unknown codes aren’t')} compared · the office matches them`} /> : null}
        {rows.map((row) => (
          <Card key={row.partId} className="gap-1.5 px-4 py-3">
            <View className="flex-row items-center gap-3">
              <View className="flex-1 gap-0.5">
                <Txt variant="label" numberOfLines={2} className="font-bold">
                  {[row.brand, row.partNumber].filter(Boolean).join(' ')}
                </Txt>
                <Txt variant="caption">{checkText(row)}</Txt>
              </View>
              <StatusChip {...VERDICT[row.verdict]} />
            </View>
            {row.references.length > 0 && row.counted > 0 ? (
              <Txt variant="caption" ink="text-ink" className="font-semibold">
                For {row.references.join(', ')} · put aside
              </Txt>
            ) : null}
          </Card>
        ))}
      </Scroll>
      <BottomBar className="gap-2">
        <Button label={`Finish · ${plural(units, 'unit', 'units')}`} icon="check" onPress={onFinish} />
        <Button label="Recount" icon="barcode" variant="tinted" onPress={onRecount} />
      </BottomBar>
    </View>
  );
}
