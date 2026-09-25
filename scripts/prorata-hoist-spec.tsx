/**
 * THE PRO-RATA LEAF SCANS, HOISTED — REQ-D7-04 clause 5.
 *
 *   npm run spec:prorata-hoist
 *
 * The three pro-rata leaf lists (one per metric) read the rows and the columns
 * and nothing about the scope. They are now built ONCE per dataset by
 * `buildProRataLeaves` and passed to every seam run. On the fixture shaped as the
 * 1855 inventory's (60 Corporate·Direct leaves fitted to 2025-12; actuals over
 * 540 leaves to 2026-06, 90,720 rows; the enabled Corporate/Direct Inflow event
 * the Step 3 specs use), in fill-in order:
 *  (a) IDENTITY. The builder's three lists deep-equal those 379c48b's
 *      `buildLeaves` produced — transcribed below VERBATIM from 379c48b
 *      (WhatIfTab.tsx:1460-1483), because the lists the engine built inside
 *      itself were never exposed, and this spec exposes nothing new to read
 *      them. The seam's `series`, `rawArpuByMonth`, `adjustedMonths` and
 *      `arpuIdsByMonth` equal the figures 379c48b produced for four runs (All/All,
 *      Corporate/Direct, one 7-part leaf, and that leaf with an Outflow event
 *      too) — SHA-256 of each field's JSON, measured on the untouched 379c48b
 *      source before the hoist and recorded below. THE DISCRIMINATOR: the rows
 *      handed to the seam count their own iterations, and with the lists passed
 *      in they must be read ZERO times — the engine's fallback (it builds from
 *      the rows when no lists are passed) did not run.
 *  (b) TIMING. 60 per-leaf runs at Corporate/Direct with the hoisted lists: wall
 *      time quoted; PASS under 2 s (clause 3's band). 1339 measured 3.26 s.
 *  (X) ONE builder; the engine's fallback calls it; ONE memo each in WhatIfTab
 *      and FVA; the seam builds nothing.
 */
import * as fs from 'fs';
import * as crypto from 'crypto';
import XLSX from 'xlsx';
import * as fc from '../src/utils/forecasting';
import { eventScopeSeries } from '../src/utils/eventScopeSeries';

const HIST = 'test-data/VBU_IBRO_Synthetic_ForecastTest_TariffHierarchy_Jan2023_Dec2025.xlsx';
const ACT  = 'test-data/VBU_IBRO_Synthetic_ForecastTest_TariffHierarchy_Jan2023_Jun2026.xlsx';
const C = { date: 'Month', seg: 'Customer_Segment', prod: 'Product_L1', prodL2: 'Product_L2_Value_Tier',
  chan: 'Channel_Level_1', chanL2: 'Channel_Level_2', t1: 'tariff_tier_l1', t2: 'tariff_tier_l2',
  metric: 'IBRO_Scenario_Type', val: 'Subscriber_Volume', rev: 'Monthly_Revenue_GBP' };

/**
 * THE BEFORE — 379c48b's seam outputs, SHA-256 of JSON.stringify(field), measured
 * on 2026-09-25 against the untouched 379c48b source (`git diff --stat 379c48b --
 * src` empty) by a scratchpad script with this spec's fixture, store and event.
 * The leaf is the first stored key in sort order.
 */
const BEFORE: Record<string, { series: string; rawArpuByMonth: string; adjustedMonths: string; arpuIdsByMonth: string }> = {
  'All/All': {
    series: '4d074e58a72b1bb499217a3fe2e6d1e696a2855ff5858939b722d14329693a12',
    rawArpuByMonth: 'f4187d4d65fe2d006f407b3e0002138d4f0939d04a9dd185c405fd49725ab23d',
    adjustedMonths: 'f8ff0d2d3cc153f813acdc5f66e0089850179bef9a7fd7b3b757e7950a41c60e',
    arpuIdsByMonth: '7bfe29093692ba52759b60511a0166b039f73a0f0566cb751e821f808933ef37' },
  'Corporate/Direct': {
    series: '4d074e58a72b1bb499217a3fe2e6d1e696a2855ff5858939b722d14329693a12',
    rawArpuByMonth: 'f4187d4d65fe2d006f407b3e0002138d4f0939d04a9dd185c405fd49725ab23d',
    adjustedMonths: 'f8ff0d2d3cc153f813acdc5f66e0089850179bef9a7fd7b3b757e7950a41c60e',
    arpuIdsByMonth: '7bfe29093692ba52759b60511a0166b039f73a0f0566cb751e821f808933ef37' },
  'leaf': {
    series: 'ab9f883d2d57728cc00a4f480371e7c74bd3cc68969e49325d4670ad3a5dc46e',
    rawArpuByMonth: '7eb7ba8f91b2afe61c8eb624663e97f432df501f0a401913d87a01ffed86bc06',
    adjustedMonths: '048ae7077fd7b872267d077ab0f7784482dab064f31f0eb69cc6ea5c720a8882',
    arpuIdsByMonth: '7bfe29093692ba52759b60511a0166b039f73a0f0566cb751e821f808933ef37' },
  'leaf, inflow + outflow events': {
    series: '1433c1288a0b651f336bd46d3255a09b336022a9573c70606637c8377874ef4c',
    rawArpuByMonth: '7eb7ba8f91b2afe61c8eb624663e97f432df501f0a401913d87a01ffed86bc06',
    adjustedMonths: '722647e1dafdcfc73aad7c330839ec0c09d4262f87381f2059627d175ae9c8f1',
    arpuIdsByMonth: '7bfe29093692ba52759b60511a0166b039f73a0f0566cb751e821f808933ef37' },
};
const LEAF_KEY = 'Corporate|Fixed Connectivity|High Value|Direct|Call Centre / Tele-sales|RED ULTD|SIM-only';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };
const H = (x: any) => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');

for (const f of [HIST, ACT]) if (!fs.existsSync(f)) {
  console.log(`\nprorata-hoist spec: UNREACHABLE — fixture missing at ${f}`); process.exit(1);
}
const load = (f: string) => (XLSX.utils.sheet_to_json(XLSX.read(fs.readFileSync(f), { cellDates: true }).Sheets['Fact_IBRO']) as any[]);
const hist = load(HIST);
const rows = load(ACT);
const ym = (d: any) => { const x = d instanceof Date ? d : new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; };
const leafOf = (r: any) => [C.seg, C.prod, C.prodL2, C.chan, C.chanL2, C.t1, C.t2].map(c => String(r[c] ?? 'All').trim()).join('|');

// ── THE STORE: the 60 Corporate·Direct leaves, fitted on history to 2025-12 ──
const byLeaf = new Map<string, any[]>();
for (const r of hist) {
  const k = leafOf(r); const p = k.split('|');
  if (p[0] !== 'Corporate' || p[3] !== 'Direct') continue;
  if (!byLeaf.has(k)) byLeaf.set(k, []);
  byLeaf.get(k)!.push(r);
}
const store = new Map<string, any>();
for (const [k, rs] of byLeaf) {
  const mm = new Map<string, any>(); let lastT = -1, seed: number | null = null;
  for (const r of rs) {
    const key = ym(r[C.date]);
    if (!mm.has(key)) mm.set(key, { _parsedDate: new Date(r[C.date]), inflow: 0, outflow: 0, retention: 0, subs: 0, rev: 0,
      iS: 0, iR: 0, oS: 0, oR: 0, rS: 0, rR: 0, bS: 0, bR: 0 });
    const e = mm.get(key); const v = Number(r[C.val]) || 0, rv = Number(r[C.rev]) || 0, m = String(r[C.metric]);
    e.subs += v; e.rev += rv;
    if (m === 'Inflow') { e.inflow += v; e.iS += v; e.iR += rv; }
    else if (m === 'Outflow') { e.outflow += v; e.oS += v; e.oR += rv; }
    else if (m === 'Retention') { e.retention += v; e.rS += v; e.rR += rv; }
    else if (m === 'Base') {
      e.bS += v; e.bR += rv;
      const t = new Date(r[C.date]).getTime();
      if (t > lastT) { lastT = t; seed = 0; }
      if (t === lastT) seed = (seed ?? 0) + v;
    }
  }
  const series = [...mm.values()].sort((a, b) => a._parsedDate - b._parsedDate).map(e => ({
    _parsedDate: e._parsedDate, inflow: e.inflow, outflow: e.outflow, retention: e.retention,
    arpu: e.subs ? e.rev / e.subs : 0, inflowArpu: e.iS ? e.iR / e.iS : 0, outflowArpu: e.oS ? e.oR / e.oS : 0,
    retentionArpu: e.rS ? e.rR / e.rS : 0, baseArpu: e.bS ? e.bR / e.bS : 0 }));
  const p = k.split('|');
  const bf = (fc as any).calculateBaseForecast(series, { segment: p[0], product: p[1], productL2: p[2], channel: p[3],
    channelL2: p[4], tariffL1: p[5], tariffL2: p[6], scenario: 'Base Case' }, seed, 12, 1.0, 1.5, 3, 'Holt Linear');
  if (bf) store.set(fc.makeForecastKey(p[0], p[1], p[2], p[3], p[4], p[5], p[6]), bf);
}
const dm = (fc as any).buildCohortDataMap(rows.map(r => ({ ...r, _parsedDate: new Date(r[C.date]) })),
  C.date, C.seg, C.prod, C.prodL2, C.chan, C.chanL2, C.t1, C.t2);
const leafMap = (fc as any).buildRollUpIndex(dm.keys()).leafMap;
const resolveForecast = (key: string) => (fc as any).resolveFromStore(store, leafMap, key);
check('PREMISE: 60 leaves fitted', store.size === 60, String(store.size));
check('PREMISE: the recorded leaf is the first stored key', [...store.keys()].sort()[0] === LEAF_KEY, [...store.keys()].sort()[0]);

const cols = { wiSegmentCol: C.seg, wiProductCol: C.prod, wiProductL2Col: C.prodL2, wiChannelCol: C.chan,
  wiChannelL2Col: C.chanL2, wiTariffL1Col: C.t1, wiTariffL2Col: C.t2, wiValueCol: C.val,
  wiMetricCol: C.metric, wiInflowVal: 'Inflow', wiOutflowVal: 'Outflow', wiRetentionVal: 'Retention' };

// ── (a) IDENTITY: THE LISTS ───────────────────────────────────────────────
// 379c48b's `buildLeaves`, TRANSCRIBED VERBATIM from WhatIfTab.tsx:1460-1483 (the
// engine's closure, over the same destructured columns), so the comparison is
// against the code as it stood — not against the builder it was moved into.
const transcribed379 = (data: any[]) => {
  const { wiSegmentCol, wiProductCol, wiProductL2Col, wiChannelCol, wiChannelL2Col,
    wiTariffL1Col, wiTariffL2Col, wiValueCol, wiMetricCol, wiInflowVal, wiOutflowVal, wiRetentionVal } = cols;
  type ProRataLeaf = fc.ProRataLeaf;
    const buildLeaves = (metricValue: string): ProRataLeaf[] => (() => {
      const byLeaf = new Map<string, ProRataLeaf>();
      for (const row of data) {
        if (wiMetricCol && metricValue && String(row[wiMetricCol]).trim() !== metricValue) continue;
        const leaf: ProRataLeaf = {
          segment:   wiSegmentCol  ? String(row[wiSegmentCol]  ?? 'All').trim() : 'All',
          product:   wiProductCol  ? String(row[wiProductCol]  ?? 'All').trim() : 'All',
          productL2: wiProductL2Col ? String(row[wiProductL2Col] ?? 'All').trim() : 'All',
          channel:   wiChannelCol  ? String(row[wiChannelCol]  ?? 'All').trim() : 'All',
          channelL2: wiChannelL2Col ? String(row[wiChannelL2Col] ?? 'All').trim() : 'All',
          tariffL1:  wiTariffL1Col ? String(row[wiTariffL1Col] ?? 'All').trim() : 'All',
          tariffL2:  wiTariffL2Col ? String(row[wiTariffL2Col] ?? 'All').trim() : 'All',
          volume: 0,
        };
        const k = [leaf.segment, leaf.product, leaf.productL2, leaf.channel, leaf.channelL2, leaf.tariffL1, leaf.tariffL2].join('|');
        const vol = wiValueCol ? Number(row[wiValueCol]) || 0 : 0;
        // The row EXISTS for this metric, whatever its value — that is what
        // distinguishes "churned nobody" from "no outflow history at all".
        const cur = byLeaf.get(k);
        if (cur) { cur.volume += vol; cur.hasMetricData = true; }
        else { leaf.volume = vol; leaf.hasMetricData = true; byLeaf.set(k, leaf); }
      }
      return Array.from(byLeaf.values());
    })();
  return {
    Inflow:    buildLeaves(wiInflowVal ?? ''),
    Outflow:   buildLeaves(wiOutflowVal ?? ''),
    Retention: buildLeaves(wiRetentionVal ?? ''),
  };
};
const before = transcribed379(rows);
const lists = fc.buildProRataLeaves(rows, cols);
for (const m of ['Inflow', 'Outflow', 'Retention'] as const) {
  check(`(a) the builder's ${m} list deep-equals 379c48b's (${before[m].length} leaves)`,
    Array.isArray((lists as any)[m]) && JSON.stringify((lists as any)[m]) === JSON.stringify(before[m]),
    `${(lists as any)[m]?.length ?? 'absent'} vs ${before[m].length}`);
}
check('(a) exactly the three metric lists, nothing else', JSON.stringify(Object.keys(lists)) === '["Inflow","Outflow","Retention"]',
  JSON.stringify(Object.keys(lists)));

// ── (a) IDENTITY: THE OUTPUTS — and the discriminator ───────────────────────
// The rows the seam receives COUNT THEIR OWN ITERATIONS. The engine's only read
// of `data` is the pro-rata fallback (WhatIfTab.tsx, `buildProRataLeaves(data, …)`
// when no lists are passed), so with the lists handed in, a run reads them ZERO
// times. Identity alone could not tell a hoist from a fallback: both give the
// same numbers.
let reads = 0;
const counted: any[] = rows.slice();
const iter = Array.prototype[Symbol.iterator];
Object.defineProperty(counted, Symbol.iterator, { value: function (this: any[]) { reads++; return iter.call(this); } });
const MONTH0 = resolveForecast('All|All|All|All|All|All|All').forecast?.months[0]?.month;
const eventCD = {
  id: 'ev-cd', name: 'Launch', campaignName: 'Launch', scenario: 'Inflow', segment: 'Corporate', product: 'All', productL2: 'All',
  channel: 'Direct', channelL2: 'All', tariffL1: 'All', tariffL2: 'All', date: MONTH0,
  subscriberVolume: 1000, customerVolume: 0, revenue: 0, arpu: 0, comment: '', contractLength: 24, sequence: 1,
  amountType: 'absolute', percentageBasis: 'baseline', retentionLinked: true,
  isPromotion: false, promoRebanded: false, hold: false, mode: 'spread', enabled: true,
};
const eventOut = { ...eventCD, id: 'ev-out', name: 'Churn', campaignName: 'Churn', scenario: 'Outflow', subscriberVolume: 500 };
const draftOf = (k: string) => { const [segment, product, productL2, channelL1, channelL2, tariffL1, tariffL2] = k.split('|');
  return { segment, product, productL2, channelL1, channelL2, tariffL1, tariffL2 }; };
const run = (key: string, markets: any[]) => eventScopeSeries({ draft: draftOf(key), excludeId: null,
  marketEvents: markets as any, yieldEvents: [], pricingEvents: [], resolveForecast, data: counted, ...cols, proRataLeaves: lists });
const RUNS: [string, string, any[]][] = [
  ['All/All', 'All|All|All|All|All|All|All', [eventCD]],
  ['Corporate/Direct', 'Corporate|All|All|Direct|All|All|All', [eventCD]],
  ['leaf', LEAF_KEY, [eventCD]],
  ['leaf, inflow + outflow events', LEAF_KEY, [eventCD, eventOut]],
];
reads = 0;
for (const [name, key, markets] of RUNS) {
  const r = run(key, markets);
  for (const f of ['series', 'rawArpuByMonth', 'adjustedMonths', 'arpuIdsByMonth'] as const) {
    check(`(a) ${name}: ${f} equals 379c48b's`, H((r as any)[f]) === BEFORE[name][f], H((r as any)[f]).slice(0, 12) + ' vs ' + BEFORE[name][f].slice(0, 12));
  }
}
check('(a) DISCRIMINATOR: with the lists passed, the seam read the rows ZERO times (no fallback ran)', reads === 0, `${reads} iterations`);
// The discriminator's own positive control: without the lists the fallback DOES read them — three passes.
reads = 0;
eventScopeSeries({ draft: draftOf(LEAF_KEY), excludeId: null, marketEvents: [eventCD] as any, yieldEvents: [], pricingEvents: [],
  resolveForecast, data: counted, ...cols } as any);
check('(a) CONTROL: with no lists, the engine\'s fallback reads the rows three times (one per metric)', reads === 3, `${reads} iterations`);

// ── (b) TIMING ──────────────────────────────────────────────────────────────
const CD_KEY = 'Corporate|All|All|Direct|All|All|All';
const covered: string[] = [...fc.coveredLeafKeys(resolveForecast(CD_KEY), CD_KEY, new Set(rows.map(leafOf)).keys())].sort();
check('(b) PREMISE: 60 covered leaves at Corporate/Direct', covered.length === 60, String(covered.length));
for (const k of covered.slice(0, 5)) run(k, [eventCD]);                    // warm-up, not timed
reads = 0;
const t0 = performance.now();
const per: number[] = [];
for (const k of covered) { const s = performance.now(); run(k, [eventCD]); per.push(performance.now() - s); }
const wall = performance.now() - t0;
per.sort((a, b) => a - b);
console.log(`  (b) 60 per-leaf runs at Corporate/Direct, hoisted lists: ${(wall / 1000).toFixed(3)} s; per run median ${per[30].toFixed(2)} ms, min ${Math.min(...per).toFixed(2)}, max ${per[59].toFixed(2)} (1339: 3.26 s)`);
check('(b) 60 per-leaf runs under 2 s', wall < 2000, `${(wall / 1000).toFixed(3)} s`);
check('(b) and none of them read the rows', reads === 0, `${reads} iterations`);
const tb = performance.now(); fc.buildProRataLeaves(rows, cols); const buildMs = performance.now() - tb;
console.log(`  (b) one build of the three lists (once per dataset): ${buildMs.toFixed(1)} ms`);

// ── (X) STRUCTURE ───────────────────────────────────────────────────────────
{
  const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const count = (t: string, n: string) => t.split(n).length - 1;
  const eng = strip(fs.readFileSync('src/utils/forecasting.ts', 'utf8'));
  const wit = strip(fs.readFileSync('src/components/WhatIfTab.tsx', 'utf8'));
  const fva = strip(fs.readFileSync('src/components/ForecastVsActualsTab.tsx', 'utf8'));
  const util = strip(fs.readFileSync('src/utils/eventScopeSeries.ts', 'utf8'));
  const all = [eng, wit, fva, util].join('\n');
  check('(X) ONE builder: buildProRataLeaves defined once, in forecasting.ts', count(eng, 'export function buildProRataLeaves(') === 1
    && count(all, 'function buildProRataLeaves(') === 1);
  check('(X) the engine\'s closure is gone: no `const buildLeaves` outside the builder', count(wit, 'const buildLeaves') === 0);
  check('(X) the engine falls back to the SAME builder, once', /proRataLeavesOverride\s*\n?\s*\?\? buildProRataLeaves\(data, \{/.test(wit));
  check('(X) ONE memo each: WhatIfTab 1 + the engine fallback 1; FVA 1; the seam builds nothing',
    count(wit, 'buildProRataLeaves(') === 2 && count(wit, 'const proRataLeaves = useMemo(() => buildProRataLeaves(data, {') === 1
      && count(fva, 'buildProRataLeaves(') === 1 && count(fva, 'const proRataLeaves = useMemo(() => buildProRataLeaves(data, {') === 1
      && count(util, 'buildProRataLeaves(') === 0,
    `${count(wit, 'buildProRataLeaves(')} / ${count(fva, 'buildProRataLeaves(')} / ${count(util, 'buildProRataLeaves(')}`);
  check('(X) the seam passes the lists it is given on every run', count(util, 'proRataLeavesOverride: proRataLeaves,') === 1
    && /proRataLeaves: ProRataLeavesByMetric;/.test(util));
  check('(X) both callers hand the seam their memoised lists', count(wit, 'wiMetricCol, wiInflowVal, wiOutflowVal, wiRetentionVal, proRataLeaves,') === 1
    && count(fva, 'wiMetricCol, wiInflowVal, wiOutflowVal, wiRetentionVal, proRataLeaves,') === 1);
  const ca = (fs.readdirSync('src', { recursive: true } as any) as string[])
    .filter(f => /\.(ts|tsx)$/.test(String(f)))
    .reduce((n, f) => n + count(fs.readFileSync('src/' + String(f).split('\\').join('/'), 'utf8'), 'computeAdjustedForecast('), 0);
  check('(X) computeAdjustedForecast stays 6 across src', ca === 6, String(ca));
}

console.log(`\nprorata-hoist spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fails.length ? 1 : 0);
