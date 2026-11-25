import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readBoolean, readNumber, readRecord, readString, type JsonRecord } from '../core/read';
import { CUSTOMER_CHANNEL_PHRASE, readReplacedSupply, type LineFailure, type ReplacedSupply } from './cannot-supply';
import type { FoundPart, FoundSupplier } from './offers';
import { dayAndTime, dayWords, marginOf, marginWords, moneyWords, quantityWords } from './words';

// Replace part (docs/SALES.md 13.17, board 6r). When the customer agreed to an equivalent that fits (answer 2), or the
// account takes one, the counter replaces a part that can't be supplied: its units move to a new line for the part
// chosen, at the lower of the two prices (owner, 21 November 2026). The database makes the line and settles the
// failure; these read what it did, price the choices the same way, word them and send the replacement and its Undo.

// What Replace part did: the new line and the old, the prices, and where the units come from.
export type LineReplaced = {
  lineId: number;
  replacedLineId: number;
  // Every unit on the old line was replaced, so it was cancelled.
  oldCancelled: boolean;
  from: string;
  to: string;
  units: number;
  // The old line's price, what the customer pays now, and the new part's own price.
  was: number;
  price: number;
  list: number;
  supply: ReplacedSupply;
  setAside: number;
  supplier: string | null;
  place: string | null;
};

export function readLineReplaced(data: Json): LineReplaced {
  const body = readRecord(data) ?? {};
  return {
    lineId: readNumber(body.line_id) ?? 0,
    replacedLineId: readNumber(body.replaced_line_id) ?? 0,
    oldCancelled: readBoolean(body.old_cancelled) ?? false,
    from: readString(body.from) ?? '',
    to: readString(body.to) ?? '',
    units: readNumber(body.units) ?? 0,
    was: readNumber(body.was) ?? 0,
    price: readNumber(body.price) ?? 0,
    list: readNumber(body.list) ?? 0,
    supply: readReplacedSupply(body.supply),
    setAside: readNumber(body.set_aside) ?? 0,
    supplier: readString(body.supplier),
    place: readString(body.place),
  };
}

// What the customer pays for an equivalent: the lower of its own price and the order's (owner, 21 November 2026).
// kept: the part lists dearer, so the order's price stays and the margin drops. Null when the part has no price.
export function replacementPrice(partPrice: number | null, orderPrice: number): { price: number; kept: boolean } | null {
  if (partPrice == null) return null;
  return partPrice < orderPrice ? { price: partPrice, kept: false } : { price: orderPrice, kept: partPrice > orderPrice };
}

// The confirm window's price line: "£14.20 → £13.90", or "£14.20, the order’s price" for a dearer part.
export function replacePriceWords(partPrice: number, orderPrice: number): { value: string; note: string } {
  const chosen = replacementPrice(partPrice, orderPrice);
  if (!chosen || chosen.price === orderPrice) {
    return { value: `${moneyWords(orderPrice)}, the order’s price`, note: partPrice > orderPrice ? `it lists at ${moneyWords(partPrice)}` : '' };
  }
  return { value: `${moneyWords(orderPrice)} → ${moneyWords(chosen.price)}`, note: 'the lower price' };
}

// The margin before and after: "32% → 31%". Empty when either can't be worked out.
export function replaceMarginWords(orderMargin: number | null, price: number, cost: number | null): string {
  const after = marginOf(price, cost);
  if (orderMargin == null || after == null) return '';
  return `${marginWords(orderMargin)} → ${marginWords(after)}`;
}

// Where the replacement's units come from, as the confirm window says it. From this branch's shelf: "1 of the 2 at
// Central is set aside for this order." Ordered in: "Not in stock: it goes to Customer lines for GSF Car Parts,
// arriving Fri 20 Nov. Hillside Garage is then told the new day."
export function replaceWhereWords(
  row: Pick<FoundPart, 'place' | 'hereQty' | 'away'>,
  units: number,
  supplier: Pick<FoundSupplier, 'supplier' | 'delivery'> | null,
  branch: string,
  customer: string,
  plan: 'collect' | 'move',
  now: string,
): string {
  const n = quantityWords(units);
  const verb = units === 1 ? 'is' : 'are';
  if (row.place === 'here') {
    if (row.hereQty > units) return `${n} of the ${quantityWords(row.hereQty)} at ${branch} ${verb} set aside for this order.`;
    if (row.hereQty >= units) return `${units === 1 ? 'The one' : `All ${n}`} at ${branch} ${verb} set aside for this order.`;
    const rest = units - row.hereQty;
    return `${quantityWords(row.hereQty)} at ${branch} ${row.hereQty === 1 ? 'is' : 'are'} set aside; ${quantityWords(rest)} more ${rest === 1 ? 'goes' : 'go'} to Customer lines to order in.`;
  }
  if (row.place === 'branch' && row.away) {
    return plan === 'collect' ? `From ${row.away.location}: ${customer} collects it there.` : `From ${row.away.location}: it is moved to ${branch}.`;
  }
  const arrives = supplier?.delivery?.arrivesOn ? `, arriving ${dayWords(supplier.delivery.arrivesOn, now)}` : '';
  return `Not in stock: it goes to Customer lines${supplier ? ` for ${supplier.supplier}` : ''}${arrives}. ${customer} is then told the new day.`;
}

// How the customer came to take an equivalent: "Agreed on WhatsApp today 10:40: 2, an equivalent that fits (recorded answer).", or the account's
// setting when nobody asked.
export function replaceAgreedWords(failure: LineFailure, customer: string, now: string): string {
  if (failure.answer === 'equivalent' && failure.answeredAt) {
    const via = failure.answeredVia ? ` ${CUSTOMER_CHANNEL_PHRASE[failure.answeredVia]}` : '';
    return `Agreed${via} ${dayAndTime(failure.answeredAt, now)}: 2, an equivalent that fits (recorded answer).`;
  }
  return `${customer} takes an equivalent that fits (account setting). The customer is told what was put in.`;
}

// After Replace part: "Bosch 1 987 473 566 replaced by Textar 98044800 on SO-000061; 1 unit set aside at Central for
// picking." Ordered in: "…; 1 unit to order in from GSF Car Parts in Customer lines."
export function replacedToastWords(done: LineReplaced, orderNumber: string): string {
  const units = `${quantityWords(done.units)} ${done.units === 1 ? 'unit' : 'units'}`;
  const where =
    done.supply === 'order_in'
      ? `${units} to order in${done.supplier ? ` from ${done.supplier}` : ''} in Customer lines`
      : done.setAside >= done.units
        ? `${units} set aside${done.place ? ` at ${done.place}` : ''} for picking`
        : done.setAside > 0
          ? `${quantityWords(done.setAside)} of ${units} set aside${done.place ? ` at ${done.place}` : ''}; the rest is to order`
          : `${units} to order`;
  return `${done.from} replaced by ${done.to} on ${orderNumber}; ${where}.`;
}

// The order's history lines for Replace part; null for any other event.
export function replaceEventText(event: string, detail: JsonRecord): string | null {
  const text = (key: string) => (typeof detail[key] === 'string' ? (detail[key] as string) : '');
  const money = (key: string) => (typeof detail[key] === 'number' ? (detail[key] as number) : null);
  const n = typeof detail.units === 'number' ? detail.units : 0;
  const units = `${quantityWords(n)} ${n === 1 ? 'unit' : 'units'}`;
  switch (event) {
    case 'part_replaced': {
      const price = money('price');
      const was = money('was');
      const list = money('list');
      const priced =
        price == null
          ? ''
          : was != null && price < was
            ? ` at ${moneyWords(price)} each, the lower price`
            : list != null && list > price
              ? ` at the order’s price, ${moneyWords(price)} (it lists at ${moneyWords(list)})`
              : ` at ${moneyWords(price)} each`;
      return `${text('from')} replaced by ${text('to')}${detail.substitute === true ? ', the substitute the supplier sent,' : ''} (${units})${priced}.`;
    }
    case 'replace_undone':
      return `Replacing ${text('from')} with ${text('to')} undone: ${units} can’t be supplied again.`;
    default:
      return null;
  }
}

// Replace part, and its Undo. Each returns once the database has recorded it.
export type ReplaceWith = { partId: number; sourceId?: number | null; locationId?: number | null; branchPlan?: 'collect' | 'move' | null };

export function replaceOrderLine(supabase: Client, lineId: number, part: ReplaceWith): Promise<LineReplaced> {
  const p: { [key: string]: Json } = { part_id: part.partId };
  if (part.sourceId != null) p.source_id = part.sourceId;
  if (part.locationId != null) p.location_id = part.locationId;
  if (part.branchPlan) p.branch_plan = part.branchPlan;
  return call(supabase.rpc('sales_order_replace_line', { p_line: lineId, p }), readLineReplaced);
}

export function undoReplaceOrderLine(supabase: Client, lineId: number): Promise<void> {
  return call(supabase.rpc('sales_order_undo_replace', { p_line: lineId }), () => undefined);
}
