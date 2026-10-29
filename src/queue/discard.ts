import { countStream } from './stream';
import type { OutboxItem } from './types';

// What discarding a problem throws away: the item PartsLogic refused, and everything unsent behind it in
// the same stream, which depends on it (a count's totals and finish wait on its open). Nothing already sent
// is touched, and only a refused item can be discarded: one waiting or being sent may still go through.
export function discardPlan(items: OutboxItem[], clientId: string): OutboxItem[] {
  const refused = items.find((item) => item.clientId === clientId);
  if (!refused || refused.status !== 'attention') return [];
  return items
    .filter((item) => item.streamKey === refused.streamKey && item.seq >= refused.seq && item.status !== 'done' && item.status !== 'sending')
    .sort((a, b) => a.seq - b.seq);
}

// The bin count a stream belongs to, so the phone can forget it too once its work is discarded.
export function countOfStream(streamKey: string): string | null {
  const prefix = countStream('');
  return streamKey.startsWith(prefix) ? streamKey.slice(prefix.length) : null;
}

// A count discarded on the phone: its work not sent yet (waiting, or refused), which no longer needs
// sending. One being sent right now is left to finish; the discard queued after it follows it.
export function unsentOfCount(items: OutboxItem[], stocktakeId: string): OutboxItem[] {
  const stream = countStream(stocktakeId);
  return items.filter((item) => item.streamKey === stream && (item.status === 'pending' || item.status === 'attention'));
}
