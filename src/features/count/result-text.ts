import type { CountProgress } from './count-results';

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

// What a finished count did, in plain words.
export function countResultText(progress: CountProgress): { text: string; problem: boolean } {
  if (progress.stage === 'waiting') return { text: 'Saved. It finishes when it reaches PartsLogic.', problem: false };
  if (progress.stage === 'attention') {
    return { text: progress.reason ? `Not finished: ${progress.reason}` : 'Not finished', problem: true };
  }
  const { result } = progress;
  const parts = [
    result.putAway > 0 ? `${plural(result.putAway, 'unit', 'units')} put away from Unbinned` : null,
    result.returned > 0 ? `${plural(result.returned, 'unit', 'units')} back to Unbinned` : null,
    result.found > 0 ? `${plural(result.found, 'unit', 'units')} found` : null,
    result.unresolved > 0 ? `${plural(result.unresolved, 'unknown code', 'unknown codes')} for the office` : null,
  ].filter(Boolean);
  const review = result.partial
    ? ' The bin changed while it was counted, so only the scanned parts were updated and the office will review it.'
    : result.needsReview
      ? ' The office will review it.'
      : '';
  return { text: `${parts.length > 0 ? parts.join(', ') : 'No change'}.${review}`, problem: false };
}
