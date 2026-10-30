import { RefreshControl, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PartRow } from '@/features/part/part-row';
import type { RecentPart } from '@/lib/prefs';
import { Button } from '@/ui/button';
import { Icon } from '@/ui/icon';
import { JobTile } from '@/ui/job-tile';
import { APPEAR, SETTLE } from '@/ui/motion';
import { SectionLabel } from '@/ui/section-label';
import { StatusChip } from '@/ui/status-chip';
import { LocationPill, SyncPill } from '@/ui/status-pills';
import { Card, PressableCard } from '@/ui/surface';
import { Txt } from '@/ui/text';
import { useColour } from '@/ui/theme';
import type { BoardSection, LiveWorkflow } from '@/workflows/catalogue';

import { boardLayout } from './board-layout';
import { openWorkKey, resumeText, type OpenWork } from './open-work';
import type { SyncState } from './sync-state';
import { tileBadge } from './tile-badge';

type BoardProps = {
  sections: BoardSection[];
  openWork: OpenWork[];
  // Units waiting in the location's Unbinned bin, for Put away's tile (null when not known).
  unbinned?: number | null;
  // A new version is downloaded and Restart switches to it (use-app-update.ts).
  update?: { ready: boolean; restart: () => void };
  location: string | null;
  sync: SyncState;
  onJob: (workflow: LiveWorkflow) => void;
  onResume: (work: OpenWork) => void;
  onLocation: () => void;
  onSync: () => void;
  onAccount: () => void;
  // Parts looked up lately, shown on a board with no job tiles (a viewer's), one tap from the answer.
  recent?: RecentPart[];
  onPart?: (part: RecentPart) => void;
  // Pull down to fetch again what the board shows from PartsLogic.
  onRefresh?: () => void;
  refreshing?: boolean;
};

// Two to a row; a tile left on its own keeps its width.
const pairs = <T,>(items: readonly T[]): T[][] =>
  Array.from({ length: Math.ceil(items.length / 2) }, (_, index) => items.slice(index * 2, index * 2 + 2));

// Home. The app's name with the account button, where this phone works and whether its work is sent, the
// search field (Look up), open work to carry on with, then every job as a tile under its family, each with
// a corner badge for its open work or what's waiting (tile-badge.ts). Every job is one tap away.
export function BoardView({
  sections,
  openWork,
  unbinned = null,
  update,
  location,
  sync,
  onJob,
  onResume,
  onLocation,
  onSync,
  onAccount,
  recent = [],
  onPart,
  onRefresh,
  refreshing = false,
}: BoardProps) {
  const insets = useSafeAreaInsets();
  const colourOf = useColour();
  const layout = boardLayout(sections);

  return (
    <ScrollView
      className="flex-1 bg-ground"
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }}
      contentContainerClassName="gap-3 px-4"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colourOf('quiet-ink')} colors={[colourOf('action')]} /> : undefined}>
      <View className="flex-row items-center gap-3">
        <Txt accessibilityRole="header" variant="title" className="flex-1 font-extrabold tracking-[0.3px]">
          PartsLogic
        </Txt>
        <PressableCard accessibilityLabel="Account" onPress={onAccount} className="h-11 w-11 items-center justify-center rounded-[10px]">
          <Icon name="account" size={20} />
        </PressableCard>
      </View>

      <View className="flex-row gap-2">
        <LocationPill name={location} onPress={onLocation} />
        {/* Keyed by its words, so a change of state fades in rather than snapping. */}
        <Animated.View key={sync.label} entering={APPEAR}>
          <SyncPill state={sync} onPress={onSync} />
        </Animated.View>
      </View>

      {update?.ready ? (
        <Animated.View entering={APPEAR}>
          <Card className="flex-row items-center gap-3 px-4 py-3">
            <View className="flex-1 gap-0.5">
              <Txt variant="label" className="font-bold">
                New version ready
              </Txt>
              <Txt variant="caption">Nothing you’ve done is lost</Txt>
            </View>
            <Button label="Restart" icon="retry" compact onPress={update.restart} />
          </Card>
        </Animated.View>
      ) : null}

      {layout.search ? <SearchField onPress={() => onJob(layout.search!)} /> : null}

      {openWork.length > 0 ? (
        <Animated.View entering={APPEAR} layout={SETTLE} style={{ gap: 8 }}>
          <SectionLabel>Resume</SectionLabel>
          <Card className="overflow-hidden">
            {openWork.map((work, index) => {
              const text = resumeText(work);
              return (
                <PressableCard
                  key={openWorkKey(work)}
                  accessibilityLabel={`Resume ${text.title}, ${text.detail}`}
                  onPress={() => onResume(work)}
                  depth="flat"
                  className={index > 0 ? 'rounded-none border-0 border-t border-rule' : 'rounded-none border-0'}>
                  <View className="min-h-16 flex-row items-center gap-3 px-4 py-3">
                    <View className="flex-1 gap-0.5">
                      <Txt variant="label" numberOfLines={2} className="font-bold">
                        {text.title}
                      </Txt>
                      <Txt variant="caption" numbers numberOfLines={1}>
                        {text.detail}
                      </Txt>
                    </View>
                    <StatusChip tone="warn" icon="waiting" label="Open" />
                    <Icon name="forward" size={16} colour="quiet-ink" />
                  </View>
                </PressableCard>
              );
            })}
          </Card>
        </Animated.View>
      ) : null}

      {layout.sections.length === 0 && recent.length > 0 && onPart ? (
        <View className="gap-2">
          <SectionLabel>Recent</SectionLabel>
          {recent.map((part) => (
            <PartRow key={part.partId} brand={part.brand} number={part.number} description={part.description} onPress={() => onPart(part)} />
          ))}
        </View>
      ) : null}

      {/* The jobs slide down to make room when open work appears. */}
      <Animated.View layout={SETTLE} style={{ gap: 12 }}>
        {layout.sections.map((section) => (
          <View key={section.family} className="gap-2">
            <SectionLabel family={section.family}>{section.label}</SectionLabel>
            {pairs(section.workflows).map((row) => (
              <View key={row.map((workflow) => workflow.id).join()} className="flex-row gap-2">
                {row.map((workflow) => (
                  <View key={workflow.id} className="flex-1">
                    <JobTile
                      label={workflow.label}
                      icon={workflow.icon}
                      family={workflow.family}
                      badge={tileBadge(workflow.id, openWork, unbinned)}
                      onPress={() => onJob(workflow)}
                    />
                  </View>
                ))}
                {row.length === 1 ? <View className="flex-1" /> : null}
              </View>
            ))}
          </View>
        ))}
      </Animated.View>
    </ScrollView>
  );
}

// Look up, drawn as a search field: tapping it opens the camera with the typing box ready.
function SearchField({ onPress }: { onPress: () => void }) {
  return (
    <PressableCard
      accessibilityLabel="Look up a part: scan or type"
      onPress={onPress}
      className="min-h-14 flex-row items-center gap-2 border-[1.5px] px-4">
      <Icon name="lookup" size={18} colour="quiet-ink" />
      <Txt variant="body" ink="text-quiet-ink" numberOfLines={1} className="flex-1">
        Scan or type a part
      </Txt>
      <Icon name="barcode" size={20} colour="action-ink" />
    </PressableCard>
  );
}
