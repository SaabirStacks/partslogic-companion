import { formatMoney, stockBadge } from '../stock';

describe('stockBadge', () => {
  it('shows Out for a stocked part at or below zero, even when also below reorder', () => {
    expect(stockBadge({ isStocked: true, onHand: 0, belowReorder: true })).toBe('out');
    expect(stockBadge({ isStocked: true, onHand: -2, belowReorder: false })).toBe('out');
  });

  it('shows Reorder below the reorder level', () => {
    expect(stockBadge({ isStocked: true, onHand: 3, belowReorder: true })).toBe('reorder');
  });

  it('shows nothing otherwise, including unstocked parts at zero', () => {
    expect(stockBadge({ isStocked: true, onHand: 12, belowReorder: false })).toBeNull();
    expect(stockBadge({ isStocked: false, onHand: 0, belowReorder: false })).toBeNull();
  });
});

describe('formatMoney', () => {
  it('formats pounds and leaves missing prices empty', () => {
    expect(formatMoney(12.5, 'GBP')).toBe('£12.50');
    expect(formatMoney(null, 'GBP')).toBeNull();
  });
});
