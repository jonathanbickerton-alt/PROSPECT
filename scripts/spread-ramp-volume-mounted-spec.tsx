/**
 * REQ-D6-05 SPREAD vs RAMP — THE VOLUME CARD, THROUGH THE APP.
 *
 *   npm run spec:spread-ramp-volume
 *
 * The real WhatIfTab renders over the TWO-LEAF STORE (churn-hold-mounted's
 * harness, copied rather than re-invented), and the form is filled in Jon's
 * order: mode → amount → duration → values → Hold LAST.
 *
 * WHY THE TWO-LEAF STORE AND NOT hold-mounted's harness. That host's
 * `addMarketEvent` is a no-op, so a duration-1 draft — REQ-D6-05 clause 10's
 * "duration 1 is today's single event" — would emit nothing there and the
 * single-event route could not be asserted at all. This host records it.
 *
 * Cases (a)–(h) are the brief's, with discriminator sub-cases for the traps
 * that would otherwise stay green: (a2) for 227, (e-order)/(e-last) for 228,
 * and the typed-into-the-derived-total check in (b) for 230.
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
  console.log(`\nspread-ramp-volume spec: ${pass} passed, ${fails.length} failed`);
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
    console.log(`\nspread-ramp-volume spec: UNREACHABLE — fixture missing at ${FIX}`);
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
  const HELD_TAIL = Array.from({ length: 21 }, () => 3000);

  // ── (a) SPREAD, Even, 3,000 over 3 → 1,000 × 3, THREE rows ──────────────
  let rowsA: any[] = [];
  {
    await mount();
    await freshInflow('SpreadA');
    // 1. mode
    await click(byTestId('volume-mode-spread'));
    check('(a) Spread is selected', byTestId('volume-mode-spread')?.getAttribute('aria-pressed') === 'true');
    // 2. amount
    await type(byTestId('volume-amount'), '3000');
    // 3. duration
    await type(byTestId('volume-duration'), '3');
    // 4. values — Even
    await click(byTestId('volume-dist-even'));
    // 5. Hold LAST — and in Spread there is no Hold to press (clause 2).
    check('(a) CLAUSE 2: no Hold checkbox is rendered in Spread mode', !byTestId('volume-hold-toggle'));
    check('(a) CLAUSE 12: the label is "split across 3 months"',
      norm(byTestId('volume-amount-label')?.textContent || '') === i18n.t('whatif_amount_label_spread', { p0: 3 }),
      norm(byTestId('volume-amount-label')?.textContent || ''));
    check('(a) CLAUSE 10: the row preview is in view before Add',
      !!byTestId('volume-row-0') && !!byTestId('volume-row-2') && !byTestId('volume-row-3'));
    check('(a) the button reports 3 rows',
      /3/.test(byTestId('volume-add')?.textContent || ''), norm(byTestId('volume-add')?.textContent || ''));
    await click(byTestId('volume-add'));
    rowsA = captured.slice();
    check('(a) THREE rows, not the ramp and not 24', captured.length === 3, String(captured.length));
    check('(a) 1,000 / 1,000 / 1,000 — the TOTAL split, literal', vols().join(',') === '1000,1000,1000', vols().join(','));
    check('(a) every row states mode Spread', captured.every((e: any) => e.mode === 'spread'));
    check('(a) no row carries Hold', captured.every((e: any) => !e.hold));
  }

  // ── (a0) Duration 1 IS today's single event (clause 10) ─────────────────
  {
    await mount();
    await freshInflow('');
    await click(byTestId('volume-mode-spread'));
    await type(byTestId('volume-amount'), '500');
    // duration left at 1 — the default, read rather than assumed
    check('(a0) the duration defaults to 1', byTestId('volume-duration')?.value === '1', byTestId('volume-duration')?.value);
    await click(byTestId('volume-add'));
    check('(a0) duration 1 takes the single-event route: exactly one row, via addMarketEvent',
      captured.length === 1 && captured[0]?.id === 'single', `${captured.length} ${captured[0]?.id}`);
  }

  // ── (a2) Hold set in Ramp does NOT survive into Spread (clause 2) ───────
  //
  // THE DISCRIMINATOR FOR TRAP 227. Hold cannot be pressed in Spread, so the
  // only way a Spread campaign could carry it is a Hold left on from Ramp.
  {
    await mount();
    await freshInflow('SpreadA2');
    await click(byTestId('volume-mode-ramp'));
    await type(byTestId('volume-amount'), '3000');
    await type(byTestId('volume-duration'), '3');
    await click(byTestId('volume-hold-toggle'));
    check('(a2) Hold is on while in Ramp', byTestId('volume-hold-toggle')?.checked === true);
    // Back to Spread — mode is the first control, re-chosen.
    await click(byTestId('volume-mode-spread'));
    await click(byTestId('volume-dist-even'));
    await click(byTestId('volume-add'));
    check('(a2) Spread emits THREE rows, not a held 24', captured.length === 3, String(captured.length));
    check('(a2) and none of them carries Hold', captured.every((e: any) => !e.hold),
      captured.filter((e: any) => e.hold).length + ' held');
  }

  // ── (b) SPREAD, Custom values 500 / 1,500 / 1,000 → those rows ──────────
  let rowsB: any[] = [];
  {
    await mount();
    await freshInflow('ValuesB');
    // 1. mode
    await click(byTestId('volume-mode-spread'));
    // 2. amount — NOT typed: with Custom values the total is derived (clause 8).
    // 3. duration
    await type(byTestId('volume-duration'), '3');
    // 4. values
    await click(byTestId('volume-dist-values'));
    await type(byTestId('volume-spread-value-0'), '500');
    await type(byTestId('volume-spread-value-1'), '1500');
    await type(byTestId('volume-spread-value-2'), '1000');
    // 5. Hold LAST — absent in Spread.
    const box = byTestId('volume-amount');
    check('(b) CLAUSE 8: the total box reads the SUM, 3,000', box?.value === '3000', box?.value);
    check('(b) CLAUSE 8: and it is read-only while Custom values is on', box?.readOnly === true);
    // THE DISCRIMINATOR FOR TRAP 230: typing into it changes nothing.
    await type(box, '9999');
    check('(b) typing 9,999 into the derived total leaves it at 3,000', byTestId('volume-amount')?.value === '3000',
      byTestId('volume-amount')?.value);
    await click(byTestId('volume-add'));
    rowsB = captured.slice();
    check('(b) THREE rows', captured.length === 3, String(captured.length));
    check('(b) 500 / 1,500 / 1,000 — the typed values, literal', vols().join(',') === '500,1500,1000', vols().join(','));
    check('(b) every row states mode Spread', captured.every((e: any) => e.mode === 'spread'));

    // REOPEN — brief 1.4: Spread reopens with the SUM and its distribution.
    const pill = pillFor('ValuesB', 3);
    check('(b) the campaign pill is reachable', !!pill);
    if (pill) {
      await click(pill);
      check('(b) REOPEN: Spread', byTestId('volume-mode-spread')?.getAttribute('aria-pressed') === 'true');
      check('(b) REOPEN: the amount is the SUM, 3,000', byTestId('volume-amount')?.value === '3000', byTestId('volume-amount')?.value);
      // 500/1500/1000 is neither an even split nor integer shares of 3,000 that
      // re-spread exactly (17/50/33 → 510/1500/990), so the rule says VALUES.
      check('(b) REOPEN: the distribution is Custom values (the stated rule)',
        !!byTestId('volume-spread-value-0'), 'no value boxes');
      check('(b) REOPEN: and the values are the rows',
        ['0', '1', '2'].map(i => byTestId(`volume-spread-value-${i}`)?.value).join(',') === '500,1500,1000',
        ['0', '1', '2'].map(i => byTestId(`volume-spread-value-${i}`)?.value).join(','));
    }
  }

  // ── (c) RAMP, typed 1,000 / 2,000 / 3,000, no Hold → 3 rows ─────────────
  let rowsC: any[] = [];
  {
    await mount();
    await freshInflow('RampC');
    // 1. mode
    await click(byTestId('volume-mode-ramp'));
    // 2. amount — the TARGET
    await type(byTestId('volume-amount'), '3000');
    // 3. duration
    await type(byTestId('volume-duration'), '3');
    check('(c) CLAUSE 11: the duration re-prefilled the ramp Even',
      ['0', '1', '2'].map(i => byTestId(`volume-ramp-value-${i}`)?.value).join(',') === '1000,2000,3000',
      ['0', '1', '2'].map(i => byTestId(`volume-ramp-value-${i}`)?.value).join(','));
    // 4. values — typed, as the user types them
    await type(byTestId('volume-ramp-value-0'), '1000');
    await type(byTestId('volume-ramp-value-1'), '2000');
    await type(byTestId('volume-ramp-value-2'), '3000');
    // 5. Hold LAST — present in Ramp, and left OFF.
    check('(c) CLAUSE 2: Hold is rendered in Ramp', !!byTestId('volume-hold-toggle'));
    check('(c) and is OFF', byTestId('volume-hold-toggle')?.checked === false);
    check('(c) CLAUSE 12: "reached at month 3", no ", then held"',
      norm(byTestId('volume-amount-label')?.textContent || '') === i18n.t('whatif_amount_label_ramp', { p0: 3 }),
      norm(byTestId('volume-amount-label')?.textContent || ''));
    await click(byTestId('volume-add'));
    rowsC = captured.slice();
    check('(c) THREE rows', captured.length === 3, String(captured.length));
    check('(c) 1,000 / 2,000 / 3,000 — literal', vols().join(',') === '1000,2000,3000', vols().join(','));
    check('(c) every row states mode Ramp, unheld',
      captured.every((e: any) => e.mode === 'ramp' && !e.hold));

    const pill = pillFor('RampC', 3);
    check('(c) the campaign pill is reachable', !!pill);
    if (pill) {
      await click(pill);
      check('(c) REOPEN: Ramp', byTestId('volume-mode-ramp')?.getAttribute('aria-pressed') === 'true');
      check('(c) REOPEN: the target is 3,000 — the LAST row, not the 6,000 sum',
        byTestId('volume-amount')?.value === '3000', byTestId('volume-amount')?.value);
      check('(c) REOPEN: duration 3', byTestId('volume-duration')?.value === '3', byTestId('volume-duration')?.value);
      check('(c) REOPEN: the typed values are ALL the rows (unheld)',
        ['0', '1', '2'].map(i => byTestId(`volume-ramp-value-${i}`)?.value).join(',') === '1000,2000,3000',
        ['0', '1', '2'].map(i => byTestId(`volume-ramp-value-${i}`)?.value).join(','));
      check('(c) REOPEN: Hold off', byTestId('volume-hold-toggle')?.checked === false);
    }
  }

  // ── (d) RAMP, Even 3,000 over 3 + Hold → 1,000/2,000/3,000 then 3,000 ───
  let rowsD: any[] = [];
  {
    await mount();
    await freshInflow('RampD');
    // 1. mode
    await click(byTestId('volume-mode-ramp'));
    // 2. amount
    await type(byTestId('volume-amount'), '3000');
    // 3. duration
    await type(byTestId('volume-duration'), '3');
    // 4. values — the Even prefill, accepted as is
    // 5. Hold LAST
    await click(byTestId('volume-hold-toggle'));
    check('(d) CLAUSE 12: ", then held" joins the label with Hold on',
      norm(byTestId('volume-amount-label')?.textContent || '')
        === norm(i18n.t('whatif_amount_label_ramp', { p0: 3 }) + i18n.t('whatif_amount_label_then_held')),
      norm(byTestId('volume-amount-label')?.textContent || ''));
    check('(d) CLAUSE 10: the held-tail line is in view before Add', !!byTestId('volume-hold-tail'));
    await click(byTestId('volume-add'));
    rowsD = captured.slice();
    // THE REQ-D6-03 HELD LITERAL: 3,000 over 3 = 1,000 / 2,000 / 3,000, and
    // every month from the fourth to the 24th holds 3,000.
    check('(d) 24 rows — 3 ramp + 21 held', captured.length === 24, String(captured.length));
    check('(d) 1,000 / 2,000 / 3,000 then 3,000 × 21 — literal',
      vols().join(',') === ['1000', '2000', '3000', ...HELD_TAIL].join(','), vols().slice(0, 5).join(','));
    check('(d) every row states Ramp and carries Hold',
      captured.every((e: any) => e.mode === 'ramp' && e.hold === true));
  }

  // ── (e) RAMP typed 1,000 / 3,000 / 2,000 → Add BLOCKED, reason in the DOM ─
  {
    const reason = i18n.t('whatif_ramp_block_order');
    const drive = async (a: string, b: string, c: string) => {
      await mount();
      await freshInflow('RampE');
      await click(byTestId('volume-mode-ramp'));
      await type(byTestId('volume-amount'), '3000');
      await type(byTestId('volume-duration'), '3');
      await type(byTestId('volume-ramp-value-0'), a);
      await type(byTestId('volume-ramp-value-1'), b);
      await type(byTestId('volume-ramp-value-2'), c);
    };
    // The brief's case: both halves of the rule are broken at once.
    await drive('1000', '3000', '2000');
    check('(e) CLAUSE 11: the reason is rendered as TEXT',
      norm(byTestId('volume-ramp-block-reason')?.textContent || '') === reason,
      norm(byTestId('volume-ramp-block-reason')?.textContent || '') || 'no reason');
    check('(e) and Add is disabled', byTestId('volume-add')?.disabled === true);
    await click(byTestId('volume-add'));
    check('(e) and a click emits nothing', captured.length === 0, String(captured.length));

    // THE DISCRIMINATOR FOR TRAP 228 — ORDER alone broken, last month = target.
    await drive('2000', '1000', '3000');
    check('(e-order) 2,000 / 1,000 / 3,000 is blocked on ORDER alone',
      byTestId('volume-add')?.disabled === true && !!byTestId('volume-ramp-block-reason'));
    // ...and LAST alone broken, order fine.
    await drive('1000', '2000', '2500');
    check('(e-last) 1,000 / 2,000 / 2,500 under a 3,000 target is blocked on the LAST month alone',
      byTestId('volume-add')?.disabled === true && !!byTestId('volume-ramp-block-reason'));
    // ...and a legal ramp is NOT blocked — the rule is not "always blocked".
    await drive('1000', '2000', '3000');
    check('(e-ok) 1,000 / 2,000 / 3,000 is NOT blocked',
      byTestId('volume-add')?.disabled === false && !byTestId('volume-ramp-block-reason'));
  }

  // ── (f) % 10 → the mode is locked to Ramp; Spread is not selectable ─────
  {
    await mount();
    await freshInflow('PctF');
    // The amount UNIT is part of the amount step; choosing % is what locks the mode.
    const pctArm = btnByText(i18n.t('whatif_amount_unit_pct'));
    check('(f) the % arm is reachable', !!pctArm);
    if (pctArm) await click(pctArm);
    await type(byTestId('volume-amount'), '10');
    const spreadBtn = byTestId('volume-mode-spread');
    check('(f) CLAUSE 9: Spread is aria-disabled', spreadBtn?.getAttribute('aria-disabled') === 'true');
    check('(f) CLAUSE 9: and disabled', spreadBtn?.disabled === true);
    check('(f) CLAUSE 9: Ramp is the mode', byTestId('volume-mode-ramp')?.getAttribute('aria-pressed') === 'true');
    if (spreadBtn) await click(spreadBtn);
    check('(f) a click on Spread changes nothing — still Ramp',
      byTestId('volume-mode-ramp')?.getAttribute('aria-pressed') === 'true'
        && spreadBtn?.getAttribute('aria-pressed') === 'false');
    check('(f) the lock says why, in the DOM', !!byTestId('volume-mode-locked'));
    // RE-AIMED at REQ-D6-05 clause 15 (2026-09-11): the percentage label now carries the
    // Ramp suffix, and this draft is at the default duration of 1 — so it reads
    // "— one month". A HAND-WRITTEN literal, not the key read back, so a wrong key fails.
    check('(f) CLAUSE 15: the percentage label at duration 1 reads "Change to Inflow — one month"',
      norm(byTestId('volume-amount-label')?.textContent || '') === 'Change to Inflow — one month',
      norm(byTestId('volume-amount-label')?.textContent || ''));
  }

  // ── (f2) REQ-D6-05 clause 15 — the % label carries the Ramp suffix ───────
  //
  // FILL-IN ORDER: the amount (the % unit, then 10) → duration → Hold LAST, and the
  // label read after each. Every expected label is a HAND-WRITTEN English literal.
  {
    const lbl = () => norm(byTestId('volume-amount-label')?.textContent || '');
    await mount();
    await freshInflow('PctLabel3');
    const pctArm = btnByText(i18n.t('whatif_amount_unit_pct'));
    check('(f2) the % arm is reachable', !!pctArm);
    if (pctArm) await click(pctArm);
    await type(byTestId('volume-amount'), '10');
    await type(byTestId('volume-duration'), '3');
    check('(f2) CLAUSE 15: % 10 over 3 reads "Change to Inflow — reached at month 3"',
      lbl() === 'Change to Inflow — reached at month 3', lbl());
    // Guarded: with a % draft wrongly let into Spread (trap 229) the Hold box is absent,
    // and an unguarded click threw — killing the spec before its FAIL lines printed.
    const holdBox = byTestId('volume-hold-toggle');
    check('(f2) the Hold box is on the % draft (it is always a Ramp)', !!holdBox);
    if (holdBox) await click(holdBox);
    check('(f2) CLAUSE 15: Hold on adds ", then held"',
      lbl() === 'Change to Inflow — reached at month 3, then held', lbl());
  }
  {
    const lbl = () => norm(byTestId('volume-amount-label')?.textContent || '');
    await mount();
    await freshInflow('PctLabel1');
    const pctArm = btnByText(i18n.t('whatif_amount_unit_pct'));
    if (pctArm) await click(pctArm);
    await type(byTestId('volume-amount'), '10');
    await type(byTestId('volume-duration'), '1');
    check('(f2) CLAUSE 15: duration 1 reads "Change to Inflow — one month"',
      lbl() === 'Change to Inflow — one month', lbl());
  }

  // ── (g) ROUND TRIP of (b), (c), (d) through the REAL writer and reader ──
  {
    const trip = (rows: any[]) => rows.map((e: any) => fc.marketEventExportRow(e));
    const back = (sheet: any[]) => sheet.map((r: any) => fc.marketEventFromRow(r, 'session'));
    for (const [tag, rows, mode, held] of [
      ['b', rowsB, 'spread', false], ['c', rowsC, 'ramp', false], ['d', rowsD, 'ramp', true],
    ] as const) {
      const sheet = trip(rows as any[]);
      const keys = Object.keys(sheet[0] ?? {});
      check(`(g-${tag}) Mode is the LAST column written`, keys[keys.length - 1] === 'Mode', keys[keys.length - 1]);
      check(`(g-${tag}) Mode is written as ${mode === 'ramp' ? 'Ramp' : 'Spread'} on every row`,
        sheet.every((r: any) => r.Mode === (mode === 'ramp' ? 'Ramp' : 'Spread')));
      const rt = back(sheet);
      check(`(g-${tag}) the mode reads back as ${mode}`, rt.every((e: any) => e.mode === mode),
        rt.map((e: any) => e.mode).slice(0, 3).join(','));
      check(`(g-${tag}) Hold reads back as ${held}`, rt.every((e: any) => e.hold === held));
      check(`(g-${tag}) the figures survive`,
        rt.map((e: any) => Math.abs(e.subscriberVolume)).join(',') === (rows as any[]).map((e: any) => Math.abs(e.subscriberVolume)).join(','));
    }
  }

  // ── (h) AN OLD-FORMAT SAVE — no Mode column — by the absent rule ────────
  {
    const legacy = (rows: any[]) => rows.map((e: any) => { const r = { ...fc.marketEventExportRow(e) }; delete r.Mode; return r; });
    const read = (rows: any[]) => legacy(rows).map((r: any) => fc.marketEventFromRow(r, 'session'));
    check('(h) an unheld old campaign reads as Spread', read(rowsB).every((e: any) => e.mode === 'spread'));
    check('(h) a held old campaign reads as Ramp', read(rowsD).every((e: any) => e.mode === 'ramp'));
    // THE STATED LOSS: before the column existed there was no unheld ramp, so an
    // unheld row with no Mode is a Spread by definition. The rule is right for
    // every save that can exist; this pins that it says so.
    check('(h) an unheld row with no Mode is Spread even if it was built as a ramp',
      read(rowsC).every((e: any) => e.mode === 'spread'));
    check('(h) THE ONE READER: {} → spread', fc.modeFromRow({}) === 'spread');
    check("(h) THE ONE READER: { Hold: 'Yes' } → ramp", fc.modeFromRow({ Hold: 'Yes' }) === 'ramp');
    check("(h) THE ONE READER: a stated Mode wins over Hold", fc.modeFromRow({ Mode: 'Ramp', Hold: 'No' }) === 'ramp'
      && fc.modeFromRow({ Mode: 'Spread', Hold: 'Yes' }) === 'spread');
  }

  report();
}

main().catch(e => { console.log('\nspread-ramp-volume spec: CRASHED — ' + (e?.stack || e)); process.exit(1); });
