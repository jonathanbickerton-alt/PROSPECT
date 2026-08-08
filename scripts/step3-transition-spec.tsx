/**
 * WALK C-17, SECOND HALF — the Step 3 inversion, as TRANSITIONS.
 *
 *   npm run spec:step3-transition
 *
 * ── Why transitions, and why this spec exists at all ──────────────────────
 *
 * Jon saw a restored session render Step 1 while Actuals Review showed the
 * never-generated message. The diagnosis could not reproduce it: Session L's
 * diff touches neither ForecastVsActualsTab nor ForecastContext, no hunk covers
 * the restore path, and replaying the real save through the seam resolved BOTH
 * surfaces. Under the controlled protocol it did not recur either.
 *
 * One asymmetry candidate survived that: NAVIGATION ORDER. `stdSelectionFilter`
 * is Step 1's own state and restore does not set it; the tab-switch effect
 * overwrites `baseForecast` from `step3Filter` on every `activeView` change,
 * with `[activeView]` as its only dependency. Nothing in a single mounted state
 * can see that — a mount-with-X spec does not cover transition-to-X, and
 * transitions are where this class of defect lives.
 *
 * So this is a TRIPWIRE, not a fix. Each sequence is driven through the
 * production seam and the production filter/key conversion (utils/viewFilter,
 * extracted for exactly this reason — a transcribed conversion pins the spec,
 * not the app), and the real tab is mounted at the end of each one.
 *
 * If a sequence ever goes red, the mechanism is in that sequence and the walk
 * note says what to capture: the exact navigation sequence since reload.
 *
 * ── What is deliberately NOT claimed ──────────────────────────────────────
 *
 * Green here does not prove the defect impossible. It proves these four orders
 * do not produce it, on this store, with the columns mapped. That is the honest
 * scope of a tripwire, and it is stated so a later reader does not upgrade it.
 */
import * as fs from 'fs';
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

async function main() {
  const XLSX: any = (await import('xlsx')).default ?? (await import('xlsx'));
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const i18n = (await import('../src/i18n')).default;
  await (i18n as any).init?.();
  const fc: any = await import('../src/utils/forecasting');
  const vf: any = await import('../src/utils/viewFilter');
  const { ForecastProvider } = await import('../src/context/ForecastContext');
  const mod: any = await import('../src/components/ForecastVsActualsTab');
  const Tab = mod.default ?? mod.ForecastVsActualsTab ?? Object.values(mod).find((x: any) => typeof x === 'function');
  const noop = () => {};

  const FIX = 'test-data/VBU_IBRO_EdgeCases_ShortHistory_PerScenarioARPU_Jan2023_Jun2026.xlsx';
  const C = { date: 'Month', metric: 'IBRO_Scenario_Type', val: 'Subscriber_Volume',
    seg: 'Customer_Segment', prod: 'Product_L1', prodL2: 'Product_L2_Value_Tier',
    chan: 'Channel_Level_1', chanL2: 'Channel_Level_2',
    t1: 'tariff_tier_l1', t2: 'tariff_tier_l2', rev: 'Monthly_Revenue_GBP' };
  const rows: any[] = XLSX.utils.sheet_to_json(XLSX.readFile(FIX).Sheets[XLSX.readFile(FIX).SheetNames[0]]);
  const v = (r: any, k: string) => String(r[k] ?? '').trim();

  // ── A store exactly as RESTORE leaves it: leaf fits rehydrated, nothing else
  const dm = fc.buildCohortDataMap(rows, C.date, C.seg, C.prod, C.prodL2, C.chan, C.chanL2, C.t1, C.t2);
  const { leafMap } = fc.buildRollUpIndex([...dm.keys()]);
  const AGG = fc.makeForecastKey('All', 'All', 'All', 'All', 'All', 'All', 'All');
  const store = new Map<string, any>();
  for (const k of leafMap.get(AGG)!) {
    const [seg, prod, prodL2, chan, chanL2, t1, t2] = k.split('|');
    const sel = rows.filter(r => v(r, C.seg) === seg && v(r, C.prod) === prod && v(r, C.prodL2) === prodL2
      && v(r, C.chan) === chan && v(r, C.chanL2) === chanL2 && v(r, C.t1) === t1 && v(r, C.t2) === t2);
    const acc = new Map<number, any>();
    for (const r of sel) {
      const d = new Date(String(v(r, C.date)).slice(0, 7) + '-01'); if (isNaN(d.getTime())) continue;
      const tt = d.getTime();
      if (!acc.has(tt)) acc.set(tt, { _parsedDate: d, inflow: 0, outflow: 0, retention: 0,
        arpu: 0, inflowArpu: 0, outflowArpu: 0, retentionArpu: 0, baseArpu: 0 });
      const e = acc.get(tt)!, m = v(r, C.metric), val = Number(r[C.val]) || 0;
      if (m === 'Inflow') e.inflow += val; else if (m === 'Outflow') e.outflow += val;
      else if (m === 'Retention') e.retention += val;
    }
    const series = [...acc.values()].sort((a, b) => a._parsedDate - b._parsedDate);
    const bf = fc.calculateBaseForecast(series,
      { segment: seg, product: prod, productL2: prodL2, channel: chan, channelL2: chanL2,
        tariffL1: t1, tariffL2: t2, scenario: 'Base Case' }, 1000, 12, 1.0, 1.5, 3, 'Holt Linear');
    if (bf) store.set(k, bf);
  }
  check('PREMISE: the restored store holds leaf forecasts', store.size === 72, String(store.size));

  /** THE SEAM, production. Every sequence step resolves through this. */
  const resolveForecast = (key: string) => fc.resolveFromStore(store, leafMap, key);

  /**
   * The tab-switch effect's BODY, verbatim in behaviour:
   *   setBaseForecast(resolveForecast(filterToKey(stepNFilter)).forecast)
   * filterToKey is the production function, not a copy.
   */
  // DRIVES the production function, does not model it. The previous version
  // reimplemented the effect's body here, so trap 36 could break the real
  // effect and leave all four sequences green.
  const onEnterStep3 = (step3Filter: any) =>
    vf.forecastForView('vsactuals', step3Filter, step3Filter, resolveForecast).forecast;

  // Restore picks the Is_Active cohort, resolves it through the seam, and sets
  // step3Filter from the RESOLVED forecast's cohort (App.tsx:893).
  // A PARTIALLY specified aggregate - segment AND product set, the rest All -
  // matching the shape of Jon's real Is_Active key (Corporate|Fixed
  // Connectivity|All|...). The first version used a segment-only key, where
  // product is already 'All', so the product arm of the filter round trip was
  // never exercised: trap 37 planted a break in it and every sequence stayed
  // green. A population that cannot express the defect proves nothing about it.
  const firstLeaf = leafMap.get(AGG)![0].split('|');
  const activeKey = fc.makeForecastKey(firstLeaf[0], firstLeaf[1], 'All', 'All', 'All', 'All', 'All');
  const restored = resolveForecast(activeKey).forecast;
  check('PREMISE: restore resolves the active cohort', !!restored,
    'the premise of every sequence below is absent');
  let step3Filter = vf.cohortToFilter(restored!.cohort);
  check('PREMISE: step3Filter round-trips back to the same key',
    vf.filterToKey(step3Filter) === activeKey,
    `${vf.filterToKey(step3Filter)} vs ${activeKey}`);

  const NEVER = i18n.t('actuals_no_forecast_loaded');
  check('PREMISE: the never-generated heading resolved from i18n',
    !!NEVER && NEVER !== 'actuals_no_forecast_loaded', NEVER);

  async function mountStep3(baseForecast: any, storeForMount = store) {
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
      activeFilter: step3Filter,
      formatNumber: (x: any) => String(x), setActiveView: noop, downloadExcel: noop,
    };
    await (act as any)(async () => {
      root.render(React.createElement(ForecastProvider as any, {
        baseForecast, setBaseForecast: noop, adjustedForecast: null, setAdjustedForecast: noop,
        forecastStore: storeForMount, setForecastStore: noop, hasLegacyBaseline: true,
        resolveForecast, canResolve: () => true,
        updatedAt: Date.now(), bulkRuns: [], setBulkRuns: noop,
      }, React.createElement(Tab as any, props)));
    });
    await (act as any)(async () => { await new Promise(r => setTimeout(r, 30)); });
    return container;
  }

  /** One sequence: a list of navigation steps, ending on Step 3. */
  async function runSequence(name: string, steps: Array<'step1' | 'step3' | 'selection-change'>) {
    // Step 1 does NOT write baseForecast — its panel derives (Session L). The
    // only writer in these sequences is the tab-switch effect entering Step 3.
    let baseForecast: any = restored;
    for (const s of steps) {
      if (s === 'step3') baseForecast = onEnterStep3(step3Filter);
      else if (s === 'selection-change') {
        // handleStep3FilterChange: setStep3Filter(f) then setBaseForecast via seam.
        step3Filter = vf.cohortToFilter(restored!.cohort);
        baseForecast = resolveForecast(vf.filterToKey(step3Filter)).forecast;
      }
      // 'step1' changes activeView to 'standard': the tab-switch effect has no
      // arm for it, so baseForecast is left as-is. Modelled by doing nothing,
      // which is the behaviour under test.
    }
    const c = await mountStep3(baseForecast);
    const txt = c.textContent || '';
    check(`SEQ ${name}: Actuals Review renders`, !txt.includes(NEVER),
      'the never-generated message is on screen — F1 REPRODUCED, report the mechanism');
    check(`SEQ ${name}: and it rendered something substantial`, txt.length > 200,
      `${txt.length} chars`);
  }

  await runSequence('restore -> Step 3', ['step3']);
  await runSequence('restore -> Step 1 -> Step 3', ['step1', 'step3']);
  await runSequence('restore -> Step 1 -> selection change -> Step 3',
    ['step1', 'selection-change', 'step3']);
  await runSequence('restore -> Step 3 -> Step 1 -> Step 3', ['step3', 'step1', 'step3']);

  // ── POSITIVE CONTROL ────────────────────────────────────────────────────
  // Without this, every "message absent" above would pass for a tab that failed
  // to render at all, or for a message that can no longer be reached.
  {
    const empty = new Map<string, any>();
    const c = await mountStep3(null, empty);
    const txt = c.textContent || '';
    check('CONTROL: on a genuinely empty store the never-generated message RENDERS',
      txt.includes(NEVER),
      'the message is unreachable — every absence check above is vacuous');
    check('CONTROL: and it offers the Step 1 route',
      txt.includes(i18n.t('common_go_to_step_1')));
  }

  // ── The gate this tripwire watches, pinned ──────────────────────────────
  {
    const tab = fs.readFileSync('src/components/ForecastVsActualsTab.tsx', 'utf8');
    check('GATE: Actuals Review still gates on the context forecast',
      /if \(!baseForecast\) \{/.test(tab),
      'the gate moved — this tripwire may be watching the wrong thing');
    const app = fs.readFileSync('src/App.tsx', 'utf8');
    check('GATE: the tab-switch effect still delegates to forecastForView',
      /forecastForView\(activeView, step2Filter, step3Filter/.test(app),
      'the transition under test changed shape');
    check('GATE: App delegates the filter conversion rather than owning a copy',
      /from '\.\/utils\/viewFilter'/.test(app),
      'a second conversion has grown back and this spec is testing the wrong one');
  }

  console.log(`step3-transition spec: ${pass} passed, ${fails.length} failed`);
  fails.forEach(f => console.log('  FAIL ' + f));
  process.exit(fails.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
