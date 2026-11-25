import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { DataError, dataError } from '../core/errors';
import { readArray, readBoolean, readNumber, readRecord, readString, readStrings } from '../core/read';
import type { StatusState } from '../core/status';
import { call, readDocumentEvents, type DocumentEvent } from './documents';
import type { OrderAddress } from './orders';
import { isReturnLineReason, isReturnReason, type ReturnLineReason, type ReturnReason } from './return-terms';
import { isSupplierStatus, type SupplierStatus } from './suppliers';

// Returns to a supplier (docs/RETURNS_AND_CORES.md; purchasing steps 15a and 15b). A draft is put together; Ready
// takes the stock off its bins onto the returns shelf; Sent is when it has gone back; Settled once every line is
// credited (credits.ts), refused, written off or replaced. Every rule lives in SQL (public.*supplier_return*,
// return_to_supplier, part_return_options, settle_supplier_return_line); this file shapes what is sent and read.

export const SUPPLIER_RETURN_STATUSES = ['draft', 'ready', 'sent', 'settled'] as const;
export type SupplierReturnStatus = (typeof SUPPLIER_RETURN_STATUSES)[number];
// A return's badge state (docs/design-checks/status-colours.md, owner 23 November 2026): a draft has not started, one on
// the returns shelf is our move, a sent one waits on the supplier's credit, a settled one is done.
export const SUPPLIER_RETURN_STATUS_STATES: Record<SupplierReturnStatus, StatusState> = {
  draft: 'not_started',
  ready: 'active',
  sent: 'waiting',
  settled: 'ready',
};

export function isSupplierReturnStatus(value: unknown): value is SupplierReturnStatus {
  return typeof value === 'string' && (SUPPLIER_RETURN_STATUSES as readonly string[]).includes(value);
}

// Where what we paid came from: the delivery's checked, order or sheet price; their current price; or typed.
export const RETURN_COST_BASES = ['checked', 'order', 'sheet', 'price', 'typed'] as const;
export type ReturnCostBasis = (typeof RETURN_COST_BASES)[number];

// short: credited less than expected, not accepted. over_credited: credited more than expected.
export type ReturnLineWarning = 'not_enough_stock' | 'past_window' | 'no_price' | 'short' | 'over_credited';
export type ReturnWarning =
  'supplier_on_hold' | 'supplier_archived' | 'needs_return_number' | 'not_enough_stock' | 'short';

const LINE_WARNINGS: readonly ReturnLineWarning[] = [
  'not_enough_stock',
  'past_window',
  'no_price',
  'short',
  'over_credited',
];
const RETURN_WARNINGS: readonly ReturnWarning[] = [
  'supplier_on_hold',
  'supplier_archived',
  'needs_return_number',
  'not_enough_stock',
  'short',
];

// What else became of a sent line's units: refused and back in stock, written off, replaced, or a short credit
// accepted.
export const RETURN_OUTCOME_KINDS = ['back_to_stock', 'written_off', 'replaced', 'short_accepted'] as const;
export type ReturnOutcomeKind = (typeof RETURN_OUTCOME_KINDS)[number];

export function isReturnOutcomeKind(value: unknown): value is ReturnOutcomeKind {
  return typeof value === 'string' && (RETURN_OUTCOME_KINDS as readonly string[]).includes(value);
}

export type ReturnOutcome = {
  id: number;
  kind: ReturnOutcomeKind;
  // Null for a short accepted.
  qty: number | null;
  // The units at what we paid, or the short written off.
  value: number;
  bin: { id: number; code: string } | null;
  noFaultFound: boolean;
  testFee: number | null;
  note: string | null;
  at: string;
  by: string;
};

// A credit note with this line on it (a draft counts for nothing yet).
export type ReturnLineCredit = {
  id: string;
  number: string;
  reference: string | null;
  status: string;
  qty: number;
  amount: number;
};

// Once sent: what is credited, refused, written off or replaced, and what is still waiting.
export type ReturnLineBalance = {
  unitsCredited: number;
  credited: number;
  unitsBack: number;
  unitsWrittenOff: number;
  unitsReplaced: number;
  shortAccepted: number;
  testFees: number;
  unitsOpen: number;
  // Credited less than expected (not accepted), or more.
  short: number;
  over: number;
  // Still waiting: the open units' credit expected plus any short.
  openCredit: number;
  settled: boolean;
  credits: ReturnLineCredit[];
  outcomes: ReturnOutcome[];
};

export type ReturnBalance = {
  credited: number;
  open: number;
  short: number;
  over: number;
  shortAccepted: number;
  backToStock: number;
  writtenOff: number;
  replaced: number;
  testFees: number;
  linesOpen: number;
  linesSettled: number;
};

export type ReturnBin = { id: number; code: string; isSystem: boolean; qty: number };

export type ReturnDelivery = {
  receiptId: string;
  number: string;
  receivedAt: string;
  qtyLeft: number;
  unitCost: number | null;
};

export type SupplierReturnLine = {
  id: number;
  lineNo: number;
  partId: number;
  brand: string;
  number: string;
  description: string | null;
  supplierCode: string | null;
  reason: ReturnLineReason;
  reasonLabel: string;
  qty: number;
  // The bin it comes off, with what is in it now. Null on a CORE line: an old unit is never stock.
  bin: ReturnBin | null;
  // The old unit a CORE line sends back.
  core: { id: number; tag: string; customer: string | null } | null;
  receipt: { id: string; number: string; receivedAt: string } | null;
  daysSinceDelivery: number | null;
  windowDays: number | null;
  unitCost: number | null;
  costBasis: ReturnCostBasis | null;
  handlingPct: number;
  // Units x what we paid, less the handling charge. Null with no price.
  credit: number | null;
  note: string | null;
  warnings: ReturnLineWarning[];
  // On a draft: the deliveries and bins it could come from instead.
  deliveries: ReturnDelivery[];
  bins: ReturnBin[];
  // Once sent.
  balance: ReturnLineBalance | null;
};

export type ReturnTotals = {
  lines: number;
  units: number;
  net: number;
  vatRate: number;
  vat: number;
  gross: number;
  currency: string;
  // Lines with no price, so not in the credit expected.
  unpriced: number;
};

export type ReturnEvent = DocumentEvent;

// A credit note set against the return, with how much of it is for this return.
export type ReturnCreditNote = {
  id: string;
  number: string;
  reference: string | null;
  status: string;
  creditDate: string | null;
  amount: number;
};

export type SupplierReturnDetail = {
  id: string;
  number: string;
  status: SupplierReturnStatus;
  // Their return number.
  reference: string | null;
  notes: string | null;
  supplierNotes: string | null;
  // The reasons on it whose terms need their return number first.
  needsReturnNumberFor: string[];
  createdAt: string;
  createdBy: string;
  readyAt: string | null;
  readyBy: string | null;
  sentAt: string | null;
  sentBy: string | null;
  settledAt: string | null;
  // Days since it was sent, while waiting for credit.
  daysWaiting: number | null;
  supplier: {
    id: number;
    name: string;
    status: SupplierStatus;
    accountNumber: string | null;
    // Their returns address, else their main one.
    address: (OrderAddress & { kind: string }) | null;
    contact: { name: string; email: string | null; phone: string | null } | null;
  };
  location: { id: number; code: string; name: string } | null;
  collectFrom: (OrderAddress & { name: string | null }) | null;
  lines: SupplierReturnLine[];
  totals: ReturnTotals;
  // Once sent.
  balance: ReturnBalance | null;
  credits: ReturnCreditNote[];
  // Where a refused or replaced part can go back to (editors, once sent).
  locationBins: { id: number; code: string; isSystem: boolean }[];
  warnings: ReturnWarning[];
  history: ReturnEvent[];
  can: {
    edit: boolean;
    ready: boolean;
    reopen: boolean;
    send: boolean;
    unsend: boolean;
    delete: boolean;
    editReference: boolean;
    // Record their credit (a sent return with something still waiting).
    credit: boolean;
    // Refuse, write off, replace or accept a short credit on a line.
    settle: boolean;
  };
};

export type SupplierReturnRow = {
  id: string;
  number: string;
  status: SupplierReturnStatus;
  reference: string | null;
  supplierId: number;
  supplier: string;
  locationCode: string | null;
  reasons: ReturnReason[];
  totals: ReturnTotals;
  balance: ReturnBalance | null;
  daysWaiting: number | null;
  // Waiting for credit longer than chaseDays.
  overdue: boolean;
  createdAt: string;
  readyAt: string | null;
  sentAt: string | null;
  settledAt: string | null;
};

// What is waiting for credit across the returns found: in all, and (across suppliers) by supplier, most owed first.
export type ReturnsWaiting = {
  returns: number;
  open: number;
  overdue: number;
  oldestSentAt: string | null;
  suppliers: { id: number; name: string; returns: number; open: number; oldestSentAt: string | null }[] | null;
};

export type SupplierReturnList = {
  counts: Record<SupplierReturnStatus, number>;
  chaseDays: number;
  waiting: ReturnsWaiting;
  returns: SupplierReturnRow[];
};

export type SupplierReturnQuery = {
  status?: SupplierReturnStatus;
  supplierId?: number;
  search?: string;
  limit?: number;
};

export type NewReturnLine = {
  partId: number;
  qty: number;
  reason: ReturnReason;
  binId?: number;
  // The goods receipt it came in on; otherwise the newest delivery from that supplier with units left.
  receiptId?: string;
  unitCost?: number;
  note?: string | null;
};

export type ReturnLineChanges = {
  qty?: number;
  reason?: ReturnReason;
  binId?: number;
  // Null: not from a delivery, so their current price.
  receiptId?: string | null;
  // Null: back to what the delivery or their price says.
  unitCost?: number | null;
  handlingPct?: number;
  note?: string | null;
};

export type ReturnChanges = { reference?: string | null; notes?: string | null; supplierNotes?: string | null };

// What became of some of a sent line's units. Units default to all those still open; the bin to the line's own (else
// UNBINNED). No fault found (and a test fee) only for a refused warranty line.
export type ReturnSettlement = {
  kind: ReturnOutcomeKind;
  qty?: number;
  binId?: number;
  note?: string | null;
  noFaultFound?: boolean;
  testFee?: number | null;
};

export type ReturnStarted = { id: string; number: string; created: boolean; added: number };

export type PartReturnSupplier = {
  id: number;
  name: string;
  status: SupplierStatus;
  // Their current price, if they list it.
  price: number | null;
  lastDelivery: {
    receiptId: string;
    number: string;
    receivedAt: string;
    locationId: number | null;
    qtyLeft: number;
    unitCost: number | null;
  } | null;
  terms: { reason: ReturnReason; windowDays: number | null; handlingPct: number; needsReturnNumber: boolean }[];
  drafts: { id: string; number: string; locationId: number | null }[];
};

export type PartReturnOptions = {
  part: { id: number; brand: string; number: string; description: string | null };
  stock: { locationId: number; code: string; name: string; qty: number; bins: ReturnBin[] }[];
  // The suppliers it came from, latest delivery first, then any that list it.
  suppliers: PartReturnSupplier[];
  reasons: { code: ReturnReason; label: string; description: string }[];
};

function readAddress(value: Json | undefined): OrderAddress | null {
  const row = readRecord(value);
  const lines = readString(row?.lines);
  if (!row || !lines) return null;
  return { lines, town: readString(row.town), county: readString(row.county), postcode: readString(row.postcode) };
}

function readBin(value: Json | undefined): ReturnBin | null {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  if (!row || id == null) return null;
  return {
    id,
    code: readString(row.code) ?? '',
    isSystem: readBoolean(row.is_system) ?? false,
    qty: readNumber(row.qty) ?? 0,
  };
}

function readTotals(value: Json | undefined): ReturnTotals {
  const row = readRecord(value);
  const n = (key: string) => readNumber(row?.[key]) ?? 0;
  return {
    lines: n('lines'),
    units: n('units'),
    net: n('net'),
    vatRate: n('vat_rate'),
    vat: n('vat'),
    gross: n('gross'),
    currency: readString(row?.currency) ?? 'GBP',
    unpriced: n('unpriced'),
  };
}

function readBalance(value: Json | undefined): ReturnBalance | null {
  const row = readRecord(value);
  if (!row) return null;
  const n = (key: string) => readNumber(row[key]) ?? 0;
  return {
    credited: n('credited'),
    open: n('open'),
    short: n('short'),
    over: n('over'),
    shortAccepted: n('short_accepted'),
    backToStock: n('back_to_stock'),
    writtenOff: n('written_off'),
    replaced: n('replaced'),
    testFees: n('test_fees'),
    linesOpen: n('lines_open'),
    linesSettled: n('lines_settled'),
  };
}

function readOutcome(value: Json): ReturnOutcome | null {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  const kind = readString(row?.kind);
  if (!row || id == null || !isReturnOutcomeKind(kind)) return null;
  const bin = readRecord(row.bin);
  const binId = readNumber(bin?.id);
  return {
    id,
    kind,
    qty: readNumber(row.qty),
    value: readNumber(row.value) ?? 0,
    bin: bin && binId != null ? { id: binId, code: readString(bin.code) ?? '' } : null,
    noFaultFound: readBoolean(row.no_fault_found) ?? false,
    testFee: readNumber(row.test_fee),
    note: readString(row.note),
    at: readString(row.at) ?? '',
    by: readString(row.by) ?? 'Someone',
  };
}

function readLineBalance(value: Json | undefined): ReturnLineBalance | null {
  const row = readRecord(value);
  if (!row) return null;
  const n = (key: string) => readNumber(row[key]) ?? 0;
  return {
    unitsCredited: n('units_credited'),
    credited: n('credited'),
    unitsBack: n('units_back'),
    unitsWrittenOff: n('units_written_off'),
    unitsReplaced: n('units_replaced'),
    shortAccepted: n('short_accepted'),
    testFees: n('test_fees'),
    unitsOpen: n('units_open'),
    short: n('short'),
    over: n('over'),
    openCredit: n('open_credit'),
    settled: readBoolean(row.settled) ?? false,
    credits: readArray(row.credits).flatMap((item) => {
      const credit = readRecord(item);
      const id = readString(credit?.id);
      const number = readString(credit?.number);
      if (!credit || !id || !number) return [];
      return [
        {
          id,
          number,
          reference: readString(credit.reference),
          status: readString(credit.status) ?? 'draft',
          qty: readNumber(credit.qty) ?? 0,
          amount: readNumber(credit.amount) ?? 0,
        },
      ];
    }),
    outcomes: readArray(row.outcomes).flatMap((item) => readOutcome(item) ?? []),
  };
}

function readCostBasis(value: Json | undefined): ReturnCostBasis | null {
  const basis = readString(value);
  return basis && (RETURN_COST_BASES as readonly string[]).includes(basis) ? (basis as ReturnCostBasis) : null;
}

function readLine(value: Json): SupplierReturnLine | null {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  const partId = readNumber(row?.part_id);
  const qty = readNumber(row?.qty);
  const reason = readString(row?.reason);
  const bin = readBin(row?.bin);
  const coreRow = readRecord(row?.core);
  const coreId = readNumber(coreRow?.id);
  const core = coreRow && coreId != null ? { id: coreId, tag: readString(coreRow.tag) ?? '', customer: readString(coreRow.customer) } : null;
  if (!row || id == null || partId == null || qty == null || !isReturnLineReason(reason) || (!bin && !core)) return null;
  const receipt = readRecord(row.receipt);
  const receiptId = readString(receipt?.id);
  return {
    id,
    lineNo: readNumber(row.line_no) ?? 0,
    partId,
    brand: readString(row.brand) ?? '',
    number: readString(row.number) ?? '',
    description: readString(row.description),
    supplierCode: readString(row.supplier_code),
    reason,
    reasonLabel: readString(row.reason_label) ?? reason,
    qty,
    bin,
    core,
    receipt:
      receipt && receiptId
        ? { id: receiptId, number: readString(receipt.number) ?? '', receivedAt: readString(receipt.received_at) ?? '' }
        : null,
    daysSinceDelivery: readNumber(row.days_since_delivery),
    windowDays: readNumber(row.window_days),
    unitCost: readNumber(row.unit_cost),
    costBasis: readCostBasis(row.cost_basis),
    handlingPct: readNumber(row.handling_pct) ?? 0,
    credit: readNumber(row.credit),
    note: readString(row.note),
    warnings: readStrings(row.warnings).filter((item): item is ReturnLineWarning =>
      (LINE_WARNINGS as readonly string[]).includes(item),
    ),
    deliveries: readArray(row.deliveries).flatMap((item) => {
      const delivery = readRecord(item);
      const deliveryId = readString(delivery?.receipt_id);
      const number = readString(delivery?.number);
      if (!delivery || !deliveryId || !number) return [];
      return [
        {
          receiptId: deliveryId,
          number,
          receivedAt: readString(delivery.received_at) ?? '',
          qtyLeft: readNumber(delivery.qty_left) ?? 0,
          unitCost: readNumber(delivery.unit_cost),
        },
      ];
    }),
    bins: readArray(row.bins).flatMap((item) => readBin(item) ?? []),
    balance: readLineBalance(row.balance),
  };
}

export function readSupplierReturn(value: Json | null | undefined): SupplierReturnDetail {
  const row = readRecord(value ?? undefined);
  const id = readString(row?.document_id);
  const number = readString(row?.number);
  const status = readString(row?.status);
  const supplier = readRecord(row?.supplier);
  const supplierId = readNumber(supplier?.id);
  if (!row || !id || !number || !isSupplierReturnStatus(status) || !supplier || supplierId == null) {
    throw new DataError('The return could not be read.', 'P0002');
  }
  const contact = readRecord(supplier.contact);
  const address = readAddress(supplier.address);
  const location = readRecord(row.location);
  const locationId = readNumber(location?.id);
  const from = readRecord(row.collect_from);
  const fromAddress = readAddress(row.collect_from);
  const supplierStatus = readString(supplier.status);
  const can = readRecord(row.can);
  return {
    id,
    number,
    status,
    reference: readString(row.reference),
    notes: readString(row.notes),
    supplierNotes: readString(row.supplier_notes),
    needsReturnNumberFor: readStrings(row.needs_return_number_for),
    createdAt: readString(row.created_at) ?? '',
    createdBy: readString(row.created_by) ?? 'Someone',
    readyAt: readString(row.ready_at),
    readyBy: readString(row.ready_by),
    sentAt: readString(row.sent_at),
    sentBy: readString(row.sent_by),
    settledAt: readString(row.settled_at),
    daysWaiting: readNumber(row.days_waiting),
    supplier: {
      id: supplierId,
      name: readString(supplier.name) ?? '',
      status: isSupplierStatus(supplierStatus) ? supplierStatus : 'active',
      accountNumber: readString(supplier.account_number),
      address: address ? { ...address, kind: readString(readRecord(supplier.address)?.kind) ?? 'main' } : null,
      contact:
        contact && readString(contact.name)
          ? { name: readString(contact.name) ?? '', email: readString(contact.email), phone: readString(contact.phone) }
          : null,
    },
    location:
      location && locationId != null
        ? { id: locationId, code: readString(location.code) ?? '', name: readString(location.name) ?? '' }
        : null,
    collectFrom: from && fromAddress ? { ...fromAddress, name: readString(from.name) } : null,
    lines: readArray(row.lines).flatMap((item) => readLine(item) ?? []),
    totals: readTotals(row.totals),
    balance: readBalance(row.balance),
    credits: readArray(row.credits).flatMap((item) => {
      const credit = readRecord(item);
      const creditId = readString(credit?.id);
      const creditNumber = readString(credit?.number);
      if (!credit || !creditId || !creditNumber) return [];
      return [
        {
          id: creditId,
          number: creditNumber,
          reference: readString(credit.reference),
          status: readString(credit.status) ?? 'draft',
          creditDate: readString(credit.credit_date),
          amount: readNumber(credit.amount) ?? 0,
        },
      ];
    }),
    locationBins: readArray(row.location_bins).flatMap((item) => {
      const bin = readBin(item);
      return bin ? [{ id: bin.id, code: bin.code, isSystem: bin.isSystem }] : [];
    }),
    warnings: readStrings(row.warnings).filter((item): item is ReturnWarning =>
      (RETURN_WARNINGS as readonly string[]).includes(item),
    ),
    history: readDocumentEvents(row.history),
    can: {
      edit: readBoolean(can?.edit) ?? false,
      ready: readBoolean(can?.ready) ?? false,
      reopen: readBoolean(can?.reopen) ?? false,
      send: readBoolean(can?.send) ?? false,
      unsend: readBoolean(can?.unsend) ?? false,
      delete: readBoolean(can?.delete) ?? false,
      editReference: readBoolean(can?.edit_reference) ?? false,
      credit: readBoolean(can?.credit) ?? false,
      settle: readBoolean(can?.settle) ?? false,
    },
  };
}

function readWaiting(value: Json | undefined): ReturnsWaiting {
  const row = readRecord(value);
  const suppliers = row?.suppliers;
  return {
    returns: readNumber(row?.returns) ?? 0,
    open: readNumber(row?.open) ?? 0,
    overdue: readNumber(row?.overdue) ?? 0,
    oldestSentAt: readString(row?.oldest_sent_at),
    suppliers: Array.isArray(suppliers)
      ? suppliers.flatMap((item) => {
          const supplier = readRecord(item);
          const id = readNumber(supplier?.id);
          if (!supplier || id == null) return [];
          return [
            {
              id,
              name: readString(supplier.name) ?? '',
              returns: readNumber(supplier.returns) ?? 0,
              open: readNumber(supplier.open) ?? 0,
              oldestSentAt: readString(supplier.oldest_sent_at),
            },
          ];
        })
      : null,
  };
}

export function readSupplierReturnList(value: Json): SupplierReturnList {
  const row = readRecord(value);
  const counts = readRecord(row?.counts);
  return {
    counts: Object.fromEntries(
      SUPPLIER_RETURN_STATUSES.map((status) => [status, readNumber(counts?.[status]) ?? 0]),
    ) as Record<SupplierReturnStatus, number>,
    chaseDays: readNumber(row?.chase_days) ?? 30,
    waiting: readWaiting(row?.waiting),
    returns: readArray(row?.returns).flatMap((item) => {
      const ret = readRecord(item);
      const id = readString(ret?.document_id);
      const number = readString(ret?.number);
      const status = readString(ret?.status);
      const supplier = readRecord(ret?.supplier);
      const supplierId = readNumber(supplier?.id);
      if (!ret || !id || !number || !isSupplierReturnStatus(status) || !supplier || supplierId == null) return [];
      return [
        {
          id,
          number,
          status,
          reference: readString(ret.reference),
          supplierId,
          supplier: readString(supplier.name) ?? '',
          locationCode: readString(readRecord(ret.location)?.code),
          reasons: readStrings(ret.reasons).filter(isReturnReason),
          totals: readTotals(ret.totals),
          balance: readBalance(ret.balance),
          daysWaiting: readNumber(ret.days_waiting),
          overdue: readBoolean(ret.overdue) ?? false,
          createdAt: readString(ret.created_at) ?? '',
          readyAt: readString(ret.ready_at),
          sentAt: readString(ret.sent_at),
          settledAt: readString(ret.settled_at),
        },
      ];
    }),
  };
}

export function readPartReturnOptions(value: Json): PartReturnOptions {
  const row = readRecord(value);
  const part = readRecord(row?.part);
  const partId = readNumber(part?.id);
  if (!row || !part || partId == null) throw new DataError('That part could not be read.', 'P0002');
  return {
    part: {
      id: partId,
      brand: readString(part.brand) ?? '',
      number: readString(part.number) ?? '',
      description: readString(part.description),
    },
    stock: readArray(row.stock).flatMap((item) => {
      const stock = readRecord(item);
      const locationId = readNumber(stock?.location_id);
      if (!stock || locationId == null) return [];
      return [
        {
          locationId,
          code: readString(stock.code) ?? '',
          name: readString(stock.name) ?? '',
          qty: readNumber(stock.qty) ?? 0,
          bins: readArray(stock.bins).flatMap((bin) => readBin(bin) ?? []),
        },
      ];
    }),
    suppliers: readArray(row.suppliers).flatMap((item) => {
      const supplier = readRecord(item);
      const id = readNumber(supplier?.id);
      if (!supplier || id == null) return [];
      const status = readString(supplier.status);
      const last = readRecord(supplier.last_delivery);
      const lastId = readString(last?.receipt_id);
      return [
        {
          id,
          name: readString(supplier.name) ?? '',
          status: isSupplierStatus(status) ? status : 'active',
          price: readNumber(supplier.price),
          lastDelivery:
            last && lastId
              ? {
                  receiptId: lastId,
                  number: readString(last.number) ?? '',
                  receivedAt: readString(last.received_at) ?? '',
                  locationId: readNumber(last.location_id),
                  qtyLeft: readNumber(last.qty_left) ?? 0,
                  unitCost: readNumber(last.unit_cost),
                }
              : null,
          terms: readArray(supplier.terms).flatMap((term) => {
            const terms = readRecord(term);
            const reason = readString(terms?.reason);
            if (!terms || !isReturnReason(reason)) return [];
            return [
              {
                reason,
                windowDays: readNumber(terms.window_days),
                handlingPct: readNumber(terms.handling_pct) ?? 0,
                needsReturnNumber: readBoolean(terms.needs_return_number) ?? false,
              },
            ];
          }),
          drafts: readArray(supplier.drafts).flatMap((draft) => {
            const d = readRecord(draft);
            const draftId = readString(d?.document_id);
            const number = readString(d?.number);
            return d && draftId && number ? [{ id: draftId, number, locationId: readNumber(d.location_id) }] : [];
          }),
        },
      ];
    }),
    reasons: readArray(row.reasons).flatMap((item) => {
      const reason = readRecord(item);
      const code = readString(reason?.code);
      if (!reason || !isReturnReason(code)) return [];
      return [{ code, label: readString(reason.label) ?? code, description: readString(reason.description) ?? '' }];
    }),
  };
}

function lineJson(line: NewReturnLine): Record<string, Json> {
  const out: Record<string, Json> = { part_id: line.partId, qty: line.qty, reason: line.reason };
  if (line.binId != null) out.bin_id = line.binId;
  if (line.receiptId != null) out.receipt_id = line.receiptId;
  if (line.unitCost != null) out.unit_cost = line.unitCost;
  if (line.note != null) out.note = line.note;
  return out;
}

export async function listSupplierReturns(
  supabase: Client,
  query: SupplierReturnQuery = {},
): Promise<SupplierReturnList> {
  return call(
    supabase.rpc('supplier_return_list', {
      p_status: query.status,
      p_source: query.supplierId,
      p_search: query.search?.trim() || undefined,
      p_limit: query.limit,
    }),
    readSupplierReturnList,
  );
}

export async function getSupplierReturn(supabase: Client, returnId: string): Promise<SupplierReturnDetail> {
  return call(supabase.rpc('supplier_return_detail', { p_return: returnId }), readSupplierReturn);
}

export async function getPartReturnOptions(supabase: Client, partId: number): Promise<PartReturnOptions> {
  return call(supabase.rpc('part_return_options', { p_part: partId }), readPartReturnOptions);
}

// Puts lines on the supplier's draft return for the location, starting one if there is none. No lines: just opens it.
export async function returnToSupplier(
  supabase: Client,
  input: { supplierId: number; locationId: number; lines?: NewReturnLine[] },
): Promise<ReturnStarted> {
  return call(
    supabase.rpc('return_to_supplier', {
      p_supplier: input.supplierId,
      p_location: input.locationId,
      p_lines: (input.lines ?? []).map(lineJson),
    }),
    (data) => {
      const row = readRecord(data);
      const id = readString(row?.document_id);
      const number = readString(row?.number);
      if (!row || !id || !number) throw new DataError('The return was not started.', 'P0002');
      return { id, number, created: readBoolean(row.created) ?? false, added: readNumber(row.added) ?? 0 };
    },
  );
}

export async function addSupplierReturnLines(
  supabase: Client,
  returnId: string,
  lines: NewReturnLine[],
): Promise<SupplierReturnDetail> {
  return call(
    supabase.rpc('add_supplier_return_lines', { p_return: returnId, p_lines: lines.map(lineJson) }),
    readSupplierReturn,
  );
}

export async function saveSupplierReturnLine(
  supabase: Client,
  lineId: number,
  changes: ReturnLineChanges,
): Promise<SupplierReturnDetail> {
  const p: Record<string, Json> = {};
  if (changes.qty !== undefined) p.qty = changes.qty;
  if (changes.reason !== undefined) p.reason = changes.reason;
  if (changes.binId !== undefined) p.bin_id = changes.binId;
  if (changes.receiptId !== undefined) p.receipt_id = changes.receiptId;
  if (changes.unitCost !== undefined) p.unit_cost = changes.unitCost;
  if (changes.handlingPct !== undefined) p.handling_pct = changes.handlingPct;
  if (changes.note !== undefined) p.note = changes.note;
  return call(supabase.rpc('save_supplier_return_line', { p_line: lineId, p }), readSupplierReturn);
}

export async function removeSupplierReturnLine(supabase: Client, lineId: number): Promise<SupplierReturnDetail> {
  return call(supabase.rpc('remove_supplier_return_line', { p_line: lineId }), readSupplierReturn);
}

export async function saveSupplierReturn(
  supabase: Client,
  returnId: string,
  changes: ReturnChanges,
): Promise<SupplierReturnDetail> {
  const p: Record<string, Json> = {};
  if (changes.reference !== undefined) p.reference = changes.reference;
  if (changes.notes !== undefined) p.notes = changes.notes;
  if (changes.supplierNotes !== undefined) p.supplier_notes = changes.supplierNotes;
  return call(supabase.rpc('save_supplier_return', { p_return: returnId, p }), readSupplierReturn);
}

export async function deleteDraftSupplierReturn(supabase: Client, returnId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_draft_supplier_return', { p_return: returnId });
  if (error) throw dataError(error);
}

// The status changes, each returning the detail: onto the returns shelf, back to draft, sent, and undo sent.
export type ReturnStep = 'ready' | 'reopen' | 'send' | 'unsend';

const STEP_FUNCTIONS = {
  ready: 'ready_supplier_return',
  reopen: 'reopen_supplier_return',
  send: 'send_supplier_return',
  unsend: 'unsend_supplier_return',
} as const satisfies Record<ReturnStep, string>;

export async function moveSupplierReturn(
  supabase: Client,
  returnId: string,
  step: ReturnStep,
): Promise<SupplierReturnDetail> {
  return call(supabase.rpc(STEP_FUNCTIONS[step], { p_return: returnId }), readSupplierReturn);
}

// Refused and back in stock, written off, replaced, or a short credit accepted. Returns the return's detail.
export async function settleSupplierReturnLine(
  supabase: Client,
  lineId: number,
  settlement: ReturnSettlement,
): Promise<SupplierReturnDetail> {
  const p: Record<string, Json> = { kind: settlement.kind };
  if (settlement.qty != null) p.qty = settlement.qty;
  if (settlement.binId != null) p.bin_id = settlement.binId;
  if (settlement.note != null) p.note = settlement.note;
  if (settlement.noFaultFound) p.no_fault_found = true;
  if (settlement.testFee != null) p.test_fee = settlement.testFee;
  return call(supabase.rpc('settle_supplier_return_line', { p_line: lineId, p }), readSupplierReturn);
}

export async function undoSupplierReturnOutcome(supabase: Client, outcomeId: number): Promise<SupplierReturnDetail> {
  return call(supabase.rpc('undo_supplier_return_outcome', { p_outcome: outcomeId }), readSupplierReturn);
}
