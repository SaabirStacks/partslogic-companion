import { Pressable, View } from 'react-native';

import { BinChip } from '@/ui/bin-chip';
import { Icon } from '@/ui/icon';
import { LineRow } from '@/ui/line-row';
import { SectionLabel } from '@/ui/section-label';
import { Txt } from '@/ui/text';
import { binLabel } from '@/vendor/partslogic/shared/sales/picking';
import { quantityWords } from '@/vendor/partslogic/shared/sales/words';

import { done, left, pickable, picked, type JobRow } from './job';
import { countOf, partName, rowState } from './words';

// The job's rows under the bin they're in, in walking order: the bins still to visit first, then what's picked,
// then rows with no bin on the books, which need a count before they can be picked.
export function PickRows({ rows, onRow }: { rows: JobRow[]; onRow: (row: JobRow) => void }) {
  const toPick = rows.filter((row) => pickable(row) && !done(row));
  const finished = rows.filter((row) => pickable(row) && done(row));
  const noBin = rows.filter((row) => !pickable(row));
  return (
    <>
      {groupByBin(toPick).map(([bin, group]) => (
        <View key={bin} className="gap-2">
          <View className="flex-row">
            <BinChip code={binLabel(bin)} />
          </View>
          {group.map((row) => (
            <Row key={row.key} row={row} onMenu={() => onRow(row)} />
          ))}
        </View>
      ))}
      {finished.length > 0 ? (
        <View className="gap-2">
          <SectionLabel>Picked</SectionLabel>
          {finished.map((row) => (
            <Row key={row.key} row={row} />
          ))}
        </View>
      ) : null}
      {noBin.length > 0 ? (
        <View className="gap-2">
          <SectionLabel>Count first</SectionLabel>
          {noBin.map((row) => (
            <Row key={row.key} row={row} />
          ))}
        </View>
      ) : null}
    </>
  );
}

function groupByBin(rows: JobRow[]): [string, JobRow[]][] {
  const groups = new Map<string, JobRow[]>();
  for (const row of rows) groups.set(row.bin ?? '', [...(groups.get(row.bin ?? '') ?? []), row]);
  return [...groups.entries()];
}

const STATE_ICON = { ok: 'sent', warn: 'warning', neutral: 'keyboard' } as const;

// One row: the part, the order it goes with, where it stands, and "1 of 2". A row still to pick opens its menu
// (Can't scan, Short pick) from its count.
function Row({ row, onMenu }: { row: JobRow; onMenu?: () => void }) {
  const state = rowState(row);
  const count = (
    <View className="items-end">
      <Txt variant="headline" numbers className="font-extrabold">
        {quantityWords(picked(row))}
      </Txt>
      <Txt variant="caption" numbers numberOfLines={1}>
        {`of ${quantityWords(row.want)}`}
      </Txt>
    </View>
  );
  return (
    <LineRow
      name={partName(row)}
      code={row.urgent ? `${row.order} · Urgent` : row.order}
      status={state ? { text: state.text, tone: state.tone, icon: STATE_ICON[state.tone] } : null}
      quantity={
        onMenu && left(row) > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${partName(row)}, ${countOf(row)} for ${row.order}. Can’t scan or short pick`}
            onPress={onMenu}
            hitSlop={8}
            className="min-h-12 flex-row items-center gap-2 active:opacity-60">
            {count}
            <Icon name="more" size={22} colour="action-ink" />
          </Pressable>
        ) : (
          count
        )
      }
    />
  );
}
