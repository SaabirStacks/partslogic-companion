import type { QuickAddResult } from '@/vendor/partslogic/shared/floor';

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

type Conflict = Extract<QuickAddResult, { status: 'conflict' }>;
type Added = Extract<QuickAddResult, { status: 'added' }>;

// "4006… already belongs to MANN W 712/75": nothing was created, and it isn't retried.
export function conflictMessage(result: Conflict): string {
  const holder = result.holder ? `${result.holder.brand} ${result.holder.number}` : 'another part';
  return `${result.code} already belongs to ${holder}, so nothing was added.`;
}

// What happened when the part was added, for the person who added it.
export function addedMessage(result: Added, brand: string, number: string): string {
  return [
    result.createdPart ? `Added ${brand} ${number}.` : `${brand} ${number} was already in the catalogue.`,
    result.wasInInventory ? 'It was already in your range.' : 'It’s now in your range.',
    result.createdBrand ? `${brand} was added as a new brand.` : null,
    result.healed > 0 ? `${plural(result.healed, 'waiting scan was', 'waiting scans were')} booked to it.` : null,
  ]
    .filter(Boolean)
    .join(' ');
}
