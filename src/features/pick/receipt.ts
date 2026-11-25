import type { OutboxItem } from '@/queue/types';
import { fulfilmentLabel, ORDER_FULFILMENTS, type DeliveryMethod, type OrderFulfilment } from '@/vendor/partslogic/shared/sales/orders';
import type { PickJob } from '@/vendor/partslogic/shared/sales/pick-jobs';

import { totals, type LocalPickJob } from './job';
import { receiptLine } from './words';

// The end of a pick job, from the phone's count and what PartsLogic answered: where it stands (sending, sent, or a
// pick refused), each order's stage once the end is sent, and each refusal in words with its order (P8).
export type PickReceipt = {
  state: 'sending' | 'sent' | 'check';
  line: string;
  orders: { id: string; number: string; stage: string | null }[];
  refused: { key: string; order: string; reason: string }[];
};

const ofJob = (jobId: string) => (item: OutboxItem) =>
  (item.payload.kind === 'pick_row' || item.payload.kind === 'pick_short' || item.payload.kind === 'pick_job_end') && item.payload.jobId === jobId;

const isFulfilment = (value: string | null): value is OrderFulfilment => (ORDER_FULFILMENTS as readonly string[]).includes(value ?? '');
const isMethod = (value: string): value is DeliveryMethod => value === 'collection' || value === 'delivery' || value === 'courier';

// The job's work still to send or refused, for the job screen's strip as well as the receipt.
export function jobItems(job: LocalPickJob, items: OutboxItem[]): OutboxItem[] {
  return items.filter(ofJob(job.jobId));
}

export function refusedPicks(job: LocalPickJob, items: OutboxItem[]): PickReceipt['refused'] {
  return jobItems(job, items).flatMap((item) => {
    const payload = item.payload;
    if (item.status !== 'attention' || payload.kind === 'pick_job_end' || !('lineId' in payload)) return [];
    const row = job.rows.find((candidate) => candidate.lineId === payload.lineId && candidate.binId === payload.binId);
    return [{ key: item.clientId, order: row?.order ?? '', reason: item.lastError ?? 'Not picked' }];
  });
}

export function pickReceipt(job: LocalPickJob, items: OutboxItem[]): PickReceipt {
  const mine = jobItems(job, items);
  const refused = refusedPicks(job, items);
  const end = mine.find((item) => item.payload.kind === 'pick_job_end' && item.status === 'done');
  // What PartsLogic made of each order once the job ended (endPickJob's answer): To pack, Ready for collection, To pick.
  const answer = end ? (end.result as { job?: PickJob | null; pickedUnits?: number; shortUnits?: number } | null) : null;
  const after = answer?.job ?? null;
  const orders = job.orders.map((order) => {
    const now = after?.orders.find((candidate) => candidate.id === order.id);
    const method = now?.method ?? order.method;
    return {
      id: order.id,
      number: order.number,
      stage: now && isFulfilment(now.fulfilment) && isMethod(method) ? fulfilmentLabel(now.fulfilment, method) : null,
    };
  });
  const waiting = mine.some((item) => item.status === 'pending' || item.status === 'sending');
  return {
    state: mine.some((item) => item.status === 'attention') ? 'check' : waiting || !end ? 'sending' : 'sent',
    // What PartsLogic counted once the end is sent, so a refused pick isn't counted as picked (critique B).
    line: receiptLine(
      answer && typeof answer.pickedUnits === 'number'
        ? { ...totals(job), picked: answer.pickedUnits, short: answer.shortUnits ?? totals(job).short }
        : totals(job),
    ),
    orders,
    refused,
  };
}
