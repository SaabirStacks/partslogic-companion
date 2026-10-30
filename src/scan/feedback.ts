import { feel } from '@/feel/feel';
import type { Moment } from '@/feel/moments';

import type { ScanCheck } from './resolve';

// What a held scan's answer sounds and feels like: a part reads as a scan, an error as a refusal, and
// anything to check (unknown, unchecked or a bin) as a warning. Staff can keep their eyes on the shelf.
export function scanMoment(check: ScanCheck): Moment {
  if (check.type === 'part') return 'scan';
  if (check.type === 'error') return 'refused';
  return 'unknown';
}

export const feedbackFor = (check: ScanCheck) => feel(scanMoment(check));
