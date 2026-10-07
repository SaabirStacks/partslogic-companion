import { supabase } from '@/lib/supabase';
import type { QueueItem } from '@/vendor/partslogic/shared/bin-session';
import {
  closeStockDocument,
  commitBinCount,
  ensureBin,
  openBinCount,
  quickAddPart,
  recordCounts,
  recordReceiptLines,
} from '@/vendor/partslogic/shared/floor';

// Each kind of queued work and the PartsLogic call that sends it. Every call is safe to repeat: the server
// recognises the ids made on the phone, so a replay is success, not an error.
export function sendQueued(item: QueueItem): Promise<unknown> {
  switch (item.kind) {
    case 'ensure_bin':
      return ensureBin(supabase, item.locationId, item.code);
    case 'open_bin_count':
      return openBinCount(supabase, {
        stocktakeId: item.stocktakeId,
        binId: item.binId,
        device: item.device,
        startedAt: item.startedAt,
      });
    case 'bin_count_lines':
      return recordCounts(supabase, { stocktakeId: item.stocktakeId, binId: item.binId, lines: item.lines });
    case 'commit_bin_count':
      return commitBinCount(supabase, item.stocktakeId, item.confirmEmpty);
    case 'receipt_lines':
      return recordReceiptLines(supabase, {
        documentId: item.documentId,
        locationId: item.locationId,
        device: item.device,
        lines: item.lines,
      });
    case 'close_receipt':
      return closeStockDocument(supabase, item.documentId);
    case 'quick_add':
      return quickAddPart(supabase, {
        brandId: item.brandId,
        brandName: item.brandName,
        number: item.number,
        code: item.code,
        confirmNewBrand: item.confirmNewBrand,
      });
  }
}
