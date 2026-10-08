import { clock } from '@/lib/format';

import { resumeText } from '../open-work';

const startedAt = '2026-10-08T09:14:00.000Z';

describe('resumeText', () => {
  it('describes an open delivery', () => {
    expect(resumeText({ kind: 'delivery', units: 12, startedAt })).toEqual({
      title: 'Delivery',
      detail: `12 units · started ${clock(startedAt)}`,
      href: '/receive',
    });
  });

  it('describes an open bin count by its bin', () => {
    expect(resumeText({ kind: 'count', bin: 'A-01', units: 1, startedAt })).toEqual({
      title: 'Bin A-01',
      detail: `1 unit · started ${clock(startedAt)}`,
      href: '/count',
    });
  });
});
