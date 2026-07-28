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
  if (/^[a-z0-9_\-]+$/.test(t)) return false;            // css-ish / enum-ish token
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
      let inJsxExpr = false, p: ts.Node | undefined = n.parent;
      while (p) { if (ts.isJsxExpression(p)) { inJsxExpr = true; break; } p = p.parent; }
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
    // 4. .ts utilities — sentence-like literals (candidates, need human review)
    if (!isTsx && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n))) {
      if (!insideT(n)) {
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

function bucketOf(h: Hit): string {
  const t = h.text.trim();
  if (h.note === 'IDENTIFIER-OPERAND') return 'ident (excluded)';
  if (DATEFMT.test(t) && t.length <= 20) return 'date-format (excluded)';
  if (DEBUG.test(t)) return 'debug-log (excluded)';
  if (CHARTKEY.test(t)) return '5 chart-series-key (DEFERRED displayLabel)';
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

const mustKey = bucketed.filter(b => b.bucket.includes('MUST KEY'));
if (process.argv.includes('--check')) {
  if (mustKey.length) {
    console.error(`\nFAIL: ${mustKey.length} user-facing string(s) sit outside a translation key.`);
    for (const m of mustKey.slice(0, 25))
      console.error(`  ${m.file}:${m.line}  [${m.bucket}]  ${m.text.slice(0, 68)}`);
    if (mustKey.length > 25) console.error(`  ... and ${mustKey.length - 25} more — see scan_i18n_report.json`);
    process.exit(1);
  }
  console.log('\nPASS: every user-facing string resolves from a translation key or an agreed exclusion.');
}
