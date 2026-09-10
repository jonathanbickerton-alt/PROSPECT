/**
 * REQ-D6-03 session 3 — PROMOTION HOLD, THROUGH THE APP.
 *
 *   npm run spec:promo-hold-mounted
 *
 * The third carrier, driven the way the other two are: the real WhatIfTab
 * renders, the Promotion card is opened by CLICK, the amount mode and the ramp
 * and hold toggles are CLICKED, the figures are TYPED, and what lands in
 * `marketEvents` is what the engine is then asked to forecast.
 *
 * THE LOAD-BEARING CHECK IS THE HOLD-OFF DIFFERENTIAL. This session retired
 * `buildPromoEvents`'s own `pct / total` in favour of the shared
 * `spreadShape`, and decision 3 says that path is byte-identical. A spec that
 * asserted the new code against itself would pass whatever it happened to do,
 * so the hold-off expectations here are HAND-WRITTEN LITERALS computed from
 * the c11151e promo arithmetic and recorded with their derivation.
 *
 * ONE ROW PER MONTH, NOT TWO. The brief says "2 rows per month"; the card
 * emits ONE MarketEvent per month, carrying the volume, the mix, the pricing
 * arm and the ARPU together on that single row. Asserted explicitly below so
 * the discrepancy is measured rather than argued.
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
const near = (a: number, b: number, eps = 1e-9) =>
  Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));

function report() {
  console.log(`\npromo-hold-mounted spec: ${pass} passed, ${fails.length} failed`);
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
    console.log(`\npromo-hold-mounted spec: UNREACHABLE — fixture missing at ${FIX}`);
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
  const baseForecast = fc.calculateBaseForecast(seriesArr,
    { segment: SEG, product: 'All', productL2: 'All', channel: 'All', channelL2: 'All',
      tariffL1: 'All', tariffL2: 'All', scenario: 'Base Case' },
    1_000_000, HORIZON, 1.0, 1.5, 3, 'Holt Linear');
  const MONTHS: string[] = baseForecast.months.map((m: any) => m.month);
  check('harness: the base forecast spans 24 months', MONTHS.length === HORIZON, `${MONTHS.length}`);
  if (MONTHS.length !== HORIZON) { report(); return; }

  let captured: any[] = [];
  let promoSetter: ((d: any) => void) | null = null;

  const Host: React.FC<any> = ({ Card, props }) => {
    const [newEvent, setNewEvent] = (React as any).useState({
      scenario: 'Inflow', segment: 'All', product: 'All', productL2: 'All',
      channel: 'All', channelL2: 'All', tariffL1: 'All', tariffL2: 'All',
      date: MONTHS[0], subscriberVolume: 0, customerVolume: 0, revenue: 0, arpu: 0,
      name: '', campaignName: '', comment: '', contractLength: 24,
    });
    const [marketEvents, setMarketEvents] = (React as any).useState([]);
    captured = marketEvents;
    return React.createElement(Card, {
      ...props, newEvent, setNewEvent, marketEvents, setMarketEvents,
      addMarketEvent: noop,
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
    forecastStore: new Map(), setForecastStore: noop,
    resolveForecast: (k: string) => fc.resolveFromStore(new Map(), new Map(), k),
    canResolve: () => false,
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
  const norm = (s: string) => (s || '').replace(/»/g, '').trim();
  const btnByText = (txt: string) =>
    [...container.querySelectorAll('button')].find((b: any) => norm(b.textContent || '') === txt) as any;
  const click = async (el: any) => { await (act as any)(async () => { el.click(); }); };
  const type = async (el: any, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(
      dom.window.HTMLInputElement.prototype, 'value')!.set!;
    await (act as any)(async () => {
      setter.call(el, value);
      el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
  };

  /** Open the Promotion card and put a draft on it. */
  const openPromo = async () => {
    const tab = btnByText('Promotion');
    check('mount: the Promotion card is reachable', !!tab);
    if (!tab) return false;
    await click(tab);
    // THE START MONTH IS SET, not assumed.  defaults to the
    // CURRENT calendar month, which is not the forecast's first month — the
    // first run of this file expected 24 rows and got 22, from a campaign
    // starting two months in. Typing it makes the horizon deterministic.
    const monthInput = byTestId('promo-month');
    check('mount: the promo month input is reachable', !!monthInput);
    if (!monthInput) return false;
    await type(monthInput, MONTHS[0]);
    return true;
  };

  const rampMonthsInput = () =>
    [...container.querySelectorAll('input[type=number]')]
      .find((i: any) => i.getAttribute('max') === '24' && i.getAttribute('min') === '2') as any;

  // ── Case 1 — +10% Inflow, ramp 3, Hold ON ────────────────────────────────
  //
  // HAND-COMPUTED before any assertion: a 10% target over a 3-month even ramp
  // is 10 x 1/3, 10 x 2/3, 10 x 3/3 = 3.3333 / 6.6667 / 10.0000, and every
  // month from the fourth to the last carries 10. The campaign starts at
  // MONTHS[0], so the horizon gives 24 rows: three ramp, twenty-one held.
  {
    await mount();
    if (!(await openPromo())) { report(); return; }

    const hold = byTestId('promo-hold-toggle');
    check('(1) the hold toggle is on the Promotion card', !!hold);
    if (!hold) { report(); return; }
    check('(1) it is OFF before it is clicked', hold.getAttribute('aria-pressed') === 'false');

    // ── HOLD IS CLICKED LAST, AND THAT ORDER IS THE TEST ──────────────────
    //
    // This file drove amount -> HOLD -> ramp, and passed at 24 rows while the
    // app emitted 3. The order was the whole difference: `promoSpreadEnabled`
    // WAS in the Add handler's dependency list and `promoHold` was NOT, so
    // touching the ramp switch after the toggle rebuilt the callback and
    // hid the stale closure. Jon drove amount -> ramp -> HOLD, which is the
    // order a form is actually filled in, and nothing rebuilt it.
    //
    // So the drive below is Jon's, deliberately, and it is the LAST control
    // touched that matters. A harness that passes what the card passes can
    // still lie if it does not press the buttons in the order a person does.
    await click(byTestId('promo-amount-pct'));
    await type(byTestId('promo-volume-amount'), '10');

    const rampBtn = btnByText(i18n.t('whatif_ramp_volume_over_multiple_months'));
    check('(1) the ramp control is reachable', !!rampBtn);
    if (!rampBtn) { report(); return; }
    await click(rampBtn);
    const mi = rampMonthsInput();
    check('(1) the ramp duration input is reachable', !!mi);
    if (mi) await type(mi, '3');

    await click(hold);
    check('(1) and ON after', byTestId('promo-hold-toggle').getAttribute('aria-pressed') === 'true');

    // ── NOT A RADIO GROUP: BOTH STAY ON ───────────────────────────────────
    //
    // The two controls render as round dots side by side and READ as a radio
    // pair on screen. They are not one: both are `<button type="button">`
    // with independent togglers, and REQ-D6-03 clause 4 says the ramp and the
    // hold are independent — ramp PLUS hold is the feature, not a choice
    // between them. Asserted three ways, because "the toggle is still lit" is
    // a weaker claim than "the ramp section is still on screen".
    const rampStillOn = btnByText(i18n.t('whatif_ramp_volume_over_multiple_months'));
    check('(1) EXCLUSIVITY: the ramp control is still present after Hold',
      !!rampStillOn);
    check('(1) EXCLUSIVITY: the ramp DURATION input is still in the DOM',
      !!rampMonthsInput(), 'the ramp panel would be gone if the two were exclusive');
    check('(1) EXCLUSIVITY: the ramp months value survived the Hold click',
      Number(rampMonthsInput()?.value) === 3, String(rampMonthsInput()?.value));

    const add = byTestId('promo-add');
    check('(1) the Add control is reachable', !!add);
    if (!add) { report(); return; }
    await click(add);

    check('(1) 24 rows emitted — 3 ramp + 21 held', captured.length === 24, String(captured.length));
    // ONE ROW PER MONTH, measured. See the header note.
    const byMonth = new Map<string, number>();
    for (const e of captured) byMonth.set(e.date, (byMonth.get(e.date) ?? 0) + 1);
    check('(1) exactly ONE row per month, not two',
      [...byMonth.values()].every(n => n === 1) && byMonth.size === captured.length,
      `${byMonth.size} distinct months for ${captured.length} rows`);

    const vols = captured.map((e: any) => e.subscriberVolume);
    check('(1) the ramp is 3.3333 / 6.6667 / 10 — a RATE, never rounded to 3/7/10',
      near(vols[0], 10 / 3) && near(vols[1], 20 / 3) && vols[2] === 10,
      vols.slice(0, 3).map((v: number) => v.toFixed(4)).join(' / '));
    check('(1) every later month holds exactly 10',
      vols.slice(3).every((v: number) => v === 10), String(vols[23]));
    check('(1) EVERY row carries hold — the tail included',
      captured.every((e: any) => e.hold === true));
    check('(1) every row is a promotion row',
      captured.every((e: any) => e.isPromotion === true));
    check('(1) the months are consecutive from the start month',
      captured[0]?.date === MONTHS[0] && captured[23]?.date === MONTHS[23],
      `${captured[0]?.date}..${captured[23]?.date}`);
    // A percentage promotion writes revenue 0 — the pre-existing rule, and it
    // must survive the generator swap.
    check('(1) a percentage promotion still writes revenue 0',
      captured.every((e: any) => e.revenue === 0));
  }

  // ── Case 2 — Hold OFF, against the c11151e literal ───────────────────────
  //
  // HAND-COMPUTED from the arithmetic as it stood BEFORE this session:
  //
  //     const pcts     = Array(3).fill(100/3)
  //     const total    = pcts.reduce((s, p) => s + p, 0)   // 100.00000000000001
  //     const fraction = pcts[i] / total                   // 0.3333333333333333
  //     const vol      = Math.round(3000 * fraction)       // 999.9999999999999 -> 1000
  //
  // so 3000 over 3 even is 1000 / 1000 / 1000, and there is no fourth row.
  // Nothing here is read back from `spreadShape`.
  {
    await mount();
    if (!(await openPromo())) { report(); return; }
    await type(byTestId('promo-volume-amount'), '3000');
    await click(btnByText(i18n.t('whatif_ramp_volume_over_multiple_months')));
    const mi = rampMonthsInput();
    if (mi) await type(mi, '3');
    await click(byTestId('promo-add'));

    check('(2) EXACTLY 3 rows, then nothing', captured.length === 3, String(captured.length));
    check('(2) 1000 / 1000 / 1000 — the c11151e literal',
      captured.map((e: any) => e.subscriberVolume).join(',') === '1000,1000,1000',
      captured.map((e: any) => e.subscriberVolume).join(','));
    check('(2) no row carries hold', captured.every((e: any) => !e.hold));
    check('(2) the months stop at the third',
      captured[2]?.date === MONTHS[2], String(captured[2]?.date));
  }

  // ── Case 3 — the round trip, through the REAL writer and reader ──────────
  {
    await mount();
    if (!(await openPromo())) { report(); return; }
    // Jon's order here too — hold LAST. See case 1.
    await click(byTestId('promo-amount-pct'));
    await type(byTestId('promo-volume-amount'), '10');
    await click(btnByText(i18n.t('whatif_ramp_volume_over_multiple_months')));
    const mi = rampMonthsInput();
    if (mi) await type(mi, '3');
    await click(byTestId('promo-hold-toggle'));
    await click(byTestId('promo-add'));
    const emitted = captured.slice();
    check('(3) 24 rows to round-trip', emitted.length === 24, String(emitted.length));

    const sheet = emitted.map((e: any) => fc.marketEventExportRow(e));
    const back = sheet.map((r: any) => fc.marketEventFromRow(r, 'session'));
    check('(3) Hold is restored on every row', back.every((e: any) => e.hold === true));
    check('(3) Is_Promotion survives too', back.every((e: any) => e.isPromotion === true));
    check('(3) the figures survive',
      near(back[0]?.subscriberVolume, 10 / 3) && back[23]?.subscriberVolume === 10,
      `${back[0]?.subscriberVolume} .. ${back[23]?.subscriberVolume}`);

    const { holdPlateauStart } = await import('../src/components/WhatIfTab');
    const figs = back.map((e: any) => Math.abs(e.subscriberVolume));
    check('(3) the ramp length restores as 3 — via holdPlateauStart, no new function',
      holdPlateauStart(figs) === 3, String(holdPlateauStart(figs)));
    check('(3) the target restores as 10 — the LAST row, not the sum',
      figs[figs.length - 1] === 10, String(figs[figs.length - 1]));

    // AN OLD SAVE: the column deleted, not blanked.
    const legacy = sheet.map((r: any) => { const c = { ...r }; delete c.Hold; return c; });
    const oldBack = legacy.map((r: any) => fc.marketEventFromRow(r, 'session'));
    check('(3) an old promo save loads with hold OFF',
      oldBack.every((e: any) => e.hold === false));
    check('(3) and its rows are untouched',
      oldBack.length === emitted.length
      && oldBack.every((e: any, i: number) => e.subscriberVolume === emitted[i].subscriberVolume
        && e.date === emitted[i].date),
      String(oldBack.length));
  }

  // ── Case 4 — reopen through D5-04's router ───────────────────────────────
  //
  // Clause 5 on the third carrier: toggle from the COLUMN, target from the
  // LAST row, ramp length from `holdPlateauStart`.
  //
  // AN ABSOLUTE PROMOTION, NOT A PERCENTAGE ONE, and that is a FINDING rather
  // than a convenience. The brief's case is +10%, and a percentage promo
  // campaign HAS NO PILL: D5-05's bar refuses it with
  //   "Percentage events are edited individually, not as a campaign spread"
  // — measured, by reading the decline reason out of the Volume table on the
  // first run of this case. That bar predates this session and is not its to
  // change, so the restore path is exercised with the amount type that can
  // reach it. A HELD PERCENTAGE PROMO CAMPAIGN THEREFORE CANNOT BE REOPENED
  // AS A CAMPAIGN — reported, not repaired.
  //
  // HAND-COMPUTED: 3000 over a 3-month even ramp under hold is
  // 3000 x 1/3, 3000 x 2/3, 3000 x 1 = 1000 / 2000 / 3000, then 3000 held.
  {
    await mount();
    if (!(await openPromo())) { report(); return; }
    // Jon's order here too — hold LAST. See case 1.
    await type(byTestId('promo-volume-amount'), '3000');
    await click(btnByText(i18n.t('whatif_ramp_volume_over_multiple_months')));
    const mi = rampMonthsInput();
    if (mi) await type(mi, '3');
    await click(byTestId('promo-hold-toggle'));
    // BY PLACEHOLDER, because this input carries no testid and adding one cost
    // session 2 a gate run (a duplicate `data-testid` tsc refused). The
    // placeholder is a locale key resolved through the same i18n instance the
    // card renders with, so this cannot drift from the copy.
    const nameInput = [...container.querySelectorAll('input')]
      .find((i: any) => i.getAttribute('placeholder') === i18n.t('whatif_e_g_summer_promo_2026')) as any;
    check('(4) the campaign-name input is reachable', !!nameInput);
    if (!nameInput) { report(); return; }
    await type(nameInput, 'Promo');
    // ── WALK C — THE GRID SHOWS WHAT THE SAVE EMITS ───────────────────────
    //
    // HAND-WRITTEN, both sides, and NEVER one against the other: a check that
    // compared the grid to the rows would pass with both wrong, which is the
    // whole failure being fixed. 3,000 over a 3-month even ramp under hold is
    //   3000 x 1/3 = 1000, 3000 x 2/3 = 2000, 3000 x 3/3 = 3000
    // and the campaign starts at MONTHS[0] on a 24-month forecast, so the
    // tail is 24 - 3 = 21 months of 3,000.
    const gridVols = [...container.querySelectorAll('.text-emerald-600')]
      .map((e: any) => norm(e.textContent || ''))
      .filter((s: string) => /^\+[\d,]+$/.test(s));
    check('(C) the PREVIEW GRID reads +1,000 / +2,000 / +3,000',
      gridVols.join(' ') === '+1,000 +2,000 +3,000', gridVols.join(' '));
    const tail = byTestId('promo-hold-tail');
    check('(C) a tail line is present under Hold ON', !!tail);
    check('(C) it names the held figure and the last month',
      (tail?.textContent ?? '').includes('3,000')
      && (tail?.textContent ?? '').includes('21'),
      norm(tail?.textContent ?? ''));
    const addBtn = byTestId('promo-add');
    check('(C) the button reports 24, not "Add Promotion"',
      /24/.test(addBtn?.textContent ?? ''), norm(addBtn?.textContent ?? ''));
    await click(byTestId('promo-add'));

    check('(4) a held promo campaign was built', captured.length === 24, String(captured.length));
    // AND THE EMITTED ROWS MATCH THE SAME HAND-WRITTEN LITERAL.
    check('(C) the EMITTED rows are 1000 / 2000 / 3000, then 3000 held',
      captured.slice(0, 3).map((e: any) => e.subscriberVolume).join(',') === '1000,2000,3000'
      && captured.slice(3).every((e: any) => e.subscriberVolume === 3000),
      captured.slice(0, 4).map((e: any) => e.subscriberVolume).join(','));
    check('(4) its ramp is 1000 / 2000 / 3000, then 3000 held',
      captured.slice(0, 3).map((e: any) => e.subscriberVolume).join(',') === '1000,2000,3000'
      && captured.slice(3).every((e: any) => e.subscriberVolume === 3000),
      captured.slice(0, 4).map((e: any) => e.subscriberVolume).join(','));

    // THROUGH THE PROMOTION CARD'S OWN CAMPAIGN PILL, which is
    //  — the handler item 1.3 names.
    //
    // NOT through the Volume table's pill, and that is DECLARED rather than
    // quietly dropped: after switching to the Volume tab this harness found
    // neither a pill nor a decline reason for the promo campaign (0 and 0),
    // so D5-04's router could not be exercised here and is NOT covered by
    // this file. The percentage variant is separately barred — see above.
    //
    // The pill carries no testid, so it is found by its resolved title, which
    // comes from the same i18n instance the card renders with.
    const pillTitle = i18n.t('whatif_edit_campaign_event',
      { p0: 'Promo', p1: 24, p2: 's' });
    const pill = [...container.querySelectorAll('button')]
      .find((b: any) => b.getAttribute('title') === pillTitle) as any;
    check('(4) the Promotion card campaign pill is reachable', !!pill, pillTitle);
    if (!pill) { report(); return; }
    await click(pill);

    check('(4) the hold toggle comes back ON, from the COLUMN',
      byTestId('promo-hold-toggle')?.getAttribute('aria-pressed') === 'true',
      String(byTestId('promo-hold-toggle')?.getAttribute('aria-pressed')));
    const mi2 = rampMonthsInput();
    check('(4) the ramp duration is 3 — the PLATEAU START, not 24',
      Number(mi2?.value) === 3, String(mi2?.value));
    check('(4) the amount box shows the TARGET 3000, not the 69,000 sum',
      Number(byTestId('promo-volume-amount')?.value) === 3000,
      String(byTestId('promo-volume-amount')?.value));
  }

  report();
}

main().catch(e => { console.log('\npromo-hold-mounted spec: CRASHED — ' + (e?.stack || e)); process.exit(1); });
