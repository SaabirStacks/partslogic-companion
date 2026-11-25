import { router } from 'expo-router';
import { View } from 'react-native';

import { NeedsLocation } from '@/features/location/needs-location';
import { PickJobView } from '@/features/pick/pick-job-view';
import { PickReceipt } from '@/features/pick/pick-receipt';
import { PickStart } from '@/features/pick/pick-start';
import { usePickJob } from '@/features/pick/use-pick-job';
import { useWorkingLocation } from '@/session/location-provider';

// Pick (S5b, PartsLogic docs/design-checks/phone-picking.md): Start picking claims the next orders at the branch for
// this picker; the banner names the bin to go to, large, and each scan adds one unit to its row with no confirm in
// between, saying which order it goes with. A row that can't be scanned is tapped with why; one short is a Short pick.
// Finish or Stop lets the orders go, and the receipt fills in as PartsLogic answers.
export default function Pick() {
  const { location } = useWorkingLocation();
  const pick = usePickJob();

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
  return (
    <PickJobView
      job={pick.job}
      totals={pick.totals!}
      card={pick.card}
      lastRow={pick.lastRow}
      refused={pick.refused}
      onScan={(code) => void pick.scan(code)}
      onDismissCard={pick.dismissCard}
      onTap={(key, qty, reason) => void pick.tap(key, qty, reason)}
      onShort={(key, found, reason) => void pick.short(key, found, reason)}
      onUndo={() => void pick.undoLast()}
      onEnd={(how) => void pick.end(how)}
    />
  );
}
