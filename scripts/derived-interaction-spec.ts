/**
 * Interaction survey — the engine paths, driven with a DERIVED baseForecast.
 *
 *   npm run spec:interaction
 *
 * The Phase 2 design named `computeAdjustedForecast` and `computeScenarioForFilter`
 * as the two consumers that would newly receive a derived aggregate where they
 * previously received stale-or-nothing. Neither reads `provenance` (verified by
 * grep across src/), so both treat a derived aggregate exactly like a leaf.
 *
 * That is expected to be CORRECT and it was never exercised. This spec exercises
 * it: a derived aggregate is not a leaf — its ARPU bands are absent, its months
 * are month-key aligned across ragged leaves, and its seeds are summed at the
 * aggregate's own as-of month. Any of those could have broken the pro-rata
 * split, and "we think it is fine" is not a measurement.
 */
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { deriveAggregate, buildCohortDataMap, buildRollUpIndex, makeForecastKey } from '../src/utils/forecasting';
import { runForecastJob } from '../src/workers/forecasting.worker';
import { computeAdjustedForecast } from '../src/components/WhatIfTab';
import type { BaseForecast, CohortKey } from '../src/types/forecast';
import { provenanceModel } from '../src/types/forecast';
import type { MarketEvent } from '../src/utils/forecasting';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

const EDGE = 'test-data/VBU_IBRO_EdgeCases_ShortHistory_PerScenarioARPU_Jan2023_Jun2026.xlsx';
const C = {
  date: 'Month', metric: 'IBRO_Scenario_Type', value: 'Subscriber_Volume',
  seg: 'Customer_Segment', prod: 'Product_L1', prodL2: 'Product_L2_Value_Tier',
  chan: 'Channel_Level_1', chanL2: 'Channel_Level_2',
  t1: 'tariff_tier_l1', t2: 'tariff_tier_l2',
  arpu: 'Avg_Unit_Price_GBP', rev: 'Monthly_Revenue_GBP',
};

const rows: any[] = XLSX.utils.sheet_to_json(
  XLSX.read(fs.readFileSync(EDGE), { type: 'buffer', cellDates: true }).Sheets[
    XLSX.read(fs.readFileSync(EDGE), { type: 'buffer', cellDates: true }).SheetNames[0]]);
const dm = buildCohortDataMap(rows, C.date, C.seg, C.prod, C.prodL2, C.chan, C.chanL2, C.t1, C.t2);
const enumerated = [...dm.keys()].sort();

const job = runForecastJob({
  workerId: 0,
  config: {
    wiDateCol: C.date, wiMetricCol: C.metric, wiValueCol: C.value,
    wiSegmentCol: C.seg, wiProductCol: C.prod, wiProductL2Col: C.prodL2,
    wiChannelCol: C.chan, wiChannelL2Col: C.chanL2, wiTariffL1Col: C.t1, wiTariffL2Col: C.t2,
    wiInflowVal: 'Inflow', wiOutflowVal: 'Outflow', wiBaseVal: 'Base', wiRetentionVal: 'Retention',
    wiArpuCol: C.arpu, wiRevenueCol: C.rev,
    genLength: 12, runPreUnc: 1.28, runPostExp: 0.02, runConfHor: 3,
    runModel: 'Holt Linear', autoModel: false, autoConfidence: false, oneOffMonths: {},
  },
  rows: rows as any, standardCohorts: [],
  ibroCohorts: enumerated.map(k => {
    const [seg, prod, prodL2, chan, chanL2, tariffL1, tariffL2] = k.split('|');
    return { fKey: k, seg, prod, prodL2, chan, chanL2, tariffL1, tariffL2 };
  }),
} as any);

const store = new Map<string, BaseForecast>(job.newTypedForecasts);
check('GUARD: leaves fitted from the edge fixture', store.size > 0, String(store.size));

// A real aggregate: Corporate, everything else All.
const AGG_KEY = makeForecastKey('Corporate', 'All', 'All', 'All', 'All', 'All', 'All');
const aggLeaves = enumerated.filter(k => k.startsWith('Corporate|'))
  .map(k => store.get(k)).filter((b): b is BaseForecast => !!b);
const [segment, product, productL2, channel, channelL2, tariffL1, tariffL2] = AGG_KEY.split('|');
const derived = deriveAggregate(aggLeaves, {
  segment, product, productL2, channel, channelL2, tariffL1, tariffL2, scenario: 'Base Case',
} as unknown as CohortKey);

check('GUARD: the aggregate has multiple leaves', aggLeaves.length > 1, String(aggLeaves.length));
check('GUARD: it derives', derived !== null);
check('GUARD: and it is genuinely DERIVED, not a passthrough',
  derived!.provenance.kind === 'derived', derived!.provenance.kind);
check('GUARD: its ARPU interval is ABSENT — this is what makes it not a leaf',
  derived!.months[0].arpu.optimistic === undefined);

// ── computeAdjustedForecast with a DERIVED baseForecast ──────────────────
const month0 = derived!.months[0].month;
const event = (over: Partial<MarketEvent> = {}): MarketEvent => ({
  id: 'evt-1', scenario: 'Inflow', segment: 'Corporate',
  product: 'All', productL2: 'All', channel: 'All', channelL2: 'All',
  tariffL1: 'All', tariffL2: 'All',
  date: month0, subscriberVolume: 1000, customerVolume: 0, revenue: 0, arpu: 0,
  name: 'spec', campaignName: '', comment: '', contractLength: 24,
  sequence: 0, amountType: 'absolute', percentageBasis: 'baseline', retentionLinked: true,
  ...over,
} as MarketEvent);

const runAdj = (bf: BaseForecast, events: MarketEvent[]) => computeAdjustedForecast({
  baseForecast: bf, marketEvents: events, yieldEvents: [], pricingEvents: [],
  viewSegment: 'Corporate', viewProduct: { l1: null, l2: null },
  viewChannel: { l1: null, l2: null }, viewTariff: { l1: null, l2: null },
  data: rows,
  wiSegmentCol: C.seg, wiProductCol: C.prod, wiProductL2Col: C.prodL2,
  wiChannelCol: C.chan, wiChannelL2Col: C.chanL2,
  wiTariffL1Col: C.t1, wiTariffL2Col: C.t2,
  wiValueCol: C.value, wiMetricCol: C.metric,
  wiInflowVal: 'Inflow', wiOutflowVal: 'Outflow', wiRetentionVal: 'Retention',
} as any);

{
  const none = runAdj(derived!, []);
  const withEvt = runAdj(derived!, [event()]);

  check('ENGINE: computeAdjustedForecast accepts a derived baseForecast without throwing',
    Array.isArray(withEvt.adjustedMonths) && withEvt.adjustedMonths.length > 0,
    String(withEvt.adjustedMonths?.length));

  const b0 = none.adjustedMonths.find((m: any) => m.month === month0);
  const a0 = withEvt.adjustedMonths.find((m: any) => m.month === month0);
  check('ENGINE: no events leaves the derived baseline unchanged',
    !!b0 && near(b0.uplifted.inflow, b0.baseline.inflow, 0.01),
    `${b0?.uplifted?.inflow} vs ${b0?.baseline?.inflow}`);

  // The pro-rata split: an event on the aggregate must move the aggregate by
  // the full amount. Splitting across leaves and summing back must reconcile.
  check('ENGINE: an event on the aggregate moves inflow by the FULL amount',
    !!a0 && !!b0 && near(a0.uplifted.inflow - b0.uplifted.inflow, 1000, 1.0),
    `${a0 && b0 ? (a0.uplifted.inflow - b0.uplifted.inflow).toFixed(2) : 'n/a'} vs 1000`);

  check('ENGINE: months outside the event are untouched',
    withEvt.adjustedMonths.filter((m: any, i: number) =>
      m.month !== month0 && !near(m.uplifted.inflow, none.adjustedMonths[i].uplifted.inflow, 0.01)
    ).length === 0);

  // No NaN anywhere — the absent ARPU interval is the most likely source.
  const anyNaN = withEvt.adjustedMonths.some((m: any) =>
    [m.uplifted?.inflow, m.uplifted?.outflow, m.uplifted?.retention, m.uplifted?.arpu]
      .some(v => typeof v === 'number' && Number.isNaN(v)));
  check('ENGINE: the absent ARPU interval produces NO NaN downstream', !anyNaN);
}

// ── The control: a FITTED leaf behaves identically through the same path ─
{
  const leaf = aggLeaves[0];
  const lMonth = leaf.months[0].month;
  const none = runAdj(leaf, []);
  const withEvt = runAdj(leaf, [event({ date: lMonth, segment: leaf.cohort.segment })]);
  const b0 = none.adjustedMonths.find((m: any) => m.month === lMonth);
  const a0 = withEvt.adjustedMonths.find((m: any) => m.month === lMonth);
  check('CONTROL: a fitted leaf still moves by the full amount through the same path',
    !!a0 && !!b0 && near(a0.uplifted.inflow - b0.uplifted.inflow, 1000, 1.0),
    `${a0 && b0 ? (a0.uplifted.inflow - b0.uplifted.inflow).toFixed(2) : 'n/a'}`);
  check('CONTROL: a fitted leaf keeps its ARPU interval',
    typeof leaf.months[0].arpu.optimistic === 'number');
}

// ── Neither engine path reads provenance ─────────────────────────────────
// Recorded as a fact rather than an assumption: if either ever starts
// branching on it, this assertion says so and the survey gets redone.
{
  const wi = fs.readFileSync('src/components/WhatIfTab.tsx', 'utf8');
  const sh = fs.readFileSync('src/utils/scenarioHelper.ts', 'utf8');
  check('SURVEY: computeAdjustedForecast does not branch on provenance',
    !/\.provenance/.test(wi), 'WhatIfTab reads .provenance');
  check('SURVEY: computeScenarioForFilter does not branch on provenance',
    !/\.provenance/.test(sh), 'scenarioHelper reads .provenance');
}

// ── INSTANCE 3: the challenger key resolves through the seam ─────────────
// AMENDMENT 2 required this and gate stage 2 found it MISSING - not "asserts
// the shape only", but asserts nothing at all. The code was fixed and left
// uncovered.
//
// The assertion has to go THROUGH resolveForecast, because fixing the key alone
// changes nothing observable: the challenger's keys are aggregate shapes at the
// default grouping, so a correct 7-part key still misses the store. Only
// derivation makes it resolve.
{
  // The key the challenger builds at the default grouping: segment only, every
  // other dimension 'All'. Built with the SHARED builder, as the fixed code does.
  const challengerKey = makeForecastKey('Corporate', 'All', 'All', 'All', 'All', 'All', 'All');

  check('INSTANCE 3: the key has SEVEN parts, not the old five',
    challengerKey.split('|').length === 7, String(challengerKey.split('|').length));
  check('INSTANCE 3: ...and every store key has seven too, so a match is possible',
    [...store.keys()].every(k => k.split('|').length === 7));

  // The seam, replicated exactly as App builds it: stored hit, else derive from
  // the leaves the key covers, else null.
  const covers = (agg: string, leaf: string) => {
    const a2 = agg.split('|'), l = leaf.split('|');
    return a2.every((p, i) => p === 'All' || p === l[i]);
  };
  const resolve = (key: string) => {
    const hit = store.get(key);
    if (hit) return hit;
    const lv = [...store.entries()].filter(([k]) => k !== key && covers(key, k)).map(([, v]) => v);
    if (!lv.length) return null;
    const [sg, pr, p2, ch, c2, t1, t2] = key.split('|');
    return deriveAggregate(lv, { segment: sg, product: pr, productL2: p2, channel: ch, channelL2: c2, tariffL1: t1, tariffL2: t2, scenario: 'Base Case' } as any);
  };

  const resolved = resolve(challengerKey);
  check('INSTANCE 3: the challenger key is NOT in the store — the old lookup would miss',
    store.get(challengerKey) === undefined);
  check('INSTANCE 3: it resolves NON-NULL through the seam',
    resolved !== null);
  check('INSTANCE 3: ...with DERIVED provenance, which is what makes the fix visible',
    resolved!.provenance.kind === 'derived', resolved!.provenance.kind);
  check('INSTANCE 3: the resolved aggregate carries real months',
    resolved!.months.length > 0, String(resolved!.months.length));

  // And the source-level half: no hand-rolled key survives at that site.
  const fva = fs.readFileSync('src/components/ForecastVsActualsTab.tsx', 'utf8');
  check('INSTANCE 3: the challenger site uses makeForecastKey, not a join',
    /const cohortFcKey = makeForecastKey\(/.test(fva));
  check('INSTANCE 3: ...and resolves rather than reading the store directly',
    /cohortFcExact = resolveForecast\(cohortFcKey\)/.test(fva));
}

// ── B3: the challenger list is NOT empty at any grouping ─────────────────
// This inverts the reproduction that found the defect. B2a dropped every row
// whose incumbent model was null, and since every key the challenger builds is
// an aggregate, that was every row at every grouping - the feature vanished
// while its button still looked live.
//
// The premise was wrong, not just the handling: fitting a challenger to
// aggregate data is fit-on-aggregate, and ACCEPTING one would write a fitted
// aggregate into the store, undoing bottom-up. So derived rows stay with their
// real accuracy scores and the COMPARISON is suppressed - not the row.
{
  const covers = (agg: string, leaf: string) => {
    const a2 = agg.split('|'), l = leaf.split('|');
    return a2.every((p, i) => p === 'All' || p === l[i]);
  };
  const resolveKey = (key: string) => {
    const hit = store.get(key);
    if (hit) return hit;
    const lv = [...store.entries()].filter(([k]) => k !== key && covers(key, k)).map(([, v]) => v);
    if (!lv.length) return null;
    const [sg, pr, p2, ch, c2, t1, t2] = key.split('|');
    return deriveAggregate(lv, { segment: sg, product: pr, productL2: p2, channel: ch, channelL2: c2, tariffL1: t1, tariffL2: t2, scenario: 'Base Case' } as any);
  };
  // The row-survival rule as the component applies it: a row survives when it
  // resolves to SOMETHING. Model presence decides the comparison, not the row.
  const rowSurvives = (key: string) => resolveKey(key) !== null;

  const segments = [...new Set(enumerated.map(k => k.split('|')[0]))].sort();

  // Default grouping: segment only.
  const defaultKeys = segments.map(sg => makeForecastKey(sg, 'All', 'All', 'All', 'All', 'All', 'All'));
  const defaultKept = defaultKeys.filter(rowSurvives).length;
  check('B3: rows survive at the DEFAULT grouping',
    defaultKept === defaultKeys.length && defaultKept > 0,
    `${defaultKept}/${defaultKeys.length}`);

  // Product + channel grouping.
  const pcKeys = [...new Set(enumerated.map(k => {
    const p = k.split('|'); return makeForecastKey(p[0], p[1], 'All', p[3], 'All', 'All', 'All');
  }))];
  const pcMissing = pcKeys.filter(k => !rowSurvives(k));
  const pcKept = pcKeys.length - pcMissing.length;
  check('B3: rows survive at the product+channel grouping too', pcKept > 0,
    `${pcKept}/${pcKeys.length}`);
  // The ONE key that legitimately has no row is the all-short aggregate:
  // every leaf under it failed to fit, so there is nothing to derive and
  // nothing to score. A row there would be the zero-forecast the spec
  // forbids. Named rather than tolerated - if the missing set ever grows,
  // this fails.
  check('B3: ...and the ONLY key with no row is the all-short aggregate',
    pcMissing.length === 1 && pcMissing[0].startsWith('Large Enterprise|Fixed Connectivity'),
    pcMissing.join(', '));

  // THE REGRESSION CASE: the old rule dropped every row at every grouping.
  const oldRuleKept = defaultKeys.filter(k => {
    const fc = resolveKey(k);
    return fc !== null && provenanceModel(fc.provenance) !== null;
  }).length;
  check('B3 REGRESSION CASE: the OLD model-presence rule would drop every row',
    oldRuleKept === 0, `${oldRuleKept} would have survived`);

  // Derived rows carry the mix and NO comparison.
  const aggFc = resolveKey(defaultKeys[0])!;
  check('B3: a default-grouping row IS derived', aggFc.provenance.kind === 'derived');
  check('B3: ...so it has no incumbent model', provenanceModel(aggFc.provenance) === null);
  check('B3: ...and carries a leaf count for the mix label',
    (aggFc.provenance as any).leafCount > 0, String((aggFc.provenance as any).leafCount));
  check('B3: ...and a model histogram, not a single model',
    Object.keys((aggFc.provenance as any).models).length > 0);

  // CONTROL: a fitted leaf keeps its incumbent, so its comparison still runs.
  const leafKey = [...store.keys()][0];
  const leafFc = resolveKey(leafKey)!;
  check('B3 CONTROL: a fitted leaf row survives too', leafFc !== null);
  check('B3 CONTROL: ...and KEEPS its incumbent model, so the comparison runs',
    provenanceModel(leafFc.provenance) !== null, String(provenanceModel(leafFc.provenance)));

  // Source: derived rows are never acceptance candidates, and never index the
  // trajectory map with an empty key.
  const fva = fs.readFileSync('src/components/ForecastVsActualsTab.tsx', 'utf8');
  check('B3 SOURCE: derived rows are excluded from acceptance candidates',
    /!g\.derivedMix && g\.bestModel\.name !== g\.chosenModel/.test(fva));
  check('B3 SOURCE: the trajectory map is never indexed with an empty key',
    /selectedChallengerGroup\.chosenModel$[\s\S]{0,120}?\? \(pt\[/m.test(fva)
      || /chosenModel[\s\S]{0,80}\?\s*\(pt\[/.test(fva));
  // THE assertion that catches the original defect. The row-survival checks
  // above replicate the rule rather than driving the component's, so
  // reinstating `if (!chosenModel) return null` left them all passing - the
  // measure-don't-reimplement trap, in the spec written to close that defect.
  // The component's guard lives in a closure that cannot be driven, so the
  // check is on the source.
  const challengerBody = fva.slice(fva.indexOf('const challengerGroups'),
                                   fva.indexOf('const filteredChallengerGroups'));
  check('B3 SOURCE GUARD: challengerGroups was found', challengerBody.length > 200,
    String(challengerBody.length));
  // Pinning ONE spelling (`if (!chosenModel) return null`) guards the sentence,
  // not the defect: `chosenModel === ''`, `if (derivedMix)`, a braced body, or a
  // test on provenanceModel() directly all reinstate it and all read as green.
  // So the rule is structural - NO early return null in this closure may be
  // predicated on the absence of a model, however that absence is spelled.
  const ABSENCE = /chosenModel|derivedMix|provenanceModel|incumbentSrc/;
  const droppers: string[] = [];
  for (const m of challengerBody.matchAll(/return\s+null/g)) {
    // The nearest `if (` opening before this return, within one statement's reach.
    const before = challengerBody.slice(Math.max(0, m.index! - 200), m.index!);
    const lastIf = before.lastIndexOf('if (');
    if (lastIf === -1) continue;
    const cond = before.slice(lastIf);
    // Only a guard whose body IS this return - no intervening statement.
    if (/;\s*\S[\s\S]*$/.test(cond.replace(/^if \([\s\S]*?\)\s*\{?\s*/, ''))) continue;
    if (ABSENCE.test(cond)) droppers.push(cond.trim().replace(/\s+/g, ' ').slice(0, 90));
  }
  check('B3 SOURCE GUARD: no row is dropped for having no incumbent model',
    droppers.length === 0,
    'a row is dropped on model-absence: ' + droppers.join(' | '));
  // The mix must be CARRIED, not merely not-dropped: a row that survives with
  // derivedMix hardcoded null passes the check above and still shows a model
  // name it does not have.
  check('B3 SOURCE GUARD: the derived mix is built from provenance, not stubbed',
    /derivedMix\s*=\s*[\s\S]{0,80}kind === 'derived'/.test(challengerBody),
    'derivedMix is not derived from the provenance discriminant');

  check('B3 SOURCE: the suppression reason is on screen, keyed',
    /actuals_models_live_on_leaf_cohorts/.test(fva));

  // ── WHAT THIS BLOCK DOES NOT COVER ──────────────────────────────────────
  // Everything above asserts PROVENANCE and SOURCE TEXT: that deriveAggregate
  // carries a leafCount, that provenanceModel returns null, that a key appears
  // in the file. All of it stayed green while the leaf count and model
  // histogram rendered NOWHERE - the approved design put the mix on the row and
  // the row showed a fixed string. A spec that cannot tell those two apart is
  // asserting the wrong layer, and its greenness is not evidence about the
  // screen.
  //
  // The DOM authority is `npm run spec:challenger`, which mounts the real tab
  // and reads rendered text. The guard below is a cheap tripwire only: it
  // catches a regression to a constant label, and it is NOT a substitute for
  // the render spec.
  const rowStart = fva.indexOf('g.derivedMix ? (');
  const rowSite = fva.slice(rowStart, fva.indexOf(') : (', rowStart));
  check('B3 TRIPWIRE: the derived row renders the MIX, not a constant label',
    /incumbentLabel\(g\)/.test(rowSite),
    'the derived row is back to a fixed string - see spec:challenger for the real check');
}

// ── UNMAPPED DIMENSION: the roll-up index must not duplicate a leaf ─────────
// An unmapped dimension is a legitimate file shape, not a misuse: the
// ProductL2_Full fixtures carry no tariff columns at all, and they are
// indistinguishable from the TariffHierarchy ones on every count a walk checks
// (90,720 rows, 42 months, 540 cohorts) - which is how a walk reached this
// state by accident.
//
// With tariff unmapped both its levels are already 'All', so the three roll-up
// variants - ['All','All'], [t1,'All'], [t1,t2] - collapse to ONE key. The walk
// used to record the leaf once per variant, and resolveForecast then handed
// deriveAggregate the same leaf three times.
{
  const dmU = buildCohortDataMap(rows, C.date, C.seg, C.prod, C.prodL2, C.chan, C.chanL2, '', '');
  const leavesU = [...dmU.keys()].sort();
  const idxU = buildRollUpIndex(leavesU);
  const idxM = buildRollUpIndex(enumerated);      // control: the fully-mapped walk

  const dupes = (ix: { leafMap: Map<string, string[]> }) =>
    [...ix.leafMap.values()].filter(v => new Set(v).size !== v.length).length;

  check('UNMAPPED: the premise holds - every leaf key carries All in both tariff slots',
    leavesU.length > 0 && leavesU.every(k => k.split('|').slice(5).join('|') === 'All|All'),
    `${leavesU.length} leaves`);
  check('UNMAPPED: no roll-up lists any leaf more than once',
    dupes(idxU) === 0, `${dupes(idxU)} roll-ups carry duplicates`);
  check('CONTROL: the fully-mapped walk is unchanged and also duplicate-free',
    dupes(idxM) === 0, `${dupes(idxM)} roll-ups carry duplicates`);

  // A store keyed the way an unmapped run keys it.
  const jobU = runForecastJob({
    workerId: 0,
    config: {
      wiDateCol: C.date, wiMetricCol: C.metric, wiValueCol: C.value,
      wiSegmentCol: C.seg, wiProductCol: C.prod, wiProductL2Col: C.prodL2,
      wiChannelCol: C.chan, wiChannelL2Col: C.chanL2, wiTariffL1Col: '', wiTariffL2Col: '',
      wiInflowVal: 'Inflow', wiOutflowVal: 'Outflow', wiBaseVal: 'Base', wiRetentionVal: 'Retention',
      wiArpuCol: C.arpu, wiRevenueCol: C.rev,
      genLength: 12, runPreUnc: 1.28, runPostExp: 0.02, runConfHor: 3,
      runModel: 'Holt Linear', autoModel: false, autoConfidence: false, oneOffMonths: {},
    },
    rows: rows as any, standardCohorts: [],
    ibroCohorts: leavesU.map(k => {
      const [seg, prod, prodL2, chan, chanL2, tariffL1, tariffL2] = k.split('|');
      return { fKey: k, seg, prod, prodL2, chan, chanL2, tariffL1, tariffL2 };
    }),
  } as any);
  const storeU = new Map<string, BaseForecast>(jobU.newTypedForecasts);

  // The values below are the MEASURED consequence of the bug, pinned so the
  // regression is a number and not an adjective.
  const segKey = makeForecastKey('SOHO', 'All', 'All', 'All', 'All', 'All', 'All');
  const rollUpLeaves = idxU.leafMap.get(segKey) ?? [];
  check('UNMAPPED: SOHO rolls up 14 leaves, not the 42 entries the duplication gave',
    rollUpLeaves.length === 14, `${rollUpLeaves.length} entries`);

  const bfs = rollUpLeaves.map(k => storeU.get(k)).filter((b): b is BaseForecast => !!b);
  const derived = deriveAggregate(bfs, {
    segment: 'SOHO', product: 'All', productL2: 'All', channel: 'All',
    channelL2: 'All', tariffL1: 'All', tariffL2: 'All', scenario: 'Base Case',
  } as unknown as CohortKey);
  check('UNMAPPED: SOHO derives at all', !!derived);
  if (derived) {
    const p: any = derived.provenance;
    check('UNMAPPED: provenance.leafCount is 14, not 42 - the mix label told the truth',
      p.kind === 'derived' && p.leafCount === 14, `leafCount=${p.leafCount}`);
    check('UNMAPPED: month[0] inflow.mean is 4970.08, not the 14910.24 (3x) the duplication produced',
      near(derived.months[0].inflow.mean, 4970.08, 0.01),
      derived.months[0].inflow.mean.toFixed(2));
  }
}

console.log(`derived-interaction spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
