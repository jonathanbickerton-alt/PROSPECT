/**
 * REGRESSION TRAPS — three prior fixes whose only protection was a comment.
 *
 *   npm run traps
 *
 * Each of these was a real defect, fixed, and then guarded by nothing but prose
 * in the source. A refactor can read past prose. These fail instead.
 *
 *   A. TARIFF GRAIN. actualsAggrMap and computeForecastMape must both scope
 *      actuals to the loaded forecast's tariff. Without the guard,
 *      Corporate·Mobile Voice·Direct·RED S read 75,468 actual against 1,693
 *      forecast (+97.7%) every month — the cohort's actuals were being summed
 *      across all five tariffs while the forecast covered one.
 *      (ForecastVsActualsTab.tsx:1607, :238)
 *      Asserts BOTH paths: the variance table (fed by actualsAggrMap) and the
 *      summary MAPE cards (fed by computeForecastMape). Breaking only the
 *      second left all three traps green until 2026-07-31.
 *
 *   B. summaryMape's tarMatch. A tariff filter must NARROW the forecast set.
 *      Without tarMatch the summary cards ignore the tariff dimension, so the
 *      filtered and unfiltered views report the same number.
 *      (ForecastVsActualsTab.tsx, summaryMape)
 *
 *   C. !matchingBfs.length early return. A row with no forecast must render
 *      UNSCORED, never a fabricated score. Removing this reopens the defect in
 *      EXPECTED.md §16b, where such rows read 60/75/61/74 filtered and 0/0/0/0
 *      cleared — neither a measurement of anything.
 *
 * Drives the real component. Asserts on rendered DOM, not on reimplemented
 * maths. Every trap states a POSITIVE control so a vacuous pass is visible:
 * if the control does not hold, the harness reports INCONCLUSIVE, not PASS.
 */
import { JSDOM } from 'jsdom';

const FIX = 'test-data/VBU_IBRO_Trimmed_TariffHierarchy_Jan2023_Jun2026.xlsx';
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
// A no-op ResizeObserver leaves ResponsiveContainer at width -1 and nothing paints;
// a rendered-element count of 0 would then be indistinguishable from success.
g.ResizeObserver = class { cb: any; constructor(cb: any) { this.cb = cb; }
  observe(el: any) { this.cb([{ target: el, contentRect: { width: 900, height: 400, top: 0, left: 0, bottom: 400, right: 900, x: 0, y: 0 } }], this); }
  unobserve() {} disconnect() {} };
g.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
g.IS_REACT_ACT_ENVIRONMENT = true;
for (const p of ['offsetWidth', 'clientWidth'] as const) Object.defineProperty(dom.window.HTMLElement.prototype, p, { configurable: true, value: 900 });
for (const p of ['offsetHeight', 'clientHeight'] as const) Object.defineProperty(dom.window.HTMLElement.prototype, p, { configurable: true, value: 400 });

const v = (r: any, k: string) => String(r[k] ?? '').trim();
const results: { id: string; name: string; state: 'PASS' | 'FAIL' | 'INCONCLUSIVE'; detail: string }[] = [];
const record = (id: string, name: string, state: 'PASS' | 'FAIL' | 'INCONCLUSIVE', detail: string) =>
  results.push({ id, name, state, detail });

async function main() {
  const XLSX: any = (await import('xlsx')).default ?? (await import('xlsx'));
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const i18n = (await import('../src/i18n')).default;
  await (i18n as any).init?.();
  const fc: any = await import('../src/utils/forecasting');
  const { ForecastProvider } = await import('../src/context/ForecastContext');
  const { deriveAggregate } = await import('../src/utils/forecasting');
  /** Does roll-up key `agg` cover leaf key `leaf`? 'All' matches anything. */
  const keyCovers = (agg: string, leaf: string) => {
    const a2 = agg.split('|'), l = leaf.split('|');
    return a2.length === 7 && l.length === 7 && a2.every((p, i) => p === 'All' || p === l[i]);
  };
  const mod: any = await import('../src/components/ForecastVsActualsTab');
  const Tab = mod.default ?? mod.ForecastVsActualsTab ?? Object.values(mod).find((x: any) => typeof x === 'function');
  const noop = () => {};

  const rows: any[] = XLSX.utils.sheet_to_json(XLSX.readFile(FIX).Sheets[XLSX.readFile(FIX).SheetNames[0]]);

  /** Forecast for one (seg, prod, chan, tariff) scope, seeded from its OWN last
   *  historical Base — never a constant, or every derived figure is an artefact. */
  function build(seg: string, prod: string, chan: string, tar: string) {
    const sel = rows.filter(r => v(r, C.seg) === seg && v(r, C.prod) === prod
      && v(r, C.chan) === chan && (tar === 'All' || v(r, C.t1) === tar));
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
    const cohort = { segment: seg, product: prod, productL2: 'All', channel: chan,
      channelL2: 'All', tariffL1: tar, tariffL2: 'All', scenario: 'Base Case' };
    return { key: [seg, prod, 'All', chan, 'All', tar, 'All'].join('|'),
             bf: fc.calculateBaseForecast(hist, cohort, seed, 12, 1.0, 1.5, 3, 'Holt Linear') };
  }

  async function render(loaded: any, store: Map<string, any>, tariff: string | null, groupByTariff: boolean) {
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
      activeFilter: { segment: 'Corporate', product: { l1: 'Mobile Voice', l2: null },
        channel: { l1: 'Direct', l2: null }, tariff: { l1: tariff, l2: null } },
      formatNumber: (x: any) => String(x), setActiveView: noop, downloadExcel: noop,
    };
    await (act as any)(async () => {
      root.render(React.createElement(ForecastProvider as any, {
        baseForecast: loaded, setBaseForecast: noop, adjustedForecast: null, setAdjustedForecast: noop,
        forecastStore: store, setForecastStore: noop, hasLegacyBaseline: true,
        // The seam. The trap harness drives the REAL component, so it must
        // supply the real contract - store hit, else derive from leaves in
        // scope, else null with a reason. A stub returning null would make
        // every trap measure a screen with no forecast.
        resolveForecast: (key: string) => {
          const hit = store.get(key);
          if (hit) return { forecast: hit, reason: null };
          const leaves = [...store.entries()]
            .filter(([k]) => k !== key && keyCovers(key, k))
            .map(([, v]) => v);
          if (!leaves.length) return { forecast: null, reason: 'never-enumerated' };
          const [segment, product, productL2, channel, channelL2, tariffL1, tariffL2] = key.split('|');
          const d = deriveAggregate(leaves, { segment, product, productL2, channel, channelL2, tariffL1, tariffL2, scenario: 'Base Case' } as any);
          return { forecast: d, reason: d ? null : 'insufficient-history' };
        },
        canResolve: (key: string) => store.has(key)
          || [...store.keys()].some(k => k !== key && keyCovers(key, k)),
        updatedAt: new Date().toISOString(), bulkRuns: [], setBulkRuns: noop,
      }, React.createElement(Tab as any, props)));
    });
    if (groupByTariff) {
      for (const cb of [...container.querySelectorAll('input[type=checkbox]')] as any[]) {
        const lbl = (cb.closest('label')?.textContent || cb.parentElement?.textContent || '').trim();
        if (/tariff/i.test(lbl) && /l1/i.test(lbl) && !cb.checked) await (act as any)(async () => { cb.click(); });
      }
    }
    const text = container.textContent || '';
    // Summary MAPE cards ONLY. Scraping every percentage on the page cannot
    // isolate tarMatch: the variance and accuracy figures move with the filter
    // for unrelated reasons, so an all-percentages diff always differs and the
    // trap passes whatever tarMatch does. Verified by mutation.
    const summaryCards: string[] = [];
    for (const card of [...container.querySelectorAll('div')]) {
      const ps = [...card.querySelectorAll(':scope > p')];
      if (ps.length < 2) continue;
      const head = (ps[0].textContent || '').trim();
      if (!/ MAPE$/.test(head)) continue;
      // FIND the value, do not index to it. This read `ps[1]` and broke the
      // moment a subtitle was inserted between the heading and the number: it
      // then scraped the same static caption from every card, so the filtered
      // and cleared states compared textually identical and trap B "passed"
      // by measuring nothing. An index into sibling paragraphs encodes the
      // layout, and the layout is not what this trap is about.
      const valueEl = ps.slice(1).find(p => /[%—]/.test(p.textContent || ''));
      if (!valueEl) continue;
      summaryCards.push(`${head}=${(valueEl.textContent || '').trim()}`);
    }
    // Monthly variance table: month | actual | baseline | variance | var% | inBand
    const variance: { month: string; actual: number; baseline: number }[] = [];
    for (const d of [...container.querySelectorAll('details')]) {
      const h = d.querySelector('h4')?.textContent || '';
      if (!/Base/i.test(h)) continue;
      for (const tr of [...d.querySelectorAll('tbody tr')]) {
        const td = [...tr.querySelectorAll('td')].map(x => (x.textContent || '').trim());
        if (td.length < 3) continue;
        variance.push({ month: td[0], actual: Number(td[1]), baseline: Number(td[2]) });
      }
      break;
    }
    // Accuracy table rows: label -> the four component score cells, raw
    const acc: Record<string, string> = {};
    const tars = [...new Set(rows.map(r => v(r, C.t1)))].filter(x => x && x !== 'undefined');
    for (const tb of [...container.querySelectorAll('table')]) {
      const rws = [...tb.querySelectorAll('tbody tr')];
      if (!rws.some(tr => tars.some(t => (tr.textContent || '').includes(t)))) continue;
      for (const tr of rws) {
        const td = [...tr.querySelectorAll('td')].map(x => (x.textContent || '').trim());
        if (td.length >= 5) acc[td[0]] = td.slice(1, 5).join(' | ');
      }
      break;
    }
    await (act as any)(async () => { root.unmount(); });
    return { text, variance, acc, summaryCards };
  }

  // ── ground truth straight from the file ──────────────────────────────────
  const tariffScaleBase = (tar: string | null) => {
    const months = new Map<string, number>();
    for (const r of rows) {
      if (v(r, C.seg) !== 'Corporate' || v(r, C.prod) !== 'Mobile Voice') continue;
      if (v(r, C.chan) !== 'Direct' || v(r, C.metric) !== 'Base') continue;
      if (tar && v(r, C.t1) !== tar) continue;
      months.set(v(r, C.date), (months.get(v(r, C.date)) || 0) + (Number(r[C.val]) || 0));
    }
    return months;
  };
  const oneTariff = tariffScaleBase('RED S');
  const allTariffs = tariffScaleBase(null);
  const lastMonth = [...oneTariff.keys()].sort().pop()!;
  const ratio = (allTariffs.get(lastMonth) || 0) / (oneTariff.get(lastMonth) || 1);

  const redS = build('Corporate', 'Mobile Voice', 'Direct', 'RED S');
  if (!redS) { console.error('ABORT: could not build the RED S reference forecast'); process.exit(2); }

  // ── TRAP A — tariff grain ────────────────────────────────────────────────
  // Positive control: the all-tariff total must be materially larger than the
  // single-tariff total, or the fixture cannot express this defect at all.
  if (!(ratio > 2)) {
    record('A', 'tariff grain (actualsAggrMap + computeForecastMape)', 'INCONCLUSIVE',
      `fixture cannot express the defect: all-tariff/one-tariff Base ratio is only ${ratio.toFixed(2)}x`);
  } else {
    const r = await render(redS.bf, new Map([[redS.key, redS.bf]]), 'RED S', false);
    const scale = r.variance.length
      ? r.variance.reduce((s, x) => s + x.actual, 0) / r.variance.length
      : NaN;
    const expectOne = oneTariff.get(lastMonth) || 0;
    const expectAll = allTariffs.get(lastMonth) || 0;
    const nearOne = isFinite(scale) && Math.abs(scale - expectOne) / expectOne < 0.5;
    const nearAll = isFinite(scale) && Math.abs(scale - expectAll) / expectAll < 0.5;
    if (!r.variance.length) {
      record('A', 'tariff grain (actualsAggrMap + computeForecastMape)', 'INCONCLUSIVE',
        'no Base variance rows rendered — nothing was compared');
    } else if (nearAll) {
      record('A', 'tariff grain (actualsAggrMap + computeForecastMape)', 'FAIL',
        `Base actuals ~${Math.round(scale)} match the ALL-TARIFF total ~${Math.round(expectAll)}, not the RED S total ~${Math.round(expectOne)}. ` +
        `This is the +97.7% defect: actuals summed across ${ratio.toFixed(1)}x the forecast's scope.`);
    } else if (nearOne) {
      // The variance table above is fed by actualsAggrMap. computeForecastMape is
      // a SEPARATE path feeding the summary MAPE cards, and breaking only its
      // tariff scoping left every trap green while the cards read 97.6% -- the
      // exact defect this trap names. Assert the cards too, or the docstring
      // claims coverage the trap does not have.
      const cardPcts = r.summaryCards
        .map(c => Number((c.split('=')[1] || '').replace('%', '')))
        .filter(n => isFinite(n));
      const worst = cardPcts.length ? Math.max(...cardPcts) : NaN;
      if (!cardPcts.length) {
        record('A', 'tariff grain (actualsAggrMap + computeForecastMape)', 'INCONCLUSIVE',
          'variance table is correctly scoped but no summary MAPE cards rendered, so computeForecastMape was not exercised');
      } else if (worst > 20) {
        record('A', 'tariff grain (actualsAggrMap + computeForecastMape)', 'FAIL',
          `variance table is correctly tariff-scoped (~${Math.round(scale)}) but summary MAPE peaks at ${worst}% -- ` +
          `computeForecastMape is scoping actuals across ${ratio.toFixed(1)}x its forecast's tariff scope. This is the +97.7% defect on the cards.`);
      } else {
        record('A', 'tariff grain (actualsAggrMap + computeForecastMape)', 'PASS',
          `Base actuals ~${Math.round(scale)} match the RED S total ~${Math.round(expectOne)} (all-tariff ~${Math.round(expectAll)}, ${ratio.toFixed(1)}x); ` +
          `summary MAPE peaks at ${worst}% (computeForecastMape scoped correctly)`);
      }
    } else {
      record('A', 'tariff grain (actualsAggrMap + computeForecastMape)', 'FAIL',
        `Base actuals ~${Math.round(scale)} match neither the RED S total ~${Math.round(expectOne)} nor the all-tariff total ~${Math.round(expectAll)}`);
    }
  }

  // ── TRAP B — summaryMape's tarMatch ──────────────────────────────────────
  // A tariff filter must narrow the forecast set, so the summary cards must
  // differ between filtered and cleared. Identical output means tarMatch is gone.
  {
    const store = new Map<string, any>();
    for (const tar of ['RED S', 'RED M', 'RED L', 'RED XL', 'RED ULTD']) {
      const b = build('Corporate', 'Mobile Voice', 'Direct', tar);
      if (b) store.set(b.key, b.bf);
    }
    const set = await render(redS.bf, store, 'RED S', false);
    const clr = await render(redS.bf, store, null, false);
    const a = set.summaryCards.join(','), b = clr.summaryCards.join(',');
    if (!a && !b) {
      record('B', "summaryMape tarMatch", 'INCONCLUSIVE', 'no summary MAPE cards rendered in either state');
    } else if (a === b) {
      record('B', "summaryMape tarMatch", 'FAIL',
        `summary MAPE identical with the tariff filter set and cleared (${a || '(none)'}) — the tariff filter is not narrowing the forecast set`);
    } else {
      record('B', "summaryMape tarMatch", 'PASS',
        `summary MAPE changes when the tariff filter is applied (set=${a.slice(0, 40)} cleared=${b.slice(0, 40)})`);
    }
  }

  // ── TRAP C — !matchingBfs.length early return ────────────────────────────
  // Seed ONLY Corporate. Rows from other segments have no forecast and must
  // render unscored. Positive control: Corporate rows must still score.
  {
    const store = new Map<string, any>();
    for (const tar of ['RED S', 'RED M', 'RED L', 'RED XL', 'RED ULTD']) {
      const b = build('Corporate', 'Mobile Voice', 'Direct', tar);
      if (b) store.set(b.key, b.bf);
    }
    const r = await render(redS.bf, store, 'RED S', true);
    const labels = Object.keys(r.acc);
    const corp = labels.filter(k => k.startsWith('Corporate'));
    const other = labels.filter(k => !k.startsWith('Corporate'));
    const hasDigit = (s: string) => /\d/.test(s);
    const controlScored = corp.length > 0 && corp.every(k => hasDigit(r.acc[k]));
    const fabricated = other.filter(k => hasDigit(r.acc[k]));
    if (!other.length) {
      record('C', 'no-forecast rows render unscored', 'INCONCLUSIVE',
        `no non-Corporate rows rendered — nothing was on the no-forecast path (rows: ${labels.length})`);
    } else if (!controlScored) {
      record('C', 'no-forecast rows render unscored', 'INCONCLUSIVE',
        'positive control failed: Corporate rows, which DO have forecasts, are not scoring either');
    } else if (fabricated.length) {
      record('C', 'no-forecast rows render unscored', 'FAIL',
        `${fabricated.length} of ${other.length} rows with no forecast render a score: ` +
        fabricated.slice(0, 3).map(k => `${k} => ${r.acc[k]}`).join(' ; '));
    } else {
      record('C', 'no-forecast rows render unscored', 'PASS',
        `${other.length} rows with no forecast all unscored; ${corp.length} forecast-backed rows still score (control holds)`);
    }
  }

  // ── report ───────────────────────────────────────────────────────────────
  console.log('\nREGRESSION TRAPS\n' + '='.repeat(72));
  for (const r of results) {
    console.log(`[${r.state.padEnd(12)}] ${r.id}. ${r.name}`);
    console.log(`               ${r.detail}`);
  }
  console.log('='.repeat(72));
  const failed = results.filter(r => r.state === 'FAIL');
  const incon = results.filter(r => r.state === 'INCONCLUSIVE');
  console.log(`${results.filter(r => r.state === 'PASS').length} pass, ${failed.length} fail, ${incon.length} inconclusive`);
  if (incon.length) console.log('INCONCLUSIVE is not a pass — the trap did not exercise its defect.');
  process.exit(failed.length || incon.length ? 1 : 0);
}
main().catch(e => { console.error('ABORT', e); process.exit(2); });
