import type { ReactNode } from 'react';

import { OutboxContext, type OutboxContextValue } from '@/queue/outbox-provider';
import type { OutboxItem } from '@/queue/types';
import { ScanIndexContext, type ScanIndexContextValue } from '@/scan/scan-index-provider';
import { LocationContext, type LocationContextValue } from '@/session/location-provider';
import { SessionContext, type SessionContextValue } from '@/session/session-provider';
import type { SessionState } from '@/session/session-state';

// Dev-only stand-ins for the app's providers, so the review gallery can draw the real screens without
// signing in, a database or a network. Nothing here runs on a phone.

const noop = () => {};
const later = async () => {};

export const LOCATIONS = [
  { id: 1, code: 'MAIN', name: 'Main' },
  { id: 2, code: 'VAN1', name: 'Van 1' },
  { id: 3, code: 'BR2', name: 'Branch 2' },
];

export const MEMBER: SessionState = {
  status: 'member',
  email: 'counter@example.com',
  member: { userId: 'fixture', role: 'counter', workspaceName: 'Eclipse Auto Parts', currency: 'GBP' },
};

export function Fixtures({
  session = MEMBER,
  waiting = 0,
  needsAttention = 0,
  items = [],
  children,
}: {
  session?: SessionState;
  waiting?: number;
  needsAttention?: number;
  items?: OutboxItem[];
  children: ReactNode;
}) {
  const sessionValue: SessionContextValue = { state: session, checking: false, signIn: async () => null, signOut: later, retry: noop };
  const locationValue: LocationContextValue = { location: LOCATIONS[0], locations: LOCATIONS, status: 'ready', choose: noop, refresh: noop };
  const outboxValue: OutboxContextValue = {
    enqueue: later,
    items,
    waiting,
    needsAttention,
    lastSentAt: items.find((item) => item.status === 'done')?.updatedAt ?? null,
    lastProblem: null,
    retry: later,
    sendNow: noop,
  };
  const scanIndexValue: ScanIndexContextValue = { saved: null, progress: null, failed: false, update: noop };
  return (
    <SessionContext value={sessionValue}>
      <LocationContext value={locationValue}>
        <OutboxContext value={outboxValue}>
          <ScanIndexContext value={scanIndexValue}>{children}</ScanIndexContext>
        </OutboxContext>
      </LocationContext>
    </SessionContext>
  );
}

// A stocked oil filter, as PartsLogic would return it (only the fields the screens read).
export const OIL_FILTER = {
  part: { id: 7, brandId: 1, brand: 'Mann', number: 'HU 816 x', kind: 'part', description: 'Oil filter', tecdocAlias: null, categoryId: null, redirectedFrom: null },
  displayName: null,
  categoryTrail: ['Filters', 'Oil filters'],
  sourceCategory: null,
  images: [],
  barcodes: [{ display: '4011558726304' }],
  prices: [],
  oeNumbers: [],
  enrichment: null,
  item: {
    isStocked: true,
    onHand: 12,
    belowReorder: false,
    sellPrice: 9.5,
    sku: 'MAN-HU816X',
    bestCost: 4.2,
    bestCurrency: 'GBP',
    bestSupplierName: 'Euro Car Parts',
    pricing: { source: 'rule', tradePrice: 7.6, minMargin: null, margin: null },
    stock: [
      { binId: 1, place: 'A-01', qty: 8 },
      { binId: 2, place: 'C-03', qty: 4 },
    ],
  },
} as unknown as import('@/vendor/partslogic/shared/catalogue').PartDetail;

export const RECENT = [
  { partId: 7, brand: 'Mann', number: 'HU 816 x', description: 'Oil filter' },
  { partId: 8, brand: 'Bosch', number: '0 986 494 119', description: 'Brake pad set, front axle' },
  { partId: 9, brand: 'NGK', number: 'BKR6E', description: 'Spark plug' },
];

const at = (hour: number, minute: number) => new Date(new Date().setHours(hour, minute, 0, 0)).toISOString();
const item = (clientId: string, label: string, status: OutboxItem['status'], updatedAt: string, lastError: string | null = null) =>
  ({ clientId, label, status, updatedAt, createdAt: updatedAt, lastError, attempts: 1, seq: 0, userId: 'fixture', streamKey: 's', kind: 'receipt_lines', payload: {}, result: null }) as unknown as OutboxItem;

// A morning's work: one count refused, a delivery waiting, and what went earlier.
export const OUTBOX_ITEMS: OutboxItem[] = [
  item('a', 'Finish count of bin C-03', 'attention', at(10, 2), 'Bin C-03 is inactive'),
  item('b', 'Delivery started 09:14 · 12 lines', 'pending', at(10, 5)),
  item('c', 'Count of bin A-01 started 09:40', 'done', at(9, 52)),
  item('d', 'Add part MANN HU 816 x', 'done', at(9, 31)),
];
