import { statusText } from '../status-text';

describe('statusText', () => {
  it('flags only what a person must act on', () => {
    expect(statusText('refused', 'More than was received').problem).toBe(true);
    expect(statusText('attention', 'Not allowed').text).toBe('Not sent: Not allowed');
    for (const status of ['booked', 'waiting', 'unknown', 'void'] as const) {
      expect(statusText(status, null).problem).toBe(false);
    }
  });
});
