import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readBoolean, readNumber, readRecord, readString, type JsonRecord } from '../core/read';
import type { StatusState } from '../core/status';

// Exchange cores (docs/RETURNS_AND_CORES.md, step 16): surcharges paid to suppliers, owed back to us, and the old units
// that settle them. Every rule lives in SQL (core_list, book_in_cores, send_cores and the rest); this file shapes what
// is read and sent.

export const CORE_STATUSES = [
  'received',
  'refused',
  'accepted',
  'on_return',
  'with_supplier',
  'credited',
  'rejected',
] as const;
export type CoreStatus = (typeof CORE_STATUSES)[number];

// Each core's badge state (docs/design-checks/status-colours.md): to check or on our shelf is our move, on a return or
// with the supplier is waiting, credited is done, failed or rejected stops it.
export const CORE_STATUS_STATES: Record<CoreStatus, StatusState> = {
  received: 'active',
  refused: 'blocked',
  accepted: 'active',
  on_return: 'waiting',
  with_supplier: 'waiting',
  credited: 'ready',
  rejected: 'blocked',
};

export const CORE_VIEWS = ['to_check', 'on_shelf', 'sent', 'done', 'open', 'all'] as const;
export type CoreView = (typeof CORE_VIEWS)[number];

export function isCoreView(value: unknown): value is CoreView {
  return typeof value === 'string' && (CORE_VIEWS as readonly string[]).includes(value);
}

// Why an old unit fails our check.
export const CORE_REFUSE_REASONS = [
  'cracked_casing',
  'damaged_threads',
  'damaged_fittings',
  'incomplete',
  'seized',
  'contaminated',
  'wrong_part',
  'other',
] as const;
export type CoreRefuseReason = (typeof CORE_REFUSE_REASONS)[number];

export function isCoreRefuseReason(value: unknown): value is CoreRefuseReason {
  return typeof value === 'string' && (CORE_REFUSE_REASONS as readonly string[]).includes(value);
}

export type OldUnit = {
  id: number;
  tag: string;
  status: CoreStatus;
  part: { id: number; brand: string | null; number: string; description: string | null };
  supplier: { id: number; name: string };
  location: { id: number; code: string };
  // A trade account's party (account true), or a typed name.
  customer: { partyId: number | null; name: string | null; account: boolean };
  ourInvoice: string | null;
  note: string | null;
  receivedAt: string;
  receivedBy: string;
  daysHeld: number;
  check: { passed: boolean; reason: CoreRefuseReason | null; note: string | null; at: string; by: string } | null;
  return: { id: string; number: string; status: string; lineId: number } | null;
  // The surcharge it should bring back: its line's, else the supplier's oldest open one for the part.
  surcharge: number | null;
  credited: number | null;
};

export type CoreRule = { sendAtCount: number; sendAfterDays: number };

// One supplier's old units and surcharges (purchasing.supplier_cores): on the cores page and the supplier's page.
export type CoreFigures = {
  onShelf: number;
  oldestAt: string | null;
  rule: CoreRule & { own: boolean };
  // Their shelf has reached the rule: book a collection.
  timeToSend: boolean;
  withSupplier: number;
  owedUnits: number;
  owedValue: number;
  overdueUnits: number;
  overdueValue: number;
  // Days a supplier gives us to send an old unit back; null: no limit set.
  windowDays: number | null;
};

export type CoreSupplier = CoreFigures & { id: number; name: string };

export type CoreList = {
  counts: { toCheck: number; onShelf: number; sent: number; done: number };
  cores: OldUnit[];
  suppliers: CoreSupplier[];
  rule: CoreRule;
  currency: string;
  can: { book: boolean; edit: boolean };
};

export type CoreDeposit = {
  supplier: { id: number; name: string };
  receipt: { id: string; number: string; receivedAt: string };
  part: { id: number; brand: string | null; number: string };
  qty: number;
  unitSurcharge: number;
  basis: 'order' | 'sheet';
  lost: number;
  claimed: number;
  open: number;
  openValue: number;
  dueOn: string | null;
  overdue: boolean;
  losses: { id: number; qty: number; value: number; note: string; at: string; by: string }[];
};

// Booking old units in: the part, where, how many, and optionally who for, our invoice, a note and our check.
export type NewOldUnits = {
  partId: number;
  locationId: number;
  qty?: number;
  supplierId?: number;
  customerPartyId?: number | null;
  customerName?: string | null;
  ourInvoice?: string | null;
  note?: string | null;
  passed?: boolean | null;
  refuseReason?: CoreRefuseReason | null;
  checkNote?: string | null;
};

export type CoreCheck = { passed: boolean | null; refuseReason?: CoreRefuseReason | null; checkNote?: string | null };

export type OldUnitChanges = {
  supplierId?: number;
  customerPartyId?: number | null;
  customerName?: string | null;
  ourInvoice?: string | null;
  note?: string | null;
};

const num = (value: Json | undefined) => readNumber(value) ?? 0;

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}

export function readOldUnit(value: Json | undefined): OldUnit | null {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  const tag = readString(row?.tag);
  const part = readRecord(row?.part);
  const partId = readNumber(part?.id);
  const supplier = readRecord(row?.supplier);
  const supplierId = readNumber(supplier?.id);
  const location = readRecord(row?.location);
  if (
    !row ||
    id == null ||
    !tag ||
    !isOneOf(CORE_STATUSES, row.status) ||
    !part ||
    partId == null ||
    supplierId == null
  ) {
    return null;
  }
  const customer = readRecord(row.customer);
  const check = readRecord(row.check);
  const ret = readRecord(row.return);
  const retId = readString(ret?.id);
  return {
    id,
    tag,
    status: row.status,
    part: {
      id: partId,
      brand: readString(part.brand),
      number: readString(part.number) ?? '',
      description: readString(part.description),
    },
    supplier: { id: supplierId, name: readString(supplier?.name) ?? '' },
    location: { id: readNumber(location?.id) ?? 0, code: readString(location?.code) ?? '' },
    customer: {
      partyId: readNumber(customer?.party_id),
      name: readString(customer?.name),
      account: readBoolean(customer?.account) ?? false,
    },
    ourInvoice: readString(row.our_invoice),
    note: readString(row.note),
    receivedAt: readString(row.received_at) ?? '',
    receivedBy: readString(row.received_by) ?? 'Someone',
    daysHeld: num(row.days_held),
    check: check
      ? {
          passed: readBoolean(check.passed) ?? false,
          reason: isCoreRefuseReason(check.reason) ? check.reason : null,
          note: readString(check.note),
          at: readString(check.at) ?? '',
          by: readString(check.by) ?? 'Someone',
        }
      : null,
    return:
      ret && retId
        ? {
            id: retId,
            number: readString(ret.number) ?? '',
            status: readString(ret.status) ?? '',
            lineId: num(ret.line_id),
          }
        : null,
    surcharge: readNumber(row.surcharge),
    credited: readNumber(row.credited),
  };
}

function readRule(value: Json | undefined): CoreRule {
  const row = readRecord(value);
  return { sendAtCount: readNumber(row?.send_at_count) ?? 10, sendAfterDays: readNumber(row?.send_after_days) ?? 14 };
}

export function readCoreFigures(value: Json | undefined): CoreFigures | null {
  const s = readRecord(value);
  if (!s) return null;
  return {
    onShelf: num(s.on_shelf),
    oldestAt: readString(s.oldest_at),
    rule: { ...readRule(s.rule), own: readBoolean(readRecord(s.rule)?.own) ?? false },
    timeToSend: readBoolean(s.time_to_send) ?? false,
    withSupplier: num(s.with_supplier),
    owedUnits: num(s.owed_units),
    owedValue: num(s.owed_value),
    overdueUnits: num(s.overdue_units),
    overdueValue: num(s.overdue_value),
    windowDays: readNumber(s.window_days),
  };
}

export function readCoreList(value: Json): CoreList {
  const row: JsonRecord = readRecord(value) ?? {};
  const counts = readRecord(row.counts);
  const can = readRecord(row.can);
  return {
    counts: {
      toCheck: num(counts?.to_check),
      onShelf: num(counts?.on_shelf),
      sent: num(counts?.sent),
      done: num(counts?.done),
    },
    cores: readArray(row.cores).flatMap((item) => readOldUnit(item) ?? []),
    suppliers: readArray(row.suppliers).flatMap((item) => {
      const s = readRecord(item);
      const id = readNumber(s?.id);
      const figures = readCoreFigures(item);
      return s && id != null && figures ? [{ id, name: readString(s.name) ?? '', ...figures }] : [];
    }),
    rule: readRule(row.rule),
    currency: readString(row.currency) ?? 'GBP',
    can: { book: readBoolean(can?.book) ?? false, edit: readBoolean(can?.edit) ?? false },
  };
}

export function readCoreDeposits(value: Json): CoreDeposit[] {
  return readArray(value).flatMap((item) => {
    const row = readRecord(item);
    const supplier = readRecord(row?.supplier);
    const receipt = readRecord(row?.receipt);
    const part = readRecord(row?.part);
    const supplierId = readNumber(supplier?.id);
    const receiptId = readString(receipt?.id);
    const partId = readNumber(part?.id);
    if (!row || supplierId == null || !receiptId || partId == null) return [];
    return [
      {
        supplier: { id: supplierId, name: readString(supplier?.name) ?? '' },
        receipt: {
          id: receiptId,
          number: readString(receipt?.number) ?? '',
          receivedAt: readString(receipt?.received_at) ?? '',
        },
        part: { id: partId, brand: readString(part?.brand), number: readString(part?.number) ?? '' },
        qty: num(row.qty),
        unitSurcharge: num(row.unit_surcharge),
        basis: row.basis === 'order' ? 'order' : 'sheet',
        lost: num(row.lost),
        claimed: num(row.claimed),
        open: num(row.open),
        openValue: num(row.open_value),
        dueOn: readString(row.due_on),
        overdue: readBoolean(row.overdue) ?? false,
        losses: readArray(row.losses).flatMap((entry) => {
          const loss = readRecord(entry);
          const lossId = readNumber(loss?.id);
          if (!loss || lossId == null) return [];
          return [
            {
              id: lossId,
              qty: num(loss.qty),
              value: num(loss.value),
              note: readString(loss.note) ?? '',
              at: readString(loss.at) ?? '',
              by: readString(loss.by) ?? 'Someone',
            },
          ];
        }),
      },
    ];
  });
}

function requireUnit(data: Json): OldUnit {
  const unit = readOldUnit(data);
  if (!unit) throw new Error('The old unit could not be read back.');
  return unit;
}

// The cores page: old units by view (open by default), the shelf by supplier, and what suppliers owe us.
export async function listCores(
  supabase: Client,
  query: { view?: CoreView; supplierId?: number | null; search?: string | null } = {},
): Promise<CoreList> {
  return call(
    supabase.rpc('core_list', {
      p_view: query.view ?? 'open',
      p_source: query.supplierId ?? undefined,
      p_search: query.search?.trim() || undefined,
    }),
    readCoreList,
  );
}

// Surcharges paid to suppliers, by delivery and part: those still owed back, or all.
export async function listCoreDeposits(
  supabase: Client,
  supplierId?: number | null,
  openOnly = true,
): Promise<CoreDeposit[]> {
  return call(
    supabase.rpc('core_deposit_list', { p_source: supplierId ?? undefined, p_open: openOnly }),
    readCoreDeposits,
  );
}

// Books old units in (counter). Returns the units, each with its own tag.
export async function bookInCores(supabase: Client, units: NewOldUnits): Promise<OldUnit[]> {
  const p: Record<string, Json> = { part_id: units.partId, location_id: units.locationId };
  if (units.qty != null) p.qty = units.qty;
  if (units.supplierId != null) p.source_id = units.supplierId;
  if (units.customerPartyId != null) p.customer_party_id = units.customerPartyId;
  if (units.customerName) p.customer_name = units.customerName;
  if (units.ourInvoice) p.our_invoice = units.ourInvoice;
  if (units.note) p.note = units.note;
  if (units.passed != null) {
    p.passed = units.passed;
    if (units.refuseReason) p.refuse_reason = units.refuseReason;
    if (units.checkNote) p.check_note = units.checkNote;
  }
  return call(supabase.rpc('book_in_cores', { p }), (data) =>
    readArray(data).flatMap((item) => readOldUnit(item) ?? []),
  );
}

// Our check (counter): passed, or failed with a reason; null to check it again.
export async function checkCore(supabase: Client, coreId: number, check: CoreCheck): Promise<OldUnit> {
  const p: Record<string, Json> = { passed: check.passed };
  if (check.refuseReason) p.refuse_reason = check.refuseReason;
  if (check.checkNote) p.check_note = check.checkNote;
  return call(supabase.rpc('check_core', { p_core: coreId, p }), requireUnit);
}

export async function saveCore(supabase: Client, coreId: number, changes: OldUnitChanges): Promise<OldUnit> {
  const p: Record<string, Json> = {};
  if (changes.supplierId != null) p.source_id = changes.supplierId;
  if (changes.customerPartyId !== undefined) p.customer_party_id = changes.customerPartyId;
  if (changes.customerName !== undefined) p.customer_name = changes.customerName;
  if (changes.ourInvoice !== undefined) p.our_invoice = changes.ourInvoice;
  if (changes.note !== undefined) p.note = changes.note;
  return call(supabase.rpc('save_core', { p_core: coreId, p }), requireUnit);
}

export async function deleteCore(supabase: Client, coreId: number): Promise<void> {
  await call(supabase.rpc('delete_core', { p_core: coreId }), () => undefined);
}

// Puts accepted old units on each supplier's draft return (counter). Returns the returns touched.
export async function sendCores(
  supabase: Client,
  coreIds: number[],
): Promise<{ id: string; number: string; cores: number }[]> {
  return call(supabase.rpc('send_cores', { p_cores: coreIds }), (data) =>
    readArray(data).flatMap((item) => {
      const row = readRecord(item);
      const id = readString(row?.document_id);
      if (!row || !id) return [];
      return [{ id, number: readString(row.number) ?? '', cores: num(row.cores) }];
    }),
  );
}

// Writes off units of a delivery's surcharge that won't come back (editors). Returns that supplier's open ones.
export async function writeOffCoreDeposit(
  supabase: Client,
  input: { supplierId: number; receiptId: string; partId: number; qty?: number; note: string },
): Promise<CoreDeposit[]> {
  const p: Record<string, Json> = {
    source_id: input.supplierId,
    receipt_id: input.receiptId,
    part_id: input.partId,
    note: input.note,
  };
  if (input.qty != null) p.qty = input.qty;
  return call(supabase.rpc('write_off_core_deposit', { p }), readCoreDeposits);
}

export async function undoCoreDepositLoss(supabase: Client, lossId: number): Promise<CoreDeposit[]> {
  return call(supabase.rpc('undo_core_deposit_loss', { p_loss: lossId }), readCoreDeposits);
}

// When to book a collection: the company's rule (no supplier), or a supplier's own (null to follow the company's).
export async function saveCoreRule(supabase: Client, supplierId: number | null, rule: CoreRule | null) {
  return call(
    supabase.rpc('save_core_rule', {
      p_source: supplierId as number,
      p: (rule ? { send_at_count: rule.sendAtCount, send_after_days: rule.sendAfterDays } : null) as Json,
    }),
    (data) => ({ ...readRule(data), own: readBoolean(readRecord(data)?.own) ?? false }),
  );
}
