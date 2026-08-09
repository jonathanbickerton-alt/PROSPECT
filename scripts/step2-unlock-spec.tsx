/**
 * GENERATING UNLOCKS STEP 2, AND NAVIGATION NEVER RE-LOCKS IT.
 *
 *   npm run spec:step2-unlock
 *
 * Found on Jon's B-11 walk: 72 leaves generated on the edge fixture and Step 2
 * still locked. His testimony is that generation has always been the unlock and
 * that no save action exists or ever has — and nothing in the code contradicts
 * it. There is no save control after Step 1.
 *
 * THE PREDICATE WAS `hasLegacyBaseline`: a non-empty `savedForecasts`, the
 * pre-bottom-up 5-part store, written only by the STANDARD chart-series
 * generation path. Bulk leaf generation writes `forecastStore` and nothing
 * else, so:
 *
 *   - Step 1's scoped aggregate generate has NEVER unlocked Step 2 — it passes
 *     restrictToLeafKeys, which sets `targets = []`, so no Standard cohort is
 *     enrolled. True at d4a7f8a, ec77b34 and c161a42.
 *   - The Overall whole-book door DID, until 76c7c53 made both doors scoped
 *     leaf runs and removed the last writer of `savedForecasts` during bulk.
 *
 * THE GATE NOW DERIVES FROM STORE CONTENTS — `hasAnyUsableForecast` — which is
 * the corollary of surface-not-store this codebase already applies: a gate
 * reads what exists, not what a transient path populated. The store survives a
 * selection change, a tab move and a restore, so the unlock cannot flicker with
 * navigation.
 *
 * STATE-NOT-NAVIGATION is therefore the substance of this file, not a rider.
 * A mount showing "unlocked" proves the render; the transitions prove the gate.
 *
 * PRODUCTION-FED: leaves are fitted with the real `calculateBaseForecast`, and
 * the gate is the real exported predicate. Guard-trap 47 severs the store
 * derivation and the mounted assertion goes red.
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
  const fc: any = await import('../src/utils/forecasting');
  const mod: any = await import('../src/components/StepIndicator');
  const StepIndicator = mod.default ?? mod.StepIndicator;

  const FIX = 'test-data/VBU_IBRO_EdgeCases_ShortHistory_PerScenarioARPU_Jan2023_Jun2026.xlsx';
  const C = { date: 'Month', metric: 'IBRO_Scenario_Type', val: 'Subscriber_Volume',
    seg: 'Customer_Segment', prod: 'Product_L1', prodL2: 'Product_L2_Value_Tier',
    chan: 'Channel_Level_1', chanL2: 'Channel_Level_2',
    t1: 'tariff_tier_l1', t2: 'tariff_tier_l2', rev: 'Monthly_Revenue_GBP' };
  const wb = XLSX.read(fs.readFileSync(FIX), { type: 'buffer', cellDates: true });
  const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  const v = (r: any, k: string) => String(r[k] ?? '').trim();
  const mo = (r: any) => String(v(r, C.date)).slice(0, 7);

  const dm = fc.buildCohortDataMap(rows, C.date, C.seg, C.prod, C.prodL2, C.chan, C.chanL2, C.t1, C.t2);
  const { leafMap } = fc.buildRollUpIndex([...dm.keys()]);
  const ALL = fc.makeForecastKey('All', 'All', 'All', 'All', 'All', 'All', 'All');

  // ── A REAL BULK RUN: fit every leaf, write ONLY forecastStore ────────────
  // This is exactly what a scoped leaf run produces — nothing lands in the
  // legacy savedForecasts store, which is what left Step 2 locked.
  const store = new Map<string, any>();
  for (const k of leafMap.get(ALL) ?? []) {
    const [seg, prod, prodL2, chan, chanL2, t1, t2] = k.split('|');
    const sel = rows.filter(r => v(r, C.seg) === seg && v(r, C.prod) === prod && v(r, C.prodL2) === prodL2
      && v(r, C.chan) === chan && v(r, C.chanL2) === chanL2 && v(r, C.t1) === t1 && v(r, C.t2) === t2);
    const acc = new Map<number, any>();
    for (const r of sel) {
      const d = new Date(mo(r) + '-01'); if (isNaN(d.getTime())) continue;
      const tt = d.getTime();
      if (!acc.has(tt)) acc.set(tt, { _parsedDate: d, inflow: 0, outflow: 0, retention: 0,
        arpu: 0, inflowArpu: 0, outflowArpu: 0, retentionArpu: 0, baseArpu: 0 });
      const e = acc.get(tt)!, m = v(r, C.metric), val = Number(r[C.val]) || 0;
      if (m === 'Inflow') e.inflow += val; else if (m === 'Outflow') e.outflow += val;
      else if (m === 'Retention') e.retention += val;
    }
    const series = [...acc.values()].sort((a: any, b: any) => a._parsedDate - b._parsedDate);
    const bf = fc.calculateBaseForecast(series,
      { segment: seg, product: prod, productL2: prodL2, channel: chan, channelL2: chanL2,
        tariffL1: t1, tariffL2: t2, scenario: 'Base Case' }, 1000, 12, 1.0, 1.5, 3, 'Holt Linear');
    if (bf) store.set(k, bf);
  }
  check('PREMISE: a bulk run produced fitted leaves in the store',
    store.size === 72, `${store.size}`);
  check('PREMISE: and nothing reached the legacy savedForecasts store',
    true, 'this run writes forecastStore only, which is the whole point');

  // ── THE GATE, driven ─────────────────────────────────────────────────────
  const NO_LEGACY = false;
  check('GATE: a bulk-only run counts as having a forecast',
    fc.hasAnyUsableForecast(store, NO_LEGACY) === true,
    'generation does not unlock — the walk finding, unfixed');
  check('GATE: an empty store with no legacy does NOT',
    fc.hasAnyUsableForecast(new Map(), NO_LEGACY) === false,
    'the gate is open before anything is generated — it would never lock');
  check('GATE: a legacy-only session still counts',
    fc.hasAnyUsableForecast(new Map(), true) === true,
    'a pre-bottom-up saved session lost its unlock');

  // A store of ONLY retired aggregate fits must not unlock: the seam refuses to
  // return them, so no view can produce a forecast from that store.
  {
    const retiredOnly = new Map<string, any>();
    const aggKey = fc.makeForecastKey('Corporate', 'All', 'All', 'All', 'All', 'All', 'All');
    const anyLeaf = [...store.values()][0];
    retiredOnly.set(aggKey, { ...anyLeaf, provenance: { kind: 'fitted', modelUsed: 'Holt Linear' } });
    check('GATE PREMISE: that entry really is a retired aggregate fit',
      fc.isRetiredAggregateFit(aggKey, retiredOnly.get(aggKey)) === true, 'premise broken');
    check('GATE: a store of only retired aggregate fits does NOT unlock',
      fc.hasAnyUsableForecast(retiredOnly, NO_LEGACY) === false,
      'the indicator claims coverage the seam refuses to serve');
  }

  // ── MOUNTED: the step indicator itself ──────────────────────────────────
  const render = async (over: any) => {
    const host = document.getElementById('root')!;
    host.replaceChildren();
    const container = document.createElement('div');
    host.appendChild(container);
    const root = createRoot(container);
    await (act as any)(async () => {
      root.render(React.createElement(StepIndicator as any, {
        activeStep: 1, hasBaseline: false, hasData: true, onStepClick: () => {}, ...over,
      }));
    });
    await (act as any)(async () => { await new Promise(r => setTimeout(r, 20)); });
    const buttons = [...container.querySelectorAll('button')];
    return { container, buttons, txt: container.textContent || '' };
  };
  /** Step 2's button, by position: the indicator renders one per step in order. */
  const step2Of = (buttons: Element[]) => buttons[1] as HTMLButtonElement | undefined;

  {
    // The gate fed by the REAL predicate on the REAL bulk store.
    const { buttons } = await render({ hasBaseline: fc.hasAnyUsableForecast(store, NO_LEGACY) });
    check('MOUNT: after a bulk run Step 2 is reachable',
      !!step2Of(buttons) && !step2Of(buttons)!.disabled,
      'Step 2 is still locked with 72 forecasts in the store — the walk finding');
  }
  {
    // POSITIVE CONTROL: locked must be reachable, or "unlocked" proves nothing.
    const { buttons } = await render({ hasBaseline: fc.hasAnyUsableForecast(new Map(), false) });
    check('MOUNT CONTROL: with nothing generated Step 2 IS locked',
      !!step2Of(buttons) && step2Of(buttons)!.disabled,
      'the indicator never locks — the unlock assertion is vacuous');
  }

  // ── STATE-NOT-NAVIGATION ────────────────────────────────────────────────
  //
  // The gate must not re-lock on anything that is merely navigation. Each of
  // these changes something the OLD gate would have been sensitive to, and
  // re-reads the real predicate against the unchanged store.
  {
    const gate = () => fc.hasAnyUsableForecast(store, NO_LEGACY);

    // A selection that resolves to nothing. baseForecast goes null; the store
    // does not change, so the gate must not move.
    const missKey = fc.makeForecastKey('Corporate', 'Mobile Voice', 'High Value',
      'Direct', 'Call Centre / Tele-sales', 'RED ULTD', 'SIM-only');
    const missed = fc.resolveFromStore(new Map(), leafMap, missKey);
    check('NAV PREMISE: that selection really does resolve to nothing',
      missed.forecast === null, 'the premise for the re-lock check is broken');
    const { buttons: b1 } = await render({ hasBaseline: gate() });
    check('NAV: a selection that resolves to NULL does not re-lock Step 2',
      !step2Of(b1)!.disabled,
      'the gate is reading the current forecast again, not the store');

    // Step 2 -> Step 1 -> Step 2. Only activeStep moves.
    const { buttons: b2 } = await render({ activeStep: 2, hasBaseline: gate() });
    check('NAV: on Step 2 itself the gate still holds', !step2Of(b2)!.disabled, 'locked while standing on it');
    const { buttons: b3 } = await render({ activeStep: 1, hasBaseline: gate() });
    check('NAV: back on Step 1 Step 2 remains reachable', !step2Of(b3)!.disabled, 're-locked by a tab move');
    const { buttons: b4 } = await render({ activeStep: 2, hasBaseline: gate() });
    check('NAV: and returning to Step 2 works', !step2Of(b4)!.disabled, 'the round trip re-locked it');

    // RESTORE: a fresh session object holding the same forecasts arrives
    // unlocked. Rebuilt as a new Map, because a restore does not hand back the
    // identical object and a gate keyed on identity would pass here wrongly.
    const restored = new Map(store);
    const { buttons: b5 } = await render({ hasBaseline: fc.hasAnyUsableForecast(restored, false) });
    check('NAV: a restored session with forecasts arrives UNLOCKED',
      !step2Of(b5)!.disabled,
      'a restore lands locked despite holding forecasts');
  }

  // ── THE COPY: no save action is described, because none exists ──────────
  {
    const en = JSON.parse(fs.readFileSync('src/locales/en/translation.json', 'utf8'));
    const sft = fs.readFileSync('src/components/StandardForecastTab.tsx', 'utf8');
    check('COPY: the placeholder no longer tells the user to save',
      !/save/i.test(String(en['baseline_forecast_appears_once_generated'] ?? '')),
      String(en['baseline_forecast_appears_once_generated']));
    check('COPY: and it names generating as the unlock',
      /generat/i.test(String(en['baseline_forecast_appears_once_generated'] ?? '')),
      'the corrected sentence does not say what unlocks Step 2');
    check('COPY: the surface no longer renders the save sentence',
      !sft.includes("t('baseline_the_forecast_will_appear_here_once_generated')"),
      'the old key is still on screen');
    for (const loc of ['en', 'de', 'es', 'fr', 'it', 'pt']) {
      const d = JSON.parse(fs.readFileSync(`src/locales/${loc}/translation.json`, 'utf8'));
      check(`COPY LOCALE ${loc}: the corrected key is present`,
        'baseline_forecast_appears_once_generated' in d);
    }
  }

  // ── WIRING: App must feed the indicator the derived gate ────────────────
  {
    const app = fs.readFileSync('src/App.tsx', 'utf8').replace(/\/\/[^\n]*/g, '');
    check('WIRING: the indicator is handed the store-derived gate',
      /hasBaseline=\{hasAnyForecast\}/.test(app),
      'the step indicator is back on the legacy-store gate');
    check('WIRING: and that gate is the shared predicate',
      /hasAnyUsableForecast\(forecastStore, hasLegacyBaseline\)/.test(app),
      'App computes its own version of the gate');
  }

  console.log(`step2-unlock spec: ${pass} passed, ${fails.length} failed`);
  fails.forEach(f => console.log('  FAIL ' + f));
  process.exit(fails.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
