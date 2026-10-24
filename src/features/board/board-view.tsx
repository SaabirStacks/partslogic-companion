import { ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/ui/icon';
import { JobTile } from '@/ui/job-tile';
import { APPEAR, SETTLE } from '@/ui/motion';
import { Plate, PressablePlate } from '@/ui/plate';
import { SectionLabel } from '@/ui/section-label';
import { SignText } from '@/ui/sign-text';
import { LocationPlate, SyncPlate } from '@/ui/status-plates';

import type { BoardSection, LiveWorkflow } from '@/workflows/catalogue';

import { resumeText, type OpenWork } from './open-work';
import type { SyncState } from './sync-state';

type BoardProps = {
  sections: BoardSection[];
  openWork: OpenWork[];
  location: string | null;
  sync: SyncState;
  onJob: (workflow: LiveWorkflow) => void;
  onResume: (work: OpenWork) => void;
  onLocation: () => void;
  onSync: () => void;
  onAccount: () => void;
};

// Two to a row; a tile left on its own fills its row.
const pairs = <T,>(items: readonly T[]): T[][] =>
  Array.from({ length: Math.ceil(items.length / 2) }, (_, index) => items.slice(index * 2, index * 2 + 2));

// Home: the jobs as signs. Status plates on top, open work as yellow resume plates, then the workflows in
// their families (Parts, Inbound, Stock control...). Look up leads as a wide sign; the rest sit in a grid of
// squares. Every job is one tap away.
export function BoardView({ sections, openWork, location, sync, onJob, onResume, onLocation, onSync, onAccount }: BoardProps) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      className="flex-1 bg-ground"
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }}
      contentContainerClassName="gap-3 px-3">
      <View className="flex-row items-center justify-between gap-3">
        <Plate tone="plain" accessible accessibilityRole="header" accessibilityLabel="PartsLogic" className="h-12 justify-center px-3">
          <SignText size="label" weight="heavy" ink="text-on-plain" className="tracking-[2px]">
            PartsLogic
          </SignText>
        </Plate>
        <PressablePlate accessibilityLabel="Account" onPress={onAccount} className="h-12 w-12 items-center justify-center">
          <Icon name="account" size={26} />
        </PressablePlate>
      </View>

      <View className="flex-row gap-2">
        <LocationPlate name={location} onPress={onLocation} />
        {/* Keyed by its words, so a change of state fades in rather than snapping. */}
        <Animated.View key={sync.label} entering={APPEAR} style={{ flex: 1 }}>
          <SyncPlate state={sync} onPress={onSync} />
        </Animated.View>
      </View>

      {openWork.map((work) => {
        const text = resumeText(work);
        return (
          <Animated.View key={work.kind} entering={APPEAR} layout={SETTLE}>
            <PressablePlate
              tone="warning"
              heavy
              accessibilityLabel={`Resume ${text.title}, ${text.detail}`}
              onPress={() => onResume(work)}
              className="min-h-[72px] flex-row items-center gap-3 px-4 py-3">
              <Icon name={work.kind === 'delivery' ? 'receive' : 'count'} size={30} colour="on-warning" />
              <View className="flex-1">
                <SignText size="title" weight="heavy" ink="text-on-warning" numberOfLines={1}>
                  {`Resume · ${text.title}`}
                </SignText>
                <SignText size="tag" ink="text-on-warning" numberOfLines={1}>
                  {text.detail}
                </SignText>
              </View>
              <Icon name="forward" size={20} colour="on-warning" />
            </PressablePlate>
          </Animated.View>
        );
      })}

      {/* The jobs slide down to make room when a resume plate arrives. */}
      <Animated.View layout={SETTLE} style={{ gap: 12 }}>
        {sections.map((section, sectionIndex) => {
          const [lead, ...rest] = sectionIndex === 0 ? section.workflows : [];
          const tiles = sectionIndex === 0 ? rest : section.workflows;
          return (
            <View key={section.family} className="gap-3">
              <SectionLabel>{section.label}</SectionLabel>
              {lead ? <JobTile shape="lead" label={lead.label} icon={lead.icon} tone={lead.tone} onPress={() => onJob(lead)} /> : null}
              {pairs(tiles).map((row) =>
                row.length === 1 ? (
                  <JobTile key={row[0].id} shape="bar" label={row[0].label} icon={row[0].icon} tone={row[0].tone} onPress={() => onJob(row[0])} />
                ) : (
                  <View key={row.map((workflow) => workflow.id).join()} className="flex-row gap-3">
                    {row.map((workflow) => (
                      <JobTile key={workflow.id} label={workflow.label} icon={workflow.icon} tone={workflow.tone} onPress={() => onJob(workflow)} />
                    ))}
                  </View>
                ),
              )}
            </View>
          );
        })}
      </Animated.View>
    </ScrollView>
  );
}
