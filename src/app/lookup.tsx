import { router } from 'expo-router';
import { partAnswer } from '@/features/lookup/answer';
import { PartAnswerPlate } from '@/features/lookup/part-answer-plate';
import { useLookUp, type LookUpView } from '@/features/lookup/use-look-up';
import { loadPart } from '@/features/part/load-part';
import { PartRow } from '@/features/part/part-row';
import type { RecentPart } from '@/lib/prefs';
import { useRemote } from '@/lib/use-remote';
import { useSession } from '@/session/session-provider';
import { ActionBar } from '@/ui/action-bar';
import { Button } from '@/ui/button';
import { JobScreen } from '@/ui/job-screen';
import { ScanResultCard } from '@/ui/scan-result-card';
import { SectionLabel } from '@/ui/section-label';
import { barcodeProblem } from '@/vendor/partslogic/shared/gtin';
import { roleAtLeast } from '@/vendor/partslogic/shared/members';

type LookUpApi = ReturnType<typeof useLookUp>;

// Look up: scan or type, and the answer lands on the result plate. A part shows its stock, bins and
// price at a glance; the next scan replaces it, and tapping it opens the whole part.
export default function LookUp() {
  const lookUp = useLookUp();
  const { state } = useSession();
  const member = state.status === 'member' ? state.member : null;
  const canCount = member !== null && roleAtLeast(member.role, 'counter');
  const { view, recent } = lookUp;

  return (
    <JobScreen
      placeholder="Part number or barcode"
      scanEnabled={!lookUp.busy}
      onScan={lookUp.scan}
      onType={lookUp.type}
      result={<Answer view={view} lookUp={lookUp} currency={member?.currency ?? 'GBP'} />}
      action={<Action view={view} lookUp={lookUp} canCount={canCount} />}>
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

function Answer({ view, lookUp, currency }: { view: LookUpView; lookUp: LookUpApi; currency: string }) {
  switch (view.kind) {
    case 'working':
      return <ScanResultCard tone="surface" status={{ icon: 'waiting', label: 'Looking up' }} title={view.code} />;
    case 'part':
      return <PartPlate key={view.at} part={view.part} currency={currency} onOpen={() => lookUp.openPart(view.part)} />;
    case 'bin':
      return <ScanResultCard tone="surface" status={{ icon: 'bin', label: 'Bin label' }} title={view.bin} detail={view.location} />;
    case 'unknown':
      return (
        <ScanResultCard tone="warning" status={{ icon: 'warning', label: 'Unknown code' }} title={view.code} detail={barcodeProblem(view.code)}>
          <Button label="Search instead" icon="lookup" variant="secondary" compact onPress={() => lookUp.search(view.code)} />
        </ScanResultCard>
      );
    case 'offline':
      return (
        <ScanResultCard tone="warning" status={{ icon: 'offline', label: 'No signal' }} title={view.code} detail="Not in the scan list on this phone">
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
      return view.results.length === 0 ? (
        <ScanResultCard tone="warning" status={{ icon: 'lookup', label: 'No match' }} title={view.query} detail="Check the number, or scan the box" />
      ) : null;
    default:
      return null;
  }
}

// A scanned part: stock and price from PartsLogic (or the copy saved on this phone), drawn as the stock
// sign. Until they arrive it shows the part with a dash for the quantity.
function PartPlate({ part, currency, onOpen }: { part: RecentPart; currency: string; onOpen: () => void }) {
  const { data, error } = useRemote(`part:${part.partId}`, () => loadPart(part.partId));
  const title = `${part.brand} ${part.number}`;

  if (!data) {
    return error ? (
      <ScanResultCard tone="warning" status={{ icon: 'offline', label: 'No signal' }} title={title} detail="Stock shows when you’re back online" />
    ) : (
      <ScanResultCard
        tone="surface"
        status={{ icon: 'waiting', label: data === null ? 'Not found' : 'Checking stock' }}
        title={title}
        quantity={{ value: '–', label: 'On hand' }}
      />
    );
  }

  return <PartAnswerPlate title={title} answer={partAnswer(data.detail, currency)} savedAt={data.savedAt} onOpen={onOpen} />;
}

// The one main action for what was scanned: open the part, count the bin, or add the unknown code.
function Action({ view, lookUp, canCount }: { view: LookUpView; lookUp: LookUpApi; canCount: boolean }) {
  if (view.kind === 'part') {
    return <ActionBar label="Open part" icon="forward" onPress={() => lookUp.openPart(view.part)} />;
  }
  if (view.kind === 'bin' && canCount) {
    return (
      <ActionBar
        label={`Count bin ${view.bin}`}
        icon="count"
        onPress={() => {
          lookUp.clear();
          router.navigate({ pathname: '/count', params: { binId: String(view.binId), bin: view.bin, location: view.location } });
        }}
      />
    );
  }
  if (view.kind === 'unknown' && canCount) {
    return (
      <ActionBar
        label="Add part"
        icon="add"
        tone="plain"
        onPress={() => router.push({ pathname: '/quick-add', params: { code: view.code } })}
      />
    );
  }
  return null;
}
