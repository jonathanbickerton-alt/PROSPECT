/**
 * THE PROMOTION ARM'S COHORT TARGET, DRIVEN THROUGH THE RENDERED DOM.
 *
 *   npm run spec:promo-cohort-target
 *
 * REQ-D6-07 clauses 12-15 (Jon, 2026-09-16). The Promotion card's Value-mix arm
 * answered in BLEND units while the Value card beside it answered in cohort
 * units. The 1008 session measured why it could not simply be pointed at the
 * preview seam: the seam had no slot for a promotion draft, so delivered equalled
 * fitted at any mix. Clause 15 adds the slot; this file pins what it delivers.
 *
 * SECTION S — THE FOUR EXISTING SEAM CALLERS ARE UNCHANGED. Measured on the
 * source BEFORE the slot was added (3510cc9's tree) and written here as literals,
 * one per caller: the Pricing preview, the Pricing save, the Value card's
 * preview, the Value card's cohort solve. A splice that altered the run for a
 * caller passing no promotion draft would move one of them.
 *
 * SECTION P — the Promotion arm, in the brief's fill-in order (a)-(i).
 *
 * THE HARNESS is value-cohort-target's, deliberately: same fixture, same seeded
 * ARPU history, same resolver that answers every key with the seeded baseline.
 * The literals in section P are the 1008 harness's figures (scratchpad
 * d612-promo.tsx), which drove the engine directly; agreeing with them is the
 * evidence that the card reaches the engine the way the harness did.
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

// READ FROM THE LOCALE FILE, never copied: a pasted sentence lets the app's
// wording change while the assertion keeps passing against the old words.
const EN: any = JSON.parse(
  (await import('node:fs')).readFileSync('src/locales/en/translation.json', 'utf8'));
const EN_REFUSE_NO_RATES: string = EN['whatif_value_refuse_no_rates'];

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

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
    console.log(`\npromo-cohort-target spec: UNREACHABLE — fixture missing at ${FIX}`);
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

  const captured: any[] = [];

  // `newYieldEvent` is a PROP with a noop setter here, so the month is supplied
  // rather than typed. That is the card's real entry state on an opened event,
  // and it is what lets the card's own save handler run — the alternative,
  // building a YieldEvent by hand, would be this spec reimplementing the very
  // construction site (d) exists to exercise.
  const whatIfProps = (yieldEvents: any[] = []) => ({
    data: rows.slice(0, 4000),
    wiDateCol: C.date, wiSegmentCol: C.seg, wiProductCol: C.prod, wiProductL2Col: C.prodL2,
    wiChannelCol: C.chan, wiChannelL2Col: C.chanL2, wiMetricCol: C.metric,
    wiInflowVal: 'Inflow', wiRetentionVal: 'Retention',
    wiValueCol: C.val, wiRevenueCol: C.rev, wiArpuCol: '',
    productTree: treeOf(C.prod, C.prodL2), channelTree: treeOf(C.chan, C.chanL2),
    tariffTree: new Map<string, string[]>(),
    selectedTariffs: [], setSelectedTariffs: noop,
    cohortAvgArpu: 11.6,
    newEvent: {}, setNewEvent: noop, marketEvents: [], setMarketEvents: noop,
    addMarketEvent: noop, removeMarketEvent: noop, updateMarketEvent: noop,
    yieldEvents, newYieldEvent: { month: MONTH, ibro: 'Inflow' }, setNewYieldEvent: noop,
    addYieldEvent: (e: any) => captured.push(e),
    updateYieldEvent: noop,
    removeYieldEvent: noop, clearAllYieldEvents: noop,
    pricingEvents: [], newPricingEvent: {}, setNewPricingEvent: noop, addPricingEvent: noop,
    removePricingEvent: noop, clearAllPricingEvents: noop,
    downloadExcel: noop, formatNumber: (v: any) => Number(v).toFixed(2), setActiveView: noop,
    missingMonths: [],
  } as any);

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
        arpu: 0, inflowArpu: 0, outflowArpu: 0, retentionArpu: 0, baseArpu: 0, _rev: 0, _vol: 0 });
      const e = acc.get(tms)!, m = String(row[C.metric]), v = Number(row[C.val]) || 0;
      if (m === 'Inflow') e.inflow += v; else if (m === 'Outflow') e.outflow += v;
      else if (m === 'Retention') e.retention += v;
      // REQ-D6-07. THE HISTORY NOW CARRIES ARPU. It did not before, and it did not
      // need to: every check here was about SHARES. The card's band is now stated in
      // cohort terms, and a cohort ARPU of zero is a band of [0.00, 0.00] — a mount
      // that could not tell a working solve from a broken one.
      e._rev += Number(row[C.rev]) || 0; e._vol += v;
    }
  }
  const seriesArr = [...acc.values()].sort((a, b) => a._parsedDate - b._parsedDate)
    .map((r: any) => { const a = r._vol > 0 ? r._rev / r._vol : 20;
      return { ...r, arpu: a, inflowArpu: a, outflowArpu: a, retentionArpu: a, baseArpu: a }; });
  const baseForecast = fc.calculateBaseForecast(seriesArr,
    { segment: SEG, product: 'All', productL2: 'All', channel: 'All', channelL2: 'All',
      tariffL1: 'All', tariffL2: 'All', scenario: 'Base Case' },
    10000, 24, 1.0, 1.5, 3, 'Holt Linear');

  // THE DRAFT MONTH IS THE FORECAST'S OWN, not a literal. A month outside the
  // forecast has no fitted ARPU at all, which is clause 11's refusal rather than
  // the state (f) and (g) exercise.
  const MONTH: string = baseForecast.months[3].month;

  const withProvider = (child: any) => React.createElement(ForecastProvider as any, {
    baseForecast, setBaseForecast: noop,
    adjustedForecast: null, setAdjustedForecast: noop,
    forecastStore: new Map(), setForecastStore: noop,
    // REQ-D6-07. THE SEAM NEEDS A RESOLVABLE FORECAST, because the card's band is
    // now stated in COHORT terms and a cohort figure comes from the slice's own
    // forecast. An empty store resolves nothing, so before this the card could
    // only ever have said "no fitted ARPU here" — which is clause 11 working, but
    // it is not the state (f) and (g) are about. Every key resolves to the seeded
    // baseline: this spec's subject is the CARD, and which key the store answers
    // to is resolveFromStore's own spec, not this one's.
    resolveForecast: (_k: string) => ({ forecast: baseForecast, reason: null, leaves: [] }),
    canResolve: () => false,
    hasLegacyBaseline: !!baseForecast, updatedAt: new Date().toISOString(),
    bulkRuns: [], setBulkRuns: noop,
  }, child);

  // THE CARD'S OWN FORMATTER, imported rather than reimplemented: a second
  // month formatter here would pin this spec's idea of a month label.
  const { monthLabel } = await import('../src/utils/monthFormat');
  const fmtM = (m: string) => monthLabel(m, (i18n as any).language);
  const M: any = (await import('../src/components/WhatIfTab')).WhatIfTab;
  const host = document.getElementById('root')!;
  const nativeSetter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!;

  /** Mount the card with the VALUE tab active. By testid, never by label. */
  const openValueCard = async (yieldEvents: any[] = [], ibro: string = 'Inflow') => {
    host.replaceChildren();
    const c = document.createElement('div');
    host.appendChild(c);
    const root = createRoot(c);
    await (act as any)(async () => {
      root.render(withProvider(React.createElement(M, { ...whatIfProps(yieldEvents),
        newYieldEvent: { month: MONTH, ibro } })));
    });
    const tab = c.querySelector('[data-testid="whatif-tab-value"]') as any;
    if (tab) await (act as any)(async () => { tab.click(); });
    return { c, root, tab };
  };
  /**
   * REQ-D6-07. WHAT THE TARGET IS NOW MEASURED AGAINST.
   *
   * The typed figure is a COHORT ARPU, so "did Apply hit the target" is a question
   * about what the cohort delivers, not about the blend — and the two are different
   * numbers (the engine multiplies the fitted ARPU by blend / equal-weight). Read
   * from the card's own lead, which is the figure the chart will draw; it is
   * displayed to two decimals, so the bar here is 0.01 rather than the solver's own
   * 0.005 tolerance. Measuring the blend instead is trap 246.
   */
  const lockOf = (c: any, tier: string) => c.querySelector(`[data-testid="yield-mix-lock-${tier}"]`) as any;
  const rangeOf = (c: any, tier: string) => c.querySelector(`[data-testid="yield-mix-range-${tier}"]`) as any;
  const tiersIn = (c: any) => [...c.querySelectorAll('[data-testid^="yield-mix-range-"]')]
    .map((el: any) => el.getAttribute('data-testid').replace('yield-mix-range-', ''));
  const clickIt = async (el: any) => { await (act as any)(async () => { el.click(); }); };
  const setRange = async (el: any, v: number) => {
    await (act as any)(async () => {
      nativeSetter.call(el, String(v));
      el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
  };


  const PROBE = process.env.PROBE === '1';
  const txt = (el: any) => ((el?.textContent) ?? '').replace(/\s+/g, ' ').trim();
  const typeInto = async (el: any, v: string) => {
    await (act as any)(async () => {
      nativeSetter.call(el, v);
      el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
  };
  const pressEnter = async (el: any) => {
    await (act as any)(async () => {
      el.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
  };
  /** Mount with prop overrides, a tab clicked by testid. */
  const openWith = async (over: any, tab: string) => {
    host.replaceChildren();
    const c = document.createElement('div');
    host.appendChild(c);
    const root = createRoot(c);
    await (act as any)(async () => {
      root.render(withProvider(React.createElement(M, { ...whatIfProps(), ...over })));
    });
    const tb = c.querySelector(`[data-testid="whatif-tab-${tab}"]`) as any;
    if (tb) await clickIt(tb);
    return c;
  };

  // ══ SECTION S — THE FOUR EXISTING CALLERS, BYTE-IDENTICAL ══════════════════
  const S: Record<string, string> = {};
  {
    // S1 — the Pricing card's PREVIEW (eventScopeSeriesFor via previewScopeResolution).
    const capturedPricing: any[] = [];
    const cP = await openWith({
      newPricingEvent: { month: MONTH, amount: 5, inputMode: 'percentage', target: 'cohorts', cohortScope: 'both' },
      addPricingEvent: (e: any) => capturedPricing.push(e),
    }, 'pricing');
    const lbl = [...cP.querySelectorAll('label')].find((l: any) => txt(l) === EN['whatif_preview_impact']) as any;
    S.pricingPreview = txt(lbl?.nextElementSibling);
    // S2 — the Pricing card's SAVE (the same seam, the handler's own call).
    const addBtn = [...cP.querySelectorAll('button')].find((b: any) => txt(b) === EN['whatif_add_pricing_event']) as any;
    if (addBtn) await clickIt(addBtn);
    const ev = capturedPricing[0] ?? {};
    S.pricingSave = JSON.stringify(Object.fromEntries(Object.keys(ev).sort()
      .filter(k => typeof ev[k] === 'number').map(k => [k, Number(ev[k].toFixed(6))])));
    // S3 — the Value card's PREVIEW.
    const cY = await openWith({}, 'value');
    S.yieldPreview = txt(cY.querySelector('[data-testid="yield-preview"]'));
    // S4 — the Value card's COHORT SOLVE (yieldDeliverForMix).
    const boxY = cY.querySelector('[data-testid="yield-mix-target"]') as any;
    if (boxY) { await typeInto(boxY, '14.2861'); await pressEnter(boxY); }
    const sharesY = [...cY.querySelectorAll('[data-testid^="yield-mix-range-"]')]
      .map((el: any) => Number(el.value).toFixed(4)).join(',');
    S.yieldSolve = txt(cY.querySelector('[data-testid="yield-preview-adjusted"]')) + ' @ ' + sharesY;
  }
  if (PROBE) { console.log('PROBE S ' + JSON.stringify(S, null, 1)); }
  const S_LITERAL: Record<string, string> = {
    // MEASURED on 3510cc9's src (WhatIfTab md5 recorded in the report), before
    // the market-draft slot existed. Hand-writing them from that run is the
    // point: a literal read back from the current tree would pass whatever the
    // splice did.
    pricingPreview: 'Baseline ARPU 13.88Adjusted ARPU 14.32+0.44 (+3.2%)',
    pricingSave: '{"amount":5,"originalBaseArpu":13.880813,"pricedVol":26623.05,"totalVol":42240.5}',
    yieldPreview: 'All Inflow ARPU, Nov 202613.87 → 13.87+0.00%at Nov 2026 only',
    yieldSolve: '14.29 @ 35.3666,32.3167,32.3167',
  };
  for (const k of Object.keys(S_LITERAL)) {
    check(`(S) seam caller ${k} is byte-identical to 3510cc9`, S[k] === S_LITERAL[k],
      `now ${JSON.stringify(S[k])} vs ${JSON.stringify(S_LITERAL[k])}`);
  }
  check('(S) all four callers were reached', Object.values(S).every(v => !!v && v !== '{}'),
    JSON.stringify(S));

  // ══ SECTION P — THE PROMOTION ARM, IN FILL-IN ORDER ═══════════════════════
  const byTid = (c: any, id: string) => c.querySelector('[data-testid="' + id + '"]') as any;
  const num = (c: any, id: string) => Number(txt(byTid(c, id)));
  const promoTiers = (c: any) => [...c.querySelectorAll('[data-testid^="promo-mix-range-"]')]
    .map((el: any) => String(el.getAttribute('data-testid')).replace('promo-mix-range-', ''));
  const promoRate = (c: any, t: string) => Number(byTid(c, 'promo-band-arpu-override-' + t)?.placeholder);
  const promoBlendByHand = (c: any) => promoTiers(c)
    .reduce((acc, t) => acc + Number(byTid(c, 'promo-mix-range-' + t).value) / 100 * promoRate(c, t), 0);
  const setSelect = async (el: any, v: string) => {
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value')!.set!;
    await (act as any)(async () => {
      setter.call(el, v);
      el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
  };
  const commitBox = async (el: any, v: string) => { await typeInto(el, v); await pressEnter(el); };
  /** A promotion draft, filled in the order a user fills the card. */
  const basisButton = (c: any, which: 'historical' | 'forecast') =>
    [...c.querySelectorAll('button')].find((x: any) =>
      txt(x) === EN[which === 'historical' ? 'common_historical_arpu' : 'whatif_forecast_arpu']) as any;
  const basisPressed = (c: any): string => {
    const on = (b: any) => !!b && String(b.className).includes('bg-white text-slate-900');
    return on(basisButton(c, 'forecast')) ? 'forecast' : on(basisButton(c, 'historical')) ? 'historical' : 'none';
  };
  const basisOnOpen: string[] = [];
  const openPromo = async (o: { target?: string; subs: number; months?: number; basis?: 'forecast' }) => {
    const c = await openWith({}, 'promotion');
    if (o.target && o.target !== 'Inflow') {
      const sel = [...c.querySelectorAll('select')].find((x: any) =>
        [...x.options].some((op: any) => op.value === 'Retention')) as any;
      await setSelect(sel, o.target);
    }
    await typeInto(byTid(c, 'promo-month'), MONTH);
    await typeInto(byTid(c, 'promo-volume-amount'), String(o.subs));
    if (o.months && o.months > 1) await typeInto(byTid(c, 'promo-duration'), String(o.months));
    const mixBox = [...c.querySelectorAll('input[type=checkbox]')].find((b: any) =>
      txt(b.closest('label')) === EN['whatif_value_mix_arm']) as any;
    if (mixBox) await clickIt(mixBox);
    // RE-AIMED at REQ-D6-07 clause 14 (A). A NEW draft now opens on FORECAST, and
    // the literals below were hand-checked engine-direct on the HISTORICAL basis
    // (the card's default when they were measured). Seen RED first, on the build
    // that changed the default and before this line existed:
    //   FAIL  (a) an even mix on the Historical basis delivers 15.03 (engine 15.0299)  [13.88]
    //   FAIL  (b) the lead reads 16.91 (engine 16.9057)  [15.11]
    //   FAIL  (b) and the demoted blend line reads 33.13 (engine 33.1264)  [21.7]
    //   FAIL  (c) at 300 subscribers the lead reads 14.23 (engine 14.2331)  [14.02]
    //   FAIL  (e) a -20% dilution lowers the delivered figure to 15.86 (engine 15.8644)  [14.43]
    //   FAIL  (g) a Retention promotion leads with Retention ARPU at its own month  [... 13.88 -> 13.88 ...]
    // So the drafts SELECT Historical, which keeps every hand-checked figure, and
    // the new default is asserted where it belongs — on the draft as opened.
    basisOnOpen.push(basisPressed(c));
    if (o.basis !== 'forecast') await clickIt(basisButton(c, 'historical'));
    return c;
  };
  /** 10 / 20 / 70 over the tiers by rate, by typing and padlocking. */
  const tiltPromo = async (c: any) => {
    const ts = promoTiers(c).sort((a, b) => promoRate(c, a) - promoRate(c, b));
    await commitBox(byTid(c, 'promo-mix-pct-' + ts[0]), '10');
    await clickIt(byTid(c, 'promo-mix-lock-' + ts[0]));
    await commitBox(byTid(c, 'promo-mix-pct-' + ts[1]), '20');
    await clickIt(byTid(c, 'promo-mix-lock-' + ts[0]));
    return ts;
  };
  const pShares = (c: any) => promoTiers(c).map(t => Number(byTid(c, 'promo-mix-range-' + t).value).toFixed(3)).join(',');

  // (a) THE EVEN MIX, and what it delivers.
  const cA = await openPromo({ subs: 3000 });
  const tiersA = promoTiers(cA);
  check('(a) the mix arm seeded three tiers', tiersA.length === 3, String(tiersA.length));
  check('(a) the lead renders with its pair', !!byTid(cA, 'promo-preview-baseline') && !!byTid(cA, 'promo-preview-adjusted'),
    txt(byTid(cA, 'promo-preview')) || 'no lead');
  const P_: any = { aBaseline: num(cA, 'promo-preview-baseline'), aDelivered: num(cA, 'promo-preview-adjusted'),
    aBlend: promoBlendByHand(cA), aRates: tiersA.map(t => promoRate(cA, t)) };

  // (b) TILT 10 / 20 / 70.
  await tiltPromo(cA);
  P_.bShares = pShares(cA);
  P_.bDelivered = num(cA, 'promo-preview-adjusted');
  P_.bBlend = num(cA, 'promo-blend');
  P_.bLabel = txt(byTid(cA, 'promo-preview')).slice(0, 60);
  P_.bScope = txt(byTid(cA, 'promo-lead-scope'));
  const roA = txt(byTid(cA, 'promo-mix-target-range'));
  P_.bBand = roA;

  // (c) THE SAME MIX AT 300.
  await typeInto(byTid(cA, 'promo-volume-amount'), '300');
  P_.cDelivered = num(cA, 'promo-preview-adjusted');
  P_.cBand = txt(byTid(cA, 'promo-mix-target-range'));
  P_.cScope = txt(byTid(cA, 'promo-lead-scope'));

  // (d) A TYPED COHORT TARGET at 3,000.
  const cD = await openPromo({ subs: 3000 });
  const beforeD = pShares(cD);
  const boxD = byTid(cD, 'promo-mix-target');
  await commitBox(boxD, '15.00');
  P_.dShares = beforeD + ' -> ' + pShares(cD);
  P_.dDelivered = num(cD, 'promo-preview-adjusted');
  P_.dBox = boxD?.value;
  // and a DRAG under that target — the coverage value-padlock (h) held in blend units
  const tsD = promoTiers(cD);
  const fromD = Number(byTid(cD, 'promo-mix-range-' + tsD[1]).value);
  await setRange(byTid(cD, 'promo-mix-range-' + tsD[1]), Math.max(0, Math.min(100, fromD > 50 ? fromD - 5 : fromD + 5)));
  P_.dAfterDrag = num(cD, 'promo-preview-adjusted');

  // (e) DILUTION -20% at 3,000 on the tilted mix.
  const cE = await openPromo({ subs: 3000 });
  await tiltPromo(cE);
  await clickIt(byTid(cE, 'promo-pricing-arm'));
  await clickIt(byTid(cE, 'promo-pricing-mode-dilution'));
  await typeInto(byTid(cE, 'promo-dilution-current'), '0');
  await typeInto(byTid(cE, 'promo-dilution-target'), '20');
  P_.eDelivered = num(cE, 'promo-preview-adjusted');

  // (f) ABOVE THE BAND.
  const cF = await openPromo({ subs: 3000 });
  const nF = (txt(byTid(cF, 'promo-mix-target-range')).match(/-?\d+\.\d+/g) || []).map(Number);
  await commitBox(byTid(cF, 'promo-mix-target'), String(Math.round((nF[1] ?? 0) + 5)));
  P_.fBand = nF.join(' - ');
  P_.fBlocked = txt(byTid(cF, 'promo-mix-target-blocked'));
  P_.fTopRate = Math.max(...promoTiers(cF).map(t => promoRate(cF, t)));

  // (g) RETENTION: its own month.
  const cG = await openPromo({ target: 'Retention', subs: 3000 });
  P_.gLead = txt(byTid(cG, 'promo-preview')).slice(0, 70);
  P_.gLabel = txt(byTid(cG, 'promo-mix-target')?.closest('div')?.parentElement?.querySelector('label'));

  // (h) A 3-MONTH SPREAD.
  const cH = await openPromo({ subs: 3000, months: 3 });
  P_.hScope = txt(byTid(cH, 'promo-lead-scope'));
  P_.hDelivered = num(cH, 'promo-preview-adjusted');

  {
    const cH1 = await openPromo({ subs: 1000 });
    P_.h1000single = num(cH1, 'promo-preview-adjusted');
    P_.hShares = pShares(cH);
    P_.hBlend = num(cH, 'promo-blend');
    P_.h1000Blend = num(cH1, 'promo-blend');
    P_.hRates = promoTiers(cH).map(t => promoRate(cH, t));
    const cFc = await openPromo({ subs: 3000, basis: 'forecast' });
    P_.forecastBasisEven = num(cFc, 'promo-preview-baseline') + ' -> ' + num(cFc, 'promo-preview-adjusted')
      + ' blend ' + num(cFc, 'promo-blend') + ' rates ' + promoTiers(cFc).map(t => promoRate(cFc, t)).join('/');
    await tiltPromo(cFc);
    P_.forecastBasisTilted = num(cFc, 'promo-preview-adjusted') + ' blend ' + num(cFc, 'promo-blend');
  }
  // (i) THE VALUE CARD, unchanged.
  const cI = await openWith({}, 'value');
  P_.iLead = txt(byTid(cI, 'yield-preview'));
  P_.iBand = txt(byTid(cI, 'yield-mix-target-range'));

  if (PROBE) console.log('PROBE P ' + JSON.stringify(P_, null, 1));
  // ── THE LITERALS, HAND-CHECKED ENGINE-DIRECT ──────────────────────────────
  // Each figure below was reproduced by driving computeAdjustedForecast directly
  // (scratchpad d620-check / d621-spread / d622-ret) with THIS mount's inputs:
  // the 4,000-row slice for the tier rates (Low 5.8568 / Medium 15.7229 / High
  // 41.9945 on the Historical basis), seed 10,000, a Corporate draft at 2026-10.
  // The 1008 harness's literals (16.56, 30.91, 14.19, 15.59) used ALL rows and so
  // a different rate set; they are the same mechanism at different rates.
  const within = (x: number, y: number, tol = 0.01) => Number.isFinite(x) && Math.abs(x - y) <= tol + 1e-9;

  // (a) Historical basis (clause 14 HELD — see the report): an even mix is a pool
  // at the equal-weight of the rates, 21.19, above the fitted 13.88, so it RAISES
  // the cohort's Inflow ARPU. Engine-direct: 13.8808 -> 15.0299.
  check('(a) the lead reads the fitted Inflow ARPU at the promotion month', within(P_.aBaseline, 13.88),
    String(P_.aBaseline));
  check('(a) an even mix on the Historical basis delivers 15.03 (engine 15.0299)', within(P_.aDelivered, 15.03),
    String(P_.aDelivered));
  // ON THE FORECAST BASIS the rates are scaled so their equal-weight IS the fitted
  // figure, so an even mix delivers exactly fitted — the brief's (a), which is why
  // clause 14 matters, asserted through the toggle that stays.
  check('(a) on the Forecast basis an even mix delivers the fitted figure (13.88 -> 13.88)',
    String(P_.forecastBasisEven).startsWith('13.88 -> 13.88 blend 13.88'), String(P_.forecastBasisEven));

  // (b) TILTED 10/20/70 at 3,000 — engine 16.9057, blend 33.1264.
  check('(b) the tilt landed 10 / 20 / 70 by rate', P_.bShares === '70.000,10.000,20.000', P_.bShares);
  check('(b) the lead reads 16.91 (engine 16.9057)', within(P_.bDelivered, 16.91), String(P_.bDelivered));
  check('(b) and the demoted blend line reads 33.13 (engine 33.1264)', within(P_.bBlend, 33.13), String(P_.bBlend));
  check('(b) the label names cohort, scenario and the promotion month',
    String(P_.bLabel).startsWith('All Inflow ARPU, Oct 2026'), P_.bLabel);
  check('(b) the caption names the volume', P_.bScope === "with this promotion's 3000.00 subscribers at this mix", P_.bScope);

  // (c) THE SAME MIX AT 300 — engine 14.2331. The pool is volume-weighted, so the
  // figure AND the band both move, and the band narrows.
  check('(c) at 300 subscribers the lead reads 14.23 (engine 14.2331)', within(P_.cDelivered, 14.23), String(P_.cDelivered));
  const bandNums = (t: string) => (String(t).match(/-?\d+\.\d+/g) || []).map(Number);
  const [b3lo, b3hi] = bandNums(P_.bBand), [b0lo, b0hi] = bandNums(P_.cBand);
  check('(c) the band MOVED with the volume, both ends', b3lo !== b0lo && b3hi !== b0hi, P_.bBand + ' vs ' + P_.cBand);
  check('(c) and NARROWED', (b0hi - b0lo) < (b3hi - b3lo), P_.bBand + ' vs ' + P_.cBand);
  check('(c) the caption follows the volume', String(P_.cScope).includes('300.00'), P_.cScope);

  // (d) A TYPED COHORT TARGET.
  const [dBefore, dAfter] = String(P_.dShares).split(' -> ');
  check('(d) the sliders moved', dBefore !== dAfter, P_.dShares);
  check('(d) the lead lands within a penny of 15.00', within(P_.dDelivered, 15.00), String(P_.dDelivered));
  check('(d) and the box still reads what was typed', P_.dBox === '15.00', String(P_.dBox));
  check('(d) a drag under the target keeps the lead on it', within(P_.dAfterDrag, 15.00), String(P_.dAfterDrag));

  // (e) DILUTION -20% — engine 15.8644, below the undiluted 16.91.
  check('(e) a -20% dilution lowers the delivered figure to 15.86 (engine 15.8644)',
    within(P_.eDelivered, 15.86) && P_.eDelivered < P_.bDelivered, String(P_.eDelivered));

  // (f) ABOVE THE BAND.
  check('(f) a target above the band is BLOCKED', !!P_.fBlocked, 'no blocked message');
  check('(f) naming the binding tier', String(P_.fBlocked).includes('High Value'), P_.fBlocked);
  check('(f) at the COHORT ceiling, not the tier rate',
    String(P_.fBlocked).includes(Number(String(P_.fBand).split(' - ')[1]).toFixed(2))
      && !String(P_.fBlocked).includes(Number(P_.fTopRate).toFixed(2)),
    P_.fBlocked + ' | band ' + P_.fBand + ' | top rate ' + P_.fTopRate);

  // (g) RETENTION reads its OWN month — engine 13.8808 -> 15.5331.
  check('(g) a Retention promotion leads with Retention ARPU at its own month',
    String(P_.gLead).startsWith('All Retention ARPU, Oct 2026') && String(P_.gLead).includes('15.53'), P_.gLead);
  check('(g) and the target label names that month', P_.gLabel === 'Target Retention ARPU at Oct 2026', P_.gLabel);

  // (h) A 3-MONTH SPREAD reads its FIRST month with that month's volume (clause 13).
  check('(h) the caption says first month of 3, at 1,000', P_.hScope === "with this promotion's 1000.00 subscribers at this mix, first month of 3", P_.hScope);
  check('(h) and the figure is a single month at 1,000 (engine 14.3087, later rows inert)',
    within(P_.hDelivered, 14.31) && P_.hDelivered === P_.h1000single, P_.hDelivered + ' vs ' + P_.h1000single);

  // (i) THE VALUE CARD, its own literals (0706's), unchanged.
  check('(i) the Value card lead is unchanged', P_.iLead === 'All Inflow ARPU, Nov 202613.87 → 13.87+0.00%at Nov 2026 only', P_.iLead);
  check('(i) and its band is unchanged', P_.iBand === 'Reachable: 3.83 – 27.49', P_.iBand);



  // ── CLAUSE 14 (A): EVERY NEW DRAFT OPENED ON FORECAST ─────────────────────
  check('(14A) every new promotion draft in this file opened on the Forecast basis',
    basisOnOpen.length >= 8 && basisOnOpen.every(b => b === 'forecast'), basisOnOpen.join(','));

  // ══ SECTION X — ONE SOLVER, ONE ROW BUILDER, ONE ENGINE (clause 15) ═══════
  // Structural, because the failure they guard is BEHAVIOURALLY INVISIBLE the
  // moment it lands: a preview-local copy of the row builder returns the same rows
  // today and drifts from the save path the next time either is edited. Comments
  // are stripped first, so an explanatory mention cannot satisfy a count.
  {
    const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    // RE-AIMED 2026-09-24 (REQ-D7-02 clause 11): the seam's BODY moved verbatim
    // to src/utils/eventScopeSeries.ts; WhatIfTab keeps a thin wrapper. The seam is now
    // those two files, so the source read here is both — the counts are unchanged.
    const tab = strip(fs.readFileSync('src/components/WhatIfTab.tsx', 'utf8') + '\n' + fs.readFileSync('src/utils/eventScopeSeries.ts', 'utf8'));
    const mix = strip(fs.readFileSync('src/utils/mixConstraint.ts', 'utf8'));
    const count = (t: string, needle: string) => t.split(needle).length - 1;
    check('(X) buildPromoEvents: 1 definition + 3 save paths + the preview = 5',
      count(tab, 'buildPromoEvents(') === 5, String(count(tab, 'buildPromoEvents(')));
    check('(X) and the preview reaches it through promoRowsFor, not a wrapper',
      tab.includes('const promoRowsFor = useCallback(') && count(tab, 'return buildPromoEvents({') === 1,
      'a second path to the rows is a second definition of the promotion');
    check('(X) solveForCohortTarget is DEFINED once, in mixConstraint, and nowhere in the tab',
      count(mix, 'function solveForCohortTarget(') === 1 && count(tab, 'function solveForCohortTarget') === 0
        && !/const solveForCohortTarget\s*=/.test(tab),
      'a second solver is the STOP');
    check('(X) the engine is still called at 6 sites (1 definition + 5 calls)',
      count(tab, 'computeAdjustedForecast(') === 6, String(count(tab, 'computeAdjustedForecast(')));
    check('(X) the seam has 5 callers — the promotion measure is the fifth',
      count(tab, 'eventScopeSeriesFor(') === 5 && tab.includes('const promoMeasure = useCallback('),
      String(count(tab, 'eventScopeSeriesFor(')));
  }

  report();
}

function report() {
  console.log(`\npromo-cohort-target spec: ${pass}/${pass + fails.length} passed`);
  fails.forEach(f => console.log('  FAIL  ' + f));
  if (!fails.length) console.log('  every check green');
  process.exit(fails.length ? 1 : 0);
}

main().catch(e => { console.error('promo-cohort-target spec CRASHED —', e); process.exit(1); });
