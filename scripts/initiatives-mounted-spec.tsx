/**
 * INITIATIVES ON THE EVENTS SUMMARY — REQ-D6-08 session 1, driven through the DOM.
 *
 *   npm run spec:initiatives
 *
 * Clauses 1-15 under REQ-D6-08 (Jon and Alessandro, 2026-09-16). This session:
 * the `Initiative` column on the three sheets, carried through campaign edits,
 * the summary's initiative headers with the tri-state switch, and Compare's
 * column. In fill-in order:
 *  (a) the column round-trips on all three sheets, LAST, through a real workbook;
 *  (b) an old save with no column: no initiative anywhere, no header;
 *  (c) a Volume campaign edited 3 -> 4 months keeps every row in the initiative,
 *      and a Promotion campaign save keeps it too;
 *  (d) one header, "5 events", placed at the earliest member, members together,
 *      ungrouped rows in today's order — asserted as a literal testid sequence;
 *  (e) the header switch turns every member off ACROSS carriers, reads mixed when
 *      one member is turned back on in its card, and turns all on from mixed;
 *  (f) 8 events in 2 initiatives: the badge says 8 events, Show all is offered;
 *  (g) Compare: the name in a column, pipeline order, no header.
 *
 * The Host holds all three carriers in real state with App's update semantics,
 * so a switch that wrote the wrong carrier shows in the rows, not in a mock.
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
const ALLV = { l1: null, l2: null } as any;
const near = (a: number, b: number, eps = 1e-6) =>
  Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
/** Relative difference in per cent — the unit the 0.5% tolerance is stated in. */
const pctDiff = (a: number, b: number) => Math.abs(a - b) / Math.max(1e-12, Math.abs(b)) * 100;

function report() {
  console.log(`\ninitiatives spec: ${pass} passed, ${fails.length} failed`);
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

  const FIX = 'test-data/VBU_IBRO_Trimmed_TariffHierarchy_Jan2023_Jun2026.xlsx';
  if (!fs.existsSync(FIX)) {
    console.log(`\ninitiatives spec: UNREACHABLE — fixture missing at ${FIX}`);
    process.exit(1);
  }
  const wb = XLSX.read(fs.readFileSync(FIX), { cellDates: true });
  const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

  const C = {
    date: 'Month', seg: 'Customer_Segment', prod: 'Product_L1',
    prodL2: 'Product_L2_Value_Tier', chan: 'Channel_Level_1', chanL2: 'Channel_Level_2',
    metric: 'IBRO_Scenario_Type', val: 'Subscriber_Volume', rev: 'Monthly_Revenue_GBP',
  };
  const noop = () => {};
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

  const fc: any = await import('../src/utils/forecasting');
  const { ForecastProvider } = await import('../src/context/ForecastContext');
  const map = fc.buildCohortDataMap(
    rows.map((r: any) => ({ ...r, _parsedDate: new Date(r[C.date]) }))
        .filter((r: any) => !isNaN(r._parsedDate.getTime())),
    C.date, C.seg, C.prod, C.prodL2, C.chan, C.chanL2, 'tariff_tier_l1', 'tariff_tier_l2');
  const SEG = 'Corporate';
  const acc = new Map<number, any>();
  for (const [k, bucket] of map) {
    if (String(k).split('|')[0] !== SEG) continue;
    for (const row of bucket as any[]) {
      const tms = row._parsedDate.getTime();
      if (!acc.has(tms)) acc.set(tms, { _parsedDate: row._parsedDate, inflow: 0, outflow: 0, retention: 0,
        arpu: 0, inflowArpu: 0, outflowArpu: 0, retentionArpu: 0, baseArpu: 0 });
      const e = acc.get(tms)!, m = String(row[C.metric]), v = Number(row[C.val]) || 0;
      if (m === 'Inflow') e.inflow += v; else if (m === 'Outflow') e.outflow += v;
      else if (m === 'Retention') e.retention += v;
    }
  }
  const seriesArr = [...acc.values()].sort((a, b) => a._parsedDate - b._parsedDate);
  const HORIZON = 24;

  // ── A RESOLVABLE STORE, because the churn panel needs one ────────────────
  //
  // The volume mount could pass an empty store: the spread never asks the
  // context anything. The churn fold does — it derives the scoped series and
  // reads `canShowBaseForecast(churnScopeResolution?.forecast)` for
  // `seedBaseKnown`, and an unresolvable scope makes EVERY month absent, the
  // fold emit nothing, and the Add button do nothing at all.
  //
  // The first draft of this file passed `canResolve: () => false` and the run
  // reported 0 rows emitted — not a defect in the feature, a harness that had
  // nothing to fold. The shape below is `spec:mix-card`'s R7 section verbatim
  // in intent: LEAVES in the store plus a leafMap, because a stored fit under
  // an All-bearing key is ignored by design (the retired fit-on-aggregate
  // rule), so stashing an aggregate would resolve to null and this file would
  // be testing an absence while claiming to test a ramp.
  const mkSeries = (mult: number, arpu: number) => seriesArr.map((r: any) => ({
    ...r, inflow: r.inflow * mult, outflow: r.outflow * mult, retention: r.retention * mult,
    arpu, inflowArpu: arpu, outflowArpu: arpu, retentionArpu: arpu, baseArpu: arpu,
  }));
  const leafCohort = (prod: string) => ({
    segment: SEG, product: prod, productL2: 'Standard', channel: 'Direct',
    channelL2: 'Direct Sales', tariffL1: 'T1', tariffL2: 'T2', scenario: 'Base Case',
  });
  const leafKey = (prod: string) =>
    fc.makeForecastKey(SEG, prod, 'Standard', 'Direct', 'Direct Sales', 'T1', 'T2');
  const PRODS = [...treeOf(C.prod, C.prodL2).keys()]
    .filter(k => k && k !== 'All' && k !== 'undefined');
  const PRODB = PRODS[0] ?? 'All';
  const PRODC = PRODS[1] ?? PRODB;
  // SEEDS LARGE ENOUGH THAT THE BASE CANNOT COLLAPSE over 24 months. A base
  // that rolls to zero is a legitimate absence the fold names, and a fixture
  // that hit it would be exercising the absence path.
  const store = new Map<string, any>([
    [leafKey(PRODB), fc.calculateBaseForecast(mkSeries(1, 24), leafCohort(PRODB),
      800_000, HORIZON, 1.0, 1.5, 3, 'Holt Linear')],
    [leafKey(PRODC), fc.calculateBaseForecast(mkSeries(0.25, 6), leafCohort(PRODC),
      200_000, HORIZON, 1.0, 1.5, 3, 'Holt Linear')],
  ]);
  const keyAll = fc.makeForecastKey(SEG, 'All', 'All', 'All', 'All', 'All', 'All');
  const leafMap = new Map<string, string[]>([
    [keyAll, [leafKey(PRODB), leafKey(PRODC)]],
  ]);
  const baseForecast = fc.resolveFromStore(store, leafMap, keyAll).forecast;
  check('harness: the All-scope forecast RESOLVES', !!baseForecast,
    'an unresolvable scope makes every fold month absent and emits nothing');
  if (!baseForecast) { report(); return; }

  const MONTHS: string[] = baseForecast.months.map((m: any) => m.month);
  check('harness: the base forecast spans 24 months', MONTHS.length === HORIZON, `${MONTHS.length}`);
  if (MONTHS.length !== HORIZON) { report(); return; }

  let captured: any[] = [];
  let capturedYield: any[] = [];
  let capturedPricing: any[] = [];
  let draftSetter: ((d: any) => void) | null = null;
  let initial: { market: any[]; yield: any[]; pricing: any[] } = { market: [], yield: [], pricing: [] };

  /** App's own update semantics: a functional map by id, so N calls in one tick compose. */
  const byId = (setter: any) => (id: string, patch: any) =>
    setter((prev: any[]) => prev.map((e: any) => (e.id === id ? { ...e, ...patch } : e)));

  const Host: React.FC<any> = ({ Card, props }) => {
    const [newEvent, setNewEvent] = (React as any).useState({
      scenario: 'Inflow', segment: SEG, product: 'All', productL2: 'All',
      channel: 'All', channelL2: 'All', tariffL1: 'All', tariffL2: 'All',
      date: MONTHS[0], subscriberVolume: 0, customerVolume: 0, revenue: 0, arpu: 0,
      name: '', campaignName: '', comment: '', contractLength: 24,
    });
    const [marketEvents, setMarketEvents] = (React as any).useState(initial.market);
    const [yieldEvents, setYieldEvents] = (React as any).useState(initial.yield);
    const [pricingEvents, setPricingEvents] = (React as any).useState(initial.pricing);
    draftSetter = setNewEvent;
    captured = marketEvents; capturedYield = yieldEvents; capturedPricing = pricingEvents;
    return React.createElement(Card, {
      ...props, newEvent, setNewEvent, marketEvents, setMarketEvents,
      addMarketEvent: () => setMarketEvents((e: any[]) => [...e, { ...newEvent, id: 'single' }]),
      updateMarketEvent: byId(setMarketEvents),
      yieldEvents, updateYieldEvent: byId(setYieldEvents),
      removeYieldEvent: (id: string) => setYieldEvents((p: any[]) => p.filter((e: any) => e.id !== id)),
      pricingEvents, updatePricingEvent: byId(setPricingEvents),
      removePricingEvent: (id: string) => setPricingEvents((p: any[]) => p.filter((e: any) => e.id !== id)),
    });
  };

  const whatIfProps = () => ({
    data: rows.slice(0, 4000),
    wiDateCol: C.date, wiSegmentCol: C.seg, wiProductCol: C.prod, wiProductL2Col: C.prodL2,
    wiChannelCol: C.chan, wiChannelL2Col: C.chanL2, wiMetricCol: C.metric,
    wiInflowVal: 'Inflow', wiRetentionVal: 'Retention', wiOutflowVal: 'Outflow',
    wiValueCol: C.val, wiRevenueCol: C.rev, wiArpuCol: '',
    productTree: treeOf(C.prod, C.prodL2), channelTree: treeOf(C.chan, C.chanL2),
    tariffTree: new Map<string, string[]>(),
    selectedTariffs: [], setSelectedTariffs: noop,
    cohortAvgArpu: 11.6,
    removeMarketEvent: noop,
    newYieldEvent: {}, setNewYieldEvent: noop, addYieldEvent: noop, clearAllYieldEvents: noop,
    newPricingEvent: {}, setNewPricingEvent: noop, addPricingEvent: noop, clearAllPricingEvents: noop,
    downloadExcel: noop, formatNumber: (v: any) => Number(v).toFixed(2), setActiveView: noop,
    missingMonths: [],
  } as any);

  const withProvider = (child: any) => React.createElement(ForecastProvider as any, {
    baseForecast, setBaseForecast: noop,
    adjustedForecast: null, setAdjustedForecast: noop,
    forecastStore: store, setForecastStore: noop,
    // THE REAL SEAM over the two-leaf store, not a stub — what App passes.
    resolveForecast: (k: string) => fc.resolveFromStore(store, leafMap, k),
    canResolve: (k: string) => leafMap.has(k) || store.has(k),
    hasLegacyBaseline: !!baseForecast, updatedAt: new Date().toISOString(),
    bulkRuns: [], setBulkRuns: noop,
  }, child);

  const M: any = (await import('../src/components/WhatIfTab')).WhatIfTab;
  const host = document.getElementById('root')!;
  let container: any, root: any;

  const mount = async () => {
    host.replaceChildren();
    container = document.createElement('div');
    host.appendChild(container);
    root = createRoot(container);
    await (act as any)(async () => {
      root.render(withProvider(React.createElement(Host, { Card: M, props: whatIfProps() })));
    });
  };

  const byTestId = (id: string) => container.querySelector(`[data-testid="${id}"]`) as any;
  const allTestId = (id: string) => [...container.querySelectorAll(`[data-testid^="${id}"]`)] as any[];
  const norm = (s: string) => (s || '').replace(/»/g, '').trim();
  const click = async (el: any) => { await (act as any)(async () => { el.click(); }); };
  /** Type into a controlled React input, the way the user does. */
  const type = async (el: any, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(
      dom.window.HTMLInputElement.prototype, 'value')!.set!;
    await (act as any)(async () => {
      setter.call(el, value);
      el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
  };

  // ══════════════════════════════════════════════════════════════════════════
  // REQ-D6-05 — THE VOLUME CARD, DRIVEN.
  //
  // FILL-IN ORDER, AND IT IS STATED AT EACH CASE: mode → amount → duration →
  // values → Hold LAST. The order is not decoration. The promotion card shipped
  // a stale-closure defect that only Jon's order exposed (promo-hold-mounted
  // records it); a harness that fills a form in a different order from a
  // person can pass what the card fails.
  //
  // THE SCENARIO AND START MONTH ARE SET ON THE DRAFT, not clicked, exactly as
  // hold-mounted and churn-hold-mounted do: they are not what this build
  // changed, and the start month must be MONTHS[0] for the horizon to be 24.
  //
  // EVERY EXPECTED ROW LIST IS A HAND-WRITTEN LITERAL, never read back off the
  // card and compared with itself.
  // ══════════════════════════════════════════════════════════════════════════
  const setDraft = async (patch: any) => {
    await (act as any)(async () => { draftSetter!((d: any) => ({ ...d, ...patch })); });
  };
  const btnByText = (txt: string) =>
    [...container.querySelectorAll('button')].find((b: any) => norm(b.textContent || '') === txt) as any;
  const pillFor = (name: string, n: number) => {
    const title = i18n.t('whatif_edit_campaign_event', { p0: name, p1: n, p2: n === 1 ? '' : 's' });
    return [...container.querySelectorAll('button')].find((b: any) => b.getAttribute('title') === title) as any;
  };
  const vols = () => captured.map((e: any) => Math.abs(e.subscriberVolume));
  const freshInflow = async (campaignName: string) => {
    await setDraft({ scenario: 'Inflow', segment: SEG, amountType: 'absolute', percentageBasis: 'baseline',
      subscriberVolume: 0, date: MONTHS[0], campaignName });
  };

  const EN: any = JSON.parse(fs.readFileSync('src/locales/en/translation.json', 'utf8'));
  const throughXlsx = (rs: Record<string, unknown>[]) => {
    const wb2 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb2, XLSX.utils.json_to_sheet(rs), 'S');
    const buf = XLSX.write(wb2, { type: 'buffer', bookType: 'xlsx' });
    return XLSX.utils.sheet_to_json(XLSX.read(buf, { type: 'buffer' }).Sheets['S'], { defval: '' }) as Record<string, unknown>[];
  };
  const vol = (id: string, name: string, month: string, initiative?: string, seq = 1) => ({
    id, name, campaignName: name, scenario: 'Inflow', segment: SEG, product: 'All', productL2: 'All',
    channel: 'All', channelL2: 'All', tariffL1: 'All', tariffL2: 'All', date: month,
    subscriberVolume: 1000, customerVolume: 0, revenue: 0, arpu: 0, comment: '', contractLength: 24,
    sequence: seq, amountType: 'absolute', percentageBasis: 'baseline', retentionLinked: true,
    isPromotion: false, promoRebanded: false, hold: false, mode: 'spread',
    ...(initiative ? { initiative } : {}),
  });
  const yld = (id: string, name: string, month: string, initiative?: string) => ({
    id, name, ibro: 'Inflow', segment: SEG, product: 'All', channelL1: 'All', channelL2: 'All', month,
    rollForward: false, mixAxis: 'value', tariffMix: { A: 50, B: 50 }, tariffBaseArpu: { A: 10, B: 20 },
    arpuBasis: 'historical', comment: '', ...(initiative ? { initiative } : {}),
  });
  const prc = (id: string, name: string, month: string, initiative?: string) => ({
    id, name, segment: SEG, product: 'All', productL2: 'All', channelL1: 'All', channelL2: 'All',
    tariffL1: 'All', tariffL2: 'All', month, inputMode: 'percentage', amount: 5, target: 'cohorts',
    cohortScope: 'both', duration: 'one-off', originalBaseArpu: 20, comment: '', contractLength: 24,
    ...(initiative ? { initiative } : {}),
  });

  // THE FIXTURE. An initiative "Launch" spanning a 3-row Volume campaign (months
  // 2-4), a Value event and a Pricing event; ungrouped: "Early" at month 0 (so the
  // group does NOT sit first), "Solo" at month 3 (inside the campaign's span), a
  // Value and a Pricing event. Today's order is pass, then month.
  const L = 'Launch';
  const FIX_MARKET = [
    vol('camp-1', 'CampA', MONTHS[2], L, 2), vol('camp-2', 'CampA', MONTHS[3], L, 3),
    vol('camp-3', 'CampA', MONTHS[4], L, 4), vol('early', 'Early', MONTHS[0], undefined, 1),
    vol('solo', 'Solo', MONTHS[3], undefined, 5),
  ];
  const FIX_YIELD = [yld('y-in', 'YieldIn', MONTHS[1], L), yld('y-out', 'YieldOut', MONTHS[2])];
  const FIX_PRICING = [prc('p-in', 'PriceIn', MONTHS[1], L), prc('p-out', 'PriceOut', MONTHS[2])];

  // ── (a) ROUND TRIP ────────────────────────────────────────────────────────
  const mRows = FIX_MARKET.map((e: any) => fc.marketEventExportRow(e));
  const yRows = FIX_YIELD.map((e: any) => fc.yieldEventExportRow(e));
  const pRows = FIX_PRICING.map((e: any) => fc.pricingEventExportRow(e));
  const last = (r: any) => Object.keys(r)[Object.keys(r).length - 1];
  check('(a) Initiative is written LAST on Market_Events', mRows.every(r => last(r) === 'Initiative'), last(mRows[0]));
  check('(a) Initiative is written LAST on Yield_Events', yRows.every(r => last(r) === 'Initiative'), last(yRows[0]));
  check('(a) Initiative is written LAST on Pricing_Events', pRows.every(r => last(r) === 'Initiative'), last(pRows[0]));
  check('(a) a row in no initiative writes an empty cell', mRows[3].Initiative === '' && yRows[1].Initiative === '');
  // A name typed with stray spaces reads back trimmed (clause 11).
  const padded = { ...yRows[0], Initiative: '  ' + L + ' ' };
  const mBack = throughXlsx(mRows).map(r => fc.marketEventFromRow(r, 'session'));
  const yBack = throughXlsx([padded, yRows[1]]).map(r => fc.yieldEventFromRow(r));
  const pBack = throughXlsx(pRows).map(r => fc.pricingEventFromRow(r));
  check('(a) every Market member reads back in the initiative, non-members in none',
    mBack.map((e: any) => e.initiative ?? '-').join(',') === 'Launch,Launch,Launch,-,-',
    mBack.map((e: any) => e.initiative ?? '-').join(','));
  check('(a) the Value member reads back, trimmed', yBack[0]?.initiative === L && yBack[1].initiative === undefined,
    JSON.stringify(yBack.map((e: any) => e.initiative)));
  check('(a) the Pricing member reads back', pBack[0]?.initiative === L && pBack[1].initiative === undefined,
    JSON.stringify(pBack.map((e: any) => e.initiative)));

  // ── (b) AN OLD SAVE WITH NO COLUMN ────────────────────────────────────────
  const strip = (rs: any[]) => rs.map(r => { const o = { ...r }; delete o.Initiative; return o; });
  const mOld = throughXlsx(strip(mRows)).map(r => fc.marketEventFromRow(r, 'session'));
  const yOld = throughXlsx(strip(yRows)).map(r => fc.yieldEventFromRow(r));
  const pOld = throughXlsx(strip(pRows)).map(r => fc.pricingEventFromRow(r));
  check('(b) an old save loads with NO initiative on any row',
    [...mOld, ...yOld, ...pOld].every((e: any) => e.initiative === undefined));
  const oldEntries = fc.initiativeGroups(fc.buildEventsSummaryRows({ marketEvents: mOld, yieldEvents: yOld, pricingEvents: pOld }, i18n.t));
  check('(b) and the layout has no header', oldEntries.every((x: any) => x.kind === 'row'), String(oldEntries.length));
  initial = { market: mOld, yield: yOld, pricing: pOld };
  await mount();
  const openSummary = async () => {
    const tog = byTestId('events-summary-toggle');
    if (tog && tog.getAttribute('aria-expanded') !== 'true') await click(tog);
  };
  await openSummary();
  check('(b) mounted: no initiative header renders', allTestId('events-summary-initiative-').length === 0,
    String(allTestId('events-summary-initiative-').length));

  // ── (c) A CAMPAIGN EDIT KEEPS THE INITIATIVE ──────────────────────────────
  initial = { market: mBack, yield: yBack, pricing: pBack };
  await mount();
  const pill = pillFor('CampA', 3);
  check('(c) the CampA campaign pill is reachable', !!pill);
  if (pill) {
    await click(pill);
    check('(c) REOPEN: duration 3', byTestId('volume-duration')?.value === '3', byTestId('volume-duration')?.value);
    await type(byTestId('volume-duration'), '4');
    const save = btnByText(i18n.t('whatif_save_campaign'));
    check('(c) the Save campaign button is present', !!save);
    if (save) await click(save);
    const camp = captured.filter((e: any) => e.campaignName === 'CampA');
    check('(c) the campaign is now FOUR rows', camp.length === 4, String(camp.length));
    check('(c) and EVERY row, the added month included, is in the initiative',
      camp.length === 4 && camp.every((e: any) => e.initiative === L),
      camp.map((e: any) => e.initiative ?? '-').join(','));
    check('(c) the ungrouped rows are untouched', captured.filter((e: any) => e.campaignName !== 'CampA').every((e: any) => e.initiative === undefined));
  }
  // The PROMOTION campaign save rebuilds its rows too.
  {
    const { buildPromoEvents } = await import('../src/components/WhatIfTab');
    const promoRows = buildPromoEvents({
      target: 'Inflow', amountType: 'absolute',
      draft: { segment: SEG, product: 'All', productL2: 'All', channel: 'All', channelL2: 'All',
        tariffL1: 'All', tariffL2: 'All', date: MONTHS[1], subscriberVolume: 2000, contractLength: 24,
        campaignName: 'PromoC', comment: '' },
      mixEnabled: false, mixAxis: 'value', draftMix: {}, mixLocked: [], tierData: [],
      pricingEnabled: false, pricingMode: 'percentage', pricingAmount: 0, cohortAvgArpu: 20,
      shape: [{ offset: 0, fraction: 0.5 }, { offset: 1, fraction: 0.5 }], mode: 'spread', startSequence: 1,
    } as any).map((e: any, i: number) => ({ ...e, id: 'pc-' + i, initiative: 'PromoInit' }));
    initial = { market: promoRows, yield: [], pricing: [] };
    await mount();
    await click(byTestId('whatif-tab-promotion'));
    const ppill = pillFor('PromoC', 2);
    check('(c) the PromoC campaign pill is reachable', !!ppill);
    if (ppill) {
      await click(ppill);
      const psave = btnByText(i18n.t('whatif_save_campaign'));
      check('(c) the promotion Save campaign button is present', !!psave);
      if (psave) await click(psave);
      const pc = captured.filter((e: any) => e.campaignName === 'PromoC');
      check('(c) the rebuilt PROMOTION rows keep the initiative',
        pc.length === 2 && pc.every((e: any) => e.initiative === 'PromoInit') && pc.every((e: any) => !String(e.id).startsWith('pc-')),
        pc.map((e: any) => e.id + ':' + (e.initiative ?? '-')).join(','));
    }
  }

  // ── (d) THE SUMMARY LAYOUT ────────────────────────────────────────────────
  initial = { market: mBack, yield: yBack, pricing: pBack };
  await mount();
  await openSummary();
  const bodyRows = () => [...container.querySelectorAll('[data-testid="events-summary-body"] tbody tr')]
    .map((tr: any) => String(tr.getAttribute('data-testid')).replace('events-summary-', ''));
  const seq = bodyRows().join(' | ');
  // HAND-WRITTEN. Today's order is pass then month: early(m0) camp-1(m2)
  // camp-2(m3) solo(m3) camp-3(m4) | y-in(m1) y-out(m2) | p-in(m1) p-out(m2).
  // The group sits where its earliest member (camp-1) was; its members follow in
  // today's order; every ungrouped row keeps its relative place.
  const EXPECT = 'row-early | initiative-Launch | row-camp-1 | row-camp-2 | row-camp-3 | row-y-in | row-p-in'
    + ' | row-solo | row-y-out | row-p-out';
  check('(d) the order: group at its earliest member, members together, the rest unmoved', seq === EXPECT, seq);
  check('(d) exactly ONE header', allTestId('events-summary-initiative-Launch').length === 1);
  check('(d) the header says 5 events',
    (byTestId('events-summary-initiative-count-Launch')?.textContent || '').trim() === i18n.t('whatif_summary_count', { count: 5 }),
    byTestId('events-summary-initiative-count-Launch')?.textContent);
  check('(d) the panel badge still counts EVENTS (9), not entries (10)',
    (byTestId('events-summary-count')?.textContent || '').trim() === i18n.t('whatif_summary_count', { count: 9 }),
    byTestId('events-summary-count')?.textContent);
  const eff = (byTestId('events-summary-initiative-effect-Launch')?.textContent || '').trim();
  check('(d) the header Effect cell is a per-state count, empty states omitted',
    /^[^·]+ ×\d+( · [^·]+ ×\d+)*$/.test(eff) && eff.split(' · ').reduce((n, p) => n + Number(p.split('×')[1]), 0) === 5,
    eff);
  console.log('  (d) entries: ' + seq);
  console.log('  (d) header effect: ' + eff);

  // ── (e) THE HEADER SWITCH ─────────────────────────────────────────────────
  const hdrSwitch = () => byTestId('event-on-initiative-Launch');
  const members = () => [...captured.filter((e: any) => e.initiative === L), ...capturedYield.filter((e: any) => e.initiative === L),
    ...capturedPricing.filter((e: any) => e.initiative === L)];
  const nonMembers = () => [...captured.filter((e: any) => e.initiative !== L), ...capturedYield.filter((e: any) => e.initiative !== L),
    ...capturedPricing.filter((e: any) => e.initiative !== L)];
  check('(e) the header switch reads ALL ON', hdrSwitch()?.getAttribute('aria-checked') === 'true',
    hdrSwitch()?.getAttribute('aria-checked'));
  if (hdrSwitch()) await click(hdrSwitch());
  check('(e) OFF: every Market member is off', captured.filter((e: any) => e.initiative === L).every((e: any) => e.enabled === false));
  check('(e) OFF: the VALUE member is off — its own carrier was written',
    capturedYield.find((e: any) => e.id === 'y-in')?.enabled === false, String(capturedYield.find((e: any) => e.id === 'y-in')?.enabled));
  check('(e) OFF: the PRICING member is off — its own carrier was written',
    capturedPricing.find((e: any) => e.id === 'p-in')?.enabled === false, String(capturedPricing.find((e: any) => e.id === 'p-in')?.enabled));
  check('(e) and no non-member moved', nonMembers().every((e: any) => e.enabled !== false));
  check('(e) the header now reads ALL OFF', hdrSwitch()?.getAttribute('aria-checked') === 'false',
    hdrSwitch()?.getAttribute('aria-checked'));
  // ONE member on, in ITS CARD: the Value card table's switch, not the summary's.
  await click(byTestId('whatif-tab-value'));
  const cardSwitch = [...container.querySelectorAll('[data-testid="event-on-y-in"]')]
    .find((el: any) => !el.closest('[data-testid="events-summary-body"]')) as any;
  check('(e) the Value card has its own switch for the member', !!cardSwitch);
  if (cardSwitch) await click(cardSwitch);
  check('(e) one member on in its card -> the header reads MIXED',
    hdrSwitch()?.getAttribute('aria-checked') === 'mixed', hdrSwitch()?.getAttribute('aria-checked'));
  if (hdrSwitch()) await click(hdrSwitch());
  check('(e) click on MIXED -> every member ON', members().length === 5 && members().every((e: any) => e.enabled !== false),
    members().map((e: any) => e.id + ':' + e.enabled).join(','));
  check('(e) and the header reads ALL ON again', hdrSwitch()?.getAttribute('aria-checked') === 'true');

  // ── (f) COUNTING: 8 events in 2 initiatives ───────────────────────────────
  initial = {
    market: [],
    yield: [0, 1, 2, 3].map(i => yld('fa-' + i, 'FA' + i, MONTHS[i], 'Alpha')),
    pricing: [0, 1, 2, 3].map(i => prc('fb-' + i, 'FB' + i, MONTHS[i], 'Beta')),
  };
  await mount();
  await openSummary();
  check('(f) the badge says 8 events', (byTestId('events-summary-count')?.textContent || '').trim() === i18n.t('whatif_summary_count', { count: 8 }),
    byTestId('events-summary-count')?.textContent);
  check('(f) 10 entries render (8 rows + 2 headers)', bodyRows().length === 10, String(bodyRows().length));
  check('(f) Show all is offered — 10 visible entries exceed 9', !!byTestId('events-summary-show-all'));

  // ── (g) COMPARE: the name in a column, pipeline order, no header ──────────
  {
    const panels = fc.buildPerFileEventPanels([{ fileName: 'f.xlsx', marketEvents: mRows, yieldEvents: yRows, pricingEvents: pRows }], i18n.t);
    const { EventsSummaryTable } = await import('../src/components/EventsSummaryTable');
    host.replaceChildren();
    container = document.createElement('div'); host.appendChild(container);
    root = createRoot(container);
    await (act as any)(async () => {
      root.render(React.createElement(EventsSummaryTable as any, {
        rows: panels[0]?.rows ?? [], t: i18n.t, open: true, onToggle: noop, title: 'f.xlsx',
        testIdPrefix: 'cmp', showInitiativeColumn: true, dense: true,
      }));
    });
    const cmpSeq = [...container.querySelectorAll('[data-testid="cmp-body"] tbody tr')].map((tr: any) => tr.getAttribute('data-testid'));
    check('(g) Compare: pipeline order, one row per event, no header',
      cmpSeq.join(',') === 'cmp-row-early,cmp-row-camp-1,cmp-row-camp-2,cmp-row-solo,cmp-row-camp-3,cmp-row-y-in,cmp-row-y-out,cmp-row-p-in,cmp-row-p-out',
      cmpSeq.join(','));
    check('(g) Compare: the Initiative column names it on a member and is blank on a non-member',
      (byTestId('cmp-initiative-cell-camp-2')?.textContent || '') === L && (byTestId('cmp-initiative-cell-solo')?.textContent || '') === '',
      (byTestId('cmp-initiative-cell-camp-2')?.textContent || '') + '|' + (byTestId('cmp-initiative-cell-solo')?.textContent || ''));
    const cmpSrc = fs.readFileSync('src/components/ScenarioCompareTab.tsx', 'utf8');
    check('(g) and ScenarioCompareTab passes the column, not entries or a switch',
      cmpSrc.includes('showInitiativeColumn') && !cmpSrc.includes('entries=') && !cmpSrc.includes('onSetInitiativeEnabled'));
  }

  // ── STRUCTURE ─────────────────────────────────────────────────────────────
  {
    const strip2 = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const wi = strip2(fs.readFileSync('src/components/WhatIfTab.tsx', 'utf8'));
    const fct = strip2(fs.readFileSync('src/utils/forecasting.ts', 'utf8'));
    const count = (t: string, n: string) => t.split(n).length - 1;
    check('(X) initiativeGroups is defined once', count(fct, 'export function initiativeGroups(') === 1 && count(wi, 'function initiativeGroups') === 0);
    check('(X) campaignToggleState and handleSetEventEnabled are each defined once',
      count(wi, 'const campaignToggleState = useCallback(') === 1 && count(wi, 'const handleSetEventEnabled = useCallback(') === 1);
    check('(X) the carry sits at all THREE campaign saves', count(wi, 'carryInitiative(') === 3, String(count(wi, 'carryInitiative(')));
  }

  report();
}

main().catch(e => { console.error('initiatives spec CRASHED —', e); process.exit(1); });
