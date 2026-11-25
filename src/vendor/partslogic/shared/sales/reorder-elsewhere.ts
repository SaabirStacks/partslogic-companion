import type { PurchaseLetDown } from '../purchasing/orders';
import { replyWords } from './cannot-supply';
import type { OrderInSupplier } from './order-in';
import { moneyWords, quantityWords } from './words';

// Reorder elsewhere (S4b part three b, slice three b; board 6r line 28): the purchase order a supplier let down offers
// the other suppliers for the customer still waiting. Every string is the copy deck's
// (docs/design-checks/reorder-elsewhere.md), so the purchase order, Customer lines and the sales order say one thing.

export const REORDER_ELSEWHERE_HEADING = 'Reorder elsewhere';
export const LOWEST_PRICE = 'Lowest price';
export const BELOW_COST = 'Below cost';
export const ADD_TO_DRAFT = 'Add to draft';
export const NOT_NOW = 'Not now';
export const LEFT_IN_CUSTOMER_LINES = 'Left in Customer lines';
// A request that never came back: what went wrong and what to do.
export const NOT_ADDED = 'Not added. Check the connection and try again.';
export const NOT_TAKEN_OFF = 'Not taken off. Check the connection and try again.';

// "1 × Bosch 1 987 473 566 for SO-000061 · Hillside Garage".
export function letDownLine(letDown: Pick<PurchaseLetDown, 'units' | 'number' | 'customer'>, part: string): string {
  return `${quantityWords(letDown.units)} × ${part} for ${letDown.number}${letDown.customer ? ` · ${letDown.customer}` : ''}`;
}

// Where it stands, saying who acts, for a customer the buyer can't reorder for yet (or has): under the panel's own line
// ("Counter asks the customer", the sales order's "No reply yet · asked today 10:05"), or with who it is for on the
// cancelled line, where nothing above names them ("SO-000061 · Hillside Garage · Counter replaces the part"). Null when
// the buyer can reorder now.
export function letDownStateWords(
  letDown: Pick<PurchaseLetDown, 'number' | 'customer' | 'step' | 'reordered' | 'askedAt' | 'askedVia' | 'answerOverdue'>,
  { suppliersLeft = 0, named = false, now }: { suppliersLeft?: number; named?: boolean; now?: string } = {},
): string | null {
  const state = (words: string) => (named ? `${letDownWho(letDown)} · ${words}` : words);
  if (letDown.reordered) return `On ${letDown.reordered.poNumber}${letDown.reordered.supplier ? ` · ${letDown.reordered.supplier}` : ''}`;
  switch (letDown.step) {
    case 'ask':
      return state('Counter asks the customer');
    case 'answer':
      return state(replyWords(letDown, now));
    case 'replace':
      return state('Counter replaces the part');
    case 'take_off':
      return state('Counter removes the part');
    case 'reorder':
      return suppliersLeft > 0 ? null : state('No other supplier lists it');
    default:
      return null;
  }
}

// Who it is for, where nothing nearby names them: "SO-000061 · Hillside Garage".
export function letDownWho(letDown: Pick<PurchaseLetDown, 'number' | 'customer'>): string {
  return `${letDown.number}${letDown.customer ? ` · ${letDown.customer}` : ''}`;
}

// The page's need while a customer waits for the buyer to reorder: "1 customer waiting for a reorder.", with Reorder.
export function waitingForReorderWords(letDowns: Pick<PurchaseLetDown, 'step' | 'reordered'>[]): string | null {
  const count = letDowns.filter((d) => d.step === 'reorder' && !d.reordered).length;
  return count > 0 ? `${count} ${count === 1 ? 'customer' : 'customers'} waiting for a reorder.` : null;
}

// The suppliers to offer, cheapest first for people who may see cost (the first marked Lowest price); otherwise in
// Customer lines' own order, soonest first, with nothing marked.
export function reorderChoices(suppliers: OrderInSupplier[]): { supplier: OrderInSupplier; lowest: boolean }[] {
  const priced = suppliers.every((s) => s.cost != null);
  const sorted = priced ? [...suppliers].sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0)) : suppliers;
  return sorted.map((supplier, index) => ({ supplier, lowest: priced && index === 0 && sorted.length > 1 }));
}

// Below cost when it costs more than the line sells at (both known only to people who may see cost).
export function belowCost(cost: number | null, unitPrice: number | null): boolean {
  return cost != null && unitPrice != null && cost > unitPrice;
}

// "£10.40 each".
export function eachWords(cost: number): string {
  return `${moneyWords(cost)} each`;
}

// The below-cost confirm: a question and one line (owner, 22 November 2026: confirmed, no reason kept).
export function belowCostConfirmWords(cost: number, supplier: string, unitPrice: number): { title: string; line: string; action: string } {
  return {
    title: 'Add below cost?',
    line: `Costs ${moneyWords(cost)} from ${supplier} · sells at ${moneyWords(unitPrice)}`,
    action: 'Add below cost',
  };
}

// Toasts, two to four words.
export function addedToWords(poNumber: string): string {
  return `Added to ${poNumber}`;
}
export function takenOffWords(poNumber: string): string {
  return `Taken off ${poNumber}`;
}
