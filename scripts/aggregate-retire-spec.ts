/**
 * RETIRING STORED FIT-ON-AGGREGATE FORECASTS.
 *
 *   npm run spec:retire
 *
 * Real saved sessions contain forecasts that were FITTED to an aggregate by the
 * manual path Session G removed, stored under All-bearing keys. `resolveForecast`
 * is store-first, so without a rule those stale fits would win over derivation
 * permanently and nothing on screen would say so.
 *
 * The rule is read-time: a stored FITTED forecast under an All-bearing key is
 * treated as a miss, and derivation answers instead. The entry stays in the
 * store as a record rather than an authority.
 *
 * SCOPE IS THE POINT, and it is why there are two cases rather than one. The
 * rule needs BOTH halves - All-bearing AND fitted. Widen it either way and it
 * eats something it must not:
 *
 *   * drop the fitted test  -> it retires DERIVED aggregates, which is every
 *                              answer the seam produces;
 *   * drop the All-bearing  -> it retires LEAF fits, which is every real
 *     test                     forecast in the store.
 *
 * Case 2 is not decoration. It is the half that catches a rule that looks
 * correct on the case it was written for.
 */
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import {
  buildCohortDataMap, buildRollUpIndex, deriveAggregate,
  calculateBaseForecast, isRetiredAggregateFit, makeForecastKey,
} from '../src/utils/forecasting';
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

/** Fit a series for an arbitrary scope — used for both leaves and (to build the
 *  artefact) an aggregate, exactly as the removed manual path did. */
function fitScope(pred: (r: any) => boolean, cohort: any): BaseForecast | null {
  const sel = rows.filter(pred);
  if (!sel.length) return null;
  const acc = new Map<number, any>();
  for (const r of sel) {
    const d = new Date(month(r) + '-01'); if (isNaN(d.getTime())) continue;
    const t = d.getTime();
    if (!acc.has(t)) acc.set(t, { _parsedDate: d, inflow: 0, outflow: 0, retention: 0,
      arpu: 0, inflowArpu: 0, outflowArpu: 0, retentionArpu: 0, baseArpu: 0, _rev: 0, _vol: 0 });
    const e = acc.get(t)!, m = v(r, C.metric), val = Number(r[C.value]) || 0;
    if (m === 'Inflow') e.inflow += val; else if (m === 'Outflow') e.outflow += val;
    else if (m === 'Retention') e.retention += val;
    e._rev += Number(r[C.rev]) || 0; e._vol += val;
  }
  for (const e of acc.values()) {
    e.arpu = e._vol > 0 ? e._rev / e._vol : 0;
    e.inflowArpu = e.arpu; e.outflowArpu = e.arpu; e.retentionArpu = e.arpu; e.baseArpu = e.arpu;
  }
  const series = [...acc.values()].sort((a, b) => a._parsedDate - b._parsedDate);
  if (series.length < 8) return null;
  const hist = series.slice(0, Math.max(4, series.length - 6));
  return calculateBaseForecast(hist, cohort, 1000, 12, 1.0, 1.5, 3, 'Holt Linear');
}

const dm = buildCohortDataMap(rows, C.date, C.seg, C.prod, C.prodL2, C.chan, C.chanL2, C.t1, C.t2);
const enumerated = [...dm.keys()];
const { leafMap } = buildRollUpIndex(enumerated);

// Leaf fits — the normal contents of a store.
const store = new Map<string, BaseForecast>();
for (const k of enumerated) {
  const [seg, prod, prodL2, chan, chanL2, t1, t2] = k.split('|');
  const bf = fitScope(r => v(r, C.seg) === seg && v(r, C.prod) === prod && v(r, C.prodL2) === prodL2
    && v(r, C.chan) === chan && v(r, C.chanL2) === chanL2 && v(r, C.t1) === t1 && v(r, C.t2) === t2,
    { segment: seg, product: prod, productL2: prodL2, channel: chan, channelL2: chanL2,
      tariffL1: t1, tariffL2: t2, scenario: 'Base Case' });
  if (bf) store.set(k, bf);
}
check('PREMISE: leaf fits exist', store.size > 0, `${store.size} leaves`);

// THE ARTEFACT: a fit-on-aggregate under an All-bearing key, exactly what the
// removed manual path wrote and what a real old save file carries.
const seg0 = enumerated[0].split('|')[0];
const AGG_KEY = makeForecastKey(seg0, 'All', 'All', 'All', 'All', 'All', 'All');
const aggFit = fitScope(r => v(r, C.seg) === seg0,
  { segment: seg0, product: 'All', productL2: 'All', channel: 'All', channelL2: 'All',
    tariffL1: 'All', tariffL2: 'All', scenario: 'Base Case' });
check('PREMISE: the stale artefact was built and is FITTED',
  !!aggFit && aggFit.provenance.kind === 'fitted',
  aggFit ? aggFit.provenance.kind : 'null');
if (aggFit) store.set(AGG_KEY, aggFit);

/** resolveForecast, App.tsx — store-first, with the retirement rule. */
function resolve(key: string) {
  const stored = store.get(key);
  if (stored && !isRetiredAggregateFit(key, stored)) return stored;
  const lk = leafMap.get(key) ?? [];
  const leaves = lk.map(k => store.get(k)).filter((b): b is BaseForecast => !!b);
  if (!leaves.length) return null;
  const [segment, product, productL2, channel, channelL2, tariffL1, tariffL2] = key.split('|');
  return deriveAggregate(leaves, { segment, product, productL2, channel, channelL2,
    tariffL1, tariffL2, scenario: 'Base Case' } as any);
}

// ── CASE 1: the stale aggregate fit is NOT returned ───────────────────────
{
  const got = resolve(AGG_KEY);
  check('CASE 1: the stale aggregate fit is still IN the store',
    store.get(AGG_KEY)?.provenance.kind === 'fitted',
    'the artefact was purged — this rule is read-time, it must not delete');
  check('CASE 1: the seam does NOT return it',
    !!got && got !== store.get(AGG_KEY),
    'the stored fit-on-aggregate won over derivation');
  check('CASE 1: the seam returns a DERIVED aggregate instead',
    !!got && (got.provenance as any).kind === 'derived',
    got ? (got.provenance as any).kind : 'null');
  check('CASE 1: and the derived answer is built from more than one leaf',
    !!got && (got.provenance as any).leafCount > 1,
    got ? String((got.provenance as any).leafCount) : 'n/a');
}

// ── CASE 2: THE SCOPE GUARD. A leaf fit is still returned. ────────────────
// This is the half that catches a broadened rule. Without it, a rule that
// retired every fitted forecast, or every All-bearing one, would pass case 1
// perfectly while deleting the store's entire usefulness.
{
  const leafKey = enumerated.find(k => store.has(k))!;
  const got = resolve(leafKey);
  check('CASE 2 PREMISE: a leaf fit exists to be returned', !!store.get(leafKey));
  check('CASE 2: a FITTED forecast under a LEAF key IS returned',
    got === store.get(leafKey),
    'the rule swallowed a leaf fit — it is too broad');
  check('CASE 2: and it is still fitted, not silently re-derived',
    !!got && (got.provenance as any).kind === 'fitted',
    got ? (got.provenance as any).kind : 'null');
}

// ── The predicate itself, on all four quadrants ───────────────────────────
{
  const fitted = { provenance: { kind: 'fitted' } };
  const derived = { provenance: { kind: 'derived' } };
  const allKey = 'Corporate|All|All|All|All|All|All';
  const leafKey = enumerated[0];
  check('QUADRANT: All-bearing + fitted  -> retired', isRetiredAggregateFit(allKey, fitted));
  check('QUADRANT: All-bearing + derived -> KEPT', !isRetiredAggregateFit(allKey, derived));
  check('QUADRANT: leaf + fitted         -> KEPT', !isRetiredAggregateFit(leafKey, fitted));
  check('QUADRANT: leaf + derived        -> KEPT', !isRetiredAggregateFit(leafKey, derived));
  // A partially-aggregated key is still All-bearing — Jon's artefact is at this
  // depth (Corporate|Fixed Connectivity|All|All|...), not the full roll-up.
  check('QUADRANT: PARTIAL aggregate + fitted -> retired',
    isRetiredAggregateFit('Corporate|Fixed Connectivity|All|All|All|All|All', fitted),
    'a partly-aggregated key is not being recognised as All-bearing');
}

// ── THE WIRING, guarded at the source ─────────────────────────────────────
// Everything above measures the RULE. None of it observes App.tsx, because
// `resolveForecast` and `canResolve` are closures inside App and cannot be
// driven headlessly — `resolve()` above is a transcription of the seam, not
// the seam. That gap is not theoretical: trap 13 restored store-first in
// App.tsx and every check above stayed green. A correct rule that nothing
// calls is worth nothing.
//
// So the wiring gets a source guard, and the guard is STRUCTURAL rather than
// a pinned sentence. Traps 2-4 are the reason: three respellings of one defect
// all walked past a guard that matched trap 1's exact text. The rule here is
// "no return on a store hit in these closures that is not gated by the
// predicate", which has no preferred spelling to evade.
// UPDATE, same session: the seam was extracted to the pure `resolveFromStore`
// in forecasting.ts, so `resolveForecast` no longer contains a store read at
// all. This guard's ANCHOR check caught that immediately — it failed with "the
// seam was renamed or restructured, this guard is now blind" rather than
// passing over a window that no longer existed. That is the whole reason the
// anchor is a separate check from the rule it protects, and it is worth saying
// out loud: the guard's own failure was the first sign the refactor had moved
// something it depended on.
{
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  const engine = fs.readFileSync('src/utils/forecasting.ts', 'utf8');

  // `resolveForecast` must DELEGATE, not reimplement. Two copies of the seam
  // that agree today are the divergence this session already paid for once.
  const rfStart = app.indexOf('const resolveForecast = useCallback');
  check('WIRING ANCHOR: resolveForecast was found', rfStart !== -1);
  if (rfStart !== -1) {
    const body = app.slice(rfStart, app.indexOf('}, [forecastStore, populatedCohorts]);', rfStart))
      .replace(/\/\/[^\n]*/g, '');
    check('WIRING: resolveForecast delegates to the pure seam',
      body.includes('resolveFromStore('), 'it is not calling the seam');
    check('WIRING: and does not read the store itself',
      !body.includes('forecastStore.get('),
      'a second copy of the seam is growing back inside App');
  }

  // The store-first branch now lives in one place. Same structural rule as
  // before, applied where the code actually is.
  const sites = [
    { name: 'resolveFromStore (engine)', get: 'const stored = store.get(key);', src: engine },
    { name: 'canResolve', get: 'const hit = forecastStore.get(key);', src: app },
  ];
  for (const site of sites) {
    const src = site.src;
    const start = src.indexOf(site.get);
    check(`WIRING ANCHOR: ${site.name}'s store read was found`, start !== -1,
      'the seam was renamed or restructured — this guard is now blind, fix it');
    if (start === -1) continue;
    const end = src.indexOf('leafMap.get(key)', start);
    check(`WIRING ANCHOR: ${site.name}'s derivation fallback follows it`,
      end > start, 'window could not be bounded');
    if (end <= start) continue;
    // Comments are prose and must not be able to satisfy a code guard: a
    // window whose only mention of the predicate is the docstring beside it
    // would pass while the call was gone.
    const code = src.slice(start, end).replace(/\/\/[^\n]*/g, '');
    const hitVar = site.get.includes('stored') ? 'stored' : 'hit';
    const returns = code.split('\n').filter(l =>
      /\bif\s*\(/.test(l) && /\breturn\b/.test(l) && new RegExp(`\\b${hitVar}\\b`).test(l));
    check(`WIRING: ${site.name} returns the store hit at all`, returns.length > 0,
      'nothing to guard — the anti-vacuity control for the check below');
    check(`WIRING: every store-hit return in ${site.name} is gated by the predicate`,
      returns.length > 0 && returns.every(l => l.includes('isRetiredAggregateFit')),
      returns.filter(l => !l.includes('isRetiredAggregateFit')).join(' || ') || 'n/a');
  }
}

console.log(`aggregate-retire spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
