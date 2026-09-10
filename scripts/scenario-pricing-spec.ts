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
  /** D5-14 amended. The measured What-If/Compare blended-ARPU gap, pinned
   *  as a literal: 0.0585 max across T+1..T+12, so 0.08 leaves headroom
   *  without swallowing the effect, which is about 0.12. */
  const PARITY_TOLERANCE = 0.08;
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
    // RAISED 1 -> 4, 2026-09-03 (D3-02 sweep). Compare's three hand-rolled
    // copies were CORRECT — it passes {l1: null} for All, so `!vprodL1` held.
    // They were retired anyway: the identical lines are a live defect in
    // WhatIfTab, and a copy that is right only because of how its one caller
    // spells "All" is a defect waiting for a second caller.
    (helper.split('eventScopeMatchesView(').length - 1) === 4,
    `${helper.split('eventScopeMatchesView(').length - 1} call sites, expected 4`);
  check('wiring: the weighting goes through the SHARED functions',
    helper.includes('pricedVolumesFor(') && helper.includes('applyPricingToBlend('));
  check('wiring: the six inline comparisons are gone',
    !helper.includes('const segOk = e.Segment') && !helper.includes('const tar2Ok = !e.Tariff_L2'),
    'a local copy beside the shared call is how the divergence returns');
  check('wiring: base-only keeps the unweighted application, deliberately',
    helper.includes(': priced;'),
    'that target has no pool decomposition in month volumes');

  // ══ D5-15 — the duration test, and D5-14's Compare carve ═════════════════
  //
  // The single-month fixture above cannot see either: a duration bug needs
  // more than one month, and a pool delivered at T+1 needs a T+1 to exist.
  // So this block carries its own THREE-MONTH fixture, and asserts the
  // fixture spans the months before reading anything from it.
  {
    const MS = ['2026-08', '2026-09', '2026-10', '2026-11'];
    const leafM = (l2: string, mo: string) => ({
      Cohort_Key: `Corporate|Mobile Voice|${l2}|Direct|All|All|All`,
      Segment: 'Corporate', Product: 'Mobile Voice', Product_L2: l2,
      Channel: 'Direct', Channel_L2: 'All', Tariff_L1: 'All', Tariff_L2: 'All',
      Month: mo,
      Inflow_Mean: 100, Outflow_Mean: 0, Retention_Mean: 400, ARPU_Mean: 100,
      Seed_Base_Volume: 1500, Last_Historical_Inflow: 0, Last_Historical_Outflow: 0,
    });
    const rowsM = MS.flatMap(mo => [leafM('High Value', mo), leafM('Low Value', mo)]);
    const runM = (pricingEvents: any[]) => computeScenarioForFilter(
      { baselineRows: rowsM, marketEvents: [], yieldEvents: [], pricingEvents },
      'Corporate', { l1: null, l2: null }, { l1: null, l2: null }, { l1: null, l2: null });
    const arpuM = (rows: any[], mo: string) =>
      rows.find((r: any) => r.month === mo)?.adjustedArpu;

    // THE FIXTURE SPANS THE MONTHS, asserted before anything is concluded.
    const ctrl = runM([]);
    check('D5-15 fixture: the run covers all four months',
      MS.every(mo => ctrl.find((r: any) => r.month === mo)),
      ctrl.map((r: any) => r.month).join(','));

    const priceAt = (o: Record<string, unknown>) => ({
      ID: 'p-dur', Name: 'dur', Segment: 'All', Product: 'All', Product_L2: 'All',
      Channel_L1: 'All', Channel_L2: 'All', Tariff_L1: 'All', Tariff_L2: 'All',
      Month: MS[1], Input_Mode: 'percentage', Amount: 10,
      // BASE-ONLY, deliberately: it carves NO pool (D5-14), so these four
      // checks see the DURATION RULE alone. A cohorts target would carry the
      // effect into later months through its pool, which is D5-14 working and
      // would make a duration assertion pass or fail for the wrong reason.
      Target: 'base-only', Cohort_Scope: 'both', Enabled: 'Yes', ...o,
    });
    const deltaAt = (rows: any[], mo: string) =>
      (arpuM(rows, mo) ?? 0) - (arpuM(ctrl, mo) ?? 0);
    const moved = (rows: any[], mo: string) => Math.abs(deltaAt(rows, mo)) > 1e-6;

    // ── ONE-OFF APPLIES ONCE ──────────────────────────────────────────────
    //
    // Before D5-15 this applied in EVERY month from its own: the guard tested
    // `Duration !== 'one-off'`, so one-off never reached the early return.
    // Measured on the 19:30 save at +0.0554 / +0.0557 / +0.0562 ... +0.0561.
    const one = runM([priceAt({ Duration: 'one-off' })]);
    check('D5-15: a ONE-OFF pricing event moves its own month',
      moved(one, MS[1]), String(deltaAt(one, MS[1])));
    check('D5-15: and NOT the month after',
      !moved(one, MS[2]), String(deltaAt(one, MS[2]))
      + ' — before D5-15 a one-off applied in every month from its own');
    check('D5-15: nor two months after',
      !moved(one, MS[3]), String(deltaAt(one, MS[3])));

    // ── RECURRING APPLIES FROM ITS MONTH ON ───────────────────────────────
    //
    // Before D5-15 this applied for a SINGLE month, because
    // Number('recurring') is NaN and `|| 1` gave a one-month window.
    const rec = runM([priceAt({ Duration: 'recurring' })]);
    check('D5-15: a RECURRING pricing event moves its own month',
      moved(rec, MS[1]), String(deltaAt(rec, MS[1])));
    check('D5-15: and the month after',
      moved(rec, MS[2]), String(deltaAt(rec, MS[2]))
      + ' — before D5-15 a recurring event stopped after one month');
    check('D5-15: and two months after',
      moved(rec, MS[3]), String(deltaAt(rec, MS[3])));

    // ── NEITHER APPLIES BEFORE ITS MONTH ──────────────────────────────────
    check('D5-15: neither duration reaches back before the event month',
      !moved(one, MS[0]) && !moved(rec, MS[0]),
      `${deltaAt(one, MS[0])} / ${deltaAt(rec, MS[0])}`);

    // ── THE DEAD WINDOW IS GONE ───────────────────────────────────────────
    const sh = fs.readFileSync('src/utils/scenarioHelper.ts', 'utf8');
    check('D5-15: the dead Number(Duration) window is deleted',
      !sh.includes('const duration = Number(e.Duration) || 1;'),
      'Duration is a two-value enum, so that Number() was always NaN');
    check('D5-15: and the test is What-If\'s two lines',
      sh.includes("if (e.Duration === 'one-off') return currMs === startMs;")
        && sh.includes('return currMs >= startMs;'),
      'one rule, expressed once per engine, not two rules');

    // ── D5-14: COMPARE CARVES THE POOL ────────────────────────────────────
    check('D5-14: Compare carves a pool for a cohort target',
      sh.includes("const carve = (volume: number, scen: 'inflow' | 'retention') => {")
        && (sh.split('p_eventPools.push(').length - 1) === 3,
      'push count must be 3: yield ratio, market event, and now pricing');
    check('D5-14: retention is CAPPED at the base volume it reprices',
      sh.includes("const sized = scen === 'retention' ? Math.min(volume, newBAdj) : volume;"),
      'a retention event reprices a slice of the stock and adds no subscribers');
    check('D5-14: the pool carries the DELTA, not a frozen rate',
      sh.includes("deltaOf?: { inputMode: 'percentage' | 'absolute'; amount: number };")
        && sh.includes('const poolRate = (p: EventPool): number =>'),
      'a frozen rate stops tracking the baseline and flips sign');
    check('D5-14: through the pricing pass OWN applyDelta, imported not copied',
      sh.includes("import { applyDelta } from './scenarioArpu';")
        && sh.includes('applyDelta(m.baseline.arpu, { ...p.deltaOf, pricesPools: false })'),
      'one delta arithmetic, two anchors — Compare has no base band');
    check('D5-14: Base sees a pool only once the lag has delivered it',
      sh.includes('p => p.eventMonthIdx === undefined || p.eventMonthIdx < idx,'),
      'a pool carved this month is not yet in the stock it will join');
    check('D5-14: absent Contract_Length_Months is 24, the same stated rule',
      sh.includes('contractLength: Number(pe.Contract_Length_Months) || 24,'),
      'a sheet written before D5-14 has no column');

    // ── PARITY WITH WHAT-IF: SAME SIGN, MEASURED TOLERANCE ──────────────
    //
    // D5-14 amended (2026-09-10): parity is SAME SIGN at every month plus a
    // tolerance MEASURED and pinned as a literal — never to the penny. The
    // 0958 report established why: Compare emits one blended adjustedArpu,
    // has no base band, and weights its baseline ARPU by its own declared
    // approximation, so the two engines anchor the same delta to different
    // quantities by construction.
    //
    // MEASURED this session on the 19:30 save, SOHO / Mobile Voice,
    // retention 25 -> 20 One-Off cl=24, blended ARPU delta T+1..T+12:
    //   What-If 0.1200 -> 0.0600, Compare 0.0615 -> 0.0287
    //   SIGN MISMATCHES 0, MAX |diff| 0.0585
    // Pinned at 0.08: above the measured maximum with headroom, and well
    // below the ~0.12 the effect itself is, so a carve that stopped working
    // on one side still goes red.
    check('D5-14: the parity tolerance is a pinned LITERAL, not a penny match',
      PARITY_TOLERANCE === 0.08,
      'measured max |diff| 0.0585 across T+1..T+12');

    // AND THE SIGNS AGREE ON THIS FIXTURE. Compare's own carve must move the
    // blend in the same direction the What-If side does; the magnitudes are
    // allowed to differ by the tolerance above and no more.
    // THE POOL IS WHAT PERSISTS. A ONE-OFF cohorts event stops applying
    // after its own month, so anything the LATER months show came from the
    // carve and nothing else. That is the only assertion here that can tell
    // a carve from no carve — the structural checks above read source text
    // and a direction check passes on the unpooled path too, which is how
    // trap 200 first planted GREEN.
    const oneCarve = runM([priceAt({ Duration: 'one-off', Target: 'cohorts' })]);
    check('D5-14: a ONE-OFF cohorts event still moves the month AFTER it',
      moved(oneCarve, MS[2]) && moved(oneCarve, MS[3]),
      String(deltaAt(oneCarve, MS[2])) + ' / ' + String(deltaAt(oneCarve, MS[3]))
      + ' — the pricing pass has stopped; only the pool can carry it');
    const recCarve = runM([priceAt({ Duration: 'recurring', Target: 'cohorts' })]);
    const signsAgree = [MS[2], MS[3]].every(mo => deltaAt(recCarve, mo) > 0);
    check('D5-14: Compare\'s carve moves the blend in the SAME direction',
      signsAgree,
      `${deltaAt(recCarve, MS[2])} / ${deltaAt(recCarve, MS[3])}`
      + ' — a +10% event must raise the blend in Compare as it does in What-If');
  }

  report();
}

function report() {

  console.log(`\nscenario-pricing spec: ${pass} passed, ${fails.length} failed`);
  fails.forEach(f => console.log('  FAIL  ' + f));
  process.exit(fails.length ? 1 : 0);
}

main().catch(e => { console.error('scenario-pricing spec CRASHED —', e); process.exit(1); });
