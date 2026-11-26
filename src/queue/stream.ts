import type { QueueItem } from './items';

// A bin count's stream: its open, totals, finish or discard.
export const countStream = (stocktakeId: string) => `count:${stocktakeId}`;

// A pick job's: its end. Each row of it is a stream of its own (its scans, taps and short pick, in order), so a
// pick PartsLogic refuses holds back only that row; the end, queued last, is sent after every row has been tried.
export const pickJobStream = (jobId: string) => `pick:${jobId}`;
export const pickRowStream = (jobId: string, lineId: number, binId: number) => `pick:${jobId}:${lineId}:${binId}`;

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
    case 'pick_row':
    case 'pick_short':
      return pickRowStream(item.jobId, item.lineId, item.binId);
    case 'pick_job_end':
      return pickJobStream(item.jobId);
    case 'pack_order':
      return `pack:${item.orderId}`;
    // One drop: Delivered or Not delivered, in the order the driver chose them.
    case 'deliver_signed':
    case 'not_delivered':
      return `deliver:${item.orderId}`;
  }
}
