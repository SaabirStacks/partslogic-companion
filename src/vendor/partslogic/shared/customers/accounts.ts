import type { Json } from '@partslogic/db-types';

import { call, readHistoryEvents, type HistoryEvent } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readBoolean, readNumber, readRecord, readString, type JsonRecord } from '../core/read';
import {
  readAddresses,
  readContacts,
  readSites,
  type PartyAddress,
  type PartyContact,
  type PartySite,
} from '../parties/parties';
import {
  readDiscountRules,
  readPaymentTerms,
  type DiscountRule,
  type PaymentTerms,
  type PaymentTermsKind,
  isPaymentTermsKind,
} from './discounts';
import { isCannotSupplyPreference, type CannotSupplyPreference } from './cannot-supply';
import type { StatusState } from '../core/status';

// Trade accounts: the list, an account's page, opening and saving one, its status, and the check before a sale on
// account. The database checks every rule and role; these only shape what is sent and read back.

export const TRADE_TYPES = [
  'garage',
  'bodyshop',
  'mobile_mechanic',
  'fleet',
  'dealer',
  'motor_factor',
  'taxi',
  'other',
] as const;
export type TradeType = (typeof TRADE_TYPES)[number];

export function isTradeType(value: unknown): value is TradeType {
  return typeof value === 'string' && (TRADE_TYPES as readonly string[]).includes(value);
}

export const CUSTOMER_STATUSES = ['active', 'on_stop', 'closed'] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

// An account's badge state (docs/design-checks/status-colours.md): active can trade, on stop stops work, closed has
// ended. A list shows no badge for Active (owner, 23 November 2026): only the exceptions stand out.
export const CUSTOMER_STATUS_STATES: Record<CustomerStatus, StatusState> = { active: 'ready', on_stop: 'blocked', closed: 'ended' };

export function isCustomerStatus(value: unknown): value is CustomerStatus {
  return typeof value === 'string' && (CUSTOMER_STATUSES as readonly string[]).includes(value);
}

// The list's filter: open is active and on stop together.
export const CUSTOMER_FILTERS = ['open', ...CUSTOMER_STATUSES, 'all'] as const;
export type CustomerFilter = (typeof CUSTOMER_FILTERS)[number];

export function isCustomerFilter(value: unknown): value is CustomerFilter {
  return typeof value === 'string' && (CUSTOMER_FILTERS as readonly string[]).includes(value);
}

// A row of the trade accounts list.
export type CustomerRow = {
  accountId: number;
  // The account's party: how other modules (cores, later sales) point at a trade account.
  partyId: number | null;
  accountNumber: string;
  name: string;
  tradeType: TradeType;
  status: CustomerStatus;
  statusReason: string | null;
  creditLimit: number;
  terms: string;
  termsKind: PaymentTermsKind;
  tier: string | null;
  tierId: number | null;
  contact: { name: string; phone: string | null; email: string | null } | null;
  town: string | null;
  postcode: string | null;
};

export type CustomerList = {
  total: number;
  counts: Record<CustomerStatus, number>;
  // Across the open accounts (active and on stop): how many have credit terms, the credit extended, how many are
  // on a discount tier; and how many retail cards there are.
  totals: { onCredit: number; creditLimit: number; onTier: number; retailCards: number };
  currency: string;
  accounts: CustomerRow[];
};

export type CustomerQuery = {
  search?: string | null;
  status?: CustomerFilter;
  tierId?: number | null;
  limit?: number;
  offset?: number;
};

export type CustomerEvent = HistoryEvent;

// What the account owes comes from sales; until sales are recorded here the balance is 0.
export type CustomerCredit = { limit: number; balance: number; available: number };

export type CustomerTier = {
  id: number;
  name: string;
  description: string | null;
  archived: boolean;
  rules: DiscountRule[];
};

// One trade account's page.
export type CustomerDetail = {
  accountId: number;
  partyId: number;
  accountNumber: string;
  name: string;
  legalName: string | null;
  companyNumber: string | null;
  vatNumber: string | null;
  website: string | null;
  notes: string | null;
  tradeType: TradeType;
  status: CustomerStatus;
  statusReason: string | null;
  statusChangedAt: string | null;
  statusChangedBy: string | null;
  terms: PaymentTerms;
  // When an invoice raised today would be due.
  nextDue: string | null;
  credit: CustomerCredit;
  tier: CustomerTier | null;
  // The account's own deals.
  deals: DiscountRule[];
  orderRefRequired: boolean;
  invoiceEmail: string | null;
  statementEmail: string | null;
  counterNote: string | null;
  // What to do when a supplier can't supply a part (S4b part three): same_part, equivalent, ask or take_off.
  ifCannotSupply: CannotSupplyPreference;
  contacts: PartyContact[];
  addresses: PartyAddress[];
  // Where deliveries go.
  sites: PartySite[];
  events: CustomerEvent[];
  currency: string;
  createdAt: string;
  updatedAt: string;
  can: {
    edit: boolean;
    money: boolean;
    contacts: boolean;
    stop: boolean;
    lift: boolean;
    close: boolean;
    reopen: boolean;
  };
};

// A new account. Terms other than the default, a credit limit and a tier are for admins.
export type NewCustomerAccount = {
  name: string;
  accountNumber?: string | null;
  tradeType?: TradeType;
  termsId?: number | null;
  creditLimit?: number | null;
  tierId?: number | null;
};

// What an account's page saves. Only the fields given change; null or '' clears one.
export type CustomerChanges = {
  name?: string;
  legalName?: string | null;
  companyNumber?: string | null;
  vatNumber?: string | null;
  website?: string | null;
  notes?: string | null;
  tradeType?: TradeType;
  orderRefRequired?: boolean;
  invoiceEmail?: string | null;
  statementEmail?: string | null;
  counterNote?: string | null;
  // Admins only.
  accountNumber?: string;
  termsId?: number;
  creditLimit?: number;
  tierId?: number | null;
};

const CHANGE_KEYS: Record<keyof CustomerChanges, string> = {
  name: 'name',
  legalName: 'legal_name',
  companyNumber: 'company_number',
  vatNumber: 'vat_number',
  website: 'website',
  notes: 'notes',
  tradeType: 'trade_type',
  orderRefRequired: 'order_ref_required',
  invoiceEmail: 'invoice_email',
  statementEmail: 'statement_email',
  counterNote: 'counter_note',
  accountNumber: 'account_number',
  termsId: 'terms_id',
  creditLimit: 'credit_limit',
  tierId: 'tier_id',
};

export function isCustomerChangeKey(key: string): key is keyof CustomerChanges {
  return (Object.keys(CHANGE_KEYS) as string[]).includes(key);
}

export const SALE_BLOCKS = ['closed', 'no_credit', 'on_stop', 'over_limit'] as const;
export type SaleBlock = (typeof SALE_BLOCKS)[number];

// What the counter needs to know before selling to an account, and whether an amount may go on account.
export type CustomerSaleCheck = {
  accountId: number;
  accountNumber: string;
  name: string;
  status: CustomerStatus;
  statusReason: string | null;
  // False for a closed account: no sales at all.
  canSell: boolean;
  terms: PaymentTerms | null;
  dueDate: string | null;
  creditLimit: number;
  balance: number;
  amount: number;
  available: number;
  onAccount: {
    allowed: boolean;
    blockedBy: SaleBlock[];
    // Who may let a blocked sale through, or null when nobody can.
    overrideRole: string | null;
    youCanOverride: boolean;
  };
  orderRefRequired: boolean;
  counterNote: string | null;
  tier: string | null;
};

function readStatus(value: Json | undefined): CustomerStatus {
  return isCustomerStatus(value) ? value : 'active';
}

function readTradeType(value: Json | undefined): TradeType {
  return isTradeType(value) ? value : 'other';
}

function readRow(value: Json | undefined): CustomerRow | null {
  const row = readRecord(value);
  const accountId = readNumber(row?.account_id);
  const accountNumber = readString(row?.account_number);
  const name = readString(row?.name);
  if (!row || accountId == null || !accountNumber || !name) return null;
  const contact = readRecord(row.contact);
  const contactName = readString(contact?.name);
  return {
    accountId,
    partyId: readNumber(row.party_id),
    accountNumber,
    name,
    tradeType: readTradeType(row.trade_type),
    status: readStatus(row.status),
    statusReason: readString(row.status_reason),
    creditLimit: readNumber(row.credit_limit) ?? 0,
    terms: readString(row.terms) ?? '',
    termsKind: isPaymentTermsKind(row.terms_kind) ? row.terms_kind : 'at_sale',
    tier: readString(row.tier),
    tierId: readNumber(row.tier_id),
    contact:
      contact && contactName
        ? { name: contactName, phone: readString(contact.phone), email: readString(contact.email) }
        : null,
    town: readString(row.town),
    postcode: readString(row.postcode),
  };
}

export function readCustomerList(value: Json): CustomerList {
  const row: JsonRecord = readRecord(value) ?? {};
  const counts = readRecord(row.counts);
  const totals = readRecord(row.totals);
  return {
    total: readNumber(row.total) ?? 0,
    totals: {
      onCredit: readNumber(totals?.on_credit) ?? 0,
      creditLimit: readNumber(totals?.credit_limit) ?? 0,
      onTier: readNumber(totals?.on_tier) ?? 0,
      retailCards: readNumber(totals?.retail_cards) ?? 0,
    },
    counts: {
      active: readNumber(counts?.active) ?? 0,
      on_stop: readNumber(counts?.on_stop) ?? 0,
      closed: readNumber(counts?.closed) ?? 0,
    },
    currency: readString(row.currency) ?? 'GBP',
    accounts: readArray(row.accounts).flatMap((item) => readRow(item) ?? []),
  };
}

function readTier(value: Json | undefined): CustomerTier | null {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  const name = readString(row?.name);
  if (!row || id == null || !name) return null;
  return {
    id,
    name,
    description: readString(row.description),
    archived: readBoolean(row.archived) ?? false,
    rules: readDiscountRules(row.rules),
  };
}

export function readCustomerDetail(value: Json): CustomerDetail | null {
  const row = readRecord(value);
  const accountId = readNumber(row?.account_id);
  const partyId = readNumber(row?.party_id);
  const accountNumber = readString(row?.account_number);
  const name = readString(row?.name);
  const terms = readPaymentTerms(row?.terms);
  const createdAt = readString(row?.created_at);
  if (!row || accountId == null || partyId == null || !accountNumber || !name || !terms || !createdAt) return null;
  const credit = readRecord(row.credit);
  const can = readRecord(row.can);
  const flag = (key: string) => readBoolean(can?.[key]) ?? false;
  return {
    accountId,
    partyId,
    accountNumber,
    name,
    legalName: readString(row.legal_name),
    companyNumber: readString(row.company_number),
    vatNumber: readString(row.vat_number),
    website: readString(row.website),
    notes: readString(row.notes),
    tradeType: readTradeType(row.trade_type),
    status: readStatus(row.status),
    statusReason: readString(row.status_reason),
    statusChangedAt: readString(row.status_changed_at),
    statusChangedBy: readString(row.status_changed_by),
    terms,
    nextDue: readString(row.next_due),
    credit: {
      limit: readNumber(credit?.limit) ?? 0,
      balance: readNumber(credit?.balance) ?? 0,
      available: readNumber(credit?.available) ?? 0,
    },
    tier: readTier(row.tier),
    deals: readDiscountRules(row.deals),
    orderRefRequired: readBoolean(row.order_ref_required) ?? false,
    invoiceEmail: readString(row.invoice_email),
    statementEmail: readString(row.statement_email),
    counterNote: readString(row.counter_note),
    ifCannotSupply: isCannotSupplyPreference(row.if_cannot_supply) ? row.if_cannot_supply : 'ask',
    contacts: readContacts(row.contacts),
    addresses: readAddresses(row.addresses),
    sites: readSites(row.addresses),
    events: readHistoryEvents(row.events),
    currency: readString(row.currency) ?? 'GBP',
    createdAt,
    updatedAt: readString(row.updated_at) ?? createdAt,
    can: {
      edit: flag('edit'),
      money: flag('money'),
      contacts: flag('contacts'),
      stop: flag('stop'),
      lift: flag('lift'),
      close: flag('close'),
      reopen: flag('reopen'),
    },
  };
}

export function readCustomerSaleCheck(value: Json): CustomerSaleCheck {
  const row: JsonRecord = readRecord(value) ?? {};
  const onAccount = readRecord(row.on_account);
  return {
    accountId: readNumber(row.account_id) ?? 0,
    accountNumber: readString(row.account_number) ?? '',
    name: readString(row.name) ?? '',
    status: readStatus(row.status),
    statusReason: readString(row.status_reason),
    canSell: readBoolean(row.can_sell) ?? false,
    terms: readPaymentTerms(row.terms),
    dueDate: readString(row.due_date),
    creditLimit: readNumber(row.credit_limit) ?? 0,
    balance: readNumber(row.balance) ?? 0,
    amount: readNumber(row.amount) ?? 0,
    available: readNumber(row.available) ?? 0,
    onAccount: {
      allowed: readBoolean(onAccount?.allowed) ?? false,
      blockedBy: readArray(onAccount?.blocked_by).filter((item): item is SaleBlock =>
        (SALE_BLOCKS as readonly Json[]).includes(item),
      ),
      overrideRole: readString(onAccount?.override_role),
      youCanOverride: readBoolean(onAccount?.you_can_override) ?? false,
    },
    orderRefRequired: readBoolean(row.order_ref_required) ?? false,
    counterNote: readString(row.counter_note),
    tier: readString(row.tier),
  };
}

// Shared by the account's setters, which all hand back the account as it now stands.
export function requireDetail(what: string) {
  return (data: Json): CustomerDetail => {
    const detail = readCustomerDetail(data);
    if (!detail) throw new Error(`The account could not be read back after ${what}.`);
    return detail;
  };
}

// The trade accounts list: open accounts by default, searched by name, number, contact or postcode.
export async function listCustomers(supabase: Client, query: CustomerQuery = {}): Promise<CustomerList> {
  return call(
    supabase.rpc('customer_list', {
      p_search: query.search?.trim() || undefined,
      p_status: query.status ?? 'open',
      p_tier: query.tierId ?? undefined,
      p_limit: query.limit ?? 50,
      p_offset: query.offset ?? 0,
    }),
    readCustomerList,
  );
}

// One trade account's page, or null when the id isn't an account.
export async function getCustomer(supabase: Client, accountId: number): Promise<CustomerDetail | null> {
  return call(supabase.rpc('customer_detail', { p_account: accountId }), (data) =>
    data == null ? null : readCustomerDetail(data),
  );
}

// Opens a trade account (editors; terms, a limit or a tier need an admin). Returns its id.
export async function createCustomerAccount(supabase: Client, account: NewCustomerAccount): Promise<number> {
  const p: Record<string, Json> = { name: account.name };
  if (account.accountNumber) p.account_number = account.accountNumber;
  if (account.tradeType) p.trade_type = account.tradeType;
  if (account.termsId != null) p.terms_id = account.termsId;
  if (account.creditLimit != null) p.credit_limit = account.creditLimit;
  if (account.tierId != null) p.tier_id = account.tierId;
  return call(supabase.rpc('create_customer_account', { p }), (data) => {
    const id = readNumber(data as Json);
    if (id == null) throw new Error('The account was opened but its id could not be read.');
    return id;
  });
}

// Saves an account's details (editors), or its number, terms, credit limit and tier (admins).
export async function saveCustomerAccount(
  supabase: Client,
  accountId: number,
  changes: CustomerChanges,
): Promise<CustomerDetail> {
  const p: Record<string, Json> = { account_id: accountId };
  for (const key of Object.keys(CHANGE_KEYS) as (keyof CustomerChanges)[]) {
    const value = changes[key];
    if (value !== undefined) p[CHANGE_KEYS[key]] = value;
  }
  return call(supabase.rpc('save_customer_account', { p }), requireDetail('saving'));
}

// Puts an account on stop (editors, with a reason), lifts the stop, closes or reopens it (admins).
export async function setCustomerStatus(
  supabase: Client,
  accountId: number,
  status: CustomerStatus,
  reason?: string | null,
): Promise<CustomerDetail> {
  return call(
    supabase.rpc('set_customer_status', {
      p_account: accountId,
      p_status: status,
      p_reason: reason?.trim() || undefined,
    }),
    requireDetail('changing its status'),
  );
}

// Whether an amount (with VAT) may go on an account, and what the counter should know first.
export async function checkCustomerSale(supabase: Client, accountId: number, amount = 0): Promise<CustomerSaleCheck> {
  return call(supabase.rpc('customer_sale_check', { p_account: accountId, p_amount: amount }), readCustomerSaleCheck);
}
