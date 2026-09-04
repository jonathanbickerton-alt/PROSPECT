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

  // ── (e) THE OTHER TWO READS OF THE SAME SAVE ──────────────────────────────
  // D3-04 was a dependency array narrower than its read-set. `yieldMixLocked`
  // was the read the padlock cases caught; `effectiveTierArpuMap` and
  // `draftTierArpuOverride` are the other two, and NOTHING here would have
  // failed if either were dropped again. Both are exercised through the SAME
  // save handler, because a stale closure is a property of the callback rather
  // than of any one value it reads.
  const { c: c5 } = await openValueCard();
  const tiers5 = tiersIn(c5);
  const E = tiers5[1];
  const OVERRIDE = 42.5;
  const ovInput = c5.querySelector(`[data-testid="tier-arpu-override-${E}"]`) as any;
  check('(e) the per-tier ARPU override input is reachable by testid', !!ovInput);
  if (ovInput) {
    // The derived rate FIRST, so the assertion below distinguishes "the
    // override was carried" from "the override happened to equal the derived
    // figure" — a fixture whose tier already sat at 42.5 would make this pass
    // for the wrong reason.
    const derivedE = Number(ovInput.placeholder);
    check('(e) the derived rate differs from the value being typed',
      !Number.isNaN(derivedE) && Math.abs(derivedE - OVERRIDE) > 1e-9,
      `placeholder ${ovInput.placeholder} — pick a different OVERRIDE`);

    await (act as any)(async () => {
      nativeSetter.call(ovInput, String(OVERRIDE));
      ovInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      ovInput.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
    check('(e) the typed override is not disabled or ignored by the control',
      Number((c5.querySelector(`[data-testid="tier-arpu-override-${E}"]`) as any).value) === OVERRIDE);

    captured.length = 0;
    const addBtn5 = [...c5.querySelectorAll('button')]
      .find((b: any) => /add .*(event|yield)/i.test(b.textContent || '')) as any;
    if (addBtn5) await clickIt(addBtn5);
    check('(e) the card saved exactly one event', captured.length === 1, `${captured.length}`);

    if (captured.length === 1) {
      const ev = captured[0];
      // READ ONE: draftTierArpuOverride — the user's stated figure, kept so
      // provenance survives. Absent rather than {} when nothing was stated.
      check('(e) the saved event carries the OVERRIDE the user stated',
        !!ev.tariffBaseArpuOverride && ev.tariffBaseArpuOverride[E] === OVERRIDE,
        JSON.stringify(ev.tariffBaseArpuOverride ?? null));
      // READ TWO: effectiveTierArpuMap — the rate the ENGINE will read. It must
      // be the stated figure, not the derived one, or the saved event behaves
      // differently from the card that produced it.
      check('(e) and the EFFECTIVE rate the engine reads is the stated one',
        !!ev.tariffBaseArpu && ev.tariffBaseArpu[E] === OVERRIDE,
        `${ev.tariffBaseArpu ? ev.tariffBaseArpu[E] : 'absent'} — stale map, so the engine reads the derived rate`);
      // NOT A BLANKET. A map that set every tier to the override would satisfy
      // both checks above and be badly wrong.
      const otherE = tiers5.find(t => t !== E)!;
      check('(e) and no OTHER tier picked up the override',
        !!ev.tariffBaseArpu && ev.tariffBaseArpu[otherE] !== OVERRIDE,
        `${otherE} also reads ${OVERRIDE}`);
    }
  }

  // ── (f) THE ARPU TARGET ───────────────────────────────────────────────────
  // The blend is computed BY HAND here, from the per-tier rates the card is
  // showing, and compared with the number the user typed. Asserting only that
  // "Apply changed the shares" would pass against a solver that hit a
  // different blend entirely.
  const { c: c6 } = await openValueCard();
  const tiers6 = tiersIn(c6);
  // THE RATES ARE READ AS DISPLAYED — the placeholder is formatNumber'd to two
  // decimals — so this recomputation is deliberately not to full precision.
  // That is why the target comparison below is "< 0.005" rather than exact:
  // demanding exact equality would be testing this file's rounding against the
  // card's, not testing the solver. The bar is still tight enough to catch
  // trap 143, whose held-share drift is ~0.003.
  const rateOf = (c: any, tier: string) => Number(
    (c.querySelector(`[data-testid="tier-arpu-override-${tier}"]`) as any).placeholder);
  const blendOf = (c: any, ts: string[]) =>
    ts.reduce((sum, t) => sum + Number(rangeOf(c, t).value) / 100 * rateOf(c, t), 0);

  const targetBox = c6.querySelector('[data-testid="yield-mix-target"]') as any;
  const applyBtn = c6.querySelector('[data-testid="yield-mix-target-apply"]') as any;
  const rangeOut = c6.querySelector('[data-testid="yield-mix-target-range"]') as any;
  check('(f) the target box, Apply and the range readout are all present', !!targetBox && !!applyBtn && !!rangeOut);
  check('(f) Apply is disabled with no target typed - blank carries no verdict',
    !!applyBtn && applyBtn.disabled === true);

  if (targetBox && applyBtn && rangeOut) {
    const nums = (rangeOut.textContent || '').match(/-?\d+\.\d+/g) || [];
    check('(f) the readout states a reachable interval', nums.length === 2, rangeOut.textContent || '');
    const lo = Number(nums[0]), hi = Number(nums[1]);
    const typeTarget = async (v: number) => {
      await (act as any)(async () => {
        nativeSetter.call(targetBox, String(v));
        targetBox.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
        targetBox.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
      });
    };

    // ── REACHABLE ───────────────────────────────────────────────────────────
    const REACH = Math.round(((lo + hi) / 2) * 100) / 100;
    await typeTarget(REACH);
    const before = tiers6.map(t => Number(rangeOf(c6, t).value));
    check('(f) a reachable target enables Apply',
      (c6.querySelector('[data-testid="yield-mix-target-apply"]') as any).disabled === false,
      `target ${REACH} in [${lo}, ${hi}]`);
    await clickIt(c6.querySelector('[data-testid="yield-mix-target-apply"]') as any);
    const after = tiers6.map(t => Number(rangeOf(c6, t).value));
    check('(f) Apply moved the shares', after.some((v, i) => v !== before[i]),
      `${before.join(',')} -> ${after.join(',')}`);
    const achieved = blendOf(c6, tiers6);
    // TO THE PENNY, against the number the USER typed - not against anything
    // the solver reported back, which would be the solver checking itself.
    check('(f) and the achieved blend equals the target to the penny',
      Math.abs(achieved - REACH) < 0.005,
      `by hand ${achieved.toFixed(6)} vs target ${REACH}`);
    // STATED ON A GREEN RUN, not only on a red one. A figure that only appears
    // when a check fails cannot be quoted in a report without re-running the
    // spec with the failure induced, and the reachable interval is fixture-
    // dependent, so the next reader needs to see what this one actually hit.
    console.log(`  target: reachable interval [${lo}, ${hi}], typed ${REACH},`
      + ` achieved by hand ${achieved.toFixed(6)}`);
    check('(f) and the shares still total 100',
      Math.abs(after.reduce((s, v) => s + v, 0) - 100) < 0.05,
      String(after.reduce((s, v) => s + v, 0)));

    // ── UNREACHABLE: SHOWN, NEVER CLAMPED ───────────────────────────────────
    const held6 = tiers6.map(t => Number(rangeOf(c6, t).value));
    await typeTarget(hi + 10);
    check('(f) an unreachable target DISABLES Apply',
      (c6.querySelector('[data-testid="yield-mix-target-apply"]') as any).disabled === true);
    check('(f) and the message is rendered, naming the wall',
      !!c6.querySelector('[data-testid="yield-mix-target-blocked"]'),
      'an unreachable target must be shown, not silently ignored');
    check('(f) and the shares are UNTOUCHED - never clamped to the nearest reachable',
      tiers6.every((t, i) => Number(rangeOf(c6, t).value) === held6[i]),
      'the tool would be stating a number the user did not type');
    check('(f) and the typed value is left exactly as typed',
      Number((c6.querySelector('[data-testid="yield-mix-target"]') as any).value) === hi + 10);

    // ── A HELD TIER IS UNTOUCHED BY APPLY ───────────────────────────────────
    // The padlock's whole claim, under the one operation most likely to break
    // it: Apply rewrites shares wholesale.
    const { c: c7 } = await openValueCard();
    const tiers7 = tiersIn(c7);
    const H = tiers7[0];
    await clickIt(lockOf(c7, H));
    const heldExact = Number(rangeOf(c7, H).value);
    const ro7 = c7.querySelector('[data-testid="yield-mix-target-range"]') as any;
    const n7 = (ro7?.textContent || '').match(/-?\d+\.\d+/g) || [];
    check('(f) the reachable interval narrows once a tier is held', n7.length === 2,
      ro7 ? ro7.textContent : 'no readout - the range collapsed with one hold');
    if (n7.length === 2) {
      const tgt7 = Math.round(((Number(n7[0]) + Number(n7[1])) / 2) * 100) / 100;
      const box7 = c7.querySelector('[data-testid="yield-mix-target"]') as any;
      await (act as any)(async () => {
        nativeSetter.call(box7, String(tgt7));
        box7.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
        box7.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
      });
      await clickIt(c7.querySelector('[data-testid="yield-mix-target-apply"]') as any);
      check('(f) a HELD tier is untouched by Apply, to the penny',
        Number(rangeOf(c7, H).value) === heldExact,
        `${Number(rangeOf(c7, H).value)} vs ${heldExact} - Apply ignored the lock set`);
      check('(f) and Apply still hit the target with the hold in place',
        Math.abs(blendOf(c7, tiers7) - tgt7) < 0.005,
        `by hand ${blendOf(c7, tiers7).toFixed(6)} vs target ${tgt7}`);
      check('(f) and the padlock is still engaged after Apply',
        lockOf(c7, H).getAttribute('aria-pressed') === 'true');
    }

    // ── THE TARGET IS DRAFT-ONLY, AND THAT IS ASSERTED, NOT ASSUMED ──────────
    // It is a way of REACHING a mix, not a property of the event: what persists
    // is the mix it produced. The Promotion arm behaves the same way. This
    // check pins the CURRENT behaviour so that persisting it later is a
    // deliberate change rather than a silent one.
    captured.length = 0;
    const addBtn6 = [...c6.querySelectorAll('button')]
      .find((b: any) => /add .*(event|yield)/i.test(b.textContent || '')) as any;
    if (addBtn6) await clickIt(addBtn6);
    if (captured.length === 1) {
      const keys = Object.keys(captured[0]).filter(k => /target/i.test(k));
      check('(f) the saved event carries NO target field - the target is draft-only',
        keys.length === 0, keys.join(','));
    } else {
      check('(f) the draft-only check reached a saved event', false, `${captured.length} captured`);
    }
  }


  // ── (g) THE DRAG HOLDS THE TARGET, ON THE VALUE CARD ──────────────────────
  // 1213 measured this failing: a target of 23.93 became a blend of 21.385325
  // the moment a slider moved, on BOTH cards, because both drag paths reached
  // `rebalance` — which is given neither the target nor the rates. These are
  // the checks that failure would have had to pass.
  const { c: c8 } = await openValueCard();
  const tiers8 = tiersIn(c8);
  const rate8 = (t: string) => Number(
    (c8.querySelector(`[data-testid="tier-arpu-override-${t}"]`) as any).placeholder);
  const blend8 = () => tiers8.reduce((s, t) => s + Number(rangeOf(c8, t).value) / 100 * rate8(t), 0);
  const box8 = c8.querySelector('[data-testid="yield-mix-target"]') as any;
  const ro8 = c8.querySelector('[data-testid="yield-mix-target-range"]') as any;
  const n8 = ((ro8?.textContent) || '').match(/-?\d+\.\d+/g) || [];
  check('(g) the Value card offers a reachable interval', n8.length === 2, ro8?.textContent || 'absent');

  if (n8.length === 2 && box8) {
    const lo8 = Number(n8[0]), hi8 = Number(n8[1]);
    const T8 = Math.round(((lo8 + hi8) / 2) * 100) / 100;
    const type8 = async (v: number) => {
      await (act as any)(async () => {
        nativeSetter.call(box8, String(v));
        box8.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
        box8.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
      });
    };
    await type8(T8);
    await clickIt(c8.querySelector('[data-testid="yield-mix-target-apply"]') as any);
    const applied8 = blend8();

    // THE DRAG. Small, well inside the range, so this is the plain case.
    const mv8 = tiers8[1];
    const from8 = Number(rangeOf(c8, mv8).value);
    const to8 = Math.max(0, Math.min(100, from8 > 50 ? from8 - 5 : from8 + 5));
    await setRange(rangeOf(c8, mv8), to8);
    const after8 = blend8();
    console.log(`  (g) value drag: target ${T8}, blend after Apply ${applied8.toFixed(6)},`
      + ` dragged ${mv8} ${from8.toFixed(3)} -> ${to8}, blend after ${after8.toFixed(6)}`);
    check('(g) THE BLEND IS STILL THE TARGET AFTER A DRAG',
      Math.abs(after8 - T8) < 0.005,
      `${after8.toFixed(6)} vs ${T8} — 1213 measured this at 21.385325 against 23.93`);
    check('(g) and the shares still total 100',
      Math.abs(tiers8.reduce((s, t) => s + Number(rangeOf(c8, t).value), 0) - 100) < 0.05,
      String(tiers8.reduce((s, t) => s + Number(rangeOf(c8, t).value), 0)));
    check('(g) and the dragged tier went where it was dragged',
      Math.abs(Number(rangeOf(c8, mv8).value) - to8) < 1e-6,
      `${Number(rangeOf(c8, mv8).value)} vs ${to8}`);

    // ── A LOCK HOLDS UNDER A DRAG-WITH-TARGET ───────────────────────────────
    const { c: c9 } = await openValueCard();
    const tiers9 = tiersIn(c9);
    const H9 = tiers9[0];
    await clickIt(lockOf(c9, H9));
    const heldExact9 = Number(rangeOf(c9, H9).value);
    const ro9 = c9.querySelector('[data-testid="yield-mix-target-range"]') as any;
    const n9 = ((ro9?.textContent) || '').match(/-?\d+\.\d+/g) || [];
    if (n9.length === 2) {
      const T9 = Math.round(((Number(n9[0]) + Number(n9[1])) / 2) * 100) / 100;
      const box9 = c9.querySelector('[data-testid="yield-mix-target"]') as any;
      await (act as any)(async () => {
        nativeSetter.call(box9, String(T9));
        box9.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
        box9.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
      });
      await clickIt(c9.querySelector('[data-testid="yield-mix-target-apply"]') as any);
      const mv9 = tiers9[1];
      const from9 = Number(rangeOf(c9, mv9).value);
      await setRange(rangeOf(c9, mv9), Math.max(0, Math.min(100, from9 > 50 ? from9 - 4 : from9 + 4)));
      const rate9 = (t: string) => Number(
        (c9.querySelector(`[data-testid="tier-arpu-override-${t}"]`) as any).placeholder);
      const blend9 = tiers9.reduce((s, t) => s + Number(rangeOf(c9, t).value) / 100 * rate9(t), 0);
      check('(g) a HELD tier is untouched by a drag under a target, to the penny',
        Number(rangeOf(c9, H9).value) === heldExact9,
        `${Number(rangeOf(c9, H9).value)} vs ${heldExact9}`);
      check('(g) and the target is still held with a lock in play',
        Math.abs(blend9 - T9) < 0.005, `${blend9.toFixed(6)} vs ${T9}`);
    }

    // ── THE WALL ────────────────────────────────────────────────────────────
    // Drag hard toward a bound. The slider must STOP short of the request, the
    // reason must render, and the target must still be held at the stop.
    const { c: cW } = await openValueCard();
    const tiersW = tiersIn(cW);
    const boxW = cW.querySelector('[data-testid="yield-mix-target"]') as any;
    const roW = cW.querySelector('[data-testid="yield-mix-target-range"]') as any;
    const nW = ((roW?.textContent) || '').match(/-?\d+\.\d+/g) || [];
    const TW = Math.round(((Number(nW[0]) + Number(nW[1])) / 2) * 100) / 100;
    await (act as any)(async () => {
      nativeSetter.call(boxW, String(TW));
      boxW.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      boxW.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
    await clickIt(cW.querySelector('[data-testid="yield-mix-target-apply"]') as any);
    const mvW = tiersW[0];
    await setRange(rangeOf(cW, mvW), 100);
    const stopped = Number(rangeOf(cW, mvW).value);
    const rateW = (t: string) => Number(
      (cW.querySelector(`[data-testid="tier-arpu-override-${t}"]`) as any).placeholder);
    const blendW = tiersW.reduce((s, t) => s + Number(rangeOf(cW, t).value) / 100 * rateW(t), 0);
    console.log(`  (g) value wall: requested 100, stopped at ${stopped.toFixed(6)},`
      + ` blend ${blendW.toFixed(6)} vs target ${TW}`);
    check('(g) THE DRAG STOPS AT THE WALL rather than taking the request',
      stopped < 100 - 1e-6, `${stopped} — it went the whole way, so nothing stopped it`);
    check('(g) the wall reason is RENDERED',
      !!cW.querySelector('[data-testid="yield-mix-wall"]'),
      'a slider that stops without saying why is the dead-control state');
    check('(g) and AT THE WALL the target is still held',
      Math.abs(blendW - TW) < 0.005,
      `${blendW.toFixed(6)} vs ${TW} — a wall that abandoned the target would be the old bug`);
    check('(g) and the shares still total 100 at the wall',
      Math.abs(tiersW.reduce((s, t) => s + Number(rangeOf(cW, t).value), 0) - 100) < 0.05);
  }

  // ── (h) THE SAME, ON THE PROMOTION ARM ────────────────────────────────────
  // Its 0958 testids have never been driven. Both cards reach one function, so
  // a check here is not a duplicate: it is the assertion that they still do.
  {
    host.replaceChildren();
    const cp = document.createElement('div');
    host.appendChild(cp);
    const rootP = createRoot(cp);
    await (act as any)(async () => { rootP.render(withProvider(React.createElement(M, whatIfProps()))); });
    await clickIt(cp.querySelector('[data-testid="whatif-tab-promotion"]') as any);
    let mixBox: any = null;
    for (const b of [...cp.querySelectorAll('input[type=checkbox]')] as any[]) {
      const label = b.closest('label')?.textContent || b.parentElement?.textContent || '';
      if (/mix/i.test(label)) { mixBox = b; break; }
    }
    check('(h) the Promotion mix arm is reachable', !!mixBox);
    if (mixBox) {
      await clickIt(mixBox);
      const pTiers = [...cp.querySelectorAll('[data-testid^="promo-mix-lock-"]')]
        .map((el: any) => el.getAttribute('data-testid').replace('promo-mix-lock-', ''));
      const pRange = (t: string) => cp.querySelector(`[data-testid="promo-mix-range-${t}"]`) as any;
      const pRate = (t: string) => Number(
        (cp.querySelector(`[data-testid="promo-band-arpu-override-${t}"]`) as any).placeholder);
      const pBlend = () => pTiers.reduce((s, t) => s + Number(pRange(t).value) / 100 * pRate(t), 0);
      const pBox = cp.querySelector('[data-testid="promo-mix-target"]') as any;
      const pRo = cp.querySelector('[data-testid="promo-mix-target-range"]') as any;
      check('(h) the Promotion target box and range readout are present by testid',
        !!pBox && !!pRo, 'the 0958 testids');
      const pN = ((pRo?.textContent) || '').match(/-?\d+\.\d+/g) || [];
      if (pBox && pN.length === 2) {
        const pT = Math.round(((Number(pN[0]) + Number(pN[1])) / 2) * 100) / 100;
        await (act as any)(async () => {
          nativeSetter.call(pBox, String(pT));
          pBox.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
          pBox.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
        });
        await clickIt(cp.querySelector('[data-testid="promo-mix-target-apply"]') as any);
        const pMv = pTiers[1];
        const pFrom = Number(pRange(pMv).value);
        await setRange(pRange(pMv), Math.max(0, Math.min(100, pFrom > 50 ? pFrom - 5 : pFrom + 5)));
        const pAfter = pBlend();
        console.log(`  (h) promo drag: target ${pT}, dragged ${pMv} ${pFrom.toFixed(3)},`
          + ` blend after ${pAfter.toFixed(6)}`);
        check('(h) THE PROMOTION ARM ALSO HOLDS THE TARGET UNDER A DRAG',
          Math.abs(pAfter - pT) < 0.005,
          `${pAfter.toFixed(6)} vs ${pT} — 1213 measured 21.385325 against 23.93 here too`);
        check('(h) and its shares still total 100',
          Math.abs(pTiers.reduce((s, t) => s + Number(pRange(t).value), 0) - 100) < 0.05);
      }
    }
  }

  // THE 4-MEMBER TARIFF AXIS IS NOT EXERCISED MOUNTED. This harness passes an
  // empty tariffTree and no selectedTariffs, so the tariff axis never seeds and
  // the mounted cases above are all three-band. The engine's 4-member case is
  // covered by property checks in spec:mix-constraint, including the
  // minimum-change comparison against a brute sweep; what is missing is a
  // MOUNTED 4-member drag, and it is missing because no fixture seeds one.


  // ── (i) THE TYPED BOX COMMITS ON ENTER OR BLUR, NOT PER KEYSTROKE ─────────
  // D4-02 option (a). Typing "35" passes through "3"; committing that would
  // rebalance to a 3% mix and, under a target, could CLAMP at the wall — so the
  // user lands on a number they never typed and never saw. The draft exists
  // because the wall exists.
  {
    const { c: cb } = await openValueCard();
    const tiersB = tiersIn(cb);
    const pctOf = (t: string) => cb.querySelector(`[data-testid="yield-mix-pct-${t}"]`) as any;
    check('(i) the mix % box is reachable by testid', !!pctOf(tiersB[0]),
      'D4-02 needs the box addressable; it had no testid before');

    const roB = cb.querySelector('[data-testid="yield-mix-target-range"]') as any;
    const nB = ((roB?.textContent) || '').match(/-?\d+\.\d+/g) || [];
    const TB = Math.round(((Number(nB[0]) + Number(nB[1])) / 2) * 100) / 100;
    const boxB = cb.querySelector('[data-testid="yield-mix-target"]') as any;
    await (act as any)(async () => {
      nativeSetter.call(boxB, String(TB));
      boxB.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    await clickIt(cb.querySelector('[data-testid="yield-mix-target-apply"]') as any);

    const target8 = tiersB[1];
    const box = pctOf(target8);
    const otherShares = () => tiersB.filter(t => t !== target8).map(t => Number(rangeOf(cb, t).value));
    const before = otherShares();

    // KEYSTROKE ONE: "3".
    await (act as any)(async () => {
      nativeSetter.call(box, '3');
      box.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    check('(i) after one keystroke the box shows the draft',
      pctOf(target8).value === '3', `"${pctOf(target8).value}"`);
    check('(i) and NOTHING has rebalanced yet',
      otherShares().every((v, k) => v === before[k]),
      `${before.join(',')} -> ${otherShares().join(',')} — a 3% mix the user never asked for`);

    // KEYSTROKE TWO: "35".
    await (act as any)(async () => {
      nativeSetter.call(box, '35');
      box.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    check('(i) after the second keystroke the box shows 35',
      pctOf(target8).value === '35', `"${pctOf(target8).value}"`);
    check('(i) and STILL nothing has rebalanced',
      otherShares().every((v, k) => v === before[k]),
      `${otherShares().join(',')}`);

    // ENTER COMMITS.
    await (act as any)(async () => {
      pctOf(target8).dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    const committedShares = tiersB.map(t => Number(rangeOf(cb, t).value));
    check('(i) ENTER commits — the mix moved',
      otherShares().some((v, k) => v !== before[k]), `${otherShares().join(',')}`);
    const rateB = (t: string) => Number(
      (cb.querySelector(`[data-testid="tier-arpu-override-${t}"]`) as any).placeholder);
    const blendB = tiersB.reduce((s, t) => s + Number(rangeOf(cb, t).value) / 100 * rateB(t), 0);
    check('(i) and the commit held the target, exactly as a drag would',
      Math.abs(blendB - TB) < 0.005, `${blendB.toFixed(6)} vs ${TB}`);
    console.log(`  (i) typed 35 under target ${TB}: committed mix `
      + `${committedShares.map(v => v.toFixed(3)).join(', ')}, blend ${blendB.toFixed(6)}`);

    // THE COMMIT TAKES THE SAME PATH A DRAG TAKES: a second mount dragged to
    // the same value must land on the same mix. Not "close" — the same.
    const { c: cd } = await openValueCard();
    const tiersD = tiersIn(cd);
    const boxD = cd.querySelector('[data-testid="yield-mix-target"]') as any;
    await (act as any)(async () => {
      nativeSetter.call(boxD, String(TB));
      boxD.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    await clickIt(cd.querySelector('[data-testid="yield-mix-target-apply"]') as any);
    await setRange(rangeOf(cd, tiersD[1]), 35);
    const dragged = tiersD.map(t => Number(rangeOf(cd, t).value));
    check('(i) TYPING 35 AND DRAGGING TO 35 LAND ON THE SAME MIX',
      dragged.every((v, k) => Math.abs(v - committedShares[k]) < 1e-9),
      `${dragged.map(v => v.toFixed(6)).join(',')} vs ${committedShares.map(v => v.toFixed(6)).join(',')}`);

    // ESCAPE REVERTS.
    const settled = Number(rangeOf(cb, target8).value);
    await (act as any)(async () => {
      nativeSetter.call(pctOf(target8), '77');
      pctOf(target8).dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    await (act as any)(async () => {
      pctOf(target8).dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    check('(i) ESCAPE restores the committed value',
      Math.abs(Number(rangeOf(cb, target8).value) - settled) < 1e-9,
      `${Number(rangeOf(cb, target8).value)} vs ${settled}`);

    // BLUR COMMITS.
    const beforeBlur = otherShares();
    await (act as any)(async () => {
      nativeSetter.call(pctOf(target8), '20');
      pctOf(target8).dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    check('(i) blur has not happened yet, so nothing moved',
      otherShares().every((v, k) => v === beforeBlur[k]));
    await (act as any)(async () => {
      // REACT IMPLEMENTS onBlur VIA THE BUBBLING `focusout`, not `blur`.
      // A non-bubbling 'blur' never reaches the delegated listener, so the
      // first version of this check failed against a control that works.
      pctOf(target8).dispatchEvent(new dom.window.FocusEvent('focusout', { bubbles: true }));
    });
    check('(i) BLUR commits',
      otherShares().some((v, k) => v !== beforeBlur[k]), `${otherShares().join(',')}`);

    // WITHOUT A TARGET, the same box behaves the same way and rebalances to 100.
    const { c: cn } = await openValueCard();
    const tiersN = tiersIn(cn);
    const boxN = cn.querySelector(`[data-testid="yield-mix-pct-${tiersN[1]}"]`) as any;
    const beforeN = tiersN.map(t => Number(rangeOf(cn, t).value));
    await (act as any)(async () => {
      nativeSetter.call(boxN, '45');
      boxN.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    check('(i) with NO target the box still holds a draft — one behaviour',
      tiersN.map(t => Number(rangeOf(cn, t).value)).every((v, k) => v === beforeN[k]),
      'commit-on-keystroke when free would make the control mode-dependent');
    await (act as any)(async () => {
      boxN.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    const sumN = tiersN.reduce((s, t) => s + Number(rangeOf(cn, t).value), 0);
    check('(i) and Enter rebalances to 100 as a drag would',
      Math.abs(sumN - 100) < 0.05 && Math.abs(Number(rangeOf(cn, tiersN[1]).value) - 45) < 1e-6,
      `sum ${sumN}, moved ${Number(rangeOf(cn, tiersN[1]).value)}`);
  }

  // ── (j) THE PROMOTION ARM, SAME BOX ───────────────────────────────────────
  {
    host.replaceChildren();
    const cq = document.createElement('div');
    host.appendChild(cq);
    const rootQ = createRoot(cq);
    await (act as any)(async () => { rootQ.render(withProvider(React.createElement(M, whatIfProps()))); });
    await clickIt(cq.querySelector('[data-testid="whatif-tab-promotion"]') as any);
    let mb: any = null;
    for (const b of [...cq.querySelectorAll('input[type=checkbox]')] as any[]) {
      const label = b.closest('label')?.textContent || b.parentElement?.textContent || '';
      if (/mix/i.test(label)) { mb = b; break; }
    }
    if (mb) {
      await clickIt(mb);
      const pT = [...cq.querySelectorAll('[data-testid^="promo-mix-lock-"]')]
        .map((el: any) => el.getAttribute('data-testid').replace('promo-mix-lock-', ''));
      const pR = (t: string) => cq.querySelector(`[data-testid="promo-mix-range-${t}"]`) as any;
      const pBox = cq.querySelector(`[data-testid="promo-mix-pct-${pT[1]}"]`) as any;
      check('(j) the Promotion mix % box is reachable by testid', !!pBox);
      if (pBox) {
        const beforeP = pT.filter(t => t !== pT[1]).map(t => Number(pR(t).value));
        await (act as any)(async () => {
          nativeSetter.call(pBox, '3');
          pBox.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
        });
        check('(j) one keystroke on the Promotion arm rebalances NOTHING',
          pT.filter(t => t !== pT[1]).map(t => Number(pR(t).value)).every((v, k) => v === beforeP[k]),
          'the same behaviour on both cards, which is what option (a) is for');
        await (act as any)(async () => {
          nativeSetter.call(pBox, '35');
          pBox.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
          pBox.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        });
        check('(j) and ENTER commits on the Promotion arm too',
          Math.abs(Number(pR(pT[1]).value) - 35) < 1e-6, `${Number(pR(pT[1]).value)}`);
      }
    }
  }

  // ── (k) EXACTLY DETERMINED IS A COLLAPSED RANGE, NOT A WALL ───────────────
  // D4-03. Three tiers, a target, one lock: the two free tiers are then fixed
  // by the two equations, so there is no move to make — which is a different
  // claim from "a move was stopped".
  {
    const { c: ck } = await openValueCard();
    const tiersK = tiersIn(ck);
    const roK = ck.querySelector('[data-testid="yield-mix-target-range"]') as any;
    const nK = ((roK?.textContent) || '').match(/-?\d+\.\d+/g) || [];
    const TK = Math.round(((Number(nK[0]) + Number(nK[1])) / 2) * 100) / 100;
    const boxK = ck.querySelector('[data-testid="yield-mix-target"]') as any;
    await (act as any)(async () => {
      nativeSetter.call(boxK, String(TK));
      boxK.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    await clickIt(ck.querySelector('[data-testid="yield-mix-target-apply"]') as any);
    const HK = tiersK[0];
    await clickIt(lockOf(ck, HK));

    const free = tiersK.filter(t => t !== HK);
    check('(k) with a target and one hold, the free tiers are DISABLED',
      free.every(t => rangeOf(ck, t).disabled === true),
      free.map(t => `${t}=${rangeOf(ck, t).disabled}`).join(' '));
    check('(k) and are NOT shown as held — the two-reasons rule at a third site',
      free.every(t => lockOf(ck, t).getAttribute('aria-pressed') !== 'true'),
      'a slider fixed by the constraints is not a slider the user padlocked');
    check('(k) the EXACTLY-DETERMINED reason is rendered',
      !!ck.querySelector('[data-testid="yield-mix-determined"]'),
      'the sliders went dead with nothing saying why');
    check('(k) and the WALL message is NOT shown — no move was stopped',
      !ck.querySelector('[data-testid="yield-mix-wall"]'),
      'the wall reports an interaction; there was none');

    // RELEASING THE LOCK GIVES THE MOVE BACK.
    await clickIt(lockOf(ck, HK));
    check('(k) releasing the hold re-enables the free tiers',
      free.every(t => rangeOf(ck, t).disabled === false),
      free.map(t => `${t}=${rangeOf(ck, t).disabled}`).join(' '));
    check('(k) and the reason clears',
      !ck.querySelector('[data-testid="yield-mix-determined"]'));
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
