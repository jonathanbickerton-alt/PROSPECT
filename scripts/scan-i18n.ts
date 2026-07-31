/**
 * AST-based i18n coverage scan. Uses the TypeScript compiler API — no regex.
 * Walks JSX text, JSX attribute string literals, string/template literals inside
 * JSX expression containers, and user-facing-looking literals in .ts utilities.
 */
import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve('src');

// Attributes whose string values reach the user
const UI_ATTRS = new Set(['placeholder', 'title', 'aria-label', 'alt', 'label', 'aria-description']);
// Attributes that are never user-facing
const SKIP_ATTRS = new Set(['className', 'class', 'style', 'id', 'key', 'type', 'role', 'htmlFor', 'name',
  'href', 'src', 'xmlns', 'd', 'fill', 'stroke', 'viewBox', 'dataKey', 'data-testid', 'accept', 'autoComplete']);

// Never-translate vocabulary + held-back identifiers (TERMBASE §1, §11)
const NEVER = new Set(['Inflow', 'Outflow', 'Retention', 'Base', 'ARPU', 'IBRO', 'IBRO Scenario', 'IBRO Type',
  'PROSPECT', 'MAPE', 'Simple Exponential Smoothing', 'Holt Linear', 'Damped Trend', 'Holt-Winters', 'AutoML',
  'Base Case', 'Standard Forecast', 'What-If Analysis', 'Optimistic', 'Pessimistic', 'All', 'All (Aggregated)',
  'Mean (Base)', 'Base Only', 'All Time', 'Recurring monthly peaks', 'No strong pattern detected',
  // TERMBASE §1 tight compounds built on a never-translate term
  'ARPU Column', 'Inflow Identifier', 'Outflow Identifier', 'Base Identifier', 'Retention Identifier',
  'ARPU Uplift %', 'Inflow Uplift %', 'Retention Uplift %', 'Inflow Lag (Months)', 'Retention Lag (Months)',
  'Pricing Events — ARPU Override', 'ARPU Δ', 'Base Δ', 'Inflow Δ', 'Outflow Δ', 'Retention Δ', 'ARPU (+/−)']);

type Hit = { file: string; line: number; kind: string; text: string; note?: string; container?: number };
const hits: Hit[] = [];

const files: string[] = [];
(function walkDir(d: string) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walkDir(p);
    else if (/\.tsx?$/.test(e.name)) files.push(p);
  }
})(ROOT);

// createSourceFile with setParentNodes=true: we need parent pointers, and
// createProgram does not set them. Without them insideT/isIdentifierOperand
// silently return false and every .ts hit is suppressed.
const sourceFiles = files.map(f => ts.createSourceFile(
  f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.ESNext, /*setParentNodes*/ true,
  f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS));

function looksUserFacing(s: string): boolean {
  const t = s.trim();
  if (t.length < 2) return false;
  if (!/[A-Za-z]{2}/.test(t)) return false;              // needs real letters
  // Reject kebab/snake tokens and known CSS keywords — but NOT plain lowercase
  // words. The old `^[a-z0-9_-]+$` rejected every all-lowercase string, which
  // also dropped legitimate display words: 'tier' and 'tariff' at
  // WhatIfTab.tsx:4107 render to the user and were invisible to this scan.
  // A bare lowercase word in a rendering position is display text; enum values
  // and comparison operands are excluded by isRenderingPosition/isIdentifierOperand,
  // not by shape.
  if (/^[a-z0-9]+([-_][a-z0-9]+)+$/.test(t)) return false;   // kebab/snake token
  if (/^(auto|none|inherit|initial|unset|hidden|visible|block|inline|flex|grid|absolute|relative|fixed|sticky|static|normal|bold|italic|center|left|right|top|bottom|middle|start|end|row|column|wrap|nowrap|pointer|default|solid|dashed|dotted|transparent|currentcolor)$/.test(t)) return false;
  if (/^[A-Z_]+$/.test(t)) return false;                 // CONSTANT
  if (/^\w+\.\w+/.test(t)) return false;                 // property path
  if (/^(#|https?:|\/|\.\/|data:)/.test(t)) return false;
  if (/^[\d\s.,%£$€+\-–—:/()]*$/.test(t)) return false;  // numeric/date-ish
  if (/^[a-z]+[A-Z]\w*$/.test(t)) return false;          // camelCase identifier (baseArpu, dataKey)
  if (/rgba?\(|hsla?\(|var\(--|calc\(/.test(t)) return false;   // CSS colour / function
  if (/\d+(px|rem|em|vh|vw|pt)/.test(t)) return false; // CSS length shorthand
  if (/^[\d\s.,%#a-fA-F()/-]+$/.test(t)) return false;   // hex / numeric shorthand
  return true;
}

/** is this node lexically inside a t(...) call? */
function insideT(n: ts.Node): boolean {
  let p: ts.Node | undefined = n.parent;
  while (p) {
    if (ts.isCallExpression(p)) {
      const e = p.expression;
      if ((ts.isIdentifier(e) && e.text === 't') ||
          (ts.isPropertyAccessExpression(e) && e.name.text === 't')) return true;
    }
    p = p.parent;
  }
  return false;
}

/** is this literal an operand of a comparison / nullish default / value= prop? */
function isIdentifierOperand(n: ts.Node): boolean {
  const p = n.parent;
  if (!p) return false;
  if (ts.isBinaryExpression(p)) {
    const k = p.operatorToken.kind;
    if (k === ts.SyntaxKind.EqualsEqualsEqualsToken || k === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
        k === ts.SyntaxKind.EqualsEqualsToken || k === ts.SyntaxKind.ExclamationEqualsToken ||
        k === ts.SyntaxKind.QuestionQuestionToken) return true;
  }
  if (ts.isCaseClause(p)) return true;
  if (ts.isPropertyAssignment(p) || ts.isElementAccessExpression(p)) return true;
  // value={...} on a form control
  let a: ts.Node | undefined = p;
  while (a && !ts.isJsxAttribute(a)) a = a.parent;
  if (a && ts.isJsxAttribute(a) && (a.name as any).escapedText === 'value') return true;
  return false;
}

/**
 * Is this literal in a position that actually RENDERS, rather than merely sitting
 * somewhere beneath a JSX node? Only pass-through syntax may separate it from the
 * JsxExpression — ternary branches, &&/||/?? guards, parentheses. Anything else
 * (element access, call argument, object property) means the value is data or an
 * identifier, not display text.
 */
function isRenderingPosition(n: ts.Node): boolean {
  let cur: ts.Node = n;
  let p: ts.Node | undefined = n.parent;
  while (p) {
    if (ts.isJsxExpression(p)) return true;
    if (ts.isParenthesizedExpression(p)) { cur = p; p = p.parent; continue; }
    if (ts.isConditionalExpression(p) && (p.whenTrue === cur || p.whenFalse === cur)) { cur = p; p = p.parent; continue; }
    if (ts.isBinaryExpression(p)) {
      const k = p.operatorToken.kind;
      if (k === ts.SyntaxKind.AmpersandAmpersandToken || k === ts.SyntaxKind.BarBarToken ||
          k === ts.SyntaxKind.QuestionQuestionToken) { cur = p; p = p.parent; continue; }
    }
    return false;
  }
  return false;
}

/**
 * A t() result used where an IDENTIFIER is required — property accessor, computed
 * key, comparison operand, switch case. Always an error, never a candidate: the
 * lookup silently stops matching the moment the value is actually translated.
 * Fourth instance of this class after Base Case, All and the Field export names.
 */
function tCallInIdentifierPosition(n: ts.Node): string | null {
  if (!ts.isCallExpression(n)) return null;
  const e = n.expression;
  const isT = (ts.isIdentifier(e) && e.text === 't') ||
              (ts.isPropertyAccessExpression(e) && e.name.text === 't');
  if (!isT) return null;
  let node: ts.Node = n;
  while (node.parent && (ts.isAsExpression(node.parent) || ts.isParenthesizedExpression(node.parent) ||
         ts.isNonNullExpression(node.parent))) node = node.parent;
  const p = node.parent;
  if (!p) return null;
  if (ts.isElementAccessExpression(p) && p.argumentExpression === node) return 'property accessor';
  // Laundered through an array: `const keys = [t('a')]` then `row[k]`, or
  // `for (const k of [t('a')])`. The parent is an ArrayLiteralExpression, so the
  // direct check above misses it — this is how the ARPU y-axis domain instance
  // survived. Only flag arrays that BECOME key lists: bound to a variable, or
  // iterated by for-of. An array that is .map()ed or .join()ed straight into JSX
  // is a list of display strings and is fine.
  if (ts.isArrayLiteralExpression(p)) {
    let q: ts.Node | undefined = p;
    while (q) {
      if (ts.isJsxExpression(q)) return null;                       // renders — safe
      if (ts.isForOfStatement(q) && q.expression) return 'for-of key list';
      if (ts.isVariableDeclaration(q)) return 'array bound as key list';
      // `.join(...)` / `.map(...)` turn the array into display output, not a key
      // list, even when the result is bound to a variable.
      if (ts.isPropertyAccessExpression(q) && /^(join|map)$/.test(q.name.text)) return null;
      if (ts.isArrowFunction(q) || ts.isCallExpression(q) ||
          ts.isPropertyAccessExpression(q) || ts.isArrayLiteralExpression(q) ||
          ts.isParenthesizedExpression(q) || ts.isAsExpression(q)) { q = q.parent; continue; }
      return null;
    }
  }
  if (ts.isComputedPropertyName(p)) return 'computed object key';
  if (ts.isCaseClause(p)) return 'switch case';
  if (ts.isBinaryExpression(p)) {
    const k = p.operatorToken.kind;
    if (k === ts.SyntaxKind.EqualsEqualsEqualsToken || k === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
        k === ts.SyntaxKind.EqualsEqualsToken || k === ts.SyntaxKind.ExclamationEqualsToken)
      return 'comparison operand';
  }
  return null;
}

const identErrors: { file: string; line: number; kind: string; text: string }[] = [];

for (const sf of sourceFiles) {
  if (sf.isDeclarationFile || !/[\\/]src[\\/]/.test(sf.fileName)) continue;
  const rel = path.relative(process.cwd(), sf.fileName);
  const isTsx = sf.fileName.endsWith('.tsx');

  const push = (n: ts.Node, kind: string, text: string, note?: string) => {
    const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
    // nearest enclosing JSX element — fragments of one rendered sentence share it
    let c: ts.Node | undefined = n.parent, container = -1;
    while (c) { if (ts.isJsxElement(c) || ts.isJsxFragment(c)) { container = c.getStart(sf); break; } c = c.parent; }
    hits.push({ file: rel, line: line + 1, kind, text: text.trim().slice(0, 90), note, container });
  };

  (function visit(n: ts.Node) {
    // 0. t() used where an identifier is required — hard error, not a candidate.
    const idPos = tCallInIdentifierPosition(n);
    if (idPos) {
      const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
      identErrors.push({ file: rel, line: line + 1, kind: idPos, text: n.getText(sf).slice(0, 80) });
    }
    // 1. JSX text between tags
    if (ts.isJsxText(n)) {
      const t = n.text.replace(/\s+/g, ' ').trim();
      if (looksUserFacing(t) && !NEVER.has(t)) push(n, 'JSXText', t);
    }
    // 2. JSX attribute string values
    else if (ts.isJsxAttribute(n) && n.initializer) {
      const an = n.name.getText(sf);
      if (UI_ATTRS.has(an) && ts.isStringLiteral(n.initializer)) {
        const t = n.initializer.text;
        if (looksUserFacing(t) && !NEVER.has(t)) push(n, `attr:${an}`, t);
      }
    }
    // 3. string / template literals inside JSX expression containers
    else if (isTsx && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n))) {
      // A literal is in a RENDERING position only if nothing but pass-through
      // syntax separates it from the JsxExpression. Walking the parent chain
      // unconditionally is wrong: a property accessor inside a {...map()} block
      // has a JsxExpression somewhere above it but is an identifier, not text.
      // That bug produced `countLabel=t(...)` and, worse, the Monthly Variance
      // regression where row[`${prefix}_actual`] became row[t('actuals_actual')].
      const inJsxExpr = isRenderingPosition(n);
      if (inJsxExpr && !insideT(n)) {
        let text = '';
        if (ts.isTemplateExpression(n)) {
          text = n.head.text + n.templateSpans.map(s => '{}' + s.literal.text).join('');
        } else text = (n as ts.StringLiteral).text;
        if (looksUserFacing(text) && !NEVER.has(text.trim())) {
          const attrSkip = (() => { let a: ts.Node | undefined = n.parent;
            while (a && !ts.isJsxAttribute(a)) a = a.parent;
            return a && ts.isJsxAttribute(a) ? SKIP_ATTRS.has(a.name.getText(sf)) : false; })();
          if (!attrSkip) {
            push(n, ts.isTemplateExpression(n) ? 'JSXExpr:template' : 'JSXExpr:string', text,
                 isIdentifierOperand(n) ? 'IDENTIFIER-OPERAND' : undefined);
          }
        }
      }
    }
    // 3b. .tsx object-literal string VALUES. Strings defined in a config object at
    // component scope and rendered later via .map() never appear in a JSX position,
    // so the JSX walk above cannot see them — this is the class that let
    // BulkGenerateModal's option labels pass as clean. Bucketed for review because
    // object values are also full of config, enum-like tokens and CSS.
    if (isTsx && ts.isStringLiteral(n) && n.parent && ts.isPropertyAssignment(n.parent) &&
        n.parent.initializer === n && !insideT(n)) {
      let inJsx = false, q: ts.Node | undefined = n.parent;
      while (q) { if (ts.isJsxExpression(q)) { inJsx = true; break; } q = q.parent; }
      const propName = ts.isIdentifier(n.parent.name) || ts.isStringLiteral(n.parent.name)
        ? (n.parent.name as any).text : '';
      const t = n.text;
      if (!inJsx && !SKIP_ATTRS.has(propName) && looksUserFacing(t) && !NEVER.has(t.trim()))
        push(n, 'ObjLiteral', t, propName);
    }
    // 4. .ts utilities — sentence-like literals (candidates, need human review)
    if (!isTsx && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n))) {
      // A string used as an object-literal KEY is a data contract (export column
      // header, chart series key), never display copy. Translating one silently
      // changes the shape of exported data.
      const isObjectKey = n.parent && ts.isPropertyAssignment(n.parent) && n.parent.name === n;
      if (!insideT(n) && !isObjectKey) {
        let text = '';
        if (ts.isTemplateExpression(n)) text = n.head.text + n.templateSpans.map(s => '{}' + s.literal.text).join('');
        else text = (n as ts.StringLiteral).text;
        const t = text.trim();
        // sentence-like: has a space and at least three letter-groups, or ends in punctuation
        if (looksUserFacing(t) && /\s/.test(t) && (t.split(/\s+/).length >= 3 || /[.!?:]$/.test(t)) && !NEVER.has(t)) {
          if (n.parent && !ts.isImportDeclaration(n.parent) && !ts.isExportDeclaration(n.parent)) push(n, 'TS-literal', t);
        }
      }
    }
    ts.forEachChild(n, visit);
  })(sf);
}

// ---- report ----
const byFile = new Map<string, Hit[]>();
for (const h of hits) { if (!byFile.has(h.file)) byFile.set(h.file, []); byFile.get(h.file)!.push(h); }
const ident = hits.filter(h => h.note === 'IDENTIFIER-OPERAND');
const real = hits.filter(h => h.note !== 'IDENTIFIER-OPERAND');

console.log('AST i18n SCAN — unkeyed user-facing string candidates\n');
console.log('file'.padEnd(46) + 'total'.padStart(7) + 'toExtract'.padStart(11) + 'identifier'.padStart(12));
console.log('-'.repeat(76));
for (const [f, hs] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const id = hs.filter(h => h.note === 'IDENTIFIER-OPERAND').length;
  console.log(f.padEnd(46) + String(hs.length).padStart(7) + String(hs.length - id).padStart(11) + String(id).padStart(12));
}
console.log('-'.repeat(76));
console.log('TOTAL'.padEnd(46) + String(hits.length).padStart(7) + String(real.length).padStart(11) + String(ident.length).padStart(12));

const byKind = new Map<string, number>();
for (const h of real) byKind.set(h.kind, (byKind.get(h.kind) || 0) + 1);
console.log('\nBY KIND (to extract):');
for (const [k, v] of [...byKind.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(22)}${v}`);

// ---------------------------------------------------------------------------
// Bucket classification. Buckets 1a / 6 / 7 must be empty — anything in them is
// a user-facing string sitting outside a translation key. Buckets 1b and 5 are
// known-deferred work (<Trans> conversion, displayLabel helper): reported, but
// they do not fail the check until those passes land.
// ---------------------------------------------------------------------------
const DATEFMT = /^[yMdHhms\-/:. ]+$/;
const DEBUG = /^\[|console|cohort=/;
const CHARTKEY = /^(Inflow|Outflow|Retention|Base|ARPU|Customer|Total) .*(\(Baseline\)|\(Uplifted\)|\(Adjusted\))$/;
const FRAGMENT = /^[a-z(]|^[A-Z][a-z]*$|'t$/;

/**
 * Known <Trans> backlog — sites where the surrounding sentence must be converted
 * as a whole, so the individual strings must NOT be keyed in isolation. Keyed by
 * `file:line` so the backlog is machine-checked, not just documented prose.
 *
 * WhatIfTab.tsx:4107 renders:
 *   — {n} {axis === 'tariff' ? 'tariff' : 'tier'}{n !== 1 ? 's' : ''}
 * The trailing `{n !== 1 ? 's' : ''}` is an English-only pluralisation. Most
 * target locales do not pluralise by appending 's' (German Tarif/Tarife,
 * French tarif/tarifs but tier/tiers differs, Italian tariffa/tariffe), and
 * several have more than two plural forms. Keying 'tier' and 'tariff' alone
 * would bake the suffix ternary in permanently. This needs i18next plural
 * forms — key_one / key_other with { count } — inside a <Trans>, not four
 * separate keys.
 */
const TRANS_BACKLOG = new Set<string>([
  // Keyed by file + TEXT, never file + line: line numbers shift whenever anything
  // above them is edited, which silently un-defers the entry and fails the build
  // for an unrelated change. Learned when a JSX removal moved this site 4107->4085.
  'WhatIfTab.tsx::tariff',
  'WhatIfTab.tsx::tier',
]);

function bucketOf(h: Hit): string {
  const base = h.file.split(/[\\/]/).pop() ?? h.file;
  if (TRANS_BACKLOG.has(`${base}::${h.text.trim()}`)) return '1b fragment (DEFERRED Trans)';
  const t = h.text.trim();
  if (h.note === 'IDENTIFIER-OPERAND') return 'ident (excluded)';
  if (DATEFMT.test(t) && t.length <= 20) return 'date-format (excluded)';
  if (DEBUG.test(t)) return 'debug-log (excluded)';
  if (CHARTKEY.test(t)) return '5 chart-series-key (DEFERRED displayLabel)';
  if (h.kind === 'ObjLiteral') return '8 object-literal (REVIEW)';
  if (h.kind === 'JSXExpr:template') return '6 interpolated (MUST KEY)';
  if (h.kind === 'TS-literal') return '7 ts-utility (MUST KEY)';
  if (h.kind === 'JSXText' && FRAGMENT.test(t) && t.split(/\s+/).length <= 3) return '1b fragment (DEFERRED Trans)';
  return '1a simple (MUST KEY)';
}

// Fragments of one rendered sentence share a container. If a container holds
// both a 1a and a 1b fragment, the whole sentence becomes 1b — a half-keyed
// sentence is worse than a fully English one.
const containerBuckets = new Map<string, Set<string>>();
for (const h of hits) {
  const k = `${h.file}#${h.container}`;
  if (!containerBuckets.has(k)) containerBuckets.set(k, new Set());
  containerBuckets.get(k)!.add(bucketOf(h));
}
const straddled = new Set<string>();
for (const [k, bs] of containerBuckets)
  if (bs.has('1a simple (MUST KEY)') && bs.has('1b fragment (DEFERRED Trans)')) straddled.add(k);

const bucketed = hits.map(h => ({
  ...h,
  bucket: straddled.has(`${h.file}#${h.container}`) && bucketOf(h) === '1a simple (MUST KEY)'
    ? '1b fragment (DEFERRED Trans)' : bucketOf(h),
}));

const counts = new Map<string, number>();
for (const b of bucketed) counts.set(b.bucket, (counts.get(b.bucket) || 0) + 1);
console.log('\nBY BUCKET:');
for (const [k, v] of [...counts.entries()].sort()) console.log(`  ${k.padEnd(44)}${v}`);
if (straddled.size) console.log(`  (${straddled.size} straddling container(s): 1a fragments promoted to 1b)`);

fs.writeFileSync('scan_i18n_report.json', JSON.stringify(bucketed, null, 2));
console.log('\nfull inventory -> scan_i18n_report.json');

// ---------------------------------------------------------------------------
// t() in an identifier position. Reported ALWAYS, and always an error — a
// translated value doing an identifier's job breaks lookups silently the moment
// it is translated, and in the Monthly Variance case it was already broken in
// English because the key slug collided with a display string.
// ---------------------------------------------------------------------------
console.log(`\nt() IN IDENTIFIER POSITION: ${identErrors.length}`);
for (const e of identErrors) console.log(`  ${e.file}:${e.line}  [${e.kind}]  ${e.text}`);

// ---------------------------------------------------------------------------
// LOCALE PARITY — a key in `en` and absent from any of the five other locales.
//
// TERMBASE §13 asked for these to be recorded by hand, in the same commit that
// added the key. That rule was broken TWICE by the person who wrote it, caught
// both times by the pre-merge gate and never at commit time. A rule that relies
// on someone remembering it will keep being missed, so it is a build failure
// now — the same way the identifier-position rule was closed.
//
// Existing debt sits in LOCALE_DEFERRED rather than blocking the build: these
// are known, recorded in TERMBASE §13, and awaiting phase 2 commissioning.
// `fallbackLng` is 'en', so they render English rather than a raw key.
//
// ADDING to this list is a deliberate act. It means "this ships English for
// now", and it belongs in the same commit as the key, with a §13 row.
// ---------------------------------------------------------------------------
const LOCALE_DEFERRED = new Set<string>([
  // Recorded in src/locales/TERMBASE.md §13, 2026-07-30 and 2026-07-31.
  'actuals_no_forecast_yet_tooltip',
  'actuals_revenue_no_band',
  'actuals_show',
  'actuals_unit_arpu',
  'actuals_unit_revenue',
  'actuals_value_revenue',
  'bulk_large_run_detail',
  'bulk_large_run_title',
  'bulk_no_source_cohort',
]);

const LOCALES = ['de', 'es', 'fr', 'it', 'pt'];
const localeGaps: { key: string; missingFrom: string[] }[] = [];
const staleDeferred: string[] = [];
{
  const readLocale = (l: string): Record<string, string> => {
    const f = path.join('src', 'locales', l, 'translation.json');
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  };
  const enBundle = readLocale('en');
  const others = Object.fromEntries(LOCALES.map(l => [l, readLocale(l)]));
  for (const key of Object.keys(enBundle)) {
    if (LOCALE_DEFERRED.has(key)) continue;
    const missingFrom = LOCALES.filter(l => !(key in others[l]));
    if (missingFrom.length) localeGaps.push({ key, missingFrom });
  }
  // A deferred key that HAS been translated everywhere should leave the list,
  // or it silently exempts a key that no longer needs exempting.
  for (const k of LOCALE_DEFERRED) {
    if (k in enBundle && LOCALES.every(l => k in others[l])) staleDeferred.push(k);
  }
  console.log(`\nLOCALE PARITY: ${localeGaps.length} key(s) in en missing from another locale ` +
    `(${LOCALE_DEFERRED.size} explicitly deferred)`);
  for (const g of localeGaps) console.log(`  ${g.key} — missing from ${g.missingFrom.join(', ')}`);
  for (const k of staleDeferred) console.log(`  ${k} — now translated everywhere; remove from LOCALE_DEFERRED`);
}

const mustKey = bucketed.filter(b => b.bucket.includes('MUST KEY'));
if (process.argv.includes('--check')) {
  if (identErrors.length) {
    console.error(`\nFAIL: ${identErrors.length} t() call(s) used where an identifier is required.`);
    console.error('A translated value must never be a property accessor, computed key,');
    console.error('comparison operand or switch case. Keep the identifier a literal and key');
    console.error('the display form separately (TERMBASE §11).');
    process.exit(1);
  }
  if (mustKey.length) {
    console.error(`\nFAIL: ${mustKey.length} user-facing string(s) sit outside a translation key.`);
    for (const m of mustKey.slice(0, 25))
      console.error(`  ${m.file}:${m.line}  [${m.bucket}]  ${m.text.slice(0, 68)}`);
    if (mustKey.length > 25) console.error(`  ... and ${mustKey.length - 25} more — see scan_i18n_report.json`);
    process.exit(1);
  }
  if (localeGaps.length) {
    console.error(`\nFAIL: ${localeGaps.length} key(s) exist in en but not in every locale.`);
    for (const g of localeGaps.slice(0, 25))
      console.error(`  ${g.key} — missing from ${g.missingFrom.join(', ')}`);
    if (localeGaps.length > 25) console.error(`  ... and ${localeGaps.length - 25} more`);
    console.error('Either translate them, or add them to LOCALE_DEFERRED in this file AND');
    console.error('record a row in src/locales/TERMBASE.md §13 — in THIS commit, not later.');
    process.exit(1);
  }
  console.log('\nPASS: every user-facing string resolves from a translation key or an agreed exclusion,');
  console.log('and every key exists in all six locales or is explicitly deferred.');
}
