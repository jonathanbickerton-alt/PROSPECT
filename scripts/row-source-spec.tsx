/**
 * REQ-D8-01 — THE ROW-SOURCE SEAM, THE COLUMN LIST, RESTORED FORECAST SETTINGS.
 *
 *   npm run spec:row-source
 *
 * WHAT IT PROVES.
 *  (S) Structure: the baseline, actuals and restore functions parse nothing
 *      (no sheet_to_json, no XLSX.read); the restore reads every sheet through
 *      ONE accessor; ONE function builds the save record and the export only
 *      serialises it.
 *  (i) Baseline: the trimmed fixture through the file path, and the same rows
 *      handed straight to applyBaselineRows, give identical `data` and
 *      `columns`; the Market_Events sheet beside the data is read.
 *  (ii) Restore: an in-memory session restored through the workbook (written,
 *      read back, sheetRowsFromWorkbook) and through the record path gives
 *      identical restored state.
 *  (iii) Save: the save record equals the sheets the writer emits, read back.
 *  (iv) Every comparison is anchored to hand-written literals, three or more
 *      cells per sheet. A comparison of two paths through the same code would
 *      stay green if both broke the same way; the literals would not.
 *  (C) Clause 21: the column list is the union of keys over all rows, and every
 *      auto-detect role, by name, picks the same column before and after.
 *  (M) Clause 22, MOUNTED: App itself is mounted, a session is dropped on the
 *      real Import Save input, and the Step 1 settings controls are read.
 *
 * App IS MOUNTABLE HEADLESSLY. Earlier specs (ingest, nav-target) record that
 * it is not; measured 2026-11-06, it renders under JSDOM given a Worker stub,
 * and the Import Save journey runs end to end through FileReader.
 */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',
  { url: 'http://localhost/', pretendToBeVisual: true });
const g = globalThis as any;
g.window = dom.window; g.document = dom.window.document;
Object.defineProperty(g, 'navigator', { value: dom.window.navigator, configurable: true, writable: true });
g.HTMLElement = dom.window.HTMLElement; g.Element = dom.window.Element; g.Node = dom.window.Node;
g.SVGElement = dom.window.SVGElement;
g.getComputedStyle = dom.window.getComputedStyle;
g.requestAnimationFrame = (cb: any) => setTimeout(() => cb(Date.now()), 0);
g.cancelAnimationFrame = clearTimeout;
g.MutationObserver = dom.window.MutationObserver;
g.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
g.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
g.IS_REACT_ACT_ENVIRONMENT = true;
g.File = dom.window.File; g.FileReader = dom.window.FileReader; g.Blob = dom.window.Blob;
// App constructs workers for bulk generation; none runs in these journeys.
g.Worker = class { postMessage() {} terminate() {} addEventListener() {} removeEventListener() {} onmessage = null; };

import fs from 'fs';
import * as XLSX from 'xlsx';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? '  [' + d + ']' : '')); };
const J = (v: unknown) => JSON.stringify(v, (_k, x) => (x instanceof Map ? [...x.entries()] : x));

const FIXTURE = 'test-data/VBU_IBRO_Trimmed_TariffHierarchy_Jan2023_Jun2026.xlsx';

// ── (S) STRUCTURE ─────────────────────────────────────────────────────────
const appRaw = fs.readFileSync('src/App.tsx', 'utf8');
const app = appRaw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const moduleFn = (name: string) => {
  const s = app.indexOf(`export function ${name}(`);
  return s < 0 ? '' : app.slice(s, app.indexOf('\n}\n', s) + 2);
};
const componentFn = (name: string) => {
  const s = app.indexOf(`  const ${name} = `);
  return s < 0 ? '' : app.slice(s, app.indexOf('\n  };\n', s) + 5);
};
const count = (s: string, x: string | RegExp) => typeof x === 'string' ? s.split(x).length - 1 : (s.match(x) ?? []).length;
{
  const baseline = moduleFn('applyBaselineRows');
  const actuals = componentFn('applyActualsRows');
  const restore = moduleFn('restoreSessionSheets');
  const saveRec = moduleFn('buildSessionSheetRecord');
  const exportFn = componentFn('exportSession');
  for (const [n, body] of [['applyBaselineRows', baseline], ['applyActualsRows', actuals], ['restoreSessionSheets', restore]] as const) {
    check(`(S) ${n} was located`, body.length > 200, String(body.length));
    check(`(S) ${n} contains ZERO sheet_to_json calls`, count(body, 'sheet_to_json') === 0, String(count(body, 'sheet_to_json')));
    check(`(S) ${n} contains ZERO XLSX.read calls`, count(body, 'XLSX.read') === 0, String(count(body, 'XLSX.read')));
  }
  check('(S) the restore has exactly ONE accessor', count(restore, /const sheetRows = /g) === 1);
  check('(S) and reads all 11 sheets through it', count(restore, /sheetRows\('/g) === 11, String(count(restore, /sheetRows\('/g)));
  check('(S) the restore never touches a workbook', !/\bwb\b/.test(restore));
  check('(S) the baseline function reads Market_Events from the sheets it is given',
    /toLowerCase\(\) === 'market_events'/.test(baseline) && /marketEventFromRow\(r, 'workbook'\)/.test(baseline));
  check('(S) exactly ONE function builds the save record', count(app, 'export function buildSessionSheetRecord(') === 1
    && count(app, 'buildSessionSheetRecord(') === 2);
  check('(S) exportSession only serialises it: one record, one writer, no per-sheet calls',
    count(exportFn, 'buildSessionSheetRecord(') === 1 && count(exportFn, 'workbookFromSheetRows(record)') === 1
      && count(exportFn, 'json_to_sheet') === 0 && count(exportFn, 'book_append_sheet') === 0);
  check('(S) Import Save and the drop-zone routing both go through the workbook wrapper',
    count(app, 'applyImportSaveFromWorkbook(wb)') === 2 && count(app, 'applyImportSaveWorkbook(sheetRowsFromWorkbook(wb), wb.SheetNames)') === 1);
  check('(S) the upload builds its sheet record through the same wrapper',
    count(componentFn('handleFileUpload'), 'sheetRowsFromWorkbook(wb)') === 1
      && count(componentFn('handleFileUpload'), 'sheet_to_json') === 0);
  check('(S) the actuals file path parses sheet [0] once and hands the rows on',
    count(componentFn('handleImportActualsFile'), 'sheet_to_json(wb.Sheets[sheetName])') === 1
      && count(componentFn('handleImportActualsFile'), 'applyActualsRows(rows)') === 1);
  // The restore's sheet list is read where the restore needs names only.
  check('(S) the readWorkbook options are still type:array, cellDates:true (the file path below relies on them)',
    app.includes("XLSX.read(evt.target?.result, { type: 'array', cellDates: true })"));
  // Clause 21 at its three sites, and no row-0 list left.
  check('(C) the union helper is used at the baseline, the restore and the actuals append',
    count(baseline, 'columnsFromRows(jsonData)') === 1 && count(restore, 'columnsFromRows(actualsRaw)') === 1
      && count(componentFn('handleImportActualsConfirm'), 'columnsFromRows(toAppend, prev)') === 1);
  check('(C) no column list is built from row 0 any more',
    !/Object\.keys\((jsonData|actualsRaw|toAppend)\[0\]/.test(app));
  // Clause 22: three fields read; forecast length HELD (no setter exists).
  check('(M) the restore reads the three settings that have a setter',
    restore.includes("restoreSetting('Pre_Horizon_Uncertainty_Pct', setPreHorizonUncertainty)")
      && restore.includes("restoreSetting('Post_Horizon_Expansion_Rate_Pct', setPostHorizonExpansionRate)")
      && restore.includes("restoreSetting('Confidence_Horizon_Months', setConfidenceHorizon)"));
  check('(M) HELD: Forecast_Length_Months is not read (stdForecastLength has no setter)',
    !restore.includes("getMetaValue('Forecast_Length_Months')") && !restore.includes("restoreSetting('Forecast_Length_Months'")
      && app.includes('const [stdForecastLength] = useState(24);'));
}

// ── A RECORDING SINK ──────────────────────────────────────────────────────
// Holds what each setter was last given, applying functional updaters to the
// held value, so two restores can be compared state for state.
function recorder(initial: Record<string, any> = {}) {
  const state: Record<string, any> = { ...initial };
  const sink: any = new Proxy({}, {
    get: (_t, k: string) => {
      if (k === 't') return (key: string) => key;
      if (k === 'makeForecastKey') return fc.makeForecastKey;
      return (v: any) => { state[k] = typeof v === 'function' ? v(state[k]) : v; };
    },
  });
  return { state, sink };
}
let fc: any;

async function main() {
  fc = await import('../src/utils/forecasting');
  const rs = await import('../src/utils/rowSource');
  const A: any = await import('../src/App');
  const vf: any = await import('../src/utils/viewFilter');

  // ── (i) BASELINE ────────────────────────────────────────────────────────
  {
    const bytes = fs.readFileSync(FIXTURE);
    // The file path: readWorkbook's options (pinned above), then the wrapper,
    // then the upload's own sheet choice, then the hand-off.
    const wb = XLSX.read(new Uint8Array(bytes), { type: 'array', cellDates: true });
    const sheets = rs.sheetRowsFromWorkbook(wb);
    const actualsName = wb.SheetNames.find((n: string) => n.toLowerCase() === 'actuals') || wb.SheetNames[0];
    const viaFile = recorder();
    A.applyBaselineRows(sheets[actualsName], 12, sheets, viaFile.sink);
    // The rows path: rows read by this spec, handed straight in, no sheets.
    const rows = XLSX.utils.sheet_to_json(XLSX.read(bytes, { type: 'buffer', cellDates: true }).Sheets['Fact_IBRO']);
    const viaRows = recorder();
    A.applyBaselineRows(rows, 12, undefined, viaRows.sink);
    check('(i) the same data through the file path and the rows path', J(viaFile.state.setData) === J(viaRows.state.setData));
    check('(i) the same columns through both', J(viaFile.state.setColumns) === J(viaRows.state.setColumns));
    const d = viaRows.state.setData ?? [];
    check('(iv) the fixture is the trimmed one: 12,432 rows, sheet Fact_IBRO', d.length === 12432 && actualsName === 'Fact_IBRO', `${d.length} ${actualsName}`);
    check('(iv) row 0: Month 2023-01, Customer_Segment SOHO, Subscriber_Volume 3891, IBRO_Scenario_Type Base',
      d[0]?.Month === '2023-01' && d[0]?.Customer_Segment === 'SOHO' && d[0]?.Subscriber_Volume === 3891 && d[0]?.IBRO_Scenario_Type === 'Base');
    check('(iv) row 1 carries Applied_Flow_Rate_% = 11.11; the last row is 2026-06 at 112',
      d[1]?.['Applied_Flow_Rate_%'] === 11.11 && d[d.length - 1]?.Month === '2026-06' && d[d.length - 1]?.Subscriber_Volume === 112);
    check('(i) the success line and the cleared chart are set on both paths',
      viaFile.state.setLoadedLine === viaRows.state.setLoadedLine && J(viaRows.state.setForecastData) === '[]');

    // ── (C) CLAUSE 21 — measured on this fixture ──────────────────────────
    const BEFORE = ['Month', 'Customer_Segment', 'Product_L1', 'Product_L2_Value_Tier', 'tariff_tier_l1', 'tariff_tier_l2',
      'IBRO_Scenario_Type', 'Channel_Level_1', 'Channel_Level_2', 'Subscriber_Volume', 'Customer_Volume',
      'Avg_Subscribers_per_Customer', 'Avg_Unit_Price_GBP', 'Monthly_Revenue_GBP', 'Annualised_Revenue_GBP',
      'Accounting_View', 'Refresh_Frequency', 'Simulation_Type'];
    const AFTER = [...BEFORE, 'Applied_Flow_Rate_%'];
    check('(C) BEFORE (row 0 keys) is the 18-column list', J(Object.keys(rows[0] as object)) === J(BEFORE));
    check('(C) AFTER (the union) is the 19-column list, Applied_Flow_Rate_% last', J(viaRows.state.setColumns) === J(AFTER),
      J(viaRows.state.setColumns));
    const ROLES: Record<string, string> = {
      dateCol: 'Month', targetCol: 'Subscriber_Volume', segmentCol: 'Customer_Segment', productCol: 'Product_L1',
      channelCol: 'Channel_Level_1', wiDateCol: 'Month', wiMetricCol: 'IBRO_Scenario_Type', wiValueCol: 'Subscriber_Volume',
      wiCustomerCol: 'Customer_Segment', wiRevenueCol: 'Monthly_Revenue_GBP', wiArpuCol: '', wiSegmentCol: 'Customer_Segment',
      wiProductCol: 'Product_L1', wiProductL2Col: 'Product_L2_Value_Tier', wiChannelCol: 'Channel_Level_1',
      wiChannelL2Col: 'Channel_Level_2', wiTariffL1Col: 'tariff_tier_l1', wiTariffL2Col: 'tariff_tier_l2',
      dataTypeCol: 'IBRO_Scenario_Type',
    };
    const rb: any = A.detectColumnRoles(BEFORE), ra: any = A.detectColumnRoles(AFTER);
    check('(C) detectColumnRoles names exactly the 19 roles', J(Object.keys(ra).sort()) === J(Object.keys(ROLES).sort()));
    for (const [role, col] of Object.entries(ROLES)) {
      check(`(C) role ${role}: '${col}' before and after`, rb[role] === col && ra[role] === col, `${rb[role]} / ${ra[role]}`);
    }
    // The append: a header first seen on a LATER appended row is added.
    const appended = rs.columnsFromRows([{ Month: 'x', Subscriber_Volume: 1 }, { Month: 'y', New_Col: 2 }], BEFORE);
    check('(C) the actuals append adds a header first seen on row 2, after the current list',
      J(appended) === J([...BEFORE, 'New_Col']));

    // The Market_Events read beside the data (the fixture has none).
    const evSheets = {
      Actuals: [{ Month: '2024-01', Subscriber_Volume: 5 }],
      Market_Events: [{ Name: 'Launch A', Scenario: 'Inflow', Segment: 'SOHO', Product: 'All', Channel: 'All',
        Start_Month: '2024-03', Subscriber_Volume: 250 }],
    };
    const ev = recorder();
    A.applyBaselineRows(evSheets.Actuals, 3, evSheets, ev.sink);
    const evs = ev.state.setMarketEvents ?? [];
    check('(i) the Market_Events sheet beside the data is read: one event, Launch A, 250 in 2024-03',
      evs.length === 1 && evs[0]?.name === 'Launch A' && evs[0]?.subscriberVolume === 250 && evs[0]?.date === '2024-03',
      J(evs));
    check('(i) no Market_Events sheet, no event write', !('setMarketEvents' in viaRows.state) && !('setMarketEvents' in viaFile.state));
  }

  // ── A SESSION, BUILT BY HAND ────────────────────────────────────────────
  const band = (m: number) => ({ mean: m, optimistic: m + 10, pessimistic: m - 10 });
  const leaf = (product: string, base: number) => ({
    // REAL LEAVES — every part specific. A key with an 'All' part is an aggregate,
    // which the restored leaf index never enumerates, so it would not resolve.
    cohort: { segment: 'SOHO', product, productL2: product + '_Std', channel: 'Online', channelL2: 'Web', tariffL1: 'Unlimited', tariffL2: 'Unlimited_24m', scenario: 'Standard Forecast' },
    seedBaseVolume: base, seedBaseKnown: true, historicalMonths: ['2025-11', '2025-12'],
    lastHistoricalInflow: 40, lastHistoricalOutflow: 30,
    provenance: { kind: 'fitted', modelUsed: 'Holt Linear' }, seasonalFallback: false,
    months: [
      { month: '2026-01', inflow: band(100), outflow: band(80), retention: band(1000), arpu: band(20) },
      { month: '2026-02', inflow: band(110), outflow: band(85), retention: band(1025), arpu: band(21) },
    ],
  });
  const leafA = leaf('Mobile', 1000), leafB = leaf('Broadband', 500);
  const keyOf = (bf: any) => fc.makeForecastKey(bf.cohort.segment, bf.cohort.product, bf.cohort.productL2, bf.cohort.channel, bf.cohort.channelL2, bf.cohort.tariffL1, bf.cohort.tariffL2);
  const store = new Map<string, any>([[keyOf(leafA), leafA], [keyOf(leafB), leafB]]);
  const mev = fc.marketEventFromRow({ ID: 'ev-1', Name: 'Spring push', Scenario: 'Inflow', Segment: 'SOHO', Product: 'Mobile', Channel: 'Online',
    Start_Month: '2026-02', Subscriber_Volume: 300, Sequence: 1 }, 'session');
  const yev = fc.yieldEventFromRow({ ID: 'y-1', Name: 'Yield lift', Segment: 'SOHO', Product: 'Mobile', Channel: 'Online', Start_Month: '2026-01' });
  const pev = fc.pricingEventFromRow({ ID: 'p-1', Name: 'Price rise', Segment: 'SOHO', Product: 'Mobile', Channel: 'Online', Start_Month: '2026-02' });
  const sessionState = (over: Record<string, any> = {}) => ({
    data: [{ Month: '2025-12', Customer_Segment: 'SOHO', Subscriber_Volume: 900 }, { Month: '2025-12', Customer_Segment: 'SOHO', Subscriber_Volume: 950, Extra_Col: 'late' }],
    wiDateCol: 'Month', baseForecast: leafA, forecastStore: store, cohortGenLog: [],
    bulkRuns: [{ id: 'run-1', name: 'Nightly', comment: 'c', timestamp: '2026-01-05T10:00:00.000Z', cohortIds: [keyOf(leafA)], generated: 1, failed: 0,
      settings: { model: 'Holt Linear', preHorizonUncertainty: 1.5, postHorizonExpansionRate: 2.25, confidenceHorizon: 2, forecastLength: 12 } }],
    preHorizonUncertainty: 7, postHorizonExpansionRate: 4, confidenceHorizon: 5, stdForecastLength: 18,
    marketEvents: [mev], adjustedForecast: null, carriedAdjustedRows: null, modelAcceptanceLog: [],
    yieldEvents: [yev], pricingEvents: [pev],
    oneOffMonths: { [keyOf(leafA)]: [{ month: '2025-06', reason: 'Outage' }] },
    selectedTariffs: ['Unlimited'], activeView: 'standard',
    viewFilter: vf.cohortToFilter(leafA.cohort), savedForecasts: {},
    ...over,
  });
  const TS = new Date(2026, 10, 6, 15, 55);
  const record = A.buildSessionSheetRecord(sessionState(), TS);
  const NAMES = ['Actuals', 'Baseline_Forecasts', 'Market_Events', 'Adjusted_Forecasts', 'Bulk_Generation_History',
    'Model_Acceptance_Log', 'Yield_Events', 'Pricing_Events', 'One_Off_Months', 'Tariff_Selection', 'Metadata'];
  const writeRead = (rec: Record<string, any[]>) => {
    const buf = XLSX.write(rs.workbookFromSheetRows(rec), { type: 'array', bookType: 'xlsx' });
    return XLSX.read(buf, { type: 'array', cellDates: true });
  };

  // ── (iii) SAVE — the record IS what the writer emits ────────────────────
  {
    check('(iii) the record has the 11 sheets, in the export\'s order', J(Object.keys(record)) === J(NAMES), J(Object.keys(record)));
    const back = writeRead(record);
    check('(iii) the writer emits the same 11 sheets in the same order', J(back.SheetNames) === J(NAMES));
    for (const n of NAMES) {
      const rows = XLSX.utils.sheet_to_json(back.Sheets[n]);
      check(`(iii) ${n}: the record equals the sheet read back`, J(rows) === J(record[n]), `${String(J(rows)).slice(0, 160)} vs ${String(J(record[n])).slice(0, 160)}`);
    }
    // (iv) three hand-written cells per sheet, on the record itself.
    const meta = (f: string) => record.Metadata.find((r: any) => r.Field === f)?.Value;
    const R = record as any;
    const lit: [string, () => boolean][] = [
      ['Actuals', () => R.Actuals.length === 2 && R.Actuals[0]?.Subscriber_Volume === 900 && R.Actuals[1].Extra_Col === 'late' && R.Actuals[0]?.Month === '2025-12'],
      ['Baseline_Forecasts', () => R.Baseline_Forecasts.length === 4 && R.Baseline_Forecasts[0]?.Inflow_Mean === 100 && R.Baseline_Forecasts[1].Retention_Mean === 1025 && R.Baseline_Forecasts[0]?.Is_Active === 'Yes'],
      ['Market_Events', () => R.Market_Events.length === 1 && R.Market_Events[0]?.Name === 'Spring push' && R.Market_Events[0]?.Subscriber_Volume === 300 && R.Market_Events[0]?.Start_Month === '2026-02'],
      ['Adjusted_Forecasts', () => R.Adjusted_Forecasts.length === 1 && Object.keys(R.Adjusted_Forecasts[0]).length === 1 && /No market events applied/.test(R.Adjusted_Forecasts[0]?.Note)],
      ['Bulk_Generation_History', () => R.Bulk_Generation_History[0]?.Run_ID === 'run-1' && R.Bulk_Generation_History[0]?.Pre_Horizon_Uncertainty_Pct === 1.5 && R.Bulk_Generation_History[0]?.Forecast_Length_Months === 12],
      ['Model_Acceptance_Log', () => R.Model_Acceptance_Log.length === 1 && Object.keys(R.Model_Acceptance_Log[0]).length === 1 && R.Model_Acceptance_Log[0]?.Note === 'No AutoML model switches recorded this session'],
      ['Yield_Events', () => R.Yield_Events.length === 1 && R.Yield_Events[0]?.Name === 'Yield lift' && R.Yield_Events[0]?.ID === 'y-1'],
      ['Pricing_Events', () => R.Pricing_Events.length === 1 && R.Pricing_Events[0]?.Name === 'Price rise' && R.Pricing_Events[0]?.ID === 'p-1'],
      ['One_Off_Months', () => R.One_Off_Months[0]?.Month === '2025-06' && R.One_Off_Months[0]?.Reason === 'Outage' && R.One_Off_Months[0]?.Product === 'Mobile'],
      ['Tariff_Selection', () => R.Tariff_Selection.length === 1 && R.Tariff_Selection[0]?.Tariff_L1 === 'Unlimited' && Object.keys(R.Tariff_Selection[0]).length === 1],
      ['Metadata', () => meta('Pre_Horizon_Uncertainty_Pct') === 7 && meta('Post_Horizon_Expansion_Rate_Pct') === 4 && meta('Confidence_Horizon_Months') === 5 && meta('Forecast_Length_Months') === 18 && meta('Active_Step') === 'standard'],
    ];
    // Thunks, so a MISSING sheet reads as red here rather than crashing the spec.
    for (const [n, ok] of lit) { let v = false; try { v = ok(); } catch { v = false; } check(`(iv) ${n}: three hand-written cells`, v, String(J(R[n])).slice(0, 200)); }
  }

  // ── (ii) RESTORE — through the workbook wrapper and the record path ─────
  {
    const back = writeRead(record);
    const viaWb = recorder({ setForecastStore: new Map() });
    A.restoreSessionSheets(rs.sheetRowsFromWorkbook(back), back.SheetNames, viaWb.sink);
    const viaRec = recorder({ setForecastStore: new Map() });
    A.restoreSessionSheets(record, Object.keys(record), viaRec.sink);
    const KEYS = ['setImportSaveResult', 'setData', 'setColumns', 'setForecastStore', 'setBaseForecast', 'setMarketEvents',
      'setYieldEvents', 'setPricingEvents', 'setOneOffMonths', 'setSelectedTariffs', 'setViewFilter', 'setActiveView',
      'setBulkRuns', 'setCarriedAdjustedRows', 'setRestoreFellBack',
      'setPreHorizonUncertainty', 'setPostHorizonExpansionRate', 'setConfidenceHorizon'];
    for (const k of KEYS) {
      check(`(ii) ${k}: identical through the wrapper and the record`, J(viaWb.state[k]) === J(viaRec.state[k]),
        `${J(viaWb.state[k])?.slice(0, 140)} vs ${J(viaRec.state[k])?.slice(0, 140)}`);
    }
    const s = viaRec.state;
    check('(iv) restore succeeded and lands on standard', s.setImportSaveResult?.success === true && s.setActiveView === 'standard');
    check('(iv) forecasts: two leaves, Mobile inflow 2026-02 = 110, Broadband seed 500',
      s.setForecastStore?.size === 2 && s.setForecastStore.get(keyOf(leafA))?.months[1].inflow.mean === 110
        && s.setForecastStore.get(keyOf(leafB))?.seedBaseVolume === 500);
    check('(iv) all three event sets: Spring push 300, Yield lift, Price rise',
      s.setMarketEvents?.[0]?.name === 'Spring push' && s.setMarketEvents[0]?.subscriberVolume === 300
        && s.setYieldEvents?.[0]?.name === 'Yield lift' && s.setPricingEvents?.[0]?.name === 'Price rise');
    check('(iv) one-offs and tariffs: 2025-06 Outage; [Unlimited]',
      s.setOneOffMonths?.[keyOf(leafA)]?.[0]?.reason === 'Outage' && J(s.setSelectedTariffs) === '["Unlimited"]');
    check('(iv) Metadata view and active cohort: the Mobile leaf, no fallback',
      vf.filterToKey(s.setViewFilter) === vf.filterToKey(vf.cohortToFilter(leafA.cohort)) && vf.filterToKey(s.setViewFilter) === 'SOHO|Mobile|Mobile_Std|Online|Web|Unlimited|Unlimited_24m'
        && s.setBaseForecast?.cohort?.product === 'Mobile' && s.setBaseForecast?.cohort?.productL2 === 'Mobile_Std' && s.setRestoreFellBack === false,
      J(s.setViewFilter) + ' ' + J(s.setBaseForecast?.cohort));
    check('(M) the three settings restore: 7 / 4 / 5',
      s.setPreHorizonUncertainty === 7 && s.setPostHorizonExpansionRate === 4 && s.setConfidenceHorizon === 5);
    check('(M) Bulk_Generation_History keeps its own per-run values: 1.5 / 2.25 / 2 / 12',
      s.setBulkRuns?.[0]?.settings?.preHorizonUncertainty === 1.5 && s.setBulkRuns[0]?.settings.postHorizonExpansionRate === 2.25
        && s.setBulkRuns[0]?.settings.confidenceHorizon === 2 && s.setBulkRuns[0]?.settings.forecastLength === 12);
    check('(C) the restore\'s column list is the union: Extra_Col, first seen on row 2, is in it',
      J(s.setColumns) === J(['Month', 'Customer_Segment', 'Subscriber_Volume', 'Extra_Col']), J(s.setColumns));
    // Not-a-finite-number leaves the setting: blank, text, absent.
    const bad = { ...record, Metadata: record.Metadata.map((r: any) =>
      r.Field === 'Pre_Horizon_Uncertainty_Pct' ? { ...r, Value: '' }
        : r.Field === 'Post_Horizon_Expansion_Rate_Pct' ? { ...r, Value: 'wide' } : r)
      .filter((r: any) => r.Field !== 'Confidence_Horizon_Months') };
    const viaBad = recorder();
    A.restoreSessionSheets(bad, Object.keys(bad), viaBad.sink);
    check('(M) blank, non-numeric and absent cells set nothing',
      viaBad.state.setImportSaveResult?.success === true && !('setPreHorizonUncertainty' in viaBad.state)
        && !('setPostHorizonExpansionRate' in viaBad.state) && !('setConfidenceHorizon' in viaBad.state));
    const strRec = { ...record, Metadata: record.Metadata.map((r: any) => r.Field === 'Confidence_Horizon_Months' ? { ...r, Value: '4' } : r) };
    const viaStr = recorder();
    A.restoreSessionSheets(strRec, Object.keys(strRec), viaStr.sink);
    check('(M) a numeric string counts as a finite number: \'4\' -> 4', viaStr.state.setConfidenceHorizon === 4);
  }

  // ── (M) MOUNTED — App, the real Import Save input, the Step 1 controls ──
  {
    const React = await import('react');
    const { createRoot } = await import('react-dom/client');
    const { act } = await import('react');
    const i18n = (await import('../src/i18n')).default;
    await (i18n as any).init?.();
    const App = A.default;
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const waitFor = async (pred: () => boolean, ms = 8000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) { if (pred()) return true; await (act as any)(async () => { await sleep(25); }); }
      return pred();
    };
    const fileOf = (rec: Record<string, any[]>) => {
      const buf = XLSX.write(rs.workbookFromSheetRows(rec), { type: 'array', bookType: 'xlsx' });
      return new dom.window.File([buf], 'session.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    };
    const importSave = async (c: HTMLElement, rec: Record<string, any[]>) => {
      const input = c.querySelector('input[type="file"][accept=".xlsx"]') as HTMLInputElement | null;
      if (!input) return false;
      Object.defineProperty(input, 'files', { value: [fileOf(rec)], configurable: true });
      await (act as any)(async () => { input.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
      return true;
    };
    const controls = (c: HTMLElement) => {
      const v = (id: string) => (c.querySelector(`[data-testid="${id}"]`) as HTMLInputElement | null)?.value;
      return { pre: v('std-setting-pre-horizon'), post: v('std-setting-post-horizon'), horizon: v('std-setting-confidence-horizon') };
    };
    const mount = async () => {
      const c = document.createElement('div'); document.body.appendChild(c);
      const root = createRoot(c);
      await (act as any)(async () => { root.render(React.createElement(App)); });
      return { c, root };
    };
    const onStep1 = (c: HTMLElement) => !!c.querySelector('[data-testid="std-setting-pre-horizon"]');

    // Session P: the four settings present, landing on Step 1.
    const P = record;
    // Session H: the same, but landing on Home (to restore over, below).
    const H = A.buildSessionSheetRecord(sessionState({ activeView: 'home' }), TS);
    // Session Q: Metadata WITHOUT the four fields, landing on Step 1, and with
    // no active cohort recorded — so its restore raises the fallback notice,
    // which is how this spec knows Q's restore actually ran.
    const SETTINGS = ['Pre_Horizon_Uncertainty_Pct', 'Post_Horizon_Expansion_Rate_Pct', 'Confidence_Horizon_Months', 'Forecast_Length_Months'];
    const Q = { ...record, Metadata: record.Metadata.filter((r: any) => !SETTINGS.includes(r.Field) && !/^Active_Cohort_/.test(r.Field)),
      Baseline_Forecasts: record.Baseline_Forecasts.map((r: any) => ({ ...r, Is_Active: 'No' })) };
    check('(M) Q really lacks all four fields', SETTINGS.every(f => !Q.Metadata.some((r: any) => r.Field === f)));

    // Case 1 — present: P over the defaults shows 7 / 4 / 5.
    {
      const { c, root } = await mount();
      check('(M) App mounted on Home with the Import Save input', !!c.querySelector('input[type="file"][accept=".xlsx"]'));
      const before = { ...controls(c) };
      await importSave(c, P);
      const landed = await waitFor(() => onStep1(c));
      const got = controls(c);
      check('(M) PRESENT: after restoring P, Step 1 shows 7 / 4 / 5', landed && got.pre === '7' && got.post === '4' && got.horizon === '5',
        `landed=${landed} ${J(got)} (before ${J(before)})`);
      await (act as any)(async () => { root.unmount(); }); c.remove();
    }
    // Control — Q over the defaults shows the defaults, so Q carries nothing.
    {
      const { c, root } = await mount();
      await importSave(c, Q);
      const landed = await waitFor(() => onStep1(c) && !!c.querySelector('[data-testid="restore-fellback-notice"]'));
      const got = controls(c);
      check('(M) CONTROL: Q over the defaults shows the defaults 1 / 1 / 3', landed && got.pre === '1' && got.post === '1' && got.horizon === '3',
        `landed=${landed} ${J(got)}`);
      await (act as any)(async () => { root.unmount(); }); c.remove();
    }
    // Case 2 — absent: H (7 / 4 / 5, stays Home), then Q over it: still 7 / 4 / 5.
    {
      const { c, root } = await mount();
      await importSave(c, H);
      const homeAgain = await waitFor(() => /session_restored|Session restored/i.test(c.textContent ?? '') || !!c.querySelector('input[type="file"][accept=".xlsx"]'));
      await sleep(50);
      const ok2 = await importSave(c, Q);
      const landed = await waitFor(() => onStep1(c) && !!c.querySelector('[data-testid="restore-fellback-notice"]'));
      const got = controls(c);
      check('(M) ABSENT: Q restored over 7 / 4 / 5 leaves 7 / 4 / 5', homeAgain && ok2 && landed && got.pre === '7' && got.post === '4' && got.horizon === '5',
        `home=${homeAgain} input=${ok2} landed=${landed} ${J(got)}`);
      await (act as any)(async () => { root.unmount(); }); c.remove();
    }
  }
}

main()
  .then(() => {
    console.log(`\nrow-source spec: ${pass} passed, ${fails.length} failed`);
    fails.forEach(f => console.log('  FAIL  ' + f));
    process.exit(fails.length ? 1 : 0);
  })
  .catch(e => { console.log('\nrow-source spec: CRASHED — ' + (e?.stack || e)); process.exit(1); });
