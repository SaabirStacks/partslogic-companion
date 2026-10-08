import type { IconName } from '@/ui/icons';
import type { Tone } from '@/ui/palette';
import type { TallyItem } from '@/ui/tally';

import type { CountProgress } from './count-results';

// What a finished count did, in a few words for a list row.
export function countResultText(progress: CountProgress): { text: string; problem: boolean } {
  if (progress.stage === 'waiting') return { text: 'Waiting to send', problem: false };
  if (progress.stage === 'attention') {
    return { text: progress.reason ? `Not finished · ${progress.reason}` : 'Not finished', problem: true };
  }
  const { result } = progress;
  const parts = [
    result.putAway > 0 ? `${result.putAway} put away` : null,
    result.returned > 0 ? `${result.returned} back to Unbinned` : null,
    result.found > 0 ? `${result.found} found` : null,
    result.unresolved > 0 ? `${result.unresolved} unknown` : null,
    result.partial || result.needsReview ? 'office will review' : null,
  ].filter(Boolean);
  return { text: parts.length > 0 ? parts.join(' · ') : 'No change', problem: false };
}

export type CountSummary = { tone: Tone; icon: IconName; label: string; items: TallyItem[] };

// The result screen after a count, in big numbers: what went onto the shelf from Unbinned, what went back
// to Unbinned, and what turned up that PartsLogic didn't expect.
export function countSummary(progress: CountProgress): CountSummary {
  if (progress.stage === 'waiting') return { tone: 'surface', icon: 'waiting', label: 'Waiting to send', items: [] };
  if (progress.stage === 'attention') {
    return { tone: 'stop', icon: 'stop', label: progress.reason ? `Not finished · ${progress.reason}` : 'Not finished', items: [] };
  }
  const { result } = progress;
  const review = result.partial || result.needsReview;
  return {
    tone: review ? 'warning' : 'safe',
    icon: review ? 'warning' : 'sent',
    label: review ? 'Done · office will review' : 'Done',
    items: [
      { value: result.putAway, label: 'Put away', tone: result.putAway > 0 ? 'safe' : undefined },
      { value: result.returned, label: 'To Unbinned' },
      { value: result.found, label: 'Found' },
      ...(result.unresolved > 0 ? [{ value: result.unresolved, label: 'Unknown', tone: 'warning' as const }] : []),
    ],
  };
}
