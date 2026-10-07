import type { QueueItem } from '@/vendor/partslogic/shared/bin-session';

// Items in one stream are sent strictly in order; streams are independent. One delivery or one bin
// count is a stream, so a problem with one never holds up another.
export function streamKeyOf(item: QueueItem): string {
  switch (item.kind) {
    case 'receipt_lines':
    case 'close_receipt':
      return `receipt:${item.documentId}`;
    case 'open_bin_count':
    case 'bin_count_lines':
    case 'commit_bin_count':
      return `count:${item.stocktakeId}`;
    case 'ensure_bin':
      return `bin:${item.locationId}:${item.code.toUpperCase()}`;
    case 'quick_add':
      return `quick-add:${item.clientId}`;
  }
}
