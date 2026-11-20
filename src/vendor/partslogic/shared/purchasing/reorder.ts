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
