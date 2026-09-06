/**
 * REQ-D6-01 — PER-EVENT ON/OFF, DRIVEN AND PINNED.
 *
 *   npm run spec:event-toggle
 *
 * WHAT THIS ASSERTS, in the order it matters:
 *
 *  1. THE PREDICATE IS THE ONLY DEFINITION OF "OFF". Twelve apply sites call
 *     it; nothing outside `isEventOn` and the switch's own writer reads
 *     `.enabled`. Both are structural, because a thirteenth site testing the
 *     field directly would be a second definition that could drift — the shape
 *     `eventScopeMatchesView` was extracted to prevent, and the shape that cost
 *     three sessions when the re-banded pool carried its own copy.
 *  2. THE ARITHMETIC MOVES BY EXACTLY THE EVENT'S OWN CONTRIBUTION, mounted,
 *     and comes back to the penny when the event is turned on again. A toggle
 *     that merely changes a number is not evidence; a toggle that RESTORES the
 *     original is.
 *  3. ABSENT MEANS ON, at the reader and through a real xlsx round trip.
 *
 * ITS OWN MOUNT. `view-apply-mounted` is 168 checks long and its fixture is
 * shared by twelve blocks; a thirteenth would make every future change to it a
 * change to this one too.
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

import * as fs from 'fs';
import * as XLSX from 'xlsx';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

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

  // ══ 1. THE PREDICATE ITSELF ═══════════════════════════════════════════
  check('predicate: absent means ON', fc.isEventOn({}) === true);
  check('predicate: only an explicit false turns it off',
    fc.isEventOn({ enabled: false }) === false && fc.isEventOn({ enabled: true }) === true);
  check('predicate: undefined enabled is ON, not off',
    fc.isEventOn({ enabled: undefined }) === true,
    'a nullish check that treated undefined as off would disable every old event');
  // THE RAW-SHEET SHAPE. Compare's engine never calls marketEventFromRow, so
  // its rows carry the sheet column. One predicate, both shapes.
  check('predicate: a raw sheet row with Enabled No is OFF',
    fc.isEventOn({ Enabled: 'No' }) === false);
  check('predicate: a raw sheet row with Enabled Yes, or none, is ON',
    fc.isEventOn({ Enabled: 'Yes' }) === true && fc.isEventOn({ Enabled: '' }) === true
      && fc.isEventOn({ Enabled: undefined }) === true);

  // ══ 2. THE STRUCTURAL PINS ════════════════════════════════════════════
  const wi = fs.readFileSync('src/components/WhatIfTab.tsx', 'utf8');
  const sh = fs.readFileSync('src/utils/scenarioHelper.ts', 'utf8');
  const eng = fs.readFileSync('src/utils/forecasting.ts', 'utf8');

  // TWELVE APPLY SITES, counted by their own marker rather than by counting
  // isEventOn calls — the display sites call it too, and a count that could
  // not tell them apart would go green if an apply site were converted into
  // a display one.
  const applyMarkers = (src: string) =>
    (src.match(/REQ-D6-01, apply site/gi) ?? []).length;
  const wiApply = applyMarkers(wi), shApply = applyMarkers(sh);
  check('pin: EXACTLY 8 apply sites in the What-If engine', wiApply === 8, String(wiApply));
  check('pin: EXACTLY 4 apply sites in Compare\'s engine', shApply === 4, String(shApply));
  check('pin: TWELVE in total — the number the true-state inventory found',
    wiApply + shApply === 12, String(wiApply + shApply));

  // THE DISPLAY SITES ARE PINNED SEPARATELY, and that separation is the point:
  // they are decision 7, not decision 1, and moving one into the other class
  // must be a visible change rather than a silent one.
  const displayMarkers = (wi.match(/REQ-D6-01 DISPLAY/g) ?? []).length;
  check('pin: EXACTLY 6 display sites, counted apart from the twelve',
    displayMarkers === 6, String(displayMarkers));

  // NOTHING OUTSIDE THE PREDICATE READS `.enabled` FOR A DECISION.
  const readers = (src: string, file: string) =>
    src.split('\n').map((l, i) => ({ l, n: i + 1 }))
      .filter(x => /\.enabled\b/.test(x.l) && !/^\s*(\*|\/\/)/.test(x.l))
      .map(x => `${file}:${x.n}`);
  const engReaders = readers(eng, 'forecasting.ts');
  const wiReaders = readers(wi, 'WhatIfTab.tsx');
  const shReaders = readers(sh, 'scenarioHelper.ts');
  // forecasting.ts holds the predicate (one read) and the three export writers
  // (three more) — the writers must read the field, they are its serialiser.
  check('pin: `.enabled` is read in forecasting.ts ONLY by the predicate and the three writers',
    engReaders.length === 4, engReaders.join(' '));
  check('pin: NO site in the What-If engine reads `.enabled` directly',
    wiReaders.length === 0, wiReaders.join(' ')
    + ' — a second definition of "off" is how the pool predicate drifted for three sessions');
  check('pin: nor in Compare\'s', shReaders.length === 0, shReaders.join(' '));

  // THE SUMMARY BADGE COUNTS EVENTS THAT ARE ON (decision 6).
  //
  // PINNED STRUCTURALLY, and deliberately so: the badge is one expression in
  // ForecastSummaryBar, and mounting a whole second component to read one
  // integer would cost more than it proves. The three counters on that bar are
  // MEANT to differ - events held, events applied, events with no coverage -
  // so the thing worth guarding is that this one passes through the predicate
  // at all, which is exactly what a reader of the line can check.
  const bar = fs.readFileSync('src/components/ForecastSummaryBar.tsx', 'utf8');
  const countLine = bar.split('\n').find(l => /const eventCount\s*=/.test(l)) ?? '';
  check('badge: the event count is taken through isEventOn',
    /\.filter\(\s*isEventOn\s*\)/.test(countLine), countLine.trim()
    + ' - counting every event held would report a number the forecast does not use');

  // FOUR INSERTIONS OF THE ONE COMPONENT, and no fifth renderer.
  //
  // Counted by marker rather than by counting <EventOnOffSwitch> tags, because
  // the campaign control is an EventOnOffSwitch too and a tag count could not
  // tell a fifth card table from a second campaign pill.
  const cardMarks = (wi.match(/REQ-D6-01 CARD SWITCH (\d) of 4/g) ?? []);
  check('pin: the switch is inserted in EXACTLY 4 card tables (header + row each)',
    cardMarks.length === 8, cardMarks.length + ' markers');
  check('pin: they are tables 1..4, each appearing twice',
    JSON.stringify(cardMarks.map(m => m.slice(-6, -5)).sort())
      === JSON.stringify(['1', '1', '2', '2', '3', '3', '4', '4']),
    cardMarks.join(' '));
  check('pin: the campaign switch is the SAME edit twice, not two designs',
    (wi.match(/REQ-D6-01 CAMPAIGN SWITCH (\d) of 2/g) ?? []).length === 4);

  // EVERY WRITE GOES THROUGH THE ONE HANDLER. Five invocations: the four card
  // tables, and the campaign handler's per-row loop. A sixth would be a second
  // way to set the same field - the defect this whole arc is shaped against.
  const handlerCalls = (wi.match(/handleSetEventEnabled\(\{/g) ?? []).length;
  check('pin: EXACTLY 5 invocations of handleSetEventEnabled',
    handlerCalls === 5, String(handlerCalls)
    + ' - four card tables plus the campaign loop; the summary passes it by'
    + ' reference, which is why this counts invocations and not mentions');
  check('pin: the summary table is still handed the SAME handler',
    /onSetEnabled=\{handleSetEventEnabled\}/.test(wi));

  // ONE GREYING CLASS. Five renderers show an off row; a literal repeated five
  // times is five chances to drift.
  const srcFiles = ['src/components/WhatIfTab.tsx', 'src/components/EventsSummaryTable.tsx',
                    'src/components/EventOnOffSwitch.tsx'];
  const literal = srcFiles.filter(f => /'opacity-45'/.test(fs.readFileSync(f, 'utf8')));
  check('pin: `opacity-45` is written ONCE, as OFF_ROW',
    literal.length === 1 && literal[0].endsWith('EventOnOffSwitch.tsx'),
    literal.join(' '));

  // ══ 3. PERSISTENCE ════════════════════════════════════════════════════
  const mkt = fc.marketEventExportRow({
    id: 'm1', sequence: 1, scenario: 'Inflow', date: MONTHS[0], segment: 'All',
    product: 'All', channel: 'All', subscriberVolume: 100, customerVolume: 0,
    revenue: 0, arpu: 10, name: '', enabled: false,
  } as any);
  const mktOn = fc.marketEventExportRow({
    id: 'm2', sequence: 2, scenario: 'Inflow', date: MONTHS[0], segment: 'All',
    product: 'All', channel: 'All', subscriberVolume: 100, customerVolume: 0,
    revenue: 0, arpu: 10, name: '',
  } as any);
  check('export: an OFF event writes Enabled No', mkt.Enabled === 'No', String(mkt.Enabled));
  check('export: an event with no flag writes Enabled Yes',
    mktOn.Enabled === 'Yes', String(mktOn.Enabled));

  // THE COLUMN IS LAST, on all three sheets. Trap 119's rule: a reader keys by
  // name, but a human diffing two exports reads column ORDER.
  const lastKey = (o: Record<string, unknown>) => Object.keys(o)[Object.keys(o).length - 1];
  check('export: Enabled is the LAST column on Market_Events',
    lastKey(mkt) === 'Enabled', lastKey(mkt));
  const yr = fc.yieldEventExportRow({ id: 'y1', ibro: 'Inflow', segment: 'All', product: 'All',
    channelL1: 'All', channelL2: 'All', month: MONTHS[0], rollForward: false,
    tariffMix: {}, tariffBaseArpu: {}, enabled: false } as any);
  check('export: and on Yield_Events', lastKey(yr) === 'Enabled', lastKey(yr));
  const pr = fc.pricingEventExportRow({ id: 'p1', segment: 'All', product: 'All', productL2: 'All',
    channelL1: 'All', channelL2: 'All', month: MONTHS[0], inputMode: 'percentage',
    amount: 5, target: 'cohorts', cohortScope: 'both', duration: 'one-off',
    originalBaseArpu: 20, enabled: false } as any);
  check('export: and on Pricing_Events', lastKey(pr) === 'Enabled', lastKey(pr));

  /** Through a REAL workbook, not an object handed straight back. */
  const throughXlsx = (rows: Record<string, unknown>[]) => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'S');
    const back = XLSX.read(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' });
    return XLSX.utils.sheet_to_json(back.Sheets['S']) as any[];
  };
  const backOff: any = fc.marketEventFromRow(throughXlsx([mkt])[0], 'session');
  const backOn: any = fc.marketEventFromRow(throughXlsx([mktOn])[0], 'session');
  check('round trip: an OFF event reloads OFF', backOff.enabled === false, String(backOff.enabled));
  check('round trip: an ON event reloads ON', backOn.enabled === true, String(backOn.enabled));

  // AN OLD WORKBOOK. Every save written before this column loads with
  // everything applying, which is what it meant.
  const legacy = throughXlsx([{ ...mkt, Enabled: '' }])[0];
  const legacyBack: any = fc.marketEventFromRow(legacy, 'session');
  check('round trip: a workbook with NO Enabled column loads ON',
    legacyBack.enabled === true, String(legacyBack.enabled)
    + ' — false here would silently disable every event in every existing save');
  check('round trip: the same on the workbook route',
    (fc.marketEventFromRow(legacy, 'workbook') as any).enabled === true);
  const yBack: any = fc.yieldEventFromRow(throughXlsx([yr])[0]);
  const pBack: any = fc.pricingEventFromRow(throughXlsx([pr])[0]);
  check('round trip: the yield carrier keeps its OFF', yBack.enabled === false, String(yBack.enabled));
  check('round trip: the pricing carrier keeps its OFF', pBack.enabled === false, String(pBack.enabled));

  // EVERYTHING ELSE SURVIVES. `enabled` joins the read-set; nothing else moves.
  const readSet = (e: any) => ({
    scenario: e.scenario, date: e.date, amountType: e.amountType,
    subscriberVolume: e.subscriberVolume, revenue: e.revenue, arpu: e.arpu,
    segment: e.segment, product: e.product, channel: e.channel,
    retentionLinked: e.retentionLinked, contractLength: e.contractLength,
  });
  check('round trip: the rest of the row is untouched by the new column',
    JSON.stringify(readSet(backOff)) === JSON.stringify(readSet(backOn)),
    'only `enabled` may differ between the two');

  // ══ 3b. COMPARE'S ENGINE, DRIVEN ══════════════════════════════════════
  //
  // NOT a second mount — Compare's engine is one pure function over RAW SHEET
  // ROWS, and raw rows are the whole reason the predicate accepts two shapes.
  // A block that only proved the typed shape would leave Compare's four sites
  // asserted by nothing but a grep.
  const { computeScenarioForFilter } = await import('../src/utils/scenarioHelper');
  const baselineRows = MONTHS.map(m => ({
    Cohort_Key: 'c1', Segment: 'Corporate', Product: 'Mobile Voice', Product_L2: 'All',
    Channel: 'All', Channel_L2: 'All', Month: m, Inflow_Mean: 300, Outflow_Mean: 0,
    Retention_Mean: 100, ARPU_Mean: 20, Seed_Base_Volume: 10000,
    Last_Historical_Inflow: 200, Last_Historical_Outflow: 0,
  }));
  const rawEvent: Record<string, unknown> = {
    ID: 'ce1', Name: 'ce1', Scenario: 'Inflow', Start_Month: MONTHS[0],
    Segment: 'Corporate', Product: 'Mobile Voice', Product_L2: 'All',
    Channel: 'All', Channel_L2: 'All', Subscriber_Volume: 1000, ARPU: 0,
    Amount_Type: 'absolute',
  };
  const runCompare = (ev: Record<string, unknown> | null) =>
    computeScenarioForFilter(
      { baselineRows, marketEvents: ev ? [ev] : [], yieldEvents: [], pricingEvents: [] },
      'Corporate', { l1: null, l2: null }, { l1: null, l2: null });
  const cmpOn = runCompare(rawEvent);
  const cmpOff = runCompare({ ...rawEvent, Enabled: 'No' });
  const cmpNone = runCompare(null);
  // NaN IS NOT A READING. The first draft of this block reached for a field
  // that does not exist, got NaN on all three runs, and the "it moves" check
  // PASSED - because NaN !== NaN. A vacuous pass is the failure mode this
  // project has hit before (the ratio check that passed at arpu 0), so the
  // reader refuses rather than returning a number nothing can be concluded from.
  const firstInflow = (rows: any[]) => {
    const v = Number(rows?.[0]?.adjustedInflow);
    if (!Number.isFinite(v)) throw new Error(
      'Compare fixture produced no adjustedInflow - the shape moved: '
      + JSON.stringify(rows?.[0] ?? rows).slice(0, 200));
    return v;
  };
  console.log('  compare  ON inflow ' + firstInflow(cmpOn)
    + '  |  OFF ' + firstInflow(cmpOff) + '  |  no event ' + firstInflow(cmpNone));
  check('Compare: the raw-row event moves the month when ON',
    firstInflow(cmpOn) !== firstInflow(cmpNone),
    firstInflow(cmpOn) + ' vs ' + firstInflow(cmpNone)
    + ' - if these are equal the fixture is not exercising the engine at all');
  check('Compare: Enabled No is IGNORED BY THE ENGINE, not by the parser',
    firstInflow(cmpOff) === firstInflow(cmpNone),
    firstInflow(cmpOff) + ' vs ' + firstInflow(cmpNone));

  // ══ 4. MOUNTED ════════════════════════════════════════════════════════
  const noop = () => {};
  const band = (m: number) => ({ mean: m, optimistic: m * 1.1, pessimistic: m * 0.9 });
  const mkLeaf = (product: string, inflow: number) => ({
    cohort: { segment: 'Corporate', product, productL2: 'All', channel: 'All',
              channelL2: 'All', tariffL1: 'All', tariffL2: 'All', scenario: 'Standard Forecast' },
    seedBaseVolume: 10000, seedBaseKnown: true,
    historicalMonths: ['2025-10', '2025-11', '2025-12'],
    lastHistoricalInflow: inflow, lastHistoricalOutflow: 0,
    provenance: 'fitted' as const,
    months: MONTHS.map(month => ({
      month, inflow: band(inflow), outflow: band(0), retention: band(100), arpu: band(20),
      inflowArpu: band(22), outflowArpu: band(18), retentionArpu: band(21), baseArpu: band(20),
    })),
  });
  const A = mkLeaf('Mobile Voice', 200);
  const B = mkLeaf('Broadband', 800);
  const keyA = fc.makeForecastKey('Corporate', 'Mobile Voice', 'All', 'All', 'All', 'All', 'All');
  const keyB = fc.makeForecastKey('Corporate', 'Broadband', 'All', 'All', 'All', 'All', 'All');
  const store = new Map<string, any>([[keyA, A], [keyB, B]]);
  const leafMap = fc.buildRollUpIndex([keyA, keyB]).leafMap;
  const resolveForecast = (k: string) => fc.resolveFromStore(store, leafMap, k);

  const C = { date: 'Month', seg: 'Segment', prod: 'Product', prodL2: 'ProductL2',
              chan: 'Channel', chanL2: 'ChannelL2', metric: 'Metric', val: 'Volume' };
  const data = ['Mobile Voice', 'Broadband'].flatMap(p => MONTHS.map(m => ({
    [C.date]: m, [C.seg]: 'Corporate', [C.prod]: p, [C.prodL2]: 'All',
    [C.chan]: 'All', [C.chanL2]: 'All', [C.metric]: 'Inflow',
    [C.val]: p === 'Mobile Voice' ? 300 : 700,
  })));

  const EVENT = {
    id: 'e-abs', sequence: 1, scenario: 'Inflow', date: MONTHS[0],
    amountType: 'absolute', subscriberVolume: 1000, arpu: 0, revenue: 0,
    customerVolume: 0, segment: 'Corporate', product: 'Mobile Voice', productL2: 'All',
    channel: 'All', channelL2: 'All', tariffL1: 'All', tariffL2: 'All',
    name: 'abs', retentionLinked: false,
  } as any;

  const mount = async (marketEvents: any[], opts: any = {}) => {
    const host = document.getElementById('root')!;
    host.replaceChildren();
    const container = document.createElement('div');
    host.appendChild(container);
    const root = createRoot(container);
    const Harness = () => {
      const [newEvent, setNewEvent] = (React as any).useState({});
      // REAL STATE, not noop setters. The earlier block only needed to mount
      // three fixed arrays; a switch is a WRITE, and a harness whose setters
      // discard the write can only prove that a click does not crash.
      // `updateById` here is App's, verbatim in behaviour: a FUNCTIONAL
      // setState patching by id, which is what makes the campaign's N writes
      // in one tick land on each other rather than the last one winning.
      const [me, setMe] = (React as any).useState(marketEvents);
      const [ye, setYe] = (React as any).useState(opts.yieldEvents ?? []);
      const [pe, setPe] = (React as any).useState(opts.pricingEvents ?? []);
      const upd = (setter: any) => (id: string, patch: any) =>
        setter((prev: any[]) => prev.map(x => (x.id === id ? { ...x, ...patch } : x)));
      return React.createElement(M, {
        data, wiDateCol: C.date, wiSegmentCol: C.seg, wiProductCol: C.prod,
        wiProductL2Col: C.prodL2, wiChannelCol: C.chan, wiChannelL2Col: C.chanL2,
        wiMetricCol: C.metric, wiInflowVal: 'Inflow', wiOutflowVal: 'Outflow',
        wiRetentionVal: 'Retention', wiValueCol: C.val, wiRevenueCol: '', wiArpuCol: '',
        productTree: new Map([['Mobile Voice', ['All']], ['Broadband', ['All']]]),
        channelTree: new Map(), tariffTree: new Map(),
        selectedTariffs: [], setSelectedTariffs: noop, cohortAvgArpu: 20,
        marketEvents: me, setMarketEvents: setMe, addMarketEvent: noop,
        removeMarketEvent: noop, updateMarketEvent: upd(setMe),
        yieldEvents: ye, newYieldEvent: {}, setNewYieldEvent: noop, addYieldEvent: noop,
        removeYieldEvent: noop, clearAllYieldEvents: noop, updateYieldEvent: upd(setYe),
        pricingEvents: pe, newPricingEvent: {}, setNewPricingEvent: noop,
        addPricingEvent: noop, removePricingEvent: noop, clearAllPricingEvents: noop,
        updatePricingEvent: upd(setPe),
        downloadExcel: noop, formatNumber: (v: any) => Number(v).toFixed(2),
        setActiveView: noop, missingMonths: [], newEvent, setNewEvent,
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
    const num = (el: any) => el ? Number(String(el.textContent).replace(/[+,\s]/g, '')) : NaN;
    const handle = {
      q,
      baseDelta: () => num(q('impact-base-delta')),
      count: () => (q('impact-event-count') ? String(q('impact-event-count').textContent).trim() : null),
      /** The switch for one event, wherever it is currently rendered. */
      sw: (id: string) => q('event-on-' + id),
      /** Every switch for that id - the promotion has TWO. */
      allSw: (id: string) => Array.from(
        container.querySelectorAll('[data-testid="event-on-' + id + '"]')) as any[],
      row: (id: string) => q('events-summary-row-' + id),
      click: async (el: any) => { await (act as any)(async () => {
        el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      }); },
      tab: async (name: string) => { await (act as any)(async () => {
        q('whatif-tab-' + name).dispatchEvent(
          new dom.window.MouseEvent('click', { bubbles: true }));
      }); },
      close: async () => { await (act as any)(async () => { root.unmount(); }); },
      container,
    };
    return handle;
  };
  /** The old three-field snapshot, for the blocks written against it. */
  const snapshot = async (marketEvents: any[]) => {
    const h = await mount(marketEvents);
    const out = { baseDelta: h.baseDelta(), count: h.count(), container: h.container };
    await h.close();
    return out;
  };

  const on = await snapshot([EVENT]);
  const off = await snapshot([{ ...EVENT, enabled: false }]);
  const backAgain = await snapshot([{ ...EVENT, enabled: true }]);
  console.log('');
  console.log('  toggle  ON base delta ' + on.baseDelta + ' count ' + on.count
    + '   |  OFF ' + off.baseDelta + ' count ' + off.count
    + '   |  ON again ' + backAgain.baseDelta);

  check('mounted: the event moves the base delta when ON',
    on.baseDelta === 1000, String(on.baseDelta));
  check('mounted: turning it OFF removes exactly its contribution',
    off.baseDelta === 0, String(off.baseDelta)
    + ' — 1000 means the predicate is not reaching the apply site');
  check('mounted: and the applied count drops to zero',
    off.count === '0', String(off.count));
  check('mounted: turning it back ON restores the figure TO THE PENNY',
    backAgain.baseDelta === on.baseDelta,
    backAgain.baseDelta + ' vs ' + on.baseDelta
    + ' — a toggle that changes a number is not evidence; one that restores it is');

  // ══ 5. THE CARD TABLES, DRIVEN FROM EACH TAB ══════════════════════════
  //
  // The block above proved the ENGINE honours `enabled`. This one proves the
  // CONTROL reaches it: the switch is clicked in the DOM, on the card whose
  // tab is open, and the arithmetic is read afterwards. A switch that renders
  // correctly and writes nowhere would pass every check written so far.
  const YEV = {
    id: 'y-1', ibro: 'Inflow', segment: 'Corporate', product: 'Mobile Voice',
    productL2: 'All', channelL1: 'All', channelL2: 'All', month: MONTHS[0],
    rollForward: false, name: 'yv',
    tariffMix: { A: 100 }, tariffBaseArpu: { A: 30 },
  } as any;
  const PEV = {
    id: 'p-1', segment: 'Corporate', product: 'Mobile Voice', productL2: 'All',
    channelL1: 'All', channelL2: 'All', month: MONTHS[0], name: 'pv',
    inputMode: 'absolute', amount: 5, target: 'cohorts', cohortScope: 'both',
    duration: 'ongoing', originalBaseArpu: 20,
  } as any;
  const PROMO = (n: number) => ({
    ...EVENT, id: 'pr-' + n, sequence: 10 + n, name: 'promo' + n,
    isPromotion: true, campaignName: 'Spring', subscriberVolume: 100 * n,
  });

  const h = await mount([EVENT, PROMO(1), PROMO(2)],
    { yieldEvents: [YEV], pricingEvents: [PEV] });
  // THE SUMMARY IS COLLAPSED BY DEFAULT, so its rows are not in the DOM at all.
  // Opening it is part of the fixture, not part of what is being proved - a
  // "the summary row greys" check run against a closed panel reads false for
  // the wrong reason and would have been a green-looking bug either way.
  await h.click(h.q('events-summary-toggle'));

  /** The switch on the CARD, not the one on the summary table above it. */
  const cardSwitch = (id: string) => {
    const all = h.allSw(id);
    return all.length > 1 ? all[all.length - 1] : all[0];
  };
  const rowOf = (el: any) => el && el.closest('tr');
  /**
   * THE INSTRUMENT HAS TO MATCH THE EVENT.
   *
   * `impact-base-delta` is a SUBSCRIBER VOLUME figure. A yield or pricing
   * event moves ARPU and no volume at all, so measuring one with the other
   * reads "nothing happened" for a switch that worked perfectly - which is
   * exactly what the first run of this block reported. Reading both means
   * every kind of event is measured by something it can actually move.
   */
  const measure = () => h.baseDelta() + ' | '
    + String(h.q('impact-arpu-scenarios')?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const greyed = (el: any) => !!el && /opacity-45/.test(el.className || '');

  const tabs: [string, string][] = [
    ['volume', EVENT.id], ['value', YEV.id],
    ['pricing', PEV.id], ['promotion', 'pr-1'],
  ];
  console.log('');
  for (const [tab, id] of tabs) {
    await h.tab(tab);
    const sw = cardSwitch(id);
    check(`mounted ${tab}: the card table renders a switch for its row`,
      !!sw, 'no [data-testid="event-on-' + id + '"] on the ' + tab + ' card');
    if (!sw) continue;
    const before = measure();
    await h.click(sw);
    const after = measure();
    const cardGrey = greyed(rowOf(cardSwitch(id)));
    const sumGrey = greyed(h.row(id));
    console.log('  ' + tab.padEnd(10) + ' ' + before + '  ->  ' + after
      + '   card/summary greyed ' + cardGrey + '/' + sumGrey);
    check(`mounted ${tab}: switching the row off changes the forecast`,
      after !== before, before + ' -> ' + after
      + ' - a switch that renders and writes nowhere passes every static check');
    check(`mounted ${tab}: the card row greys`, cardGrey);
    check(`mounted ${tab}: and so does the summary row - ONE state, two views`,
      sumGrey);
    // BACK ON, to the penny, before the next tab is measured.
    await h.click(cardSwitch(id));
    check(`mounted ${tab}: switching it back on restores the figure exactly`,
      measure() === before, measure() + ' vs ' + before);
  }

  // A PROMOTION IS IN TWO TABLES. Switched off from the Promotion card, the
  // Volume card's copy of the same row must show off too - they are two views
  // of one `enabled`, and the failure this guards against is two states.
  await h.tab('promotion');
  await h.click(cardSwitch('pr-1'));
  await h.tab('volume');
  const volCopy = cardSwitch('pr-1');
  check('mounted: a promotion switched off on the Promotion card reads off on Volume',
    !!volCopy && volCopy.getAttribute('aria-checked') === 'false',
    String(volCopy && volCopy.getAttribute('aria-checked'))
    + ' - two switches over one field, not two fields');
  check('mounted: and the Volume row is greyed there too', greyed(rowOf(volCopy)));
  await h.click(cardSwitch('pr-1'));

  // THE CAMPAIGN SWITCH. One control, one write per row, and MIXED is real.
  await h.tab('promotion');
  const camp = () => h.sw('campaign-Spring');
  check('mounted: ONE campaign switch for the two-row campaign, not one per row',
    h.allSw('campaign-Spring').length === 1,
    h.allSw('campaign-Spring').length + ' controls');
  const deltaAllOn = h.baseDelta();
  check('mounted: the campaign reads ON while both its rows are on',
    camp() && camp().getAttribute('aria-checked') === 'true',
    String(camp() && camp().getAttribute('aria-checked')));
  await h.click(camp());
  const deltaAllOff = h.baseDelta();
  const promoRowsOff = ['pr-1', 'pr-2'].every(
    id => cardSwitch(id) && cardSwitch(id).getAttribute('aria-checked') === 'false');
  check('mounted: switching the campaign off switches EVERY row off',
    promoRowsOff, 'one write per row through the same handler; a non-functional'
    + ' setState would have let all but the last write vanish');
  check('mounted: and the forecast drops both rows\' contribution',
    deltaAllOff === deltaAllOn - 300, deltaAllOn + ' -> ' + deltaAllOff
    + ' (expected -300: promo1 100 + promo2 200)');
  // ONE ROW BACK ON -> MIXED. Not "off", and not "on": a campaign with one row
  // each way is neither, and drawing it as off invites a click that silently
  // turns the survivor off too.
  await h.click(cardSwitch('pr-1'));
  console.log('  campaign   ' + deltaAllOn + ' -> off ' + deltaAllOff
    + ' -> one back on ' + h.baseDelta()
    + '   pill aria-checked ' + (camp() && camp().getAttribute('aria-checked')));
  check('mounted: one row back on makes the campaign INDETERMINATE',
    camp() && camp().getAttribute('aria-checked') === 'mixed',
    String(camp() && camp().getAttribute('aria-checked')));
  // AND A CLICK ON MIXED TURNS IT ON, never off - off is the destructive
  // reading of an ambiguous state.
  await h.click(camp());
  check('mounted: clicking a MIXED campaign turns it fully on, not fully off',
    h.baseDelta() === deltaAllOn, h.baseDelta() + ' vs ' + deltaAllOn);
  await h.close();

  console.log('');
  console.log(`event-toggle spec: ${pass} passed, ${fails.length} failed`);
  fails.forEach(f => console.log('  FAIL  ' + f));
  process.exit(fails.length ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
