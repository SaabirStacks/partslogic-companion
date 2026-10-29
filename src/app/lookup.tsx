import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { filterBins } from '@/features/count/bin-choices';
import { useBinChoices } from '@/features/count/use-bin-choices';
import { partAnswer } from '@/features/lookup/answer';
import { PartAnswerCard } from '@/features/lookup/part-answer-card';
import { useLookUp, type LookUpView } from '@/features/lookup/use-look-up';
import { loadPart } from '@/features/part/load-part';
import { PartRow } from '@/features/part/part-row';
import type { RecentPart } from '@/lib/prefs';
import { useRemote } from '@/lib/use-remote';
import { isSystemBin } from '@/scan/system-bins';
import { useWorkingLocation } from '@/session/location-provider';
import { useSession } from '@/session/session-provider';
import { ActionBar } from '@/ui/action-bar';
import { Button } from '@/ui/button';
import { Icon } from '@/ui/icon';
import { JobScreen } from '@/ui/job-screen';
import { ScanResultCard } from '@/ui/scan-result-card';
import { SectionLabel } from '@/ui/section-label';
import { PressableCard } from '@/ui/surface';
import { Txt } from '@/ui/text';
import { barcodeProblem } from '@/vendor/partslogic/shared/gtin';
import { roleAtLeast } from '@/vendor/partslogic/shared/members';

type LookUpApi = ReturnType<typeof useLookUp>;

// Look up: scan or type, and the answer lands on the result card. A part shows its stock, bins and
// price at a glance, and tapping it opens the whole part. The camera holds on the answer until Scan next.
export default function LookUp() {
  const lookUp = useLookUp();
  const { state } = useSession();
  const member = state.status === 'member' ? state.member : null;
  const canCount = member !== null && roleAtLeast(member.role, 'counter');
  const { view, recent } = lookUp;
  const { location } = useWorkingLocation();
  // A typed search also looks through the location's bins (loaded the first time one is searched), so a
  // bin can be found without its label or its exact name.
  const [binsWanted, setBinsWanted] = useState(false);
  if (view.kind === 'results' && !binsWanted) setBinsWanted(true);
  const bins = useBinChoices(binsWanted && location ? location.id : null);
  const binMatches = view.kind === 'results' ? filterBins(bins.choices, view.query).slice(0, 6) : [];

  return (
    <JobScreen
      placeholder="Part number or barcode"
      scanEnabled={!lookUp.holding}
      onResume={lookUp.view.kind === 'working' ? undefined : lookUp.clear}
      onScan={lookUp.scan}
      onType={lookUp.type}
      result={<Answer view={view} lookUp={lookUp} currency={member?.currency ?? 'GBP'} binMatches={binMatches.length} />}
      action={<Action view={view} lookUp={lookUp} canCount={canCount} />}>
      {binMatches.length > 0 && location ? (
        <>
          <SectionLabel>{`Bins in ${location.name}`}</SectionLabel>
          {binMatches.map((bin) => (
            <PressableCard
              key={bin.binId}
              accessibilityLabel={`Bin ${bin.code}`}
              onPress={() => lookUp.showBin({ binId: bin.binId, code: bin.code })}
              className="min-h-14 flex-row items-center gap-3 px-4 py-2">
              <Icon name="bin" size={20} colour="quiet-ink" />
              <View className="flex-1">
                <Txt variant="title" numberOfLines={1} className="font-extrabold">
                  {bin.code}
                </Txt>
              </View>
              <Icon name="forward" size={16} colour="quiet-ink" />
            </PressableCard>
          ))}
        </>
      ) : null}
      {view.kind === 'results' && view.results.length > 0 ? (
        <>
          <SectionLabel>{`${view.results.length === 30 ? 'First 30' : view.results.length} ${view.results.length === 1 ? 'match' : 'matches'}`}</SectionLabel>
          {view.results.map((result) => (
            <PartRow
              key={result.partId}
              brand={result.brand}
              number={result.number}
              description={result.description}
              onPress={() => lookUp.openPart({ partId: result.partId, brand: result.brand, number: result.number, description: result.description })}
            />
          ))}
        </>
      ) : null}
      {view.kind !== 'results' && recent.length > 0 ? (
        <>
          <SectionLabel>Recent</SectionLabel>
          {recent.map((part) => (
            <PartRow key={part.partId} {...part} onPress={() => lookUp.openPart(part)} />
          ))}
        </>
      ) : null}
    </JobScreen>
  );
}

function Answer({ view, lookUp, currency, binMatches }: { view: LookUpView; lookUp: LookUpApi; currency: string; binMatches: number }) {
  switch (view.kind) {
    case 'working':
      return <ScanResultCard tone="neutral" status={{ icon: 'waiting', label: 'Looking up' }} title={view.code} />;
    case 'part':
      return <PartCard key={view.at} part={view.part} currency={currency} onOpen={() => lookUp.openPart(view.part)} />;
    case 'bin':
      return isSystemBin(view.bin) ? (
        <ScanResultCard tone="neutral" status={{ icon: 'bin', label: 'System bin' }} title={view.bin} detail={`${view.location} · Can’t be counted`} />
      ) : (
        <ScanResultCard tone="neutral" status={{ icon: 'bin', label: 'Bin' }} title={view.bin} detail={view.location} />
      );
    case 'unknown':
      return (
        <ScanResultCard tone="warn" status={{ icon: 'warning', label: 'Unknown code' }} title={view.code} detail={barcodeProblem(view.code)}>
          <Button label="Search instead" icon="lookup" variant="secondary" compact onPress={() => lookUp.search(view.code)} />
        </ScanResultCard>
      );
    case 'offline':
      return (
        <ScanResultCard tone="warn" status={{ icon: 'offline', label: 'No signal' }} title={view.code} detail="Not in the scan list on this phone">
          <Button label="Try again" icon="retry" variant="secondary" compact onPress={() => lookUp.retry(view.code, view.typed)} />
        </ScanResultCard>
      );
    case 'error':
      return (
        <ScanResultCard tone="stop" status={{ icon: 'stop', label: 'Didn’t work' }} title={view.code} detail={view.message}>
          <Button label="Try again" icon="retry" variant="secondary" compact onPress={() => lookUp.retry(view.code, view.typed)} />
        </ScanResultCard>
      );
    case 'results':
      return view.results.length === 0 && binMatches === 0 ? (
        <ScanResultCard tone="warn" status={{ icon: 'lookup', label: 'No match' }} title={view.query} detail="Check the number, or scan the box" />
      ) : null;
    default:
      return null;
  }
}

// A scanned part: stock and price from PartsLogic (or the copy saved on this phone), with its stock chip.
// Until they arrive it shows the part with a dash for the quantity.
function PartCard({ part, currency, onOpen }: { part: RecentPart; currency: string; onOpen: () => void }) {
  const { data, error } = useRemote(`part:${part.partId}`, () => loadPart(part.partId));
  const title = `${part.brand} ${part.number}`;

  if (!data) {
    return error ? (
      <ScanResultCard tone="warn" status={{ icon: 'offline', label: 'No signal' }} title={title} detail="Stock shows when you’re back online" />
    ) : (
      <ScanResultCard
        tone="neutral"
        status={{ icon: 'waiting', label: data === null ? 'Not found' : 'Checking stock' }}
        title={title}
        quantity={{ value: '–', label: 'On hand' }}
      />
    );
  }

  return <PartAnswerCard title={title} answer={partAnswer(data.detail, currency)} savedAt={data.savedAt} onOpen={onOpen} />;
}

// The one main action for what was scanned: open the part, count the bin (never a system bin), or add the
// unknown code. Scan next sits on the paused camera.
function Action({ view, lookUp, canCount }: { view: LookUpView; lookUp: LookUpApi; canCount: boolean }) {
  if (view.kind === 'part') {
    return <ActionBar label="Open part" icon="forward" onPress={() => lookUp.openPart(view.part)} />;
  }
  if (view.kind === 'bin' && canCount && !isSystemBin(view.bin)) {
    return (
      <ActionBar
        label={`Count bin ${view.bin}`}
        icon="count"
        onPress={() => {
          lookUp.clear();
          router.navigate({ pathname: '/count', params: { purpose: 'stock-count', binId: String(view.binId), bin: view.bin, location: view.location } });
        }}
      />
    );
  }
  if (view.kind === 'unknown' && canCount) {
    return (
      <ActionBar
        label="Add part"
        icon="add"
        tone="neutral"
        onPress={() => router.push({ pathname: '/quick-add', params: { code: view.code } })}
      />
    );
  }
  return null;
}
