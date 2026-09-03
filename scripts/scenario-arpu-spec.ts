/**
 * PER-SCENARIO ADJUSTED ARPU — the arithmetic, driven directly.
 *
 *   npm run spec:scenario-arpu
 *
 * A PURE spec, deliberately. `computeAdjustedForecast` is an exported function
 * over plain arguments, so the measure UAT asked for can be asserted against
 * hand-written literals without a mount. The mount is for the control row and
 * belongs to session 2.
 *
 * WHAT IT IS CAREFUL ABOUT:
 *
 *  - THE FIXTURE MUST DISCRIMINATE BEFORE ANYTHING IS ASSERTED ON IT. Every
 *    scenario carries a DIFFERENT ARPU and a DIFFERENT volume, and the spec
 *    checks that first. A fixture whose scenarios share a figure would let a
 *    block that reads the wrong one pass; this arc has already lost a session
 *    to exactly that (the mounted harness's arpu was 0 everywhere).
 *  - ISOLATION IS ASSERTED AS A NEGATIVE. "An Inflow event moves inflow ARPU"
 *    is half a claim; the half that catches a leak is "and moves no other
 *    scenario's". Every isolation check asserts both.
 *  - THE PRICING PIN IS A LITERAL, not a "still passes". `ARPU (Baseline)` and
 *    `ARPU (Adjusted)` are hand-computed and compared to the digit, so a change
 *    to the blended formula fails here even though every per-scenario check
 *    would stay green. That pairing is what proves the two layers are separate.
 */
import { computeAdjustedForecast } from '../src/components/WhatIfTab';
import { scenarioAdjustedArpu, aggregateScenarioArpu } from '../src/utils/scenarioArpu';
import { deriveAggregate } from '../src/utils/forecasting';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };
const near = (a: number | null, b: number, eps = 1e-9) =>
  a !== null && Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));

// ── THE FIXTURE ────────────────────────────────────────────────────────────
// Two months so the T+1 base recursion has somewhere to land. Every scenario's
// ARPU and volume is distinct, and none is zero.
const M0 = '2026-06', M1 = '2026-07';
const V = { inflow: 400, outflow: 250, retention: 600 };
const A = { inflow: 30, outflow: 18, retention: 22, base: 12 };
const SEED = 10_000;

const band = (v: number) => ({ mean: v, optimistic: v, pessimistic: v });
const monthOf = (month: string) => ({
  month,
  inflow: band(V.inflow), outflow: band(V.outflow), retention: band(V.retention),
  arpu: { mean: 20 },                       // the BLEND — deliberately none of the four
  inflowArpu: { mean: A.inflow }, outflowArpu: { mean: A.outflow },
  retentionArpu: { mean: A.retention }, baseArpu: { mean: A.base },
});

const BF: any = {
  cohort: { segment: 'All', product: 'All', productL2: 'All', channel: 'All',
            channelL2: 'All', tariffL1: 'All', tariffL2: 'All', scenario: 'Base Case' },
  seedBaseVolume: SEED, seedBaseKnown: true,
  lastHistoricalInflow: 0, lastHistoricalOutflow: 0,
  historicalMonths: ['2026-05'],
  months: [monthOf(M0), monthOf(M1)],
  provenance: { kind: 'fitted', modelUsed: 'Holt Linear' },
};

const ALL = { l1: null, l2: null };
const run = (marketEvents: any[] = [], yieldEvents: any[] = [], pricingEvents: any[] = []) =>
  computeAdjustedForecast({
    baseForecast: BF, marketEvents, yieldEvents, pricingEvents,
    viewSegment: 'All', viewProduct: ALL as any, viewChannel: ALL as any, viewTariff: ALL as any,
    data: [], wiSegmentCol: '', wiProductCol: '', wiProductL2Col: '',
    wiChannelCol: '', wiChannelL2Col: '', wiTariffL1Col: '', wiTariffL2Col: '',
    wiValueCol: '', proRataLeavesOverride: [],
  } as any);

const sc = (r: any, i: number) => (r.adjustedMonths[i] as any).scenarioArpu;

// ── 0. THE FIXTURE DISCRIMINATES ───────────────────────────────────────────
// Asserted BEFORE anything is asserted on it.
{
  const vals = [A.inflow, A.outflow, A.retention, A.base];
  check('fixture: all four scenario ARPUs are DISTINCT',
    new Set(vals).size === 4, vals.join(' / '));
  check('fixture: none of them is zero', vals.every(v => v > 0), vals.join(' / '));
  check('fixture: the BLEND matches none of the four — a wrong read cannot pass',
    !vals.includes(20), 'blend 20');
  const vols = [V.inflow, V.outflow, V.retention];
  check('fixture: the three flow volumes are DISTINCT and non-zero',
    new Set(vols).size === 3 && vols.every(v => v > 0), vols.join(' / '));
}

// ── 1. NO EVENTS → EACH SCENARIO EQUALS ITS BASELINE BAND, EXACTLY ─────────
// The Option-A anchor property, per scenario. Exact equality, not near().
{
  const s = sc(run(), 1);
  check('no events: inflow ARPU IS the baseline band', s.inflow.arpu === A.inflow, `${s.inflow.arpu}`);
  check('no events: outflow ARPU IS the baseline band', s.outflow.arpu === A.outflow, `${s.outflow.arpu}`);
  check('no events: retention ARPU IS the baseline band', s.retention.arpu === A.retention, `${s.retention.arpu}`);
  check('no events: base ARPU IS the baseline band', s.base.arpu === A.base, `${s.base.arpu}`);
  check('no events: no scenario reports an absence',
    !s.inflow.absence && !s.outflow.absence && !s.retention.absence && !s.base.absence);
  // AND THE REVENUE FOLLOWS THE VOLUME, not the blend.
  check('no events: inflow revenue is ARPU x inflow volume',
    near(s.inflow.revenue, A.inflow * V.inflow), `${s.inflow.revenue}`);
  check('no events: outflow revenue is ARPU x outflow volume',
    near(s.outflow.revenue, A.outflow * V.outflow), `${s.outflow.revenue}`);
}

// ── 2. ABSENCE IS ABSENCE, NEVER THE BLEND ────────────────────────────────
{
  const r = scenarioAdjustedArpu({ baselineArpu: undefined, naturalVolume: 500 });
  check('absent band: arpu is NULL, not the blend', r.arpu === null, `${r.arpu}`);
  check('absent band: the reason is named', r.absence === 'band-absent', `${r.absence}`);
  check('absent band: revenue is null too', r.revenue === null);
  const z = scenarioAdjustedArpu({ baselineArpu: 25, naturalVolume: 0 });
  check('no volume: a rate over nothing is absent, with its own reason',
    z.arpu === null && z.absence === 'no-volume', `${z.absence}`);
  check('band-absence OUTRANKS no-volume — the cause named is the right one',
    scenarioAdjustedArpu({ baselineArpu: undefined, naturalVolume: 0 }).absence === 'band-absent');
}

// ── 3. AGGREGATE = Srevenue / Svolume, NEVER A MEAN OF RATES ──────────────
// Two leaves that disagree on both rate and size, so a mean-of-rates and a
// volume-weighted blend cannot coincide.
{
  const leafA = scenarioAdjustedArpu({ baselineArpu: 30, naturalVolume: 100 });
  const leafB = scenarioAdjustedArpu({ baselineArpu: 10, naturalVolume: 900 });
  const agg = aggregateScenarioArpu([leafA, leafB]);

  const meanOfRates = (30 + 10) / 2;                       // 20 — the WRONG answer
  const weighted = (30 * 100 + 10 * 900) / (100 + 900);    // 12 — the right one
  check('aggregate fixture DISCRIMINATES: the two answers differ',
    Math.abs(meanOfRates - weighted) > 1, `${meanOfRates} vs ${weighted}`);
  check('aggregate ARPU is the VOLUME-WEIGHTED blend, hand-computed',
    near(agg.arpu, 12), `${agg.arpu}`);
  check('aggregate ARPU is NOT the mean of rates', agg.arpu !== meanOfRates);
  // THE NEVER-AVERAGED RULE MADE CHECKABLE, to the penny.
  check('aggregate ARPU x aggregate volume EQUALS S(leaf ARPU x leaf volume)',
    near(agg.arpu! * agg.volume, leafA.revenue! + leafB.revenue!),
    `${agg.arpu! * agg.volume} vs ${leafA.revenue! + leafB.revenue!}`);
  check('aggregate volume is the SUM of leaf volumes', agg.volume === 1000, `${agg.volume}`);
  // A leaf that cannot state a rate contributes NOTHING, not a zero rate.
  const withAbsent = aggregateScenarioArpu([leafA, leafB,
    scenarioAdjustedArpu({ baselineArpu: undefined, naturalVolume: 5000 })]);
  check('an ABSENT leaf contributes nothing — not a zero rate dragging the blend',
    near(withAbsent.arpu, 12) && withAbsent.volume === 1000, `${withAbsent.arpu} / ${withAbsent.volume}`);
}

// ── 4. ISOLATION — each kind moves its own scenario and no other ──────────
const baseline = sc(run(), 1);

// (a) A market event on Inflow.
{
  const ev = [{
    id: 'mk1', scenario: 'Inflow', segment: 'All', product: 'All', productL2: 'All',
    channel: 'All', channelL2: 'All', tariffL1: 'All', tariffL2: 'All',
    date: M1, subscriberVolume: 200, customerVolume: 0, revenue: 200 * 50, arpu: 50,
    name: '', campaignName: '', comment: '', contractLength: 24, sequence: 1,
    amountType: 'absolute', percentageBasis: 'baseline', retentionLinked: true,
  }];
  const s = sc(run(ev), 1);
  check('market/Inflow: inflow ARPU MOVES', s.inflow.arpu !== baseline.inflow.arpu,
    `${baseline.inflow.arpu} -> ${s.inflow.arpu}`);
  check('market/Inflow: it moves TOWARD the pool rate (50 > 30)',
    s.inflow.arpu > A.inflow && s.inflow.arpu < 50, `${s.inflow.arpu}`);
  check('market/Inflow: outflow ARPU is UNMOVED', s.outflow.arpu === baseline.outflow.arpu);
  check('market/Inflow: retention ARPU is UNMOVED', s.retention.arpu === baseline.retention.arpu);
}

// (b) A dilution — a retention-scoped pricing event.
{
  const pe = [{
    id: 'pr1', segment: 'All', product: 'All', productL2: 'All', channelL1: 'All',
    channelL2: 'All', tariffL1: 'All', tariffL2: 'All', month: M1,
    inputMode: 'percentage', amount: -10, target: 'cohorts', cohortScope: 'retention',
    duration: 'one-off', originalBaseArpu: 0, name: '', comment: '',
    pricingMode: 'dilution', dilutionCurrentPct: 10, dilutionTargetPct: 19,
  }];
  const s = sc(run([], [], pe), 1);
  check('dilution: retention ARPU MOVES', s.retention.arpu !== baseline.retention.arpu,
    `${baseline.retention.arpu} -> ${s.retention.arpu}`);
  check('dilution: retention ARPU falls by exactly 10%',
    near(s.retention.arpu, A.retention * 0.9), `${s.retention.arpu}`);
  check('dilution: inflow ARPU is UNMOVED', s.inflow.arpu === baseline.inflow.arpu);
  check('dilution: base ARPU is UNMOVED', s.base.arpu === baseline.base.arpu);
  check('dilution: outflow ARPU is UNMOVED', s.outflow.arpu === baseline.outflow.arpu);
}

// (c) A base-only pricing event.
{
  const pe = [{
    id: 'pr2', segment: 'All', product: 'All', productL2: 'All', channelL1: 'All',
    channelL2: 'All', tariffL1: 'All', tariffL2: 'All', month: M1,
    inputMode: 'percentage', amount: 10, target: 'base-only', cohortScope: 'both',
    duration: 'one-off', originalBaseArpu: 0, name: '', comment: '',
  }];
  const s = sc(run([], [], pe), 1);
  check('base-only pricing: base ARPU rises by exactly 10%',
    near(s.base.arpu, A.base * 1.1), `${s.base.arpu}`);
  check('base-only pricing: inflow ARPU is UNMOVED', s.inflow.arpu === baseline.inflow.arpu);
  check('base-only pricing: retention ARPU is UNMOVED', s.retention.arpu === baseline.retention.arpu);
  check('base-only pricing: outflow ARPU is UNMOVED', s.outflow.arpu === baseline.outflow.arpu);
}

// (d) A churn ramp — outflow VOLUME moves, outflow ARPU does not.
{
  const ev = [{
    id: 'ch1', scenario: 'Outflow', segment: 'All', product: 'All', productL2: 'All',
    channel: 'All', channelL2: 'All', tariffL1: 'All', tariffL2: 'All',
    date: M1, subscriberVolume: 60, customerVolume: 0, revenue: 0, arpu: 0,
    name: '', campaignName: 'Churn reduction', comment: '', contractLength: 24, sequence: 1,
    amountType: 'absolute', percentageBasis: 'baseline', retentionLinked: true,
    churnMode: 'churn', churnTargetPct: 1, churnCurrentPct: 3, churnPrevBase: SEED,
  }];
  const r = run(ev);
  const s = sc(r, 1);
  check('churn: outflow VOLUME moves', s.outflow.volume !== baseline.outflow.volume,
    `${baseline.outflow.volume} -> ${s.outflow.volume}`);
  check('churn: outflow ARPU does NOT move — it states who leaves, not their worth',
    s.outflow.arpu === baseline.outflow.arpu, `${s.outflow.arpu}`);
  check('churn: outflow REVENUE follows the volume at the unchanged rate',
    near(s.outflow.revenue, s.outflow.arpu * s.outflow.volume), `${s.outflow.revenue}`);
  check('churn: no other scenario ARPU moves',
    s.inflow.arpu === baseline.inflow.arpu && s.retention.arpu === baseline.retention.arpu);
}

// ── 5. THE PIN — the blended column is UNCHANGED, by literal ──────────────
// Hand-computed, not copied from a run. With no events the engine's Option-A
// anchor makes the adjusted blend equal the baseline blend exactly, and the
// baseline blend is the fixture's own `arpu.mean`.
{
  const r = run();
  const row0: any = r.chartData[0];
  const row1: any = r.chartData[1];
  check('PIN: ARPU (Baseline) is the fixture blend, to the digit',
    row1['ARPU (Baseline)'] === 20, `${row1['ARPU (Baseline)']}`);
  check('PIN: ARPU (Adjusted) is the fixture blend, to the digit',
    row1['ARPU (Adjusted)'] === 20, `${row1['ARPU (Adjusted)']}`);
  check('PIN: and the same holds in month 0',
    row0['ARPU (Baseline)'] === 20 && row0['ARPU (Adjusted)'] === 20,
    `${row0['ARPU (Baseline)']} / ${row0['ARPU (Adjusted)']}`);
  // THE LAYER PROOF'S OTHER HALF: the blend is NOT any per-scenario figure.
  const s = sc(r, 1);
  check('PIN: the blend differs from every per-scenario ARPU — two layers, not one',
    ![s.inflow.arpu, s.outflow.arpu, s.retention.arpu, s.base.arpu].includes(20),
    `blend 20 vs ${s.inflow.arpu}/${s.outflow.arpu}/${s.retention.arpu}/${s.base.arpu}`);
  // The pricing card reads this column; assert the shape it depends on.
  check('PIN: ARPU (Adjusted) is a finite number, as originalBaseArpu requires',
    typeof row1['ARPU (Adjusted)'] === 'number' && Number.isFinite(row1['ARPU (Adjusted)']));
}

// ── 6. BASE WEIGHTS BY BASE STOCK, not by inflow ──────────────────────────
{
  const s = sc(run(), 1);
  const r = run();
  const row1: any = r.chartData[1];
  check('base: volume IS the adjusted base stock, not a flow',
    near(s.base.volume, row1['Base (Adjusted)'], 1e-6),
    `${s.base.volume} vs ${row1['Base (Adjusted)']}`);
  check('base: and that stock is not any flow volume',
    s.base.volume !== V.inflow && s.base.volume !== V.retention && s.base.volume !== V.outflow,
    `${s.base.volume}`);
  check('base: revenue is base ARPU x base stock',
    near(s.base.revenue, s.base.arpu * s.base.volume), `${s.base.revenue}`);
}

// ── 7. THE SIXTEEN COLUMNS, AND THE EXPORT ORDER ─────────────────────────
//
// The chart export writes `chartData` wholesale, so the row's KEY ORDER is the
// export's column order. "Additive only" is therefore a literal, checkable
// claim: the original thirteen keys must still be the first thirteen, in the
// same order, and everything new must follow them.
//
// COMPATIBILITY, from `051a9b3` onward: `hasEvent` here and the
// `Applied_Event_IDs` column in the session export both EXCLUDE zero-coverage
// events — an event in scope at the view that lands on none of it. The columns
// did not move and were not renamed, so a diff of two exports shows no
// structural change; what changed is which events they name. Since the
// 2026-09-03 contract change (EXPECTED.md, "AN EVENT MATCHING NO POPULATED
// LEAF IS APPLIED NOWHERE — ABSOLUTE TOO") the exclusion covers absolute
// events as well as percentages.

{
  const r = run();
  const row: any = r.chartData[1];
  const keys = Object.keys(row);

  const ORIGINAL_13 = [
    'month',
    'Inflow (Baseline)', 'Inflow (Adjusted)',
    'Outflow (Baseline)', 'Outflow (Adjusted)',
    'Retention (Baseline)', 'Retention (Adjusted)',
    'Base (Baseline)', 'Base (Adjusted)',
    'ARPU (Baseline)', 'ARPU (Adjusted)',
    'ARPU Outflow (Ref)',
    'hasEvent',
  ];
  check('export: the original thirteen keys are the FIRST thirteen, in order',
    JSON.stringify(keys.slice(0, 13)) === JSON.stringify(ORIGINAL_13),
    `${JSON.stringify(keys.slice(0, 13))}`);
  check('export: nothing existing was renamed or removed',
    ORIGINAL_13.every(k => keys.includes(k)));

  const NEW_16: string[] = [];
  for (const sn of ['Inflow', 'Outflow', 'Retention', 'Base']) {
    for (const mz of ['ARPU', 'Revenue']) {
      for (const half of ['Baseline', 'Adjusted']) NEW_16.push(`${sn} ${mz} (${half})`);
    }
  }
  check('export: all sixteen new columns are present', NEW_16.every(k => keys.includes(k)),
    `${NEW_16.filter(k => !keys.includes(k)).join(', ') || 'all present'}`);
  check('export: and every one of them comes AFTER the original thirteen',
    NEW_16.every(k => keys.indexOf(k) >= 13));
  check('export: the row has exactly 13 + 16 keys — nothing else crept in',
    keys.length === 29, `${keys.length} keys`);

  // ── THE LITERALS. Hand-computed from the fixture, per scenario. ─────────
  // Revenue is THAT scenario's ARPU x THAT scenario's volume — trap 118 plants
  // the wrong volume, and only a per-scenario literal can see it.
  check('columns: Inflow ARPU (Baseline) is the inflow band',
    row['Inflow ARPU (Baseline)'] === A.inflow, `${row['Inflow ARPU (Baseline)']}`);
  check('columns: Inflow Revenue (Baseline) is 30 x 400 = 12000',
    row['Inflow Revenue (Baseline)'] === 12000, `${row['Inflow Revenue (Baseline)']}`);
  check('columns: Outflow Revenue (Baseline) is 18 x 250 = 4500',
    row['Outflow Revenue (Baseline)'] === 4500, `${row['Outflow Revenue (Baseline)']}`);
  check('columns: Retention Revenue (Baseline) is 22 x 600 = 13200',
    row['Retention Revenue (Baseline)'] === 13200, `${row['Retention Revenue (Baseline)']}`);
  check('columns: Base Revenue (Baseline) is 12 x the BASELINE base stock',
    near(row['Base Revenue (Baseline)'], A.base * row['Base (Baseline)'], 1e-4),
    `${row['Base Revenue (Baseline)']} vs ${A.base * row['Base (Baseline)']}`);

  // NO EVENTS: adjusted equals baseline in every one of the sixteen.
  for (const sn of ['Inflow', 'Outflow', 'Retention', 'Base']) {
    check(`columns: ${sn} ARPU adjusted === baseline with no events`,
      row[`${sn} ARPU (Adjusted)`] === row[`${sn} ARPU (Baseline)`],
      `${row[`${sn} ARPU (Adjusted)`]} vs ${row[`${sn} ARPU (Baseline)`]}`);
  }

  // AND THE WRONG-VOLUME MISTAKE IS VISIBLE: the four revenues are distinct, so
  // multiplying by another scenario's volume cannot coincide with the right
  // answer. Asserted, because a fixture where they collided would let trap 118
  // through.
  const revs = ['Inflow', 'Outflow', 'Retention', 'Base'].map(sn => row[`${sn} Revenue (Baseline)`]);
  check('columns: the four baseline revenues are DISTINCT — a wrong volume cannot hide',
    new Set(revs).size === 4, revs.join(' / '));
}

// ── 8. ABSENCE REACHES THE COLUMN AS null, NEVER AS THE BLEND OR ZERO ─────
{
  // A forecast month with NO per-scenario bands — the pre-schema shape.
  const bare: any = {
    ...BF,
    months: BF.months.map((mm: any) => ({
      month: mm.month, inflow: mm.inflow, outflow: mm.outflow, retention: mm.retention,
      arpu: { mean: 20 },
    })),
  };
  const r = computeAdjustedForecast({
    baseForecast: bare, marketEvents: [], yieldEvents: [], pricingEvents: [],
    viewSegment: 'All', viewProduct: ALL as any, viewChannel: ALL as any, viewTariff: ALL as any,
    data: [], wiSegmentCol: '', wiProductCol: '', wiProductL2Col: '',
    wiChannelCol: '', wiChannelL2Col: '', wiTariffL1Col: '', wiTariffL2Col: '',
    wiValueCol: '', proRataLeavesOverride: [],
  } as any);
  const row: any = r.chartData[1];
  for (const sn of ['Inflow', 'Outflow', 'Retention', 'Base']) {
    check(`absence: ${sn} ARPU (Baseline) is null, not the blend and not 0`,
      row[`${sn} ARPU (Baseline)`] === null, `${row[`${sn} ARPU (Baseline)`]}`);
    check(`absence: ${sn} Revenue (Adjusted) is null, not 0`,
      row[`${sn} Revenue (Adjusted)`] === null, `${row[`${sn} Revenue (Adjusted)`]}`);
  }
  check('absence: the BLENDED columns still carry their figures — only the new ones abstain',
    row['ARPU (Baseline)'] === 20 && row['ARPU (Adjusted)'] === 20,
    `${row['ARPU (Baseline)']} / ${row['ARPU (Adjusted)']}`);
  check('absence: the engine named a REASON rather than just producing null',
    (r.adjustedMonths[1] as any).scenarioArpu.inflow.absence === 'band-absent',
    `${(r.adjustedMonths[1] as any).scenarioArpu.inflow.absence}`);
}

// ── 9. YIELD ISOLATION — the engine session's first stated gap ────────────
//
// That session wired yield through the hoisted ratios and said plainly it had
// no spec of its own. One Inflow yield and one Retention yield, each asserted
// to move its own scenario and NO other.
{
  const yieldEv = (ibro: 'Inflow' | 'Retention', month: string) => ({
    id: `y-${ibro}`, ibro, segment: 'All', product: 'All',
    channelL1: 'All', channelL2: 'All', month, rollForward: false,
    // A mix that blends to DOUBLE the equal-weight baseline, so the ratio is
    // 2.0 and the movement cannot be mistaken for rounding.
    tariffMix: { A: 100, B: 0 },
    tariffBaseArpu: { A: 40, B: 20 },
    name: '', comment: '',
  });

  const base = sc(run(), 1);

  // RETENTION yield in month 1.
  {
    const s2 = sc(run([], [yieldEv('Retention', M1)]), 1);
    check('yield/Retention: retention ARPU MOVES',
      s2.retention.arpu !== base.retention.arpu,
      `${base.retention.arpu} -> ${s2.retention.arpu}`);
    check('yield/Retention: inflow ARPU is UNMOVED', s2.inflow.arpu === base.inflow.arpu,
      `${s2.inflow.arpu}`);
    check('yield/Retention: outflow ARPU is UNMOVED', s2.outflow.arpu === base.outflow.arpu);
    check('yield/Retention: base ARPU is UNMOVED', s2.base.arpu === base.base.arpu);
  }

  // INFLOW yield applies to the PREVIOUS month's inflow entering the pool, so
  // it is stated at M0 and read at M1 — the engine's own T-1 lag on that arm.
  {
    const s2 = sc(run([], [yieldEv('Inflow', M0)]), 1);
    check('yield/Inflow: inflow ARPU MOVES',
      s2.inflow.arpu !== base.inflow.arpu, `${base.inflow.arpu} -> ${s2.inflow.arpu}`);
    check('yield/Inflow: retention ARPU is UNMOVED',
      s2.retention.arpu === base.retention.arpu, `${s2.retention.arpu}`);
    check('yield/Inflow: outflow ARPU is UNMOVED', s2.outflow.arpu === base.outflow.arpu);
  }
}

// ── 10. A TWO-LEAF STORE — the engine session's second stated gap ─────────
//
// That session drove the aggregate rule on `aggregateScenarioArpu` directly and
// said the REAL aggregation was not exercised. This runs deriveAggregate over
// two leaves and then feeds the aggregate through computeAdjustedForecast, so
// the whole path is driven.
{
  const leafOf = (name: string, mult: number, arpu: typeof A) => ({
    cohort: { segment: name, product: 'All', productL2: 'All', channel: 'All',
              channelL2: 'All', tariffL1: 'All', tariffL2: 'All', scenario: 'Base Case' },
    seedBaseVolume: SEED * mult, seedBaseKnown: true,
    lastHistoricalInflow: 0, lastHistoricalOutflow: 0,
    historicalMonths: ['2026-05'],
    months: [M0, M1].map(month => ({
      month,
      inflow: band(V.inflow * mult), outflow: band(V.outflow * mult),
      retention: band(V.retention * mult),
      arpu: { mean: 20 },
      inflowArpu: { mean: arpu.inflow }, outflowArpu: { mean: arpu.outflow },
      retentionArpu: { mean: arpu.retention }, baseArpu: { mean: arpu.base },
    })),
    provenance: { kind: 'fitted', modelUsed: 'Holt Linear' },
  });

  const LA = leafOf('LA', 1, A);
  const LB = leafOf('LB', 3, { inflow: 10, outflow: 6, retention: 8, base: 4 });
  // THE FIXTURE MUST DISCRIMINATE: the leaves disagree on every scenario.
  check('two-leaf: the leaves disagree on every scenario ARPU',
    A.inflow !== 10 && A.outflow !== 6 && A.retention !== 8 && A.base !== 4);

  const agg = deriveAggregate([LA, LB] as any, LA.cohort as any);
  const am: any = agg!.months.find((x: any) => x.month === M1);

  // Srevenue / Svolume, per scenario, hand-computed.
  const expInflow = (A.inflow * V.inflow + 10 * V.inflow * 3) / (V.inflow + V.inflow * 3);
  check('two-leaf: aggregate inflowArpu is Srev/Svol, hand-computed',
    near(am.inflowArpu.mean, +expInflow.toFixed(4), 1e-4),
    `${am.inflowArpu.mean} vs ${expInflow}`);
  check('two-leaf: it is NOT the mean of the two leaf rates',
    Math.abs(am.inflowArpu.mean - (A.inflow + 10) / 2) > 0.01,
    `${am.inflowArpu.mean} vs mean-of-rates ${(A.inflow + 10) / 2}`);

  // AND THROUGH THE ENGINE: the aggregate's columns carry those figures.
  const r = computeAdjustedForecast({
    baseForecast: agg, marketEvents: [], yieldEvents: [], pricingEvents: [],
    viewSegment: 'All', viewProduct: ALL as any, viewChannel: ALL as any, viewTariff: ALL as any,
    data: [], wiSegmentCol: '', wiProductCol: '', wiProductL2Col: '',
    wiChannelCol: '', wiChannelL2Col: '', wiTariffL1Col: '', wiTariffL2Col: '',
    wiValueCol: '', proRataLeavesOverride: [],
  } as any);
  const row: any = r.chartData[1];
  check('two-leaf: the chart column carries the AGGREGATE inflow ARPU',
    near(row['Inflow ARPU (Baseline)'], +am.inflowArpu.mean.toFixed(2), 1e-6),
    `${row['Inflow ARPU (Baseline)']} vs ${am.inflowArpu.mean}`);
  check('two-leaf: aggregate inflow revenue is aggregate ARPU x aggregate volume',
    near(row['Inflow Revenue (Baseline)'],
         +(row['Inflow ARPU (Baseline)'] * row['Inflow (Baseline)']).toFixed(2), 1e-4),
    `${row['Inflow Revenue (Baseline)']}`);
}

console.log(`\nscenario-arpu spec: ${pass}/${pass + fails.length} passed`);
fails.forEach(f => console.log('  FAIL  ' + f));
if (!fails.length) console.log('  every check green');
process.exit(fails.length ? 1 : 0);
