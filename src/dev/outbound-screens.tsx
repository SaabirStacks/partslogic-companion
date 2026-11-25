import type { ReactNode } from 'react';
import { View } from 'react-native';

import { BoardView } from '@/features/board/board-view';
import { syncState } from '@/features/board/sync-state';
import { openBox, scanIntoBox, stepLine, type Box } from '@/features/pack/pack';
import { PackJobView } from '@/features/pack/pack-job-view';
import { PackList, PackReceipt } from '@/features/pack/pack-views';
import type { PackCard } from '@/features/pack/use-pack';
import { fromServerJob, scanPart, shortRow, tapRow, totals, type LocalPickJob } from '@/features/pick/job';
import { PickJobView } from '@/features/pick/pick-job-view';
import { PickReceipt } from '@/features/pick/pick-receipt';
import { PickStart } from '@/features/pick/pick-start';
import type { PickCard } from '@/features/pick/scan-card';
import { NetworkContext } from '@/lib/network';
import type { PickJob, PickJobStatus } from '@/vendor/partslogic/shared/sales/pick-jobs';
import type { PackingOrder } from '@/vendor/partslogic/shared/sales/picking';
import { boardFor } from '@/workflows/catalogue';

import { StackHeader } from './stack-header';

// Dev-only: the outbound jobs (S5b, Pick and Pack) in every state the copy deck names, from fixtures, for the review
// gallery (?screen=pick-job). Orders, parts and bins as the demo has them.

const noop = () => {};
const startedAt = new Date(new Date().setHours(8, 10, 0, 0)).toISOString();

const part = (id: number, brand: string, number: string, description: string | null = null) => ({ id, brand, number, description });
const MANN = part(6, 'MANN-FILTER', 'C 35 154', 'Air filter');
const BOSCH = part(9, 'BOSCH', '0 451 103 336', 'Oil filter');
const BREMBO = part(12, 'BREMBO', 'P 06 036', 'Brake pads, front');
const NGK = part(15, 'NGK', 'BKR6E', 'Spark plug');

const row = (over: Partial<PickJob['rows'][number]>): PickJob['rows'][number] => ({
  lineId: 1, orderId: 'o19', order: 'SO-000019', customer: 'Northway Fleet Services', urgent: false, part: MANN,
  binId: 2, bin: 'B-02', qty: 2, notFound: null, picker: null, ...over,
});

const SERVER_JOB: PickJob = {
  id: 'j1', locationId: 1, location: 'Leeds branch', startedAt, endedAt: null, endedHow: null,
  orders: [
    { id: 'o21', number: 'SO-000021', customer: 'Calder Motors', urgent: true, method: 'collection', fulfilment: 'to_pick' },
    { id: 'o19', number: 'SO-000019', customer: 'Northway Fleet Services', urgent: false, method: 'delivery', fulfilment: 'to_pick' },
    { id: 'o23', number: 'SO-000023', customer: 'A. Patel', urgent: false, method: 'collection', fulfilment: 'to_pick' },
    { id: 'o24', number: 'SO-000024', customer: 'Shipley Taxis', urgent: false, method: 'delivery', fulfilment: 'to_pick' },
  ],
  rows: [
    row({ lineId: 7, orderId: 'o21', order: 'SO-000021', urgent: true, part: BREMBO, binId: 1, bin: 'A-04', qty: 1 }),
    row({ lineId: 1 }),
    row({ lineId: 3, orderId: 'o23', order: 'SO-000023', part: MANN, qty: 1 }),
    row({ lineId: 4, orderId: 'o24', order: 'SO-000024', part: BOSCH, binId: 3, bin: 'C-02', qty: 4 }),
    row({ lineId: 5, orderId: 'o19', order: 'SO-000019', part: NGK, binId: 5, bin: 'D-01', qty: 4 }),
    row({ lineId: 6, orderId: 'o23', order: 'SO-000023', part: part(18, 'FEBI', '27 351'), binId: null, bin: null, qty: 1 }),
  ],
  picked: [],
  now: startedAt,
};

const fresh = () => fromServerJob(SERVER_JOB, 'u1');
// The urgent row picked, then one of two in B-02: the walk is at B-02.
function midway(): LocalPickJob {
  let job = scanPart(fresh(), 12).job;
  job = scanPart(job, 6).job;
  return job;
}
const midwayRow = () => midway().rows.find((candidate) => candidate.key === '1:2')!;
function nearlyDone(): LocalPickJob {
  let job = midway();
  for (let i = 0; i < 2; i += 1) job = scanPart(job, 6).job;
  job = tapRow(job, '4:3', 4, 'label');
  job = shortRow(job, '5:5', 1, 'bin_empty');
  return job;
}

function Pick({ job, card = null, refused = [], sheet = null, confirming = null, online = true }: {
  job: LocalPickJob;
  card?: PickCard | null;
  refused?: { key: string; order: string; reason: string }[];
  sheet?: { key: string; start: 'menu' | 'cant' | 'short' } | null;
  confirming?: 'finish' | 'stop' | null;
  online?: boolean;
}) {
  return (
    <NetworkContext value={online}>
      <View className="flex-1">
        <StackHeader title="Pick" />
        <PickJobView
          job={job}
          totals={totals(job)}
          card={card ? { key: 'k', card } : null}
          lastRow={job.rows.find((candidate) => candidate.scanned + candidate.tapped > 0 && !candidate.short) ?? null}
          refused={refused}
          onScan={noop}
          onDismissCard={noop}
          onTap={noop}
          onShort={noop}
          onUndo={noop}
          onEnd={noop}
          sheet={sheet}
          confirming={confirming}
        />
      </View>
    </NetworkContext>
  );
}

const STATUS: PickJobStatus = {
  locationId: 1, location: 'Leeds branch', toPick: 20, orders: 11, freeOrders: 9, toPack: 2, job: null, canPick: true, now: startedAt,
};

function Start({ status, online = true }: { status: PickJobStatus | undefined; online?: boolean }) {
  return (
    <View className="flex-1">
      <StackHeader title="Pick" />
      <PickStart status={status} online={online} loading={false} busy={false} problem={null} onStart={noop} onPack={noop} />
    </View>
  );
}

const ORDER: PackingOrder = {
  orderId: 'o15', order: 'SO-000015', customer: 'Northway Fleet Services', urgent: false, units: 3,
  address: null, addressText: 'Unit 4, Dockfield Road\nShipley BD18 3AB',
  lines: [
    { lineId: 31, part: MANN, qty: 2 },
    { lineId: 32, part: BOSCH, qty: 1 },
  ],
};
const ORDERS: PackingOrder[] = [
  { ...ORDER, urgent: true },
  { orderId: 'o24', order: 'SO-000024', customer: 'Shipley Taxis', urgent: false, units: 12, address: null, addressText: '1 Market Street\nBradford BD1 1AA', lines: [] },
];
const halfBox = (): Box => scanIntoBox(openBox(ORDER), 6).box;
const fullBox = (): Box => stepLine(scanIntoBox(halfBox(), 6).box, 32, 1);

function PackJob({ box, card = null, asking = false }: { box: Box; card?: PackCard | null; asking?: boolean }) {
  return (
    <View className="flex-1">
      <StackHeader title="Pack" />
      <PackJobView box={box} card={card ? { key: 'k', card } : null} onScan={noop} onStep={noop} onSet={noop} onPacked={noop} onClose={noop} asking={asking} />
    </View>
  );
}

function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="flex-1">
      <StackHeader title={title} />
      {children}
    </View>
  );
}

const ORDER_STAGES = [
  { id: 'o21', number: 'SO-000021', stage: 'Ready for collection' },
  { id: 'o19', number: 'SO-000019', stage: 'To pack' },
  { id: 'o23', number: 'SO-000023', stage: 'To pick' },
  { id: 'o24', number: 'SO-000024', stage: 'To pack' },
];

export const OUTBOUND_SCREENS: Record<string, () => ReactNode> = {
  'board-outbound': () => (
    <BoardView
      sections={boardFor('counter')}
      openWork={[]}
      unbinned={24}
      outbound={{ toPick: 20, toPack: 2 }}
      location="Leeds branch"
      sync={syncState({ waiting: 0, needsAttention: 0, online: true })}
      onJob={noop}
      onResume={noop}
      onLocation={noop}
      onSync={noop}
      onAccount={noop}
    />
  ),
  'board-picking': () => (
    <BoardView
      sections={boardFor('counter')}
      openWork={[{ kind: 'pick', picked: 6, units: 14, startedAt }]}
      outbound={{ toPick: 20, toPack: 2 }}
      location="Leeds branch"
      sync={syncState({ waiting: 4, needsAttention: 0, online: false })}
      onJob={noop}
      onResume={noop}
      onLocation={noop}
      onSync={noop}
      onAccount={noop}
    />
  ),
  'pick-ready': () => <Start status={STATUS} />,
  'pick-nothing': () => <Start status={{ ...STATUS, toPick: 0, orders: 0, freeOrders: 0 }} />,
  'pick-all-claimed': () => <Start status={{ ...STATUS, freeOrders: 0 }} />,
  'pick-own-job': () => <Start status={{ ...STATUS, job: { id: 'j1', picked: 6, toPick: 8 } }} />,
  'pick-no-signal': () => <Start status={undefined} online={false} />,
  'pick-job': () => <Pick job={midway()} card={{ kind: 'added', row: midwayRow(), complete: false }} />,
  'pick-job-start': () => <Pick job={fresh()} />,
  'pick-not-on-pick': () => <Pick job={midway()} card={{ kind: 'not_on_pick', scanned: 'BOSCH 0 986 452 041', here: midwayRow() }} />,
  'pick-spare': () => {
    const job = scanPart(scanPart(midway(), 6).job, 6).job;
    return <Pick job={job} card={{ kind: 'spare', row: job.rows.find((candidate) => candidate.key === '3:2')!, want: 3 }} />;
  },
  'pick-bin-label': () => <Pick job={midway()} card={{ kind: 'bin', bin: 'B-02' }} />,
  'pick-offline': () => <Pick job={midway()} online={false} card={{ kind: 'offline', code: '4011558726304' }} />,
  'pick-row-menu': () => <Pick job={midway()} sheet={{ key: '1:2', start: 'menu' }} />,
  'pick-short': () => <Pick job={midway()} sheet={{ key: '1:2', start: 'short' }} />,
  'pick-cant-scan': () => <Pick job={midway()} sheet={{ key: '4:3', start: 'cant' }} />,
  // A small job, so its foot (Stop picking) is in view.
  'pick-job-foot': () => {
    const job = fromServerJob({ ...SERVER_JOB, orders: SERVER_JOB.orders.slice(0, 1), rows: SERVER_JOB.rows.slice(0, 1) }, 'u1');
    return <Pick job={job} />;
  },
  'pick-near-end': () => <Pick job={nearlyDone()} />,
  'pick-refused': () => (
    <Pick job={nearlyDone()} refused={[{ key: 'r', order: 'SO-000019', reason: 'Only 0 in D-01 on the books. Count the bin, then pick.' }]} />
  ),
  'pick-finish': () => <Pick job={midway()} confirming="finish" />,
  'pick-stop': () => <Pick job={midway()} confirming="stop" />,
  'pick-receipt-sending': () => (
    <Screen title="Pick">
      <PickReceipt receipt={{ state: 'sending', line: '12 picked · 1 short · 4 orders', orders: ORDER_STAGES.map((order) => ({ ...order, stage: null })), refused: [] }} onPack={noop} onDone={noop} />
    </Screen>
  ),
  'pick-receipt-sent': () => (
    <Screen title="Pick">
      <PickReceipt receipt={{ state: 'sent', line: '11 picked · 1 short · 4 orders', orders: ORDER_STAGES, refused: [] }} onPack={noop} onDone={noop} />
    </Screen>
  ),
  'pick-receipt': () => (
    <Screen title="Pick">
      <PickReceipt
        receipt={{
          state: 'check',
          line: '11 picked · 1 short · 4 orders',
          orders: ORDER_STAGES,
          refused: [{ key: 'r', order: 'SO-000023', reason: 'Only 0 in B-02 on the books. Count the bin, then pick.' }],
        }}
        onPack={noop}
        onDone={noop}
      />
    </Screen>
  ),
  'pack-list': () => (
    <Screen title="Pack">
      <PackList online orders={ORDERS} problem={null} onRetry={noop} onOpen={noop} />
    </Screen>
  ),
  'pack-nothing': () => (
    <Screen title="Pack">
      <PackList online orders={[]} problem={null} onRetry={noop} onOpen={noop} />
    </Screen>
  ),
  'pack-no-signal': () => (
    <Screen title="Pack">
      <PackList online={false} orders={undefined} problem={null} onRetry={noop} onOpen={noop} />
    </Screen>
  ),
  'pack-job': () => <PackJob box={halfBox()} card={{ kind: 'added', line: halfBox().lines[0], complete: false }} />,
  'pack-not-on-order': () => <PackJob box={halfBox()} card={{ kind: 'not_on_order', scanned: 'NGK BKR6E' }} />,
  'pack-ready': () => <PackJob box={fullBox()} />,
  'pack-parcels': () => <PackJob box={fullBox()} asking />,
  'pack-receipt': () => (
    <Screen title="Pack">
      <PackReceipt packed={{ order: ORDER, parcels: 2, clientId: 'c', words: '2 parcels', sent: true, refused: null }} onNext={noop} onDone={noop} />
    </Screen>
  ),
};
