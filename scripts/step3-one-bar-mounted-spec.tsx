/**
 * STEP 3 HAS ONE SCOPE CONTROL — REQ-D7-02 session 1, driven through the DOM.
 *
 *   npm run spec:step3-one-bar
 *
 * Clauses 1, 3, 4 and 6 under REQ-D7-02, on the fixture shaped as the 1855
 * inventory's (60 Corporate·Direct leaves fitted to 2025-12; actuals over 540
 * leaves to 2026-06; the real seam). In the order a user meets it:
 *  (a) at Corporate/Direct there is no COMPARING bar;
 *  (b) clicking the Corporate row SELECTS it — the chart shows it — and the
 *      viewing bar is untouched; clicking it again deselects, bar untouched;
 *  (c) there is no Drilled-into Clear;
 *  (d) Step 2, mounted at All/All with one enabled event that applies, writes the
 *      adjusted forecast: Step 3 at All/All shows the badge and the toggle; moved
 *      to Corporate/Direct, both are hidden and the scoring is baseline;
 *  (e) Step 2 with no applying event (only a disabled one; none at all): hidden;
 *  (f) a loaded session starts with no adjusted forecast (source), so Step 3
 *      shows no badge until Step 2 writes one; Compare's parser pool is quoted.
 *
 * Step 2 is the REAL WhatIfTab, mounted alone as App mounts it (Step 2 only), so
 * the adjusted forecast Step 3 is handed is the one Step 2 actually writes. Step 3
 * is handed a SPY where the old viewing-bar writer was: nothing may call it.
 */
import { JSDOM } from 'jsdom';

const HIST = 'test-data/VBU_IBRO_Synthetic_ForecastTest_TariffHierarchy_Jan2023_Dec2025.xlsx';
const ACT  = 'test-data/VBU_IBRO_Synthetic_ForecastTest_TariffHierarchy_Jan2023_Jun2026.xlsx';
const C = { date: 'Month', seg: 'Customer_Segment', prod: 'Product_L1', prodL2: 'Product_L2_Value_Tier',
  chan: 'Channel_Level_1', chanL2: 'Channel_Level_2', t1: 'tariff_tier_l1', t2: 'tariff_tier_l2',
  metric: 'IBRO_Scenario_Type', val: 'Subscriber_Volume', rev: 'Monthly_Revenue_GBP' };
const M = '2026-03';

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

function report() {
  console.log(`\nstep3-one-bar spec: ${pass} passed, ${fails.length} failed`);
  fails.forEach(f => console.log('  FAIL  ' + f));
  process.exit(fails.length ? 1 : 0);
}

async function main() {
  const fs = await import('fs');
  const XLSX: any = (await import('xlsx')).default ?? (await import('xlsx'));
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const i18n = (await import('../src/i18n')).default;
  await (i18n as any).init?.();
  const fc: any = await import('../src/utils/forecasting');
  const { ForecastProvider } = await import('../src/context/ForecastContext');
  const FVA: any = (await import('../src/components/ForecastVsActualsTab')).ForecastVsActualsTab;
  const WhatIf: any = (await import('../src/components/WhatIfTab')).WhatIfTab;
  const noop = () => {};

  for (const f of [HIST, ACT]) if (!fs.existsSync(f)) {
    console.log(`\nstep3-one-bar spec: UNREACHABLE — fixture missing at ${f}`); process.exit(1);
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
    const bf = fc.calculateBaseForecast(series, { segment: p[0], product: p[1], productL2: p[2], channel: p[3],
      channelL2: p[4], tariffL1: p[5], tariffL2: p[6], scenario: 'Base Case' }, seed, 12, 1.0, 1.5, 3, 'Holt Linear');
    if (bf) store.set(fc.makeForecastKey(p[0], p[1], p[2], p[3], p[4], p[5], p[6]), bf);
  }
  const dm = fc.buildCohortDataMap(rows.map(r => ({ ...r, _parsedDate: new Date(r[C.date]) })),
    C.date, C.seg, C.prod, C.prodL2, C.chan, C.chanL2, C.t1, C.t2);
  const leafMap = fc.buildRollUpIndex(dm.keys()).leafMap;
  const resolveForecast = (key: string) => fc.resolveFromStore(store, leafMap, key);
  const ALL_KEY = 'All|All|All|All|All|All|All';
  const CD_KEY = 'Corporate|All|All|Direct|All|All|All';
  check('PREMISE: 60 leaves fitted', store.size === 60, String(store.size));

  const VIEW = (seg: string, chan: string | null) => ({ segment: seg, product: { l1: null, l2: null },
    channel: { l1: chan, l2: null }, tariff: { l1: null, l2: null } });
  const host = document.getElementById('root')!;
  let container: any;
  const fresh = () => { host.replaceChildren(); container = document.createElement('div'); host.appendChild(container); return createRoot(container); };
  const flush = async () => { await (act as any)(async () => {}); };
  const byTestId = (id: string) => container.querySelector(`[data-testid="${id}"]`) as any;
  const text = () => container.textContent || '';

  // ── STEP 2, as App mounts it: the real WhatIfTab, alone ─────────────────────
  const treeOf = (l1: string, l2: string) => {
    const m = new Map<string, string[]>();
    for (const r of rows.slice(0, 4000)) {
      const a = String(r[l1]), b = String(r[l2]);
      if (!a || a === 'undefined') continue;
      if (!m.has(a)) m.set(a, []);
      if (b && b !== 'undefined' && !m.get(a)!.includes(b)) m.get(a)!.push(b);
    }
    return m;
  };
  const fcAll = resolveForecast(ALL_KEY).forecast;
  const MONTH0 = fcAll?.months[0]?.month;
  const eventCD = (enabled: boolean) => ({
    id: 'ev-cd', name: 'Launch', campaignName: 'Launch', scenario: 'Inflow', segment: 'Corporate', product: 'All', productL2: 'All',
    channel: 'Direct', channelL2: 'All', tariffL1: 'All', tariffL2: 'All', date: MONTH0,
    subscriberVolume: 1000, customerVolume: 0, revenue: 0, arpu: 0, comment: '', contractLength: 24, sequence: 1,
    amountType: 'absolute', percentageBasis: 'baseline', retentionLinked: true,
    isPromotion: false, promoRebanded: false, hold: false, mode: 'spread', enabled,
  });
  /** Mount Step 2 at All/All with these events; return what it writes to context. */
  const step2Writes = async (events: any[]) => {
    let written: any = null;
    const Host: React.FC<any> = () => {
      const [newEvent, setNewEvent] = (React as any).useState({
        scenario: 'Inflow', segment: 'All', product: 'All', productL2: 'All', channel: 'All', channelL2: 'All',
        tariffL1: 'All', tariffL2: 'All', date: MONTH0, subscriberVolume: 0, customerVolume: 0, revenue: 0, arpu: 0,
        name: '', campaignName: '', comment: '', contractLength: 24,
      });
      const [marketEvents, setMarketEvents] = (React as any).useState(events);
      return React.createElement(WhatIf, {
        data: rows.slice(0, 4000),
        wiDateCol: C.date, wiSegmentCol: C.seg, wiProductCol: C.prod, wiProductL2Col: C.prodL2,
        wiChannelCol: C.chan, wiChannelL2Col: C.chanL2, wiMetricCol: C.metric,
        wiInflowVal: 'Inflow', wiRetentionVal: 'Retention', wiOutflowVal: 'Outflow',
        wiValueCol: C.val, wiRevenueCol: C.rev, wiArpuCol: '',
        productTree: treeOf(C.prod, C.prodL2), channelTree: treeOf(C.chan, C.chanL2),
        tariffTree: new Map<string, string[]>(), selectedTariffs: [], setSelectedTariffs: noop,
        cohortAvgArpu: 11.6, removeMarketEvent: noop,
        newEvent, setNewEvent, marketEvents, setMarketEvents, addMarketEvent: noop, updateMarketEvent: noop,
        yieldEvents: [], updateYieldEvent: noop, removeYieldEvent: noop,
        pricingEvents: [], updatePricingEvent: noop, removePricingEvent: noop,
        newYieldEvent: {}, setNewYieldEvent: noop, addYieldEvent: noop, clearAllYieldEvents: noop,
        newPricingEvent: {}, setNewPricingEvent: noop, addPricingEvent: noop, clearAllPricingEvents: noop,
        downloadExcel: noop, formatNumber: (v: any) => Number(v).toFixed(2), setActiveView: noop, missingMonths: [],
      });
    };
    const root = fresh();
    await (act as any)(async () => {
      root.render(React.createElement(ForecastProvider as any, {
        baseForecast: fcAll, setBaseForecast: noop,
        adjustedForecast: null, setAdjustedForecast: (v: any) => { written = v; },
        forecastStore: store, setForecastStore: noop,
        resolveForecast, canResolve: (k: string) => !!resolveForecast(k).forecast,
        hasLegacyBaseline: true, updatedAt: new Date().toISOString(), bulkRuns: [], setBulkRuns: noop,
      }, React.createElement(Host)));
    });
    await flush();
    await (act as any)(async () => { root.unmount(); });   // App unmounts Step 2 on leaving it
    return written;
  };

  // ── STEP 3: FVA under a Host holding the viewing-bar state ─────────────────
  let setView: ((v: any) => void) | null = null;
  let currentView: any = null;
  const spyCalls: any[] = [];
  const mountStep3 = async (view: any, adjusted: any) => {
    const Host: React.FC<any> = () => {
      const [v, sv] = (React as any).useState(view);
      setView = sv; currentView = v;
      return React.createElement(ForecastProvider as any, {
        baseForecast: resolveForecast(fc.makeForecastKey(v.segment, 'All', 'All', v.channel.l1 ?? 'All', 'All', 'All', 'All')).forecast,
        setBaseForecast: noop, adjustedForecast: adjusted, setAdjustedForecast: noop,
        forecastStore: store, setForecastStore: noop,
        resolveForecast, canResolve: (k: string) => !!resolveForecast(k).forecast,
        hasLegacyBaseline: true, updatedAt: new Date().toISOString(), bulkRuns: [], setBulkRuns: noop,
      }, React.createElement(FVA, {
        data: rows, wiDateCol: C.date, wiMetricCol: C.metric, wiValueCol: C.val,
        wiInflowVal: 'Inflow', wiOutflowVal: 'Outflow', wiRetentionVal: 'Retention', wiBaseVal: 'Base',
        wiSegmentCol: C.seg, wiProductCol: C.prod, wiProductL2Col: C.prodL2,
        wiChannelCol: C.chan, wiChannelL2Col: C.chanL2, wiTariffL1Col: C.t1, wiTariffL2Col: C.t2,
        wiRevenueCol: C.rev, wiArpuCol: '', activeFilter: v,
        // THE SPY. App passed its viewing-bar setter here before this build; if any
        // Step 3 control still tried to write the bar, it would land here.
        onCohortFilterChange: (next: any) => { spyCalls.push(next); sv(next); },
        formatNumber: (x: any) => String(Math.round(Number(x))), setActiveView: noop, downloadExcel: noop,
      }));
    };
    const root = fresh();
    await (act as any)(async () => { root.render(React.createElement(Host)); });
    await flush();
  };
  const varianceAt = (scenario: string, month: string) => {
    for (const d of [...container.querySelectorAll('details')] as any[]) {
      if (!(d.querySelector('h4')?.textContent || '').trim().startsWith(scenario + ' ')) continue;
      for (const tr of [...d.querySelectorAll('tbody tr')] as any[]) {
        const td = [...tr.querySelectorAll('td')].map((x: any) => (x.textContent || '').trim());
        if (td[0] === month) return { actual: Number(td[1]), forecast: Number(td[2]) };
      }
    }
    return null;
  };
  const rowFor = (seg: string) => ([...container.querySelectorAll('tbody tr')] as any[]).find(tr => {
    const tds = [...tr.querySelectorAll('td')];
    return tds.length >= 5 && ((tds[0] as any)?.textContent || '').trim().startsWith(seg);
  });
  const drilledStrip = () => ([...container.querySelectorAll('span')] as any[])
    .find(s => (s.textContent || '').trim() === i18n.t('actuals_drilled_into'))?.parentElement ?? null;
  const cardLines = () => {
    for (const card of [...container.querySelectorAll('div')] as any[]) {
      const ps = [...card.querySelectorAll(':scope > p')] as any[];
      if (ps.length >= 2 && /^Inflow MAPE$/.test((ps[0]?.textContent || '').trim())) return ps.map(p => (p.textContent || '').trim());
    }
    return [] as string[];
  };

  // ── (a) NO COMPARING BAR AT A NARROWED VIEW ──────────────────────────────
  await mountStep3(VIEW('Corporate', 'Direct'), null);
  const cdView = currentView;
  check('(a) Corporate/Direct: Step 3 is on screen with its forecast', !!varianceAt('Inflow', M), JSON.stringify(varianceAt('Inflow', M)));
  check('(a) no "Comparing" bar', !/Comparing/.test(text()));
  check('(a) no "Actuals filtered to match forecast scope" note', !/Actuals filtered to match forecast scope/.test(text()));
  check('(a) no Segment / Channel chips', !([...container.querySelectorAll('button')] as any[])
    .some(b => /^(Segment|Product|Channel|Tariff)\s*(Corporate|Direct|All)/.test((b.textContent || '').trim())));

  // ── (b) ROW CLICK SELECTS ONLY ───────────────────────────────────────────
  const corp = rowFor('Corporate');
  check('(b) the Corporate row is on screen (Group-by Segment)', !!corp);
  if (corp) await (act as any)(async () => { corp.click(); });
  await flush();
  check('(b) the row is SELECTED: the Drilled-into strip names it',
    !!drilledStrip() && (drilledStrip().textContent || '').includes('Corporate'), (drilledStrip()?.textContent || '(none)').trim());
  const sel = varianceAt('Inflow', M);
  check(`(b) the chart shows the row: ${M} Inflow 33048 against 33136`, sel?.actual === 33048 && sel?.forecast === 33136, JSON.stringify(sel));
  check('(b) the viewing bar was NOT written: no call reached the old setter', spyCalls.length === 0, JSON.stringify(spyCalls));
  check('(b) and step3Filter is the same Corporate/Direct state', currentView === cdView
    && currentView.segment === 'Corporate' && currentView.channel.l1 === 'Direct', JSON.stringify(currentView));

  // ── (c) NO CLEAR ─────────────────────────────────────────────────────────
  check('(c) the Drilled-into strip has no Clear control', !!drilledStrip() && drilledStrip().querySelectorAll('button').length === 0,
    String(drilledStrip()?.querySelectorAll('button').length));

  const corp2 = rowFor('Corporate');
  if (corp2) await (act as any)(async () => { corp2.click(); });
  await flush();
  check('(b) clicking again DESELECTS: the strip is gone', !drilledStrip());
  check('(b) and the viewing bar is still untouched', spyCalls.length === 0 && currentView === cdView, JSON.stringify(spyCalls));

  // ── (d) STEP 2 WRITES FOR All/All WITH AN APPLYING EVENT ─────────────────
  const adjOn = await step2Writes([eventCD(true)]);
  const adjKey = adjOn ? fc.makeForecastKey(adjOn.base.cohort.segment, adjOn.base.cohort.product, adjOn.base.cohort.productL2,
    adjOn.base.cohort.channel, adjOn.base.cohort.channelL2, adjOn.base.cohort.tariffL1, adjOn.base.cohort.tariffL2) : '(none)';
  console.log(`  (d) Step 2 wrote an adjusted forecast for ${adjKey}; events ${adjOn?.marketEvents?.length}; months ${adjOn?.adjustedMonths?.length}`);
  check('(d) PREMISE: Step 2 wrote an adjusted forecast for All/All', adjKey === ALL_KEY, adjKey);
  await mountStep3(VIEW('All', null), adjOn);
  check('(d) Step 3 All/All: the badge is shown', !!byTestId('adjusted-badge'));
  check('(d) Step 3 All/All: the toggle is shown', !!byTestId('adjusted-toggle'));
  const include = byTestId('adjusted-toggle') ? ([...byTestId('adjusted-toggle').querySelectorAll('button')] as any[])
    .find(b => (b.textContent || '').trim() === i18n.t('actuals_include_market_events')) : null;
  if (include) await (act as any)(async () => { include.click(); });
  await flush();
  check('(d) the toggle ON scores adjusted: the Inflow card reads Adjusted', cardLines().includes(i18n.t('actuals_adjusted')), cardLines().join(' | '));
  await (act as any)(async () => { setView!(VIEW('Corporate', 'Direct')); });
  await flush();
  check('(d) moved to Corporate/Direct: the badge is HIDDEN', !byTestId('adjusted-badge'));
  check('(d) and the toggle is HIDDEN (no disabled control)', !byTestId('adjusted-toggle'));
  check('(d) and the scoring is BASELINE — the toggle choice is forced off', cardLines().includes(i18n.t('actuals_baseline'))
    && !cardLines().includes(i18n.t('actuals_adjusted')), cardLines().join(' | '));
  await (act as any)(async () => { setView!(VIEW('All', null)); });
  await flush();
  check('(d) back at All/All the badge returns — the gate reads the view, not a latch', !!byTestId('adjusted-badge'));

  // ── (e) NO APPLYING EVENT ────────────────────────────────────────────────
  const adjOff = await step2Writes([eventCD(false)]);
  check('(e) PREMISE: Step 2 still writes an adjusted forecast with only a disabled event', !!adjOff);
  await mountStep3(VIEW('All', null), adjOff);
  check('(e) disabled event only: the badge is hidden', !byTestId('adjusted-badge'));
  check('(e) and the toggle is hidden', !byTestId('adjusted-toggle'));
  const adjNone = await step2Writes([]);
  check('(e) PREMISE: Step 2 writes one with no events at all', !!adjNone);
  await mountStep3(VIEW('All', null), adjNone);
  check('(e) no events: the badge is hidden', !byTestId('adjusted-badge'));

  // ── (f) A LOADED SESSION STARTS WITH NONE ────────────────────────────────
  {
    const app = fs.readFileSync('src/App.tsx', 'utf8').replace(/\/\/[^\n]*/g, '');
    check('(f) the session load no longer writes the adjusted forecast (setAdjustedForecast({ … }) gone from App)',
      (app.match(/setAdjustedForecast\(\{/g) ?? []).length === 0, String((app.match(/setAdjustedForecast\(\{/g) ?? []).length));
    check('(f) the sheet is unchanged: still required by the load validation, still written on save',
      /'Adjusted_Forecasts', 'Bulk_Generation_History'/.test(app) && /book_append_sheet\(wb, XLSX\.utils\.json_to_sheet\(adjRows\), 'Adjusted_Forecasts'\)/.test(app));
    const parser = fs.readFileSync('src/workers/scenarioParser.worker.ts', 'utf8');
    const pool = (parser.match(/sheets:\s*\[([^\]]*)\]/) ?? ['', ''])[1].replace(/\s+/g, ' ').trim();
    console.log(`  (f) Compare's parser pool: [${pool}]`);
    check('(f) Compare reads its own pool — Baseline_Forecasts and the three event sheets — never Adjusted_Forecasts',
      pool === "'Baseline_Forecasts', 'Market_Events', 'Yield_Events', 'Pricing_Events'" && !/Adjusted_Forecasts/.test(parser), pool);
  }
  await mountStep3(VIEW('All', null), null);
  check('(f) after a load (no adjusted forecast), Step 3 shows no badge', !byTestId('adjusted-badge') && !byTestId('adjusted-toggle'));
  await mountStep3(VIEW('All', null), adjOn);
  check('(f) until Step 2 writes one for the view: then it shows', !!byTestId('adjusted-badge'));

  // ── STRUCTURE ─────────────────────────────────────────────────────────────
  {
    const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    const fva = strip(fs.readFileSync('src/components/ForecastVsActualsTab.tsx', 'utf8'));
    const app = strip(fs.readFileSync('src/App.tsx', 'utf8'));
    const count = (t: string, n: string) => t.split(n).length - 1;
    check('(X) Step 3 holds no writer of the viewing bar: onCohortFilterChange appears nowhere in FVA or App',
      count(fva, 'onCohortFilterChange') === 0 && count(app, 'onCohortFilterChange') === 0,
      `${count(fva, 'onCohortFilterChange')} / ${count(app, 'onCohortFilterChange')}`);
    check('(X) handleStep3FilterChange: defined once, called by the viewing bar only',
      count(app, 'const handleStep3FilterChange = useCallback(') === 1 && count(app, 'handleStep3FilterChange') === 2
        && /onChange=\{activeView === 'whatif' \? handleStep2FilterChange : handleStep3FilterChange\}/.test(app),
      String(count(app, 'handleStep3FilterChange')));
    check('(X) ONE gate: showAdjusted defined once; the badge and the toggle read it',
      count(fva, 'const showAdjusted = useMemo(') === 1 && count(fva, '{showAdjusted && (') === 2);
    check('(X) the toggle is forced off with the gate, and adjustedMeanMap reads that',
      /const adjustedScoringOn = useAdjustedScoring && showAdjusted;/.test(fva) && /if \(!adjustedScoringOn \|\| !adjustedForecast\) return undefined;/.test(fva));
    check('(X) the gate uses the existing predicate', count(fva, 'eventScopeMatchesView(') === 1);
    check('(X) the COMPARING bar\'s machinery is gone', !/activeDims|hasActiveFilterDims|ActiveDim\b/.test(fva));
  }

  report();
}

main().catch(e => { console.error('step3-one-bar spec CRASHED —', e); process.exit(1); });
