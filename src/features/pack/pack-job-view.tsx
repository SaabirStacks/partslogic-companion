import { useState } from 'react';

import { ActionBar } from '@/ui/action-bar';
import { Button } from '@/ui/button';
import { JobBanner } from '@/ui/job-banner';
import { JobScreen } from '@/ui/job-screen';
import { LineRow } from '@/ui/line-row';
import { Quantity } from '@/ui/quantity';
import { Tally } from '@/ui/tally';
import { quantityWords } from '@/vendor/partslogic/shared/sales/words';

import { boxTotals, full, inBox, type Box } from './pack';
import { PackScanCard, ParcelsSheet } from './pack-views';
import type { PackCard } from './use-pack';
import { boxCount, boxProgress, linePart, packingDetail } from './words';

// Packing one delivery: the order (large) and where it goes, the camera, the last scan's card, how much is in the box,
// each part with − and + for one that won't scan, and Packed in the thumb zone, which asks how many parcels. Drawn
// from its props, so the review gallery shows it from fixtures.
export function PackJobView({
  box,
  card,
  onScan,
  onStep,
  onSet,
  onPacked,
  onClose,
  asking: initialAsking = false,
}: {
  box: Box;
  card: { key: string; card: PackCard } | null;
  onScan: (code: string) => void;
  onStep: (lineId: number, change: 1 | -1) => void;
  onSet: (lineId: number, target: number) => void;
  onPacked: (parcels: number) => void;
  onClose: () => void;
  asking?: boolean;
}) {
  const [asking, setAsking] = useState(initialAsking);
  const total = boxTotals(box);
  return (
    <>
      <JobScreen
        placeholder="Barcode or part number"
        onScan={onScan}
        banner={<JobBanner size="headline" family="outbound" title={box.order.order} detail={packingDetail(box.order)} />}
        result={card ? <PackScanCard key={card.key} card={card.card} /> : null}
        // Packed waits for every unit in the box, and says how far it is till then (critique A, F8).
        action={
          <ActionBar
            label={total.ready ? 'Packed' : boxProgress(total.inBox, total.units)}
            icon={total.ready ? 'check' : undefined}
            disabled={!total.ready}
            onPress={() => setAsking(true)}
          />
        }>
        <Tally
          items={[
            { value: quantityWords(total.inBox), label: `In the box of ${quantityWords(total.units)}` },
            { value: box.lines.length, label: box.lines.length === 1 ? 'Part' : 'Parts' },
          ]}
        />
        {box.lines.map((line) => (
          <LineRow
            key={line.lineId}
            name={linePart(line)}
            code={line.part.description}
            status={full(line) ? { text: boxCount(line), icon: 'sent', tone: 'ok' } : { text: boxCount(line), icon: 'waiting', tone: 'neutral' }}
            quantity={<Quantity total={inBox(line)} name={linePart(line)} onStep={(change) => onStep(line.lineId, change)} onSet={(target) => onSet(line.lineId, target)} />}
          />
        ))}
        <Button label="Another order" icon="back" variant="secondary" onPress={onClose} />
      </JobScreen>
      <ParcelsSheet
        key={asking ? 'open' : 'closed'}
        visible={asking}
        onPacked={(parcels) => {
          setAsking(false);
          onPacked(parcels);
        }}
        onClose={() => setAsking(false)}
      />
    </>
  );
}
