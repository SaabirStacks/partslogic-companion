import { Fragment, type ReactNode } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import type { BinChoice } from '@/features/count/bin-choices';
import { formatQty } from '@/features/part/stock';
import { plural } from '@/lib/format';
import { cx } from '@/ui/cx';
import { Icon } from '@/ui/icon';
import { PressableCard } from '@/ui/surface';
import { Txt } from '@/ui/text';

import { binStep, type StepAsk, type StepTile } from './bin-steps';

const GAP = 8;
// The screens it sits in keep 16 px either side.
const GUTTERS = 32;

const ASK: Record<StepAsk, { prompt: string; tile: string }> = {
  aisle: { prompt: 'Choose the aisle', tile: 'Aisle' },
  letter: { prompt: 'Choose the letter', tile: 'Letter' },
  number: { prompt: 'Choose the number', tile: 'Number' },
  part: { prompt: 'Choose the next part', tile: '' },
};

// Tab view: a location's bins as big square tiles, a part of the name at a time (aisle, then letter,
// then number). The name so far sits on top ("02-B-?"); tapping a part of it, or Back, goes back to
// change it. A tile says how many bins are under it, or for the last part what's known about that bin.
//  - held: green "Has 4" where the part already is, so it can be followed to its bin.
//  - chosen: for choosing several bins (a stock take), a tick and outline on what's chosen, and
//    "4 of 10" on a tile part chosen. marks says what the tick means: chosen (tiles are checkboxes), or
//    counted (a stock take's bins as it goes, which are tapped to count).
export function BinTiles({
  bins,
  path,
  onPath,
  onBin,
  held,
  chosen,
  marks = 'chosen',
  detail,
  action,
}: {
  bins: readonly BinChoice[];
  path: string[];
  onPath: (path: string[]) => void;
  // A tile that is one bin was tapped.
  onBin: (bin: BinChoice) => void;
  held?: ReadonlyMap<number, number>;
  chosen?: ReadonlySet<number>;
  marks?: 'chosen' | 'counted';
  // What a bin's own tile says under its number ("3 Oct").
  detail?: (bin: BinChoice) => string | null;
  // Goes between the name and the tiles ("Choose all 10 in 02-B").
  action?: ReactNode;
}) {
  const step = binStep(bins, path);
  const { width, fontScale } = useWindowDimensions();
  const columns = width >= 600 ? 6 : fontScale > 1.3 ? 3 : 4;
  const size = Math.floor((width - GUTTERS - GAP * (columns - 1)) / columns);
  const asking = step.shown.indexOf('?');

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-3">
        {path.length > 0 ? (
          <PressableCard
            accessibilityLabel="Back a step"
            onPress={() => onPath(path.slice(0, -1))}
            className="h-12 w-12 items-center justify-center rounded-[10px]">
            <Icon name="back" size={20} />
          </PressableCard>
        ) : null}
        <View className="flex-1 gap-0.5">
          <View className="flex-row flex-wrap items-center">
            {step.shown.map((part, i) => (
              <Fragment key={i}>
                {i > 0 ? <Unspoken text="-" ink="text-quiet-ink" /> : null}
                {i < path.length ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Change ${part}`}
                    hitSlop={8}
                    onPress={() => onPath(path.slice(0, i))}>
                    <Txt variant="headline" className="font-extrabold">
                      {part}
                    </Txt>
                  </Pressable>
                ) : (
                  <Unspoken text="?" ink={i === asking ? 'text-action-ink' : 'text-quiet-ink'} />
                )}
              </Fragment>
            ))}
          </View>
          {/* The screen's title already counts them all; inside an aisle, how many are left to choose from. */}
          <Txt variant="caption">
            {path.length > 0 ? `${ASK[step.ask].prompt} · ${plural(step.count, 'bin', 'bins')}` : ASK[step.ask].prompt}
          </Txt>
        </View>
      </View>

      {action}

      <View className="flex-row flex-wrap" style={{ gap: GAP }}>
        {step.tiles.map((tile) => (
          <Tile
            key={tile.key}
            tile={tile}
            word={ASK[step.ask].tile}
            size={size}
            held={held}
            chosen={chosen}
            marks={marks}
            detail={detail}
            onPress={() => (tile.bin ? onBin(tile.bin) : onPath(tile.path))}
          />
        ))}
      </View>
      {step.tiles.length === 0 ? (
        <Txt variant="caption" className="px-1">
          No bins here
        </Txt>
      ) : null}
    </View>
  );
}

// The name's dashes and question marks: seen, not read out (the line under them says what to choose).
function Unspoken({ text, ink }: { text: string; ink: string }) {
  return (
    <Txt variant="headline" ink={ink} accessible={false} importantForAccessibility="no" className="font-extrabold">
      {text}
    </Txt>
  );
}

function Tile({
  tile,
  word,
  size,
  held,
  chosen,
  marks,
  detail,
  onPress,
}: {
  tile: StepTile;
  word: string;
  size: number;
  held?: ReadonlyMap<number, number>;
  chosen?: ReadonlySet<number>;
  marks: 'chosen' | 'counted';
  detail?: (bin: BinChoice) => string | null;
  onPress: () => void;
}) {
  const total = tile.bins.length;
  const has = held ? tile.bins.reduce((sum, bin) => sum + (held.get(bin.binId) ?? 0), 0) : 0;
  const picked = chosen ? tile.bins.filter((bin) => chosen.has(bin.binId)).length : 0;
  const all = picked > 0 && picked === total;
  const caption =
    has > 0
      ? `Has ${formatQty(has)}`
      : tile.bin
        ? (detail?.(tile.bin) ?? null)
        : picked > 0
          ? all
            ? `All ${total}`
            : `${picked} of ${total}`
          : plural(total, 'bin', 'bins');
  const spoken = tile.bin
    ? [`Bin ${tile.bin.code}`, caption].filter(Boolean).join(', ')
    : [
        `${word} ${tile.label}`.trim(),
        plural(total, 'bin', 'bins'),
        has > 0 ? `has ${formatQty(has)} of the part` : null,
        picked > 0 ? `${picked} ${marks}` : null,
      ]
        .filter(Boolean)
        .join(', ');
  const choosing = chosen != null && tile.bin != null && marks === 'chosen';

  return (
    <View style={{ width: size, minHeight: size }}>
      <PressableCard
        haptic
        accessibilityRole={choosing ? 'checkbox' : 'button'}
        accessibilityState={choosing ? { checked: all } : undefined}
        accessibilityLabel={spoken}
        onPress={onPress}
        className={cx('flex-1 items-center justify-center gap-0.5 px-1.5 py-2', all && 'border-2 border-ink')}>
        {all ? (
          // On the corner, clear of the number.
          <View className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full border-2 border-ground bg-ink">
            <Icon name="check" size={12} colour="surface" />
          </View>
        ) : null}
        <Txt
          variant={tile.label.length <= 3 ? 'headline' : 'title'}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          className="font-extrabold">
          {tile.label}
        </Txt>
        {caption ? (
          <Txt
            variant="caption"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            ink={has > 0 ? 'text-ok-ink' : undefined}
            className={cx('text-[13px] leading-[17px]', has > 0 && 'font-semibold')}>
            {caption}
          </Txt>
        ) : null}
      </PressableCard>
    </View>
  );
}
