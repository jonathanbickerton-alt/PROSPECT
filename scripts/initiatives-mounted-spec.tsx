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
 * Session 2 (2026-09-17) — the controls and the bin, same order of filling:
 *  (h) the row-edit carry: a Value member's comment and a Pricing member's amount
 *      edited in their own cards — both still in the initiative;
 *  (i) Select; tick ONE row of a 3-row campaign -> all 3 ticked; Group as "New":
 *      the 3 rows and a ticked Value event carry "New";
 *  (j) Group as an EXISTING name, picked from the list: adds, no dialog;
 *  (k) a member of Launch grouped as New leaves Launch (Launch -3, New +3);
 *  (l) Ungroup on a campaign member clears the whole campaign; the Value member stays;
 *  (m) Dissolve clears every member, the event count unchanged, no header;
 *  (n) Rename to an unused name renames every member under one header; Rename onto
 *      a used name asks "Merge into…": cancel leaves two headers, confirm one;
 *  (o) the bin: the dialog names the initiative and its count; the preview runs on
 *      all THREE arrays; confirm removes the Market, Value AND Pricing members and
 *      nothing else, the Value and Pricing ones one call per member; the Value
 *      card's own bin still removes its row.
 *
 * Clause 17 (Jon, 2026-09-17, Walk I5) — names match case-insensitively, the
 * existing casing wins:
 *  (p) Rename "Q4 test" -> "  launch TEST " asks to merge into 'Launch test';
 *      Cancel writes nothing; Merge leaves every member reading 'Launch test';
 *  (q) Group as "launch test" adds to 'Launch test', no prompt, exact casing;
 *  (r) a save holding 'Launch test' AND 'launch test' renders ONE header with the
 *      combined count, and its switch moves every row of both casings.
 *
 * Clause 18 (Jon, 2026-09-17, Walk J) — a casing-only rename re-cases:
 *  (s) Rename 'Launch test' -> 'LAUNCH TEST': no prompt, every member re-cased,
 *      one header 'LAUNCH TEST', the member count unchanged;
 *  (t) Rename 'Q4 test' -> 'launch TEST' still prompts "Merge into 'LAUNCH TEST'?"
 *      and merges into it — so the branch is self vs other, not case.
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
  /** Session 2: every per-row remover call, so "once per member" is counted, not inferred. */
  let removeCalls: { yield: string[]; pricing: string[] } = { yield: [], pricing: [] };
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
    // Session 2 (h): the Value and Pricing DRAFTS are real state, so an edit in the
    // card reaches its save the way it does in App.
    const [newYieldEvent, setNewYieldEvent] = (React as any).useState({});
    const [newPricingEvent, setNewPricingEvent] = (React as any).useState({});
    draftSetter = setNewEvent;
    captured = marketEvents; capturedYield = yieldEvents; capturedPricing = pricingEvents;
    return React.createElement(Card, {
      ...props, newEvent, setNewEvent, marketEvents, setMarketEvents,
      addMarketEvent: () => setMarketEvents((e: any[]) => [...e, { ...newEvent, id: 'single' }]),
      updateMarketEvent: byId(setMarketEvents),
      yieldEvents, updateYieldEvent: byId(setYieldEvents),
      removeYieldEvent: (id: string) => { removeCalls.yield.push(id); setYieldEvents((p: any[]) => p.filter((e: any) => e.id !== id)); },
      pricingEvents, updatePricingEvent: byId(setPricingEvents),
      removePricingEvent: (id: string) => { removeCalls.pricing.push(id); setPricingEvents((p: any[]) => p.filter((e: any) => e.id !== id)); },
      newYieldEvent, setNewYieldEvent, newPricingEvent, setNewPricingEvent,
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

  // ══ SESSION 2 — THE CONTROLS AND THE BIN ══════════════════════════════════

  // ── (h) THE ROW-EDIT CARRY, mounted ───────────────────────────────────────
  initial = { market: mBack, yield: yBack, pricing: pBack };
  await mount();
  {
    const saveChanges = () => btnByText(i18n.t('whatif_save_changes'));
    await click(byTestId('whatif-tab-value'));
    const yEdit = byTestId('yield-edit-y-in');
    check('(h) the Value member has its edit control', !!yEdit);
    if (yEdit) await click(yEdit);
    const comment = [...container.querySelectorAll('input[type="text"]')]
      .find((el: any) => el.getAttribute('placeholder') === i18n.t('whatif_describe_this_mix_change_e_g_promo_pushing_hi')) as any;
    check('(h) the Value card comment field is present', !!comment);
    if (comment) await type(comment, 'edited in the card');
    const ySave = saveChanges();
    check('(h) the Value Save changes button is enabled', !!ySave && !ySave.disabled, ySave ? String(ySave.disabled) : 'absent');
    if (ySave) await click(ySave);
    const yIn = capturedYield.find((e: any) => e.id === 'y-in');
    check('(h) the Value edit SAVED (the comment changed)', yIn?.comment === 'edited in the card', String(yIn?.comment));
    check('(h) and the Value member is STILL in the initiative', yIn?.initiative === L, String(yIn?.initiative));

    await click(byTestId('whatif-tab-pricing'));
    const pRow = [...container.querySelectorAll('tr')]
      .find((tr: any) => !tr.closest('[data-testid="events-summary-body"]') && (tr.textContent || '').includes('PriceIn')
        && [...tr.querySelectorAll('button')].some((b: any) => b.getAttribute('title') === i18n.t('whatif_edit_event'))) as any;
    const pEdit = pRow ? [...pRow.querySelectorAll('button')].find((b: any) => b.getAttribute('title') === i18n.t('whatif_edit_event')) as any : null;
    check('(h) the Pricing member has its edit control', !!pEdit);
    if (pEdit) await click(pEdit);
    const amount = [...container.querySelectorAll('input[type="number"]')]
      .find((el: any) => el.getAttribute('placeholder') === i18n.t('whatif_5_or_10')) as any;
    check('(h) the Pricing amount field is present, reopened on 5', amount?.value === '5', amount?.value);
    if (amount) await type(amount, '7');
    const pSave = saveChanges();
    check('(h) the Pricing Save changes button is enabled', !!pSave && !pSave.disabled, pSave ? String(pSave.disabled) : 'absent');
    if (pSave) await click(pSave);
    const pIn = capturedPricing.find((e: any) => e.id === 'p-in');
    check('(h) the Pricing edit SAVED (the amount changed)', pIn?.amount === 7, String(pIn?.amount));
    check('(h) and the Pricing member is STILL in the initiative', pIn?.initiative === L, String(pIn?.initiative));
  }

  // ── THE CONTROLS FIXTURE: Launch as before, plus CampB (3 rows, no initiative) ──
  const FIX2_MARKET = [...FIX_MARKET,
    vol('campb-1', 'CampB', MONTHS[5], undefined, 6), vol('campb-2', 'CampB', MONTHS[6], undefined, 7),
    vol('campb-3', 'CampB', MONTHS[7], undefined, 8)];
  initial = { market: FIX2_MARKET, yield: FIX_YIELD, pricing: FIX_PRICING };
  await mount();
  await openSummary();
  const TOTAL = FIX2_MARKET.length + FIX_YIELD.length + FIX_PRICING.length;   // 12
  const allRows = () => [...captured, ...capturedYield, ...capturedPricing];
  const initOf = (id: string) => allRows().find((e: any) => e.id === id)?.initiative || '-';
  const hdrCount = (name: string) => (byTestId(`events-summary-initiative-count-${name}`)?.textContent || '').trim();
  const countText = (n: number) => i18n.t('whatif_summary_count', { count: n });
  const headerNames = () => [...container.querySelectorAll('[data-testid="events-summary-body"] tbody tr')]
    .map((tr: any) => String(tr.getAttribute('data-testid')))
    .filter((id: string) => id.startsWith('events-summary-initiative-'))
    .map((id: string) => id.replace('events-summary-initiative-', ''));
  const tick = (id: string) => byTestId(`events-summary-tick-${id}`);
  const enterSelect = async () => { const b = byTestId('events-summary-select'); if (b) await click(b); };
  const change = async (el: any, value: string) => {
    await (act as any)(async () => {
      el.value = value;
      el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
  };

  // ── (i) A CAMPAIGN TICKS WHOLE; Group as a NEW name ───────────────────────
  check('(i) no selection mode until Select is pressed', !tick('campb-2') && !byTestId('events-summary-selection-bar'));
  await enterSelect();
  check('(i) Select shows the bar and a tick per event row', !!byTestId('events-summary-selection-bar') && !!tick('campb-2') && !!tick('y-out'));
  check('(i) a header row has no tick',
    !byTestId('events-summary-initiative-Launch')?.querySelector('input[type="checkbox"]'));
  if (tick('campb-2')) await click(tick('campb-2'));
  check('(i) ticking ONE campaign row ticks all THREE',
    ['campb-1', 'campb-2', 'campb-3'].every(id => tick(id)?.checked === true),
    ['campb-1', 'campb-2', 'campb-3'].map(id => String(tick(id)?.checked)).join(','));
  check('(i) and nothing else is ticked', ['camp-1', 'early', 'solo', 'y-out', 'p-out'].every(id => tick(id)?.checked === false));
  if (tick('y-out')) await click(tick('y-out'));
  check('(i) the bar says 4 selected', (byTestId('events-summary-selected-count')?.textContent || '').trim() === i18n.t('whatif_summary_selected', { n: 4 }),
    byTestId('events-summary-selected-count')?.textContent);
  if (byTestId('events-summary-group-name')) await type(byTestId('events-summary-group-name'), '  New ');
  if (byTestId('events-summary-group-as')) await click(byTestId('events-summary-group-as'));
  check('(i) Group as "New": the 3 campaign rows and the Value event carry "New" (trimmed)',
    ['campb-1', 'campb-2', 'campb-3', 'y-out'].every(id => initOf(id) === 'New'),
    ['campb-1', 'campb-2', 'campb-3', 'y-out'].map(initOf).join(','));
  check('(i) nothing else moved', ['camp-1', 'camp-2', 'camp-3', 'y-in', 'p-in'].every(id => initOf(id) === L)
    && ['early', 'solo', 'p-out'].every(id => initOf(id) === '-'));
  check('(i) a "New" header saying 4 events', hdrCount('New') === countText(4), hdrCount('New'));
  check('(i) the selection mode closed', !byTestId('events-summary-selection-bar') && !tick('campb-2'));

  // ── (j) Group as an EXISTING name: adds, no prompt ────────────────────────
  await enterSelect();
  if (tick('p-out')) await click(tick('p-out'));
  const pick = byTestId('events-summary-group-pick');
  check('(j) the pick-list offers the existing names',
    !!pick && [...pick.querySelectorAll('option')].map((o: any) => o.value).filter(Boolean).join(',') === 'Launch,New',
    pick ? [...pick.querySelectorAll('option')].map((o: any) => o.value).join(',') : 'absent');
  if (pick) await change(pick, 'New');
  check('(j) picking fills the name', byTestId('events-summary-group-name')?.value === 'New', byTestId('events-summary-group-name')?.value);
  if (byTestId('events-summary-group-as')) await click(byTestId('events-summary-group-as'));
  check('(j) no merge dialog', !byTestId('events-summary-merge-dialog'));
  check('(j) the Pricing event joined New: 5 events', initOf('p-out') === 'New' && hdrCount('New') === countText(5), initOf('p-out') + ' ' + hdrCount('New'));

  // ── (k) A MEMBER OF Launch GROUPED AS New MOVES ───────────────────────────
  await enterSelect();
  if (tick('camp-1')) await click(tick('camp-1'));
  if (byTestId('events-summary-group-name')) await type(byTestId('events-summary-group-name'), 'New');
  if (byTestId('events-summary-group-as')) await click(byTestId('events-summary-group-as'));
  check('(k) CampA moved WHOLE to New', ['camp-1', 'camp-2', 'camp-3'].every(id => initOf(id) === 'New'),
    ['camp-1', 'camp-2', 'camp-3'].map(initOf).join(','));
  check('(k) Launch 5 -> 2', hdrCount(L) === countText(2), hdrCount(L));
  check('(k) New 5 -> 8', hdrCount('New') === countText(8), hdrCount('New'));

  // ── (l) UNGROUP ON A CAMPAIGN MEMBER ──────────────────────────────────────
  const ung = byTestId('events-summary-ungroup-campb-3');
  check('(l) a member row carries Ungroup', !!ung);
  check('(l) a row in no initiative carries none', !byTestId('events-summary-ungroup-early'));
  if (ung) await click(ung);
  check('(l) Ungroup on ONE campaign row clears the WHOLE campaign',
    ['campb-1', 'campb-2', 'campb-3'].every(id => initOf(id) === '-'),
    ['campb-1', 'campb-2', 'campb-3'].map(initOf).join(','));
  check('(l) the Value member stays in New', initOf('y-out') === 'New');
  check('(l) New 8 -> 5', hdrCount('New') === countText(5), hdrCount('New'));

  // ── (m) DISSOLVE ──────────────────────────────────────────────────────────
  const diss = byTestId('events-summary-initiative-dissolve-Launch');
  check('(m) the Launch header carries Dissolve', !!diss);
  if (diss) await click(diss);
  check('(m) no dialog for Dissolve', !byTestId('event-change-title') && !byTestId('events-summary-merge-dialog'));
  check('(m) every Launch member is cleared', ['y-in', 'p-in'].every(id => initOf(id) === '-'), ['y-in', 'p-in'].map(initOf).join(','));
  check('(m) the event count is unchanged (12), rows otherwise untouched',
    allRows().length === TOTAL && capturedYield.find((e: any) => e.id === 'y-in')?.name === 'YieldIn', String(allRows().length));
  check('(m) the Launch header is gone', !headerNames().includes(L), headerNames().join(','));

  // ── (n) RENAME ────────────────────────────────────────────────────────────
  const rename = async (from: string, to: string) => {
    const b = byTestId(`events-summary-initiative-rename-${from}`);
    if (b) await click(b);
    const inp = byTestId(`events-summary-initiative-rename-input-${from}`);
    if (inp) await type(inp, to);
    const sv = byTestId(`events-summary-initiative-rename-save-${from}`);
    if (sv) await click(sv);
    return !!b && !!inp && !!sv;
  };
  const newMembers = allRows().filter((e: any) => e.initiative === 'New').map((e: any) => e.id).sort();
  check('(n) Rename reaches its input and save', await rename('New', '  Big '));
  check('(n) an UNUSED name renames with no prompt', !byTestId('events-summary-merge-dialog'));
  check('(n) EVERY member renamed',
    allRows().filter((e: any) => e.initiative === 'Big').map((e: any) => e.id).sort().join(',') === newMembers.join(',') && newMembers.length === 5,
    allRows().filter((e: any) => e.initiative === 'Big').map((e: any) => e.id).join(','));
  check('(n) ONE header, Big', headerNames().join(',') === 'Big', headerNames().join(','));
  await enterSelect();
  if (tick('early')) await click(tick('early'));
  if (byTestId('events-summary-group-name')) await type(byTestId('events-summary-group-name'), 'Other');
  if (byTestId('events-summary-group-as')) await click(byTestId('events-summary-group-as'));
  check('(n) a second initiative, Other', headerNames().includes('Other') && initOf('early') === 'Other', headerNames().join(','));
  await rename('Other', 'Big');
  const mt = (byTestId('events-summary-merge-title')?.textContent || '').trim();
  check('(n) renaming onto a USED name asks first',
    mt === i18n.t('whatif_initiative_merge_title', { name: 'Big', n: 1 }) && mt === "Merge into 'Big'? 1 events will join it", mt);
  check('(n) nothing is written while it asks', initOf('early') === 'Other');
  if (byTestId('events-summary-merge-cancel')) await click(byTestId('events-summary-merge-cancel'));
  check('(n) CANCEL leaves both: two headers', headerNames().sort().join(',') === 'Big,Other' && initOf('early') === 'Other', headerNames().join(','));
  await rename('Other', 'Big');
  if (byTestId('events-summary-merge-confirm')) await click(byTestId('events-summary-merge-confirm'));
  check('(n) CONFIRM merges: one header, Big, with the sum (6)',
    headerNames().join(',') === 'Big' && hdrCount('Big') === countText(6) && initOf('early') === 'Big',
    headerNames().join(',') + ' ' + hdrCount('Big'));
  check('(n) and no event was added or lost', allRows().length === TOTAL, String(allRows().length));

  // ── (o) THE INITIATIVE BIN ────────────────────────────────────────────────
  initial = { market: FIX2_MARKET, yield: FIX_YIELD, pricing: FIX_PRICING };
  await mount();
  await openSummary();
  removeCalls = { yield: [], pricing: [] };
  const bin = byTestId(`events-summary-initiative-delete-${L}`);
  check('(o) the Launch header carries the bin', !!bin);
  if (bin) await click(bin);
  const title = (byTestId('event-change-title')?.textContent || '').trim();
  check('(o) the dialog names the initiative and its count',
    title === i18n.t('whatif_delete_initiative_title', { name: L, n: 5 }) && title.includes("'Launch'") && title.includes('5'), title);
  check('(o) nothing is removed before confirm', allRows().length === TOTAL, String(allRows().length));
  // THE PREVIEW RUNS ON ALL THREE ARRAYS. The dialog's four figures are VOLUMES,
  // which Value and Pricing events do not move — so a Market-only preview would
  // show the same digits. The discriminator is therefore the engine call itself.
  {
    const wiSrc = fs.readFileSync('src/components/WhatIfTab.tsx', 'utf8');
    const i = wiSrc.indexOf('const after = computeAdjustedForecast(');
    const call = i < 0 ? '' : wiSrc.slice(i, wiSrc.indexOf(');', i));
    check('(o) the preview varies all THREE arrays — market, yield and pricing from the pending change',
      call.includes('marketEvents: pendingChange.nextEvents') && call.includes('yieldEvents: pendingChange.nextYield ?? yieldEvents')
        && call.includes('pricingEvents: pendingChange.nextPricing ?? pricingEvents'), call.replace(/\s+/g, ' '));
  }
  const confirm = byTestId('event-change-confirm');
  check('(o) the confirm button is present', !!confirm);
  if (confirm) await click(confirm);
  const ids = (xs: any[]) => xs.map((e: any) => e.id).sort().join(',');
  check('(o) confirm removed the THREE Market members and nothing else',
    ids(captured) === 'campb-1,campb-2,campb-3,early,solo', ids(captured));
  check('(o) confirm removed the VALUE member and nothing else', ids(capturedYield) === 'y-out', ids(capturedYield));
  check('(o) confirm removed the PRICING member and nothing else', ids(capturedPricing) === 'p-out', ids(capturedPricing));
  check('(o) through the per-row removers, ONCE per member',
    removeCalls.yield.join(',') === 'y-in' && removeCalls.pricing.join(',') === 'p-in',
    JSON.stringify(removeCalls));
  check('(o) the dialog closed, no Launch header', !byTestId('event-change-title') && !headerNames().includes(L));
  // The Value card's own bin is unchanged: the sibling of its edit control.
  await click(byTestId('whatif-tab-value'));
  const yOutEdit = byTestId('yield-edit-y-out');
  const yBin = yOutEdit?.nextElementSibling as any;
  check('(o) the Value card still has its own row bin', !!yBin && yBin.tagName === 'BUTTON');
  if (yBin) await click(yBin);
  check("(o) and it still removes its row, through its own remover", capturedYield.length === 0 && removeCalls.yield.join(',') === 'y-in,y-out',
    ids(capturedYield) + ' ' + JSON.stringify(removeCalls.yield));

  // ══ CLAUSE 17 — CASE-INSENSITIVE NAMES, THE EXISTING CASING WINS ══════════
  {
    const LT = 'Launch test', Q4 = 'Q4 test';
    initial = {
      market: [vol('lt-1', 'LtCamp', MONTHS[1], LT, 1), vol('loose', 'Loose', MONTHS[2], undefined, 2)],
      yield: [yld('q4-y', 'Q4Yield', MONTHS[1], Q4)],
      pricing: [prc('q4-p', 'Q4Price', MONTHS[1], Q4)],
    };
    await mount();
    await openSummary();
    const initOf17 = (id: string) => [...captured, ...capturedYield, ...capturedPricing].find((e: any) => e.id === id)?.initiative ?? '-';
    const hdrNames17 = () => [...container.querySelectorAll('[data-testid="events-summary-body"] tbody tr')]
      .map((tr: any) => String(tr.getAttribute('data-testid')))
      .filter((id: string) => id.startsWith('events-summary-initiative-'))
      .map((id: string) => id.replace('events-summary-initiative-', ''));
    const count17 = (name: string) => (byTestId(`events-summary-initiative-count-${name}`)?.textContent || '').trim();
    const rename17 = async (from: string, to: string) => {
      const b = byTestId(`events-summary-initiative-rename-${from}`); if (b) await click(b);
      const inp = byTestId(`events-summary-initiative-rename-input-${from}`); if (inp) await type(inp, to);
      const sv = byTestId(`events-summary-initiative-rename-save-${from}`); if (sv) await click(sv);
      return !!b && !!inp && !!sv;
    };

    // ── (p) RENAME ONTO A NAME THAT DIFFERS ONLY IN CASE ──
    check('(p) two headers to start: Launch test, Q4 test', hdrNames17().join(',') === 'Launch test,Q4 test', hdrNames17().join(','));
    check('(p) Rename reaches its controls', await rename17(Q4, '  launch TEST '));
    const mt17 = (byTestId('events-summary-merge-title')?.textContent || '').trim();
    check("(p) it PROMPTS, naming the EXISTING casing: Merge into 'Launch test'? 2 events will join it",
      mt17 === "Merge into 'Launch test'? 2 events will join it", mt17 || '(no prompt)');
    check('(p) nothing written while it asks', initOf17('q4-y') === Q4 && initOf17('q4-p') === Q4,
      initOf17('q4-y') + ',' + initOf17('q4-p'));
    if (byTestId('events-summary-merge-cancel')) await click(byTestId('events-summary-merge-cancel'));
    check('(p) CANCEL writes nothing: both names, both headers',
      initOf17('q4-y') === Q4 && initOf17('q4-p') === Q4 && initOf17('lt-1') === LT && hdrNames17().join(',') === 'Launch test,Q4 test',
      [initOf17('lt-1'), initOf17('q4-y'), initOf17('q4-p')].join(',') + ' | ' + hdrNames17().join(','));
    await rename17(Q4, '  launch TEST ');
    if (byTestId('events-summary-merge-confirm')) await click(byTestId('events-summary-merge-confirm'));
    check("(p) MERGE: every member reads 'Launch test' EXACTLY",
      ['lt-1', 'q4-y', 'q4-p'].every(id => initOf17(id) === LT), ['lt-1', 'q4-y', 'q4-p'].map(initOf17).join(','));
    check("(p) one header, 'Launch test', 3 events",
      hdrNames17().join(',') === LT && count17(LT) === i18n.t('whatif_summary_count', { count: 3 }), hdrNames17().join(',') + ' ' + count17(LT));

    // ── (q) GROUP AS A NAME THAT DIFFERS ONLY IN CASE ──
    const sel = byTestId('events-summary-select'); if (sel) await click(sel);
    const tk = byTestId('events-summary-tick-loose'); if (tk) await click(tk);
    if (byTestId('events-summary-group-name')) await type(byTestId('events-summary-group-name'), 'launch test');
    if (byTestId('events-summary-group-as')) await click(byTestId('events-summary-group-as'));
    check('(q) no prompt', !byTestId('events-summary-merge-dialog'));
    check("(q) the row reads 'Launch test' — the existing casing, not the typed one", initOf17('loose') === LT, initOf17('loose'));
    check("(q) it ADDED: one header, 'Launch test', 4 events",
      hdrNames17().join(',') === LT && count17(LT) === i18n.t('whatif_summary_count', { count: 4 }), hdrNames17().join(',') + ' ' + count17(LT));

    // ── (r) A SAVE ALREADY HOLDING BOTH CASINGS ──
    initial = {
      market: [vol('mc-1', 'CaseA', MONTHS[1], LT, 1), vol('mc-2', 'CaseB', MONTHS[2], 'launch test', 2),
        vol('mc-free', 'Free', MONTHS[3], undefined, 3)],
      yield: [yld('mc-y', 'CaseY', MONTHS[1], 'launch test')],
      pricing: [],
    };
    await mount();
    await openSummary();
    check("(r) ONE header, under the first-seen casing 'Launch test'", hdrNames17().join(',') === LT, hdrNames17().join(','));
    check('(r) with the combined count (3)', count17(LT) === i18n.t('whatif_summary_count', { count: 3 }), count17(LT));
    const sw17 = byTestId(`event-on-initiative-${LT}`);
    check('(r) the header switch reads ALL ON', sw17?.getAttribute('aria-checked') === 'true', sw17?.getAttribute('aria-checked'));
    if (sw17) await click(sw17);
    const stateOf = (id: string) => String([...captured, ...capturedYield].find((e: any) => e.id === id)?.enabled);
    check('(r) OFF moved EVERY row of BOTH casings, across carriers',
      ['mc-1', 'mc-2', 'mc-y'].every(id => stateOf(id) === 'false'), ['mc-1', 'mc-2', 'mc-y'].map(stateOf).join(','));
    check('(r) and not the row in no initiative', stateOf('mc-free') !== 'false', stateOf('mc-free'));
  }

  // ══ CLAUSE 18 — A CASING-ONLY RENAME RE-CASES ═════════════════════════════
  {
    initial = {
      market: [vol('rc-1', 'RcCamp', MONTHS[1], 'Launch test', 1), vol('rc-2', 'RcSolo', MONTHS[2], 'Launch test', 2)],
      yield: [yld('rc-q4', 'RcQ4', MONTHS[1], 'Q4 test')],
      pricing: [],
    };
    await mount();
    await openSummary();
    const initOf18 = (id: string) => [...captured, ...capturedYield].find((e: any) => e.id === id)?.initiative ?? '-';
    const hdr18 = () => [...container.querySelectorAll('[data-testid="events-summary-body"] tbody tr')]
      .map((tr: any) => String(tr.getAttribute('data-testid')))
      .filter((id: string) => id.startsWith('events-summary-initiative-'))
      .map((id: string) => id.replace('events-summary-initiative-', ''));
    const cnt18 = (name: string) => (byTestId(`events-summary-initiative-count-${name}`)?.textContent || '').trim();
    const rename18 = async (from: string, to: string) => {
      const b = byTestId(`events-summary-initiative-rename-${from}`); if (b) await click(b);
      const inp = byTestId(`events-summary-initiative-rename-input-${from}`); if (inp) await type(inp, to);
      const sv = byTestId(`events-summary-initiative-rename-save-${from}`); if (sv) await click(sv);
      return !!b && !!inp && !!sv;
    };
    check('(s) start: Launch test (2), Q4 test (1)',
      hdr18().join(',') === 'Launch test,Q4 test' && cnt18('Launch test') === i18n.t('whatif_summary_count', { count: 2 }),
      hdr18().join(',') + ' ' + cnt18('Launch test'));

    // ── (s) RENAME AN INITIATIVE TO ITS OWN NAME IN ANOTHER CASING ──
    check('(s) Rename reaches its controls', await rename18('Launch test', 'LAUNCH TEST'));
    check('(s) no prompt', !byTestId('events-summary-merge-dialog'));
    check("(s) every member reads 'LAUNCH TEST' exactly",
      initOf18('rc-1') === 'LAUNCH TEST' && initOf18('rc-2') === 'LAUNCH TEST', initOf18('rc-1') + ',' + initOf18('rc-2'));
    check("(s) one header 'LAUNCH TEST', the old casing gone, Q4 test untouched",
      hdr18().join(',') === 'LAUNCH TEST,Q4 test' && initOf18('rc-q4') === 'Q4 test', hdr18().join(','));
    check('(s) the member count unchanged (2)', cnt18('LAUNCH TEST') === i18n.t('whatif_summary_count', { count: 2 }), cnt18('LAUNCH TEST'));

    // ── (t) A DIFFERENT INITIATIVE, SAME KEY: STILL A MERGE ──
    await rename18('Q4 test', 'launch TEST');
    const mt18 = (byTestId('events-summary-merge-title')?.textContent || '').trim();
    check("(t) renaming ANOTHER initiative onto it still prompts: Merge into 'LAUNCH TEST'? 1 events will join it",
      mt18 === "Merge into 'LAUNCH TEST'? 1 events will join it", mt18 || '(no prompt)');
    check('(t) nothing written while it asks', initOf18('rc-q4') === 'Q4 test', initOf18('rc-q4'));
    if (byTestId('events-summary-merge-confirm')) await click(byTestId('events-summary-merge-confirm'));
    check("(t) the merge writes the existing casing 'LAUNCH TEST'", initOf18('rc-q4') === 'LAUNCH TEST', initOf18('rc-q4'));
    check("(t) one header 'LAUNCH TEST' with 3", hdr18().join(',') === 'LAUNCH TEST' && cnt18('LAUNCH TEST') === i18n.t('whatif_summary_count', { count: 3 }),
      hdr18().join(',') + ' ' + cnt18('LAUNCH TEST'));
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
    // Session 2. ONE writer of `initiative`: the setter, defined once; the table
    // holds no writer of its own, and the campaign unit is one helper.
    const tbl = strip2(fs.readFileSync('src/components/EventsSummaryTable.tsx', 'utf8'));
    check('(X) handleSetInitiative is defined ONCE', count(wi, 'const handleSetInitiative = useCallback(') === 1);
    check('(X) the only writes of { initiative } are the setter\'s three carrier calls',
      count(wi, '{ initiative }') === 3, String(count(wi, '{ initiative }')));
    check('(X) campaignUnit is defined once, and the table reads it for the tick and Ungroup (2 calls)',
      count(fct, 'export function campaignUnit(') === 1 && count(tbl, 'campaignUnit(rows, r)') === 2, String(count(tbl, 'campaignUnit(rows, r)')));
    check('(X) the table never writes events itself',
      !/update(Market|Yield|Pricing)Event|remove(Yield|Pricing)Event|setMarketEvents/.test(tbl));
    check('(X) the bin: setPendingChange staged at 7 sites, handleDeleteCampaign callers still 3',
      count(wi, 'setPendingChange({') === 7 && count(wi, 'handleDeleteCampaign(') === 3,
      `${count(wi, 'setPendingChange({')} / ${count(wi, 'handleDeleteCampaign(')}`);
    check('(X) the confirm removes Value and Pricing members through the per-row removers, no whole-array setter',
      wi.includes('binned?.yieldIds.forEach(id => removeYieldEvent(id));') && wi.includes('binned?.pricingIds.forEach(id => removePricingEvent(id));')
        && !/setYieldEvents|setPricingEvents/.test(wi));
    // Clause 17. ONE comparison of names: initiativeKey, defined once in
    // forecasting.ts, read by the layout's grouping key (2) and by the table's one
    // resolver (2), which Group as and Rename both call.
    check('(X) initiativeKey is defined ONCE, in forecasting.ts, and nowhere else',
      count(fct, 'export function initiativeKey(') === 1 && count(tbl, 'function initiativeKey') === 0 && count(wi, 'initiativeKey') === 0);
    check('(X) the layout keys on it', count(fct, 'initiativeKey(r.initiative)') === 2, String(count(fct, 'initiativeKey(r.initiative)')));
    check('(X) the table resolves through it once, and Group as and Rename both call that resolver',
      count(tbl, 'initiativeKey(') === 2 && count(tbl, 'const existingInitiative = (') === 1 && count(tbl, 'existingInitiative(') === 2
        && tbl.includes('onSetInitiative(pickedRows, existingInitiative(name) ?? name)') && tbl.includes('const into = existingInitiative(to);'),
      `${count(tbl, 'initiativeKey(')} / ${count(tbl, 'existingInitiative(')}`);
    check('(X) no exact name comparison survives in the table', !tbl.includes('initiativeNames.includes('));
    check('(X) computeAdjustedForecast stays 6', count(wi, 'computeAdjustedForecast(') === 6, String(count(wi, 'computeAdjustedForecast(')));
  }

  report();
}

main().catch(e => { console.error('initiatives spec CRASHED —', e); process.exit(1); });
