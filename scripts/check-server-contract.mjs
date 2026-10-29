#!/usr/bin/env node
// Checks that a PartsLogic commit still serves everything this app calls on the server, so a change made
// for the web app can't break the phones. Phones keep running the code they have (and replay queued work),
// so the server must keep every function, argument, table and column this code uses.
//
// What the app calls is read from its own code: every supabase.rpc() and supabase.from() in src/, plus
// those inside the vendored PartsLogic wrappers the app imports (src/vendor/partslogic/shared). What the
// server offers is read from PartsLogic's generated types (packages/db-types) and schema snapshot
// (supabase/schema.sql) at a commit, so run it after that commit's types and snapshot are regenerated.
//
// Usage:
//   node scripts/check-server-contract.mjs --from ../PartsLogic --ref purchasing/01-document-tables
//   node scripts/check-server-contract.mjs --write     (rewrites docs/SERVER_CONTRACT.md from the code)
//
// It fails (exit 1) on a function, argument, table or column the app uses that is gone or renamed, a new
// argument the app doesn't send that has no default, or a column gone from a function's returned rows.
// It warns about jsonb output keys that were built in the vendored commit's version of a function but
// aren't any more: the app may read them, so check each by hand.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR_SHARED = path.join('vendor', 'partslogic', 'shared');
const FILTER_METHODS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in', 'contains',
  'containedBy', 'not', 'order', 'match', 'filter', 'textSearch']);

// ------------------------------------------------------------------------------------------------------
// What the app calls
// ------------------------------------------------------------------------------------------------------

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      out.push(...sourceFiles(file));
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(file);
    }
  }
  return out;
}

const parse = (file, text) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
  file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

const stringArg = (node) => (node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null);

// The columns a PostgREST select string names: "a, b, alias:c, rel(x, y)" -> a, b, c (embedded relations skipped).
export function selectColumns(select) {
  const out = [];
  let depth = 0;
  let current = '';
  for (const ch of `${select},`) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      const item = current.trim();
      current = '';
      if (!item || item === '*' || item.includes('(')) continue;
      const plain = item.replace(/::\w+/g, '');
      const column = plain.includes(':') ? plain.split(':').pop() : plain;
      out.push(column.replace(/->.*/, '').trim());
    } else {
      current += ch;
    }
  }
  return out.filter(Boolean);
}

// Every rpc() and from() call under a node: { rpc: [{ name, args, dynamic }], from: [{ name, columns }] }.
function callsIn(node) {
  const rpc = [];
  const from = [];
  const visit = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const method = n.expression.name.text;
      const first = stringArg(n.arguments[0]);
      if (method === 'rpc' && first) {
        const second = n.arguments[1];
        const args = [];
        let dynamic = false;
        if (second && ts.isObjectLiteralExpression(second)) {
          for (const p of second.properties) {
            if (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) args.push(p.name.getText());
            else dynamic = true;
          }
        } else if (second) {
          dynamic = true;
        }
        rpc.push({ name: first, args, dynamic });
      }
      if (method === 'from' && first && !/^(Array|Buffer|Object)\b/.test(n.expression.expression.getText())) {
        const columns = [];
        let cur = n;
        while (ts.isPropertyAccessExpression(cur.parent) && ts.isCallExpression(cur.parent.parent)
               && cur.parent.parent.expression === cur.parent) {
          const chained = cur.parent.name.text;
          const arg = stringArg(cur.parent.parent.arguments[0]);
          if (chained === 'select' && arg) columns.push(...selectColumns(arg));
          if (FILTER_METHODS.has(chained) && arg) columns.push(arg);
          cur = cur.parent.parent;
        }
        from.push({ name: first, columns });
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return { rpc, from };
}

// The top-level functions of a vendored module: name -> { node, calls, refs } (refs: other top-level names used).
function topLevelFunctions(sf) {
  const fns = new Map();
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name) fns.set(st.name.text, st);
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.initializer
            && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) {
          fns.set(d.name.text, d.initializer);
        }
      }
    }
  }
  const out = new Map();
  for (const [name, node] of fns) {
    const refs = new Set();
    const visit = (n) => {
      if (ts.isIdentifier(n) && fns.has(n.text) && n.text !== name) refs.add(n.text);
      ts.forEachChild(n, visit);
    };
    visit(node);
    out.set(name, { calls: callsIn(node), refs });
  }
  return out;
}

function addCall(surface, call, file) {
  const fn = surface.functions.get(call.name) ?? { args: new Set(), dynamic: false, files: new Set() };
  call.args.forEach((a) => fn.args.add(a));
  fn.dynamic ||= call.dynamic;
  fn.files.add(file);
  surface.functions.set(call.name, fn);
}

function addRelation(surface, rel, file) {
  const r = surface.relations.get(rel.name) ?? { columns: new Set(), files: new Set() };
  rel.columns.forEach((c) => r.columns.add(c));
  r.files.add(file);
  surface.relations.set(rel.name, r);
}

// The server surface the app uses: functions (args it sends) and tables or views (columns it reads or
// filters on), each with the app files that reach them.
export function appSurface(srcDir = path.join(root, 'src')) {
  const vendorDir = path.join(srcDir, VENDOR_SHARED);
  const modules = new Map();
  if (existsSync(vendorDir)) {
    for (const f of readdirSync(vendorDir).filter((n) => n.endsWith('.ts'))) {
      const file = path.join(vendorDir, f);
      modules.set(f.replace(/\.ts$/, ''), topLevelFunctions(parse(file, readFileSync(file, 'utf8'))));
    }
  }
  const surface = { functions: new Map(), relations: new Map() };

  // A vendored function and everything it calls in its module, closed over.
  const reach = (mod, name, seen = new Set()) => {
    const fns = modules.get(mod);
    const key = `${mod}.${name}`;
    if (!fns?.has(name) || seen.has(key)) return [];
    seen.add(key);
    const entry = fns.get(name);
    return [entry.calls, ...[...entry.refs].flatMap((r) => reach(mod, r, seen))];
  };

  for (const file of sourceFiles(srcDir)) {
    const rel = path.relative(srcDir, file).split(path.sep).join('/');
    if (rel.startsWith('vendor/') || rel.startsWith('dev/')) continue;
    const sf = parse(file, readFileSync(file, 'utf8'));
    const own = callsIn(sf);
    own.rpc.forEach((c) => addCall(surface, c, rel));
    own.from.forEach((r) => addRelation(surface, r, rel));
    for (const st of sf.statements) {
      if (!ts.isImportDeclaration(st) || st.importClause?.isTypeOnly) continue;
      const spec = st.moduleSpecifier.text;
      if (!spec.startsWith('@/vendor/partslogic/shared')) continue;
      const named = st.importClause?.namedBindings;
      if (!named || !ts.isNamedImports(named)) continue;
      const mod = spec.split('/').slice(4).join('/');
      for (const el of named.elements) {
        if (el.isTypeOnly) continue;
        const name = (el.propertyName ?? el.name).text;
        const owners = mod ? [mod] : [...modules.keys()].filter((m) => modules.get(m).has(name));
        for (const m of owners) {
          for (const calls of reach(m, name)) {
            calls.rpc.forEach((c) => addCall(surface, c, rel));
            calls.from.forEach((r) => addRelation(surface, r, rel));
          }
        }
      }
    }
  }
  return surface;
}

// ------------------------------------------------------------------------------------------------------
// What the server offers
// ------------------------------------------------------------------------------------------------------

const memberName = (m) => (m.name && (ts.isIdentifier(m.name) || ts.isStringLiteral(m.name)) ? m.name.text : null);

function members(typeNode) {
  const out = new Map();
  if (typeNode && ts.isTypeLiteralNode(typeNode)) {
    for (const m of typeNode.members) if (memberName(m)) out.set(memberName(m), m);
  }
  return out;
}

// The public schema of PartsLogic's generated Database type: functions (each overload's arguments, with
// whether each is optional, and the columns of returned rows) and tables and views (their columns).
export function serverSurface(typesText) {
  const sf = parse('database.ts', typesText);
  let database = null;
  for (const st of sf.statements) {
    if (ts.isTypeAliasDeclaration(st) && st.name.text === 'Database') database = st.type;
  }
  if (!database) throw new Error('No Database type in the generated types');
  const pub = members(members(database).get('public')?.type);
  const functions = new Map();
  for (const [name, m] of members(pub.get('Functions')?.type)) {
    const variants = ts.isUnionTypeNode(m.type) ? m.type.types : [m.type];
    functions.set(name, variants.map((v) => {
      const parts = members(v);
      const args = new Map();
      for (const [arg, am] of members(parts.get('Args')?.type)) args.set(arg, Boolean(am.questionToken));
      const returns = parts.get('Returns')?.type;
      let returnCols = null;
      if (returns && ts.isArrayTypeNode(returns) && ts.isTypeLiteralNode(returns.elementType)) {
        returnCols = new Set(members(returns.elementType).keys());
      }
      return { args, returnCols, returns: returns?.getText() ?? '' };
    }));
  }
  const relations = new Map();
  for (const group of ['Tables', 'Views']) {
    for (const [name, m] of members(pub.get(group)?.type)) {
      relations.set(name, new Set(members(members(m.type).get('Row')?.type).keys()));
    }
  }
  return { functions, relations };
}

// The keys each public function builds with jsonb_build_object, from schema.sql (overloads merged).
export function jsonKeys(schemaSql, names) {
  const sql = schemaSql.replace(/\r/g, '');
  const out = new Map();
  const re = /CREATE OR REPLACE FUNCTION public\.([a-z0-9_]+)\(/g;
  let m;
  while ((m = re.exec(sql))) {
    if (!names.has(m[1])) continue;
    const end = sql.indexOf('$function$;', m.index);
    const body = sql.slice(m.index, end === -1 ? undefined : end);
    const keys = out.get(m[1]) ?? new Set();
    let at = body.indexOf('jsonb_build_object(');
    while (at !== -1) {
      let depth = 0;
      let quote = false;
      let current = '';
      const args = [];
      for (let i = at + 'jsonb_build_object('.length; i < body.length; i++) {
        const ch = body[i];
        if (ch === "'" ) quote = !quote;
        if (!quote && ch === '(') depth += 1;
        if (!quote && ch === ')') {
          if (depth === 0) { args.push(current.trim()); break; }
          depth -= 1;
        }
        if (!quote && ch === ',' && depth === 0) { args.push(current.trim()); current = ''; continue; }
        current += ch;
      }
      args.forEach((a, i) => {
        const k = /^'([a-z_][a-z0-9_]*)'$/.exec(a);
        if (i % 2 === 0 && k) keys.add(k[1]);
      });
      at = body.indexOf('jsonb_build_object(', at + 1);
    }
    out.set(m[1], keys);
  }
  return out;
}

// ------------------------------------------------------------------------------------------------------
// The check
// ------------------------------------------------------------------------------------------------------

// Problems with serving `app` from `target`, compared with `base` (the commit the app's copy came from).
export function compare(app, target, base) {
  const errors = [];
  const warnings = [];
  for (const [name, use] of [...app.functions].sort(([a], [b]) => a.localeCompare(b))) {
    const variants = target.functions.get(name);
    if (!variants) { errors.push(`${name}: the function is gone (used by ${[...use.files].join(', ')})`); continue; }
    const fits = variants.some((v) => [...use.args].every((a) => v.args.has(a))
      && [...v.args].every(([arg, optional]) => optional || use.args.has(arg) || use.dynamic));
    if (!fits) {
      const v = variants[0];
      const unknown = [...use.args].filter((a) => !v.args.has(a));
      const required = [...v.args].filter(([arg, optional]) => !optional && !use.args.has(arg)).map(([arg]) => arg);
      if (unknown.length) errors.push(`${name}: no longer takes ${unknown.join(', ')}, which the app sends`);
      if (required.length) errors.push(`${name}: now needs ${required.join(', ')}, which the app doesn't send (give it a default)`);
      if (!unknown.length && !required.length) errors.push(`${name}: none of its signatures fits what the app sends`);
    }
    const before = base?.functions.get(name)?.find((v) => v.returnCols)?.returnCols;
    const after = variants.find((v) => v.returnCols)?.returnCols;
    if (before) {
      const gone = [...before].filter((c) => !after?.has(c));
      if (gone.length) errors.push(`${name}: its rows no longer have ${gone.join(', ')}`);
    }
    if (use.dynamic) warnings.push(`${name}: the app builds its arguments dynamically, so they weren't all checked`);
  }
  for (const [name, use] of [...app.relations].sort(([a], [b]) => a.localeCompare(b))) {
    const columns = target.relations.get(name);
    if (!columns) { errors.push(`${name}: the table or view is gone (used by ${[...use.files].join(', ')})`); continue; }
    const gone = [...use.columns].filter((c) => !columns.has(c));
    if (gone.length) errors.push(`${name}: no longer has ${gone.join(', ')}`);
  }
  if (base?.jsonKeys && target.jsonKeys) {
    for (const [name, keys] of base.jsonKeys) {
      const now = target.jsonKeys.get(name) ?? new Set();
      const gone = [...keys].filter((k) => !now.has(k));
      if (gone.length && target.functions.has(name)) {
        warnings.push(`${name}: no longer builds the output key${gone.length > 1 ? 's' : ''} ${gone.join(', ')}; check the app doesn't read ${gone.length > 1 ? 'them' : 'it'}`);
      }
    }
  }
  return { errors, warnings };
}

// ------------------------------------------------------------------------------------------------------
// docs/SERVER_CONTRACT.md
// ------------------------------------------------------------------------------------------------------

export function contractMarkdown(app) {
  const files = (set) => [...set].sort().map((f) => `\`${f}\``).join(', ');
  const lines = [
    '# What the app calls on the server',
    '',
    'Generated by `node scripts/check-server-contract.mjs --write` from the app\'s code (its own calls, and those in the',
    'vendored PartsLogic wrappers it imports). Do not edit by hand.',
    '',
    'Phones keep running the build and update they have, and replay work queued offline, so PartsLogic must keep',
    'serving everything below: no function, argument, table or column here is renamed or removed, and a new',
    'argument always has a default. New functions, arguments and output fields are fine.',
    '',
    'To check a PartsLogic branch, after its generated types and schema snapshot are updated:',
    '',
    '```bash',
    'node scripts/check-server-contract.mjs --from ../PartsLogic --ref <branch>',
    '```',
    '',
    `## Functions (${app.functions.size})`,
    '',
    '| Function | Arguments the app sends | Used by |',
    '|---|---|---|',
    ...[...app.functions].sort(([a], [b]) => a.localeCompare(b)).map(([name, use]) =>
      `| \`${name}\` | ${[...use.args].sort().map((a) => `\`${a}\``).join(', ') || 'none'}${use.dynamic ? ' (and others, built in code)' : ''} | ${files(use.files)} |`),
    '',
    `## Tables and views (${app.relations.size})`,
    '',
    '| Table or view | Columns the app reads or filters on | Used by |',
    '|---|---|---|',
    ...[...app.relations].sort(([a], [b]) => a.localeCompare(b)).map(([name, use]) =>
      `| \`${name}\` | ${[...use.columns].sort().map((c) => `\`${c}\``).join(', ') || 'all'} | ${files(use.files)} |`),
    '',
  ];
  return lines.join('\n');
}

// ------------------------------------------------------------------------------------------------------
// Command line
// ------------------------------------------------------------------------------------------------------

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : fallback;
}

function main() {
  const app = appSurface();
  if (process.argv.includes('--write')) {
    const out = path.join(root, 'docs', 'SERVER_CONTRACT.md');
    writeFileSync(out, contractMarkdown(app));
    console.log(`docs/SERVER_CONTRACT.md: ${app.functions.size} functions, ${app.relations.size} tables and views.`);
    return 0;
  }

  const from = path.resolve(option('from', process.env.PARTSLOGIC_DIR ?? path.join(root, '..', 'PartsLogic')));
  const ref = option('ref', 'main');
  const git = (...args) => execFileSync('git', ['-C', from, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const show = (commit, file) => git('show', `${commit}:${file}`);
  const load = (commit) => {
    const surface = serverSurface(show(commit, 'packages/db-types/src/database.ts'));
    surface.jsonKeys = jsonKeys(show(commit, 'supabase/schema.sql'), new Set(app.functions.keys()));
    return surface;
  };

  let target;
  let base = null;
  try {
    target = load(git('rev-parse', '--verify', `${ref}^{commit}`).trim());
  } catch (error) {
    console.error(`Can't read PartsLogic at ${ref} in ${from}: ${error.message.split('\n')[0]}`);
    return 2;
  }
  const source = JSON.parse(readFileSync(path.join(root, 'src', 'vendor', 'partslogic', 'SOURCE.json'), 'utf8'));
  try {
    base = load(source.commit);
  } catch {
    console.warn(`(The vendored commit ${source.ref} isn't in ${from}; returned rows and output keys aren't compared.)`);
  }

  const { errors, warnings } = compare(app, target, base);
  console.log(`Checked ${app.functions.size} functions and ${app.relations.size} tables and views the app uses, against PartsLogic ${ref}${base ? ` (the app's copy is from ${source.ref})` : ''}.`);
  for (const w of warnings) console.log(`  ! ${w}`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  console.log(errors.length ? `${errors.length} problem${errors.length > 1 ? 's' : ''}: this would break the app.` : 'Nothing the app uses is broken.');
  return errors.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exitCode = main();
