import type { BoardSection, LiveWorkflow, LiveWorkflowId, WorkflowFamily } from '@/workflows/catalogue';

// How the board arranges a role's workflows: Look up is the search field at the top, like a retail app,
// and every other job is a tile under its family. Parts (with Add part) sits after the floor jobs, so the
// day's work comes first.
const SEARCH: LiveWorkflowId = 'lookup';
const LAST: WorkflowFamily = 'parts';

export type BoardLayout = { search: (LiveWorkflow & { id: LiveWorkflowId }) | null; sections: BoardSection[] };

export function boardLayout(sections: BoardSection[]): BoardLayout {
  const search = sections.flatMap((section) => section.workflows).find((workflow) => workflow.id === SEARCH) ?? null;
  const tiled = sections
    .map((section) => ({ ...section, workflows: section.workflows.filter((workflow) => workflow.id !== SEARCH) }))
    .filter((section) => section.workflows.length > 0);
  return {
    search,
    sections: [...tiled.filter((section) => section.family !== LAST), ...tiled.filter((section) => section.family === LAST)],
  };
}
