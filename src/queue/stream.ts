import type { QueueItem } from '@/vendor/partslogic/shared/bin-session';

// A bin count's stream: its open, totals, finish or discard.
export const countStream = (stocktakeId: string) => `count:${stocktakeId}`;

// Items in one stream are sent strictly in order; streams are independent. One delivery or one bin
// count is a stream, so a problem with one never holds up another.
export function streamKeyOf(item: QueueItem): string {
  switch (item.kind) {
    case 'receipt_lines':
    case 'receipt_details':
    case 'close_receipt':
      return `receipt:${item.documentId}`;
    case 'open_bin_count':
    case 'bin_count_lines':
    case 'commit_bin_count':
    case 'discard_bin_count':
      return countStream(item.stocktakeId);
    case 'ensure_bin':
      return `bin:${item.locationId}:${item.code.toUpperCase()}`;
    case 'quick_add':
      return `quick-add:${item.clientId}`;
    // Its own stream: the location's queued opening counts don't wait on it, and PartsLogic still takes the
    // ones begun before it was marked done.
    case 'opening_stock_done':
      return `opening:${item.locationId}`;
  }
}
