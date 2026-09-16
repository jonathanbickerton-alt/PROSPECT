/**
 * THE VALUE CARD'S COHORT TARGET, DRIVEN THROUGH THE RENDERED DOM.
 *
 *   npm run spec:value-cohort-target
 *
 * REQ-D6-07 (Alessandro, UAT 2026-09-15; clauses 6-11 in EXPECTED.md). The card
 * used to lead with a COMPARATOR — two blended ARPUs whose ratio the forecast
 * applies — and take a target in those same blend units. A reader who wanted
 * "Corporate's Inflow ARPU at November" had to apply the ratio themselves, and a
 * target typed in cohort units silently meant something else.
 *
 * WHAT THIS PINS, in the order the card is filled in:
 *
 *  (a) the lead is the cohort pair, and a flat mix delivers the fitted figure
 *      unchanged - the case where a correct card must say "nothing happens";
 *  (b) a typed cohort target moves the sliders, the lead lands on the target,
 *      and the box still reads what was typed - never the solver's own blend;
 *  (c) the same target lands with a tier rate OVERRIDDEN, which moves the blend
 *      the solve must find without moving the answer the user asked for;
 *  (d) a target above the cohort band is BLOCKED, naming the binding tier, and
 *      the readout is stated in cohort terms;
 *  (e) clause 11's refusals are TEXT, not silence;
 *  (f) the label names the READ month - the month after the draft's for an
 *      Inflow event, the draft's own for a Retention one;
 *  (g) the arithmetic is one click away and closed by default.
 *
 * And Item 2: the events summary cell states the RATIO, with the pair in the
 * title; Compare renders no title at all.
 *
 * WHY A SIBLING FILE. The same reasoning value-padlock-mounted's header gives:
 * this file owns its own mounts, so a mistake here can only break this. The
 * harness below is that spec's, deliberately - the card is the same card, and
 * two different mounts of one card would be two different fixtures to reconcile
 * every time either moved.
 *
 * THE MOUNT IS ASSERTED BEFORE ANY OF IT: a selector matching nothing would
 * take every check below it vacuously green.
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
    console.log(`\nvalue-cohort-target spec: UNREACHABLE — fixture missing at ${FIX}`);
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

  // ── THE MOUNT RESOLVED ────────────────────────────────────────────────────
  const { c: c1 } = await openValueCard();
  const tiers1 = tiersIn(c1);
  check('mount: the Value card seeded at least three tiers', tiers1.length >= 3,
    `${tiers1.length} tiers`);
  const leadOf = (c: any) => (c.querySelector('[data-testid="yield-preview"]') as any)?.textContent ?? '';
  const baselineIn = (c: any) => Number(
    (c.querySelector('[data-testid="yield-preview-baseline"]') as any)?.textContent);
  const deliveredIn = (c: any) => Number(
    (c.querySelector('[data-testid="yield-preview-adjusted"]') as any)?.textContent);
  const pctIn = (c: any) => ((c.querySelector('[data-testid="yield-preview-pct"]') as any)?.textContent ?? '').trim();
  const boxOf = (c: any) => c.querySelector('[data-testid="yield-mix-target"]') as any;
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
  if (tiers1.length < 3) { report(); return; }

  // ── (a) THE LEAD IS THE COHORT PAIR, AND A FLAT MIX CHANGES NOTHING ───────
  // The card opens on an even mix over the fitted rates, so blend and
  // equal-weight are the same number, the ratio is exactly 1, and the delivered
  // figure must equal the fitted one. A card that "helpfully" reported movement
  // here would be reporting its own rounding.
  check('(a) the lead names the cohort, the scenario and the READ month',
    /Inflow ARPU/.test(leadOf(c1)) && leadOf(c1).includes(fmtM(baseForecast.months[4].month)),
    leadOf(c1).slice(0, 80));
  check('(a) the pair is present and the flat mix delivers the fitted figure',
    Number.isFinite(baselineIn(c1)) && baselineIn(c1) === deliveredIn(c1),
    `${baselineIn(c1)} -> ${deliveredIn(c1)}`);
  check('(a) and says so as +0.00%, not as a blank',
    pctIn(c1) === '+0.00%', pctIn(c1));
  console.log(`  (a) fitted ${baselineIn(c1)} -> delivered ${deliveredIn(c1)} ${pctIn(c1)}`);

  // ── (b) A TYPED COHORT TARGET ────────────────────────────────────────────
  // Typed to FOUR decimals deliberately: the chart's ARPU columns are written
  // to two, so a solve that read them could not tell this target from the
  // fitted figure. Clause 6 is why the seam carries the unrounded pair.
  const fitted = baselineIn(c1);
  const TARGET = Number((fitted + 0.4161).toFixed(4));
  const box1 = boxOf(c1);
  const before1 = tiers1.map(t => Number(rangeOf(c1, t).value));
  await typeInto(box1, String(TARGET));
  await pressEnter(box1);
  const after1 = tiers1.map(t => Number(rangeOf(c1, t).value));
  check('(b) Enter moved the sliders', after1.some((v, k) => v !== before1[k]),
    `${before1.join(',')} -> ${after1.join(',')}`);
  check('(b) the lead lands on the target, to the displayed penny',
    Math.abs(deliveredIn(c1) - TARGET) <= 0.01,
    `delivered ${deliveredIn(c1)} vs target ${TARGET}`);
  check('(b) and the box still reads exactly what was typed',
    boxOf(c1).value === String(TARGET), boxOf(c1).value);
  // TRAP 246's shape: the blend the solver found is NOT the typed figure, and
  // showing the one where the other belongs is the whole defect.
  const rateOf = (c: any, t: string) => Number(
    (c.querySelector(`[data-testid="tier-arpu-override-${t}"]`) as any).placeholder);
  const blendOf = (c: any, ts: string[]) =>
    ts.reduce((s, t) => s + Number(rangeOf(c, t).value) / 100 * rateOf(c, t), 0);
  const blend1 = blendOf(c1, tiers1);
  check('(b) the blend the solve found is a DIFFERENT number from the target',
    Math.abs(blend1 - TARGET) > 0.01,
    `blend ${blend1.toFixed(4)} vs cohort target ${TARGET} — if these matched, the card is still in blend units`);
  console.log(`  (b) typed ${TARGET}: delivered ${deliveredIn(c1)}, blend ${blend1.toFixed(4)},`
    + ` shares ${after1.map(v => v.toFixed(3)).join(', ')}`);

  // ── (c) THE SAME TARGET, WITH A RATE OVERRIDDEN ──────────────────────────
  // An override moves the blend that reaches a given cohort figure. The answer
  // the user asked for does not move, which is the point of solving in cohort
  // units at all.
  const { c: c3 } = await openValueCard();
  const tiers3 = tiersIn(c3);
  const ovBox = c3.querySelector(`[data-testid="tier-arpu-override-${tiers3[0]}"]`) as any;
  const OV = Number((rateOf(c3, tiers3[0]) * 1.35).toFixed(4));
  await typeInto(ovBox, String(OV));
  const box3 = boxOf(c3);
  await typeInto(box3, String(TARGET));
  await pressEnter(box3);
  check('(c) the override took', Number(ovBox.value) === OV, ovBox.value);
  check('(c) and the same cohort target still lands',
    Math.abs(deliveredIn(c3) - TARGET) <= 0.01,
    `delivered ${deliveredIn(c3)} vs target ${TARGET}`);
  const blend3 = blendOf(c3, tiers3);
  check('(c) by a DIFFERENT blend than the un-overridden case',
    Math.abs(blend3 - blend1) > 0.01, `${blend3.toFixed(4)} vs ${blend1.toFixed(4)}`);
  console.log(`  (c) override ${tiers3[0]} -> ${OV}: delivered ${deliveredIn(c3)}, blend ${blend3.toFixed(4)}`);

  // ── (d) ABOVE THE BAND: BLOCKED, IN COHORT TERMS ─────────────────────────
  const { c: c4 } = await openValueCard();
  const ro4 = c4.querySelector('[data-testid="yield-mix-target-range"]') as any;
  const n4 = ((ro4?.textContent) || '').match(/-?\d+\.\d+/g) || [];
  check('(d) the readout states a cohort interval', n4.length === 2, ro4?.textContent || 'absent');
  const hi4 = Number(n4[1] ?? 0);
  // THE READOUT IS THE COHORT BAND, not the blend band. Asserted by BOUNDS
  // rather than by literals: the blend band's top is the richest tier's own
  // rate, and the cohort band cannot reach it, because the ratio that gets
  // there is applied to a fitted ARPU that is a different number.
  const topRate = Math.max(...tiersIn(c4).map(t => rateOf(c4, t)));
  check('(d) and it is the COHORT band, not the blend band',
    Math.abs(hi4 - topRate) > 0.01,
    `readout top ${hi4} vs richest tier rate ${topRate} — equal means the blend band leaked back`);
  const box4 = boxOf(c4);
  await typeInto(box4, String(Math.round(hi4 + 10)));
  await pressEnter(box4);
  const blocked4 = c4.querySelector('[data-testid="yield-mix-target-blocked"]') as any;
  check('(d) a target above the band is BLOCKED, and says so', !!blocked4,
    'an unreachable target must be shown, not silently ignored');
  check('(d) and the blocked message names the binding tier',
    !!blocked4 && tiersIn(c4).some(t => (blocked4.textContent || '').includes(t)),
    blocked4?.textContent || '');
  // THE DISCRIMINATOR. The blend wall and the cohort ceiling sit within a few
  // pence of each other on this fixture (27.51 against 27.49), so a sentence
  // quoting the wrong one still reads plausibly. It must carry the READOUT's
  // number, and must not carry the richest tier's rate.
  check('(d) and the sentence quotes the COHORT ceiling, not the tier rate',
    !!blocked4 && (blocked4.textContent || '').includes(String(n4[1]))
      && !(blocked4.textContent || '').includes(topRate.toFixed(2)),
    `${blocked4?.textContent} — readout top ${n4[1]}, tier rate ${topRate.toFixed(2)}`);
  check('(d) and the shares were not clamped to the nearest reachable mix',
    (c4.querySelector('[data-testid="yield-mix-target-apply"]') as any).disabled === true);
  console.log(`  (d) cohort band [${n4[0]}, ${n4[1]}], richest tier ${topRate.toFixed(4)};`
    + ` blocked: ${(blocked4?.textContent || '').slice(0, 90)}`);

  // ── (e) CLAUSE 11: A REFUSAL IS STATED ───────────────────────────────────
  // Every tier rate overridden to zero: the engine's ratio falls back to 1, so
  // every mix delivers the same figure and no target could ever be reached.
  // The old card would have accepted the number and moved the sliders to no
  // effect — a control that appears to work and does not.
  const { c: c5 } = await openValueCard();
  for (const t of tiersIn(c5)) {
    await typeInto(c5.querySelector(`[data-testid="tier-arpu-override-${t}"]`) as any, '0');
  }
  const box5 = boxOf(c5);
  await typeInto(box5, '15');
  await pressEnter(box5);
  const refused5 = c5.querySelector('[data-testid="yield-target-refused-no-rates"]') as any;
  check('(e) a draft with no stored rates REFUSES, in words', !!refused5,
    (c5.querySelector('[data-testid="yield-mix-target-blocked"]') as any)?.textContent
      ?? 'no refusal and no blocked message — the card said nothing');
  check('(e) and the refusal is the keyed sentence, not a diagnostic',
    !!refused5 && refused5.textContent === EN_REFUSE_NO_RATES,
    refused5?.textContent || '');

  // ── (f) THE LABEL NAMES THE READ MONTH ───────────────────────────────────
  const labelOf = (c: any) => {
    const b = c.querySelector('[data-testid="yield-mix-target"]')?.closest('div')?.parentElement;
    return (b?.querySelector('label')?.textContent) || '';
  };
  check('(f) Inflow: the label names the month AFTER the draft month',
    labelOf(c1).includes(fmtM(baseForecast.months[4].month))
      && !labelOf(c1).includes(fmtM(MONTH)),
    `${labelOf(c1)} — draft ${fmtM(MONTH)}, read ${fmtM(baseForecast.months[4].month)}`);
  const { c: c6 } = await openValueCard([], 'Retention');
  check('(f) Retention: the label names the DRAFT month',
    labelOf(c6).includes(fmtM(MONTH)), labelOf(c6));
  check('(f) and the Retention lead reads at that same month',
    (leadOf(c6)).includes(fmtM(MONTH)), leadOf(c6).slice(0, 80));
  console.log(`  (f) inflow label "${labelOf(c1)}" / retention label "${labelOf(c6)}"`);

  // ── (g) THE ARITHMETIC IS ONE CLICK AWAY ─────────────────────────────────
  const det = c1.querySelector('[data-testid="yield-how-computed"]') as any;
  check('(g) the collapsed line exists', !!det);
  check('(g) and is CLOSED by default', !!det && det.open !== true);
  check('(g) the two blends are inside it, not beside the lead',
    !!det && /\d/.test(det.textContent || '')
      && !!det.querySelector('[data-testid="yield-ratio-caption"]'),
    'the caption is re-homed, not deleted');
  if (det) {
    await (act as any)(async () => { det.open = true; det.dispatchEvent(new dom.window.Event('toggle', { bubbles: true })); });
    check('(g) and it opens', det.open === true);
  }
  // THE LEAD COMES FIRST IN THE DOCUMENT, which is what "leads" means.
  const leadEl = c1.querySelector('[data-testid="yield-preview"]') as any;
  check('(g) the lead precedes the arithmetic in document order',
    !!leadEl && !!det && (leadEl.compareDocumentPosition(det) & 4) !== 0,
    'the card answers first and shows its working second');

  // ── ITEM 2: THE SUMMARY CELL, AND WHAT RIDES IN ITS TITLE ────────────────
  // A SAVED event, so this is the row a reader actually meets. The cell states
  // the ratio — arithmetic on the event alone, true wherever it lands — and the
  // title states the pair at the read month, which belongs to this run.
  const savedRates: Record<string, number> = {};
  for (const t of tiers1) savedRates[t] = rateOf(c1, t);
  const savedMix: Record<string, number> = {};
  tiers1.forEach((t, k) => { savedMix[t] = k === 0 ? 20 : (k === 1 ? 30 : 50); });
  const equalWeight = tiers1.reduce((sum, t) => sum + savedRates[t], 0) / tiers1.length;
  const blendSaved = tiers1.reduce((sum, t) => sum + savedMix[t] / 100 * savedRates[t], 0);
  const expectedPct = (blendSaved / equalWeight - 1) * 100;
  const { c: cS } = await openValueCard([{
    id: 'saved-y', name: 'Saved yield', ibro: 'Inflow', segment: 'All', product: 'All',
    channelL1: 'All', channelL2: 'All', month: MONTH, mixAxis: 'value',
    tariffMix: savedMix, tariffBaseArpu: savedRates, rollForward: false, comment: '',
  }]);
  // The panel is collapsed until it is opened, exactly as a reader finds it.
  const sumToggle = cS.querySelector('[data-testid="events-summary-toggle"]') as any;
  if (sumToggle) await clickIt(sumToggle);
  const cell = cS.querySelector('[data-testid="events-summary-adjusts-saved-y"]') as any;
  check('(item 2) the summary cell exists for the saved yield row', !!cell,
    'without the row there is nothing to assert about');
  const wantPct = (expectedPct >= 0 ? '+' : '-') + Math.abs(expectedPct).toFixed(1) + '%';
  check('(item 2) and states the RATIO the forecast applies',
    !!cell && cell.textContent === `Inflow ARPU ${wantPct}`,
    `${cell?.textContent} — by hand blend ${blendSaved.toFixed(4)} / equal-weight ${equalWeight.toFixed(4)}`);
  check('(item 2) and NOT the blend, which is a money figure in other units',
    !!cell && !cell.textContent.includes(blendSaved.toFixed(2)), cell?.textContent);
  const title = cell?.getAttribute('title') ?? '';
  check('(item 2) the pair rides in the title, at the READ month',
    title.includes(baseForecast.months[4].month)
      && (title.match(/[0-9]+[.][0-9][0-9]/g) ?? []).length === 2,
    title || 'no title');
  console.log(`  (item 2) cell "${cell?.textContent}" title "${title}"`);

  // ── 1.3: THE PROMOTION ARM IS UNTOUCHED ──────────────────────────────────
  // The panel is SHARED, and every cohort prop it gained is optional precisely
  // so that the arm which passes none renders what it rendered before. The
  // literals are hand-written rather than read from the Value card: comparing
  // the two cards to each other would pass just as happily if BOTH had changed.
  host.replaceChildren();
  const cp = document.createElement('div');
  host.appendChild(cp);
  const rootP = createRoot(cp);
  await (act as any)(async () => { rootP.render(withProvider(React.createElement(M, whatIfProps()))); });
  await clickIt(cp.querySelector('[data-testid="whatif-tab-promotion"]') as any);
  let mixBox: any = null;
  for (const b of [...cp.querySelectorAll('input[type=checkbox]')] as any[]) {
    const label = b.closest('label')?.textContent || b.parentElement?.textContent || '';
    if (/mix/i.test(label)) { mixBox = b; break; }
  }
  if (mixBox) await clickIt(mixBox);
  const promoLabelEl = cp.querySelector('[data-testid="promo-mix-target"]')
    ?.closest('div')?.parentElement?.querySelector('label') as any;
  check('(1.3) the Promotion arm keeps the BLEND label, byte for byte',
    (promoLabelEl?.textContent ?? '') === 'Target blended ARPU',
    promoLabelEl?.textContent ?? 'no panel — the mix arm did not open');
  const promoRo = cp.querySelector('[data-testid="promo-mix-target-range"]') as any;
  check('(1.3) and its readout still begins with the blend wording',
    (promoRo?.textContent ?? '').startsWith('Reachable: '),
    promoRo?.textContent ?? 'no readout');

  check('the run exercised every case',
    tiers1.length >= 3 && tiers3.length >= 3 && tiersIn(c4).length >= 3,
    `${tiers1.length}/${tiers3.length}/${tiersIn(c4).length}`);

  report();
}

function report() {
  console.log(`\nvalue-cohort-target spec: ${pass}/${pass + fails.length} passed`);
  fails.forEach(f => console.log('  FAIL  ' + f));
  if (!fails.length) console.log('  every check green');
  process.exit(fails.length ? 1 : 0);
}

main().catch(e => { console.error('value-cohort-target spec CRASHED —', e); process.exit(1); });
