/**
 * A PERCENTAGE EVENT MOVES THE AGGREGATE BY EXACTLY ITS LEAF EFFECT.
 *
 *   npm run spec:aggregate-reconciliation
 *
 * Decision, Jon 2026-09-02, option (i) — recorded in EXPECTED.md. The aggregate
 * adjustment of a percentage event is Σ over targeted populated leaves of
 * (pct × that leaf's fitted forecast for that month).
 *
 * THE FIXTURE IS THE POINT, and it is asserted before anything else runs.
 * `eventCoverage` weights by HISTORY; the value it scales is a FITTED FORECAST.
 * Those two denominators are equal in every synthetic fixture anyone would
 * write by hand — which is exactly why this defect survived a session that
 * measured it directly (1456) and was only caught on a real save. So the leaves
 * here carry a forecast mix that DIFFERS from their historical mix, the two
 * ratios are printed, and the spec fails if they ever coincide.
 *
 *   historical  A 300 / 1000 = 0.30      forecast  A 200 / 1000 = 0.20
 *
 * A +10% event on leaf A must move BOTH views by 0.10 × 200 = 20.00.
 * Under historical weighting the aggregate moved 0.10 × 1000 × 0.30 = 30.00
 * while its own leaf moved 20.00 — the shape of UAT-D2-03.
 *
 * MEASURED ON THE REAL SAVE TOO. `test-data/Walks/PROSPECT Forecast Save —
 * 02 Sep 2026 1633.xlsx` (sha1 1322c3e6…): a +10% event on Large Enterprise /
 * Mobile Voice moved ALL 41.20 against LEAF 48.28 before, and 48.28 / 48.28
 * after. That file is not committed, so the literals below stand in for it.
 */
import * as fs from 'fs';
import { computeAdjustedForecast } from '../src/components/WhatIfTab';
import { forecastCoverage } from '../src/utils/forecasting';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

const M0 = '2026-07', M1 = '2026-08';
const band = (v: number) => ({ mean: v, optimistic: v, pessimistic: v });

/** FORECAST volumes — deliberately NOT proportional to the history below. */
const F = { A: { [M0]: 200, [M1]: 250 }, B: { [M0]: 800, [M1]: 750 } };
/** HISTORICAL volumes, what eventCoverage used to weight by. */
const H = { A: 300, B: 700 };

const scopeA = { segment: 'Corporate', product: 'Mobile Voice', productL2: 'All',
                 channel: 'Direct', channelL2: 'All', tariffL1: 'All', tariffL2: 'All' };
const scopeB = { segment: 'SME', product: 'Mobile Data', productL2: 'All',
                 channel: 'Direct', channelL2: 'All', tariffL1: 'All', tariffL2: 'All' };

const leafOf = (scope: any, f: Record<string, number>) => ({
  cohort: { ...scope, scenario: 'Base Case' },
  seedBaseVolume: 5000, seedBaseKnown: true,
  lastHistoricalInflow: 0, lastHistoricalOutflow: 0, historicalMonths: ['2026-06'],
  months: [M0, M1].map(m => ({
    month: m, inflow: band(f[m]), outflow: band(0), retention: band(0),
    arpu: { mean: 20 }, inflowArpu: { mean: 20 }, outflowArpu: { mean: 20 },
    retentionArpu: { mean: 20 }, baseArpu: { mean: 20 },
  })),
  provenance: { kind: 'fitted', modelUsed: 'Holt Linear' },
}) as any;
const LEAF_A = leafOf(scopeA, F.A);
const LEAF_B = leafOf(scopeB, F.B);

/** The All view: the SUM of the two, which is what deriveAggregate produces. */
const AGG = {
  cohort: { segment: 'All', product: 'All', productL2: 'All', channel: 'All',
            channelL2: 'All', tariffL1: 'All', tariffL2: 'All', scenario: 'Base Case' },
  seedBaseVolume: 10000, seedBaseKnown: true,
  lastHistoricalInflow: 0, lastHistoricalOutflow: 0, historicalMonths: ['2026-06'],
  months: [M0, M1].map(m => ({
    month: m, inflow: band(F.A[m] + F.B[m]), outflow: band(0), retention: band(0),
    arpu: { mean: 20 }, inflowArpu: { mean: 20 }, outflowArpu: { mean: 20 },
    retentionArpu: { mean: 20 }, baseArpu: { mean: 20 },
  })),
  provenance: { kind: 'fitted', modelUsed: 'Holt Linear' },
} as any;

/** The HISTORICAL leaf weights the old path used. */
const DATA_LEAVES = [{ ...scopeA, volume: H.A, hasMetricData: true },
                     { ...scopeB, volume: H.B, hasMetricData: true }];

const ALLV = { l1: null, l2: null };
const run = (bf: any, seg: string, prod: any, chan: any, events: any[], vlf?: any[]) =>
  computeAdjustedForecast({
    baseForecast: bf, marketEvents: events, yieldEvents: [], pricingEvents: [],
    viewLeafForecasts: vlf,
    viewSegment: seg, viewProduct: prod as any, viewChannel: chan as any, viewTariff: ALLV as any,
    data: [], wiSegmentCol: '', wiProductCol: '', wiProductL2Col: '',
    wiChannelCol: '', wiChannelL2Col: '', wiTariffL1Col: '', wiTariffL2Col: '',
    wiValueCol: '', proRataLeavesOverride: DATA_LEAVES,
  } as any);

const ev = (over: any) => [{
  id: 'E1', sequence: 1, date: M0, scenario: 'Inflow', name: 'r',
  ...scopeA, customerVolume: 0, revenue: 0, arpu: 0, percentageBasis: 'baseline', ...over,
}];
const deltaAt = (r: any, month: string) => {
  const m = r.adjustedMonths.find((x: any) => x.month === month);
  return m ? m.uplifted.inflow - m.baseline.inflow : NaN;
};

// ---------------------------------------------------------------------------
// 0. THE FIXTURE DISCRIMINATES — the whole spec rests on this.
// ---------------------------------------------------------------------------
{
  const histRatio = H.A / (H.A + H.B);
  const fcstRatio = F.A[M0] / (F.A[M0] + F.B[M0]);
  console.log(`  historical ratio ${histRatio}   forecast ratio ${fcstRatio}`);
  check('fixture: the two leaves have DIFFERENT historical volumes',
    H.A !== H.B, `${H.A} / ${H.B}`);
  check('fixture: neither historical volume is zero', H.A > 0 && H.B > 0);
  check('fixture: the FORECAST mix DIFFERS from the HISTORICAL mix',
    !near(histRatio, fcstRatio, 1e-12), `${histRatio} vs ${fcstRatio}`);
  check('fixture: and it differs at the SECOND month too',
    !near(H.A / (H.A + H.B), F.A[M1] / (F.A[M1] + F.B[M1]), 1e-12));
  check('fixture: the aggregate forecast is the SUM of the leaves at both months',
    near(AGG.months[0].inflow.mean, F.A[M0] + F.B[M0]) &&
    near(AGG.months[1].inflow.mean, F.A[M1] + F.B[M1]));
}

// ---------------------------------------------------------------------------
// 1. RECONCILIATION, to the penny, at BOTH months.
// ---------------------------------------------------------------------------
{
  const PCT = ev({ subscriberVolume: 10, amountType: 'percentage' });
  const rAll = run(AGG, 'All', ALLV, ALLV, PCT, [LEAF_A, LEAF_B]);
  const rLeaf = run(LEAF_A, scopeA.segment, { l1: scopeA.product, l2: null },
                    { l1: scopeA.channel, l2: null }, PCT, [LEAF_A]);

  check('M0: the LEAF moves by 10% of its own forecast — 20.00',
    near(deltaAt(rLeaf, M0), 20, 1e-9), `${deltaAt(rLeaf, M0)}`);
  check('M0: the AGGREGATE moves by the SAME 20.00',
    near(deltaAt(rAll, M0), 20, 1e-9),
    `${deltaAt(rAll, M0)} — historical weighting would give 30.00`);
  check('M0: aggregate === leaf to the penny',
    near(deltaAt(rAll, M0), deltaAt(rLeaf, M0), 1e-9));

  // The event lands in M0 only, so M1 must move by nothing at either view —
  // the control that stops a blanket uplift passing as reconciliation.
  check('M1: neither view moves, the event is a single month',
    near(deltaAt(rAll, M1), 0, 1e-9) && near(deltaAt(rLeaf, M1), 0, 1e-9),
    `${deltaAt(rAll, M1)} / ${deltaAt(rLeaf, M1)}`);

  // And a SECOND month's event, so the reconciliation is not a coincidence of M0.
  const PCT1 = ev({ subscriberVolume: 10, amountType: 'percentage', date: M1 });
  const rAll1 = run(AGG, 'All', ALLV, ALLV, PCT1, [LEAF_A, LEAF_B]);
  const rLeaf1 = run(LEAF_A, scopeA.segment, { l1: scopeA.product, l2: null },
                     { l1: scopeA.channel, l2: null }, PCT1, [LEAF_A]);
  check('M1 event: the LEAF moves 10% of 250 — 25.00',
    near(deltaAt(rLeaf1, M1), 25, 1e-9), `${deltaAt(rLeaf1, M1)}`);
  check('M1 event: the AGGREGATE moves the SAME 25.00',
    near(deltaAt(rAll1, M1), 25, 1e-9),
    `${deltaAt(rAll1, M1)} — the month's own ratio, not M0's`);
}

// ---------------------------------------------------------------------------
// 2. THE OLD BEHAVIOUR IS STILL REACHABLE, and is what the fix replaced.
//    Without leaf forecasts the historical weighting stands — a deliberate
//    fallback, pinned so it cannot become an accident.
// ---------------------------------------------------------------------------
{
  const PCT = ev({ subscriberVolume: 10, amountType: 'percentage' });
  const noLeaves = run(AGG, 'All', ALLV, ALLV, PCT, undefined);
  check('FALLBACK: with no leaf forecasts the aggregate uses HISTORICAL weights',
    near(deltaAt(noLeaves, M0), 30, 1e-9),
    `${deltaAt(noLeaves, M0)} — 10% x 1000 x 0.30, the pre-fix number`);
  check('FALLBACK: and that is exactly what the fix removes when leaves ARE known',
    !near(30, 20));
}

// ---------------------------------------------------------------------------
// 3. ABSOLUTE EVENTS ARE UNTOUCHED — they already reconciled.
// ---------------------------------------------------------------------------
{
  const ABS = ev({ subscriberVolume: 50, amountType: 'absolute' });
  const rAll = run(AGG, 'All', ALLV, ALLV, ABS, [LEAF_A, LEAF_B]);
  const rLeaf = run(LEAF_A, scopeA.segment, { l1: scopeA.product, l2: null },
                    { l1: scopeA.channel, l2: null }, ABS, [LEAF_A]);
  check('ABSOLUTE: the aggregate takes the whole 50', near(deltaAt(rAll, M0), 50, 1e-9),
    `${deltaAt(rAll, M0)}`);
  check('ABSOLUTE: and so does the leaf', near(deltaAt(rLeaf, M0), 50, 1e-9));
  check('ABSOLUTE: the two agree', near(deltaAt(rAll, M0), deltaAt(rLeaf, M0), 1e-9));
}

// ---------------------------------------------------------------------------
// 4. forecastCoverage's OWN CONTRACT — null, never zero, when it cannot answer.
// ---------------------------------------------------------------------------
{
  check('COVERAGE: the forecast ratio at the All view',
    near(forecastCoverage(scopeA as any, 'inflow', M0, [LEAF_A, LEAF_B])!, 0.2, 1e-12),
    `${forecastCoverage(scopeA as any, 'inflow', M0, [LEAF_A, LEAF_B])}`);
  check('COVERAGE: 1 at the leaf itself',
    forecastCoverage(scopeA as any, 'inflow', M0, [LEAF_A]) === 1);
  check('COVERAGE: null with no leaves — NOT zero',
    forecastCoverage(scopeA as any, 'inflow', M0, undefined) === null);
  check('COVERAGE: null with an empty list — NOT zero',
    forecastCoverage(scopeA as any, 'inflow', M0, []) === null);
  check('COVERAGE: null for a month the leaves do not carry',
    forecastCoverage(scopeA as any, 'inflow', '2099-01', [LEAF_A, LEAF_B]) === null);
  // A target matching no leaf is genuinely zero — a real answer, not a decline.
  const noMatch = { ...scopeA, segment: 'MNC' };
  check('COVERAGE: 0 when the target matches no leaf in the view',
    forecastCoverage(noMatch as any, 'inflow', M0, [LEAF_A, LEAF_B]) === 0);
}

// ---------------------------------------------------------------------------
// 5. THE WIRING. Exactly-N pins on what changed, so a caller cannot be missed.
// ---------------------------------------------------------------------------
{
  const fc = fs.readFileSync('src/utils/forecasting.ts', 'utf8');
  const wi = fs.readFileSync('src/components/WhatIfTab.tsx', 'utf8');
  const app = fs.readFileSync('src/App.tsx', 'utf8');

  check('WIRING: forecastCoverage is exported exactly once',
    (fc.match(/export function forecastCoverage\(/g) ?? []).length === 1);
  const calls = (wi.match(/forecastCoverage\(/g) ?? []).length;
  check('WIRING: the card calls it exactly once', calls === 1, `${calls}`);
  check('WIRING: and prefers it over eventCoverage, falling back with ??',
    /forecastCoverage\(e, metricOf\(e\), month\.month, viewLeafForecasts\)\s*\n?\s*\?\? eventCoverage\(e, viewScope, leavesFor\(e\)\)/.test(wi),
    'the fallback must remain, or a stored forecast loses its events');
  check('WIRING: eventCoverage is still called exactly once — the fallback',
    (wi.match(/eventCoverage\(/g) ?? []).length === 1);
  check('WIRING: resolveFromStore returns the leaves',
    /reason: SkipReason \| null; leaves: BaseForecast\[\] \}/.test(fc));
  const returns = (fc.match(/return \{ forecast: [^}]*leaves/g) ?? []).length;
  // FOUR return sites, counted from the source rather than assumed: stored,
  // never-enumerated, insufficient-history, derived. The first draft said five
  // and the check caught it — which is the whole reason it is an exact count.
  check('WIRING: every resolveFromStore return carries leaves', returns === 4, `${returns}`);
  check('WIRING: a STORED forecast returns NO leaves',
    fc.includes('return { forecast: stored, reason: null, leaves: [] };'),
    'a fitted aggregate is not the sum of its leaves — weighting by them is a second wrong denominator');
  check('WIRING: App widened resolveForecast to carry them', app.includes('leaves: BaseForecast[];'));
  // Two claims, two checks. This was ONE literal spanning the call and the
  // dependency array, and it broke the moment the memo grew a guard — a check
  // that fails for a reason it does not name costs more than it is worth.
  check('WIRING: the card resolves the VIEW\'s leaves through the shared seam',
    wi.includes('}, resolveForecast).leaves ?? [];'),
    'building a cohort key inline here would fork the definition the pin protects');
  check('WIRING: with the VIEW\'s own dims, not an event\'s',
    wi.includes('segment: cohortScope.seg,'));
  // The seam is declared non-optional on the context and is absent from at
  // least one mounted provider (override-arpu-spec). This memo runs at mount,
  // so without the guard the card crashes there. Deleting the guard "because
  // the type says it cannot be undefined" is the exact move that fails.
  check('WIRING: and declines rather than crashing when the seam is absent',
    wi.includes("if (typeof resolveForecast !== 'function') return [];"),
    'the type claims non-optional; a mounted provider disproves it');
  check('WIRING: and the memo depends on them',
    wi.includes('wiMetricCol, wiInflowVal, wiOutflowVal, wiRetentionVal, viewLeafForecasts]);'));
}

console.log(`aggregate-reconciliation spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
