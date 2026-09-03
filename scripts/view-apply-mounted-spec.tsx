/**
 * UAT-D2-03 — A LEAF-SCOPED EVENT AT A BROADER VIEW, DRIVEN THROUGH THE CARD.
 *
 *   npm run spec:view-apply-mounted
 *
 * WHY THIS FILE EXISTS, AND WHY THE ARC NEEDED IT.
 *
 * Three sessions measured this defect and none reproduced it, because every
 * check handed `computeAdjustedForecast` the event directly. Done that way the
 * engine is correct — 1634 measured it returning 8,000.00 at the All view for
 * the very event the app displayed +0.00 for. The defect was never in the
 * engine. It was in what reached the engine: a filter running BEFORE it, in
 * the card.
 *
 * A spec that calls the engine cannot see a filter in front of the engine. So
 * this one mounts the card and reads the rendered KPI, which is the only
 * position from which "the event never arrived" and "the engine mishandled it"
 * look different.
 *
 * THE MECHANISM IT PINS: "All" has two representations. The apply path carried
 * its own copy of the scope rule and tested the view side with `!vprodL1`, so
 * only `null` counted as All. `cohortScope` maps `cohort.product ?? null`, and
 * `??` converts only nullish, so a cohort whose product is the STRING 'All'
 * stayed 'All' — truthy — and the event was withheld from every view broad
 * enough to contain it.
 *
 * SELECTORS ARE TESTIDS, never text: the KPI labels are translated, so a text
 * selector here would be a locale bomb that passes in en and fails in de.
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
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? '  [' + d + ']' : '')); };

function report() {
  console.log('\nview-apply-mounted spec: ' + pass + '/' + (pass + fails.length) + ' passed');
  fails.forEach(f => console.log('  FAIL  ' + f));
  if (!fails.length) console.log('  every check green');
  // Unconditional: JSDOM keeps the loop alive after a green run, and a spec
  // that hangs on success is indistinguishable from one that hangs on a defect.
  process.exit(fails.length ? 1 : 0);
}

const MONTHS = ['2026-01', '2026-02', '2026-03'];

async function main() {
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const i18n = (await import('../src/i18n')).default;
  await (i18n as any).init?.();
  const fc: any = await import('../src/utils/forecasting');
  const { ForecastProvider } = await import('../src/context/ForecastContext');
  const M: any = (await import('../src/components/WhatIfTab')).WhatIfTab;

  const noop = () => {};
  const band = (m: number) => ({ mean: m, optimistic: m * 1.1, pessimistic: m * 0.9 });

  /**
   * TWO LEAVES WITH DELIBERATELY DIFFERENT SHAPES.
   *
   * The forecast inflows and the historical rows are given DIFFERENT mixes:
   * history splits 300/700, the forecast splits 200/800. That is the
   * discriminating condition — a fixture whose historical and forecast ratios
   * agree cannot tell a history-weighted coverage from a forecast-weighted
   * one, which is exactly how this family of defect survived three sessions.
   */
  const mkLeaf = (product: string, inflow: number) => ({
    cohort: { segment: 'Corporate', product, productL2: 'All', channel: 'All',
              channelL2: 'All', tariffL1: 'All', tariffL2: 'All', scenario: 'Standard Forecast' },
    seedBaseVolume: 10000, seedBaseKnown: true,
    historicalMonths: ['2025-10', '2025-11', '2025-12'],
    lastHistoricalInflow: inflow, lastHistoricalOutflow: 0,
    provenance: 'fitted' as const,
    months: MONTHS.map(month => ({
      month, inflow: band(inflow), outflow: band(0), retention: band(0), arpu: band(20),
    })),
  });

  const A = mkLeaf('Mobile Voice', 200);   // forecast 200 ... history 300
  const B = mkLeaf('Broadband', 800);      // forecast 800 ... history 700

  const keyA = fc.makeForecastKey('Corporate', 'Mobile Voice', 'All', 'All', 'All', 'All', 'All');
  const keyB = fc.makeForecastKey('Corporate', 'Broadband', 'All', 'All', 'All', 'All', 'All');
  const store = new Map<string, any>([[keyA, A], [keyB, B]]);
  const leafMap = fc.buildRollUpIndex([keyA, keyB]).leafMap;
  const resolveForecast = (key: string) => fc.resolveFromStore(store, leafMap, key);

  // Historical rows — the mix the history-weighted coverage would have used.
  const C = { date: 'Month', seg: 'Segment', prod: 'Product', prodL2: 'ProductL2',
              chan: 'Channel', chanL2: 'ChannelL2', metric: 'Metric', val: 'Volume' };
  const rowFor = (product: string, vol: number) => MONTHS.map(m => ({
    [C.date]: m, [C.seg]: 'Corporate', [C.prod]: product, [C.prodL2]: 'All',
    [C.chan]: 'All', [C.chanL2]: 'All', [C.metric]: 'Inflow', [C.val]: vol,
  }));
  const data = [...rowFor('Mobile Voice', 300), ...rowFor('Broadband', 700)];

  const EVENT_ABS = {
    id: 'evt-abs', sequence: 1, scenario: 'Inflow', date: MONTHS[0],
    amountType: 'absolute', subscriberVolume: 1000, arpu: 0,
    segment: 'Corporate', product: 'Mobile Voice', productL2: 'All',
    channel: 'All', channelL2: 'All', tariffL1: 'All', tariffL2: 'All',
    name: 'abs', retentionLinked: false,
  } as any;

  const EVENT_PCT = { ...EVENT_ABS, id: 'evt-pct', amountType: 'percentage', subscriberVolume: 10 } as any;

  const propsFor = (marketEvents: any[]) => ({
    data,
    wiDateCol: C.date, wiSegmentCol: C.seg, wiProductCol: C.prod, wiProductL2Col: C.prodL2,
    wiChannelCol: C.chan, wiChannelL2Col: C.chanL2, wiMetricCol: C.metric,
    wiInflowVal: 'Inflow', wiOutflowVal: 'Outflow', wiRetentionVal: 'Retention',
    wiValueCol: C.val, wiRevenueCol: '', wiArpuCol: '',
    productTree: new Map([['Mobile Voice', ['All']], ['Broadband', ['All']]]),
    channelTree: new Map<string, string[]>(), tariffTree: new Map<string, string[]>(),
    selectedTariffs: [], setSelectedTariffs: noop, cohortAvgArpu: 20,
    marketEvents, setMarketEvents: noop,
    addMarketEvent: noop, removeMarketEvent: noop, updateMarketEvent: noop,
    yieldEvents: [], newYieldEvent: {}, setNewYieldEvent: noop, addYieldEvent: noop,
    removeYieldEvent: noop, clearAllYieldEvents: noop,
    pricingEvents: [], newPricingEvent: {}, setNewPricingEvent: noop, addPricingEvent: noop,
    removePricingEvent: noop, clearAllPricingEvents: noop,
    downloadExcel: noop, formatNumber: (v: any) => Number(v).toFixed(2), setActiveView: noop,
    missingMonths: [],
  } as any);

  /** Mount the card AT A VIEW and read the two KPI testids back. */
  const readAt = async (viewKey: string, marketEvents: any[], expandId?: string) => {
    const resolved = resolveForecast(viewKey);
    const host = document.getElementById('root')!;
    host.replaceChildren();
    const container = document.createElement('div');
    host.appendChild(container);
    const root = createRoot(container);
    const Harness = () => {
      const [newEvent, setNewEvent] = (React as any).useState({});
      return React.createElement(M, { ...propsFor(marketEvents), newEvent, setNewEvent });
    };
    await (act as any)(async () => {
      root.render(React.createElement(ForecastProvider as any, {
        baseForecast: resolved.forecast, setBaseForecast: noop,
        adjustedForecast: null, setAdjustedForecast: noop,
        forecastStore: store, setForecastStore: noop,
        resolveForecast, canResolve: () => true,
        hasLegacyBaseline: true, updatedAt: new Date().toISOString(),
        bulkRuns: [], setBulkRuns: noop,
      }, React.createElement(Harness)));
    });
    const q = (id: string) => container.querySelector('[data-testid="' + id + '"]') as any;
    const deltaEl = q('impact-base-delta');
    const countEl = q('impact-event-count');
    // OPEN THE DERIVATION EXPANDER, if asked for. The empty state is the whole
    // point of the ghost case, and it renders only for an expanded percentage
    // row — so a spec that never clicks the chevron cannot see the copy it is
    // meant to be pinning.
    let expanderText: string | null = null;
    if (expandId) {
      const btn = q('event-expand-' + expandId);
      if (btn) {
        await (act as any)(async () => { btn.dispatchEvent(
          new dom.window.MouseEvent('click', { bubbles: true })); });
        const empty = q('event-expander-empty');
        expanderText = empty ? String(empty.textContent).trim() : null;
      }
    }
    const out = {
      rendered: !!deltaEl,
      delta: deltaEl ? Number(String(deltaEl.textContent).replace(/[+,\s]/g, '')) : NaN,
      count: countEl ? String(countEl.textContent).trim() : null,
      expanderFound: expandId ? !!q('event-expand-' + expandId) : null,
      expanderText,
    };
    await (act as any)(async () => { root.unmount(); });
    return out;
  };

  const KEY_ALL  = fc.makeForecastKey('All', 'All', 'All', 'All', 'All', 'All', 'All');
  const KEY_CORP = fc.makeForecastKey('Corporate', 'All', 'All', 'All', 'All', 'All', 'All');

  // ── 0. THE FIXTURE DISCRIMINATES ─────────────────────────────────────────
  // Asserted BEFORE anything is concluded from it, so a fixture that could not
  // tell the two weightings apart fails here rather than passing everything
  // downstream for the wrong reason.
  const histRatio = 300 / (300 + 700);
  const fcstRatio = 200 / (200 + 800);
  check('fixture: historical and forecast mixes DIFFER',
    Math.abs(histRatio - fcstRatio) > 1e-9, 'hist ' + histRatio + ' vs forecast ' + fcstRatio);

  // ── 1. EVERY VIEW RESOLVES ───────────────────────────────────────────────
  // A null forecast renders no KPI card at all, and every delta check below
  // would then read NaN and pass vacuously.
  const viewList: [string, string][] = [
    ['All', KEY_ALL], ['Corporate/All', KEY_CORP], ['leaf', keyA], ['disjoint leaf', keyB],
  ];
  for (const [label, k] of viewList) {
    check('view resolves: ' + label, !!resolveForecast(k).forecast,
      'no forecast — every delta below would be vacuous');
  }

  // ── 2. THE ABSOLUTE EVENT ────────────────────────────────────────────────
  const leafAbs = await readAt(keyA, [EVENT_ABS]);
  const allAbs  = await readAt(KEY_ALL, [EVENT_ABS]);
  const corpAbs = await readAt(KEY_CORP, [EVENT_ABS]);
  const disjAbs = await readAt(keyB, [EVENT_ABS]);

  check('absolute: the KPI card RENDERS at the All view', allAbs.rendered,
    'no card means every number below is NaN and nothing is being tested');
  check('absolute: the LEAF view moves', leafAbs.delta > 0, 'delta ' + leafAbs.delta);
  check('absolute: the ALL view moves by EXACTLY the leaf delta',
    Math.abs(allAbs.delta - leafAbs.delta) < 0.005, 'All ' + allAbs.delta + ' vs leaf ' + leafAbs.delta);
  check('absolute: the intermediate Corporate/All view too',
    Math.abs(corpAbs.delta - leafAbs.delta) < 0.005, 'Corp ' + corpAbs.delta + ' vs leaf ' + leafAbs.delta);
  check('absolute: the caption counts 1 at the LEAF', leafAbs.count === '1', String(leafAbs.count));
  check('absolute: the caption counts 1 at ALL', allAbs.count === '1', String(allAbs.count));
  check('absolute: a DISJOINT leaf does not move', Math.abs(disjAbs.delta) < 0.005, 'delta ' + disjAbs.delta);
  check('absolute: and its caption counts 0', disjAbs.count === '0', String(disjAbs.count));

  // ── 3. THE PERCENTAGE EVENT on the discriminating fixture ────────────────
  const leafPct = await readAt(keyA, [EVENT_PCT]);
  const allPct  = await readAt(KEY_ALL, [EVENT_PCT]);
  const disjPct = await readAt(keyB, [EVENT_PCT]);

  check('percentage: the LEAF view moves', leafPct.delta > 0, 'delta ' + leafPct.delta);
  check('percentage: ALL === leaf TO THE PENNY where the mixes differ',
    Math.abs(allPct.delta - leafPct.delta) < 0.005, 'All ' + allPct.delta + ' vs leaf ' + leafPct.delta);
  check('percentage: the caption counts 1 at ALL', allPct.count === '1', String(allPct.count));
  check('percentage: a DISJOINT leaf does not move', Math.abs(disjPct.delta) < 0.005, 'delta ' + disjPct.delta);
  check('percentage: and its caption counts 0', disjPct.count === '0', String(disjPct.count));

  console.log('\n  absolute   leaf ' + leafAbs.delta + '   All ' + allAbs.delta
    + '   Corp ' + corpAbs.delta + '   disjoint ' + disjAbs.delta);
  console.log('  percentage leaf ' + leafPct.delta + '   All ' + allPct.delta
    + '   disjoint ' + disjPct.delta);

  // ── 4. THE GHOST: in scope at the view, landing on none of it ───────────
  //
  // Its product exists in no row and no leaf, so at the All view it PASSES the
  // scope predicate (the view is All, which meets everything) while its
  // coverage is a measured 0: the view is populated on inflow, and none of
  // that population is inside the event's target.
  //
  // That 0 is a real ratio, not a stand-in for "cannot tell". eventCoverage
  // and forecastCoverage both reserve separate behaviour for the empty cases —
  // the first falls back to 1 where nothing is populated, the second returns
  // null — so this fixture exercises the one path where 0 genuinely means
  // "lands on nothing here".
  const GHOST = { ...EVENT_ABS, id: 'evt-ghost', amountType: 'percentage',
                  subscriberVolume: 10, product: 'Satellite' } as any;

  check('ghost: it is IN SCOPE at All — otherwise this tests the wrong thing',
    fc.eventScopeMatchesView(
      { segment: GHOST.segment, product: GHOST.product, productL2: GHOST.productL2,
        channelL1: GHOST.channel, channelL2: GHOST.channelL2,
        tariffL1: GHOST.tariffL1, tariffL2: GHOST.tariffL2 },
      { segment: 'All', productL1: 'All', productL2: 'All', channelL1: 'All',
        channelL2: 'All', tariffL1: 'All', tariffL2: 'All' }),
    'a ghost that fails the predicate would be excluded for the OTHER reason');

  const ghostAll = await readAt(KEY_ALL, [GHOST], GHOST.id);
  const ghostLeaf = await readAt(keyA, [GHOST], GHOST.id);

  check('ghost: the KPI does not move at All', Math.abs(ghostAll.delta) < 0.005, 'delta ' + ghostAll.delta);
  check('ghost: and the caption EXCLUDES it at All', ghostAll.count === '0', String(ghostAll.count));
  check('ghost: the KPI does not move at the leaf either', Math.abs(ghostLeaf.delta) < 0.005, 'delta ' + ghostLeaf.delta);
  check('ghost: and the caption excludes it at the leaf', ghostLeaf.count === '0', String(ghostLeaf.count));

  // The expander must EXIST to be read. Without this, a missing chevron would
  // leave expanderText null and every copy check below would pass vacuously.
  check('ghost: the derivation expander is present to open', ghostAll.expanderFound === true,
    'no chevron — the copy checks below would be vacuous');
  check('ghost: the expander shows the ZERO-COVERAGE copy, not the out-of-scope one',
    ghostAll.expanderText === i18n.t('whatif_event_no_coverage_in_view'),
    JSON.stringify(ghostAll.expanderText));

  // A REAL out-of-scope event still gets the OTHER sentence. Without this the
  // pair could both be satisfied by always showing the zero-coverage string.
  const OUTSIDE = { ...EVENT_PCT, id: 'evt-outside', segment: 'Consumer' } as any;
  const outsideAt = await readAt(keyA, [OUTSIDE], OUTSIDE.id);
  check('out-of-scope: the expander shows the NOT-IN-VIEW copy instead',
    outsideAt.expanderText === i18n.t('whatif_event_not_in_current_view'),
    JSON.stringify(outsideAt.expanderText));
  check('the two sentences are DIFFERENT strings',
    i18n.t('whatif_event_no_coverage_in_view') !== i18n.t('whatif_event_not_in_current_view'),
    'one sentence cannot carry two reasons');

  // ── 5. THE COPY IS KEYED, so it is not English in a German session ───────
  // spec:i18n-parity owns bundle parity; this asserts the RENDERED string
  // changes with the language, which is exactly what a hardcoded literal
  // cannot do and what this session's D2-04 change exists to fix.
  const enText = i18n.t('whatif_event_no_coverage_in_view');
  await (i18n as any).changeLanguage('de');
  const deText = i18n.t('whatif_event_no_coverage_in_view');
  await (i18n as any).changeLanguage('it');
  const itText = i18n.t('whatif_event_no_coverage_in_view');
  await (i18n as any).changeLanguage('en');
  check('copy: de differs from en', !!deText && deText !== enText, deText);
  check('copy: it differs from en', !!itText && itText !== enText, itText);
  check('copy: neither is the key name echoed back',
    deText !== 'whatif_event_no_coverage_in_view' && itText !== 'whatif_event_no_coverage_in_view',
    'i18next echoes the key when a bundle is missing, which would satisfy a bare != test');

  console.log('\n  ghost      All delta ' + ghostAll.delta + ' count ' + ghostAll.count
    + '   leaf delta ' + ghostLeaf.delta + ' count ' + ghostLeaf.count);
  console.log('  ghost copy en/de/it: '
    + JSON.stringify([enText.slice(0, 26), deText.slice(0, 26), itText.slice(0, 26)]));

  report();
}

main().catch(e => {
  console.log('view-apply-mounted spec CRASHED — ' + (e?.stack || e));
  process.exit(1);
});
