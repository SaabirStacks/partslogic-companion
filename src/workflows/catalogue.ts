import type { Href } from 'expo-router';

import type { IconName } from '@/ui/icons';
import { roleAtLeast, type AppRole } from '@/vendor/partslogic/shared/members';

// Every warehouse workflow, in the standard families, including the ones PartsLogic can't support yet so the
// app is shaped for them now. The board, the screen titles and (later) the type of a session all read their
// names from here. A workflow shows on the board only once it is live.
export type WorkflowFamily = 'parts' | 'inbound' | 'stock' | 'outbound';

export const FAMILIES: readonly { id: WorkflowFamily; label: string }[] = [
  { id: 'parts', label: 'Parts' },
  { id: 'inbound', label: 'Inbound' },
  { id: 'stock', label: 'Stock control' },
  { id: 'outbound', label: 'Outbound' },
];

type Base = {
  family: WorkflowFamily;
  label: string;
  // The least role that may do it; PartsLogic's row-level security makes the same call on the server.
  minRole: AppRole;
};

// live: on the board with a screen. server-ready: PartsLogic can do it, the app has no screen yet.
// planned: PartsLogic needs new tables or functions first (needs says which).
export type LiveWorkflow = Base & {
  availability: 'live';
  icon: IconName;
  href: Href;
  // false for a job started from inside another one rather than from its own tile.
  onBoard?: false;
};
export type FutureWorkflow = Base & { availability: 'server-ready' | 'planned'; needs: string };

const LIVE = {
  lookup: { family: 'parts', label: 'Look up', minRole: 'viewer', availability: 'live', icon: 'lookup', href: '/lookup' },
  'add-part': { family: 'parts', label: 'Add part', minRole: 'counter', availability: 'live', icon: 'add', href: '/quick-add' },
  receive: { family: 'inbound', label: 'Receive goods', minRole: 'counter', availability: 'live', icon: 'receive', href: '/receive' },
  // Put away and Stock count share the bin count: counting a bin is how PartsLogic moves stock out of
  // Unbinned onto the shelf.
  'put-away': {
    family: 'inbound',
    label: 'Put away',
    minRole: 'counter',
    availability: 'live',
    icon: 'putAway',
    href: { pathname: '/count', params: { purpose: 'put-away' } },
  },
  'stock-count': {
    family: 'stock',
    label: 'Stock count',
    minRole: 'counter',
    availability: 'live',
    icon: 'count',
    href: { pathname: '/count', params: { purpose: 'stock-count' } },
  },
  // Stock take and Opening stock are planned runs of bin counts: the phone keeps the run together and each
  // bin is a count PartsLogic records with the run and its purpose. Opening stock books found stock as
  // opening stock. A location is set up once (at go-live, or a new branch), so Opening stock has no tile:
  // Stock take's first step asks which it is.
  'stock-take': {
    family: 'stock',
    label: 'Stock take',
    minRole: 'counter',
    availability: 'live',
    icon: 'stockTake',
    href: { pathname: '/count', params: { purpose: 'stock-take' } },
  },
  'opening-stock': {
    family: 'stock',
    label: 'Opening stock',
    minRole: 'counter',
    availability: 'live',
    icon: 'opening',
    href: { pathname: '/count', params: { purpose: 'opening-stock' } },
    onBoard: false,
  },
  transfer: { family: 'stock', label: 'Transfer stock', minRole: 'counter', availability: 'live', icon: 'move', href: '/move' },
} as const satisfies Record<string, LiveWorkflow>;

const FUTURE = {
  'inbound-staging': {
    family: 'inbound',
    label: 'Inbound staging',
    minRole: 'counter',
    availability: 'planned',
    needs: 'Staging areas; today every receipt lands in its location’s Unbinned bin',
  },
  'customer-return': { family: 'inbound', label: 'Customer return', minRole: 'counter', availability: 'planned', needs: 'A returns document (the customer_return movement reason exists)' },
  adjust: { family: 'stock', label: 'Adjust stock', minRole: 'editor', availability: 'server-ready', needs: 'A screen for adjust_stock' },
  pick: { family: 'outbound', label: 'Pick', minRole: 'counter', availability: 'planned', needs: 'Orders and pick lists' },
  pack: { family: 'outbound', label: 'Pack', minRole: 'counter', availability: 'planned', needs: 'Orders and packages' },
  'outbound-staging': { family: 'outbound', label: 'Outbound staging', minRole: 'counter', availability: 'planned', needs: 'Dispatch staging areas' },
  dispatch: { family: 'outbound', label: 'Dispatch', minRole: 'counter', availability: 'planned', needs: 'Shipments and carriers' },
  'supplier-return': { family: 'outbound', label: 'Return to supplier', minRole: 'counter', availability: 'planned', needs: 'A returns document (the supplier_return movement reason exists)' },
} as const satisfies Record<string, FutureWorkflow>;

export type LiveWorkflowId = keyof typeof LIVE;
export type WorkflowId = LiveWorkflowId | keyof typeof FUTURE;
export type Workflow = (LiveWorkflow | FutureWorkflow) & { id: WorkflowId };

// In family order, then the order written above.
export const WORKFLOWS: readonly Workflow[] = FAMILIES.flatMap(({ id: family }) =>
  [...Object.entries(LIVE), ...Object.entries(FUTURE)]
    .filter(([, entry]) => entry.family === family)
    .map(([id, entry]) => ({ ...entry, id: id as WorkflowId }) as Workflow),
);

export function liveWorkflow(id: LiveWorkflowId): LiveWorkflow & { id: LiveWorkflowId } {
  return { ...LIVE[id], id };
}

export type BoardSection = { family: WorkflowFamily; label: string; workflows: (LiveWorkflow & { id: LiveWorkflowId })[] };

// The board for a role: each family with at least one live workflow that role may do and that has a tile,
// in family order.
export function boardFor(role: AppRole): BoardSection[] {
  return FAMILIES.map(({ id, label }) => ({
    family: id,
    label,
    workflows: WORKFLOWS.filter(
      (entry): entry is LiveWorkflow & { id: LiveWorkflowId } =>
        entry.family === id && entry.availability === 'live' && entry.onBoard !== false && roleAtLeast(role, entry.minRole),
    ),
  })).filter((section) => section.workflows.length > 0);
}
