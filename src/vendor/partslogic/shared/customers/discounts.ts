import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readBoolean, readNumber, readRecord, readString, type JsonRecord } from '../core/read';

// Payment terms, discount tiers and their rules, an account's own deals, and what an account pays for a part. The
// database holds every rule (which rule wins, who may change what); these only shape what is sent and read back.

export const PAYMENT_TERMS_KINDS = ['at_sale', 'days_after_invoice', 'day_of_next_month'] as const;
export type PaymentTermsKind = (typeof PAYMENT_TERMS_KINDS)[number];

export function isPaymentTermsKind(value: unknown): value is PaymentTermsKind {
  return typeof value === 'string' && (PAYMENT_TERMS_KINDS as readonly string[]).includes(value);
}

// days: none for at_sale; days after the invoice; or the day of the following month (31 is its last day).
export type PaymentTerms = {
  id: number;
  name: string;
  kind: PaymentTermsKind;
  days: number;
  isDefault: boolean;
  archived: boolean;
  // How many accounts use them (set-up lists only).
  accounts: number;
};

export type PaymentTermsInput = {
  id?: number;
  name?: string;
  kind?: PaymentTermsKind;
  days?: number;
  isDefault?: boolean;
  archived?: boolean;
};

export const DISCOUNT_SCOPES = ['all', 'brand', 'category', 'part'] as const;
export type DiscountScope = (typeof DISCOUNT_SCOPES)[number];
export const DISCOUNT_KINDS = ['percent_off', 'fixed_price'] as const;
export type DiscountKind = (typeof DISCOUNT_KINDS)[number];

export function isDiscountScope(value: unknown): value is DiscountScope {
  return typeof value === 'string' && (DISCOUNT_SCOPES as readonly string[]).includes(value);
}

export function isDiscountKind(value: unknown): value is DiscountKind {
  return typeof value === 'string' && (DISCOUNT_KINDS as readonly string[]).includes(value);
}

// A tier's rule or an account's deal. value: a fraction for percent_off (0.15 is 15%), a price without VAT for
// fixed_price. live: whether it applies today.
export type DiscountRule = {
  id: number;
  owner: 'tier' | 'account';
  scope: DiscountScope;
  scopeId: number | null;
  label: string;
  kind: DiscountKind;
  value: number;
  minQty: number;
  startsOn: string | null;
  endsOn: string | null;
  note: string | null;
  live: boolean;
};

// A rule to add (with tierId or accountId, and what it covers) or to change (with id: what it covers stays).
export type DiscountRuleInput = {
  id?: number;
  tierId?: number;
  accountId?: number;
  scope?: DiscountScope;
  scopeId?: number | null;
  kind: DiscountKind;
  value: number;
  minQty?: number;
  startsOn?: string | null;
  endsOn?: string | null;
  note?: string | null;
};

export type DiscountTier = {
  id: number;
  name: string;
  description: string | null;
  archived: boolean;
  accounts: number;
  rules: DiscountRule[];
};

export type DiscountTierInput = { id?: number; name?: string; description?: string | null; archived?: boolean };

export type RetailClearing = { at: string; cards: number; reason: 'request' | 'expired'; by: string };

// What the customer screens offer and set up.
export type CustomerSetup = {
  terms: PaymentTerms[];
  tiers: DiscountTier[];
  tradeTypes: string[];
  retail: { keepMonths: number; expired: number; lastCleared: RetailClearing | null };
  currency: string;
  can: { money: boolean; edit: boolean; cards: boolean };
};

// What an account pays for a part, and why.
export type CustomerPrice = {
  accountId: number;
  partId: number;
  brand: string | null;
  number: string;
  qty: number;
  on: string;
  // The trade price for that quantity; null when the part has none.
  listPrice: number | null;
  price: number | null;
  saving: number | null;
  rule: DiscountRule | null;
  // The rule would have put the price above the trade price, so the trade price applies.
  capped: boolean;
  cost: number | null;
  margin: number | null;
  minMargin: number | null;
  belowMinMargin: boolean;
  belowCost: boolean;
  currency: string;
};

export function readPaymentTerms(value: Json | undefined): PaymentTerms | null {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  const name = readString(row?.name);
  if (!row || id == null || !name || !isPaymentTermsKind(row.kind)) return null;
  return {
    id,
    name,
    kind: row.kind,
    days: readNumber(row.days) ?? 0,
    isDefault: readBoolean(row.is_default) ?? false,
    archived: readBoolean(row.archived) ?? false,
    accounts: readNumber(row.accounts) ?? 0,
  };
}

export function readDiscountRule(value: Json | undefined): DiscountRule | null {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  const amount = readNumber(row?.value);
  if (!row || id == null || amount == null || !isDiscountScope(row.scope) || !isDiscountKind(row.kind)) return null;
  return {
    id,
    owner: row.owner === 'account' ? 'account' : 'tier',
    scope: row.scope,
    scopeId: readNumber(row.scope_id),
    label: readString(row.label) ?? 'Everything',
    kind: row.kind,
    value: amount,
    minQty: readNumber(row.min_qty) ?? 1,
    startsOn: readString(row.starts_on),
    endsOn: readString(row.ends_on),
    note: readString(row.note),
    live: readBoolean(row.live) ?? true,
  };
}

export function readDiscountRules(value: Json | undefined): DiscountRule[] {
  return readArray(value).flatMap((item) => readDiscountRule(item) ?? []);
}

export function readDiscountTier(value: Json | undefined): DiscountTier | null {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  const name = readString(row?.name);
  if (!row || id == null || !name) return null;
  return {
    id,
    name,
    description: readString(row.description),
    archived: readBoolean(row.archived) ?? false,
    accounts: readNumber(row.accounts) ?? 0,
    rules: readDiscountRules(row.rules),
  };
}

function readClearing(value: Json | undefined): RetailClearing | null {
  const row = readRecord(value);
  const at = readString(row?.at);
  if (!row || !at) return null;
  return {
    at,
    cards: readNumber(row.cards) ?? 0,
    reason: row.reason === 'expired' ? 'expired' : 'request',
    by: readString(row.by) ?? 'Someone',
  };
}

export function readCustomerSetup(value: Json): CustomerSetup {
  const row: JsonRecord = readRecord(value) ?? {};
  const retail = readRecord(row.retail);
  const can = readRecord(row.can);
  return {
    terms: readArray(row.terms).flatMap((item) => readPaymentTerms(item) ?? []),
    tiers: readArray(row.tiers).flatMap((item) => readDiscountTier(item) ?? []),
    tradeTypes: readArray(row.trade_types).filter((item): item is string => typeof item === 'string'),
    retail: {
      keepMonths: readNumber(retail?.keep_months) ?? 36,
      expired: readNumber(retail?.expired) ?? 0,
      lastCleared: readClearing(retail?.last_cleared),
    },
    currency: readString(row.currency) ?? 'GBP',
    can: {
      money: readBoolean(can?.money) ?? false,
      edit: readBoolean(can?.edit) ?? false,
      cards: readBoolean(can?.cards) ?? false,
    },
  };
}

export function readCustomerPrice(value: Json): CustomerPrice {
  const row: JsonRecord = readRecord(value) ?? {};
  return {
    accountId: readNumber(row.account_id) ?? 0,
    partId: readNumber(row.part_id) ?? 0,
    brand: readString(row.brand),
    number: readString(row.number) ?? '',
    qty: readNumber(row.qty) ?? 1,
    on: readString(row.on) ?? '',
    listPrice: readNumber(row.list_price),
    price: readNumber(row.price),
    saving: readNumber(row.saving),
    rule: readDiscountRule(row.rule),
    capped: readBoolean(row.capped) ?? false,
    cost: readNumber(row.cost),
    margin: readNumber(row.margin),
    minMargin: readNumber(row.min_margin),
    belowMinMargin: readBoolean(row.below_min_margin) ?? false,
    belowCost: readBoolean(row.below_cost) ?? false,
    currency: readString(row.currency) ?? 'GBP',
  };
}

// What a rule gives, in words: "15% off" or "£12.50 each".
export function discountText(rule: Pick<DiscountRule, 'kind' | 'value'>, money: (amount: number) => string): string {
  if (rule.kind === 'fixed_price') return `${money(rule.value)} each`;
  return `${Math.round(rule.value * 10000) / 100}% off`;
}

// The terms in words: "Pay at the time", "30 days after the invoice", "The 20th of the following month".
export function paymentTermsText(terms: Pick<PaymentTerms, 'kind' | 'days'>): string {
  if (terms.kind === 'at_sale') return 'Paid at the time, no credit';
  if (terms.kind === 'days_after_invoice')
    return `${terms.days} ${terms.days === 1 ? 'day' : 'days'} after the invoice`;
  if (terms.days >= 31) return 'The last day of the following month';
  const suffix =
    terms.days % 10 === 1 && terms.days !== 11
      ? 'st'
      : terms.days % 10 === 2 && terms.days !== 12
        ? 'nd'
        : terms.days % 10 === 3 && terms.days !== 13
          ? 'rd'
          : 'th';
  return `The ${terms.days}${suffix} of the following month`;
}

// Payment terms, discount tiers with their rules, trade types and the retail keeping time (any member).
export async function getCustomerSetup(supabase: Client): Promise<CustomerSetup> {
  return call(supabase.rpc('customer_setup'), readCustomerSetup);
}

// Adds payment terms or changes them (admins). Returns the set-up.
export async function savePaymentTerms(supabase: Client, terms: PaymentTermsInput): Promise<CustomerSetup> {
  const p: Record<string, Json> = {};
  if (terms.id != null) p.id = terms.id;
  if (terms.name !== undefined) p.name = terms.name;
  if (terms.kind !== undefined) p.kind = terms.kind;
  if (terms.days !== undefined) p.days = terms.days;
  if (terms.isDefault !== undefined) p.is_default = terms.isDefault;
  if (terms.archived !== undefined) p.archived = terms.archived;
  return call(supabase.rpc('save_payment_terms', { p }), readCustomerSetup);
}

// Adds a discount tier or changes one (admins). Returns the set-up.
export async function saveDiscountTier(supabase: Client, tier: DiscountTierInput): Promise<CustomerSetup> {
  const p: Record<string, Json> = {};
  if (tier.id != null) p.id = tier.id;
  if (tier.name !== undefined) p.name = tier.name;
  if (tier.description !== undefined) p.description = tier.description;
  if (tier.archived !== undefined) p.archived = tier.archived;
  return call(supabase.rpc('save_discount_tier', { p }), readCustomerSetup);
}

// Adds a rule to a tier or a deal to an account, or changes one (admins). Returns that tier's rules or that
// account's deals.
export async function saveDiscountRule(supabase: Client, rule: DiscountRuleInput): Promise<DiscountRule[]> {
  const p: Record<string, Json> = { kind: rule.kind, value: rule.value };
  if (rule.id != null) p.id = rule.id;
  if (rule.tierId != null) p.tier_id = rule.tierId;
  if (rule.accountId != null) p.account_id = rule.accountId;
  if (rule.scope !== undefined) p.scope = rule.scope;
  if (rule.scopeId != null) p.scope_id = rule.scopeId;
  if (rule.minQty !== undefined) p.min_qty = rule.minQty;
  if (rule.startsOn !== undefined) p.starts_on = rule.startsOn;
  if (rule.endsOn !== undefined) p.ends_on = rule.endsOn;
  if (rule.note !== undefined) p.note = rule.note;
  return call(supabase.rpc('save_discount_rule', { p }), readDiscountRules);
}

// Removes a rule or a deal (admins). Returns the ones left.
export async function removeDiscountRule(supabase: Client, ruleId: number): Promise<DiscountRule[]> {
  return call(supabase.rpc('remove_discount_rule', { p_id: ruleId }), readDiscountRules);
}

// What an account pays for a part in your range, for a quantity (any member).
export async function getCustomerPrice(
  supabase: Client,
  accountId: number,
  partId: number,
  qty = 1,
): Promise<CustomerPrice> {
  return call(supabase.rpc('customer_price', { p_account: accountId, p_part: partId, p_qty: qty }), readCustomerPrice);
}

// How many months a retail card is kept after it was last used (admins). Returns the set-up.
export async function saveCustomerSettings(
  supabase: Client,
  settings: { retailKeepMonths: number },
): Promise<CustomerSetup> {
  return call(
    supabase.rpc('save_customer_settings', { p: { retail_keep_months: settings.retailKeepMonths } }),
    readCustomerSetup,
  );
}
