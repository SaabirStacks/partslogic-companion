import { router } from 'expo-router';
import { useState } from 'react';

import { NeedsLocation } from '@/features/location/needs-location';
import { full, inBox } from '@/features/pack/pack';
import { PackList, PackReceipt, PackScanCard, ParcelsSheet } from '@/features/pack/pack-views';
import { usePack } from '@/features/pack/use-pack';
import { boxCount, EACH_PART_FIRST, linePart, packingDetail } from '@/features/pack/words';
import { useWorkingLocation } from '@/session/location-provider';
import { ActionBar } from '@/ui/action-bar';
import { Button } from '@/ui/button';
import { JobBanner } from '@/ui/job-banner';
import { JobScreen } from '@/ui/job-screen';
import { LineRow } from '@/ui/line-row';
import { Quantity } from '@/ui/quantity';
import { StatusStrip } from '@/ui/status-strip';
import { Tally } from '@/ui/tally';
import { quantityWords } from '@/vendor/partslogic/shared/sales/words';

// Pack (S5b): the branch's deliveries with every part picked. One order at a time, each part is scanned into the box
// (or put in with + when it won't scan) until every unit is in; then how many parcels, and Packed: the order reads
// Ready for delivery, for the driver (S5a-2).
export default function Pack() {
  const { location } = useWorkingLocation();
  const pack = usePack();
  const [asking, setAsking] = useState(false);
  const [asked, setAsked] = useState(false);

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
  if (!pack.box) return location ? <PackList pack={pack} /> : <NeedsLocation />;

  const box = pack.box;
  const total = pack.totals!;
  return (
    <>
      <JobScreen
        placeholder="Barcode or part number"
        onScan={(code) => void pack.scan(code)}
        banner={<JobBanner size="headline" family="outbound" title={box.order.order} detail={packingDetail(box.order)} />}
        result={pack.card ? <PackScanCard key={pack.card.key} card={pack.card.card} /> : null}
        action={
          <ActionBar
            label="Packed"
            icon="check"
            onPress={() => {
              if (!total.ready) return setAsked(true);
              setAsking(true);
            }}
          />
        }>
        <Tally
          items={[
            { value: quantityWords(total.inBox), label: `In the box of ${quantityWords(total.units)}` },
            { value: box.lines.length, label: box.lines.length === 1 ? 'Part' : 'Parts' },
          ]}
        />
        {asked && !total.ready ? <StatusStrip tone="stop" icon="stop" text={EACH_PART_FIRST} /> : null}
        {box.lines.map((line) => (
          <LineRow
            key={line.lineId}
            name={linePart(line)}
            code={line.part.description}
            status={
              full(line)
                ? { text: boxCount(line), icon: 'sent', tone: 'ok' }
                : { text: boxCount(line), icon: 'pack', tone: asked ? 'stop' : 'neutral' }
            }
            quantity={<Quantity total={inBox(line)} name={linePart(line)} onStep={(change) => pack.step(line.lineId, change)} onSet={(target) => pack.set(line.lineId, target)} />}
          />
        ))}
        <Button label="Another order" icon="back" variant="secondary" onPress={pack.close} />
      </JobScreen>
      <ParcelsSheet
        key={asking ? 'open' : 'closed'}
        visible={asking}
        onPacked={(parcels) => {
          setAsking(false);
          setAsked(false);
          void pack.pack(parcels);
        }}
        onClose={() => setAsking(false)}
      />
    </>
  );
}
