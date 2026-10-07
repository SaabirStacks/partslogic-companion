import { visibleTabs } from '../tabs';

describe('visibleTabs', () => {
  it('gives counters and above every job', () => {
    for (const role of ['counter', 'editor', 'admin', 'owner'] as const) {
      expect(visibleTabs(role)).toEqual(['lookup', 'receive', 'count', 'outbox']);
    }
  });

  it('gives viewers look up and their account', () => {
    expect(visibleTabs('viewer')).toEqual(['lookup', 'account']);
  });
});
