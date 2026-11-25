import type { Moment } from '@/feel/moments';

import { bins, done, pickable, scanPart, type JobRow, type LocalPickJob } from './job';

// What a scan in a pick job says on its card and how it sounds, with no confirm in between (P6: one scan per unit).
// The check is what the code turned out to be (scan/resolve.ts); kept to its shape here so this stays pure.
export type PickCheck =
  | { type: 'part'; partId: number; brand: string; number: string }
  | { type: 'bin'; bin: string }
  | { type: 'unknown'; code: string }
  | { type: 'offline'; code: string }
  | { type: 'error'; code: string; message: string };

export type PickCard =
  | { kind: 'added'; row: JobRow; complete: boolean }
  | { kind: 'spare'; row: JobRow; want: number }
  // Not a part on this job: what was scanned, and the part the bin to go to wants, for Short pick.
  | { kind: 'not_on_pick'; scanned: string; here: JobRow | null }
  | { kind: 'bin'; bin: string }
  | { kind: 'offline'; code: string }
  | { kind: 'error'; code: string; message: string };

const MOMENT: Record<PickCard['kind'], Moment> = {
  added: 'scan',
  spare: 'unknown',
  not_on_pick: 'unknown',
  bin: 'unknown',
  offline: 'unknown',
  error: 'refused',
};
export const pickMoment = (card: PickCard): Moment => MOMENT[card.kind];

// The first row still to pick in the bin to go to: what Short pick from the card is for.
export function rowHere(job: LocalPickJob): JobRow | null {
  const { now } = bins(job);
  return job.rows.find((row) => pickable(row) && !done(row) && row.bin === now) ?? null;
}

export function pickScan(job: LocalPickJob, check: PickCheck): { job: LocalPickJob; card: PickCard } {
  switch (check.type) {
    case 'part': {
      const { job: next, outcome } = scanPart(job, check.partId);
      if (outcome.kind !== 'not_on_pick') return { job: next, card: outcome };
      return { job, card: { kind: 'not_on_pick', scanned: [check.brand, check.number].filter(Boolean).join(' '), here: rowHere(job) } };
    }
    case 'bin':
      return { job, card: { kind: 'bin', bin: check.bin } };
    case 'unknown':
      return { job, card: { kind: 'not_on_pick', scanned: check.code, here: rowHere(job) } };
    case 'offline':
      return { job, card: { kind: 'offline', code: check.code } };
    case 'error':
      return { job, card: { kind: 'error', code: check.code, message: check.message } };
  }
}
