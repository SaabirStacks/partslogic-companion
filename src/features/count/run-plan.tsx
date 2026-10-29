import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { binsUnder } from '@/features/bins/bin-steps';
import { BinTiles } from '@/features/bins/bin-tiles';
import { BIN_VIEWS, useBinBrowse } from '@/features/bins/use-bin-browse';
import { useStepBack } from '@/features/bins/use-step-back';
import { clock, plural } from '@/lib/format';
import { ActionBar } from '@/ui/action-bar';
import { Button } from '@/ui/button';
import { Choice } from '@/ui/choice';
import { SectionLabel } from '@/ui/section-label';
import { Segmented } from '@/ui/segmented';
import { StatusStrip } from '@/ui/status-strip';
import { Txt } from '@/ui/text';
import { useColour } from '@/ui/theme';
import { Scroll } from '@/ui/scroll';

import { countedShort, countedText, type BinChoice } from './bin-choices';
import type { RunWorkflow } from './count-store';
import { planBins, type RunPlan } from './run-progress';
import type { RunBinPlan } from './run-store';

const KINDS: readonly { value: RunWorkflow; label: string }[] = [
  { value: 'stock-take', label: 'Stock take' },
  { value: 'opening-stock', label: 'Opening stock' },
];

type BinList = { choices: BinChoice[]; loading: boolean; failed: boolean; savedAt: string | null; reload: () => void };

// Step 1 of a stock take: which bins (the whole location, a hand-picked set such as an aisle or a few
// shelves, which Tab view can choose a whole aisle or shelf at a time, or only bins never counted), and
// whether it's a stock take or opening stock. Opening stock is setting a location up, done once, so it's
// asked here rather than having a tile, and only until the location's opening stock is done
// (openingOffered). initial is the one asked for.
export function RunPlanView({
  initial,
  openingOffered = true,
  locationName,
  list,
  onStart,
}: {
  initial: RunWorkflow;
  openingOffered?: boolean;
  locationName: string;
  list: BinList;
  onStart: (bins: RunBinPlan[], as: RunWorkflow) => void;
}) {
  const colourOf = useColour();
  const [asked, setKind] = useState<RunWorkflow>(initial);
  const kind: RunWorkflow = openingOffered ? asked : 'stock-take';
  const noun = kind === 'opening-stock' ? 'opening stock' : 'stock take';
  const [plan, setPlan] = useState<RunPlan>('every');
  const [chosen, setChosen] = useState<ReadonlySet<number>>(new Set());
  const bins = planBins(plan, list.choices, chosen);
  const never = planBins('never', list.choices, chosen).length;

  const browse = useBinBrowse();
  useStepBack(plan === 'choose' && browse.inStep ? browse.back : null);

  const toggle = (binId: number) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(binId)) next.delete(binId);
      else next.add(binId);
      return next;
    });
  // Chooses (or clears) every bin in an aisle or shelf at once.
  const setAll = (binIds: number[], on: boolean) =>
    setChosen((current) => {
      const next = new Set(current);
      for (const binId of binIds) {
        if (on) next.add(binId);
        else next.delete(binId);
      }
      return next;
    });
  const under = binsUnder(list.choices, browse.path).map((bin) => bin.binId);
  const allUnder = under.length > 0 && under.every((binId) => chosen.has(binId));
  const place = browse.path.join('-');

  return (
    <View className="flex-1 bg-ground">
      <Scroll toEdge={false} contentContainerClassName="gap-3 px-4 pt-4">
        {openingOffered ? <Segmented options={KINDS} value={kind} onChange={setKind} /> : null}
        {kind === 'opening-stock' ? (
          <StatusStrip tone="warn" icon="opening" text={`Setting up ${locationName}: what’s found becomes its opening stock`} />
        ) : null}
        <Txt accessibilityRole="header" variant="headline" className="font-extrabold">
          Which bins?
        </Txt>
        {list.savedAt ? <StatusStrip tone="warn" icon="offline" text={`No signal · bins saved ${clock(list.savedAt)}`} /> : null}
        {list.failed && list.choices.length === 0 ? (
          <>
            <StatusStrip tone="stop" icon="offline" text="Bins didn’t load" />
            <Button label="Try again" icon="retry" variant="secondary" onPress={list.reload} />
          </>
        ) : null}
        {list.loading ? (
          <View className="py-4">
            <ActivityIndicator color={colourOf('quiet-ink')} />
          </View>
        ) : null}

        <View className="gap-2" accessibilityRole="radiogroup">
          <Choice
            title={`Every bin in ${locationName}`}
            detail={plural(list.choices.length, 'bin', 'bins')}
            selected={plan === 'every'}
            onPress={() => setPlan('every')}
          />
          <Choice title="Choose bins" detail="An aisle or a few shelves" selected={plan === 'choose'} onPress={() => setPlan('choose')} />
          <Choice
            title="Never counted"
            detail={plural(never, 'bin', 'bins')}
            selected={plan === 'never'}
            onPress={() => setPlan('never')}
          />
        </View>

        {plan === 'choose' ? (
          <>
            <SectionLabel>{`${chosen.size} chosen`}</SectionLabel>
            <Segmented options={BIN_VIEWS} value={browse.view} onChange={browse.setView} />
            {browse.view === 'tabs' && list.choices.length > 0 ? (
              <BinTiles
                bins={list.choices}
                path={browse.path}
                onPath={browse.setPath}
                onBin={(bin) => toggle(bin.binId)}
                chosen={chosen}
                detail={(bin) => countedShort(bin.lastCounted)}
                action={
                  browse.path.length > 0 && under.length > 1 ? (
                    <Button
                      label={allUnder ? `Clear the ${under.length} in ${place}` : `Choose all ${under.length} in ${place}`}
                      icon={allUnder ? 'close' : 'check'}
                      variant="secondary"
                      compact
                      onPress={() => setAll(under, !allUnder)}
                    />
                  ) : null
                }
              />
            ) : (
              <View className="gap-2">
                {list.choices.map((bin) => (
                  <Choice
                    key={bin.binId}
                    title={bin.code}
                    detail={countedText(bin.lastCounted)}
                    selected={chosen.has(bin.binId)}
                    onPress={() => toggle(bin.binId)}
                  />
                ))}
              </View>
            )}
          </>
        ) : null}
      </Scroll>
      <ActionBar
        label={
          bins.length > 0
            ? `Start ${noun} · ${plural(bins.length, 'bin', 'bins')}`
            : plan === 'choose'
              ? 'Choose the bins'
              : 'No bins to count'
        }
        icon={bins.length > 0 ? 'count' : undefined}
        disabled={bins.length === 0}
        onPress={() => onStart(bins, kind)}
      />
    </View>
  );
}
