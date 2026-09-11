/**
 * REQ-D6-05 SPREAD vs RAMP, Item 2 — THE PROMOTION CARD, THROUGH THE APP.
 *
 *   npm run spec:spread-ramp-promo
 *
 * spread-ramp-volume's cases (a)–(h) on the Promotion card, over the same
 * TWO-LEAF STORE harness (copied from churn-hold-mounted, not re-invented),
 * filled in Jon's order: mode → amount → duration → values → Hold LAST.
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
  console.log(`\nspread-ramp-promo spec: ${pass} passed, ${fails.length} failed`);
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
    console.log(`\nspread-ramp-promo spec: UNREACHABLE — fixture missing at ${FIX}`);
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
  let draftSetter: ((d: any) => void) | null = null;

  const Host: React.FC<any> = ({ Card, props }) => {
    const [newEvent, setNewEvent] = (React as any).useState({
      scenario: 'Outflow', segment: SEG, product: 'All', productL2: 'All',
      channel: 'All', channelL2: 'All', tariffL1: 'All', tariffL2: 'All',
      date: MONTHS[0], subscriberVolume: 0, customerVolume: 0, revenue: 0, arpu: 0,
      name: '', campaignName: '', comment: '', contractLength: 24,
    });
    const [marketEvents, setMarketEvents] = (React as any).useState([]);
    draftSetter = setNewEvent;
    captured = marketEvents;
    return React.createElement(Card, {
      ...props, newEvent, setNewEvent, marketEvents, setMarketEvents,
      addMarketEvent: () => setMarketEvents((e: any[]) => [...e, { ...newEvent, id: 'single' }]),
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
    removeMarketEvent: noop, updateMarketEvent: noop,
    yieldEvents: [], newYieldEvent: {}, setNewYieldEvent: noop, addYieldEvent: noop,
    removeYieldEvent: noop, clearAllYieldEvents: noop,
    pricingEvents: [], newPricingEvent: {}, setNewPricingEvent: noop, addPricingEvent: noop,
    removePricingEvent: noop, clearAllPricingEvents: noop,
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
  // REQ-D6-05 Item 2 — THE PROMOTION CARD, DRIVEN.
  //
  // spread-ramp-volume's cases (a)–(h) on the third carrier, with promo-
  // testids. FILL-IN ORDER, stated at each case: mode → amount → duration →
  // values → Hold LAST. The start month is TYPED into the card's own month box
  // (the promo draft is the card's state, not the host's). Every expected row
  // list is a hand-written literal.
  // ══════════════════════════════════════════════════════════════════════════
  const btnByText = (txt: string) =>
    [...container.querySelectorAll('button')].find((b: any) => norm(b.textContent || '') === txt) as any;
  const pillFor = (name: string, n: number) => {
    const title = i18n.t('whatif_edit_campaign_event', { p0: name, p1: n, p2: n === 1 ? '' : 's' });
    return [...container.querySelectorAll('button')].find((b: any) => b.getAttribute('title') === title) as any;
  };
  const vols = () => captured.map((e: any) => Math.abs(e.subscriberVolume));
  const vals3 = (prefix: string) => ['0', '1', '2'].map(i => byTestId(`${prefix}-${i}`)?.value).join(',');
  const nameInput = () => [...container.querySelectorAll('input')]
    .find((i: any) => i.getAttribute('placeholder') === i18n.t('whatif_e_g_summer_promo_2026')) as any;
  /** Open the Promotion card on a fresh mount, pin the start month, name the campaign. */
  const openPromo = async (campaign: string) => {
    await mount();
    const tab = btnByText(i18n.t('whatif_promotion'));
    if (!tab) return false;
    await click(tab);
    const month = byTestId('promo-month');
    if (!month) return false;
    await type(month, MONTHS[0]);
    if (campaign) { const n = nameInput(); if (!n) return false; await type(n, campaign); }
    return true;
  };
  const HELD_TAIL = Array.from({ length: 21 }, () => 3000);

  // ── (a) SPREAD, Even, 3,000 over 3 → 1,000 × 3 ──────────────────────────
  let rowsB: any[] = [], rowsC: any[] = [], rowsD: any[] = [];
  {
    check('(a) the Promotion card opens', await openPromo('PSpreadA'));
    // 1. mode
    await click(byTestId('promo-mode-spread'));
    // 2. amount
    await type(byTestId('promo-volume-amount'), '3000');
    // 3. duration
    await type(byTestId('promo-duration'), '3');
    // 4. values — Even
    await click(byTestId('promo-dist-even'));
    // 5. Hold LAST — none in Spread (clause 2).
    check('(a) CLAUSE 2: no Hold checkbox in Spread mode', !byTestId('promo-hold-toggle'));
    check('(a) CLAUSE 10: the promo on-off switch is retired', !byTestId('promo-spread-toggle'));
    check('(a) CLAUSE 12: the label is "split across 3 months"',
      norm(byTestId('promo-amount-label')?.textContent || '') === i18n.t('whatif_amount_label_spread', { p0: 3 }),
      norm(byTestId('promo-amount-label')?.textContent || ''));
    check('(a) CLAUSE 10: the rows are in view before Add',
      !!byTestId('promo-row-0') && !!byTestId('promo-row-2') && !byTestId('promo-row-3'));
    await click(byTestId('promo-add'));
    check('(a) THREE rows', captured.length === 3, String(captured.length));
    check('(a) 1,000 / 1,000 / 1,000 — literal', vols().join(',') === '1000,1000,1000', vols().join(','));
    check('(a) every row is a Spread promotion, unheld',
      captured.every((e: any) => e.mode === 'spread' && !e.hold && e.isPromotion === true));
  }

  // ── (a0) duration 1 is a single promotion row ───────────────────────────
  {
    check('(a0) the Promotion card opens', await openPromo(''));
    await click(byTestId('promo-mode-spread'));
    await type(byTestId('promo-volume-amount'), '500');
    check('(a0) the duration defaults to 1', byTestId('promo-duration')?.value === '1', byTestId('promo-duration')?.value);
    await click(byTestId('promo-add'));
    check('(a0) exactly ONE row', captured.length === 1 && vols()[0] === 500, `${captured.length} ${vols()[0]}`);
  }

  // ── (b) SPREAD, Custom values 500 / 1,500 / 1,000 ───────────────────────
  {
    check('(b) the Promotion card opens', await openPromo('PValuesB'));
    // 1. mode
    await click(byTestId('promo-mode-spread'));
    // 2. amount — NOT typed: Custom values derives it (clause 8).
    // 3. duration
    await type(byTestId('promo-duration'), '3');
    // 4. values
    await click(byTestId('promo-dist-values'));
    await type(byTestId('promo-spread-value-0'), '500');
    await type(byTestId('promo-spread-value-1'), '1500');
    await type(byTestId('promo-spread-value-2'), '1000');
    // 5. Hold LAST — absent.
    const box = byTestId('promo-volume-amount');
    check('(b) CLAUSE 8: the total box reads the SUM, 3,000', box?.value === '3000', box?.value);
    check('(b) CLAUSE 8: and it is read-only', box?.readOnly === true);
    await type(box, '9999');
    check('(b) typing 9,999 into the derived total leaves it at 3,000',
      byTestId('promo-volume-amount')?.value === '3000', byTestId('promo-volume-amount')?.value);
    await click(byTestId('promo-add'));
    rowsB = captured.slice();
    check('(b) 500 / 1,500 / 1,000 — literal', vols().join(',') === '500,1500,1000', vols().join(','));
    const pill = pillFor('PValuesB', 3);
    check('(b) the Promotion card pill is reachable', !!pill);
    if (pill) {
      await click(pill);
      check('(b) REOPEN: Spread', byTestId('promo-mode-spread')?.getAttribute('aria-pressed') === 'true');
      check('(b) REOPEN: the SUM, 3,000', byTestId('promo-volume-amount')?.value === '3000', byTestId('promo-volume-amount')?.value);
      check('(b) REOPEN: Custom values, and the values are the rows',
        vals3('promo-spread-value') === '500,1500,1000', vals3('promo-spread-value'));
    }
  }

  // ── (c) RAMP, typed 1,000 / 2,000 / 3,000, no Hold ──────────────────────
  {
    check('(c) the Promotion card opens', await openPromo('PRampC'));
    await click(byTestId('promo-mode-ramp'));                 // 1. mode
    await type(byTestId('promo-volume-amount'), '3000');      // 2. amount — the TARGET
    await type(byTestId('promo-duration'), '3');              // 3. duration
    check('(c) CLAUSE 11: the duration re-prefilled Even', vals3('promo-ramp-value') === '1000,2000,3000',
      vals3('promo-ramp-value'));
    await type(byTestId('promo-ramp-value-0'), '1000');       // 4. values, typed
    await type(byTestId('promo-ramp-value-1'), '2000');
    await type(byTestId('promo-ramp-value-2'), '3000');
    check('(c) 5. Hold LAST — present in Ramp, left OFF', byTestId('promo-hold-toggle')?.checked === false);
    await click(byTestId('promo-add'));
    rowsC = captured.slice();
    check('(c) 1,000 / 2,000 / 3,000 — literal, three rows', vols().join(',') === '1000,2000,3000', vols().join(','));
    check('(c) every row a Ramp, unheld', captured.every((e: any) => e.mode === 'ramp' && !e.hold));
    const pill = pillFor('PRampC', 3);
    check('(c) the Promotion card pill is reachable', !!pill);
    if (pill) {
      await click(pill);
      check('(c) REOPEN: Ramp', byTestId('promo-mode-ramp')?.getAttribute('aria-pressed') === 'true');
      check('(c) REOPEN: target 3,000 — the last row, not the 6,000 sum',
        byTestId('promo-volume-amount')?.value === '3000', byTestId('promo-volume-amount')?.value);
      check('(c) REOPEN: duration 3, and the typed values are all the rows',
        byTestId('promo-duration')?.value === '3' && vals3('promo-ramp-value') === '1000,2000,3000',
        `${byTestId('promo-duration')?.value} ${vals3('promo-ramp-value')}`);
    }
  }

  // ── (d) RAMP, Even 3,000 over 3 + Hold → then 3,000 to the horizon ─────
  {
    check('(d) the Promotion card opens', await openPromo('PRampD'));
    await click(byTestId('promo-mode-ramp'));                 // 1. mode
    await type(byTestId('promo-volume-amount'), '3000');      // 2. amount
    await type(byTestId('promo-duration'), '3');              // 3. duration
    // 4. values — the Even prefill, accepted
    await click(byTestId('promo-hold-toggle'));               // 5. Hold LAST
    check('(d) CLAUSE 10: the held-tail line is in view before Add', !!byTestId('promo-hold-tail'));
    await click(byTestId('promo-add'));
    rowsD = captured.slice();
    check('(d) 24 rows', captured.length === 24, String(captured.length));
    check('(d) 1,000 / 2,000 / 3,000 then 3,000 × 21 — literal',
      vols().join(',') === ['1000', '2000', '3000', ...HELD_TAIL].join(','), vols().slice(0, 5).join(','));
    check('(d) every row a held Ramp', captured.every((e: any) => e.mode === 'ramp' && e.hold === true));
  }

  // ── (e) RAMP 1,000 / 3,000 / 2,000 → BLOCKED, reason in the DOM ────────
  {
    const reason = i18n.t('whatif_ramp_block_order');
    const drive = async (a: string, b: string, c: string) => {
      await openPromo('PRampE');
      await click(byTestId('promo-mode-ramp'));
      await type(byTestId('promo-volume-amount'), '3000');
      await type(byTestId('promo-duration'), '3');
      await type(byTestId('promo-ramp-value-0'), a);
      await type(byTestId('promo-ramp-value-1'), b);
      await type(byTestId('promo-ramp-value-2'), c);
    };
    await drive('1000', '3000', '2000');
    check('(e) CLAUSE 11: the reason is rendered as TEXT',
      norm(byTestId('promo-ramp-block-reason')?.textContent || '') === reason,
      norm(byTestId('promo-ramp-block-reason')?.textContent || '') || 'no reason');
    check('(e) and Add is disabled', byTestId('promo-add')?.disabled === true);
    await click(byTestId('promo-add'));
    check('(e) and a click emits nothing', captured.length === 0, String(captured.length));
    await drive('2000', '1000', '3000');
    check('(e-order) ORDER alone blocks', byTestId('promo-add')?.disabled === true);
    await drive('1000', '2000', '3000');
    check('(e-ok) a legal ramp is NOT blocked',
      byTestId('promo-add')?.disabled === false && !byTestId('promo-ramp-block-reason'));
  }

  // ── (f) % 10 → the mode is locked to Ramp ───────────────────────────────
  {
    check('(f) the Promotion card opens', await openPromo('PPctF'));
    await click(byTestId('promo-amount-pct'));                // the unit is part of the amount step
    await type(byTestId('promo-volume-amount'), '10');
    const spreadBtn = byTestId('promo-mode-spread');
    check('(f) CLAUSE 9: Spread is aria-disabled and disabled',
      spreadBtn?.getAttribute('aria-disabled') === 'true' && spreadBtn?.disabled === true);
    check('(f) CLAUSE 9: Ramp is the mode', byTestId('promo-mode-ramp')?.getAttribute('aria-pressed') === 'true');
    if (spreadBtn) await click(spreadBtn);
    check('(f) a click on Spread changes nothing', byTestId('promo-mode-ramp')?.getAttribute('aria-pressed') === 'true');
    check('(f) the lock says why, in the DOM', !!byTestId('promo-mode-locked'));
    // RE-AIMED at REQ-D6-05 clause 15 (2026-09-11): this card's own per-cent stem now
    // carries the Ramp suffix; the draft is at the default duration of 1. Literal.
    check("(f) CLAUSE 15: this card's own per-cent label at duration 1 reads \"— one month\"",
      norm(byTestId('promo-amount-label')?.textContent || '') === 'Volume change (% of the forecast) — one month',
      norm(byTestId('promo-amount-label')?.textContent || ''));
  }

  // ── (f2) REQ-D6-05 clause 15 — the promo % label carries the Ramp suffix ─
  //
  // FILL-IN ORDER: the amount (% unit, then 10) → duration → Hold LAST. Literals.
  {
    const lbl = () => norm(byTestId('promo-amount-label')?.textContent || '');
    check('(f2) the Promotion card opens', await openPromo('PPctLabel3'));
    await click(byTestId('promo-amount-pct'));
    await type(byTestId('promo-volume-amount'), '10');
    await type(byTestId('promo-duration'), '3');
    check('(f2) CLAUSE 15: % 10 over 3 reads "Volume change (% of the forecast) — reached at month 3"',
      lbl() === 'Volume change (% of the forecast) — reached at month 3', lbl());
    // Guarded: with a % draft wrongly let into Spread (trap 232) the Hold box is absent,
    // and an unguarded click threw — killing the spec before its FAIL lines printed.
    const holdBox = byTestId('promo-hold-toggle');
    check('(f2) the Hold box is on the % draft (it is always a Ramp)', !!holdBox);
    if (holdBox) await click(holdBox);
    check('(f2) CLAUSE 15: Hold on adds ", then held"',
      lbl() === 'Volume change (% of the forecast) — reached at month 3, then held', lbl());
  }
  {
    const lbl = () => norm(byTestId('promo-amount-label')?.textContent || '');
    check('(f2) the Promotion card opens again', await openPromo('PPctLabel1'));
    await click(byTestId('promo-amount-pct'));
    await type(byTestId('promo-volume-amount'), '10');
    await type(byTestId('promo-duration'), '1');
    check('(f2) CLAUSE 15: duration 1 reads "Volume change (% of the forecast) — one month"',
      lbl() === 'Volume change (% of the forecast) — one month', lbl());
  }

  // ── (r) REQ-D6-05 clause 18 — the ABSOLUTE Ramp at duration 1 ───────────
  {
    const lbl = () => norm(byTestId('promo-amount-label')?.textContent || '');
    check('(r) the Promotion card opens', await openPromo('PRampOne'));
    await click(byTestId('promo-mode-ramp'));                 // 1. mode
    await type(byTestId('promo-volume-amount'), '3000');      // 2. amount — the TARGET
    await type(byTestId('promo-duration'), '1');              // 3. duration
    check('(r) CLAUSE 18: an absolute Ramp at duration 1 reads "Target volume — one month"',
      lbl() === 'Target volume — one month', lbl());
    await type(byTestId('promo-duration'), '3');
    check('(r) CLAUSE 18: at duration 3 it still reads "Target volume — reached at month 3"',
      lbl() === 'Target volume — reached at month 3', lbl());
  }

  // ── (g) ROUND TRIP of (b), (c), (d) through the REAL writer and reader ──
  for (const [tag, rows, mode, held] of [
    ['b', rowsB, 'spread', false], ['c', rowsC, 'ramp', false], ['d', rowsD, 'ramp', true],
  ] as const) {
    const sheet = (rows as any[]).map((e: any) => fc.marketEventExportRow(e));
    const keys = Object.keys(sheet[0] ?? {});
    check(`(g-${tag}) Mode is the LAST column`, keys[keys.length - 1] === 'Mode', keys[keys.length - 1]);
    const back = sheet.map((r: any) => fc.marketEventFromRow(r, 'session'));
    check(`(g-${tag}) mode reads back as ${mode}, Hold as ${held}`,
      back.every((e: any) => e.mode === mode && e.hold === held));
    check(`(g-${tag}) the promotion flag and the figures survive`,
      back.every((e: any) => e.isPromotion === true)
        && back.map((e: any) => Math.abs(e.subscriberVolume)).join(',') === (rows as any[]).map((e: any) => Math.abs(e.subscriberVolume)).join(','));
  }

  // ── (h) OLD-FORMAT promo rows, no Mode column ───────────────────────────
  {
    const read = (rows: any[]) => rows
      .map((e: any) => { const r = { ...fc.marketEventExportRow(e) }; delete r.Mode; return r; })
      .map((r: any) => fc.marketEventFromRow(r, 'session'));
    check('(h) an unheld old promo reads as Spread', read(rowsB).every((e: any) => e.mode === 'spread'));
    check('(h) a held old promo reads as Ramp', read(rowsD).every((e: any) => e.mode === 'ramp'));
  }

  report();
}

main().catch(e => { console.log('\nspread-ramp-promo spec: CRASHED — ' + (e?.stack || e)); process.exit(1); });
