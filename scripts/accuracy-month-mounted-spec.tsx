/**
 * THE ACCURACY MONTH ON STEP 3 — REQ-D7-01 session 2, driven through the DOM.
 *
 *   npm run spec:accuracy-month
 *
 * Clauses 2, 7, 8, 9 and 11 under REQ-D7-01, on the fixture shaped as the 1855
 * inventory's (60 Corporate·Direct leaves fitted to 2025-12; actuals over 540
 * leaves to 2026-06; the real seam). A sibling of spec:actuals-coverage, which
 * would pass 60 checks with these added.
 *
 * In the order a user meets it:
 *  (f) the select offers the months carrying BOTH, and defaults to the latest;
 *  (g) choosing 2026-03: the Corporate row's Inflow score is the engine's
 *      single-month score, the cards' MAPE is that month's per-leaf average, and
 *      the cards' line reads "60 cohorts compared, Mar 2026";
 *  (h) Trend keeps its own window UP TO the chosen month: 6 points on 2026-06,
 *      "insufficient" (no arrow) on 2026-03;
 *  (i) Bias follows the chosen month, where the fixture's sign flips;
 *  (j) a view whose covered leaves stop before the file does defaults to THEIR
 *      latest month, not the file's (per view);
 *  (k) the Challenger's flagged set follows the month.
 *
 * Every expected figure is the engine's own answer or the fixture's own rows,
 * computed in this file — never read off the screen and compared with itself.
 */
import { JSDOM } from 'jsdom';

const HIST = 'test-data/VBU_IBRO_Synthetic_ForecastTest_TariffHierarchy_Jan2023_Dec2025.xlsx';
const ACT  = 'test-data/VBU_IBRO_Synthetic_ForecastTest_TariffHierarchy_Jan2023_Jun2026.xlsx';
const C = { date: 'Month', seg: 'Customer_Segment', prod: 'Product_L1', prodL2: 'Product_L2_Value_Tier',
  chan: 'Channel_Level_1', chanL2: 'Channel_Level_2', t1: 'tariff_tier_l1', t2: 'tariff_tier_l2',
  metric: 'IBRO_Scenario_Type', val: 'Subscriber_Volume', rev: 'Monthly_Revenue_GBP' };

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
  console.log(`\naccuracy-month spec: ${pass} passed, ${fails.length} failed`);
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
  const { monthLabel } = await import('../src/utils/monthFormat');
  const { ForecastProvider } = await import('../src/context/ForecastContext');
  const mod: any = await import('../src/components/ForecastVsActualsTab');
  const Tab = mod.ForecastVsActualsTab;
  const noop = () => {};

  for (const f of [HIST, ACT]) if (!fs.existsSync(f)) {
    console.log(`\naccuracy-month spec: UNREACHABLE — fixture missing at ${f}`); process.exit(1);
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
  const seamOver = (data: any[]) => {
    const dm = fc.buildCohortDataMap(data.map(r => ({ ...r, _parsedDate: new Date(r[C.date]) })),
      C.date, C.seg, C.prod, C.prodL2, C.chan, C.chanL2, C.t1, C.t2);
    const leafMap = fc.buildRollUpIndex(dm.keys()).leafMap;
    return (key: string) => fc.resolveFromStore(store, leafMap, key);
  };
  const resolveForecast = seamOver(rows);
  check('PREMISE: 60 leaves fitted', store.size === 60, String(store.size));

  // ── THE ENGINE'S OWN ANSWERS ─────────────────────────────────────────────
  /** cohortActualsMap, keyed and summed as the tab keys and sums it. */
  const camOf = (data: any[]) => {
    const cam = new Map<string, Map<string, any>>();
    for (const r of data) {
      const k = leafOf(r), m = ym(r[C.date]);
      if (!cam.has(k)) cam.set(k, new Map());
      const mm = cam.get(k)!;
      if (!mm.has(m)) mm.set(m, { inflow: 0, outflow: 0, retention: 0, base: null, arpu: 0, arpuRevSum: 0, arpuSubVol: 0,
        inflowArpu: 0, outflowArpu: 0, retentionArpu: 0, baseArpu: 0, inflowRev: 0, inflowSubVol: 0, outflowRev: 0, outflowSubVol: 0,
        retentionRev: 0, retentionSubVol: 0, baseRev: 0, baseSubVol: 0 });
      const e = mm.get(m); const v = Number(r[C.val]) || 0, rv = Number(r[C.rev]) || 0, met = String(r[C.metric]);
      if (met === 'Inflow') { e.inflow += v; e.inflowSubVol += v; e.inflowRev += rv; e.arpuSubVol += v; e.arpuRevSum += rv; }
      else if (met === 'Outflow') { e.outflow += v; e.outflowSubVol += v; e.outflowRev += rv; e.arpuSubVol += v; e.arpuRevSum += rv; }
      else if (met === 'Retention') { e.retention += v; e.retentionSubVol += v; e.retentionRev += rv; e.arpuSubVol += v; e.arpuRevSum += rv; }
      else if (met === 'Base') { e.base = (e.base ?? 0) + v; e.baseSubVol += v; e.baseRev += rv; e.arpuSubVol += v; e.arpuRevSum += rv; }
    }
    for (const mm of cam.values()) for (const e of mm.values()) {
      e.arpu = e.arpuSubVol > 0 && e.arpuRevSum > 0 ? e.arpuRevSum / e.arpuSubVol : 0;
      e.inflowArpu = e.inflowSubVol > 0 && e.inflowRev > 0 ? e.inflowRev / e.inflowSubVol : 0;
      e.outflowArpu = e.outflowSubVol > 0 && e.outflowRev > 0 ? e.outflowRev / e.outflowSubVol : 0;
      e.retentionArpu = e.retentionSubVol > 0 && e.retentionRev > 0 ? e.retentionRev / e.retentionSubVol : 0;
      e.baseArpu = e.baseSubVol > 0 && e.baseRev > 0 ? e.baseRev / e.baseSubVol : 0;
    }
    return cam;
  };
  const cam = camOf(rows);
  const fcAll = resolveForecast('All|All|All|All|All|All|All').forecast;
  const SEG = { product: false, productL2: false, channelL1: false, channelL2: false, tariffL1: false, tariffL2: false };
  const corpAt = (month: string) => mod.buildCohortAccuracy(cam, fcAll, SEG, store, resolveForecast, undefined, month)
    .find((r: any) => r.seg === 'Corporate');
  /** The cards' per-leaf Inflow MAPE for one month, as summaryMape averages it. */
  const cardInflowAt = (month: string) => {
    const vals = [...store.values()].map(bf => mod.computeForecastMape(bf, rows, C.date, C.metric, C.val,
      'Inflow', 'Outflow', 'Retention', 'Base', '', C.rev, C.seg, C.prod, C.chan, undefined,
      C.prodL2, C.chanL2, C.t1, C.t2, month))
      .map((m: any) => m.inflow).filter((x: any) => x !== null) as number[];
    return { n: vals.length, mape: vals.reduce((s, x) => s + x, 0) / vals.length };
  };
  const MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];

  // ── MOUNT ────────────────────────────────────────────────────────────────
  const host = document.getElementById('root')!;
  let container: any;
  const ALLVIEW = { segment: 'All', product: { l1: null, l2: null }, channel: { l1: null, l2: null }, tariff: { l1: null, l2: null } };
  const mount = async (data: any[], seam: (k: string) => any) => {
    host.replaceChildren(); container = document.createElement('div'); host.appendChild(container);
    const root = createRoot(container);
    await (act as any)(async () => {
      root.render(React.createElement(ForecastProvider as any, {
        baseForecast: seam('All|All|All|All|All|All|All').forecast, setBaseForecast: noop,
        adjustedForecast: null, setAdjustedForecast: noop,
        forecastStore: store, setForecastStore: noop, hasLegacyBaseline: true,
        resolveForecast: seam, canResolve: (k: string) => !!seam(k).forecast,
        updatedAt: Date.now(), bulkRuns: [], setBulkRuns: noop,
      }, React.createElement(Tab as any, {
        data, wiDateCol: C.date, wiMetricCol: C.metric, wiValueCol: C.val,
        wiInflowVal: 'Inflow', wiOutflowVal: 'Outflow', wiRetentionVal: 'Retention', wiBaseVal: 'Base',
        wiSegmentCol: C.seg, wiProductCol: C.prod, wiProductL2Col: C.prodL2,
        wiChannelCol: C.chan, wiChannelL2Col: C.chanL2, wiTariffL1Col: C.t1, wiTariffL2Col: C.t2,
        wiRevenueCol: C.rev, wiArpuCol: '', activeFilter: ALLVIEW,
        formatNumber: (x: any) => String(Math.round(Number(x))), setActiveView: noop, downloadExcel: noop,
      })));
    });
    await (act as any)(async () => {});
  };
  const sel = () => container.querySelector('[data-testid="accuracy-month-select"]') as any;
  const choose = async (month: string) => {
    const el = sel(); if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value')!.set!;
    await (act as any)(async () => {
      setter.call(el, month);
      el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
    await (act as any)(async () => {});
    return el.value === month;
  };
  const corpInflowCell = () => {
    const tr = ([...container.querySelectorAll('tbody tr')] as any[]).find(r => {
      const tds = [...r.querySelectorAll('td')];
      return tds.length >= 5 && ((tds[0] as any)?.textContent || '').trim().startsWith('Corporate');
    });
    return tr ? ((tr.querySelectorAll('td')[1] as any)?.textContent || '').trim() : '';
  };
  const cardText = (heading: RegExp) => {
    for (const card of [...container.querySelectorAll('div')] as any[]) {
      const ps = [...card.querySelectorAll(':scope > p')] as any[];
      if (ps.length < 2 || !heading.test((ps[0]?.textContent || '').trim())) continue;
      return ps.map(p => (p.textContent || '').trim());
    }
    return [] as string[];
  };
  const hasArrow = (cell: string) => /[↗↘→]/.test(cell);

  // ── (f) THE OPTIONS AND THE DEFAULT ──────────────────────────────────────
  await mount(rows, resolveForecast);
  const opts = sel() ? [...sel().querySelectorAll('option')].map((o: any) => o.value) : [];
  check('(f) the accuracy-month select is on screen', !!sel());
  check('(f) it offers the months carrying BOTH actuals and forecast, chronologically — Jan..Jun 2026',
    opts.join(',') === MONTHS.join(','), opts.join(','));
  check('(f) the default is the LATEST of them, 2026-06', sel()?.value === '2026-06', sel()?.value);
  const optLabels = sel() ? [...sel().querySelectorAll('option')].map((o: any) => (o.textContent || '').trim()) : [];
  check('(f) options are labelled by month', optLabels[5] === monthLabel('2026-06', 'en'), optLabels[5]);

  // ── (g) CHOOSE 2026-03 ────────────────────────────────────────────────────
  const eMar = corpAt('2026-03');
  const dMar = eMar?.inflowDetail?.rows ?? [];
  console.log(`  (g) engine Corporate 2026-03: actual ${dMar[0]?.actual?.toFixed(0)} forecast ${dMar[0]?.mean?.toFixed(0)} dev ${dMar[0]?.dev?.toFixed(2)}% month score ${dMar[0]?.score?.toFixed(2)}; Inflow score ${eMar?.inflowScore?.toFixed(2)}`);
  check('(g) ENGINE: the Corporate row scores exactly ONE month on 2026-03',
    dMar.length === 1 && dMar[0]?.month === '2026-03', dMar.map((r: any) => r.month).join(','));
  check('(g) ENGINE: that month is the covered 33,048 against 33,136',
    Math.round(dMar[0]?.actual) === 33048 && Math.round(dMar[0]?.mean) === 33136,
    `${dMar[0]?.actual} vs ${dMar[0]?.mean}`);
  check('(g) ENGINE: the Inflow score IS that month\'s score', eMar?.inflowScore === dMar[0]?.score,
    `${eMar?.inflowScore} vs ${dMar[0]?.score}`);
  check('(g) the month can be chosen', await choose('2026-03'));
  const cellMar = corpInflowCell();
  check('(g) the rendered Corporate Inflow score is the engine\'s single-month score',
    cellMar.startsWith(eMar.inflowScore.toFixed(0)), `${cellMar} vs ${eMar.inflowScore.toFixed(0)}`);
  const cMar = cardInflowAt('2026-03');
  const inflowCard = cardText(/^Inflow MAPE$/);
  console.log(`  (g) cards: Inflow MAPE 2026-03 per-leaf average ${cMar.mape.toFixed(2)}% over ${cMar.n}; card reads ${inflowCard.join(' | ')}`);
  check('(g) the Inflow MAPE card is that month\'s per-leaf average',
    inflowCard.some(p => p === cMar.mape.toFixed(1) + '%'), `${inflowCard.join(' | ')} vs ${cMar.mape.toFixed(1)}%`);
  const line = i18n.t('actuals_cohorts_compared_month', { n: 60, month: monthLabel('2026-03', 'en') });
  check('(g) the cards\' line reads "60 cohorts compared, Mar 2026"',
    line === '60 cohorts compared, Mar 2026' && inflowCard.includes(line), inflowCard.join(' | '));

  // ── (h) TREND: ITS OWN WINDOW, UP TO THE CHOSEN MONTH ────────────────────
  const eJun = corpAt('2026-06');
  console.log(`  (h) engine Corporate Inflow trend: 2026-06 ${eJun?.inflowTrend}, 2026-03 ${eMar?.inflowTrend}`);
  check('(h) ENGINE: on 2026-06 Trend has its 6 points (Jan-Jun) — not "insufficient"',
    !!eJun && eJun.inflowTrend !== 'insufficient' && eJun.inflowTrend !== null, String(eJun?.inflowTrend));
  check('(h) ENGINE: on 2026-03 Trend has 3 points (Jan-Mar) — "insufficient"', eMar?.inflowTrend === 'insufficient',
    String(eMar?.inflowTrend));
  check('(h) on screen, 2026-03: no Trend arrow in the Corporate Inflow cell', !hasArrow(cellMar), cellMar);
  await choose('2026-06');
  const cellJun = corpInflowCell();
  check('(h) on screen, 2026-06: a Trend arrow is shown', hasArrow(cellJun), cellJun);

  // ── (i) BIAS FOLLOWS THE MONTH ───────────────────────────────────────────
  //    Found, not assumed: the first component, in column order, whose sign flips
  //    between two of the months. (On this fixture Inflow never flips; its ARPU does.)
  const COLS = ['inflow', 'outflow', 'retention', 'base', 'inflowArpu', 'outflowArpu', 'retentionArpu', 'baseArpu'];
  let flip: { kpi: string; col: number; up: string; down: string } | null = null;
  for (let c = 0; c < COLS.length && !flip; c++) {
    const by = MONTHS.map(m => ({ m, b: corpAt(m)?.[COLS[c] + 'Bias'] ?? null }));
    console.log(`  (i) engine Corporate ${COLS[c]} bias: ${by.map(x => x.m.slice(5) + '=' + x.b).join(' ')}`);
    const up = by.find(x => x.b === 'above'), down = by.find(x => x.b === 'below');
    if (up && down) flip = { kpi: COLS[c], col: c + 1, up: up.m, down: down.m };
  }
  check("(i) a component's sign FLIPS across the months on this fixture", !!flip, 'none exists');
  if (flip) {
    const cellAt = async (m: string) => {
      await choose(m);
      const tr = ([...container.querySelectorAll('tbody tr')] as any[]).find(r => {
        const tds = [...r.querySelectorAll('td')];
        return tds.length >= 5 && ((tds[0] as any)?.textContent || '').trim().startsWith('Corporate');
      });
      return tr ? ((tr.querySelectorAll('td')[flip!.col] as any)?.textContent || '').trim() : '';
    };
    const cUp = await cellAt(flip.up), cDown = await cellAt(flip.down);
    console.log(`  (i) on screen, Corporate ${flip.kpi}: ${flip.up} "${cUp}"  ${flip.down} "${cDown}"`);
    check(`(i) ${flip.kpi} on ${flip.up}: the cell reads Over`, cUp.includes(i18n.t('actuals_over')), cUp);
    check(`(i) ${flip.kpi} on ${flip.down}: the cell reads Under`, cDown.includes(i18n.t('actuals_under')), cDown);
  }

  // ── (k) THE CHALLENGER FOLLOWS THE MONTH ─────────────────────────────────
  //    At Group-by Segment the Corporate row clears 85 in both months (95.6 on
  //    2026-03, 87.2 on 2026-06), so its list is empty either way. Grouped by
  //    Product L1 — a toggle the user has on the Challenger tab — the month moves it.
  const buttons = () => [...container.querySelectorAll('button')] as any[];
  const toTab = async (re: RegExp) => { const b = buttons().find(x => re.test((x.textContent || '').trim())); if (b) await (act as any)(async () => { b.click(); }); await (act as any)(async () => {}); return !!b; };
  await toTab(/AutoML Challenger/i);
  // The empty state hides the toggles; the user reaches them through "Review all
  // cohorts anyway", sets Product L1, and returns to the threshold.
  await toTab(new RegExp(i18n.t('actuals_review_all_cohorts_anyway')));
  const prodBox = ([...container.querySelectorAll('input[type=checkbox]')] as any[])
    .find(x => /^Product L1/i.test((x.closest('label')?.textContent || '').trim()) && !x.checked && !x.disabled);
  check("(k) the Challenger's Product L1 toggle is available", !!prodBox);
  if (prodBox) await (act as any)(async () => { prodBox.click(); });
  await toTab(new RegExp(i18n.t('actuals_reset_to_threshold')));
  const PROD = { ...SEG, product: true };
  const engineFlagged = (m: string) => mod.buildCohortAccuracy(cam, fcAll, PROD, store, resolveForecast, undefined, m)
    .filter((r: any) => r.overallScore !== null && r.overallScore < 85).map((r: any) => r.cohortKey).sort();
  const flaggedOn = async (month: string) => {
    await toTab(new RegExp('^' + i18n.t('actuals_forecast_vs_actuals') + '$'));
    await choose(month);
    await toTab(/AutoML Challenger/i);
    return ([...container.querySelectorAll('[data-testid^="challenger-group-"]')] as any[])
      .map(b => String(b.getAttribute('data-testid')).replace('challenger-group-', '')).sort();
  };
  const fMar = await flaggedOn('2026-03');
  const fJun = await flaggedOn('2026-06');
  const eMarF = engineFlagged('2026-03'), eJunF = engineFlagged('2026-06');
  console.log(`  (k) Challenger, Product L1: 2026-03 [${fMar.join(', ')}] (engine [${eMarF.join(', ')}]); 2026-06 [${fJun.join(', ')}] (engine [${eJunF.join(', ')}])`);
  check("(k) 2026-03: the flagged set is the engine's for that month", fMar.join(',') === eMarF.join(','), `${fMar.join(',')} vs ${eMarF.join(',')}`);
  check('(k) 2026-06: likewise', fJun.join(',') === eJunF.join(','), `${fJun.join(',')} vs ${eJunF.join(',')}`);
  check('(k) and the set MOVES with the month', fMar.join(',') !== fJun.join(',') && fJun.length > 0, `${fMar.join(',')} / ${fJun.join(',')}`);

  // ── (j) PER VIEW: THE COVERED LEAVES STOP BEFORE THE FILE DOES ───────────
  //    Every Corporate·Direct row for 2026-06 is withheld; the other 480 leaves
  //    keep it. The file still carries 2026-06 — the view's covered leaves do not.
  const rowsJ = rows.filter(r => !(String(r[C.seg]).trim() === 'Corporate' && String(r[C.chan]).trim() === 'Direct' && ym(r[C.date]) === '2026-06'));
  const fileMonths = fc.monthsCarryingActuals(rowsJ, [C.date], C.val);
  check('(j) PREMISE: the file still carries 2026-06', fileMonths.has('2026-06'));
  await mount(rowsJ, seamOver(rowsJ));
  const optsJ = sel() ? [...sel().querySelectorAll('option')].map((o: any) => o.value) : [];
  check('(j) the view\'s months stop at 2026-05', optsJ.join(',') === MONTHS.slice(0, 5).join(','), optsJ.join(','));
  check('(j) and the default is THE VIEW\'S latest, 2026-05 — not the file\'s 2026-06', sel()?.value === '2026-05', sel()?.value);

  // ── STRUCTURE ─────────────────────────────────────────────────────────────
  {
    const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const fva = strip(fs.readFileSync('src/components/ForecastVsActualsTab.tsx', 'utf8'));
    const count = (t: string, n: string) => t.split(n).length - 1;
    check('(X) ONE select: accuracy-month-select appears once', count(fva, 'data-testid="accuracy-month-select"') === 1,
      String(count(fva, 'data-testid="accuracy-month-select"')));
    check('(X) ONE filter: scoredMonths and trendMonths each defined once',
      count(fva, 'const scoredMonths: string[] =') === 1 && count(fva, 'const trendMonths: string[] =') === 1);
    check('(X) Scores, Bias and MAPE read scoredMonths (4 loops + MAPE); Trend reads trendMonths (2 loops)',
      count(fva, 'of scoredMonths)') === 4 && count(fva, 'pairs = scoredMonths') === 1 && count(fva, 'of trendMonths)') === 2,
      `${count(fva, 'of scoredMonths)')} / ${count(fva, 'pairs = scoredMonths')} / ${count(fva, 'of trendMonths)')}`);
    check('(X) both builder calls and the card MAPE pass the month',
      count(fva, 'resolveForecast, adjustedMeanMap, accuracyMonth || undefined)') === 1
        && count(fva, 'resolveForecast, undefined, accuracyMonth || undefined)') === 1
        && count(fva, 'wiTariffL2Col,\n        accuracyMonth || undefined,') === 1);
    check('(X) the default reuses the Delta-month pattern: derived, no effect writes it',
      /const accuracyMonth = accuracyMonthOptions\.includes\(selectedAccuracyMonth\)/.test(fva)
        && !/setSelectedAccuracyMonth\((?!e\.target\.value)/.test(fva));
    check('(X) the chart does not read the month', !/accuracyMonth/.test(fva.slice(fva.indexOf('const multiChartData = useMemo'), fva.indexOf('const hasScopedBaseline'))));
  }

  report();
}

main().catch(e => { console.error('accuracy-month spec CRASHED —', e); process.exit(1); });
