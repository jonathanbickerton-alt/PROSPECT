/**
 * CHALLENGER RENDER — what a derived row actually PUTS ON SCREEN.
 *
 *   npm run spec:challenger
 *
 * Every previous B3 assertion was on provenance: does `deriveAggregate` carry a
 * leafCount, does `provenanceModel` return null. All true, all green, and the
 * leaf count and model histogram rendered NOWHERE — the approved design put the
 * mix on the row and the row showed a fixed string instead. A spec that stays
 * green whether or not the value reaches a surface is asserting the wrong layer.
 *
 * So this one mounts the real ForecastVsActualsTab, clicks through to the
 * challenger tab, and reads the DOM.
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
  const { deriveAggregate } = await import('../src/utils/forecasting');
  const mod: any = await import('../src/components/ForecastVsActualsTab');
  const Tab = mod.default ?? mod.ForecastVsActualsTab ?? Object.values(mod).find((x: any) => typeof x === 'function');
  const noop = () => {};

  const wb = XLSX.readFile(FIX);
  const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

  const keyCovers = (agg: string, leaf: string) => {
    const a2 = agg.split('|'), l = leaf.split('|');
    return a2.length === 7 && l.length === 7 && a2.every((p, i) => p === 'All' || p === l[i]);
  };

  /** A leaf fit, seeded from its own last historical Base. */
  function build(seg: string, prod: string, chan: string, tar: string) {
    const sel = rows.filter(r => v(r, C.seg) === seg && v(r, C.prod) === prod
      && (chan === 'All' || v(r, C.chan) === chan) && (tar === 'All' || v(r, C.t1) === tar));
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

  // A store of real leaf fits across one segment, so a segment-level roll-up is
  // a genuine MULTI-leaf derived aggregate.
  const store = new Map<string, any>();
  const segs = [...new Set(rows.map(r => v(r, C.seg)))].filter(Boolean);
  const prods = [...new Set(rows.map(r => v(r, C.prod)))].filter(Boolean);
  const chans = [...new Set(rows.map(r => v(r, C.chan)))].filter(Boolean);
  const tars = [...new Set(rows.map(r => v(r, C.t1)))].filter(Boolean);
  void tars;
  outer:
  for (const s of segs) for (const p of prods) for (const c of chans) {
    const b = build(s, p, c, 'All');
    if (b?.bf) store.set(b.key, b.bf);
  }
  // NO 12-ENTRY CAP. The cap was the reason this harness could not reach a
  // fitted row at leaf grain, and the gap it produced was declared for two
  // sessions as a property of the product. It was a property of the test:
  // 12 fits against actuals covering every cohort leaves most rows with nothing
  // to resolve. spec:leafgrain establishes that leaf-grain rows score normally.
  // Also a PRODUCT-grain fit per segment. A store legitimately holds fits at
  // whatever grain someone generated, and this is the grain the challenger's
  // Product L1 toggle asks for - so a fitted row is reachable by a toggle a
  // user can actually click, rather than only in principle.
  for (const s2 of segs) for (const p2 of prods) {
    const b = build(s2, p2, 'All', 'All');
    if (b?.bf) store.set(b.key, b.bf);
  }
  check('PREMISE: a store of real leaf fits was built', store.size >= 4, `${store.size} leaves`);

  // The loaded cohort: a DERIVED aggregate over those leaves.
  const seg0 = [...store.keys()][0].split('|')[0];
  const mine = [...store.entries()].filter(([k]) => k.split('|')[0] === seg0).map(([, b]) => b);
  const derived = deriveAggregate(mine, { segment: seg0, product: 'All', productL2: 'All',
    channel: 'All', channelL2: 'All', tariffL1: 'All', tariffL2: 'All', scenario: 'Base Case' } as any);
  check('PREMISE: the loaded cohort is DERIVED with >1 leaf',
    !!derived && (derived.provenance as any).kind === 'derived' && (derived.provenance as any).leafCount > 1,
    derived ? `leafCount=${(derived.provenance as any).leafCount}` : 'null');

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
      baseForecast: derived, setBaseForecast: noop, adjustedForecast: null, setAdjustedForecast: noop,
      forecastStore: store, setForecastStore: noop, hasLegacyBaseline: true,
      resolveForecast: (key: string) => {
        const hit = store.get(key);
        if (hit) return { forecast: hit, reason: null };
        const lv = [...store.entries()].filter(([k]) => k !== key && keyCovers(key, k)).map(([, b]) => b);
        if (!lv.length) return { forecast: null, reason: 'never-enumerated' };
        const [sg, pr, p2, ch, c2, t1, t2] = key.split('|');
        return { forecast: deriveAggregate(lv, { segment: sg, product: pr, productL2: p2, channel: ch,
          channelL2: c2, tariffL1: t1, tariffL2: t2, scenario: 'Base Case' } as any), reason: null };
      },
      canResolve: () => true,
      updatedAt: Date.now(), bulkRuns: [], setBulkRuns: noop,
    }, React.createElement(Tab as any, props)));
  });

  /** Click the first element whose text matches. */
  async function clickText(re: RegExp, tag = '*') {
    // Flush first. A click that immediately follows another click's state update
    // can run against a tree React has not re-rendered yet, and the element you
    // are looking for legitimately does not exist at that instant.
    await (act as any)(async () => {});
    const el = [...container.querySelectorAll(tag)].reverse()
      .find(e => re.test(e.textContent || '') && !e.querySelector(tag === '*' ? 'button' : tag));
    if (!el) return false;
    await (act as any)(async () => { (el as any).click(); });
    await (act as any)(async () => {});
    return true;
  }

  const opened = await clickText(/AutoML Challenger/i, 'button');
  check('the AutoML Challenger tab can be opened', opened, 'no matching button found');

  // Bypass the accuracy threshold, or the list is empty on a healthy fixture and
  // every assertion below passes over zero rows - a vacuous green.
  if (process.env.DEBUG_CR) console.log('PRE-SHOWALL BUTTONS:', [...container.querySelectorAll('button')].map(b => JSON.stringify((b.textContent||'').trim())).join(' | ').slice(0, 600));
  // Only needed when the fixture is healthy enough that every cohort scores
  // above the threshold. Asserting the button EXISTS would fail whenever rows
  // are already listed - which is the good case.
  await clickText(/Review all cohorts anyway/i, 'button');
  check('the challenger list is not empty', /leaves|Best:/.test(container.textContent || ''),
    'no rows at all - every assertion below would pass over an empty set');
  if (process.env.DEBUG_CR) console.log('CBS AT ROWS:', [...container.querySelectorAll('input[type=checkbox]')].map((c: any) => JSON.stringify((c.closest('label')?.textContent||'').trim())).join(' | ').slice(0, 500));

  const text = () => container.textContent || '';

  // ── THE ASSERTION THAT WAS MISSING ───────────────────────────────────────
  // Not "provenance carries a leafCount" - does the SCREEN show it.
  const leafPhrase = /(\d+)\s+leaves/.exec(text());
  check('a derived row RENDERS its leaf count',
    !!leafPhrase, `no "N leaves" text on screen; first 200 chars: ${text().slice(0, 200).replace(/\s+/g, ' ')}`);
  check('a derived row RENDERS a model histogram beside the count',
    /leaves\s*—\s*[A-Za-z][A-Za-z\- ]*\s*x\d+/.test(text()),
    `no "N leaves — Model xN" text; sample: ${(text().match(/.{0,80}leaves.{0,80}/) || ['none'])[0]}`);
  check('the leaf count on screen is not zero', !!leafPhrase && Number(leafPhrase[1]) > 0,
    leafPhrase ? leafPhrase[1] : 'n/a');

  // ── The illustration panel must be GONE for a derived selection ──────────
  const rowButtons = [...container.querySelectorAll('button')]
    .filter(b => /leaves/.test(b.textContent || ''));
  check('a derived row is selectable', rowButtons.length > 0, `${rowButtons.length} rows carrying a mix`);
  if (rowButtons.length) {
    await (act as any)(async () => { (rowButtons[0] as any).click(); });
    const t2 = text();
    check('a derived selection shows the suppression banner',
      /models live on leaf cohorts|leaf cohorts/i.test(t2),
      t2.slice(0, 200).replace(/\s+/g, ' '));
    check('a derived selection shows NO error-ranked model legend',
      !/%\s*err/i.test(t2),
      (t2.match(/.{0,60}% err.{0,40}/) || ['none'])[0]);
    check('a derived selection draws no illustration chart',
      container.querySelectorAll('svg.recharts-surface').length === 0,
      `${container.querySelectorAll('svg.recharts-surface').length} chart surfaces`);
  }

  // ── THE CONTROL. Everything above asserts an ABSENCE - no legend, no chart.
  // An absence is only evidence if this harness can produce the presence.
  // Recharts bails at width -1 and paints nothing, so without this "no chart
  // surface" would pass on every branch and prove nothing at all.
  {
    await clickText(/^Forecast vs Actuals$/i, 'button');
    const surfaces = container.querySelectorAll('svg.recharts-surface').length;
    check('CONTROL: this harness CAN paint a Recharts surface',
      surfaces > 0,
      `${surfaces} surfaces on a chart-bearing tab - if 0, the "no chart" assertion above is vacuous`);
  }

  // ── THE FITTED CASE, and the stage-2 route re-tested ────────────────────
  // Declared unreachable for two sessions. It was reachable: the blocker was
  // this harness's own 12-fit cap, now removed. `spec:leafgrain` established
  // that the product scores leaf-grain rows normally, which is what made a
  // retry worth running instead of re-declaring the gap.
  {
    await clickText(/AutoML Challenger/i, 'button');
    await (act as any)(async () => {});
    let toggled = 0;
    for (const want of [/^Product L1/i]) {
      await (act as any)(async () => {});
      const x: any = [...container.querySelectorAll('input[type=checkbox]')]
        .find((e: any) => want.test((e.closest('label')?.textContent || '').trim())
          && !e.checked && !e.disabled);
      if (x) { await (act as any)(async () => { x.click(); }); toggled++; }
    }
    await (act as any)(async () => {});
    await clickText(/Review all cohorts anyway/i, 'button');
    check('STAGE-2 ROUTE: the Product L1 toggle was available', toggled === 1, `${toggled} of 1`);

    const fitted = [...container.querySelectorAll('button')]
      .filter(b => /Best:/i.test(b.textContent || ''));
    check('STAGE-2 ROUTE REPRODUCED: a fitted row appears at leaf grain',
      fitted.length > 0, `${fitted.length} rows carrying a "Best:" recommendation`);

    if (fitted.length) {
      check('FITTED: the row shows a model name, not a leaf mix',
        !/leaves/.test(fitted[0].textContent || ''),
        (fitted[0].textContent || '').slice(0, 90));
      await (act as any)(async () => { (fitted[0] as any).click(); });
      await (act as any)(async () => {});
      const tf = container.textContent || '';
      // The complement of the derived assertions above. Together they prove the
      // suppression is scoped to derivedMix rather than simply always-on.
      check('FITTED: the error-ranked legend IS shown for a fitted row',
        /%\s*err/i.test(tf), 'no "% err" on a fitted selection either');
      check('FITTED: the illustration chart IS drawn for a fitted row',
        container.querySelectorAll('svg.recharts-surface').length > 0,
        `${container.querySelectorAll('svg.recharts-surface').length} surfaces`);
      check('FITTED: the derived suppression banner is NOT shown',
        !/models live on leaf cohorts/i.test(tf),
        'the derived-only banner leaked onto a fitted row');
    }
  }

  if (process.env.DEBUG_CR) {
    console.log('CHECKBOXES:', [...container.querySelectorAll('input[type=checkbox]')]
      .map((cb: any) => JSON.stringify((cb.closest('label')?.textContent || '').trim()) + '=' + cb.checked).join(' | '));
    console.log('ROW SAMPLE:', [...container.querySelectorAll('button')]
      .map(b => (b.textContent || '').trim()).filter(t => t.length > 12).slice(0, 6).join('  ||  '));
  }
  console.log(`challenger-render spec: ${pass} passed, ${fails.length} failed`);
  fails.forEach(f => console.log('  FAIL ' + f));
  process.exit(fails.length ? 1 : 0);
}
main().catch(e => { console.error('ABORT', e); process.exit(2); });
