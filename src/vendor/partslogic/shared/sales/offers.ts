import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readBoolean, readNumber, readRecord, readString } from '../core/read';
import { ENQUIRY_CHANNELS, type EnquiryChannel } from './channels';

// Offers: the parts put to a customer for one request, and Find parts, the search that adds them
// (docs/SALES.md, sections 5, 7 and 10.3). The database works out the price, the fit, where a part would come from
// and when; these wrappers read those answers and never work them out.

export const OFFER_SUPPLIES = ['stock', 'branch', 'order_in'] as const;
export type OfferSupply = (typeof OFFER_SUPPLIES)[number];

export const PART_FITS = ['fits', 'via_alternative', 'other_years', 'no_data', 'does_not_fit'] as const;
export type PartFit = (typeof PART_FITS)[number];

export type PriceBasis = 'account' | 'trade' | 'retail';

// A supplier's next order-by time and arrival. Null where the supplier has no delivery times.
export type OfferDelivery = { cutoffAt: string | null; arrivesOn: string | null; arrivesFrom: string | null; arrivesBy: string | null };

export type EnquiryOffer = {
  id: number;
  partId: number;
  brand: string;
  number: string;
  description: string | null;
  supply: OfferSupply;
  locationId: number | null;
  location: string | null;
  branchPlan: 'collect' | 'move' | null;
  sourceId: number | null;
  supplier: string | null;
  quantity: number;
  // Each, before VAT. standardPrice is what this customer pays without a change; a different unitPrice has a reason.
  unitPrice: number;
  standardPrice: number;
  priceBasis: PriceBasis;
  priceReason: string | null;
  lineTotal: number;
  fit: PartFit | null;
  note: string | null;
  // What was said when the offer was added, and what is true now.
  promise: { at: string | null; onHand: number | null; bin: string | null; location: string | null; delivery: OfferDelivery | null };
  onHandNow: number | null;
  delivery: OfferDelivery | null;
  missedCutoffAt: string | null;
  acceptedAt: string | null;
  acceptedBy: string | null;
  acceptedHow: EnquiryChannel | null;
  addedAt: string;
  // When it last went to the customer on a quote and at what price. sent: it went, and at today's price.
  quotedAt: string | null;
  quotedPrice: number | null;
  sent: boolean;
  // The supplier's quote the offer was made from, when a person wrote one down: its own reference and the day the
  // supplier said the part would arrive.
  supplierQuote: { id: number; reference: string | null; arrivesOn: string | null; recordedAt: string } | null;
  // Only for a person allowed to see cost and margin.
  unitCost: number | null;
  margin: number | null;
};

// The quote as it stands: the accepted offer on each request, or its first offer while nothing is accepted.
// How a quote reached the customer. Nothing is sent by PartsLogic: it is copied, opened in the person's own email,
// printed, or said on the phone.
export const QUOTE_HOWS = ['whatsapp', 'email', 'print', 'phone'] as const;
export type QuoteHow = (typeof QUOTE_HOWS)[number];

// The quote as it stands, and the last one sent: unsent counts the offers the customer has not been sent (at their
// price today); validUntilNew is the date a quote sent now would hold until.
export type EnquiryQuote = {
  total: number | null;
  totalInc: number | null;
  accepted: number;
  priced: number;
  requests: number;
  offers: number;
  unsent: number;
  id: number | null;
  sentAt: string | null;
  sentBy: string | null;
  how: QuoteHow | null;
  validUntil: string | null;
  expired: boolean;
  validUntilNew: string | null;
};

function oneOf<T extends string>(values: readonly T[], value: Json | undefined): T | null {
  return typeof value === 'string' && (values as readonly string[]).includes(value) ? (value as T) : null;
}

export function readOfferDelivery(value: Json | undefined): OfferDelivery | null {
  const row = readRecord(value);
  if (!row || (!readString(row.arrives_on) && !readString(row.cutoff_at))) return null;
  return {
    cutoffAt: readString(row.cutoff_at),
    arrivesOn: readString(row.arrives_on),
    arrivesFrom: readString(row.arrives_from),
    arrivesBy: readString(row.arrives_by),
  };
}

function readSupplierQuote(value: Json | undefined): EnquiryOffer['supplierQuote'] {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  if (!row || id == null) return null;
  return { id, reference: readString(row.reference), arrivesOn: readString(row.arrives_on), recordedAt: readString(row.recorded_at) ?? '' };
}

export function readEnquiryOffer(value: Json | undefined): EnquiryOffer | null {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  const partId = readNumber(row?.part_id);
  const supply = oneOf(OFFER_SUPPLIES, row?.supply);
  if (!row || id == null || partId == null || !supply) return null;
  const promise = readRecord(row.promise) ?? {};
  return {
    id,
    partId,
    brand: readString(row.brand) ?? '',
    number: readString(row.number) ?? '',
    description: readString(row.description),
    supply,
    locationId: readNumber(row.location_id),
    location: readString(row.location),
    branchPlan: oneOf(['collect', 'move'] as const, row.branch_plan),
    sourceId: readNumber(row.source_id),
    supplier: readString(row.supplier),
    quantity: readNumber(row.quantity) ?? 1,
    unitPrice: readNumber(row.unit_price) ?? 0,
    standardPrice: readNumber(row.standard_price) ?? 0,
    priceBasis: oneOf(['account', 'trade', 'retail'] as const, row.price_basis) ?? 'trade',
    priceReason: readString(row.price_reason),
    lineTotal: readNumber(row.line_total) ?? 0,
    fit: oneOf(PART_FITS, row.fit),
    note: readString(row.note),
    promise: {
      at: readString(promise.at),
      onHand: readNumber(promise.on_hand),
      bin: readString(promise.bin),
      location: readString(promise.location),
      delivery: readOfferDelivery(promise),
    },
    onHandNow: readNumber(row.on_hand_now),
    delivery: readOfferDelivery(row.delivery),
    missedCutoffAt: readString(row.missed_cutoff_at),
    acceptedAt: readString(row.accepted_at),
    acceptedBy: readString(row.accepted_by),
    acceptedHow: oneOf(ENQUIRY_CHANNELS, row.accepted_how),
    addedAt: readString(row.added_at) ?? '',
    quotedAt: readString(row.quoted_at),
    quotedPrice: readNumber(row.quoted_price),
    sent: readBoolean(row.sent) ?? false,
    supplierQuote: readSupplierQuote(row.supplier_quote),
    unitCost: readNumber(row.unit_cost),
    margin: readNumber(row.margin),
  };
}

export function readEnquiryQuote(value: Json | undefined): EnquiryQuote {
  const row = readRecord(value) ?? {};
  return {
    total: readNumber(row.total),
    totalInc: readNumber(row.total_inc),
    accepted: readNumber(row.accepted) ?? 0,
    priced: readNumber(row.priced) ?? 0,
    requests: readNumber(row.requests) ?? 0,
    offers: readNumber(row.offers) ?? 0,
    unsent: readNumber(row.unsent) ?? 0,
    id: readNumber(row.id),
    sentAt: readString(row.sent_at),
    sentBy: readString(row.sent_by),
    how: oneOf(QUOTE_HOWS, row.how),
    validUntil: readString(row.valid_until),
    expired: readBoolean(row.expired) ?? false,
    validUntilNew: readString(row.valid_until_new),
  };
}

// ------------------------------------------------------------------------------------------------- Find parts

export type FoundSupplier = {
  sourceId: number;
  supplier: string;
  preferred: boolean;
  delivery: OfferDelivery | null;
  // Today's order time, when it has already passed.
  missedCutoffAt: string | null;
  cost: number | null;
};

export type PartPlace = 'here' | 'branch' | 'order_in';

export type FoundPart = {
  partId: number;
  brand: string;
  number: string;
  description: string | null;
  matchType: string;
  position: 'front' | 'rear' | null;
  // Null when the enquiry has no matched vehicle: nothing is claimed.
  fit: PartFit | null;
  place: PartPlace;
  hereQty: number;
  hereBin: string | null;
  // Units on the shelf here that confirmed orders hold: on hand, but not to sell.
  hereHeld: number;
  away: { locationId: number; location: string; qty: number } | null;
  // Soonest first.
  suppliers: FoundSupplier[];
  // Each, before VAT. Null when the part has no price yet.
  price: number | null;
  offer: { id: number; accepted: boolean } | null;
  // On an order's search: the line the part is already on.
  line: { id: number; quantity: number } | null;
  // What the part costs from where this row would get it; only for a person allowed to see it.
  cost: number | null;
  stockCost: number | null;
};

// What the search box understood, when a number was matched exactly.
export type PartMatch = { type: 'barcode' | 'exact' | 'supplier_code'; kind: string; brand: string; number: string };

// Whether a found part is the one the search box matched exactly (a barcode, a part number or a supplier code), so it
// is pinned first under Exact match and Enter or a scan adds it. Spaces, dots and case are ignored, as the search does.
export function isMatchedPart(row: { brand: string; number: string }, match: PartMatch | null | undefined): boolean {
  if (!match) return false;
  const same = (a: string, b: string) => a.replace(/[^a-z0-9]/gi, '').toLowerCase() === b.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return same(row.brand, match.brand) && same(row.number, match.number);
}

export type FoundParts = {
  requestId: number;
  quantity: number;
  search: string;
  branch: { id: number; name: string } | null;
  hasVehicle: boolean;
  basis: PriceBasis;
  match: PartMatch | null;
  rows: FoundPart[];
  offers: number;
  canSeeMargin: boolean;
  now: string;
};

export function readFoundParts(data: Json): FoundParts {
  const body = readRecord(data) ?? {};
  const branch = readRecord(body.branch);
  const match = readRecord(body.match);
  const matchType = oneOf(['barcode', 'exact', 'supplier_code'] as const, match?.type);
  return {
    requestId: readNumber(body.request_id) ?? 0,
    quantity: readNumber(body.quantity) ?? 1,
    search: readString(body.search) ?? '',
    branch: branch && readNumber(branch.id) != null ? { id: readNumber(branch.id) ?? 0, name: readString(branch.name) ?? '' } : null,
    hasVehicle: readBoolean(body.has_vehicle) ?? false,
    basis: oneOf(['account', 'trade', 'retail'] as const, body.basis) ?? 'trade',
    match: match && matchType ? { type: matchType, kind: readString(match.kind) ?? '', brand: readString(match.brand) ?? '', number: readString(match.number) ?? '' } : null,
    rows: readArray(body.rows).flatMap((item) => {
      const row = readRecord(item);
      const partId = readNumber(row?.part_id);
      const place = oneOf(['here', 'branch', 'order_in'] as const, row?.place);
      if (!row || partId == null || !place) return [];
      const away = readRecord(row.away);
      const offer = readRecord(row.offer);
      const line = readRecord(row.line);
      return [
        {
          partId,
          brand: readString(row.brand) ?? '',
          number: readString(row.number) ?? '',
          description: readString(row.description),
          matchType: readString(row.match_type) ?? '',
          position: oneOf(['front', 'rear'] as const, row.position),
          fit: oneOf(PART_FITS, row.fit),
          place,
          hereQty: readNumber(row.here_qty) ?? 0,
          hereBin: readString(row.here_bin),
          hereHeld: readNumber(row.here_held) ?? 0,
          away:
            away && readNumber(away.location_id) != null
              ? { locationId: readNumber(away.location_id) ?? 0, location: readString(away.location) ?? '', qty: readNumber(away.qty) ?? 0 }
              : null,
          suppliers: readArray(row.suppliers).flatMap((entry) => {
            const supplier = readRecord(entry);
            const sourceId = readNumber(supplier?.source_id);
            if (!supplier || sourceId == null) return [];
            return [
              {
                sourceId,
                supplier: readString(supplier.supplier) ?? '',
                preferred: readBoolean(supplier.preferred) ?? false,
                delivery: readOfferDelivery(supplier.delivery),
                missedCutoffAt: readString(supplier.missed_cutoff_at),
                cost: readNumber(supplier.cost),
              },
            ];
          }),
          price: readNumber(row.price),
          offer: offer && readNumber(offer.id) != null ? { id: readNumber(offer.id) ?? 0, accepted: readBoolean(offer.accepted) ?? false } : null,
          line: line && readNumber(line.id) != null ? { id: readNumber(line.id) ?? 0, quantity: readNumber(line.quantity) ?? 1 } : null,
          cost: readNumber(row.cost),
          stockCost: readNumber(row.stock_cost),
        },
      ];
    }),
    offers: readNumber(body.offers) ?? 0,
    canSeeMargin: readBoolean(body.can_see_margin) ?? false,
    now: readString(body.now) ?? new Date().toISOString(),
  };
}

export function findPartsForRequest(supabase: Client, requestId: number, search?: string | null): Promise<FoundParts> {
  return call(supabase.rpc('enquiry_find_parts', { p_request: requestId, p_search: search?.trim() || null }), readFoundParts);
}

export type NewOffer = { partId: number; supply: OfferSupply; sourceId?: number | null; locationId?: number | null; branchPlan?: 'collect' | 'move' | null };

export function addEnquiryOffer(supabase: Client, requestId: number, offer: NewOffer): Promise<number> {
  const p: { [key: string]: Json } = { part_id: offer.partId, supply: offer.supply };
  if (offer.sourceId != null) p.source_id = offer.sourceId;
  if (offer.locationId != null) p.location_id = offer.locationId;
  if (offer.branchPlan) p.branch_plan = offer.branchPlan;
  return call(supabase.rpc('enquiry_add_offer', { p_request: requestId, p }), (data) => readNumber(data) ?? 0);
}

export type OfferChanges = { quantity?: number; unitPrice?: number; reason?: string | null; note?: string | null };

export function saveEnquiryOffer(supabase: Client, offerId: number, changes: OfferChanges): Promise<void> {
  const p: { [key: string]: Json } = {};
  if (changes.quantity !== undefined) p.quantity = changes.quantity;
  if (changes.unitPrice !== undefined) p.unit_price = changes.unitPrice;
  if (changes.reason !== undefined) p.reason = changes.reason;
  if (changes.note !== undefined) p.note = changes.note;
  return call(supabase.rpc('enquiry_save_offer', { p_offer: offerId, p }), () => undefined);
}

export function removeEnquiryOffer(supabase: Client, offerId: number): Promise<void> {
  return call(supabase.rpc('enquiry_remove_offer', { p_offer: offerId }), () => undefined);
}

// The customer's yes: who said it and how. One offer per request; accepting another moves it.
export function acceptEnquiryOffer(supabase: Client, offerId: number, accepted: { by?: string | null; how?: EnquiryChannel } = {}): Promise<void> {
  const p: { [key: string]: Json } = {};
  if (accepted.by) p.by = accepted.by;
  if (accepted.how) p.how = accepted.how;
  return call(supabase.rpc('enquiry_accept_offer', { p_offer: offerId, p }), () => undefined);
}

export function unacceptEnquiryOffer(supabase: Client, offerId: number): Promise<void> {
  return call(supabase.rpc('enquiry_unaccept_offer', { p_offer: offerId }), () => undefined);
}

// Makes what an offer promises (stock, arrival) what is true now.
export function refreshEnquiryOffer(supabase: Client, offerId: number): Promise<void> {
  return call(supabase.rpc('enquiry_refresh_offer', { p_offer: offerId }), () => undefined);
}

// ------------------------------------------------------------------------------------------------- quotes

// Records that the offers went to the customer, one of four ways, with the words that were sent. Returns the
// quote's id, which Undo hands back.
export function sendEnquiryQuote(supabase: Client, enquiryId: string, quote: { how: QuoteHow; body?: string | null }): Promise<number> {
  const p: { [key: string]: Json } = { how: quote.how };
  if (quote.body) p.body = quote.body;
  return call(supabase.rpc('enquiry_send_quote', { p_id: enquiryId, p }), (data) => readNumber(data) ?? 0);
}

// Takes back the last quote sent: the enquiry and its offers return to what they were.
export function unsendEnquiryQuote(supabase: Client, quoteId: number): Promise<void> {
  return call(supabase.rpc('enquiry_unsend_quote', { p_quote: quoteId }), () => undefined);
}

// An expired quote's prices, worked out again: what each offer was quoted at and the customer's price today.
export type PriceReview = {
  validUntil: string | null;
  validUntilNew: string | null;
  changed: number;
  totalWas: number | null;
  totalNow: number | null;
  canKeep: boolean;
  rows: { offerId: number; brand: string; number: string; quantity: number; quoted: number; today: number }[];
};

export function readPriceReview(data: Json): PriceReview {
  const body = readRecord(data) ?? {};
  return {
    validUntil: readString(body.valid_until),
    validUntilNew: readString(body.valid_until_new),
    changed: readNumber(body.changed) ?? 0,
    totalWas: readNumber(body.total_was),
    totalNow: readNumber(body.total_now),
    canKeep: readBoolean(body.can_keep) ?? false,
    rows: readArray(body.rows).flatMap((value) => {
      const row = readRecord(value);
      const offerId = readNumber(row?.offer_id);
      if (!row || offerId == null) return [];
      return [
        {
          offerId,
          brand: readString(row.brand) ?? '',
          number: readString(row.number) ?? '',
          quantity: readNumber(row.quantity) ?? 1,
          quoted: readNumber(row.quoted) ?? 0,
          today: readNumber(row.today) ?? 0,
        },
      ];
    }),
  };
}

export function reviewEnquiryPrices(supabase: Client, enquiryId: string): Promise<PriceReview> {
  return call(supabase.rpc('enquiry_review_prices', { p_id: enquiryId }), readPriceReview);
}

// After the review: keep the quoted prices (a price override) or put every offer on the customer's price today.
// Either way the quote holds until a new date. Returns how many prices had moved.
export function requoteEnquiry(supabase: Client, enquiryId: string, keep: boolean): Promise<number> {
  return call(supabase.rpc('enquiry_requote', { p_id: enquiryId, p_keep: keep }), (data) => readNumber(data) ?? 0);
}
