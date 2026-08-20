/**
 * THE COMPARE CHART SURVIVES A THIRD FILE, AND SAYS SO WHEN IT CANNOT DRAW.
 *
 *   npm run spec:compare-render
 *
 * Closes the 2026-08-20 third-file diagnosis. That diagnosis measured six
 * file-count states through the real paths and found them structurally
 * identical and wholly finite — so the defect was never in the data, and this
 * file's job is to keep it that way while pinning the render-side fixes the
 * data cannot see.
 *
 * WHAT IT IS CAREFUL ABOUT:
 *
 *  - THE COUNT TRANSITION IS DRIVEN, NOT ASSUMED. chartData is built from the
 *    real merge at 1, 2, 3 and 4 files, and the THREE-FILE shape — the one that
 *    broke on screen — is asserted coherent alongside the two-file shape that
 *    did not.
 *  - THE FLOOR IS A SOURCE PIN, AND SAYS SO. A CSS min-height is not observable
 *    in Node. The check reads the class off the component and is declared as a
 *    source-level anchor rather than dressed up as a measurement.
 *  - THE DRAWABILITY PREDICATE IS DRIVEN DIRECTLY, with hand-written
 *    expectations, including the not-yet-measured case that must NOT report a
 *    fault.
 */
import fs from 'fs';
import { chartDrawability, MIN_DRAWABLE_CHART_PX } from '../src/utils/viewFilter';
import { computeScenarioForFilter } from '../src/utils/scenarioHelper';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURES — a session shaped like the real saves, per file.
// ═══════════════════════════════════════════════════════════════════════════
const MONTHS = Array.from({ length: 24 }, (_, i) => {
  const m = 7 + i, y = 2026 + Math.floor((m - 1) / 12), mm = ((m - 1) % 12) + 1;
  return `${y}-${String(mm).padStart(2, '0')}`;
});

const sessionNamed = (fileName: string, scale: number) => ({
  fileName,
  baselineRows: MONTHS.map(month => ({
    Cohort_Key: `${fileName}|Corporate|Mobile Voice|All|Direct|All|All|All`,
    Segment: 'Corporate', Product: 'Mobile Voice', Product_L2: 'All',
    Channel: 'Direct', Channel_L2: 'All', Tariff_L1: 'All', Tariff_L2: 'All',
    Month: month,
    Seed_Base_Volume: 1000 * scale,
    Last_Historical_Inflow: 100 * scale, Last_Historical_Outflow: 90 * scale,
    Inflow_Mean: 100 * scale, Outflow_Mean: 90 * scale, Retention_Mean: 50 * scale,
    ARPU_Mean: 20 + scale,
  })),
  marketEvents: [], yieldEvents: [], pricingEvents: [],
});

/** The tab's chartData memo, verbatim (ScenarioCompareTab :234-270). */
const chartDataFor = (sessions: any[]) => {
  const allComputed = sessions.map(s => ({
    fileName: s.fileName,
    data: computeScenarioForFilter(s, 'All', { l1: null, l2: null }, { l1: null, l2: null }, { l1: null, l2: null }),
  }));
  const monthMap = new Map<string, any>();
  allComputed.forEach(({ fileName, data }) => {
    data.forEach((row: any) => {
      if (!monthMap.has(row.month)) monthMap.set(row.month, { month: row.month });
      const m = monthMap.get(row.month);
      m[`${fileName}_Base`] = row.adjustedBase;
      m[`${fileName}_Inflow`] = row.adjustedInflow;
      m[`${fileName}_Outflow`] = row.adjustedOutflow;
      m[`${fileName}_Retention`] = row.adjustedRetention;
      m[`${fileName}_ARPU`] = row.adjustedArpu;
      m[`${fileName}_BaselineBase`] = row.baselineBase;
      m[`${fileName}_BaselineARPU`] = row.baselineArpu;
    });
  });
  return Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
};

/** The keys the Base view's <Line dataKey=…> definitions ask Recharts for. */
const plottedKeys = (sessions: any[], showBaseline = true) =>
  sessions.flatMap(s => showBaseline ? [`${s.fileName}_Base`, `${s.fileName}_BaselineBase`] : [`${s.fileName}_Base`]);

// ═══════════════════════════════════════════════════════════════════════════
// 1. THE COUNT TRANSITION — 1, 2, 3 and 4 files
//
// THE THREE-FILE STATE IS THE ONE THAT BROKE ON SCREEN. It is asserted here
// beside the two-file state that did not, so a failure names the count.
// ═══════════════════════════════════════════════════════════════════════════
{
  const files = [1, 2, 3, 4].map(i => sessionNamed(`save-${i}.xlsx`, i));

  for (const n of [1, 2, 3, 4]) {
    const sessions = files.slice(0, n);
    const cd = chartDataFor(sessions);
    const keys = plottedKeys(sessions);

    check(`COUNT ${n}: chartData has one row per month`,
      cd.length === 24, `${cd.length} rows`);

    let missing = 0, nonFinite = 0; let first = '';
    for (const row of cd) for (const k of keys) {
      if (!(k in row)) { missing++; first ||= `MISSING ${k} @ ${row.month}`; }
      else if (!Number.isFinite(Number(row[k]))) { nonFinite++; first ||= `${String(row[k])} @ ${k}`; }
    }
    check(`COUNT ${n}: every plotted key present for every file`, missing === 0, first);
    check(`COUNT ${n}: every plotted value finite`, nonFinite === 0, first);

    // EVERY FILE IS DISTINGUISHABLE. Identical keys across files would let one
    // file's series stand in for another's and this whole block prove nothing.
    const bases = sessions.map(s => cd[0][`${s.fileName}_Base`]);
    check(`COUNT ${n}: each file contributes its OWN series`,
      new Set(bases).size === n, JSON.stringify(bases));

    // The row's key set must be identical across months, or Recharts sees a
    // series appear and vanish mid-chart.
    check(`COUNT ${n}: the key set is identical in every month`,
      new Set(cd.map(r => Object.keys(r).sort().join('|'))).size === 1);
  }

  // THE REGRESSION SHAPE, NAMED. Two files rendered; three did not.
  const two = chartDataFor(files.slice(0, 2));
  const three = chartDataFor(files.slice(0, 3));
  check('THE REPORTED TRANSITION: the three-file state is as coherent as the two-file state',
    two.length === three.length
      && Object.keys(three[0]).length === Object.keys(two[0]).length + 7,
    `two=${Object.keys(two[0]).length} keys, three=${Object.keys(three[0]).length} keys`);
  check('THE REPORTED TRANSITION: adding a third file adds series, never removes any',
    plottedKeys(files.slice(0, 2)).every(k => k in three[0]),
    'a third file must not disturb the first two');
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. THE DRAWABILITY PREDICATE — the fourth state
// ═══════════════════════════════════════════════════════════════════════════
{
  check('DRAWABILITY: enough data and enough room is drawable',
    chartDrawability(24, 400) === 'drawable');
  check('DRAWABILITY: enough data and NO room is too-short — the reported failure',
    chartDrawability(24, 0) === 'too-short',
    'zero height is exactly what the third file produced');
  check('DRAWABILITY: a hair under the floor is too-short',
    chartDrawability(24, MIN_DRAWABLE_CHART_PX - 1) === 'too-short');
  check('DRAWABILITY: exactly the floor is drawable',
    chartDrawability(24, MIN_DRAWABLE_CHART_PX) === 'drawable',
    'the boundary belongs to drawable, or the floor itself would report a fault');
  check('DRAWABILITY: no data outranks the height — the empty state owns that case',
    chartDrawability(0, 0) === 'no-data' && chartDrawability(0, 400) === 'no-data',
    'two messages must not both claim the same blank');

  // NOT YET MEASURED IS NOT A FAULT. Reporting one here would flash the
  // condition on every mount, before the observer has ever fired.
  check('DRAWABILITY: an unmeasured region is drawable, not faulty',
    chartDrawability(24, null) === 'drawable',
    'a fault on first paint would be a false alarm on every mount');
  check('DRAWABILITY: a non-finite measurement is treated as unmeasured',
    chartDrawability(24, NaN) === 'drawable');

  // The floor is a parameter, so the threshold is stated once and testable.
  check('DRAWABILITY: the threshold is injectable',
    chartDrawability(24, 50, 40) === 'drawable' && chartDrawability(24, 30, 40) === 'too-short');
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. WIRING — including the one pin that is source-level, and says so
// ═══════════════════════════════════════════════════════════════════════════
{
  const tabRaw = fs.readFileSync('src/components/ScenarioCompareTab.tsx', 'utf8');
  // COMMENTS STRIPPED, and this is not fastidiousness — guard-trap 93 MISSED
  // because of it. The trap removed the floor from the className, but the
  // comment ABOVE the card explains the fix and contains the same text, so a
  // whole-file regex still matched and the check stayed green. A check that
  // reads prose as code certifies the prose.
  const tab = tabRaw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  // A CSS min-height cannot be observed from Node. This is a SOURCE anchor,
  // declared as such rather than dressed up as a measurement — the standing
  // rule about stating what a check could not exercise.
  //
  // Anchored on the CARD'S OWN className, not on the file: the floor must be
  // on the element that is the sole flex-1, and nowhere else will do.
  const cardClass = (tab.match(/className="flex-1 bg-white p-6[^"]*"/) ?? [''])[0];
  check('FLOOR (source-level): the chart card element carries a minimum height',
    /min-h-\[\d+px\]/.test(cardClass),
    `card className was: ${cardClass || '(card element not found)'}`);
  check('FLOOR (source-level): and does NOT also carry min-h-0',
    !/\bmin-h-0\b/.test(cardClass),
    'two classes emitting min-height leave the winner to CSS source order');
  check('FLOOR (source-level): the floor is at least the drawability threshold',
    Number((cardClass.match(/min-h-\[(\d+)px\]/) ?? [0, '0'])[1]) >= MIN_DRAWABLE_CHART_PX,
    'a floor below the threshold would report a fault about itself');

  check('WIRING: the plotting area is measured',
    tab.includes('ref={chartAreaRef}') && tab.includes('new ResizeObserver('),
    'the fourth state needs a measurement, not an assumption');
  check('WIRING: the measurement feeds the shared predicate',
    (tab.match(/chartDrawability\(/g) ?? []).length === 1,
    'one derivation of can-this-draw');
  check('WIRING: the named condition is rendered when the region is too short',
    tab.includes("drawability === 'too-short'") && tab.includes("t('compare_chart_too_short')"),
    'a silent blank is the failure this closes');
  check('WIRING: the three existing empty-state messages keep their jobs',
    tab.includes("t('compare_no_data_for_selected_filters')")
      && tab.includes("t('compare_events_scope_not_in_baseline')")
      && tab.includes("t('compare_check_at_least_one_scenario_below_to_display')"),
    'the fourth state is an addition, never a replacement');

  // EXONERATED BY MEASUREMENT — pinned so a later session does not "fix" them.
  const helper = fs.readFileSync('src/utils/scenarioHelper.ts', 'utf8');
  check('UNTOUCHED: computeScenarioForFilter still matches on the same columns',
    helper.includes("if (vprodL1 && r.Product !== vprodL1) return false;")
      && helper.includes("if (vseg !== 'All' && r.Segment !== vseg) return false;"),
    'the third-file diagnosis measured six states identical — nothing here was the cause');
  check('UNTOUCHED: windowBounds is still the one window derivation',
    (tab.match(/windowBounds\(/g) ?? []).length === 1);

  const LOCALES = ['en', 'de', 'es', 'fr', 'it', 'pt'];
  const missing = LOCALES.filter(l =>
    typeof JSON.parse(fs.readFileSync(`src/locales/${l}/translation.json`, 'utf8'))['compare_chart_too_short'] !== 'string');
  check('i18n: the named condition exists in all six locales', missing.length === 0, missing.join(', '));
}

console.log(`\ncompare-render spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fails.length ? 1 : 0);
