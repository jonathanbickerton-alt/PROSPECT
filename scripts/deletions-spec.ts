/**
 * DELETIONS — what happens INSTEAD, not merely that the code is gone.
 *
 *   npm run spec:deletions
 *
 * An absence assertion ("scaledBandFlow no longer appears") passes equally well
 * if the fallback was replaced by something worse. Each block below pins the
 * replacement behaviour.
 *
 * Session C deleted four things, all one family: a number was produced where
 * the honest answer was nothing.
 *
 *   1. scaledBandFlow      — scored a cohort's flows against the LOADED cohort's
 *                            bands scaled by an average share.
 *   2. computeAvgShare     — computed that share; its other consumer,
 *      + derivedBaseBands    derivedBaseBands, did the same for the Base KPI.
 *   3. instance-2 seed     — seeded a challenger for cohort X from cohort Y's
 *                            standing base, then from 0.
 *   4. the dead guard      — a `!g.derivedMix` test in a list that already
 *                            excludes derived rows.
 */
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { buildCohortDataMap, buildRollUpIndex, makeForecastKey } from '../src/utils/forecasting';
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

function storeFor(rows: any[]) {
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
  return { store: new Map<string, BaseForecast>(job.newTypedForecasts), enumerated };
}

const cohortsIn = (rows: any[]) => {
  const out = new Set<string>();
  for (const r of rows) out.add(makeForecastKey(
    String(r[C.seg] ?? '').trim(), String(r[C.prod] ?? '').trim(), String(r[C.prodL2] ?? '').trim(),
    String(r[C.chan] ?? '').trim(), String(r[C.chanL2] ?? '').trim(),
    String(r[C.t1] ?? '').trim(), String(r[C.t2] ?? '').trim()));
  return out;
};

// ── 1+2. THE TRIGGER SET, pinned ───────────────────────────────────────────
// CORRECTION, 2026-08-06. This set is `resolveForecast` returning null - which
// is the CHART's trigger (one tier). The accuracy table resolved in TWO tiers
// until Session D deleted the second, so before that its trigger set was a
// SUBSET of this one and describing this figure as "the table's" was wrong.
//
// Session C's shipped scope stands: `spec:triggers` measures both and the
// tier-2 scan fired on ZERO of the tier-1 misses on every fixture, so the two
// sets coincide in fact. The description was wrong, not the number.
//
// This is the population whose rows change from a fabricated number to a blank.
// Pinned so a fixture edit that silently grows it is noticed: the deletion is
// only defensible while this set is the deliberate short-history leaves.
{
  const cases: Array<[string, string, number]> = [
    ['trimmed, same file', 'test-data/VBU_IBRO_Trimmed_TariffHierarchy_Jan2023_Jun2026.xlsx', 0],
    ['edge, same file', 'test-data/VBU_IBRO_EdgeCases_ShortHistory_PerScenarioARPU_Jan2023_Jun2026.xlsx', 2],
    // The walk configuration. Slower (540 leaves) but it is the one a reviewer
    // actually looks at, and it was confirmed by hand and left unguarded.
    ['full Dec2025', 'test-data/VBU_IBRO_Synthetic_ForecastTest_TariffHierarchy_Jan2023_Dec2025.xlsx', 0],
  ];
  for (const [label, f, expected] of cases) {
    const rows = read(f);
    const { store, enumerated } = storeFor(rows);
    const { leafMap } = buildRollUpIndex(enumerated);
    const resolvable = (key: string) =>
      store.has(key) || (leafMap.get(key) ?? []).some(k => store.has(k));
    const cohorts = cohortsIn(rows);
    const orphans = [...cohorts].filter(k => !resolvable(k));

    check(`TRIGGER (${label}): the population is non-empty and real`, cohorts.size > 0, `${cohorts.size} cohorts`);
    check(`TRIGGER (${label}): ${expected} cohorts have actuals but no resolvable forecast`,
      orphans.length === expected, `${orphans.length}, expected ${expected}`);
  }
  // The edge fixture's two ARE the short-history leaves, not an unrelated gap.
  const rows = read('test-data/VBU_IBRO_EdgeCases_ShortHistory_PerScenarioARPU_Jan2023_Jun2026.xlsx');
  const { store, enumerated } = storeFor(rows);
  check('TRIGGER: the edge fixture orphans are exactly its unfitted leaves',
    enumerated.length - store.size === 2,
    `${enumerated.length} enumerated, ${store.size} fitted`);
}

// ── SOURCE GUARDS. The closures below cannot be driven headlessly. ─────────
// `calcComponentDetail` and `runChallengerForecast` are component/callback
// closures. Declared as source assertions, not passed off as behaviour.
const fva = fs.readFileSync('src/components/ForecastVsActualsTab.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');

// Code, not commentary: strip block comments before asserting absence, or the
// comment explaining the deletion satisfies the check that it happened.
const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const fvaCode = strip(fva);
const appCode = strip(app);

check('1: scaledBandFlow is gone from the CODE, not merely from one call site',
  !/scaledBandFlow/.test(fvaCode));
check('2: computeAvgShare is gone from the code', !/computeAvgShare/.test(fvaCode));
check('2: derivedBaseBands is gone from the code', !/derivedBaseBands/.test(fvaCode));

// REPLACEMENT, not absence: the read sites must return nothing, not something else.
check('1: the flow band read has no fallback arm at all',
  /const baseBand = flowBandMaps\?\.\[kpi\]\?\.get\(month\);[\s\S]{0,80}if \(!baseBand\) return null;/.test(fvaCode),
  'the flow read is not the plain "own band or nothing" shape');
check('2: the base band read has no fallback arm at all',
  /const band = cohortBaseBandMap\?\.get\(month\);/.test(fvaCode) &&
  !/cohortBaseBandMap\?\.get\(month\) \?\?/.test(fvaCode),
  'the base read still has a ?? fallback');

// 3. instance-2: declines rather than borrowing.
const rcf = appCode.slice(appCode.indexOf('const runChallengerForecast'),
                          appCode.indexOf('const acceptPreviewForecast'));
check('3: runChallengerForecast was found', rcf.length > 500, String(rcf.length));
check('3: it DECLINES when the cohort has no forecast of its own',
  /if \(!existingBf\) return null;/.test(rcf),
  'no early decline - it still produces a forecast without an own seed');
check('3: it never falls back to the LOADED cohort\'s seed',
  !/baseForecast\?\.seedBaseVolume/.test(rcf),
  'the borrowed seed is back');
check('3: and there is no `?? 0` seed either - zero base is not a neutral default',
  !/seedBaseVolume \?\? 0/.test(rcf) && !/\?\? baseForecast/.test(rcf));

// 4. the dead guard: one authority for the rule, not two.
check('4: acceptAllCandidates still excludes derived rows - the REAL rule',
  /acceptAllCandidates[\s\S]{0,400}?!g\.derivedMix/.test(fvaCode),
  'the filter that makes the removed guard redundant is itself gone');
// LAST occurrence, and no truncation window. The first version anchored on
// indexOf(), which found an unrelated `.map` ~77,000 characters earlier, and
// then tested only the first 1,500 characters after it - so it never looked at
// the modal at all. A gate reinstated the exact dead guard and this check
// stayed green. A slice offset is not a location, and a fixed window is a
// guess about distance.
const modalStart = fvaCode.lastIndexOf('acceptAllCandidates.map');
const modal = modalStart === -1 ? '' : fvaCode.slice(modalStart);
check('4: the modal render block was located', modal.length > 200 && /ArrowRight/.test(modal),
  `slice length ${modal.length}, ArrowRight present ${/ArrowRight/.test(modal)}`);
check('4: the modal row no longer re-tests derivedMix',
  modal.length > 0 && !/!g\.derivedMix/.test(modal),
  'the dead guard is back');

console.log(`deletions spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
