/**
 * THE TWO PANELS' TRIGGER SETS — measured separately, pinned separately.
 *
 *   npm run spec:triggers
 *
 * The accuracy table and the chart answer "does this cohort have a forecast"
 * with DIFFERENT predicates, and a report that pinned one figure as though it
 * described both is what this file exists to prevent repeating.
 *
 *   CHART  (ForecastVsActualsTab.tsx:2054) — one tier:
 *          resolveForecast(key). Null means fabricate (pre-deletion).
 *   TABLE  (:676-730) — two tiers: resolveForecast(key), and if that misses, a
 *          CANDIDATE SCAN over forecastStore for any stored fit whose scope is
 *          contained by this row's, under the view's group-by dims.
 *
 * So the table's trigger set is a SUBSET of the chart's: every key where tier 1
 * misses AND tier 2 also finds nothing. The difference between them - keys where
 * tier 1 misses and tier 2 HITS - is the set where the table scores a row using
 * a forecast fitted to a DIFFERENT SCOPE. That set is measured and printed here
 * with what it borrowed, because deleting the scan depends on it being empty.
 *
 * The scan loop below is transcribed from the source and calls the REAL exported
 * predicates (`cohortInScope`, `dimsFromGrouping`); `buildCohortAccuracy` is
 * module-private and cannot be driven. Declared, not passed off as behaviour.
 */
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { buildCohortDataMap, buildRollUpIndex, deriveAggregate, makeForecastKey } from '../src/utils/forecasting';
import { cohortInScope, dimsFromGrouping } from '../src/utils/cohortScope';
import { runForecastJob } from '../src/workers/forecasting.worker';
import type { BaseForecast } from '../src/types/forecast';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

const C = { date: 'Month', metric: 'IBRO_Scenario_Type', value: 'Subscriber_Volume',
  seg: 'Customer_Segment', prod: 'Product_L1', prodL2: 'Product_L2_Value_Tier',
  chan: 'Channel_Level_1', chanL2: 'Channel_Level_2',
  t1: 'tariff_tier_l1', t2: 'tariff_tier_l2', arpu: 'Avg_Unit_Price_GBP', rev: 'Monthly_Revenue_GBP' };

const read = (f: string): any[] => {
  const wb = XLSX.read(fs.readFileSync(f), { type: 'buffer', cellDates: true });
  const sheet = wb.SheetNames.find(n => n.toLowerCase() === 'actuals') || wb.SheetNames[0];
  return XLSX.utils.sheet_to_json(wb.Sheets[sheet]);
};

function build(rows: any[]) {
  const dm = buildCohortDataMap(rows, C.date, C.seg, C.prod, C.prodL2, C.chan, C.chanL2, C.t1, C.t2);
  const enumerated = [...dm.keys()];
  const job = runForecastJob({
    workerId: 0,
    config: { wiDateCol: C.date, wiMetricCol: C.metric, wiValueCol: C.value,
      wiSegmentCol: C.seg, wiProductCol: C.prod, wiProductL2Col: C.prodL2,
      wiChannelCol: C.chan, wiChannelL2Col: C.chanL2, wiTariffL1Col: C.t1, wiTariffL2Col: C.t2,
      wiInflowVal: 'Inflow', wiOutflowVal: 'Outflow', wiBaseVal: 'Base', wiRetentionVal: 'Retention',
      wiArpuCol: C.arpu, wiRevenueCol: C.rev, genLength: 12, runPreUnc: 1.28, runPostExp: 0.02,
      runConfHor: 3, runModel: 'Holt Linear', autoModel: false, autoConfidence: false, oneOffMonths: {} },
    rows: rows as any, standardCohorts: [],
    ibroCohorts: enumerated.map(k => {
      const [seg, prod, prodL2, chan, chanL2, tariffL1, tariffL2] = k.split('|');
      return { fKey: k, seg, prod, prodL2, chan, chanL2, tariffL1, tariffL2 };
    }),
  } as any);
  const store = new Map<string, BaseForecast>(job.newTypedForecasts);
  const { leafMap } = buildRollUpIndex(enumerated);
  return { store, enumerated, leafMap };
}

/** resolveForecast, App.tsx:1547 — store hit, else derive from leaves in scope. */
function makeResolve(store: Map<string, BaseForecast>, leafMap: Map<string, string[]>) {
  return (key: string): BaseForecast | null => {
    const hit = store.get(key);
    if (hit) return hit;
    const lk = leafMap.get(key) ?? [];
    const leaves = lk.map(k => store.get(k)).filter((b): b is BaseForecast => !!b);
    if (!leaves.length) return null;
    const [segment, product, productL2, channel, channelL2, tariffL1, tariffL2] = key.split('|');
    return deriveAggregate(leaves, { segment, product, productL2, channel, channelL2,
      tariffL1, tariffL2, scenario: 'Base Case' } as any);
  };
}

/** TIER 2, transcribed from ForecastVsActualsTab.tsx:676-698. Real predicates. */
function candidateScan(store: Map<string, BaseForecast>, rowKey: string, dims: any) {
  const [seg, prod, prodL2, chan, chanL2, tariffL1, tariffL2] = rowKey.split('|');
  const rowScope = { segment: seg, product: prod, productL2: prodL2,
    channel: chan, channelL2: chanL2, tariffL1, tariffL2 };
  const matchDims = dimsFromGrouping(dims);
  const out: Array<[string, BaseForecast]> = [];
  for (const [key, bf] of store.entries()) {
    const p = key.split('|');
    if (p[0] !== seg) continue;
    if (!cohortInScope({ segment: p[0], product: p[1], productL2: p[2],
      channel: p[3], channelL2: p[4], tariffL1: p[5], tariffL2: p[6] } as any,
      rowScope as any, matchDims)) continue;
    out.push([key, bf]);
  }
  return out;
}

const FIXTURES: Array<[string, string]> = [
  ['trimmed', 'test-data/VBU_IBRO_Trimmed_TariffHierarchy_Jan2023_Jun2026.xlsx'],
  ['edge', 'test-data/VBU_IBRO_EdgeCases_ShortHistory_PerScenarioARPU_Jan2023_Jun2026.xlsx'],
  ['full Dec2025', 'test-data/VBU_IBRO_Synthetic_ForecastTest_TariffHierarchy_Jan2023_Dec2025.xlsx'],
];

// Every grouping the accuracy table offers, so the scan is exercised at the
// grains where tier 1 is most likely to miss - not only the default.
const GROUPINGS: Array<[string, any]> = [
  ['segment only', { product: false, productL2: false, channelL1: false, channelL2: false, tariffL1: false, tariffL2: false }],
  ['product', { product: true, productL2: false, channelL1: false, channelL2: false, tariffL1: false, tariffL2: false }],
  ['product+channel', { product: true, productL2: false, channelL1: true, channelL2: false, tariffL1: false, tariffL2: false }],
  ['full grain', { product: true, productL2: true, channelL1: true, channelL2: true, tariffL1: true, tariffL2: true }],
];

let totalScanHits = 0;
let totalTier1Misses = 0;
const scanHitReport: string[] = [];

for (const [fxLabel, file] of FIXTURES) {
  const rows = read(file);
  const { store, enumerated, leafMap } = build(rows);
  const resolve = makeResolve(store, leafMap);

  // Distinct cohorts present in ACTUALS, at each grouping's grain.
  for (const [gLabel, dims] of GROUPINGS) {
    const keys = new Set<string>();
    for (const lk of enumerated) {
      const [s, p1, p2, c1, c2, t1, t2] = lk.split('|');
      keys.add(makeForecastKey(s,
        dims.product ? p1 : 'All', dims.productL2 ? p2 : 'All',
        dims.channelL1 ? c1 : 'All', dims.channelL2 ? c2 : 'All',
        dims.tariffL1 ? t1 : 'All', dims.tariffL2 ? t2 : 'All'));
    }
    const tier1Miss = [...keys].filter(k => resolve(k) === null);
    totalTier1Misses += tier1Miss.length;
    const scanHits = tier1Miss
      .map(k => [k, candidateScan(store, k, dims)] as const)
      .filter(([, c]) => c.length > 0);

    check(`${fxLabel} / ${gLabel}: the grouping produces rows at all`, keys.size > 0, `${keys.size} keys`);

    if (scanHits.length) {
      totalScanHits += scanHits.length;
      for (const [k, c] of scanHits) {
        scanHitReport.push(`${fxLabel} / ${gLabel}\n      row  ${k}\n      scan returned ${c.length}: ` +
          c.slice(0, 3).map(([sk]) => sk).join('  '));
      }
    }
    console.log(`  ${fxLabel.padEnd(13)} ${gLabel.padEnd(16)} keys=${String(keys.size).padStart(4)}  ` +
      `CHART trigger (tier-1 miss)=${String(tier1Miss.length).padStart(3)}  ` +
      `tier-2 HITS=${scanHits.length}  TABLE trigger=${tier1Miss.length - scanHits.length}`);
  }
}

console.log('');
// THE GATING RESULT. An empty hit set everywhere means the two panels' trigger
// sets coincide on these fixtures and the scan borrows nothing that is reachable.
check('THE CANDIDATE SCAN NEVER FIRES on any fixture at any grouping',
  totalScanHits === 0,
  `${totalScanHits} hits:\n    ` + scanHitReport.join('\n    '));

// Anti-vacuity: the tier-1 miss population must be non-empty somewhere, or the
// scan "never firing" is a statement about an empty input.
// A hardcoded `true` was written here first. A check that cannot fail is not a
// check, and this file exists because of a claim nobody could falsify.
check('ANTI-VACUITY: tier-1 misses exist, so "the scan never fires" is about a real input',
  totalTier1Misses > 0,
  `${totalTier1Misses} tier-1 misses across all fixtures and groupings — if 0, the scan result is vacuous`);

console.log(`trigger-sets spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
