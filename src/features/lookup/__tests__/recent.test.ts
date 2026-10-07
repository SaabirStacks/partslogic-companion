import { addRecent } from '../recent';

const part = (partId: number) => ({ partId, brand: 'BOSCH', number: `N${partId}`, description: null });

describe('addRecent', () => {
  it('puts the newest first and keeps each part once', () => {
    expect(addRecent([part(1), part(2)], part(2)).map((p) => p.partId)).toEqual([2, 1]);
  });

  it('keeps the list to its limit', () => {
    expect(addRecent([part(1), part(2), part(3)], part(4), 3).map((p) => p.partId)).toEqual([4, 1, 2]);
  });
});
