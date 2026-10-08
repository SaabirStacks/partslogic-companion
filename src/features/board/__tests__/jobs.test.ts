import { jobsFor } from '../jobs';

describe('jobsFor', () => {
  it('gives counters and above every job', () => {
    for (const role of ['counter', 'editor', 'admin', 'owner'] as const) {
      expect(jobsFor(role).map((job) => job.id)).toEqual(['lookup', 'receive', 'count', 'move', 'add']);
    }
  });

  it('gives viewers look up only', () => {
    expect(jobsFor('viewer').map((job) => job.id)).toEqual(['lookup']);
  });
});
