import { View } from 'react-native';

import { Button } from '@/ui/button';
import { ScanResultCard } from '@/ui/scan-result-card';
import { binLabel } from '@/vendor/partslogic/shared/sales/picking';
import { quantityWords } from '@/vendor/partslogic/shared/sales/words';

import { picked, type JobRow } from './job';
import type { PickCard as Card } from './scan-card';
import { NOT_ON_PICK, partName, putWith, SPARE_BACK, spareLine, thisBin } from './words';

// The answer to a scan in a pick job, over the camera's edge: the part and which order it goes with, or why the
// scan didn't count. Nothing waits on it: the next scan replaces it (P6).
export function PickCard({ card, onShortPick, onDismiss }: { card: Card; onShortPick: (row: JobRow) => void; onDismiss: () => void }) {
  switch (card.kind) {
    case 'added':
      return (
        <ScanResultCard
          tone="ok"
          status={card.complete ? { icon: 'sent', label: 'Row picked' } : { icon: 'sent', label: 'Picked' }}
          title={partName(card.row)}
          detail={putWith(card.row)}
          quantity={{ value: quantityWords(picked(card.row)), label: `of ${quantityWords(card.row.want)}` }}
        />
      );
    case 'spare':
      return <ScanResultCard tone="warn" status={{ icon: 'warning', label: spareLine(card.want) }} title={partName(card.row)} detail={SPARE_BACK} />;
    case 'not_on_pick':
      return (
        <ScanResultCard tone="warn" status={{ icon: 'warning', label: NOT_ON_PICK }} title={card.scanned} detail={thisBin(card.here)}>
          <View className="flex-row gap-2">
            {card.here ? (
              <View className="flex-1">
                <Button label="Short pick" variant="tinted" compact onPress={() => onShortPick(card.here!)} />
              </View>
            ) : null}
            <View className="flex-1">
              <Button label="Scan again" variant="secondary" compact onPress={onDismiss} />
            </View>
          </View>
        </ScanResultCard>
      );
    case 'bin':
      return <ScanResultCard tone="warn" status={{ icon: 'bin', label: 'A bin label' }} title={binLabel(card.bin)} detail="Scan the part" />;
    case 'offline':
      return (
        <ScanResultCard tone="neutral" status={{ icon: 'offline', label: 'Not checked' }} title={card.code} detail="No signal · use Can’t scan on its row" />
      );
    case 'error':
      return <ScanResultCard tone="stop" status={{ icon: 'stop', label: 'Not checked' }} title={card.code} detail={card.message} />;
  }
}
