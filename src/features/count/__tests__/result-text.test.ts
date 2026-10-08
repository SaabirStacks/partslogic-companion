import { countResultText, countSummary } from '../result-text';

const result = { stocktakeId: 'S1', status: 'posted', duplicate: false, partial: false, needsReview: false, putAway: 0, returned: 0, found: 0, unresolved: 0 };

describe('countResultText', () => {
  it('says what the count changed, in a few words', () => {
    expect(countResultText({ stage: 'done', result: { ...result, putAway: 6, returned: 1 } }).text).toBe('6 put away · 1 back to Unbinned');
    expect(countResultText({ stage: 'done', result }).text).toBe('No change');
  });

  it('notes an office review and flags a stuck count', () => {
    expect(countResultText({ stage: 'done', result: { ...result, found: 2, partial: true } }).text).toBe('2 found · office will review');
    expect(countResultText({ stage: 'attention', reason: 'Bin is inactive' })).toEqual({ text: 'Not finished · Bin is inactive', problem: true });
  });
});

describe('countSummary', () => {
  it('gives the result in big numbers, green when done', () => {
    const summary = countSummary({ stage: 'done', result: { ...result, putAway: 6, returned: 1, found: 2 } });
    expect(summary.tone).toBe('safe');
    expect(summary.items.map((item) => [item.label, item.value])).toEqual([
      ['Put away', 6],
      ['To Unbinned', 1],
      ['Found', 2],
    ]);
  });

  it('adds unknown codes, turns yellow for an office review, and red when stuck', () => {
    const review = countSummary({ stage: 'done', result: { ...result, unresolved: 1, needsReview: true } });
    expect(review.tone).toBe('warning');
    expect(review.items.at(-1)).toEqual({ value: 1, label: 'Unknown', tone: 'warning' });
    expect(countSummary({ stage: 'attention', reason: null }).tone).toBe('stop');
    expect(countSummary({ stage: 'waiting' }).items).toEqual([]);
  });
});
