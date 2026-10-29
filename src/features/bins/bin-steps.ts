import type { BinChoice } from '@/features/count/bin-choices';

// Tab view finds a bin a part of its name at a time: 02-B-03 is aisle 02, then letter B, then number 03.
// Each step offers only what the location has under the parts chosen so far. Any name works: one with
// fewer parts ends sooner, and one without dashes is a single tile.

// A bin name's parts: "02-B-03" → ["02", "B", "03"].
export const binParts = (code: string): string[] =>
  code
    .toUpperCase()
    .split('-')
    .map((part) => part.trim())
    .filter(Boolean);

const startsWith = (parts: readonly string[], path: readonly string[]) => path.every((part, i) => parts[i] === part);

const byLabel = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });

// The bins under the parts chosen so far.
export function binsUnder(bins: readonly BinChoice[], path: readonly string[]): BinChoice[] {
  return bins.filter((bin) => startsWith(binParts(bin.code), path));
}

export type StepTile = {
  key: string;
  // The next part ("B"), or the whole name of a bin that ends at the parts chosen (02-A beside 02-A-01).
  label: string;
  // Every bin under it.
  bins: BinChoice[];
  // The bin, when the tile is one bin whose name ends here, so tapping it chooses it. Otherwise null and
  // tapping it opens the next step.
  bin: BinChoice | null;
  // The parts chosen once it's tapped.
  path: string[];
};

// What the step asks for: the first part is the aisle; after that a letter or a number when every tile
// is one, else just the next part.
export type StepAsk = 'aisle' | 'letter' | 'number' | 'part';

export type BinStep = {
  // The name so far, with a ? for each part still to choose: ["02", "B", "?"].
  shown: string[];
  ask: StepAsk;
  tiles: StepTile[];
  // How many bins are under the parts chosen.
  count: number;
};

export function binStep(bins: readonly BinChoice[], path: readonly string[]): BinStep {
  const depth = path.length;
  const whole: StepTile[] = [];
  const groups = new Map<string, BinChoice[]>();
  let longest = depth;
  let count = 0;

  for (const bin of bins) {
    const parts = binParts(bin.code);
    if (!startsWith(parts, path)) continue;
    count += 1;
    longest = Math.max(longest, parts.length);
    if (parts.length === depth) {
      whole.push({ key: `bin:${bin.binId}`, label: bin.code, bins: [bin], bin, path: [...path] });
      continue;
    }
    const part = parts[depth];
    groups.set(part, [...(groups.get(part) ?? []), bin]);
  }

  const labels = [...groups.keys()].sort(byLabel);
  const tiles = labels.map((part): StepTile => {
    const under = groups.get(part) ?? [];
    const only = under.length === 1 && binParts(under[0].code).length === depth + 1 ? under[0] : null;
    return { key: `part:${part}`, label: part, bins: under, bin: only, path: [...path, part] };
  });

  return {
    shown: [...path, ...Array<string>(longest - depth).fill('?')],
    ask: askFor(depth, labels),
    tiles: [...whole, ...tiles],
    count,
  };
}

function askFor(depth: number, labels: string[]): StepAsk {
  if (depth === 0) return 'aisle';
  if (labels.length > 0 && labels.every((label) => /^[A-Z]+$/.test(label))) return 'letter';
  if (labels.length > 0 && labels.every((label) => /^\d+$/.test(label))) return 'number';
  return 'part';
}
