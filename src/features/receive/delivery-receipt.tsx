import { View } from 'react-native';

import { plural } from '@/lib/format';
import { Button } from '@/ui/button';
import type { ChipState } from '@/ui/status-chip';
import { ReceiptCard } from '@/ui/receipt';
import { Scroll } from '@/ui/scroll';
import { BottomBar } from '@/ui/action-bar';

import type { Delivery } from './delivery-store';
import { receiptLine, type ReceiptSummary } from './receipt';

const CHIP: Record<ReceiptSummary['state'], ChipState> = {
  booked: { tone: 'ok', icon: 'sent', label: 'Delivery booked' },
  sending: { tone: 'neutral', icon: 'waiting', label: 'Sending' },
  check: { tone: 'stop', icon: 'stop', label: 'Check in Sync' },
};

// The end of Receive goods, as a receipt: where it stands, the receipt number, who it was from, then the
// numbers. Put away now goes straight to choosing a bin.
export function DeliveryReceipt({
  delivery,
  number,
  units,
  summary,
  onPutAway,
  onNext,
}: {
  delivery: Delivery;
  number: string | null;
  units: number;
  summary: ReceiptSummary;
  onPutAway: () => void;
  onNext: () => void;
}) {
  const rows: [string, number][] = [
    ['Units into Unbinned', units],
    ['Codes', summary.codes],
    ...(summary.unknown > 0 ? ([['Unknown, kept for the office', summary.unknown]] as [string, number][]) : []),
  ];
  return (
    <View className="flex-1 bg-ground">
      <Scroll toEdge={false} contentContainerClassName="flex-grow justify-center gap-4 px-4 pt-6">
        <ReceiptCard
          chip={CHIP[summary.state]}
          reference={number ?? 'Not sent yet'}
          line={receiptLine(delivery)}
          rows={rows.map(([label, value]) => ({ label, value, tone: label.startsWith('Unknown') ? 'warn' : undefined }))}
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
