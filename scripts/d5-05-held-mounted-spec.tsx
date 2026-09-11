/**
 * D5-05 AMENDED — A HELD PERCENTAGE CAMPAIGN IS GROUP-EDITABLE, THROUGH THE APP.
 *
 *   npm run spec:d5-05-held
 *
 * Driven in Jon's click order against the real WhatIfTab: a +10% campaign is
 * built with Hold ON, and its campaign pill is CLICKED — from the Volume
 * table, from the Promotion card, and through D5-04's Volume-table router.
 *
 * WHAT THE BAR WAS, AND WHY HELD IS DIFFERENT. D5-05 barred any campaign
 * containing a percentage row because the group edit reverse-engineers a ramp
 * by SUMMING volumes, and a sum of per-cents is meaningless. A held campaign
 * never reaches that arithmetic: its restore reads the target off the LAST
 * row and the ramp length off `holdPlateauStart`. The hazard did not lapse —
 * it is avoided by never reaching the summing path, the same way the churn
 * bar was lifted in D5-REVISED.
 *
 * THE UNHELD CASE IS ASSERTED TOO, and asserted on the REASON TEXT rendered
 * in the DOM rather than on a title attribute — a hover tooltip is invisible
 * on touch, which is the defect D5-05's own render note records.
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
  console.log(`\nd5-05-held spec: ${pass} passed, ${fails.length} failed`);
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
    console.log(`\nd5-05-held spec: UNREACHABLE — fixture missing at ${FIX}`);
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
  let draftSetter: ((f: any) => void) | null = null;

  const Host: React.FC<any> = ({ Card, props }) => {
    const [newEvent, setNewEvent] = (React as any).useState({
      scenario: 'Inflow', segment: 'All', product: 'All', productL2: 'All',
      channel: 'All', channelL2: 'All', tariffL1: 'All', tariffL2: 'All',
      date: MONTHS[0], subscriberVolume: 0, customerVolume: 0, revenue: 0, arpu: 0,
      name: '', campaignName: '', comment: '', contractLength: 24,
    });
    const [marketEvents, setMarketEvents] = (React as any).useState([]);
    captured = marketEvents;
    draftSetter = setNewEvent;
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

  const setDraft = async (patch: any) => {
    await (act as any)(async () => { draftSetter!((d: any) => ({ ...d, ...patch })); });
  };
  /** The campaign pill, found by its resolved title — it carries a testid
   *  (`edit-campaign`) only when EDITABLE, which is precisely the thing under
   *  test, so a testid lookup would beg the question. */
  const pillFor = (name: string, n: number) => {
    const title = i18n.t('whatif_edit_campaign_event',
      { p0: name, p1: n, p2: n === 1 ? '' : 's' });
    return [...container.querySelectorAll('button')]
      .find((b: any) => b.getAttribute('title') === title) as any;
  };
  const declineText = () => [...container.querySelectorAll('[data-testid^="campaign-decline-reason-"]')]
    .map((e: any) => (e.textContent || '').trim()).filter(Boolean);

  // ── (1) A HELD +10% VOLUME CAMPAIGN REOPENS AT 10 / RAMP 3 / HOLD ON ─────
  //
  // Built in fill-in order (REQ-D6-05): the percentage draft, the duration,
  // then Hold LAST — the order hold-mounted case (a) now builds in, so the rows
  // under test are the ones that path actually emits, not a hand-made fixture.
  {
    await mount();
    // RE-AIMED at REQ-D6-05 (2026-09-11). This pressed Hold first and then
    // `volume-spread-toggle`, which is retired; Hold now renders only in Ramp,
    // so the old order crashed on a null box. Re-driven in fill-in order —
    // mode → amount → duration → values → Hold LAST. A percentage draft IS a
    // Ramp (clause 9), so the mode step is the draft itself.
    await setDraft({ scenario: 'Inflow', amountType: 'percentage',
      percentageBasis: 'baseline', subscriberVolume: 10, date: MONTHS[0],
      campaignName: 'PctHeld' });
    await type(byTestId('volume-duration'), '3');
    await click(byTestId('volume-hold-toggle'));
    await click(byTestId('volume-add'));

    check('(1) 24 rows emitted, every one held',
      captured.length === 24 && captured.every((e: any) => e.hold === true),
      String(captured.length));
    check('(1) and every one is a PERCENTAGE row',
      captured.every((e: any) => e.amountType === 'percentage'));
    const vols = captured.map((e: any) => e.subscriberVolume);
    check('(1) the ramp is 3.3333 / 6.6667 / 10 and the tail holds 10',
      near(vols[0], 10 / 3) && near(vols[1], 20 / 3) && vols[2] === 10
        && vols.slice(3).every((v: number) => v === 10),
      vols.slice(0, 3).map((v: number) => v.toFixed(4)).join(' / '));

    // THE BAR IS LIFTED — the pill is a BUTTON, not the disabled span.
    const pill = pillFor('PctHeld', 24);
    check('(1) D5-05 LIFTED: the campaign pill is an enabled button',
      !!pill && pill.tagName === 'BUTTON', pill ? pill.tagName : 'absent');
    check('(1) and no decline reason is rendered for it',
      declineText().length === 0, declineText().join(' | '));
    if (!pill) { report(); return; }
    await click(pill);

    // THE VOLUME CARD's amount box, ramp-duration box and unit arms carry NO
    // testids, so all three are found structurally — the amount box by the
    // percentage placeholder the card itself renders, the duration box by the
    // min/max pair the promo spec already uses, and the lit unit arm by the
    // Vodafone red class the card applies to whichever arm is selected.
    const volAmount = () => [...container.querySelectorAll('input[type=number]')]
      .find((i: any) => (i.getAttribute('placeholder') || '').includes('+10%')) as any;
    // RE-AIMED at REQ-D6-05: the Volume duration box is min 1 now (clause 10),
    // so the min-2 lookup would find nothing — or, worse, the PROMOTION box.
    // It has a testid; use it.
    const volMonths = () => byTestId('volume-duration');
    const litUnitArm = () => [...container.querySelectorAll('button')]
      .filter((b: any) => /bg-\[#e60000\] text-white/.test(b.className || ''))
      .map((b: any) => norm(b.textContent || ''))
      .find((s: string) => s === i18n.t('whatif_amount_unit_pct')
        || s === i18n.t('whatif_amount_unit_subs'));

    check('(1) the amount box shows the TARGET 10, not the 220.0 sum',
      Number(volAmount()?.value) === 10, String(volAmount()?.value));
    check('(1) the hold toggle comes back ON, from the COLUMN',
      byTestId('volume-hold-toggle')?.checked === true,
      String(byTestId('volume-hold-toggle')?.checked));
    check('(1) the ramp duration is 3 — the PLATEAU START, not 24',
      Number(volMonths()?.value) === 3, String(volMonths()?.value));
    // THE AMOUNT STILL MEANS PER CENT. Without amountType and the amount
    // control on the restored draft, the box would read 10 and mean ten
    // SUBSCRIBERS — the amount changing meaning silently, which is the exact
    // class of failure D5-05 existed to prevent.
    check('(1) the % arm is lit, so the 10 still means per cent',
      litUnitArm() === i18n.t('whatif_amount_unit_pct'),
      String(litUnitArm()));
    // ── RE-SAVING REPLACES ALL ROWS ──────────────────────────────────────
    const idsBefore = captured.map((e: any) => e.id);
    // The campaign-save button carries NO testid — it is found by its resolved
    // label, from the same i18n instance the card renders with. Not given one
    // here: adding a testid is a UI change this brief did not ask for, and the
    // label lookup is honest about what the user actually presses.
    const saveBtn = btnByText(i18n.t('whatif_save_campaign'));
    check('(1) the campaign-save button is reachable', !!saveBtn,
      i18n.t('whatif_save_campaign'));
    if (!saveBtn) { report(); return; }
    await click(saveBtn);
    check('(1) re-saving leaves the row COUNT unchanged at 24',
      captured.length === 24, String(captured.length));
    const idsAfter = captured.map((e: any) => e.id);
    check('(1) and every id is NEW — the rows were replaced, not merged',
      idsAfter.every((id: string) => !idsBefore.includes(id)),
      `${idsAfter.filter((id: string) => idsBefore.includes(id)).length} survived`);
    check('(1) the re-saved rows are still percentage and still held',
      captured.every((e: any) => e.amountType === 'percentage' && e.hold === true));
  }


  /** Open the Promotion card and pin the start month, so the horizon is
   *  deterministic — the promo month defaults to the CURRENT calendar month,
   *  which is not the forecast's first. */
  const openPromo = async () => {
    const tab = btnByText('Promotion');
    check('promo: the Promotion card is reachable', !!tab);
    if (!tab) return false;
    await click(tab);
    const monthInput = byTestId('promo-month');
    check('promo: the promo month input is reachable', !!monthInput);
    if (!monthInput) return false;
    await type(monthInput, MONTHS[0]);
    return true;
  };
  // RE-AIMED at REQ-D6-05: the promo duration box is min 1 now; use its testid.
  const rampMonthsInput = () => byTestId('promo-duration');
  const promoNameInput = () =>
    [...container.querySelectorAll('input')]
      .find((i: any) => i.getAttribute('placeholder') === i18n.t('whatif_e_g_summer_promo_2026')) as any;

  // ── (2) AN UNHELD +10% CAMPAIGN STILL DECLINES, REASON IN THE DOM ────────
  //
  // BUILT ON THE PROMOTION CARD, and the reason is worth recording: with hold
  // OFF the VOLUME card HIDES its spread control for a percentage draft
  // (REQ-D6-03 settled that ambiguity), so a multi-row unheld percentage
  // campaign is not reachable there at all. The Promotion card's ramp is open
  // for percentages either way, so that is where the unheld case lives.
  //
  // This is the half of the amendment that must NOT change: D5-05 stands for
  // an unheld percentage campaign, because its restore would still reverse-
  // engineer a ramp by summing per-cents.
  {
    await mount();
    if (!(await openPromo())) { report(); return; }
    await click(byTestId('promo-amount-pct'));
    await type(byTestId('promo-volume-amount'), '10');
    // RE-AIMED at REQ-D6-05 (2026-09-11). This built its unheld +10% campaign
    // through the Promotion card's UNGATED per-cent share-split — the gap
    // clause 9 retires. A percentage is now always a Ramp, so the unheld case is
    // an unheld percentage RAMP. The claim is unchanged and still the point:
    // D5-05 declines an unheld percentage campaign, reason in the DOM.
    const mi = rampMonthsInput();
    if (mi) await type(mi, '3');
    const nameBox = promoNameInput();
    check('(2) the campaign-name input is reachable', !!nameBox);
    if (!nameBox) { report(); return; }
    await type(nameBox, 'PctPlain');
    await click(byTestId('promo-add'));

    check('(2) an unheld percentage campaign of 3 rows was built',
      captured.length === 3 && captured.every((e: any) => !e.hold)
        && captured.every((e: any) => e.amountType === 'percentage'),
      `${captured.length} rows, held=${captured.filter((e: any) => e.hold).length}`);
    check('(2) D5-05 STANDS: there is no enabled pill for it',
      !pillFor('PctPlain', 3));
    // ASSERTED ON THE RENDERED TEXT, never on a title attribute — a tooltip is
    // invisible on touch, which is the defect D5-05's own render note records.
    const expected = i18n.t('whatif_campaign_decline_percentage');
    check('(2) and the REASON is rendered as TEXT in the DOM',
      declineText().some((s: string) => s === expected),
      declineText().join(' | ') || 'no reason rendered');
  }

  // ── (3) A HELD +10% PROMOTION, VIA THE PROMOTION PILL ────────────────────
  //
  // The Promotion card owns its own campaign groups and its own pill — a
  // byte-identical JSX copy of the Volume table's. Lifting the bar inside
  // groupByCampaign lifts it for BOTH, and that is what this case claims.
  //
  // Jon's order, deliberately: amount -> ramp -> HOLD. The stale-closure
  // failure promo-hold-mounted records was invisible under any other order.
  {
    await mount();
    if (!(await openPromo())) { report(); return; }
    await click(byTestId('promo-amount-pct'));
    await type(byTestId('promo-volume-amount'), '10');
    // RE-AIMED at REQ-D6-05: the switch is retired; a % promotion is a Ramp.
    const mi = rampMonthsInput();
    if (mi) await type(mi, '3');
    await click(byTestId('promo-hold-toggle'));
    const nameBox = promoNameInput();
    if (!nameBox) { report(); return; }
    await type(nameBox, 'PromoHeld');
    await click(byTestId('promo-add'));

    check('(3) 24 held percentage promo rows were built',
      captured.length === 24 && captured.every((e: any) => e.hold === true)
        && captured.every((e: any) => e.amountType === 'percentage'),
      `${captured.length} rows, held=${captured.filter((e: any) => e.hold).length}`);
    const pill = pillFor('PromoHeld', 24);
    check('(3) D5-05 LIFTED on the Promotion card too: the pill is a button',
      !!pill && pill.tagName === 'BUTTON', pill ? pill.tagName : 'absent');
    check('(3) and no decline reason is rendered for it',
      declineText().length === 0, declineText().join(' | '));
    if (!pill) { report(); return; }
    await click(pill);

    check('(3) the promo hold toggle comes back ON, from the COLUMN',
      byTestId('promo-hold-toggle')?.checked === true,
      String(byTestId('promo-hold-toggle')?.checked));
    check('(3) the promo amount box shows the TARGET 10, not the 220 sum',
      Number(byTestId('promo-volume-amount')?.value) === 10,
      String(byTestId('promo-volume-amount')?.value));
    const mi3 = rampMonthsInput();
    check('(3) the promo ramp duration is 3 — the PLATEAU START, not 24',
      Number(mi3?.value) === 3, String(mi3?.value));
    // LIT-NESS IS READ FROM THE CLASS, not aria-pressed: the promo unit arms
    // are plain buttons that carry no pressed state, and the card marks the
    // selected one with the Vodafone red. This is how view-apply-mounted
    // already reads them, so the two files agree on what "lit" means.
    check('(3) the % arm is still lit, so the 10 still means per cent',
      String(byTestId('promo-amount-pct')?.className ?? '').includes('bg-[#e60000]'),
      String(byTestId('promo-amount-pct')?.className ?? '').slice(0, 40));
  }

  // ── (4) D5-04's ROUTER — THE VOLUME TABLE's PILL OPENS THE PROMO EDITOR ──
  //
  // The same held promotion, reached from the OTHER table. D5-04 decided a
  // promotion is edited from its source: the Volume table's campaign pill
  // routes through editCampaignFromVolumeTable, which switches the tab first
  // and then seeds the promotion draft. The test is that the SAME campaign
  // restores to the SAME three values by the other door.
  {
    await mount();
    if (!(await openPromo())) { report(); return; }
    await click(byTestId('promo-amount-pct'));
    await type(byTestId('promo-volume-amount'), '10');
    // RE-AIMED at REQ-D6-05: the switch is retired; a % promotion is a Ramp.
    const mi = rampMonthsInput();
    if (mi) await type(mi, '3');
    await click(byTestId('promo-hold-toggle'));
    const nameBox = promoNameInput();
    if (!nameBox) { report(); return; }
    await type(nameBox, 'PromoHeld');
    await click(byTestId('promo-add'));
    check('(4) the held promo campaign exists', captured.length === 24,
      String(captured.length));
    // Over to the Volume table, where the promotion's rows are also listed.
    //
    // THE TAB IS TAKEN FROM THE TAB STRIP, not by text alone. A plain
    // `btnByText('Volume')` matched a DIFFERENT button — the card also
    // renders a measure control labelled "Volume" — and `.find` returned
    // that one, so the click did nothing and this case read the Promotion
    // card's own table while believing it was reading the Volume table's.
    // The strip is identified by the tab already known to be in it.
    const tabStrip = btnByText('Promotion')?.parentElement;
    const volTab = tabStrip && [...tabStrip.querySelectorAll('button')]
      .find((b: any) => norm(b.textContent || '') === i18n.t('whatif_volume')) as any;
    check('(4) the Volume tab is reachable from the tab strip', !!volTab);
    if (!volTab) { report(); return; }
    await click(volTab);
    check('(4) and the Volume card is what is now on screen',
      !!byTestId('volume-add'), 'volume-add absent');
    await click(volTab);

    const pills = [...container.querySelectorAll('button')]
      .filter((b: any) => b.getAttribute('data-testid') === 'edit-campaign');
    check('(4) the Volume table renders an ENABLED pill for the held promo',
      pills.length > 0, `${pills.length} pills`);
    if (!pills.length) { report(); return; }
    await click(pills[0]);

    // D5-04: the tab is switched FIRST, so the promotion editor is what the
    // user is looking at — asserted by the promo controls being present and
    // carrying the restored values, not by a flag.
    check('(4) the PROMOTION editor is what opened, not the Volume form',
      !!byTestId('promo-hold-toggle'), 'promo-hold-toggle absent');
    check('(4) it restores hold ON by the Volume-table route too',
      byTestId('promo-hold-toggle')?.checked === true,
      String(byTestId('promo-hold-toggle')?.checked));
    check('(4) the amount box shows the TARGET 10 by that route too',
      Number(byTestId('promo-volume-amount')?.value) === 10,
      String(byTestId('promo-volume-amount')?.value));
    const mi4 = rampMonthsInput();
    check('(4) and the ramp duration is 3, not 24',
      Number(mi4?.value) === 3, String(mi4?.value));
  }

  report();
}

main().catch(e => { console.log('\nd5-05-held spec: CRASHED — ' + (e?.stack || e)); process.exit(1); });
