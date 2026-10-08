import type { PartDetail } from '@/vendor/partslogic/shared/catalogue';

import { partAnswer } from '../answer';

type Item = { isStocked: boolean; onHand: number; belowReorder: boolean; sellPrice: number | null; stock: { binId: number; place: string; qty: number }[] };

const detail = (item: Item | null): PartDetail =>
  ({
    part: { id: 7, brand: 'Mann', number: 'HU 816 x', description: 'Oil filter' },
    displayName: null,
    item,
  }) as unknown as PartDetail;

const stocked = (overrides: Partial<Item> = {}): Item => ({
  isStocked: true,
  onHand: 12,
  belowReorder: false,
  sellPrice: 9.5,
  stock: [
    { binId: 1, place: 'MAIN/A-01', qty: 4 },
    { binId: 2, place: 'MAIN/C-03', qty: 8 },
  ],
  ...overrides,
});

describe('partAnswer', () => {
  it('is a white plate for a part in stock, with its bins (most first) and sell price', () => {
    const answer = partAnswer(detail(stocked()), 'GBP');
    expect(answer.tone).toBe('surface');
    expect(answer.status.label).toBe('In stock');
    expect(answer.onHand).toBe('12');
    expect(answer.bins.map((bin) => bin.place)).toEqual(['MAIN/C-03', 'MAIN/A-01']);
    expect(answer.price).toBe('£9.50');
    expect(answer.name).toBe('Oil filter');
  });

  it('follows the stock sign: red when out, yellow when it needs reordering', () => {
    expect(partAnswer(detail(stocked({ onHand: 0, stock: [] })), 'GBP')).toMatchObject({ tone: 'stop', status: { label: 'Out of stock' } });
    expect(partAnswer(detail(stocked({ onHand: 2, belowReorder: true })), 'GBP')).toMatchObject({ tone: 'warning', status: { label: 'Reorder' } });
  });

  it('shows three bins and counts the rest, skipping empty ones', () => {
    const stock = [5, 4, 3, 2, 0].map((qty, index) => ({ binId: index, place: `B-${index}`, qty }));
    const answer = partAnswer(detail(stocked({ stock })), 'GBP');
    expect(answer.bins).toHaveLength(3);
    expect(answer.moreBins).toBe(1);
  });

  it('says so when the part isn’t in the range', () => {
    expect(partAnswer(detail(null), 'GBP')).toMatchObject({ tone: 'surface', status: { label: 'Not in your range' }, onHand: null });
  });
});
