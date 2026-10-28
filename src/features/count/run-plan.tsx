import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { clock, plural } from '@/lib/format';
import { ActionBar } from '@/ui/action-bar';
import { Button } from '@/ui/button';
import { Choice } from '@/ui/choice';
import { SectionLabel } from '@/ui/section-label';
import { Segmented } from '@/ui/segmented';
import { StatusStrip } from '@/ui/status-strip';
import { Txt } from '@/ui/text';
import { useColour } from '@/ui/theme';

import { countedText, type BinChoice } from './bin-choices';
import type { RunWorkflow } from './count-store';
import { planBins, type RunPlan } from './run-progress';
import type { RunBinPlan } from './run-store';

const KINDS: readonly { value: RunWorkflow; label: string }[] = [
  { value: 'stock-take', label: 'Stock take' },
  { value: 'opening-stock', label: 'Opening stock' },
];

type BinList = { choices: BinChoice[]; loading: boolean; failed: boolean; savedAt: string | null; reload: () => void };

// Step 1 of a stock take: which bins (the whole location, a hand-picked set such as an aisle or a few
// shelves, or only bins never counted), and whether it's a stock take or opening stock. Opening stock is
// setting a location up, done once, so it's asked here rather than having a tile; initial is the one asked
// for.
export function RunPlanView({
  initial,
  locationName,
  list,
  onStart,
}: {
  initial: RunWorkflow;
  locationName: string;
  list: BinList;
  onStart: (bins: RunBinPlan[], as: RunWorkflow) => void;
}) {
  const colourOf = useColour();
  const [kind, setKind] = useState<RunWorkflow>(initial);
  const noun = kind === 'opening-stock' ? 'opening stock' : 'stock take';
  const [plan, setPlan] = useState<RunPlan>('every');
  const [chosen, setChosen] = useState<ReadonlySet<number>>(new Set());
  const bins = planBins(plan, list.choices, chosen);
  const never = planBins('never', list.choices, chosen).length;

  const toggle = (binId: number) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(binId)) next.delete(binId);
      else next.add(binId);
      return next;
    });

  return (
    <View className="flex-1 bg-ground">
      <ScrollView contentContainerClassName="gap-3 px-4 pb-6 pt-4">
        <Segmented options={KINDS} value={kind} onChange={setKind} />
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
          <Choice title={`Every bin in ${locationName}`} detail={plural(list.choices.length, 'bin', 'bins')} selected={plan === 'every'} onPress={() => setPlan('every')} />
          <Choice title="Choose bins" detail="An aisle or a few shelves" selected={plan === 'choose'} onPress={() => setPlan('choose')} />
          <Choice title="Never counted" detail={plural(never, 'bin', 'bins')} selected={plan === 'never'} onPress={() => setPlan('never')} />
        </View>

        {plan === 'choose' ? (
          <>
            <SectionLabel>{`${chosen.size} chosen`}</SectionLabel>
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
          </>
        ) : null}
      </ScrollView>
      <ActionBar
        label={bins.length > 0 ? `Start ${noun} · ${plural(bins.length, 'bin', 'bins')}` : plan === 'choose' ? 'Choose the bins' : 'No bins to count'}
        icon={bins.length > 0 ? 'count' : undefined}
        disabled={bins.length === 0}
        onPress={() => onStart(bins, kind)}
      />
    </View>
  );
}
