import { outboxSummary } from '../status';

describe('outboxSummary', () => {
  it('puts work needing attention first', () => {
    expect(outboxSummary({ waiting: 3, needsAttention: 1, online: true, lastProblem: null }).title).toBe(
      '1 item needs attention',
    );
  });

  it('says work waits for signal when offline', () => {
    expect(outboxSummary({ waiting: 2, needsAttention: 0, online: false, lastProblem: null })).toMatchObject({
      icon: 'offline',
      title: '2 items waiting',
    });
  });

  it('is calm when everything is sent', () => {
    expect(outboxSummary({ waiting: 0, needsAttention: 0, online: true, lastProblem: null }).title).toBe('All sent');
  });
});
