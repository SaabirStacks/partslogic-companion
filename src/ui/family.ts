import type { WorkflowFamily } from '@/workflows/catalogue';

import type { ColourName } from './palette';

// A job family's colour: teal for inbound, violet for stock control, plum for parts. It marks which kind of
// job you're in (its tile, its heading on the board, the line under its title) and never means "press" or a
// state, which keep blue and green, amber and red. Outbound gets its own when it arrives.
export type FamilyColours = { ink: ColourName; soft: ColourName; bg: string; dot: string; text: string; border: string };

const FAMILY: Record<WorkflowFamily, FamilyColours> = {
  inbound: { ink: 'inbound', soft: 'inbound-soft', bg: 'bg-inbound-soft', dot: 'bg-inbound', text: 'text-inbound', border: 'border-inbound' },
  stock: { ink: 'control', soft: 'control-soft', bg: 'bg-control-soft', dot: 'bg-control', text: 'text-control', border: 'border-control' },
  parts: { ink: 'parts', soft: 'parts-soft', bg: 'bg-parts-soft', dot: 'bg-parts', text: 'text-parts', border: 'border-parts' },
  outbound: { ink: 'action-ink', soft: 'action-soft', bg: 'bg-action-soft', dot: 'bg-action', text: 'text-action-ink', border: 'border-action' },
};

export function familyColours(family: WorkflowFamily): FamilyColours {
  return FAMILY[family];
}

// What a chosen row, chip or tile is drawn in: the colour of the thing chosen, as it's coloured elsewhere.
// Bins are stock violet (as on the part card), who goods come from is inbound teal, a part's brand is parts
// plum, and a place (a location) takes the blue of the board's location pin. The outline and tick stay, so
// colour is never the only sign of a choice. A person's role takes the same blue, as a setting of the
// shop rather than a family of jobs.
export type PickKind = 'bin' | 'sender' | 'brand' | 'place' | 'role';

const PICK: Record<PickKind, FamilyColours> = {
  bin: FAMILY.stock,
  sender: FAMILY.inbound,
  brand: FAMILY.parts,
  // The blue outbound borrows until it has a colour of its own.
  place: FAMILY.outbound,
  role: FAMILY.outbound,
};

export function pickColours(kind: PickKind): FamilyColours {
  return PICK[kind];
}
