import type { PickJob, PickJobOrder } from '@/vendor/partslogic/shared/sales/pick-jobs';
import type { CantScanReason, NotFound, PickingPart, ShortPickReason } from '@/vendor/partslogic/shared/sales/picking';

// A pick job as the phone keeps it (S5b, PartsLogic docs/design-checks/phone-picking.md). PartsLogic claims the
// orders and lists the rows in walking order; the phone then counts each unit as it is scanned, saves the count on
// the phone and queues it (pick-queue.ts), so a job carries on without signal. Pure, so it's tested without a phone.

// One order line's units in one bin, with what this job has done to it.
export type JobRow = {
  key: string;
  lineId: number;
  orderId: string;
  order: string;
  urgent: boolean;
  part: PickingPart;
  binId: number | null;
  bin: string | null;
  // The units this job picks from the bin: still to pick when the job started (or came back), plus what it had
  // already picked.
  want: number;
  scanned: number;
  // Picked without a scan (Can't scan), and the last reason given.
  tapped: number;
  tapReason: CantScanReason | null;
  // Saved as a short pick: how many were here, and why the rest weren't. The row is done.
  short: { found: number; reason: ShortPickReason } | null;
  // Flagged short before this job, still waiting on a count.
  notFound: NotFound | null;
};

export type LocalPickJob = {
  jobId: string;
  userId: string;
  locationId: number | null;
  location: string | null;
  startedAt: string;
  orders: PickJobOrder[];
  rows: JobRow[];
  // Set once Finish or Stop is pressed; the job is then a receipt.
  endedAt: string | null;
  endedHow: 'finished' | 'stopped' | null;
};

export const rowKey = (lineId: number, binId: number | null) => `${lineId}:${binId ?? 'none'}`;

// A row with no bin has nothing on the books here to pick from: it needs a count first.
export const pickable = (row: JobRow) => row.binId !== null && row.want > 0;
export const picked = (row: JobRow) => row.scanned + row.tapped + (row.short?.found ?? 0);
export const left = (row: JobRow) => (row.short ? 0 : Math.max(0, row.want - row.scanned - row.tapped));
export const done = (row: JobRow) => pickable(row) && left(row) === 0;

// The phone's job from PartsLogic's: a job just claimed, or one carried on (on another phone, or after the app was
// reinstalled), each row counting what the job already picked from it.
export function fromServerJob(job: PickJob, userId: string): LocalPickJob {
  const rows = new Map<string, JobRow>();
  const ensure = (base: Omit<JobRow, 'key' | 'want' | 'scanned' | 'tapped' | 'tapReason' | 'short'>) => {
    const key = rowKey(base.lineId, base.binId);
    const row = rows.get(key) ?? { ...base, key, want: 0, scanned: 0, tapped: 0, tapReason: null, short: null };
    rows.set(key, row);
    return row;
  };
  for (const row of job.rows) {
    ensure({ lineId: row.lineId, orderId: row.orderId, order: row.order, urgent: row.urgent, part: row.part, binId: row.binId, bin: row.bin, notFound: row.notFound }).want += row.qty;
  }
  // What the job already picked joins its row; a pick whose row is gone (every unit picked) brings the row back.
  for (const pick of job.picked) {
    const order = job.orders.find((candidate) => candidate.id === pick.orderId);
    const known = [...rows.values()].find((row) => row.lineId === pick.lineId);
    const row = ensure({
      lineId: pick.lineId,
      orderId: pick.orderId,
      order: known?.order ?? order?.number ?? '',
      urgent: known?.urgent ?? order?.urgent ?? false,
      part: known?.part ?? { id: pick.partId, brand: '', number: '', description: null },
      binId: pick.binId,
      bin: pick.bin,
      notFound: null,
    });
    // A short pick's missing units are still the row's to pick (flagged), so only what was moved is added.
    row.want += pick.qty;
    if (pick.short > 0 && pick.reason) row.short = { found: (row.short?.found ?? 0) + pick.qty, reason: pick.reason };
    else if (pick.method === 'tap') row.tapped += pick.qty;
    else row.scanned += pick.qty;
  }
  return {
    jobId: job.id,
    userId,
    locationId: job.locationId,
    location: job.location,
    startedAt: job.startedAt,
    orders: job.orders,
    rows: [...rows.values()].sort(walkingOrder(job)),
    endedAt: null,
    endedHow: null,
  };
}

// PartsLogic's order: urgent first, then the walk by bin. A row brought back from its picks (every unit picked) goes
// after the rest.
function walkingOrder(job: PickJob) {
  const place = new Map(job.rows.map((row, index) => [rowKey(row.lineId, row.binId), index]));
  return (a: JobRow, b: JobRow) =>
    Number(b.urgent) - Number(a.urgent) ||
    (place.get(a.key) ?? Number.MAX_SAFE_INTEGER) - (place.get(b.key) ?? Number.MAX_SAFE_INTEGER) ||
    (a.bin ?? '').localeCompare(b.bin ?? '') ||
    a.lineId - b.lineId;
}

// The bin to go to (the first with a row still to pick, in walking order) and the one after it.
export function bins(job: LocalPickJob): { now: string | null; next: string | null } {
  const ahead: string[] = [];
  for (const row of job.rows) {
    if (!pickable(row) || done(row) || row.bin === null) continue;
    if (!ahead.includes(row.bin)) ahead.push(row.bin);
    if (ahead.length === 2) break;
  }
  return { now: ahead[0] ?? null, next: ahead[1] ?? null };
}

export type JobTotals = { units: number; picked: number; short: number; left: number; orders: number };

export function totals(job: LocalPickJob): JobTotals {
  const rows = job.rows.filter(pickable);
  const short = rows.reduce((sum, row) => sum + (row.short ? row.want - picked(row) : 0), 0);
  return {
    units: rows.reduce((sum, row) => sum + row.want, 0),
    picked: rows.reduce((sum, row) => sum + picked(row), 0),
    short,
    left: rows.reduce((sum, row) => sum + left(row), 0),
    orders: job.orders.length,
  };
}

// What a scanned part does to the job. A part on the job adds one to its first row still to pick (the bin to go
// to first, then the walk); a part whose rows are all picked is a spare; anything else isn't on this pick.
export type ScanOutcome =
  | { kind: 'added'; row: JobRow; complete: boolean }
  | { kind: 'spare'; row: JobRow; want: number }
  | { kind: 'not_on_pick' };

export function scanPart(job: LocalPickJob, partId: number): { job: LocalPickJob; outcome: ScanOutcome } {
  const rows = job.rows.filter((row) => pickable(row) && row.part.id === partId);
  if (rows.length === 0) return { job, outcome: { kind: 'not_on_pick' } };
  const { now } = bins(job);
  const target = rows.find((row) => !done(row) && row.bin === now) ?? rows.find((row) => !done(row));
  if (!target) {
    const want = rows.reduce((sum, row) => sum + row.want, 0);
    return { job, outcome: { kind: 'spare', row: rows[rows.length - 1], want } };
  }
  const row = { ...target, scanned: target.scanned + 1 };
  return { job: withRow(job, row), outcome: { kind: 'added', row, complete: left(row) === 0 } };
}

// Can't scan: units picked by a tap, with why (owner, 21 November 2026: the reason is logged).
export function tapRow(job: LocalPickJob, key: string, qty: number, reason: CantScanReason): LocalPickJob {
  const row = job.rows.find((candidate) => candidate.key === key);
  if (!row || qty <= 0) return job;
  return withRow(job, { ...row, tapped: row.tapped + Math.min(qty, left(row)), tapReason: reason });
}

// Takes back the row's last unit, a scan first (Undo the last scan).
export function unscanRow(job: LocalPickJob, key: string): LocalPickJob {
  const row = job.rows.find((candidate) => candidate.key === key);
  if (!row || row.short) return job;
  if (row.scanned > 0) return withRow(job, { ...row, scanned: row.scanned - 1 });
  if (row.tapped > 0) return withRow(job, { ...row, tapped: row.tapped - 1, tapReason: row.tapped > 1 ? row.tapReason : null });
  return job;
}

// Short pick: how many of the rest are here, and why the others aren't. The row is done; PartsLogic flags it for a
// count (Bin empty, Wrong part) as the web does.
export function shortRow(job: LocalPickJob, key: string, found: number, reason: ShortPickReason): LocalPickJob {
  const row = job.rows.find((candidate) => candidate.key === key);
  if (!row || row.short || found < 0 || found >= left(row)) return job;
  return withRow(job, { ...row, short: { found, reason } });
}

function withRow(job: LocalPickJob, row: JobRow): LocalPickJob {
  return { ...job, rows: job.rows.map((candidate) => (candidate.key === row.key ? row : candidate)) };
}

// The rows of one order, for the receipt.
export function orderRows(job: LocalPickJob, orderId: string): JobRow[] {
  return job.rows.filter((row) => row.orderId === orderId && pickable(row));
}
