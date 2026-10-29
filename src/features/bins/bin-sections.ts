import { filterBins, type BinChoice } from '@/features/count/bin-choices';

// The aisle a bin belongs to: its name up to the first dash ("02" for 02-A-01), else the whole name.
export const aisleOf = (code: string) => code.split('-')[0] || code;

export type BinSection = { title: string | null; data: BinChoice[] };

// A location's bins for a pick list. Browsing, they come grouped by aisle in label order; searching, the
// matches come as one list (names that start with what's typed first, see filterBins). Bins in skip (the
// one stock is leaving) are left out.
export function binSections(bins: BinChoice[], query: string, skip: ReadonlySet<number> = new Set()): BinSection[] {
  const shown = filterBins(bins, query).filter((bin) => !skip.has(bin.binId));
  if (query.trim() !== '') return shown.length > 0 ? [{ title: null, data: shown }] : [];
  const sections: BinSection[] = [];
  for (const bin of shown) {
    const aisle = aisleOf(bin.code);
    const last = sections.at(-1);
    if (last && last.title === aisle) last.data.push(bin);
    else sections.push({ title: aisle, data: [bin] });
  }
  return sections;
}
