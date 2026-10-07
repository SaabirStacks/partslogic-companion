import { acceptScan } from '../scan-gate';

describe('acceptScan', () => {
  it('accepts the first scan and a different code straight away', () => {
    expect(acceptScan(null, 'A', 0)).toBe(true);
    expect(acceptScan({ code: 'A', seenAt: 1000 }, 'B', 1001)).toBe(true);
  });

  it('ignores the same code while it stays in view', () => {
    expect(acceptScan({ code: 'A', seenAt: 1000 }, 'A', 1100)).toBe(false);
  });

  it('accepts the same code again once it has been out of view for the cooldown', () => {
    expect(acceptScan({ code: 'A', seenAt: 1000 }, 'A', 2200)).toBe(true);
  });
});
