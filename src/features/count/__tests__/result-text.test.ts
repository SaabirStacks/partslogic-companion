import { countResultText } from '../result-text';

const result = { stocktakeId: 'S1', status: 'posted', duplicate: false, partial: false, needsReview: false, putAway: 0, returned: 0, found: 0, unresolved: 0 };

describe('countResultText', () => {
  it('says what the count changed', () => {
    expect(countResultText({ stage: 'done', result: { ...result, putAway: 6, returned: 1 } }).text).toBe(
      '6 units put away from Unbinned, 1 unit back to Unbinned.',
    );
    expect(countResultText({ stage: 'done', result }).text).toBe('No change.');
  });

  it('explains a partial count and flags a stuck one', () => {
    expect(countResultText({ stage: 'done', result: { ...result, found: 2, partial: true } }).text).toMatch(/office will review/);
    expect(countResultText({ stage: 'attention', reason: 'Bin is inactive' })).toEqual({
      text: 'Not finished: Bin is inactive',
      problem: true,
    });
  });
});
