/**
 * THE STEP 1 CHART DRAWS BOTH LINES FROM ONE POPULATION.
 *
 *   npm run spec:chart-scope
 *
 * `arpuChartData` rebuilt its historical series from the raw rows using a
 * segment + product + channel filter only. The forecast beside it was fitted by
 * `generateStandardForecast`, which filters on all SEVEN dimensions. So for any
 * selection with a Product L2, Channel L2 or tariff set, the chart drew history
 * for a much larger population than the forecast it was being compared against
 * — labelled Historical and Mean, on one axis, as though they were the same
 * thing measured before and after.
 *
 * This measures the gap on a real leaf, pins it, and asserts it is closed.
 *
 * WHY THE VOLUME SERIES NEEDED NOTHING. The extension asked whether
 * `stdChartData` carried the same filter. It does not, and the reason is
 * structural rather than lucky: it is derived from `forecastData`, which is the
 * output of the fit's own seven-dimension `processedData` chain, so its history
 * cannot disagree with its forecast about scope. Only the ARPU view rebuilt the
 * series from raw data, and only it could drift. Checked, not assumed — the
 * check is at the bottom of this file.
 *
 * The fix copies the fit's semantics rather than tightening them. An L2 or
 * tariff filter applies only when a value is SET, because that is what the fit
 * does; filtering more strictly here would recreate the disagreement from the
 * other side.
 */
import * as fs from 'fs';
import * as XLSX from 'xlsx';

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

/** A concrete leaf selection — every dimension set, which is the case that drifts. */
const SEL = (() => {
  const r = rows.find(x => v(x, C.prodL2) && v(x, C.chanL2) && v(x, C.t1) && v(x, C.t2))!;
  return { seg: v(r, C.seg), prod: v(r, C.prod), prodL2: v(r, C.prodL2),
           chan: v(r, C.chan), chanL2: v(r, C.chanL2), t1: v(r, C.t1), t2: v(r, C.t2) };
})();
check('PREMISE: a fully-specified leaf selection exists in the fixture',
  !!SEL.prodL2 && !!SEL.t1, JSON.stringify(SEL));

/** The OLD filter: segment + product + channel only. */
const oldScope = (r: any) =>
  v(r, C.seg) === SEL.seg && v(r, C.prod) === SEL.prod && v(r, C.chan) === SEL.chan;

/** The NEW filter, and also what generateStandardForecast's chain produces. */
const newScope = (r: any) =>
  oldScope(r) && v(r, C.prodL2) === SEL.prodL2 && v(r, C.chanL2) === SEL.chanL2
  && v(r, C.t1) === SEL.t1 && v(r, C.t2) === SEL.t2;

const oldRows = rows.filter(oldScope);
const newRows = rows.filter(newScope);

/** Volume-weighted ARPU, the figure the chart's Historical line plots. */
const arpuOf = (rs: any[]) => {
  let rev = 0, vol = 0;
  for (const r of rs) { rev += Number(r[C.rev]) || 0; vol += Number(r[C.value]) || 0; }
  return vol > 0 ? rev / vol : 0;
};

const oldArpu = arpuOf(oldRows);
const newArpu = arpuOf(newRows);
const ratio = oldRows.length / Math.max(1, newRows.length);
const gapPct = Math.abs(oldArpu - newArpu) / Math.max(1e-9, newArpu) * 100;

console.log(`  scope: old ${oldRows.length} rows (ARPU ${oldArpu.toFixed(2)})  ->  new ${newRows.length} rows (ARPU ${newArpu.toFixed(2)})`);
console.log(`  row ratio ${ratio.toFixed(1)}x   ARPU gap ${gapPct.toFixed(1)}%`);

// ── The defect, measured ──────────────────────────────────────────────────
check('BEFORE: the old filter really did cover a much larger population',
  oldRows.length > newRows.length * 5,
  `${oldRows.length} vs ${newRows.length} — if these are close the fixture no longer exercises the drift`);
check('BEFORE: and the two populations disagree about ARPU',
  gapPct > 20, `gap ${gapPct.toFixed(1)}%`);
// Anti-vacuity: a gap proves nothing if the narrow scope is empty.
check('BEFORE: the narrow scope is non-empty — the gap is a disagreement, not an absence',
  newRows.length > 0 && newArpu > 0, `${newRows.length} rows, ARPU ${newArpu.toFixed(2)}`);

// ── The fix, in the source ────────────────────────────────────────────────
{
  const tab = fs.readFileSync('src/components/StandardForecastTab.tsx', 'utf8');
  const start = tab.indexOf('const arpuChartData = useMemo');
  check('ANCHOR: arpuChartData was found', start !== -1,
    'renamed or removed — this guard is blind, fix it');
  const body = start === -1 ? '' : tab.slice(start, tab.indexOf('const rows: any[] = [];', start));
  const code = body.replace(/\/\/[^\n]*/g, '');

  for (const [dim, col, val] of [
    ['Product L2', 'wiProductL2Col', 'productL2Value'],
    ['Channel L2', 'wiChannelL2Col', 'channelL2Value'],
    ['Tariff L1',  'wiTariffL1Col',  'tariffValue'],
    ['Tariff L2',  'wiTariffL2Col',  'tariffL2Value'],
  ] as const) {
    check(`AFTER: the historical filter reads ${dim}`,
      code.includes(col) && code.includes(val),
      `${col}/${val} absent — history is still drawn wider than the fit`);
  }

  // The memo must RE-RUN when those selections change, or the fix is correct
  // and stale: the user narrows the tariff and the chart keeps the old line.
  const depsStart = tab.indexOf('}, [baseForecast, data', start);
  const deps = tab.slice(depsStart, tab.indexOf(']);', depsStart));
  for (const d of ['productL2Value', 'channelL2Value', 'tariffValue', 'tariffL2Value',
                   'wiProductL2Col', 'wiChannelL2Col', 'wiTariffL1Col', 'wiTariffL2Col']) {
    check(`AFTER: ${d} is in the dependency array`, deps.includes(d),
      'the memo reads it but will not recompute when it changes');
  }

  // Semantics must MATCH the fit, not exceed it.
  check('AFTER: L2 filters apply only when a value is set, as the fit does',
    /wiProductL2Col && productL2Value/.test(code) && /wiChannelL2Col && channelL2Value/.test(code),
    'filtering unconditionally would disagree with the fit from the other side');
  check('AFTER: the tariff L2 filter is nested inside the tariff L1 branch, as the fit does',
    code.indexOf('wiTariffL2Col') > code.indexOf('wiTariffL1Col'),
    'tariff L2 applied independently of L1');
}

// ── The volume series: checked, not assumed ───────────────────────────────
{
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  const start = app.indexOf('const stdChartData = useMemo');
  check('VOLUME ANCHOR: stdChartData was found', start !== -1);
  const body = start === -1 ? '' : app.slice(start, app.indexOf('}, [forecastData', start));

  // It must NOT rebuild from raw data with its own dimension filter — that is
  // the shape that drifted. It reads forecastData, which the fit already scoped.
  check('VOLUME: the series is derived from forecastData, not from raw data',
    /forecastData/.test(body) && !/wiSegmentCol/.test(body),
    'stdChartData grew its own dimension filter — it can now drift like the ARPU one did');
  check('VOLUME: and it applies no dimension filter of its own',
    !/wiProductL2Col|wiTariffL1Col|segmentValue|productValue|channelValue/.test(body),
    'a second scoping rule has appeared where there was none');

  // And the fit really does filter on all seven, which is what makes the
  // volume series safe. If this ever stops being true, the volume series
  // inherits the defect silently.
  const gsf = app.indexOf('const generateStandardForecast');
  const gsfBody = app.slice(gsf, app.indexOf('const bfSeries', gsf) > gsf
    ? app.indexOf('const bfSeries', gsf) : gsf + 12000);
  for (const col of ['wiProductL2Col', 'wiChannelL2Col', 'wiTariffL1Col', 'wiTariffL2Col']) {
    check(`VOLUME: the fit still filters on ${col} — what makes the volume series safe`,
      gsfBody.includes(col),
      'the fit narrowed; the volume chart now inherits the ARPU defect');
  }
}

// ── The metric axis is POOLED on purpose — do not "fix" it ───────────────
// A gate reviewer flagged that arpuChartData never filters by scenario/metric
// while generateStandardForecast's processedData does, and read that as the
// same population defect on an eighth axis. It is not, and the reason is worth
// pinning because the flag was reasonable.
//
// processedData is the VOLUME series' scope: it filters to ONE metric because
// it is fitting that metric's volume. The chart's ARPU line plots the BLENDED
// arpu, and the fit builds that as totalRev/totalSubs summed across all four
// metrics (App.tsx, second pass in the manual generation path). A blended
// figure needs a blended denominator. Filtering the history by metric would
// introduce the mismatch, not remove it.
{
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  check('METRIC: the fit blends ARPU across all four metrics',
    /const totalSubs = ia\.subs \+ oa\.subs \+ ra\.subs \+ ba\.subs;/.test(app)
      && /entry\.arpu = totalRev \/ totalSubs;/.test(app),
    'the blended ARPU is no longer pooled — the history must now match whatever it does');
  const tab = fs.readFileSync('src/components/StandardForecastTab.tsx', 'utf8');
  const start = tab.indexOf('const arpuChartData = useMemo');
  const body = tab.slice(start, tab.indexOf('const rows: any[] = [];', start));
  check('METRIC: and the ARPU history pools them too, matching it',
    !/wiMetricCol/.test(body),
    'a metric filter was added to the ARPU history — it now disagrees with the blended fit');
  // The chart must actually be plotting the blended series, or the two checks
  // above are about a number nobody sees.
  check('METRIC: the chart plots the blended arpu, not a per-scenario one',
    /'Mean \(Base\)': m\.arpu\.mean/.test(tab),
    'the chart switched to a per-scenario ARPU — the pooling argument no longer applies');
}

console.log(`chart-scope spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
