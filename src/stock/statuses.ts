// Stock statuses: what each unit on a shelf may be used for. PartsLogic doesn't tag stock with a status
// yet; until it does, every unit on hand counts as Available. This is the phone's whole list, ready for
// that day, kept in one place like the workflow catalogue. When PartsLogic sends a status on each stock
// line, the part card's circles and its bins fill in from it with no other change.
//
// Each status falls in one of the part card's three circles:
//   available    can be sold and picked
//   reserved     promised to an order: picked for it, not sold to anyone else
//   unavailable  can't be used: held until someone signs it off, or locked until it's dealt with

export type StockCircle = 'available' | 'reserved' | 'unavailable';
export type StockStatusCode = 'AVAIL' | 'RESV' | 'XDOCK' | 'QAHOLD' | 'CORE' | 'RTV' | 'RECALL' | 'DAMG' | 'SCRAP';

export type StockStatus = {
  code: string;
  // What staff call it, in sentence case.
  name: string;
  circle: StockCircle;
  // For unavailable stock: held (frozen until someone acts) or locked (kept apart until it's disposed of).
  hold: 'held' | 'locked' | null;
  // What PartsLogic does with stock in this status.
  meaning: string;
};

const status = (code: StockStatusCode, name: string, circle: StockCircle, hold: StockStatus['hold'], meaning: string) => ({ code, name, circle, hold, meaning });

// In the order they're listed wherever more than one shows.
export const STOCK_STATUSES: Record<StockStatusCode, StockStatus> = {
  AVAIL: status('AVAIL', 'Available', 'available', null, 'Can be sold and picked'),
  RESV: status('RESV', 'Reserved', 'reserved', null, 'Kept for an order: picked for it, not sold'),
  XDOCK: status('XDOCK', 'Cross-dock', 'reserved', null, 'Goes straight to shipping, first'),
  QAHOLD: status('QAHOLD', 'QA hold', 'unavailable', 'held', 'Frozen until a technician signs it off'),
  CORE: status('CORE', 'Core return', 'unavailable', 'held', 'Frozen until it goes for remanufacture'),
  RTV: status('RTV', 'Return to supplier', 'unavailable', 'held', 'Frozen until the supplier credits or collects it'),
  RECALL: status('RECALL', 'Recall', 'unavailable', 'locked', 'Locked: keep it apart'),
  DAMG: status('DAMG', 'Damaged', 'unavailable', 'locked', 'Locked until it is written off'),
  SCRAP: status('SCRAP', 'Scrap', 'unavailable', 'locked', 'Locked until it is thrown away'),
};

const ORDER = Object.keys(STOCK_STATUSES);

// A line with no status is Available (PartsLogic today). A code this phone doesn't know is locked, so stock
// is never shown as sellable unless PartsLogic says it is.
export function statusOf(code: string | null | undefined): StockStatus {
  if (!code) return STOCK_STATUSES.AVAIL;
  const known = STOCK_STATUSES[code.trim().toUpperCase() as StockStatusCode];
  return known ?? { code, name: code, circle: 'unavailable', hold: 'locked', meaning: 'Not known to this phone' };
}

export type StatusLine = { qty: number; status?: string | null };
export type StatusQty = { status: StockStatus; qty: number };

export type StockBreakdown = {
  onHand: number;
  available: number;
  reserved: number;
  unavailable: number;
  // The statuses that aren't Available, with how many in each, in the list's order.
  setAside: StatusQty[];
};

// Splits what's on hand into the three circles. On hand is PartsLogic's own total; reserved and
// unavailable are what the lines say, and Available is the rest, so the three always add up to on hand.
export function stockBreakdown(onHand: number, lines: readonly StatusLine[]): StockBreakdown {
  const setAside = setAsideOf(lines);
  const sum = (circle: StockCircle) => setAside.filter((entry) => entry.status.circle === circle).reduce((total, entry) => total + entry.qty, 0);
  const reserved = sum('reserved');
  const unavailable = sum('unavailable');
  return { onHand, available: onHand - reserved - unavailable, reserved, unavailable, setAside };
}

export type BinStock<L> = { line: L; qty: number; setAside: StatusQty[] };

// The stock lines as one row per bin: its total, and what in it isn't Available. PartsLogic may send a bin
// once per status; the first line for a bin stands for it (its id and name).
export function stockByBin<L extends StatusLine & { binId: number }>(lines: readonly L[]): BinStock<L>[] {
  const bins = new Map<number, L[]>();
  for (const line of lines) bins.set(line.binId, [...(bins.get(line.binId) ?? []), line]);
  return [...bins.values()].map((group) => ({
    line: group[0],
    qty: group.reduce((total, line) => total + line.qty, 0),
    setAside: setAsideOf(group),
  }));
}

function setAsideOf(lines: readonly StatusLine[]): StatusQty[] {
  const totals = new Map<string, StatusQty>();
  for (const line of lines) {
    const found = statusOf(line.status);
    if (found.circle === 'available' || line.qty === 0) continue;
    const entry = totals.get(found.code) ?? { status: found, qty: 0 };
    totals.set(found.code, { ...entry, qty: entry.qty + line.qty });
  }
  const rank = (code: string) => (ORDER.includes(code) ? ORDER.indexOf(code) : ORDER.length);
  return [...totals.values()].sort((a, b) => rank(a.status.code) - rank(b.status.code));
}
