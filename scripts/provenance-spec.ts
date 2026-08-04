/**
 * Spec for Phase 1 — the provenance union.
 *
 *   npm run spec:provenance
 *
 * The phase exists to remove ONE fiction: that a derived aggregate has a model
 * and a set of fitted parameters. Every assertion here is ultimately about that
 * fiction being impossible to reintroduce quietly.
 *
 * Two mutations must kill this spec, and both are checked by hand at build time
 * (see the branch report):
 *   1. reinstating any `?? 'Holt Linear'` on a modelUsed read;
 *   2. making `provenanceModel()` return a default instead of null.
 * The second is the one that matters most — a default there would make every
 * consumer's derived-arm handling dead code while leaving the types intact, so
 * the spec would still compile and the fiction would be back everywhere at once.
 */
import { provenanceModel, provenanceParams } from '../src/types/forecast';
import type { Provenance, FittedParamsBundle } from '../src/types/forecast';
import { calculateBaseForecast } from '../src/utils/forecasting';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

const params: FittedParamsBundle = {
  inflow: { alpha: 0.3, beta: 0.1, mse: 0, sigma: 0 },
  outflow: { alpha: 0.3, beta: 0.1, mse: 0, sigma: 0 },
  retention: { alpha: 0.3, beta: 0.1, mse: 0, sigma: 0 },
  arpu: { alpha: 0.3, beta: 0.1, mse: 0, sigma: 0 },
};

const FITTED: Provenance = { kind: 'fitted', modelUsed: 'Damped Trend', fittedParams: params };
const ACCEPTED: Provenance = { kind: 'accepted', modelUsed: 'Holt-Winters', fittedParams: params,
  replacedModel: 'Holt Linear', acceptedAt: '2026-08-04T00:00:00.000Z' };
const DERIVED: Provenance = { kind: 'derived', leafCount: 74,
  models: { 'Holt Linear': 68, 'Damped Trend': 6 },
  coverage: { inScope: 74, withForecast: 72, skipped: [{ fKey: 'A|B|C|D|E|F|G', reason: 'insufficient-history' }] } };

// ── THE NO-DEFAULT REGRESSION CASE ────────────────────────────────────────
// This is the case a `provenanceModel` default would kill, and the reason the
// function returns null at all.
check('THE NO-DEFAULT CASE: a derived aggregate has NO model',
  provenanceModel(DERIVED) === null, String(provenanceModel(DERIVED)));
check('THE NO-DEFAULT CASE: a derived aggregate has NO fitted params',
  provenanceParams(DERIVED) === null, String(provenanceParams(DERIVED)));
check('...and specifically NOT the default that used to be substituted',
  (provenanceModel(DERIVED) as unknown) !== 'Holt Linear');

check('a fitted forecast reports its own model',
  provenanceModel(FITTED) === 'Damped Trend');
check('an accepted forecast reports its adopted model',
  provenanceModel(ACCEPTED) === 'Holt-Winters');
check('an accepted forecast records what it replaced',
  ACCEPTED.kind === 'accepted' && ACCEPTED.replacedModel === 'Holt Linear');
check('an accepted forecast records when',
  ACCEPTED.kind === 'accepted' && ACCEPTED.acceptedAt.startsWith('2026-'));
check('fitted params survive on both non-derived arms',
  provenanceParams(FITTED) === params && provenanceParams(ACCEPTED) === params);

// ── THE DERIVED ARM CARRIES WHAT IT DOES KNOW ─────────────────────────────
check('derived carries a leaf count', DERIVED.kind === 'derived' && DERIVED.leafCount === 74);
check('derived carries the MODEL MIX rather than one model',
  DERIVED.kind === 'derived' && Object.keys(DERIVED.models).length === 2);
check('derived carries coverage, and names the skipped leaves',
  DERIVED.kind === 'derived' && DERIVED.coverage.skipped[0].fKey === 'A|B|C|D|E|F|G');
check('coverage reuses the Phase 0 reason vocabulary',
  DERIVED.kind === 'derived' && DERIVED.coverage.skipped[0].reason === 'insufficient-history');

// ── EXPORT / IMPORT ROUND-TRIP (option C) ─────────────────────────────────
// Mirrors App.tsx's export columns and readProvenance exactly. Kept in step by
// the assertions below, which check the SHAPE the app writes and reads.
const exportRow = (p: Provenance) => ({
  Model_Used: provenanceModel(p) ?? '',
  Provenance: p.kind,
  Leaf_Count: p.kind === 'derived' ? p.leafCount : '',
  Replaced_Model: p.kind === 'accepted' ? p.replacedModel : '',
  Accepted_At: p.kind === 'accepted' ? p.acceptedAt : '',
});
const readProvenance = (row: Record<string, any>): Provenance => {
  const kind = String(row.Provenance ?? '').trim() || 'fitted';
  if (kind === 'derived') {
    return { kind: 'derived', leafCount: Number(row.Leaf_Count ?? 0), models: {},
      coverage: { inScope: 0, withForecast: 0, skipped: [] } };
  }
  const modelUsed = (String(row.Model_Used ?? '').trim() || 'Holt Linear') as any;
  if (kind === 'accepted') {
    return { kind: 'accepted', modelUsed,
      replacedModel: (String(row.Replaced_Model ?? '').trim() || modelUsed) as any,
      acceptedAt: String(row.Accepted_At ?? '') };
  }
  return { kind: 'fitted', modelUsed };
};

const dRow = exportRow(DERIVED);
check('EXPORT: Model_Used is EMPTY for a derived row', dRow.Model_Used === '', JSON.stringify(dRow.Model_Used));
check('EXPORT: Model_Used stays an enum for fitted', exportRow(FITTED).Model_Used === 'Damped Trend');
check('EXPORT: Provenance column carries the discriminant', dRow.Provenance === 'derived');
check('EXPORT: Leaf_Count is populated for derived only',
  dRow.Leaf_Count === 74 && exportRow(FITTED).Leaf_Count === '');

check('ROUND-TRIP derived -> derived', readProvenance(dRow).kind === 'derived');
check('ROUND-TRIP: a derived row does NOT come back with a model',
  provenanceModel(readProvenance(dRow)) === null,
  String(provenanceModel(readProvenance(dRow))));
check('ROUND-TRIP: leaf count survives',
  (readProvenance(dRow) as any).leafCount === 74);
check('ROUND-TRIP fitted -> fitted, model intact',
  provenanceModel(readProvenance(exportRow(FITTED))) === 'Damped Trend');
check('ROUND-TRIP accepted -> accepted, replaced model and date intact',
  (() => { const r = readProvenance(exportRow(ACCEPTED));
    return r.kind === 'accepted' && r.replacedModel === 'Holt Linear' && r.acceptedAt.startsWith('2026-'); })());

// ── NO-COLUMN -> FITTED ───────────────────────────────────────────────────
// A file with no Provenance column predates option C, and everything in such a
// file was fitted. That is a fact about old files, not a default.
const legacy = { Model_Used: 'Holt Linear' };
check('NO COLUMN: an old export imports as fitted', readProvenance(legacy).kind === 'fitted');
check('NO COLUMN: its model is preserved', provenanceModel(readProvenance(legacy)) === 'Holt Linear');
check('EMPTY COLUMN behaves the same as absent',
  readProvenance({ Provenance: '', Model_Used: 'Holt Linear' }).kind === 'fitted');

// ── THE PRODUCER WRITES THE FITTED ARM ────────────────────────────────────
// Drives the real calculateBaseForecast rather than restating what it should do.
const rows: any[] = [];
for (let i = 0; i < 12; i++) {
  const d = new Date(2025, i, 1);
  rows.push({ _parsedDate: d, inflow: 100 + i, outflow: 40 + i, retention: 20 + i,
    arpu: 10, inflowArpu: 10, outflowArpu: 10, retentionArpu: 10, baseArpu: 10 });
}
const bf = calculateBaseForecast(rows, { segment: 'S', product: 'P', productL2: 'All',
  channel: 'C', channelL2: 'All', tariffL1: 'All', tariffL2: 'All', scenario: 'Base Case' } as any,
  1000, 6, 1.28, 0.02, 3, 'Damped Trend');
check('GUARD: the producer actually produced a forecast', !!bf);
check('the producer writes the FITTED arm', bf!.provenance.kind === 'fitted');
check('...carrying the model it was asked for',
  provenanceModel(bf!.provenance) === 'Damped Trend', String(provenanceModel(bf!.provenance)));
check('...and its fitted parameters', provenanceParams(bf!.provenance) !== null);

// ── PROVABLY AGGREGATE-FREE ───────────────────────────────────────────────
// Phase 1's control: nothing in src/ constructs a derived provenance yet.
// Phase 2 introduces deriveAggregate; until then a derived arm can only come
// from a test fixture or an imported row, and this assertion says so.
import * as fs from 'fs';
import * as path from 'path';
const srcFiles: string[] = [];
(function walk(dir: string) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f);
    else if (/\.(ts|tsx)$/.test(e.name)) srcFiles.push(f);
  }
})('src');
// A CONSTRUCTION uses a comma (`kind: 'derived',`); the union DECLARATION uses
// a semicolon (`kind: 'derived';`). Matching the comma alone distinguishes them
// without excluding the types file by name, which would have made this check
// blind to a future constructor added there.
// App.tsx's readProvenance is excluded deliberately: it rebuilds a provenance
// from an IMPORTED row, which is data, not derivation.
// The readProvenance exemption is per-LINE-REGION, not per-file. It was
// file-level and gate stage 2 proved that unsound: a `kind: 'derived',`
// planted anywhere in App.tsx passed, because App.tsx contains the word
// readProvenance somewhere. App.tsx is where Phase 2's deriveAggregate is
// planned to live, so that was the file the check was blindest in.
const constructors: string[] = [];
for (const f of srcFiles) {
  const lines = fs.readFileSync(f, 'utf8').split(String.fromCharCode(10))
    .map(l => l.replace(/\s+$/, ''));
  lines.forEach((line, i) => {
    if (!/kind:\s*'derived',/.test(line)) return;
    // Allowed ONLY inside readProvenance, which rebuilds provenance from an
    // IMPORTED row - data, not derivation. Judged from the nearest preceding
    // 20 lines rather than from the whole file: the exemption was file-level
    // and gate stage 2 proved that unsound, because a construction planted
    // anywhere in App.tsx passed merely because App.tsx contains the word
    // readProvenance somewhere. App.tsx is where Phase 2's deriveAggregate is
    // planned to live, so it was the file this check was blindest in.
    // Window widened 20 -> 120 and deriveAggregate added: Phase 2 Session A
    // makes it a legitimate producer, and its construction sits 96 lines
    // below its header. This guard is now the WEAKER of two - the brace-depth
    // version in spec:derive supersedes it and is the one planted-violation
    // tested in three locations. Extend that one, not this.
    const ctx = lines.slice(Math.max(0, i - 120), i).join(String.fromCharCode(10));
    if (/readProvenance\s*=|function deriveAggregate/.test(ctx)) return;
    constructors.push(f + ':' + (i + 1));
  });
}

// RETIRED - superseded by GUARD 1 in scripts/derive-aggregate-spec.ts.
// Phase 2 Session A makes deriveAggregate a legitimate producer, so the
// blanket 'nothing constructs derived' assertion is now false by design. The
// narrower property - deriveAggregate is the ONLY producer - is guarded
// there, by brace depth rather than proximity, and planted-violation tested
// in three locations. Not kept as a weaker duplicate: two guards for one
// property drift, and the weaker one is the one someone reads.
void constructors;

// -- NO MODEL DEFAULT AT A CONSUMER -----------------------------------------
// The second required mutation: reinstating `?? 'Holt Linear'` on a
// provenanceModel() read. That is the exact shape this phase removes - it makes
// the derived arm unreachable at that site while leaving every type intact, so
// nothing else in this spec would notice.
//
// DISPLAY sites may render '' for a model that does not exist. What they may
// not do is invent one.
const offenders: string[] = [];
for (const f of srcFiles) {
  const src = fs.readFileSync(f, 'utf8');
  const re = /provenanceModel\([^)]*\)\s*\?\?\s*'[^']+'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (/\?\?\s*''$/.test(m[0])) continue;             // empty string is a blank, not a model
    offenders.push(`${f}: ${m[0]}`);
  }
}
check('NO CONSUMER DEFAULTS a model name onto a derived forecast',
  offenders.length === 0, offenders.join('  |  '));

console.log(`provenance spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
