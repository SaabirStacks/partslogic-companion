import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { dataError } from '../core/errors';
import type { Page } from '../core/page';
import { readNumber, readRecord, readString, type JsonRecord } from '../core/read';
import { readAddresses, readContacts, type PartyAddress, type PartyContact } from '../parties/parties';
import { readDeliveryTerms, type DeliveryTerms } from './delivery-terms';
import { readSupplierUpload, type SupplierUpload } from './supplier-options';

export const SUPPLIER_STATUSES = ['active', 'on_hold', 'archived'] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

export function isSupplierStatus(value: unknown): value is SupplierStatus {
  return typeof value === 'string' && (SUPPLIER_STATUSES as readonly string[]).includes(value);
}

// The newest goods receipt that names a supplier.
export type SupplierDelivery = { documentId: string; number: string; reference: string | null; createdAt: string };

// A row of the Suppliers list.
export type SupplierRow = {
  supplierId: number;
  name: string;
  shortCode: string | null;
  status: SupplierStatus;
  accountNumber: string | null;
  linesListed: number;
  lastSheet: SupplierUpload | null;
  lastDelivery: SupplierDelivery | null;
};

// One supplier's page: who they are, the supplier role, its activity, and the party's contacts and addresses.
export type SupplierDetail = SupplierRow & {
  partyId: number;
  // Carriage, free delivery, minimum order, how to order and delivery runs.
  delivery: DeliveryTerms;
  contacts: PartyContact[];
  addresses: PartyAddress[];
  legalName: string | null;
  companyNumber: string | null;
  vatNumber: string | null;
  website: string | null;
  notes: string | null;
  statusReason: string | null;
  statusChangedAt: string | null;
  statusChangedBy: string | null;
  linesInRange: number;
  createdAt: string;
  updatedAt: string;
};

export type SupplierQuery = {
  search?: string | null;
  status?: SupplierStatus | 'all';
  limit?: number;
  offset?: number;
};

// The details a supplier's page saves. Only the fields given change; null or '' clears one.
export type SupplierChanges = {
  name?: string;
  legalName?: string | null;
  shortCode?: string | null;
  companyNumber?: string | null;
  vatNumber?: string | null;
  website?: string | null;
  notes?: string | null;
  accountNumber?: string | null;
};

const CHANGE_KEYS: Record<keyof SupplierChanges, string> = {
  name: 'name',
  legalName: 'legal_name',
  shortCode: 'short_code',
  companyNumber: 'company_number',
  vatNumber: 'vat_number',
  website: 'website',
  notes: 'notes',
  accountNumber: 'account_number',
};

export function isSupplierChangeKey(key: string): key is keyof SupplierChanges {
  return (Object.keys(CHANGE_KEYS) as string[]).includes(key);
}

function readStatus(value: Json | undefined): SupplierStatus {
  return isSupplierStatus(value) ? value : 'active';
}

function readDelivery(value: Json | undefined): SupplierDelivery | null {
  const delivery = readRecord(value);
  const documentId = readString(delivery?.document_id);
  const number = readString(delivery?.number);
  const createdAt = readString(delivery?.created_at);
  if (!documentId || !number || !createdAt) return null;
  return { documentId, number, reference: readString(delivery?.reference), createdAt };
}

// The fields supplier_list and supplier_detail share.
function readRow(row: JsonRecord | null): SupplierRow | null {
  const supplierId = readNumber(row?.source_id);
  const name = readString(row?.name);
  if (!row || supplierId == null || !name) return null;
  return {
    supplierId,
    name,
    shortCode: readString(row.short_code),
    status: readStatus(row.status),
    accountNumber: readString(row.account_number),
    linesListed: readNumber(row.lines_listed) ?? 0,
    lastSheet: readSupplierUpload(row.last_upload),
    lastDelivery: readDelivery(row.last_delivery),
  };
}

function readDetail(value: Json): SupplierDetail | null {
  const row = readRecord(value);
  const base = readRow(row);
  const partyId = readNumber(row?.party_id);
  const createdAt = readString(row?.created_at);
  if (!row || !base || partyId == null || !createdAt) return null;
  return {
    ...base,
    partyId,
    legalName: readString(row.legal_name),
    companyNumber: readString(row.company_number),
    vatNumber: readString(row.vat_number),
    website: readString(row.website),
    notes: readString(row.notes),
    statusReason: readString(row.status_reason),
    statusChangedAt: readString(row.status_changed_at),
    statusChangedBy: readString(row.status_changed_by),
    linesInRange: readNumber(row.lines_in_range) ?? 0,
    delivery: readDeliveryTerms(row.delivery),
    contacts: readContacts(row.contacts),
    addresses: readAddresses(row.addresses),
    createdAt,
    updatedAt: readString(row.updated_at) ?? createdAt,
  };
}

// The Suppliers list: active ones by default, searched by name, short code or account number.
export async function listSuppliers(supabase: Client, query: SupplierQuery = {}): Promise<Page<SupplierRow>> {
  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;
  const { data, error } = await supabase.rpc('supplier_list', {
    p_search: query.search?.trim() || undefined,
    p_status: query.status ?? 'active',
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw dataError(error);
  const rows = (data ?? []).flatMap((row) => readRow(row) ?? []);
  return { rows, page: { limit, offset, total: readNumber(data?.[0]?.total_count) ?? 0 } };
}

// One supplier's page, or null when the id isn't a supplier.
export async function getSupplier(supabase: Client, supplierId: number): Promise<SupplierDetail | null> {
  const { data, error } = await supabase.rpc('supplier_detail', { p_source: supplierId });
  if (error) throw dataError(error);
  return data == null ? null : readDetail(data);
}

// Saves a supplier's details (editors). A rename changes the name everywhere the supplier appears.
export async function saveSupplier(supabase: Client, supplierId: number, changes: SupplierChanges): Promise<SupplierDetail> {
  const p: Record<string, Json> = { source_id: supplierId };
  for (const key of Object.keys(CHANGE_KEYS) as (keyof SupplierChanges)[]) {
    const value = changes[key];
    if (value !== undefined) p[CHANGE_KEYS[key]] = value;
  }
  const { data, error } = await supabase.rpc('save_supplier', { p });
  if (error) throw dataError(error);
  const detail = readDetail(data);
  if (!detail) throw new Error('The supplier could not be read back after saving.');
  return detail;
}

// Puts a supplier on hold, archives it, or makes it active again (editors), with an optional reason.
export async function setSupplierStatus(
  supabase: Client,
  supplierId: number,
  status: SupplierStatus,
  reason?: string | null,
): Promise<SupplierDetail> {
  const { data, error } = await supabase.rpc('set_supplier_status', {
    p_source: supplierId,
    p_status: status,
    p_reason: reason?.trim() || undefined,
  });
  if (error) throw dataError(error);
  const detail = readDetail(data);
  if (!detail) throw new Error('The supplier could not be read back after changing its status.');
  return detail;
}
