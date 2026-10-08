import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { NeedsLocation } from '@/features/location/needs-location';
import { AddPartLink } from '@/features/quick-add/add-part-link';
import type { LineGroup } from '@/features/receive/lines';
import { statusText } from '@/features/receive/status-text';
import { useDelivery } from '@/features/receive/use-delivery';
import { clock, plural } from '@/lib/format';
import { useWorkingLocation } from '@/session/location-provider';
import { ActionBar } from '@/ui/action-bar';
import { Button } from '@/ui/button';
import { ConfirmSheet } from '@/ui/confirm-sheet';
import { JobBanner } from '@/ui/job-banner';
import { JobScreen } from '@/ui/job-screen';
import { LineRow } from '@/ui/line-row';
import { Notice } from '@/ui/notice';
import { Plate } from '@/ui/plate';
import { Quantity } from '@/ui/quantity';
import { ScanResultCard } from '@/ui/scan-result-card';
import { SectionLabel } from '@/ui/section-label';
import { Detail, SignText } from '@/ui/sign-text';
import { StatusStrip } from '@/ui/status-strip';
import { Tally } from '@/ui/tally';

type Receiving = ReturnType<typeof useDelivery>;

// Receive: scan box after box. The first scan opens the delivery; every scan lands as a green plate (or
// yellow for a code PartsLogic may not know) and adds to its line. Finish books it all into Unbinned.
export default function Receive() {
  const { location } = useWorkingLocation();
  const receiving = useDelivery();
  const [confirming, setConfirming] = useState(false);
  const { delivery, groups, units, lastLine } = receiving;

  if (!receiving.loaded) return <View className="flex-1 bg-ground" />;
  if (receiving.finished && !delivery) return <Finished receiving={receiving} />;
  if (!location && !delivery) return <NeedsLocation />;

  const unknown = groups.filter((group) => group.status === 'unknown').length;
  const toCheck = groups.filter((group) => statusText(group.status, group.reason).tone !== 'safe' && group.status !== 'waiting').length;

  return (
    <>
      <JobScreen
        placeholder="Barcode or part number"
        onScan={(code) => void receiving.scan(code)}
        banner={
          delivery ? (
            <JobBanner
              title={receiving.number ?? `Delivery ${clock(delivery.startedAt)}`}
              detail={delivery.locationName ? `Into ${delivery.locationName} Unbinned` : null}
            />
          ) : null
        }
        result={<LastScan receiving={receiving} />}
        action={
          groups.length > 0 ? (
            <ActionBar
              label={`Finish · ${plural(units, 'unit', 'units')}`}
              icon="check"
              onPress={() => setConfirming(true)}
              secondary={
                lastLine && lastLine.qty > 0
                  ? { label: 'Undo the last scan', icon: 'undo', onPress: () => void receiving.change(lastLine.code, -1, lastLine.label) }
                  : undefined
              }
            />
          ) : null
        }>
        <Tally
          items={[
            { value: units, label: 'Units' },
            { value: groups.length, label: 'Codes' },
            { value: toCheck, label: 'To check', tone: toCheck > 0 ? 'warning' : undefined },
          ]}
        />
        {receiving.problems > 0 ? (
          <StatusStrip tone="stop" icon="stop" text={`${plural(receiving.problems, 'line', 'lines')} not sent · see Sync`} />
        ) : null}
        {groups.map((group) => (
          <GroupRow key={group.code} group={group} receiving={receiving} />
        ))}
        {!delivery && receiving.recent.length > 0 ? (
          <>
            <SectionLabel>Finished on this phone</SectionLabel>
            {receiving.recent.map((item) => (
              <Plate key={item.documentId} className="min-h-14 flex-row items-center gap-3 px-3 py-2">
                <SignText size="label" weight="heavy" className="flex-1">
                  {`Delivery ${clock(item.startedAt)}`}
                </SignText>
                {item.finishedAt ? <Detail>{`Finished ${clock(item.finishedAt)}`}</Detail> : null}
              </Plate>
            ))}
          </>
        ) : null}
      </JobScreen>
      <ConfirmSheet
        visible={confirming}
        title="Finish delivery?"
        facts={[
          { value: units, label: 'Units' },
          { value: groups.length, label: 'Codes' },
        ]}
        note={unknown > 0 ? `${plural(unknown, 'unknown code stays', 'unknown codes stay')} for the office to match.` : null}
        confirm={{
          label: `Finish · ${plural(units, 'unit', 'units')}`,
          onPress: () => {
            setConfirming(false);
            void receiving.finish();
          },
        }}
        cancelLabel="Keep scanning"
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

// The plate for the scan that just landed: what was added and how many of it are in the delivery now.
function LastScan({ receiving }: { receiving: Receiving }) {
  const { notice, lastLine, groups } = receiving;
  if (notice) {
    return (
      <ScanResultCard key={notice.bin} tone="warning" status={{ icon: 'bin', label: 'Bin label · not added' }} title={notice.bin} detail="Deliveries go into Unbinned" />
    );
  }
  if (!lastLine) return null;
  const group = groups.find((candidate) => candidate.code === lastLine.code);
  const total = group?.total ?? lastLine.qty;
  if (lastLine.qty < 0) {
    return (
      <ScanResultCard
        key={lastLine.clientLineId}
        tone="surface"
        status={{ icon: 'undo', label: 'Taken off' }}
        title={lastLine.label ?? lastLine.code}
        quantity={{ value: String(lastLine.qty).replace('-', '−'), label: `${total} in delivery` }}
      />
    );
  }
  const known = lastLine.label !== null;
  return (
    <ScanResultCard
      key={lastLine.clientLineId}
      tone={known ? 'safe' : 'warning'}
      status={known ? { icon: 'sent', label: 'Added' } : { icon: 'warning', label: 'Added · unknown code' }}
      title={lastLine.label ?? lastLine.code}
      detail={known ? lastLine.code : null}
      quantity={{ value: `+${lastLine.qty}`, label: `${total} in delivery` }}>
      {known ? null : <AddPartLink code={lastLine.code} />}
    </ScanResultCard>
  );
}

function GroupRow({ group, receiving }: { group: LineGroup; receiving: Receiving }) {
  const status = statusText(group.status, group.reason);
  const name = group.label ?? group.code;
  return (
    <LineRow
      name={name}
      code={group.label ? group.code : null}
      status={status}
      quantity={
        <Quantity
          total={group.total}
          name={name}
          onStep={(change) => void receiving.change(group.code, change, group.label)}
          onSet={(target) => void receiving.setTotal(group.code, target, group.total, group.label)}
        />
      }>
      {group.status === 'unknown' ? <AddPartLink code={group.code} /> : null}
    </LineRow>
  );
}

// After Finish: the receipt number, where the stock went, and the next job.
function Finished({ receiving }: { receiving: Receiving }) {
  const finished = receiving.finished!;
  const place = finished.delivery.locationName ? `${finished.delivery.locationName} Unbinned` : 'Unbinned';
  return (
    <View className="flex-1 bg-ground">
      <Notice
        icon="sent"
        tone="safe"
        title={receiving.finishedNumber ?? 'Delivery finished'}
        line={`${plural(finished.units, 'unit', 'units')} into ${place}`}>
        <Button label="Put away now" icon="count" onPress={() => router.replace('/count')} />
        <Button label="Next delivery" variant="secondary" onPress={receiving.dismissFinished} />
      </Notice>
    </View>
  );
}
