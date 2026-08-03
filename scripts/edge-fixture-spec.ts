/**
 * Spec for the EDGE-CASE fixture — proves the two properties it exists to have.
 *
 *   npm run spec:edge
 *
 * A fixture that CLAIMS to reach a branch is worth nothing. This drives the real
 * enumeration, the real `classifySkip`, the real `runForecastJob` and the real
 * `computeForecastMape` over the file and asserts the branches are reached and
 * the numbers actually differ.
 *
 * The second half is the vacuity check for the vacuity fix: the whole reason the
 * per-scenario prices were introduced is that the existing fixtures produce four
 * IDENTICAL ARPU MAPEs, so a fixture claiming to fix that must be made to
 * demonstrate four DIFFERENT ones.
 */
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { buildCohortDataMap, classifySkip } from '../src/utils/forecasting';
import { runForecastJob } from '../src/workers/forecasting.worker';
import { computeForecastMape } from '../src/components/ForecastVsActualsTab';

const EDGE = 'test-data/VBU_IBRO_EdgeCases_ShortHistory_PerScenarioARPU_Jan2023_Jun2026.xlsx';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

const C = {
  date: 'Month', metric: 'IBRO_Scenario_Type', value: 'Subscriber_Volume',
  seg: 'Customer_Segment', prod: 'Product_L1', prodL2: 'Product_L2_Value_Tier',
  chan: 'Channel_Level_1', chanL2: 'Channel_Level_2',
  t1: 'tariff_tier_l1', t2: 'tariff_tier_l2',
  arpu: 'Avg_Unit_Price_GBP', rev: 'Monthly_Revenue_GBP',
};
const VAL = { inflow: 'Inflow', outflow: 'Outflow', retention: 'Retention', base: 'Base' };

check('the edge fixture exists', fs.existsSync(EDGE), EDGE);
if (!fs.existsSync(EDGE)) { console.log('run `npm run build:trimmed-fixture` first'); process.exit(1); }

const rows: any[] = XLSX.utils.sheet_to_json(
  XLSX.read(fs.readFileSync(EDGE), { type: 'buffer', cellDates: true }).Sheets[
    XLSX.read(fs.readFileSync(EDGE), { type: 'buffer', cellDates: true }).SheetNames[0]]);
console.log(`${EDGE}\n  rows: ${rows.length}`);

// ── PROPERTY 1: short history reaches the skip branch ─────────────────────
// Enumeration replicated from App.tsx:3488 — every distinct 7-part tuple in any
// row, no metric/volume/month filter.
const dm = buildCohortDataMap(rows, C.date, C.seg, C.prod, C.prodL2, C.chan, C.chanL2, C.t1, C.t2);
// Buckets restricted to the fitting window, for the classifySkip cross-check.
const enumerated = [...dm.keys()].sort();
console.log(`  leaves enumerated: ${enumerated.length}`);

const cfg = {
  wiDateCol: C.date, wiMetricCol: C.metric, wiValueCol: C.value,
  wiSegmentCol: C.seg, wiProductCol: C.prod, wiProductL2Col: C.prodL2,
  wiChannelCol: C.chan, wiChannelL2Col: C.chanL2, wiTariffL1Col: C.t1, wiTariffL2Col: C.t2,
  wiInflowVal: VAL.inflow, wiOutflowVal: VAL.outflow, wiBaseVal: VAL.base, wiRetentionVal: VAL.retention,
  wiArpuCol: C.arpu, wiRevenueCol: C.rev,
  genLength: 12, runPreUnc: 1.28, runPostExp: 0.02, runConfHor: 3,
  runModel: 'Holt Linear' as const, autoModel: false, autoConfidence: false, oneOffMonths: {},
};

// FIT on the file minus its last 6 months, SCORE against the whole file. This
// is the app's own workflow (generate on an earlier dataset, import later
// actuals) and it is what the Dec2025/Jun2026 fixture pair exists to represent.
// Withholding months is not fabricating values - every number scored is one the
// fixture already contains.
const monthKey = (r: any) => {
  const d = r[C.date] instanceof Date ? r[C.date] : new Date(r[C.date]);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const allMonths = [...new Set(rows.map(monthKey))].sort();
const HOLDBACK = 6;
const fitMonths = new Set(allMonths.slice(0, allMonths.length - HOLDBACK));
const fitRows = rows.filter(r => fitMonths.has(monthKey(r)));
console.log(`  fit on ${fitMonths.size} months, holding back ${HOLDBACK} for scoring`);

const job = runForecastJob({
  workerId: 0, config: cfg, rows: fitRows as any, standardCohorts: [],
  ibroCohorts: enumerated.map(k => {
    const [seg, prod, prodL2, chan, chanL2, tariffL1, tariffL2] = k.split('|');
    return { fKey: k, seg, prod, prodL2, chan, chanL2, tariffL1, tariffL2 };
  }),
} as any);

console.log(`  typed forecasts: ${job.newTypedForecasts.length}   skipped: ${job.skipped.length}`);
for (const s of job.skipped) console.log(`    SKIPPED  ${s.fKey}  ${s.reason}`);

check('the skip list is NON-EMPTY — the branch is actually reached',
  job.skipped.length > 0, `${job.skipped.length} skipped`);
check('every skipped entry is NAMED with a real enumerated key',
  job.skipped.every(s => enumerated.includes(s.fKey)),
  JSON.stringify(job.skipped.map(s => s.fKey)));
check('every skipped entry carries insufficient-history',
  job.skipped.every(s => s.reason === 'insufficient-history'),
  JSON.stringify(job.skipped.map(s => s.reason)));
check('healthy leaves still fit — the truncation is targeted, not global',
  job.newTypedForecasts.length > 0 && job.newTypedForecasts.length === enumerated.length - job.skipped.length,
  `${job.newTypedForecasts.length} fitted of ${enumerated.length}`);

// classifySkip agrees with the worker, driven directly on the same buckets.
for (const s of job.skipped) {
  const fitBucket = fitRows.filter(r => [C.seg, C.prod, C.prodL2, C.chan, C.chanL2, C.t1, C.t2]
    .map(k => String(r[k] ?? '').trim()).join('|') === s.fKey);
  check(`classifySkip agrees for ${s.fKey.split('|').slice(0, 2).join('|')}`,
    classifySkip(fitBucket, null) === s.reason);
}

// The two required SHAPES, from the fitted/skipped split rather than the builder's claim.
const groupOf = (k: string) => k.split('|').slice(0, 2).join('|');
const skippedKeys = new Set(job.skipped.map(s => s.fKey));
const groups = new Map<string, { total: number; short: number }>();
for (const k of enumerated) {
  const g = groupOf(k);
  if (!groups.has(g)) groups.set(g, { total: 0, short: 0 });
  const e = groups.get(g)!;
  e.total++; if (skippedKeys.has(k)) e.short++;
}
const mixed = [...groups.entries()].filter(([, e]) => e.short > 0 && e.short < e.total);
const allShort = [...groups.entries()].filter(([, e]) => e.short > 0 && e.short === e.total);
check('at least one aggregate MIXES short and healthy leaves',
  mixed.length > 0, JSON.stringify(mixed.map(([g, e]) => `${g} ${e.short}/${e.total}`)));
check('at least one aggregate has ONLY short leaves',
  allShort.length > 0, JSON.stringify(allShort.map(([g, e]) => `${g} ${e.short}/${e.total}`)));

// ── PROPERTY 2: per-scenario prices produce FOUR DIFFERENT ARPU MAPEs ─────
// The vacuity check for the vacuity fix.
const healthy = job.newTypedForecasts.find(([k]) => !skippedKeys.has(k))!;
const [hKey, bf] = healthy;
console.log(`\n  scoring healthy leaf: ${hKey}`);

// Score the fitted forecast against the SAME file's actuals. The forecast months
// run past the data, so this deliberately compares the overlap only — what
// matters here is whether the four values differ, not their level.
const mape = computeForecastMape(
  bf, rows, C.date, C.metric, C.value,
  VAL.inflow, VAL.outflow, VAL.retention, VAL.base,
  C.arpu, C.rev, C.seg, C.prod, C.chan,
  undefined, C.prodL2, C.chanL2, C.t1, C.t2,
);

// Raw per-scenario ARPU straight from the file, for the same leaf — this is the
// property the fixture claims, checked before anything derived from it.
const leafRows = rows.filter(r => [C.seg, C.prod, C.prodL2, C.chan, C.chanL2, C.t1, C.t2]
  .map(k => String(r[k] ?? '').trim()).join('|') === hKey);
const firstMonth = [...new Set(leafRows.map(r => {
  const d = r[C.date] instanceof Date ? r[C.date] : new Date(r[C.date]);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}))].sort()[0];
const priceByScen: Record<string, number> = {};
for (const k of ['Inflow', 'Outflow', 'Retention', 'Base']) {
  const r = leafRows.find(x => {
    const d = x[C.date] instanceof Date ? x[C.date] : new Date(x[C.date]);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === firstMonth
      && String(x[C.metric]).trim() === k;
  });
  if (r) priceByScen[k] = Number((Number(r[C.rev]) || 0) / (Number(r[C.value]) || 1));
}
console.log(`  raw ARPU by scenario, ${firstMonth}: ${JSON.stringify(priceByScen)}`);
const rawVals = Object.values(priceByScen);
check('THE FILE ITSELF carries four DIFFERENT per-scenario ARPUs',
  new Set(rawVals.map(v => v.toFixed(6))).size === 4, JSON.stringify(priceByScen));
check('revenue equals price x volume — the file is internally consistent',
  leafRows.every(r => {
    const v = Number(r[C.value]) || 0, p = Number(r[C.arpu]) || 0, rv = Number(r[C.rev]) || 0;
    return v === 0 || Math.abs(rv - p * v) < 0.02;
  }));

const arpuMapes = [mape.inflowArpu, mape.outflowArpu, mape.retentionArpu, mape.baseArpu];
console.log(`  ARPU MAPEs: ${JSON.stringify(arpuMapes)}`);
console.log(`  volume MAPEs: ${JSON.stringify([mape.inflow, mape.outflow, mape.retention, mape.base])}`);
check('GUARD: the scoring run compared some months', (mape.monthsWithActuals ?? 0) > 0,
  String(mape.monthsWithActuals));
check('GUARD: all four ARPU MAPEs were produced', arpuMapes.every(x => x !== null && x !== undefined),
  JSON.stringify(arpuMapes));
check('THE FOUR ARPU MAPEs ARE DISTINCT — the fixture is non-vacuous',
  new Set(arpuMapes.map(x => Number(x).toFixed(9))).size === 4, JSON.stringify(arpuMapes));

// Distinctness alone is too weak, and this is the trap the fixture already
// fell into once: a LEVEL-only price factor gave four values agreeing to five
// significant figures, distinct only through rounding noise. MAPE is
// scale-invariant, so a constant per-scenario multiplier cannot move it. The
// spread has to be big enough that it could only have come from the four
// trajectories having different SHAPES.
const spread = Math.max(...arpuMapes.map(Number)) - Math.min(...arpuMapes.map(Number));
check('...and the spread is MATERIAL, not rounding noise (> 0.5pp)',
  spread > 0.5, `spread=${spread.toFixed(4)}pp`);

console.log(`\nedge-fixture spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
