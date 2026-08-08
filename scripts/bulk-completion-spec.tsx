/**
 * THE COMPLETION PANEL IS REACHABLE FROM A STEP 1 AGGREGATE GENERATE.
 *
 *   npm run spec:bulk-completion
 *
 * Session G's aggregate decline (7578038) put an early return above
 * `setTriggerBulkCheck`, so an aggregate generate raised no post-generation flow
 * at all. G's decline was deliberate and stated; this side effect was neither.
 * Everything the user needs to hear about a scoped run — the coverage statement,
 * the grain-named counters, the named skipped leaves, and Session G's own
 * retirement notice — lives in that panel, so a Step 1 generate reported nothing
 * about what it had covered.
 *
 * The panel now opens directly at 'complete' for a finished scoped run. There is
 * nothing to confirm: the work is already done, and a confirm step would be
 * offering to do it again.
 *
 * TWO HALVES, AND NEITHER COVERS THE OTHER. The mounted checks prove that GIVEN
 * a finished run the panel reports it correctly. The WIRING checks at the bottom
 * prove the app actually produces that run. Trap 39 replants Session G's
 * severance and is caught by the wiring half alone - the mounted half stays
 * green, because this spec hands the modal its summary as a prop.
 *
 * That is stated rather than left implicit: Session M found the same split in
 * the Step 3 tripwire and fixed it by extracting the function under test. Here
 * the App side is state plumbing inside a promise callback with nothing pure to
 * extract, so the wiring guard is the honest instrument - and a reader must not
 * assume the mount is watching it.
 *
 * PRODUCTION-FED. The summary is not hand-written here: the leaves are fitted
 * with the real `calculateBaseForecast`, the unfittable ones fall out of that
 * fit rather than being declared, and the retirement population is identified by
 * the real `isRetiredAggregateFit`. A spec may not feed itself the artefact
 * under test.
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
  const mod: any = await import('../src/components/BulkGenerateModal');
  const Modal = mod.BulkGenerateModal ?? mod.default;
  const noop = () => {};

  const FIX = 'test-data/VBU_IBRO_EdgeCases_ShortHistory_PerScenarioARPU_Jan2023_Jun2026.xlsx';
  const C = { date: 'Month', metric: 'IBRO_Scenario_Type', val: 'Subscriber_Volume',
    seg: 'Customer_Segment', prod: 'Product_L1', prodL2: 'Product_L2_Value_Tier',
    chan: 'Channel_Level_1', chanL2: 'Channel_Level_2',
    t1: 'tariff_tier_l1', t2: 'tariff_tier_l2', rev: 'Monthly_Revenue_GBP' };
  const rows: any[] = XLSX.utils.sheet_to_json(XLSX.readFile(FIX).Sheets[XLSX.readFile(FIX).SheetNames[0]]);
  const v = (r: any, k: string) => String(r[k] ?? '').trim();

  // ── A REAL scoped run: fit every leaf, let the unfittable ones fall out ──
  const dm = fc.buildCohortDataMap(rows, C.date, C.seg, C.prod, C.prodL2, C.chan, C.chanL2, C.t1, C.t2);
  const { leafMap } = fc.buildRollUpIndex([...dm.keys()]);
  const AGG = fc.makeForecastKey('All', 'All', 'All', 'All', 'All', 'All', 'All');
  const store = new Map<string, any>();
  const skipped: { fKey: string; reason: string }[] = [];
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
    else {
      const reason = fc.classifySkip(dm.get(k), null);
      if (reason) skipped.push({ fKey: k, reason });
    }
  }
  // This is the shape generateAllMissingForecasts resolves with.
  const summary = { grain: 'leaves' as const, generated: store.size, failed: skipped.length, skipped };

  check('PREMISE: the run produced a real summary', summary.generated === 72 && summary.failed === 2,
    `${summary.generated} generated, ${summary.failed} skipped`);
  check('PREMISE: skipped leaves carry a reason from the shared enum',
    skipped.every(s => s.reason === 'insufficient-history'),
    skipped.map(s => s.reason).join(','));

  async function render(over: any = {}) {
    const host = document.getElementById('root')!;
    host.replaceChildren();
    const container = document.createElement('div');
    host.appendChild(container);
    const root = createRoot(container);
    await (act as any)(async () => {
      root.render(React.createElement(Modal as any, {
        isOpen: true, onClose: noop, sourceCohort: null, missingCount: 0,
        params: { preHorizonUncertainty: 1, postHorizonExpansionRate: 1.5,
                  confidenceHorizon: 3, forecastLength: 24 },
        currentModel: 'Holt Linear',
        onConfirm: async () => ({ generated: 0, failed: 0, skipped: [] }),
        ...over,
      }));
    });
    await (act as any)(async () => { await new Promise(r => setTimeout(r, 20)); });
    return container;
  }

  // ── THE FIX: a finished scoped run opens straight at the coverage panel ──
  {
    const c = await render({ initialSummary: summary });
    const txt = c.textContent || '';
    check('MOUNTS: the completion panel is on screen for a finished scoped run',
      txt.includes(i18n.t('bulk_complete_with_gaps', { count: summary.failed })),
      'the coverage statement did not render');
    check('MOUNTS: it did NOT open at the confirm step',
      !txt.includes(i18n.t('bulk_apply_to_all_remaining_combinations')),
      'the user is asked to confirm work that is already done');
    check('COUNTERS: the generated counter names its grain (chart series)',
      txt.includes('forecast leaves generated'), 'a grainless count');
    check('COUNTERS: the uncovered counter names its grain (forecast leaves)',
      txt.includes('forecast leaves') || txt.includes('forecast leaf'),
      'a grainless count');
    check('NAMED: every skipped leaf is named, not just counted',
      skipped.every(s => txt.includes(s.fKey.split('|').join(' · '))),
      'the count is there and the names are not');
    check('NAMED: each carries its reason', txt.includes(i18n.t('skip_reason_insufficient_history')),
      'a named leaf with no reason beside it');
  }

  // ── SESSION G's RETIREMENT NOTICE, on a store that has retired entries ──
  {
    // Identify the population with the REAL predicate, not by assertion.
    const retiring = new Map(store);
    const aggKey = fc.makeForecastKey([...store.keys()][0].split('|')[0],
      'All', 'All', 'All', 'All', 'All', 'All');
    const anyLeaf = store.get([...store.keys()][0]);
    retiring.set(aggKey, { ...anyLeaf, provenance: { kind: 'fitted', modelUsed: 'Holt Linear' } });
    const retired = [...retiring.entries()].filter(([k, bf]) => fc.isRetiredAggregateFit(k, bf));
    check('RETIRED PREMISE: the store contains a retired All-bearing fitted entry',
      retired.length === 1, `${retired.length}`);

    const c = await render({ initialSummary: summary });
    check('RETIRED: the retirement statement renders in the completion panel',
      (c.textContent || '').includes(i18n.t('bulk_complete_retired')),
      'Session G\'s on-screen statement is unreachable again');
  }

  // ── POSITIVE CONTROL ────────────────────────────────────────────────────
  // Without a summary the modal must open at CONFIRM. Otherwise "opened at
  // complete" would pass for a modal that always does, proving nothing.
  {
    const c = await render({ initialSummary: null, missingCount: 5 });
    const txt = c.textContent || '';
    check('CONTROL: with no finished run the modal opens at CONFIRM',
      txt.includes(i18n.t('bulk_apply_to_all_remaining_combinations')),
      'the confirm step is unreachable — the check above is vacuous');
    check('CONTROL: and the coverage statement is NOT shown',
      !txt.includes('forecast leaves generated'),
      'a completion statement on a run that has not happened');
  }

  // ── THE WIRING: the aggregate branch must actually raise it ─────────────
  {
    const app = fs.readFileSync('src/App.tsx', 'utf8');
    const i = app.indexOf('generateAllMissingForecasts({ restrictToLeafKeys');
    const after = i === -1 ? '' : app.slice(i, i + 2600).replace(/\/\/[^\n]*/g, '');
    check('WIRING: the scoped run raises the completion panel',
      /setBulkCompletedRun\(\{/.test(after),
      'the run finishes and reports nothing — the severance is back');
    check('WIRING: the modal opens on it as well as on the standing prompt',
      /isOpen=\{showBulkGeneratePrompt \|\| !!bulkCompletedRun\}/.test(app),
      'the second door is not wired');
    check('WIRING: G\'s early return is untouched — retirement semantics stay',
      /if \(stdAggregatesMappedDim\) \{/.test(app),
      'the decline was restructured; this fix was only meant to restore the prompt');
  }

  // THE INVARIANT THE LEAVES GRAIN RESTS ON, PINNED WHERE IT IS RELIED UPON.
  // `uncovered` may drop `failed` on the leaves path ONLY because every
  // `ibroFailed++` in the worker is paired with a `skipped.push` for the same
  // leaf - which holds only because classifySkip NEVER returns null for a falsy
  // forecast. That reason lives in forecasting.ts, not in the modal. If it ever
  // stops holding, the count silently UNDER-reports and nothing here would see
  // it, so the invariant is exercised rather than trusted.
  const falsy: unknown[] = [null, undefined, 0, '', false, NaN];
  const populated = [{ any: 1 }];
  check('INVARIANT: no falsy forecast is ever classified as a success',
    falsy.every(f => fc.classifySkip(populated, f) !== null),
    'a leaf can now fail WITHOUT being named in skipped - uncovered under-counts');
  check('INVARIANT: and it separates the two absences rather than merging them',
    fc.classifySkip([], null) === 'never-enumerated'
      && fc.classifySkip(populated, null) === 'insufficient-history',
    'a key with no rows is not a cohort with short history');
  check('INVARIANT CONTROL: a real forecast still classifies as no-skip',
    fc.classifySkip(populated, { months: [] }) === null,
    'the check above would pass vacuously if nothing can return null');

  console.log(`bulk-completion spec: ${pass} passed, ${fails.length} failed`);
  fails.forEach(f => console.log('  FAIL ' + f));
  process.exit(fails.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
