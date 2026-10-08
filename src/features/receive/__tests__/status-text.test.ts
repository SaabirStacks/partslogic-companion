import { statusText } from '../status-text';

describe('statusText', () => {
  it('flags only what a person must act on, in red', () => {
    expect(statusText('refused', 'More than was received')).toMatchObject({ problem: true, tone: 'stop' });
    expect(statusText('attention', 'Not allowed').text).toBe('Not sent · Not allowed');
    for (const status of ['booked', 'waiting', 'unknown', 'void'] as const) {
      expect(statusText(status, null).problem).toBe(false);
    }
  });

  it('is green once booked, yellow when the office must look, and plain while waiting', () => {
    expect(statusText('booked', null).tone).toBe('safe');
    expect(statusText('unknown', null).tone).toBe('warning');
    expect(statusText('void', null).tone).toBe('warning');
    expect(statusText('waiting', null).tone).toBe('surface');
  });
});
