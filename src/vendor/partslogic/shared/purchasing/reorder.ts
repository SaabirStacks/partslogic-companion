import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { DataError, dataError } from '../core/errors';
import { readArray, readBoolean, readNumber, readRecord, readString } from '../core/read';
import { readOffers, type SupplierOffer } from './catalogue';
import { readOrdersTouched, type OrdersTouched } from './orders';

// Reorder into orders (step 4): what each location needs, who to order it from, and approved lines onto drafts.
// Every rule lives in SQL (purchasing.reorder_lines and its entry points); this file shapes what is sent and read.
// Nothing here places an order: lines only ever go onto drafts.

// Why a supplier was chosen: the part's preferred supplier; the cheapest, with none preferred; the cheapest because
// the preferred one is on hold or no longer lists the part; or nobody lists it, so the order is raised by hand.
export type SupplierReason = 'preferred' | 'cheapest' | 'preferred_unavailable' | 'no_price';

const REASONS = new Set<string>(['preferred', 'cheapest', 'preferred_unavailable', 'no_price']);

function readReason(value: Json | undefined): SupplierReason {
  const reason = readString(value);
  return reason && REASONS.has(reason) ? (reason as SupplierReason) : 'no_price';
}

// One part at one location. Needed when on hand + on order + on draft orders is at or below the minimum; the
// quantity then tops it up to the maximum, rounded up to the supplier's pack and minimum. When nothing is needed,
// it is one pack, for ordering by hand.
export type ReorderLine = {
  partId: number;
  locationId: number;
  onHand: number;
  onOrder: number;
  onDrafts: number;
  minQty: number | null;
  maxQty: number | null;
  needed: boolean;
  suggestedQty: number;
  supplierId: number | null;
  supplier: string | null;
  supplierReason: SupplierReason;
  unitCost: number | null;
  packQty: number;
  minOrderQty: number | null;
  // The line's supplier marks the part "while stocks last". Set by the web's reorder list (listEndingLines); the
  // database's reorder rows, which the phone and the reports API also read, don't carry it.
  ending?: boolean;
  // The location's name ("Leeds branch") and what is due at it (the first date, and how many are past their date),
  // set by the web's reorder list from listLocations and part_stock_glance; the database's reorder rows don't carry them.
  locationName?: string;
  onOrderDue?: string | null;
  onOrderLate?: number;
};

// A line of the reorder list: a part that needs ordering, with what the Stock list shows of it.
export type ReorderSuggestion = ReorderLine & {
  brand: string;
  number: string;
  name: string | null;
  locationCode: string;
};

// The part modal's Order: each location, the preferred supplier and every supplier's offer.
export type PartReorder = {
  partId: number;
  preferredSupplierId: number | null;
  locations: (ReorderLine & { code: string; name: string })[];
  offers: SupplierOffer[];
};

// A line to put on a draft. Its supplier's draft for the location is added to, or a new one made.
export type ReorderOrderLine = {
  locationId: number;
  supplierId: number;
  partId: number;
  qty: number;
};

function readLine(row: Record<string, Json | undefined>): ReorderLine | null {
  const partId = readNumber(row.part_id);
  const locationId = readNumber(row.location_id);
  if (partId == null || locationId == null) return null;
  return {
    partId,
    locationId,
    onHand: readNumber(row.on_hand) ?? 0,
    onOrder: readNumber(row.on_order) ?? 0,
    onDrafts: readNumber(row.on_drafts) ?? 0,
    minQty: readNumber(row.min_qty ?? row.reorder_level),
    maxQty: readNumber(row.max_qty ?? row.max_level),
    needed: readBoolean(row.needed) ?? true,
    suggestedQty: readNumber(row.suggested_qty) ?? 1,
    supplierId: readNumber(row.supplier_id),
    supplier: readString(row.supplier ?? row.best_source),
    supplierReason: readReason(row.supplier_reason),
    unitCost: readNumber(row.unit_cost ?? row.best_cost),
    packQty: Math.max(readNumber(row.pack_qty) ?? 1, 1),
    minOrderQty: readNumber(row.min_order_qty),
  };
}

// Every part and location that needs reordering, grouped by supplier, then location. Optionally one location.
export async function listReorderSuggestions(
  supabase: Client,
  query: { locationId?: number | null; partId?: number | null } = {},
): Promise<ReorderSuggestion[]> {
  const { data, error } = await supabase.rpc('reorder_suggestions', {
    p_location: query.locationId ?? undefined,
    p_part: query.partId ?? undefined,
  });
  if (error) throw dataError(error);
  return (data ?? []).flatMap((row) => {
    const line = readLine(row as Record<string, Json | undefined>);
    if (!line || row.brand == null || row.number == null || row.location_code == null) return [];
    return [
      {
        ...line,
        brand: row.brand,
        number: row.number,
        name: row.name ?? null,
        locationCode: row.location_code,
      },
    ];
  });
}

export function readPartReorder(data: Json): PartReorder {
  const row = readRecord(data);
  const partId = readNumber(row?.part_id);
  if (!row || partId == null) throw new DataError('That part could not be read.', 'P0002');
  return {
    partId,
    preferredSupplierId: readNumber(row.preferred_supplier_id),
    locations: readArray(row.locations).flatMap((item) => {
      const location = readRecord(item);
      // Each location is the part's own, so it doesn't repeat the part id.
      const line = location ? readLine({ ...location, part_id: partId }) : null;
      if (!location || !line) return [];
      return [
        {
          ...line,
          code: readString(location.code) ?? '',
          name: readString(location.name) ?? '',
        },
      ];
    }),
    offers: readOffers(row.offers),
  };
}

export async function getPartReorder(supabase: Client, partId: number): Promise<PartReorder> {
  const { data, error } = await supabase.rpc('part_reorder', { p_part: partId });
  if (error) throw dataError(error);
  return readPartReorder(data);
}

// Sets the part's preferred supplier, or clears it with null. Returns the part's reorder view.
export async function setPreferredSupplier(
  supabase: Client,
  partId: number,
  supplierId: number | null,
): Promise<PartReorder> {
  const { data, error } = await supabase.rpc('set_preferred_supplier', {
    p_part: partId,
    p_supplier: supplierId as number,
  });
  if (error) throw dataError(error);
  return readPartReorder(data);
}

// Approved lines onto drafts: one per supplier and location, added to if one exists. Returns the drafts touched.
export async function addReorderLines(supabase: Client, lines: ReorderOrderLine[]): Promise<OrdersTouched> {
  const { data, error } = await supabase.rpc('add_reorder_lines', {
    p_lines: lines.map((line) => ({
      location_id: line.locationId,
      supplier_id: line.supplierId,
      part_id: line.partId,
      qty: line.qty,
    })),
  });
  if (error) throw dataError(error);
  return readOrdersTouched(data as Json);
}

// The suggestions grouped for the reorder list: by supplier (no supplier last), then location.
export type ReorderGroup = {
  supplierId: number | null;
  supplier: string | null;
  lines: ReorderSuggestion[];
};

export function groupReorder(suggestions: ReorderSuggestion[]): ReorderGroup[] {
  const groups = new Map<string, ReorderGroup>();
  for (const line of suggestions) {
    const key = line.supplierId == null ? 'none' : String(line.supplierId);
    const group = groups.get(key) ?? {
      supplierId: line.supplierId,
      supplier: line.supplier,
      lines: [],
    };
    group.lines.push(line);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      lines: [...group.lines].sort(
        (a, b) =>
          a.locationCode.localeCompare(b.locationCode) ||
          a.brand.localeCompare(b.brand) ||
          a.number.localeCompare(b.number),
      ),
    }))
    .sort((a, b) => (a.supplier == null ? 1 : b.supplier == null ? -1 : a.supplier.localeCompare(b.supplier)));
}

// ---------------------------------------------------------------------------------------------- the Reorder window

// One card of the Reorder window (docs/design-checks/reorder-window.md): the lines Create drafts puts on one draft,
// one supplier at one location (add_reorder_lines makes or adds to that draft). Lines no supplier lists share one card,
// last, whatever their location (supplierId and locationId null). Cards run by supplier, then location by name.
export type ReorderDraftGroup = {
  key: string;
  supplierId: number | null;
  supplier: string | null;
  locationId: number | null;
  location: string | null;
  lines: ReorderSuggestion[];
};

const placeOf = (line: Pick<ReorderSuggestion, 'locationName' | 'locationCode'>) => line.locationName ?? line.locationCode;

export function groupReorderByDraft(suggestions: ReorderSuggestion[]): ReorderDraftGroup[] {
  const groups = new Map<string, ReorderDraftGroup>();
  for (const line of suggestions) {
    const listed = line.supplierId != null;
    const key = listed ? `${line.supplierId}:${line.locationId}` : 'none';
    const group = groups.get(key) ?? {
      key,
      supplierId: listed ? line.supplierId : null,
      supplier: listed ? line.supplier : null,
      locationId: listed ? line.locationId : null,
      location: listed ? placeOf(line) : null,
      lines: [],
    };
    group.lines.push(line);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      lines: [...group.lines].sort(
        (a, b) => placeOf(a).localeCompare(placeOf(b)) || a.brand.localeCompare(b.brand) || a.number.localeCompare(b.number),
      ),
    }))
    .sort((a, b) =>
      a.supplierId == null
        ? 1
        : b.supplierId == null
          ? -1
          : (a.supplier ?? '').localeCompare(b.supplier ?? '') || (a.location ?? '').localeCompare(b.location ?? ''),
    );
}

// Why the line's supplier, under its cost: "cheapest", "preferred", "Preferred supplier unavailable"; nothing when no
// supplier lists the part.
export const REORDER_REASON_WORDS: Readonly<Record<SupplierReason, string | null>> = {
  preferred: 'preferred',
  cheapest: 'cheapest',
  preferred_unavailable: 'Preferred supplier unavailable',
  no_price: null,
};

// The levels under Available: "min 2 · fill up to 6", "min 2" with no fill-up level, null with neither.
export function reorderLevelWords(minQty: number | null, maxQty: number | null): string | null {
  const parts = [minQty == null ? null : `min ${minQty}`, maxQty == null ? null : `fill up to ${maxQty}`].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

// Under the quantity: the supplier's pack and minimum order, when it sets them ("pack of 6", "min order 10").
export function reorderPackWords(packQty: number, minOrderQty: number | null): string | null {
  const parts = [packQty > 1 ? `pack of ${packQty}` : null, minOrderQty != null && minOrderQty > 1 ? `min order ${minOrderQty}` : null];
  const said = parts.filter(Boolean);
  return said.length ? said.join(' · ') : null;
}

// "1 line", "9 lines".
export function reorderLinesWord(count: number): string {
  return `${count} ${count === 1 ? 'line' : 'lines'}`;
}

// The level bar beside Available: the line's own figures laid end to end (what can be sold, what is on order, what is
// already on drafts, then this order, or "left out" when the line is unticked), each as a share of the bar, with the
// minimum as a mark. The bar spans the fill-up level, or more when the figures pass it. It draws figures the database
// worked out; it decides nothing.
export type ReorderLevelKind = 'available' | 'onOrder' | 'onDrafts' | 'thisOrder' | 'leftOut';
export type ReorderLevel = {
  parts: { kind: ReorderLevelKind; qty: number; share: number }[];
  minAt: number | null;
  label: string;
};

export function reorderLevel(input: {
  available: number;
  onOrder: number;
  onDrafts: number;
  qty: number;
  included: boolean;
  minQty: number | null;
  maxQty: number | null;
}): ReorderLevel {
  const clean = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);
  const figures: [ReorderLevelKind, number][] = [
    ['available', clean(input.available)],
    ['onOrder', clean(input.onOrder)],
    ['onDrafts', clean(input.onDrafts)],
    [input.included ? 'thisOrder' : 'leftOut', clean(input.qty)],
  ];
  const total = figures.reduce((sum, [, qty]) => sum + qty, 0);
  const scale = Math.max(total, clean(input.maxQty ?? 0), clean(input.minQty ?? 0), 1);
  const words: Record<ReorderLevelKind, (qty: number) => string> = {
    available: (qty) => `${qty} available`,
    onOrder: (qty) => `${qty} on order`,
    onDrafts: (qty) => `${qty} on drafts`,
    thisOrder: (qty) => `ordering ${qty}`,
    leftOut: (qty) => `${qty} left out`,
  };
  const said = figures.filter(([kind, qty]) => qty > 0 || kind === 'available').map(([kind, qty]) => words[kind](qty));
  if (input.minQty != null) said.push(`minimum ${input.minQty}`);
  if (input.maxQty != null) said.push(`fill up to ${input.maxQty}`);
  return {
    parts: figures.filter(([, qty]) => qty > 0).map(([kind, qty]) => ({ kind, qty, share: qty / scale })),
    minAt: input.minQty == null ? null : Math.min(clean(input.minQty) / scale, 1),
    label: said.join(', '),
  };
}

// A supplier in the Reorder window's cost menu: "preferred" (the part's preferred supplier), else "cheapest" (the
// lowest cost among the suppliers that can be ordered from now, as the reorder list picks), else "On hold" for one that
// can't be chosen ("preferred · On hold" when it is the preferred one); null for the rest.
export function reorderOfferNote(
  offer: Pick<SupplierOffer, 'supplierId' | 'cost' | 'usable' | 'status'>,
  offers: readonly Pick<SupplierOffer, 'supplierId' | 'cost' | 'usable' | 'status'>[],
  preferredSupplierId: number | null,
): string | null {
  const choosable = (item: Pick<SupplierOffer, 'usable' | 'status'>) => item.usable && item.status === 'active';
  if (!choosable(offer)) {
    if (offer.status !== 'on_hold') return null;
    return offer.supplierId === preferredSupplierId ? 'preferred · On hold' : 'On hold';
  }
  if (offer.supplierId === preferredSupplierId) return 'preferred';
  const cheapest = offers.filter(choosable).reduce<number | null>((low, item) => (low == null || item.cost < low ? item.cost : low), null);
  return cheapest != null && offer.cost === cheapest ? 'cheapest' : null;
}

// What is wrong with a typed quantity, in the words under the box, or null when it can go on a draft: a whole number
// above 0 and at most 99,999, in whole packs and at least the supplier's minimum order. The database checks the same
// on the draft; this says it before anything is sent. "1,000" reads as 1000.
export const REORDER_MAX_QTY = 99_999;

export function reorderQtyProblem(typed: string, packQty: number, minOrderQty: number | null): string | null {
  const text = typed.replace(/[\s,]/g, '');
  const qty = Number(text);
  if (text === '') return 'Enter more than 0';
  if (!Number.isFinite(qty)) return 'Enter a whole number';
  if (qty <= 0) return 'Enter more than 0';
  if (!/^\d+$/.test(text)) return 'Enter a whole number';
  if (qty > REORDER_MAX_QTY) return 'Enter 99,999 or less';
  if (packQty > 1 && qty % packQty !== 0) return `Order in packs of ${packQty}`;
  if (minOrderQty != null && minOrderQty > 1 && qty < minOrderQty) return `Order at least ${minOrderQty}`;
  return null;
}

// The quantity as a number, once reorderQtyProblem has passed it.
export function reorderQty(typed: string): number {
  return Number(typed.replace(/[\s,]/g, ''));
}

// The quantity a line is priced at: a whole number from 1 to 99,999, even one its supplier's pack or minimum order won't
// take (the total says what was typed while Create drafts waits); null for anything else, so the line shows "—", not
// £0.00.
export function reorderPricedQty(typed: string): number | null {
  const text = typed.replace(/[\s,]/g, '');
  if (!/^\d+$/.test(text)) return null;
  const qty = Number(text);
  return qty > 0 && qty <= REORDER_MAX_QTY ? qty : null;
}

// The Reorder window's location after a read: the one chosen while it still has lines, else every location (a filter
// kept across opens must never leave the window empty with no way back). "all" is every location.
export function reorderLocationAfterRead(chosen: string, lines: readonly Pick<ReorderSuggestion, 'locationId'>[]): string {
  if (chosen === 'all') return chosen;
  return lines.some((line) => String(line.locationId) === chosen) ? chosen : 'all';
}
