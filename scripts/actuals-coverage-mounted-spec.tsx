/**
 * STEP 3 COMPARES LIKE-FOR-LIKE — REQ-D7-01 session 1, driven through the DOM.
 *
 *   npm run spec:actuals-coverage
 *
 * Decision 1 (A) and clauses 5, 6, 11, 12 under REQ-D7-01. The fixture is shaped
 * as the 1855 inventory's: 60 forecast leaves, all Corporate·Direct, fitted on
 * the Dec2025 history; actuals over all 540 leaves to Jun2026. The seam is the
 * real one (`resolveFromStore`), so the covered set is whatever it summed.
 *
 * In the order a user meets it:
 *  (a) All/All: the chart's 2026-03 actual Inflow is the COVERED sum against the
 *      forecast, and the Base actual is the covered Base (clause 6);
 *  (b) Group-by Segment: the Corporate row scores the covered actuals, exactly as
 *      the engine scores them; the other four segments show the em dash;
 *  (c) the coverage line: "60 of 540" at All/All, "60 of 108" on the Corporate
 *      row, and NO line at Corporate/Direct, where coverage is complete;
 *  (d) a seam miss charts actuals only: the SOHO row selected under All/All (the
 *      case the deleted branch served), and a SOHO view mounts without a crash;
 *  (e) the Challenger's flagged set moves with the restriction (clause 11).
 *
 * Every expected figure below is measured from the fixture's own rows in this
 * file, never read back off the screen and compared with itself.
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
  console.log(`\nactuals-coverage spec: ${pass} passed, ${fails.length} failed`);
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
  const { ForecastProvider } = await import('../src/context/ForecastContext');
  const mod: any = await import('../src/components/ForecastVsActualsTab');
  const Tab = mod.ForecastVsActualsTab;
  const noop = () => {};

  for (const f of [HIST, ACT]) if (!fs.existsSync(f)) {
    console.log(`\nactuals-coverage spec: UNREACHABLE — fixture missing at ${f}`); process.exit(1);
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
  // THE REAL SEAM — the one App wires, `leaves` included.
  const resolveForecast = (key: string) => fc.resolveFromStore(store, leafMap, key);

  const allLeaves = new Set(rows.map(leafOf));
  const covered = new Set(byLeaf.keys());
  check('PREMISE: 60 leaves fitted, all Corporate·Direct', store.size === 60, String(store.size));
  check('PREMISE: actuals over 540 leaves', allLeaves.size === 540, String(allLeaves.size));

  // ── EXPECTED FIGURES, from the rows ──────────────────────────────────────
  const sumAt = (pred: (r: any) => boolean, metric: string) =>
    rows.filter(r => ym(r[C.date]) === M && String(r[C.metric]) === metric && pred(r))
      .reduce((s, r) => s + (Number(r[C.val]) || 0), 0);
  const covInflow = sumAt(r => covered.has(leafOf(r)), 'Inflow');
  const allInflow = sumAt(() => true, 'Inflow');
  const covBase   = sumAt(r => covered.has(leafOf(r)), 'Base');
  const allBase   = sumAt(() => true, 'Base');
  const fcAll = resolveForecast('All|All|All|All|All|All|All').forecast;
  const fcInflow = fcAll?.months.find((m: any) => m.month === M)?.inflow.mean;
  console.log(`  [expected] ${M} Inflow covered ${covInflow} (all ${allInflow}); forecast ${fcInflow?.toFixed(0)}; Base covered ${covBase} (all ${allBase})`);
  check('PREMISE: the covered and unrestricted Inflow differ — the case is live', allInflow > covInflow * 5,
    `${allInflow} vs ${covInflow}`);

  // ── MOUNT ────────────────────────────────────────────────────────────────
  const host = document.getElementById('root')!;
  let container: any;
  const round = (x: any) => String(Math.round(Number(x)));
  const filterOf = (seg: string, chan: string | null) => ({ segment: seg, product: { l1: null, l2: null },
    channel: { l1: chan, l2: null }, tariff: { l1: null, l2: null } });
  const mount = async (activeFilter: any) => {
    host.replaceChildren(); container = document.createElement('div'); host.appendChild(container);
    const root = createRoot(container);
    const viewKey = fc.makeForecastKey(activeFilter.segment, 'All', 'All', activeFilter.channel.l1 ?? 'All', 'All', 'All', 'All');
    await (act as any)(async () => {
      root.render(React.createElement(ForecastProvider as any, {
        baseForecast: resolveForecast(viewKey).forecast, setBaseForecast: noop,
        adjustedForecast: null, setAdjustedForecast: noop,
        forecastStore: store, setForecastStore: noop, hasLegacyBaseline: true,
        resolveForecast, canResolve: (k: string) => !!resolveForecast(k).forecast,
        updatedAt: Date.now(), bulkRuns: [], setBulkRuns: noop,
      }, React.createElement(Tab as any, {
        data: rows, wiDateCol: C.date, wiMetricCol: C.metric, wiValueCol: C.val,
        wiInflowVal: 'Inflow', wiOutflowVal: 'Outflow', wiRetentionVal: 'Retention', wiBaseVal: 'Base',
        wiSegmentCol: C.seg, wiProductCol: C.prod, wiProductL2Col: C.prodL2,
        wiChannelCol: C.chan, wiChannelL2Col: C.chanL2, wiTariffL1Col: C.t1, wiTariffL2Col: C.t2,
        wiRevenueCol: C.rev, wiArpuCol: '', activeFilter,
        formatNumber: round, setActiveView: noop, downloadExcel: noop,
      })));
    });
    await (act as any)(async () => {});
  };
  const byTestId = (id: string) => container.querySelector(`[data-testid="${id}"]`) as any;
  /** The monthly variance row for a scenario: [actual, forecast] as rendered. */
  const varianceAt = (scenario: string, month: string) => {
    for (const d of [...container.querySelectorAll('details')] as any[]) {
      const h = (d.querySelector('h4')?.textContent || '').trim();
      if (!h.startsWith(scenario + ' ')) continue;
      for (const tr of [...d.querySelectorAll('tbody tr')] as any[]) {
        const td = [...tr.querySelectorAll('td')].map((x: any) => (x.textContent || '').trim());
        if (td[0] === month) return { actual: Number(td[1]), forecast: Number(td[2]) };
      }
    }
    return null;
  };
  const geom = (el: Element) => { const d = el.querySelector('path.recharts-curve')?.getAttribute('d') || ''; return /[ML]\s*-?\d/.test(d); };
  const coverageText = (covered: number, total: number) => i18n.t('actuals_coverage_line', { covered, total });

  // ── (a) ALL/ALL: THE CHART COMPARES THE COVERED LEAVES ───────────────────
  await mount(filterOf('All', null));
  const inflow = varianceAt('Inflow', M);
  check(`(a) All/All ${M}: the chart's actual Inflow is the COVERED sum (${covInflow}), not every leaf (${allInflow})`,
    inflow?.actual === Math.round(covInflow), JSON.stringify(inflow));
  check(`(a) against the forecast Inflow (${fcInflow?.toFixed(0)})`,
    inflow?.forecast === Math.round(fcInflow ?? NaN), JSON.stringify(inflow));
  const base = varianceAt('Base', M);
  check(`(a) the Base actual is the COVERED Base (${covBase}), not every leaf's (${allBase}) — clause 6`,
    base?.actual === Math.round(covBase), JSON.stringify(base));
  console.log(`  (a) ${M}: Inflow ${JSON.stringify(inflow)}  Base ${JSON.stringify(base)}`);

  // ── (c) THE COVERAGE LINE AT ALL/ALL ─────────────────────────────────────
  const line = (byTestId('actuals-coverage-line')?.textContent || '').trim();
  check('(c) All/All: the coverage line reads "60 of 540"', line === coverageText(60, 540), line || '(none)');

  // ── (b) GROUP-BY SEGMENT: THE CORPORATE ROW ──────────────────────────────
  const accRows = () => ([...container.querySelectorAll('tbody tr')] as any[]).filter(tr => {
    const tds = [...tr.querySelectorAll('td')];
    return tds.length >= 5 && !/^\d{4}-\d{2}$/.test((tds[0]?.textContent || '').trim());
  });
  const rowFor = (seg: string) => accRows().find(tr => (tr.querySelector('td')?.textContent || '').trim().startsWith(seg));
  const corp = rowFor('Corporate');
  check('(b) the Corporate row is on screen', !!corp);
  // THE ENGINE'S OWN ANSWER for the same inputs — the exported builder, fed the
  // actuals keyed exactly as the tab keys them.
  const cam = new Map<string, Map<string, any>>();
  for (const r of rows) {
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
  const dims = { product: false, productL2: false, channelL1: false, channelL2: false, tariffL1: false, tariffL2: false };
  const engine = mod.buildCohortAccuracy(cam, fcAll, dims, store, resolveForecast);
  const eCorp = engine.find((r: any) => r.seg === 'Corporate');
  const eM = eCorp?.inflowDetail?.rows.find((x: any) => x.month === M);
  check(`(b) the engine scores the Corporate row's ${M} Inflow on the COVERED actual (${covInflow}), not all Corporate`,
    !!eM && Math.round(eM.actual) === Math.round(covInflow), eM ? `${eM.actual}` : 'no month');
  console.log(`  (b) engine Corporate: ${M} actual ${eM?.actual.toFixed(0)} forecast ${eM?.mean.toFixed(0)} dev ${eM?.dev.toFixed(2)}% month score ${eM?.score.toFixed(1)}; `
    + `Inflow score ${eCorp?.inflowScore?.toFixed(1)}, overall ${eCorp?.overallScore?.toFixed(1)}`);
  // RE-AIMED 2026-09-24 (REQ-D7-01 session 2): the table now scores the ACCURACY
  // MONTH, which defaults to the view's latest (2026-06). The rendered cell is the
  // engine's score for that month; the all-months engine above still carries the
  // 2026-03 detail this case quotes.
  const eDef = mod.buildCohortAccuracy(cam, fcAll, dims, store, resolveForecast, undefined, '2026-06')
    .find((r: any) => r.seg === 'Corporate');
  const cells = corp ? [...corp.querySelectorAll('td')].map((x: any) => (x.textContent || '').trim()) : [];
  check('(b) the rendered Corporate Inflow score IS the engine\'s for the default month, 2026-06 (same label)',
    !!corp && cells[1].startsWith(eDef?.inflowScore === null ? '—' : eDef.inflowScore.toFixed(0)),
    `${cells[1]} vs ${eDef?.inflowScore?.toFixed(0)}`);
  for (const s of ['SOHO', 'SME', 'Large Enterprise', 'MNC']) {
    const r = rowFor(s);
    const c = r ? [...r.querySelectorAll('td')].slice(1, 5).map((x: any) => (x.textContent || '').trim()) : [];
    check(`(b) ${s}: the em dash, as today`, !!r && c.every(t => /^[—\s]+$/.test(t)), c.join(' | '));
    check(`(b) ${s}: no coverage line on an unscored row`, !container.querySelector(`[data-testid="cohort-coverage-${s}"]`));
  }

  // ── (c) THE CORPORATE ROW'S LINE ─────────────────────────────────────────
  const rowLine = (byTestId('cohort-coverage-Corporate')?.textContent || '').trim();
  check('(c) the Corporate row\'s coverage line reads "60 of 108"', rowLine === coverageText(60, 108), rowLine || '(none)');

  // ── (e) THE CHALLENGER — measured on the same mount, before (c) re-mounts ──
  //    BEFORE (a497ff5, the 1855 measurement): the Corporate row scored 38.3
  //    overall against every Corporate leaf, below the Challenger's 85 — FLAGGED.
  const toChallenger = [...container.querySelectorAll('button')].find((b: any) => /AutoML Challenger/i.test(b.textContent || '')) as any;
  check('(e) the AutoML Challenger tab opens', !!toChallenger);
  if (toChallenger) await (act as any)(async () => { toChallenger.click(); });
  await (act as any)(async () => {});
  const flagged = ([...container.querySelectorAll('[data-testid^="challenger-group-"]')] as any[])
    .map(b => String(b.getAttribute('data-testid')).replace('challenger-group-', ''));
  // RE-AIMED 2026-09-24 (session 2): the Challenger scores the accuracy month too.
  console.log(`  (e) Challenger flagged: before (a497ff5) [Corporate] at overall 38.3; after [${flagged.join(', ')}] at overall ${eDef?.overallScore?.toFixed(1)} (default month 2026-06)`);
  check('(e) the Corporate row now scores at or above the Challenger threshold (85) on the default month',
    typeof eDef?.overallScore === 'number' && eDef.overallScore >= 85, String(eDef?.overallScore));
  check('(e) and the flagged set MOVED: Corporate is no longer flagged', !flagged.includes('Corporate'), flagged.join(','));

  // ── (c) CORPORATE/DIRECT: COMPLETE COVERAGE, NO LINE ─────────────────────
  await mount(filterOf('Corporate', 'Direct'));
  const cd = varianceAt('Inflow', M);
  check('(c) Corporate/Direct: the chart compares the same covered sum', cd?.actual === Math.round(covInflow), JSON.stringify(cd));
  check('(c) Corporate/Direct: NO coverage line — 60 of 60 is complete', !byTestId('actuals-coverage-line'),
    (byTestId('actuals-coverage-line')?.textContent || '').trim());

  // ── (d) A SEAM MISS: ACTUALS ONLY, NO CRASH ──────────────────────────────
  //    The deleted branch served ONE case: a scope the seam cannot answer while a
  //    forecast is loaded — a SELECTED ROW with no forecast. That is driven here.
  //    A view-level miss has no loaded forecast and so no months to chart at all,
  //    before and after this build; it is checked for not crashing.
  check('(d) PREMISE: SOHO resolves to nothing', resolveForecast('SOHO|All|All|All|All|All|All').forecast === null);
  await mount(filterOf('All', null));
  const soho = rowFor('SOHO');
  check('(d) the SOHO row is on screen at All/All', !!soho);
  let crashed = '';
  try { if (soho) await (act as any)(async () => { soho.click(); }); await (act as any)(async () => {}); }
  catch (e: any) { crashed = String(e?.message ?? e); }
  check('(d) selecting the SOHO row does not crash', crashed === '', crashed);
  const fSeries = [...container.querySelectorAll('g.recharts-line.series-forecast')];
  const aSeries = [...container.querySelectorAll('g.recharts-line.series-actual')];
  check('(d) SELECTOR: the actual series is findable', aSeries.length > 0);
  check('(d) the SOHO actuals ARE drawn — positive control', aSeries.some(geom), `${aSeries.filter(geom).length} of ${aSeries.length}`);
  check('(d) NO forecast is drawn for the miss', fSeries.every(el => !geom(el)), `${fSeries.filter(geom).length} of ${fSeries.length}`);
  check('(d) no coverage line on a miss', !byTestId('actuals-coverage-line'));
  let crashedView = '';
  try { await mount(filterOf('SOHO', null)); } catch (e: any) { crashedView = String(e?.message ?? e); }
  check('(d) a view-level miss (SOHO) mounts without a crash', crashedView === '', crashedView);
  check('(d) and draws no forecast', [...container.querySelectorAll('g.recharts-line.series-forecast')].every(el => !geom(el)));

  // ── STRUCTURE ─────────────────────────────────────────────────────────────
  {
    const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const fva = strip(fs.readFileSync('src/components/ForecastVsActualsTab.tsx', 'utf8'));
    const eng = strip(fs.readFileSync('src/utils/forecasting.ts', 'utf8'));
    const count = (t: string, n: string) => t.split(n).length - 1;
    check('(X) coveredLeafKeys is defined ONCE, in forecasting.ts', count(eng, 'export function coveredLeafKeys(') === 1
      && count(fva, 'function coveredLeafKeys') === 0);
    // RE-AIMED 2026-09-24 (session 2): the accuracy-month options read it too (4).
    check('(X) the chart, its coverage count, the table and the accuracy months read it (4 calls)', count(fva, 'coveredLeafKeys(') === 4,
      String(count(fva, 'coveredLeafKeys(')));
    check('(X) deriveAggregate is called ONCE in Step 3 (the seam-miss copy is gone)', count(fva, 'deriveAggregate(') === 1,
      String(count(fva, 'deriveAggregate(')));
    check('(X) resolveForecast( stays at 4 calls', count(fva, 'resolveForecast(') === 4, String(count(fva, 'resolveForecast(')));
    check('(X) the dead accuracy memo is gone', !/const accuracy = useMemo/.test(fva));
    check('(X) no store scan in the chart any more — only summaryMape\'s pinned one', count(fva, 'forecastStore.entries()') === 0
      && count(fva, 'forecastStore.values()') === 1, `${count(fva, 'forecastStore.entries()')} / ${count(fva, 'forecastStore.values()')}`);
  }

  report();
}

main().catch(e => { console.error('actuals-coverage spec CRASHED —', e); process.exit(1); });
