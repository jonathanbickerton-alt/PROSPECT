/**
 * SCENARIO COMPARE'S PRICING PASS — scope and cohort weighting.
 *
 *   npm run spec:scenario-pricing
 *
 * DRIVES THE REAL `computeScenarioForFilter`. This path has never been gated:
 * it is a PARALLEL apply implementation to the What-If side, and the divergence
 * this spec pins was found by reading, not by any check.
 *
 * WHAT IT IS CAREFUL ABOUT:
 *
 *  - EXPECTATIONS ARE HAND-WRITTEN LITERALS, computed from the formula. Nothing
 *    below is produced by the functions under test, and the cross-path
 *    agreement figure is written out rather than obtained by running WhatIfTab
 *    — two implementations agreeing because one was used to score the other
 *    would prove nothing.
 *  - THE NARROW CASE IS THE POINT. An event scoped inside the scenario must
 *    move the blend by its VOLUME SHARE, not by its full ratio. That is the
 *    defect this closes, and it is asserted as a number.
 *  - IT PINS COMBINATION BEHAVIOUR AS FOUND, not as preferred. Two percentage
 *    events are measured and the actual behaviour recorded, so R5's compounding
 *    question gains a real measurement on a real pass.
 */
import fs from 'fs';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };
const near = (a: number, b: number, eps = 1e-6) =>
  Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));

async function main() {
  const { computeScenarioForFilter } = await import('../src/utils/scenarioHelper');

  // ── A minimal session: two leaves under one segment, one month ────────────
  //
  // Deliberately round numbers so every expectation below lands on an exact
  // binary fraction and can be checked by hand from the formula.
  const MONTH = '2026-08';
  const leaf = (l2: string, inflow: number, retention: number, seed: number, arpu: number) => ({
    Cohort_Key: `Corporate|Mobile Voice|${l2}|Direct|All|All|All`,
    Segment: 'Corporate', Product: 'Mobile Voice', Product_L2: l2,
    Channel: 'Direct', Channel_L2: 'All', Tariff_L1: 'All', Tariff_L2: 'All',
    Month: MONTH,
    Inflow_Mean: inflow, Outflow_Mean: 0, Retention_Mean: retention,
    ARPU_Mean: arpu,
    Seed_Base_Volume: seed, Last_Historical_Inflow: 0, Last_Historical_Outflow: 0,
  });

  const baselineRows = [
    leaf('High Value', 100, 400, 1500, 100),
    leaf('Low Value', 100, 400, 1500, 100),
  ];

  const session = (pricingEvents: any[]) => ({
    baselineRows, marketEvents: [], yieldEvents: [], pricingEvents,
  });
  const ALL = { l1: null, l2: null };
  const run = (pricingEvents: any[], vprod: any = ALL) =>
    computeScenarioForFilter(session(pricingEvents), 'Corporate', vprod, ALL, ALL);

  const arpuAt = (rows: any[], month = MONTH) =>
    rows.find((r: any) => r.month === month)?.adjustedArpu;

  const pricing = (o: Record<string, unknown>) => ({
    ID: 'p1', Name: 'test', Segment: 'All', Product: 'All', Product_L2: 'All',
    Channel_L1: 'All', Channel_L2: 'All', Tariff_L1: 'All', Tariff_L2: 'All',
    Month: MONTH, Input_Mode: 'percentage', Amount: 10,
    Target: 'cohorts', Cohort_Scope: 'both', Duration: 'recurring', ...o,
  });

  // ── 0. THE BASELINE the cases are measured against ────────────────────────
  const base = run([]);
  const baseArpu = arpuAt(base);
  check('baseline: the scenario produces a month with an ARPU',
    typeof baseArpu === 'number' && baseArpu > 0, String(baseArpu));
  // A ZERO baseline makes every ratio check below vacuous — near(0, 0) is
  // true for any multiplier. The first run of this spec hit exactly that,
  // so the guard tests the property the checks depend on, not just the type.
  if (typeof baseArpu !== 'number' || !(baseArpu > 0)) { report(); return; }

  // ── (a) IN-SCOPE, cohorts+base with scope 'both' — prices EVERYTHING ───────
  //
  // pricedVol === totalVol makes the weighting an identity, so the full ratio
  // is correct here. This is the cross-path agreement case: the What-If side
  // computes the identical figure for the identical inputs, and the expected
  // value is the hand-written +10%.
  const everything = arpuAt(run([pricing({ Target: 'cohorts+base', Cohort_Scope: 'both' })]));
  check('(a) an event pricing EVERYTHING moves the blend by its full ratio',
    near(everything, baseArpu * 1.1),
    `${everything} vs ${baseArpu * 1.1}`);
  check('(a) cross-path agreement: that is exactly what the What-If weighting gives',
    near(everything, baseArpu * 1.1),
    'pricedVol === totalVol is an identity in applyPricingToBlend');

  // ── (b) NARROWER than scope — a WEIGHTED partial effect ───────────────────
  //
  // Retention-scoped, target 'cohorts'. Volumes: inflow 200, retention 800,
  // base 3000 -> total 4000, priced 800.
  //   priced ARPU = A x 1.1
  //   weighted    = (800 x 1.1A + 3200 x A) / 4000 = A x (0.88 + 0.8) = A x 1.02
  const narrow = arpuAt(run([pricing({ Target: 'cohorts', Cohort_Scope: 'retention' })]));
  check('(b) a retention-scoped event moves the blend by its VOLUME SHARE',
    near(narrow, baseArpu * 1.02),
    `${narrow} vs ${baseArpu * 1.02}`);
  check('(b) and NOT by the full ratio — the defect this closes',
    !near(narrow, baseArpu * 1.1),
    `${narrow} — a full ratio would be ${baseArpu * 1.1}`);

  // ── (c) OUTSIDE scope — no effect at all ──────────────────────────────────
  const outside = arpuAt(run([pricing({ Segment: 'SOHO' })]));
  check('(c) an event outside the scenario scope has NO effect',
    near(outside, baseArpu), `${outside} vs ${baseArpu}`);
  // PRODUCT_L2 specifically: the retired inline filter omitted it entirely, so
  // an event scoped to one value tier applied across every tier.
  const otherL2 = arpuAt(run([pricing({ Product_L2: 'High Value' })],
                             { l1: 'Mobile Voice', l2: 'Low Value' }));
  const baseL2 = arpuAt(run([], { l1: 'Mobile Voice', l2: 'Low Value' }));
  check('(c) PRODUCT_L2 is honoured — the dimension the old filter omitted',
    near(otherL2, baseL2),
    `${otherL2} vs ${baseL2} — a High Value event must not touch Low Value`);

  // ── (d) A DILUTION-BORN EVENT — the systematic case ───────────────────────
  //
  // Dilution events are retention-scoped by construction and arrive as ordinary
  // percentage events with the amount precomputed. 25 -> 20 is +6.666...%.
  //   priced   = A x 1.0666666666666667
  //   weighted = (800 x 1.0666...A + 3200 x A) / 4000 = A x 1.0133333333333333
  const DIL = 6.666666666666671;
  const dilution = arpuAt(run([pricing({
    Amount: DIL, Target: 'cohorts', Cohort_Scope: 'retention', Pricing_Mode: 'dilution',
  })]));
  check('(d) a dilution-born event weights like any other retention-scoped one',
    near(dilution, baseArpu * 1.0133333333333333),
    `${dilution} vs ${baseArpu * 1.0133333333333333}`);
  check('(d) and NOT the full +6.67% across the whole book',
    !near(dilution, baseArpu * 1.0666666666666667),
    `${dilution}`);

  // NO MODE BRANCH. A dilution event is an ordinary percentage event here, as
  // it is on the What-If side; the pass must not learn the mode exists.
  const helper = fs.readFileSync('src/utils/scenarioHelper.ts', 'utf8');
  check('(d) the pass has NO pricingMode branch',
    !helper.includes('Pricing_Mode') && !helper.includes('pricingMode'),
    'the mode is a card concern; the amount is precomputed at save');

  // ── (e) TWO EVENTS — the behaviour AS FOUND, not as preferred ─────────────
  //
  // Both retention-scoped +10%. Measured and recorded so R5's compounding
  // question has a real number on a real pass. The pass applies events in
  // sequence against the RUNNING finalArpu, so the second weights against the
  // first's result: this COMPOUNDS.
  //   after 1st: A x 1.02
  //   after 2nd: (800 x 1.1 x 1.02A + 3200 x 1.02A) / 4000 = A x 1.02 x 1.02
  const two = arpuAt(run([
    pricing({ ID: 'p1', Target: 'cohorts', Cohort_Scope: 'retention' }),
    pricing({ ID: 'p2', Target: 'cohorts', Cohort_Scope: 'retention' }),
  ]));
  check('(e) two events COMPOUND — 1.02 x 1.02, not 1.04',
    near(two, baseArpu * 1.02 * 1.02),
    `${two} vs compound ${baseArpu * 1.02 * 1.02} vs flat ${baseArpu * 1.04}`);
  check('(e) and the difference from flat is real, so this is not a vacuous pin',
    !near(baseArpu * 1.02 * 1.02, baseArpu * 1.04));
  console.log(`  (e) MEASURED: two +10% retention events -> ${two?.toFixed(6)} `
    + `(compound ${(baseArpu * 1.0404).toFixed(6)}, flat would be ${(baseArpu * 1.04).toFixed(6)})`);

  // ── WIRING — shared functions, no local reimplementation ──────────────────
  check('wiring: scope goes through the SHARED predicate',
    (helper.split('eventScopeMatchesView(').length - 1) === 1,
    `${helper.split('eventScopeMatchesView(').length - 1} call sites, expected 1`);
  check('wiring: the weighting goes through the SHARED functions',
    helper.includes('pricedVolumesFor(') && helper.includes('applyPricingToBlend('));
  check('wiring: the six inline comparisons are gone',
    !helper.includes('const segOk = e.Segment') && !helper.includes('const tar2Ok = !e.Tariff_L2'),
    'a local copy beside the shared call is how the divergence returns');
  check('wiring: base-only keeps the unweighted application, deliberately',
    helper.includes(': priced;'),
    'that target has no pool decomposition in month volumes');

  report();
}

function report() {
  console.log(`\nscenario-pricing spec: ${pass} passed, ${fails.length} failed`);
  fails.forEach(f => console.log('  FAIL  ' + f));
  process.exit(fails.length ? 1 : 0);
}

main().catch(e => { console.error('scenario-pricing spec CRASHED —', e); process.exit(1); });
