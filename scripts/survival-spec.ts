/**
 * FIRST-ROW DEREFERENCES ARE BASELINED, PER FILE, EXACT BOTH WAYS.
 *
 *   npm run spec:survival
 *
 * WHAT THIS GUARDS. A spec that writes `rows[0].field` on an array that can be
 * empty does not fail when the array is empty — it THROWS, and a spec that
 * throws exits non-zero having printed no report line. Under guard-traps that
 * reads as CRASHED; under a naive runner it reads as a failure whose message
 * is a stack trace. Traps 72 and 90 were both this, and the 1327 session spent
 * itself proving they were spec deaths rather than defects.
 *
 * WHAT IT DOES NOT CLAIM. It does not distinguish GUARDED from UNGUARDED
 * dereferences, and saying it did would be the more useful claim dressed up as
 * the checkable one. "Is this site guarded" needs flow analysis — the length
 * check may be ten lines up, inside an `if` that returns, or implied by a
 * literal fixture that cannot be empty. "Does this site EXIST" needs a regex.
 * So the baseline counts every first-row dereference, and its value is that a
 * NEW one cannot appear silently: the number moves, and whoever moved it
 * decides whether it needed a guard.
 *
 * EXACT BOTH WAYS. A `>=` here would stop noticing a site disappearing, and a
 * disappearing site is how a fixture quietly stopped covering something. The
 * same rule the trap-anchor and caller-count checks already follow.
 *
 * THE 87 IN THE 1327 REPORT IS NOT THIS NUMBER. It was counted by hand, before
 * three sessions added specs, and it was re-counted from scratch here rather
 * than carried forward. Recount when this fails; do not adjust the total to
 * make it pass.
 */
import * as fs from 'fs';
import * as path from 'path';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

/** A first-row dereference on a named array: an identifier, then index zero,
 *  then a member access. */
const FIRST_ROW = /[A-Za-z_$][A-Za-z0-9_$]*\[0\]\./g;

/**
 * COMMENTS ARE STRIPPED FIRST, and that is not tidiness.
 *
 * Measured: without it this file counted TWO sites in its own prose, because
 * the doc comment above names the pattern it looks for. A counter that fires
 * on an edit to a comment is a counter nobody will keep at the right value —
 * it would be adjusted to pass, which is exactly the failure mode the
 * exact-both-ways rule exists to prevent.
 *
 * It is a TEXT strip, not a parse: a `//` inside a string literal takes the
 * rest of that line with it. That is a known and accepted imprecision — an AST
 * pass would be a second parser to keep in step, and the quantity being
 * guarded is "did a new one appear", which survives the approximation.
 */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');

const DIR = 'scripts';
const files = fs.readdirSync(DIR)
  .filter(f => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.startsWith('.'))
  .sort();

const counted: Record<string, number> = {};
for (const f of files) {
  const src = stripComments(fs.readFileSync(path.join(DIR, f), 'utf8'));
  const n = (src.match(FIRST_ROW) ?? []).length;
  if (n > 0) counted[f] = n;
}

/**
 * THE BASELINE, measured 2026-09-05 by this file's own regex over this file's
 * own file list — so the instrument that pins it is the instrument that
 * produced it, and a disagreement is a real change rather than two counting
 * methods differing.
 */
const BASELINE: Record<string, number> = {
  'aggregate-reconciliation-spec.ts': 1,
  'aggregate-retire-spec.ts': 1,
  'amount-control-spec.ts': 6,
  'applied-count-spec.ts': 2,
  'arpu-companion-spec.ts': 2,
  'base-seed-spec.ts': 4,
  'challenger-render-spec.tsx': 2,
  'churn-fold-spec.ts': 27,
  'compare-events-panel-spec.ts': 5,
  'derived-interaction-spec.ts': 7,
  'event-roundtrip-spec.ts': 3,
  'events-summary-spec.ts': 1,
  'generate-missing-spec.ts': 2,
  'guard-traps.ts': 2,
  'i18n-parity-spec.ts': 1,
  'import-seam-spec.ts': 1,
  'mix-card-spec.tsx': 2,
  'null-render-spec.tsx': 2,
  'percentage-events-spec.ts': 6,
  'provenance-spec.ts': 2,
  'regression-traps.tsx': 1,
  'scan-i18n.ts': 1,
  'step1-selection-spec.tsx': 6,
  'unscored-row-spec.tsx': 4,
  // ADDED 2026-09-05, deliberately and after looking at each one. All four are
  // `pctEdit.written[0].patch...` / `absEdit.written[0].patch...`, and each
  // sits in an && chain whose FIRST term is `written.length === 1`. JavaScript
  // short-circuits, so index zero is reached only when there is a row there.
  // Guarded, therefore - which is a judgement this spec deliberately does not
  // try to make for itself, so it is recorded here in prose beside the count.
  // 5 since 2026-09-05 (D5-04): the fifth is `viaPromo[0].patch`, inside an
  // `if (viaPromo.length === 1)` block. Guarded, like the other four.
  'view-apply-mounted-spec.tsx': 5,
};

const TOTAL = Object.values(BASELINE).reduce((a, b) => a + b, 0);

// Per file, exact, in BOTH directions — a new file with sites fails here too.
const names = new Set([...Object.keys(BASELINE), ...Object.keys(counted)]);
for (const f of [...names].sort()) {
  const want = BASELINE[f] ?? 0;
  const got = counted[f] ?? 0;
  check(`survival: ${f} has exactly ${want} first-row dereference(s)`,
    got === want,
    `counted ${got}` + (want === 0
      ? ' — a NEW file with first-row dereferences; add it to the baseline deliberately'
      : got === 0 ? ' — the sites are gone; lower the baseline deliberately' : ''));
}

const total = Object.values(counted).reduce((a, b) => a + b, 0);
check(`survival: ${TOTAL} first-row dereferences in total`, total === TOTAL,
  `counted ${total} — the 1327 report's 87 was a DIFFERENT count, taken by hand`
  + ' before three sessions added specs; recount, do not adjust to fit');

console.log(`\nFIRST-ROW DEREFERENCES: ${total} across ${Object.keys(counted).length} file(s)`);
console.log(`survival spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fails.length ? 1 : 0);
