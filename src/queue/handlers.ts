import { supabase } from '@/lib/supabase';
import { conflictMessage } from '@/features/quick-add/wording';
import type { QueueItem } from '@/vendor/partslogic/shared/bin-session';
import { classifyQueueError, DataError } from '@/vendor/partslogic/shared/errors';
import {
  closeStockDocument,
  commitBinCount,
  discardBinCount,
  ensureBin,
  markOpeningStockDone,
  openBinCount,
  quickAddPart,
  recordCounts,
  recordReceiptLines,
  setReceiptDetails,
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
        purpose: item.purpose,
        runId: item.runId,
      });
    case 'bin_count_lines':
      return recordCounts(supabase, { stocktakeId: item.stocktakeId, binId: item.binId, lines: item.lines });
    case 'commit_bin_count':
      return commitBinCount(supabase, item.stocktakeId, item.confirmEmpty);
    case 'discard_bin_count':
      return sendDiscard(item);
    case 'receipt_lines':
      return recordReceiptLines(supabase, {
        documentId: item.documentId,
        locationId: item.locationId,
        device: item.device,
        lines: item.lines,
      });
    case 'receipt_details':
      return sendReceiptDetails(item);
    case 'close_receipt':
      return closeStockDocument(supabase, item.documentId);
    case 'quick_add':
      return sendQuickAdd(item);
    case 'opening_stock_done':
      return markOpeningStockDone(supabase, item.locationId);
  }
}

// A PartsLogic without discard_bin_count yet (PGRST202, no such function) can't be told; its own clean-up
// cancels the count after 24 hours, so this is done rather than stuck in Sync.
async function sendDiscard(item: Extract<QueueItem, { kind: 'discard_bin_count' }>) {
  try {
    return await discardBinCount(supabase, item.stocktakeId);
  } catch (error) {
    if ((error as { code?: string | null }).code === 'PGRST202') return { stocktakeId: item.stocktakeId, discarded: false };
    throw error;
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

// Who a delivery came from, sent after its first lines (same stream), so the receipt exists. It's extra
// detail on a delivery, never a reason to hold the delivery up: when PartsLogic refuses it (a supplier
// removed since the list was saved), the refusal is recorded as the answer and the delivery's Finish
// still goes through. The office can set the supplier on the receipt. No signal is still a retry.
async function sendReceiptDetails(item: Extract<QueueItem, { kind: 'receipt_details' }>) {
  try {
    return await setReceiptDetails(supabase, {
      documentId: item.documentId,
      sourceId: item.sourceId,
      brandId: item.brandId,
      reference: item.reference,
    });
  } catch (error) {
    if (classifyQueueError(error as { code?: string; message?: string }) === 'retry') throw error;
    return { refused: error instanceof Error ? error.message : String(error) };
  }
}
