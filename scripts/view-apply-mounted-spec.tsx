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
  const { buildPromoEvents } = await import('../src/components/WhatIfTab');
  const { dilutionAmountPct } = fc;

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
  const mkLeaf = (product: string, inflow: number, retention = 100) => ({
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
      month, inflow: band(inflow), outflow: band(0), retention: band(retention), arpu: band(20),
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

  /**
   * A SECOND STORE, FOR THE RETENTION PERCENTAGE CASE ONLY.
   *
   * The default fixture seeds retention 100 on every leaf, and that makes a
   * retention percentage NON-DISCRIMINATING: `pct% x 100` is `pct`, so the
   * resolved delta of a +10% promotion is 10 - exactly the number the RETIRED
   * arithmetic produces by reading the stored per cent as a subscriber count.
   * A pool-size assertion on that fixture would pass with or without the
   * defect, which is the vacuous-result trap, and it is why trap (b) planted
   * green in the 1526 session.
   *
   * So the retention case runs on leaves seeded 400 / 100. A +10% promotion on
   * leaf A resolves to 40, and the retired reading gives 10. Both numbers are
   * computed by hand below, so the check discriminates between two KNOWN
   * values rather than between a number and its absence.
   *
   * The DEFAULT store is untouched: the 15.83 / 13.57 retention figures the
   * lag assertions are built on are hand-computed against retention 100.
   */
  const AR = mkLeaf('Mobile Voice', 200, 400);
  const BR = mkLeaf('Broadband', 800, 100);
  const storeR = new Map<string, any>([[keyA, AR], [keyB, BR]]);
  const resolveForecastR = (key: string) => fc.resolveFromStore(storeR, leafMap, key);
  const BUNDLE_R = { store: storeR, resolveForecast: resolveForecastR };

  /**
   * THE YIELD FIXTURE, and why its inflow VARIES month to month.
   *
   * The synthetic yield pool is built from the PREVIOUS month's natural inflow
   * (`p_prevBBaseIn`, `eventMonthIdx = idx - 1`). On a fixture whose inflow is
   * the same every month, "previous month" and "this month" are the same
   * number, so a pool sized from the wrong one is indistinguishable from a
   * pool sized correctly — the vacuous-result trap, in the exact shape that
   * made trap (b) plant green in the 1526 session.
   *
   * So leaf A carries 200 / 300 / 400. A pool sized from the current month
   * differs from one sized from the previous month at every step.
   *
   * TWO HORIZONS, because the card's KPI reads the LAST month only. A
   * two-month store puts T+1 last; a three-month store puts T+2 last. That is
   * what lets both months be read from the same rendered figure rather than
   * from a chart row the KPI does not use.
   */
  const mkYLeaf = (product: string, inflows: number[]) => ({
    cohort: { segment: 'Corporate', product, productL2: 'All', channel: 'All',
              channelL2: 'All', tariffL1: 'All', tariffL2: 'All', scenario: 'Standard Forecast' },
    seedBaseVolume: 10000, seedBaseKnown: true,
    historicalMonths: ['2025-10', '2025-11', '2025-12'],
    lastHistoricalInflow: inflows[0], lastHistoricalOutflow: 0,
    provenance: 'fitted' as const,
    months: inflows.map((inf, i) => ({
      month: MONTHS[i], inflow: band(inf), outflow: band(0), retention: band(100),
      arpu: band(20), inflowArpu: band(22), outflowArpu: band(18),
      retentionArpu: band(21), baseArpu: band(20),
    })),
  });

  const mkYBundle = (n: number) => {
    const ya = mkYLeaf('Mobile Voice', [200, 300, 400].slice(0, n));
    const yb = mkYLeaf('Broadband', [800, 800, 800].slice(0, n));
    const st = new Map<string, any>([[keyA, ya], [keyB, yb]]);
    return { store: st, resolveForecast: (k: string) => fc.resolveFromStore(st, leafMap, k) };
  };
  const BUNDLE_Y2 = mkYBundle(2);   // last month is T+1
  const BUNDLE_Y3 = mkYBundle(3);   // last month is T+2


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

  const propsFor = (marketEvents: any[], dataOverride?: any[], yEvents: any[] = [],
                    onUpdate: (id: string, patch: any) => void = noop) => ({
    data: dataOverride ?? data,
    wiDateCol: C.date, wiSegmentCol: C.seg, wiProductCol: C.prod, wiProductL2Col: C.prodL2,
    wiChannelCol: C.chan, wiChannelL2Col: C.chanL2, wiMetricCol: C.metric,
    wiInflowVal: 'Inflow', wiOutflowVal: 'Outflow', wiRetentionVal: 'Retention',
    wiValueCol: C.val, wiRevenueCol: '', wiArpuCol: '',
    productTree: new Map([['Mobile Voice', ['All']], ['Broadband', ['All']]]),
    channelTree: new Map<string, string[]>(), tariffTree: new Map<string, string[]>(),
    selectedTariffs: [], setSelectedTariffs: noop, cohortAvgArpu: 20,
    marketEvents, setMarketEvents: noop,
    addMarketEvent: noop, removeMarketEvent: noop, updateMarketEvent: onUpdate,
    yieldEvents: yEvents, newYieldEvent: {}, setNewYieldEvent: noop, addYieldEvent: noop,
    removeYieldEvent: noop, clearAllYieldEvents: noop,
    pricingEvents: [], newPricingEvent: {}, setNewPricingEvent: noop, addPricingEvent: noop,
    removePricingEvent: noop, clearAllPricingEvents: noop,
    downloadExcel: noop, formatNumber: (v: any) => Number(v).toFixed(2), setActiveView: noop,
    missingMonths: [],
  } as any);

  /** Mount the card AT A VIEW and read the two KPI testids back. */
  const readAt = async (viewKey: string, marketEvents: any[], expandId?: string,
                        dataOverride?: any[],
                        bundle?: { store: Map<string, any>;
                                   resolveForecast: (k: string) => any },
                        openPromoTab?: boolean,
                        yEvents: any[] = []) => {
    const useStore = bundle ? bundle.store : store;
    const useResolve = bundle ? bundle.resolveForecast : resolveForecast;
    const resolved = useResolve(viewKey);
    const host = document.getElementById('root')!;
    host.replaceChildren();
    const container = document.createElement('div');
    host.appendChild(container);
    const root = createRoot(container);
    const Harness = () => {
      const [newEvent, setNewEvent] = (React as any).useState({});
      return React.createElement(M, { ...propsFor(marketEvents, dataOverride, yEvents), newEvent, setNewEvent });
    };
    await (act as any)(async () => {
      root.render(React.createElement(ForecastProvider as any, {
        baseForecast: resolved.forecast, setBaseForecast: noop,
        adjustedForecast: null, setAdjustedForecast: noop,
        forecastStore: useStore, setForecastStore: noop,
        resolveForecast: useResolve, canResolve: () => true,
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
    /** The SAME cell as rendered - sign and all. `perScen` strips the sign to
     *  make a number, and a check on that number cannot see a lost sign. */
    const perScenText = (k: string) => {
      const el = q('impact-arpu-delta-' + k);
      return el ? String(el.textContent).trim() : null;
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
    // ── D5-01: THE PROMOTIONS TABLE IS ON ANOTHER TAB ─────────────────
    // The card mounts on Volume, so the promotions table is not in the DOM at
    // all until its tab is clicked. MEASURED: the first draft of the D5-01
    // check read an EMPTY node list and reported a failure that said nothing
    // about the cell - an assertion on absent DOM cannot tell a wrong unit
    // from a missing table.
    let promoVolumeCells: string[] = [];
    if (openPromoTab) {
      const tabBtn = q('whatif-tab-promotion');
      if (tabBtn) {
        await (act as any)(async () => { tabBtn.dispatchEvent(
          new dom.window.MouseEvent('click', { bubbles: true })); });
      }
      promoVolumeCells = Array.from(
        container.querySelectorAll('[data-testid^="promo-row-volume-"]'),
      ).map((el: any) => String(el.textContent).trim());
    }
    const out = {
      promoVolumeCells,
      rendered: !!deltaEl,
      delta: deltaEl ? Number(String(deltaEl.textContent).replace(/[+,\s]/g, '')) : NaN,
      count: countEl ? String(countEl.textContent).trim() : null,
      arpuDelta: arpuEl ? Number(String(arpuEl.textContent).replace(/[+,\s]/g, '')) : NaN,
      arpuInflow: perScen('inflow'), arpuOutflow: perScen('outflow'),
      arpuRetention: perScen('retention'), arpuBase: perScen('base'),
      arpuBaseText: perScenText('base'),
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


  // ── 3b. THE PERCENTAGE PROMOTION (decision 6, built 2026-09-04) ───────────
  //
  // The entry that declined this said the blocker was the RESOLUTION MODEL:
  // `buildPromoEvents` baked a concrete volume, ARPU and revenue at creation,
  // and a percentage anchor cannot supply what eager resolution needs. Step 2
  // of its recorded order removed the part that could not survive - the baked
  // REVENUE, now 0 for a percentage exactly as `draftEventRate` already does -
  // and left the part that can: `arpu` is a per-subscriber RATE and is the
  // same number whether the promotion moves 10 subscribers or 10 per cent.
  //
  // Built through the REAL builder, not a hand-shaped row. A hand-built event
  // would assert that this spec can write a percentage promotion, which is not
  // the claim.
  {
    const promoRows = buildPromoEvents({
      target: 'Inflow',
      amountType: 'percentage',
      draft: {
        date: MONTHS[0], segment: EVENT_ABS.segment, product: EVENT_ABS.product,
        productL2: EVENT_ABS.productL2, channel: EVENT_ABS.channel,
        channelL2: EVENT_ABS.channelL2, tariffL1: EVENT_ABS.tariffL1,
        tariffL2: EVENT_ABS.tariffL2,
        subscriberVolume: 10, campaignName: '', comment: '', contractLength: 12,
      } as any,
      mixEnabled: false, mixAxis: 'value', draftMix: {}, mixLocked: [],
      tierData: [], pricingEnabled: false, pricingMode: 'percentage',
      pricingAmount: 0, cohortAvgArpu: 20,
      spreadEnabled: false, spreadMonths: 1, spreadDistType: 'even', customDist: [],
      startSequence: 1,
    } as any);

    check('promo%: the builder produced exactly one row', promoRows.length === 1,
      `${promoRows.length}`);
    const row: any = promoRows[0];

    // THE THREE THINGS STEP 2 CHANGED, asserted on the built row before it is
    // applied anywhere - so a failure here says "the builder", not "the engine".
    check('promo%: the row carries amountType percentage',
      row.amountType === 'percentage', String(row.amountType));
    check('promo%: REVENUE IS ZERO - the bake that could not survive',
      row.revenue === 0,
      `${row.revenue} — per-cent times a rate, which the pool would read as an ARPU`);
    check('promo%: but the ARPU RATE is kept, because it is magnitude-independent',
      row.arpu > 0, `${row.arpu}`);
    check('promo%: and subscriberVolume holds the PER CENT',
      row.subscriberVolume === 10, `${row.subscriberVolume}`);
    check('promo%: it is flagged as a promotion', row.isPromotion === true);

    // MOUNTED, on the discriminating fixture: the same claims the plain
    // percentage event makes, now for a promotion.
    const pLeaf = await readAt(keyA, [row]);
    const pAll  = await readAt(KEY_ALL, [row]);
    const pDisj = await readAt(keyB, [row]);

    check('promo%: the LEAF view moves', pLeaf.delta > 0, `delta ${pLeaf.delta}`);
    check('promo%: ALL === leaf TO THE PENNY where the mixes differ',
      Math.abs(pAll.delta - pLeaf.delta) < 0.005,
      `All ${pAll.delta} vs leaf ${pLeaf.delta}`);
    check('promo%: a DISJOINT leaf does not move',
      Math.abs(pDisj.delta) < 0.005, `delta ${pDisj.delta}`);

    // THE SAME NUMBER AS THE PLAIN PERCENTAGE EVENT. A +10% Inflow promotion
    // and a +10% Inflow event move the view by the same amount - the promotion
    // resolves through the SAME market-event path, which is what step 2 was
    // for. If these ever differ, a second resolution model has appeared.
    check('promo%: a +10% PROMOTION moves the leaf exactly as a +10% EVENT does',
      Math.abs(pLeaf.delta - leafPct.delta) < 0.005,
      `promo ${pLeaf.delta} vs plain ${leafPct.delta}`);
    check('promo%: and the same at ALL',
      Math.abs(pAll.delta - allPct.delta) < 0.005,
      `promo ${pAll.delta} vs plain ${allPct.delta}`);

    // ── D5-01: THE UNIT IN THE PROMOTIONS TABLE ────────────────────
    // `subscriberVolume` holds a PERCENT here, so the bare "+10" this cell
    // used to render read as ten subscribers - beside an ARPU column, on a
    // row whose whole point is that it is not a quantity.
    const pctTableRead = await readAt(keyA, [row], undefined, undefined, undefined, true);
    check('D5-01: the table renders the promotion row at all',
      pctTableRead.promoVolumeCells.length === 1,
      JSON.stringify(pctTableRead.promoVolumeCells)
      + ' - an empty list means the tab never opened, not that the unit is right');
    check('D5-01: the promo table Volume cell carries the unit',
      pctTableRead.promoVolumeCells.includes('+10%'),
      JSON.stringify(pctTableRead.promoVolumeCells) + ' - "+10" reads as ten subscribers');
    const absPromoRow: any = buildPromoEvents({
      target: 'Inflow', amountType: 'absolute',
      draft: {
        date: MONTHS[0], segment: EVENT_ABS.segment, product: EVENT_ABS.product,
        productL2: EVENT_ABS.productL2, channel: EVENT_ABS.channel,
        channelL2: EVENT_ABS.channelL2, tariffL1: EVENT_ABS.tariffL1,
        tariffL2: EVENT_ABS.tariffL2,
        subscriberVolume: 8000, campaignName: '', comment: '', contractLength: 12,
      } as any,
      mixEnabled: false, mixAxis: 'value', draftMix: {}, mixLocked: [],
      tierData: [], pricingEnabled: false, pricingMode: 'percentage',
      pricingAmount: 0, cohortAvgArpu: 20,
      spreadEnabled: false, spreadMonths: 1, spreadDistType: 'even', customDist: [],
      startSequence: 2,
    } as any)[0];
    const absRead = await readAt(keyA, [absPromoRow], undefined, undefined, undefined, true);
    check('D5-01: an ABSOLUTE promotion is UNCHANGED - signed, rounded, no unit',
      absRead.promoVolumeCells.includes('+8,000'),
      JSON.stringify(absRead.promoVolumeCells));

    // THE POOL IS SIZED FROM THE RESOLVED DELTA. If it were sized from the
    // stored scalar the pool would hold TEN SUBSCRIBERS for a ten-per-cent
    // promotion, and the Inflow ARPU delta would be a fraction of its true
    // size. Read from the rendered per-scenario ARPU card.
    console.log(`\n  promo%   leaf ${pLeaf.delta}   All ${pAll.delta}`
      + `   disjoint ${pDisj.delta}   (plain pct leaf ${leafPct.delta})`);
  }

  // ── 3c. THE RETENTION HALF OF STEP 2 ───────────────────────
  //
  // The 1526 session finished step 2 in the source and could not exercise half
  // of it: `promoRebanded` is a RETENTION pool and the Inflow case above never
  // reaches it, so its trap planted GREEN and was not registered. This is that
  // half.
  //
  // Runs on BUNDLE_R, whose leaf retention is 400 rather than 100 - see the
  // store's own comment for why the default fixture cannot tell the two
  // arithmetics apart here.
  {
    const TIERS = [{ tier: 'High', baseArpu: 30 }, { tier: 'Low', baseArpu: 15 }];
    const mkRetPromo = (date: string) => buildPromoEvents({
      target: 'Retention',
      amountType: 'percentage',
      bandArpuOverride: { High: 50 },       // THE STATED RE-BANDED RATE
      draft: {
        date, segment: EVENT_ABS.segment, product: EVENT_ABS.product,
        productL2: EVENT_ABS.productL2, channel: EVENT_ABS.channel,
        channelL2: EVENT_ABS.channelL2, tariffL1: EVENT_ABS.tariffL1,
        tariffL2: EVENT_ABS.tariffL2,
        subscriberVolume: 10, campaignName: '', comment: '', contractLength: 12,
      } as any,
      mixEnabled: true, mixAxis: 'value',
      draftMix: { High: 60, Low: 40 }, mixLocked: [],
      tierData: TIERS,
      pricingEnabled: false, pricingMode: 'percentage', pricingAmount: 0,
      cohortAvgArpu: 20,
      spreadEnabled: false, spreadMonths: 1, spreadDistType: 'even', customDist: [],
      startSequence: 1,
    } as any)[0] as any;

    const rp = mkRetPromo(MONTHS[MONTHS.length - 1]);

    // THE BUILT ROW. The blend is hand-computed: the stated rate outranks the
    // band's own ARPU for High, so tierArpu is { High: 50, Low: 15 } and the
    // blend is 0.60x50 + 0.40x15 = 36. A percentage promotion keeps that RATE
    // and drops the REVENUE.
    check('ret%: amountType percentage', rp.amountType === 'percentage', String(rp.amountType));
    check('ret%: REVENUE IS ZERO', rp.revenue === 0, String(rp.revenue));
    check('ret%: the ARPU RATE survives, at the hand-computed mix blend 36',
      Math.abs(rp.arpu - 36) < 1e-9, String(rp.arpu) + ' — 0.6x50 + 0.4x15');
    check('ret%: it is a RE-BANDED promotion, so it gets its own pool',
      rp.promoRebanded === true && rp.isPromotion === true);
    check('ret%: subscriberVolume holds the PER CENT', rp.subscriberVolume === 10);
    check('ret%: the stated rate is carried, filtered to the members',
      rp.promoBandArpuOverride && rp.promoBandArpuOverride.High === 50,
      JSON.stringify(rp.promoBandArpuOverride));

    // THE FIXTURE DISCRIMINATES, asserted before anything is read from it.
    const fitted = 400;                       // leaf A's fitted retention, BUNDLE_R
    const resolved = 0.10 * fitted;           // 40 - the resolved delta
    const retired = 10;                       // the stored per cent, read as subscribers
    check('ret% fixture: the resolved delta and the stored scalar DIFFER',
      Math.abs(resolved - retired) > 1, resolved + ' vs ' + retired
      + ' — on retention 100 these are equal and every check below is vacuous');

    const rLeaf = await readAt(keyA, [rp], undefined, undefined, BUNDLE_R);
    const rAll  = await readAt(KEY_ALL, [rp], undefined, undefined, BUNDLE_R);
    const rDisj = await readAt(keyB, [rp], undefined, undefined, BUNDLE_R);
    console.log('');
    console.log('  ret%  leaf retention ' + rLeaf.arpuRetention + '  base ' + rLeaf.arpuBase
      + '  |  All retention ' + rAll.arpuRetention + '  base ' + rAll.arpuBase
      + '  |  disjoint retention ' + rDisj.arpuRetention);

    // RETENTION ARPU AT T, BY HAND. scenarioPools sizes the retention pool from
    // the resolved delta; the adjusted retention volume is 400 + 40 = 440, of
    // which 40 sits in the pool at 36 and the remaining 400 at the fitted 21:
    //   (400x21 + 40x36) / 440 - 21 = (8400 + 1440)/440 - 21 = 1.3636
    // The retired reading gives a pool of 10 at 36 against a natural 430:
    //   (430x21 + 10x36) / 440 - 21 = (9030 + 360)/440 - 21 = 0.3409
    const RET_T = (400 * 21 + 40 * 36) / 440 - 21;
    check('ret%: RETENTION ARPU at the leaf is the resolved-delta blend',
      rLeaf.arpuRetention !== null
        && Math.abs((rLeaf.arpuRetention as number) - RET_T) < 0.02,
      'retention ' + rLeaf.arpuRetention + ' vs hand ' + RET_T.toFixed(4)
      + ' — 0.34 means the per cent was read as a subscriber count');

    // AT ALL. Total fitted retention is 500 and the promotion covers 400 of it,
    // so coverage is 0.8 and the delta is 0.10 x 500 x 0.8 = 40 - the SAME 40,
    // which is the sum over the leaves it lands on (only leaf A moves).
    // AT ALL, BY HAND. The same resolved 40 against a wider denominator:
    //   (500x21 + 40x36) / 540 - 21 = 11940/540 - 21 = 1.1111
    // The DELTA is the sum over the leaves the promotion covers - only leaf A -
    // and it is the ARPU blend, not the delta, that differs between the views.
    const RET_ALL = (500 * 21 + 40 * 36) / 540 - 21;
    check('ret%: ALL carries the SAME resolved 40, blended over the wider base',
      rAll.arpuRetention !== null
        && Math.abs((rAll.arpuRetention as number) - RET_ALL) < 0.02,
      'retention ' + rAll.arpuRetention + ' vs hand ' + RET_ALL.toFixed(4));
    check('ret%: a DISJOINT leaf does not move',
      rDisj.arpuRetention === null || Math.abs(rDisj.arpuRetention as number) < 0.005,
      'retention ' + rDisj.arpuRetention);

    // THE LAG. A retention promotion in the LAST month has not reached Base.
    const rPrev = await readAt(keyA, [mkRetPromo(MONTHS[MONTHS.length - 2])],
                               undefined, undefined, BUNDLE_R);
    console.log('  ret% one month EARLIER  leaf base ' + rPrev.arpuBase);
    check('ret%: BASE is 0 at T — the lag has not delivered it',
      rLeaf.arpuBase === null || Math.abs(rLeaf.arpuBase as number) < 0.005,
      'base ' + rLeaf.arpuBase);
    check('ret%: BASE carries it at T+1',
      rPrev.arpuBase !== null && Math.abs(rPrev.arpuBase as number) > 0.005,
      'base ' + rPrev.arpuBase);

    // ── WHERE promoRebanded IS ACTUALLY OBSERVABLE ─────────────────
    //
    // MEASURED, not assumed. `p_eventPools`' re-banded push feeds BASE ONLY,
    // through the T+1 lag - the per-scenario Retention ARPU is built by
    // `scenarioPools`, a separate construction that never consults it. That is
    // the same finding 1409 recorded when it declined to re-point the D3-02
    // assertions, and it is why the Retention check above cannot catch a defect
    // in the re-banded pool's SIZE.
    //
    // So the size assertion lives HERE, at T+1, where the pool reaches Base.
    // The pool holds 40 at the blended 36 against a base stock whose ARPU is
    // 20, so the whole of its effect on Base is  40 x (36 - 20) / stock. The
    // retired reading holds TEN at the same rate, and the total adjusted stock
    // is identical either way (D enforces p_basePool = newBAdj - eventTotal),
    // so the two deltas stand in the pool-size ratio 40:10 exactly:
    //     resolved   40 x 16 / 10240 = 0.0625  -> 0.06
    //     retired    10 x 16 / 10240 = 0.0156  -> 0.02
    // Both are known numbers, so this discriminates between two arithmetics
    // rather than between a number and its absence.
    check('ret%: the RE-BANDED POOL is sized from the RESOLVED delta',
      rPrev.arpuBase !== null && Math.abs((rPrev.arpuBase as number) - 0.06) < 0.005,
      'base ' + rPrev.arpuBase
      + ' — 0.02 is a pool of TEN: the per cent read as a subscriber count');
  }

  // ── 3d. THE MIX ARM UNDER A PERCENTAGE ─────────────────────────
  //
  // WHAT THE MIX IS, MEASURED. It carries NO per-tier volumes - there is no
  // site in src/ that splits a promotion's volume across its bands. The mix is
  // a PRICING device: it produces one blended rate, which the event carries as
  // `arpu` and the pool prices its whole size at. So the claim available here
  // is not "the tiers get the resolved delta rather than the percent" but the
  // stronger pair the pool actually makes: SIZE from the resolved delta, PRICE
  // at the mix blend.
  //
  // Both are pinned by one number, which is what makes it discriminating:
  //   correct        pool 20 @31 -> (200x22 + 20x31)/220 - 22 = 0.8182
  //   percent-sized  pool 10 @31 -> (210x22 + 10x31)/220 - 22 = 0.4091
  //   mean-priced    pool 20 @26.67 (a MEAN of the three ARPUs, not a blend)
  //                              -> (200x22 + 20x26.67)/220 - 22 = 0.4242
  // Three known values; the check separates the right one from two plausible
  // wrong ones rather than from zero.
  {
    const TIERS3 = [{ tier: 'Premium', baseArpu: 40 }, { tier: 'Core', baseArpu: 30 },
                    { tier: 'Entry', baseArpu: 10 }];
    const MIX3 = { Premium: 50, Core: 30, Entry: 20 };   // uneven, sums to 100
    const mixPromo = buildPromoEvents({
      target: 'Inflow',
      amountType: 'percentage',
      draft: {
        date: MONTHS[MONTHS.length - 1],
        segment: EVENT_ABS.segment, product: EVENT_ABS.product,
        productL2: EVENT_ABS.productL2, channel: EVENT_ABS.channel,
        channelL2: EVENT_ABS.channelL2, tariffL1: EVENT_ABS.tariffL1,
        tariffL2: EVENT_ABS.tariffL2,
        subscriberVolume: 10, campaignName: '', comment: '', contractLength: 12,
      } as any,
      mixEnabled: true, mixAxis: 'value', draftMix: MIX3, mixLocked: [],
      tierData: TIERS3,
      pricingEnabled: false, pricingMode: 'percentage', pricingAmount: 0,
      cohortAvgArpu: 20,
      spreadEnabled: false, spreadMonths: 1, spreadDistType: 'even', customDist: [],
      startSequence: 1,
    } as any)[0] as any;

    // 0.50x40 + 0.30x30 + 0.20x10 = 20 + 9 + 2 = 31. A MEAN would be 26.67.
    check('mix%: the row carries the share-weighted blend, not a mean',
      Math.abs(mixPromo.arpu - 31) < 1e-9,
      String(mixPromo.arpu) + ' — a mean of the three would be 26.67');
    check('mix%: revenue is still zero under a mix', mixPromo.revenue === 0,
      String(mixPromo.revenue));
    check('mix%: an INFLOW promo with a mix is NOT re-banded — that is Retention only',
      mixPromo.promoRebanded === false, String(mixPromo.promoRebanded));

    const mLeaf = await readAt(keyA, [mixPromo]);
    console.log('  mix%  leaf inflow ' + mLeaf.arpuInflow);
    const MIX_T = (200 * 22 + 20 * 31) / 220 - 22;
    check('mix%: the INFLOW pool is sized from the resolved delta AND priced at the blend',
      mLeaf.arpuInflow !== null && Math.abs((mLeaf.arpuInflow as number) - MIX_T) < 0.02,
      'inflow ' + mLeaf.arpuInflow + ' vs hand ' + MIX_T.toFixed(4)
      + ' — 0.41 is a pool of ten, 0.42 is a mean-priced pool of twenty');
  }

  // ── 3e. THE PROMOTION'S DILUTION PRICING ARM (decision 3) ────────
  //
  // Dilution is not a third arm of the promotion's pricing control. It is a
  // third way of SAYING the same thing: the user states current and target
  // dilution, `dilutionAmountPct` converts the pair, and the existing
  // percentage arm applies it - exactly the doctrine the Pricing card records
  // for its own dilution events ("it rides the existing mechanism entirely").
  //
  // THE EQUALITY IS BY CONSTRUCTION, AND IS PINNED ANYWAY. Both cards call one
  // exported function, so they cannot compute different numbers from the same
  // figures; the check exists so that an inline re-implementation on either
  // side is caught the moment it appears rather than when the two drift.
  {
    const promoDraft = {
      date: MONTHS[MONTHS.length - 1],
      segment: EVENT_ABS.segment, product: EVENT_ABS.product,
      productL2: EVENT_ABS.productL2, channel: EVENT_ABS.channel,
      channelL2: EVENT_ABS.channelL2, tariffL1: EVENT_ABS.tariffL1,
      tariffL2: EVENT_ABS.tariffL2,
      subscriberVolume: 1000, campaignName: '', comment: '', contractLength: 12,
    } as any;
    const common = {
      target: 'Inflow', amountType: 'absolute', draft: promoDraft,
      mixEnabled: false, mixAxis: 'value', draftMix: {}, mixLocked: [],
      tierData: [], cohortAvgArpu: 20,
      spreadEnabled: false, spreadMonths: 1, spreadDistType: 'even', customDist: [],
      startSequence: 1,
    };

    const dil: any = buildPromoEvents({
      ...common, pricingEnabled: true, pricingMode: 'dilution', pricingAmount: 0,
      pricingDilutionCurrentPct: 25, pricingDilutionTargetPct: 20,
    } as any)[0];

    // THE PRICING CARD'S OWN FIGURE for the same inputs, from the same
    // function the Pricing card calls at handleAddPricingEvent.
    const cardPct = dilutionAmountPct(25, 20) as number;

    // BY HAND: ratio = (1 - 20/100) / (1 - 25/100) = 0.80 / 0.75 = 1.0666...
    // so the amount is +6.6667%, NOT the +5 a subtraction would give. That
    // gap is the error this mode exists to remove, and it is asserted here as
    // a distance rather than trusted.
    check('promo dilution: the card figure is the RATIO, not the difference',
      Math.abs(cardPct - 6.666666666666671) < 1e-9 && Math.abs(cardPct - 5) > 1,
      String(cardPct) + ' - 5 would mean a subtraction had been written');
    check('promo dilution: the promotion carries the SAME figure, to 1e-9',
      Math.abs(dil.promoPricingAmount - cardPct) < 1e-9,
      dil.promoPricingAmount + ' vs the Pricing card ' + cardPct);
    check('promo dilution: the mode is persisted',
      dil.promoPricingMode === 'dilution', String(dil.promoPricingMode));
    check('promo dilution: AND both stated figures - R5 decision 3',
      dil.promoDilutionCurrentPct === 25 && dil.promoDilutionTargetPct === 20,
      JSON.stringify([dil.promoDilutionCurrentPct, dil.promoDilutionTargetPct]));

    // THE RATE THE ARM APPLIED. Base 20 (the cohort average, no mix), so
    // 20 x 0.80/0.75 = 21.3333. A subtraction-based conversion would give 21.
    check('promo dilution: the applied ARPU is base x the retained-revenue ratio',
      Math.abs(dil.arpu - 20 * (0.80 / 0.75)) < 1e-9,
      String(dil.arpu) + ' - 21 would be the +5% a hand subtraction gives');

    // AND THE STRONGEST FORM: a promotion priced in PER CENT at the converted
    // figure is the same event. If these ever differ, the dilution arm has
    // stopped riding the percentage arm and become a second implementation.
    const asPct: any = buildPromoEvents({
      ...common, pricingEnabled: true, pricingMode: 'percentage',
      pricingAmount: cardPct,
    } as any)[0];
    check('promo dilution: identical to a hand-converted PERCENTAGE arm, to 1e-9',
      Math.abs(dil.arpu - asPct.arpu) < 1e-9 && Math.abs(dil.revenue - asPct.revenue) < 1e-9,
      dil.arpu + ' vs ' + asPct.arpu);

    // INCOMPLETE OR OUT-OF-RANGE FIGURES BUILD NOTHING. Null is not zero: a
    // promotion whose price arm cannot be resolved has no honest rate, and
    // emitting one priced at +0% would state a change the user never made.
    check('promo dilution: an INCOMPLETE pair builds no event',
      buildPromoEvents({ ...common, pricingEnabled: true, pricingMode: 'dilution',
        pricingAmount: 0, pricingDilutionCurrentPct: 25 } as any).length === 0);
    check('promo dilution: an OUT-OF-RANGE pair builds no event',
      buildPromoEvents({ ...common, pricingEnabled: true, pricingMode: 'dilution',
        pricingAmount: 0, pricingDilutionCurrentPct: 100,
        pricingDilutionTargetPct: 20 } as any).length === 0);

    // MOUNTED, on the discriminating fixture. The pool holds 1000 at 21.3333
    // against a natural inflow of 200 at the fitted 22:
    //   (200x22 + 1000x21.33333)/1200 - 22 = 25733.33/1200 - 22 = -0.5556
    // A promotion priced by subtraction (1000 @21) gives
    //   (200x22 + 1000x21)/1200 - 22 = 25400/1200 - 22 = -0.8333
    // MEASURED by planting exactly that, not predicted: the first draft of this
    // comment said -0.67 and was wrong. The rendered figure therefore separates
    // the two conversions, not merely zero from non-zero.
    const dLeaf = await readAt(keyA, [dil]);
    console.log('  promo dilution  leaf inflow ' + dLeaf.arpuInflow);
    const DIL_T = (200 * 22 + 1000 * (20 * 0.80 / 0.75)) / 1200 - 22;
    check('promo dilution: the MOUNTED inflow ARPU is the ratio-priced pool',
      dLeaf.arpuInflow !== null && Math.abs((dLeaf.arpuInflow as number) - DIL_T) < 0.02,
      'inflow ' + dLeaf.arpuInflow + ' vs hand ' + DIL_T.toFixed(4)
      + ' - -0.83 is a pool priced at 21, the subtraction');

    // THE EXISTING ARMS ARE UNCHANGED TO THE PENNY. Measured, not assumed:
    // applyPricing was rewritten to route dilution through the percentage
    // branch, so the other two are exactly what that rewrite could break.
    const pctArm: any = buildPromoEvents({
      ...common, pricingEnabled: true, pricingMode: 'percentage', pricingAmount: 10,
    } as any)[0];
    const absArm: any = buildPromoEvents({
      ...common, pricingEnabled: true, pricingMode: 'absolute', pricingAmount: 2.5,
    } as any)[0];
    const offArm: any = buildPromoEvents({
      ...common, pricingEnabled: false, pricingMode: 'percentage', pricingAmount: 10,
    } as any)[0];
    check('promo dilution: the PERCENTAGE arm still gives 20 x 1.10 = 22',
      Math.abs(pctArm.arpu - 22) < 1e-9, String(pctArm.arpu));
    check('promo dilution: the ABSOLUTE arm still gives 20 + 2.50 = 22.50',
      Math.abs(absArm.arpu - 22.5) < 1e-9, String(absArm.arpu));
    check('promo dilution: an arm turned OFF still applies nothing',
      Math.abs(offArm.arpu - 20) < 1e-9 && offArm.promoPricingMode === undefined
        && offArm.promoPricingAmount === undefined,
      String(offArm.arpu));
    check('promo dilution: a non-dilution arm carries NO stated figures',
      pctArm.promoDilutionCurrentPct === undefined
        && pctArm.promoDilutionTargetPct === undefined,
      'absence is the carrier, and nothing pre-decision-3 migrates');
  }

  // ── 3f. THE SYNTHETIC YIELD POOL, VERIFIED BY HAND ──────────────
  //
  // The 0747 session found that a yield event, not a promotion, moved Base
  // ARPU on Jon's save (−0.27 on its own). It did not verify that −0.27 was
  // RIGHT. This does, on a fixture whose every quantity is known.
  //
  // THE ARITHMETIC, from the source rather than assumed. The base term takes
  // the pools the lag has DELIVERED (`eventMonthIdx < idx`), sets
  // `naturalVolume = newBAdj − Σ size`, and `scenarioAdjustedArpu` returns
  // `(baseArpu × natural + Σ size×rate) / newBAdj`. Subtracting the baseline
  // `baseArpu` collapses that to
  //
  //     Base ARPU delta = Σ delivered size × (rate − baseArpu) / stock
  //
  // which is the formula every figure below is computed from.
  {
    // THE YIELD EVENT. Mix 25/75 over bands at 40 and 10:
    //   raw blend        0.25x40 + 0.75x10 = 17.50
    //   equal weight     (40 + 10) / 2     = 25.00
    //   ratio            17.50 / 25.00     = 0.70
    //   pool rate        fitted inflow ARPU 22 x 0.70 = 15.40
    // Well below the fitted 22, and below the fitted BASE blend of 20 - which
    // is what makes the contribution negative and the sign meaningful.
    const YIELD_EV = {
      id: 'y1', name: 'yield mix', ibro: 'Inflow',
      segment: 'All', product: 'All', channelL1: 'All', channelL2: 'All',
      month: MONTHS[0], rollForward: true, mixAxis: 'value',
      tariffMix: { High: 25, Low: 75 },
      tariffBaseArpu: { High: 40, Low: 10 },
    } as any;

    const RATE = 22 * ((0.25 * 40 + 0.75 * 10) / ((40 + 10) / 2));
    check('yield: the pool rate is the mix blend scaled onto the fitted inflow ARPU',
      Math.abs(RATE - 15.4) < 1e-9, String(RATE));

    // THE FIXTURE DISCRIMINATES, asserted before anything is read from it.
    const yInflows = BUNDLE_Y3.resolveForecast(keyA).forecast.months
      .map((m: any) => m.inflow.mean);
    check('yield fixture: the inflow VARIES month to month',
      new Set(yInflows).size === yInflows.length,
      yInflows.join('/') + ' — equal inflows make a pool sized from the wrong'
      + ' month unobservable, which is the vacuous-result trap');

    /** Base ARPU delta, by hand, from the formula above. */
    const handDelta = (sizes: number[], stock: number) =>
      sizes.reduce((t, sz) => t + sz * (RATE - 20), 0) / stock;

    // ── T+1: the two-month store, so the LAST month is idx 1 ────────
    //
    // Stock, by hand from the engine's own recursion
    // (newBAdj = prev stock + prev adjusted inflow − prev adjusted outflow,
    //  seeded at seedBaseVolume with lastHistoricalInflow as the first inflow):
    //   idx 0   10000 + 200 = 10200
    //   idx 1   10200 + 200 = 10400
    // Pool at idx 1: sized from the PREVIOUS month's natural inflow, 200, and
    // its eventMonthIdx is 0, so the lag has delivered it in this same month.
    const T1_HAND = handDelta([200], 10400);
    const yT1 = await readAt(keyA, [], undefined, undefined, BUNDLE_Y2, false, [YIELD_EV]);
    console.log('');
    console.log('  yield T+1 leaf  base ' + yT1.arpuBase
      + '   hand ' + T1_HAND.toFixed(6));
    check('yield: BASE ARPU at T+1 equals the hand figure',
      yT1.arpuBase !== null && Math.abs((yT1.arpuBase as number) - T1_HAND) < 0.005,
      'rendered ' + yT1.arpuBase + ' vs hand ' + T1_HAND.toFixed(6)
      + ' — 200 x (15.40 − 20) / 10400');

    // ── T+2: the three-month store, so the LAST month is idx 2 ──────
    //
    //   idx 0   10000 + 200 = 10200
    //   idx 1   10200 + 200 = 10400
    //   idx 2   10400 + 300 = 10700
    // TWO pools are delivered by now - the yield event rolls forward, so one
    // was pushed at idx 1 (sized 200, the inflow of idx 0) and another at
    // idx 2 (sized 300, the inflow of idx 1). Both have eventMonthIdx < 2.
    const T2_HAND = handDelta([200, 300], 10700);
    const yT2 = await readAt(keyA, [], undefined, undefined, BUNDLE_Y3, false, [YIELD_EV]);
    console.log('  yield T+2 leaf  base ' + yT2.arpuBase
      + '   hand ' + T2_HAND.toFixed(6));
    check('yield: BASE ARPU at T+2 equals the hand figure',
      yT2.arpuBase !== null && Math.abs((yT2.arpuBase as number) - T2_HAND) < 0.005,
      'rendered ' + yT2.arpuBase + ' vs hand ' + T2_HAND.toFixed(6)
      + ' — (200 + 300) x (15.40 − 20) / 10700');

    // THE TWO MONTHS MUST DIFFER, or one figure is doing both jobs and a
    // constant-in-time defect would satisfy both checks.
    check('yield: T+1 and T+2 are different figures',
      Math.abs(T1_HAND - T2_HAND) > 0.05,
      T1_HAND.toFixed(4) + ' vs ' + T2_HAND.toFixed(4));

    // WHAT A CURRENT-MONTH POOL WOULD READ, computed here so the trap's
    // failure line separates two KNOWN numbers rather than a number and zero:
    //   T+1  300 x (15.40 − 20) / 10400 = -0.1327
    //   T+2  (300 + 400) x (15.40 − 20) / 10700 = -0.3009
    console.log('  yield defect would read  T+1 '
      + handDelta([300], 10400).toFixed(4)
      + '   T+2 ' + handDelta([300, 400], 10700).toFixed(4));

    // ── AT ALL, the same formula on the aggregate's own quantities ──
    // Not a second hand figure: the fitted inflows and the seed are READ from
    // the resolved aggregate, so this checks the ENGINE's ARPU against an
    // independently computed one rather than against a number typed twice.
    const aggT2 = BUNDLE_Y3.resolveForecast(KEY_ALL).forecast;
    const aggIn = aggT2.months.map((m: any) => m.inflow.mean);
    const aggSeed = aggT2.seedBaseVolume;
    const aggStock = aggSeed + aggIn[0] + aggIn[0] + aggIn[1];   // idx 0,1,2 recursion
    const ALL_HAND = handDelta([aggIn[0], aggIn[1]], aggStock);
    const yAll = await readAt(KEY_ALL, [], undefined, undefined, BUNDLE_Y3, false, [YIELD_EV]);
    console.log('  yield T+2 ALL   base ' + yAll.arpuBase
      + '   hand ' + ALL_HAND.toFixed(6)
      + '   (inflows ' + aggIn.join('/') + ', seed ' + aggSeed + ')');
    check('yield: BASE ARPU at ALL equals the same formula on the aggregate',
      yAll.arpuBase !== null && Math.abs((yAll.arpuBase as number) - ALL_HAND) < 0.005,
      'rendered ' + yAll.arpuBase + ' vs hand ' + ALL_HAND.toFixed(6));
  }

  // ── 3g. THE KPI SUBTRACTS BEFORE IT ROUNDS ──────────────────────
  //
  // `perScenarioColumns` rounds both `<scenario> ARPU (Baseline)` and
  // `(Adjusted)` to two decimals, because those columns are chart and export
  // values. The KPI used to subtract that already-rounded pair, so its delta
  // carried up to a full penny of pure rounding.
  //
  // THE FIXTURE IS BUILT SO THE TWO PATHS DISAGREE. A base ARPU of exactly 20
  // would not show it: 20.000 and 20.006 round to 20.00 and 20.01, and the
  // old subtraction lands on 0.01 by luck. At 19.996 both sides round to
  // 20.00 and the movement disappears entirely - which is the case that
  // separates "rounded once, at the end" from "rounded twice, at the start".
  {
    const BASE_ARPU = 19.996;
    const STOCK = 10400;        // 10000 + 200 + 200, the two-month recursion
    const POOL = 200;           // the previous month's natural inflow

    // The yield ratio with bands {A: a, B: 0} is 2p/100 whatever `a` is -
    // rawBlend = (p/100)a, equalWeight = a/2 - so the mix share alone sets the
    // pool's rate, and the share needed for a chosen delta is solved for here
    // rather than typed as a magic number.
    const shareFor = (targetDelta: number) => {
      const rate = BASE_ARPU + targetDelta * STOCK / POOL;
      return rate * 50 / 22;    // rate = 22 x (2p/100) = 22p/50
    };
    const mkYieldFor = (targetDelta: number) => ({
      id: 'yp', name: 'precision', ibro: 'Inflow',
      segment: 'All', product: 'All', channelL1: 'All', channelL2: 'All',
      month: MONTHS[0], rollForward: true, mixAxis: 'value',
      tariffMix: { A: shareFor(targetDelta), B: 100 - shareFor(targetDelta) },
      tariffBaseArpu: { A: 40, B: 0 },
    } as any);

    const mkPLeaf = (product: string, inflows: number[]) => ({
      cohort: { segment: 'Corporate', product, productL2: 'All', channel: 'All',
                channelL2: 'All', tariffL1: 'All', tariffL2: 'All',
                scenario: 'Standard Forecast' },
      seedBaseVolume: 10000, seedBaseKnown: true,
      historicalMonths: ['2025-10', '2025-11', '2025-12'],
      lastHistoricalInflow: inflows[0], lastHistoricalOutflow: 0,
      provenance: 'fitted' as const,
      months: inflows.map((inf, i) => ({
        month: MONTHS[i], inflow: band(inf), outflow: band(0), retention: band(100),
        arpu: band(20), inflowArpu: band(22), outflowArpu: band(18),
        retentionArpu: band(21), baseArpu: band(BASE_ARPU),
      })),
    });
    const pA = mkPLeaf('Mobile Voice', [200, 200]);
    const pB = mkPLeaf('Broadband', [800, 800]);
    const storeP = new Map<string, any>([[keyA, pA], [keyB, pB]]);
    const BUNDLE_P = { store: storeP,
      resolveForecast: (k: string) => fc.resolveFromStore(storeP, leafMap, k) };

    const readDelta = async (targetDelta: number) => {
      const r = await readAt(keyA, [], undefined, undefined, BUNDLE_P, false,
        [mkYieldFor(targetDelta)]);
      return r.arpuBase;
    };
    /** The rendered TEXT of the same cell, sign included. `readDelta` parses a
     *  number out of it, which cannot tell "+0.01" from "0.01" or from a lost
     *  sign - and the sign is half of what a delta says. */
    const readDeltaText = async (targetDelta: number) => {
      const r = await readAt(keyA, [], undefined, undefined, BUNDLE_P, false,
        [mkYieldFor(targetDelta)]);
      return r.arpuBaseText;
    };

    // 0.004: BELOW what two decimals can express, so both paths read 0.00.
    // The check exists so the new path is not mistaken for "always shows more"
    // - it shows the TRUTH, and the truth here rounds to nothing.
    const d004 = await readDelta(0.004);
    console.log('');
    console.log('  precision  true 0.004 -> rendered ' + d004
      + '   |  true 0.006 -> rendered ' + (await readDelta(0.006)));
    check('precision: a true delta of 0.004 reads 0.00 - it is below the display',
      d004 !== null && Math.abs(d004 as number) < 0.005, String(d004));

    // 0.006: the discriminating case. Subtract-then-round reads 0.01;
    // round-then-subtract reads 0.00, because 19.996 and 20.002 both round to
    // 20.00 and the movement is destroyed before the subtraction happens.
    const d006 = await readDelta(0.006);
    check('precision: a true delta of 0.006 reads 0.01, NOT 0.00',
      d006 !== null && Math.abs((d006 as number) - 0.01) < 1e-9,
      String(d006) + ' — 0.00 means the pair was rounded before it was subtracted');

    // AT THE CARD, AS A USER READS IT. The check above parses a number out of
    // the cell; this one pins the STRING, sign included - "+0.01" is what the
    // KPI shows, and a delta that lost its sign would satisfy the number.
    const t006 = await readDeltaText(0.006);
    console.log('  precision  0.006 renders "' + t006 + '"');
    check('precision: the card RENDERS "+0.01" for a true 0.006',
      t006 === '+0.01', '"' + t006 + '"');
  }

  // ── 3h. D5-03: THE UNIT CONTROL SURVIVES AN EDIT ────────────────
  //
  // Jon's 05 Sep screenshot: reopening a +10% promotion showed the amount
  // control on SUBS. The screenshot is the mild half. `handleSavePromoEdit`
  // passes `promoAmountMode` straight to `buildPromoEvents`, so pressing Save
  // Changes without touching the toggle REWROTE the event as ten subscribers
  // — a silent hundred-fold change of meaning, not a display fault.
  //
  // MEASURED BEFORE THE FIX: `setPromoAmountMode` had exactly ONE writer, the
  // toggle itself. Neither edit path set it and `resetPromoDraft` did not
  // clear it, so the mode was whatever the session last left it at.
  //
  // DRIVEN THROUGH THE CARD, not the builder: the claim is about the restore,
  // and a builder call cannot see a control that was never seeded.
  {
    const mkPromo = (amountType: 'absolute' | 'percentage', vol: number) =>
      buildPromoEvents({
        target: 'Retention', amountType,
        draft: {
          date: MONTHS[0], segment: EVENT_ABS.segment, product: EVENT_ABS.product,
          productL2: EVENT_ABS.productL2, channel: EVENT_ABS.channel,
          channelL2: EVENT_ABS.channelL2, tariffL1: EVENT_ABS.tariffL1,
          tariffL2: EVENT_ABS.tariffL2,
          subscriberVolume: vol, campaignName: '', comment: '', contractLength: 12,
        } as any,
        mixEnabled: false, mixAxis: 'value', draftMix: {}, mixLocked: [],
        tierData: [], pricingEnabled: false, pricingMode: 'percentage',
        pricingAmount: 0, cohortAvgArpu: 20,
        spreadEnabled: false, spreadMonths: 1, spreadDistType: 'even', customDist: [],
        startSequence: 1,
      } as any)[0] as any;

    /** Mount, open the Promotion tab, click the row's pencil, and report what
     *  the unit control shows and what Save Changes writes. */
    const editAndSave = async (row: any) => {
      const written: any[] = [];
      const host = document.getElementById('root')!;
      host.replaceChildren();
      const container = document.createElement('div');
      host.appendChild(container);
      const root = createRoot(container);
      const Harness = () => {
        const [newEvent, setNewEvent] = (React as any).useState({});
        return React.createElement(M, {
          ...propsFor([row], undefined, [], (id: string, patch: any) => written.push({ id, patch })),
          newEvent, setNewEvent,
        });
      };
      await (act as any)(async () => {
        root.render(React.createElement(ForecastProvider as any, {
          baseForecast: resolveForecast(keyA).forecast, setBaseForecast: noop,
          adjustedForecast: null, setAdjustedForecast: noop,
          forecastStore: store, setForecastStore: noop,
          resolveForecast, canResolve: () => true,
          hasLegacyBaseline: true, updatedAt: new Date().toISOString(),
          bulkRuns: [], setBulkRuns: noop,
        }, React.createElement(Harness)));
      });
      const q = (id: string) => container.querySelector('[data-testid="' + id + '"]') as any;
      const click = async (el: any) => { await (act as any)(async () => {
        el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); }); };

      await click(q('whatif-tab-promotion'));
      // BY TESTID. The first draft took "the last button in the row", which
      // clicked DELETE and reported an empty write list that the assertions
      // then read as a failed restore - a wrong control looks exactly like a
      // broken one. The pencil now carries `promo-row-edit-<id>`.
      const pencil = q('promo-row-edit-' + row.id);
      if (pencil) await click(pencil);

      const pressed = (id: string) => {
        const el = q(id);
        return el ? String(el.className).includes('bg-[#e60000]') : null;
      };
      const out = {
        // THE ADD FORM IS ALWAYS MOUNTED, so the presence of the unit control
        // proves nothing. "Did the pencil open an EDIT" is the editing banner
        // / Save Changes button, which exist only while editingPromoId is set.
        opened: !!Array.from(container.querySelectorAll('button'))
          .find((b2: any) => /save changes/i.test(String(b2.textContent))),
        pctPressed: pressed('promo-amount-pct'),
        subsPressed: pressed('promo-amount-subs'),
        volumeShown: q('promo-volume-amount') ? q('promo-volume-amount').value : null,
        written,
      };
      // Save Changes, without touching anything.
      const saveBtn = Array.from(container.querySelectorAll('button'))
        .find((b: any) => /save/i.test(String(b.textContent))) as any;
      if (saveBtn) await click(saveBtn);
      await (act as any)(async () => { root.unmount(); });
      return out;
    };

    const pctRow = mkPromo('percentage', 10);
    const pctEdit = await editAndSave(pctRow);
    console.log('');
    console.log('  D5-03 pct edit   opened ' + pctEdit.opened
      + '  %-pressed ' + pctEdit.pctPressed + '  subs-pressed ' + pctEdit.subsPressed
      + '  volume ' + pctEdit.volumeShown
      + '  written ' + JSON.stringify(pctEdit.written.map((w: any) =>
        [w.patch.amountType, w.patch.subscriberVolume])));

    check('D5-03: the edit form opened at all',
      pctEdit.opened === true,
      'the unit control is not in the DOM — the pencil did not open the form,'
      + ' and every assertion below would be vacuous');
    check('D5-03: the % unit is PRESSED when a percentage promotion is reopened',
      pctEdit.pctPressed === true && pctEdit.subsPressed === false,
      'pct ' + pctEdit.pctPressed + ' subs ' + pctEdit.subsPressed
      + ' — Subs pressed is the screenshot');
    check('D5-03: SAVE re-emits amountType percentage, magnitude unchanged',
      pctEdit.written.length === 1
        && pctEdit.written[0].patch.amountType === 'percentage'
        && pctEdit.written[0].patch.subscriberVolume === 10,
      JSON.stringify(pctEdit.written.map((w: any) =>
        [w.patch.amountType, w.patch.subscriberVolume]))
      + ' — absolute/10 means a ten-per-cent promotion became ten subscribers');

    // THE ABSOLUTE CASE IS UNCHANGED, measured rather than assumed: the fix
    // reads the event, so an absolute row must still open on Subs.
    const absEdit = await editAndSave(mkPromo('absolute', 8000));
    console.log('  D5-03 abs edit   %-pressed ' + absEdit.pctPressed
      + '  subs-pressed ' + absEdit.subsPressed
      + '  written ' + JSON.stringify(absEdit.written.map((w: any) =>
        [w.patch.amountType, w.patch.subscriberVolume])));
    check('D5-03: an ABSOLUTE promotion still opens on Subs',
      absEdit.subsPressed === true && absEdit.pctPressed === false,
      'pct ' + absEdit.pctPressed + ' subs ' + absEdit.subsPressed);
    check('D5-03: and saves back as absolute, magnitude unchanged',
      absEdit.written.length === 1
        && absEdit.written[0].patch.amountType === 'absolute'
        && absEdit.written[0].patch.subscriberVolume === 8000,
      JSON.stringify(absEdit.written.map((w: any) =>
        [w.patch.amountType, w.patch.subscriberVolume])));
  }

  // ── 3i. D5-04: THE VOLUME PENCIL ROUTES A PROMOTION HOME ────────
  //
  // DECIDED (Jon, 2026-09-05), option 1: a promotion is edited from its
  // source. The Volume table still LISTS promotions - a user looking for
  // every market event finds them there - but its pencil opens the PROMOTION
  // card's editor, because the Volume form cannot represent a promotion's
  // arms and a no-change save from it zeroed the baked rate (1903: 36 -> 0).
  //
  // THIS BLOCK REPLACES the "measured, not endorsed" pin. That check asserted
  // "exactly two fields move and one is the baked rate"; it went RED on the
  // first run of this session, which is the signal the decision landed:
  //   FAIL  D5-04: the Volume-form save actually committed
  //         [no commit reached setMarketEvents]
  // - red because the Volume save path is no longer the one a promotion takes.
  {
    const PROMO = buildPromoEvents({
      target: 'Retention', amountType: 'percentage',
      bandArpuOverride: { High: 50 },
      draft: {
        date: MONTHS[0], segment: EVENT_ABS.segment, product: EVENT_ABS.product,
        productL2: EVENT_ABS.productL2, channel: EVENT_ABS.channel,
        channelL2: EVENT_ABS.channelL2, tariffL1: EVENT_ABS.tariffL1,
        tariffL2: EVENT_ABS.tariffL2,
        subscriberVolume: 10, campaignName: '', comment: '', contractLength: 12,
      } as any,
      mixEnabled: true, mixAxis: 'value',
      draftMix: { High: 60, Low: 40 }, mixLocked: ['High'],
      tierData: [{ tier: 'High', baseArpu: 30 }, { tier: 'Low', baseArpu: 15 }],
      pricingEnabled: false, pricingMode: 'percentage', pricingAmount: 0,
      cohortAvgArpu: 20,
      spreadEnabled: false, spreadMonths: 1, spreadDistType: 'even', customDist: [],
      startSequence: 1,
    } as any)[0] as any;

    /** The 23 fields the engine reads off a promotion row. */
    const readSet = (e: any) => ({
      scenario: e.scenario, date: e.date, amountType: e.amountType,
      percentageBasis: e.percentageBasis, subscriberVolume: e.subscriberVolume,
      revenue: e.revenue, arpu: e.arpu, arpuOverride: e.arpuOverride,
      isPromotion: e.isPromotion, promoRebanded: e.promoRebanded,
      promoMixAxis: e.promoMixAxis, promoMix: e.promoMix,
      promoBandArpuOverride: e.promoBandArpuOverride, mixLocked: e.mixLocked,
      promoPricingMode: e.promoPricingMode, promoPricingAmount: e.promoPricingAmount,
      promoDilutionCurrentPct: e.promoDilutionCurrentPct,
      promoDilutionTargetPct: e.promoDilutionTargetPct,
      contractLength: e.contractLength, retentionLinked: e.retentionLinked,
      segment: e.segment, product: e.product, productL2: e.productL2,
    });

    // THE TIER LIST COMES FROM `data`, NOT FROM THE EVENT. `computeTierData`
    // reads the actuals rows for the promotion's scope, metric and month, and
    // the shared fixture carries only INFLOW rows at productL2 'All' - so a
    // Retention promotion found NO tiers, the mix rendered with no members,
    // and Save Changes was correctly DISABLED. Measured, not guessed: the
    // first run of this block reported `via Promotion 0` and a missing mix
    // row, which is the card refusing to save a mix it cannot populate.
    //
    // So this mount gets Retention rows carrying real value tiers.
    // AND AN ARPU COLUMN. `computeTierData` returns [] unless a revenue OR an
    // arpu column is named (its first line), and the shared props pass '' for
    // both - so no fixture mounted through them can produce tiers at all.
    // That is why the first run found none: not the rows, the columns.
    const ARPU_COL = 'Arpu';
    const PROMO_DATA = [
      ...data,
      ...['High', 'Low'].map(tier => ({
        [C.date]: MONTHS[0], [C.seg]: 'Corporate', [C.prod]: 'Mobile Voice',
        [C.prodL2]: tier, [C.chan]: 'All', [C.chanL2]: 'All',
        [C.metric]: 'Retention', [C.val]: tier === 'High' ? 600 : 400,
        [ARPU_COL]: tier === 'High' ? 30 : 15,
      })),
    ];

    // BOTH WRITERS ARE CAPTURED, and that is the discriminator. The Volume
    // form commits through setMarketEvents (via its confirm modal); the
    // Promotion editor commits through updateMarketEvent. Which one fires
    // says which editor took the row, without needing to spy on a handler.
    const viaVolume: any[] = [];
    const viaPromo: any[] = [];
    const host = document.getElementById('root')!;
    host.replaceChildren();
    const container = document.createElement('div');
    host.appendChild(container);
    const root = createRoot(container);
    const Harness = () => {
      const [newEvent, setNewEvent] = (React as any).useState({});
      const props = propsFor([PROMO], PROMO_DATA);
      props.wiArpuCol = ARPU_COL;
      props.setMarketEvents = (next: any) => { viaVolume.push(next); };
      props.updateMarketEvent = (id: string, patch: any) => { viaPromo.push({ id, patch }); };
      return React.createElement(M, { ...props, newEvent, setNewEvent });
    };
    await (act as any)(async () => {
      root.render(React.createElement(ForecastProvider as any, {
        baseForecast: resolveForecast(keyA).forecast, setBaseForecast: noop,
        adjustedForecast: null, setAdjustedForecast: noop,
        forecastStore: store, setForecastStore: noop,
        resolveForecast, canResolve: () => true,
        hasLegacyBaseline: true, updatedAt: new Date().toISOString(),
        bulkRuns: [], setBulkRuns: noop,
      }, React.createElement(Harness)));
    });
    const q = (id: string) => container.querySelector('[data-testid="' + id + '"]') as any;
    const click = async (el: any) => { await (act as any)(async () => {
      el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); }); };
    const tabActive = (tab: string) => {
      const el = q('whatif-tab-' + tab);
      return el ? String(el.className).includes('bg-white') : null;
    };

    // (c) THE ROW SETS STILL OVERLAP - option 1 changes where the pencil goes,
    // not what the table lists. A user must still find the promotion here.
    const volumeRows = container.querySelectorAll('[data-testid="edit-event"]').length;
    await click(q('whatif-tab-promotion'));
    const promoRows = container.querySelectorAll('[data-testid^="promo-row-edit-"]').length;
    await click(q('whatif-tab-volume'));
    console.log('');
    console.log('  D5-04 row sets   Volume table ' + volumeRows
      + '  Promotion table ' + promoRows);
    check('D5-04: the promotion is STILL listed in the Volume table',
      volumeRows === 1, String(volumeRows)
      + ' — option 1 routes the pencil, it does not hide the row');
    check('D5-04: and in the Promotion table', promoRows === 1, String(promoRows));

    // ── THE ROUTE ────────────────────────────────────────────────────
    check('D5-04: the Volume tab is active before the click',
      tabActive('volume') === true, 'the drive must start where the user is');
    await click(q('edit-event'));

    console.log('  D5-04 after pencil   promo tab active ' + tabActive('promotion')
      + '  volume tab active ' + tabActive('volume')
      + '  %-pressed ' + (q('promo-amount-pct')
        ? String(q('promo-amount-pct').className).includes('bg-[#e60000]') : null));

    check('D5-04: the pencil SWITCHES to the Promotion tab',
      tabActive('promotion') === true && tabActive('volume') === false,
      'promo ' + tabActive('promotion') + ' volume ' + tabActive('volume')
      + ' — seeding the draft behind the Volume card is an invisible edit');
    check('D5-04: the promotion editor restored the % unit',
      q('promo-amount-pct')
        && String(q('promo-amount-pct').className).includes('bg-[#e60000]'),
      'the D5-03 restore, reached through the Volume pencil');
    console.log('  D5-04 mix rows restored: ' + Array.from(
      container.querySelectorAll('[data-testid^="promo-mix-pct-"]'))
      .map((e2: any) => String(e2.getAttribute('data-testid')).replace('promo-mix-pct-', ''))
      .join(', '));
    check('D5-04: and restored the mix and the lock',
      !!q('promo-mix-pct-High') && !!q('promo-mix-pct-Low'),
      'the arms the Volume form cannot represent');

    // ── SAVE, CHANGING NOTHING ───────────────────────────────────────
    const saveBtn = Array.from(container.querySelectorAll('button'))
      .find((b: any) => /save changes/i.test(String(b.textContent))) as any;
    check('D5-04: the promotion editor is open, with Save Changes',
      !!saveBtn, 'no Save Changes button — the edit never opened and the'
      + ' deep-equal below would compare nothing');
    if (saveBtn) await click(saveBtn);
    await (act as any)(async () => { root.unmount(); });

    console.log('  D5-04 commits    via Volume ' + viaVolume.length
      + '  via Promotion ' + viaPromo.length);
    check('D5-04: the VOLUME form never committed this row',
      viaVolume.length === 0, viaVolume.length
      + ' — setMarketEvents firing means handleEditStart took the promotion');
    check('D5-04: the PROMOTION editor did',
      viaPromo.length === 1, String(viaPromo.length));

    if (viaPromo.length === 1) {
      const saved = { ...viaPromo[0].patch };
      const before = readSet(PROMO);
      const after = readSet(saved);
      const moved = Object.keys(before).filter(k =>
        JSON.stringify((before as any)[k]) !== JSON.stringify((after as any)[k]));
      console.log('  D5-04 changed fields: ' + (moved.length ? moved.join(', ') : 'NONE'));
      for (const k of moved) {
        console.log('      ' + k + ': ' + JSON.stringify((before as any)[k])
          + ' -> ' + JSON.stringify((after as any)[k]));
      }
      // THE CLAIM THE DECISION MAKES. A no-change edit-and-save must leave the
      // engine's whole read-set untouched - arpu INCLUDED, which is the field
      // the old route destroyed.
      check('D5-04: a no-change edit-and-save leaves the 23-field read-set IDENTICAL',
        moved.length === 0, moved.join(', ') || 'none');
      check('D5-04: the BAKED RATE survives - the field the old route zeroed',
        after.arpu === before.arpu && after.arpu === 36,
        before.arpu + ' -> ' + after.arpu);
    }
  }

  // ── 3j. THE DILUTION CONTROL, DRIVEN THROUGH THE DOM ────────────
  //
  // 2138 built Dilution on the promotion's pricing arm and pinned the
  // arithmetic to 1e-9 against the Pricing card - but only through
  // `buildPromoEvents`. Its own Limits said so: "no mounted case drives the
  // CONTROL ... a defect in the wiring between the control and the builder
  // would not be caught here", and the gating was unasserted entirely.
  //
  // This drives the control: press the mode, type both figures, read the
  // effect line, press Add, and inspect what the card built.
  {
    const host = document.getElementById('root')!;
    host.replaceChildren();
    const container = document.createElement('div');
    host.appendChild(container);
    const root = createRoot(container);
    const added: any[] = [];
    const Harness = () => {
      const [newEvent, setNewEvent] = (React as any).useState({});
      // AN ARPU COLUMN, for the same reason the D5-04 mount needs one:
      // `computeCohortTrailingArpu` cannot produce a rate without a revenue or
      // arpu column, and the shared props pass '' for both. Without it the
      // card's base rate is null, the built arpu is 0, and a ratio assertion
      // on zero is TRUE FOR EVERY RATIO - the vacuous-result trap. Measured:
      // the first run of this block printed `arpu 0` and passed.
      const props = propsFor([], data.map((r: any) => ({ ...r, Arpu: 25 })));
      props.wiArpuCol = 'Arpu';
      props.setMarketEvents = (next: any) => { added.push(next); };
      return React.createElement(M, { ...props, newEvent, setNewEvent });
    };
    await (act as any)(async () => {
      root.render(React.createElement(ForecastProvider as any, {
        baseForecast: resolveForecast(keyA).forecast, setBaseForecast: noop,
        adjustedForecast: null, setAdjustedForecast: noop,
        forecastStore: store, setForecastStore: noop,
        resolveForecast, canResolve: () => true,
        hasLegacyBaseline: true, updatedAt: new Date().toISOString(),
        bulkRuns: [], setBulkRuns: noop,
      }, React.createElement(Harness)));
    });
    const q = (id: string) => container.querySelector('[data-testid="' + id + '"]') as any;
    const click = async (el: any) => { await (act as any)(async () => {
      el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); }); };
    /** A real React-controlled input write: the native setter, then `input`. */
    const typeInto = async (el: any, value: string) => {
      const proto = el.tagName === 'SELECT'
        ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
      await (act as any)(async () => {
        setter.call(el, value);
        el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      });
    };

    await click(q('whatif-tab-promotion'));
    await typeInto(q('promo-month'), MONTHS[0]);
    await typeInto(q('promo-volume-amount'), '1000');
    await click(q('promo-pricing-arm'));
    await click(q('promo-pricing-mode-dilution'));

    check('dilution control: the two figure inputs render',
      !!q('promo-dilution-current') && !!q('promo-dilution-target'),
      'the mode button did not open the dilution inputs');

    // ── GATING, BRANCH 1: INCOMPLETE ────────────────────────────────
    await typeInto(q('promo-dilution-current'), '25');
    const awaitingText = q('promo-dilution-effect')
      ? String(q('promo-dilution-effect').textContent).trim() : null;
    const addDisabledIncomplete = q('promo-add') ? q('promo-add').disabled : null;
    console.log('');
    console.log('  dilution INCOMPLETE  effect "' + awaitingText
      + '"  add disabled ' + addDisabledIncomplete);
    check('dilution gating: an INCOMPLETE pair disables Add',
      addDisabledIncomplete === true, String(addDisabledIncomplete));
    check('dilution gating: and names the reason on screen',
      awaitingText === i18n.t('whatif_dilution_awaiting'),
      '"' + awaitingText + '" vs "' + i18n.t('whatif_dilution_awaiting') + '"');

    // ── GATING, BRANCH 2: OUT OF RANGE ──────────────────────────────
    // A current dilution of 100 makes the retained-revenue ratio divide by
    // zero, so `dilutionAmountPct` returns null - absence, not a substituted
    // 1.0. Absence and out-of-range are DIFFERENT user situations, and the
    // block predicate keeps them apart; the effect line shows the same
    // awaiting copy for both, which is what it has, stated rather than
    // asserted as if it were two messages.
    await typeInto(q('promo-dilution-current'), '100');
    await typeInto(q('promo-dilution-target'), '20');
    const rangeText = q('promo-dilution-effect')
      ? String(q('promo-dilution-effect').textContent).trim() : null;
    const addDisabledRange = q('promo-add') ? q('promo-add').disabled : null;
    console.log('  dilution OUT OF RANGE  effect "' + rangeText
      + '"  add disabled ' + addDisabledRange);
    check('dilution gating: an OUT-OF-RANGE pair also disables Add',
      addDisabledRange === true, String(addDisabledRange)
      + ' — dilutionAmountPct returns null, and null is not zero');
    check('dilution gating: the range branch is reached, not the incomplete one',
      (fc.dilutionAmountPct(100, 20) === null)
        && (fc.dilutionAmountPct(25, undefined) === null),
      'both return null, so only the block predicate can tell them apart');

    // ── THE EFFECT LINE, AGAINST THE SHARED FUNCTION ────────────────
    await typeInto(q('promo-dilution-current'), '25');
    await typeInto(q('promo-dilution-target'), '20');
    const effectText = q('promo-dilution-effect')
      ? String(q('promo-dilution-effect').textContent).trim() : '';
    const shown = Number((effectText.match(/-?\d+(?:\.\d+)?/) ?? ['NaN'])[0]);
    const expected = fc.dilutionAmountPct(25, 20) as number;
    console.log('  dilution 25->20  rendered "' + effectText
      + '"  shown ' + shown + '  dilutionAmountPct ' + expected);
    check('dilution control: the rendered effect equals dilutionAmountPct',
      Math.abs(shown - Number(expected.toFixed(2))) < 1e-9,
      shown + ' vs ' + expected.toFixed(2)
      + ' — the card renders the same function the builder applies');
    check('dilution control: and that figure is the RATIO, not the difference',
      Math.abs(shown - 6.67) < 1e-9 && Math.abs(shown - 5) > 1,
      String(shown) + ' — 5.00 would mean a subtraction reached the screen');

    // ── ADD, AND WHAT THE CARD BUILT ────────────────────────────────
    const addDisabledComplete = q('promo-add') ? q('promo-add').disabled : null;
    check('dilution gating: a COMPLETE pair enables Add',
      addDisabledComplete === false, String(addDisabledComplete));
    await click(q('promo-add'));
    await (act as any)(async () => { root.unmount(); });

    const built = added.length ? added[added.length - 1][0] : null;
    console.log('  dilution ADD  rows ' + (added.length ? added[added.length - 1].length : 0)
      + '  arpu ' + (built ? built.arpu : null)
      + '  mode ' + (built ? built.promoPricingMode : null));
    check('dilution control: Add built exactly one row', !!built && added.length === 1,
      String(added.length));
    if (built) {
      // BY HAND. No mix arm, so the base rate is the cohort trailing average
      // the card resolves - read from the built row's own baseline rather
      // than assumed, then the ratio applied to it.
      const ratio = fc.retainedRevenueRatio(25, 20) as number;
      const BASE = 25;   // the fixture's trailing ARPU, every row priced at 25
      check('dilution control: the mode is persisted from the CONTROL',
        built.promoPricingMode === 'dilution', String(built.promoPricingMode));
      check('dilution control: and both stated figures',
        built.promoDilutionCurrentPct === 25 && built.promoDilutionTargetPct === 20,
        JSON.stringify([built.promoDilutionCurrentPct, built.promoDilutionTargetPct]));
      // NON-ZERO FIRST. A rate of 0 satisfies `arpu === base x ratio` for every
      // ratio, so the discriminating check is worthless without this one in
      // front of it.
      check('dilution control: the base rate is NON-ZERO, so the next check discriminates',
        built.arpu > 0, String(built.arpu)
        + ' — 0 makes any ratio assertion trivially true');
      check('dilution control: arpu is base x the retained-revenue ratio, by hand',
        Math.abs(built.arpu - BASE * ratio) < 1e-9,
        built.arpu + ' vs ' + (BASE * ratio) + ' — 25 x 0.80/0.75');
      // The stronger form: the derived amount on the row IS the function's.
      check('dilution control: promoPricingAmount equals dilutionAmountPct to 1e-9',
        Math.abs(built.promoPricingAmount - expected) < 1e-9,
        built.promoPricingAmount + ' vs ' + expected);
    }
  }

  // ── 3k. THE CAMPAIGN ROUTE, DRIVEN ──────────────────────────────
  //
  // 1950 built `editCampaignFromVolumeTable` and said so in its own Limits:
  // "the campaign pill's route is asserted by neither a mounted click nor a
  // trap. It shares the router with nothing else, so nothing would catch it
  // breaking." This is that click.
  //
  // A TWO-ROW CAMPAIGN FROM ONE BUILDER CALL, so the rows share an amountType
  // and an arm by construction - which is the assumption the campaign restore
  // makes when it reads `first` and speaks for the group.
  //
  // The arm is the DILUTION pricing arm rather than a mix: a mix needs tier
  // data the shared props cannot produce (no revenue or arpu column), and a
  // mix with zero tiers correctly disables Save. The dilution arm needs
  // neither, and exercises the D5-03 mode restore and the 2138 arm together.
  {
    const CAMPAIGN = 'Autumn promo';
    // ABSOLUTE, AND THAT IS A RULE RATHER THAN A CONVENIENCE. `groupByCampaign`
    // BARS any campaign containing a percentage row from group edit: the group
    // edit reverse-engineers a ramp by SUMMING volumes, and that arithmetic is
    // meaningless on a per cent. Measured, not assumed - the first run of this
    // block found no pressable pill at all, which is the bar firing correctly.
    // So the campaign route can only be driven on an absolute campaign, and
    // the unit restored here is Subs.
    const ROWS = buildPromoEvents({
      target: 'Inflow', amountType: 'absolute',
      draft: {
        date: MONTHS[0], segment: EVENT_ABS.segment, product: EVENT_ABS.product,
        productL2: EVENT_ABS.productL2, channel: EVENT_ABS.channel,
        channelL2: EVENT_ABS.channelL2, tariffL1: EVENT_ABS.tariffL1,
        tariffL2: EVENT_ABS.tariffL2,
        subscriberVolume: 1000, campaignName: CAMPAIGN, comment: '', contractLength: 12,
      } as any,
      mixEnabled: false, mixAxis: 'value', draftMix: {}, mixLocked: [],
      tierData: [],
      pricingEnabled: true, pricingMode: 'dilution', pricingAmount: 0,
      pricingDilutionCurrentPct: 25, pricingDilutionTargetPct: 20,
      cohortAvgArpu: 25,
      spreadEnabled: true, spreadMonths: 2, spreadDistType: 'even', customDist: [],
      startSequence: 1,
    } as any) as any[];

    const readSet = (e: any) => ({
      scenario: e.scenario, date: e.date, amountType: e.amountType,
      percentageBasis: e.percentageBasis, subscriberVolume: e.subscriberVolume,
      revenue: e.revenue, arpu: e.arpu, arpuOverride: e.arpuOverride,
      isPromotion: e.isPromotion, promoRebanded: e.promoRebanded,
      promoMixAxis: e.promoMixAxis, promoMix: e.promoMix,
      promoBandArpuOverride: e.promoBandArpuOverride, mixLocked: e.mixLocked,
      promoPricingMode: e.promoPricingMode, promoPricingAmount: e.promoPricingAmount,
      promoDilutionCurrentPct: e.promoDilutionCurrentPct,
      promoDilutionTargetPct: e.promoDilutionTargetPct,
      contractLength: e.contractLength, retentionLinked: e.retentionLinked,
      segment: e.segment, product: e.product, productL2: e.productL2,
    });

    check('campaign: the builder produced TWO rows from one call',
      ROWS.length === 2, String(ROWS.length)
      + ' — a one-row campaign takes the single-row path and tests nothing here');

    const committed: any[] = [];
    const host = document.getElementById('root')!;
    host.replaceChildren();
    const container = document.createElement('div');
    host.appendChild(container);
    const root = createRoot(container);
    const Harness = () => {
      const [newEvent, setNewEvent] = (React as any).useState({});
      const props = propsFor(ROWS, data.map((r: any) => ({ ...r, Arpu: 25 })));
      props.wiArpuCol = 'Arpu';
      props.setMarketEvents = (next: any) => { committed.push(next); };
      return React.createElement(M, { ...props, newEvent, setNewEvent });
    };
    await (act as any)(async () => {
      root.render(React.createElement(ForecastProvider as any, {
        baseForecast: resolveForecast(keyA).forecast, setBaseForecast: noop,
        adjustedForecast: null, setAdjustedForecast: noop,
        forecastStore: store, setForecastStore: noop,
        resolveForecast, canResolve: () => true,
        hasLegacyBaseline: true, updatedAt: new Date().toISOString(),
        bulkRuns: [], setBulkRuns: noop,
      }, React.createElement(Harness)));
    });
    const q = (id: string) => container.querySelector('[data-testid="' + id + '"]') as any;
    const click = async (el: any) => { await (act as any)(async () => {
      el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); }); };
    const tabActive = (tab: string) => {
      const el = q('whatif-tab-' + tab);
      return el ? String(el.className).includes('bg-white') : null;
    };

    // THE PILL EXISTS AND IS PRESSABLE. Before 2864d60 a promotion campaign's
    // pill rendered as a disabled span, so this check would have found no
    // button at all - and an assertion on an absent control proves nothing.
    const pill = q('edit-campaign');
    check('campaign: the Volume table shows a PRESSABLE campaign pill for a promotion',
      !!pill, 'a disabled span means the route has nothing to fire');
    check('campaign: and the Volume tab is where the drive starts',
      tabActive('volume') === true);

    if (pill) await click(pill);
    console.log('');
    console.log('  campaign route   promo tab ' + tabActive('promotion')
      + '  volume tab ' + tabActive('volume')
      + '  subs-pressed ' + (q('promo-amount-subs')
        ? String(q('promo-amount-subs').className).includes('bg-[#e60000]') : null)
      + '  dilution current ' + (q('promo-dilution-current')
        ? q('promo-dilution-current').value : null));

    check('campaign: the pill SWITCHES to the Promotion tab',
      tabActive('promotion') === true && tabActive('volume') === false,
      'promo ' + tabActive('promotion') + ' volume ' + tabActive('volume'));
    check('campaign: the campaign editor restored the SUBS unit from the first row',
      q('promo-amount-subs')
        && String(q('promo-amount-subs').className).includes('bg-[#e60000]')
        && !String(q('promo-amount-pct').className).includes('bg-[#e60000]'),
      'the D5-03 restore, reached through the campaign pill');
    check('campaign: and the dilution arm, both stated figures',
      q('promo-dilution-current') && q('promo-dilution-target')
        && Number(q('promo-dilution-current').value) === 25
        && Number(q('promo-dilution-target').value) === 20,
      JSON.stringify([q('promo-dilution-current')?.value, q('promo-dilution-target')?.value]));

    // SAVE, CHANGING NOTHING.
    const saveBtn = Array.from(container.querySelectorAll('button'))
      .find((b: any) => /save campaign|save changes/i.test(String(b.textContent))) as any;
    check('campaign: the campaign editor is open, with a save control', !!saveBtn,
      'no save button — the deep-equal below would compare nothing');
    if (saveBtn) await click(saveBtn);
    await (act as any)(async () => { root.unmount(); });

    const next = committed.length ? committed[committed.length - 1] : null;
    console.log('  campaign commits ' + committed.length
      + '  rows back ' + (next ? next.length : 0));
    check('campaign: the save committed', committed.length === 1 && !!next,
      String(committed.length));
    if (next) {
      const savedRows = next.filter((e: any) => e.campaignName === CAMPAIGN);
      check('campaign: BOTH rows came back', savedRows.length === 2,
        String(savedRows.length));
      const moved: string[] = [];
      ROWS.forEach((before: any, i: number) => {
        const after = savedRows[i];
        if (!after) { moved.push('row ' + i + ' missing'); return; }
        Object.keys(readSet(before)).forEach(k => {
          if (JSON.stringify((readSet(before) as any)[k])
              !== JSON.stringify((readSet(after) as any)[k])) {
            moved.push('row ' + i + '.' + k + ': '
              + JSON.stringify((readSet(before) as any)[k]) + ' -> '
              + JSON.stringify((readSet(after) as any)[k]));
          }
        });
      });
      console.log('  campaign changed: ' + (moved.length ? moved.join(' | ') : 'NONE'));
      check('campaign: EVERY row\'s 23-field read-set is identical after a no-change save',
        moved.length === 0, moved.join(' | ') || 'none');
    }
  }

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
