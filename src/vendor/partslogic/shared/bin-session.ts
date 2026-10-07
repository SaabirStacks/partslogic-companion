// A phone's bin-count session, and the items its offline queue replays. Pure: the app keeps the state in
// SQLite and sends it with the floor wrappers in ./floor.ts.
//
// The session holds a running total per scanned code. Totals are sent with record_counts, which replaces a
// total it has seen before, so the phone can send the whole session as often as it likes. A line taken back
// to 0 stays in the session (hidden from the counter) so the 0 reaches the server and voids what was sent.

export type BinSessionLine = {
  clientCountId: string;
  code: string;
  qty: number;
  partId: number | null;
};

export type BinSession = {
  stocktakeId: string;
  binId: number | null;
  binCode: string | null;
  locationId: number | null;
  startedAt: string;
  lines: BinSessionLine[];
};

export type BinSessionAction =
  | { type: 'lock_bin'; binId: number; binCode: string; locationId: number }
  | { type: 'scan'; clientCountId: string; code: string; partId?: number | null }
  | { type: 'increment'; clientCountId: string }
  | { type: 'decrement'; clientCountId: string }
  | { type: 'set_qty'; clientCountId: string; qty: number }
  | { type: 'remove'; clientCountId: string };

export function emptyBinSession(stocktakeId: string, startedAt = new Date().toISOString()): BinSession {
  return { stocktakeId, binId: null, binCode: null, locationId: null, startedAt, lines: [] };
}

function setQty(state: BinSession, clientCountId: string, qty: (current: number) => number): BinSession {
  return {
    ...state,
    lines: state.lines.map((line) =>
      line.clientCountId === clientCountId ? { ...line, qty: Math.max(0, qty(line.qty)) } : line,
    ),
  };
}

export function reduceBinSession(state: BinSession, action: BinSessionAction): BinSession {
  switch (action.type) {
    case 'lock_bin':
      return { ...state, binId: action.binId, binCode: action.binCode, locationId: action.locationId };
    case 'scan': {
      const code = action.code.trim();
      if (!code) return state;
      const existing = state.lines.find((line) => line.code === code);
      if (existing) return setQty(state, existing.clientCountId, (qty) => qty + 1);
      return {
        ...state,
        lines: [...state.lines, { clientCountId: action.clientCountId, code, qty: 1, partId: action.partId ?? null }],
      };
    }
    case 'increment':
      return setQty(state, action.clientCountId, (qty) => qty + 1);
    case 'decrement':
      return setQty(state, action.clientCountId, (qty) => qty - 1);
    case 'set_qty':
      return setQty(state, action.clientCountId, () => (Number.isFinite(action.qty) ? action.qty : 0));
    case 'remove':
      return setQty(state, action.clientCountId, () => 0);
  }
}

// What the counter sees: lines still above 0.
export function visibleLines(session: BinSession): BinSessionLine[] {
  return session.lines.filter((line) => line.qty > 0);
}

// What record_counts is sent: every line, zeros included.
export function sessionLines(session: BinSession): { clientCountId: string; code: string; qty: number }[] {
  return session.lines.map((line) => ({ clientCountId: line.clientCountId, code: line.code, qty: line.qty }));
}

// The offline queue, replayed in order. clientId is the queue item's own id; the server recognises a replay
// by the ids inside (stocktakeId, clientCountId, documentId, clientLineId), and by brand and number for a
// quick add, so a replay is success, not an error.
export type QueueItem =
  | { kind: 'ensure_bin'; clientId: string; locationId: number; code: string }
  | { kind: 'open_bin_count'; clientId: string; stocktakeId: string; binId: number; startedAt: string; device?: string }
  | {
      kind: 'bin_count_lines';
      clientId: string;
      stocktakeId: string;
      binId: number;
      lines: { clientCountId: string; code: string; qty: number }[];
    }
  | { kind: 'commit_bin_count'; clientId: string; stocktakeId: string; confirmEmpty: boolean }
  | {
      kind: 'receipt_lines';
      clientId: string;
      documentId: string;
      locationId: number | null;
      device?: string;
      lines: { clientLineId: string; code: string; qty: number }[];
    }
  | { kind: 'close_receipt'; clientId: string; documentId: string }
  | {
      kind: 'quick_add';
      clientId: string;
      brandId?: number;
      brandName?: string;
      number: string;
      code?: string;
      confirmNewBrand?: boolean;
    };

export type QueueKind = QueueItem['kind'];
