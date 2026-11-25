import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readBoolean, readNumber, readRecord, readString, type JsonRecord } from '../core/read';
import { deliveryPlace, readSalesOrderAddress, type SalesOrderAddress } from './address';
import { dayAndTime, quantityWords } from './words';

const LONDON = 'Europe/London';

// Picking (S5a-1, docs/SALES.md 13.15, docs/design-checks/fulfilment.md). A confirmed order's set-aside units are
// picked from their bins to the collection and delivery shelf, in walking order by bin, urgent orders first. A short
// pick keeps the units to pick, flagged with a reason; nothing leaves the books. The database works out the list, the
// bins and the counts; these read its answers and put them in words.

// To pack (S5b-1, owner 25 November 2026: a view on Picking): deliveries with every unit picked, by order. It sits with
// the other queues, before Picked today, the day's record.
export const PICKING_VIEWS = ['to_pick', 'not_found', 'to_pack', 'picked_today'] as const;
export type PickingView = (typeof PICKING_VIEWS)[number];

export const PICKING_VIEW_LABELS: Record<PickingView, string> = {
  to_pick: 'To pick',
  // The owner, 25 November 2026: "Short picks", the action's own name ("Not found" is To source's word on sales screens).
  not_found: 'Short picks',
  to_pack: 'To pack',
  picked_today: 'Picked today',
};

// How a pick was made (S5b-1): on the web's Picking page, by a scan on the phone, or by a tap on the phone when the
// code would not scan, with why (owner, 21 November 2026: the reason is logged).
export const PICK_METHODS = ['web', 'scan', 'tap'] as const;
export type PickMethod = (typeof PICK_METHODS)[number];

export const CANT_SCAN_REASONS = ['label', 'wont_scan'] as const;
export type CantScanReason = (typeof CANT_SCAN_REASONS)[number];
export const CANT_SCAN_REASON_LABELS: Record<CantScanReason, string> = {
  label: 'Label worn or missing',
  wont_scan: "Won't scan",
};

export const SHORT_PICK_REASONS = ['bin_empty', 'damaged', 'wrong_part'] as const;
export type ShortPickReason = (typeof SHORT_PICK_REASONS)[number];

export const SHORT_PICK_REASON_LABELS: Record<ShortPickReason, string> = {
  bin_empty: 'Bin empty',
  damaged: 'Damaged',
  wrong_part: 'Wrong part',
};

// The bin a row's stock is in. Unbinned is "Not in a bin"; a row with no bin has no stock on the books here.
export const UNBINNED_CODE = 'UNBINNED';

export type PickingPart = { id: number; brand: string; number: string; description: string | null };

export type NotFound = { qty: number; reason: ShortPickReason; binId: number; bin: string; at: string | null };

// A row to pick: one order line's units in one bin.
export type PickingRow = {
  lineId: number;
  orderId: string;
  order: string;
  customer: string | null;
  urgent: boolean;
  part: PickingPart;
  binId: number | null;
  bin: string | null;
  qty: number;
  notFound: NotFound | null;
  // Who holds the order in a pick job on a phone (S5b-1), or null.
  picker: string | null;
};

// A pick still standing today: what was moved, and what was not found.
export type PickedRow = {
  pickId: number;
  lineId: number;
  orderId: string;
  order: string;
  customer: string | null;
  urgent: boolean;
  part: PickingPart;
  binId: number;
  bin: string;
  qty: number;
  short: number;
  reason: ShortPickReason | null;
  pickedAt: string;
  pickedBy: string | null;
  method: PickMethod;
};

// An order to pack (S5b-1): a delivery or courier order with every unit on the shelf, and the parts going in the box.
export type PackingLine = { lineId: number; part: PickingPart; qty: number };
export type PackingOrder = {
  orderId: string;
  order: string;
  customer: string | null;
  urgent: boolean;
  units: number;
  address: SalesOrderAddress | null;
  addressText: string | null;
  lines: PackingLine[];
};

export type PickingLocation = { id: number; code: string; name: string };

// Units for each view, except To pack, which counts orders: a delivery is packed whole (owner, 25 November 2026).
export type PickingCounts = { toPick: number; orders: number; notFound: number; toPack: number; pickedToday: number };

export type PickingList = {
  view: PickingView;
  locationId: number | null;
  orderId: string | null;
  // The order the page shows alone (opened from its Pick links): its number, for the chip that shows every order.
  orderNumber: string | null;
  locations: PickingLocation[];
  counts: PickingCounts;
  rows: PickingRow[];
  picked: PickedRow[];
  packing: PackingOrder[];
  canPick: boolean;
  now: string;
};

export function isPickingView(value: string | null): value is PickingView {
  return value != null && (PICKING_VIEWS as readonly string[]).includes(value);
}

function isReason(value: string | null): value is ShortPickReason {
  return value != null && (SHORT_PICK_REASONS as readonly string[]).includes(value);
}

function readMethod(value: Json | undefined): PickMethod {
  return typeof value === 'string' && (PICK_METHODS as readonly string[]).includes(value) ? (value as PickMethod) : 'web';
}

function readPart(value: Json | undefined): PickingPart | null {
  const part = readRecord(value);
  const id = readNumber(part?.id);
  if (!part || id == null) return null;
  return { id, brand: readString(part.brand) ?? '', number: readString(part.number) ?? '', description: readString(part.description) };
}

export function readNotFound(value: Json | undefined): NotFound | null {
  const row = readRecord(value);
  const qty = readNumber(row?.qty);
  const reason = readString(row?.reason);
  const binId = readNumber(row?.bin_id);
  if (!row || qty == null || qty <= 0 || !isReason(reason) || binId == null) return null;
  return { qty, reason, binId, bin: readString(row.bin) ?? '', at: readString(row.at) };
}

// A row to pick, as the Picking page and a phone's pick job both read it.
export function readPickingRow(item: Json): PickingRow[] {
  const row = readRecord(item);
  const lineId = readNumber(row?.line_id);
  const orderId = readString(row?.order_id);
  const part = readPart(row?.part);
  if (!row || lineId == null || !orderId || !part) return [];
  return [
    {
      lineId,
      orderId,
      order: readString(row.order) ?? '',
      customer: readString(row.customer),
      urgent: readBoolean(row.urgent) ?? false,
      part,
      binId: readNumber(row.bin_id),
      bin: readString(row.bin),
      qty: readNumber(row.qty) ?? 0,
      notFound: readNotFound(row.not_found),
      picker: readString(row.picker),
    },
  ];
}

function readPicked(item: Json): PickedRow[] {
  const row = readRecord(item);
  const pickId = readNumber(row?.pick_id);
  const lineId = readNumber(row?.line_id);
  const orderId = readString(row?.order_id);
  const binId = readNumber(row?.bin_id);
  const part = readPart(row?.part);
  if (!row || pickId == null || lineId == null || !orderId || binId == null || !part) return [];
  const reason = readString(row.reason);
  return [
    {
      pickId,
      lineId,
      orderId,
      order: readString(row.order) ?? '',
      customer: readString(row.customer),
      urgent: readBoolean(row.urgent) ?? false,
      part,
      binId,
      bin: readString(row.bin) ?? '',
      qty: readNumber(row.qty) ?? 0,
      short: readNumber(row.short) ?? 0,
      reason: isReason(reason) ? reason : null,
      pickedAt: readString(row.picked_at) ?? '',
      pickedBy: readString(row.picked_by),
      method: readMethod(row.method),
    },
  ];
}

function readPacking(item: Json): PackingOrder[] {
  const row = readRecord(item);
  const orderId = readString(row?.order_id);
  if (!row || !orderId) return [];
  return [
    {
      orderId,
      order: readString(row.order) ?? '',
      customer: readString(row.customer),
      urgent: readBoolean(row.urgent) ?? false,
      units: readNumber(row.units) ?? 0,
      address: readSalesOrderAddress(row.address),
      addressText: readString(row.address_text),
      lines: readArray(row.lines).flatMap((entry) => {
        const line = readRecord(entry);
        const lineId = readNumber(line?.line_id);
        const part = readPart(line?.part);
        return line && lineId != null && part ? [{ lineId, part, qty: readNumber(line.qty) ?? 0 }] : [];
      }),
    },
  ];
}

export function readPickingList(value: Json): PickingList {
  const list = readRecord(value) ?? {};
  const counts = readRecord(list.counts) ?? {};
  const view = readString(list.view);
  const resolved: PickingView = isPickingView(view) ? view : 'to_pick';
  const rows = readArray(list.rows);
  return {
    view: resolved,
    locationId: readNumber(list.location_id),
    orderId: readString(list.order_id),
    orderNumber: readString(list.order),
    locations: readArray(list.locations).flatMap((item) => {
      const row = readRecord(item);
      const id = readNumber(row?.id);
      if (!row || id == null) return [];
      return [{ id, code: readString(row.code) ?? '', name: readString(row.name) ?? '' }];
    }),
    counts: {
      toPick: readNumber(counts.to_pick) ?? 0,
      orders: readNumber(counts.orders) ?? 0,
      notFound: readNumber(counts.not_found) ?? 0,
      toPack: readNumber(counts.to_pack) ?? 0,
      pickedToday: readNumber(counts.picked_today) ?? 0,
    },
    rows: resolved === 'to_pick' || resolved === 'not_found' ? rows.flatMap(readPickingRow) : [],
    picked: resolved === 'picked_today' ? rows.flatMap(readPicked) : [],
    packing: resolved === 'to_pack' ? rows.flatMap(readPacking) : [],
    canPick: readBoolean(list.can_pick) ?? false,
    now: readString(list.now) ?? new Date().toISOString(),
  };
}

export function getPickingList(
  supabase: Client,
  options: { view?: PickingView; locationId?: number | null; orderId?: string | null } = {},
): Promise<PickingList> {
  const p: { [key: string]: Json } = { view: options.view ?? 'to_pick' };
  if (options.locationId != null) p.location_id = options.locationId;
  if (options.orderId) p.order_id = options.orderId;
  return call(supabase.rpc('picking_list', { p }), readPickingList);
}

export type PickResult = { pickId: number; lineId: number; orderId: string; picked: number; short: number };

function readPickResult(value: Json): PickResult {
  const row = readRecord(value) ?? {};
  return {
    pickId: readNumber(row.pick_id) ?? 0,
    lineId: readNumber(row.line_id) ?? 0,
    orderId: readString(row.order_id) ?? '',
    picked: readNumber(row.picked) ?? 0,
    short: readNumber(row.short) ?? 0,
  };
}

// Pick a row: its units from its bin to the shelf. With found less than qty, a short pick with its reason. From a
// phone's pick job (S5b-1): the job, and a scan or a tap with why it couldn't be scanned; each scan of a row adds one
// to the same pick.
export function pickLine(
  supabase: Client,
  pick: {
    lineId: number;
    binId: number;
    qty: number;
    found?: number;
    reason?: ShortPickReason;
    jobId?: string;
    method?: PickMethod;
    cantScan?: CantScanReason;
  },
): Promise<PickResult> {
  const p: { [key: string]: Json } = { line_id: pick.lineId, bin_id: pick.binId, qty: pick.qty };
  if (pick.found != null) p.found = pick.found;
  if (pick.reason) p.reason = pick.reason;
  if (pick.jobId) p.job_id = pick.jobId;
  if (pick.method) p.method = pick.method;
  if (pick.cantScan) p.cant_scan = pick.cantScan;
  return call(supabase.rpc('sales_order_pick', { p }), readPickResult);
}

export function undoPick(supabase: Client, pickId: number): Promise<{ returned: number }> {
  return call(supabase.rpc('sales_order_undo_pick', { p_pick: pickId }), (value) => ({
    returned: readNumber(readRecord(value)?.returned) ?? 0,
  }));
}

export function setOrderUrgent(supabase: Client, orderId: string, urgent: boolean): Promise<void> {
  return call(supabase.rpc('sales_order_set_urgent', { p_id: orderId, p_urgent: urgent }), () => undefined);
}

// ------------------------------------------------------------------------------------------------ the words
// The copy deck (docs/design-checks/fulfilment.md, signed off 25 November 2026).

// Units, the order page's word for the same count (owner, 25 November 2026): "1 unit", "3 units", "1.5 units".
export function unitsCount(qty: number): string {
  return `${quantityWords(qty)} ${qty === 1 ? 'unit' : 'units'}`;
}

// The page's line under its title: "14 units for 6 orders", or "Nothing to pick".
export function pickingSubline(counts: Pick<PickingCounts, 'toPick' | 'orders'>): string {
  if (counts.toPick <= 0) return 'Nothing to pick';
  return `${unitsCount(counts.toPick)} for ${counts.orders} ${counts.orders === 1 ? 'order' : 'orders'}`;
}

// The line under Picking's title, in the open view's own words, so it is always one line high: "20 units for 11
// orders", "1 unit not found", "4 units picked today" (critique round 3: Picked today said To pick's numbers).
export function pickingViewSubline(view: PickingView, counts: PickingCounts): string {
  switch (view) {
    case 'to_pick':
      return counts.toPick > 0 ? pickingSubline(counts) : 'Nothing to pick';
    case 'not_found':
      return counts.notFound > 0 ? `${unitsCount(counts.notFound)} not found` : 'No short picks';
    case 'to_pack':
      return counts.toPack > 0 ? `${counts.toPack} ${counts.toPack === 1 ? 'order' : 'orders'} to pack` : 'Nothing to pack';
    case 'picked_today':
      return counts.pickedToday > 0 ? `${unitsCount(counts.pickedToday)} picked today` : 'Nothing picked today';
  }
}

// A bin as the picker reads it: its code; Unbinned is "Not in a bin"; no bin at all is a part set aside without stock
// (Confirm's In stock here), worded as the order page and the To count list word it (DESIGN.md).
export function binLabel(code: string | null): string {
  if (code == null || code.trim() === '') return 'Set aside without stock';
  return code.trim().toUpperCase() === UNBINNED_CODE ? 'Not in a bin' : code;
}

// A row whose order a picker holds on a phone (S5b-1): "Sam is picking".
export function pickerWords(picker: string): string {
  return `${picker} is picking`;
}

// Where an order to pack goes: "Shipley BD18".
export function packingPlace(order: Pick<PackingOrder, 'address' | 'addressText'>): string {
  return deliveryPlace(order.address, order.addressText);
}

// An order to pack, under its number: "3 units · Shipley BD18".
export function packingOrderLine(order: Pick<PackingOrder, 'units' | 'address' | 'addressText'>): string {
  return [unitsCount(order.units), packingPlace(order)].filter(Boolean).join(' · ');
}

// A part going in the box: "2 × MANN-FILTER C 35 154".
export function packingLineWords(line: Pick<PackingLine, 'part' | 'qty'>): string {
  return `${quantityWords(line.qty)} × ${`${line.part.brand} ${line.part.number}`.trim()}`;
}

// Who a row is for: the customer, or "Cash sale" for an order with none, as the Sales orders list says it.
export function pickingCustomer(customer: string | null): string {
  return customer ?? 'Cash sale';
}

// Where a pick came from: "From A12", or "From stock not in a bin" for Unbinned.
export function pickedFromWords(bin: string | null): string {
  return binLabel(bin) === bin ? `From ${bin}` : 'From stock not in a bin';
}

// "MINTEX MDC1705 (Brake disc, vented)".
export function pickRowPart(part: PickingPart): string {
  const name = `${part.brand} ${part.number}`.trim();
  return part.description ? `${name} (${part.description})` : name;
}

export type PickingGroup = { key: string; label: string; urgent: boolean; rows: PickingRow[]; qty: number };

// Urgent orders first as one group, then one group per bin, in the order the database walked them.
export function groupPickingRows(rows: readonly PickingRow[]): PickingGroup[] {
  const groups: PickingGroup[] = [];
  const byKey = new Map<string, PickingGroup>();
  for (const row of rows) {
    const key = row.urgent ? 'urgent' : `bin:${row.bin == null ? '' : row.bin.toUpperCase()}`;
    let group = byKey.get(key);
    if (!group) {
      group = { key, label: row.urgent ? 'Urgent' : binLabel(row.bin), urgent: row.urgent, rows: [], qty: 0 };
      byKey.set(key, group);
      groups.push(group);
    }
    group.rows.push(row);
    group.qty += row.qty;
  }
  return groups;
}

// A group's header: "Urgent · 2 units", "A12 · 3 units", "Not in a bin · 1 unit".
export function pickingGroupWords(group: Pick<PickingGroup, 'label' | 'qty'>): string {
  return `${group.label} · ${unitsCount(group.qty)}`;
}

// The Short pick window's line: "MINTEX MDC1705 · A12 · 2 to pick".
export function shortPickLine(row: { part: PickingPart; bin: string | null; qty: number }): string {
  return `${`${row.part.brand} ${row.part.number}`.trim()} · ${binLabel(row.bin)} · ${quantityWords(row.qty)} to pick`;
}

// The toast after Pick or Short pick's Save.
export function pickedToastWords(result: Pick<PickResult, 'short'>): string {
  return result.short > 0 ? 'Short pick saved' : 'Part picked';
}

// Where a short pick looked: " in A12", or " · Not in a bin" for stock not yet put away.
function lookedIn(bin: string | null): string {
  const label = binLabel(bin);
  return label === bin ? ` in ${label}` : ` · ${label}`;
}

// A failure that stays beside the row until the next try (the toast fades): "Not picked · Check the connection, then
// try again.", and the same for Undo. Approved by the owner, 25 November 2026.
export function pickFailedLine(reason: string): string {
  return `Not picked · ${reason}`;
}
export function undoFailedLine(reason: string): string {
  return `Not undone · ${reason}`;
}

// Short pick's line when the count isn't short: "Up to 3. For all 4, use Pick." (owner, 25 November 2026). A row of one
// has nothing between none and all: "If it's here, use Pick." (critique round 3: "For all 1" read oddly).
export function shortPickTooMany(qty: number): string {
  return qty > 1 ? `Up to ${quantityWords(qty - 1)}. For all ${quantityWords(qty)}, use Pick.` : "If it's here, use Pick.";
}

// What is wrong with the Here box, or null when Save can take it. An empty box waits for a number and says nothing
// (critique round 2); each other mistake gets its own line, not "Up to 3" for all of them (critique round 3).
export function shortPickProblem(typed: string, qty: number): string | null {
  const text = typed.trim();
  if (text === '') return null;
  const n = Number(text);
  if (!Number.isFinite(n)) return 'Type a number.';
  if (n < 0) return "Can't be below 0.";
  if (!Number.isInteger(Math.round(n * 1e6) / 1e3)) return 'Up to 3 decimal places.';
  if (n >= qty) return shortPickTooMany(qty);
  return null;
}

// A row set aside without stock (nothing in a bin to pick) points to the To count list (owner, 25 November 2026).
export const COUNT_FIRST = 'Count first';
export const COUNT_FIRST_HREF = '/stock-counts#count-requests';

// A short pick still open, on the row: "1 not found in A12 · Bin empty". Given now, it also says when it was flagged
// ("· today 05:40"), so a short pick left open shows its age (critique round 3).
export function notFoundWords(notFound: Pick<NotFound, 'qty' | 'bin' | 'reason'> & { at?: string | null }, now?: string): string {
  return `${quantityWords(notFound.qty)} not found${lookedIn(notFound.bin)} · ${SHORT_PICK_REASON_LABELS[notFound.reason]}${since(notFound.at, now)}`;
}

function since(at: string | null | undefined, now: string | undefined): string {
  const when = at && now ? dayAndTime(at, now) : '';
  return when ? ` · ${when}` : '';
}

// A Bin empty short pick asked for a count of that bin (owner, 25 November 2026): the row and the order's need link to
// To count with this.
export const COUNT_BIN = 'Count bin';

// The same on the order page's need row, naming the part: "1 MINTEX MDC1705 not found in A12 · Bin empty · today 05:40".
export function orderNotFoundWords(
  part: { brand: string; number: string },
  notFound: Pick<NotFound, 'qty' | 'bin' | 'reason'> & { at?: string | null },
  now?: string,
): string {
  return `${quantityWords(notFound.qty)} ${`${part.brand} ${part.number}`.trim()} not found${lookedIn(notFound.bin)} · ${SHORT_PICK_REASON_LABELS[notFound.reason]}${since(notFound.at, now)}`;
}

// What an empty view holds.
export function pickingEmptyWords(view: PickingView): string {
  switch (view) {
    case 'to_pick':
      return 'Nothing to pick. Confirmed orders with stock set aside appear here.';
    case 'not_found':
      return 'No short picks. Parts not found in their bin appear here.';
    case 'to_pack':
      return 'Nothing to pack. Deliveries appear here once every part is picked.';
    case 'picked_today':
      return 'Nothing picked today. Parts picked to the shelf appear here.';
  }
}

// The printed pick list's title, in UK time: "Pick list · Leeds · 22 Nov 2026 14:05".
export function pickListTitle(location: string | null, at: string, order: string | null = null): string {
  const then = new Date(at);
  const when = Number.isNaN(then.getTime())
    ? ''
    : `${new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, day: 'numeric', month: 'short', year: 'numeric' }).format(then)} ${new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(then)}`;
  // One order printed alone names it: "Pick list · SO-000021 · Leeds · …" (critique round 3).
  return ['Pick list', order, location, when].filter(Boolean).join(' · ');
}

// The order's history lines for picking, or null for an event that is not picking's.
export function pickingEventText(event: string, detail: JsonRecord): string | null {
  const num = (key: string) => (typeof detail[key] === 'number' ? (detail[key] as number) : 0);
  const text = (key: string) => (typeof detail[key] === 'string' ? (detail[key] as string) : '');
  switch (event) {
    case 'picked': {
      const reason = text('reason');
      const short = num('short') > 0 && isReason(reason) ? `${quantityWords(num('short'))} not found · ${SHORT_PICK_REASON_LABELS[reason]}` : '';
      // Nothing found says only that, where (critique round 4: "× 0 picked from A-01, 1 not found").
      if (num('qty') <= 0 && short) return `${text('part')}: ${short.replace(' not found', ` not found${lookedIn(text('bin') || null)}`)}.`;
      const from = text('bin') ? ` ${pickedFromWords(text('bin')).replace(/^From/, 'from')}` : '';
      // A phone pick that couldn't be scanned says why (owner, 21 November 2026: the reason is logged).
      const cant = text('cant_scan');
      const tapped = text('method') === 'tap' && (CANT_SCAN_REASONS as readonly string[]).includes(cant)
        ? ` without a scan: ${CANT_SCAN_REASON_LABELS[cant as CantScanReason].toLowerCase()}`
        : '';
      return `${text('part')} × ${quantityWords(num('qty'))} picked${from}${tapped}${short ? `, ${short}` : ''}.`;
    }
    case 'pick_undone':
      // A short pick that moved nothing is undone as such, not "0 back in the bin".
      return num('qty') > 0 ? `Pick undone: ${quantityWords(num('qty'))} back in the bin.` : num('short') > 0 ? 'Short pick undone.' : 'Pick undone.';
    case 'marked_urgent':
      return 'Marked urgent.';
    case 'not_urgent':
      return 'No longer urgent.';
    default:
      return null;
  }
}
