import { clock, when } from '../format';

describe('when', () => {
  const now = new Date('2026-10-28T23:09:00');

  it('gives just the time for today, and the day as well for anything older', () => {
    expect(when('2026-10-28T15:57:00', now)).toBe(clock('2026-10-28T15:57:00'));
    expect(when('2026-10-27T15:57:00', now)).toBe(`Yesterday ${clock('2026-10-27T15:57:00')}`);
    expect(when('2026-10-24T13:28:00', now)).toBe(`24 Oct ${clock('2026-10-24T13:28:00')}`);
    expect(when('2025-10-24T13:28:00', now)).toBe(`24 Oct 2025 ${clock('2025-10-24T13:28:00')}`);
  });
});
