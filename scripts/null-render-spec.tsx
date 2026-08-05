/**
 * NULL RENDER — a null resolution must produce the empty state, not a throw.
 *
 *   npm run spec:nullrender
 *
 * The surface-not-store rule, applied to specs themselves. That
 * `resolveForecast` returns null for an all-short aggregate was proven at the
 * store and re-proven at every gate. That the SCREEN survives being handed that
 * null was never tested once — and Jon's A5 walk blanked the app on exactly the
 * cohort the specs certified.
 *
 * Proving a contract at the producer says nothing about the consumer. This
 * mounts the real components with a null resolution and asserts on rendered
 * DOM.
 */
import { JSDOM } from 'jsdom';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import * as React from 'react';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

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

const noop = () => {};

async function main() {
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { ForecastProvider } = await import('../src/context/ForecastContext');
  const { WhatIfTab } = await import('../src/components/WhatIfTab');
  const { ViewFilterBar } = await import('../src/components/ViewFilterBar');

  // Errors React swallows into its own boundary reporting still surface here.
  const thrown: string[] = [];
  const origErr = console.error;
  console.error = (...a: any[]) => { thrown.push(a.map(String).join(' ')); };

  const host = document.getElementById('root')!;
  host.replaceChildren();
  const container = document.createElement('div');
  host.appendChild(container);
  const root = createRoot(container);

  // REAL rows. The first version of this harness passed data: [], which makes
  // most paths trivially safe and would have certified a screen nobody has.
  const EDGE = 'test-data/VBU_IBRO_EdgeCases_ShortHistory_PerScenarioARPU_Jan2023_Jun2026.xlsx';
  const wb = XLSX.read(fs.readFileSync(EDGE), { type: 'buffer', cellDates: true });
  const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

  const props: any = {
    data: rows,
    wiDateCol: 'Month', wiMetricCol: 'IBRO_Scenario_Type', wiValueCol: 'Subscriber_Volume',
    wiInflowVal: 'Inflow', wiOutflowVal: 'Outflow', wiRetentionVal: 'Retention', wiBaseVal: 'Base',
    wiSegmentCol: 'Customer_Segment', wiProductCol: 'Product_L1', wiProductL2Col: 'Product_L2_Value_Tier',
    wiChannelCol: 'Channel_Level_1', wiChannelL2Col: 'Channel_Level_2',
    wiTariffL1Col: 'tariff_tier_l1', wiTariffL2Col: 'tariff_tier_l2',
    wiRevenueCol: 'Monthly_Revenue_GBP', wiArpuCol: 'Avg_Unit_Price_GBP',
    productTree: new Map(), channelTree: new Map(), tariffTree: new Map(),
    // Every REQUIRED prop, supplied. Omitting one throws inside a dependency
    // array and looks exactly like an app defect - the first run of this
    // harness did precisely that and nearly got reported as the A5 crash.
    newEvent: {}, setNewEvent: noop, marketEvents: [], setMarketEvents: noop,
    addMarketEvent: noop, removeMarketEvent: noop, updateMarketEvent: noop,
    yieldEvents: [], newYieldEvent: {}, setNewYieldEvent: noop, addYieldEvent: noop,
    removeYieldEvent: noop, updateYieldEvent: noop, clearAllYieldEvents: noop,
    pricingEvents: [], newPricingEvent: {}, setNewPricingEvent: noop,
    addPricingEvent: noop, removePricingEvent: noop, updatePricingEvent: noop,
    clearAllPricingEvents: noop,
    // Passed by App and previously omitted here. A hook can branch on these,
    // so a harness without them exercises a different component.
    selectedTariffs: [], setSelectedTariffs: noop, cohortAvgArpu: 0,
    formatNumber: (x: any) => String(x), setActiveView: noop, downloadExcel: noop,
    activeFilter: {
      segment: 'Large Enterprise', product: { l1: 'Fixed Connectivity', l2: null },
      channel: { l1: null, l2: null }, tariff: { l1: null, l2: null },
    },
  };

  /** Mount the Step 2 path with a given baseForecast and report what happened. */
  async function mount(bf: any, opts: { store?: Map<string, any>; legacy?: boolean; reason?: any } = {}) {
    const c = document.createElement('div');
    host.replaceChildren(); host.appendChild(c);
    const r = createRoot(c);
    let threw: Error | null = null;
    const store = opts.store ?? new Map();
    const legacy = opts.legacy ?? true;
    const reason = 'reason' in opts ? opts.reason : (bf ? null : 'insufficient-history');
    try {
      await (act as any)(async () => {
        r.render(React.createElement(ForecastProvider as any, {
          baseForecast: bf, setBaseForecast: noop,
          adjustedForecast: null, setAdjustedForecast: noop,
          forecastStore: store, setForecastStore: noop, hasLegacyBaseline: legacy,
          resolveForecast: () => ({ forecast: bf, reason }),
          canResolve: () => !!bf,
        }, React.createElement(WhatIfTab as any, { ...props, noForecastReason: reason })));
      });
    } catch (e: any) { threw = e; origErr('STACK>>>', e && e.stack); }
    return { threw, text: c.textContent ?? '', kids: c.childElementCount, svgs: c.querySelectorAll('svg').length };
  }

  let renderThrew: Error | null = null;
  try {
    await (act as any)(async () => {
      root.render(React.createElement(ForecastProvider as any, {
        // THE CASE: the all-short aggregate. resolveForecast correctly returns
        // null with reason 'insufficient-history' - every leaf behind the key
        // exists and none of them fitted.
        baseForecast: null, setBaseForecast: noop,
        adjustedForecast: null, setAdjustedForecast: noop,
        forecastStore: new Map(), setForecastStore: noop, hasLegacyBaseline: true,
        resolveForecast: () => ({ forecast: null, reason: 'insufficient-history' }),
        canResolve: () => false,
      }, React.createElement(React.Fragment, null,
        // The Step 2 path is BOTH of these. ViewFilterBar is the sibling that
        // renders from the same filter change, so a harness mounting only the
        // tab would clear half the screen and call it proven.
        React.createElement(ViewFilterBar as any, {
          filter: props.activeFilter, onChange: noop, segments: ['Large Enterprise'],
          productTree: new Map([['Fixed Connectivity', []]]), channelTree: new Map(),
          tariffTree: new Map(), hasForecast: false, onGoToStep1: noop,
        }),
        React.createElement(WhatIfTab as any, props))));
    });
  } catch (e: any) {
    renderThrew = e;
    origErr('STACK>>>', e && e.stack);
  }
  console.error = origErr;

  const text = container.textContent ?? '';

  check('Step 2 renders without throwing when the resolution is null',
    !renderThrew, renderThrew ? String(renderThrew.message).slice(0, 160) : '');
  check('Step 2 produced DOM rather than a blank container',
    container.childElementCount > 0 || text.length > 0,
    `children=${container.childElementCount} textLen=${text.length}`);
  // The designed empty state, WhatIfTab.tsx:2284. Keyed strings, so match on
  // the rendered English rather than the key.
  // i18n is not initialised in this harness, so t() returns the KEY.
  // This mount uses the default legacy: true - a session that HAS generated -
  // so the correct destination is the reason state, not the never-generated
  // one. Naming which state it expects is the point: an assertion that accepts
  // "any empty state" is what let the wrong message ship.
  check('Step 2 shows the designed empty state, not a blank screen',
    /whatif_no_forecast_for_selection/.test(text) && !/whatif_no_baseline_forecast_yet/.test(text),
    text.slice(0, 200).replace(/\s+/g, ' '));
  const real = thrown.filter(t => !/not wrapped in act|Warning: /i.test(t));
  check('Step 2 logged no render error',
    real.length === 0, real.slice(0, 2).join(' | ').slice(0, 300));

  // ── CASE 2: a DERIVED aggregate, whose ARPU bounds are ABSENT by design ──
  // The A5 walk was specced as a null case, but on the fixture actually loaded
  // (ProductL2_Full) that same filter resolves to a DERIVED forecast with 27
  // fitted leaves - not null. A derived aggregate is the object whose ArpuBand
  // bounds are deliberately absent, so it is the one a band-reading chart is
  // most likely to trip over.
  {
    const { buildCohortDataMap, buildRollUpIndex, deriveAggregate, makeForecastKey } =
      await import('../src/utils/forecasting');
    const { runForecastJob } = await import('../src/workers/forecasting.worker');
    const PL2 = 'test-data/VBU_IBRO_Synthetic_ForecastTest_ProductL2_Full_Jan2023_Jun2026.xlsx';
    const w2 = XLSX.read(fs.readFileSync(PL2), { type: 'buffer', cellDates: true });
    const r2: any[] = XLSX.utils.sheet_to_json(w2.Sheets[w2.SheetNames[0]]);
    // ProductL2_Full carries NO tariff columns - the unmapped shape, as loaded.
    const dm2 = buildCohortDataMap(r2, 'Month', 'Customer_Segment', 'Product_L1',
      'Product_L2_Value_Tier', 'Channel_Level_1', 'Channel_Level_2', '', '');
    const leaves2 = [...dm2.keys()];
    const job2 = runForecastJob({ workerId: 0, config: {
        wiDateCol: 'Month', wiMetricCol: 'IBRO_Scenario_Type', wiValueCol: 'Subscriber_Volume',
        wiSegmentCol: 'Customer_Segment', wiProductCol: 'Product_L1', wiProductL2Col: 'Product_L2_Value_Tier',
        wiChannelCol: 'Channel_Level_1', wiChannelL2Col: 'Channel_Level_2', wiTariffL1Col: '', wiTariffL2Col: '',
        wiInflowVal: 'Inflow', wiOutflowVal: 'Outflow', wiBaseVal: 'Base', wiRetentionVal: 'Retention',
        wiArpuCol: 'Avg_Unit_Price_GBP', wiRevenueCol: 'Monthly_Revenue_GBP',
        genLength: 12, runPreUnc: 1.28, runPostExp: 0.02, runConfHor: 3,
        runModel: 'Holt Linear', autoModel: false, autoConfidence: false, oneOffMonths: {} },
      rows: r2 as any, standardCohorts: [],
      ibroCohorts: leaves2.map(k => { const [seg, prod, prodL2, chan, chanL2, tariffL1, tariffL2] = k.split('|');
        return { fKey: k, seg, prod, prodL2, chan, chanL2, tariffL1, tariffL2 }; }),
    } as any);
    const store2 = new Map<string, any>(job2.newTypedForecasts);
    const { leafMap: lm2 } = buildRollUpIndex(leaves2);
    const k2 = makeForecastKey('Large Enterprise', 'Fixed Connectivity', 'All', 'All', 'All', 'All', 'All');
    const bfs2 = (lm2.get(k2) ?? []).map(k => store2.get(k)).filter(Boolean);
    const derived = deriveAggregate(bfs2 as any, { segment: 'Large Enterprise', product: 'Fixed Connectivity',
      productL2: 'All', channel: 'All', channelL2: 'All', tariffL1: 'All', tariffL2: 'All', scenario: 'Base Case' } as any);

    check('CASE 2 premise: the walked filter resolves DERIVED on the loaded fixture',
      !!derived && (derived.provenance as any).kind === 'derived' && bfs2.length === 27,
      `leaves=${bfs2.length} kind=${derived ? (derived.provenance as any).kind : 'null'}`);
    check('CASE 2 premise: its ARPU bounds are ABSENT, as designed for derived',
      !!derived && derived.months[0].arpu.optimistic === undefined,
      derived ? String(derived.months[0].arpu.optimistic) : 'n/a');

    const c2 = await mount(derived);
    check('Step 2 renders a DERIVED aggregate without throwing',
      !c2.threw, c2.threw ? String(c2.threw.message).slice(0, 200) : '');
    check('Step 2 produced DOM for the derived case',
      c2.kids > 0 || c2.text.length > 0, `children=${c2.kids} textLen=${c2.text.length}`);
    // ANTI-VACUITY. Recharts bails at width -1 and paints nothing, so "no
    // throw" would certify a chart path that never ran. Count what painted.
    check('CASE 2 actually painted a chart - otherwise the chart path is untested',
      c2.svgs > 0, `svg elements=${c2.svgs}`);
  }

  // ── THE TWO MEANINGS OF NULL ─────────────────────────────────────────────
  // Before the seam, a null baseForecast meant only "nothing generated yet", so
  // "No Baseline Forecast Yet - go to Step 1" was always true. The seam gave
  // null a second meaning - a generation exists, this SELECTION resolves to
  // nothing - and the screen kept speaking the first. A reviewer with 7,588 bulk
  // forecasts was told none existed and sent to Step 1, the fit-on-aggregate
  // path Phase 3 removes.
  {
    const NEVER = /whatif_no_baseline_forecast_yet/;
    const REASON = /whatif_no_forecast_for_selection/;
    const STEP1 = /common_go_to_step_1/;

    // (a) Nothing generated at all -> the original never-generated state.
    const virgin = await mount(null, { store: new Map(), legacy: false, reason: null });
    check('NEVER-GENERATED: empty store and no legacy shows the Step 1 state',
      NEVER.test(virgin.text) && !REASON.test(virgin.text),
      virgin.text.slice(0, 120).replace(/\s+/g, ' '));
    check('NEVER-GENERATED: keeps the Go to Step 1 action', STEP1.test(virgin.text));

    // (b) A generation exists but THIS selection resolves null -> the reason.
    const populated = new Map<string, any>([['x', {} as any]]);
    const sel = await mount(null, { store: populated, legacy: false, reason: 'insufficient-history' });
    check('SELECTION-NULL: a non-empty store shows the reason state, not Step 1',
      REASON.test(sel.text) && !NEVER.test(sel.text),
      sel.text.slice(0, 160).replace(/\s+/g, ' '));
    check('SELECTION-NULL: states the CAUSE, through the shared reason enum',
      /skip_reason_insufficient_history/.test(sel.text),
      sel.text.slice(0, 160).replace(/\s+/g, ' '));
    check('SELECTION-NULL: offers NO Step 1 redirect - Step 1 cannot fix short history',
      !STEP1.test(sel.text), sel.text.slice(0, 160).replace(/\s+/g, ' '));

    // The other reason code must reach the screen too, or the enum is decorative.
    const sel2 = await mount(null, { store: populated, legacy: false, reason: 'never-enumerated' });
    check('SELECTION-NULL: the never-enumerated code renders its own copy',
      /skip_reason_never_enumerated/.test(sel2.text),
      sel2.text.slice(0, 160).replace(/\s+/g, ' '));

    // A legacy session with an empty store still counts as generated.
    const legacyOnly = await mount(null, { store: new Map(), legacy: true, reason: 'insufficient-history' });
    check('SELECTION-NULL: a legacy baseline counts as generated',
      REASON.test(legacyOnly.text) && !NEVER.test(legacyOnly.text),
      legacyOnly.text.slice(0, 120).replace(/\s+/g, ' '));
  }

  // ── THE TRANSITION. Mounting with X does not cover transitioning to X. ──
  // In React that distinction is where hook-order violations live: a first
  // render with null skips a hook consistently, so nothing is wrong; a render
  // that skips a hook the PREVIOUS render ran throws "Rendered fewer hooks
  // than expected". The mount cases above passed while the real app blanked.
  {
    const { buildCohortDataMap, buildRollUpIndex, deriveAggregate, makeForecastKey } =
      await import('../src/utils/forecasting');
    const { runForecastJob } = await import('../src/workers/forecasting.worker');
    const dmE = buildCohortDataMap(rows, 'Month', 'Customer_Segment', 'Product_L1',
      'Product_L2_Value_Tier', 'Channel_Level_1', 'Channel_Level_2', 'tariff_tier_l1', 'tariff_tier_l2');
    const leavesE = [...dmE.keys()];
    const jobE = runForecastJob({ workerId: 0, config: {
        wiDateCol: 'Month', wiMetricCol: 'IBRO_Scenario_Type', wiValueCol: 'Subscriber_Volume',
        wiSegmentCol: 'Customer_Segment', wiProductCol: 'Product_L1', wiProductL2Col: 'Product_L2_Value_Tier',
        wiChannelCol: 'Channel_Level_1', wiChannelL2Col: 'Channel_Level_2',
        wiTariffL1Col: 'tariff_tier_l1', wiTariffL2Col: 'tariff_tier_l2',
        wiInflowVal: 'Inflow', wiOutflowVal: 'Outflow', wiBaseVal: 'Base', wiRetentionVal: 'Retention',
        wiArpuCol: 'Avg_Unit_Price_GBP', wiRevenueCol: 'Monthly_Revenue_GBP',
        genLength: 12, runPreUnc: 1.28, runPostExp: 0.02, runConfHor: 3,
        runModel: 'Holt Linear', autoModel: false, autoConfidence: false, oneOffMonths: {} },
      rows: rows as any, standardCohorts: [],
      ibroCohorts: leavesE.map(k => { const [seg, prod, prodL2, chan, chanL2, tariffL1, tariffL2] = k.split('|');
        return { fKey: k, seg, prod, prodL2, chan, chanL2, tariffL1, tariffL2 }; }),
    } as any);
    const storeE = new Map<string, any>(jobE.newTypedForecasts);
    const { leafMap: lmE } = buildRollUpIndex(leavesE);
    // A cohort that DOES resolve - Jon's starting point before he switches.
    const okKey = makeForecastKey('SOHO', 'All', 'All', 'All', 'All', 'All', 'All');
    const okBfs = (lmE.get(okKey) ?? []).map(k => storeE.get(k)).filter(Boolean);
    const loaded = deriveAggregate(okBfs as any, { segment: 'SOHO', product: 'All', productL2: 'All',
      channel: 'All', channelL2: 'All', tariffL1: 'All', tariffL2: 'All', scenario: 'Base Case' } as any);
    check('TRANSITION premise: the starting cohort really resolves', !!loaded,
      `leaves=${okBfs.length}`);

    // ONE root, re-rendered. Two separate mounts would not share hook state
    // and could never reproduce this.
    const c = document.createElement('div');
    host.replaceChildren(); host.appendChild(c);
    const r = createRoot(c);
    const paint = (bf: any) => React.createElement(ForecastProvider as any, {
      baseForecast: bf, setBaseForecast: noop, adjustedForecast: null, setAdjustedForecast: noop,
      // storeE is the REAL fitted store, and hasLegacyBaseline is false: the
      // "has anything been generated" answer must come from the store, exactly
      // as it does for a user who bulk-generated and never used Step 1.
      forecastStore: storeE, setForecastStore: noop, hasLegacyBaseline: false,
      resolveForecast: () => ({ forecast: bf, reason: bf ? null : 'insufficient-history' }),
      canResolve: () => !!bf,
    }, React.createElement(WhatIfTab as any, {
      ...props, noForecastReason: bf ? null : 'insufficient-history',
    }));

    let tErr: Error | null = null;
    try {
      await (act as any)(async () => { r.render(paint(loaded)); });
      // THE STEP THAT CRASHED: Jon switching to LE - Fixed Connectivity,
      // whose resolution is correctly null.
      await (act as any)(async () => { r.render(paint(null)); });
    } catch (e: any) { tErr = e; origErr('TRANSITION STACK>>>', e && e.stack); }
    const tTxt = c.textContent ?? '';
    check('TRANSITION forecast -> null does not throw', !tErr,
      tErr ? String(tErr.message).slice(0, 160) : '');
    // The store is POPULATED here - a forecast was just displayed from it - so
    // the correct destination is the reason state. Asserting merely "an empty
    // state" would have passed while the screen told the user nothing had ever
    // been generated, which is the defect this transition exists to catch.
    check('TRANSITION forecast -> null shows the empty state, not a blank page',
      /whatif_no_forecast_for_selection|whatif_no_baseline_forecast_yet/.test(tTxt),
      tTxt.slice(0, 140).replace(/\s+/g, ' '));
    check('TRANSITION forecast -> null shows the REASON state, not never-generated',
      /whatif_no_forecast_for_selection/.test(tTxt) && !/whatif_no_baseline_forecast_yet/.test(tTxt),
      tTxt.slice(0, 160).replace(/\s+/g, ' '));

    // And back again: null -> forecast must restore the working screen.
    let bErr: Error | null = null;
    try { await (act as any)(async () => { r.render(paint(loaded)); }); }
    catch (e: any) { bErr = e; origErr('REVERSE STACK>>>', e && e.stack); }
    check('TRANSITION null -> forecast does not throw', !bErr,
      bErr ? String(bErr.message).slice(0, 160) : '');
    check('TRANSITION null -> forecast restores the working screen',
      !/whatif_no_baseline_forecast_yet/.test(c.textContent ?? ''),
      (c.textContent ?? '').slice(0, 120).replace(/\s+/g, ' '));
  }

  // ── The boundary: a throw must become a REPORT, never a blank page ───────
  {
    const { ErrorBoundary } = await import('../src/components/ErrorBoundary');
    const Boom = () => { throw new Error('planted render failure'); };
    /** Mount a throwing child under the boundary at a chosen verbosity. */
    async function boundary(dev: boolean) {
      const c = document.createElement('div');
      host.replaceChildren(); host.appendChild(c);
      const r = createRoot(c);
      let escaped: Error | null = null;
      try {
        await (act as any)(async () => {
          r.render(React.createElement(ErrorBoundary as any, { dev }, React.createElement(Boom)));
        });
      } catch (e: any) { escaped = e; }
      return { escaped, t: c.textContent ?? '', kids: c.childElementCount };
    }
    const d = await boundary(true);
    const { escaped, kids } = d; const t = d.t;
    void kids;
    check('BOUNDARY: a child throw does not escape to the root', !escaped,
      escaped ? String(escaped.message) : '');
    check('BOUNDARY: the page is not blank after a throw',
      d.kids > 0 && t.length > 0, `children=${d.kids} textLen=${t.length}`);
    check('BOUNDARY: the planted message reaches the screen in dev',
      /planted render failure/.test(t), t.slice(0, 140).replace(/\s+/g, ' '));
    check('BOUNDARY: a reload action is offered',
      /reload/i.test(t), t.slice(0, 140).replace(/\s+/g, ' '));
    check('BOUNDARY dev: the stack reaches the screen, not just the message',
      /at Boom|ErrorBoundary\.tsx|null-render-spec/.test(t), 'no stack text found');

    // PROD is the branch a UAT tester sees, and it must NOT leak the stack.
    const pr = await boundary(false);
    check('BOUNDARY prod: not blank', pr.kids > 0 && pr.t.length > 0, `kids=${pr.kids}`);
    check('BOUNDARY prod: a plain apology, no planted message',
      !/planted render failure/.test(pr.t) && /went wrong/i.test(pr.t),
      pr.t.slice(0, 120).replace(/\s+/g, ' '));
    check('BOUNDARY prod: still offers reload', /reload/i.test(pr.t));
  }

  console.log(`null-render spec: ${pass} passed, ${fails.length} failed`);
  fails.forEach(f => console.log('  FAIL ' + f));
  process.exit(fails.length ? 1 : 0);
}
main().catch(e => { console.error('ABORT', e); process.exit(2); });
