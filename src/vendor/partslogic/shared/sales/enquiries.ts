import type { Json } from '@partslogic/db-types';

import { call, readHistoryEvents } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readBoolean, readNumber, readRecord, readString, readStrings, type JsonRecord } from '../core/read';
import { ENQUIRY_CHANNELS, isEnquiryChannel, type EnquiryChannel } from './channels';
import { readEnquiryOffer, readEnquiryQuote, type EnquiryOffer, type EnquiryQuote, type PriceBasis } from './offers';
import { readRequestPhotos, type RequestPhoto } from './photos';

// Enquiries: what a customer asked for and what became of it (docs/SALES.md, section 5). The database decides
// where an enquiry stands (its group on the list and the reason shown under its status); these wrappers read
// that answer and never work it out.

export const ENQUIRY_VIEWS = ['mine', 'unassigned', 'follow_up_today', 'to_source', 'all_open', 'closed'] as const;
export type EnquiryView = (typeof ENQUIRY_VIEWS)[number];
export const isEnquiryView = (value: string): value is EnquiryView => (ENQUIRY_VIEWS as readonly string[]).includes(value);

export const ENQUIRY_STATUSES = [
  'new',
  'in_progress',
  'to_source',
  'quoted',
  'waiting_supplier',
  'ordered',
  'lost',
  'no_reply',
  'duplicate',
] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

// The statuses a person can move an open enquiry to. The others follow from what is done to it.
export const ENQUIRY_OPEN_STATUSES = ['in_progress', 'to_source', 'quoted', 'waiting_supplier'] as const;
export type EnquiryOpenStatus = (typeof ENQUIRY_OPEN_STATUSES)[number];


export const NEXT_MOVES = ['needs_action', 'waiting_customer', 'waiting_supplier'] as const;
export type NextMove = (typeof NEXT_MOVES)[number] | 'closed';
export const isNextMove = (value: string): value is (typeof NEXT_MOVES)[number] =>
  (NEXT_MOVES as readonly string[]).includes(value);

// Why a row is where it is, shown under its status.
export type EnquiryStep = 'customer_replied' | 'quote_expired' | 'follow_up_overdue' | 'reply_overdue' | 'follow_up' | 'set_follow_up';

export const REQUEST_OUTCOMES = ['declined', 'could_not_supply', 'no_reply'] as const;
export type CloseOutcome = (typeof REQUEST_OUTCOMES)[number];
export type RequestOutcome = CloseOutcome | 'ordered';

export type EnquiryCustomer = {
  // account: a trade account. card: a retail card. caller: a name and number typed in. erased: a retail card
  // that was erased on request. none: nobody yet.
  kind: 'account' | 'card' | 'caller' | 'erased' | 'none';
  name: string | null;
  phone: string | null;
  partyId: number | null;
  accountId: number | null;
  accountNumber: string | null;
  // The account's status (active, on_stop, closed) and the reason it is on stop.
  status: string | null;
  statusReason: string | null;
  contactId: number | null;
  contactName: string | null;
  retailContactId: number | null;
  // The account needs the customer's own order number on every order.
  orderRefRequired: boolean;
  // The account's note for the counter ("Only Dee or Marcus can order on account").
  counterNote: string | null;
};

export type EnquiryOwner = { id: string; name: string };
// A sales order as an enquiry names it: enough to link to it and to say whether it is still a draft.
export type RequestOrder = { id: string; number: string; status: string };

export function readRequestOrder(value: Json | undefined): RequestOrder | null {
  const row = readRecord(value);
  const id = readString(row?.id);
  const number = readString(row?.number);
  return row && id && number ? { id, number, status: readString(row.status) ?? '' } : null;
}
// Someone an enquiry can be given to, with how many open enquiries they already own.
export type EnquiryOwnerOption = EnquiryOwner & { open: number };

type Standing = {
  id: string;
  number: string;
  status: EnquiryStatus;
  nextMove: NextMove;
  step: EnquiryStep | null;
  overdueMinutes: number | null;
  customerReplied: boolean;
  followUpAt: string | null;
  followUpNote: string | null;
  urgent: boolean;
  channel: EnquiryChannel;
  createdAt: string;
  lastContactAt: string | null;
  closedAt: string | null;
  customer: EnquiryCustomer;
  owner: EnquiryOwner | null;
};

export type EnquiryRow = Standing & {
  vehicles: { registration: string | null; label: string | null }[];
  // Every request, in the customer's words, and how many there are.
  wanted: string | null;
  requestCount: number;
  // The quote as it stands: its total, how many offers, and when it was sent and holds until.
  quote: EnquiryQuote;
  // The other people who have it open now.
  viewers: string[];
};

export type EnquiryGroup = { key: NextMove; count: number; rows: EnquiryRow[] };

// count is what needs action in the view (null for Closed); open is every open enquiry, on All open only.
export type EnquiryViewCount = { key: EnquiryView; count: number | null; open: number | null };

// Across every open enquiry, whatever the view: how many, the customer replies to answer, the overdue ones.
export type EnquirySummary = { open: number; replies: number; overdue: number };

export type EnquiryList = {
  view: EnquiryView;
  views: EnquiryViewCount[];
  summary: EnquirySummary;
  groups: EnquiryGroup[];
  total: number;
  // The rows in the view before the filter box and the filters narrowed them.
  viewTotal: number;
  me: string | null;
  // The database's clock when the list was read: ages are worked out from it, not from the browser's.
  now: string;
};

export type EnquiryVehicle = {
  id: number;
  registration: string | null;
  vin: string | null;
  vehicleId: number | null;
  label: string | null;
  // A picture of the model in the vehicle's colour, from the registration lookup, while its link still works. An
  // illustration, not a photograph of the customer's car.
  imageUrl: string | null;
  // What the registration lookup called this car ("320d EfficientDynamics") and the year it was made. Both are the
  // car's own, kept for its plate; null for a plate never looked up.
  variant: string | null;
  year: number | null;
  // The catalogue vehicle's own details; null until the vehicle is matched.
  spec: VehicleSpec | null;
};

// What the catalogue holds for a vehicle: one row covers every trim with this engine, so it can list several
// engine codes and a run of years.
export type VehicleSpec = {
  fuel: string | null;
  engineCc: number | null;
  powerKw: number | null;
  powerPs: number | null;
  body: string | null;
  drivetrain: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  engineCodes: string[];
};

export function readVehicleSpec(data: Json | undefined): VehicleSpec | null {
  const row = readRecord(data);
  if (!row) return null;
  return {
    fuel: readString(row.fuel),
    engineCc: readNumber(row.engine_cc),
    powerKw: readNumber(row.power_kw),
    powerPs: readNumber(row.power_ps),
    body: readString(row.body),
    drivetrain: readString(row.drivetrain),
    yearFrom: readNumber(row.year_from),
    yearTo: readNumber(row.year_to),
    engineCodes: readStrings(row.engine_codes),
  };
}

export function readEnquiryVehicle(row: JsonRecord): EnquiryVehicle {
  return {
    id: readNumber(row.id) ?? 0,
    registration: readString(row.registration),
    vin: readString(row.vin),
    vehicleId: readNumber(row.vehicle_id),
    label: readString(row.label),
    imageUrl: readString(row.image_url),
    variant: readString(row.variant),
    year: readNumber(row.year),
    spec: readVehicleSpec(row.spec),
  };
}

// The engine in one line: "2.0 litre diesel · 1,968 cc · 110 kW (150 PS)". Null when the catalogue holds none of it.
export function vehicleEngineWords(spec: VehicleSpec | null): string | null {
  if (!spec) return null;
  const litres = spec.engineCc != null && spec.engineCc > 0 ? `${(Math.round(spec.engineCc / 100) / 10).toFixed(1)} litre` : null;
  const fuel = spec.fuel?.trim().toLowerCase() || null;
  const first = [litres, fuel].filter(Boolean).join(' ');
  const size = spec.engineCc != null && spec.engineCc > 0 ? `${new Intl.NumberFormat('en-GB').format(spec.engineCc)} cc` : null;
  const kw = spec.powerKw != null ? `${Number.isInteger(spec.powerKw) ? spec.powerKw : spec.powerKw.toFixed(1)} kW` : null;
  const power = kw && spec.powerPs != null ? `${kw} (${Math.round(spec.powerPs)} PS)` : kw;
  const words = [first ? first.charAt(0).toUpperCase() + first.slice(1) : null, size, power].filter(Boolean);
  return words.length ? words.join(' · ') : null;
}

// The years a catalogue vehicle was made: "2012 to 2018", "2016 on".
export function vehicleYearsWords(spec: VehicleSpec | null): string | null {
  if (!spec || spec.yearFrom == null) return null;
  return spec.yearTo != null ? (spec.yearTo === spec.yearFrom ? String(spec.yearFrom) : `${spec.yearFrom} to ${spec.yearTo}`) : `${spec.yearFrom} on`;
}

// The details of an enquiry's vehicle that are worth reading but not copying, for the window its name opens.
// Rows with nothing to say are left out.
export function vehicleFactRows(vehicle: EnquiryVehicle): [string, string][] {
  const rows: [string, string | null][] = [
    ['Registered as', vehicle.variant],
    ['Year', vehicle.year != null ? String(vehicle.year) : null],
    ['Engine', vehicleEngineWords(vehicle.spec)],
    [vehicle.spec && vehicle.spec.engineCodes.length > 1 ? 'Engine codes' : 'Engine code', vehicle.spec?.engineCodes.join(', ') || null],
    ['Body', vehicle.spec?.body ?? null],
    ['Drive', vehicle.spec?.drivetrain ?? null],
    ['Made', vehicleYearsWords(vehicle.spec)],
  ];
  return rows.filter((row): row is [string, string] => Boolean(row[1]));
}

// The line under a vehicle's name: the car's year, what it is registered as, and the end of its VIN.
export function vehicleSubLine(vehicle: EnquiryVehicle): string | null {
  const words = [vehicle.year != null ? String(vehicle.year) : null, vehicle.variant, vehicle.vin ? `VIN ending ${vehicle.vin.slice(-6)}` : null].filter(Boolean);
  return words.length ? words.join(' · ') : null;
}

// One word per request: how it ended, or how far its offers have got.
export const REQUEST_STATES = ['new', 'to_source', 'offered', 'quoted', 'accepted', 'ordered', 'declined', 'could_not_supply', 'no_reply'] as const;
export type RequestState = (typeof REQUEST_STATES)[number];

export type EnquiryRequest = {
  id: number;
  wanted: string;
  quantity: number;
  vehicleId: number | null;
  state: RequestState;
  // The parts put to the customer for this request, oldest first.
  offers: EnquiryOffer[];
  // The customer's pictures (the old part, its label), oldest first.
  photos: RequestPhoto[];
  // The sales order the accepted offer went onto, while the request reads Ordered.
  order: RequestOrder | null;
  outcome: RequestOutcome | null;
  reason: string | null;
  reasonLabel: string | null;
  outcomeNote: string | null;
  closedAt: string | null;
  closedBy: string | null;
};

export type EnquiryLogEntry =
  | {
      id: number;
      kind: 'message' | 'call' | 'note';
      direction: 'in' | 'out' | 'internal';
      channel: EnquiryChannel | null;
      body: string;
      at: string;
      by: string | null;
    }
  | { id: number; kind: 'event'; event: string; detail: JsonRecord; at: string; by: string | null };

// needsNote: choosing it asks what happened (Other); the typed words are shown in place of the label.
export type LostReason = { code: string; outcome: 'declined' | 'could_not_supply'; label: string; needsNote: boolean };

export type EnquiryContact = { id: number; name: string | null; phone: string | null; email: string | null; isPrimary: boolean };

export type EnquiryDetail = Standing & {
  locationId: number | null;
  createdBy: string | null;
  closedBy: string | null;
  // The other people who have it open now.
  viewers: string[];
  // The account's contacts, to say who is asking.
  contacts: EnquiryContact[];
  vehicles: EnquiryVehicle[];
  requests: EnquiryRequest[];
  // Messages, calls, notes and what the system did, oldest first.
  log: EnquiryLogEntry[];
  // Other open enquiries from the same customer for the same plate, opened the same day.
  duplicates: { id: string; number: string; status: EnquiryStatus; wanted: string | null; owner: string | null }[];
  mergedInto: { id: string; number: string } | null;
  reasons: LostReason[];
  // The quote as it stands, whose prices the enquiry is on, the VAT rate, and the branch that is "here".
  quote: EnquiryQuote;
  priceBasis: PriceBasis;
  vatRate: number;
  branch: { id: number; name: string } | null;
  canSeeMargin: boolean;
  canOverridePrice: boolean;
  // May write down a supplier's quote (the Record supplier quotes permission).
  canRecordSupplierQuote: boolean;
  // May search Autodoc from Find parts (the Search Autodoc from an enquiry permission).
  canSearchAutodoc: boolean;
  // Something is accepted on an open request, and this person may make the order.
  canCreateOrder: boolean;
  // Every sales order made from this enquiry, oldest first, cancelled ones included.
  orders: RequestOrder[];
  // The registration lookup provider, or null: staff match the vehicle by hand.
  vrmProvider: string | null;
  canEdit: boolean;
  now: string;
};

function oneOf<T extends string>(values: readonly T[], value: Json | undefined, fallback: T): T {
  return typeof value === 'string' && (values as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function readEnquiryCustomer(value: Json | undefined): EnquiryCustomer {
  const row = readRecord(value) ?? {};
  return {
    kind: oneOf(['account', 'card', 'caller', 'erased', 'none'] as const, row.kind, 'none'),
    name: readString(row.name),
    phone: readString(row.phone),
    partyId: readNumber(row.party_id),
    accountId: readNumber(row.account_id),
    accountNumber: readString(row.account_number),
    status: readString(row.status),
    statusReason: readString(row.status_reason),
    contactId: readNumber(row.contact_id),
    contactName: readString(row.contact_name),
    retailContactId: readNumber(row.retail_contact_id),
    orderRefRequired: readBoolean(row.order_ref_required) ?? false,
    counterNote: readString(row.counter_note),
  };
}

function readBranch(value: Json | undefined): { id: number; name: string } | null {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  return row && id != null ? { id, name: readString(row.name) ?? '' } : null;
}

export function readEnquiryOwner(value: Json | undefined): EnquiryOwner | null {
  const row = readRecord(value);
  const id = readString(row?.id);
  return row && id ? { id, name: readString(row.name) ?? 'Someone' } : null;
}

function readStanding(row: JsonRecord): Standing | null {
  const id = readString(row.id);
  const number = readString(row.number);
  if (!id || !number) return null;
  const step = readString(row.step);
  return {
    id,
    number,
    status: oneOf(ENQUIRY_STATUSES, row.status, 'new'),
    nextMove: oneOf(['needs_action', 'waiting_customer', 'waiting_supplier', 'closed'] as const, row.next_move, 'needs_action'),
    step: step
      ? oneOf(['customer_replied', 'quote_expired', 'follow_up_overdue', 'reply_overdue', 'follow_up', 'set_follow_up'] as const, step, 'set_follow_up')
      : null,
    overdueMinutes: readNumber(row.overdue_minutes),
    customerReplied: readBoolean(row.customer_replied) ?? false,
    followUpAt: readString(row.follow_up_at),
    followUpNote: readString(row.follow_up_note),
    urgent: readBoolean(row.urgent) ?? false,
    channel: oneOf(ENQUIRY_CHANNELS, row.channel, 'phone'),
    createdAt: readString(row.created_at) ?? '',
    lastContactAt: readString(row.last_contact_at),
    closedAt: readString(row.closed_at),
    customer: readEnquiryCustomer(row.customer),
    owner: readEnquiryOwner(row.owner),
  };
}

export function readEnquiryRow(value: Json | undefined): EnquiryRow | null {
  const row = readRecord(value);
  const standing = row && readStanding(row);
  if (!row || !standing) return null;
  return {
    ...standing,
    vehicles: readArray(row.vehicles).flatMap((item) => {
      const vehicle = readRecord(item);
      return vehicle ? [{ registration: readString(vehicle.registration), label: readString(vehicle.label) }] : [];
    }),
    wanted: readString(row.wanted),
    requestCount: readNumber(row.request_count) ?? 0,
    quote: readEnquiryQuote(row.quote),
    viewers: readStrings(row.viewers),
  };
}

export function readEnquiryList(data: Json): EnquiryList {
  const body = readRecord(data) ?? {};
  const summary = readRecord(body.summary) ?? {};
  return {
    view: oneOf(ENQUIRY_VIEWS, body.view, 'all_open'),
    summary: {
      open: readNumber(summary.open) ?? 0,
      replies: readNumber(summary.replies) ?? 0,
      overdue: readNumber(summary.overdue) ?? 0,
    },
    views: readArray(body.views).flatMap((item) => {
      const view = readRecord(item);
      const key = readString(view?.key);
      if (!view || !key || !isEnquiryView(key)) return [];
      return [{ key, count: readNumber(view.count), open: readNumber(view.open) }];
    }),
    groups: readArray(body.groups).flatMap((item) => {
      const group = readRecord(item);
      if (!group) return [];
      return [
        {
          key: oneOf(['needs_action', 'waiting_customer', 'waiting_supplier', 'closed'] as const, group.key, 'needs_action'),
          count: readNumber(group.count) ?? 0,
          rows: readArray(group.rows).flatMap((row) => readEnquiryRow(row) ?? []),
        },
      ];
    }),
    total: readNumber(body.total) ?? 0,
    viewTotal: readNumber(body.view_total) ?? 0,
    me: readString(body.me),
    now: readString(body.now) ?? new Date().toISOString(),
  };
}

function readLogEntry(value: Json): EnquiryLogEntry[] {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  const kind = readString(row?.kind);
  if (!row || id == null || !kind) return [];
  const at = readString(row.at) ?? '';
  const by = readString(row.by);
  if (kind === 'event') {
    const event = readHistoryEvents([row])[0];
    return event ? [{ id, kind: 'event', event: event.event, detail: event.detail, at, by }] : [];
  }
  const channel = readString(row.channel);
  return [
    {
      id,
      kind: oneOf(['message', 'call', 'note'] as const, kind, 'note'),
      direction: oneOf(['in', 'out', 'internal'] as const, row.direction, 'internal'),
      channel: channel && isEnquiryChannel(channel) ? channel : null,
      body: readString(row.body) ?? '',
      at,
      by,
    },
  ];
}

export function readEnquiryDetail(data: Json): EnquiryDetail | null {
  const body = readRecord(data);
  const standing = body && readStanding(body);
  if (!body || !standing) return null;
  const merged = readRecord(body.merged_into);
  const mergedId = readString(merged?.id);
  return {
    ...standing,
    locationId: readNumber(body.location_id),
    createdBy: readString(body.created_by),
    closedBy: readString(body.closed_by),
    viewers: readStrings(body.viewers),
    contacts: readArray(body.contacts).flatMap((item) => {
      const contact = readRecord(item);
      const id = readNumber(contact?.id);
      if (!contact || id == null) return [];
      return [{ id, name: readString(contact.name), phone: readString(contact.phone), email: readString(contact.email), isPrimary: readBoolean(contact.is_primary) ?? false }];
    }),
    vehicles: readArray(body.vehicles).flatMap((item) => {
      const vehicle = readRecord(item);
      if (!vehicle || readNumber(vehicle.id) == null) return [];
      return [readEnquiryVehicle(vehicle)];
    }),
    requests: readArray(body.requests).flatMap((item) => {
      const request = readRecord(item);
      const id = readNumber(request?.id);
      if (!request || id == null) return [];
      const outcome = readString(request.outcome);
      return [
        {
          id,
          wanted: readString(request.wanted) ?? '',
          quantity: readNumber(request.quantity) ?? 1,
          vehicleId: readNumber(request.vehicle_id),
          state: oneOf(REQUEST_STATES, request.state, outcome ? 'no_reply' : 'new'),
          offers: readArray(request.offers).flatMap((offer) => readEnquiryOffer(offer) ?? []),
          photos: readRequestPhotos(request.photos),
          order: readRequestOrder(request.order),
          outcome: outcome ? oneOf(['ordered', 'declined', 'could_not_supply', 'no_reply'] as const, outcome, 'no_reply') : null,
          reason: readString(request.reason),
          reasonLabel: readString(request.reason_label),
          outcomeNote: readString(request.outcome_note),
          closedAt: readString(request.closed_at),
          closedBy: readString(request.closed_by),
        },
      ];
    }),
    log: readArray(body.log).flatMap(readLogEntry),
    duplicates: readArray(body.duplicates).flatMap((item) => {
      const other = readRecord(item);
      const id = readString(other?.id);
      const number = readString(other?.number);
      return other && id && number
        ? [{ id, number, status: oneOf(ENQUIRY_STATUSES, other.status, 'new'), wanted: readString(other.wanted), owner: readString(other.owner) }]
        : [];
    }),
    mergedInto: merged && mergedId ? { id: mergedId, number: readString(merged.number) ?? '' } : null,
    reasons: readArray(body.reasons).flatMap((item) => {
      const reason = readRecord(item);
      const code = readString(reason?.code);
      if (!reason || !code) return [];
      return [
        {
          code,
          outcome: oneOf(['declined', 'could_not_supply'] as const, reason.outcome, 'declined'),
          label: readString(reason.label) ?? code,
          needsNote: readBoolean(reason.needs_note) ?? false,
        },
      ];
    }),
    vrmProvider: readString(body.vrm_provider),
    quote: readEnquiryQuote(body.quote),
    priceBasis: oneOf(['account', 'trade', 'retail'] as const, body.price_basis, 'trade'),
    vatRate: readNumber(body.vat_rate) ?? 0,
    branch: readBranch(body.branch),
    canSeeMargin: readBoolean(body.can_see_margin) ?? false,
    canOverridePrice: readBoolean(body.can_override_price) ?? false,
    canRecordSupplierQuote: readBoolean(body.can_record_supplier_quote) ?? false,
    canSearchAutodoc: readBoolean(body.can_search_autodoc) ?? false,
    canCreateOrder: readBoolean(body.can_create_order) ?? false,
    orders: readArray(body.orders).flatMap((item) => readRequestOrder(item) ?? []),
    canEdit: readBoolean(body.can_edit) ?? false,
    now: readString(body.now) ?? new Date().toISOString(),
  };
}

// --------------------------------------------------------------------------------------------------- reading

export type EnquiryListQuery = {
  view?: EnquiryView;
  search?: string;
  nextMove?: (typeof NEXT_MOVES)[number];
  // Narrow the rows: an owner's id or 'none' for unassigned, and how it arrived.
  owner?: string;
  channel?: EnquiryChannel;
  // The Closed view is the one paged view.
  limit?: number;
  offset?: number;
};

export function listEnquiries(supabase: Client, query: EnquiryListQuery = {}): Promise<EnquiryList> {
  const filters: { [key: string]: Json } = {};
  if (query.owner) filters.owner = query.owner;
  if (query.channel) filters.channel = query.channel;
  return call(
    supabase.rpc('enquiry_list', {
      p_view: query.view ?? 'all_open',
      p_search: query.search?.trim() || null,
      p_next_move: query.nextMove ?? null,
      p_limit: query.limit ?? 50,
      p_offset: query.offset ?? 0,
      p_filters: filters,
    }),
    readEnquiryList,
  );
}

export function getEnquiry(supabase: Client, id: string): Promise<EnquiryDetail | null> {
  return call(supabase.rpc('enquiry_detail', { p_id: id }), readEnquiryDetail);
}

// The people an enquiry can be assigned to, each with how many open enquiries they own.
export function listEnquiryOwners(supabase: Client): Promise<EnquiryOwnerOption[]> {
  return call(supabase.rpc('enquiry_owners'), (data) =>
    readArray(data).flatMap((item) => {
      const owner = readEnquiryOwner(item);
      return owner ? [{ ...owner, open: readNumber(readRecord(item)?.open) ?? 0 }] : [];
    }),
  );
}

// A light read for a list that is already open: the counts, and each open enquiry with whether the customer has
// replied, so the screen can say what is new without moving rows.
export type EnquiryPulse = { views: EnquiryViewCount[]; summary: EnquirySummary; open: { id: string; replied: boolean }[]; now: string };

export function getEnquiryPulse(supabase: Client): Promise<EnquiryPulse> {
  return call(supabase.rpc('enquiry_pulse'), (data) => {
    const list = readEnquiryList(data);
    return {
      views: list.views,
      summary: list.summary,
      now: list.now,
      open: readArray(readRecord(data)?.open).flatMap((item) => {
        const row = readRecord(item);
        const id = readString(row?.id);
        return row && id ? [{ id, replied: readBoolean(row.replied) ?? false }] : [];
      }),
    };
  });
}

// Says the caller has this enquiry open now; returns the names of the others who do.
export function touchEnquiry(supabase: Client, id: string): Promise<string[]> {
  return call(supabase.rpc('enquiry_touch', { p_id: id }), (data) => readStrings(data));
}

// The last few customers the caller took an enquiry for, newest first.
export function listRecentEnquiryCustomers(supabase: Client, limit = 5): Promise<(EnquiryCustomer & { at: string })[]> {
  return call(supabase.rpc('enquiry_recent_customers', { p_limit: limit }), (data) =>
    readArray(data).map((item) => ({ ...readEnquiryCustomer(item), at: readString(readRecord(item)?.at) ?? '' })),
  );
}

// Makes a retail card from the name and number typed on an enquiry, and puts the enquiry on it.
export function makeRetailCardFromCaller(supabase: Client, id: string): Promise<number> {
  return call(supabase.rpc('enquiry_caller_to_card', { p_id: id }), (data) => readNumber(data) ?? 0);
}

// Splits one request into several, in order. The original wording is kept in the history.
export function splitEnquiryRequest(supabase: Client, requestId: number, parts: string[]): Promise<void> {
  return call(supabase.rpc('enquiry_split_request', { p_request: requestId, p_parts: parts }), () => undefined);
}

// --------------------------------------------------------------------------------------------------- writing

// Who is asking: a trade account (partyId, with one of its contacts), a retail card, or a caller typed in.
export type EnquiryCustomerInput = {
  partyId?: number | null;
  contactId?: number | null;
  retailContactId?: number | null;
  callerName?: string | null;
  callerPhone?: string | null;
};

export type NewEnquiry = EnquiryCustomerInput & {
  channel?: EnquiryChannel;
  locationId?: number | null;
  // The first request, in the customer's words.
  wanted?: string;
};

// Only the fields given change; null clears one.
export type EnquiryChanges = EnquiryCustomerInput & {
  channel?: EnquiryChannel;
  locationId?: number | null;
  urgent?: boolean;
  followUpAt?: string | null;
  followUpNote?: string | null;
  ownerId?: string | null;
};

const FIELD_NAMES: Record<string, string> = {
  partyId: 'party_id',
  contactId: 'contact_id',
  retailContactId: 'retail_contact_id',
  callerName: 'caller_name',
  callerPhone: 'caller_phone',
  locationId: 'location_id',
  followUpAt: 'follow_up_at',
  followUpNote: 'follow_up_note',
  ownerId: 'owner_id',
};

// The database's field names; a field that was not given is left out, so it is left alone.
export function enquiryFields(input: Record<string, Json | undefined>): { [key: string]: Json } {
  const out: { [key: string]: Json } = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) out[FIELD_NAMES[key] ?? key] = value;
  }
  return out;
}

// Opens an enquiry at once: there is no draft. Returns its id and number.
export function createEnquiry(supabase: Client, input: NewEnquiry = {}): Promise<{ id: string; number: string }> {
  return call(supabase.rpc('enquiry_create', { p: enquiryFields(input) }), (data) => {
    const body = readRecord(data);
    return { id: readString(body?.id) ?? '', number: readString(body?.number) ?? '' };
  });
}

export function saveEnquiry(supabase: Client, id: string, changes: EnquiryChanges): Promise<void> {
  return call(supabase.rpc('enquiry_save', { p_id: id, p: enquiryFields(changes) }), () => undefined);
}

// Gives enquiries to a person, or to nobody (null). Returns how many were changed.
export function assignEnquiries(supabase: Client, ids: string[], ownerId: string | null): Promise<number> {
  return call(supabase.rpc('enquiry_assign', { p_ids: ids, p_owner: ownerId }), (data) => readNumber(data) ?? 0);
}

export function deleteEnquiry(supabase: Client, id: string): Promise<void> {
  return call(supabase.rpc('enquiry_delete', { p_id: id }), () => undefined);
}

export type EnquiryVehicleInput = {
  id?: number;
  registration?: string | null;
  vin?: string | null;
  // Leave vehicleId out to let a plate seen before fill it in; null says the vehicle is not known.
  vehicleId?: number | null;
  label?: string | null;
};

// remembered: the plate was seen before and the vehicle was filled in from that match, made at matchedAt.
export function saveEnquiryVehicle(
  supabase: Client,
  id: string,
  vehicle: EnquiryVehicleInput,
): Promise<EnquiryVehicle & { remembered: boolean; matchedAt: string | null }> {
  const p = enquiryFields({ ...vehicle, vehicleId: undefined });
  if (vehicle.vehicleId !== undefined) p.vehicle_id = vehicle.vehicleId;
  return call(supabase.rpc('enquiry_save_vehicle', { p_id: id, p }), (data) => {
    const row = readRecord(data) ?? {};
    return {
      ...readEnquiryVehicle(row),
      remembered: readBoolean(row.remembered) ?? false,
      matchedAt: readString(row.matched_at),
    };
  });
}

export function removeEnquiryVehicle(supabase: Client, vehicleId: number): Promise<void> {
  return call(supabase.rpc('enquiry_remove_vehicle', { p_vehicle: vehicleId }), () => undefined);
}

export type EnquiryRequestInput = { id?: number; wanted: string; quantity?: number; vehicleId?: number | null };

export function saveEnquiryRequest(supabase: Client, id: string, request: EnquiryRequestInput): Promise<number> {
  const p: { [key: string]: Json } = { wanted: request.wanted };
  if (request.id != null) p.id = request.id;
  if (request.quantity != null) p.quantity = request.quantity;
  if (request.vehicleId !== undefined) p.vehicle_id = request.vehicleId;
  return call(supabase.rpc('enquiry_save_request', { p_id: id, p }), (data) => readNumber(data) ?? 0);
}

export function removeEnquiryRequest(supabase: Client, requestId: number): Promise<void> {
  return call(supabase.rpc('enquiry_remove_request', { p_request: requestId }), () => undefined);
}

// A message or call (in from the customer, out to the customer) or a staff note. Nothing is sent.
export type EnquiryLogInput =
  | { kind: 'message'; direction: 'in' | 'out'; body: string; channel?: EnquiryChannel }
  | { kind: 'call'; direction: 'in' | 'out'; body: string }
  | { kind: 'note'; body: string };

export function logEnquiryContact(supabase: Client, id: string, entry: EnquiryLogInput): Promise<number> {
  return call(supabase.rpc('enquiry_log_contact', { p_id: id, p: enquiryFields(entry) }), (data) => readNumber(data) ?? 0);
}

export function setEnquiryStatus(supabase: Client, id: string, status: EnquiryOpenStatus): Promise<void> {
  return call(supabase.rpc('enquiry_set_status', { p_id: id, p_status: status }), () => undefined);
}

// How a request, or a whole enquiry, ends without a sale. declined and could_not_supply need a reason.
export type CloseInput = { outcome: CloseOutcome; reason?: string | null; note?: string | null };

export function closeEnquiryRequest(supabase: Client, requestId: number, input: CloseInput): Promise<void> {
  return call(
    supabase.rpc('enquiry_close_request', {
      p_request: requestId,
      p_outcome: input.outcome,
      p_reason: input.reason ?? null,
      p_note: input.note ?? null,
    }),
    () => undefined,
  );
}

export function reopenEnquiryRequest(supabase: Client, requestId: number): Promise<void> {
  return call(supabase.rpc('enquiry_reopen_request', { p_request: requestId }), () => undefined);
}

export function closeEnquiry(supabase: Client, id: string, input: CloseInput): Promise<void> {
  return call(
    supabase.rpc('enquiry_close', {
      p_id: id,
      p_outcome: input.outcome,
      p_reason: input.reason ?? null,
      p_note: input.note ?? null,
    }),
    () => undefined,
  );
}

export function reopenEnquiry(supabase: Client, id: string): Promise<void> {
  return call(supabase.rpc('enquiry_reopen', { p_id: id }), () => undefined);
}

// The same thing asked twice: `from` moves into `into` and closes as a duplicate.
export function mergeEnquiries(supabase: Client, from: string, into: string): Promise<void> {
  return call(supabase.rpc('enquiry_merge', { p_from: from, p_into: into }), () => undefined);
}
