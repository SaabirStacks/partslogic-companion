import type { UnlocatedLine } from '@/vendor/partslogic/shared/floor';

// A part waiting in the location's Unbinned bin, with the shelf it already lives on (the shelf bin holding
// most of it), so putting it away is one tap: count that shelf. null when it has no shelf yet.
export type WaitingRow = { partId: number; name: string; qty: number; shelf: { binId: number; code: string } | null };
export type StockLevel = { partId: number; binId: number; qty: number };

// lines are what's in Unbinned (biggest first, as PartsLogic sends them); shelves are the location's shelf
// bins by id (no system or inactive bins).
export function waitingRows(lines: UnlocatedLine[], levels: StockLevel[], shelves: ReadonlyMap<number, string>): WaitingRow[] {
  return lines.map((line) => {
    const best = levels
      .filter((level) => level.partId === line.partId && level.qty > 0 && shelves.has(level.binId))
      .sort((a, b) => b.qty - a.qty || shelves.get(a.binId)!.localeCompare(shelves.get(b.binId)!))[0];
    return {
      partId: line.partId,
      name: `${line.brand} ${line.number}`,
      qty: line.qty,
      shelf: best ? { binId: best.binId, code: shelves.get(best.binId)! } : null,
    };
  });
}
