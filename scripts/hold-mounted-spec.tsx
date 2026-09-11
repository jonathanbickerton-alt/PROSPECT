/**
 * REQ-D6-03 — RAMP THEN HOLD, THROUGH THE APP.
 *
 *   npm run spec:hold-mounted
 *
 * `spec:hold-shape` pins the arithmetic. This pins that the CARD is wired to
 * it: the real WhatIfTab renders, the real hold toggle is CLICKED, the real
 * Add button is CLICKED, and what lands in `marketEvents` is what the engine
 * is then asked to forecast.
 *
 * WHY A SECOND FILE AND NOT MORE OF THE FIRST. The shape spec is pure and
 * runs in milliseconds; this one mounts JSDOM and builds a base forecast. More
 * importantly they can fail for opposite reasons — a correct generator that
 * nothing calls, and a wired card whose arithmetic is wrong — and a single
 * file reporting one figure would not say which.
 *
 * WHAT IT IS CAREFUL ABOUT:
 *
 *  - THE TOGGLES ARE CLICKED, never set. A mount that assigned component state
 *    would prove the generator and nothing about the button, which is the half
 *    that was added this session.
 *  - THE DIFFERENTIAL IS RUN IN BOTH DIRECTIONS. Case (c) adds the SAME draft
 *    with hold off and asserts the old three rows, so a change that made hold
 *    unconditional would fail here even though every hold assertion passed.
 *  - EXPECTED FIGURES ARE HAND-COMPUTED AND STATED BEFORE THE ASSERTION, with
 *    the arithmetic shown, so a wrong-but-plausible engine result cannot be
 *    read back as the expectation.
 *  - IT PINS COUNTS. Every case says how many rows it exercised.
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

function report() {
  console.log(`\nhold-mounted spec: ${pass} passed, ${fails.length} failed`);
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
    console.log(`\nhold-mounted spec: UNREACHABLE — fixture missing at ${FIX}`);
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
  // TWENTY-FOUR MONTHS, not the twelve the other mounts use. Case (a) reads a
  // month "12+ months out" and case (b) needs a tail long enough to beat 3x
  // the terminating spread — neither question exists inside a 12-month
  // horizon, so the horizon is part of the fixture here rather than a default.
  const HORIZON = 24;
  const baseForecast = fc.calculateBaseForecast(seriesArr,
    { segment: SEG, product: 'All', productL2: 'All', channel: 'All', channelL2: 'All',
      tariffL1: 'All', tariffL2: 'All', scenario: 'Base Case' },
    10000, HORIZON, 1.0, 1.5, 3, 'Holt Linear');

  const MONTHS: string[] = baseForecast.months.map((m: any) => m.month);
  check('harness: the base forecast spans 24 months',
    MONTHS.length === HORIZON, `${MONTHS.length}`);
  if (MONTHS.length !== HORIZON) { report(); return; }

  // ── A STATEFUL HOST, because the draft and the event list are App's ──────
  //
  // The other mounts pass `newEvent: {}` and `setMarketEvents: noop`, which is
  // enough to render a card and useless for watching one emit. This wrapper is
  // the smallest thing that makes the Add path observable: the same two props,
  // held in React state, so a click round-trips exactly as it does in App.
  let captured: any[] = [];
  let draftSetter: ((d: any) => void) | null = null;

  const Host: React.FC<any> = ({ Card, props }) => {
    const [newEvent, setNewEvent] = (React as any).useState({
      scenario: 'Inflow', segment: 'All', product: 'All', productL2: 'All',
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
    wiInflowVal: 'Inflow', wiRetentionVal: 'Retention',
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
    forecastStore: new Map(), setForecastStore: noop,
    resolveForecast: (k: string) => fc.resolveFromStore(new Map(), new Map(), k),
    canResolve: () => false,
    hasLegacyBaseline: !!baseForecast, updatedAt: new Date().toISOString(),
    bulkRuns: [], setBulkRuns: noop,
  }, child);

  const M: any = (await import('../src/components/WhatIfTab')).WhatIfTab;
  const host = document.getElementById('root')!;
  let container: any, root: any;

  /** A fresh mount per case — a long-lived card carrying state between cases
   *  is how a differential quietly stops being one. */
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
  const norm = (s: string) => (s || '').replace(/»/g, '').trim();
  const btnByText = (txt: string) =>
    [...container.querySelectorAll('button')].find((b: any) => norm(b.textContent || '') === txt) as any;
  const click = async (el: any) => { await (act as any)(async () => { el.click(); }); };
  /** Type into a controlled React input, the way the user does. Added at
   *  REQ-D6-05: the re-aimed cases type the duration, and this harness had
   *  no typing helper — copied from churn-hold-mounted, not re-invented. */
  const type = async (el: any, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(
      dom.window.HTMLInputElement.prototype, 'value')!.set!;
    await (act as any)(async () => {
      setter.call(el, value);
      el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
  };
  const setDraft = async (patch: any) => {
    await (act as any)(async () => { draftSetter!((d: any) => ({ ...d, ...patch })); });
  };

  // ── Case (a) — +10% Inflow, ramp 3 Even, Hold ON ─────────────────────────
  //
  // HAND-COMPUTED, before any assertion: a 10% target over a 3-month even ramp
  // is 10 x 1/3, 10 x 2/3, 10 x 3/3 = 3.3333 / 6.6667 / 10.0000, and every
  // month from the fourth to the last carries 10. The campaign starts at
  // MONTHS[0], so the horizon gives 24 rows: three ramp, twenty-one held.
  //
  // The engine reads a percentage row as a percent of the month's baseline
  // Inflow, so at any held month the adjusted Inflow is baseline x 1.10 —
  // which is the check that the number reaching the engine is a RATE and not
  // 10 subscribers.
  {
    await mount();
    // RE-AIMED at REQ-D6-05 (2026-09-11). This case clicked Hold FIRST, then
    // pressed `volume-spread-toggle` — which is retired, and Hold now renders
    // only in Ramp mode, so the old order crashed on a null Hold box. Re-driven
    // in FILL-IN ORDER: mode → amount → duration → values → Hold LAST.
    //
    // 1+2. mode and amount: a PERCENTAGE draft, which is always a Ramp (clause 9).
    await setDraft({ scenario: 'Inflow', amountType: 'percentage', percentageBasis: 'baseline',
      subscriberVolume: 10, date: MONTHS[0] });
    // RE-AIMED: this asserted "the spread control opens for a percentage draft
    // once hold is on" (REQ-D6-03 clause 7). Clause 7's coupling is superseded;
    // the claim that replaces it is that a percentage IS a ramp.
    check('(a) REQ-D6-05 clause 9: a percentage draft is a Ramp',
      byTestId('volume-mode-ramp')?.getAttribute('aria-pressed') === 'true');
    // 3. duration — this re-prefills the typed ramp Even (clause 11).
    await type(byTestId('volume-duration'), '3');
    // 4. values — the Even prefill, accepted.
    // 5. Hold LAST.
    const holdBtn = byTestId('volume-hold-toggle');
    check('(a) the hold toggle is on the Volume card', !!holdBtn);
    // CLAUSE 10 — a real checkbox, asserted on .checked which only a checkbox
    // has. A button would report undefined here.
    check('(a) CLAUSE 10: the hold control is an <input type=checkbox>',
      holdBtn?.tagName === 'INPUT' && holdBtn?.type === 'checkbox',
      `${holdBtn?.tagName}/${holdBtn?.type}`);
    if (!holdBtn) { report(); return; }
    await click(holdBtn);

    const add = byTestId('volume-add');
    check('(a) the Add button is reachable', !!add);
    if (!add) { report(); return; }
    check('(a) the button reports 24 rows, not the ramp length',
      /24/.test(add.textContent || ''), norm(add.textContent || ''));
    await click(add);

    check('(a) 24 rows emitted — 3 ramp + 21 held', captured.length === 24,
      String(captured.length));
    const vols = captured.map((e: any) => e.subscriberVolume);
    check('(a) the ramp is 3.3333 / 6.6667 / 10 — a RATE, never rounded to 3/7/10',
      near(vols[0], 10 / 3) && near(vols[1], 20 / 3) && vols[2] === 10,
      vols.slice(0, 3).map((v: number) => v.toFixed(4)).join(' / '));
    check('(a) every later month holds exactly 10',
      vols.slice(3).every((v: number) => v === 10), String(vols[23]));
    check('(a) the months are consecutive from the start month',
      captured[0]?.date === MONTHS[0] && captured[23]?.date === MONTHS[23],
      `${captured[0]?.date}..${captured[23]?.date}`);
    check('(a) every row carries Hold', captured.every((e: any) => e.hold === true));

    // THROUGH THE ENGINE. Month index 15 is 15 months out — comfortably past
    // the "12+ months" the case asks for and deep inside the held tail.
    const run = (await import('../src/components/WhatIfTab')).computeAdjustedForecast({
      baseForecast, marketEvents: captured, yieldEvents: [], pricingEvents: [],
      viewSegment: 'All', viewProduct: ALLV, viewChannel: ALLV, viewTariff: ALLV,
      data: [], wiSegmentCol: '', wiProductCol: '', wiProductL2Col: '',
      wiChannelCol: '', wiChannelL2Col: '', wiTariffL1Col: '', wiTariffL2Col: '',
      wiValueCol: '',
    } as any);
    const at = run.adjustedMonths[15];
    // THE ENGINE'S OWN PAIR, read off ONE month: `baseline` is the untouched
    // forecast for that month and `uplifted` is the same month after events.
    // Deriving the baseline separately — from `baseForecast.months[15]` and
    // its band — would be a second derivation of the very number under test.
    check('(a) at month 16 the adjusted Inflow is baseline x 1.10',
      near(at.uplifted.inflow, at.baseline.inflow * 1.10, 1e-9),
      `${at.uplifted.inflow} vs ${at.baseline.inflow * 1.10}`);
    check('(a) and the baseline it is measured against is real, not zero',
      at.baseline.inflow > 0, String(at.baseline.inflow));
  }

  // ── Case (b) — 300 Retention absolute, ramp 3, Hold ON ───────────────────
  //
  // HAND-COMPUTED, before any assertion:
  //   rows            100 / 200 / 300, then 300 in each of months 4..24
  //   total emitted   100 + 200 + 300 x 22 = 6,900
  //   Base is driven by OUTFLOW, and a linked Retention event removes its
  //   volume from Outflow. Base carries a T+1 lag, so the base delta at the
  //   LAST month is the sum of every row STRICTLY BEFORE it:
  //     100 + 200 + 300 x 21 = 6,600
  //   The no-hold comparison is the same draft as a terminating spread:
  //   100 / 100 / 100, whose base delta at the last month is its whole total,
  //   300. Three times that is 900, and 6,600 > 900 by a factor of 7.3.
  //
  // The strict inequality is what the case asks for; the exact 6,600 is
  // asserted as well, because an inequality alone would pass on a tail that
  // was merely long rather than correct.
  let noHoldBaseDelta = 0;
  {
    await mount();
    // RE-AIMED at REQ-D6-05: fill-in order, and the retired switch replaced by
    // the mode control. 1. mode
    await click(byTestId('volume-mode-ramp'));
    // 2. amount
    await setDraft({ scenario: 'Retention', amountType: 'absolute',
      subscriberVolume: 300, date: MONTHS[0], retentionLinked: true });
    // 3. duration — re-prefills 100 / 200 / 300. 4. values — accepted.
    await type(byTestId('volume-duration'), '3');
    // 5. Hold LAST.
    await click(byTestId('volume-hold-toggle'));
    await click(byTestId('volume-add'));

    check('(b) 24 rows emitted', captured.length === 24, String(captured.length));
    const vols = captured.map((e: any) => e.subscriberVolume);
    check('(b) the ramp is 100 / 200 / 300', vols.slice(0, 3).join(',') === '100,200,300',
      vols.slice(0, 3).join(','));
    check('(b) every later month holds 300',
      vols.slice(3).every((v: number) => v === 300), String(vols[23]));
    check('(b) the emitted total is 6,900',
      vols.reduce((s: number, v: number) => s + v, 0) === 6900,
      String(vols.reduce((s: number, v: number) => s + v, 0)));

    const run = (await import('../src/components/WhatIfTab')).computeAdjustedForecast({
      baseForecast, marketEvents: captured, yieldEvents: [], pricingEvents: [],
      viewSegment: 'All', viewProduct: ALLV, viewChannel: ALLV, viewTariff: ALLV,
      data: [], wiSegmentCol: '', wiProductCol: '', wiProductL2Col: '',
      wiChannelCol: '', wiChannelL2Col: '', wiTariffL1Col: '', wiTariffL2Col: '',
      wiValueCol: '',
    } as any);
    // THE CARD'S OWN QUANTITY, not a reimplementation of it. WhatIfTab:5349
    // computes the Base Volume Delta as exactly this subtraction over the last
    // month, so this reads the same two fields the screen reads.
    const baseDeltaAt = (r: any, i: number) =>
      r.adjustedMonths[i].adjustedBaseVolume - r.adjustedMonths[i].baselineBaseVolume;
    const heldDelta = baseDeltaAt(run, HORIZON - 1);
    check('(b) the base delta at the last month is 6,600 as hand-computed',
      near(heldDelta, 6600, 1e-6), String(heldDelta));

    // The same draft, hold OFF, for the comparison the case names.
    // RE-AIMED at REQ-D6-05: "hold OFF" of the same 300 is now a SPREAD, which
    // is what it always meant — a terminating split, 100 / 100 / 100.
    await mount();
    await click(byTestId('volume-mode-spread'));
    await setDraft({ scenario: 'Retention', amountType: 'absolute',
      subscriberVolume: 300, date: MONTHS[0], retentionLinked: true });
    await type(byTestId('volume-duration'), '3');
    await click(byTestId('volume-dist-even'));
    await click(byTestId('volume-add'));
    const run2 = (await import('../src/components/WhatIfTab')).computeAdjustedForecast({
      baseForecast, marketEvents: captured, yieldEvents: [], pricingEvents: [],
      viewSegment: 'All', viewProduct: ALLV, viewChannel: ALLV, viewTariff: ALLV,
      data: [], wiSegmentCol: '', wiProductCol: '', wiProductL2Col: '',
      wiChannelCol: '', wiChannelL2Col: '', wiTariffL1Col: '', wiTariffL2Col: '',
      wiValueCol: '',
    } as any);
    noHoldBaseDelta = baseDeltaAt(run2, HORIZON - 1);
    check('(b) the no-hold base delta at the last month is 300',
      near(noHoldBaseDelta, 300, 1e-6), String(noHoldBaseDelta));
    check('(b) held is STRICTLY GREATER than 3x the no-hold figure',
      heldDelta > 3 * noHoldBaseDelta,
      `${heldDelta} vs ${3 * noHoldBaseDelta}`);
  }

  // ── Case (c) — the differential: the SAME draft with hold OFF ────────────
  //
  // Decision 3, exercised through the card rather than through the generator.
  // The expected list is the one `spec:hold-shape` records as a hand-written
  // literal: 300 over 3 even is 100 / 100 / 100, and there is no fourth row.
  {
    await mount();
    // RE-AIMED at REQ-D6-05: the retired switch becomes Spread mode, in
    // fill-in order. The expected rows are unchanged — clause 14 says Spread
    // emits exactly the Hold-OFF rows.
    await click(byTestId('volume-mode-spread'));
    await setDraft({ scenario: 'Retention', amountType: 'absolute',
      subscriberVolume: 300, date: MONTHS[0], retentionLinked: true });
    await type(byTestId('volume-duration'), '3');
    await click(byTestId('volume-dist-even'));
    const add = byTestId('volume-add');
    check('(c) with hold off the button still reports 3',
      /3/.test(add.textContent || ''), norm(add.textContent || ''));
    await click(add);
    check('(c) EXACTLY 3 rows, then nothing', captured.length === 3, String(captured.length));
    check('(c) 100 / 100 / 100',
      captured.map((e: any) => e.subscriberVolume).join(',') === '100,100,100',
      captured.map((e: any) => e.subscriberVolume).join(','));
    check('(c) no row carries Hold', captured.every((e: any) => !e.hold));
  }

  // ── Case (d) — the round trip, and an old save ───────────────────────────
  {
    await mount();
    // RE-AIMED at REQ-D6-05: fill-in order; a percentage draft is a Ramp.
    await setDraft({ scenario: 'Inflow', amountType: 'percentage', percentageBasis: 'baseline',
      subscriberVolume: 10, date: MONTHS[0], campaignName: 'Ramp' });
    await type(byTestId('volume-duration'), '3');
    // Hold LAST.
    await click(byTestId('volume-hold-toggle'));
    await click(byTestId('volume-add'));
    const emitted = captured.slice();
    check('(d) 24 rows to round-trip', emitted.length === 24, String(emitted.length));

    // Out through the REAL export and back through the REAL reader.
    const sheet = emitted.map((e: any) => fc.marketEventExportRow(e));
    const back = sheet.map((r: any) => fc.marketEventFromRow(r, 'session'));
    check('(d) Hold is restored on every row', back.every((e: any) => e.hold === true));
    check('(d) the figures survive', near(back[0]?.subscriberVolume, 10 / 3)
      && back[23]?.subscriberVolume === 10,
      `${back[0]?.subscriberVolume} .. ${back[23]?.subscriberVolume}`);

    const { holdPlateauStart } = await import('../src/components/WhatIfTab');
    const figs = back.map((e: any) => Math.abs(e.subscriberVolume));
    check('(d) the ramp length restores as 3',
      holdPlateauStart(figs) === 3, String(holdPlateauStart(figs)));
    check('(d) the target restores as 10 — the LAST row, not the sum',
      figs[figs.length - 1] === 10, String(figs[figs.length - 1]));

    // AN OLD SAVE. The column is deleted, not blanked: a workbook written
    // before this session has no such key at all.
    const legacy = sheet.map((r: any) => { const c = { ...r }; delete c.Hold; return c; });
    const oldBack = legacy.map((r: any) => fc.marketEventFromRow(r, 'session'));
    check('(d) an old save loads with hold OFF', oldBack.every((e: any) => e.hold === false));
    check('(d) and its rows are untouched',
      oldBack.length === emitted.length
      && oldBack.every((e: any, i: number) => e.subscriberVolume === emitted[i].subscriberVolume
        && e.date === emitted[i].date),
      `${oldBack.length}`);
  }

  report();
}

main().catch(e => { console.log('\nhold-mounted spec: CRASHED — ' + (e?.stack || e)); process.exit(1); });
