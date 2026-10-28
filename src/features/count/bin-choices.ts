import type { BinSummary } from '@/vendor/partslogic/shared/settings';

// A bin you can count: its name on the shelf, what it holds, and when it was last counted.
export type BinChoice = { binId: number; code: string; description: string | null; units: number; lastCounted: string | null };

// A posted stock take or bin count, as read from PartsLogic: the bins it counted (a full stock take with
// no list counted the whole location) and when it was posted.
export type PostedCount = { kind: string; binIds: number[] | null; postedAt: string };

// When each bin was last counted, from posted counts (newest first or not).
export function lastCountedByBin(posted: PostedCount[], allBinIds: number[]): Map<number, string> {
  const last = new Map<number, string>();
  const mark = (binId: number, at: string) => {
    const seen = last.get(binId);
    if (!seen || at > seen) last.set(binId, at);
  };
  for (const count of posted) {
    const bins = count.binIds ?? (count.kind === 'full' ? allBinIds : []);
    for (const binId of bins) mark(binId, count.postedAt);
  }
  return last;
}

// Shelf bins in the order they're labelled: A-2 before A-10. System bins (Unbinned) and inactive ones
// are left out; they're never counted.
export function binChoices(bins: BinSummary[], lastCounted: Map<number, string>): BinChoice[] {
  return bins
    .filter((bin) => !bin.isSystem && bin.isActive)
    .map((bin) => ({ binId: bin.id, code: bin.code, description: bin.description, units: bin.units, lastCounted: lastCounted.get(bin.id) ?? null }))
    .sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true, sensitivity: 'base' }));
}

// Bins matching what's typed: the start of the name, or any part of it, ignoring case, spaces and dashes.
export function filterBins(choices: BinChoice[], query: string): BinChoice[] {
  const want = squash(query);
  if (want === '') return choices;
  const starts = choices.filter((choice) => squash(choice.code).startsWith(want));
  const contains = choices.filter((choice) => !squash(choice.code).startsWith(want) && squash(choice.code).includes(want));
  return [...starts, ...contains];
}

// The bin a typed name means exactly, if there is one.
export function exactBin(choices: BinChoice[], query: string): BinChoice | null {
  const want = squash(query);
  return want === '' ? null : (choices.find((choice) => squash(choice.code) === want) ?? null);
}

const squash = (text: string) => text.toUpperCase().replace(/[\s-]+/g, '');

// "Counted today", "Counted 3 Oct", "Counted 3 Oct 2025" (another year), or "Never counted".
export function countedText(lastCounted: string | null, now = new Date()): string {
  if (!lastCounted) return 'Never counted';
  const at = new Date(lastCounted);
  if (at.toDateString() === now.toDateString()) return 'Counted today';
  const sameYear = at.getFullYear() === now.getFullYear();
  return `Counted ${at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })}`;
}
