import { boardFor, FAMILIES, WORKFLOWS } from '../catalogue';

describe('the workflow catalogue', () => {
  it('names each workflow once', () => {
    const ids = WORKFLOWS.map((workflow) => workflow.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('lists workflows in family order', () => {
    const order = FAMILIES.map((family) => family.id);
    const families = WORKFLOWS.map((workflow) => order.indexOf(workflow.family));
    expect(families).toEqual([...families].sort((a, b) => a - b));
  });

  it('gives every live workflow a pictogram and a screen, and every other one what PartsLogic still needs', () => {
    for (const workflow of WORKFLOWS) {
      if (workflow.availability === 'live') {
        expect(workflow.icon).toBeTruthy();
        expect(workflow.href).toBeTruthy();
      } else {
        expect(workflow.needs).toBeTruthy();
      }
    }
  });
});

describe('boardFor', () => {
  it('gives counters and above every live workflow, by family', () => {
    for (const role of ['counter', 'editor', 'admin', 'owner'] as const) {
      expect(boardFor(role).map((section) => [section.family, section.workflows.map((workflow) => workflow.id)])).toEqual([
        ['parts', ['lookup', 'add-part']],
        ['inbound', ['receive', 'put-away']],
        ['stock', ['stock-count', 'stock-take', 'opening-stock', 'transfer']],
      ]);
    }
  });

  it('gives viewers look up only', () => {
    expect(boardFor('viewer').map((section) => section.workflows.map((workflow) => workflow.id))).toEqual([['lookup']]);
  });

  it('never shows a workflow PartsLogic cannot support yet', () => {
    const shown = boardFor('owner').flatMap((section) => section.workflows.map((workflow) => workflow.id));
    for (const id of ['pick', 'pack', 'dispatch', 'customer-return', 'adjust'] as const) expect(shown).not.toContain(id);
  });
});
