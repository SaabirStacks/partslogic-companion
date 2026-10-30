import { View } from 'react-native';

import type { PartAnswer } from '@/features/lookup/answer';
import { stockBreakdown, stockByBin, type StatusQty, type StockGroup } from '@/stock/statuses';
import { cx } from '@/ui/cx';
import { familyColours } from '@/ui/family';
import { Icon } from '@/ui/icon';
import type { IconName } from '@/ui/icons';
import type { Tone } from '@/ui/palette';
import { Card, PressableCard, SOFT, TONE_INK, TONE_TEXT } from '@/ui/surface';
import { Txt } from '@/ui/text';
import { Ticking } from '@/ui/ticking';

import { formatQty } from './stock';

// A bin's stock as PartsLogic sends it. status is for the day PartsLogic tags stock (src/stock/statuses.ts);
// a bin may then come once per status.
export type StockLine = { binId: number; place: string; qty: number; status?: string | null };

const GROUPS: { group: StockGroup; label: string; tone: Tone }[] = [
  { group: 'available', label: 'Available', tone: 'ok' },
  { group: 'reserved', label: 'Reserved', tone: 'warn' },
  { group: 'unavailable', label: 'Unavailable', tone: 'stop' },
];

// The outline of a box that has stock in it, in its state's strong colour.
const OUTLINE: Record<Tone, string> = { ok: 'border-ok', warn: 'border-warn', stop: 'border-stop', action: 'border-action', neutral: 'border-edge' };

const markOf = (entry: StatusQty): IconName =>
  entry.status.hold === 'locked' ? 'locked' : entry.status.hold === 'held' ? 'held' : 'reserved';

// "QA hold" keeps its capitals; "Reserved" reads "2 reserved".
const inLine = (name: string) => (/^[A-Z]{2}/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1));

// A part's stock: how much is on hand, split into three boxes (available to sell, reserved for an order,
// unavailable), then each bin holding it with Move beside it. The boxes always add up to on hand. A box
// with nothing in it stays grey, so colour only appears where there's stock to act on. Until PartsLogic
// tags stock with a status, everything on hand is available.
export function StockCard({
  answer,
  onHand,
  lines,
  nameOf,
  canMove,
  onMove,
}: {
  answer: PartAnswer;
  // PartsLogic's total, or null when the part isn't in this location's range.
  onHand: number | null;
  lines: readonly StockLine[] | null;
  nameOf: (place: string) => string;
  canMove: boolean;
  onMove: (line: StockLine) => void;
}) {
  const rows = lines ? stockByBin(lines) : [];
  const moves = canMove && rows.some((row) => row.qty > 0);
  const bin = familyColours('stock');
  // The stock level only speaks up when it needs attention (Reorder, Out of stock): a green Available
  // box already says it's in stock.
  const level = answer.tone === 'ok' ? null : answer.status;

  if (onHand === null || !lines) {
    return (
      <Card accessible accessibilityLabel={answer.status.label} className="min-h-16 flex-row items-center gap-3 px-4 py-3">
        <Icon name={answer.status.icon} size={20} colour="quiet-ink" />
        <Txt variant="label" ink="text-quiet-ink" className="flex-1 font-semibold">
          {answer.status.label}
        </Txt>
      </Card>
    );
  }

  const split = stockBreakdown(onHand, lines);

  return (
    <Card className="overflow-hidden">
      <View
        accessible
        accessibilityLabel={[`${formatQty(onHand)} on hand`, level?.label].filter(Boolean).join(', ')}
        className="flex-row items-center gap-3 px-4 pt-4">
        <View className="flex-1 flex-row items-baseline gap-2">
          <Ticking value={formatQty(onHand)} variant="headline" className="font-extrabold" />
          <Txt variant="label" ink="text-quiet-ink">
            on hand
          </Txt>
        </View>
        {level ? (
          <View className="flex-row items-center gap-1.5">
            <Icon name={level.icon} size={16} colour={TONE_INK[answer.tone]} />
            <Txt variant="caption" ink={TONE_TEXT[answer.tone]} className="font-bold">
              {level.label}
            </Txt>
          </View>
        ) : null}
      </View>

      <View className="flex-row px-2 pb-4 pt-3">
        {GROUPS.map(({ group, label, tone }) => {
          const qty = split[group];
          const kinds = split.setAside.filter((entry) => entry.status.group === group);
          // Under a box, the statuses in it, unless the only one is the box's own name.
          const detail = kinds.length === 1 && kinds[0].status.name === label ? [] : kinds;
          return <StockBox key={group} label={label} tone={qty === 0 ? 'neutral' : tone} qty={qty} detail={detail} />;
        })}
      </View>

      {rows.length === 0 ? (
        <View className="border-t border-rule px-4 py-3">
          <Txt variant="caption">Not in any bin</Txt>
        </View>
      ) : null}

      {rows.map(({ line, qty, setAside }) => (
        <View key={line.binId} className={cx('min-h-16 flex-row items-center gap-3 border-t border-rule py-2 pl-4', moves ? 'pr-2' : 'pr-4')}>
          <View className={`h-8 w-8 items-center justify-center rounded-[9px] ${bin.bg}`}>
            <Icon name="bin" size={16} colour={bin.ink} />
          </View>
          <View className="flex-1 gap-0.5">
            <Txt variant="title" numberOfLines={1}>
              {nameOf(line.place)}
            </Txt>
            {setAside.length > 0 ? (
              <Txt variant="caption" numberOfLines={2}>
                {setAside.map((entry) => `${formatQty(entry.qty)} ${inLine(entry.status.name)}`).join(' · ')}
              </Txt>
            ) : null}
          </View>
          <Txt variant="title" numbers className="font-extrabold">
            {formatQty(qty)}
          </Txt>
          {moves ? (
            qty > 0 ? (
              <PressableCard
                tone="tint"
                haptic
                accessibilityLabel={`Move stock from ${nameOf(line.place)}`}
                onPress={() => onMove(line)}
                className="h-12 w-24 flex-row items-center justify-center gap-1.5">
                <Icon name="move" size={18} colour="action-ink" />
                <Txt variant="label" ink="text-action-ink" numberOfLines={1} className="font-bold">
                  Move
                </Txt>
              </PressableCard>
            ) : (
              <View className="w-24" />
            )
          ) : null}
        </View>
      ))}
    </Card>
  );
}

// One box: the count inside, outlined in its colour when there's stock in it (the cards' 12 pt corners),
// its name under it, and the statuses that make it up under that.
function StockBox({ label, tone, qty, detail }: { label: string; tone: Tone; qty: number; detail: StatusQty[] }) {
  const active = tone !== 'neutral';
  const spoken = [`${formatQty(qty)} ${label.toLowerCase()}`, ...detail.map((entry) => `${formatQty(entry.qty)} ${inLine(entry.status.name)}`)].join(', ');
  return (
    <View accessible accessibilityLabel={spoken} className="flex-1 items-center gap-1.5 px-1">
      <View className={cx('h-[76px] w-[76px] items-center justify-center rounded-card border-2 px-1.5', active ? cx(SOFT[tone], OUTLINE[tone]) : 'border-edge bg-ground')}>
        <Ticking
          value={formatQty(qty)}
          origin="center"
          variant="headline"
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          ink={active ? TONE_TEXT[tone] : 'text-quiet-ink'}
          className="font-extrabold"
        />
      </View>
      <Txt variant="caption" ink={active ? 'text-ink' : 'text-quiet-ink'} numberOfLines={1} className="font-semibold">
        {label}
      </Txt>
      {detail.map((entry) => (
        <View key={entry.status.code} className="max-w-full flex-row items-center gap-1">
          <Icon name={markOf(entry)} size={12} colour={TONE_INK[tone]} />
          <Txt variant="caption" numberOfLines={1} className="shrink text-[13px] leading-[17px]">
            {`${entry.status.name} ${formatQty(entry.qty)}`}
          </Txt>
        </View>
      ))}
    </View>
  );
}
