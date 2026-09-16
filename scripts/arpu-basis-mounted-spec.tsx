/**
 * THE ARPU BASIS IS STORED ON THE EVENT — REQ-D6-07 clause 14, option (A).
 *
 *   npm run spec:arpu-basis
 *
 * Jon, 2026-09-16. The 1019 build held clause 14 (Forecast as the Promotion arm's
 * default) because the basis was not stored: a promotion saved on Historical,
 * reopened on the new default, re-derived its tier rates and rewrote its baked
 * ARPU on a no-change save (D5-04, 36 -> 35.6). Option (A) stores the basis as
 * `Tariff_ARPU_Basis` — last on Yield_Events, after Mode on Market_Events for a
 * promotion with a mix arm — and reads ABSENT as Historical.
 *
 * In fill-in order:
 *  (a) a promotion saved with no column reopens on HISTORICAL (the no-change
 *      save's rate is D5-04's own case in view-apply-mounted, quoted in the report);
 *  (b) a NEW promotion draft opens on FORECAST;
 *  (c) a yield event saved on Forecast round-trips as Forecast — through the card's
 *      save, the writer, a real workbook, the reader, and a reopen;
 *  (d) an old save without the column reads Historical for every row, both sheets;
 *  (e) the Value card's new draft opens on Forecast (D5-11, unchanged);
 *  (f) clause 16: after an Add the next draft opens on Forecast, and the added
 *      event still reopens on the basis it was saved with.
 *
 * The harness is promo-cohort-target's, so the tab mounts exactly as that spec's do.
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
    console.log(`\narpu-basis spec: UNREACHABLE — fixture missing at ${FIX}`);
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


  const basisButton = (c: any, which: 'historical' | 'forecast') =>
    [...c.querySelectorAll('button')].find((x: any) =>
      txt(x) === EN[which === 'historical' ? 'common_historical_arpu' : 'whatif_forecast_arpu']) as any;
  const basisPressed = (c: any): string => {
    const on = (b: any) => !!b && String(b.className).includes('bg-white text-slate-900');
    return on(basisButton(c, 'forecast')) ? 'forecast' : on(basisButton(c, 'historical')) ? 'historical' : 'none';
  };
  /** Through a REAL workbook: rows out, an xlsx buffer, rows back. */
  const throughXlsx = (rows: Record<string, unknown>[]) => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'S');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const back = XLSX.read(buf, { type: 'buffer' });
    return XLSX.utils.sheet_to_json(back.Sheets['S'], { defval: '' }) as Record<string, unknown>[];
  };
  const { buildPromoEvents } = await import('../src/components/WhatIfTab');
  const TIERS = [{ tier: 'Low Value', baseArpu: 5.86 }, { tier: 'Medium Value', baseArpu: 15.72 },
    { tier: 'High Value', baseArpu: 41.99 }];
  const promoRow = (basis?: 'historical' | 'forecast') => buildPromoEvents({
    target: 'Inflow', amountType: 'absolute',
    draft: { segment: 'All', product: 'All', productL2: 'All', channel: 'All', channelL2: 'All',
      tariffL1: 'All', tariffL2: 'All', date: MONTH, subscriberVolume: 3000, contractLength: 24,
      campaignName: '', comment: '' },
    mixEnabled: true, mixAxis: 'value',
    draftMix: { 'Low Value': 10, 'Medium Value': 20, 'High Value': 70 }, mixLocked: [], tierData: TIERS,
    pricingEnabled: false, pricingMode: 'percentage', pricingAmount: 0, cohortAvgArpu: null,
    shape: [{ offset: 0, fraction: 1 }], startSequence: 1,
    ...(basis ? { arpuBasis: basis } : {}),
  } as any)[0];

  // ── (a) A PROMOTION SAVED BEFORE THE COLUMN REOPENS ON HISTORICAL ──────────
  // The row is written by the real writer and the column then REMOVED, which is
  // exactly what a save from before clause 14 looks like to the reader.
  {
    const written = fc.marketEventExportRow(promoRow('forecast'));
    check('(a) the writer puts the column on a mix row', written.Tariff_ARPU_Basis === 'Forecast',
      String(written.Tariff_ARPU_Basis));
    const old: Record<string, unknown> = { ...written };
    delete old.Tariff_ARPU_Basis;
    const [back] = throughXlsx([old]).map(r => fc.marketEventFromRow(r, 'session'));
    check('(a) read back with no column, the promotion is HISTORICAL', back.arpuBasis === 'historical',
      String(back.arpuBasis));
    const c = await openWith({ marketEvents: [back] }, 'promotion');
    const edit = c.querySelector(`[data-testid="promo-row-edit-${back.id}"]`) as any;
    check('(a) its row edit control is present', !!edit, 'no promo-row-edit for the restored event');
    if (edit) await clickIt(edit);
    check('(a) and it REOPENS on Historical, not on the new default',
      basisPressed(c) === 'historical', basisPressed(c));
  }

  // ── (b) A NEW PROMOTION DRAFT OPENS ON FORECAST ─────────────────────────────
  {
    const c = await openWith({}, 'promotion');
    const mixBox = [...c.querySelectorAll('input[type=checkbox]')].find((b: any) =>
      txt(b.closest('label')) === EN['whatif_value_mix_arm']) as any;
    if (mixBox) await clickIt(mixBox);
    check('(b) a new promotion draft opens on FORECAST', basisPressed(c) === 'forecast', basisPressed(c));
    // and a promotion SAVED on Forecast reopens on Forecast, stamped by the builder
    const fRow = promoRow('forecast');
    check('(b) the builder stamps the basis on a mix row', fRow.arpuBasis === 'forecast', String(fRow.arpuBasis));
    const noMix = buildPromoEvents({
      target: 'Inflow', amountType: 'absolute',
      draft: { segment: 'All', product: 'All', productL2: 'All', channel: 'All', channelL2: 'All',
        tariffL1: 'All', tariffL2: 'All', date: MONTH, subscriberVolume: 100, contractLength: 24,
        campaignName: '', comment: '' },
      mixEnabled: false, mixAxis: 'value', draftMix: {}, mixLocked: [], tierData: TIERS,
      pricingEnabled: false, pricingMode: 'percentage', pricingAmount: 0, cohortAvgArpu: 20,
      shape: [{ offset: 0, fraction: 1 }], startSequence: 1, arpuBasis: 'forecast',
    } as any)[0];
    check('(b) and NOT on a promotion without a mix arm — no rates, no basis',
      noMix.arpuBasis === undefined && fc.marketEventExportRow(noMix).Tariff_ARPU_Basis === '',
      String(noMix.arpuBasis));
  }

  // ── (c) A YIELD EVENT SAVED ON FORECAST ROUND-TRIPS AS FORECAST ─────────────
  {
    const captured: any[] = [];
    const c = await openWith({ addYieldEvent: (e: any) => captured.push(e) }, 'value');
    check('(c) the Value card is on Forecast before saving', basisPressed(c) === 'forecast', basisPressed(c));
    const add = [...c.querySelectorAll('button')].find((b: any) => txt(b) === EN['whatif_add_yield_event']) as any;
    if (add) await clickIt(add);
    const saved = captured[0];
    check('(c) the card SAVED the basis', saved?.arpuBasis === 'forecast', String(saved?.arpuBasis));
    const row = saved ? fc.yieldEventExportRow(saved) : {};
    check('(c) the writer wrote Forecast', (row as any).Tariff_ARPU_Basis === 'Forecast',
      String((row as any).Tariff_ARPU_Basis));
    const [back] = throughXlsx([row as any]).map(r => fc.yieldEventFromRow(r));
    check('(c) and a real workbook reads it back as Forecast', back?.arpuBasis === 'forecast',
      String(back?.arpuBasis));
    // REOPEN — on Forecast, and a Historical one on Historical: the pair is the
    // discriminator, because the new default is Forecast and one reading alone
    // could not tell "restored" from "defaulted".
    const hist = { ...back, id: 'y-hist', arpuBasis: 'historical' as const };
    const c2 = await openWith({ yieldEvents: [back, hist] }, 'value');
    const e1 = c2.querySelector(`[data-testid="yield-edit-${back.id}"]`) as any;
    const e2 = c2.querySelector('[data-testid="yield-edit-y-hist"]') as any;
    check('(c) both yield rows have their edit control', !!e1 && !!e2, `${!!e1} ${!!e2}`);
    if (e2) await clickIt(e2);
    check('(c) a HISTORICAL yield event reopens on Historical', basisPressed(c2) === 'historical', basisPressed(c2));
    if (e1) await clickIt(e1);
    check('(c) and the FORECAST one on Forecast', basisPressed(c2) === 'forecast', basisPressed(c2));
  }

  // ── (d) AN OLD SAVE WITHOUT THE COLUMN READS HISTORICAL, EVERY ROW ──────────
  {
    const mRows = [promoRow('forecast'), promoRow('forecast'), promoRow()].map(e => {
      const r: Record<string, unknown> = { ...fc.marketEventExportRow(e) };
      delete r.Tariff_ARPU_Basis; return r;
    });
    const yRows = [0, 1].map(i => {
      const r: Record<string, unknown> = { ...fc.yieldEventExportRow({ id: 'y' + i, ibro: 'Inflow', segment: 'All',
        product: 'All', channelL1: 'All', channelL2: 'All', month: MONTH, rollForward: false, mixAxis: 'value',
        tariffMix: { A: 50, B: 50 }, tariffBaseArpu: { A: 10, B: 20 }, arpuBasis: 'forecast' } as any) };
      delete r.Tariff_ARPU_Basis; return r;
    });
    const mBack = throughXlsx(mRows).map(r => fc.marketEventFromRow(r, 'session'));
    const yBack = throughXlsx(yRows).map(r => fc.yieldEventFromRow(r));
    check('(d) every Market_Events mix row without the column reads Historical',
      mBack.every((e: any) => e.arpuBasis === 'historical'), mBack.map((e: any) => e.arpuBasis).join(','));
    check('(d) every Yield_Events row without the column reads Historical',
      yBack.every((e: any) => e.arpuBasis === 'historical'), yBack.map((e: any) => e.arpuBasis).join(','));
    check('(d) the discriminator: WITH the column, the same rows read Forecast',
      throughXlsx([fc.marketEventExportRow(promoRow('forecast'))]).map(r => fc.marketEventFromRow(r, 'session'))[0].arpuBasis === 'forecast'
        && throughXlsx([fc.yieldEventExportRow({ ...(yRows[0] as any), id: 'yz', tariffMix: {}, tariffBaseArpu: {}, arpuBasis: 'forecast' } as any)])
          .map(r => fc.yieldEventFromRow(r))[0].arpuBasis === 'forecast',
      'a reader that ignored the column entirely would also pass the two lines above');
  }

  // ── (f) CLAUSE 16: AFTER AN ADD, THE NEXT DRAFT OPENS ON FORECAST ───────────
  // A PAIR, deliberately. "The next draft reads Forecast" alone would also pass if
  // the Add never stored Historical at all — the card would simply never have left
  // Forecast. So the event this Add wrote is reopened too, and must come back on
  // Historical: the basis was stored AND the draft was reset.
  {
    const captured: any[] = [];
    const c = await openWith({ addYieldEvent: (e: any) => captured.push(e) }, 'value');
    await clickIt(basisButton(c, 'historical'));
    check('(f) the user chose Historical before adding', basisPressed(c) === 'historical', basisPressed(c));
    const add = [...c.querySelectorAll('button')].find((b: any) => txt(b) === EN['whatif_add_yield_event']) as any;
    if (add) await clickIt(add);
    check('(f) the Add went through', captured.length === 1, String(captured.length));
    check('(f) and the NEXT draft opens on Forecast — the chosen basis did not carry',
      basisPressed(c) === 'forecast', basisPressed(c));
    const saved = captured[0];
    check('(f) the added event STORED Historical', saved?.arpuBasis === 'historical', String(saved?.arpuBasis));
    const c2 = await openWith({ yieldEvents: saved ? [{ ...saved, id: 'y-f' }] : [] }, 'value');
    const edit = c2.querySelector('[data-testid="yield-edit-y-f"]') as any;
    if (edit) await clickIt(edit);
    check('(f) the PAIR: that event reopens on Historical, so "reset" is not "never stored"',
      !!edit && basisPressed(c2) === 'historical', edit ? basisPressed(c2) : 'no edit control');
  }

  // ── (e) THE VALUE CARD'S NEW DRAFT OPENS ON FORECAST (D5-11) ────────────────
  {
    const c = await openWith({}, 'value');
    check('(e) the Value card opens a new draft on Forecast', basisPressed(c) === 'forecast', basisPressed(c));
  }

  report();
}

function report() {
  console.log(`\narpu-basis spec: ${pass}/${pass + fails.length} passed`);
  fails.forEach(f => console.log('  FAIL  ' + f));
  if (!fails.length) console.log('  every check green');
  process.exit(fails.length ? 1 : 0);
}

main().catch(e => { console.error('arpu-basis spec CRASHED —', e); process.exit(1); });
