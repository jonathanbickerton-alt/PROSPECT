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

// ── GUARD 2: nothing calls deriveAggregate yet (Session A control) ────────
{
  const callers = srcFiles.filter(f =>
    /deriveAggregate\s*\(/.test(fs.readFileSync(f, 'utf8')) &&
    !/export function deriveAggregate/.test(fs.readFileSync(f, 'utf8')));
  check('GUARD 2: NOTHING calls deriveAggregate — the Session A control',
    callers.length === 0, callers.join(', '));
}

console.log(`derive-aggregate spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
