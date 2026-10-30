import { View } from 'react-native';

import type { PartAnswer } from '@/features/lookup/answer';
import { cx } from '@/ui/cx';
import { familyColours } from '@/ui/family';
import { Icon } from '@/ui/icon';
import { Card, PressableCard, SOFT, TONE_INK, TONE_TEXT } from '@/ui/surface';
import { Txt } from '@/ui/text';
import { Ticking } from '@/ui/ticking';

import { formatQty } from './stock';

export type StockLine = { binId: number; place: string; qty: number };

// The Move button's width, kept on every row (and on the On hand row) so the numbers line up in one column.
const MOVE_SLOT = 'w-24';

// A part's stock as a short stock sheet. On hand heads it, on its state's soft colour, with the state in
// words under it; then each bin holding it, with Move beside it. Every number sits in one column, so the
// total reads as the sum of the bins under it.
export function StockCard({
  answer,
  lines,
  nameOf,
  canMove,
  onMove,
}: {
  answer: PartAnswer;
  // Null when the part isn't in this location's range: there's nothing to list.
  lines: readonly StockLine[] | null;
  nameOf: (place: string) => string;
  canMove: boolean;
  onMove: (line: StockLine) => void;
}) {
  const moves = canMove && !!lines?.some((line) => line.qty > 0);
  const counted = answer.onHand !== null;
  const bin = familyColours('stock');

  return (
    <Card className="overflow-hidden">
      <View
        accessible
        accessibilityLabel={counted ? `On hand ${answer.onHand}, ${answer.status.label}` : answer.status.label}
        className={cx('min-h-[72px] flex-row items-center gap-3 py-3 pl-4', moves ? 'pr-2' : 'pr-4', SOFT[answer.tone])}>
        <View className="h-8 w-8 items-center justify-center">
          <Icon name={answer.status.icon} size={22} colour={TONE_INK[answer.tone]} />
        </View>
        <View className="flex-1 gap-0.5">
          <Txt variant="title" numberOfLines={1}>
            {counted ? 'On hand' : answer.status.label}
          </Txt>
          {counted ? (
            <Txt variant="caption" ink={TONE_TEXT[answer.tone]} numberOfLines={1} className="font-semibold">
              {answer.status.label}
            </Txt>
          ) : null}
        </View>
        {counted ? <Ticking value={answer.onHand ?? ''} origin="right bottom" variant="headline" ink={TONE_TEXT[answer.tone]} className="font-extrabold" /> : null}
        {moves ? <View className={MOVE_SLOT} /> : null}
      </View>

      {lines && lines.length === 0 ? (
        <View className="border-t border-rule px-4 py-3">
          <Txt variant="caption">Not in any bin</Txt>
        </View>
      ) : null}

      {lines?.map((line) => (
        <View key={line.binId} className={cx('min-h-16 flex-row items-center gap-3 border-t border-rule py-2 pl-4', moves ? 'pr-2' : 'pr-4')}>
          <View className={`h-8 w-8 items-center justify-center rounded-[9px] ${bin.bg}`}>
            <Icon name="bin" size={16} colour={bin.ink} />
          </View>
          <Txt variant="title" numberOfLines={1} className="flex-1">
            {nameOf(line.place)}
          </Txt>
          <Txt variant="title" numbers className="font-extrabold">
            {formatQty(line.qty)}
          </Txt>
          {moves ? (
            line.qty > 0 ? (
              <PressableCard
                tone="tint"
                haptic
                accessibilityLabel={`Move stock from ${nameOf(line.place)}`}
                onPress={() => onMove(line)}
                className={cx(MOVE_SLOT, 'h-12 flex-row items-center justify-center gap-1.5')}>
                <Icon name="move" size={18} colour="action-ink" />
                <Txt variant="label" ink="text-action-ink" numberOfLines={1} className="font-bold">
                  Move
                </Txt>
              </PressableCard>
            ) : (
              <View className={MOVE_SLOT} />
            )
          ) : null}
        </View>
      ))}
    </Card>
  );
}
