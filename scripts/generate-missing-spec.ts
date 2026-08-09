/**
 * GENERATE THE MISSING LEAVES, AND WRITE NOTHING UNDER AN AGGREGATE KEY.
 *
 *   npm run spec:generate-missing
 *
 * Session H replaces Session G's Step 1 decline. An aggregate selection no
 * longer refuses; it enumerates the leaves underneath, fits the ones that are
 * missing, and lets derivation cover the total. Nothing is ever written under
 * the All-bearing key itself.
 *
 * THE MIRROR CONTROL is the second half and the more important one. The
 * generate path is easy to check by what it produces; the invariant worth
 * holding is what NO path produces. So every store-writing site is enumerated
 * and the same question asked of each.
 *
 * ── The invariant is NOT "zero All-bearing writes" ──────────────────────────
 *
 * That is how it was first stated and it is false. When a dimension is not
 * mapped — no tariff columns in the upload — every genuine leaf key carries
 * 'All' in those slots. Those are real fitted leaves, not aggregates, and
 * refusing to write them would refuse the whole dataset.
 *
 * The honest invariant: **no write under a key that is All-bearing in a
 * dimension that is actually MAPPED.** An 'All' in an unmapped dimension is a
 * leaf; an 'All' in a mapped dimension is an aggregate. Same marker, different
 * meaning, decided by how the key was built — the same distinction the legacy
 * import site draws for its own reason.
 *
 * ── A live fragility this spec pins rather than fixes ───────────────────────
 *
 * `isRetiredAggregateFit` does NOT make that distinction: it is pure key-plus-
 * provenance and has no idea which dimensions were mapped. So on an
 * unmapped-dimension dataset it classifies every genuine leaf fit as retired.
 * Measured: it returns true for them.
 *
 * They survive anyway, and the reason is an accident worth knowing about.
 * `buildRollUpIndex` maps a leaf key to a list containing ITSELF, the leaf read
 * inside derivation is not gated by the rule, and `deriveAggregate` of a single
 * leaf returns that leaf unchanged — so the refused store hit is handed straight
 * back, provenance and model name intact. Nothing is lost.
 *
 * It works, but not by design, and the load-bearing part is single-leaf
 * identity in `deriveAggregate`. If that ever stops being an identity — a
 * re-derived confidence band would do it — every forecast on every
 * unmapped-dimension dataset changes at once, silently. The checks at the end
 * of this file pin that identity so the accident cannot be removed quietly.
 */
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import {
  buildCohortDataMap, buildRollUpIndex, missingLeavesForKey, isAllBearing,
  isRetiredAggregateFit, resolveFromStore, deriveAggregate, calculateBaseForecast, classifySkip,
  makeForecastKey,
} from '../src/utils/forecasting';
import type { BaseForecast } from '../src/types/forecast';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

const FIX = 'test-data/VBU_IBRO_EdgeCases_ShortHistory_PerScenarioARPU_Jan2023_Jun2026.xlsx';
const C = { date: 'Month', metric: 'IBRO_Scenario_Type', value: 'Subscriber_Volume',
  seg: 'Customer_Segment', prod: 'Product_L1', prodL2: 'Product_L2_Value_Tier',
  chan: 'Channel_Level_1', chanL2: 'Channel_Level_2',
  t1: 'tariff_tier_l1', t2: 'tariff_tier_l2', rev: 'Monthly_Revenue_GBP' };
const v = (r: any, k: string) => String(r[k] ?? '').trim();
const wb = XLSX.read(fs.readFileSync(FIX), { type: 'buffer', cellDates: true });
const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
const month = (r: any) => String(v(r, C.date)).slice(0, 7);

/** Series for a leaf, and the fit — returns null exactly where the app skips. */
function seriesFor(k: string) {
  const [seg, prod, prodL2, chan, chanL2, t1, t2] = k.split('|');
  const sel = rows.filter(r => v(r, C.seg) === seg && v(r, C.prod) === prod && v(r, C.prodL2) === prodL2
    && v(r, C.chan) === chan && v(r, C.chanL2) === chanL2 && v(r, C.t1) === t1 && v(r, C.t2) === t2);
  const acc = new Map<number, any>();
  for (const r of sel) {
    const d = new Date(month(r) + '-01'); if (isNaN(d.getTime())) continue;
    const t = d.getTime();
    if (!acc.has(t)) acc.set(t, { _parsedDate: d, inflow: 0, outflow: 0, retention: 0,
      arpu: 0, inflowArpu: 0, outflowArpu: 0, retentionArpu: 0, baseArpu: 0, _rev: 0, _vol: 0 });
    const e = acc.get(t)!, m = v(r, C.metric), val = Number(r[C.value]) || 0;
    if (m === 'Inflow') e.inflow += val; else if (m === 'Outflow') e.outflow += val;
    else if (m === 'Retention') e.retention += val;
    e._rev += Number(r[C.rev]) || 0; e._vol += val;
  }
  for (const e of acc.values()) {
    e.arpu = e._vol > 0 ? e._rev / e._vol : 0;
    e.inflowArpu = e.arpu; e.outflowArpu = e.arpu; e.retentionArpu = e.arpu; e.baseArpu = e.arpu;
  }
  return [...acc.values()].sort((a, b) => a._parsedDate - b._parsedDate);
}
/**
 * Fit a leaf the way the app does, and let the app's own machinery decide
 * whether it is fittable.
 *
 * The first version of this spec invented a `series.length < 8` threshold and
 * asserted 2 leaves would be skipped. Zero were — the anti-vacuity control
 * caught it. The threshold is not mine to choose: a leaf is skipped when
 * `calculateBaseForecast` returns null, and `classifySkip` is what names the
 * reason. Reimplementing the rule would have measured my guess about the app
 * instead of the app.
 */
function fitLeafKey(k: string): BaseForecast | null {
  const series = seriesFor(k);
  const [seg, prod, prodL2, chan, chanL2, t1, t2] = k.split('|');
  return calculateBaseForecast(series,
    { segment: seg, product: prod, productL2: prodL2, channel: chan, channelL2: chanL2,
      tariffL1: t1, tariffL2: t2, scenario: 'Base Case' } as any,
    1000, 12, 1.0, 1.5, 3, 'Holt Linear');
}

/** A row's 7-part key — used to hand classifySkip the same bucket the app would. */
const keyOfRow = (r: any) => makeForecastKey(v(r, C.seg), v(r, C.prod), v(r, C.prodL2),
  v(r, C.chan), v(r, C.chanL2), v(r, C.t1), v(r, C.t2));

const dm = buildCohortDataMap(rows, C.date, C.seg, C.prod, C.prodL2, C.chan, C.chanL2, C.t1, C.t2);
const enumerated = [...dm.keys()];
const { leafMap } = buildRollUpIndex(enumerated);

// ── PART 1: the generate-missing enumeration ──────────────────────────────
// The FULL roll-up, not one segment's. The two unfittable leaves in this
// fixture sit under different segments, so a single-segment aggregate would
// cover neither and the skip checks below would be vacuous - which is exactly
// what happened on the first run of this spec.
const AGG = makeForecastKey('All', 'All', 'All', 'All', 'All', 'All', 'All');

// Module scope so the Overall-door block at the end of this file reuses the
// same REAL fit — those checks are about the definition of missing, and a
// hand-built store would be the spec feeding itself its own premise.
const store = new Map<string, BaseForecast>();
const skipped: string[] = [];

{
  const empty = new Map<string, BaseForecast>();
  const first = missingLeavesForKey(AGG, leafMap, empty);
  check('ENUMERATE: the aggregate has leaves', first.enumerated && first.leaves.length > 1,
    `${first.leaves.length}`);
  check('ENUMERATE: with an empty store every leaf is missing',
    first.missing.length === first.leaves.length && first.present.length === 0,
    `missing=${first.missing.length} present=${first.present.length}`);
  check('ENUMERATE: no leaf under the aggregate is itself the aggregate key',
    !first.leaves.includes(AGG),
    'the aggregate is enrolled as its own leaf — it would be fitted');

  // Fit them, exactly as a scoped run does. (Declared at module scope above.)
  for (const k of first.missing) {
    const bf = fitLeafKey(k);
    if (bf) store.set(k, bf); else skipped.push(k);
  }

  // THE SHORT LEAVES ARE COVERAGE, NOT FAILURE. The edge fixture contains
  // leaves with too little history to fit. They must be reported by NAME and
  // counted, not folded into a failure total — a skipped cohort the user can
  // see is a coverage statement; a silent one is a lie about what was produced.
  check('SKIPPED: some leaves are skipped for short history', skipped.length > 0,
    'if zero, this fixture no longer exercises the skip path and the checks below are vacuous');
  // Measured on this fixture: 74 leaves, 72 fit, 2 carry only 2 months each.
  // Pinned because a fixture that quietly stopped containing unfittable leaves
  // would turn every check below into a tautology.
  check('SKIPPED: the fixture still has exactly 74 leaves and 2 unfittable',
    first.leaves.length === 74 && skipped.length === 2,
    `leaves=${first.leaves.length} skipped=${skipped.length}`);
  check('COVERAGE NOT FAILURE: the fitted count is the complement, 72',
    store.size === 72, `${store.size}`);
  check('SKIPPED: each skipped leaf is nameable', skipped.every(k => k.split('|').length === 7),
    skipped.join(' , '));
  // The REASON is the app's own classifier, not a threshold this spec invents.
  check('SKIPPED: every skipped leaf classifies as insufficient-history',
    skipped.every(k => classifySkip(rows.filter(r => keyOfRow(r) === k), null) === 'insufficient-history'),
    'a leaf was skipped but is not short history — it may not be a cohort at all');
  // Positive control on the same mechanism: a fitted leaf must classify as no
  // skip, or "skipped" is not what is being measured.
  check('SKIPPED: every FITTED leaf classifies as no-skip',
    [...store.entries()].every(([k, bf]) => classifySkip(rows.filter(r => keyOfRow(r) === k), bf) === null));
  // And the skipped ones really do have less history than the fitted ones -
  // stated as a measured comparison rather than a pinned threshold.
  if (skipped.length) {
    const maxSkipped = Math.max(...skipped.map(k => seriesFor(k).length));
    const minFitted  = Math.min(...[...store.keys()].map(k => seriesFor(k).length));
    check('SKIPPED: the skipped leaves are genuinely shorter than every fitted one',
      maxSkipped < minFitted,
      `longest skipped=${maxSkipped} shortest fitted=${minFitted}`);
  }

  // Second pass — the idempotence that makes the button honest.
  const second = missingLeavesForKey(AGG, leafMap, store);
  check('SECOND PASS: the fitted leaves are now present',
    second.present.length === store.size, `${second.present.length} vs ${store.size}`);
  check('SECOND PASS: only the unfittable leaves remain missing',
    second.missing.length === skipped.length &&
    second.missing.every(k => skipped.includes(k)),
    `missing=${second.missing.length} skipped=${skipped.length}`);

  // And the aggregate is now derivable from what was generated.
  const res = resolveFromStore(store, leafMap, AGG);
  check('DERIVES: the aggregate resolves after generating its leaves',
    !!res.forecast, `reason=${res.reason}`);
  check('DERIVES: and it is derived, never stored',
    !!res.forecast && (res.forecast.provenance as any).kind === 'derived' && !store.has(AGG),
    store.has(AGG) ? 'THE AGGREGATE KEY WAS WRITTEN TO THE STORE' : 'not derived');
  check('DERIVES: from the leaves that were actually fitted',
    !!res.forecast && (res.forecast.provenance as any).leafCount === store.size,
    res.forecast ? `${(res.forecast.provenance as any).leafCount} vs ${store.size}` : 'n/a');
}

// ── PART 2: THE MIRROR CONTROL ────────────────────────────────────────────
// Zero writes under a key that aggregates a MAPPED dimension, across every
// store-writing path in the app.
{
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  const lines = app.split('\n');
  const writes: { line: number; text: string }[] = [];
  lines.forEach((l, i) => {
    if (/setForecastStore\s*\(/.test(l) && !/const setForecastStore|setForecastStore:/.test(l)) {
      writes.push({ line: i + 1, text: l.trim() });
    }
  });
  check('MIRROR: store-writing sites were found', writes.length > 0, 'the matcher is broken');
  const EXPECTED_WRITES = 8;
  check(`MIRROR: the store-writing site count is still ${EXPECTED_WRITES}`,
    writes.length === EXPECTED_WRITES,
    `found ${writes.length} — a new writer must be classified before this passes`);

  // The two accept sites must DECLINE, not re-stamp. Re-labelling a
  // fit-on-aggregate as `accepted` would satisfy a naive no-fitted-All-keys
  // rule while making it permanent: the retirement rule only retires `fitted`,
  // so an `accepted` aggregate would never be caught on the way back out.
  for (const fn of ['acceptPreviewForecast', 'acceptAllChallengerModels']) {
    const start = app.indexOf(`const ${fn} = useCallback`);
    check(`MIRROR: ${fn} was found`, start !== -1);
    if (start === -1) continue;
    const body = app.slice(start, app.indexOf('setForecastStore(', start));
    check(`MIRROR: ${fn} declines an All-bearing key before writing`,
      /isAllBearing\(/.test(body) && /return;/.test(body),
      'it can still write a fit under an aggregate key');
    check(`MIRROR: ${fn} does NOT launder the provenance to accepted`,
      !/kind:\s*'accepted'/.test(body),
      'it re-stamps instead of declining — that removes the retirement rule as a net');
  }

  // Step 1 must not write the aggregate key either — it generates leaves.
  const gsf = app.indexOf('const generateStandardForecast');
  const gsfBody = app.slice(gsf, app.indexOf('let processedData', gsf));
  check('MIRROR: Step 1 generates the missing LEAVES for an aggregate selection',
    /missingLeavesForKey\(/.test(gsfBody) && /restrictToLeafKeys/.test(gsfBody),
    'the aggregate branch does something other than generating leaves');
  check('MIRROR: Step 1 keeps the never-enumerated case distinct from covered',
    /standard_selection_never_enumerated/.test(gsfBody) && /standard_all_leaves_present/.test(gsfBody),
    'the two zero-missing states are collapsed');
}

// ── PART 2b: a scoped run must REPORT the work it did ────────────────────
// The counters `generated`/`failed`/`generatedIds` are incremented only in the
// worker's STANDARD-cohort loop. A scoped leaf run sends an empty standard
// list by construction, so those counters are structurally zero however many
// leaves it fits — a run that fitted everything asked of it recorded
// "generated 0" and rendered in the bulk drawer as a run that did nothing.
// Found by the gate, not by review. These pin the fix.
{
  const worker = fs.readFileSync('src/workers/forecasting.worker.ts', 'utf8');
  const app = fs.readFileSync('src/App.tsx', 'utf8');

  check('COUNTS: the worker tallies typed leaves separately',
    /ibroGenerated\+\+/.test(worker) && /ibroFailed\+\+/.test(worker)
      && /ibroGeneratedKeys\.push/.test(worker),
    'the typed path reports nothing again');
  check('COUNTS: and does NOT fold them into the standard tallies',
    !/generated\+\+[\s\S]{0,200}newTypedForecasts\.push/.test(worker),
    'folding would silently change what every existing bulk run reports');
  check('COUNTS: the run record uses the typed tallies for a scoped run',
    /restrictToLeafKeys \? ibroGeneratedKeys : generatedIds/.test(app)
      && /restrictToLeafKeys \? ibroGenerated : generated/.test(app),
    'the BulkRunRecord still reports zero for scoped runs');
  check('COUNTS: the Step 1 call USES the result rather than voiding it',
    !/void generateAllMissingForecasts/.test(app)
      && /setStdGenerateResult/.test(app),
    'the skipped-leaf list is computed and thrown away');
  check('COUNTS: the skipped leaves are rendered by NAME on Step 1',
    /generateResult\.skipped\.map/.test(fs.readFileSync('src/components/StandardForecastTab.tsx', 'utf8')),
    'they are counted but not named');
}

// Behavioural half: nothing produced by the generate path is an aggregate key.
{
  const mapped = { seg: true, prod: true, prodL2: true, chan: true, chanL2: true, t1: true, t2: true };
  const slots = [mapped.seg, mapped.prod, mapped.prodL2, mapped.chan, mapped.chanL2, mapped.t1, mapped.t2];
  const aggregatesAMappedDim = (k: string) =>
    k.split('|').some((part, i) => part === 'All' && slots[i]);

  const { missing } = missingLeavesForKey(AGG, leafMap, new Map());
  check('MIRROR (behavioural): no leaf the generate path targets aggregates a mapped dimension',
    missing.every(k => !aggregatesAMappedDim(k)),
    missing.filter(aggregatesAMappedDim).slice(0, 3).join(' , '));
  // Anti-vacuity: the predicate must actually reject something.
  check('MIRROR (behavioural): the predicate rejects the aggregate key itself',
    aggregatesAMappedDim(AGG),
    'the check above passed for free — the predicate accepts everything');
}

// ── PART 3: the unmapped-dimension accident, pinned ───────────────────────
{
  const unmappedLeaves = [
    'Corporate|Mobile|High Value|Direct|Inside Sales|All|All',
    'SOHO|Mobile|Low Value|Indirect|Distributor|All|All',
  ];
  const store = new Map<string, any>();
  for (const k of unmappedLeaves) {
    store.set(k, { cohort: {}, provenance: { kind: 'fitted', modelUsed: 'Holt Linear' },
      historicalMonths: [], seedBaseVolume: 0,
      months: [{ month: '2026-01',
        inflow: { mean: 100, optimistic: 110, pessimistic: 90 },
        outflow: { mean: 5, optimistic: 6, pessimistic: 4 },
        retention: { mean: 50, optimistic: 55, pessimistic: 45 },
        arpu: { mean: 10, optimistic: 11, pessimistic: 9 } }] });
  }
  const { leafMap: lm } = buildRollUpIndex(unmappedLeaves);
  const leaf = unmappedLeaves[0];

  check('UNMAPPED: a genuine leaf IS classified as retired — the misfire is real',
    isRetiredAggregateFit(leaf, store.get(leaf)),
    'if this is false the rule was fixed and the notes above are stale');
  check('UNMAPPED: it is All-bearing', isAllBearing(leaf));

  const res = resolveFromStore(store, lm, leaf);
  check('UNMAPPED: the forecast survives anyway', !!res.forecast, `reason=${res.reason}`);
  check('UNMAPPED: and it is the stored object, unchanged',
    res.forecast === store.get(leaf),
    'the misfire is no longer absorbed — unmapped-dimension datasets have changed');
  check('UNMAPPED: provenance and model name survive',
    !!res.forecast && (res.forecast.provenance as any).kind === 'fitted'
      && (res.forecast.provenance as any).modelUsed === 'Holt Linear');

  // THE LOAD-BEARING ACCIDENT: single-leaf deriveAggregate is an identity.
  // This is what absorbs the misfire. Pinned here so it cannot be removed
  // quietly — if it stops being an identity, every forecast on every
  // unmapped-dimension dataset changes at once.
  const one = deriveAggregate([store.get(leaf)], { segment: 'x', product: 'y' } as any);
  check('UNMAPPED: deriveAggregate of ONE leaf returns that leaf unchanged',
    !!one && one.months[0].inflow.mean === 100 && one.months[0].arpu.mean === 10,
    'single-leaf derivation is no longer an identity — read the header of this file');
}

// ── ONE DEFINITION OF MISSING, AND IT REACHES THE OVERALL DOOR ────────────
//
// The Overall door read a different definition until 2026-08-09: has-no-forecast
// over the whole cohort cross-product (`ec3c79a`), which includes All-bearing
// keys and multiplies each key by four scenario rows. Session J's
// fittable-and-not-fitted definition (`a51ec8e`) reached Step 1 only —
// OverallForecastTab.tsx is not in that diff.
//
// These checks are on the DEFINITION, at the root scope the Overall door uses.
{
  const rootKey = makeForecastKey('All', 'All', 'All', 'All', 'All', 'All', 'All');

  // Post-fit: every fittable leaf fitted, the two short ones known unfittable.
  const fitted = new Map(store);
  const known = new Set(skipped);
  const post = missingLeavesForKey(rootKey, leafMap, fitted, known);

  check('OVERALL: post-fit the door has NOTHING to offer', post.missing.length === 0,
    `${post.missing.length} offered — this is the no-exit loop`);
  check('OVERALL: and it is BLOCKED, not covered — the two zero states differ',
    post.unfittable.length === 2,
    `${post.unfittable.length} known-unfittable`);

  // THE POPULATION ITSELF. Not one aggregate, at any point in the lifecycle.
  const pre = missingLeavesForKey(rootKey, leafMap, new Map(), new Set());
  const aggInPre = pre.missing.filter((k: string) => isAllBearing(k));
  check('OVERALL: an aggregate NEVER appears in a missing set, even pre-fit',
    aggInPre.length === 0,
    `${aggInPre.length} All-bearing keys offered for generation — they derive, they are not missing`);
  check('OVERALL: pre-fit the door offers exactly the fittable leaves',
    pre.missing.length === 74, `${pre.missing.length}`);

  // ANTI-VACUITY. The two definitions must actually differ, or every check
  // above would pass against the defect as well. This reconstructs the OLD
  // population — has-no-forecast, aggregates included — and shows it is not
  // empty where the new one is. Measured, not asserted: 34 aggregates whose
  // whole leaf population is the two short leaves, which is why nothing under
  // them ever resolved and the count never moved.
  const oldPopulation = [...leafMap.keys()].filter(k => {
    const hit = fitted.get(k);
    if (hit && !isRetiredAggregateFit(k, hit)) return false;
    return !(leafMap.get(k) ?? []).some((lk: string) => fitted.has(lk));
  });
  const oldAggs = oldPopulation.filter(k => isAllBearing(k));
  check('OVERALL CONTROL: the OLD definition really did offer aggregates',
    oldAggs.length > 0,
    'the two definitions agree — these checks prove nothing');
  check('OVERALL CONTROL: and it offered them with nothing left to generate',
    oldPopulation.length > post.missing.length,
    `old ${oldPopulation.length} vs new ${post.missing.length}`);
}

console.log(`generate-missing spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
