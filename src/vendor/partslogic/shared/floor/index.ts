// Floor: scanning, receipts, bin counts, stock takes and review (the phone and the back office).
// The floor doors the companion app and the back office call: scanning, bins, receipts, bin counts, quick
// add, the offline index, review and reversal. Every write is idempotent on an id the device makes, so a
// replayed queue item is success, not an error (see bin-session.ts for the queue).
// The public names; apps import them from '@partslogic/shared'.
export {
  floorActivity,
  getFloorDocument,
  markFloorReviewed,
  reverseFloorChange,
  type CountRun,
  type CountTry,
  type FloorActivityRow,
  type FloorChange,
  type FloorDocument,
  type FloorDocumentKind,
  type FloorLine,
  type FloorReviewReason,
} from './activity';
export {
  emptyBinSession,
  reduceBinSession,
  sessionLines,
  visibleLines,
  type BinSession,
  type BinSessionAction,
  type BinSessionLine,
  type QueueItem,
  type QueueKind,
} from './bin-session';
export {
  countRunStatus,
  finishCountRun,
  openCountRuns,
  startCountRun,
  type SharedRun,
  type SharedRunBin,
  type SharedRunBinState,
  type SharedRunPurpose,
} from './count-runs';
export {
  commitBinCount,
  COUNT_PURPOSES,
  discardBinCount,
  ensureBin,
  openBinCount,
  recordCounts,
  type BinCountCommit,
  type CountLineResult,
  type CountPurpose,
} from './counts';
export {
  markOpeningStockDone,
  openingStockStatus,
  reopenOpeningStock,
  type OpeningStockStatus,
} from './opening-stock';
export {
  quickAddPart,
  type QuickAddResult,
} from './quick-add';
export {
  closeStockDocument,
  recordReceiptLines,
  setReceiptDetails,
  type ReceiptLineResult,
  type ReceiptManufacturer,
  type ReceiptResult,
  type ReceiptSupplier,
} from './receipts';
export {
  resolveScan,
  scanIndexPage,
  scanIndexVersion,
  type ScanHit,
  type ScanIndexEntry,
  type ScanIndexKind,
  type ScanIndexRow,
} from './scan';
export {
  linkFloorCode,
  listPendingPutAway,
  listUnlocatedStock,
  listUnresolvedCodes,
  unlocatedStockSummary,
  voidFloorCode,
  writeOffUnlocated,
  type PendingPutAway,
  type UnlocatedLine,
  type UnlocatedSummary,
  type UnresolvedCode,
} from './unresolved';
