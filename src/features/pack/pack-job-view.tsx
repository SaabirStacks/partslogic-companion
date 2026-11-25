import { useState } from 'react';
import { View } from 'react-native';

import { ActionBar } from '@/ui/action-bar';
import { ConfirmSheet } from '@/ui/confirm-sheet';
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
import { boxProgress, LEAVE_NOTE, linePart, PACK_OFFLINE, packingDetail, toGo } from './words';

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
  const [leaving, setLeaving] = useState(false);
  const total = boxTotals(box);
  return (
    <>
      <JobScreen
        placeholder="Barcode or part number"
        onScan={onScan}
        offlineText={PACK_OFFLINE}
        // No scan counts while Packed's sheet is open (DESIGN.md: a sheet pauses the camera).
        scanEnabled={!asking && !leaving}
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
            { value: quantityWords(total.inBox), label: `In the box of\u00a0${quantityWords(total.units)}` },
            { value: box.lines.length, label: box.lines.length === 1 ? 'Part' : 'Parts' },
          ]}
        />
        {box.lines.map((line) => (
          // The part number gets the row's whole width (it never wraps inside itself, P7); − n + sits under it.
          <LineRow
            key={line.lineId}
            name={linePart(line)}
            code={line.part.description}
            status={full(line) ? { text: 'All in the box', icon: 'sent', tone: 'ok' } : { text: toGo(line), icon: 'waiting', tone: 'neutral' }}
            quantity={null}>
            <View className="items-end">
              <Quantity total={inBox(line)} name={linePart(line)} onStep={(change) => onStep(line.lineId, change)} onSet={(target) => onSet(line.lineId, target)} />
            </View>
          </LineRow>
        ))}
        <Button label="Another order" icon="back" variant="secondary" onPress={() => (total.inBox > 0 ? setLeaving(true) : onClose())} />
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
      <ConfirmSheet
        visible={leaving}
        title={`Leave ${box.order.order}?`}
        note={LEAVE_NOTE}
        confirm={{
          label: 'Leave',
          onPress: () => {
            setLeaving(false);
            onClose();
          },
        }}
        cancelLabel="Keep packing"
        onCancel={() => setLeaving(false)}
      />
    </>
  );
}
