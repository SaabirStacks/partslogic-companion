import type { ReactNode } from 'react';
import { View } from 'react-native';

import { DeliverList, DeliverReceipt, DropView, NotDeliveredSheet, SignView } from '@/features/deliver/deliver-views';
import type { DeliverState, Signing } from '@/features/deliver/use-deliver';
import type { DriverDelivery, SignatureStroke } from '@/vendor/partslogic/shared/sales/delivery';

import { StackHeader } from './stack-header';

// Dev-only: Deliver (S5a-2c) in every state the copy deck names, from fixtures, for the review gallery
// (?screen=deliver-list). Orders, customers and parts as the demo has them.

const noop = () => {};
const today = (h: number, m: number) => new Date(new Date().setHours(h, m, 0, 0)).toISOString();
const NOW = today(14, 30);

const part = (id: number, brand: string, number: string, description: string | null = null) => ({ id, brand, number, description });

const delivery = (over: Partial<DriverDelivery>): DriverDelivery => ({
  orderId: 'o43',
  order: 'SO-000043',
  customer: 'Northway Fleet Services',
  phone: '0113 496 0000',
  address: { id: 4, kind: 'site', name: 'Northway depot', lines: 'Unit 4, Calder Park\nDenby Dale Road', town: 'Wakefield', county: null, postcode: 'WF1 2PL' },
  addressText: null,
  mine: true,
  driver: 'Alex Morgan',
  sentAt: today(9, 12),
  packed: true,
  parcels: 2,
  units: 3,
  lines: [
    { lineId: 1, part: part(6, 'MONROE', 'G16494', 'Shock absorber, front'), qty: 2 },
    { lineId: 2, part: part(9, 'BOSCH', '0 451 103 336', 'Oil filter'), qty: 1 },
  ],
  ...over,
});

const MINE = delivery({});
const LOOSE = delivery({
  orderId: 'o44', order: 'SO-000044', customer: 'Precision Bodyshop', phone: null, address: null,
  addressText: '27 Kirkstall Road\nLeeds LS3 1JN', packed: false, parcels: null, units: 1, sentAt: today(9, 40),
  lines: [{ lineId: 3, part: part(12, 'OSRAM', '64210NBU-HCB', 'Bulb, headlight'), qty: 1 }],
});
const BRANCH = delivery({
  orderId: 'o5', order: 'SO-000005', customer: 'Precision Bodyshop', mine: false, driver: 'Jo Baptiste', phone: '0113 496 0123',
  address: null, addressText: '27 Kirkstall Road\nLeeds LS3 1JN', sentAt: new Date(new Date(NOW).getTime() - 26 * 3600_000).toISOString(), units: 4,
  lines: [{ lineId: 4, part: part(15, 'BREMBO', 'P 06 036', 'Brake pads, front'), qty: 4 }],
});

type List = Parameters<typeof DeliverList>[0]['list'];
const list = (over: Partial<List>): List => ({
  online: true, location: 'Leeds branch', now: NOW, deliveries: [MINE, LOOSE, BRANCH], saved: false, problem: null, reload: noop, ...over,
});

// A signature as a finger draws one on a 358 by 200 pad: a looping first name, then a quick surname.
const STROKES: SignatureStroke[] = [
  Array.from({ length: 40 }, (_, t): [number, number] => [30 + t * 5, Math.round(105 - 55 * Math.sin(t / 4) * Math.exp(-t / 50))]),
  Array.from({ length: 28 }, (_, t): [number, number] => [240 + t * 3.5, Math.round(118 + 22 * Math.sin(t / 2))]),
];
const signing = (over: Partial<Signing>): Signing => ({ orderId: 'o43', name: '', strokes: [], size: { width: 358, height: 200 }, ...over });

function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="flex-1">
      <StackHeader title={title} />
      {children}
    </View>
  );
}

function Sign({ value, problem = null }: { value: Signing; problem?: Parameters<typeof SignView>[0]['problem'] }) {
  return (
    <Screen title="Deliver">
      <SignView delivery={MINE} signing={value} problem={problem} onName={noop} onDraw={noop} onClear={noop} onDelivered={noop} onBack={noop} />
    </Screen>
  );
}

const handed = (over: Partial<NonNullable<DeliverState['handed']>>): NonNullable<DeliverState['handed']> =>
  ({ kind: 'delivered', delivery: MINE, clientId: 'c', name: 'Jo Smith', signedAt: today(14, 5), state: 'sent', refusal: null, ...over }) as NonNullable<DeliverState['handed']>;

function Receipt({ value }: { value: NonNullable<DeliverState['handed']> }) {
  return (
    <Screen title="Deliver">
      <DeliverReceipt handed={value} now={NOW} onNext={noop} onDone={noop} />
    </Screen>
  );
}

export const DELIVER_SCREENS: Record<string, () => ReactNode> = {
  'deliver-list': () => (
    <Screen title="Deliver">
      <DeliverList list={list({})} onOpen={noop} />
    </Screen>
  ),
  'deliver-list-offline': () => (
    <Screen title="Deliver">
      <DeliverList list={list({ online: false, saved: true })} onOpen={noop} />
    </Screen>
  ),
  'deliver-nothing': () => (
    <Screen title="Deliver">
      <DeliverList list={list({ deliveries: [] })} onOpen={noop} />
    </Screen>
  ),
  'deliver-no-signal': () => (
    <Screen title="Deliver">
      <DeliverList list={list({ online: false, deliveries: null })} onOpen={noop} />
    </Screen>
  ),
  'deliver-drop': () => (
    <Screen title="Deliver">
      <DropView delivery={MINE} online onSign={noop} onNotDelivered={noop} onClose={noop} />
    </Screen>
  ),
  'deliver-drop-loose': () => (
    <Screen title="Deliver">
      <DropView delivery={LOOSE} online={false} onSign={noop} onNotDelivered={noop} onClose={noop} />
    </Screen>
  ),
  'deliver-not-delivered': () => (
    <Screen title="Deliver">
      <DropView delivery={MINE} online onSign={noop} onNotDelivered={noop} onClose={noop} />
      <NotDeliveredSheet order={MINE.order} visible onSave={async () => null} onClose={noop} />
    </Screen>
  ),
  'deliver-sign': () => <Sign value={signing({})} />,
  'deliver-sign-name': () => <Sign value={signing({ strokes: STROKES })} problem={{ field: 'name', message: 'Type the name of the person signing.' }} />,
  'deliver-sign-pad': () => <Sign value={signing({ name: 'Jo Smith' })} problem={{ field: 'signature', message: 'Ask the customer to sign.' }} />,
  'deliver-signed': () => <Sign value={signing({ name: 'Jo Smith', strokes: STROKES })} />,
  'deliver-receipt': () => <Receipt value={handed({})} />,
  'deliver-waiting': () => <Receipt value={handed({ state: 'waiting' })} />,
  'deliver-refused': () => <Receipt value={handed({ state: 'refused', refusal: 'This order was already marked delivered.' })} />,
  'deliver-not-delivered-receipt': () => <Receipt value={handed({ kind: 'not_delivered', reason: 'no_one_in' } as never)} />,
};
