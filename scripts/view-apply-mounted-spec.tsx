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
    // PER-SCENARIO ARPU BANDS ARE PART OF THE FIXTURE, not an afterthought.
    // Without them every per-scenario column is a named absence and every
    // delta below reads the em dash — which would make the Q4 assertions pass
    // for the wrong reason. Measured on the first run: all four null at the
    // leaf, so the fixture could not have told a working card from a broken one.
    months: MONTHS.map(month => ({
      // RETENTION IS NON-ZERO so the DERIVED aggregate has a retention ARPU to
      // fit. With retention 0 on every leaf the All view's retention band is a
      // named absence, and every retention assertion below reads the em dash —
      // measured on the first run: retention moved at the leaf and was null at
      // All, which would have looked like a scoping defect and was a fixture gap.
      month, inflow: band(inflow), outflow: band(0), retention: band(100), arpu: band(20),
      inflowArpu: band(22), outflowArpu: band(18), retentionArpu: band(21), baseArpu: band(20),
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

  const propsFor = (marketEvents: any[], dataOverride?: any[]) => ({
    data: dataOverride ?? data,
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
  const readAt = async (viewKey: string, marketEvents: any[], expandId?: string,
                        dataOverride?: any[]) => {
    const resolved = resolveForecast(viewKey);
    const host = document.getElementById('root')!;
    host.replaceChildren();
    const container = document.createElement('div');
    host.appendChild(container);
    const root = createRoot(container);
    const Harness = () => {
      const [newEvent, setNewEvent] = (React as any).useState({});
      return React.createElement(M, { ...propsFor(marketEvents, dataOverride), newEvent, setNewEvent });
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
    const arpuEl  = q('impact-arpu-delta');
    const perScen = (k: string) => {
      const el = q('impact-arpu-delta-' + k);
      if (!el) return NaN;
      const txt = String(el.textContent).trim();
      return txt === '—' ? null : Number(txt.replace(/[+,\s]/g, ''));
    };
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
      arpuDelta: arpuEl ? Number(String(arpuEl.textContent).replace(/[+,\s]/g, '')) : NaN,
      arpuInflow: perScen('inflow'), arpuOutflow: perScen('outflow'),
      arpuRetention: perScen('retention'), arpuBase: perScen('base'),
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

  // ── 6. THE ABSOLUTE GHOST — the case the suite was silent on ────────────
  //
  // 0857 measured the blast radius of this change across all 55 specs and
  // found it zero, which cuts both ways: nothing existing would catch the
  // change going in wrong, so the fixture has to come with it.
  //
  // Same ghost scope as above, absolute this time. Absolute events are
  // weighted by eventProRataShare, not by coverage, and its empty-target
  // branch used to answer 1 for two different questions — "no leaf exists for
  // this metric" (cannot answer) and "leaves exist, none is in the target"
  // (a measured nothing). This asserts the second now answers 0 while the
  // first still takes the legacy fallback.
  const ABS_GHOST = { ...EVENT_ABS, id: 'evt-absghost', product: 'Satellite' } as any;

  const scopeOf = (e: any) => ({
    segment: e.segment, product: e.product, productL2: e.productL2,
    channel: e.channel, channelL2: e.channelL2,
    tariffL1: e.tariffL1, tariffL2: e.tariffL2,
  });

  check('abs-ghost: it PASSES the scope predicate at All',
    fc.eventScopeMatchesView(
      { segment: ABS_GHOST.segment, product: ABS_GHOST.product, productL2: ABS_GHOST.productL2,
        channelL1: ABS_GHOST.channel, channelL2: ABS_GHOST.channelL2,
        tariffL1: ABS_GHOST.tariffL1, tariffL2: ABS_GHOST.tariffL2 },
      { segment: 'All', productL1: 'All', productL2: 'All', channelL1: 'All',
        channelL2: 'All', tariffL1: 'All', tariffL2: 'All' }),
    'a ghost that fails the predicate is excluded for the OTHER reason and tests nothing');

  // The leaf set the engine builds for Inflow from the loaded rows: two leaves,
  // neither inside the ghost's target. This is the MEASURED-ZERO world.
  const inflowLeaves = [
    { segment: 'Corporate', product: 'Mobile Voice', productL2: 'All', channel: 'All',
      channelL2: 'All', tariffL1: 'All', tariffL2: 'All', volume: 300, hasMetricData: true },
    { segment: 'Corporate', product: 'Broadband', productL2: 'All', channel: 'All',
      channelL2: 'All', tariffL1: 'All', tariffL2: 'All', volume: 700, hasMetricData: true },
  ];
  const viewScopeOf = (seg: string, prod: string) => ({
    segment: seg, product: prod, productL2: 'All', channel: 'All',
    channelL2: 'All', tariffL1: 'All', tariffL2: 'All',
  });

  const shareAll  = fc.eventProRataShare(scopeOf(ABS_GHOST), viewScopeOf('All', 'All'), inflowLeaves);
  const shareCorp = fc.eventProRataShare(scopeOf(ABS_GHOST), viewScopeOf('Corporate', 'All'), inflowLeaves);
  const shareLeaf = fc.eventProRataShare(scopeOf(ABS_GHOST), viewScopeOf('Corporate', 'Mobile Voice'), inflowLeaves);
  // CANNOT ANSWER: no leaf exists for this metric at all. The legacy
  // all-or-nothing fallback survives here and ONLY here.
  const shareNoLeaves = fc.eventProRataShare(scopeOf(ABS_GHOST), viewScopeOf('All', 'All'), []);

  check('abs-ghost: share at All is a measured 0, not the legacy 1',
    shareAll === 0, String(shareAll));
  check('abs-ghost: share at the intermediate Corporate/All is 0',
    shareCorp === 0, String(shareCorp));
  check('abs-ghost: share at a real leaf is 0',
    shareLeaf === 0, String(shareLeaf));
  // TWO LAYERS, TWO ASSERTIONS. The FUNCTION answers null — there is no
  // denominator, and null is the contract forecastCoverage already keeps. The
  // CALL SITE resolves that null to the legacy 1. Asserting only the first
  // would let a call site quietly drop the fallback; asserting only the second
  // would let the function answer 0 and look identical from outside until
  // something multiplied by it.
  check('cannot-answer: the FUNCTION answers null, not 0 and not 1',
    shareNoLeaves === null, String(shareNoLeaves));

  // THE CANNOT-ANSWER WORLD, MOUNTED. Rows exist, but none is Inflow, so the
  // Inflow leaf set the engine builds is EMPTY — no denominator. An absolute
  // Inflow event on a real leaf must still apply IN FULL: that is what the
  // legacy fallback was written to protect and the one case it still covers.
  // If this goes red, the split took the fallback from the case that needed it.
  const outflowOnlyRows = data.map(r => ({ ...r, [C.metric]: 'Outflow' }));
  const cannotAnswer = await readAt(KEY_ALL, [EVENT_ABS], undefined, outflowOnlyRows);
  check('cannot-answer: mounted, an absolute event still applies IN FULL',
    Math.abs(cannotAnswer.delta - 1000) < 0.005, 'delta ' + cannotAnswer.delta);
  check('cannot-answer: and it is still counted as applied',
    cannotAnswer.count === '1', String(cannotAnswer.count));

  const absGhostAll  = await readAt(KEY_ALL, [ABS_GHOST], undefined);
  const absGhostCorp = await readAt(KEY_CORP, [ABS_GHOST], undefined);
  const absGhostLeaf = await readAt(keyA, [ABS_GHOST], ABS_GHOST.id);

  check('abs-ghost: the KPI does not move at All', Math.abs(absGhostAll.delta) < 0.005,
    'delta ' + absGhostAll.delta);
  check('abs-ghost: nor at the intermediate view', Math.abs(absGhostCorp.delta) < 0.005,
    'delta ' + absGhostCorp.delta);
  check('abs-ghost: nor at a real leaf', Math.abs(absGhostLeaf.delta) < 0.005,
    'delta ' + absGhostLeaf.delta);
  check('abs-ghost: the caption EXCLUDES it at All', absGhostAll.count === '0', String(absGhostAll.count));
  check('abs-ghost: and at the leaf', absGhostLeaf.count === '0', String(absGhostLeaf.count));

  console.log('\n  ABS GHOST share  All ' + shareAll + '   Corp/All ' + shareCorp
    + '   leaf ' + shareLeaf + '   (no-leaves cannot-answer ' + shareNoLeaves + ')');
  console.log('  ABS GHOST delta  All ' + absGhostAll.delta + ' count ' + absGhostAll.count
    + '   Corp/All ' + absGhostCorp.delta + ' count ' + absGhostCorp.count
    + '   leaf ' + absGhostLeaf.delta + ' count ' + absGhostLeaf.count);

  // ── 7. D3-02: THE RE-BANDED RETENTION POOL AT A BROADER VIEW ────────────
  //
  // A Retention promotion carrying a mix or pricing arm has promoRebanded set,
  // and the engine carves its volume into its OWN ARPU pool so the promo's
  // re-banded rate is isolated from the standing base. That pool is what makes
  // the promotion's ARPU visible at all.
  //
  // The pool's filter hand-rolled the seven dimension comparisons instead of
  // calling the shared predicate, and carried `!vprodL1` — so only null counted
  // as All. cohortScope hands the engine the STRING 'All', which is truthy, and
  // the pool was therefore never carved at any view broad enough to contain the
  // promotion. Same mechanism as D2-03, a different surface: there the event's
  // VOLUME went missing, here its ARPU does.
  //
  // Asserted on the rendered ARPU KPI by testid, because the pool's whole
  // purpose is an ARPU effect and an engine-level call could not see a filter
  // that runs before the pool is built.
  const REBANDED = {
    id: 'evt-rebanded', sequence: 9, scenario: 'Retention', date: MONTHS[0],
    amountType: 'absolute', subscriberVolume: 500, arpu: 40,
    segment: 'Corporate', product: 'Mobile Voice', productL2: 'All',
    channel: 'All', channelL2: 'All', tariffL1: 'All', tariffL2: 'All',
    name: 'rebanded promo', retentionLinked: false,
    isPromotion: true, promoRebanded: true,
    promoMixAxis: 'value', promoMix: { High: 100 },
  } as any;

  check('rebanded: the promo IS in scope at All by the shared predicate',
    fc.eventScopeMatchesView(
      { segment: REBANDED.segment, product: REBANDED.product, productL2: REBANDED.productL2,
        channelL1: REBANDED.channel, channelL2: REBANDED.channelL2,
        tariffL1: REBANDED.tariffL1, tariffL2: REBANDED.tariffL2 },
      { segment: 'All', productL1: 'All', productL2: 'All', channelL1: 'All',
        channelL2: 'All', tariffL1: 'All', tariffL2: 'All' }),
    'if it were out of scope at All the pool SHOULD be absent and this tests nothing');

  const rbLeaf = await readAt(keyA, [REBANDED], undefined);
  const rbAll  = await readAt(KEY_ALL, [REBANDED], undefined);
  const rbCorp = await readAt(KEY_CORP, [REBANDED], undefined);

  // ── THE POOL FEEDS ITS OWN SCENARIO, AND BASE ONLY FROM T+1 ─────────────
  // (Jon, 2026-09-03). The card is end-of-period, so the month a promotion
  // sits in decides which term can show it:
  //   - a promo in the LAST month feeds RETENTION there, and BASE must be 0,
  //     because the lag has not delivered it yet;
  //   - a promo one month earlier has been delivered, so BASE carries it.
  // The pair is what makes the lag assertion mean something: either alone
  // would pass on a build that ignored the lag in one direction.
  const REB_LAST = { ...REBANDED, id: 'reb-last', date: MONTHS[MONTHS.length - 1] } as any;
  const REB_PREV = { ...REBANDED, id: 'reb-prev', date: MONTHS[MONTHS.length - 2] } as any;
  const rbLastLeaf = await readAt(keyA, [REB_LAST], undefined);
  const rbLastAll  = await readAt(KEY_ALL, [REB_LAST], undefined);
  const rbPrevLeaf = await readAt(keyA, [REB_PREV], undefined);

  // ── THE ARITHMETIC THE FEED CARRIES — a PERCENTAGE event ────────────────
  //
  // Measured before the change: the retired construction sized a pool from
  // `subscriberVolume`, which for a percentage event HOLDS THE PERCENT. A +10%
  // event became a pool of 10 subscribers at 35 instead of the resolved 20.
  //
  // At the leaf that is the difference between an Inflow ARPU delta of 1.18
  // and 0.59, both computed by hand here so a regression cannot hide behind a
  // number that merely looks plausible:
  //   correct   pool 20 @35, natural 200 -> (200x22 + 20x35)/220 - 22 = 1.18
  //   retired   pool 10 @35, natural 210 -> (210x22 + 10x35)/220 - 22 = 0.59
  const PCT_LAST = { ...EVENT_ABS, id: 'evt-pct-last', amountType: 'percentage',
                     subscriberVolume: 10, arpu: 35, date: MONTHS[MONTHS.length - 1] } as any;
  const pctLast = await readAt(keyA, [PCT_LAST], undefined);
  console.log('  PCT last-month at leaf  inflow ' + pctLast.arpuInflow);
  check('feed: a PERCENTAGE event sizes its pool from the RESOLVED delta',
    pctLast.arpuInflow !== null && Math.abs((pctLast.arpuInflow as number) - 1.18) < 0.02,
    'inflow ' + pctLast.arpuInflow + ' — 0.59 means the percent was read as a subscriber count');

  console.log('  LAG promo in LAST month  leaf retention ' + rbLastLeaf.arpuRetention
    + '  base ' + rbLastLeaf.arpuBase + '   |  All retention ' + rbLastAll.arpuRetention
    + '  base ' + rbLastAll.arpuBase);
  console.log('  LAG promo one month EARLIER  leaf base ' + rbPrevLeaf.arpuBase);

  check('lag: a promo in the LAST month moves RETENTION ARPU at the leaf',
    rbLastLeaf.arpuRetention !== null && Math.abs(rbLastLeaf.arpuRetention as number) > 0.005,
    'retention ' + rbLastLeaf.arpuRetention);
  check('lag: and at All',
    rbLastAll.arpuRetention !== null && Math.abs(rbLastAll.arpuRetention as number) > 0.005,
    'retention ' + rbLastAll.arpuRetention);
  check('lag: BASE is untouched at T — the lag has not delivered it',
    rbLastLeaf.arpuBase === null || Math.abs(rbLastLeaf.arpuBase as number) < 0.005,
    'base ' + rbLastLeaf.arpuBase + ' — base must not see a pool in its own month');
  check('lag: BASE carries it at T+1',
    rbPrevLeaf.arpuBase !== null && Math.abs(rbPrevLeaf.arpuBase as number) > 0.005,
    'base ' + rbPrevLeaf.arpuBase);

  // The pool carries arpu 40 against a baseline of 20, so a carved pool MUST
  // move the blended ARPU. A zero here means no pool was built.
  // RE-POINTED at Base ARPU (Jon, 2026-09-03). Q4 retired the blended figure
  // from the card, and the blend was where this used to be read. The pool's
  // real observable is BASE: p_eventPools feeds m.scenarioArpu.base directly
  // (WhatIfTab:1570-1575), which is the column the chart grid draws.
  //
  // NOT Retention, though the promotion is a Retention event. The per-scenario
  // Retention ARPU is built from poolsFor('Retention') — a SEPARATE pool
  // construction that reads marketEvents through the shared predicate and never
  // consults p_eventPools — so it moves whether or not the re-banded pool was
  // carved. Asserting there would pass for a different reason than the defect.
  check('rebanded: the pool moves BASE ARPU at the LEAF',
    rbLeaf.arpuBase !== null && Math.abs(rbLeaf.arpuBase as number) > 0.005,
    'base ' + rbLeaf.arpuBase + ' — no pool carved even at the leaf');
  check('rebanded: the pool is carved at ALL too',
    rbAll.arpuBase !== null && Math.abs(rbAll.arpuBase as number) > 0.005,
    'base ' + rbAll.arpuBase);
  check('rebanded: and at the intermediate Corporate/All view',
    rbCorp.arpuBase !== null && Math.abs(rbCorp.arpuBase as number) > 0.005,
    'base ' + rbCorp.arpuBase);

  console.log('  REBANDED per-scenario at All  inflow ' + rbAll.arpuInflow
    + '  outflow ' + rbAll.arpuOutflow + '  retention ' + rbAll.arpuRetention
    + '  base ' + rbAll.arpuBase);
  console.log('  REBANDED per-scenario at leaf inflow ' + rbLeaf.arpuInflow
    + '  outflow ' + rbLeaf.arpuOutflow + '  retention ' + rbLeaf.arpuRetention
    + '  base ' + rbLeaf.arpuBase);
  console.log('  REBANDED arpuDelta  leaf ' + rbLeaf.arpuDelta
    + '   All ' + rbAll.arpuDelta + '   Corp/All ' + rbCorp.arpuDelta);

  // ── ITEM 0 (Q3/Q4 session): the blended consumers, MEASURED BEFORE ──────
  const ARPU_EVENT = { ...EVENT_ABS, id: 'evt-arpu', arpu: 35 } as any;
  const m0Leaf = await readAt(keyA, [ARPU_EVENT], undefined);
  const m0All  = await readAt(KEY_ALL, [ARPU_EVENT], undefined);
  console.log('  ITEM0/4 per-scenario at leaf  inflow ' + m0Leaf.arpuInflow
    + '  outflow ' + m0Leaf.arpuOutflow + '  retention ' + m0Leaf.arpuRetention
    + '  base ' + m0Leaf.arpuBase);
  console.log('  ITEM0/4 per-scenario at All   inflow ' + m0All.arpuInflow
    + '  outflow ' + m0All.arpuOutflow + '  retention ' + m0All.arpuRetention
    + '  base ' + m0All.arpuBase);
  // Q4: the card shows FOUR, and the blended figure is gone from it.
  check('Q4: the blended ARPU figure is NO LONGER on the card',
    Number.isNaN(m0Leaf.arpuDelta), 'still rendered: ' + m0Leaf.arpuDelta);
  check('Q4: the four per-scenario deltas are rendered at the leaf',
    [m0Leaf.arpuInflow, m0Leaf.arpuOutflow, m0Leaf.arpuRetention, m0Leaf.arpuBase]
      .every(v => v === null || Number.isFinite(v as number)),
    'a NaN means the testid is missing, not that the value is absent');
  // THE CARD IS END-OF-PERIOD, and that is why the Inflow feed needs its own
  // event. An Inflow event in month 0 does not move month 2's INFLOW ARPU —
  // inflow is a flow and its month has passed — while BASE still carries it,
  // because base is a stock. Measured: inflow 0, base 1.29 at the leaf. So the
  // Inflow feed is exercised with an event in the LAST month, where it can show.
  const LAST_MONTH_EVENT = { ...EVENT_ABS, id: 'evt-last', arpu: 35, date: MONTHS[MONTHS.length - 1] } as any;
  const mLast = await readAt(keyA, [LAST_MONTH_EVENT], undefined);
  console.log('  ITEM4 last-month event at leaf  inflow ' + mLast.arpuInflow
    + '  base ' + mLast.arpuBase);
  check('Q4: an Inflow event in the LAST month moves INFLOW ARPU',
    mLast.arpuInflow !== null && Math.abs(mLast.arpuInflow as number) > 0.005,
    'inflow ' + mLast.arpuInflow);
  check('Q4: and an Inflow event in the FIRST month does not, at end of period',
    m0Leaf.arpuInflow === null || Math.abs(m0Leaf.arpuInflow as number) < 0.005,
    'inflow ' + m0Leaf.arpuInflow + ' — the flow month has passed; only base carries it');
  check('Q4: outflow is rate-inert and does not move',
    m0Leaf.arpuOutflow === null || Math.abs(m0Leaf.arpuOutflow as number) < 0.005,
    'outflow ' + m0Leaf.arpuOutflow);

  report();
}

main().catch(e => {
  console.log('view-apply-mounted spec CRASHED — ' + (e?.stack || e));
  process.exit(1);
});
