import type { RecentPart } from '@/lib/prefs';

export const RECENT_LIMIT = 20;

// Newest first, each part once.
export function addRecent(list: RecentPart[], part: RecentPart, limit = RECENT_LIMIT): RecentPart[] {
  return [part, ...list.filter((item) => item.partId !== part.partId)].slice(0, limit);
}
