import { partNumber, plural } from '@/lib/format';
import { binLabel, SHORT_PICK_REASON_LABELS, CANT_SCAN_REASON_LABELS } from '@/vendor/partslogic/shared/sales/picking';
import { quantityWords } from '@/vendor/partslogic/shared/sales/words';

import { left, picked, type JobRow, type JobTotals } from './job';

// The phone's words for a pick job: the copy deck in PartsLogic's docs/design-checks/phone-picking.md (signed off by
// the owner, 25 November 2026). The web's words for the same things come from the shared code, so both say them alike.

export const units = (count: number) => plural(count, 'unit', 'units');

// Before a job.
export const NOTHING_TO_PICK = { title: 'Nothing to pick', line: 'Confirmed orders with stock set aside appear here.' };
export const NO_SIGNAL_TO_START = { title: 'No signal', line: 'Start picking when it’s back.' };
export const readyToPick = (toPick: number, orders: number, location: string | null) =>
  `${units(toPick)} for ${plural(orders, 'order', 'orders')}${location ? ` at ${location}` : ''}`;
export const yourJob = (done: number, of: number) => `${quantityWords(done)} of ${units(of)}`;

// The part, as the rows and the card name it: "MANN-FILTER C 35 154".
export const partName = (row: Pick<JobRow, 'part'>) => partNumber(row.part);

// The banner: the bin to go to, large, then what comes after it.
export function bannerTitle(now: string | null): string {
  return now ? binLabel(now) : 'All picked';
}
export function bannerDetail(next: string | null, now: string | null, total: Pick<JobTotals, 'orders' | 'units'>): string {
  const after = now ? (next ? `Next: ${binLabel(next)}` : 'Last bin') : null;
  return [after, plural(total.orders, 'order', 'orders'), units(total.units)].filter(Boolean).join(' · ');
}

export const putWith = (row: Pick<JobRow, 'order'>) => `Put with ${row.order}`;
export const countOf = (row: JobRow) => `${quantityWords(picked(row))} of ${quantityWords(row.want)}`;

// Under a row's part: where it stands, once it has moved.
export function rowState(row: JobRow): { text: string; tone: 'ok' | 'warn' | 'neutral' } | null {
  if (row.binId === null) return { text: 'Not in a bin on the books · count first', tone: 'warn' };
  if (row.short) {
    const missing = row.want - picked(row);
    return { text: `${quantityWords(missing)} short · ${SHORT_PICK_REASON_LABELS[row.short.reason]}`, tone: 'warn' };
  }
  if (left(row) === 0) return { text: 'Picked', tone: 'ok' };
  if (row.tapped > 0 && row.tapReason) {
    return { text: `${quantityWords(row.tapped)} without a scan · ${CANT_SCAN_REASON_LABELS[row.tapReason]}`, tone: 'neutral' };
  }
  return null;
}

// The scan card's lines.
export const spareLine = (want: number) => `All ${quantityWords(want)} picked`;
export const SPARE_BACK = 'Put the spare back';
export const NOT_ON_PICK = 'Not on this pick';
export const thisBin = (row: Pick<JobRow, 'part'> | null) => (row ? `This bin: ${partName(row)}` : null);

// Finish and Stop.
export const finishLabel = (count: number) => `Finish · ${units(count)}`;
export const goBack = (count: number) => `${units(count)} not picked go${count === 1 ? 'es' : ''} back to To pick.`;
export const STOP = { title: 'Stop picking?', note: 'Picked units stay picked; the rest go back to To pick.', confirm: 'Stop picking' };

// The receipt: "12 picked · 2 short · 4 orders".
export function receiptLine(total: JobTotals): string {
  return [`${quantityWords(total.picked)} picked`, total.short > 0 ? `${quantityWords(total.short)} short` : null, plural(total.orders, 'order', 'orders')]
    .filter(Boolean)
    .join(' · ');
}
// A pick PartsLogic refused when the signal came back: "Not picked · SO-000021 · Only 0 in D-01 on the books…".
export const refusedLine = (order: string, reason: string) => `Not picked · ${order} · ${reason}`;
