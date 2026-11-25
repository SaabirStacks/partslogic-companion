// The state of every status badge (docs/design-checks/status-colours.md, owner 22 November 2026). A screen draws the
// colour and the glyph from the state; the word stays the status's own. Six states in five colours:
//   not_started  grey, an empty ring: nothing has happened yet (Draft, Not invoiced)
//   ended        grey, a slashed ring: over, without going further (Cancelled, Lost, Closed short)
//   active       blue, a ring with a dot: our move, someone here acts next (To order, To pick, To check)
//   waiting      amber, a dashed ring: on someone outside, or stock on the move (Waiting on supplier, Placed)
//   ready        green, a ring with a tick: ready, finished, free to sell (Ready for collection, Paid, Available)
//   blocked      red, a ring with "!": nothing moves until someone deals with it (On hold, Rejected, Missing)
// A pill that is data, not a state (a registration, a reference, Urgent, a fit lead), is `plain`: grey, no glyph.
export const STATUS_STATES = ['not_started', 'ended', 'active', 'waiting', 'ready', 'blocked'] as const;
export type StatusState = (typeof STATUS_STATES)[number];
export type BadgeTone = StatusState | 'plain';

export type StatusFamily = 'neutral' | 'active' | 'waiting' | 'ready' | 'blocked';

export const STATUS_FAMILY: Record<StatusState, StatusFamily> = {
  not_started: 'neutral',
  ended: 'neutral',
  active: 'active',
  waiting: 'waiting',
  ready: 'ready',
  blocked: 'blocked',
};

export function isStatusState(value: string | null | undefined): value is StatusState {
  return value != null && (STATUS_STATES as readonly string[]).includes(value);
}

// Badge words that are not a domain status value (a fact a screen works out, such as a statement that agrees): each
// says one state everywhere it shows (owner, 23 November 2026: one word, one meaning). A screen names the word and the
// state comes from here, so no screen can give a word a second colour. A domain status (an order's, an account's)
// keeps its own map in its domain folder.
export const STATUS_WORD_STATES = {
  'Not recorded yet': 'not_started',
  Draft: 'not_started',
  'Draft order': 'not_started',
  Archived: 'ended',
  Reversed: 'ended',
  Cancelled: 'ended',
  Cleared: 'ended',
  'Not a replacement': 'ended',
  Voided: 'ended',
  Accepted: 'active',
  'In progress': 'active',
  'Needs review': 'active',
  'Not reconciled': 'active',
  Open: 'active',
  'To chase': 'active',
  'To check': 'active',
  'To decide': 'active',
  'To review': 'active',
  'To send': 'active',
  Unpaid: 'active',
  Reorder: 'waiting',
  Checked: 'ready',
  'Checked on bill': 'ready',
  Completed: 'ready',
  Invoiced: 'ready',
  Matched: 'ready',
  Paid: 'ready',
  'Price accepted': 'ready',
  'Prices checked': 'ready',
  Received: 'ready',
  Recorded: 'ready',
  Reconciled: 'ready',
  Replacement: 'ready',
  Settled: 'ready',
  'Below cost': 'blocked',
  Out: 'blocked',
  'On stop': 'blocked',
  'Under the minimum margin': 'blocked',
} as const satisfies Record<string, StatusState>;
export type StatusWord = keyof typeof STATUS_WORD_STATES;

