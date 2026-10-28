import { boardFor } from '@/workflows/catalogue';

import { boardLayout } from '../board-layout';

const ids = (layout: ReturnType<typeof boardLayout>) =>
  layout.sections.map((section) => [section.family, section.workflows.map((workflow) => workflow.id)]);

describe('boardLayout', () => {
  it('puts Look up in the search field and Parts after the floor jobs', () => {
    const layout = boardLayout(boardFor('counter'));
    expect(layout.search?.id).toBe('lookup');
    expect(ids(layout)).toEqual([
      ['inbound', ['receive', 'put-away']],
      ['stock', ['stock-count', 'stock-take', 'opening-stock', 'transfer']],
      ['parts', ['add-part']],
    ]);
  });

  it('gives viewers the search field and no tiles', () => {
    const layout = boardLayout(boardFor('viewer'));
    expect(layout.search?.id).toBe('lookup');
    expect(layout.sections).toEqual([]);
  });

  it('has no search field when Look up is not on the board', () => {
    expect(boardLayout([]).search).toBeNull();
  });
});
