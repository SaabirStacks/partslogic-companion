import type { PackingLine, PackingOrder } from '@/vendor/partslogic/shared/sales/picking';

// Packing one delivery on the phone (S5b): each part scanned (or tapped, when it won't scan) into the box until every
// unit is in, then the parcels and Packed. Pure, so it's tested without a phone.

export type BoxLine = PackingLine & { scanned: number; tapped: number };
export type Box = { order: PackingOrder; lines: BoxLine[] };

export const inBox = (line: BoxLine) => line.scanned + line.tapped;
export const full = (line: BoxLine) => inBox(line) >= line.qty;

export function openBox(order: PackingOrder): Box {
  return { order, lines: order.lines.map((line) => ({ ...line, scanned: 0, tapped: 0 })) };
}

export function boxTotals(box: Box): { units: number; inBox: number; ready: boolean } {
  const units = box.lines.reduce((sum, line) => sum + line.qty, 0);
  const count = box.lines.reduce((sum, line) => sum + Math.min(inBox(line), line.qty), 0);
  return { units, inBox: count, ready: box.lines.length > 0 && box.lines.every(full) };
}

// Packed by scan when every unit was scanned in; by tap when any went in without one.
export const packMethod = (box: Box): 'scan' | 'tap' => (box.lines.some((line) => line.tapped > 0) ? 'tap' : 'scan');

export type BoxOutcome =
  | { kind: 'added'; line: BoxLine; complete: boolean }
  | { kind: 'spare'; line: BoxLine }
  | { kind: 'not_on_order' };

// A scanned part goes into the box for its line; a part whose units are all in is a spare.
export function scanIntoBox(box: Box, partId: number): { box: Box; outcome: BoxOutcome } {
  const lines = box.lines.filter((line) => line.part.id === partId);
  if (lines.length === 0) return { box, outcome: { kind: 'not_on_order' } };
  const target = lines.find((line) => !full(line));
  if (!target) return { box, outcome: { kind: 'spare', line: lines[lines.length - 1] } };
  const line = { ...target, scanned: target.scanned + 1 };
  return { box: withLine(box, line), outcome: { kind: 'added', line, complete: full(line) } };
}

// − and + on a line: + puts one in without a scan; − takes one out, a tap first.
export function stepLine(box: Box, lineId: number, change: 1 | -1): Box {
  const line = box.lines.find((candidate) => candidate.lineId === lineId);
  if (!line) return box;
  if (change > 0) return full(line) ? box : withLine(box, { ...line, tapped: line.tapped + 1 });
  if (line.tapped > 0) return withLine(box, { ...line, tapped: line.tapped - 1 });
  if (line.scanned > 0) return withLine(box, { ...line, scanned: line.scanned - 1 });
  return box;
}

// A typed number of units in the box, up to the line's.
export function setLine(box: Box, lineId: number, target: number): Box {
  const line = box.lines.find((candidate) => candidate.lineId === lineId);
  if (!line || !Number.isInteger(target) || target < 0) return box;
  const want = Math.min(target, line.qty);
  const scanned = Math.min(line.scanned, want);
  return withLine(box, { ...line, scanned, tapped: want - scanned });
}

function withLine(box: Box, line: BoxLine): Box {
  return { ...box, lines: box.lines.map((candidate) => (candidate.lineId === line.lineId ? line : candidate)) };
}
