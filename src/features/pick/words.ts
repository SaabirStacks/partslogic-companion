import { partNumber, plural, unbroken } from '@/lib/format';
import { binLabel, SHORT_PICK_REASON_LABELS, CANT_SCAN_REASON_LABELS } from '@/vendor/partslogic/shared/sales/picking';
import { quantityWords } from '@/vendor/partslogic/shared/sales/words';

import { left, picked, type JobRow, type JobTotals } from './job';
import type { PickCard } from './scan-card';

// The phone's words for a pick job: the copy deck in PartsLogic's docs/design-checks/phone-picking.md (signed off by
// the owner, 25 November 2026). The web's words for the same things come from the shared code, so both say them alike.

export const units = (count: number) => plural(count, 'unit', 'units');

// The job's strip with no signal (the copy deck).
export const PICK_OFFLINE = 'No signal · Picks send when it’s back';

// Before a job.
export const NOTHING_TO_PICK = { title: 'Nothing to pick', line: 'Confirmed orders with stock set aside appear here.' };
// Units to pick, but every order is on another picker's job.
export const ALL_CLAIMED = { title: 'Nothing to pick', line: 'The orders to pick are on other pickers’ jobs.' };
export const NO_SIGNAL_TO_START = { title: 'No signal', line: 'Start picking when it’s back.' };
export const readyToPick = (toPick: number, orders: number, location: string | null) =>
  `${units(toPick)} for ${plural(orders, 'order', 'orders')}${location ? ` at ${location}` : ''}`;
export const yourJob = (done: number, of: number) => `${quantityWords(done)} of ${units(of)}`;

// The part, as the rows and the card name it: "MANN-FILTER C 35 154".
export const partName = (row: Pick<JobRow, 'part'>) => partNumber(row.part);

// The banner: the bin to go to, large, then what comes after it.
// Once every row is picked or short: "All picked", or "Nothing left to pick" when some were short.
export function bannerTitle(now: string | null, total?: Pick<JobTotals, 'short'>): string {
  if (now) return binLabel(now);
  return total && total.short > 0 ? 'Nothing left to pick' : 'All picked';
}
export function bannerDetail(next: string | null, now: string | null, total: Pick<JobTotals, 'orders' | 'units'> & Partial<Pick<JobTotals, 'short'>>): string {
  const after = now ? (next ? `Next: ${binLabel(next)}` : 'Last bin') : total.short ? `${quantityWords(total.short)} short` : null;
  return [after, plural(total.orders, 'order', 'orders'), units(total.units)].filter(Boolean).join(' · ');
}

export const putWith = (row: Pick<JobRow, 'order'>) => `Put with ${unbroken(row.order)}`;
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
// A code this phone has never seen, with no signal to ask: every part's codes are kept on the phone, so this is rare.
export const OFFLINE_UNKNOWN = 'Not on this phone’s list · scan it again with signal, or use Can’t scan';
export const thisBin = (row: Pick<JobRow, 'part'> | null) => (row ? `This bin: ${partName(row)}` : null);

// Finish and Stop.
export const finishLabel = (count: number) => `Finish · ${units(count)}`;
const TO_PICK = unbroken('To pick');
export const goBack = (count: number) => `${units(count)} not picked go${count === 1 ? 'es' : ''} back to ${TO_PICK}.`;
export const STOP = { title: 'Stop picking?', note: `Picked units stay picked; the rest go back to ${TO_PICK}.`, confirm: 'Stop picking' };

// The receipt: "12 picked · 2 short · 4 orders".
export function receiptLine(total: JobTotals): string {
  return [`${quantityWords(total.picked)} picked`, total.short > 0 ? `${quantityWords(total.short)} short` : null, plural(total.orders, 'order', 'orders')]
    .filter(Boolean)
    .join(' · ');
}
// A pick PartsLogic refused when the signal came back: "Not picked · SO-000021 · Only 0 in D-01 on the books…".
// Bin codes and numbers inside PartsLogic's reason ("Only 0 in B-02 …") never break either.
export const refusedLine = (order: string, reason: string) =>
  `Not picked · ${unbroken(order)} · ${reason.replace(/\b[A-Z0-9]+(?:-[A-Z0-9]+)+\b/g, unbroken)}`;

// The scan card in a few words, for VoiceOver: "Put with SO-000019, MANN-FILTER C 35 154, 1 of 2".
export function pickCardWords(card: PickCard): string {
  switch (card.kind) {
    case 'added':
      return `Put with ${card.row.order}, ${card.row.part.brand} ${card.row.part.number}, ${quantityWords(picked(card.row))} of ${quantityWords(card.row.want)}`;
    case 'spare':
      return `${spareLine(card.want)}. ${SPARE_BACK}`;
    case 'not_on_pick':
      return `${NOT_ON_PICK}: ${card.scanned}`;
    case 'bin':
      return 'A bin label. Scan the part';
    case 'offline':
    case 'error':
      return `Not checked: ${card.code}`;
  }
}
