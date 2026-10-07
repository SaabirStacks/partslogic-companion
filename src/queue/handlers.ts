import { supabase } from '@/lib/supabase';
import { conflictMessage } from '@/features/quick-add/wording';
import type { QueueItem } from '@/vendor/partslogic/shared/bin-session';
import { DataError } from '@/vendor/partslogic/shared/errors';
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
      return sendQuickAdd(item);
  }
}

// A code another part holds comes back as an answer, not an error. Queued work surfaces it as needing
// attention (with the holder named), so it is seen and never sent again on its own.
async function sendQuickAdd(item: Extract<QueueItem, { kind: 'quick_add' }>) {
  const result = await quickAddPart(supabase, {
    brandId: item.brandId,
    brandName: item.brandName,
    number: item.number,
    code: item.code,
    confirmNewBrand: item.confirmNewBrand,
  });
  if (result.status === 'conflict') throw new DataError(conflictMessage(result), 'P0001');
  return result;
}
