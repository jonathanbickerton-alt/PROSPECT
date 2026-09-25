/**
 * ONE VIEWING STATE FOR STEPS 2 AND 3 — REQ-D7-03, driven through the DOM.
 *
 *   npm run spec:one-view
 *
 * On the fixture shaped as the 1855 inventory's (60 Corporate·Direct leaves
 * fitted to 2025-12; actuals over 540 leaves to 2026-06; the real seam). In the
 * order the brief fills them:
 *  (a) Corporate/Direct set on Step 2 through the REAL viewing bar; Step 3
 *      mounted: its bar reads Corporate/Direct and it scores that view; All/All
 *      set on Step 3, Step 2 remounted: All/All;
 *  (b) the View cell survives an .xlsx round trip — export at Corporate/Direct,
 *      load: both steps at Corporate/Direct; a save without the cell: All/All;
 *  (c) at Corporate/Direct, grouped by Segment + Product L1, clicking
 *      Corporate · Mobile Data narrows the bar to Corporate/Mobile Data/Direct
 *      (channel KEPT) and the chart shows it; Back returns Corporate/Direct and
 *      goes; a second click on the same row is nothing;
 *  (d) grouped by Segment only, clicking Corporate leaves Corporate/Direct — a row
 *      click never widens;
 *  (e) after a row click, a Segment change by hand retires Back;
 *  (f) the eight card titles carry the month (JUN 2026 by default, MAR 2026
 *      after the change); the figures' highlight class comes and goes;
 *  (g) Step 1's cohort selector is untouched by a view change (structural).
 *
 * WHERE THIS MOUNTS, AND ITS LIMIT. App is not mountable in this harness (see
 * ingest-spec's header). The steps, the bar and the transition are the REAL
 * ones — WhatIfTab, ForecastVsActualsTab, ViewFilterBar and viewFilter's
 * forecastForView — under a host that holds ONE view state exactly as App now
 * does. That App holds exactly that, and wires exactly those, is pinned
 * structurally in (X), so a second state or a second setter in App goes red.
 */
import { JSDOM } from 'jsdom';

const HIST = 'test-data/VBU_IBRO_Synthetic_ForecastTest_TariffHierarchy_Jan2023_Dec2025.xlsx';
const ACT  = 'test-data/VBU_IBRO_Synthetic_ForecastTest_TariffHierarchy_Jan2023_Jun2026.xlsx';
const C = { date: 'Month', seg: 'Customer_Segment', prod: 'Product_L1', prodL2: 'Product_L2_Value_Tier',
  chan: 'Channel_Level_1', chanL2: 'Channel_Level_2', t1: 'tariff_tier_l1', t2: 'tariff_tier_l2',
  metric: 'IBRO_Scenario_Type', val: 'Subscriber_Volume', rev: 'Monthly_Revenue_GBP' };
const M = '2026-03';

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

function report() {
  console.log(`\none-view spec: ${pass} passed, ${fails.length} failed`);
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
  const fc: any = await import('../src/utils/forecasting');
  const vf: any = await import('../src/utils/viewFilter');
  const { ForecastProvider } = await import('../src/context/ForecastContext');
  const FVA: any = (await import('../src/components/ForecastVsActualsTab')).ForecastVsActualsTab;
  const WhatIf: any = (await import('../src/components/WhatIfTab')).WhatIfTab;
  const { ViewFilterBar }: any = await import('../src/components/ViewFilterBar');
  const noop = () => {};

  for (const f of [HIST, ACT]) if (!fs.existsSync(f)) {
    console.log(`\none-view spec: UNREACHABLE — fixture missing at ${f}`); process.exit(1);
  }
  const load = (f: string) => (XLSX.utils.sheet_to_json(XLSX.read(fs.readFileSync(f), { cellDates: true }).Sheets['Fact_IBRO']) as any[]);
  const hist = load(HIST);
  const rows = load(ACT);
  const ym = (d: any) => { const x = d instanceof Date ? d : new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; };
  const leafOf = (r: any) => [C.seg, C.prod, C.prodL2, C.chan, C.chanL2, C.t1, C.t2].map(c => String(r[c] ?? 'All').trim()).join('|');

  // ── THE STORE: the 60 Corporate·Direct leaves, fitted on history to 2025-12 ──
  const byLeaf = new Map<string, any[]>();
  for (const r of hist) {
    const k = leafOf(r); const p = k.split('|');
    if (p[0] !== 'Corporate' || p[3] !== 'Direct') continue;
    if (!byLeaf.has(k)) byLeaf.set(k, []);
    byLeaf.get(k)!.push(r);
  }
  const store = new Map<string, any>();
  for (const [k, rs] of byLeaf) {
    const mm = new Map<string, any>(); let lastT = -1, seed: number | null = null;
    for (const r of rs) {
      const key = ym(r[C.date]);
      if (!mm.has(key)) mm.set(key, { _parsedDate: new Date(r[C.date]), inflow: 0, outflow: 0, retention: 0, subs: 0, rev: 0,
        iS: 0, iR: 0, oS: 0, oR: 0, rS: 0, rR: 0, bS: 0, bR: 0 });
      const e = mm.get(key); const v = Number(r[C.val]) || 0, rv = Number(r[C.rev]) || 0, m = String(r[C.metric]);
      e.subs += v; e.rev += rv;
      if (m === 'Inflow') { e.inflow += v; e.iS += v; e.iR += rv; }
      else if (m === 'Outflow') { e.outflow += v; e.oS += v; e.oR += rv; }
      else if (m === 'Retention') { e.retention += v; e.rS += v; e.rR += rv; }
      else if (m === 'Base') {
        e.bS += v; e.bR += rv;
        const t = new Date(r[C.date]).getTime();
        if (t > lastT) { lastT = t; seed = 0; }
        if (t === lastT) seed = (seed ?? 0) + v;
      }
    }
    const series = [...mm.values()].sort((a, b) => a._parsedDate - b._parsedDate).map(e => ({
      _parsedDate: e._parsedDate, inflow: e.inflow, outflow: e.outflow, retention: e.retention,
      arpu: e.subs ? e.rev / e.subs : 0, inflowArpu: e.iS ? e.iR / e.iS : 0, outflowArpu: e.oS ? e.oR / e.oS : 0,
      retentionArpu: e.rS ? e.rR / e.rS : 0, baseArpu: e.bS ? e.bR / e.bS : 0 }));
    const p = k.split('|');
    const bf = fc.calculateBaseForecast(series, { segment: p[0], product: p[1], productL2: p[2], channel: p[3],
      channelL2: p[4], tariffL1: p[5], tariffL2: p[6], scenario: 'Base Case' }, seed, 12, 1.0, 1.5, 3, 'Holt Linear');
    if (bf) store.set(fc.makeForecastKey(p[0], p[1], p[2], p[3], p[4], p[5], p[6]), bf);
  }
  const dm = fc.buildCohortDataMap(rows.map(r => ({ ...r, _parsedDate: new Date(r[C.date]) })),
    C.date, C.seg, C.prod, C.prodL2, C.chan, C.chanL2, C.t1, C.t2);
  const leafMap = fc.buildRollUpIndex(dm.keys()).leafMap;
  const resolveForecast = (key: string) => fc.resolveFromStore(store, leafMap, key);
  check('PREMISE: 60 leaves fitted', store.size === 60, String(store.size));

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
  const productTree = treeOf(C.prod, C.prodL2), channelTree = treeOf(C.chan, C.chanL2);
  const segments = [...new Set(rows.map(r => String(r[C.seg])))].sort();
  const MONTH0 = resolveForecast('All|All|All|All|All|All|All').forecast?.months[0]?.month;

  // ── THE HOST: ONE view state, App's setter and App's tab transition ─────────
  // `onView` is App's handleViewFilterChange verbatim in behaviour: set the one
  // state, resolve baseForecast through the seam, null included. The tab effect is
  // the REAL forecastForView. The bar is the REAL ViewFilterBar, reading the state.
  let step: 'whatif' | 'vsactuals' = 'whatif';
  let currentView: any = null;
  let currentBf: any = null;
  const viewWrites: any[] = [];
  const host = document.getElementById('root')!;
  let container: any; let root: any = null;
  const flush = async () => { await (act as any)(async () => {}); };
  const Host: React.FC<{ initial: any; step: 'whatif' | 'vsactuals' }> = ({ initial, step: stepNow }) => {
    const [view, setView] = (React as any).useState(initial);
    const [bf, setBf] = (React as any).useState(() => vf.forecastForView(stepNow, initial, resolveForecast).forecast);
    const onView = (f: any) => { viewWrites.push(f); setView(f); setBf(resolveForecast(vf.filterToKey(f)).forecast); };
    currentView = view; currentBf = bf;
    const [newEvent, setNewEvent] = (React as any).useState({
      scenario: 'Inflow', segment: 'All', product: 'All', productL2: 'All', channel: 'All', channelL2: 'All',
      tariffL1: 'All', tariffL2: 'All', date: MONTH0, subscriberVolume: 0, customerVolume: 0, revenue: 0, arpu: 0,
      name: '', campaignName: '', comment: '', contractLength: 24,
    });
    const bar = React.createElement(ViewFilterBar, {
      filter: view, onChange: onView, segments, productTree, channelTree, tariffTree: new Map(),
      hasForecast: !!resolveForecast(vf.filterToKey(view)).forecast, noForecastReason: null, onGoToStep1: noop,
    });
    const body = stepNow === 'whatif'
      ? React.createElement(WhatIf, {
          data: rows.slice(0, 4000),
          wiDateCol: C.date, wiSegmentCol: C.seg, wiProductCol: C.prod, wiProductL2Col: C.prodL2,
          wiChannelCol: C.chan, wiChannelL2Col: C.chanL2, wiMetricCol: C.metric,
          wiInflowVal: 'Inflow', wiRetentionVal: 'Retention', wiOutflowVal: 'Outflow',
          wiValueCol: C.val, wiRevenueCol: C.rev, wiArpuCol: '',
          productTree, channelTree, tariffTree: new Map<string, string[]>(), selectedTariffs: [], setSelectedTariffs: noop,
          cohortAvgArpu: 11.6, removeMarketEvent: noop,
          newEvent, setNewEvent, marketEvents: [], setMarketEvents: noop, addMarketEvent: noop, updateMarketEvent: noop,
          yieldEvents: [], updateYieldEvent: noop, removeYieldEvent: noop,
          pricingEvents: [], updatePricingEvent: noop, removePricingEvent: noop,
          newYieldEvent: {}, setNewYieldEvent: noop, addYieldEvent: noop, clearAllYieldEvents: noop,
          newPricingEvent: {}, setNewPricingEvent: noop, addPricingEvent: noop, clearAllPricingEvents: noop,
          downloadExcel: noop, formatNumber: (v: any) => Number(v).toFixed(2), setActiveView: noop, missingMonths: [],
          noForecastReason: resolveForecast(vf.filterToKey(view)).reason,
        })
      : React.createElement(FVA, {
          data: rows, wiDateCol: C.date, wiMetricCol: C.metric, wiValueCol: C.val,
          wiInflowVal: 'Inflow', wiOutflowVal: 'Outflow', wiRetentionVal: 'Retention', wiBaseVal: 'Base',
          wiSegmentCol: C.seg, wiProductCol: C.prod, wiProductL2Col: C.prodL2,
          wiChannelCol: C.chan, wiChannelL2Col: C.chanL2, wiTariffL1Col: C.t1, wiTariffL2Col: C.t2,
          wiRevenueCol: C.rev, wiArpuCol: '', activeFilter: view, onViewChange: onView,
          marketEvents: [], yieldEvents: [], pricingEvents: [],
          formatNumber: (x: any) => String(Math.round(Number(x))), setActiveView: noop, downloadExcel: noop,
        });
    return React.createElement(ForecastProvider as any, {
      baseForecast: bf, setBaseForecast: setBf, adjustedForecast: null, setAdjustedForecast: noop,
      forecastStore: store, setForecastStore: noop,
      resolveForecast, canResolve: (k: string) => !!resolveForecast(k).forecast,
      hasLegacyBaseline: true, updatedAt: new Date().toISOString(), bulkRuns: [], setBulkRuns: noop,
    }, React.createElement('div', null, bar, body));
  };
  /** Mount a step with the given view — App unmounts the step it leaves, and the
   *  view it carries over is App's one state (here: the view passed in). */
  const mount = async (s: 'whatif' | 'vsactuals', view: any) => {
    if (root) await (act as any)(async () => { root.unmount(); });
    host.replaceChildren(); container = document.createElement('div'); host.appendChild(container);
    root = createRoot(container); step = s;
    await (act as any)(async () => { root.render(React.createElement(Host, { initial: view, step: s })); });
    await flush();
  };

  // ── DOM READERS ────────────────────────────────────────────────────────────
  const setSelect = async (el: any, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value')!.set!;
    await (act as any)(async () => { setter.call(el, value); el.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    await flush();
  };
  const barDropdown = (label: string) => ([...container.querySelectorAll('span')] as any[])
    .find(s => (s.textContent || '').trim() === label && s.nextElementSibling?.querySelector('button[aria-haspopup]'))
    ?.nextElementSibling?.querySelector('button[aria-haspopup]') ?? null;
  const segSelect = () => ([...container.querySelectorAll('select')] as any[])
    .find(s => [...s.options].some((o: any) => o.value === 'Corporate')) ?? null;
  /** What the viewing bar SHOWS: Segment / Product / Channel. */
  const barReads = () => {
    const seg = segSelect()?.value ?? '?';
    const txt = (b: any) => ((b?.querySelector('span.truncate')?.textContent) || '?').trim();
    return `${seg}/${txt(barDropdown(i18n.t('common_product')))}/${txt(barDropdown(i18n.t('common_channel')))}`;
  };
  const ALLTXT = i18n.t('hierdrop_all');
  const chooseInBar = async (label: string, value: string) => {
    const trig = barDropdown(label); if (!trig) return false;
    await (act as any)(async () => { trig.click(); });
    await flush();
    const opt = ([...container.querySelectorAll('button[role="option"]')] as any[])
      .find(b => (b.textContent || '').trim() === value);
    if (!opt) return false;
    await (act as any)(async () => { opt.click(); });
    await flush();
    return true;
  };
  const groupBy = async (want: RegExp, on: boolean) => {
    const cb: any = ([...container.querySelectorAll('input[type=checkbox]')] as any[])
      .find((x: any) => want.test((x.closest('label')?.textContent || '').trim()));
    if (cb && cb.checked !== on && !cb.disabled) await (act as any)(async () => { cb.click(); });
    await flush();
    return !!cb && cb.checked === on;
  };
  const tableRows = () => ([...container.querySelectorAll('tbody tr')] as any[]).filter(tr => {
    const tds = [...tr.querySelectorAll('td')];
    return tds.length >= 5 && !/^\d{4}-\d{2}$/.test(((tds[0] as any)?.textContent || '').trim());
  });
  const rowLabeled = (label: string) => tableRows().find(tr =>
    ((tr.querySelector('td')?.childNodes[0]?.textContent) || '').trim() === label);
  const varianceAt = (scenario: string, month: string) => {
    for (const d of [...container.querySelectorAll('details')] as any[]) {
      if (!(d.querySelector('h4')?.textContent || '').trim().startsWith(scenario + ' ')) continue;
      for (const tr of [...d.querySelectorAll('tbody tr')] as any[]) {
        const td = [...tr.querySelectorAll('td')].map((x: any) => (x.textContent || '').trim());
        if (td[0] === month) return { actual: Number(td[1]), forecast: Number(td[2]) };
      }
    }
    return null;
  };
  const backBtn = () => container.querySelector('[data-testid="step3-back"]') as any;
  const titles = () => ([...container.querySelectorAll('p')] as any[])
    .filter(p => / MAPE( · .*)?$/.test((p.textContent || '').trim()) && p.nextElementSibling
      && (p.nextElementSibling.textContent || '').trim() === i18n.t('actuals_mape_lower_is_better'));
  const flashed = () => ([...container.querySelectorAll('p')] as any[]).filter(p => p.classList.contains('mape-month-flash'));

  // ── (a) ONE STATE: SET ON STEP 2, READ ON STEP 3, AND BACK ───────────────
  viewWrites.length = 0;
  await mount('whatif', vf.ALL_VIEW);
  check('(a) PREMISE: Step 2 opens at All/All', barReads() === `All/${ALLTXT}/${ALLTXT}`, barReads());
  if (segSelect()) await setSelect(segSelect(), 'Corporate');
  const chanSet = await chooseInBar(i18n.t('common_channel'), 'Direct');
  check('(a) Corporate/Direct set on Step 2 through the real bar', chanSet && barReads() === `Corporate/${ALLTXT}/Direct`, barReads());
  check('(a) and Step 2\'s forecast re-resolved to Corporate/Direct',
    currentBf?.cohort?.segment === 'Corporate' && currentBf?.cohort?.channel === 'Direct',
    JSON.stringify(currentBf?.cohort));
  await mount('vsactuals', currentView);
  check('(a) Step 3 mounted: its bar reads Corporate/Direct', barReads() === `Corporate/${ALLTXT}/Direct`, barReads());
  // THE DISCRIMINATOR. On this fixture All/All and Corporate/Direct resolve the
  // SAME 60 leaves, so no forecast figure can tell the views apart. The chart's
  // coverage can: every leaf with actuals under Corporate/Direct is covered (no
  // line), while All/All has actuals over 540 leaves (a partial-coverage line).
  const covLine = () => (container.querySelector('[data-testid="actuals-coverage-line"]')?.textContent || '').trim();
  check('(a) and it scores that view: full coverage at Corporate/Direct (no partial-coverage line)', covLine() === '', covLine());
  check('(a) and its forecast is Corporate/Direct\'s', vf.filterToKey(currentView) === 'Corporate|All|All|Direct|All|All|All'
    && currentBf?.cohort?.segment === 'Corporate', vf.filterToKey(currentView));
  if (segSelect()) await setSelect(segSelect(), 'All');
  await chooseInBar(i18n.t('common_channel'), ALLTXT);
  check('(a) All/All set on Step 3', barReads() === `All/${ALLTXT}/${ALLTXT}`, barReads());
  check('(a) and Step 3 now scores All/All: the partial-coverage line appears', covLine() !== '', covLine() || '(none)');
  await mount('whatif', currentView);
  check('(a) Step 2 remounted: All/All', barReads() === `All/${ALLTXT}/${ALLTXT}`, barReads());
  check('(a) and Step 2\'s forecast is All/All\'s', currentBf?.cohort?.segment === 'All' && currentBf?.cohort?.channel === 'All',
    JSON.stringify(currentBf?.cohort));

  // ── (b) THE VIEW CELL, THROUGH A REAL .xlsx ROUND TRIP ───────────────────
  const CD = vf.cohortToFilter({ segment: 'Corporate', product: 'All', channel: 'Direct' });
  const roundTrip = (metaRows: any[]) => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(metaRows), 'Metadata');
    const back = XLSX.read(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' });
    const metaRaw: any[] = XLSX.utils.sheet_to_json(back.Sheets['Metadata']);
    return (field: string) => metaRaw.find(r => r.Field === field)?.Value;
  };
  const baseMeta = [{ Field: 'Export_Timestamp', Value: 'x' }, { Field: 'PROSPECT_Version', Value: '1.0.0' },
    { Field: 'Active_Step', Value: 'vsactuals' }];
  const get = roundTrip([...baseMeta, vf.viewMetaRow(CD)]);
  console.log(`  (b) the View cell as saved: ${JSON.stringify(get('View'))}`);
  check('(b) the cell is the 7-part key', get('View') === 'Corporate|All|All|Direct|All|All|All', String(get('View')));
  const loaded = vf.viewFromMeta(get);
  await mount('vsactuals', loaded);
  check('(b) loaded: Step 3 at Corporate/Direct', barReads() === `Corporate/${ALLTXT}/Direct`, barReads());
  await mount('whatif', currentView);
  check('(b) and Step 2 at Corporate/Direct', barReads() === `Corporate/${ALLTXT}/Direct`
    && currentBf?.cohort?.segment === 'Corporate', barReads());
  const old = vf.viewFromMeta(roundTrip(baseMeta));
  await mount('vsactuals', old);
  check('(b) a save without the cell loads All/All', barReads() === `All/${ALLTXT}/${ALLTXT}` && vf.filterToKey(old) === 'All|All|All|All|All|All|All',
    `${barReads()} ${vf.filterToKey(old)}`);

  // ── (c) A ROW CLICK NARROWS; BACK RETURNS ────────────────────────────────
  await mount('vsactuals', CD);
  viewWrites.length = 0;
  check('(c) Group-by Product L1 on', await groupBy(/^Product L1/i, true));
  const MD = rowLabeled('Corporate · Mobile Data');
  check('(c) the Corporate · Mobile Data row is on screen', !!MD, tableRows().map(tr => (tr.querySelector('td')?.textContent || '').trim()).slice(0, 6).join(' | '));
  if (MD) await (act as any)(async () => { MD.click(); });
  await flush();
  check('(c) the bar reads Corporate/Mobile Data/Direct — channel KEPT', barReads() === 'Corporate/Mobile Data/Direct', barReads());
  check('(c) ONE write, through the one setter, of the NARROWED view',
    viewWrites.length === 1 && vf.filterToKey(viewWrites[0]) === 'Corporate|Mobile Data|All|Direct|All|All|All',
    JSON.stringify(viewWrites.map((w: any) => vf.filterToKey(w))));
  const mdFc = resolveForecast('Corporate|Mobile Data|All|Direct|All|All|All').forecast;
  const mdMean = mdFc?.months.find((m: any) => m.month === M)?.inflow.mean;
  const shown = varianceAt('Inflow', M);
  console.log(`  (c) chart at ${M}: ${JSON.stringify(shown)}; the view's own forecast mean ${mdMean}`);
  check(`(c) the chart shows it: ${M} Inflow forecast is Corporate/Mobile Data/Direct's`,
    !!shown && typeof mdMean === 'number' && shown.forecast === Math.round(mdMean) && shown.forecast !== 33136, JSON.stringify(shown));
  check('(c) a Back control names the previous view',
    !!backBtn() && (backBtn().textContent || '').trim() === i18n.t('actuals_back_to', { view: 'Corporate / Direct' }),
    (backBtn()?.textContent || '(none)').trim());
  check('(c) the Drilled-into wording is gone', !container.textContent.includes('Drilled into'));
  const MD2 = rowLabeled('Corporate · Mobile Data');
  if (MD2) await (act as any)(async () => { MD2.click(); });
  await flush();
  check('(c) a second click on the same row is nothing', viewWrites.length === 1 && !!backBtn(), String(viewWrites.length));
  if (backBtn()) await (act as any)(async () => { backBtn().click(); });
  await flush();
  check('(c) Back: Corporate/Direct', barReads() === `Corporate/${ALLTXT}/Direct`, barReads());
  check('(c) and Back is gone', !backBtn());

  // ── (d) NEVER WIDENS ─────────────────────────────────────────────────────
  await mount('vsactuals', CD);
  viewWrites.length = 0;
  const corp = rowLabeled('Corporate');
  check('(d) Group-by Segment only: the Corporate row is on screen', !!corp);
  if (corp) await (act as any)(async () => { corp.click(); });
  await flush();
  check('(d) clicking Corporate at Corporate/Direct: the bar STAYS Corporate/Direct', barReads() === `Corporate/${ALLTXT}/Direct`, barReads());
  check('(d) and nothing was written, and no Back', viewWrites.length === 0 && !backBtn(),
    JSON.stringify(viewWrites.map((w: any) => vf.filterToKey(w))));

  // ── (e) A HAND CHANGE RETIRES BACK ───────────────────────────────────────
  await groupBy(/^Product L1/i, true);
  const MD3 = rowLabeled('Corporate · Mobile Data');
  if (MD3) await (act as any)(async () => { MD3.click(); });
  await flush();
  check('(e) PREMISE: after the row click, Back is shown', !!backBtn());
  const other = segments.find(s => s !== 'Corporate')!;
  if (segSelect()) await setSelect(segSelect(), other);
  check(`(e) Segment changed by hand to ${other}`, barReads().startsWith(other + '/'), barReads());
  check('(e) Back is gone', !backBtn());

  // ── (f) THE MONTH IN THE TITLES; THE HIGHLIGHT ───────────────────────────
  await mount('vsactuals', CD);
  const tt = titles();
  console.log(`  (f) titles: ${tt.map(p => (p.textContent || '').trim()).join(' | ')}`);
  check('(f) eight KPI card titles', tt.length === 8, String(tt.length));
  check('(f) each ends with the default month, shown upper-case: JUN 2026',
    tt.length === 8 && tt.every(p => (p.textContent || '').trim().endsWith(' · Jun 2026') && p.classList.contains('uppercase')),
    tt.map(p => (p.textContent || '').trim()).join(' | '));
  check('(f) no highlight before the month changes', flashed().length === 0, String(flashed().length));
  const monthSel = container.querySelector('[data-testid="accuracy-month-select"]') as any;
  if (monthSel) await setSelect(monthSel, M);
  const tt2 = titles();
  check('(f) after the change: MAR 2026 in all eight',
    tt2.length === 8 && tt2.every(p => (p.textContent || '').trim().endsWith(' · Mar 2026')), tt2.map(p => (p.textContent || '').trim()).join(' | '));
  check('(f) the small line keeps "{n} cohorts compared, {month}"',
    /cohorts compared, Mar 2026/.test(container.textContent || ''));
  check('(f) the highlight class is on the eight figures after the change', flashed().length === 8, String(flashed().length));
  await (act as any)(async () => { await new Promise(r => setTimeout(r, 700)); });
  await flush();
  check('(f) and gone after its timeout', flashed().length === 0, String(flashed().length));
  if (root) await (act as any)(async () => { root.unmount(); });
  root = null;

  // ── (g) + (X) WHAT APP HOLDS, STRUCTURALLY ───────────────────────────────
  {
    const count = (s: string, x: string) => s.split(x).length - 1;
    // Comments stripped: a comment naming the setter is not a caller.
    const app = fs.readFileSync('src/App.tsx', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const fva = fs.readFileSync('src/components/ForecastVsActualsTab.tsx', 'utf8');
    const setterStart = app.indexOf('const handleViewFilterChange = useCallback(');
    const setterBody = setterStart < 0 ? '' : app.slice(setterStart, app.indexOf('}, [resolveForecast]', setterStart));
    const stdMemoStart = app.indexOf('const stdSelectionFilter = useMemo<ViewFilter>(');
    const stdMemo = stdMemoStart < 0 ? '' : app.slice(stdMemoStart, app.indexOf(']);', stdMemoStart) + 3);
    check('(g) Step 1\'s selector is its own: the view setter writes no std* state, and stdSelectionFilter reads no viewFilter',
      setterStart >= 0 && stdMemoStart >= 0 && !/setStd|stdSelection/.test(setterBody) && !/viewFilter/.test(stdMemo),
      `${/setStd|stdSelection/.test(setterBody)} / ${/viewFilter/.test(stdMemo)}`);
    check('(X) ONE view state in App: useState<ViewFilter>(ALL_VIEW), and no step2Filter/step3Filter',
      count(app, 'const [viewFilter, setViewFilter] = useState<ViewFilter>(ALL_VIEW);') === 1 && !/step[23]Filter/.test(app));
    check('(X) ONE setter: handleViewFilterChange defined once; no per-step setters',
      count(app, 'const handleViewFilterChange = useCallback(') === 1 && !/handleStep[23]FilterChange/.test(app));
    check('(X) its callers are three: the bar\'s onChange, and FVA\'s row click and Back through onViewChange',
      count(app, 'handleViewFilterChange') === 3 && app.includes('onChange={handleViewFilterChange}')
        && app.includes('onViewChange={handleViewFilterChange}')
        && count(fva, 'onViewChange(next)') === 1 && count(fva, 'onViewChange?.(from)') === 1
        && (fva.match(/onViewChange\??\.?\(/g) ?? []).length === 2,
      `${count(app, 'handleViewFilterChange')} / ${(fva.match(/onViewChange\??\.?\(/g) ?? []).length}`);
    check('(X) ONE adjusted clear on a view change (the setter\'s)', count(setterBody, 'setAdjustedForecast(null)') === 1);
    check('(X) both steps read the one state: the bar, hasForecast, Step 2\'s reason and Step 3\'s activeFilter',
      app.includes('filter={viewFilter}') && app.includes('activeFilter={viewFilter}')
        && app.includes('hasForecast={canResolve(filterToKey(viewFilter))}')
        && app.includes('noForecastReason={resolveForecast(filterToKey(viewFilter)).reason}'));
    check('(X) the tab transition resolves the one state', app.includes('forecastForView(activeView, viewFilter, resolveForecast as any)'));
    check('(X) the export writes the View cell ONCE, through the Metadata writer', count(app, 'viewMetaRow(viewFilter)') === 1
      && app.indexOf('viewMetaRow(viewFilter)') > app.indexOf('const metaRows = [')
      && app.indexOf('viewMetaRow(viewFilter)') < app.indexOf("json_to_sheet(metaRows), 'Metadata')"));
    check('(X) the load reads it once through the Metadata reader and sets the one state once',
      count(app, 'viewFromMeta(getMetaValue)') === 1 && count(app, 'setViewFilter(restoredView)') === 1);
    check('(X) Back and the previous view are ONE piece of FVA state', count(fva, 'useState<{ from: ViewFilter; to: string } | null>') === 1);
    check('(X) the highlight is one effect toggling one class', count(fva, "' mape-month-flash'") === 2
      && count(fva, 'setMonthFlash(true)') === 1 && count(fva, 'setTimeout(() => setMonthFlash(false), 600)') === 1);
    check('(X) no row selection survives', !/selectedForecastCohortKey|selectedCohortRow\b(?!`)/.test(fva.replace(/\/\/[^\n]*/g, '')));
  }

  report();
}

main().catch(e => { console.error(e); console.log('\none-view spec: CRASHED'); process.exit(1); });
