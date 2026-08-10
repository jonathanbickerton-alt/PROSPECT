/**
 * ABSENCE PROPAGATES THROUGH THE BASE SEED — zero never impersonates it.
 *
 *   npm run spec:base-seed
 *
 * Base volume is never fitted and never stored per month. It is RECONSTRUCTED by
 * rolling an opening stock forward through the forecast flows:
 *
 *   base[t] = max(0, base[t-1] + inflow[t-1] - outflow[t-1])
 *
 * so everything depends on the seed being real. Seeded from a genuine reading it
 * is a stock roll-forward and correct. Seeded from 0 when the stock is simply
 * UNKNOWN it is a seedless integral: a line from the origin climbing at
 * inflow-minus-outflow, which reads as a forecast and is an artefact.
 *
 * THE ALL-OR-ABSENT RULE, and why the seed differs from the flows. Flows are
 * RATES — a leaf contributing no inflow genuinely adds nothing, so zero is the
 * truth. The seed is a STOCK. A leaf excluded from the seed but included in the
 * flows hands the aggregate an opening balance missing that leaf's customers
 * while still counting its joiners and leavers.
 *
 * THE DECLINE CASES HERE ARE CONSTRUCTED, and labelled as such. Three prior
 * sessions established that no shipped fixture and no saved session reaches the
 * absent-seed path: every fixture carries Base rows and the 07 Aug save's 541
 * cohorts all end on the same month. These stores are therefore built to
 * exercise the rule, and they prove its LOGIC rather than its occurrence. A
 * ragged-history fixture variant is recorded in EXPECTED.md as the upgrade that
 * would make the guard-traps behavioural.
 *
 * The CONTINUOUS cases are production-fed on the edge fixture and are what
 * proves the fix changed nothing that was already right.
 */
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import {
  buildCohortDataMap, buildRollUpIndex, calculateBaseForecast, makeForecastKey,
  deriveAggregate, canShowBaseForecast, storedSeedKnown, restoreSeedKnown,
} from '../src/utils/forecasting';
import type { BaseForecast } from '../src/types/forecast';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

const FIX = 'test-data/VBU_IBRO_EdgeCases_ShortHistory_PerScenarioARPU_Jan2023_Jun2026.xlsx';
const C = { date: 'Month', metric: 'IBRO_Scenario_Type', val: 'Subscriber_Volume',
  seg: 'Customer_Segment', prod: 'Product_L1', prodL2: 'Product_L2_Value_Tier',
  chan: 'Channel_Level_1', chanL2: 'Channel_Level_2',
  t1: 'tariff_tier_l1', t2: 'tariff_tier_l2', rev: 'Monthly_Revenue_GBP' };
const wb = XLSX.read(fs.readFileSync(FIX), { type: 'buffer', cellDates: true });
const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
const v = (r: any, k: string) => String(r[k] ?? '').trim();
const mo = (r: any) => String(v(r, C.date)).slice(0, 7);

const dm = buildCohortDataMap(rows, C.date, C.seg, C.prod, C.prodL2, C.chan, C.chanL2, C.t1, C.t2);
const { leafMap } = buildRollUpIndex([...dm.keys()]);

function seriesFor(k: string) {
  const [seg, prod, prodL2, chan, chanL2, t1, t2] = k.split('|');
  const sel = rows.filter(r => v(r, C.seg) === seg && v(r, C.prod) === prod && v(r, C.prodL2) === prodL2
    && v(r, C.chan) === chan && v(r, C.chanL2) === chanL2 && v(r, C.t1) === t1 && v(r, C.t2) === t2);
  const acc = new Map<number, any>();
  for (const r of sel) {
    const d = new Date(mo(r) + '-01'); if (isNaN(d.getTime())) continue;
    const t = d.getTime();
    if (!acc.has(t)) acc.set(t, { _parsedDate: d, inflow: 0, outflow: 0, retention: 0,
      arpu: 0, inflowArpu: 0, outflowArpu: 0, retentionArpu: 0, baseArpu: 0, _rev: 0, _vol: 0 });
    const e = acc.get(t)!, m = v(r, C.metric), val = Number(r[C.val]) || 0;
    if (m === 'Inflow') e.inflow += val; else if (m === 'Outflow') e.outflow += val;
    else if (m === 'Retention') e.retention += val;
    e._rev += Number(r[C.rev]) || 0; e._vol += val;
  }
  for (const e of acc.values()) { e.arpu = e._vol > 0 ? e._rev / e._vol : 0;
    e.inflowArpu = e.arpu; e.outflowArpu = e.arpu; e.retentionArpu = e.arpu; e.baseArpu = e.arpu; }
  return [...acc.values()].sort((a: any, b: any) => a._parsedDate - b._parsedDate);
}

/** The worker's own seed rule: this leaf's last Base-metric reading, or absent. */
function seedOf(k: string): number | null {
  const [seg, prod, prodL2, chan, chanL2, t1, t2] = k.split('|');
  const readings = new Map<string, number>();
  for (const r of rows) {
    if (v(r, C.seg) !== seg || v(r, C.prod) !== prod || v(r, C.prodL2) !== prodL2) continue;
    if (v(r, C.chan) !== chan || v(r, C.chanL2) !== chanL2) continue;
    if (v(r, C.t1) !== t1 || v(r, C.t2) !== t2) continue;
    if (v(r, C.metric) !== 'Base') continue;
    readings.set(mo(r), (readings.get(mo(r)) ?? 0) + (Number(r[C.val]) || 0));
  }
  if (!readings.size) return null;
  return readings.get([...readings.keys()].sort().pop()!)!;
}
const fit = (k: string, seed: number | null) => {
  const [seg, prod, prodL2, chan, chanL2, t1, t2] = k.split('|');
  return calculateBaseForecast(seriesFor(k) as any,
    { segment: seg, product: prod, productL2: prodL2, channel: chan, channelL2: chanL2,
      tariffL1: t1, tariffL2: t2, scenario: 'Base Case' } as any,
    seed, 24, 1.0, 1.5, 3, 'Holt Linear');
};

const SCOPE = makeForecastKey('Corporate', 'Fixed Connectivity', 'All', 'All', 'All', 'All', 'All');
const LEAVES = leafMap.get(SCOPE) ?? [];

// ── PRODUCTION-FED: the continuous case must stay continuous ──────────────
const seeded: BaseForecast[] = [];
for (const k of LEAVES) { const bf = fit(k, seedOf(k)); if (bf) seeded.push(bf); }
check('PREMISE: the scope fitted real leaves', seeded.length >= 3, `${seeded.length}`);
check('PREMISE: and every one carries a KNOWN seed from real Base rows',
  seeded.every(b => b.seedBaseKnown), 'the fixture stopped carrying Base rows');

/** The recursion, exactly as the chart performs it: sorted, floored at zero. */
function roll(bfs: BaseForecast[]): Map<string, number> {
  const per = new Map<string, number>();
  for (const bf of bfs) {
    const sorted = [...bf.months].sort((a, b) => a.month.localeCompare(b.month));
    let b = bf.seedBaseVolume || 0;
    let pIn = bf.lastHistoricalInflow || 0, pOut = bf.lastHistoricalOutflow || 0;
    for (const m of sorted) {
      b = Math.max(0, b + pIn - pOut);
      per.set(m.month, (per.get(m.month) ?? 0) + b);
      pIn = m.inflow.mean; pOut = m.outflow.mean;
    }
  }
  return per;
}

{
  // The aggregate's true last actual Base, for the boundary comparison.
  const aggBase = new Map<string, number>();
  for (const r of rows) {
    if (v(r, C.seg) !== 'Corporate' || v(r, C.prod) !== 'Fixed Connectivity') continue;
    if (v(r, C.metric) !== 'Base') continue;
    aggBase.set(mo(r), (aggBase.get(mo(r)) ?? 0) + (Number(r[C.val]) || 0));
  }
  const lastActual = aggBase.get([...aggBase.keys()].sort().pop()!)!;
  const per = roll(seeded);
  const months = [...per.keys()].sort();
  const first = per.get(months[0])!;

  check('CONTINUITY (aggregate): the first forecast month meets the last actual',
    Math.abs(first - lastActual) / lastActual < 0.02,
    `last actual ${lastActual.toFixed(0)} vs first forecast ${first.toFixed(0)}`);
  check('CONTINUITY (aggregate): and it is NOT the seedless shape',
    first > lastActual * 0.5,
    `first forecast ${first.toFixed(0)} — an origin-start integral`);

  // A single leaf, same recursion, same rule.
  const leaf = seeded[0];
  const lper = roll([leaf]);
  const lfirst = lper.get([...lper.keys()].sort()[0])!;
  const expected = Math.max(0, (leaf.seedBaseVolume || 0)
    + (leaf.lastHistoricalInflow || 0) - (leaf.lastHistoricalOutflow || 0));
  check('CONTINUITY (leaf): the boundary is the IBRO recursion continued',
    Math.abs(lfirst - expected) < 1e-6, `${lfirst} vs ${expected}`);
  check('CONTINUITY (leaf): the zero floor is applied, never a negative stock',
    lfirst >= 0, `${lfirst}`);
}

// ── THE ENGINE: deriveAggregate is all-or-absent ──────────────────────────
{
  const agg = deriveAggregate(seeded, seeded[0].cohort as any);
  check('DERIVE: all leaves present and seeded -> the aggregate seed is KNOWN',
    !!agg && agg.seedBaseKnown === true, String(agg?.seedBaseKnown));
  check('DERIVE: and the seed is the SUM of the leaf seeds, unchanged behaviour',
    !!agg && Math.abs(agg.seedBaseVolume
      - seeded.reduce((s, b) => s + b.seedBaseVolume, 0)) < 1e-6,
    `${agg?.seedBaseVolume}`);

  // CONSTRUCTED: one leaf with no Base rows at all.
  const oneUnseeded = [...seeded.slice(1), { ...seeded[0], seedBaseKnown: false }];
  const aggUnseeded = deriveAggregate(oneUnseeded as BaseForecast[], seeded[0].cohort as any);
  check('DERIVE (constructed): ONE unseeded leaf makes the aggregate seed ABSENT',
    !!aggUnseeded && aggUnseeded.seedBaseKnown === false,
    'a partial stock was summed and passed off as the aggregate opening balance');

  // CONSTRUCTED RAGGED HISTORY: a leaf that does not reach the as-of month.
  // This is the as-of gate specifically — the leaf is seeded, but its history
  // ends early, so its stock at the common as-of month is unknown.
  const short = { ...seeded[0], historicalMonths: seeded[0].historicalMonths.slice(0, -3) };
  const ragged = [...seeded.slice(1), short as BaseForecast];
  const aggRagged = deriveAggregate(ragged as BaseForecast[], seeded[0].cohort as any);
  check('DERIVE (constructed ragged): a leaf short of the as-of month makes it ABSENT',
    !!aggRagged && aggRagged.seedBaseKnown === false,
    'the as-of gate still drops a leaf from the seed while keeping its flows');
}

// ── THE SHARED PREDICATE, which both surfaces read ────────────────────────
{
  check('PREDICATE: a known seed can show Base',
    canShowBaseForecast(seeded[0]) === true);
  check('PREDICATE: an unknown seed cannot',
    canShowBaseForecast({ ...seeded[0], seedBaseKnown: false }) === false);
  check('PREDICATE: and neither can nothing at all',
    canShowBaseForecast(null) === false && canShowBaseForecast(undefined) === false);
}

// ── THE SAVE ROUND TRIP: a blank cell must come back absent ───────────────
// `Number('')` is 0, so the obvious read turns a blank cell into a real zero —
// the exact impersonation this change exists to stop.
{
  check('ROUND TRIP: a real stored number is known', storedSeedKnown(3984) === true);
  check('ROUND TRIP: zero is a REAL stock and stays known', storedSeedKnown(0) === true,
    'a genuinely empty cohort was treated as unknown');
  // THE WRITER, driven — not just the reader. The gate found that the reader
  // was unit-tested on literal inputs while nothing exercised the export, and
  // an unseeded forecast stores 0 for arithmetic safety, so the number alone
  // cannot carry absence: `storedSeedKnown(0)` is correctly TRUE. Without an
  // explicit column a round trip turned "unknown" into "known, and empty".
  check('ROUND TRIP: an explicit known=false column survives, beating the value',
    restoreSeedKnown({ Seed_Base_Volume: 0, Seed_Base_Known: false }) === false,
    'an unseeded forecast comes back as a real opening stock of zero');
  check('ROUND TRIP: and the string form a spreadsheet writes is honoured',
    restoreSeedKnown({ Seed_Base_Volume: 0, Seed_Base_Known: 'FALSE' }) === false,
    'xlsx wrote the boolean as text and it read back as known');
  check('ROUND TRIP: a known seed still restores as known',
    restoreSeedKnown({ Seed_Base_Volume: 3984, Seed_Base_Known: true }) === true);
  // Saves written before the column existed fall back to the value, which is
  // the best available answer for them and is why the fallback stays.
  check('ROUND TRIP: a pre-column save falls back to the value',
    restoreSeedKnown({ Seed_Base_Volume: 3984 }) === true
      && restoreSeedKnown({ Seed_Base_Volume: '' }) === false,
    'older saves lost their seeds entirely');
  check('ROUND TRIP: a blank cell is ABSENT, not zero',
    storedSeedKnown('') === false && storedSeedKnown(null) === false
      && storedSeedKnown(undefined) === false,
    'a blank cell restores as a real opening stock of zero');
}

// ── THE CHART'S DECLINE, read at its source ───────────────────────────────
// The mounted Step 3 surface is exercised by spec:step3-transition; this pins the
// wiring that spec cannot see from inside the component.
{
  const fva = fs.readFileSync('src/components/ForecastVsActualsTab.tsx', 'utf8')
    .replace(/\/\/[^\n]*/g, '');
  check('WIRING: the chart declines when the seed is not known',
    /if \(!canShowBaseForecast\(\{ seedBaseKnown: fcSeedKnown \}\)\) return null;/.test(fva),
    'the Base series is drawn from an unknown stock again');
  check('WIRING: the aggregate seed is all-or-absent at the chart too',
    /fcSeedKnown = matchFcs\.length > 0 && matchFcs\.every\(bf => bf\.seedBaseKnown\)/.test(fva),
    'one unseeded leaf no longer stops the aggregate line');
  // THE SCORER, which is the reader that matters most: it feeds baseScore ->
  // overallScore -> the rendered cell AND the CSV export. A chart line that
  // should not be there is visible and arguable; a KPI scored against a
  // fabricated zero-seeded stock is a number someone writes down. This was
  // unguarded on the first pass and the gate found it.
  const app = fs.readFileSync('src/App.tsx', 'utf8').replace(/\/\/[^\n]*/g, '');
  check('WIRING: the export writes the known-ness column',
    /Seed_Base_Known:\s+bf\.seedBaseKnown,/.test(app),
    'absence cannot survive a save — the number alone cannot carry it');
  check('WIRING: and every import site restores it',
    (app.match(/seedBaseKnown:\s+restoreSeedKnown\(first\),/g) ?? []).length === 3,
    'an import site reconstructs known-ness from the value alone');
  check('WIRING: the SCORER declines on an unknown seed too',
    /if \(!canShowBaseForecast\(derivedForRow\)\) return null;/.test(fva),
    'baseScore is computed from a fabricated zero stock and exported');
  check('WIRING: and the single-forecast path carries the flag',
    /fcSeedKnown = specificForecast\.seedBaseKnown;/.test(fva),
    'a leaf selection draws Base from an unknown stock');
}

// ── UNIT B: BOTH SURFACES ANSWER FROM ONE PREDICATE, BOTH DIRECTIONS ─────
// Step 1's notice used to assert flatly that a summed aggregate HAS no Base
// volume series. That stopped being true when the seed became explicit: Base is
// reconstructed from an opening stock plus flows, so an all-seeded aggregate can
// produce one — and Step 3 draws it. Two surfaces disagreeing about one fact is
// what this closes.
{
  const app2 = fs.readFileSync('src/App.tsx', 'utf8').replace(/\/\/[^\n]*/g, '');
  const en = JSON.parse(fs.readFileSync('src/locales/en/translation.json', 'utf8'));

  check('UNIT B: Step 1 reads the SHARED predicate, not its own rule',
    /canShowBaseForecast\(forecast\)/.test(app2),
    'Step 1 decides for itself again — the surfaces can drift');
  // BOTH DIRECTIONS. A predicate read in one direction only would let Step 1
  // keep claiming impossibility whenever it declined.
  check('UNIT B (can-show): Step 1 stops claiming the series cannot exist',
    /standard_base_panel_has_no_band/.test(app2)
      && !/no Base volume series/i.test(String(en['standard_base_panel_has_no_band'] ?? '')),
    'the impossibility claim survived where Step 3 can reconstruct');
  check('UNIT B (declined): and states the OPENING STOCK reason when it cannot',
    /standard_base_no_opening_stock/.test(app2)
      && /opening base stock/i.test(String(en['standard_base_no_opening_stock'] ?? '')),
    'the decline is unexplained, or explained differently from Step 3');
  check('UNIT B: the two notices are genuinely different messages',
    String(en['standard_base_panel_has_no_band']) !== String(en['standard_base_no_opening_stock']),
    'both branches say the same thing — the predicate changes nothing on screen');
  // The old flat claim must no longer be reachable from the Base branch.
  check('UNIT B: the old impossibility notice is no longer rendered',
    !/standard_base_series_not_derivable/.test(app2),
    'Step 1 still asserts a summed aggregate has no Base series');
}

console.log(`base-seed spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
