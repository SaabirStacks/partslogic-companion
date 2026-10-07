import { classifyQueueError } from '@/vendor/partslogic/shared/errors';

export type MoveCheck = { fromBinId: number; toBinId: number | null; qty: number; available: number };

// The checks transfer_stock makes, so the Move button explains itself before anything is sent.
// PartsLogic still decides.
export function moveProblem({ fromBinId, toBinId, qty, available }: MoveCheck): string | null {
  if (toBinId == null) return 'Scan or choose the bin it’s going to.';
  if (toBinId === fromBinId) return 'Choose a different bin from the one it’s in.';
  if (!Number.isInteger(qty) || qty <= 0) return 'Move at least one.';
  if (qty > available) return `Only ${available} in that bin.`;
  return null;
}

// A move has no id made on the phone, so after a lost reply nobody knows whether it happened, and sending it
// again could move the stock twice. Moves are never queued or retried; the person checks the stock first.
export function outcomeUnknown(error: unknown): boolean {
  return classifyQueueError(error as { code?: string; message?: string }) === 'retry';
}
