import { View } from 'react-native';

import { BottomBar } from '@/ui/action-bar';
import { Button } from '@/ui/button';
import { ReceiptCard } from '@/ui/receipt';
import { Scroll } from '@/ui/scroll';
import type { ChipState } from '@/ui/status-chip';
import { StatusStrip } from '@/ui/status-strip';

import type { PickReceipt as Receipt } from './receipt';
import { refusedLine } from './words';

const CHIP: Record<Receipt['state'], ChipState> = {
  sending: { tone: 'neutral', icon: 'waiting', label: 'Sending' },
  sent: { tone: 'ok', icon: 'sent', label: 'Sent' },
  check: { tone: 'stop', icon: 'stop', label: 'Check in Sync' },
};

// The end of a pick job: where it stands (Sending, then Sent), what was picked and short, each order's stage once
// PartsLogic has the end (To pack, Ready for collection), and any pick it refused, in words with its order (P8).
export function PickReceipt({ receipt, onPack, onDone }: { receipt: Receipt; onPack: () => void; onDone: () => void }) {
  const packing = receipt.orders.some((order) => order.stage === 'To pack');
  return (
    <View className="flex-1 bg-ground">
      <Scroll toEdge={false} contentContainerClassName="flex-grow justify-center gap-3 px-4 pt-6">
        <ReceiptCard
          chip={CHIP[receipt.state]}
          reference="Pick job"
          line={receipt.line}
          rows={receipt.orders.map((order) => ({ label: order.number, value: order.stage ?? 'Sending' }))}
        />
        {receipt.refused.map((refusal) => (
          <StatusStrip key={refusal.key} tone="stop" icon="stop" text={refusedLine(refusal.order, refusal.reason)} />
        ))}
      </Scroll>
      <BottomBar className="gap-2">
        {packing ? <Button label="Pack" icon="pack" onPress={onPack} /> : null}
        <Button label="Done" variant={packing ? 'tinted' : 'primary'} onPress={onDone} />
      </BottomBar>
    </View>
  );
}
