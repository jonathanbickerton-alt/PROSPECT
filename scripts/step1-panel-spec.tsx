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

  /** forecastData in the shape showResolvedAggregate produces. */
  const histMap = new Map<number, any>();
  for (const r of rows) {
    if (v(r, C.metric) !== 'Inflow') continue;
    const d = new Date(String(v(r, C.date)).slice(0, 7) + '-01');
    if (isNaN(d.getTime())) continue;
    const t = d.getTime(), val = Number(r[C.value]) || 0;
    const prev = histMap.get(t);
    if (prev) prev['Mean (Base)'] += val;
    else histMap.set(t, { [C.date]: String(v(r, C.date)).slice(0, 7), 'Mean (Base)': val, Type: 'Historical' });
  }
  const aggForecastData = [
    ...[...histMap.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]),
    ...derived!.months.map((m: any) => ({ [C.date]: m.month, 'Mean (Base)': m.inflow.mean,
      Optimistic: m.inflow.optimistic, Pessimistic: m.inflow.pessimistic, Type: 'Forecast' })),
  ];

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
    const c = await render({ forecastData: [], stdChartData: [] });
    const txt = c.textContent || '';
    check('CONTROL: with no forecastData the placeholder RENDERS',
      txt.includes(PLACEHOLDER),
      'the placeholder is unreachable — every absence check below is vacuous');
    check('CONTROL: and the component rendered something substantial',
      txt.length > 200, `${txt.length} chars`);
  }

  // ── THE DEFECT: baseForecast set, forecastData not ──────────────────────
  // This is the state Session J left the app in. It must FAIL to show the
  // panel — pinned so the difference between the two states is visible here
  // rather than only on Jon's screen.
  {
    const c = await render({ forecastData: [], stdChartData: [] });
    check('THE DEFECT REPRODUCES: a derived forecast alone does not open the panel',
      (c.textContent || '').includes(PLACEHOLDER),
      'the gate no longer depends on forecastData — this pin is stale, re-read it');
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
    const c = await render({ forecastData: [], stdChartData: [], notice: '' });
    check('NOTICE PAIRING CONTROL: with no notice the invitation is back',
      (c.textContent || '').includes(PLACEHOLDER),
      'the placeholder was removed rather than conditioned');
  }

  console.log(`step1-panel spec: ${pass} passed, ${fails.length} failed`);
  fails.forEach(f => console.log('  FAIL ' + f));
  process.exit(fails.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
