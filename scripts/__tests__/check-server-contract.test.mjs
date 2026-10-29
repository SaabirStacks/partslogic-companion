// node --test scripts/__tests__   (npm run test:scripts)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { appSurface, compare, contractMarkdown, jsonKeys, selectColumns, serverSurface } from '../check-server-contract.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// The generated types the app's vendored copy came from: what the server offered when this code was written.
const vendoredTypes = readFileSync(path.join(root, 'src', 'vendor', 'partslogic', 'db-types', 'database.ts'), 'utf8');
const app = appSurface(path.join(root, 'src'));

const check = (typesText) => compare(app, serverSurface(typesText), null);

test('reads the columns out of a select string', () => {
  assert.deepEqual(selectColumns('bin_id, bin_code, alias:location_id, rel(a, b), *, qty::text'), ['bin_id', 'bin_code', 'location_id', 'qty']);
});

test('finds what the app calls, including inside the vendored wrappers it imports', () => {
  const receipt = app.functions.get('record_receipt_lines');
  assert.ok(receipt, 'record_receipt_lines is called from the offline queue');
  assert.deepEqual([...receipt.args].sort(), ['p_device', 'p_document', 'p_lines', 'p_location']);
  assert.ok(receipt.files.has('queue/handlers.ts'));
  assert.ok(app.functions.has('part_detail'));
  assert.deepEqual([...app.relations.get('stock_levels').columns].sort(), ['bin_id', 'part_id', 'qty']);
  assert.ok(!app.functions.has('import_begin'), 'web-only wrappers the app never imports are left out');
});

test('the server the app was written against serves everything it uses', () => {
  assert.deepEqual(check(vendoredTypes).errors, []);
});

test('a removed or renamed function is caught', () => {
  const { errors } = check(vendoredTypes.replace(/\n {6}part_detail: \{/, '\n      part_detail_v2: {'));
  assert.ok(errors.some((e) => e.startsWith('part_detail: the function is gone')), errors.join('\n'));
});

test('a removed argument the app sends is caught', () => {
  const { errors } = check(vendoredTypes.replace(/(record_receipt_lines: \{\s*Args: \{\s*)p_device\?: string\s*/, '$1'));
  assert.ok(errors.some((e) => e.includes('record_receipt_lines: no longer takes p_device')), errors.join('\n'));
});

test('a new argument without a default is caught, and one with a default is fine', () => {
  const required = check(vendoredTypes.replace(/(record_receipt_lines: \{\s*Args: \{\s*)/, '$1p_supplier: number\n          '));
  assert.ok(required.errors.some((e) => e.includes("now needs p_supplier, which the app doesn't send")), required.errors.join('\n'));
  const optional = check(vendoredTypes.replace(/(record_receipt_lines: \{\s*Args: \{\s*)/, '$1p_supplier?: number\n          '));
  assert.deepEqual(optional.errors, []);
});

test('a renamed table or a removed column the app reads is caught', () => {
  const renamed = check(vendoredTypes.replace(/\n {6}stock_levels: \{/, '\n      bin_stock: {'));
  assert.ok(renamed.errors.some((e) => e.startsWith('stock_levels: the table or view is gone')), renamed.errors.join('\n'));
  const column = check(vendoredTypes.replace(/(\n {6}members: \{\s*Row: \{[^}]*?)\n\s*role: [^\n]*/, '$1'));
  assert.ok(column.errors.some((e) => e === 'members: no longer has role'), column.errors.join('\n'));
});

test('a column gone from returned rows is caught', () => {
  const types = `export type Database = { public: { Functions: { search_parts: { Args: { q: string; max_results?: number }; Returns: { part_id: number; brand: string }[] } } } }`;
  const before = `export type Database = { public: { Functions: { search_parts: { Args: { q: string; max_results?: number }; Returns: { part_id: number; brand: string; number: string }[] } } } }`;
  const small = { functions: new Map([['search_parts', { args: new Set(['q']), dynamic: false, files: new Set(['x.ts']) }]]), relations: new Map() };
  const { errors } = compare(small, serverSurface(types), serverSurface(before));
  assert.deepEqual(errors, ['search_parts: its rows no longer have number']);
});

test('output keys a function stops building are flagged for a look', () => {
  const sql = (keys) => `CREATE OR REPLACE FUNCTION public.part_detail(p_part bigint)\n RETURNS jsonb\nAS $function$\n  select jsonb_build_object(${keys.map((k) => `'${k}', 1`).join(', ')}, 'nested', jsonb_build_object('below_reorder', true))\n$function$;\n`;
  const names = new Set(['part_detail']);
  assert.deepEqual([...jsonKeys(sql(['part', 'prices']), names).get('part_detail')].sort(), ['below_reorder', 'nested', 'part', 'prices']);
  const small = { functions: new Map([['part_detail', { args: new Set(['p_part']), dynamic: false, files: new Set(['x.ts']) }]]), relations: new Map() };
  const server = serverSurface(`export type Database = { public: { Functions: { part_detail: { Args: { p_part: number }; Returns: Json } } } }`);
  const { errors, warnings } = compare(small, { ...server, jsonKeys: jsonKeys(sql(['part']), names) }, { ...server, jsonKeys: jsonKeys(sql(['part', 'prices']), names) });
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, ["part_detail: no longer builds the output key prices; check the app doesn't read it"]);
});

test('the contract doc lists every function and table', () => {
  const md = contractMarkdown(app);
  for (const name of app.functions.keys()) assert.ok(md.includes(`\`${name}\``), name);
  for (const name of app.relations.keys()) assert.ok(md.includes(`\`${name}\``), name);
});

test('docs/SERVER_CONTRACT.md is up to date with the code (else run npm run check:server -- --write)', () => {
  assert.equal(readFileSync(path.join(root, 'docs', 'SERVER_CONTRACT.md'), 'utf8'), contractMarkdown(app));
});
