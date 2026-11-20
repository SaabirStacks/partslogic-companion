import { View } from 'react-native';

import { plural } from '@/lib/format';
import { Button } from '@/ui/button';
import type { ChipState } from '@/ui/status-chip';
import { ReceiptCard } from '@/ui/receipt';
import { Scroll } from '@/ui/scroll';
import { BottomBar } from '@/ui/action-bar';
import type { ReceiptRow } from '@/ui/receipt';
import type { CustomerShare } from '@/vendor/partslogic/shared/purchasing';

import type { Delivery } from './delivery-store';
import { receiptLine, type ReceiptSummary } from './receipt';

const CHIP: Record<ReceiptSummary['state'], ChipState> = {
  booked: { tone: 'ok', icon: 'sent', label: 'Delivery booked' },
  sending: { tone: 'neutral', icon: 'waiting', label: 'Sending' },
  check: { tone: 'stop', icon: 'stop', label: 'Check in Sync' },
};

// The end of Receive goods, as a receipt: where it stands, the receipt number, who it was from, then the
// numbers. Units for customers' sales orders are split out: put aside for each order on the collection shelf, the
// rest into Unbinned (S4b). Put away now goes straight to choosing a bin.
export function DeliveryReceipt({
  delivery,
  number,
  units,
  summary,
  putAside = [],
  onPutAway,
  onNext,
}: {
  delivery: Delivery;
  number: string | null;
  units: number;
  summary: ReceiptSummary;
  // What Check said goes to customers' sales orders.
  putAside?: CustomerShare[];
  onPutAway: () => void;
  onNext: () => void;
}) {
  const put = putAside.reduce((sum, share) => sum + share.units, 0);
  const rows: ReceiptRow[] = [
    ...(put > 0
      ? [
          { label: 'Put aside', value: `${plural(put, 'unit', 'units')} for ${plural(putAside.length, 'order', 'orders')}` },
          ...putAside.map((share) => ({ label: share.order, value: [share.units, share.customer].filter(Boolean).join(' · ') })),
        ]
      : []),
    { label: put > 0 ? 'Into Unbinned' : 'Units into Unbinned', value: put > 0 ? plural(Math.max(units - put, 0), 'unit', 'units') : units },
    { label: 'Codes', value: summary.codes },
    ...(summary.unknown > 0 ? [{ label: 'Unknown, kept for the office', value: summary.unknown, tone: 'warn' as const }] : []),
  ];
  return (
    <View className="flex-1 bg-ground">
      <Scroll toEdge={false} contentContainerClassName="flex-grow justify-center gap-4 px-4 pt-6">
        <ReceiptCard
          chip={CHIP[summary.state]}
          reference={number ?? 'Not sent yet'}
          line={receiptLine(delivery)}
          rows={rows}
          accessibilityLabel={`${CHIP[summary.state].label}. ${number ?? 'Not sent yet'}. ${receiptLine(delivery)}. ${plural(units, 'unit', 'units')}`}
        />
      </Scroll>
      <BottomBar className="gap-2">
        <Button label="Put away now" icon="putAway" onPress={onPutAway} />
        <Button label="Next delivery" variant="tinted" onPress={onNext} />
      </BottomBar>
    </View>
  );
}
