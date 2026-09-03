/**
 * THE VALUE CARD'S PADLOCK, DRIVEN THROUGH THE RENDERED DOM.
 *
 *   npm run spec:value-padlock
 *
 * WHY A SIBLING FILE AND NOT AN EXTENSION OF spec:mix-card. Session 1821 tried
 * to add this to mix-card-spec and failed twice on PLACEMENT alone — the block
 * landed outside `main()`, then inside a loop that reported the same failure
 * twice — and was reverted whole. mix-card-spec is ~2,000 lines of sequenced
 * promotion-card state; inserting a second card's journey into the middle of
 * it means owning that control flow as well as the new checks. This file owns
 * its own mounts, so a mistake here can only break this.
 *
 * That is a different judgement from the one mix-card-spec's own header makes
 * about the per-band ARPU override ("two harnesses for one card drift"). That
 * reasoning is about ONE card: the mount, the card-opening and the restore
 * already existed there for the Promotion arm. This is the OTHER card, whose
 * mount is a render and a tab click, and which shares no setup worth reusing.
 *
 * WHAT IT PINS, all of it by testid — the tab LABELS collide with the measure
 * row, which is how an earlier spec drove the wrong control and left the card
 * on another tab:
 *
 *  (a) a held tier does not move when another is dragged, the mover takes only
 *      the room the padlocks leave, and the shares still total 100;
 *  (b) all-but-one held leaves the last DISABLED with the collapsed-range
 *      REASON rendered, and NOT aria-pressed — the two-reasons distinction
 *      asserted on rendered state rather than on prop shape;
 *  (c) a released tier moves again;
 *  (d) the padlock survives export and re-edit, end to end: the card's own
 *      save handler builds the event, the real export row carries
 *      Tariff_Mix_Locked, the real importer reads it back, and a SECOND mount
 *      opening that event shows the padlock pressed.
 *
 * THE MOUNT IS ASSERTED BEFORE ANY OF IT. Every seeded tier must have both its
 * padlock and its range present; a missing testid is a FAIL, never a skip.
 * Without that, a selector matching nothing would take every check below it
 * vacuously green — the failure mode this project has already paid for in the
 * product tree (mix-card-spec ran against an EMPTY tree for weeks) and in the
 * trap registry (a dump returning nothing would have passed cleanly).
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

// THE COLLAPSED-RANGE SENTENCE, read from the locale file rather than copied.
// A copy pasted here would let the app's wording change while the assertion
// kept passing against the old words.
const EN_RANGE_COLLAPSED: string = JSON.parse(
  (await import('node:fs')).readFileSync('src/locales/en/translation.json', 'utf8')
)['whatif_mix_range_collapsed'];

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

  const FIX = 'test-data/VBU_IBRO_Trimmed_TariffHierarchy_Jan2023_Jun2026.xlsx';
  if (!fs.existsSync(FIX)) {
    console.log(`\nvalue-padlock spec: UNREACHABLE — fixture missing at ${FIX}`);
    process.exit(1);
  }
  const wb = XLSX.read(fs.readFileSync(FIX), { cellDates: true });
  const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

  const C = {
    date: 'Month', seg: 'Customer_Segment', prod: 'Product_L1',
    prodL2: 'Product_L2_Value_Tier', chan: 'Channel_Level_1', chanL2: 'Channel_Level_2',
    metric: 'IBRO_Scenario_Type', val: 'Subscriber_Volume', rev: 'Monthly_Revenue_GBP',
  };
  const noop = () => {};
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

  const MONTH = '2026-01';
  const captured: any[] = [];

  // `newYieldEvent` is a PROP with a noop setter here, so the month is supplied
  // rather than typed. That is the card's real entry state on an opened event,
  // and it is what lets the card's own save handler run — the alternative,
  // building a YieldEvent by hand, would be this spec reimplementing the very
  // construction site (d) exists to exercise.
  const whatIfProps = (yieldEvents: any[] = []) => ({
    data: rows.slice(0, 4000),
    wiDateCol: C.date, wiSegmentCol: C.seg, wiProductCol: C.prod, wiProductL2Col: C.prodL2,
    wiChannelCol: C.chan, wiChannelL2Col: C.chanL2, wiMetricCol: C.metric,
    wiInflowVal: 'Inflow', wiRetentionVal: 'Retention',
    wiValueCol: C.val, wiRevenueCol: C.rev, wiArpuCol: '',
    productTree: treeOf(C.prod, C.prodL2), channelTree: treeOf(C.chan, C.chanL2),
    tariffTree: new Map<string, string[]>(),
    selectedTariffs: [], setSelectedTariffs: noop,
    cohortAvgArpu: 11.6,
    newEvent: {}, setNewEvent: noop, marketEvents: [], setMarketEvents: noop,
    addMarketEvent: noop, removeMarketEvent: noop, updateMarketEvent: noop,
    yieldEvents, newYieldEvent: { month: MONTH, ibro: 'Inflow' }, setNewYieldEvent: noop,
    addYieldEvent: (e: any) => captured.push(e),
    updateYieldEvent: noop,
    removeYieldEvent: noop, clearAllYieldEvents: noop,
    pricingEvents: [], newPricingEvent: {}, setNewPricingEvent: noop, addPricingEvent: noop,
    removePricingEvent: noop, clearAllPricingEvents: noop,
    downloadExcel: noop, formatNumber: (v: any) => Number(v).toFixed(2), setActiveView: noop,
    missingMonths: [],
  } as any);

  const fc: any = await import('../src/utils/forecasting');
  const { ForecastProvider } = await import('../src/context/ForecastContext');
  const map = fc.buildCohortDataMap(
    rows.map((r: any) => ({ ...r, _parsedDate: new Date(r[C.date]) }))
        .filter((r: any) => !isNaN(r._parsedDate.getTime())),
    C.date, C.seg, C.prod, C.prodL2, C.chan, C.chanL2, 'tariff_tier_l1', 'tariff_tier_l2');
  const SEG = 'Corporate';
  const acc = new Map<number, any>();
  for (const [k, bucket] of map) {
    if (String(k).split('|')[0] !== SEG) continue;
    for (const row of bucket as any[]) {
      const tms = row._parsedDate.getTime();
      if (!acc.has(tms)) acc.set(tms, { _parsedDate: row._parsedDate, inflow: 0, outflow: 0, retention: 0,
        arpu: 0, inflowArpu: 0, outflowArpu: 0, retentionArpu: 0, baseArpu: 0 });
      const e = acc.get(tms)!, m = String(row[C.metric]), v = Number(row[C.val]) || 0;
      if (m === 'Inflow') e.inflow += v; else if (m === 'Outflow') e.outflow += v;
      else if (m === 'Retention') e.retention += v;
    }
  }
  const seriesArr = [...acc.values()].sort((a, b) => a._parsedDate - b._parsedDate);
  const baseForecast = fc.calculateBaseForecast(seriesArr,
    { segment: SEG, product: 'All', productL2: 'All', channel: 'All', channelL2: 'All',
      tariffL1: 'All', tariffL2: 'All', scenario: 'Base Case' },
    10000, 12, 1.0, 1.5, 3, 'Holt Linear');

  const withProvider = (child: any) => React.createElement(ForecastProvider as any, {
    baseForecast, setBaseForecast: noop,
    adjustedForecast: null, setAdjustedForecast: noop,
    forecastStore: new Map(), setForecastStore: noop,
    resolveForecast: (k: string) => fc.resolveFromStore(new Map(), new Map(), k),
    canResolve: () => false,
    hasLegacyBaseline: !!baseForecast, updatedAt: new Date().toISOString(),
    bulkRuns: [], setBulkRuns: noop,
  }, child);

  const M: any = (await import('../src/components/WhatIfTab')).WhatIfTab;
  const host = document.getElementById('root')!;
  const nativeSetter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!;

  /** Mount the card with the VALUE tab active. By testid, never by label. */
  const openValueCard = async (yieldEvents: any[] = []) => {
    host.replaceChildren();
    const c = document.createElement('div');
    host.appendChild(c);
    const root = createRoot(c);
    await (act as any)(async () => { root.render(withProvider(React.createElement(M, whatIfProps(yieldEvents)))); });
    const tab = c.querySelector('[data-testid="whatif-tab-value"]') as any;
    if (tab) await (act as any)(async () => { tab.click(); });
    return { c, root, tab };
  };
  const lockOf = (c: any, tier: string) => c.querySelector(`[data-testid="yield-mix-lock-${tier}"]`) as any;
  const rangeOf = (c: any, tier: string) => c.querySelector(`[data-testid="yield-mix-range-${tier}"]`) as any;
  const tiersIn = (c: any) => [...c.querySelectorAll('[data-testid^="yield-mix-range-"]')]
    .map((el: any) => el.getAttribute('data-testid').replace('yield-mix-range-', ''));
  const clickIt = async (el: any) => { await (act as any)(async () => { el.click(); }); };
  const setRange = async (el: any, v: number) => {
    await (act as any)(async () => {
      nativeSetter.call(el, String(v));
      el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
  };

  // ── THE MOUNT RESOLVED ────────────────────────────────────────────────────
  // Everything below depends on this, so it is asserted first and the run stops
  // if it fails. A spec that continued past a mount it could not reach would
  // report a list of green checks over an empty document.
  const { c: c1 } = await openValueCard();
  check('mount: the Value tab is reachable by testid',
    !!c1.querySelector('[data-testid="whatif-tab-value"]'));

  const tiers = tiersIn(c1);
  check('mount: the Value card seeded at least three tiers', tiers.length >= 3,
    `${tiers.length} tiers — fewer than three cannot exercise lock-one-drag-another`);
  if (tiers.length < 3) { report(); return; }

  // A MISSING TESTID IS A FAIL, NOT A SKIP.
  let missing = 0;
  for (const t of tiers) { if (!lockOf(c1, t) || !rangeOf(c1, t)) missing++; }
  check('mount: every seeded tier has BOTH its padlock and its range',
    missing === 0, `${missing} of ${tiers.length} tiers are missing one or both testids`);
  check('mount: no padlock is engaged before any interaction',
    tiers.every(t => lockOf(c1, t).getAttribute('aria-pressed') !== 'true'));
  check('mount: no tier is disabled before any interaction',
    tiers.every(t => rangeOf(c1, t).disabled === false),
    'a card that starts frozen would make (a) and (c) vacuous');

  const A = tiers[0], B = tiers[1];

  // ── (a) LOCK A, DRAG B ────────────────────────────────────────────────────
  const heldBefore = Number(rangeOf(c1, A).value);
  await clickIt(lockOf(c1, A));
  check('(a) the padlock engages on click', lockOf(c1, A).getAttribute('aria-pressed') === 'true');
  check('(a) a held tier is disabled', rangeOf(c1, A).disabled === true);
  check('(a) holding A did not disable B', rangeOf(c1, B).disabled === false);

  await setRange(rangeOf(c1, B), 5);
  const afterA = Number(rangeOf(c1, A).value);
  // TO THE PENNY: the share is compared exactly, not within a tolerance. A
  // rebalance that "mostly" preserved a hold would be the defect.
  check('(a) the HELD share is unchanged to the penny after B is dragged',
    afterA === heldBefore, `${afterA} vs ${heldBefore}`);

  const shares = tiers.map(t => Number(rangeOf(c1, t).value));
  const sum = shares.reduce((s, v) => s + v, 0);
  // The ceiling is 100 less what the padlocks hold — expressed against the
  // fixture's own starting mix rather than as a literal, because the literal
  // would pin the fixture and not the rule.
  const ceiling = 100 - heldBefore;
  check('(a) the mover takes only the room the locks leave',
    shares[1] <= ceiling + 1e-9, `B=${shares[1]} > ceiling ${ceiling}`);
  check('(a) the shares still total 100', Math.abs(sum - 100) < 0.05, String(sum));
  check('(a) dragging B did not engage B’s padlock — auto-lock is OFF',
    lockOf(c1, B).getAttribute('aria-pressed') !== 'true');

  // ── (c) RELEASE A ─────────────────────────────────────────────────────────
  await clickIt(lockOf(c1, A));
  check('(c) releasing clears the padlock', lockOf(c1, A).getAttribute('aria-pressed') !== 'true');
  check('(c) and re-enables the range', rangeOf(c1, A).disabled === false);
  const beforeMove = Number(rangeOf(c1, A).value);
  const targetA = beforeMove > 50 ? beforeMove - 10 : beforeMove + 10;
  await setRange(rangeOf(c1, A), targetA);
  check('(c) a released tier moves again on the next drag',
    Number(rangeOf(c1, A).value) !== beforeMove,
    `${Number(rangeOf(c1, A).value)} vs ${beforeMove} — still pinned at its held value`);

  // ── (b) ALL BUT ONE HELD ──────────────────────────────────────────────────
  // A FRESH MOUNT, so this does not inherit (a)'s and (c)'s drags. The point of
  // the case is the state "every tier but one is held", and reaching it from a
  // mix this file has already stirred would make the collapse depend on which
  // numbers the earlier cases happened to leave behind.
  const { c: c2 } = await openValueCard();
  const tiers2 = tiersIn(c2);
  for (const t of tiers2.slice(0, tiers2.length - 1)) await clickIt(lockOf(c2, t));
  const last = tiers2[tiers2.length - 1];

  check('(b) with all but one held, the last is DISABLED',
    rangeOf(c2, last).disabled === true,
    'the constraints leave it one value, so it cannot move');
  // THE TWO-REASONS DISTINCTION, ON RENDERED STATE. This is the check the whole
  // session exists for: `held` and `immovable` are separate props, and a card
  // that collapsed them would show a padlock the user never pressed.
  check('(b) and the last is NOT aria-pressed — collapsed is not a padlock',
    lockOf(c2, last).getAttribute('aria-pressed') !== 'true',
    'the padlock would be claiming a hold the user never set');
  check('(b) every tier the user DID hold is aria-pressed',
    tiers2.slice(0, tiers2.length - 1).every(t => lockOf(c2, t).getAttribute('aria-pressed') === 'true'));

  const reason = c2.querySelector('[data-testid="yield-mix-range-collapsed"]') as any;
  check('(b) the collapsed-range REASON is rendered', !!reason,
    'the card froze every slider and said nothing');
  check('(b) and it is the collapsed-range sentence, not some other message',
    !!reason && (reason.textContent || '').includes(EN_RANGE_COLLAPSED),
    reason ? JSON.stringify((reason.textContent || '').slice(0, 60)) : 'absent');

  // ── (d) EXPORT AND RE-EDIT ────────────────────────────────────────────────
  // Driven end to end: the CARD's save handler builds the event, the REAL
  // export row carries the column, the REAL importer reads it back, and a
  // second mount opens it. Nothing on this path is reconstructed by hand.
  const { c: c3 } = await openValueCard();
  const tiers3 = tiersIn(c3);
  const A3 = tiers3[0];
  await clickIt(lockOf(c3, A3));
  captured.length = 0;
  const addBtn = [...c3.querySelectorAll('button')]
    .find((b: any) => /add .*(event|yield)/i.test(b.textContent || '')) as any;
  check('(d) the card’s save control is reachable', !!addBtn);
  if (addBtn) await clickIt(addBtn);

  check('(d) the card saved exactly one event', captured.length === 1, `${captured.length}`);
  if (captured.length === 1) {
    const saved = captured[0];
    check('(d) the saved event carries the padlock',
      Array.isArray(saved.mixLocked) && saved.mixLocked.includes(A3),
      JSON.stringify(saved.mixLocked ?? null));

    const row = fc.yieldEventExportRow(saved);
    check('(d) Tariff_Mix_Locked holds the held tier',
      String(row.Tariff_Mix_Locked || '').includes(A3),
      JSON.stringify(row.Tariff_Mix_Locked));

    const restored = fc.yieldEventFromRow(row);
    check('(d) the importer reads the lock back',
      Array.isArray(restored.mixLocked) && restored.mixLocked.includes(A3),
      JSON.stringify(restored.mixLocked ?? null));

    // THE RENDERED END OF THE ROUND TRIP. Everything above this could pass with
    // a padlock that never draws itself pressed, which is exactly the gap the
    // source-only check left open.
    const { c: c4 } = await openValueCard([restored]);
    const editBtn = c4.querySelector(`[data-testid="yield-edit-${restored.id}"]`) as any;
    check('(d) the saved row’s edit control is reachable by testid', !!editBtn);
    if (editBtn) {
      await clickIt(editBtn);
      const lockA = lockOf(c4, A3);
      check('(d) re-editing the exported row RENDERS the padlock pressed',
        !!lockA && lockA.getAttribute('aria-pressed') === 'true',
        lockA ? `aria-pressed=${lockA.getAttribute('aria-pressed')}` : 'the padlock is not rendered');
      check('(d) and the held tier’s range is disabled on restore',
        !!rangeOf(c4, A3) && rangeOf(c4, A3).disabled === true);
      const others = tiers3.filter(t => t !== A3 && !!lockOf(c4, t));
      check('(d) and NO other padlock came back pressed',
        others.every(t => lockOf(c4, t).getAttribute('aria-pressed') !== 'true'),
        `${others.length} other tiers checked`);
    }
  }

  check('the run exercised every case', tiers.length >= 3 && tiers2.length >= 3 && tiers3.length >= 3,
    `${tiers.length}/${tiers2.length}/${tiers3.length} tiers across the mounts`);

  report();
}

function report() {
  console.log(`\nvalue-padlock spec: ${pass}/${pass + fails.length} passed`);
  fails.forEach(f => console.log('  FAIL  ' + f));
  if (!fails.length) console.log('  every check green');
  // UNCONDITIONAL — see mix-card-spec: JSDOM's timers keep the loop alive, and
  // a spec that hangs on success is indistinguishable from one that hangs on a
  // defect.
  process.exit(fails.length ? 1 : 0);
}

main().catch(e => { console.error('value-padlock spec CRASHED —', e); process.exit(1); });
