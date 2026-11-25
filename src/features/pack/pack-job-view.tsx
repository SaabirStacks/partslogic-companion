import { useState } from 'react';

import { ActionBar } from '@/ui/action-bar';
import { Button } from '@/ui/button';
import { JobBanner } from '@/ui/job-banner';
import { JobScreen } from '@/ui/job-screen';
import { LineRow } from '@/ui/line-row';
import { Quantity } from '@/ui/quantity';
import { StatusStrip } from '@/ui/status-strip';
import { Tally } from '@/ui/tally';
import { quantityWords } from '@/vendor/partslogic/shared/sales/words';

import { boxTotals, full, inBox, type Box } from './pack';
import { PackScanCard, ParcelsSheet } from './pack-views';
import type { PackCard } from './use-pack';
import { boxCount, EACH_PART_FIRST, linePart, packingDetail } from './words';

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
  asked: initialAsked = false,
}: {
  box: Box;
  card: { key: string; card: PackCard } | null;
  onScan: (code: string) => void;
  onStep: (lineId: number, change: 1 | -1) => void;
  onSet: (lineId: number, target: number) => void;
  onPacked: (parcels: number) => void;
  onClose: () => void;
  asking?: boolean;
  asked?: boolean;
}) {
  const [asking, setAsking] = useState(initialAsking);
  // Packed pressed before every unit is in: the box says so, under its parts.
  const [asked, setAsked] = useState(initialAsked);
  const total = boxTotals(box);
  return (
    <>
      <JobScreen
        placeholder="Barcode or part number"
        onScan={onScan}
        banner={<JobBanner size="headline" family="outbound" title={box.order.order} detail={packingDetail(box.order)} />}
        result={card ? <PackScanCard key={card.key} card={card.card} /> : null}
        action={<ActionBar label="Packed" icon="check" onPress={() => (total.ready ? setAsking(true) : setAsked(true))} />}>
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
            status={full(line) ? { text: boxCount(line), icon: 'sent', tone: 'ok' } : { text: boxCount(line), icon: 'pack', tone: 'neutral' }}
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
          setAsked(false);
          onPacked(parcels);
        }}
        onClose={() => setAsking(false)}
      />
    </>
  );
}
