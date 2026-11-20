import type { EnquiryChannel } from './channels';
import type { EnquiryDetail, EnquiryRequest, EnquiryRow, EnquiryStatus, EnquiryStep, EnquiryView, NextMove, RequestOutcome, RequestState } from './enquiries';
import type { EnquiryOffer, FoundPart, FoundSupplier, OfferDelivery, PartFit, PartMatch } from './offers';

// The words the enquiry screens use (DESIGN.md, "Sales: enquiries and orders"). Pure: the database says where an
// enquiry stands and these only put it in words, so the web and the phone say the same thing.

export const ENQUIRY_VIEW_LABELS: Record<EnquiryView, string> = {
  mine: 'Mine',
  unassigned: 'Unassigned',
  follow_up_today: 'Follow up today',
  to_source: 'To source',
  all_open: 'All open',
  closed: 'Closed',
};

export const ENQUIRY_STATUS_LABELS: Record<EnquiryStatus, string> = {
  new: 'New',
  in_progress: 'In progress',
  to_source: 'To source',
  quoted: 'Quoted',
  waiting_supplier: 'Waiting on supplier',
  ordered: 'Ordered',
  lost: 'Lost',
  no_reply: 'No reply',
  duplicate: 'Duplicate',
};

// The record pill each status takes: blue for work under way, green only for a settled sale.
export const ENQUIRY_STATUS_TONES: Record<EnquiryStatus, 'neutral' | 'busy' | 'done'> = {
  new: 'neutral',
  in_progress: 'busy',
  to_source: 'busy',
  quoted: 'neutral',
  waiting_supplier: 'neutral',
  ordered: 'done',
  lost: 'neutral',
  no_reply: 'neutral',
  duplicate: 'neutral',
};

export const NEXT_MOVE_LABELS: Record<NextMove, { label: string; meaning: string }> = {
  needs_action: { label: 'Needs action', meaning: 'new, in progress, customer replied or follow-up due' },
  waiting_customer: { label: 'Waiting on customer', meaning: 'quoted' },
  waiting_supplier: { label: 'Waiting on supplier', meaning: 'price or availability asked' },
  closed: { label: 'Closed', meaning: 'ordered, lost, no reply or merged' },
};

export const ENQUIRY_CHANNEL_LABELS: Record<EnquiryChannel, string> = {
  phone: 'Phone',
  whatsapp: 'WhatsApp',
  counter: 'Counter',
  email: 'Email',
  website: 'Website',
};

export const REQUEST_OUTCOME_LABELS: Record<RequestOutcome, string> = {
  ordered: 'Ordered',
  declined: 'Declined',
  could_not_supply: 'Could not supply',
  no_reply: 'No reply',
};

const LONDON = 'Europe/London';
const dayKey = (at: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: LONDON }).format(at);
const clock = (at: Date) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);

// "today 15:00", "tomorrow 09:00", "yesterday 16:40", "Wed 18 Nov 09:00", and the year when it is not this one.
export function dayAndTime(at: string, now: string): string {
  const then = new Date(at);
  const today = new Date(now);
  if (Number.isNaN(then.getTime())) return '';
  const days = Math.round((Date.parse(dayKey(then)) - Date.parse(dayKey(today))) / 86_400_000);
  if (days === 0) return `today ${clock(then)}`;
  if (days === 1) return `tomorrow ${clock(then)}`;
  if (days === -1) return `yesterday ${clock(then)}`;
  const sameYear = dayKey(then).slice(0, 4) === dayKey(today).slice(0, 4);
  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
    .format(then)
    .replace(',', '');
  return `${day} ${clock(then)}`;
}

// A length of time in the largest sensible unit: "12 min", "3 h", "2 days".
export function durationWords(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes));
  if (whole < 60) return `${whole} min`;
  if (whole < 48 * 60) return `${Math.round(whole / 60)} h`;
  return `${Math.round(whole / 1440)} days`;
}

// The time of day in the UK: "09:12".
export function clockTime(at: string): string {
  const then = new Date(at);
  return Number.isNaN(then.getTime()) ? '' : clock(then);
}

// A short date in the UK: "3 Nov", with the year when it is not this one.
export function shortDate(at: string, now: string): string {
  const then = new Date(at);
  if (Number.isNaN(then.getTime())) return '';
  const sameYear = dayKey(then).slice(0, 4) === dayKey(new Date(now)).slice(0, 4);
  return new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) }).format(then);
}

// A contact log entry's time. The day is said once, on the first entry of that day ("Today 09:12", "Fri 14:10");
// the entries that follow on the same day give the time alone ("09:14").
export function logTime(at: string, now: string, previous?: string | null): string {
  const then = new Date(at);
  if (Number.isNaN(then.getTime())) return '';
  if (previous && dayKey(new Date(previous)) === dayKey(then)) return clock(then);
  const words = dayAndTime(at, now);
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// The time since something happened, bare, for a column of ages: "8 min", "2 h", "3 days".
export function sinceWords(at: string | null, now: string): string {
  if (!at) return '';
  const minutes = (Date.parse(now) - Date.parse(at)) / 60_000;
  return Number.isNaN(minutes) ? '' : durationWords(minutes);
}

// The time since something happened: "just now", "12 min ago", "3 h ago", "2 days ago".
export function agoWords(at: string | null, now: string): string {
  if (!at) return '';
  const minutes = (Date.parse(now) - Date.parse(at)) / 60_000;
  if (Number.isNaN(minutes)) return '';
  return minutes < 1 ? 'just now' : `${durationWords(minutes)} ago`;
}

// The verb for going back to a customer, named by how the enquiry arrived.
function followUpVerb(channel: EnquiryChannel): string {
  if (channel === 'phone') return 'Call back';
  return channel === 'counter' ? 'Follow up' : 'Message';
}

// The line under an enquiry's status: why it is where it is and what happens next.
//   tone quiet: the next step. overdue: late work, shown with the overdue arrow. reply: the customer has
//   replied. verb: something is missing and this is the thing to press.
export type StepLine = { text: string; tone: 'quiet' | 'overdue' | 'reply' | 'verb' };

export function enquiryStepLine(
  row: { step: EnquiryStep | null; overdueMinutes: number | null; followUpAt: string | null; channel: EnquiryChannel; quote?: { validUntil: string | null } | null },
  now: string,
): StepLine | null {
  switch (row.step) {
    case 'customer_replied':
      return { text: 'Customer replied', tone: 'reply' };
    case 'quote_expired':
      // Not late work, so no arrow: the prices are no longer promised and need a look before anything is sent.
      return { text: `Quote expired${row.quote?.validUntil ? ` ${dateWords(row.quote.validUntil)}` : ''}`, tone: 'quiet' };
    case 'follow_up_overdue':
      return { text: `Follow up overdue ${durationWords(row.overdueMinutes ?? 0)}`, tone: 'overdue' };
    case 'reply_overdue':
      return { text: `Reply overdue ${durationWords(row.overdueMinutes ?? 0)}`, tone: 'overdue' };
    case 'follow_up':
      return row.followUpAt ? { text: `${followUpVerb(row.channel)} ${dayAndTime(row.followUpAt, now)}`, tone: 'quiet' } : null;
    case 'set_follow_up':
      return { text: 'Set follow-up', tone: 'verb' };
    default:
      return null;
  }
}

// One line for an entry in the contact log, in words: who and how. An entry made by hand says "logged by".
export function logEntryCaption(
  entry: { kind: 'message' | 'call' | 'note'; direction: 'in' | 'out' | 'internal'; channel: EnquiryChannel | null; by: string | null },
): string {
  if (entry.kind === 'note') return `Note${entry.by ? ` · ${entry.by}` : ''}`;
  if (entry.kind === 'call') {
    return `${entry.direction === 'in' ? 'Call from customer' : 'Call to customer'}${entry.by ? ` · logged by ${entry.by}` : ''}`;
  }
  const channel = entry.channel ? ` · ${ENQUIRY_CHANNEL_LABELS[entry.channel]}` : '';
  // The customer's own words carry no name; what we sent says who logged it.
  return entry.direction === 'in' ? `Customer${channel}` : `Message to customer${channel}${entry.by ? ` · logged by ${entry.by}` : ''}`;
}

// The last message or call in either direction, for the page's Last contact figure: "Call to customer, 09:20".
export function lastContactLine(
  log: readonly { kind: string; direction?: 'in' | 'out' | 'internal'; at: string }[],
  now: string,
): string {
  const last = [...log].reverse().find((entry) => (entry.kind === 'message' || entry.kind === 'call') && entry.direction !== 'internal');
  if (!last) return '';
  const what =
    last.kind === 'call'
      ? last.direction === 'in' ? 'Call from customer' : 'Call to customer'
      : last.direction === 'in' ? 'Message from customer' : 'Message to customer';
  const when = dayAndTime(last.at, now);
  return `${what}, ${when.startsWith('today ') ? when.slice(6) : when}`;
}

// What the system did, in words, for the contact log's quiet lines: "Opened by Sam Okafor", "Marked urgent by Jo".
export function enquiryEventText(event: string, detail: { [key: string]: unknown }, by?: string | null): string {
  const what = enquiryEventWords(event, detail);
  // The customer's yes names the customer, not the person who recorded it.
  if (!by || event === 'offer_accepted') return what;
  return event === 'created' ? `Opened by ${by}` : `${what} by ${by}`;
}

function enquiryEventWords(event: string, detail: { [key: string]: unknown }): string {
  const text = (key: string) => (typeof detail[key] === 'string' ? (detail[key] as string) : '');
  switch (event) {
    case 'created':
      return 'Enquiry opened';
    case 'assigned':
      return text('to_name') ? `Assigned to ${text('to_name')}` : 'Assigned';
    case 'unassigned':
      return 'Unassigned';
    case 'marked_urgent':
      return 'Marked urgent';
    case 'urgent_cleared':
      return 'No longer urgent';
    case 'follow_up_set':
      return 'Follow-up set';
    case 'follow_up_cleared':
      return 'Follow-up cleared';
    case 'status_changed': {
      const to = text('to');
      return to in ENQUIRY_STATUS_LABELS ? `Status: ${ENQUIRY_STATUS_LABELS[to as EnquiryStatus]}` : 'Status changed';
    }
    case 'request_closed': {
      const outcome = text('outcome');
      return outcome in REQUEST_OUTCOME_LABELS ? `Request closed: ${REQUEST_OUTCOME_LABELS[outcome as RequestOutcome]}` : 'Request closed';
    }
    case 'request_reopened':
      return 'Request reopened';
    case 'request_split':
      return typeof detail.count === 'number' ? `Split into ${detail.count} requests` : 'Request split';
    case 'retail_card_made':
      return 'Retail card made';
    case 'closed': {
      const status = text('status');
      return status in ENQUIRY_STATUS_LABELS ? `Closed: ${ENQUIRY_STATUS_LABELS[status as EnquiryStatus]}` : 'Closed';
    }
    case 'reopened':
      return 'Reopened';
    case 'merged_into':
      return `Merged into ${text('number')}`;
    case 'merged_from':
      return `${text('number')} merged into this enquiry`;
    case 'offer_added':
      return text('part') ? `Offer added: ${text('part')}` : 'Offer added';
    case 'offer_accepted': {
      const quantity = typeof detail.quantity === 'number' && detail.quantity !== 1 ? ` × ${quantityWords(detail.quantity)}` : '';
      const how = text('how');
      const by = how in ENQUIRY_CHANNEL_LABELS ? `, by ${ENQUIRY_CHANNEL_LABELS[how as EnquiryChannel].toLowerCase().replace('whatsapp', 'WhatsApp')}` : '';
      return `${text('who') || 'Customer'} accepted ${text('part')}${quantity}${by}`;
    }
    case 'offer_unaccepted':
      return `${text('part')} no longer accepted`;
    case 'offer_removed':
      return `Accepted offer removed: ${text('part')}`;
    case 'offer_price_changed': {
      const from = typeof detail.from === 'number' ? moneyWords(detail.from) : '';
      const to = typeof detail.to === 'number' ? moneyWords(detail.to) : '';
      return `Price of ${text('part')} changed${from && to ? ` from ${from} to ${to}` : ''}${text('reason') ? `: ${text('reason')}` : ''}`;
    }
    case 'supplier_quote_recorded': {
      const ref = text('reference') ? `, ref. ${text('reference')}` : '';
      const arrives = typeof detail.arrives_on === 'string' ? `, arrives ${dateWords(detail.arrives_on)}` : '';
      return `Supplier quote recorded: ${text('part')} from ${text('supplier')}${ref}${arrives}`;
    }
    case 'autodoc_searched': {
      const found = typeof detail.found === 'number' ? detail.found : 0;
      const credits = typeof detail.credits === 'number' ? detail.credits : 0;
      return `Autodoc searched for “${text('keyword')}”: ${found} found, ${credits === 0 ? 'no credits spent' : `${credits} ${credits === 1 ? 'credit' : 'credits'}`}`;
    }
    case 'photo_added':
      return `Photo added to ${text('request')}: ${text('name')}`;
    case 'photo_removed':
      return `Photo removed from ${text('request')}: ${text('name')}`;
    case 'order_created': {
      const lines = typeof detail.lines === 'number' ? detail.lines : 0;
      return `${text('order')} created as a draft from ${lines} accepted ${lines === 1 ? 'offer' : 'offers'}`;
    }
    case 'order_cancelled': {
      const count = typeof detail.requests === 'number' ? detail.requests : 0;
      const requests = `${count} ${count === 1 ? 'request' : 'requests'}`;
      return detail.outcome === 'returned'
        ? `${text('order')} cancelled: ${requests} back on this enquiry, still accepted`
        : `${text('order')} cancelled as a lost sale: ${text('reason') || 'no reason given'}`;
    }
    case 'request_to_source':
      return `Nothing listed for ${text('request')}: to source`;
    case 'supplier_asked':
      return `Asked ${text('supplier')} about ${text('request')}`;
    case 'quote_reviewed': {
      const until = typeof detail.valid_until === 'string' ? `, valid until ${dateWords(detail.valid_until)}` : '';
      return detail.kept === true ? `Quoted prices kept${until}` : `Prices updated to today’s${until}`;
    }
    default:
      return event.replace(/_/g, ' ');
  }
}

// The pieces a customer's words read as, when they read as several things: "Front pads and discs, and a wear sensor"
// is three. One piece, or none, means there is nothing to split.
export function splitWanted(text: string): string[] {
  const parts = text
    .split(/\s*(?:[,;\n]|\s+and\s+|\s*&\s*|\s*\+\s*)\s*/i)
    .map((part) => part.replace(/^and\s+/i, '').replace(/[.\s]+$/, '').trim())
    .filter((part) => part.length > 1);
  return parts.length >= 2 && parts.length <= 20 ? parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)) : [];
}

// ------------------------------------------------------------------------------------------------- offers

export const REQUEST_STATE_LABELS: Record<RequestState, string> = {
  new: 'New',
  to_source: 'To source',
  offered: 'Offered',
  quoted: 'Quoted',
  accepted: 'Accepted',
  ordered: 'Ordered',
  declined: 'Declined',
  could_not_supply: 'Could not supply',
  no_reply: 'No reply',
};

// How well a part fits, with its evidence for the line beneath. Only "Fits" is green; "Does not fit" only ever
// means the catalogue was told so. "Other years" is a part listed for the vehicle, but not for the year this car
// was made: worth a check, not a block.
export const PART_FIT_WORDS: Record<PartFit, { label: string; evidence: string; tone: 'done' | 'neutral' | 'blocked' }> = {
  fits: { label: 'Fits', evidence: 'Listed for this vehicle', tone: 'done' },
  via_alternative: { label: 'Fits via an alternative', evidence: 'Same OE number as a part that fits', tone: 'neutral' },
  other_years: { label: 'Listed for other years', evidence: 'Not for the year of this car', tone: 'neutral' },
  no_data: { label: 'No vehicle data', evidence: 'No vehicles listed for this part', tone: 'neutral' },
  does_not_fit: { label: 'Does not fit', evidence: 'Marked as not fitting this vehicle', tone: 'blocked' },
};

// "£38.40". Money is shown to the penny.
export function moneyWords(value: number | null | undefined, currency = 'GBP'): string {
  if (value == null || Number.isNaN(value)) return '';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

// A margin as a whole percentage: "31%".
export function marginWords(ratio: number | null | undefined): string {
  return ratio == null || Number.isNaN(ratio) ? '' : `${Math.round(ratio * 100)}%`;
}

// A quantity without trailing zeros: 1, 2, 1.5.
export function quantityWords(quantity: number): string {
  return String(Math.round(quantity * 1000) / 1000);
}

// The margin on a price against a cost, as a ratio. Null when either is missing.
export function marginOf(price: number | null | undefined, cost: number | null | undefined): number | null {
  return price != null && cost != null && price > 0 ? (price - cost) / price : null;
}

// A calendar day in words: "today", "tomorrow", "Thu 19 Nov".
export function dayWords(date: string, now: string): string {
  const words = dayAndTime(`${date}T12:00:00Z`, now);
  return words.slice(0, words.lastIndexOf(' '));
}

// When a part ordered in would arrive: "Order by 16:00 · arrives tomorrow 08:30–10:30". "Order by" is our deadline
// with the supplier. Once today's has passed the line says so; a supplier with no times promises nothing.
export function deliveryWords(delivery: OfferDelivery | null, missedCutoffAt: string | null, now: string): string {
  if (!delivery?.arrivesOn) return 'Delivery times not set';
  const window =
    delivery.arrivesFrom && delivery.arrivesBy ? ` ${delivery.arrivesFrom}–${delivery.arrivesBy}` : delivery.arrivesFrom ? ` from ${delivery.arrivesFrom}` : '';
  const arrives = `arrives ${dayWords(delivery.arrivesOn, now)}${window}`;
  if (missedCutoffAt) return `After today’s ${clockTime(missedCutoffAt)} order time · ${arrives}`;
  if (!delivery.cutoffAt) return arrives.charAt(0).toUpperCase() + arrives.slice(1);
  const cutoff = dayAndTime(delivery.cutoffAt, now);
  return `Order by ${cutoff.startsWith('today ') ? cutoff.slice(6) : cutoff} · ${arrives}`;
}

// Where a part found in the search would come from, in two lines.
export function foundAvailability(row: FoundPart, wanted: number, supplier: FoundSupplier | null, branch: string, now: string): { main: string; sub: string } {
  // A part with nothing to sell here whose shelf is not empty says so: the units are set aside for other orders.
  if (row.place !== 'here' && row.hereHeld > 0) {
    const rest = foundAvailability({ ...row, hereHeld: 0 }, wanted, supplier, branch, now);
    const held = `${quantityWords(row.hereHeld)} on hand${branch ? ` at ${branch}` : ''}, set aside for ${row.hereHeld === 1 ? 'another order' : 'other orders'}`;
    return { main: rest.main, sub: row.place === 'branch' ? held : [held, rest.sub].filter(Boolean).join(' · ') };
  }
  if (row.place === 'here') {
    if (wanted > row.hereQty && supplier) {
      return {
        main: `${quantityWords(row.hereQty)} in stock, ${quantityWords(wanted - row.hereQty)} to order in · ${supplier.supplier}`,
        sub: deliveryWords(supplier.delivery, supplier.missedCutoffAt, now),
      };
    }
    return { main: `${quantityWords(row.hereQty)} in stock`, sub: row.hereBin ? `Bin ${row.hereBin}` : '' };
  }
  if (row.place === 'branch' && row.away) {
    return { main: `${quantityWords(row.away.qty)} at ${row.away.location}`, sub: branch ? `None at ${branch}` : '' };
  }
  return {
    main: supplier ? `Order in · ${supplier.supplier}` : 'Order in',
    sub: supplier ? deliveryWords(supplier.delivery, supplier.missedCutoffAt, now) : '',
  };
}

// Where an offer's part comes from, as things are now, in two lines.
export function offerAvailability(offer: EnquiryOffer, now: string): { main: string; sub: string } {
  if (offer.supply === 'order_in') {
    return { main: `Order in · ${offer.supplier ?? 'supplier'}`, sub: deliveryWords(offer.delivery, offer.missedCutoffAt, now) };
  }
  const onHand = offer.onHandNow ?? offer.promise.onHand ?? 0;
  if (offer.supply === 'branch') {
    return {
      main: `${quantityWords(onHand)} at ${offer.location ?? 'another branch'}`,
      sub: offer.branchPlan === 'collect' ? 'Customer collects there' : 'To be moved here; no time promised',
    };
  }
  if (offer.sourceId != null && offer.quantity > onHand) {
    return {
      main: `${quantityWords(onHand)} in stock, ${quantityWords(offer.quantity - onHand)} to order in`,
      sub: deliveryWords(offer.delivery, offer.missedCutoffAt, now),
    };
  }
  return { main: `${quantityWords(onHand)} in stock`, sub: offer.location ? `${offer.location}, this branch` : '' };
}

// An offer keeps what it promised and says when that is no longer true: "Stock changed: 0 at Central now, was 3 at
// 09:18". Null while the promise still holds.
export function offerChangedWords(offer: EnquiryOffer): string | null {
  if (offer.supply === 'order_in' || offer.onHandNow == null || offer.promise.onHand == null) return null;
  if (offer.onHandNow >= Math.min(offer.quantity, offer.promise.onHand)) return null;
  const where = offer.location ? ` at ${offer.location}` : '';
  const when = offer.promise.at ? ` at ${clockTime(offer.promise.at)}` : '';
  return `Stock changed: ${quantityWords(offer.onHandNow)}${where} now, was ${quantityWords(offer.promise.onHand)}${when}`;
}

// What the search box understood when a number was matched exactly: "Matches OE number VW 5Q0 698 151 B · 3 parts
// carry it".
export function matchWords(match: PartMatch, parts: number): string {
  const name = `${match.brand} ${match.number}`.trim();
  if (match.type === 'barcode') return `Matches the barcode of ${name}`;
  if (match.type === 'supplier_code') return `Matches a supplier code for ${name}`;
  if (match.kind !== 'aftermarket') return `Matches OE number ${name} · ${parts} ${parts === 1 ? 'part carries' : 'parts carry'} it`;
  return `Matches part number ${name}`;
}

// The requests of an enquiry in a few words, for the line beside its status: "2 accepted, 1 new".
export function requestSummary(requests: readonly Pick<EnquiryRequest, 'state'>[]): string {
  const order: RequestState[] = ['accepted', 'quoted', 'offered', 'to_source', 'new', 'ordered'];
  return order
    .map((state) => [state, requests.filter((request) => request.state === state).length] as const)
    .filter(([, count]) => count > 0)
    .map(([state, count]) => `${count} ${REQUEST_STATE_LABELS[state].toLowerCase()}`)
    .join(', ');
}

// ------------------------------------------------------------------------------------------------- quotes

// A date as the customer reads it: "Mon 23 Nov", with the year on paper ("Mon 23 Nov 2026").
export function dateWords(date: string | null, withYear = false): string {
  const then = date ? new Date(`${date.slice(0, 10)}T12:00:00Z`) : null;
  if (!then || Number.isNaN(then.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, weekday: 'short', day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
    .format(then)
    .replace(/,/g, '');
}

// When the customer would have the part, in the customer's words: never the supplier's name, never our order time.
export function offerPromiseWords(offer: EnquiryOffer, now: string): string {
  const arrival = (delivery: OfferDelivery | null) =>
    delivery?.arrivesOn ? `${dayWords(delivery.arrivesOn, now)}${delivery.arrivesFrom ? ` from ${delivery.arrivesFrom}` : ''}` : null;
  if (offer.supply === 'order_in') return arrival(offer.delivery) ?? 'to order';
  if (offer.supply === 'branch') return offer.branchPlan === 'collect' && offer.location ? `in stock at ${offer.location}` : 'in stock at another branch';
  const onHand = offer.onHandNow ?? offer.promise.onHand ?? 0;
  if (onHand >= offer.quantity) return 'in stock';
  const rest = arrival(offer.delivery) ?? 'to order';
  return onHand <= 0 ? rest : `${quantityWords(onHand)} in stock, ${quantityWords(offer.quantity - onHand)} ${rest}`;
}

// One line of a quote: the request, the part that counts towards the total, and any others as "or".
export type QuoteLine = { requestId: number; wanted: string; first: EnquiryOffer; alternatives: EnquiryOffer[] };
// What a quote says. sourcing names the open requests with nothing to offer yet. Money is ex VAT unless incVat.
export type QuoteBody = { lines: QuoteLine[]; sourcing: string[]; incVat: boolean; subtotal: number; vat: number; total: number };

// Every open request with something to offer: the accepted part, or the first one with the others as alternatives.
// The total counts one part per request.
export function quoteBody(enquiry: Pick<EnquiryDetail, 'requests' | 'priceBasis' | 'vatRate'>): QuoteBody {
  const open = enquiry.requests.filter((request) => !request.outcome);
  const lines = open.flatMap((request): QuoteLine[] => {
    const accepted = request.offers.find((offer) => offer.acceptedAt);
    const first = accepted ?? request.offers[0];
    if (!first) return [];
    return [{ requestId: request.id, wanted: request.wanted, first, alternatives: accepted ? [] : request.offers.slice(1) }];
  });
  const subtotal = Math.round(lines.reduce((sum, line) => sum + line.first.lineTotal, 0) * 100) / 100;
  const vat = Math.round(subtotal * enquiry.vatRate * 100) / 100;
  return {
    lines,
    sourcing: open.filter((request) => request.offers.length === 0).map((request) => request.wanted),
    incVat: enquiry.priceBasis === 'retail',
    subtotal,
    vat,
    total: Math.round((subtotal + vat) * 100) / 100,
  };
}

// The quote in words, for WhatsApp or an email: who it is for, each request on a line, then the basis, the date it
// holds until and our number. A request with nothing to offer is left off; the window says so to the person sending.
export function quoteText(
  enquiry: Pick<EnquiryDetail, 'requests' | 'priceBasis' | 'vatRate' | 'vehicles' | 'number' | 'quote' | 'now'>,
  customer: string,
): string {
  const body = quoteBody(enquiry);
  const each = (offer: EnquiryOffer) =>
    `${moneyWords(body.incVat ? offer.unitPrice * (1 + enquiry.vatRate) : offer.unitPrice)}${offer.quantity !== 1 ? ' each' : ''}`;
  const part = (offer: EnquiryOffer) => `${offer.brand} ${offer.number}, ${each(offer)}, ${offerPromiseWords(offer, enquiry.now)}`;
  const vehicles = enquiry.vehicles
    .map((vehicle) => [vehicle.registration ?? vehicle.vin, vehicle.label].filter(Boolean).join(', '))
    .filter(Boolean)
    .join('; ');
  return [
    `Quote for ${customer}`,
    ...(vehicles ? [vehicles] : []),
    ...body.lines.map(
      (line, index) =>
        `${index + 1}. ${line.wanted}${line.first.quantity !== 1 ? ` × ${quantityWords(line.first.quantity)}` : ''}: ${part(line.first)}.` +
        line.alternatives.map((offer) => ` Or ${part(offer)}.`).join(''),
    ),
    `${body.incVat ? 'Prices include VAT' : 'Prices ex VAT'}. Valid until ${dateWords(enquiry.quote.validUntilNew)}. ${enquiry.number}.`,
  ].join('\n');
}

// The few words beside a request's pill: "2 offers, not yet sent", "sent Fri 14:10", "Marek, by phone".
export function requestCaption(request: Pick<EnquiryRequest, 'state' | 'offers'>, now: string): string {
  if (request.state === 'accepted') {
    const offer = request.offers.find((item) => item.acceptedAt);
    const how = offer?.acceptedHow ? `by ${ENQUIRY_CHANNEL_LABELS[offer.acceptedHow].toLowerCase().replace('whatsapp', 'WhatsApp')}` : '';
    return [offer?.acceptedBy, how].filter(Boolean).join(', ');
  }
  if (request.state === 'quoted') {
    const sent = request.offers.map((offer) => offer.quotedAt ?? '').sort().at(-1);
    return sent ? `sent ${dayAndTime(sent, now)}` : '';
  }
  if (request.state === 'offered') {
    const unsent = request.offers.filter((offer) => !offer.sent).length;
    const all = request.offers.length;
    return unsent === all ? `${all} ${all === 1 ? 'offer' : 'offers'}, not yet sent` : `${unsent} of ${all} offers not yet sent`;
  }
  return '';
}

// What a list row says after how the enquiry arrived: "quoted £46.80", "quoted, 2 offers", or "3 requests".
export function rowProgress(row: Pick<EnquiryRow, 'status' | 'quote' | 'requestCount'>): string {
  if (row.status === 'quoted' && row.quote.offers > 0) {
    return row.quote.offers === 1 && row.quote.total != null ? `quoted ${moneyWords(row.quote.total)}` : `quoted, ${row.quote.offers} offers`;
  }
  return `${row.requestCount} ${row.requestCount === 1 ? 'request' : 'requests'}`;
}

// The Quote row of the preview: "Sent Fri 14:10 · expires Tue 17 Nov".
export function quoteSentWords(quote: Pick<EnquiryDetail['quote'], 'sentAt' | 'validUntil' | 'expired'>, now: string): string {
  if (!quote.sentAt) return '';
  const sent = dayAndTime(quote.sentAt, now);
  return `Sent ${sent}${quote.validUntil ? ` · ${quote.expired ? 'expired' : 'expires'} ${dateWords(quote.validUntil)}` : ''}`;
}
