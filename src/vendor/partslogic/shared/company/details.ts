import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { DataError, dataError } from '../core/errors';
import { readArray, readBoolean, readNumber, readRecord, readString, readStrings, type JsonRecord } from '../core/read';
import { readSites, type PartySite } from '../parties/parties';

// Who the company is on documents (a printed purchase order): one company, one logo, one trading name. Every rule
// lives in SQL (public.company_details, public.save_company_details); this file shapes what is sent and read back.

// The parts of the UK a company can be registered in, as an order form must say.
export const REGISTERED_IN = ['England and Wales', 'Wales', 'Scotland', 'Northern Ireland'] as const;
export type RegisteredIn = (typeof REGISTERED_IN)[number];

export function isRegisteredIn(value: unknown): value is RegisteredIn {
  return typeof value === 'string' && (REGISTERED_IN as readonly string[]).includes(value);
}

// Lines are separated by newlines, up to 4 of them.
export type CompanyAddress = { lines: string; town: string | null; county: string | null; postcode: string | null };

// A site and the locations delivered there (their codes).
export type CompanySite = PartySite & { locations: string[] };

export type CompanyContact = { id: number; name: string; email: string | null; phone: string | null };

export type CompanyDetails = {
  partyId: number;
  tradingName: string;
  // As typed; registeredName falls back to the trading name when it is blank.
  legalName: string | null;
  registeredName: string;
  companyNumber: string | null;
  vatNumber: string | null;
  website: string | null;
  registeredIn: RegisteredIn | null;
  registeredOffice: CompanyAddress | null;
  contact: CompanyContact | null;
  logoPath: string | null;
  orderTerms: string | null;
  sites: CompanySite[];
  // What an order form still lacks ("company number", "where it is registered", "registered office").
  missing: string[];
  ready: boolean;
};

// Only the fields given change; null clears one.
export type CompanyDetailsChanges = {
  legalName?: string | null;
  companyNumber?: string | null;
  vatNumber?: string | null;
  website?: string | null;
  registeredIn?: RegisteredIn | null;
  orderTerms?: string | null;
  logoPath?: string | null;
  registeredOffice?: CompanyAddress | null;
  contact?: { name?: string; email?: string | null; phone?: string | null };
};

// The logo: one PNG or JPEG in the private storage bucket "branding", up to 1 MB (the PDF renderer reads only
// those two formats).
export const LOGO_BUCKET = 'branding';
export const LOGO_MAX_BYTES = 1_048_576;
export const LOGO_TYPES: Readonly<Record<string, 'png' | 'jpg'>> = { 'image/png': 'png', 'image/jpeg': 'jpg' };

// A new name for each upload, so a logo is never overwritten in place: "logo/2f1c….png".
export function logoPathFor(contentType: string, id: string): string {
  const extension = LOGO_TYPES[contentType];
  if (!extension) throw new DataError('A logo is a PNG or JPEG image.', '22023');
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new DataError('A logo needs a plain file name.', '22023');
  return `logo/${id}.${extension}`;
}

function readAddress(value: Json | undefined): CompanyAddress | null {
  const row = readRecord(value);
  const lines = readString(row?.lines);
  if (!row || !lines) return null;
  return { lines, town: readString(row.town), county: readString(row.county), postcode: readString(row.postcode) };
}

function readContact(value: Json | undefined): CompanyContact | null {
  const row = readRecord(value);
  const id = readNumber(row?.id);
  const name = readString(row?.name);
  if (!row || id == null || !name) return null;
  return { id, name, email: readString(row.email), phone: readString(row.phone) };
}

export function readCompanyDetails(value: Json | null | undefined): CompanyDetails {
  const row = readRecord(value ?? undefined);
  const partyId = readNumber(row?.party_id);
  const tradingName = readString(row?.trading_name);
  if (!row || partyId == null || !tradingName) throw new DataError('The company details could not be read.', 'P0002');
  const registeredIn = readString(row.registered_in);
  const siteRows = readArray(row.sites).map((item) => readRecord(item)).filter((item): item is JsonRecord => item != null);
  const sites = readSites(siteRows.map((site) => ({ ...site, kind: 'site' }))).map((site) => ({
    ...site,
    locations: readStrings(siteRows.find((item) => readNumber(item.id) === site.id)?.locations),
  }));
  return {
    partyId,
    tradingName,
    legalName: readString(row.legal_name),
    registeredName: readString(row.registered_name) ?? tradingName,
    companyNumber: readString(row.company_number),
    vatNumber: readString(row.vat_number),
    website: readString(row.website),
    registeredIn: isRegisteredIn(registeredIn) ? registeredIn : null,
    registeredOffice: readAddress(row.registered_office),
    contact: readContact(row.contact),
    logoPath: readString(row.logo_path),
    orderTerms: readString(row.order_terms),
    sites,
    missing: readStrings(row.missing),
    ready: readBoolean(row.ready) ?? false,
  };
}

// Anyone signed in may read them (documents print them).
export async function getCompanyDetails(supabase: Client): Promise<CompanyDetails> {
  const { data, error } = await supabase.rpc('company_details');
  if (error) throw dataError(error);
  return readCompanyDetails(data);
}

// Owners only. Returns the details as saved.
export async function saveCompanyDetails(supabase: Client, changes: CompanyDetailsChanges): Promise<CompanyDetails> {
  const p: Record<string, Json> = {};
  const fields: [keyof CompanyDetailsChanges, string][] = [
    ['legalName', 'legal_name'],
    ['companyNumber', 'company_number'],
    ['vatNumber', 'vat_number'],
    ['website', 'website'],
    ['registeredIn', 'registered_in'],
    ['orderTerms', 'order_terms'],
    ['logoPath', 'logo_path'],
  ];
  for (const [key, column] of fields) {
    const value = changes[key];
    if (value !== undefined) p[column] = value as Json;
  }
  if (changes.registeredOffice !== undefined) p.registered_office = changes.registeredOffice as Json;
  if (changes.contact !== undefined) {
    const contact: Record<string, Json> = {};
    for (const key of ['name', 'email', 'phone'] as const) {
      if (changes.contact[key] !== undefined) contact[key] = changes.contact[key] ?? null;
    }
    p.contact = contact;
  }
  const { data, error } = await supabase.rpc('save_company_details', { p });
  if (error) throw dataError(error);
  return readCompanyDetails(data);
}

// Uploads a new logo, makes it the company's, then removes the old file (owners only). The file is checked by
// type and size here and again by the bucket.
export async function replaceCompanyLogo(
  supabase: Client,
  file: Blob,
  contentType: string,
  id: string,
  current: string | null,
): Promise<CompanyDetails> {
  if (file.size > LOGO_MAX_BYTES) throw new DataError('A logo is up to 1 MB.', '22023');
  const path = logoPathFor(contentType, id);
  const upload = await supabase.storage.from(LOGO_BUCKET).upload(path, file, { contentType, upsert: false });
  if (upload.error) throw new DataError(upload.error.message, '42501');
  const details = await saveCompanyDetails(supabase, { logoPath: path });
  if (current && current !== path) await supabase.storage.from(LOGO_BUCKET).remove([current]);
  return details;
}

// Takes the logo off documents and removes its file (owners only).
export async function removeCompanyLogo(supabase: Client, current: string | null): Promise<CompanyDetails> {
  const details = await saveCompanyDetails(supabase, { logoPath: null });
  if (current) await supabase.storage.from(LOGO_BUCKET).remove([current]);
  return details;
}

// A short-lived link to show the logo (members may read the bucket); null when there is none or it is gone.
export async function companyLogoUrl(supabase: Client, path: string | null, seconds = 3600): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(LOGO_BUCKET).createSignedUrl(path, seconds);
  return error ? null : data.signedUrl;
}
