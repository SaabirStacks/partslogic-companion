import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readBoolean, readNumber, readRecord, readString, type JsonRecord } from '../core/read';
import { readBillTerms, type BillTerms } from './bills';
import { readPayables, readPaymentRow, type Payables, type SupplierPaymentRow } from './payments';
import { readStatementFigures, type StatementFigures } from './statements';
import { readCoreFigures, type CoreFigures } from './cores';
import { readSupplierUpload, type SupplierUpload } from './supplier-options';
import { readSheetFreshness, type SheetFreshness } from './supplier-sheets';

// A supplier page's figures and the Suppliers list's money columns (supplier_overview, supplier_figures). The
// database works every figure out; these only read them.

export type SupplierMonth = { month: string; ordered: number; received: number; returned: number; credited: number };

export const SUPPLIER_NEEDS = [
  'on_hold',
  'credit_overdue',
  'cores_overdue',
  'orders_late',
  'back_orders_to_chase',
  'price_checks',
  'extras',
  'returns_to_send',
  'cores_to_send',
  'bills_to_review',
  'deliveries_unbilled',
  'bills_overdue',
  'statement_to_chase',
  'delisting_check',
  'price_sheet_overdue',
  'draft_orders',
] as const;
export type SupplierNeedKind = (typeof SUPPLIER_NEEDS)[number];
// orderId: for extras, the oldest order with some to deal with. days, everyDays, lastAt: for price_sheet_overdue, how
// old their last sheet is, how often one is due and when it came. batchId: for delisting_check, the upload waiting at
// its check (count: the lines it would mark no longer listed).
export type SupplierNeed = {
  kind: SupplierNeedKind;
  count: number;
  amount: number | null;
  orderId?: string | null;
  days?: number;
  everyDays?: number;
  lastAt?: string | null;
  batchId?: string;
};

export const SUPPLIER_ACTIVITY_KINDS = ['order', 'delivery', 'return', 'credit', 'sheet'] as const;
export type SupplierActivityKind = (typeof SUPPLIER_ACTIVITY_KINDS)[number];

// Something that happened with a supplier. id is a document id, or a price sheet's batch id; number is the
// document number, or the sheet's file name.
export type SupplierActivity = {
  kind: SupplierActivityKind;
  id: string;
  number: string;
  at: string;
  amount: number | null;
  lines: number | null;
  status: string | null;
  reference: string | null;
  checked: boolean | null;
};

export type SupplierDeliveryRow = {
  id: string;
  number: string;
  reference: string | null;
  locationCode: string | null;
  receivedAt: string;
  checked: boolean;
  value: number;
};

export type PriceMover = {
  partId: number;
  brand: string | null;
  number: string;
  was: number;
  now: number;
  change: number;
  since: string;
};

export type SupplierOverview = {
  supplierId: number;
  currency: string;
  months: SupplierMonth[];
  year: Omit<SupplierMonth, 'month'>;
  openOrders: { count: number; value: number; late: number };
  owed: { open: number; returns: number; overdue: number; chaseDays: number };
  priceChecks: number;
  drafts: { orders: number; returns: number };
  prices: {
    listed: number;
    inRange: number;
    // Over the last 90 days, on the parts in your range.
    up: number;
    down: number;
    averageChange: number | null;
    movers: PriceMover[];
    lastSheet: SupplierUpload | null;
    // How fresh their last sheet is (step 12).
    freshness: SheetFreshness;
  };
  needs: SupplierNeed[];
  // Old units and surcharges with them (step 16); null before that was applied.
  cores: CoreFigures | null;
  // Lines still due past their date or on part-received orders, and whether the supplier holds back-orders.
  backOrders: { holds: boolean; lines: number; value: number; toChase: number };
  // Bills from them (step 17); null before that was applied.
  bills: SupplierBillsSummary | null;
  // What they're owed and their latest payments (step 17b), and their latest statement (17c); null before applied.
  payables: Payables | null;
  payments: SupplierPaymentRow[];
  statement: { id: number; statementDate: string; closingBalance: number; figures: StatementFigures } | null;
  activity: SupplierActivity[];
  deliveries: SupplierDeliveryRow[];
};

export type SupplierBillsSummary = {
  terms: BillTerms | null;
  recorded: number;
  toReview: number;
  billed12m: number;
  queryOpen: number;
  recent: {
    id: string;
    number: string;
    reference: string | null;
    status: 'draft' | 'recorded';
    needsReview: boolean;
    billDate: string | null;
    dueOn: string | null;
    gross: number | null;
    queryOpen: number;
  }[];
};

export function readSupplierBillsSummary(value: Json | undefined): SupplierBillsSummary | null {
  const row = readRecord(value);
  if (!row) return null;
  return {
    terms: readBillTerms(row.terms),
    recorded: num(row.recorded),
    toReview: num(row.to_review),
    billed12m: num(row.billed_12m),
    queryOpen: num(row.query_open),
    recent: readArray(row.recent).flatMap((item) => {
      const b = readRecord(item);
      const id = readString(b?.id);
      const number = readString(b?.number);
      if (!b || !id || !number) return [];
      return [
        {
          id,
          number,
          reference: readString(b.reference),
          status: b.status === 'recorded' ? 'recorded' : 'draft',
          needsReview: readBoolean(b.needs_review) ?? false,
          billDate: readString(b.bill_date),
          dueOn: readString(b.due_on),
          gross: readNumber(b.gross),
          queryOpen: num(b.query_open),
        },
      ];
    }),
  };
}

function readLatestStatement(value: Json | undefined): SupplierOverview['statement'] {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  if (!row || id == null) return null;
  return {
    id,
    statementDate: readString(row.statement_date) ?? '',
    closingBalance: readNumber(row.closing_balance) ?? 0,
    figures: readStatementFigures(row.figures),
  };
}

export type SupplierFigures = {
  orders: number;
  onOrder: number;
  late: number;
  owed: number;
  overdue: number;
  received: number;
  lastDelivery: string | null;
};

export type SupplierFigureList = {
  currency: string;
  totals: Omit<SupplierFigures, 'lastDelivery'> & { suppliers: number };
  bySupplier: Map<number, SupplierFigures>;
};

const num = (value: Json | undefined) => readNumber(value) ?? 0;

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}

function readMonth(value: Json | undefined): SupplierMonth | null {
  const row = readRecord(value);
  const month = readString(row?.month);
  if (!row || !month) return null;
  return {
    month,
    ordered: num(row.ordered),
    received: num(row.received),
    returned: num(row.returned),
    credited: num(row.credited),
  };
}

function readActivity(value: Json | undefined): SupplierActivity | null {
  const row = readRecord(value);
  const id = readString(row?.document_id) ?? readString(row?.batch_id);
  const number = readString(row?.number);
  const at = readString(row?.at);
  if (!row || !id || !number || !at || !isOneOf(SUPPLIER_ACTIVITY_KINDS, row.kind)) return null;
  return {
    kind: row.kind,
    id,
    number,
    at,
    amount: readNumber(row.amount),
    lines: readNumber(row.lines),
    status: readString(row.status),
    reference: readString(row.reference),
    checked: readBoolean(row.checked),
  };
}

export function readSupplierOverview(value: Json): SupplierOverview | null {
  const row = readRecord(value);
  const supplierId = readNumber(row?.source_id);
  if (!row || supplierId == null) return null;
  const year: JsonRecord = readRecord(row.year) ?? {};
  const open: JsonRecord = readRecord(row.open_orders) ?? {};
  const owed: JsonRecord = readRecord(row.owed) ?? {};
  const drafts: JsonRecord = readRecord(row.drafts) ?? {};
  const prices: JsonRecord = readRecord(row.prices) ?? {};
  return {
    supplierId,
    currency: readString(row.currency) ?? 'GBP',
    months: readArray(row.months).flatMap((item) => readMonth(item) ?? []),
    year: {
      ordered: num(year.ordered),
      received: num(year.received),
      returned: num(year.returned),
      credited: num(year.credited),
    },
    openOrders: { count: num(open.count), value: num(open.value), late: num(open.late) },
    owed: {
      open: num(owed.open),
      returns: num(owed.returns),
      overdue: num(owed.overdue),
      chaseDays: readNumber(owed.chase_days) ?? 30,
    },
    priceChecks: num(row.price_checks),
    drafts: { orders: num(drafts.orders), returns: num(drafts.returns) },
    prices: {
      listed: num(prices.listed),
      inRange: num(prices.in_range),
      up: num(prices.up),
      down: num(prices.down),
      averageChange: readNumber(prices.average_change),
      movers: readArray(prices.movers).flatMap((item) => {
        const mover = readRecord(item);
        const partId = readNumber(mover?.part_id);
        const number = readString(mover?.number);
        const was = readNumber(mover?.was);
        const now = readNumber(mover?.now);
        if (!mover || partId == null || !number || was == null || now == null) return [];
        return [
          {
            partId,
            brand: readString(mover.brand),
            number,
            was,
            now,
            change: num(mover.change),
            since: readString(mover.since) ?? '',
          },
        ];
      }),
      lastSheet: readSupplierUpload(prices.last_sheet),
      freshness: readSheetFreshness(prices.freshness),
    },
    needs: readArray(row.needs).flatMap((item) => {
      const need = readRecord(item);
      if (!need || !isOneOf(SUPPLIER_NEEDS, need.kind)) return [];
      const orderId = readString(need.order_id);
      const days = readNumber(need.days);
      const everyDays = readNumber(need.every_days);
      const batchId = readString(need.batch_id);
      return [
        {
          kind: need.kind,
          count: num(need.count),
          amount: readNumber(need.amount),
          ...(orderId ? { orderId } : {}),
          ...(days != null ? { days } : {}),
          ...(everyDays != null ? { everyDays, lastAt: readString(need.last_at) } : {}),
          ...(batchId ? { batchId } : {}),
        },
      ];
    }),
    cores: readCoreFigures(row.cores),
    backOrders: {
      holds: readBoolean(readRecord(row.back_orders)?.holds) ?? true,
      lines: readNumber(readRecord(row.back_orders)?.lines) ?? 0,
      value: readNumber(readRecord(row.back_orders)?.value) ?? 0,
      toChase: readNumber(readRecord(row.back_orders)?.to_chase) ?? 0,
    },
    bills: readSupplierBillsSummary(row.bills),
    payables: readRecord(row.payables) ? readPayables(row.payables) : null,
    payments: readArray(row.payments).flatMap((item) => readPaymentRow(item) ?? []),
    statement: readLatestStatement(row.statement),
    activity: readArray(row.activity).flatMap((item) => readActivity(item) ?? []),
    deliveries: readArray(row.deliveries).flatMap((item) => {
      const delivery = readRecord(item);
      const id = readString(delivery?.document_id);
      const number = readString(delivery?.number);
      const receivedAt = readString(delivery?.received_at);
      if (!delivery || !id || !number || !receivedAt) return [];
      return [
        {
          id,
          number,
          reference: readString(delivery.reference),
          locationCode: readString(delivery.location_code),
          receivedAt,
          checked: readBoolean(delivery.checked) ?? false,
          value: num(delivery.value),
        },
      ];
    }),
  };
}

function readFigures(value: Json | undefined): SupplierFigures {
  const row: JsonRecord = readRecord(value) ?? {};
  return {
    orders: num(row.orders),
    onOrder: num(row.on_order),
    late: num(row.late),
    owed: num(row.owed),
    overdue: num(row.overdue),
    received: num(row.received),
    lastDelivery: readString(row.last_delivery),
  };
}

export function readSupplierFigureList(value: Json): SupplierFigureList {
  const row: JsonRecord = readRecord(value) ?? {};
  const totals = readFigures(row.totals);
  const bySupplier = new Map<number, SupplierFigures>();
  for (const [key, item] of Object.entries(readRecord(row.suppliers) ?? {})) {
    const id = readNumber(key);
    if (id != null) bySupplier.set(id, readFigures(item));
  }
  return {
    currency: readString(row.currency) ?? 'GBP',
    totals: {
      orders: totals.orders,
      onOrder: totals.onOrder,
      late: totals.late,
      owed: totals.owed,
      overdue: totals.overdue,
      received: totals.received,
      suppliers: num(readRecord(row.totals)?.suppliers),
    },
    bySupplier,
  };
}

// One supplier's figures for its page (any member), or null when the id isn't a supplier.
export async function getSupplierOverview(supabase: Client, supplierId: number): Promise<SupplierOverview | null> {
  return call(supabase.rpc('supplier_overview', { p_source: supplierId }), (data) =>
    data == null ? null : readSupplierOverview(data),
  );
}

// The Suppliers list's money columns for every supplier that isn't archived, and their totals (any member).
export async function getSupplierFigures(supabase: Client): Promise<SupplierFigureList> {
  return call(supabase.rpc('supplier_figures'), readSupplierFigureList);
}
