import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { bins, type JobRow } from '@/features/pick/job';
import { PickCard } from '@/features/pick/pick-card';
import { PickReceipt } from '@/features/pick/pick-receipt';
import { PickRowSheet } from '@/features/pick/pick-row-sheet';
import { PickRows } from '@/features/pick/pick-rows';
import { PickStart } from '@/features/pick/pick-start';
import { usePickJob } from '@/features/pick/use-pick-job';
import { bannerDetail, bannerTitle, finishLabel, goBack, refusedLine, STOP } from '@/features/pick/words';
import { NeedsLocation } from '@/features/location/needs-location';
import { useWorkingLocation } from '@/session/location-provider';
import { ActionBar } from '@/ui/action-bar';
import { Button } from '@/ui/button';
import { ConfirmSheet } from '@/ui/confirm-sheet';
import { JobBanner } from '@/ui/job-banner';
import { JobScreen } from '@/ui/job-screen';
import { StatusStrip } from '@/ui/status-strip';
import { Tally } from '@/ui/tally';
import { quantityWords } from '@/vendor/partslogic/shared/sales/words';

// Pick (S5b, PartsLogic docs/design-checks/phone-picking.md): Start picking claims the next orders at the branch for
// this picker; the banner names the bin to go to, large, and each scan adds one unit to its row with no confirm in
// between, saying which order it goes with. A row that can't be scanned is tapped with why; one short is a Short pick.
// Finish or Stop lets the orders go, and the receipt fills in as PartsLogic answers.
export default function Pick() {
  const { location } = useWorkingLocation();
  const pick = usePickJob();
  const [sheet, setSheet] = useState<{ row: JobRow; start: 'menu' | 'short' } | null>(null);
  const [confirming, setConfirming] = useState<'finish' | 'stop' | null>(null);

  if (!pick.loaded) return <View className="flex-1 bg-ground" />;
  if (pick.ended && pick.receipt) {
    return (
      <PickReceipt
        receipt={pick.receipt}
        onPack={() => {
          pick.dismissEnded();
          router.replace('/pack');
        }}
        onDone={() => {
          pick.dismissEnded();
          router.back();
        }}
      />
    );
  }
  if (!pick.job) {
    if (!location) return <NeedsLocation />;
    return (
      <PickStart
        status={pick.status.data}
        online={pick.online}
        loading={pick.status.loading}
        busy={pick.starting.busy}
        problem={pick.starting.problem ?? (pick.status.error instanceof Error ? pick.status.error.message : null)}
        onStart={() => void pick.start()}
        onPack={() => router.replace('/pack')}
      />
    );
  }

  const job = pick.job;
  const total = pick.totals!;
  const { now, next } = bins(job);
  const last = pick.lastRow;
  const end = (how: 'finished' | 'stopped') => {
    setConfirming(null);
    void pick.end(how);
  };

  return (
    <>
      <JobScreen
        placeholder="Barcode or part number"
        onScan={(code) => void pick.scan(code)}
        banner={<JobBanner size="headline" family="outbound" title={bannerTitle(now)} detail={bannerDetail(next, now, total)} />}
        result={
          pick.card ? (
            <PickCard key={pick.card.key} card={pick.card.card} onShortPick={(row) => setSheet({ row, start: 'short' })} onDismiss={pick.dismissCard} />
          ) : null
        }
        action={
          <ActionBar
            label={finishLabel(total.picked)}
            icon="check"
            // Everything picked or short finishes at once; units still to pick are said first.
            onPress={() => (total.left > 0 ? setConfirming('finish') : end('finished'))}
            secondary={last && !last.short && last.scanned + last.tapped > 0 ? { label: 'Undo the last scan', icon: 'undo', onPress: () => void pick.undoLast() } : undefined}
          />
        }>
        <Tally
          items={[
            { value: quantityWords(total.picked), label: `Units of ${quantityWords(total.units)}` },
            { value: total.orders, label: total.orders === 1 ? 'Order' : 'Orders' },
            ...(total.short > 0 ? [{ value: quantityWords(total.short), label: 'Short', tone: 'warn' as const }] : []),
          ]}
        />
        {pick.refused.map((refusal) => (
          <StatusStrip key={refusal.key} tone="stop" icon="stop" text={refusedLine(refusal.order, refusal.reason)} />
        ))}
        <PickRows rows={job.rows} onRow={(row) => setSheet({ row, start: 'menu' })} />
        <Button label={STOP.confirm} icon="close" variant="secondary" onPress={() => setConfirming('stop')} />
      </JobScreen>
      <PickRowSheet
        row={sheet ? (job.rows.find((row) => row.key === sheet.row.key) ?? null) : null}
        start={sheet?.start}
        onTap={(key, qty, reason) => void pick.tap(key, qty, reason)}
        onShort={(key, found, reason) => void pick.short(key, found, reason)}
        onClose={() => setSheet(null)}
      />
      <ConfirmSheet
        visible={confirming === 'finish'}
        title="Finish picking?"
        facts={[
          { value: quantityWords(total.picked), label: 'Picked' },
          { value: quantityWords(total.left), label: 'Not picked', tone: 'warn' },
        ]}
        note={goBack(total.left)}
        confirm={{ label: 'Finish', onPress: () => end('finished') }}
        cancelLabel="Keep picking"
        onCancel={() => setConfirming(null)}
      />
      <ConfirmSheet
        visible={confirming === 'stop'}
        title={STOP.title}
        facts={[{ value: quantityWords(total.picked), label: 'Picked' }]}
        note={STOP.note}
        confirm={{ label: STOP.confirm, onPress: () => end('stopped') }}
        cancelLabel="Keep picking"
        onCancel={() => setConfirming(null)}
      />
    </>
  );
}
