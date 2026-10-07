import type { ReceiptLineResult, ReceiptResult } from '@/vendor/partslogic/shared/floor';

import type { OutboxItem } from '@/queue/types';

export type DeliveryLine = { clientLineId: string; code: string; qty: number; label: string | null; createdAt: string };

// Where one scanned line stands: still on the phone, refused as a whole call (attention), or what
// PartsLogic said about it.
export type LineState = { outcome: ReceiptLineResult['outcome'] | 'waiting' | 'attention'; reason: string | null };

// Line outcomes for one delivery, read from what the outbox sent and what PartsLogic answered.
export function lineStates(items: OutboxItem[], documentId: string): Map<string, LineState> {
  const states = new Map<string, LineState>();
  for (const item of items) {
    if (item.payload.kind !== 'receipt_lines' || item.payload.documentId !== documentId) continue;
    const answered = new Map(
      ((item.result as ReceiptResult | null)?.lines ?? []).map((line) => [line.clientLineId, line] as const),
    );
    for (const line of item.payload.lines) {
      if (item.status === 'done') {
        const answer = answered.get(line.clientLineId);
        states.set(line.clientLineId, { outcome: answer?.outcome ?? 'booked', reason: answer?.reason ?? null });
      } else if (item.status === 'attention') {
        states.set(line.clientLineId, { outcome: 'attention', reason: item.lastError });
      } else {
        states.set(line.clientLineId, { outcome: 'waiting', reason: null });
      }
    }
  }
  return states;
}

// The receipt number PartsLogic gave the delivery, once any of it has been sent.
export function receiptNumber(items: OutboxItem[], documentId: string): string | null {
  for (const item of items) {
    const { payload } = item;
    if (item.status !== 'done' || !('documentId' in payload) || payload.documentId !== documentId) continue;
    const number = (item.result as { number?: string } | null)?.number;
    if (number) return number;
  }
  return null;
}

export type GroupStatus = 'attention' | 'refused' | 'unknown' | 'void' | 'waiting' | 'booked';

export type LineGroup = {
  code: string;
  label: string | null;
  total: number;
  status: GroupStatus;
  reason: string | null;
  lastAt: string;
};

// The order a group's status is reported in: the thing a person must act on first.
const PRECEDENCE: GroupStatus[] = ['attention', 'refused', 'unknown', 'void', 'waiting', 'booked'];

function groupStatus(state: LineState | undefined): GroupStatus {
  switch (state?.outcome) {
    case 'attention':
      return 'attention';
    case 'refused':
      return 'refused';
    case 'unresolved':
      return 'unknown';
    // An undo that took back more than was received: kept for the office to review.
    case 'void':
      return 'void';
    case undefined:
    case 'waiting':
      return 'waiting';
    default:
      // booked, duplicate (already booked) and skipped need nothing now.
      return 'booked';
  }
}

// One row per code, newest scan first, with the total received and the most urgent status.
export function groupLines(lines: DeliveryLine[], states: Map<string, LineState>): LineGroup[] {
  const groups = new Map<string, LineGroup>();
  for (const line of lines) {
    const state = states.get(line.clientLineId);
    const status = groupStatus(state);
    const group = groups.get(line.code);
    if (!group) {
      groups.set(line.code, { code: line.code, label: line.label, total: line.qty, status, reason: state?.reason ?? null, lastAt: line.createdAt });
      continue;
    }
    group.total += line.qty;
    group.label = group.label ?? line.label;
    if (line.createdAt > group.lastAt) group.lastAt = line.createdAt;
    if (PRECEDENCE.indexOf(status) < PRECEDENCE.indexOf(group.status)) {
      group.status = status;
      group.reason = state?.reason ?? null;
    }
  }
  return [...groups.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : a.lastAt > b.lastAt ? -1 : 0));
}

// The line that brings a code's total to `target`: positive to add, negative to take back. Null when
// nothing changes or the target isn't a whole number of units.
export function adjustmentTo(target: number, total: number): number | null {
  if (!Number.isInteger(target) || target < 0) return null;
  const change = target - total;
  return change === 0 ? null : change;
}
