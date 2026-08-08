/**
 * THE STEP 1 PANEL, MOUNTED — the gate that swallowed the last fix.
 *
 *   npm run spec:step1-panel
 *
 * ── Why this spec exists ──────────────────────────────────────────────────
 *
 * Session J claimed "the user story ends with the forecast visible". Its spec
 * asserted that `showResolvedAggregate` calls `setBaseForecast` with a derived
 * forecast, which it did. Jon then generated 72 leaves and watched "Ready to
 * forecast" stay on screen.
 *
 * `StandardForecastTab` renders the entire result panel behind
 * `forecastData.length > 0 && !emptyCohortSelection`. `forecastData` is a
 * DIFFERENT piece of state, written only by the manual leaf paths. The
 * aggregate path set `baseForecast` and nothing else, so the component the spec
 * asserted on was never mounted.
 *
 * **Surface-not-store, one level up from where this codebase has met it
 * before.** The earlier instances were a wrong value inside a rendered
 * component. This was a correct value in a component that does not render —
 * and a spec that asserts on state, or on a subtree, cannot see the difference.
 * The only fix is to mount from ABOVE the gate, so the gate is inside the
 * assertion rather than assumed open.
 *
 * So this spec mounts the real tab and asserts on the rendered DOM:
 *   - the placeholder is GONE, and
 *   - the result panel is present, and
 *   - the chart has the series it should.
 *
 * Every assertion is paired with a positive control that shows the placeholder
 * IS reachable — otherwise "no placeholder" would pass for a component that
 * failed to render at all.
 */
import * as fs from 'fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',
  { url: 'http://localhost/', pretendToBeVisual: true });
const g = globalThis as any;
g.window = dom.window; g.document = dom.window.document;
Object.defineProperty(g, 'navigator', { value: dom.window.navigator, configurable: true, writable: true });
g.HTMLElement = dom.window.HTMLElement; g.Element = dom.window.Element; g.Node = dom.window.Node;
g.SVGElement = dom.window.SVGElement;
g.getComputedStyle = dom.window.getComputedStyle;
g.requestAnimationFrame = (cb: any) => setTimeout(cb, 0); g.cancelAnimationFrame = clearTimeout;
g.MutationObserver = dom.window.MutationObserver;
g.ResizeObserver = class { cb: any; constructor(cb: any) { this.cb = cb; }
  observe(el: any) { this.cb([{ target: el, contentRect: { width: 900, height: 400, top: 0, left: 0, bottom: 400, right: 900, x: 0, y: 0 } }], this); }
  unobserve() {} disconnect() {} };
g.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
g.IS_REACT_ACT_ENVIRONMENT = true;
for (const p of ['offsetWidth', 'clientWidth'] as const) Object.defineProperty(dom.window.HTMLElement.prototype, p, { configurable: true, value: 900 });
for (const p of ['offsetHeight', 'clientHeight'] as const) Object.defineProperty(dom.window.HTMLElement.prototype, p, { configurable: true, value: 400 });

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

async function main() {
  const XLSX: any = (await import('xlsx')).default ?? (await import('xlsx'));
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const i18n = (await import('../src/i18n')).default;
  await (i18n as any).init?.();
  const fc: any = await import('../src/utils/forecasting');
  const { ForecastProvider } = await import('../src/context/ForecastContext');
  const mod: any = await import('../src/components/StandardForecastTab');
  const Tab = mod.default ?? mod.StandardForecastTab ?? Object.values(mod).find((x: any) => typeof x === 'function');

  const FIX = 'test-data/VBU_IBRO_EdgeCases_ShortHistory_PerScenarioARPU_Jan2023_Jun2026.xlsx';
  const C = { date: 'Month', metric: 'IBRO_Scenario_Type', value: 'Subscriber_Volume',
    seg: 'Customer_Segment', prod: 'Product_L1', prodL2: 'Product_L2_Value_Tier',
    chan: 'Channel_Level_1', chanL2: 'Channel_Level_2',
    t1: 'tariff_tier_l1', t2: 'tariff_tier_l2', rev: 'Monthly_Revenue_GBP' };
  const rows: any[] = XLSX.utils.sheet_to_json(XLSX.readFile(FIX).Sheets[XLSX.readFile(FIX).SheetNames[0]]);
  const v = (r: any, k: string) => String(r[k] ?? '').trim();

  /** Build the derived aggregate exactly as the app does: fit leaves, derive. */
  const dm = fc.buildCohortDataMap(rows, C.date, C.seg, C.prod, C.prodL2, C.chan, C.chanL2, C.t1, C.t2);
  const { leafMap } = fc.buildRollUpIndex([...dm.keys()]);
  const AGG = fc.makeForecastKey('All', 'All', 'All', 'All', 'All', 'All', 'All');
  const store = new Map<string, any>();
  for (const k of leafMap.get(AGG)!) {
    const [seg, prod, prodL2, chan, chanL2, t1, t2] = k.split('|');
    const sel = rows.filter(r => v(r, C.seg) === seg && v(r, C.prod) === prod && v(r, C.prodL2) === prodL2
      && v(r, C.chan) === chan && v(r, C.chanL2) === chanL2 && v(r, C.t1) === t1 && v(r, C.t2) === t2);
    const acc = new Map<number, any>();
    for (const r of sel) {
      const d = new Date(String(v(r, C.date)).slice(0, 7) + '-01'); if (isNaN(d.getTime())) continue;
      const tt = d.getTime();
      if (!acc.has(tt)) acc.set(tt, { _parsedDate: d, inflow: 0, outflow: 0, retention: 0,
        arpu: 0, inflowArpu: 0, outflowArpu: 0, retentionArpu: 0, baseArpu: 0 });
      const e = acc.get(tt)!, m = v(r, C.metric), val = Number(r[C.value]) || 0;
      if (m === 'Inflow') e.inflow += val; else if (m === 'Outflow') e.outflow += val;
      else if (m === 'Retention') e.retention += val;
    }
    const series = [...acc.values()].sort((a, b) => a._parsedDate - b._parsedDate);
    const bf = fc.calculateBaseForecast(series,
      { segment: seg, product: prod, productL2: prodL2, channel: chan, channelL2: chanL2,
        tariffL1: t1, tariffL2: t2, scenario: 'Base Case' }, 1000, 12, 1.0, 1.5, 3, 'Holt Linear');
    if (bf) store.set(k, bf);
  }
  const { forecast: derived } = fc.resolveFromStore(store, leafMap, AGG);
  check('PREMISE: a derived aggregate exists to display', !!derived
    && derived.provenance.kind === 'derived' && derived.months.length > 0,
    derived ? String(derived.months.length) : 'null');
  check('PREMISE: it came from the whole leaf set', store.size === 72, String(store.size));

  /**
   * forecastData built by the REAL production function, not by a copy.
   *
   * This spec used to construct these rows itself. That made it a proof that
   * the COMPONENT renders correctly given good rows - and no proof at all that
   * the APP produces them. A verification pass planted the exact Session J
   * defect (the App populating only baseForecast) and every mounted assertion
   * here stayed green, because the rows arrived from this file rather than from
   * production. Calling buildAggregateForecastRows closes that: trap 33 mutates
   * it and the mounted assertions go red.
   */
  const inflowInScope = (row: Record<string, unknown>) => v(row, C.metric) === 'Inflow';
  const monthOf = (raw: unknown) => {
    const m = String(raw ?? '').slice(0, 7);
    return /^\d{4}-\d{2}$/.test(m) ? m : null;
  };
  const aggForecastData = fc.buildAggregateForecastRows(
    derived!, 'inflow', rows, C.date, C.value, inflowInScope, monthOf);
  check('PREMISE: the production row builder produced rows',
    aggForecastData.length > 0, `${aggForecastData.length}`);
  check('PREMISE: with both a historical and a forecast half',
    aggForecastData.some((r: any) => r.Type === 'Historical')
      && aggForecastData.some((r: any) => r.Type === 'Forecast'),
    'one half is missing - the chart would draw only one series');

  const stdChartData = aggForecastData.map(r => ({
    ...r, date: r[C.date], timestamp: new Date(r[C.date] + '-01').getTime(),
    Historical: r.Type === 'Historical' ? r['Mean (Base)'] : null,
    'Mean (Base)': r.Type === 'Forecast' ? r['Mean (Base)'] : null,
    Optimistic: r.Type === 'Forecast' ? r.Optimistic : null,
    Pessimistic: r.Type === 'Forecast' ? r.Pessimistic : null,
  }));

  const noop = () => {};
  function props(over: any = {}) {
    return {
      columns: Object.keys(rows[0] ?? {}),
      data: rows, wiDateCol: C.date, wiMetricCol: C.metric, wiValueCol: C.value,
      wiRevenueCol: C.rev, setWiRevenueCol: noop,
      wiInflowVal: 'Inflow', setWiInflowVal: noop, wiOutflowVal: 'Outflow', setWiOutflowVal: noop,
      wiBaseVal: 'Base', setWiBaseVal: noop, wiRetentionVal: 'Retention', setWiRetentionVal: noop,
      wiSegmentCol: C.seg, setWiSegmentCol: noop, wiProductCol: C.prod, setWiProductCol: noop,
      wiProductL2Col: C.prodL2, setWiProductL2Col: noop,
      wiChannelCol: C.chan, setWiChannelCol: noop, wiChannelL2Col: C.chanL2, setWiChannelL2Col: noop,
      wiTariffL1Col: C.t1, wiTariffL2Col: C.t2,
      productTree: new Map(), channelTree: new Map(), tariffTree: new Map(),
      segmentValue: 'All (Aggregated)', setSegmentValue: noop,
      productValue: 'All (Aggregated)', setProductValue: noop,
      productL2Value: '', setProductL2Value: noop,
      channelValue: 'All (Aggregated)', setChannelValue: noop,
      channelL2Value: '', setChannelL2Value: noop,
      tariffValue: 'All (Aggregated)', setTariffValue: noop,
      tariffL2Value: '', setTariffL2Value: noop,
      segmentMode: 'filter', setSegmentMode: noop, productMode: 'filter', setProductMode: noop,
      channelMode: 'filter', setChannelMode: noop,
      stdScenario: 'Inflow', setStdScenario: noop,
      selectedForecastModel: 'Holt Linear', setSelectedForecastModel: noop,
      preHorizonUncertainty: 1, setPreHorizonUncertainty: noop,
      postHorizonExpansionRate: 1.5, setPostHorizonExpansionRate: noop,
      confidenceHorizon: 3, setConfidenceHorizon: noop,
      generateStandardForecast: noop,
      aggregateState: { kind: 'covered', missing: 0, total: 72, unfittable: 0 },
      generateResult: null, notice: '', error: null,
      forecastData: [], compareCategories: [],
      windowSize: 24, setWindowSize: noop, windowOffset: 0, setWindowOffset: noop,
      stdChartData: [], formatNumber: (n: number) => String(n), downloadExcel: noop,
      setActiveView: noop, COLORS: ['#e60000'], onOpenManageBulk: noop,
      cohortGenLog: [], onSelectCohort: noop, shortLeafWarnings: {},
      oneOffMonths: [], setOneOffMonths: noop,
      ...over,
    };
  }

  async function render(over: any) {
    const host = document.getElementById('root')!;
    host.replaceChildren();
    const container = document.createElement('div');
    host.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(ForecastProvider as any, {
        baseForecast: over.baseForecast ?? derived, setBaseForecast: noop,
        adjustedForecast: null, setAdjustedForecast: noop,
        forecastStore: store, setForecastStore: noop, hasLegacyBaseline: true,
        resolveForecast: (k: string) => fc.resolveFromStore(store, leafMap, k),
        canResolve: () => true, updatedAt: Date.now(), bulkRuns: [], setBulkRuns: noop,
      }, React.createElement(Tab as any, props(over))));
    });
    await act(async () => { await new Promise(r => setTimeout(r, 30)); });
    return container;
  }

  const PLACEHOLDER = i18n.t('baseline_ready_to_forecast');
  check('PREMISE: the placeholder string resolved from i18n',
    !!PLACEHOLDER && PLACEHOLDER !== 'baseline_ready_to_forecast', PLACEHOLDER);

  // ── POSITIVE CONTROL: the placeholder IS reachable ──────────────────────
  // Without this, "no placeholder" would pass for a component that rendered
  // nothing at all — which is exactly the failure mode this spec exists for.
  {
    const c = await render({ forecastData: [], stdChartData: [],
      aggregateState: { kind: 'leaf', missing: 0, total: 0, unfittable: 0 } });
    const txt = c.textContent || '';
    check('CONTROL: with no rows and a LEAF selection the placeholder RENDERS',
      txt.includes(PLACEHOLDER),
      'the placeholder is unreachable — every absence check below is vacuous');
    check('CONTROL: and the component rendered something substantial',
      txt.length > 200, `${txt.length} chars`);
  }

  // ── THE NEW INVARIANT: the panel follows the STORE ─────────────────────
  // The old pin here asserted that a derived forecast alone did not open the
  // panel - true of the written-state design, and deliberately false now. It
  // failed rather than passing blind, which is why it was a separate check.
  //
  // What replaces it: a store with nothing for the key yields no rows, so the
  // panel stays shut for the right reason rather than for a missing write.
  {
    const emptyStore = new Map<string, any>();
    const none = fc.buildPanelRowsFromStore(
      (k: string) => fc.resolveFromStore(emptyStore, leafMap, k),
      AGG, 'inflow', rows, C.date, C.value, inflowInScope, monthOf);
    check('STORE-DRIVEN: an empty store yields no panel rows', none.length === 0,
      `${none.length}`);
    const c = await render({ forecastData: none, stdChartData: none,
      aggregateState: { kind: 'leaf', missing: 74, total: 74, unfittable: 0 } });
    check('STORE-DRIVEN: and the panel stays shut',
      (c.textContent || '').includes(PLACEHOLDER),
      'the panel opened with nothing to show');
  }

  // ── THE FIX: forecastData populated from the derived aggregate ──────────
  {
    const c = await render({ forecastData: aggForecastData, stdChartData });
    const txt = c.textContent || '';
    check('FIXED: the placeholder is GONE', !txt.includes(PLACEHOLDER),
      'the panel still has not mounted');
    check('FIXED: the result panel rendered instead', txt.length > 200, `${txt.length} chars`);
    // The chart is the thing the user came for. Recharts renders line groups
    // with a stable class; assert geometry exists rather than trusting the memo.
    const lines = c.querySelectorAll('.recharts-line');
    check('FIXED: the chart drew at least one series', lines.length > 0,
      `${lines.length} line groups`);
    const paths = [...c.querySelectorAll('.recharts-line-curve')]
      .filter(p => (p.getAttribute('d') ?? '').length > 10);
    check('FIXED: and at least one series has real geometry', paths.length > 0,
      `${paths.length} curves with a path`);
  }

  // ── THE OTHER HALF: a leaf selection is not swallowed by the machine ────
  // The four states describe filling an AGGREGATE's missing leaves. A leaf
  // selection keeps the manual Generate Forecast, regeneration included — so
  // its button must be enabled even when a forecast already exists.
  {
    const c = await render({
      aggregateState: { kind: 'leaf', missing: 0, total: 0, unfittable: 0 },
      forecastData: aggForecastData, stdChartData,
    });
    const btns = [...c.querySelectorAll('button')]
      .filter(b => (b.textContent || '').includes(i18n.t('common_generate_forecast')));
    check('LEAF: the generate button is present for a leaf selection', btns.length > 0,
      'the button is gone entirely');
    check('LEAF: and it is ENABLED — a fitted leaf can be regenerated',
      btns.some(b => !(b as HTMLButtonElement).disabled),
      'a leaf selection inherited the aggregate state machine and cannot be regenerated');
  }
  {
    // Control on the same mechanism: an exhausted AGGREGATE scope stays blocked.
    const c = await render({
      aggregateState: { kind: 'blocked', missing: 0, total: 74, unfittable: 2 },
      forecastData: aggForecastData, stdChartData,
    });
    const disabled = [...c.querySelectorAll('button')]
      .filter(b => (b as HTMLButtonElement).disabled
        && (b.textContent || '').includes('too little history'));
    check('AGGREGATE: an exhausted scope is still blocked and says why',
      disabled.length > 0,
      'the blocked state was lost while scoping the machine off leaves');
  }

  // ── A NOTICE AND AN INVITATION MUST NOT ARGUE ──────────────────────────
  // Raised by the gate: a notice explaining why nothing can be shown, sitting
  // above "Ready to forecast", reads as though nothing had been tried. The
  // notice is the explanation; the invitation stands down rather than
  // contradicting the sentence directly above it.
  {
    const c = await render({ forecastData: [], stdChartData: [],
      notice: i18n.t('standard_base_series_not_derivable') });
    const txt = c.textContent || '';
    check('NOTICE PAIRING: the notice itself is shown',
      txt.includes('no Base volume series'), 'the notice did not render at all');
    check('NOTICE PAIRING: "Ready to forecast" stands down under a notice',
      !txt.includes(PLACEHOLDER),
      'the invitation contradicts the explanation directly above it');
    check('NOTICE PAIRING: and something neutral takes its place',
      txt.includes(i18n.t('baseline_nothing_to_display')),
      'the panel area is now blank, which says less than the placeholder did');
  }
  // Control on the same mechanism: with NO notice the invitation returns.
  // Without this, deleting the placeholder entirely would pass the check above.
  {
    const c = await render({ forecastData: [], stdChartData: [], notice: '',
      aggregateState: { kind: 'leaf', missing: 0, total: 0, unfittable: 0 } });
    check('NOTICE PAIRING CONTROL: with no notice and a leaf selection, the invitation is back',
      (c.textContent || '').includes(PLACEHOLDER),
      'the placeholder was removed rather than conditioned');
  }

  // ── A NOTICE MUST NOT SIT OVER SOMEONE ELSE'S NUMBERS ──────────────────
  // Found by the gate. The Base-scenario branch returned with only a notice,
  // leaving the PREVIOUS selection's chart and table rendered underneath it -
  // the panel gate reads forecastData and knows nothing about the notice. The
  // screen then showed one cohort's numbers under a sentence about another,
  // which is a worse version of the defect this session opened on.
  //
  // The check is on the pairing, not on the branch: a notice explaining an
  // absence must never coexist with a mounted result panel.
  {
    const c = await render({ forecastData: aggForecastData, stdChartData,
      notice: i18n.t('standard_base_series_not_derivable') });
    const txt = c.textContent || '';
    check('STALE PANEL: the notice renders', txt.includes('no Base volume series'));
    // If the App ever hands both at once again, this is what the user sees.
    const curves = [...c.querySelectorAll('.recharts-line-curve')]
      .filter(p => (p.getAttribute('d') ?? '').length > 10);
    check('STALE PANEL: a mounted chart under an absence notice is visible here',
      curves.length > 0,
      'this case cannot render a chart at all, so the check below proves nothing');
  }
  // The App-side guarantee, restated for the derived design: the Base scenario
  // has no band, so the resolver returns NO rows and there is nothing to clear.
  // The previous version asserted that the Base branch called setForecastData([])
  // - true of the written design, and now unnecessary rather than merely
  // unchecked. Deleting a check because the code changed is how coverage rots,
  // so it is replaced by the property that makes the clear redundant.
  {
    const noBand = fc.buildPanelRowsFromStore(
      (k: string) => fc.resolveFromStore(store, leafMap, k),
      AGG, null, rows, C.date, C.value, inflowInScope, monthOf);
    check('BASE: a null band yields no rows, so no stale panel can survive it',
      noBand.length === 0, `${noBand.length}`);
    const app = fs.readFileSync('src/App.tsx', 'utf8');
    check('BASE: the App still says why the panel is empty for Base',
      /standard_base_series_not_derivable/.test(app),
      'an empty panel with no explanation');
  }

  // ── WALK STEP 10: the not-in-data state, mounted ───────────────────────
  // Folded in from the gate. Stage 3 had to write this check itself because
  // the shipped spec never set kind:'never' - so the state Jon's step 10
  // exercises had no mounted coverage at all, in the spec written because a
  // previous claim was never checked against the screen. A check that lives
  // in a gate prompt runs once; this one now runs every time.
  {
    const c = await render({
      aggregateState: { kind: 'never', missing: 0, total: 0, unfittable: 0 },
      forecastData: [], stdChartData: [],
    });
    const btns = [...c.querySelectorAll('button')]
      .filter(b => (b.textContent || '').includes(i18n.t('standard_scope_not_in_data')));
    check('STEP 10: the not-in-data text renders on the button', btns.length > 0,
      'the never state has no visible text');
    check('STEP 10: and the button is disabled',
      btns.some(b => (b as HTMLButtonElement).disabled),
      'a selection with no cohorts still invites a generate');
    // The whole point of keeping the states apart is that they READ apart.
    check('STEP 10: its text differs from the blocked text',
      i18n.t('standard_scope_not_in_data') !== i18n.t('standard_scope_blocked', { count: 2 }),
      'not-in-data and blocked render identically - the distinction is invisible');
  }

  // ── WALK C-17: A RESTORED SESSION MUST RENDER IN STEP 1 ────────────────
  // The defect: after a session restore, forecasts existed and drew in Actuals
  // Review while Step 1 showed "Ready to forecast" and the button read "already
  // forecast" - the store held them and Step 1 could neither show nor
  // regenerate any.
  //
  // Restore rehydrates the STORE and writes no panel state. It was never going
  // to: the panel gate is in the initial commit and restore came later, so a
  // restored session has never rendered here. Session K made the aggregate path
  // a second writer; restore would have been a third. The panel now DERIVES, so
  // there is no writer list to join.
  //
  // This drives the WHOLE path - restored store to rendered pixel - through the
  // production resolver, because a spec that builds its own rows proves nothing
  // about whether the app produces them. That lesson cost a walk.
  {
    // A store exactly as restore leaves it: leaf forecasts rehydrated, and NO
    // panel state written anywhere.
    const restoredStore = new Map(store);
    check('C-17 PREMISE: the restored store holds forecasts',
      restoredStore.size === 72, `${restoredStore.size}`);

    const restoredRows = fc.buildPanelRowsFromStore(
      (k: string) => fc.resolveFromStore(restoredStore, leafMap, k),
      AGG, 'inflow', rows, C.date, C.value, inflowInScope, monthOf,
      { preHorizonUncertainty: 1, postHorizonExpansionRate: 1.5 });
    check('C-17: the resolver yields panel rows from a restored store alone',
      restoredRows.length > 0,
      'nothing written, nothing derived - the panel stays shut, which IS the defect');

    const c = await render({ forecastData: restoredRows,
      stdChartData: restoredRows.map((r: any) => ({
        ...r, date: r[C.date], timestamp: new Date(r[C.date] + '-01').getTime(),
        Historical: r.Type === 'Historical' ? r['Mean (Base)'] : null,
        'Mean (Base)': r.Type === 'Forecast' ? r['Mean (Base)'] : null,
        Optimistic: r.Type === 'Forecast' ? r.Optimistic : null,
        Pessimistic: r.Type === 'Forecast' ? r.Pessimistic : null,
      })),
      aggregateState: { kind: 'covered', missing: 0, total: 72, unfittable: 0 } });
    const txt = c.textContent || '';
    check('C-17: the placeholder is GONE after a restore', !txt.includes(PLACEHOLDER),
      'a restored session still shows "Ready to forecast" - the walk defect, unfixed');
    check('C-17: the panel mounted instead', txt.length > 200, `${txt.length} chars`);
    // The placeholder check above stands down for a covered selection, so on
    // its own it would pass for an empty panel. This is the discriminating one.
    check('C-17: and the empty-state text is NOT shown',
      !txt.includes(i18n.t('baseline_nothing_to_display')),
      'the panel is empty - a restored session still shows nothing on Step 1');
    const curves = [...c.querySelectorAll('.recharts-line-curve')]
      .filter(p => (p.getAttribute('d') ?? '').length > 10);
    check('C-17: and the chart has real geometry', curves.length > 0,
      `${curves.length} curves with a path`);
    // The trace columns the export carries must survive derivation, or a
    // restored session exports less than a generated one did.
    check('C-17: derived rows keep the export trace columns',
      restoredRows.every((r: any) => r['Pre-Horizon Uncertainty %'] !== undefined),
      'the export loses provenance columns when the panel is derived');
  }

  // ── THE DISABLED TREATMENT IS THE FILE'S, NOT AN INVENTED ONE ──────────
  // Raised by the gate: the first version used bg-slate-100/text-slate-500 with
  // a border, which exists nowhere else. This file already has a
  // permanently-disabled style, and a coverage state is exactly that.
  {
    const tab = fs.readFileSync('src/components/StandardForecastTab.tsx', 'utf8');
    check('DISABLED STYLE: the coverage states use the file established treatment',
      /bg-slate-200 text-slate-400 cursor-not-allowed/.test(tab),
      'an invented disabled style - name the sibling it should match');
    // The coverage branch of the ternary must be the slate one, and the red
    // must sit in the OTHER branch. Checking only "slate appears somewhere"
    // would pass for a button that is red in every state with slate elsewhere.
    // Bounded FORWARD from the ternary. The first version searched for the red
    // class from position 0, which matched an earlier red button in the file
    // and produced an empty window — a check over nothing, reported as a
    // failure only because the slate half then also went missing.
    const ternStart = tab.indexOf("aggregateState.kind === 'covered' || aggregateState.kind === 'blocked'");
    const ternEnd = tab.indexOf('bg-[#e60000] hover:bg-[#cc0000] text-white', ternStart);
    check('DISABLED STYLE ANCHOR: the ternary was bounded',
      ternStart !== -1 && ternEnd > ternStart, 'the window is empty and the check below is vacuous');
    const tern = ternStart === -1 || ternEnd < 0 ? '' : tab.slice(ternStart, ternEnd);
    check('DISABLED STYLE: and the coverage branch is OFF the red action colour',
      /bg-slate-200 text-slate-400/.test(tern) && !/#e60000/.test(tern),
      'a coverage statement is back on the action colour');
    // Styling alone is not disabling. The attribute must still be set, or the
    // button looks inert and is clickable.
    check('DISABLED STYLE: the disabled ATTRIBUTE still covers all three states',
      /disabled=\{aggregateState\.kind === 'covered'[\s\S]{0,120}'blocked'\}/.test(tab),
      'the button is styled disabled but still clickable');
  }

  console.log(`step1-panel spec: ${pass} passed, ${fails.length} failed`);
  fails.forEach(f => console.log('  FAIL ' + f));
  process.exit(fails.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
