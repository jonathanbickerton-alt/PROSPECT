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
 *  (f) a loaded session starts with no adjusted forecast (source); Compare's
 *      parser pool is quoted.
 *
 * RE-AIMED 2026-09-24 for REQ-D7-02 session 2 (clauses 8, 10, 11): Step 3 now
 * computes the adjusted forecast for its OWN view from the event arrays, through
 * the seam Step 2 uses, and never reads Step 2's global. (d)-(f) were written for
 * the interim gate (key equality against Step 2's view); they now follow the
 * events that reach the view on screen. Added:
 *  (g) Step 2 at All/All, Step 3 at Corporate/Direct with an enabled
 *      Corporate/Direct event: badge shown; toggle on -> the Inflow card is the
 *      engine's figure for THIS view's uplifted means, not Step 2's;
 *  (h) the event disabled: hidden, Baseline;
 *  (i) Step 3 first, Step 2 never mounted: the badge shows where an event applies;
 *  (j) load-then-save carries the Adjusted rows verbatim; Step 2's write replaces;
 *  (k) the seam moved, not widened in behaviour: series identical, ms per run.
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

  const VIEW = (seg: string, chan: string | null, prod: string | null = null) => ({ segment: seg, product: { l1: prod, l2: null },
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
  const eventCD = (enabled: boolean, product = 'All') => ({
    id: 'ev-cd', name: 'Launch', campaignName: 'Launch', scenario: 'Inflow', segment: 'Corporate', product, productL2: 'All',
    channel: 'Direct', channelL2: 'All', tariffL1: 'All', tariffL2: 'All', date: MONTH0,
    subscriberVolume: 1000, customerVolume: 0, revenue: 0, arpu: 0, comment: '', contractLength: 24, sequence: 1,
    amountType: 'absolute', percentageBasis: 'baseline', retentionLinked: true,
    isPromotion: false, promoRebanded: false, hold: false, mode: 'spread', enabled,
  });
  /** Mount Step 2 at All/All with these events; return what it writes to context. */
  const step2Writes = async (events: any[], baseKey: string = ALL_KEY) => {
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
        baseForecast: resolveForecast(baseKey).forecast, setBaseForecast: noop,
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
  const mountStep3 = async (view: any, adjusted: any, events: { market?: any[]; yield?: any[]; pricing?: any[] } = {}) => {
    const Host: React.FC<any> = () => {
      const [v, sv] = (React as any).useState(view);
      setView = sv; currentView = v;
      return React.createElement(ForecastProvider as any, {
        baseForecast: resolveForecast(fc.makeForecastKey(v.segment, v.product.l1 ?? 'All', 'All', v.channel.l1 ?? 'All', 'All', 'All', 'All')).forecast,
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
        // REQ-D7-02 clause 10: the arrays App passes Step 3 (the ones Step 2 receives).
        marketEvents: events.market ?? [], yieldEvents: events.yield ?? [], pricingEvents: events.pricing ?? [],
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

  const toggleOn = async () => {
    const b = byTestId('adjusted-toggle') ? ([...byTestId('adjusted-toggle').querySelectorAll('button')] as any[])
      .find(x => (x.textContent || '').trim() === i18n.t('actuals_include_market_events')) : null;
    if (b) await (act as any)(async () => { b.click(); });
    await flush();
    return !!b;
  };
  const inflowCardFigure = () => cardLines().find(l => /%$/.test(l)) ?? '(none)';

  // ── (d) THE GATE FOLLOWS THE EVENTS THAT REACH THE VIEW ON SCREEN ────────
  //    RE-AIMED (clause 10). Step 2 still writes its global for All/All, to show it
  //    is irrelevant now. The event is scoped Corporate/Direct/Mobile Voice, so a
  //    view it does not reach exists: Corporate/Direct/Mobile Data.
  const adjOn = await step2Writes([eventCD(true)]);
  const adjKey = adjOn ? fc.makeForecastKey(adjOn.base.cohort.segment, adjOn.base.cohort.product, adjOn.base.cohort.productL2,
    adjOn.base.cohort.channel, adjOn.base.cohort.channelL2, adjOn.base.cohort.tariffL1, adjOn.base.cohort.tariffL2) : '(none)';
  console.log(`  (d) Step 2 wrote an adjusted forecast for ${adjKey}; events ${adjOn?.marketEvents?.length}; months ${adjOn?.adjustedMonths?.length}`);
  check('(d) PREMISE: Step 2 wrote an adjusted forecast for All/All', adjKey === ALL_KEY, adjKey);
  const MV = { market: [eventCD(true, 'Mobile Voice')] };
  await mountStep3(VIEW('All', null), adjOn, MV);
  check('(d) Step 3 All/All, a Mobile Voice event: the badge is shown', !!byTestId('adjusted-badge'));
  check('(d) and the toggle is shown', !!byTestId('adjusted-toggle'));
  await toggleOn();
  check('(d) the toggle ON scores adjusted: the Inflow card reads Adjusted', cardLines().includes(i18n.t('actuals_adjusted')), cardLines().join(' | '));
  await (act as any)(async () => { setView!(VIEW('Corporate', 'Direct', 'Mobile Data')); });
  await flush();
  check('(d) moved to Corporate/Direct/Mobile Data, which the event does not reach: the badge is HIDDEN', !byTestId('adjusted-badge'));
  check('(d) and the toggle is HIDDEN (no disabled control)', !byTestId('adjusted-toggle'));
  check('(d) and the scoring is BASELINE — the toggle choice is forced off', cardLines().includes(i18n.t('actuals_baseline'))
    && !cardLines().includes(i18n.t('actuals_adjusted')), cardLines().join(' | '));
  await (act as any)(async () => { setView!(VIEW('All', null)); });
  await flush();
  check('(d) back at All/All the badge returns — the gate reads the view, not a latch', !!byTestId('adjusted-badge'));

  // ── (e) NO APPLYING EVENT ────────────────────────────────────────────────
  await mountStep3(VIEW('All', null), adjOn, { market: [eventCD(false)] });
  check('(e) disabled event only: the badge is hidden — even with Step 2\'s global present', !byTestId('adjusted-badge'));
  check('(e) and the toggle is hidden', !byTestId('adjusted-toggle'));
  await mountStep3(VIEW('All', null), adjOn, {});
  check('(e) no events: the badge is hidden', !byTestId('adjusted-badge'));

  // ── (f) A LOADED SESSION STARTS WITH NONE ────────────────────────────────
  {
    const app = fs.readFileSync('src/App.tsx', 'utf8').replace(/\/\/[^\n]*/g, '');
    check('(f) the session load does not write the adjusted forecast (setAdjustedForecast({ … }) absent from App)',
      (app.match(/setAdjustedForecast\(\{/g) ?? []).length === 0, String((app.match(/setAdjustedForecast\(\{/g) ?? []).length));
    const parser = fs.readFileSync('src/workers/scenarioParser.worker.ts', 'utf8');
    const pool = (parser.match(/sheets:\s*\[([^\]]*)\]/) ?? ['', ''])[1].replace(/\s+/g, ' ').trim();
    console.log(`  (f) Compare's parser pool: [${pool}]`);
    check('(f) Compare reads its own pool — Baseline_Forecasts and the three event sheets — never Adjusted_Forecasts',
      pool === "'Baseline_Forecasts', 'Market_Events', 'Yield_Events', 'Pricing_Events'" && !/Adjusted_Forecasts/.test(parser), pool);
  }

  // ── (g) STEP 3's OWN RUN, WHATEVER STEP 2 LAST SHOWED ────────────────────
  //    Step 2 wrote All/All (adjOn). Step 3 at Corporate/Direct with an enabled
  //    Corporate/Direct event. The card's figure is the ENGINE's for this view's
  //    means: the seam run for Corporate/Direct, scored per leaf as summaryMape does.
  const es: any = await import('../src/utils/eventScopeSeries');
  const mod: any = await import('../src/components/ForecastVsActualsTab');
  const seamArgs = (market: any[], scope: any) => ({
    draft: scope, excludeId: null, marketEvents: market, yieldEvents: [], pricingEvents: [],
    resolveForecast, data: rows,
    wiSegmentCol: C.seg, wiProductCol: C.prod, wiProductL2Col: C.prodL2, wiChannelCol: C.chan, wiChannelL2Col: C.chanL2,
    wiTariffL1Col: C.t1, wiTariffL2Col: C.t2, wiValueCol: C.val,
    wiMetricCol: C.metric, wiInflowVal: 'Inflow', wiOutflowVal: 'Outflow', wiRetentionVal: 'Retention',
  });
  const CD_SCOPE = { segment: 'Corporate', product: 'All', productL2: 'All', channelL1: 'Direct', channelL2: 'All', tariffL1: 'All', tariffL2: 'All' };
  const cdRun = es.eventScopeSeries(seamArgs([eventCD(true)], CD_SCOPE));
  // THE INDEPENDENT REFERENCE: the engine run the pre-move body made, NOT the seam's
  // return — so a seam that drops adjustedMonths cannot pass by moving the answer too.
  // The pre-move body, transcribed from 8ccee41 (WhatIfTab.tsx eventScopeSeriesFor):
  // resolve the draft's own slice, run the engine once on the arrays, read the pair.
  const { computeAdjustedForecast } = await import('../src/components/WhatIfTab');
  const dimOrNull = (v: string | undefined) => (!v || v === 'All' ? null : v);
  const before = (market: any[], d: any) => {
    const resolution = fc.resolveEventScopeForecast({ segment: d.segment, product: d.product, productL2: d.productL2,
      channelL1: d.channelL1, channelL2: d.channelL2, tariffL1: d.tariffL1, tariffL2: d.tariffL2 }, resolveForecast);
    if (!resolution.forecast) return null;
    const run = computeAdjustedForecast({ baseForecast: resolution.forecast, marketEvents: market, yieldEvents: [], pricingEvents: [],
      viewSegment: d.segment ?? 'All', viewProduct: { l1: dimOrNull(d.product), l2: dimOrNull(d.productL2) },
      viewChannel: { l1: dimOrNull(d.channelL1), l2: dimOrNull(d.channelL2) }, viewTariff: { l1: dimOrNull(d.tariffL1), l2: dimOrNull(d.tariffL2) },
      data: rows, wiSegmentCol: C.seg, wiProductCol: C.prod, wiProductL2Col: C.prodL2, wiChannelCol: C.chan, wiChannelL2Col: C.chanL2,
      wiTariffL1Col: C.t1, wiTariffL2Col: C.t2, wiValueCol: C.val, wiMetricCol: C.metric, wiInflowVal: 'Inflow', wiOutflowVal: 'Outflow', wiRetentionVal: 'Retention',
    } as any);
    return run;
  };
  const ref = before([eventCD(true)], CD_SCOPE);
  const meansOf = (months: any[]) => new Map(months.map((am: any) => [am.month, { inflow: am.uplifted.inflow, outflow: am.uplifted.outflow,
    retention: am.uplifted.retention, arpu: am.uplifted.arpu }]));
  const cardFor = (means: Map<string, any>, month: string) => {
    const vals = [...store.values()].map(bf => mod.computeForecastMape(bf, rows, C.date, C.metric, C.val,
      'Inflow', 'Outflow', 'Retention', 'Base', '', C.rev, C.seg, C.prod, C.chan, means,
      C.prodL2, C.chanL2, C.t1, C.t2, month)).map((m: any) => m.inflow).filter((x: any) => x !== null) as number[];
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };
  const MONTH_DEFAULT = '2026-06';
  // Step 2 at a view whose means DIFFER from Step 3's: Corporate/Direct/Mobile Voice.
  // (All/All covers the same 60 leaves as Corporate/Direct on this fixture, so its
  // adjusted run is identical to Corporate/Direct's and could not discriminate.)
  const MV_KEY = 'Corporate|Mobile Voice|All|Direct|All|All|All';
  const adjMV = await step2Writes([eventCD(true)], MV_KEY);
  check('(g) PREMISE: Step 2 wrote for Corporate/Direct/Mobile Voice', !!adjMV && adjMV.base.cohort.product === 'Mobile Voice',
    String(adjMV?.base?.cohort?.product));
  const engineCD = cardFor(meansOf(ref!.adjustedMonths), MONTH_DEFAULT);
  const engineStep2 = cardFor(meansOf(adjMV.adjustedMonths), MONTH_DEFAULT);
  const engineAll = cardFor(meansOf(adjOn.adjustedMonths), MONTH_DEFAULT);
  console.log(`  (g) engine Inflow card ${MONTH_DEFAULT}: Corporate/Direct's own means ${engineCD.toFixed(1)}%; Step 2's Mobile Voice means ${engineStep2.toFixed(1)}%; All/All's ${engineAll.toFixed(1)}%`);
  await mountStep3(VIEW('Corporate', 'Direct'), adjMV, { market: [eventCD(true)] });
  check('(g) Step 2 at Mobile Voice, Step 3 at Corporate/Direct with an applying event: the badge is shown', !!byTestId('adjusted-badge'));
  await toggleOn();
  const shown = inflowCardFigure();
  console.log(`  (g) the Inflow card reads ${shown}`);
  check('(g) toggle ON: the Inflow card is the engine\'s figure for THIS view\'s uplifted means',
    shown === engineCD.toFixed(1) + '%', `${shown} vs ${engineCD.toFixed(1)}%`);
  check("(g) and NOT the figure Step 2's view means give — Step 3 used its own run",
    shown !== engineStep2.toFixed(1) + '%', `${shown} vs ${engineStep2.toFixed(1)}%`);

  // ── (h) THE SAME EVENT DISABLED ──────────────────────────────────────────
  await mountStep3(VIEW('Corporate', 'Direct'), adjMV, { market: [eventCD(false)] });
  check('(h) disabled: the badge is hidden', !byTestId('adjusted-badge'));
  check('(h) and the cards read Baseline', cardLines().includes(i18n.t('actuals_baseline')), cardLines().join(' | '));

  // ── (i) STEP 3 FIRST — STEP 2 NEVER MOUNTED ──────────────────────────────
  await mountStep3(VIEW('Corporate', 'Direct'), null, { market: [eventCD(true)] });
  check('(i) no Step 2 at all (no global): the badge still shows where an event applies', !!byTestId('adjusted-badge'));
  await toggleOn();
  check('(i) and the toggle scores the same view means', inflowCardFigure() === engineCD.toFixed(1) + '%', inflowCardFigure());

  // ── (j) LOAD-THEN-SAVE CARRIES THE ADJUSTED ROWS ─────────────────────────
  {
    const { adjustedForecastSheetRows } = fc;
    const { isPlaceholderSheet } = await import('../src/utils/sheetGuards');
    const sheetRoundTrip = (rs: any[]) => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rs), 'Adjusted_Forecasts');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      return XLSX.utils.sheet_to_json(XLSX.read(buf, { type: 'buffer' }).Sheets['Adjusted_Forecasts']) as any[];
    };
    // A saved file: Step 2's rows for All/All, as the export writes them.
    const saved = adjustedForecastSheetRows(adjOn, null);
    const loaded = sheetRoundTrip(saved);                         // what the load reads
    const carried = loaded.length > 0 && !isPlaceholderSheet(loaded) ? loaded : null;   // as App keeps it
    check('(j) PREMISE: the loaded file has real Adjusted rows', !!carried && carried.length === 12, String(carried?.length));
    const reSaved = sheetRoundTrip(adjustedForecastSheetRows(null, carried) ?? [{ Note: 'placeholder' }]);
    check('(j) save BEFORE Step 2: the sheet\'s rows are identical to the loaded ones',
      JSON.stringify(reSaved) === JSON.stringify(loaded), `${reSaved.length} rows vs ${loaded.length}`);
    const adjCD2 = await step2Writes([{ ...eventCD(true), id: 'ev-2', subscriberVolume: 2500 }]);
    const afterStep2 = adjustedForecastSheetRows(adjCD2, carried);
    check('(j) after Step 2 writes: the sheet is Step 2\'s rows, not the carried ones',
      JSON.stringify(afterStep2) === JSON.stringify(adjustedForecastSheetRows(adjCD2, null))
        && JSON.stringify(afterStep2) !== JSON.stringify(carried));
    check('(j) neither: null, and the export writes its placeholder', adjustedForecastSheetRows(null, null) === null);
    const app = fs.readFileSync('src/App.tsx', 'utf8').replace(/\/\/[^\n]*/g, '');
    check('(j) ONE sheet writer: App appends Adjusted_Forecasts once, from the helper',
      (app.match(/'Adjusted_Forecasts'\);/g) ?? []).length === 1
        && /adjustedForecastSheetRows\(adjustedForecast, carriedAdjustedRows\)/.test(app));
    check('(j) the carried rows live in App state, set by the load with the placeholder guard',
      /const \[carriedAdjustedRows, setCarriedAdjustedRows\] = useState/.test(app)
        && /setCarriedAdjustedRows\(adjRaw\.length > 0 && !isPlaceholderSheet\(adjRaw\) \? adjRaw : null\)/.test(app));
    check('(j) Step 2\'s writer drops them: the provider is handed setAdjustedForecastFromStep2',
      /setAdjustedForecast=\{setAdjustedForecastFromStep2\}/.test(app) && /if \(v\) setCarriedAdjustedRows\(null\);/.test(app));
  }

  // ── (k) THE SEAM MOVED; ITS CALLERS SEE THE SAME SERIES; ITS COST ────────
  {
    check('(k) the moved seam returns the SAME series as the pre-move body (Corporate/Direct, one event)',
      !!ref && JSON.stringify(cdRun.series) === JSON.stringify(ref.chartData), `${cdRun.series?.length} rows`);
    check('(k) and the SAME per-month winners (arpuIdsByMonth)',
      !!ref && JSON.stringify(cdRun.arpuIdsByMonth) === JSON.stringify(Object.fromEntries(ref.adjustedMonths.map((m: any) => [m.month, m.appliedArpuIds ?? []]))));
    // The forecast's flow means are already 2dp (the engine rounds them), so the
    // unrounded claim is shown on the blended ARPU, a ratio that keeps its decimals.
    check("(k) adjustedMonths is the run's own, UNROUNDED (the blended ARPU keeps more than 2 decimals)",
      !!ref && JSON.stringify(cdRun.adjustedMonths) === JSON.stringify(ref.adjustedMonths)
        && cdRun.adjustedMonths.some((m: any) => Math.abs(m.uplifted.arpu * 100 - Math.round(m.uplifted.arpu * 100)) > 1e-6),
      String(cdRun.adjustedMonths[0]?.uplifted?.arpu));
    const t: number[] = [];
    for (let n = 0; n < 5; n++) { const t0 = performance.now(); es.eventScopeSeries(seamArgs([eventCD(true)], CD_SCOPE)); t.push(performance.now() - t0); }
    t.sort((a, b) => a - b);
    console.log(`  (k) one view run (Corporate/Direct, 90,720 rows): median ${t[2].toFixed(1)} ms, min ${Math.min(...t).toFixed(1)}, max ${t[4].toFixed(1)} (5 runs)`);
    check('(k) a view run costs under a second on the 90,720-row fixture', t[2] < 1000, t[2].toFixed(1) + ' ms');
  }

  // ── STRUCTURE ─────────────────────────────────────────────────────────────
  {
    const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    const fva = strip(fs.readFileSync('src/components/ForecastVsActualsTab.tsx', 'utf8'));
    const app = strip(fs.readFileSync('src/App.tsx', 'utf8'));
    const wit = strip(fs.readFileSync('src/components/WhatIfTab.tsx', 'utf8'));
    const util = strip(fs.readFileSync('src/utils/eventScopeSeries.ts', 'utf8'));
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
    // RE-AIMED (clause 10): adjustedMeanMap reads the VIEW's run, never the global.
    check('(X) the toggle is forced off with the gate, and adjustedMeanMap reads the view run',
      /const adjustedScoringOn = useAdjustedScoring && showAdjusted;/.test(fva) && /if \(!adjustedScoringOn \|\| !viewRun\) return undefined;/.test(fva));
    check('(X) Step 3 never reads Step 2\'s global: no adjustedForecast in FVA', count(fva, 'adjustedForecast') === 0,
      String(count(fva, 'adjustedForecast')));
    check('(X) the gate uses the existing predicate, once', count(fva, 'eventScopeMatchesView(') === 1);
    check('(X) the COMPARING bar\'s machinery is gone', !/activeDims|hasActiveFilterDims|ActiveDim\b/.test(fva));
    check('(X) ONE module-level seam: eventScopeSeries defined once, in utils/eventScopeSeries.ts',
      count(util, 'export function eventScopeSeries(') === 1 && count(wit, 'function eventScopeSeries(') === 0 && count(fva, 'function eventScopeSeries(') === 0);
    check('(X) seam callers 6: the five WhatIfTab callers (through the wrapper) + FVA',
      count(wit, 'eventScopeSeriesFor(') === 5 && count(wit, 'eventScopeSeries({') === 1 && count(fva, 'eventScopeSeries({') === 1,
      `${count(wit, 'eventScopeSeriesFor(')} + wrapper ${count(wit, 'eventScopeSeries({')} + FVA ${count(fva, 'eventScopeSeries({')}`);
    check('(X) ONE route to an adjusted run: computeAdjustedForecast 6 across src — the call moved into the seam',
      count(wit, 'computeAdjustedForecast(') + count(util, 'computeAdjustedForecast(') + count(fva, 'computeAdjustedForecast(') === 6
        && count(util, 'computeAdjustedForecast(') === 1 && count(fva, 'computeAdjustedForecast(') === 0,
      `${count(wit, 'computeAdjustedForecast(')} + ${count(util, 'computeAdjustedForecast(')} + ${count(fva, 'computeAdjustedForecast(')}`);
  }

  report();
}

main().catch(e => { console.error('step3-one-bar spec CRASHED —', e); process.exit(1); });
