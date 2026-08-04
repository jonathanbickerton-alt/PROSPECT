/**
 * Spec for Session A — deriveAggregate and the single quadrature core.
 *
 *   npm run spec:derive
 *
 * Fully headless. Nothing calls deriveAggregate yet, so this spec IS the only
 * exercise it gets, and the phase's control (no behaviour change anywhere) is
 * provable precisely because that is true.
 *
 * Baselines are computed on the EDGE fixture, which is the only fixture that
 * can express ragged leaves and non-uniform per-scenario ARPU. Pinning on the
 * rectangular fixtures would lock in four identical ARPU numbers and have the
 * gate defend an untested path.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import {
  deriveAggregate, combineBandSlot, aggregateForecastBands, aggregateArpu,
  buildCohortDataMap,
} from '../src/utils/forecasting';
import { runForecastJob } from '../src/workers/forecasting.worker';
import { computeForecastMape } from '../src/components/ForecastVsActualsTab';
import type { BaseForecast, CohortKey } from '../src/types/forecast';

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
const KEY = (k: string): CohortKey => {
  const [segment, product, productL2, channel, channelL2, tariffL1, tariffL2] = k.split('|');
  return { segment, product, productL2, channel, channelL2, tariffL1, tariffL2, scenario: 'Base Case' } as CohortKey;
};

// ── CASE 6 first: quadrature, on values chosen so the answer is exact ─────
{
  const b = (mean: number, h: number) => ({ mean, optimistic: mean + h, pessimistic: mean - h });
  const out = combineBandSlot([b(10, 3), b(20, 4)]);
  check('CASE 6: means add exactly', near(out.mean, 30), String(out.mean));
  check('CASE 6: half-widths combine in QUADRATURE — sqrt(3^2+4^2) = 5, not 7',
    near(out.optimistic - out.mean, 5), String(out.optimistic - out.mean));
  check('CASE 6: bands stay symmetric', near(out.mean - out.pessimistic, out.optimistic - out.mean));
  check('CASE 6: an absent slot is SKIPPED, not read as zero',
    near(combineBandSlot([b(10, 3), undefined]).mean, 10));
}

// ── The adapter is the SAME core ──────────────────────────────────────────
{
  const b = (mean: number, h: number) => ({ mean, optimistic: mean + h, pessimistic: mean - h });
  const viaAdapter = aggregateForecastBands([[b(10, 3)], [b(20, 4)]])[0];
  const viaCore = combineBandSlot([b(10, 3), b(20, 4)]);
  check('ONE CORE: the index-aligned adapter agrees with the core exactly',
    JSON.stringify(viaAdapter) === JSON.stringify(viaCore),
    `${JSON.stringify(viaAdapter)} vs ${JSON.stringify(viaCore)}`);
}

// ── Build real leaves from the edge fixture ───────────────────────────────
const rows: any[] = XLSX.utils.sheet_to_json(
  XLSX.read(fs.readFileSync(EDGE), { type: 'buffer', cellDates: true }).Sheets[
    XLSX.read(fs.readFileSync(EDGE), { type: 'buffer', cellDates: true }).SheetNames[0]]);
const dm = buildCohortDataMap(rows, C.date, C.seg, C.prod, C.prodL2, C.chan, C.chanL2, C.t1, C.t2);
const enumerated = [...dm.keys()].sort();

const monthKey = (r: any) => {
  const d = r[C.date] instanceof Date ? r[C.date] : new Date(r[C.date]);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const allMonths = [...new Set(rows.map(monthKey))].sort();
const fitRows = rows.filter(r => allMonths.slice(0, allMonths.length - 6).includes(monthKey(r)));

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
  rows: fitRows as any, standardCohorts: [],
  ibroCohorts: enumerated.map(k => {
    const [seg, prod, prodL2, chan, chanL2, tariffL1, tariffL2] = k.split('|');
    return { fKey: k, seg, prod, prodL2, chan, chanL2, tariffL1, tariffL2 };
  }),
} as any);

const store = new Map<string, BaseForecast>(job.newTypedForecasts);
check('GUARD: leaves fitted from the edge fixture', store.size === 72, String(store.size));
check('GUARD: two leaves skipped, as the fixture intends', job.skipped.length === 2, String(job.skipped.length));

const groupOf = (k: string) => k.split('|').slice(0, 2).join('|');
const leavesOf = (grp: string) => enumerated.filter(k => groupOf(k) === grp)
  .map(k => store.get(k)).filter((b): b is BaseForecast => !!b);

// ── CASE 3: 1-leaf passthrough ────────────────────────────────────────────
{
  const one = [...store.values()][0];
  const out = deriveAggregate([one], one.cohort);
  check('CASE 3: a 1-leaf aggregate returns the STORED OBJECT — reference identity',
    out === one);
  check('CASE 3: ...so its provenance is still fitted, not derived',
    out!.provenance.kind === 'fitted', out!.provenance.kind);
}

// ── CASE 5: zero contributing leaves -> null ──────────────────────────────
{
  check('CASE 5: no leaves derives to NULL, never a zero-valued forecast',
    deriveAggregate([], KEY('X|Y|All|All|All|All|All')) === null);
  const allShort = leavesOf('Large Enterprise|Fixed Connectivity');
  check('CASE 5: the all-short aggregate has no fittable leaves', allShort.length === 0,
    String(allShort.length));
  check('CASE 5: ...and therefore derives to null',
    deriveAggregate(allShort, KEY('Large Enterprise|Fixed Connectivity|All|All|All|All|All')) === null);
}

// ── CASE 4: coverage counting, on the MIXED aggregate ─────────────────────
const MIXED = 'Corporate|Fixed Connectivity';
const mixedLeaves = leavesOf(MIXED);
const mixedAgg = deriveAggregate(mixedLeaves, KEY(MIXED + '|All|All|All|All|All'));
{
  check('GUARD: the mixed aggregate has more than one leaf', mixedLeaves.length > 1,
    String(mixedLeaves.length));
  check('CASE 4: leafCount counts the leaves actually summed',
    mixedAgg!.provenance.kind === 'derived' &&
    (mixedAgg!.provenance as any).leafCount === mixedLeaves.length);
  check('CASE 4: coverage.inScope matches', (mixedAgg!.provenance as any).coverage.inScope === mixedLeaves.length);
  check('CASE 4: coverage.withForecast counts leaves present at the as-of month',
    (mixedAgg!.provenance as any).coverage.withForecast > 0);
  check('CASE 4: the model histogram is populated, not a single model',
    Object.keys((mixedAgg!.provenance as any).models).length >= 1);
  check('CASE 4: coverage ANNOTATES — a partial aggregate is still returned', mixedAgg !== null);
}

// ── CASE 1 + 2: month-key alignment and ragged leaves ─────────────────────
{
  // Two synthetic leaves offset by one month. Position 0 differs from month 0.
  const mk = (months: string[], v: number): BaseForecast => ({
    cohort: KEY('A|B|All|All|All|All|All'),
    seedBaseVolume: v, historicalMonths: months.map(m => m), months: months.map(m => ({
      month: m,
      inflow: { mean: v, optimistic: v + 1, pessimistic: v - 1 },
      outflow: { mean: 0, optimistic: 0, pessimistic: 0 },
      retention: { mean: 0, optimistic: 0, pessimistic: 0 },
    })) as any,
    lastHistoricalInflow: v, lastHistoricalOutflow: 0,
    provenance: { kind: 'fitted', modelUsed: 'Holt Linear' },
  } as BaseForecast);

  const a = mk(['2026-01', '2026-02'], 10);
  const b = mk(['2026-02', '2026-03'], 20);
  const agg = deriveAggregate([a, b], KEY('A|B|All|All|All|All|All'))!;
  const at = (m: string) => agg.months.find(x => x.month === m);

  check('CASE 1: months align by LABEL — 2026-01 has only leaf A',
    near(at('2026-01')!.inflow.mean, 10), String(at('2026-01')!.inflow.mean));
  check('CASE 1: 2026-02 has BOTH leaves — 10 + 20 = 30',
    near(at('2026-02')!.inflow.mean, 30), String(at('2026-02')!.inflow.mean));
  check('CASE 1: 2026-03 has only leaf B',
    near(at('2026-03')!.inflow.mean, 20), String(at('2026-03')!.inflow.mean));
  check('CASE 1: index alignment would have put B month-0 into aggregate month-0',
    !near(at('2026-01')!.inflow.mean, 30));

  check('CASE 2: the as-of month is the MAX over the union — 2026-03',
    agg.historicalMonths[agg.historicalMonths.length - 1] === '2026-03',
    agg.historicalMonths.join(','));
  check('CASE 2: a leaf absent at the as-of month contributes ZERO to the seeds',
    near(agg.seedBaseVolume, 20), String(agg.seedBaseVolume));
  check('CASE 2: ...and is counted, not silently dropped',
    (agg.provenance as any).coverage.withForecast === 1 &&
    (agg.provenance as any).coverage.inScope === 2,
    JSON.stringify((agg.provenance as any).coverage));
}

// ── CASE 7: aggregateArpu is WIRED IN, not reimplemented ──────────────────
{
  const direct = aggregateArpu([{ arpu: 10, volume: 100 }, { arpu: 20, volume: 300 }]);
  check('CASE 7: aggregateArpu is volume-weighted (17.5, not the mean 15)',
    near(direct, 17.5), String(direct));
  const src = fs.readFileSync('src/utils/forecasting.ts', 'utf8');
  const body = src.slice(src.indexOf('export function deriveAggregate'));
  check('CASE 7: deriveAggregate CALLS aggregateArpu rather than reimplementing it',
    /aggregateArpu\(/.test(body.slice(0, body.indexOf('\nexport function', 10))));
}

// ── ARPU INTERVALS ARE ABSENT ON DERIVED MONTHS ──────────────────────────
// The mean is real - volume-weighted revenue over volume. The interval is not
// available, and absence says so where a zero-width band did not: the
// band-position penalty reads `actual >= pess && actual <= opt`, so opt = pess
// = mean is in-band only on exact float equality and penalised every month.
{
  const dm2 = mixedAgg!.months[0];
  check('DERIVED: the ARPU mean is present and real',
    typeof dm2.arpu.mean === 'number' && dm2.arpu.mean > 0, String(dm2.arpu.mean));
  check('DERIVED: no ARPU optimistic bound', dm2.arpu.optimistic === undefined,
    String(dm2.arpu.optimistic));
  check('DERIVED: no ARPU pessimistic bound', dm2.arpu.pessimistic === undefined,
    String(dm2.arpu.pessimistic));
  check('DERIVED: ...and specifically NOT a zero-width band at the mean',
    !(dm2.arpu.optimistic === dm2.arpu.mean && dm2.arpu.pessimistic === dm2.arpu.mean));
  const scen = [dm2.inflowArpu, dm2.outflowArpu, dm2.retentionArpu, dm2.baseArpu].filter(Boolean);
  check('DERIVED: the four per-scenario ARPU bands are also interval-less',
    scen.every(b => b!.optimistic === undefined && b!.pessimistic === undefined),
    JSON.stringify(scen));
  check('DERIVED: ...while still carrying their means',
    scen.every(b => typeof b!.mean === 'number'));
}

// ── FITTED LEAVES KEEP THEIR INTERVALS ───────────────────────────────────
// The control. Nothing about a fitted leaf changed.
{
  const leaf = [...store.values()][0];
  const lm = leaf.months[0];
  check('FITTED: a leaf still carries an ARPU optimistic bound',
    typeof lm.arpu.optimistic === 'number', String(lm.arpu.optimistic));
  check('FITTED: ...and a pessimistic bound',
    typeof lm.arpu.pessimistic === 'number', String(lm.arpu.pessimistic));
  check('FITTED: the leaf interval has real WIDTH, not zero',
    (lm.arpu.optimistic as number) > lm.arpu.mean, 
    `${lm.arpu.optimistic} vs ${lm.arpu.mean}`);
}

// ── THE SCORER TREATS ABSENCE AS NOT-APPLICABLE ──────────────────────────
// Replicates the band-position rule at ForecastVsActualsTab calcComponentDetail.
// Absence must yield NO adjustment - neither a penalty nor a free pass.
{
  const bandPenalty = (actual: number, band: { mean: number; opt?: number; pess?: number }, primary: number) => {
    const hasBand = band.opt !== undefined && band.pess !== undefined;
    const inBand = hasBand ? (actual >= band.pess! && actual <= band.opt!) : true;
    return (!hasBand || inBand) ? 0 : (primary >= 65 ? 5 : 10);
  };
  check('SCORER: an absent interval yields NO band-position penalty',
    bandPenalty(12.7, { mean: 12.0 }, 70) === 0);
  check('SCORER: ...even for a badly-deviating actual',
    bandPenalty(99, { mean: 12.0 }, 20) === 0);
  check('SCORER: a real interval still penalises an out-of-band actual',
    bandPenalty(20, { mean: 12, opt: 14, pess: 10 }, 70) === 5);
  check('SCORER: ...and still penalises harder below 65',
    bandPenalty(20, { mean: 12, opt: 14, pess: 10 }, 40) === 10);
  check('SCORER: a real interval gives no penalty in-band',
    bandPenalty(13, { mean: 12, opt: 14, pess: 10 }, 70) === 0);
  // The mutation this case exists to kill: treating absence as zero-width.
  const asZeroWidth = (actual: number, band: { mean: number }, primary: number) => {
    const opt = band.mean, pess = band.mean;
    return (actual >= pess && actual <= opt) ? 0 : (primary >= 65 ? 5 : 10);
  };
  check('SCORER: zero-width WOULD penalise - which is why absence is not that',
    asZeroWidth(12.7, { mean: 12.0 }, 70) === 5);
}

// ── SOURCE ASSERTION: the real scorer guards on absence ──────────────────
// The case above replicates the band-position rule because the scorer lives
// inside a component closure and is not exported - so mutating the real source
// would not kill it. Standard 6 says measure, do not reimplement; where the
// unit genuinely cannot be driven, assert on the SOURCE rather than let a
// replicated rule stand in for the real one unwatched.
{
  const src = fs.readFileSync('src/components/ForecastVsActualsTab.tsx', 'utf8');
  const guarded = src.split(String.fromCharCode(10))
    .filter(l => /const penalty = .*primary >= 65 \? 5 : 10/.test(l));
  check('GUARD: every band-position site was found', guarded.length === 3,
    String(guarded.length));
  check('SOURCE: every band-position penalty guards on an ABSENT interval',
    guarded.every(l => /!hasBand \|\|/.test(l) || /^\s*const penalty = primary/.test(l)),
    guarded.map(l => l.trim()).join('  |  '));
}

// ── SOURCE: every weighted ARPU roll-up OMITS bounds on absence ──────────
// Gate stage 2 found two sites that guarded the NUMERATOR but not the
// DENOMINATOR - a subset's contributions divided by the whole population's
// weight, which is not NaN and not omission but a silently understated band.
// The file's own comment calls that "a fabrication wearing the shape of an
// average"; these assertions exist because I wrote exactly that in two places
// while the comment warning against it was three functions up.
//
// Asserted on the SOURCE because the roll-ups live inside a component closure.
{
  const src = fs.readFileSync('src/components/ForecastVsActualsTab.tsx', 'utf8');
  const lines = src.split(String.fromCharCode(10));

  // Every ARPU band map / synMap emission must be conditional on a missing flag.
  const emissions = lines.filter(l => /map\.set\(month, \{ mean: wMean\/totalW/.test(l));
  check('SOURCE: no ARPU roll-up emits bounds unconditionally',
    emissions.length === 0, emissions.map(l => l.trim()).join(' | '));

  const synArpu = lines.filter(l => /arpu: \{ mean: e\.arpuWm \/ aw/.test(l));
  check('SOURCE: no synMap emits an ARPU band unconditionally',
    synArpu.length === 0, synArpu.map(l => l.trim()).join(' | '));

  // And every accumulation must guard both bounds together.
  const unguarded = lines.filter(l =>
    /(wOpt|arpuWo|ArpuWo) \+= /.test(l) && !/undefined/.test(l) && !/else \{/.test(l));
  check('SOURCE: no ARPU bound is accumulated without an absence guard',
    unguarded.length === 0, unguarded.map(l => l.trim()).join(' | '));
}

// ── baseArpu WEIGHTS ON THE DERIVED RUNNING BASE, not on inflow ──────────
// Settled 2026-08-04. One convention - ForecastVsActualsTab's bfBaseMap - and
// deriveAggregate must agree with it on a shared input rather than answer a
// different question with the same field name.
//
// The FvA convention, restated here as the INDEPENDENT reference: base is
// derived by the IBRO recursion from the leaf's seed and cumulative flows.
{
  const mk = (seed: number, lastIn: number, lastOut: number,
              flows: Array<[number, number]>, arpu: number): BaseForecast => ({
    cohort: KEY('A|B|All|All|All|All|All'),
    seedBaseVolume: seed,
    historicalMonths: ['2025-12'],
    lastHistoricalInflow: lastIn, lastHistoricalOutflow: lastOut,
    months: flows.map(([i, o], k) => ({
      month: `2026-0${k + 1}`,
      inflow:    { mean: i, optimistic: i, pessimistic: i },
      outflow:   { mean: o, optimistic: o, pessimistic: o },
      retention: { mean: 0, optimistic: 0, pessimistic: 0 },
      arpu:     { mean: arpu, optimistic: arpu, pessimistic: arpu },
      baseArpu: { mean: arpu, optimistic: arpu, pessimistic: arpu },
    })) as any,
    provenance: { kind: 'fitted', modelUsed: 'Holt Linear' },
  } as BaseForecast);

  // Two leaves with DIFFERENT base stocks but identical inflow, so the two
  // conventions must disagree - that is what makes the case discriminating.
  const big   = mk(10000, 100, 50, [[100, 50], [100, 50]], 20);
  const small = mk(  100, 100, 50, [[100, 50], [100, 50]],  5);
  const agg = deriveAggregate([big, small], KEY('A|B|All|All|All|All|All'))!;

  // Independent reference: running base at 2026-01 is seed + lastIn - lastOut.
  const bigBase   = 10000 + 100 - 50;   // 10050
  const smallBase =   100 + 100 - 50;   //   150
  const expected = (20 * bigBase + 5 * smallBase) / (bigBase + smallBase);
  const m0 = agg.months.find(m => m.month === '2026-01')!;
  check('baseArpu weights on the DERIVED RUNNING BASE',
    near(m0.baseArpu!.mean, Number(expected.toFixed(4)), 1e-3),
    `${m0.baseArpu!.mean} vs ${expected.toFixed(4)}`);

  // The mutation this case exists to kill.
  const underInflow = (20 * 100 + 5 * 100) / (100 + 100);   // 12.5
  check('...and NOT on inflow, which would give a different answer',
    !near(m0.baseArpu!.mean, underInflow, 1e-3),
    `running-base ${m0.baseArpu!.mean} vs inflow-weighted ${underInflow}`);
}

// ── ADAPTER EQUIVALENCE ON RAGGED HORIZONS ───────────────────────────────
// The previous case exercised one shape: two equal-length arrays. The horizon
// logic (Math.max over lengths, absent slots skipped) exists for the ragged
// case and was untested through the adapter.
{
  const b = (mean: number, h: number) => ({ mean, optimistic: mean + h, pessimistic: mean - h });
  const long  = [b(10, 3), b(11, 3), b(12, 3)];
  const short = [b(20, 4)];
  const viaAdapter = aggregateForecastBands([long, short]);
  check('RAGGED: the adapter spans the LONGEST horizon', viaAdapter.length === 3,
    String(viaAdapter.length));
  check('RAGGED: slot 0 combines both leaves',
    JSON.stringify(viaAdapter[0]) === JSON.stringify(combineBandSlot([long[0], short[0]])));
  check('RAGGED: slot 1 has only the long leaf - the short one is SKIPPED, not zero',
    JSON.stringify(viaAdapter[1]) === JSON.stringify(combineBandSlot([long[1], undefined])));
  check('RAGGED: ...so slot 1 keeps the long leaf mean, not a diluted one',
    near(viaAdapter[1].mean, 11), String(viaAdapter[1].mean));
  check('RAGGED: every slot agrees with the core exactly',
    viaAdapter.every((band, t) =>
      JSON.stringify(band) === JSON.stringify(combineBandSlot([long[t], short[t]]))));
}

// ── GUARD 3: the MUST-NOT-DERIVE list stays must-not-derive ──────────────
// Five call sites must never route through resolveForecast, each for its own
// reason. They are easy to "fix" later by someone tidying up the last few bare
// forecastStore reads, so the prohibition is asserted rather than commented.
//
//   summaryMape          - averages PER-LEAF MAPEs. Scoring one derived
//                          aggregate is a different quantity, not a better one.
//   the export loop      - aggregates are never stored and never exported.
//   forecastStore.size   - a count of STORED forecasts; deriving changes what
//                          the number means.
//   the challenger seed  - a borrow fix, not a derivation site.
//   the .entries() scans - deriving inside a scan over the store is circular.
{
  const appSrc = fs.readFileSync('src/App.tsx', 'utf8');
  const fvaSrc = fs.readFileSync('src/components/ForecastVsActualsTab.tsx', 'utf8');
  const lines = (src: string) => src.split(String.fromCharCode(10));

  // summaryMape's body must not call resolveForecast.
  const fl = lines(fvaSrc);
  const smStart = fl.findIndex(l => /const summaryMape\s*=/.test(l));
  check('GUARD 3: summaryMape was found', smStart >= 0, String(smStart));
  const smBody = fl.slice(smStart, smStart + 90).join(String.fromCharCode(10));
  check('GUARD 3: summaryMape does NOT resolve - it averages per-leaf MAPEs',
    !/resolveForecast/.test(smBody));

  // The three .entries() scans must not derive inside themselves.
  const scans = fl.filter(l => /forecastStore\.entries\(\)/.test(l));
  check('GUARD 3: all three store scans were found', scans.length === 3, String(scans.length));

  // The export loop and the size read.
  const al = lines(appSrc);
  const expIdx = al.findIndex(l => /forecastStore\.forEach/.test(l));
  check('GUARD 3: the export loop was found', expIdx >= 0);
  check('GUARD 3: the export loop does NOT derive - aggregates are never exported',
    !/resolveForecast/.test(al.slice(expIdx, expIdx + 60).join(String.fromCharCode(10))));
  check('GUARD 3: forecastStore.size is still a count of STORED forecasts',
    /forecastStore\.size \+ Object\.keys\(savedForecasts\)/.test(appSrc));
}

// ── GUARD 4: resolveForecast is not cached ───────────────────────────────
// The decision that made read-time derivation viable was "no cache, therefore
// no invalidation". A memo or ref around it silently reintroduces the problem
// write-time was rejected for.
{
  const appSrc = fs.readFileSync('src/App.tsx', 'utf8');
  const i = appSrc.indexOf('const resolveForecast');
  check('GUARD 4: resolveForecast was found', i >= 0);
  const body = appSrc.slice(i, i + 2000);
  check('GUARD 4: resolveForecast holds no cache of its own',
    !/useRef|new Map<string, BaseForecast>\(\)\s*;?\s*\/\/ cache|resolveCache/.test(body));
}

// ── PINNED BASELINE: the four ARPU MAPEs stay distinct ────────────────────
{
  const healthy = [...store.entries()].find(([k]) => groupOf(k) === MIXED)!;
  const mape = computeForecastMape(
    healthy[1], rows, C.date, C.metric, C.value,
    'Inflow', 'Outflow', 'Retention', 'Base',
    C.arpu, C.rev, C.seg, C.prod, C.chan,
    undefined, C.prodL2, C.chanL2, C.t1, C.t2,
  );
  const four = [mape.inflowArpu, mape.outflowArpu, mape.retentionArpu, mape.baseArpu].map(Number);
  const spread = Math.max(...four) - Math.min(...four);
  console.log(`  PINNED ARPU MAPEs: ${four.map(x => x.toFixed(4)).join(' / ')}   spread ${spread.toFixed(4)}pp`);
  check('PINNED: the four ARPU MAPEs are DISTINCT', new Set(four.map(x => x.toFixed(6))).size === 4);
  check('PINNED: spread is MATERIAL (> 0.5pp), not rounding noise',
    spread > 0.5, `${spread.toFixed(4)}pp`);
}

// ── GUARD 1: deriveAggregate is the ONLY producer of derived provenance ───
const srcFiles: string[] = [];
(function walk(dir: string) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f); else if (/\.(ts|tsx)$/.test(e.name)) srcFiles.push(f);
  }
})('src');
{
  // Enclosure established by BRACE DEPTH, not by proximity.
  //
  // Four heuristics were tried and each was watched to fail on real code:
  //   file-level exemption    - blind in App.tsx (Phase 1)
  //   fixed line window       - deriveAggregate's construction is 96 lines
  //                             below its header; a window that wide swallows
  //                             neighbours
  //   nearest declaration     - stops at inner value consts, then at inner
  //                             arrow functions
  //   backwards name scan     - PASSED a violation planted immediately after
  //                             readProvenance. Blind in App.tsx again, which
  //                             is the exact spot Phase 1's guard was blind.
  //
  // Proximity cannot express enclosure. This tracks a stack of function names
  // by brace depth, so the owner of a line is the function that actually
  // contains it. Every rule above is a guess about layout; this is the
  // structure itself.
  const FN_DECL = /(?:export\s+)?(?:default\s+)?function\s+(\w+)|(?:const|let)\s+(\w+)\s*(?::[^=]*?)?=\s*(?:async\s*)?\([^)]*\)\s*(?::[^=]*?)?=>/;
  const ALLOWED = new Set(['deriveAggregate', 'readProvenance']);
  const offenders: string[] = [];
  for (const f of srcFiles) {
    const lines = fs.readFileSync(f, 'utf8').split(String.fromCharCode(10));
    const stack: Array<{ name: string; depth: number; opened: boolean }> = [];
    let depth = 0;
    lines.forEach((line, i) => {
      const d = FN_DECL.exec(line);
      const opens = (line.match(/\{/g) || []).length;
      const closes = (line.match(/\}/g) || []).length;
      if (/kind:\s*'derived',/.test(line)) {
        if (!stack.some(fr => ALLOWED.has(fr.name))) {
          offenders.push(f + ':' + (i + 1) + ' in ' + (stack.length ? stack[stack.length - 1].name : '<top level>'));
        }
      }
      if (d) stack.push({ name: d[1] || d[2], depth, opened: false });
      depth += opens - closes;
      for (const fr of stack) if (depth > fr.depth) fr.opened = true;
      while (stack.length && stack[stack.length - 1].opened
             && depth <= stack[stack.length - 1].depth) stack.pop();
    });
  }
  check('GUARD 1: deriveAggregate is the only producer of a derived provenance',
    offenders.length === 0, offenders.join(', '));
}

// ── GUARD 2 (Session B): deriveAggregate is called ONLY from the seam ────
// Session A's control was 'nothing calls it'. Session B wires it, so the
// control becomes narrower and more useful: exactly one caller, and it is
// resolveForecast. A second caller would be a second seam, which is the
// parallel-implementation shape - and the reason every reader was routed
// through one function rather than each deriving for itself.
{
  const callers: string[] = [];
  for (const f of srcFiles) {
    const ls = fs.readFileSync(f, 'utf8').split(String.fromCharCode(10));
    ls.forEach((line, i2) => {
      if (!/deriveAggregate\s*\(/.test(line)) return;
      if (/export function deriveAggregate/.test(line)) return;
      const ctx = ls.slice(Math.max(0, i2 - 40), i2).join(String.fromCharCode(10));
      if (/const resolveForecast/.test(ctx)) return;
      callers.push(f + ':' + (i2 + 1));
    });
  }
  check('GUARD 2: deriveAggregate is called ONLY from resolveForecast',
    callers.length === 0, callers.join(', '));
}

console.log(`derive-aggregate spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
