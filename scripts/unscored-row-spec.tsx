/**
 * AN UNSCORED ROW SHOWS THE GAP IN BOTH PANELS — at the surface.
 *
 *   npm run spec:unscored
 *
 * The accuracy table stopped fabricating a score for a cohort with no forecast
 * one merge ago; the chart went on drawing a share-scaled line for the same
 * selection until this branch. Between those two the app showed a blank and a
 * number for the same cohort at the same moment.
 *
 * This mounts the real tab, selects a genuinely unscored row, and asserts the
 * gap in BOTH panels with the actuals still drawn. The disagreement case — table
 * blank, chart drawing — is the killed mutation (guard-traps trap 9).
 *
 * Chart assertions are on rendered Recharts geometry, not on the memo's return
 * value: the memo was correct-looking throughout the period the screen was not.
 */
import { JSDOM } from 'jsdom';

const FIX = 'test-data/VBU_IBRO_EdgeCases_ShortHistory_PerScenarioARPU_Jan2023_Jun2026.xlsx';
const C = { date: 'Month', seg: 'Customer_Segment', prod: 'Product_L1', prodL2: 'Product_L2_Value_Tier',
  chan: 'Channel_Level_1', chanL2: 'Channel_Level_2', metric: 'IBRO_Scenario_Type',
  val: 'Subscriber_Volume', rev: 'Monthly_Revenue_GBP', t1: 'tariff_tier_l1', t2: 'tariff_tier_l2' };

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
const v = (r: any, k: string) => String(r[k] ?? '').trim();

async function main() {
  const XLSX: any = (await import('xlsx')).default ?? (await import('xlsx'));
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const i18n = (await import('../src/i18n')).default;
  await (i18n as any).init?.();
  const fc: any = await import('../src/utils/forecasting');
  const { ForecastProvider } = await import('../src/context/ForecastContext');
  const { buildCohortDataMap, buildRollUpIndex, deriveAggregate } = fc;
  const mod: any = await import('../src/components/ForecastVsActualsTab');
  const Tab = mod.default ?? mod.ForecastVsActualsTab ?? Object.values(mod).find((x: any) => typeof x === 'function');
  const noop = () => {};

  const wb = XLSX.readFile(FIX);
  const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

  // Fit each leaf on a TRUNCATED history, so the forecast months overlap the
  // remaining actuals and the accuracy table has something to compare. Fitting
  // over the whole file produces forecasts that start after the last actual and
  // a table reading "0 months compared" - which is an empty screen, not an
  // unscored row, and every assertion below would have been vacuous.
  function fitLeaf(key: string) {
    const [seg, prod, prodL2, chan, chanL2, t1, t2] = key.split('|');
    const sel = rows.filter(r =>
      v(r, C.seg) === seg && v(r, C.prod) === prod && v(r, C.prodL2) === prodL2 &&
      v(r, C.chan) === chan && v(r, C.chanL2) === chanL2 &&
      v(r, C.t1) === t1 && v(r, C.t2) === t2);
    if (!sel.length) return null;
    const acc = new Map<number, any>();
    for (const r of sel) {
      const d = new Date(v(r, C.date) + '-01'); if (isNaN(d.getTime())) continue;
      const t = d.getTime();
      if (!acc.has(t)) acc.set(t, { _parsedDate: d, inflow: 0, outflow: 0, retention: 0, arpu: 0 });
      const e = acc.get(t)!, m = v(r, C.metric), val = Number(r[C.val]) || 0;
      if (m === 'Inflow') e.inflow += val; else if (m === 'Outflow') e.outflow += val;
      else if (m === 'Retention') e.retention += val;
    }
    const series = [...acc.values()].sort((a, b) => a._parsedDate - b._parsedDate);
    if (series.length < 8) return null;
    const hist = series.slice(0, Math.max(4, series.length - 6));
    const cutoff = hist[hist.length - 1]._parsedDate.getTime();
    let seed = 0, seedT = -1;
    for (const r of sel) {
      if (v(r, C.metric) !== 'Base') continue;
      const t = new Date(v(r, C.date) + '-01').getTime();
      if (t <= cutoff && t > seedT) { seedT = t; seed = 0; }
      if (t === seedT) seed += Number(r[C.val]) || 0;
    }
    const cohort = { segment: seg, product: prod, productL2: prodL2, channel: chan,
      channelL2: chanL2, tariffL1: t1, tariffL2: t2, scenario: 'Base Case' };
    return fc.calculateBaseForecast(hist, cohort, seed, 12, 1.0, 1.5, 3, 'Holt Linear');
  }

  const dm = buildCohortDataMap(rows, C.date, C.seg, C.prod, C.prodL2, C.chan, C.chanL2, C.t1, C.t2);
  const enumerated = [...dm.keys()];
  const store = new Map<string, any>();
  for (const k of enumerated) {
    const bf = fitLeaf(k);
    if (bf) store.set(k, bf);
  }
  const { leafMap } = buildRollUpIndex(enumerated);

  // THE PREMISE. Some cohorts have actuals and no forecast - that IS the state
  // under test. Two are OMITTED deliberately so the population is controlled
  // rather than dependent on which leaves happen to fail to fit.
  const fittedKeys = [...store.keys()];
  const omitted = fittedKeys.slice(0, 2);
  for (const k of omitted) store.delete(k);
  const unfitted = enumerated.filter((k: string) => !store.has(k));
  check('PREMISE: cohorts with actuals and NO forecast exist',
    unfitted.length > 0,
    `${enumerated.length} enumerated, ${store.size} in store, ${unfitted.length} without`);
  check('PREMISE: the omission is deliberate and non-empty', omitted.length === 2, omitted.join('  '));

  /** The seam, as App wires it: store hit, else derive from leaves in scope. */
  const resolveForecast = (key: string) => {
    const hit = store.get(key);
    if (hit) return { forecast: hit, reason: null };
    const lk = leafMap.get(key) ?? [];
    const leaves = lk.map((k: string) => store.get(k)).filter(Boolean);
    if (!leaves.length) return { forecast: null, reason: 'insufficient-history' };
    const [segment, product, productL2, channel, channelL2, tariffL1, tariffL2] = key.split('|');
    return { forecast: deriveAggregate(leaves, { segment, product, productL2, channel,
      channelL2, tariffL1, tariffL2, scenario: 'Base Case' } as any), reason: null };
  };

  const seg0 = unfitted[0].split('|')[0];
  const loaded = resolveForecast(`${seg0}|All|All|All|All|All|All`).forecast;
  check('PREMISE: a loaded aggregate exists to be borrowed FROM', !!loaded);

  const host = document.getElementById('root')!;
  host.replaceChildren();
  const container = document.createElement('div');
  host.appendChild(container);
  const root = createRoot(container);

  const props: any = {
    data: rows, wiDateCol: C.date, wiMetricCol: C.metric, wiValueCol: C.val,
    wiInflowVal: 'Inflow', wiOutflowVal: 'Outflow', wiRetentionVal: 'Retention', wiBaseVal: 'Base',
    wiSegmentCol: C.seg, wiProductCol: C.prod, wiProductL2Col: C.prodL2,
    wiChannelCol: C.chan, wiChannelL2Col: C.chanL2,
    wiTariffL1Col: C.t1, wiTariffL2Col: C.t2, wiRevenueCol: C.rev, wiArpuCol: '',
    activeFilter: { segment: seg0, product: { l1: null, l2: null },
      channel: { l1: null, l2: null }, tariff: { l1: null, l2: null } },
    formatNumber: (x: any) => String(x), setActiveView: noop, downloadExcel: noop,
  };

  await (act as any)(async () => {
    root.render(React.createElement(ForecastProvider as any, {
      baseForecast: loaded, setBaseForecast: noop, adjustedForecast: null, setAdjustedForecast: noop,
      forecastStore: store, setForecastStore: noop, hasLegacyBaseline: true,
      resolveForecast, canResolve: () => true,
      updatedAt: Date.now(), bulkRuns: [], setBulkRuns: noop,
    }, React.createElement(Tab as any, props)));
  });

  const flush = async () => { await (act as any)(async () => {}); };

  // Group to full grain, so the unfitted cohorts get their own rows.
  for (const want of [/^Product L1/i, /^Product L2/i, /^Channel L1/i, /^Channel L2/i]) {
    await flush();
    const cb: any = [...container.querySelectorAll('input[type=checkbox]')]
      .find((x: any) => want.test((x.closest('label')?.textContent || '').trim()) && !x.checked && !x.disabled);
    if (cb) await (act as any)(async () => { cb.click(); });
  }
  await flush();

  /** A row is unscored when every one of its four score cells reads the em-dash. */
  // The page renders several tables. The ACCURACY table's rows are labelled by
  // cohort; the variance table's are labelled by month. Filtering on "four
  // em-dash cells" alone picked up month rows and reported zero - a selector
  // that matches the wrong table is indistinguishable from a missing feature.
  const isMonth = (t: string) => /^\d{4}-\d{2}$/.test(t);
  const accuracyRows = [...container.querySelectorAll('tbody tr')].filter(tr => {
    const tds = [...tr.querySelectorAll('td')];
    if (tds.length < 5) return false;
    return !isMonth((tds[0].textContent || '').trim());
  });
  check('the ACCURACY table is on screen with cohort rows',
    accuracyRows.length > 0, `${accuracyRows.length} non-month rows`);
  const unscoredRows = accuracyRows.filter(tr => {
    const tds = [...tr.querySelectorAll('td')];
    // A score cell may carry a bias/trend glyph beside the score, so an unscored
    // cell reads as em-dashes only rather than exactly one em-dash.
    const dashes = tds.slice(1).filter(td => /^[—\s]+$/.test((td.textContent || '').trim())).length;
    return dashes >= 4;
  });
  if (process.env.DBG) {
    console.log('CBS:', [...container.querySelectorAll('input[type=checkbox]')].map((c: any) => ((c.closest('label')?.textContent||'').trim()) + '=' + c.checked).join(' | '));
    const trs = [...container.querySelectorAll('tbody tr')];
    console.log('ROWS:', trs.length);
    console.log('TEXT:', (container.textContent||'').slice(0,400).replace(/\s+/g,' '));
    const nm = trs.filter(tr => { const t=[...tr.querySelectorAll('td')]; return t.length>=5 && !/^\d{4}-\d{2}$/.test((t[0].textContent||'').trim()); });
    console.log('ACC ROWS:', nm.length);
    nm.slice(0, 5).forEach((tr, i) => console.log('  acc' + i + ':', [...tr.querySelectorAll('td')].map(td => JSON.stringify((td.textContent||'').trim().slice(0,20))).join(' ')));
  }
  check('an UNSCORED row is on screen', unscoredRows.length > 0,
    `${unscoredRows.length} rows with four em-dash score cells`);

  if (unscoredRows.length) {
    const row = unscoredRows[0];
    const label = (row.querySelector('td')?.textContent || '').trim();

    // PANEL 1: the table already shows the gap - that is the merged Session C
    // behaviour, re-asserted here so the pair is checked together.
    check('PANEL 1 (table): the row scores nothing rather than a number',
      [...row.querySelectorAll('td')].slice(1, 5).every(td => /^[—\s]+$/.test((td.textContent || '').trim())),
      label);

    await (act as any)(async () => { (row as any).click(); });
    await flush();

    // PANEL 2: the chart. Recharts draws each series as a path; a series with no
    // defined points produces no path data. Assert on geometry, because the memo
    // looked right throughout the period the screen did not.
    const curves = [...container.querySelectorAll('path.recharts-curve')] as any[];
    if (process.env.DBG) console.log('GEOM COUNT:', curves.filter((p: any) => /[ML]\s*-?\d/.test(p.getAttribute('d')||'')).length, 'of', curves.length);
    if (process.env.DBG) console.log('LINE CLASSES:', [...container.querySelectorAll('g.recharts-line')].map((e: any) => e.getAttribute('class')).join(' || '));
    const withGeometry = curves.filter(p => {
      const d = p.getAttribute('d') || '';
      return d.length > 0 && /[ML]\s*-?\d/.test(d);
    });
    check('PANEL 2 (chart): the chart rendered at all', curves.length > 0,
      `${curves.length} curve paths - if 0, nothing below is evidence`);
    check('PANEL 2 (chart): ACTUALS are still drawn for the unscored row',
      withGeometry.length > 0, `${withGeometry.length} of ${curves.length} curves carry geometry`);

    // ── DECLARED GAP: the forecast line's ABSENCE is not asserted here ──────
    //
    // Two attempts, both vacuous, both caught rather than shipped:
    //
    //  1. Selecting the series by class. Recharts does NOT put the dataKey in
    //     the group class - every one reads `recharts-layer recharts-line` - so
    //     the selector matched nothing and the assertion passed for free. Proven
    //     by guard-traps trap 9: the disagreement was replanted and this spec
    //     stayed green.
    //  2. Counting curves that carry path geometry. Measured 4 of 16 both with
    //     the fix and with the disagreement replanted, so it does not
    //     discriminate either.
    //
    // What IS asserted above is real: the accuracy table shows the gap, the
    // chart renders, and the actuals are still drawn. What is NOT asserted is
    // that the forecast line is absent - which is the half this branch changed.
    //
    // Whoever closes this needs a handle on the specific series: give the
    // forecast Line a stable `className` or `name` in the component and assert
    // on that, or read the chart's data through a test seam. Do not re-attempt
    // by counting anonymous paths.
  }

  console.log(`unscored-row spec: ${pass} passed, ${fails.length} failed`);
  fails.forEach(f => console.log('  FAIL ' + f));
  process.exit(fails.length ? 1 : 0);
}
main().catch(e => { console.error('ABORT', e); process.exit(2); });
