import type { EnquiryOrderNeed, EnquiryRequestFailure } from './cannot-supply';
import { failureLead } from './orders';
import { quantityWords } from './words';

// The enquiry line (S4b part three b, slice three c; board 6r line 33): the enquiry a sales order came from says when
// that order can't be supplied, and points to it, where the work is. Every string is the copy deck's
// (docs/design-checks/enquiry-line-and-figures.md).

export const OPEN_ORDER = 'Open order';
// The request row's availability once its order can't be supplied: the promised times no longer hold.
export const CANT_BE_SUPPLIED = 'Can’t be supplied';

// The accepted offer's availability once its own line can't be supplied: "Can’t be supplied", or "2 of 6 can’t be
// supplied" when only part of it can't.
export function requestSupplyWords(failure: Pick<EnquiryRequestFailure, 'units' | 'quantity'>): string {
  return failure.units < failure.quantity
    ? `${quantityWords(failure.units)} of ${quantityWords(failure.quantity)} can’t be supplied`
    : CANT_BE_SUPPLIED;
}

// The need row on the enquiry page and the list's preview: the part as the sales order words it, then who acts next
// (the first words of the order's own lead), so the enquiry tells the whole story: "SO-000061 · Bosch 1 987 473 566
// can’t be supplied · Ask customer", "SO-000030 · MINTEX MDC1705 × 2 can’t be supplied · With purchasing", "SO-000032 ·
// 2 of 4 MINTEX MDC1705 can’t be supplied · Ask customer", across several lines "SO-000061 · 3 units can’t be supplied".
export function enquiryNeedWords(need: Pick<EnquiryOrderNeed, 'number' | 'units' | 'part' | 'quantity' | 'summary'>, now?: string): string {
  const what = need.part
    ? need.quantity != null && need.units < need.quantity
      ? `${quantityWords(need.units)} of ${quantityWords(need.quantity)} ${need.part}`
      : need.units > 1
        ? `${need.part} × ${quantityWords(need.units)}`
        : need.part
    : `${quantityWords(need.units)} ${need.units === 1 ? 'unit' : 'units'}`;
  const move = need.summary ? failureLead(need.summary, now).lead.split(' · ')[0] : '';
  return `${need.number} · ${what} can’t be supplied${move ? ` · ${move}` : ''}`;
}

// The step line in the Enquiries list: the order and its next move, the first words of the sales order list's own
// lead ("SO-000061 · Ask customer" where the order list says "Ask customer · 1 can’t be supplied"; "SO-000061 · No
// reply yet"), so the two say one thing and the enquiry's narrow status cell holds it whole.
export function enquiryOrderStepWords(need: Pick<EnquiryOrderNeed, 'number' | 'summary'>, now?: string): string {
  const move = failureLead(need.summary, now).lead.split(' · ')[0];
  return `${need.number} · ${move || 'can’t be supplied'}`;
}

// How the move is set, as the order list sets it: the counter's own move in medium ink, a late reply in bold.
export function enquiryOrderStepTone(need: Pick<EnquiryOrderNeed, 'summary'>, now?: string): 'move' | 'late' | null {
  const { tone } = failureLead(need.summary, now);
  return tone === 'move' || tone === 'late' ? tone : null;
}
