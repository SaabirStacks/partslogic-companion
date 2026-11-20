import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readBoolean, readNumber, readRecord, readString } from '../core/read';

// Sourcing a part that is not listed (docs/SALES.md, sections 7.3 and 13.5): writing down what a supplier quoted,
// and logging that a supplier was asked. The database makes the part, the supplier's price and the offer, and works
// out the selling price; these wrappers hand it the words and read its answers.

// What a supplier said. number is the supplier part number; cost is each, before VAT; arrivesOn is a date
// (YYYY-MM-DD). confirmNewBrand answers the "is close to" question for a brand the catalogue does not know.
export type SupplierQuoteInput = {
  supplierId: number;
  number: string;
  brandName: string;
  cost: number;
  description?: string | null;
  arrivesOn?: string | null;
  reference?: string | null;
  confirmNewBrand?: boolean;
};

export type RecordedSupplierQuote = {
  quoteId: number;
  partId: number;
  // Brand and number, as the catalogue holds them.
  part: string;
  offerId: number | null;
  // False when the part was already offered on the request: the quote is kept, the offer is left as it is.
  offerAdded: boolean;
  createdPart: boolean;
  createdBrand: boolean;
};

export function readRecordedSupplierQuote(data: Json): RecordedSupplierQuote {
  const row = readRecord(data) ?? {};
  return {
    quoteId: readNumber(row.quote_id) ?? 0,
    partId: readNumber(row.part_id) ?? 0,
    part: readString(row.part) ?? '',
    offerId: readNumber(row.offer_id),
    offerAdded: readBoolean(row.offer_added) ?? false,
    createdPart: readBoolean(row.created_part) ?? false,
    createdBrand: readBoolean(row.created_brand) ?? false,
  };
}

export function supplierQuoteFields(quote: SupplierQuoteInput): { [key: string]: Json } {
  const p: { [key: string]: Json } = {
    supplier_id: quote.supplierId,
    number: quote.number,
    brand_name: quote.brandName,
    cost: quote.cost,
  };
  if (quote.description?.trim()) p.description = quote.description;
  if (quote.arrivesOn) p.arrives_on = quote.arrivesOn;
  if (quote.reference?.trim()) p.reference = quote.reference;
  if (quote.confirmNewBrand) p.confirm_new_brand = true;
  return p;
}

// Writes the quote down: the part joins the catalogue (not the stock list), the cost becomes that supplier's
// price, and the part is offered on the request to order in.
export function recordSupplierQuote(supabase: Client, requestId: number, quote: SupplierQuoteInput): Promise<RecordedSupplierQuote> {
  return call(supabase.rpc('enquiry_record_supplier_quote', { p_request: requestId, p: supplierQuoteFields(quote) }), readRecordedSupplierQuote);
}

// Before saving: what the customer on the request would pay. price is null until a cost is typed, and when no
// margin rule covers the part. margin is null for a person who may not see margins.
export type SupplierQuotePrice = { price: number | null; margin: number | null; onStockList: boolean; knownPart: boolean };

export function readSupplierQuotePrice(data: Json): SupplierQuotePrice {
  const row = readRecord(data) ?? {};
  return {
    price: readNumber(row.price),
    margin: readNumber(row.margin),
    onStockList: readBoolean(row.on_stock_list) ?? false,
    knownPart: readBoolean(row.known_part) ?? false,
  };
}

export function priceSupplierQuote(
  supabase: Client,
  requestId: number,
  typed: { cost: number | null; brandName?: string | null; number?: string | null },
): Promise<SupplierQuotePrice> {
  const p: { [key: string]: Json } = {};
  if (typed.cost != null) p.cost = typed.cost;
  if (typed.brandName?.trim()) p.brand_name = typed.brandName;
  if (typed.number?.trim()) p.number = typed.number;
  return call(supabase.rpc('enquiry_supplier_quote_price', { p_request: requestId, p }), readSupplierQuotePrice);
}

// Logs that a supplier was asked: the words go on the contact log, the enquiry waits on the supplier until the
// follow-up time. Nothing is sent.
export function askSupplier(supabase: Client, requestId: number, asked: { supplierId: number; body: string; followUpAt: string }): Promise<void> {
  return call(
    supabase.rpc('enquiry_ask_supplier', {
      p_request: requestId,
      p: { supplier_id: asked.supplierId, body: asked.body, follow_up_at: asked.followUpAt },
    }),
    () => undefined,
  );
}

// A search found nothing listed for the request: it reads To source, and an enquiry with nothing to offer joins
// the To source view.
export function markRequestToSource(supabase: Client, requestId: number): Promise<void> {
  return call(supabase.rpc('enquiry_source_request', { p_request: requestId }), () => undefined);
}

// The words a supplier is asked with, filled in from the request and its vehicle: "Price and availability please:
// front pads for VW Golf VII 2.0 TDI, YK19 HNC." The person can change them before copying.
export function supplierAskText(request: { wanted: string; quantity: number }, vehicle: { label: string | null; registration: string | null; vin?: string | null } | null): string {
  const wanted = request.wanted.trim().replace(/\s+/g, ' ');
  const thing = wanted ? wanted.charAt(0).toLowerCase() + wanted.slice(1) : 'part';
  const quantity = request.quantity > 1 ? `${request.quantity} × ` : '';
  const about = [vehicle?.label, vehicle?.registration, vehicle?.vin ? `VIN ${vehicle.vin}` : null].filter((part): part is string => !!part);
  return `Price and availability please: ${quantity}${thing}${about.length ? ` for ${about.join(', ')}` : ''}.`;
}

// The line under the fields of Record supplier quote: "Sells to Hillside Garage at £13.45 each · margin 30%".
export function supplierQuotePriceWords(price: SupplierQuotePrice | null, customer: string, money: (amount: number) => string): string | null {
  if (!price) return null;
  if (price.price == null) return 'No margin rule covers this part, so it has no selling price. Add a margin in Settings, Pricing.';
  const margin = price.margin != null ? ` · margin ${Math.round(price.margin * 100)}%` : '';
  const kept = price.onStockList ? ' · on the stock list, so its price stays' : '';
  return `Sells to ${customer} at ${money(price.price)} each${margin}${kept}`;
}

// Notes on the enquiry that Autodoc was searched for a request. The search itself is the server's.
export function logAutodocSearch(supabase: Client, requestId: number, searched: { keyword: string; found: number; credits: number }): Promise<void> {
  return call(
    supabase.rpc('enquiry_log_autodoc_search', { p_request: requestId, p_keyword: searched.keyword, p_found: searched.found, p_credits: searched.credits }),
    () => undefined,
  );
}

// What pressing Search Autodoc would do, so the cost is known before the press.
export type AutodocSearchOffer = {
  // What a new search costs, in credits.
  cost: number;
  // Credits left in the budget; null when no budget is set.
  left: number | null;
  limit: number | null;
  // When these words were last searched, if the saved results are still fresh enough to show for free.
  savedAt: string | null;
};

// The line under 'Search Autodoc for "…"?': the cost and what is left, or that the saved results are free.
export function autodocOfferWords(offer: AutodocSearchOffer, when: (at: string) => string): { text: string; canSearch: boolean } {
  if (offer.savedAt) return { text: `Searched ${when(offer.savedAt)}. Showing those results is free.`, canSearch: true };
  const cost = `Uses ${offer.cost} ${offer.cost === 1 ? 'credit' : 'credits'}.`;
  if (offer.limit == null || offer.left == null) return { text: `${cost} No Autodoc credit budget is set: set one in Organisation, Enrichment.`, canSearch: false };
  if (offer.left < offer.cost) return { text: 'No Autodoc credits left. The budget is changed in Organisation, Enrichment.', canSearch: false };
  const number = (value: number) => new Intl.NumberFormat('en-GB').format(value);
  return { text: `${cost} ${number(offer.left)} of ${number(offer.limit)} left.`, canSearch: true };
}
