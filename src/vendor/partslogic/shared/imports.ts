import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@partslogic/db-types';

import { dataError, DataError } from './errors';
import { readArray, readNumber, readRecord, readString, readStrings, type JsonRecord } from './read';

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------------------------------------
// Profiles: how a supplier's columns map onto the catalogue (ingest.profiles.spec, read by ingest.map_row)
// ---------------------------------------------------------------------------------------------------------

export type ImportTransform = string | { name: string; args?: string[] };
export type ImportRule = {
  mode?: 'copy' | 'constant' | 'combine' | 'list';
  sources?: string[];
  transforms?: ImportTransform[];
  value?: string;
  separator?: string;
};
export type ImportFields = {
  part_number?: ImportRule;
  description?: ImportRule;
  ean?: ImportRule;
  cost?: ImportRule;
  list_price?: ImportRule;
  surcharge?: ImportRule;
  surcharge_code?: ImportRule;
  pack_qty?: ImportRule;
  supplier_code?: ImportRule;
  category?: ImportRule;
  facts?: { [key: string]: ImportRule };
  oe?: { mode: 'oe'; number: string[]; make?: string[]; makeMeaning?: 'explicit' | 'example' };
  xrefs?: { mode: 'brandColumns'; splitOn?: string };
};
export type ImportSpec = {
  label?: string;
  fields: ImportFields;
  source?: { brand?: string; brandHeaders?: string[]; currency?: string; xrefsShareOe?: boolean };
  ignore?: string[];
  required?: string[];
  // Rules the mapper doesn't edit (NGK's second numbering system, for one) travel through unchanged.
  numberAliases?: Json[];
};

export const IMPORT_TARGETS = [
  { id: 'part_number', label: 'Part number', group: 'Identity' },
  { id: 'brand', label: 'Brand', group: 'Identity' },
  { id: 'supplier_code', label: 'Supplier part number', group: 'Identity' },
  { id: 'ean', label: 'Barcode (EAN)', group: 'Identity' },
  { id: 'description', label: 'Description', group: 'Identity' },
  { id: 'cost', label: 'Cost', group: 'Price' },
  { id: 'list_price', label: 'List price', group: 'Price' },
  { id: 'surcharge', label: 'Exchange surcharge', group: 'Price' },
  { id: 'surcharge_code', label: 'Surcharge part number', group: 'Price' },
  { id: 'pack_qty', label: 'Pack quantity', group: 'Price' },
  { id: 'oe_number', label: 'OE number', group: 'References' },
  { id: 'oe_make', label: 'OE make', group: 'References' },
  { id: 'category', label: 'Category', group: 'Details' },
  { id: 'fact:commodity_code', label: 'Commodity code', group: 'Details' },
  { id: 'fact:weight_kg', label: 'Weight (kg)', group: 'Details' },
  { id: 'fact:country_of_origin', label: 'Country of origin', group: 'Details' },
  { id: 'fact:supplier_rank', label: 'Supplier rank', group: 'Details' },
  { id: 'ignore', label: 'Ignore', group: 'Other' },
] as const;

export type ImportTarget = (typeof IMPORT_TARGETS)[number]['id'];
// header -> what it maps to; null when the column is not used (shown as unrecognised).
export type ColumnMapping = { [header: string]: ImportTarget | null };

export type MappingSettings = {
  // Used when the file has no brand column, or a row's brand cell is blank.
  defaultBrand: string | null;
  currency: string;
  // Columns headed with a brand name ("TRW", "FEBI BILSTEIN") hold that brand's equivalent numbers.
  xrefsFromBrandColumns: boolean;
  splitOn: string;
  // "example": the OE make column names an example vehicle maker, so numbers are checked against formats.
  oeMakeMeaning: 'explicit' | 'example';
};

// A rule from a saved mapping the column mapper can't show (a combined column, a constant), kept as is.
export type PreservedRule = { label: string; headers: string[] };

// Further meanings of a column that already has one: BGA's "BGA Ref" is both the part number and BGA's own
// code, and its "Description" also hints at the category.
export type AlsoMapping = { [header: string]: ImportTarget[] };

export type SuggestedMapping = {
  mapping: ColumnMapping;
  also: AlsoMapping;
  settings: MappingSettings;
  preserved: PreservedRule[];
};

type CopyField =
  | 'part_number' | 'description' | 'ean' | 'cost' | 'list_price' | 'surcharge' | 'surcharge_code' | 'pack_qty'
  | 'supplier_code';
const COPY_FIELDS: readonly CopyField[] = [
  'part_number', 'description', 'ean', 'cost', 'list_price', 'surcharge', 'surcharge_code', 'pack_qty', 'supplier_code',
];
const FACT_KEYS = ['commodity_code', 'weight_kg', 'country_of_origin', 'supplier_rank'] as const;
type FactKey = (typeof FACT_KEYS)[number];

const DEFAULT_TRANSFORMS: { [K in CopyField | FactKey]: ImportTransform[] } = {
  part_number: ['tidySpaces'],
  description: ['tidySpaces'],
  ean: ['digitsOnly'],
  cost: ['money'],
  list_price: ['money'],
  surcharge: ['money'],
  surcharge_code: ['tidySpaces'],
  pack_qty: ['digitsOnly'],
  supplier_code: ['tidySpaces'],
  commodity_code: ['digitsOnly'],
  weight_kg: [],
  country_of_origin: ['tidySpaces', 'upperCase'],
  supplier_rank: ['digitsOnly'],
};

// Header spellings seen in supplier price lists, compared after lower-casing and dropping punctuation.
const SYNONYMS: { [K in Exclude<ImportTarget, 'ignore'>]: string[] } = {
  part_number: ['part number', 'part no', 'part num', 'partno', 'part', 'item number', 'item no', 'product code',
    'manufacturer part number', 'mfr part number', 'mpn', 'article number', 'article no', 'catalogue number', 'cat no'],
  brand: ['brand', 'brand name', 'manufacturer', 'mfg code', 'mfr', 'make of part', 'supplier brand'],
  supplier_code: ['supplier code', 'supplier part number', 'supplier part no', 'supplier ref', 'stock code', 'our ref',
    'fps part no', 'bga ref'],
  ean: ['ean', 'barcode', 'bar code', 'gtin', 'ean13', 'ean code', 'upc'],
  description: ['description', 'desc', 'product description', 'item description', 'product name', 'title'],
  cost: ['net price', 'nett price', 'invoice price', 'unit cost', 'cost', 'cost price', 'trade price', 'net', 'nett',
    'your price', 'buy price', 'price'],
  list_price: ['list price', 'rrp', 'retail price', 'list'],
  surcharge: ['surcharge price', 'surcharge', 'exchange surcharge', 'surcharge value', 'exchange charge', 'core charge',
    'old unit surcharge', 'deposit'],
  surcharge_code: ['surcharge part', 'surcharge code', 'surcharge part number', 'surcharge part no'],
  pack_qty: ['pack qty', 'pack quantity', 'pack size', 'price unit', 'qty per pack', 'unit qty'],
  oe_number: ['oe', 'oe number', 'oe no', 'oe ref', 'oem', 'oem number', 'oe part number'],
  oe_make: ['oe make', 'vehicle make', 'oem make'],
  category: ['category', 'product group', 'sub category', 'subcategory', 'product category', 'group'],
  'fact:commodity_code': ['commodity code', 'tariff code', 'hs code', 'intrastat code'],
  'fact:weight_kg': ['weight', 'weight kg', 'gross weight', 'net weight'],
  'fact:country_of_origin': ['country of origin', 'origin', 'coo'],
  'fact:supplier_rank': ['rank', 'supplier rank'],
};

export const DEFAULT_MAPPING_SETTINGS: MappingSettings = {
  defaultBrand: null,
  currency: 'GBP',
  xrefsFromBrandColumns: true,
  splitOn: '/',
  oeMakeMeaning: 'explicit',
};

export function importTargetLabel(target: ImportTarget): string {
  return IMPORT_TARGETS.find((item) => item.id === target)?.label ?? target;
}

export function isImportTarget(value: string): value is ImportTarget {
  return IMPORT_TARGETS.some((item) => item.id === value);
}

function headerKey(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function copySources(rule: ImportRule | undefined): string[] {
  return rule && (rule.mode ?? 'copy') === 'copy' ? (rule.sources ?? []) : [];
}

// Reads a saved mapping back into column choices, for the headers of the file in hand. A column the
// mapping reads twice keeps its first meaning in `mapping` and the rest in `also`.
export function specToMapping(spec: ImportSpec, headers: string[]): SuggestedMapping {
  const mapping: ColumnMapping = Object.fromEntries(headers.map((header) => [header, null]));
  const also: AlsoMapping = {};
  const assign = (sources: string[] | undefined, target: ImportTarget) => {
    for (const source of sources ?? []) {
      if (!(source in mapping)) continue;
      const current = mapping[source];
      if (current == null) mapping[source] = target;
      else if (current !== target && current !== 'ignore' && target !== 'ignore') {
        const extra = (also[source] ??= []);
        if (!extra.includes(target)) extra.push(target);
      }
    }
  };

  for (const field of COPY_FIELDS) assign(copySources(spec.fields[field]), field);
  if (spec.fields.category && spec.fields.category.mode === 'list') assign(spec.fields.category.sources, 'category');
  assign(spec.fields.oe?.number, 'oe_number');
  assign(spec.fields.oe?.make, 'oe_make');
  assign(spec.source?.brandHeaders, 'brand');

  const preserved: PreservedRule[] = [];
  for (const [key, rule] of Object.entries(spec.fields.facts ?? {})) {
    const known = (FACT_KEYS as readonly string[]).includes(key);
    if (known && (rule.mode ?? 'copy') === 'copy') assign(rule.sources, `fact:${key}` as ImportTarget);
    else preserved.push({ label: key.replace(/_/g, ' '), headers: (rule.sources ?? []).filter((h) => h in mapping) });
  }
  for (const field of COPY_FIELDS) {
    const rule = spec.fields[field];
    if (rule && (rule.mode ?? 'copy') !== 'copy') {
      preserved.push({ label: field.replace(/_/g, ' '), headers: (rule.sources ?? []).filter((h) => h in mapping) });
    }
  }
  assign(spec.ignore, 'ignore');

  return {
    mapping,
    also,
    settings: {
      defaultBrand: spec.source?.brand ?? null,
      currency: spec.source?.currency ?? 'GBP',
      xrefsFromBrandColumns: spec.fields.xrefs?.mode === 'brandColumns',
      splitOn: spec.fields.xrefs?.splitOn ?? '/',
      oeMakeMeaning: spec.fields.oe?.makeMeaning ?? 'explicit',
    },
    preserved,
  };
}

// First guess at a file's columns: the supplier's saved mapping, then common header spellings.
export function suggestMapping(headers: string[], saved: ImportSpec | null): SuggestedMapping {
  const base: SuggestedMapping = saved
    ? specToMapping(saved, headers)
    : {
        mapping: Object.fromEntries(headers.map((h) => [h, null])),
        also: {},
        settings: DEFAULT_MAPPING_SETTINGS,
        preserved: [],
      };
  const mapping = { ...base.mapping };
  const taken = new Set(Object.values(mapping).filter((value): value is ImportTarget => value != null));
  const lockedHeaders = new Set(base.preserved.flatMap((rule) => rule.headers));

  for (const [target, spellings] of Object.entries(SYNONYMS) as [Exclude<ImportTarget, 'ignore'>, string[]][]) {
    if (taken.has(target) && target !== 'category') continue;
    for (const spelling of spellings) {
      const header = headers.find((h) => mapping[h] == null && !lockedHeaders.has(h) && headerKey(h) === spelling);
      if (header) {
        mapping[header] = target;
        taken.add(target);
        if (target !== 'category') break;
      }
    }
  }
  return { mapping, also: base.also, settings: base.settings, preserved: base.preserved };
}

export function headersFor(mapping: ColumnMapping, target: ImportTarget, also: AlsoMapping = {}): string[] {
  return Object.entries(mapping)
    .filter(([header, value]) => value === target || (also[header]?.includes(target) ?? false))
    .map(([header]) => header);
}

// Keeps a saved mapping's order of fallbacks, so re-saving the same choices doesn't make a new version.
function inBaseOrder(headers: string[], baseSources: string[] | undefined): string[] {
  const order = baseSources ?? [];
  return headers
    .map((header, index) => ({ header, rank: order.includes(header) ? order.indexOf(header) : 1000 + index }))
    .sort((a, b) => a.rank - b.rank)
    .map((item) => item.header);
}

// Builds the profile spec from the column choices. The saved mapping's fallbacks for columns this file
// doesn't have ("Net Price" when this list says "Invoice Price"), its rules the mapper can't show, and its
// ignore entries for other files' columns are all carried over, so re-saving unchanged choices is a no-op.
export function buildSpec(
  mapping: ColumnMapping,
  settings: MappingSettings,
  base: ImportSpec | null = null,
  also: AlsoMapping = {},
): ImportSpec {
  const sourcesFor = (target: ImportTarget, baseSources: string[] | undefined) =>
    inBaseOrder(
      [...headersFor(mapping, target, also), ...(baseSources ?? []).filter((header) => !(header in mapping))],
      baseSources,
    );
  const isCopy = (rule: ImportRule | undefined): rule is ImportRule => rule != null && (rule.mode ?? 'copy') === 'copy';
  const copyRule = (headers: string[], baseRule: ImportRule | undefined, defaults: ImportTransform[]): ImportRule => {
    const transforms = baseRule ? baseRule.transforms : defaults;
    return { mode: 'copy', sources: headers, ...(transforms ? { transforms } : {}) };
  };

  const fields: ImportFields = {};
  for (const field of COPY_FIELDS) {
    const baseRule = base?.fields[field];
    const baseCopy = isCopy(baseRule) ? baseRule : undefined;
    const headers = sourcesFor(field, baseCopy?.sources);
    if (headers.length > 0) fields[field] = copyRule(headers, baseCopy, DEFAULT_TRANSFORMS[field]);
    else if (baseRule && !baseCopy) fields[field] = baseRule;
  }

  const baseCategory = base?.fields.category;
  const categories = sourcesFor('category', baseCategory?.mode === 'list' ? baseCategory.sources : undefined);
  if (categories.length > 0) fields.category = { mode: 'list', sources: categories };
  else if (baseCategory && baseCategory.mode !== 'list') fields.category = baseCategory;

  const facts: { [key: string]: ImportRule } = {};
  for (const key of FACT_KEYS) {
    const baseRule = base?.fields.facts?.[key];
    const baseCopy = isCopy(baseRule) ? baseRule : undefined;
    const headers = sourcesFor(`fact:${key}`, baseCopy?.sources);
    if (headers.length > 0) facts[key] = copyRule(headers, baseCopy, DEFAULT_TRANSFORMS[key]);
  }
  for (const [key, rule] of Object.entries(base?.fields.facts ?? {})) {
    const known = (FACT_KEYS as readonly string[]).includes(key);
    if (!known || !isCopy(rule)) facts[key] = rule;
  }
  if (Object.keys(facts).length > 0) fields.facts = facts;

  const baseOe = base?.fields.oe;
  const oeNumbers = sourcesFor('oe_number', baseOe?.number);
  if (oeNumbers.length > 0) {
    const makes = sourcesFor('oe_make', baseOe?.make);
    fields.oe = {
      mode: 'oe',
      number: oeNumbers,
      ...(makes.length > 0 ? { make: makes } : {}),
      ...(baseOe?.makeMeaning || settings.oeMakeMeaning !== 'explicit' ? { makeMeaning: settings.oeMakeMeaning } : {}),
    };
  }
  if (settings.xrefsFromBrandColumns) {
    const splitOn = settings.splitOn || '/';
    const keepImplicit = base?.fields.xrefs != null && base.fields.xrefs.splitOn === undefined && splitOn === '/';
    fields.xrefs = { mode: 'brandColumns', ...(keepImplicit ? {} : { splitOn }) };
  }

  const ignoreHere = headersFor(mapping, 'ignore');
  const ignoreElsewhere = (base?.ignore ?? []).filter((header) => !(header in mapping));
  const ignore = inBaseOrder([...ignoreHere, ...ignoreElsewhere], base?.ignore);
  const shareOe = base ? base.source?.xrefsShareOe : false;

  const spec: ImportSpec = {
    fields,
    source: {
      ...(settings.defaultBrand?.trim() ? { brand: settings.defaultBrand.trim() } : {}),
      brandHeaders: sourcesFor('brand', base?.source?.brandHeaders),
      currency: settings.currency.trim().toUpperCase() || 'GBP',
      ...(typeof shareOe === 'boolean' ? { xrefsShareOe: shareOe } : {}),
    },
    required: base?.required ?? ['part_number', 'cost'],
  };
  if (ignore.length > 0) spec.ignore = ignore;
  if (base?.label) spec.label = base.label;
  if (base?.numberAliases && base.numberAliases.length > 0) spec.numberAliases = base.numberAliases;
  return spec;
}

// fix: a one-click answer the mapper can offer next to the problem.
export type MappingProblem = { level: 'error' | 'warning'; message: string; fix?: 'codes-are-part-numbers' };

export function validateMapping(mapping: ColumnMapping, settings: MappingSettings, also: AlsoMapping = {}): MappingProblem[] {
  const used = (target: ImportTarget) => headersFor(mapping, target, also).length > 0;
  const problems: MappingProblem[] = [];
  if (!used('part_number')) problems.push({ level: 'error', message: 'Choose the part number column.' });
  if (!used('cost')) problems.push({ level: 'error', message: 'Choose the cost column.' });
  if (!used('brand') && !settings.defaultBrand?.trim()) {
    problems.push({ level: 'error', message: 'Choose the brand column, or a default brand for the whole file.' });
  }
  if (!/^[A-Za-z]{3}$/.test(settings.currency.trim())) problems.push({ level: 'error', message: 'Currency is a three-letter code, like GBP.' });
  if (used('oe_make') && !used('oe_number')) {
    problems.push({ level: 'warning', message: 'OE make is only used with an OE number column.' });
  }
  if (!used('supplier_code')) {
    problems.push({
      level: 'warning',
      message: 'No supplier part number column: their own codes won’t be searchable.',
      ...(used('part_number') ? { fix: 'codes-are-part-numbers' as const } : {}),
    });
  }
  return problems;
}

function readRule(value: Json | undefined): ImportRule | undefined {
  const rule = readRecord(value);
  if (!rule) return undefined;
  const mode = readString(rule.mode);
  const transforms = readArray(rule.transforms).flatMap((step): ImportTransform[] => {
    if (typeof step === 'string') return [step];
    const named = readRecord(step);
    const name = readString(named?.name);
    return name ? [{ name, args: readStrings(named?.args) }] : [];
  });
  return {
    ...(mode === 'copy' || mode === 'constant' || mode === 'combine' || mode === 'list' ? { mode } : {}),
    ...(Array.isArray(rule.sources) ? { sources: readStrings(rule.sources) } : {}),
    ...(Array.isArray(rule.transforms) ? { transforms } : {}),
    ...(readString(rule.value) ? { value: readString(rule.value) ?? undefined } : {}),
    ...(typeof rule.separator === 'string' ? { separator: rule.separator } : {}),
  };
}

// Narrows a stored spec. Unknown keys are dropped; rules keep only the parts ingest.map_row reads.
export function readImportSpec(value: Json | undefined): ImportSpec | null {
  const spec = readRecord(value);
  const fieldsRecord = readRecord(spec?.fields);
  if (!spec || !fieldsRecord) return null;

  const fields: ImportFields = {};
  for (const field of [...COPY_FIELDS, 'category'] as const) {
    const rule = readRule(fieldsRecord[field]);
    if (rule) fields[field] = rule;
  }
  const facts = readRecord(fieldsRecord.facts);
  if (facts) {
    fields.facts = Object.fromEntries(
      Object.entries(facts).flatMap(([key, rule]) => {
        const read = readRule(rule);
        return read ? [[key, read]] : [];
      }),
    );
  }
  const oe = readRecord(fieldsRecord.oe);
  if (oe) {
    const meaning = readString(oe.makeMeaning);
    fields.oe = {
      mode: 'oe',
      number: readStrings(oe.number),
      ...(Array.isArray(oe.make) ? { make: readStrings(oe.make) } : {}),
      ...(meaning === 'example' || meaning === 'explicit' ? { makeMeaning: meaning } : {}),
    };
  }
  const xrefs = readRecord(fieldsRecord.xrefs);
  if (readString(xrefs?.mode) === 'brandColumns') {
    fields.xrefs = { mode: 'brandColumns', ...(typeof xrefs?.splitOn === 'string' ? { splitOn: xrefs.splitOn } : {}) };
  }

  const source = readRecord(spec.source);
  const result: ImportSpec = { fields };
  if (source) {
    result.source = {
      ...(readString(source.brand) ? { brand: readString(source.brand) ?? undefined } : {}),
      brandHeaders: readStrings(source.brandHeaders),
      ...(readString(source.currency) ? { currency: readString(source.currency) ?? undefined } : {}),
      ...(typeof source.xrefsShareOe === 'boolean' ? { xrefsShareOe: source.xrefsShareOe } : {}),
    };
  }
  if (Array.isArray(spec.ignore)) result.ignore = readStrings(spec.ignore);
  if (Array.isArray(spec.required)) result.required = readStrings(spec.required);
  if (readString(spec.label)) result.label = readString(spec.label) ?? undefined;
  if (Array.isArray(spec.numberAliases)) result.numberAliases = spec.numberAliases;
  return result;
}

// ---------------------------------------------------------------------------------------------------------
// Database calls
// ---------------------------------------------------------------------------------------------------------

export type ImportProfile = { id: number; code: string; version: number; spec: ImportSpec; createdAt: string | null };

export async function getImportProfile(supabase: Client, supplierId: number): Promise<ImportProfile | null> {
  const { data, error } = await supabase.rpc('import_profile', { p_source: supplierId });
  if (error) throw dataError(error);
  const profile = readRecord(data);
  const id = readNumber(profile?.id);
  const code = readString(profile?.code);
  const version = readNumber(profile?.version);
  const spec = readImportSpec(profile?.spec);
  if (id == null || !code || version == null || !spec) return null;
  return { id, code, version, spec, createdAt: readString(profile?.created_at) };
}

export async function saveImportProfile(
  supabase: Client,
  supplierId: number,
  spec: ImportSpec,
): Promise<{ id: number; code: string; version: number; unchanged: boolean }> {
  const { data, error } = await supabase.rpc('save_import_profile', { p_source: supplierId, p_spec: spec });
  if (error) throw dataError(error);
  const saved = readRecord(data);
  const id = readNumber(saved?.id);
  const code = readString(saved?.code);
  const version = readNumber(saved?.version);
  if (id == null || !code || version == null) throw new DataError('The mapping was not saved.', 'P0001');
  return { id, code, version, unchanged: saved?.unchanged === true };
}

export type BrandSuggestion = { brandId: number; name: string; match: string; parts: number };
export type BrandCheck = {
  name: string;
  brandId: number | null;
  brand: string | null;
  viaAlias: boolean;
  suggestions: BrandSuggestion[];
};

// Which of these names (a file's brand values, or its headers) are brands already, with near matches for
// the rest.
export async function checkBrands(supabase: Client, names: string[]): Promise<BrandCheck[]> {
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))].slice(0, 1000);
  if (unique.length === 0) return [];
  const { data, error } = await supabase.rpc('check_brands', { p_names: unique });
  if (error) throw dataError(error);
  return (data ?? []).flatMap((row) =>
    row.name == null
      ? []
      : [
          {
            name: row.name,
            brandId: row.brand_id,
            brand: row.brand,
            viaAlias: row.via_alias === true,
            suggestions: readArray(row.suggestions).flatMap((value) => {
              const item = readRecord(value);
              const brandId = readNumber(item?.brand_id);
              const name = readString(item?.name);
              return brandId == null || !name
                ? []
                : [{ brandId, name, match: readString(item?.match) ?? 'similar', parts: readNumber(item?.parts) ?? 0 }];
            }),
          },
        ],
  );
}

export async function createBrand(supabase: Client, name: string, confirm = false): Promise<number> {
  const { data, error } = await supabase.rpc('create_brand', { p_name: name.trim(), p_confirm: confirm });
  if (error) throw dataError(error);
  return data;
}

export async function aliasBrandName(supabase: Client, alias: string, brandId: number): Promise<void> {
  const { error } = await supabase.rpc('alias_brand_name', { p_alias: alias.trim(), p_brand: brandId });
  if (error) throw dataError(error);
}

export type ImportIssue = {
  level: 'error' | 'warning' | 'skipped';
  field: string | null;
  message: string;
  value: string | null;
};
export type PreviewRow = { row: number; mapped: JsonRecord; issues: ImportIssue[] };
export type ImportPreview = { brandColumns: { [header: string]: string }; missingOptionalFields: string[]; rows: PreviewRow[] };

function readIssues(value: Json | undefined): ImportIssue[] {
  return readArray(value).flatMap((item) => {
    const issue = readRecord(item);
    const level = readString(issue?.level);
    const message = readString(issue?.message) ?? readString(issue?.error);
    if (!message) return [];
    return [
      {
        level: level === 'warning' || level === 'skipped' ? level : 'error',
        field: readString(issue?.field),
        message,
        value: readString(issue?.value),
      },
    ];
  });
}

function readStringMap(value: Json | undefined): { [key: string]: string } {
  const record = readRecord(value);
  if (!record) return {};
  return Object.fromEntries(Object.entries(record).flatMap(([key, item]) => (typeof item === 'string' ? [[key, item]] : [])));
}

// Runs the real mapper (ingest.map_row) over sample rows, so the preview is exactly what the import does.
export async function previewImport(
  supabase: Client,
  spec: ImportSpec,
  rows: { [header: string]: string }[],
): Promise<ImportPreview> {
  const { data, error } = await supabase.rpc('import_preview', { p_spec: spec, p_rows: rows.slice(0, 50) });
  if (error) throw dataError(error);
  const preview = readRecord(data);
  return {
    brandColumns: readStringMap(preview?.brand_columns),
    missingOptionalFields: readStrings(preview?.missing_optional_fields),
    rows: readArray(preview?.rows).flatMap((value) => {
      const row = readRecord(value);
      const index = readNumber(row?.row);
      return index == null ? [] : [{ row: index, mapped: readRecord(row?.mapped) ?? {}, issues: readIssues(row?.issues) }];
    }),
  };
}

export type ImportStatus = Database['ingest']['Enums']['batch_status'];
export type ImportBatch = {
  id: string;
  supplierId: number;
  supplier: string;
  fileName: string;
  kind: 'upload' | 'landing';
  status: ImportStatus;
  rowCount: number;
  mappedThrough: number;
  appliedThrough: number;
  rowsApplied: number;
  rowsQuarantined: number;
  createdBy: string | null;
  createdAt: string;
  completedAt: string | null;
  error: string | null;
};
export type ImportDetails = {
  oe: { linked: number; likely: number; unattributed: number };
  supplierCodes: number;
  // rows that carried an exchange surcharge
  surcharges: number;
  skippedValuesTotal: number;
  skippedValuesTop: { value: string; rows: number }[];
};
export type ImportReport = ImportBatch & {
  received: number | null;
  staged: number;
  rowsWarning: number;
  brandColumns: { [header: string]: string };
  unrecognisedColumns: string[];
  missingOptionalFields: string[];
  profile: { code: string; version: number } | null;
  startedAt: string | null;
  details: ImportDetails | null;
};
export type QuarantinedRow = { rowNumber: number; stage: 'mapping' | 'applying'; reasons: ImportIssue[]; cells: { [header: string]: string } };

const IMPORT_STATUSES: readonly ImportStatus[] = [
  'uploaded', 'parsing', 'mapping', 'resolving', 'linking', 'publishing', 'completed', 'failed',
];

function readStatus(value: Json | undefined): ImportStatus {
  return IMPORT_STATUSES.find((status) => status === value) ?? 'uploaded';
}

function readBatch(row: JsonRecord | null): ImportBatch | null {
  const id = readString(row?.id);
  const supplierId = readNumber(row?.source_id);
  const supplier = readString(row?.source);
  const fileName = readString(row?.file_name);
  const createdAt = readString(row?.created_at);
  if (!id || supplierId == null || !supplier || !fileName || !createdAt) return null;
  return {
    id,
    supplierId,
    supplier,
    fileName,
    kind: row?.kind === 'upload' ? 'upload' : 'landing',
    status: readStatus(row?.status),
    rowCount: readNumber(row?.row_count) ?? 0,
    mappedThrough: readNumber(row?.mapped_through) ?? 0,
    appliedThrough: readNumber(row?.applied_through) ?? 0,
    rowsApplied: readNumber(row?.rows_applied) ?? 0,
    rowsQuarantined: readNumber(row?.rows_quarantined) ?? 0,
    createdBy: readString(row?.created_by),
    createdAt,
    completedAt: readString(row?.completed_at),
    error: readString(row?.error),
  };
}

export function readImportReport(value: Json | undefined): ImportReport | null {
  const report = readRecord(value);
  const batch = readBatch(report);
  if (!report || !batch) return null;
  const details = readRecord(report.details);
  const oe = readRecord(details?.oe);
  const profile = readRecord(report.profile);
  const profileCode = readString(profile?.code);
  const profileVersion = readNumber(profile?.version);
  const unrecognised = report.unrecognised_columns;
  return {
    ...batch,
    received: readNumber(report.received),
    staged: readNumber(report.staged) ?? 0,
    rowsWarning: readNumber(report.rows_warning) ?? 0,
    brandColumns: readStringMap(report.brand_columns),
    // uploads store a list; landing imports a {column: filled rows} object
    unrecognisedColumns: Array.isArray(unrecognised) ? readStrings(unrecognised) : Object.keys(readRecord(unrecognised) ?? {}),
    missingOptionalFields: readStrings(report.missing_optional_fields),
    profile: profileCode && profileVersion != null ? { code: profileCode, version: profileVersion } : null,
    startedAt: readString(report.started_at),
    details: details
      ? {
          oe: {
            linked: readNumber(oe?.linked) ?? 0,
            likely: readNumber(oe?.likely) ?? 0,
            unattributed: readNumber(oe?.unattributed) ?? 0,
          },
          supplierCodes: readNumber(details.supplier_codes) ?? 0,
          surcharges: readNumber(details.surcharges) ?? 0,
          skippedValuesTotal: readNumber(details.skipped_values_total) ?? 0,
          skippedValuesTop: readArray(details.skipped_values_top).flatMap((item) => {
            const top = readRecord(item);
            const value = readString(top?.value);
            return value ? [{ value, rows: readNumber(top?.rows) ?? 0 }] : [];
          }),
        }
      : null,
  };
}

export type ImportStart = { supplierId: number; fileName: string; sha256: string; rowCount: number; headers: string[] };

export async function beginImport(supabase: Client, input: ImportStart): Promise<string> {
  const { data, error } = await supabase.rpc('import_begin', {
    p_source: input.supplierId,
    p_file_name: input.fileName,
    p_sha256: input.sha256,
    p_row_count: input.rowCount,
    p_headers: input.headers,
  });
  if (error) throw dataError(error);
  return data;
}

// Sends rows firstRow.. of an open upload (at most 2,000). Returns how many were new.
export async function appendImportRows(
  supabase: Client,
  batchId: string,
  firstRow: number,
  rows: { [header: string]: string }[],
): Promise<number> {
  const { data, error } = await supabase.rpc('import_append_rows', { p_batch: batchId, p_first_row: firstRow, p_rows: rows });
  if (error) throw dataError(error);
  return data;
}

export async function finishImport(supabase: Client, batchId: string): Promise<ImportReport | null> {
  const { data, error } = await supabase.rpc('import_finish', { p_batch: batchId });
  if (error) throw dataError(error);
  return readImportReport(data);
}

export async function cancelImport(supabase: Client, batchId: string): Promise<void> {
  const { error } = await supabase.rpc('import_cancel', { p_batch: batchId });
  if (error) throw dataError(error);
}

export async function getImportReport(supabase: Client, batchId: string, details = false): Promise<ImportReport | null> {
  const { data, error } = await supabase.rpc('import_report', { p_batch: batchId, p_details: details });
  if (error) throw dataError(error);
  return readImportReport(data);
}

export async function listImportBatches(supabase: Client, limit = 50): Promise<ImportBatch[]> {
  const { data, error } = await supabase.rpc('import_batches', { p_limit: limit });
  if (error) throw dataError(error);
  return (data ?? []).flatMap((row) => {
    const batch = readBatch(readRecord(row));
    return batch ? [batch] : [];
  });
}

export async function listQuarantinedRows(
  supabase: Client,
  batchId: string,
  limit = 25,
  offset = 0,
): Promise<{ rows: QuarantinedRow[]; total: number }> {
  const { data, error } = await supabase.rpc('import_quarantined', { p_batch: batchId, p_limit: limit, p_offset: offset });
  if (error) throw dataError(error);
  const list = data ?? [];
  return {
    total: readNumber(list[0]?.total) ?? 0,
    rows: list.flatMap((row) =>
      row.row_number == null
        ? []
        : [
            {
              rowNumber: row.row_number,
              stage: row.stage === 'applying' ? 'applying' : 'mapping',
              reasons: readIssues(row.reasons),
              cells: readStringMap(row.cells),
            },
          ],
    ),
  };
}

// Where a batch is, as one number from 0 to 1. Mapping is about a sixth of the work (1 ms a row against
// 5 ms to apply one).
export function importProgress(batch: Pick<ImportBatch, 'status' | 'rowCount' | 'mappedThrough' | 'appliedThrough'> & {
  received?: number | null;
}): { stage: 'receiving' | 'mapping' | 'applying' | 'done' | 'failed'; fraction: number } {
  const rows = Math.max(batch.rowCount, 1);
  switch (batch.status) {
    case 'completed':
      return { stage: 'done', fraction: 1 };
    case 'failed':
      return { stage: 'failed', fraction: Math.min(batch.appliedThrough / rows, 1) };
    case 'uploaded':
    case 'parsing':
      return { stage: 'receiving', fraction: 0 };
    case 'mapping':
    case 'resolving':
      return { stage: 'mapping', fraction: 0.15 * Math.min(batch.mappedThrough / rows, 1) };
    default:
      return { stage: 'applying', fraction: 0.15 + 0.85 * Math.min(batch.appliedThrough / rows, 1) };
  }
}
