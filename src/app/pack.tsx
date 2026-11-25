import { router } from 'expo-router';

import { NeedsLocation } from '@/features/location/needs-location';
import { PackJobView } from '@/features/pack/pack-job-view';
import { PackList, PackReceipt } from '@/features/pack/pack-views';
import { usePack } from '@/features/pack/use-pack';
import { useWorkingLocation } from '@/session/location-provider';

// Pack (S5b): the branch's deliveries with every part picked. One order at a time, each part is scanned into the box
// (or put in with + when it won't scan) until every unit is in; then how many parcels, and Packed: the order reads
// Ready for delivery, for the driver (S5a-2).
export default function Pack() {
  const { location } = useWorkingLocation();
  const pack = usePack();

  if (pack.packed) {
    return (
      <PackReceipt
        packed={pack.packed}
        onNext={pack.next}
        onDone={() => {
          pack.next();
          router.back();
        }}
      />
    );
  }
  if (!location) return <NeedsLocation />;
  if (!pack.box) {
    return (
      <PackList
        online={pack.online}
        orders={pack.list.data?.packing}
        problem={pack.list.error instanceof Error ? pack.list.error.message : null}
        onRetry={pack.list.reload}
        onOpen={pack.open}
      />
    );
  }
  return (
    <PackJobView
      box={pack.box}
      card={pack.card}
      onScan={(code) => void pack.scan(code)}
      onStep={pack.step}
      onSet={pack.set}
      onPacked={(parcels) => void pack.pack(parcels)}
      onClose={pack.close}
    />
  );
}
