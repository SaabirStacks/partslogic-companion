import { View } from 'react-native';

import { plural } from '@/lib/format';
import { Button } from '@/ui/button';
import type { ChipState } from '@/ui/status-chip';
import { StatusChip } from '@/ui/status-chip';
import { Card } from '@/ui/surface';
import { Txt } from '@/ui/text';
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
  const place = delivery.locationName ? `${delivery.locationName} Unbinned` : 'Unbinned';
  const rows: [string, number][] = [
    [`Units into ${place}`, units],
    ['Codes', summary.codes],
    ...(summary.unknown > 0 ? ([['Unknown, kept for the office', summary.unknown]] as [string, number][]) : []),
  ];
  return (
    <View className="flex-1 bg-ground">
      <Scroll toEdge={false} contentContainerClassName="flex-grow justify-center gap-4 px-4 pt-6">
        <Card
          accessible
          accessibilityLabel={`${CHIP[summary.state].label}. ${number ?? 'Not sent yet'}. ${receiptLine(delivery)}. ${plural(units, 'unit', 'units')}`}
          className="gap-4 p-5">
          <View className="items-center gap-2">
            <StatusChip {...CHIP[summary.state]} />
            <Txt accessibilityRole="header" variant="display" className="text-center">
              {number ?? 'Not sent yet'}
            </Txt>
            <Txt variant="caption" numbers className="text-center">
              {receiptLine(delivery)}
            </Txt>
          </View>
          <View className="border-t border-rule pt-1">
            {rows.map(([label, value]) => (
              <View key={label} className="min-h-11 flex-row items-center justify-between gap-3">
                <Txt variant="body" numberOfLines={1} className="flex-1">
                  {label}
                </Txt>
                <Txt variant="label" numbers className="font-extrabold">
                  {value}
                </Txt>
              </View>
            ))}
          </View>
        </Card>
      </Scroll>
      <BottomBar className="gap-2">
        <Button label="Put away now" icon="putAway" onPress={onPutAway} />
        <Button label="Next delivery" variant="secondary" onPress={onNext} />
      </BottomBar>
    </View>
  );
}
