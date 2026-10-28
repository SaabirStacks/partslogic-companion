import { clock } from '@/lib/format';

import type { Delivery } from './delivery-store';
import type { LineGroup } from './lines';
import { deliveryName } from './sender';

export type ReceiptSummary = {
  // Booked: PartsLogic has every line. Sending: some are still on the phone. Check: something was
  // refused or couldn't be sent.
  state: 'booked' | 'sending' | 'check';
  codes: number;
  unknown: number;
};

// Where a finished delivery stands, from its lines as PartsLogic answered them.
export function receiptSummary(groups: LineGroup[]): ReceiptSummary {
  const check = groups.some((group) => group.status === 'attention' || group.status === 'refused');
  const sending = groups.some((group) => group.status === 'waiting');
  return {
    state: check ? 'check' : sending ? 'sending' : 'booked',
    codes: groups.length,
    unknown: groups.filter((group) => group.status === 'unknown').length,
  };
}

// The line under the receipt number: who it was from, the delivery note and when it was received
// ("BGA · DN 448210 · 09:12–09:31").
export function receiptLine(delivery: Delivery): string {
  const span = delivery.finishedAt ? `${clock(delivery.startedAt)}–${clock(delivery.finishedAt)}` : clock(delivery.startedAt);
  return [deliveryName(delivery.sender), delivery.reference, span].filter(Boolean).join(' · ');
}
