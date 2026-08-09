/**
 * NO MULTI-LEAF RUN STARTS BEFORE THE USER HAS CONFIRMED ITS SETTINGS.
 *
 *   npm run spec:bulk-completion
 *
 * The product decision, taken 2026-08-08 after the previous build was walked:
 * both doors into bulk generation — Step 1's scoped "Generate N missing" and
 * Overall Forecast's whole-book "Generate Missing" — open the SAME modal at the
 * SAME confirm step, and the run begins only when the user says so.
 *
 * This supersedes the open-at-COMPLETE entry. That version let a Step 1
 * aggregate generate run on click and reported afterwards, which put the
 * coverage statement back within reach but never let the user see, let alone
 * change, the settings the run would use.
 *
 * WHAT THIS SPEC IS FOR. "The confirm panel appears" is the weaker half of the
 * claim and the easier one to satisfy — a modal that renders a confirm step and
 * generates anyway would pass it. So the load-bearing check is that the panel
 * APPEARS AND WAITS: onConfirm is not called until the button is clicked, with
 * a positive control that clicking it DOES run, or "never ran" would pass for a
 * dead button.
 *
 * PRODUCTION-FED. The summary is not hand-written: leaves are fitted with the
 * real `calculateBaseForecast`, the unfittable ones fall out of that fit rather
 * than being declared, and the retirement population is identified by the real
 * `isRetiredAggregateFit`. A spec may not feed itself the artefact under test.
 *
 * TWO HALVES, AND NEITHER COVERS THE OTHER. The mounted checks drive the real
 * component. The WIRING checks at the bottom read App.tsx, because the entry
 * decision — which door sets what state — is state plumbing inside a promise
 * callback with nothing pure to extract. A reader must not assume the mount is
 * watching the wiring, or the wiring the mount.
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
  const SCOPED_TOTAL = summary.generated + summary.failed;

  check('PREMISE: the run produced a real summary', summary.generated === 72 && summary.failed === 2,
    `${summary.generated} generated, ${summary.failed} skipped`);
  check('PREMISE: skipped leaves carry a reason from the shared enum',
    skipped.every(s => s.reason === 'insufficient-history'),
    skipped.map(s => s.reason).join(','));

  // `spy` records every onConfirm call, so the spec can assert on what the
  // modal DID and not only on what it rendered.
  const spy = { calls: 0, lastOpts: null as any };
  async function render(over: any = {}) {
    const host = document.getElementById('root')!;
    host.replaceChildren();
    const container = document.createElement('div');
    host.appendChild(container);
    const root = createRoot(container);
    await (act as any)(async () => {
      root.render(React.createElement(Modal as any, {
        isOpen: true, onClose: noop, sourceCohort: null, missingCount: 0,
        params: { preHorizonUncertainty: 2, postHorizonExpansionRate: 5,
                  confidenceHorizon: 3, forecastLength: 24 },
        currentModel: 'Holt Linear',
        onConfirm: async (opts: any) => { spy.calls++; spy.lastOpts = opts;
                                          return { generated: 0, failed: 0, skipped: [] }; },
        ...over,
      }));
    });
    await (act as any)(async () => { await new Promise(r => setTimeout(r, 20)); });
    return container;
  }
  const findButton = (c: Element, re: RegExp) =>
    [...c.querySelectorAll('button')].find(b => re.test(b.textContent || '')) ?? null;
  const click = async (el: Element | null) => {
    await (act as any)(async () => {
      el?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      await new Promise(r => setTimeout(r, 20));
    });
  };

  // ── DOOR 1: STEP 1's SCOPED RUN ─────────────────────────────────────────
  {
    spy.calls = 0;
    const c = await render({
      scope: { label: 'Corporate' }, missingCount: SCOPED_TOTAL,
      onConfirm: async (opts: any) => { spy.calls++; spy.lastOpts = opts; return summary; },
    });
    const txt = c.textContent || '';

    check('SCOPED: the modal opens at CONFIRM, not at results',
      txt.includes(i18n.t('bulk_generate_scoped_subtitle')),
      'a scoped run opened somewhere other than the settings step');
    check('SCOPED: the header NAMES the scope and the count',
      txt.includes('Corporate') && txt.includes(String(SCOPED_TOTAL)),
      'the user is asked to confirm a run whose extent is not stated');
    check('SCOPED: the coverage statement is NOT shown yet',
      !txt.includes('forecast leaves generated'),
      'results for a run that has not been authorised');

    // THE LOAD-BEARING CHECK. Rendering a confirm step is not the same as
    // waiting at one, and only one of those is the decision.
    check('SCOPED: NOTHING HAS RUN — the modal is waiting, not reporting',
      spy.calls === 0, `onConfirm was called ${spy.calls} time(s) before any click`);

    // POSITIVE CONTROL: the button must actually work, or "never ran" above
    // would pass for a modal whose confirm does nothing at all.
    const btn = findButton(c, /Generate/i);
    check('SCOPED CONTROL: a confirm button is present to wait on', !!btn,
      'nothing to click — the wait check would be vacuous');
    await click(btn);
    check('SCOPED CONTROL: and clicking it DOES start the run',
      spy.calls === 1, `onConfirm called ${spy.calls} times after one click`);
    check('SCOPED: the run carries the settings the panel showed',
      !!spy.lastOpts && spy.lastOpts.autoModel === true && spy.lastOpts.autoConfidence === true,
      'the confirmed settings did not reach the run');

    // ── and only NOW the coverage panel, through the normal phase flow ──
    const done = c.textContent || '';
    check('SCOPED: the coverage statement arrives after the run, via CONFIRM',
      done.includes(i18n.t('bulk_complete_with_gaps', { count: summary.skipped.length })),
      'the completion panel is unreachable through the confirm flow');
    check('SCOPED: the generated counter names the LEAF grain',
      done.includes('forecast leaves generated'), 'a grainless or wrong-grain count');
    check('SCOPED: every skipped leaf is named, not just counted',
      skipped.every(sk => done.includes(sk.fKey.split('|').join(' · '))),
      'the count is there and the names are not');
    check('SCOPED: each carries its reason',
      done.includes(i18n.t('skip_reason_insufficient_history')),
      'a named leaf with no reason beside it');

    // GRAIN ARITHMETIC, read off the rendered panel rather than re-derived.
    // On the leaves grain `failed` and `skipped` are the SAME leaves, so the
    // uncovered figure must be skipped.length and never the sum.
    check('SCOPED GRAIN: uncovered counts each leaf ONCE',
      !done.includes(i18n.t('bulk_complete_with_gaps', { count: summary.skipped.length + summary.failed })),
      `double-counted: ${summary.skipped.length} skipped and ${summary.failed} failed are one population`);
  }

  // ── DOOR 2: THE WHOLE-BOOK RUN ──────────────────────────────────────────
  // Same modal, same lifecycle, different grain. Driven through the real
  // component so the two doors cannot drift into two behaviours.
  {
    spy.calls = 0;
    const seriesSummary = { grain: 'series' as const, generated: 10, failed: 3, skipped };
    const c = await render({
      scope: null, missingCount: 13,
      onConfirm: async (o: any) => { spy.calls++; spy.lastOpts = o; return seriesSummary; },
    });
    const txt = c.textContent || '';
    check('WHOLE-BOOK: this door also opens at CONFIRM',
      txt.includes(i18n.t('bulk_apply_to_all_remaining_combinations')),
      'the two doors have different lifecycles again');
    check('WHOLE-BOOK: and it too waits', spy.calls === 0,
      `onConfirm was called ${spy.calls} time(s) before any click`);
    await click(findButton(c, /Generate/i));
    check('WHOLE-BOOK CONTROL: clicking runs it', spy.calls === 1, `${spy.calls}`);
    const done = c.textContent || '';
    check('WHOLE-BOOK GRAIN: uncovered ADDS failed to skipped here',
      done.includes(i18n.t('bulk_complete_with_gaps', { count: skipped.length + 3 })),
      'the series grain lost its two distinct populations');
    check('WHOLE-BOOK GRAIN: and the counter does not claim leaves',
      !done.includes('forecast leaves generated'),
      'a whole-book run reported in the leaf grain');
  }

  // ── STATE-NOT-TRANSITION: run → Done → reopen ───────────────────────────
  // A mount-at-CONFIRM check does not cover a RETURN to confirm. The defect
  // this pivot was built over was exactly that: the modal stays mounted while
  // closed, so a finished run's phase and numbers outlived the close and the
  // NEXT open rendered stale results with no settings step.
  {
    spy.calls = 0;
    const host = document.getElementById('root')!;
    host.replaceChildren();
    const container = document.createElement('div');
    host.appendChild(container);
    const root = createRoot(container);
    const props = (isOpen: boolean) => ({
      isOpen, onClose: noop, sourceCohort: null, missingCount: SCOPED_TOTAL,
      scope: { label: 'Corporate' },
      params: { preHorizonUncertainty: 2, postHorizonExpansionRate: 5,
                confidenceHorizon: 3, forecastLength: 24 },
      currentModel: 'Holt Linear',
      onConfirm: async (o: any) => { spy.calls++; spy.lastOpts = o; return summary; },
    });
    const paint = async (isOpen: boolean) => {
      await (act as any)(async () => { root.render(React.createElement(Modal as any, props(isOpen))); });
      await (act as any)(async () => { await new Promise(r => setTimeout(r, 20)); });
    };

    await paint(true);
    await click(findButton(container, /Generate/i));
    check('TRANSITION PREMISE: the run completed and the panel is showing',
      (container.textContent || '').includes('forecast leaves generated'),
      'the transition test never reached a completed run');

    await click(findButton(container, new RegExp(i18n.t('bulk_done'), 'i')));  // Done
    await paint(false);                                                        // parent closes
    await paint(true);                                                         // REOPEN

    const re = container.textContent || '';
    check('TRANSITION: reopening lands on CONFIRM, not on the last run',
      re.includes(i18n.t('bulk_generate_scoped_subtitle')),
      'the modal reopened at results — the residue defect is back');
    check('TRANSITION: and carries NO residue of the previous run',
      !re.includes('forecast leaves generated')
        && !skipped.some(sk => re.includes(sk.fKey.split('|').join(' · '))),
      "the previous run's numbers survived the close");
    check('TRANSITION: reopening did not re-run anything', spy.calls === 1,
      `onConfirm has been called ${spy.calls} times`);
  }

  // ── SESSION G's RETIREMENT NOTICE, on a store that has retired entries ──
  {
    const retiring = new Map(store);
    const aggKey = fc.makeForecastKey([...store.keys()][0].split('|')[0],
      'All', 'All', 'All', 'All', 'All', 'All');
    const anyLeaf = store.get([...store.keys()][0]);
    retiring.set(aggKey, { ...anyLeaf, provenance: { kind: 'fitted', modelUsed: 'Holt Linear' } });
    const retired = [...retiring.entries()].filter(([k, bf]) => fc.isRetiredAggregateFit(k, bf));
    check('RETIRED PREMISE: the store contains a retired All-bearing fitted entry',
      retired.length === 1, `${retired.length}`);

    const c = await render({ scope: { label: 'Corporate' }, missingCount: SCOPED_TOTAL,
                             onConfirm: async () => summary });
    await click(findButton(c, /Generate/i));
    check('RETIRED: the retirement statement renders in the completion panel',
      (c.textContent || '').includes(i18n.t('bulk_complete_retired')),
      "Session G's on-screen statement is unreachable again");
  }

  // ── THE WIRING: the entry decision, read at its source ──────────────────
  {
    const app = fs.readFileSync('src/App.tsx', 'utf8');
    const stripped = app.replace(/\/\/[^\n]*/g, '');
    const i = stripped.indexOf('if (stdAggregatesMappedDim) {');
    const branch = i === -1 ? '' : stripped.slice(i, i + 3000);

    check('WIRING: Step 1 OPENS THE CONFIRM rather than running',
      /setPendingScopedRun\(\{/.test(branch) && /setShowBulkGeneratePrompt\(true\)/.test(branch),
      'the scoped door no longer raises the confirm panel');
    check('WIRING: and it starts NO run of its own on click',
      !/generateAllMissingForecasts\(/.test(branch),
      'the branch generates before the user has confirmed — the pivot is undone');
    check('WIRING: the confirm runs the SCOPED call through the one generator',
      /restrictToLeafKeys: new Set\(pendingScopedRun\.leafKeys\)/.test(stripped),
      'the confirmed run is not the scoped run, or is a second fitting path');
    check('WIRING: the modal has ONE open condition — always the confirm',
      /isOpen=\{showBulkGeneratePrompt\}/.test(stripped) && !/initialSummary/.test(stripped),
      'a second entry path can still bypass the confirm step');
    check("WIRING: G's early return is untouched — retirement semantics stay",
      /if \(stdAggregatesMappedDim\) \{/.test(stripped),
      'the decline was restructured; only the door was meant to move');
    check("WIRING: the panel is shown the settings the RUN uses, not the sidebar's",
      /preHorizonUncertainty: genPreHorizonUncertainty/.test(stripped)
        && /postHorizonExpansionRate: genPostHorizonExpansionRate/.test(stripped),
      'the confirm panel displays numbers the run will not apply');
  }

  // ── THE SCOPE LABEL, DRIVEN ─────────────────────────────────────────────
  // The header names the scope the user is confirming a 74-leaf run against,
  // so the label is load-bearing text and not decoration. It was inline in App
  // until a gate could only read it; it is exported and pure now, so these run
  // the real function on the real encodings instead of arguing about them.
  {
    const vf: any = await import('../src/utils/viewFilter');
    const ALL = 'all cohorts';
    const mk = (o: any = {}) => ({ segment: 'All', product: { l1: null, l2: null },
      channel: { l1: null, l2: null }, tariff: { l1: null, l2: null }, ...o });

    check('LABEL: a narrowed segment names itself',
      vf.describeScope(mk({ segment: 'Corporate' }), ALL) === 'Corporate',
      vf.describeScope(mk({ segment: 'Corporate' }), ALL));
    check('LABEL: several narrowed dimensions are all named',
      vf.describeScope(mk({ segment: 'Corporate', product: { l1: 'Mobile Voice', l2: null } }), ALL)
        === 'Corporate / Mobile Voice',
      vf.describeScope(mk({ segment: 'Corporate', product: { l1: 'Mobile Voice', l2: null } }), ALL));
    // BOTH aggregated encodings must be dropped, and they are different:
    // segment carries the literal 'All', the L1/L2 pairs carry null. Dropping
    // only one would name a scope the run does not have.
    check("LABEL: the 'All' encoding is not read back as a value",
      !vf.describeScope(mk({ segment: 'All', product: { l1: 'Mobile Voice', l2: null } }), ALL).includes('All'),
      vf.describeScope(mk({ segment: 'All', product: { l1: 'Mobile Voice', l2: null } }), ALL));
    check('LABEL: the null encoding is dropped too',
      vf.describeScope(mk({ segment: 'Corporate' }), ALL) === 'Corporate',
      'a null dimension leaked into the label');
    check('LABEL: nothing narrowed says so rather than rendering empty',
      vf.describeScope(mk(), ALL) === ALL, vf.describeScope(mk(), ALL));
    check('LABEL: a missing tariff pair does not throw',
      vf.describeScope({ segment: 'Corporate', product: { l1: null, l2: null },
                         channel: { l1: null, l2: null } } as any, ALL) === 'Corporate',
      'an older filter shape crashes the confirm header');
  }

  // THE INVARIANT THE LEAVES GRAIN RESTS ON, PINNED WHERE IT IS RELIED UPON.
  // `uncovered` may drop `failed` on the leaves path ONLY because every
  // `ibroFailed++` in the worker is paired with a `skipped.push` for the same
  // leaf — which holds only because classifySkip NEVER returns null for a falsy
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
