import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/ui/icon';
import { JobTile } from '@/ui/job-tile';
import { Plate, PressablePlate } from '@/ui/plate';
import { SignText } from '@/ui/sign-text';
import { LocationPlate, SyncPlate } from '@/ui/status-plates';

import type { Job } from './jobs';
import { resumeText, type OpenWork } from './open-work';
import type { SyncState } from './sync-state';

type BoardProps = {
  jobs: Job[];
  openWork: OpenWork[];
  location: string | null;
  sync: SyncState;
  onJob: (job: Job) => void;
  onResume: (work: OpenWork) => void;
  onLocation: () => void;
  onSync: () => void;
  onAccount: () => void;
};

// Home: the jobs as signs. Status plates on top, open work as yellow resume plates, then the lead job as
// a wide sign and the rest in a grid of squares. Every job is one tap away.
export function BoardView({ jobs, openWork, location, sync, onJob, onResume, onLocation, onSync, onAccount }: BoardProps) {
  const insets = useSafeAreaInsets();
  const [lead, ...rest] = jobs;
  const rows = Array.from({ length: Math.ceil(rest.length / 2) }, (_, index) => rest.slice(index * 2, index * 2 + 2));

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
        <SyncPlate state={sync} onPress={onSync} />
      </View>

      {openWork.map((work) => {
        const text = resumeText(work);
        return (
          <PressablePlate
            key={work.kind}
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
        );
      })}

      {lead ? <JobTile wide label={lead.label} icon={lead.icon} tone={lead.tone} onPress={() => onJob(lead)} /> : null}
      {rows.map((row) => (
        <View key={row.map((job) => job.id).join()} className="flex-row gap-3">
          {row.map((job) => (
            <JobTile key={job.id} label={job.label} icon={job.icon} tone={job.tone} onPress={() => onJob(job)} />
          ))}
          {row.length === 1 ? <View className="flex-1" /> : null}
        </View>
      ))}
    </ScrollView>
  );
}
