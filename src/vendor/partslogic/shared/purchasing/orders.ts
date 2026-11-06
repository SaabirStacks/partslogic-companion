import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { DataError, dataError } from '../core/errors';
import type { Page } from '../core/page';
import { readArray, readBoolean, readNumber, readRecord, readString, readStrings, type JsonRecord } from '../core/read';
import { readDeliveryTerms, readNextDelivery, type DeliveryTerms, type NextDelivery } from './delivery-terms';
import { isPlacedVia, type PlacedVia } from './placed-via';
import { isSupplierStatus, type SupplierStatus } from './suppliers';

export { PLACED_VIA, isPlacedVia, type PlacedVia } from './placed-via';

// Purchase orders: one supplier each, lines from the supplier catalogue, an order reference and a reference per line
// (STOCK, a registration, a customer or a garage), vehicles, the catalogue price as stated beside the agreed one.
// Every rule lives in SQL (public.purchase_order_*, docs/PURCHASE_ORDERS.md); this file shapes what is sent and read.

export const PURCHASE_ORDER_STATUSES = ['draft', 'placed', 'part_received', 'received', 'closed_short', 'cancelled'] as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];
// The reference most orders carry: bought for the shelf, not for one job.
export const STOCK_REFERENCE = 'STOCK';

export function isPurchaseOrderStatus(value: unknown): value is PurchaseOrderStatus {
  return typeof value === 'string' && (PURCHASE_ORDER_STATUSES as readonly string[]).includes(value);
}

// Why a line or an order needs a look. None of them stops the order.
export type LineWarning =
  | 'not_on_sheet'
  | 'not_multiple'
  | 'below_minimum'
  | 'price_differs'
  | 'sheet_changed'
  | 'does_not_fit';
export type OrderWarning =
  | 'supplier_on_hold'
  | 'supplier_archived'
  | 'no_delivery_address'
  | 'delivered_to_registered_office'
  | 'company_details_missing'
  | 'below_minimum_order';

export type OrderAddress = { lines: string; town: string | null; county: string | null; postcode: string | null };

export type PurchaseOrderLine = {
  id: number;
  lineNo: number;
  partId: number;
  brand: string;
  number: string;
  supplierCode: string | null;
  description: string | null;
  qty: number;
  unitCost: number;
  // The supplier's price as stated when the line was added; null when they don't list the part.
  catalogueCost: number | null;
  // Their price today; null when they no longer list it.
  currentCost: number | null;
  surcharge: number | null;
  reference: string | null;
  lineTotal: number;
  // What today's sheet says about ordering it.
  packQty: number;
  minQty: number | null;
  centralMinQty: number | null;
  boxQty: number | null;
  unit: string | null;
  // Against each of the order's vehicles from the catalogue: confirmed, via_oe, via_alternative, does_not_fit, unknown.
  fits: { vehicle: number; verdict: string }[];
  warnings: LineWarning[];
};

export type PurchaseOrderVehicle = {
  id: number;
  registration: string | null;
  vin: string | null;
  vehicleId: number | null;
  // "VW GOLF VI 1.6 TDI 2009–2012" when it is a vehicle from the catalogue.
  vehicle: string | null;
  label: string | null;
};

export type OrderTotals = {
  lines: number;
  goods: number;
  surcharges: number;
  carriage: number;
  net: number;
  vatRate: number;
  vat: number;
  gross: number;
  currency: string;
};

export type LineProgress = { lineId: number; ordered: number; received: number; closed: number; due: number };

export type OrderEvent = { event: string; detail: JsonRecord; at: string; by: string };

export type PurchaseOrderDetail = {
  id: string;
  number: string;
  status: PurchaseOrderStatus;
  origin: string;
  // Ours: who the order is for. Theirs: the supplier's order number.
  ourReference: string | null;
  reference: string | null;
  notes: string | null;
  supplierNotes: string | null;
  carriage: number;
  // A draft's carriage follows the supplier's terms until someone types one.
  carriageAuto: boolean;
  // On a draft: how much more goods would make delivery free; null when it is free or has no free-delivery value.
  freeDeliveryShort: number | null;
  expectedOn: string | null;
  // The van it should come on and its window ("Afternoon van", "13:00", "15:00"), kept when it was placed.
  expectedRun: string | null;
  expectedFrom: string | null;
  expectedBy: string | null;
  // The supplier's terms, and on a draft the next cut-off.
  delivery: DeliveryTerms;
  nextDelivery: NextDelivery | null;
  // Per line: ordered, received, closed short and still due.
  progress: LineProgress[];
  createdAt: string;
  createdBy: string;
  placedAt: string | null;
  placedBy: string | null;
  placedVia: PlacedVia | null;
  placedWith: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  closedShortAt: string | null;
  closedShortReason: string | null;
  // The goods receipts that filled it, oldest first.
  receipts: OrderReceipt[];
  supplier: {
    id: number;
    name: string;
    status: SupplierStatus;
    accountNumber: string | null;
    address: OrderAddress | null;
    contact: { name: string; email: string | null; phone: string | null } | null;
  };
  location: { id: number; code: string; name: string } | null;
  deliverTo: (OrderAddress & { name: string | null; registeredOffice: boolean }) | null;
  vehicles: PurchaseOrderVehicle[];
  lines: PurchaseOrderLine[];
  totals: OrderTotals;
  warnings: OrderWarning[];
  history: OrderEvent[];
  can: { edit: boolean; place: boolean; cancel: boolean; delete: boolean; receive: boolean; closeShort: boolean };
};

export type OrderReceipt = { id: string; number: string; at: string; deliveryNote: string | null; units: number };

export type PurchaseOrderRow = {
  id: string;
  number: string;
  status: PurchaseOrderStatus;
  supplierId: number;
  supplier: string;
  locationCode: string | null;
  ourReference: string | null;
  reference: string | null;
  lines: number;
  netTotal: number;
  registrations: string[];
  createdAt: string;
  placedAt: string | null;
};

export type PurchaseOrderQuery = {
  status?: PurchaseOrderStatus;
  supplierId?: number;
  locationId?: number;
  search?: string;
  limit?: number;
  offset?: number;
};

export type NewOrderLine = { partId: number; qty?: number; unitCost?: number; reference?: string | null };
export type CatalogueOrderLine = NewOrderLine & { supplierId: number };
export type OrderLineChanges = {
  qty?: number;
  unitCost?: number;
  description?: string | null;
  reference?: string | null;
  // Takes the supplier's price today as both the catalogue price and the agreed one.
  useCurrentPrice?: boolean;
};
export type OrderChanges = {
  reference?: string | null;
  ourReference?: string | null;
  notes?: string | null;
  supplierNotes?: string | null;
  carriage?: number;
  // Hands a draft's carriage back to the supplier's terms.
  carriageAuto?: true;
  expectedOn?: string | null;
  locationId?: number;
};
export type OrderVehicleInput = {
  id?: number;
  registration?: string | null;
  vin?: string | null;
  vehicleId?: number | null;
  label?: string | null;
};
export type PlaceOrderInput = {
  via: PlacedVia;
  reference?: string | null;
  placedWith?: string | null;
  // Prices confirmed or quoted when it was placed.
  prices?: { lineId: number; unitCost: number }[];
  // What the portal or the person charged; otherwise the order's carriage stands.
  carriage?: number;
  // A date the supplier gave; otherwise it is worked out from their delivery runs.
  expectedOn?: string | null;
};
export type OrdersTouched = { id: string; number: string; supplier: string; lines: number }[];
export type VehicleOption = { vehicleId: number; ktype: number | null; label: string; score: number };

const LINE_WARNINGS: readonly LineWarning[] = ['not_on_sheet', 'not_multiple', 'below_minimum', 'price_differs', 'sheet_changed', 'does_not_fit'];
const ORDER_WARNINGS: readonly OrderWarning[] = [
  'supplier_on_hold',
  'supplier_archived',
  'no_delivery_address',
  'delivered_to_registered_office',
  'company_details_missing',
  'below_minimum_order',
];

function readAddress(value: Json | undefined): OrderAddress | null {
  const row = readRecord(value);
  const lines = readString(row?.lines);
  if (!row || !lines) return null;
  return { lines, town: readString(row.town), county: readString(row.county), postcode: readString(row.postcode) };
}

function readLine(value: Json): PurchaseOrderLine | null {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  const partId = readNumber(row?.part_id);
  const qty = readNumber(row?.qty);
  const unitCost = readNumber(row?.unit_cost);
  if (!row || id == null || partId == null || qty == null || unitCost == null) return null;
  return {
    id,
    lineNo: readNumber(row.line_no) ?? 0,
    partId,
    brand: readString(row.brand) ?? '',
    number: readString(row.number) ?? '',
    supplierCode: readString(row.supplier_code),
    description: readString(row.description),
    qty,
    unitCost,
    catalogueCost: readNumber(row.catalogue_cost),
    currentCost: readNumber(row.current_cost),
    surcharge: readNumber(row.surcharge),
    reference: readString(row.reference),
    lineTotal: readNumber(row.line_total) ?? Math.round(qty * unitCost * 100) / 100,
    packQty: Math.max(readNumber(row.pack_qty) ?? 1, 1),
    minQty: readNumber(row.min_qty),
    centralMinQty: readNumber(row.central_min_qty),
    boxQty: readNumber(row.box_qty),
    unit: readString(row.unit),
    fits: readArray(row.fits).flatMap((item) => {
      const fit = readRecord(item);
      const vehicle = readNumber(fit?.vehicle);
      return fit && vehicle != null ? [{ vehicle, verdict: readString(fit.verdict) ?? 'unknown' }] : [];
    }),
    warnings: readStrings(row.warnings).filter((item): item is LineWarning => (LINE_WARNINGS as readonly string[]).includes(item)),
  };
}

function readProgress(value: Json): LineProgress | null {
  const row = readRecord(value);
  const lineId = readNumber(row?.line_id);
  if (!row || lineId == null) return null;
  const ordered = readNumber(row.ordered) ?? 0;
  return {
    lineId,
    ordered,
    received: readNumber(row.received) ?? 0,
    closed: readNumber(row.closed) ?? 0,
    due: readNumber(row.due) ?? ordered,
  };
}

function readVehicle(value: Json): PurchaseOrderVehicle | null {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  if (!row || id == null) return null;
  return {
    id,
    registration: readString(row.registration),
    vin: readString(row.vin),
    vehicleId: readNumber(row.vehicle_id),
    vehicle: readString(row.vehicle),
    label: readString(row.label),
  };
}

function readTotals(value: Json | undefined): OrderTotals {
  const row = readRecord(value);
  const n = (key: string) => readNumber(row?.[key]) ?? 0;
  return {
    lines: n('lines'),
    goods: n('goods'),
    surcharges: n('surcharges'),
    carriage: n('carriage'),
    net: n('net'),
    vatRate: n('vat_rate'),
    vat: n('vat'),
    gross: n('gross'),
    currency: readString(row?.currency) ?? 'GBP',
  };
}

export function readPurchaseOrder(value: Json | null | undefined): PurchaseOrderDetail {
  const row = readRecord(value ?? undefined);
  const id = readString(row?.document_id);
  const number = readString(row?.number);
  const status = readString(row?.status);
  const supplier = readRecord(row?.supplier);
  const supplierId = readNumber(supplier?.id);
  if (!row || !id || !number || !isPurchaseOrderStatus(status) || !supplier || supplierId == null) {
    throw new DataError('The purchase order could not be read.', 'P0002');
  }
  const contact = readRecord(supplier.contact);
  const location = readRecord(row.location);
  const locationId = readNumber(location?.id);
  const deliverTo = readRecord(row.deliver_to);
  const deliverAddress = readAddress(row.deliver_to);
  const via = readString(row.placed_via);
  const supplierStatus = readString(supplier.status);
  const can = readRecord(row.can);
  return {
    id,
    number,
    status,
    origin: readString(row.origin) ?? 'manual',
    ourReference: readString(row.our_reference),
    reference: readString(row.reference),
    notes: readString(row.notes),
    supplierNotes: readString(row.supplier_notes),
    carriage: readNumber(row.carriage) ?? 0,
    carriageAuto: readBoolean(row.carriage_auto) ?? false,
    freeDeliveryShort: readNumber(row.free_delivery_short),
    expectedOn: readString(row.expected_on),
    expectedRun: readString(row.expected_run),
    expectedFrom: readString(row.expected_from),
    expectedBy: readString(row.expected_by),
    delivery: readDeliveryTerms(row.delivery),
    nextDelivery: readNextDelivery(row.next_delivery),
    progress: readArray(row.progress).flatMap((item) => readProgress(item) ?? []),
    createdAt: readString(row.created_at) ?? '',
    createdBy: readString(row.created_by) ?? 'Someone',
    placedAt: readString(row.placed_at),
    placedBy: readString(row.placed_by),
    placedVia: isPlacedVia(via) ? via : null,
    placedWith: readString(row.placed_with),
    cancelledAt: readString(row.cancelled_at),
    cancelReason: readString(row.cancel_reason),
    closedShortAt: readString(row.closed_short_at),
    closedShortReason: readString(row.closed_short_reason),
    receipts: readArray(row.receipts).flatMap((item) => {
      const receipt = readRecord(item);
      const receiptId = readString(receipt?.document_id);
      const receiptNumber = readString(receipt?.number);
      if (!receipt || !receiptId || !receiptNumber) return [];
      return [{ id: receiptId, number: receiptNumber, at: readString(receipt.at) ?? '', deliveryNote: readString(receipt.delivery_note), units: readNumber(receipt.units) ?? 0 }];
    }),
    supplier: {
      id: supplierId,
      name: readString(supplier.name) ?? '',
      status: isSupplierStatus(supplierStatus) ? supplierStatus : 'active',
      accountNumber: readString(supplier.account_number),
      address: readAddress(supplier.address),
      contact: contact && readString(contact.name)
        ? { name: readString(contact.name) ?? '', email: readString(contact.email), phone: readString(contact.phone) }
        : null,
    },
    location: location && locationId != null
      ? { id: locationId, code: readString(location.code) ?? '', name: readString(location.name) ?? '' }
      : null,
    deliverTo: deliverTo && deliverAddress
      ? { ...deliverAddress, name: readString(deliverTo.name), registeredOffice: readBoolean(deliverTo.registered_office) ?? false }
      : null,
    vehicles: readArray(row.vehicles).flatMap((item) => readVehicle(item) ?? []),
    lines: readArray(row.lines).flatMap((item) => readLine(item) ?? []),
    totals: readTotals(row.totals),
    warnings: readStrings(row.warnings).filter((item): item is OrderWarning => (ORDER_WARNINGS as readonly string[]).includes(item)),
    history: readArray(row.history).flatMap((item) => {
      const event = readRecord(item);
      const name = readString(event?.event);
      if (!event || !name) return [];
      return [{ event: name, detail: readRecord(event.detail) ?? {}, at: readString(event.at) ?? '', by: readString(event.by) ?? 'Someone' }];
    }),
    can: {
      edit: readBoolean(can?.edit) ?? false,
      place: readBoolean(can?.place) ?? false,
      cancel: readBoolean(can?.cancel) ?? false,
      delete: readBoolean(can?.delete) ?? false,
      receive: readBoolean(can?.receive) ?? false,
      closeShort: readBoolean(can?.close_short) ?? false,
    },
  };
}

function lineJson(line: NewOrderLine & { supplierId?: number }): Record<string, Json> {
  const out: Record<string, Json> = { part_id: line.partId };
  if (line.supplierId != null) out.supplier_id = line.supplierId;
  if (line.qty != null) out.qty = line.qty;
  if (line.unitCost != null) out.unit_cost = line.unitCost;
  if (line.reference != null) out.reference = line.reference;
  return out;
}

async function call<T>(work: PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>, read: (data: Json) => T): Promise<T> {
  const { data, error } = await work;
  if (error) throw dataError(error);
  return read(data as Json);
}

export async function listPurchaseOrders(supabase: Client, query: PurchaseOrderQuery = {}): Promise<Page<PurchaseOrderRow>> {
  const limit = query.limit ?? 25;
  const offset = query.offset ?? 0;
  const { data, error } = await supabase.rpc('purchase_order_list', {
    p_status: query.status,
    p_source: query.supplierId,
    p_location: query.locationId,
    p_search: query.search?.trim() || undefined,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw dataError(error);
  const rows = (data ?? []).flatMap((row): PurchaseOrderRow[] =>
    isPurchaseOrderStatus(row.status)
      ? [
          {
            id: row.document_id,
            number: row.number,
            status: row.status,
            supplierId: row.source_id,
            supplier: row.supplier,
            locationCode: row.location_code ?? null,
            ourReference: row.our_reference ?? null,
            reference: row.reference ?? null,
            lines: row.lines ?? 0,
            netTotal: readNumber(row.net_total) ?? 0,
            registrations: row.registrations ?? [],
            createdAt: row.created_at,
            placedAt: row.placed_at ?? null,
          },
        ]
      : [],
  );
  return { rows, page: { limit, offset, total: readNumber(data?.[0]?.total_count) ?? 0 } };
}

export async function purchaseOrderCounts(supabase: Client): Promise<Record<PurchaseOrderStatus, number>> {
  return call(supabase.rpc('purchase_order_counts'), (data) => {
    const row = readRecord(data);
    return Object.fromEntries(PURCHASE_ORDER_STATUSES.map((status) => [status, readNumber(row?.[status]) ?? 0])) as Record<PurchaseOrderStatus, number>;
  });
}

export async function getPurchaseOrder(supabase: Client, orderId: string): Promise<PurchaseOrderDetail> {
  return call(supabase.rpc('purchase_order_detail', { p_order: orderId }), readPurchaseOrder);
}

// A new draft. Returns its id.
export async function createPurchaseOrder(
  supabase: Client,
  input: { supplierId: number; locationId: number; ourReference?: string | null },
): Promise<string> {
  return call(
    supabase.rpc('create_purchase_order', {
      p_supplier: input.supplierId,
      p_location: input.locationId,
      p_our_reference: input.ourReference ?? undefined,
    }),
    (data) => {
      if (typeof data !== 'string') throw new DataError('The order was not made.', 'P0002');
      return data;
    },
  );
}

export async function addPurchaseOrderLines(supabase: Client, orderId: string, lines: NewOrderLine[]): Promise<PurchaseOrderDetail> {
  return call(supabase.rpc('add_purchase_order_lines', { p_order: orderId, p_lines: lines.map(lineJson) }), readPurchaseOrder);
}

// The supplier catalogue's Add to order: lines from any suppliers, one order each.
export async function addToOrders(
  supabase: Client,
  input: { locationId: number; lines: CatalogueOrderLine[]; intoNew?: boolean; ourReference?: string | null },
): Promise<OrdersTouched> {
  return call(
    supabase.rpc('add_to_orders', {
      p_location: input.locationId,
      p_lines: input.lines.map(lineJson),
      p_new: input.intoNew ?? false,
      p_our_reference: input.ourReference ?? undefined,
    }),
    (data) =>
      readArray(data).flatMap((item) => {
        const row = readRecord(item);
        const id = readString(row?.document_id);
        const number = readString(row?.number);
        if (!row || !id || !number) return [];
        return [{ id, number, supplier: readString(row.supplier) ?? '', lines: readNumber(row.lines) ?? 0 }];
      }),
  );
}

export async function savePurchaseOrderLine(supabase: Client, lineId: number, changes: OrderLineChanges): Promise<PurchaseOrderDetail> {
  const p: Record<string, Json> = {};
  if (changes.qty !== undefined) p.qty = changes.qty;
  if (changes.unitCost !== undefined) p.unit_cost = changes.unitCost;
  if (changes.description !== undefined) p.description = changes.description;
  if (changes.reference !== undefined) p.reference = changes.reference;
  if (changes.useCurrentPrice) p.use_current_price = true;
  return call(supabase.rpc('save_purchase_order_line', { p_line: lineId, p }), readPurchaseOrder);
}

export async function removePurchaseOrderLine(supabase: Client, lineId: number): Promise<PurchaseOrderDetail> {
  return call(supabase.rpc('remove_purchase_order_line', { p_line: lineId }), readPurchaseOrder);
}

export async function savePurchaseOrder(supabase: Client, orderId: string, changes: OrderChanges): Promise<PurchaseOrderDetail> {
  const p: Record<string, Json> = {};
  const keys: [keyof OrderChanges, string][] = [
    ['reference', 'reference'],
    ['ourReference', 'our_reference'],
    ['notes', 'notes'],
    ['supplierNotes', 'supplier_notes'],
    ['carriage', 'carriage'],
    ['carriageAuto', 'carriage_auto'],
    ['expectedOn', 'expected_on'],
    ['locationId', 'location_id'],
  ];
  for (const [key, column] of keys) {
    if (changes[key] !== undefined) p[column] = changes[key] as Json;
  }
  return call(supabase.rpc('save_purchase_order', { p_order: orderId, p }), readPurchaseOrder);
}

export async function savePurchaseOrderVehicle(supabase: Client, orderId: string, vehicle: OrderVehicleInput): Promise<PurchaseOrderDetail> {
  const p: Record<string, Json> = {};
  if (vehicle.id != null) p.id = vehicle.id;
  if (vehicle.registration !== undefined) p.registration = vehicle.registration;
  if (vehicle.vin !== undefined) p.vin = vehicle.vin;
  if (vehicle.vehicleId !== undefined) p.vehicle_id = vehicle.vehicleId;
  if (vehicle.label !== undefined) p.label = vehicle.label;
  return call(supabase.rpc('save_purchase_order_vehicle', { p_order: orderId, p }), readPurchaseOrder);
}

export async function removePurchaseOrderVehicle(supabase: Client, vehicleId: number): Promise<PurchaseOrderDetail> {
  return call(supabase.rpc('remove_purchase_order_vehicle', { p_vehicle: vehicleId }), readPurchaseOrder);
}

export async function placePurchaseOrder(supabase: Client, orderId: string, input: PlaceOrderInput): Promise<PurchaseOrderDetail> {
  const p: Record<string, Json> = { via: input.via };
  if (input.reference != null) p.reference = input.reference;
  if (input.placedWith != null) p.placed_with = input.placedWith;
  if (input.prices?.length) p.prices = input.prices.map((price) => ({ line_id: price.lineId, unit_cost: price.unitCost }));
  if (input.carriage !== undefined) p.carriage = input.carriage;
  if (input.expectedOn !== undefined) p.expected_on = input.expectedOn;
  return call(supabase.rpc('place_purchase_order', { p_order: orderId, p }), readPurchaseOrder);
}

export async function cancelPurchaseOrder(supabase: Client, orderId: string, reason: string): Promise<PurchaseOrderDetail> {
  return call(supabase.rpc('cancel_purchase_order', { p_order: orderId, p_reason: reason }), readPurchaseOrder);
}

export async function deleteDraftPurchaseOrder(supabase: Client, orderId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_draft_purchase_order', { p_order: orderId });
  if (error) throw dataError(error);
}

// Vehicles from the catalogue that typed text describes, best first ("Golf VI 1.6 TDI 2010").
export async function vehicleOptions(supabase: Client, text: string): Promise<VehicleOption[]> {
  if (text.trim().length < 3) return [];
  const { data, error } = await supabase.rpc('vehicle_options', { p_text: text.trim() });
  if (error) throw dataError(error);
  return (data ?? []).map((row) => ({ vehicleId: row.vehicle_id, ktype: row.ktype ?? null, label: row.label, score: row.score }));
}
