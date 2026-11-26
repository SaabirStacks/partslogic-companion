import { deliverSigned } from '@/vendor/partslogic/shared/sales/delivery';
import { markNotDelivered } from '@/vendor/partslogic/shared/sales/handover';
import type { DriverDeliveries, DriverDelivery } from '@/vendor/partslogic/shared/sales/delivery';

import { sendQueued } from '@/queue/handlers';
import type { QueueItem } from '@/queue/items';
import { streamKeyOf } from '@/queue/stream';
import { tileBadge } from '@/features/board/tile-badge';

import { handledOrders, readSavedList, sendState, stillOut } from '../drop';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/vendor/partslogic/shared/sales/delivery', () => ({
  ...jest.requireActual('@/vendor/partslogic/shared/sales/delivery'),
  deliverSigned: jest.fn(),
}));
jest.mock('@/vendor/partslogic/shared/sales/handover', () => ({
  ...jest.requireActual('@/vendor/partslogic/shared/sales/handover'),
  markNotDelivered: jest.fn(),
}));

const delivery = (orderId: string, mine = true): DriverDelivery => ({
  orderId, order: `SO-${orderId}`, customer: 'Northway Fleet Services', phone: null, address: null, addressText: 'Shipley BD18',
  mine, driver: null, sentAt: '2026-11-26T09:12:00Z', packed: true, parcels: 2, units: 3, lines: [],
});
const LIST: DriverDeliveries = { locationId: 1, location: 'Leeds branch', now: '2026-11-26T14:30:00Z', deliveries: [delivery('o1'), delivery('o2'), delivery('o3', false)] };
const SIGNED: QueueItem = { kind: 'deliver_signed', clientId: 'c1', orderId: 'o1', name: 'Jo Smith', strokes: [[[10, 10], [20, 20]]], signedAt: '2026-11-26T14:05:00Z' };

beforeEach(() => jest.resetAllMocks());

describe('the driver’s list on the phone', () => {
  it('drops what this phone has delivered or marked Not delivered, unless PartsLogic refused it', () => {
    const handled = handledOrders([
      { payload: SIGNED, status: 'pending' },
      { payload: { kind: 'not_delivered', clientId: 'c2', orderId: 'o2', reason: 'no_one_in' }, status: 'attention' },
      { payload: { kind: 'pack_order', clientId: 'c3', orderId: 'o3', parcels: 1, method: 'scan' }, status: 'done' },
    ]);
    expect([...handled]).toEqual(['o1']);
    expect(stillOut(LIST, handled).map((d) => d.orderId)).toEqual(['o2', 'o3']);
  });

  it('reads a saved list back only when it still has the shape it was saved in', () => {
    expect(readSavedList(LIST)).toBe(LIST);
    expect(readSavedList({ deliveries: [{ order: 'SO-1' }] })).toBeNull();
    expect(readSavedList(null)).toBeNull();
  });

  it('says on the receipt whether it waits for signal, is sending, was sent or was refused', () => {
    expect(sendState(undefined, false)).toBe('waiting');
    expect(sendState({ status: 'pending' }, true)).toBe('sending');
    expect(sendState({ status: 'done' }, false)).toBe('sent');
    expect(sendState({ status: 'attention' }, true)).toBe('refused');
  });

  it('puts the deliveries with you on the board’s Deliver tile', () => {
    expect(tileBadge('deliver', [], null, { toPick: 0, toPack: 0, withYou: 3 })).toEqual({ label: '3 with you', tone: 'action', spoken: '3 deliveries with you' });
    expect(tileBadge('deliver', [], null, { toPick: 0, toPack: 0, withYou: 0 })).toBeNull();
    expect(tileBadge('deliver', [], null, null)).toBeNull();
  });
});

describe('sending from the drop', () => {
  it('sends the signed delivery with its client id, in the drop’s own stream', async () => {
    jest.mocked(deliverSigned).mockResolvedValue({ orderId: 'o1', units: 3, status: 'completed', replay: false });
    await sendQueued(SIGNED);
    expect(deliverSigned).toHaveBeenCalledWith({}, { orderId: 'o1', clientId: 'c1', name: 'Jo Smith', strokes: [[[10, 10], [20, 20]]], signedAt: '2026-11-26T14:05:00Z' });
    expect(streamKeyOf(SIGNED)).toBe('deliver:o1');
  });

  it('sends Not delivered with why, the note only for Other', async () => {
    await sendQueued({ kind: 'not_delivered', clientId: 'c2', orderId: 'o2', reason: 'other', note: 'Gate locked' });
    await sendQueued({ kind: 'not_delivered', clientId: 'c3', orderId: 'o2', reason: 'closed' });
    expect(markNotDelivered).toHaveBeenNthCalledWith(1, {}, { orderId: 'o2', reason: 'other', note: 'Gate locked' });
    expect(markNotDelivered).toHaveBeenNthCalledWith(2, {}, { orderId: 'o2', reason: 'closed', note: null });
    expect(streamKeyOf({ kind: 'not_delivered', clientId: 'c2', orderId: 'o2', reason: 'closed' })).toBe('deliver:o2');
  });

  it('leaves a refusal for Sync to show, in PartsLogic’s words', async () => {
    jest.mocked(deliverSigned).mockRejectedValue(new Error('This order was already marked delivered.'));
    await expect(sendQueued(SIGNED)).rejects.toThrow('This order was already marked delivered.');
  });
});
