import { useState } from 'react';
import { View } from 'react-native';

import { BottomBar } from '@/ui/action-bar';
import { Button } from '@/ui/button';
import { Icon } from '@/ui/icon';
import { Notice } from '@/ui/notice';
import { Quantity } from '@/ui/quantity';
import { ReceiptCard } from '@/ui/receipt';
import { ScanResultCard } from '@/ui/scan-result-card';
import { Scroll } from '@/ui/scroll';
import { SectionLabel } from '@/ui/section-label';
import { Sheet } from '@/ui/sheet';
import { StatusStrip } from '@/ui/status-strip';
import { PressableCard } from '@/ui/surface';
import { Txt } from '@/ui/text';
import { PARCELS_MAX, PARCELS_MIN } from '@/vendor/partslogic/shared/sales/packing';
import { binLabel, packingOrderLine, pickingCustomer, type PackingOrder } from '@/vendor/partslogic/shared/sales/picking';
import { quantityWords } from '@/vendor/partslogic/shared/sales/words';

import { inBox } from './pack';
import type { PackCard, PackState } from './use-pack';
import { allInBox, linePart, NO_SIGNAL_TO_PACK, NOT_ON_ORDER, NOTHING_TO_PACK, PARCELS_QUESTION } from './words';

// The branch's deliveries to pack, urgent first as PartsLogic lists them: "SO-000015 · Northway Fleet Services ·
// 3 units · Shipley BD18". Each opens its packing.
export function PackList({
  online,
  orders,
  problem,
  onRetry,
  onOpen,
}: {
  online: boolean;
  // Undefined while the list is loading, or when it couldn't be read (problem says why).
  orders: PackingOrder[] | undefined;
  problem: string | null;
  onRetry: () => void;
  onOpen: (order: PackingOrder) => void;
}) {
  if (!online) return <Notice icon="offline" tone="warn" title={NO_SIGNAL_TO_PACK.title} line={NO_SIGNAL_TO_PACK.line} />;
  if (!orders) {
    return (
      <Notice icon="pack" tone={problem ? 'stop' : 'neutral'} title={problem ? 'Not checked' : 'Checking what to pack'} line={problem}>
        {problem ? <Button label="Try again" icon="retry" variant="tinted" onPress={onRetry} /> : null}
      </Notice>
    );
  }
  if (orders.length === 0) return <Notice icon="sent" tone="neutral" title={NOTHING_TO_PACK.title} line={NOTHING_TO_PACK.line} />;
  return (
    <Scroll toEdge contentContainerClassName="gap-2 px-4 pt-3">
      <SectionLabel>{`To pack · ${orders.length} ${orders.length === 1 ? 'order' : 'orders'}`}</SectionLabel>
      {orders.map((order) => (
        <OrderRow key={order.orderId} order={order} onPress={() => onOpen(order)} />
      ))}
    </Scroll>
  );
}

function OrderRow({ order, onPress }: { order: PackingOrder; onPress: () => void }) {
  const line = packingOrderLine(order);
  return (
    <PressableCard accessibilityLabel={`Pack ${order.order}, ${pickingCustomer(order.customer)}, ${line}`} onPress={onPress} className="min-h-16 flex-row items-center gap-3 px-4 py-3">
      <View className="flex-1 gap-0.5">
        <Txt variant="label" numbers className="font-bold">
          {order.urgent ? `${order.order} · Urgent` : order.order}
        </Txt>
        <Txt variant="caption" numberOfLines={1}>
          {pickingCustomer(order.customer)}
        </Txt>
        <Txt variant="caption" numbers numberOfLines={2}>
          {line}
        </Txt>
      </View>
      <Icon name="forward" size={16} colour="quiet-ink" />
    </PressableCard>
  );
}

// The answer to a scan while packing, over the camera's edge.
export function PackScanCard({ card }: { card: PackCard }) {
  switch (card.kind) {
    case 'added':
      return (
        <ScanResultCard
          tone="ok"
          status={{ icon: 'sent', label: card.complete ? 'All in the box' : 'In the box' }}
          title={linePart(card.line)}
          quantity={{ value: quantityWords(inBox(card.line)), label: `of ${quantityWords(card.line.qty)}` }}
        />
      );
    case 'spare':
      return <ScanResultCard tone="warn" status={{ icon: 'warning', label: allInBox(card.line.qty) }} title={linePart(card.line)} detail="Put the spare back" />;
    case 'not_on_order':
      return <ScanResultCard tone="warn" status={{ icon: 'warning', label: NOT_ON_ORDER }} title={card.scanned} />;
    case 'bin':
      return <ScanResultCard tone="warn" status={{ icon: 'bin', label: 'A bin label' }} title={binLabel(card.bin)} detail="Scan the part" />;
    case 'offline':
      return <ScanResultCard tone="neutral" status={{ icon: 'offline', label: 'Not checked' }} title={card.code} detail="No signal · use + on its row" />;
    case 'error':
      return <ScanResultCard tone="stop" status={{ icon: 'stop', label: 'Not checked' }} title={card.code} detail={card.message} />;
  }
}

// How many parcels, from 1 (owner, 25 November 2026), then Packed.
export function ParcelsSheet({ visible, onPacked, onClose }: { visible: boolean; onPacked: (parcels: number) => void; onClose: () => void }) {
  const [parcels, setParcels] = useState(PARCELS_MIN);
  const clamp = (value: number) => Math.max(PARCELS_MIN, Math.min(PARCELS_MAX, Math.round(value)));
  return (
    <Sheet visible={visible} title={PARCELS_QUESTION} onClose={onClose}>
      <View className="flex-row items-center justify-between gap-3">
        <Txt variant="label" className="font-bold">
          Parcels
        </Txt>
        <Quantity total={parcels} name="parcels" onStep={(change) => setParcels((now) => clamp(now + change))} onSet={(target) => setParcels(clamp(target))} />
      </View>
      <View className="gap-2">
        <Button label="Packed" icon="check" onPress={() => onPacked(parcels)} />
        <Button label="Cancel" variant="secondary" onPress={onClose} />
      </View>
    </Sheet>
  );
}

// After Packed: SO-000015 · 2 parcels · Ready for delivery, once PartsLogic has it.
export function PackReceipt({ packed, onNext, onDone }: { packed: NonNullable<PackState['packed']>; onNext: () => void; onDone: () => void }) {
  const chip = packed.refused
    ? ({ tone: 'stop', icon: 'stop', label: 'Check in Sync' } as const)
    : packed.sent
      ? ({ tone: 'ok', icon: 'sent', label: 'Packed' } as const)
      : ({ tone: 'neutral', icon: 'waiting', label: 'Sending' } as const);
  return (
    <View className="flex-1 bg-ground">
      <Scroll toEdge={false} contentContainerClassName="flex-grow justify-center gap-3 px-4 pt-6">
        <ReceiptCard
          chip={chip}
          reference={packed.order.order}
          line={[packed.words, packed.sent ? 'Ready for delivery' : null].filter(Boolean).join(' · ')}
          rows={[{ label: pickingCustomer(packed.order.customer), value: quantityWords(packed.order.units) + (packed.order.units === 1 ? ' unit' : ' units') }]}
        />
        {packed.refused ? <StatusStrip tone="stop" icon="stop" text={packed.refused} /> : null}
      </Scroll>
      <BottomBar className="gap-2">
        <Button label="Next order" icon="pack" onPress={onNext} />
        <Button label="Done" variant="tinted" onPress={onDone} />
      </BottomBar>
    </View>
  );
}
