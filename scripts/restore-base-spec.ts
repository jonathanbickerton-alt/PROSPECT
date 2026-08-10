/**
 * A RESTORED SESSION'S AGGREGATE KEEPS ITS OPENING STOCK.
 *
 *   npm run spec:restore-base
 *
 * THE BEHAVIOURAL CASE the constructed stores could not be. Every earlier probe
 * built its store by FITTING, which populates `historicalMonths` as a side
 * effect. The restore path does not fit — it reads a save — and it was setting
 * `historicalMonths: []` at all three import sites, discarding the file's own
 * `Historical_Months` column.
 *
 * That is the whole defect, and it is one layer earlier than three sessions of
 * diagnosis looked. `deriveAggregate` takes its as-of month from the union of
 * its leaves' historical months, so empty arrays make `asOf` null and then NO
 * leaf passes the as-of gate. Before seed-or-decline the seed summed to 0 while
 * the flows accumulated — the seedless integral Jon reported, on a session whose
 * leaves all carried real seeds. After it, the same condition surfaced as an
 * honest decline: correct behaviour, wrong input, an OVER-DECLINE.
 *
 * PRODUCTION-FED ON THE REAL SAVE. This drives the actual shared readers the
 * import uses — `parseStoredMonths`, `restoreSeedKnown` — against Jon's own
 * 07 Aug 10:26 file, and resolves through the real seam. It is skipped, loudly,
 * if that file is not present, because a spec that silently passes when its
 * subject is missing is worse than one that is not there.
 */
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import {
  buildRollUpIndex, resolveFromStore, makeForecastKey,
  parseStoredMonths, restoreSeedKnown, canShowBaseForecast,
} from '../src/utils/forecasting';
import type { BaseForecast } from '../src/types/forecast';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

const SAVE = 'C:/Users/jonat/Downloads/PROSPECT Forecast Save — 07 Aug 2026 1026.xlsx';

if (!fs.existsSync(SAVE)) {
  console.log('restore-base spec: SKIPPED — the 07 Aug save is not on this machine.');
  console.log('  This spec is the only BEHAVIOURAL cover for the restore path.');
  console.log('  Expected at: ' + SAVE);
  process.exit(0);
}

const wb = XLSX.read(fs.readFileSync(SAVE), { type: 'buffer', cellDates: true });
const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets['Baseline_Forecasts']);
check('PREMISE: the save has baseline forecasts', rows.length > 1000, `${rows.length}`);

/** Rebuild the store the way the import does, through the SHARED readers. */
const byKey = new Map<string, any[]>();
for (const r of rows) {
  const k = String(r.Cohort_Key ?? '');
  if (!k) continue;
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k)!.push(r);
}
const store = new Map<string, BaseForecast>();
for (const [key, group] of byKey) {
  const first = group[0];
  store.set(key, {
    cohort: {
      segment: String(first.Segment ?? 'All'), product: String(first.Product ?? 'All'),
      productL2: String(first.Product_L2 ?? 'All'), channel: String(first.Channel ?? 'All'),
      channelL2: String(first.Channel_L2 ?? 'All'), tariffL1: String(first.Tariff_L1 ?? 'All'),
      tariffL2: String(first.Tariff_L2 ?? 'All'), scenario: String(first.Scenario ?? 'Standard Forecast'),
    } as any,
    seedBaseVolume: Number(first.Seed_Base_Volume ?? 0),
    seedBaseKnown: restoreSeedKnown(first),
    historicalMonths: parseStoredMonths(first.Historical_Months),
    lastHistoricalInflow: Number(first.Last_Historical_Inflow ?? 0),
    lastHistoricalOutflow: Number(first.Last_Historical_Outflow ?? 0),
    months: group.map(g => ({
      month: String(g.Month),
      inflow: { mean: Number(g.Inflow_Mean ?? 0), optimistic: Number(g.Inflow_Optimistic ?? 0), pessimistic: Number(g.Inflow_Pessimistic ?? 0) },
      outflow: { mean: Number(g.Outflow_Mean ?? 0), optimistic: Number(g.Outflow_Optimistic ?? 0), pessimistic: Number(g.Outflow_Pessimistic ?? 0) },
      retention: { mean: Number(g.Retention_Mean ?? 0), optimistic: Number(g.Retention_Optimistic ?? 0), pessimistic: Number(g.Retention_Pessimistic ?? 0) },
      arpu: { mean: Number(g.ARPU_Mean ?? 0) },
    })).sort((a, b) => a.month.localeCompare(b.month)) as any,
    provenance: { kind: 'fitted', modelUsed: String(first.Model_Used || 'Holt Linear') } as any,
  } as BaseForecast);
}

// ── THE READERS, on this file's real shape ────────────────────────────────
{
  const sample = [...store.values()][0];
  check('RESTORE: months come back populated, not empty',
    sample.historicalMonths.length > 12, `${sample.historicalMonths.length}`);
  check('RESTORE: and they are real yyyy-MM values',
    /^\d{4}-\d{2}$/.test(sample.historicalMonths[0]), sample.historicalMonths[0]);
  check('RESTORE: every restored fit carries a KNOWN seed',
    [...store.values()].every(b => b.seedBaseKnown),
    'the save carries seeds and the reader lost them');
}

// ── THE REPORTED CASE, through the real seam ──────────────────────────────
{
  const leafKeys = [...store.keys()];
  const { leafMap } = buildRollUpIndex(leafKeys);
  const SCOPE = makeForecastKey('Corporate', 'Fixed Connectivity', 'All', 'All', 'All', 'All', 'All');
  const res = resolveFromStore(store as any, leafMap, SCOPE);
  const agg: any = res.forecast;

  check('REPORTED CASE: Corporate|Fixed Connectivity resolves', !!agg, String(res.reason));
  check('REPORTED CASE: its seed is KNOWN — the decline does NOT fire',
    !!agg && canShowBaseForecast(agg) === true,
    'over-decline: a fully-seeded restored session refuses to show Base');
  // Scale, not just presence: Corporate's own stored seed is 123699, so the
  // aggregate's opening stock must be of that order — not a fraction of it,
  // which is what a partial as-of gate would produce.
  check('REPORTED CASE: and the opening stock is ~124K-scale, not a fraction',
    !!agg && agg.seedBaseVolume > 50000,
    `seedBaseVolume ${agg?.seedBaseVolume}`);

  // CONTINUITY: the first forecast month must continue the stock, not restart
  // it at the origin. The seedless shape is what this whole arc is about.
  if (agg) {
    const sorted = [...agg.months].sort((a: any, b: any) => a.month.localeCompare(b.month));
    const first = Math.max(0, (agg.seedBaseVolume || 0)
      + (agg.lastHistoricalInflow || 0) - (agg.lastHistoricalOutflow || 0));
    check('REPORTED CASE: the first forecast base continues the opening stock',
      first > agg.seedBaseVolume * 0.5,
      `first ${first.toFixed(0)} vs seed ${agg.seedBaseVolume}`);
    check('REPORTED CASE: and it is not an origin-start integral',
      first > 1000 && sorted.length > 0, `${first.toFixed(0)}`);
  }
}

// ── THE ARTEFACT, REPRODUCED — the causal chain on the real file ─────────
// This is what three sessions could not produce. Rebuild the SAME store with
// the months discarded, exactly as the restore used to, and watch the reported
// symptom appear from data that carries every seed it needs.
{
  const leafKeys = [...store.keys()];
  const { leafMap } = buildRollUpIndex(leafKeys);
  const SCOPE = makeForecastKey('Corporate', 'Fixed Connectivity', 'All', 'All', 'All', 'All', 'All');

  const oldWay = new Map<string, BaseForecast>();
  for (const [k, bf] of store) oldWay.set(k, { ...bf, historicalMonths: [] });

  const agg: any = resolveFromStore(oldWay as any, leafMap, SCOPE).forecast;
  check('ARTEFACT: with months discarded the aggregate still resolves',
    !!agg, 'the reproduction premise is broken');
  check('ARTEFACT: but its opening stock is ABSENT — every leaf fails the as-of gate',
    !!agg && canShowBaseForecast(agg) === false,
    'the reproduction did not reproduce; the cause is elsewhere');
  // THE ORIGINAL SYMPTOM. Before seed-or-decline this same condition summed the
  // seed to 0 and the chart rolled it forward from the origin — Jon's 40K climb.
  check('ARTEFACT: and the seed sums to ZERO, which is the seedless integral',
    !!agg && agg.seedBaseVolume === 0,
    `seed ${agg?.seedBaseVolume} — expected 0, the origin-start shape`);
  // The contrast is the whole finding: same file, same seeds, months alone.
  const fixed: any = resolveFromStore(store as any, leafMap, SCOPE).forecast;
  check('ARTEFACT CONTRAST: the only difference is the months',
    !!fixed && fixed.seedBaseVolume > 50000 && agg.seedBaseVolume === 0,
    `fixed ${fixed?.seedBaseVolume} vs discarded ${agg?.seedBaseVolume}`);
}

// ── THE WIRING, at its source ─────────────────────────────────────────────
{
  const app = fs.readFileSync('src/App.tsx', 'utf8').replace(/\/\/[^\n]*/g, '');
  check('WIRING: no import site discards the saved months',
    !/historicalMonths:\s+\[\],/.test(app),
    'a restore drops Historical_Months again — asOf goes null and every leaf fails the gate');
  check('WIRING: all three sites use the shared parser',
    (app.match(/historicalMonths:\s+parseStoredMonths\(first\.Historical_Months\),/g) ?? []).length === 3,
    'the sites disagree about how to read one column');
}

console.log(`restore-base spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
