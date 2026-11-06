import type { Json } from '@partslogic/db-types';

import { readArray, readRecord, readString, readStrings, type JsonRecord } from '../core/read';

// Profiles: how a supplier's columns map onto the catalogue (ingest.profiles.spec, read by ingest.map_row).
// Pure functions: no database calls.

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
  // How the part is ordered: sold in multiples of (pack_qty), the fewest that can be ordered, the fewest from the
  // supplier's central warehouse, units in their box (information only), and the unit of issue when it isn't each.
  pack_qty?: ImportRule;
  min_qty?: ImportRule;
  central_min_qty?: ImportRule;
  box_qty?: ImportRule;
  unit?: ImportRule;
  supplier_code?: ImportRule;
  category?: ImportRule;
  // The vehicles a part fits, as the sheet writes them ("Ford Fiesta 01->08 Fusion 02->09"); read into vehicle lines.
  vehicles?: ImportRule;
  // An example vehicle (BGA's "Example of Brand" and "Example of Model", joined): kept as a hint, never a fit alone.
  vehicle_example?: ImportRule;
  facts?: { [key: string]: ImportRule };
  oe?: { mode: 'oe'; number: string[]; make?: string[]; makeMeaning?: 'explicit' | 'example' };
  // mode 'brandColumns': columns headed with a brand name hold that brand's numbers; columns: ones chosen by hand.
  xrefs?: { mode?: 'brandColumns'; splitOn?: string; columns?: XrefColumns };
};
// header -> the brand whose equivalent numbers the column lists ("Alt Ref" -> "FEBI BILSTEIN"). In the mapper a
// blank brand means the column is marked as cross-references but its brand isn't chosen yet.
export type XrefColumns = { [header: string]: string };
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
  { id: 'pack_qty', label: 'Sold in multiples of', group: 'Ordering' },
  { id: 'min_qty', label: 'Minimum order (MOQ)', group: 'Ordering' },
  { id: 'central_min_qty', label: 'Minimum order, central warehouse', group: 'Ordering' },
  { id: 'box_qty', label: 'Box quantity', group: 'Ordering' },
  { id: 'unit', label: 'Unit of issue', group: 'Ordering' },
  { id: 'oe_number', label: 'OE number', group: 'References' },
  { id: 'oe_make', label: 'OE make', group: 'References' },
  { id: 'category', label: 'Category', group: 'Details' },
  { id: 'fact:commodity_code', label: 'Commodity code', group: 'Details' },
  { id: 'fact:weight_kg', label: 'Weight (kg)', group: 'Details' },
  { id: 'fact:country_of_origin', label: 'Country of origin', group: 'Details' },
  { id: 'fact:supplier_rank', label: 'Supplier rank', group: 'Details' },
  { id: 'vehicles', label: 'Vehicle applications', group: 'Vehicles' },
  { id: 'vehicle_example', label: 'Example vehicle (a hint)', group: 'Vehicles' },
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
  xrefColumns: XrefColumns;
  settings: MappingSettings;
  preserved: PreservedRule[];
};

type CopyField =
  | 'part_number' | 'description' | 'ean' | 'cost' | 'list_price' | 'surcharge' | 'surcharge_code' | 'pack_qty'
  | 'min_qty' | 'central_min_qty' | 'box_qty' | 'unit' | 'supplier_code';
const COPY_FIELDS: readonly CopyField[] = [
  'part_number', 'description', 'ean', 'cost', 'list_price', 'surcharge', 'surcharge_code', 'pack_qty', 'min_qty',
  'central_min_qty', 'box_qty', 'unit', 'supplier_code',
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
  min_qty: ['digitsOnly'],
  central_min_qty: ['digitsOnly'],
  box_qty: ['digitsOnly'],
  unit: ['tidySpaces', 'upperCase'],
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
  // "Price Unit" is the multiple a part is sold in (FPS "SEAL RING (PACK OF 1000)": 1,000 at a time, priced each).
  // A box or carton quantity is not: Comline's BoxQty of 5 on a water pump still sells one at a time.
  pack_qty: ['price unit', 'priceunit', 'pack qty', 'pack quantity', 'pack size', 'qty per pack', 'unit qty',
    'sold in multiples of', 'order multiple'],
  min_qty: ['moq', 'min order', 'minimum order', 'min order qty', 'minimum order quantity', 'min qty', 'minimum qty'],
  central_min_qty: ['min order ndc', 'minimum order ndc', 'ndc min order', 'min order central', 'central min order'],
  box_qty: ['box qty', 'boxqty', 'box quantity', 'carton qty', 'outer qty', 'qty per box', 'qty per carton'],
  unit: ['unit of issue', 'uoi', 'uom', 'unit of measure', 'unit'],
  oe_number: ['oe', 'oe number', 'oe no', 'oe ref', 'oem', 'oem number', 'oe part number'],
  oe_make: ['oe make', 'vehicle make', 'oem make'],
  category: ['category', 'product group', 'sub category', 'subcategory', 'product category', 'group'],
  vehicles: ['application', 'applications', 'brief application', 'vehicle application', 'vehicle applications',
    'fitment', 'fitments', 'car application', 'vehicle fitment'],
  vehicle_example: ['example of brand', 'example of model', 'example vehicle', 'example of make'],
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

// Targets more than one column can fill: categories by level, applications, an example vehicle's make and model.
const MULTI_COLUMN = new Set<ImportTarget>(['category', 'vehicles', 'vehicle_example']);

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
  assign(spec.fields.vehicles?.sources, 'vehicles');
  assign(spec.fields.vehicle_example?.sources, 'vehicle_example');
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
  const xrefColumns: XrefColumns = Object.fromEntries(
    Object.entries(spec.fields.xrefs?.columns ?? {}).filter(([header]) => header in mapping),
  );

  return {
    mapping,
    also,
    xrefColumns,
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
        xrefColumns: {},
        settings: DEFAULT_MAPPING_SETTINGS,
        preserved: [],
      };
  const mapping = { ...base.mapping };
  const taken = new Set(Object.values(mapping).filter((value): value is ImportTarget => value != null));
  const lockedHeaders = new Set([...base.preserved.flatMap((rule) => rule.headers), ...Object.keys(base.xrefColumns)]);

  for (const [target, spellings] of Object.entries(SYNONYMS) as [Exclude<ImportTarget, 'ignore'>, string[]][]) {
    if (taken.has(target) && !MULTI_COLUMN.has(target)) continue;
    for (const spelling of spellings) {
      const header = headers.find((h) => mapping[h] == null && !lockedHeaders.has(h) && headerKey(h) === spelling);
      if (header) {
        mapping[header] = target;
        taken.add(target);
        if (!MULTI_COLUMN.has(target)) break;
      }
    }
  }
  return { mapping, also: base.also, xrefColumns: base.xrefColumns, settings: base.settings, preserved: base.preserved };
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
  xrefColumns: XrefColumns = {},
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

  for (const target of ['vehicles', 'vehicle_example'] as const) {
    const headers = sourcesFor(target, base?.fields[target]?.sources);
    if (headers.length > 0) fields[target] = { mode: 'list', sources: headers };
  }

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
  const chosenXrefs: XrefColumns = Object.fromEntries([
    ...Object.entries(xrefColumns).filter(([header, brand]) => header in mapping && mapping[header] == null && brand.trim() !== ''),
    ...Object.entries(base?.fields.xrefs?.columns ?? {}).filter(([header]) => !(header in mapping)),
  ]);
  const hasChosenXrefs = Object.keys(chosenXrefs).length > 0;
  if (settings.xrefsFromBrandColumns || hasChosenXrefs) {
    const splitOn = settings.splitOn || '/';
    const keepImplicit = base?.fields.xrefs != null && base.fields.xrefs.splitOn === undefined && splitOn === '/';
    fields.xrefs = {
      ...(settings.xrefsFromBrandColumns ? { mode: 'brandColumns' as const } : {}),
      ...(keepImplicit ? {} : { splitOn }),
      ...(hasChosenXrefs ? { columns: chosenXrefs } : {}),
    };
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

export function validateMapping(
  mapping: ColumnMapping,
  settings: MappingSettings,
  also: AlsoMapping = {},
  xrefColumns: XrefColumns = {},
): MappingProblem[] {
  const used = (target: ImportTarget) => headersFor(mapping, target, also).length > 0;
  const problems: MappingProblem[] = [];
  for (const [header, brand] of Object.entries(xrefColumns)) {
    if (header in mapping && mapping[header] == null && brand.trim() === '') {
      problems.push({ level: 'error', message: `Choose the brand whose numbers “${header}” lists.` });
    }
  }
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
  for (const field of [...COPY_FIELDS, 'category', 'vehicles', 'vehicle_example'] as const) {
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
  const xrefColumns: XrefColumns = Object.fromEntries(
    Object.entries(readRecord(xrefs?.columns) ?? {}).flatMap(([header, brand]) =>
      typeof brand === 'string' ? [[header, brand]] : [],
    ),
  );
  const autoXrefs = readString(xrefs?.mode) === 'brandColumns';
  if (autoXrefs || Object.keys(xrefColumns).length > 0) {
    fields.xrefs = {
      ...(autoXrefs ? { mode: 'brandColumns' as const } : {}),
      ...(typeof xrefs?.splitOn === 'string' ? { splitOn: xrefs.splitOn } : {}),
      ...(Object.keys(xrefColumns).length > 0 ? { columns: xrefColumns } : {}),
    };
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
