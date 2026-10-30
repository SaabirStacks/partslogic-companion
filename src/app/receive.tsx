import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { NeedsLocation } from '@/features/location/needs-location';
import { AddPartLink } from '@/features/quick-add/add-part-link';
import { DeliveryReceipt } from '@/features/receive/delivery-receipt';
import type { Delivery } from '@/features/receive/delivery-store';
import type { LineGroup } from '@/features/receive/lines';
import { deliveryName } from '@/features/receive/sender';
import { statusText } from '@/features/receive/status-text';
import { useDelivery } from '@/features/receive/use-delivery';
import { WhoIsItFrom } from '@/features/receive/who-is-it-from';
import { plural } from '@/lib/format';
import { useWorkingLocation } from '@/session/location-provider';
import { ActionBar } from '@/ui/action-bar';
import { Button } from '@/ui/button';
import { ConfirmScanCard } from '@/ui/confirm-scan-card';
import { ConfirmSheet } from '@/ui/confirm-sheet';
import { JobBanner } from '@/ui/job-banner';
import { JobScreen } from '@/ui/job-screen';
import { LineRow } from '@/ui/line-row';
import { Quantity } from '@/ui/quantity';
import { ScanResultCard } from '@/ui/scan-result-card';
import { StatusStrip } from '@/ui/status-strip';
import { Tally } from '@/ui/tally';

type Receiving = ReturnType<typeof useDelivery>;

// Receive goods: first who it's from, then box after box, one at a time. Each scan pauses the camera on
// a card to check it and set how many, then Add (or Skip). Finish books it all into Unbinned and ends on
// a receipt.
export default function Receive() {
  const { location } = useWorkingLocation();
  const receiving = useDelivery();
  const [confirming, setConfirming] = useState(false);
  const { delivery, groups, units, lastLine } = receiving;

  if (!receiving.loaded) return <View className="flex-1 bg-ground" />;
  if (receiving.finished && !delivery) return <Finished receiving={receiving} />;
  if (!location && !delivery) return <NeedsLocation />;
  if (!delivery) return <WhoIsItFrom onStart={(sender, reference) => void receiving.start(sender, reference)} />;

  const unknown = groups.filter((group) => group.status === 'unknown').length;
  const toCheck = groups.filter((group) => statusText(group.status, group.reason).tone !== 'ok' && group.status !== 'waiting').length;

  return (
    <>
      <JobScreen
        placeholder="Barcode or part number"
        scanEnabled={!receiving.held.pending}
        onScan={receiving.scan}
        banner={<JobBanner size="headline" family="inbound" title={deliveryName(delivery.sender)} detail={bannerDetail(delivery, receiving.number)} />}
        result={<LastScan receiving={receiving} />}
        action={
          // While a scan waits on Add or Skip, it's the only decision on screen.
          groups.length > 0 && !receiving.held.pending ? (
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
            { value: toCheck, label: 'To check', tone: toCheck > 0 ? 'warn' : undefined },
          ]}
        />
        {receiving.problems > 0 ? (
          <StatusStrip tone="stop" icon="stop" text={`${plural(receiving.problems, 'line', 'lines')} not sent · see Sync`} />
        ) : null}
        {groups.map((group) => (
          <GroupRow key={group.code} group={group} receiving={receiving} />
        ))}
        {groups.length === 0 && !receiving.held.pending ? (
          <Button label="Cancel delivery" icon="close" variant="secondary" onPress={() => void receiving.cancel()} />
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

// The card over the camera's edge: the scan being held for a decision, or else the line just added and
// how many of it are in the delivery now.
function LastScan({ receiving }: { receiving: Receiving }) {
  const { held, lastLine, groups } = receiving;
  if (held.pending) {
    return (
      <ConfirmScanCard
        pending={held.pending}
        verb="Add"
        onConfirm={() => void receiving.confirm()}
        onSkip={held.clear}
        onStep={held.step}
        onSet={held.setQty}
        onRetry={() => void held.retry()}
        addPart={<AddPartLink code={held.pending.code} />}
      />
    );
  }
  if (!lastLine) return null;
  const group = groups.find((candidate) => candidate.code === lastLine.code);
  const total = group?.total ?? lastLine.qty;
  if (lastLine.qty < 0) {
    return (
      <ScanResultCard
        key={lastLine.clientLineId}
        tone="neutral"
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
      tone={known ? 'ok' : 'warn'}
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

// The strip's second line: the receipt number once PartsLogic gives one, the delivery note, and where the
// stock goes.
function bannerDetail(delivery: Delivery, number: string | null): string {
  return [number ?? 'Not sent yet', delivery.reference, 'into Unbinned'].filter(Boolean).join(' · ');
}

// After Finish: the receipt, and the next job.
function Finished({ receiving }: { receiving: Receiving }) {
  const finished = receiving.finished!;
  return (
    <DeliveryReceipt
      delivery={finished.delivery}
      number={finished.number}
      units={finished.units}
      summary={finished.summary}
      onPutAway={() => router.replace({ pathname: '/count', params: { purpose: 'put-away' } })}
      onNext={receiving.dismissFinished}
    />
  );
}
