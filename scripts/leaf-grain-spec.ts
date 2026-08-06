/**
 * SCORED ROWS AT LEAF GRAIN — and why they were not, before.
 *
 *   npm run spec:leafgrain
 *
 * `spec:challenger` carried a declared gap for two sessions: the fitted-leaf
 * case could not be driven, because toggling to leaf grain emptied the
 * challenger list and the cause was never chased. The blocker was named as the
 * unscored early return in `buildCohortAccuracy`, which was module-private and
 * therefore unreachable except by mounting the whole tab and reading the DOM —
 * the right instrument for a screen, the wrong one for arithmetic.
 *
 * It is exported now, so the question is answerable directly.
 *
 * THE DISCIPLINE THIS FILE KEEPS: prove the path under test is REACHED before
 * reading any verdict from it. A row that scores nothing because the function
 * returned early is a different fact from a row that scores nothing because no
 * forecast exists, and both look identical in the output.
 */
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { buildCohortDataMap, buildRollUpIndex, deriveAggregate, calculateBaseForecast } from '../src/utils/forecasting';
import { buildCohortAccuracy } from '../src/components/ForecastVsActualsTab';
import type { BaseForecast } from '../src/types/forecast';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

const FIX = 'test-data/VBU_IBRO_EdgeCases_ShortHistory_PerScenarioARPU_Jan2023_Jun2026.xlsx';
const C = { date: 'Month', metric: 'IBRO_Scenario_Type', value: 'Subscriber_Volume',
  seg: 'Customer_Segment', prod: 'Product_L1', prodL2: 'Product_L2_Value_Tier',
  chan: 'Channel_Level_1', chanL2: 'Channel_Level_2',
  t1: 'tariff_tier_l1', t2: 'tariff_tier_l2', rev: 'Monthly_Revenue_GBP' };

const v = (r: any, k: string) => String(r[k] ?? '').trim();
const wb = XLSX.read(fs.readFileSync(FIX), { type: 'buffer', cellDates: true });
const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
const month = (r: any) => String(v(r, C.date)).slice(0, 7);

/** cohortActualsMap, transcribed from ForecastVsActualsTab.tsx:1697-1768. */
function buildActualsMap() {
  const map = new Map<string, Map<string, any>>();
  for (const r of rows) {
    const m = month(r);
    const key = [v(r, C.seg), v(r, C.prod), v(r, C.prodL2) || 'All', v(r, C.chan),
      v(r, C.chanL2) || 'All', v(r, C.t1) || 'All', v(r, C.t2) || 'All'].join('|');
    if (!map.has(key)) map.set(key, new Map());
    const mm = map.get(key)!;
    if (!mm.has(m)) mm.set(m, { inflow: 0, outflow: 0, retention: 0, base: null, arpu: 0,
      arpuRevSum: 0, arpuSubVol: 0, inflowArpu: 0, outflowArpu: 0, retentionArpu: 0, baseArpu: 0,
      inflowRev: 0, inflowSubVol: 0, outflowRev: 0, outflowSubVol: 0,
      retentionRev: 0, retentionSubVol: 0, baseRev: 0, baseSubVol: 0 });
    const e = mm.get(m)!;
    const metric = v(r, C.metric);
    const val = Number(r[C.value]) || 0;
    const revVal = Number(r[C.rev]) || 0;
    if (metric === 'Inflow') { e.inflow += val; e.inflowSubVol += val; e.inflowRev += revVal; e.arpuSubVol += val; e.arpuRevSum += revVal; }
    else if (metric === 'Outflow') { e.outflow += val; e.outflowSubVol += val; e.outflowRev += revVal; e.arpuSubVol += val; e.arpuRevSum += revVal; }
    else if (metric === 'Retention') { e.retention += val; e.retentionSubVol += val; e.retentionRev += revVal; e.arpuSubVol += val; e.arpuRevSum += revVal; }
    else if (metric === 'Base') { e.base = (e.base ?? 0) + val; e.baseSubVol += val; e.baseRev += revVal; e.arpuSubVol += val; e.arpuRevSum += revVal; }
  }
  for (const mm of map.values()) for (const e of mm.values()) {
    e.arpu = e.arpuSubVol > 0 && e.arpuRevSum > 0 ? e.arpuRevSum / e.arpuSubVol : 0;
    e.inflowArpu = e.inflowSubVol > 0 && e.inflowRev > 0 ? e.inflowRev / e.inflowSubVol : 0;
    e.outflowArpu = e.outflowSubVol > 0 && e.outflowRev > 0 ? e.outflowRev / e.outflowSubVol : 0;
    e.retentionArpu = e.retentionSubVol > 0 && e.retentionRev > 0 ? e.retentionRev / e.retentionSubVol : 0;
    e.baseArpu = e.baseSubVol > 0 && e.baseRev > 0 ? e.baseRev / e.baseSubVol : 0;
  }
  return map;
}

/** A leaf fit on a TRUNCATED history, so forecast months overlap the actuals. */
function fitLeaf(key: string): BaseForecast | null {
  const [seg, prod, prodL2, chan, chanL2, t1, t2] = key.split('|');
  const sel = rows.filter(r => v(r, C.seg) === seg && v(r, C.prod) === prod &&
    v(r, C.prodL2) === prodL2 && v(r, C.chan) === chan && v(r, C.chanL2) === chanL2 &&
    v(r, C.t1) === t1 && v(r, C.t2) === t2);
  if (!sel.length) return null;
  const acc = new Map<number, any>();
  for (const r of sel) {
    const d = new Date(month(r) + '-01'); if (isNaN(d.getTime())) continue;
    const t = d.getTime();
    if (!acc.has(t)) acc.set(t, { _parsedDate: d, inflow: 0, outflow: 0, retention: 0,
      arpu: 0, inflowArpu: 0, outflowArpu: 0, retentionArpu: 0, baseArpu: 0,
      _rev: 0, _vol: 0, _s: { Inflow: [0, 0], Outflow: [0, 0], Retention: [0, 0], Base: [0, 0] } as any });
    const e = acc.get(t)!, m = v(r, C.metric), val = Number(r[C.value]) || 0;
    if (m === 'Inflow') e.inflow += val; else if (m === 'Outflow') e.outflow += val;
    else if (m === 'Retention') e.retention += val;
    if (e._s[m]) { e._s[m][0] += Number(r[C.rev]) || 0; e._s[m][1] += val; }
    // ARPU MUST be populated. The first version of this harness left it at 0 for
    // every month, so the fitted ARPU bands were all zero and every ARPU
    // component scored NaN - which then poisoned overallScore on 72 of 74 rows
    // and looked exactly like a product defect. It was the harness.
    e._rev += Number(r[C.rev]) || 0;
    e._vol += val;
  }
  for (const e of acc.values()) {
    e.arpu = e._vol > 0 ? e._rev / e._vol : 0;
    // PER-SCENARIO ARPU too: calculateBaseForecast fits these four series
    // independently, and leaving them undefined is what made every ARPU
    // component score NaN on the second attempt.
    const rate = (k: string) => (e._s[k][1] > 0 ? e._s[k][0] / e._s[k][1] : 0);
    e.inflowArpu = rate('Inflow'); e.outflowArpu = rate('Outflow');
    e.retentionArpu = rate('Retention'); e.baseArpu = rate('Base');
  }
  const series = [...acc.values()].sort((a, b) => a._parsedDate - b._parsedDate);
  if (series.length < 8) return null;
  const hist = series.slice(0, Math.max(4, series.length - 6));
  const cutoff = hist[hist.length - 1]._parsedDate.getTime();
  let seed = 0, seedT = -1;
  for (const r of sel) {
    if (v(r, C.metric) !== 'Base') continue;
    const t = new Date(month(r) + '-01').getTime();
    if (t <= cutoff && t > seedT) { seedT = t; seed = 0; }
    if (t === seedT) seed += Number(r[C.value]) || 0;
  }
  return calculateBaseForecast(hist, { segment: seg, product: prod, productL2: prodL2,
    channel: chan, channelL2: chanL2, tariffL1: t1, tariffL2: t2, scenario: 'Base Case' } as any,
    seed, 12, 1.0, 1.5, 3, 'Holt Linear');
}

// ── THE 5-PART STORE ARRANGEMENT ──────────────────────────────────────────
// Leaf keys carry a real tariff, so any grouping the accuracy table offers
// produces a key with 'All' in the tariff slots and never hits them exactly.
// The store is therefore built at the grain the table actually asks for.
const dm = buildCohortDataMap(rows, C.date, C.seg, C.prod, C.prodL2, C.chan, C.chanL2, C.t1, C.t2);
const enumerated = [...dm.keys()];
const { leafMap } = buildRollUpIndex(enumerated);

const store = new Map<string, BaseForecast>();
for (const k of enumerated) {
  const bf = fitLeaf(k);
  if (!bf) continue;
  store.set(k, bf);
  // The same fit, re-keyed at 5-part grain (tariff collapsed to All) — the key
  // shape a full-grain grouping builds.
  const [seg, prod, prodL2, chan, chanL2] = k.split('|');
  const fiveKey = [seg, prod, prodL2, chan, chanL2, 'All', 'All'].join('|');
  if (!store.has(fiveKey)) store.set(fiveKey, { ...bf, cohort: { ...bf.cohort, tariffL1: 'All', tariffL2: 'All' } });
}

const resolveForecast = (key: string) => {
  const hit = store.get(key);
  if (hit) return { forecast: hit, reason: null };
  const lk = leafMap.get(key) ?? [];
  const leaves = lk.map(k => store.get(k)).filter((b): b is BaseForecast => !!b);
  if (!leaves.length) return { forecast: null as BaseForecast | null, reason: 'insufficient-history' as any };
  const [segment, product, productL2, channel, channelL2, tariffL1, tariffL2] = key.split('|');
  return { forecast: deriveAggregate(leaves, { segment, product, productL2, channel,
    channelL2, tariffL1, tariffL2, scenario: 'Base Case' } as any), reason: null as any };
};

const actualsMap = buildActualsMap();
const anyBf = [...store.values()][0];

check('PREMISE: actuals exist to score against', actualsMap.size > 0, `${actualsMap.size} cohorts`);
check('PREMISE: the store holds fits at BOTH grains',
  store.size > enumerated.length, `${store.size} entries for ${enumerated.length} leaves`);

// ── THE INVESTIGATION: is the path REACHED, before any verdict is read ────
const FULL = { product: true, productL2: true, channelL1: true, channelL2: true, tariffL1: false, tariffL2: false };
const rowsOut = buildCohortAccuracy(actualsMap, anyBf, FULL as any, store, resolveForecast as any);

check('the accuracy builder returns rows at leaf grain', rowsOut.length > 0, `${rowsOut.length} rows`);

const scored = rowsOut.filter((r: any) => r.overallScore !== null);
const unscored = rowsOut.filter((r: any) => r.overallScore === null);
const noForecastFlagged = rowsOut.filter((r: any) => r.noForecast);

// THE FINDING, pinned. Before this file existed the belief was that leaf-grain
// rows come back unscored because the early return fires. Measured:
check('SCORED rows exist at leaf grain — the declared gap is closed',
  scored.length > 0,
  `${scored.length} scored, ${unscored.length} unscored of ${rowsOut.length}`);
check('and the unscored ones are unscored for the STATED reason, not silently',
  unscored.every((r: any) => r.noForecast === true),
  `${unscored.filter((r: any) => !r.noForecast).length} unscored rows are NOT flagged noForecast`);
check('the early return is REACHED — noForecast rows exist, so the path is exercised',
  noForecastFlagged.length > 0,
  `${noForecastFlagged.length} rows took the no-forecast branch; if 0, that path is untested here`);

// A scored row must carry real component scores, not a shell.
const s0: any = scored[0];
if (s0) {
  check('a scored leaf-grain row carries a real overall score',
    typeof s0.overallScore === 'number' && !Number.isNaN(s0.overallScore) && s0.overallScore > 0,
    String(s0.overallScore));
  check('a scored leaf-grain row carries at least one component score',
    [s0.inflowScore, s0.outflowScore, s0.retentionScore, s0.baseScore]
      .some(x => typeof x === 'number' && !Number.isNaN(x)),
    JSON.stringify([s0.inflowScore, s0.outflowScore, s0.retentionScore, s0.baseScore]));
  check('a scored row is NOT flagged noForecast', s0.noForecast !== true);
}

// ── THE CONTROL: an EMPTY store must score nothing, so "scored" means something
const emptyResolve = () => ({ forecast: null as BaseForecast | null, reason: 'insufficient-history' as any });
const noneOut = buildCohortAccuracy(actualsMap, anyBf, FULL as any, new Map(), emptyResolve as any);
check('CONTROL: with an empty store every row is unscored',
  noneOut.length > 0 && noneOut.every((r: any) => r.overallScore === null),
  `${noneOut.filter((r: any) => r.overallScore !== null).length} of ${noneOut.length} scored with no store`);
check('CONTROL: the two runs differ — so scoring depends on the store, not the fixture',
  scored.length > 0 && noneOut.every((r: any) => r.overallScore === null));

// ── NO SCORE MAY BE NaN ───────────────────────────────────────────────────
// NaN !== null, so a single NaN component used to survive scoreVals' filter and
// poison the mean - and a NaN overallScore renders as a SCORE, because every
// downstream test is `!== null`. The filter now also requires Number.isFinite.
//
// Guarded by guard-traps trap 11, which injects a NaN component AND weakens the
// filter, because no natural input produces one: the injection is the scenario,
// the weakened filter is the defect.
check('NO ROW carries a non-finite overallScore',
  rowsOut.every((r: any) => r.overallScore === null || Number.isFinite(r.overallScore)),
  `${rowsOut.filter((r: any) => r.overallScore !== null && !Number.isFinite(r.overallScore)).length} rows with a non-finite score`);
check('NO ROW carries a non-finite COMPONENT score either',
  rowsOut.every((r: any) => ['inflowScore','outflowScore','retentionScore','baseScore',
    'inflowArpuScore','outflowArpuScore','retentionArpuScore','baseArpuScore']
    .every(k => r[k] === null || Number.isFinite(r[k]))),
  'a component score is non-finite');

// ── THE DIAGNOSIS, and it is not what was assumed ─────────────────────────
// The ~:767 early return was named as the blocker for two sessions. IT IS NOT A
// BLOCKER AT ALL. Measured here:
//
//   * leaf-grain rows SCORE - 72 of 74, the 2 being the deliberately unfitted
//     leaves, which take the early return correctly and are flagged noForecast;
//   * a plain 7-part store scores IDENTICALLY to one with 5-part keys added
//     (72/74 both ways), because derivation already resolves the grouped key -
//     so the "5-part store arrangement" the docket called for turned out to be
//     unnecessary, not load-bearing;
//   * every scored row lands BELOW 85 (min 47.8, max 83.6), so the challenger
//     tab's `overallScore < 85` threshold would not filter them either.
//
// So none of the three things blamed - the early return, the key shape, the
// threshold - explains why `spec:challenger` could not reach a fitted row. That
// harness fitted only 12 leaves against actuals covering 74 cohorts. The
// blocker was its own store, and the gap it declared was a property of the test
// rather than of the product.
//
// The control below is kept because it is what proved the key-shape theory
// wrong: both stores behave the same.
{
  const sevenOnly = new Map<string, BaseForecast>();
  for (const k of enumerated) { const bf = store.get(k); if (bf) sevenOnly.set(k, bf); }
  const resolveSeven = (key: string) => {
    const hit = sevenOnly.get(key);
    if (hit) return { forecast: hit, reason: null as any };
    const lk = leafMap.get(key) ?? [];
    const leaves = lk.map(k => sevenOnly.get(k)).filter((b): b is BaseForecast => !!b);
    if (!leaves.length) return { forecast: null as BaseForecast | null, reason: 'insufficient-history' as any };
    const [sg, pr, p2, ch, c2, t1, t2] = key.split('|');
    return { forecast: deriveAggregate(leaves, { segment: sg, product: pr, productL2: p2,
      channel: ch, channelL2: c2, tariffL1: t1, tariffL2: t2, scenario: 'Base Case' } as any), reason: null as any };
  };
  const sevenOut = buildCohortAccuracy(actualsMap, anyBf, FULL as any, sevenOnly, resolveSeven as any);
  const sevenScored = sevenOut.filter((r: any) => r.overallScore !== null).length;

  check('DIAGNOSIS: the store really is smaller without the 5-part keys',
    sevenOnly.size < store.size, `${sevenOnly.size} vs ${store.size}`);
  check('DIAGNOSIS: with 7-part keys ONLY, leaf-grain rows resolve by DERIVATION',
    sevenOut.length > 0, `${sevenOut.length} rows`);
  check('DIAGNOSIS: a plain 7-part store scores leaf-grain rows just as well',
    sevenScored === scored.length && sevenScored > 0,
    `5-part store scored ${scored.length}, 7-part-only scored ${sevenScored}`);
  check('DIAGNOSIS: leaf-grain scores fall below the challenger threshold of 85',
    scored.every((r: any) => typeof r.overallScore === 'number' && r.overallScore < 85),
    'some leaf-grain rows score >= 85 and would be filtered from the challenger list');
  const vals = scored.map((r: any) => r.overallScore).filter((x: any) => typeof x === 'number');
  const below85 = vals.filter((x: number) => x < 85).length;
  console.log(`  [scores] min=${Math.min(...vals).toFixed(1)} max=${Math.max(...vals).toFixed(1)} below85=${below85} of ${vals.length}`);
  console.log(`  [diagnosis] 5-part store: ${scored.length} scored / ${rowsOut.length};  ` +
    `7-part only: ${sevenScored} scored / ${sevenOut.length}`);
}

console.log(`leaf-grain spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
