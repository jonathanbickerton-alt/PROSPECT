/**
 * THE CONSTRAINED MIX CARD — the promotion card driven against the real engine.
 *
 *   npm run spec:mix-card
 *
 * Session 2 of the constrained mix mode. Session 1's spec pins the engine's
 * arithmetic; this one pins that the CARD is wired to it and behaves as the
 * settled semantics say. Nothing here is mocked: the real WhatIfTab renders,
 * the real mixConstraint functions run, and the fixture is a production file.
 *
 * TRANSITION-HEAVY BY CONSTRUCTION, because state-not-transition is the rule
 * this family of defects keeps breaking. A mount showing a locked slider proves
 * a render; it does not prove that clicking the padlock locked it. So every
 * padlock and target assertion here is a SEQUENCE — mount, act, assert, act
 * again, assert again — and the intermediate states are checked, not just the
 * final one.
 *
 * WHAT IT IS CAREFUL ABOUT:
 *
 *  - AUTO-LOCK IS OFF (settled 2026-08-11, Jon). The decisive check is a
 *    NEGATIVE one: after moving a slider, no padlock is engaged. A spec that
 *    only asserted the mix rebalanced would pass under either policy and so
 *    would not be testing the decision at all.
 *  - THE TWO CAUSES OF AN IMMOVABLE SLIDER ARE DISTINGUISHED. A slider frozen
 *    because the user held it and one frozen because the range collapsed are
 *    different claims; the padlock must reflect only the first.
 *  - ABSENCE IS NOT ZERO, on screen. The blend row must not read "0.00" when
 *    there is no blend, and the check reads the rendered TEXT rather than the
 *    state behind it.
 *  - IT PINS COUNTS. Every sweep says how many cases it exercised, so a
 *    selector that silently matches nothing cannot pass as a clean run.
 *
 * EXTENDED 2026-08-13 for REQUEST 3 — the per-band ARPU override. Deliberately
 * an extension of THIS file rather than a second harness: the recovery report's
 * Finding D established that the mount, the card-opening and the saved-promotion
 * restore already existed here, and two harnesses for one card drift.
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

// THE MEMBER-DECLINE SENTENCE, read from the locale file rather than
// duplicated here. A copy pasted into the spec would let the app's copy
// change while the assertion kept passing against the old words.
const EN_MEMBER_NO_EDIT: string = JSON.parse(
  (await import('node:fs')).readFileSync('src/locales/en/translation.json', 'utf8')
)['whatif_churn_member_no_edit'];

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));

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
    console.log(`\nmix-card spec: UNREACHABLE — fixture missing at ${FIX}`);
    process.exit(1);
  }
  const wb = XLSX.read(fs.readFileSync(FIX), { cellDates: true });
  const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

  const C = {
    // CORRECTED 2026-08-20. `prod` was 'Product_Category', a column this
    // fixture does NOT contain — so every mounted check since this harness was
    // written ran against an EMPTY product tree. Found while wiring the churn
    // section, which was the first check to depend on the tree being populated.
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

  // PRODUCTION-FED: the same prop shape the i18n sweep already uses to reach
  // this card, rather than a second hand-built one that could drift from it.
  const whatIfProps = () => ({
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
    yieldEvents: [], newYieldEvent: {}, setNewYieldEvent: noop, addYieldEvent: noop,
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
    // REQUIRED PROP, and this harness never passed it — `ForecastProvider as
    // any` hid that from tsc until R7's churn panel became the first consumer
    // to call it. Supplied here as the REAL seam over this provider's store.
    resolveForecast: (k: string) => fc.resolveFromStore(new Map(), new Map(), k),
    canResolve: () => false,
    hasLegacyBaseline: !!baseForecast, updatedAt: new Date().toISOString(),
    bulkRuns: [], setBulkRuns: noop,
  }, child);

  // ── Mount, open the Promotion card, enable the mix arm ────────────────────
  const M: any = (await import('../src/components/WhatIfTab')).WhatIfTab;
  const host = document.getElementById('root')!;
  host.replaceChildren();
  const container = document.createElement('div');
  host.appendChild(container);
  const root = createRoot(container);
  await (act as any)(async () => { root.render(withProvider(React.createElement(M, whatIfProps()))); });

  const norm = (s: string) => (s || '').replace(/»/g, '').trim();
  const btnByText = (txt: string) =>
    [...container.querySelectorAll('button')].find(b => norm(b.textContent || '') === txt) as any;

  // THE PRODUCT TREE IS NON-EMPTY, and this check is the reason the column
  // defect could live: NOTHING asserted the harness's own inputs were real.
  // Correcting C.prod re-baselined ZERO expectations — every existing check
  // passed against an empty tree and still passes against a populated one,
  // which says plainly that none of them exercised it.
  {
    const tree = whatIfProps().productTree as Map<string, string[]>;
    check('harness: the product tree fed to the card is POPULATED',
      tree.size > 0, `${tree.size} products — an empty tree means C.prod names a column the fixture lacks`);
  }

  const promoBtn = btnByText('Promotion');
  check('mount: the Promotion card is reachable', !!promoBtn);
  if (!promoBtn) { report(); return; }
  await (act as any)(async () => { promoBtn.click(); });

  // The mix arm is a checkbox; find it by the label it sits beside.
  const boxes = [...container.querySelectorAll('input[type=checkbox]')] as any[];
  let mixBox: any = null;
  for (const b of boxes) {
    const label = b.closest('label')?.textContent || b.parentElement?.textContent || '';
    if (/mix/i.test(label)) { mixBox = b; break; }
  }
  check('mount: the mix arm toggle is present', !!mixBox);
  if (!mixBox) { report(); return; }
  await (act as any)(async () => { mixBox.click(); });

  const locks = () => [...container.querySelectorAll('[data-testid^="promo-mix-lock-"]')] as any[];
  const sliders = () => [...container.querySelectorAll('input[type=range]')] as any[];
  const numbers = () => [...container.querySelectorAll('input[type=number]')] as any[];
  const bodyText = () => container.textContent || '';

  const lockRow = locks();
  check('mount: a padlock is rendered for every mix member',
    lockRow.length >= 2, `${lockRow.length} padlocks`);
  if (lockRow.length < 2) { report(); return; }

  // Mix percentage inputs are the number inputs bounded 0..100 that sit in the
  // slider grid; read shares from the sliders themselves, which is what the
  // user manipulates.
  const shares = () => sliders().map(s => Number(s.value));
  const sumShares = () => shares().reduce((a, b) => a + b, 0);

  check('mount: the seeded mix conserves the total', near(sumShares(), 100, 1e-3), `${sumShares()}`);

  // ── TRANSITION 1: move a slider. Auto-lock is OFF, so no lock may appear. ──
  const before = shares();
  const engagedBefore = locks().filter(b => b.getAttribute('aria-pressed') === 'true').length;
  check('transition: no padlock is engaged before any interaction', engagedBefore === 0, `${engagedBefore}`);

  const firstSlider = sliders()[0];
  const nativeSetter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!;
  const setRange = async (el: any, v: number) => {
    await (act as any)(async () => {
      nativeSetter.call(el, String(v));
      el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
  };
  await setRange(firstSlider, 60);

  const after = shares();
  check('transition: moving a slider changes the mix', after[0] !== before[0], `${before[0]} -> ${after[0]}`);
  check('transition: and the total is still conserved', near(sumShares(), 100, 1e-3), `${sumShares()}`);

  // THE DECISIVE CHECK for the settled decision. A spec that only asserted the
  // rebalance would pass under auto-lock ON as well.
  const engagedAfter = locks().filter(b => b.getAttribute('aria-pressed') === 'true').length;
  check('AUTO-LOCK IS OFF: moving a slider engages NO padlock',
    engagedAfter === 0, `${engagedAfter} engaged — auto-lock was settled OFF on 2026-08-11`);

  // ── TRANSITION 2: padlock → held → released ───────────────────────────────
  await (act as any)(async () => { locks()[0].click(); });
  check('transition: clicking a padlock engages it',
    locks()[0].getAttribute('aria-pressed') === 'true');
  check('transition: and freezes that member\'s slider', sliders()[0].disabled === true);
  check('transition: while the other members stay movable', sliders()[1].disabled === false);

  const heldShare = shares()[0];
  await setRange(sliders()[1], 25);
  check('transition: moving another member leaves the held share untouched',
    near(shares()[0], heldShare, 1e-6), `${heldShare} -> ${shares()[0]}`);
  check('transition: and the total is still conserved', near(sumShares(), 100, 1e-3), `${sumShares()}`);

  await (act as any)(async () => { locks()[0].click(); });
  check('transition: clicking again RELEASES the padlock',
    locks()[0].getAttribute('aria-pressed') === 'false' || locks()[0].getAttribute('aria-pressed') === null);
  check('transition: and the slider moves again', sliders()[0].disabled === false);

  // ── TRANSITION 3: lock all but one → collapsed range ──────────────────────
  const n = locks().length;
  for (let i = 0; i < n; i++) await (act as any)(async () => { locks()[i].click(); });
  const allHeld = locks().filter(b => b.getAttribute('aria-pressed') === 'true').length;
  check('transition: every member can be held', allHeld === n, `${allHeld}/${n}`);
  const frozen = sliders().filter(s => s.disabled).length;
  check('transition: a fully-held mix freezes every slider', frozen === n, `${frozen}/${n}`);
  check('transition: and the card SAYS the range collapsed rather than just going dead',
    /leave one reachable blend|cannot move/i.test(bodyText()),
    'a collapsed range must state its cause, not merely disable');

  // Release all again.
  for (let i = 0; i < n; i++) await (act as any)(async () => { locks()[i].click(); });
  check('transition: releasing every hold un-freezes the sliders',
    sliders().filter(s => !s.disabled).length === n);

  // ── TRANSITION 4: target typed → unreachable → amended → reachable ────────
  const targetInput = numbers().find(i => i.getAttribute('step') === '0.01') as any;
  check('mount: the target-ARPU input is present', !!targetInput);
  if (targetInput) {
    const setNum = async (el: any, v: string) => {
      await (act as any)(async () => {
        nativeSetter.call(el, v);
        el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
        el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
      });
    };

    check('target: blank shows no verdict at all — free sliders, live blend',
      !/not reachable/i.test(bodyText()),
      'blank is a real state and must not read as a failed target');

    // A target far above anything the members can blend to.
    await setNum(targetInput, '99999');
    check('target: an unreachable target is FLAGGED', /not reachable/i.test(bodyText()));
    check('target: and the binding constraint is NAMED, not just "unreachable"',
      /highest blend these holds allow/i.test(bodyText()),
      'the settled semantics require the binding constraint named');
    const sharesWhenBlocked = shares();
    check('target: an unreachable target is never silently clamped — the mix is untouched',
      near(sharesWhenBlocked.reduce((a, b) => a + b, 0), 100, 1e-3));

    const applyBtn = btnByText('Apply');
    check('target: Apply is disabled while the target is unreachable',
      !!applyBtn && applyBtn.disabled === true);

    // Amend to something reachable, then apply and re-measure the blend.
    // AMENDED → REACHABLE. The leg that proves the flag is a live verdict and
    // not a sticky banner, and that Apply actually hits the number typed.
    const rangeText = bodyText().match(/Reachable:\s*([\d.]+)\s*–\s*([\d.]+)/);
    check('target: the reachable range is displayed as a range, not just enforced',
      !!rangeText, 'the user needs to know what they may type before typing it');
    if (rangeText) {
      const lo = Number(rangeText[1]), hi = Number(rangeText[2]);
      const midpoint = (lo + hi) / 2;
      await setNum(targetInput, midpoint.toFixed(4));
      check('target: amending to a reachable value clears the unreachable flag',
        !/not reachable/i.test(bodyText()), `${lo}..${hi}, typed ${midpoint}`);

      const apply = btnByText('Apply');
      check('target: Apply becomes enabled once the target is reachable',
        !!apply && apply.disabled === false);
      if (apply && !apply.disabled) {
        const beforeApply = shares().join(',');
        await (act as any)(async () => { apply.click(); });
        check('target: applying rewrites the mix', shares().join(',') !== beforeApply,
          `${beforeApply} -> ${shares().join(',')}`);
        check('target: and the applied mix still conserves the total',
          near(sumShares(), 100, 1e-3), `${sumShares()}`);

        // RE-MEASURED THROUGH THE RENDERED BLEND, not through the engine again.
        // Session 1's trap 53 caught a check that asserted conformance and
        // passed on a mix blending to the wrong number; this is that lesson
        // applied at the card.
        const blendShown = bodyText().match(/blended ARPU:?\s*([\d.]+)/i);
        check('target: the RENDERED blend equals the target that was applied',
          !!blendShown && near(Number(blendShown[1]), midpoint, 1e-3),
          blendShown ? `shown ${blendShown[1]} vs target ${midpoint.toFixed(4)}` : 'no blend rendered');
      }
    }

    await setNum(targetInput, '');
    check('target: clearing the target clears the flag',
      !/not reachable/i.test(bodyText()), 'blank must return to the no-verdict state');
  }

  // ── ABSENCE IS NOT ZERO, read off the rendered text ───────────────────────
  check('blend: the card renders a blend row', /blended ARPU/i.test(bodyText()));

  // The member names the CARD actually derives, read off its own padlocks.
  // Guessing them from the fixture column gave a set that was missing a tier,
  // and the resulting "stored mix" was non-conforming for a reason that had
  // nothing to do with what was being tested.
  const cardMembers = locks().map(b => String(b.getAttribute('data-testid')).replace('promo-mix-lock-', ''));
  check('members: the card exposes its derived member names', cardMembers.length >= 2,
    cardMembers.join(', '));

  await (act as any)(async () => { root.unmount(); });

  // ── WRITE ENFORCES, READ TOLERATES — mounted, both directions ─────────────
  //
  // Driven through the REAL restore path: a saved promotion whose stored mix
  // does not sum to 100 is loaded by clicking the card's own edit control. A
  // probe that set the draft mix directly would inherit my assumption about how
  // restore works, which is the exact mistake the Base-series arc made five
  // times before the real path was driven.
  {
    const members = cardMembers;

    // Deliberately non-conforming: 90, not 100, and covering EVERY member so the
    // only thing wrong with it is the total. This is the legacy/reshaped-mix
    // case the amber indicator exists for.
    const storedMix: Record<string, number> = {};
    const share90 = 90 / members.length;
    members.forEach(m => { storedMix[m] = share90; });

    const savedPromo: any = {
      id: 'restore-nonconforming', scenario: 'Inflow',
      segment: 'Corporate', product: 'All', productL2: 'All',
      channel: 'All', channelL2: 'All', tariffL1: 'All', tariffL2: 'All',
      date: '2026-09', sequence: 1, subscriberVolume: 500, customerVolume: 0,
      revenue: 5000, arpu: 10, name: '', campaignName: '', comment: '', contractLength: 12,
      isPromotion: true, promoRebanded: false,
      promoMixAxis: 'value', promoMix: storedMix,
    };

    const props2 = { ...whatIfProps(), marketEvents: [savedPromo] };
    const c2 = document.createElement('div');
    host.appendChild(c2);
    const root2 = createRoot(c2);
    await (act as any)(async () => { root2.render(withProvider(React.createElement(M, props2))); });

    const promoTab = [...c2.querySelectorAll('button')].find(b => norm(b.textContent || '') === 'Promotion') as any;
    check('restore: the Promotion card opens with a saved promotion present', !!promoTab);
    if (promoTab) {
      await (act as any)(async () => { promoTab.click(); });
      const editBtn = [...c2.querySelectorAll('button')]
        .find(b => /edit promotion/i.test(b.getAttribute('title') || '')) as any;
      check('restore: the saved promotion exposes an edit control', !!editBtn);
      if (editBtn) {
        await (act as any)(async () => { editBtn.click(); });
        const text2 = c2.textContent || '';
        const sum2 = [...c2.querySelectorAll('input[type=range]')]
          .reduce((a: number, s: any) => a + Number(s.value), 0);

        // READ IS TOLERANT: loaded as saved, NOT normalised to 100.
        check('READ TOLERATES: a non-conforming saved mix loads exactly as stored',
          Math.abs(sum2 - 100) > 1, `sum rendered ${sum2.toFixed(1)} — 100 would mean it was silently repaired`);
        check('READ TOLERATES: and the sum is flagged rather than corrected',
          /Sum:/i.test(text2), 'the amber sum indicator is what tells the user to look');

        // WRITE ENFORCES: the card must not let that mix be saved.
        const saveable = [...c2.querySelectorAll('button')]
          .filter(b => /^(Add|Save)/i.test(norm(b.textContent || '')));
        const anyEnabled = saveable.some((b: any) => !b.disabled);
        check('WRITE ENFORCES: no save control is enabled while the mix does not total 100',
          saveable.length > 0 && !anyEnabled,
          `${saveable.length} save controls, ${saveable.filter((b: any) => !b.disabled).length} enabled`);
        check('READ TOLERATES: the rendered sum is the stored 90, not some other wrong number',
          Math.abs(sum2 - 90) < 1, `${sum2.toFixed(1)}`);
      }
    }
    await (act as any)(async () => { root2.unmount(); });

    // ANTI-VACUITY CONTROL. A disabled button proves nothing about WHY it is
    // disabled — the same mount with a CONFORMING stored mix must leave the
    // save controls ENABLED. Without this, the check above would pass just as
    // happily if the buttons were disabled because the date was missing, and
    // the write-side guard could be entirely absent.
    const conformingMix: Record<string, number> = {};
    const shareEven = 100 / members.length;
    members.forEach((m, i) => {
      conformingMix[m] = i === members.length - 1 ? 100 - shareEven * (members.length - 1) : shareEven;
    });
    const props3 = { ...whatIfProps(), marketEvents: [{ ...savedPromo, promoMix: conformingMix }] };
    const c3 = document.createElement('div');
    host.appendChild(c3);
    const root3 = createRoot(c3);
    await (act as any)(async () => { root3.render(withProvider(React.createElement(M, props3))); });
    const promoTab3 = [...c3.querySelectorAll('button')].find(b => norm(b.textContent || '') === 'Promotion') as any;
    if (promoTab3) {
      await (act as any)(async () => { promoTab3.click(); });
      const edit3 = [...c3.querySelectorAll('button')]
        .find(b => /edit promotion/i.test(b.getAttribute('title') || '')) as any;
      if (edit3) {
        await (act as any)(async () => { edit3.click(); });
        const sum3 = [...c3.querySelectorAll('input[type=range]')]
          .reduce((a: number, s: any) => a + Number(s.value), 0);
        const saveable3 = [...c3.querySelectorAll('button')]
          .filter(b => /^(Add|Save)/i.test(norm(b.textContent || '')));
        check('CONTROL: a conforming stored mix loads at 100', Math.abs(sum3 - 100) < 1, `${sum3.toFixed(1)}`);
        check('CONTROL: and its save controls ARE enabled — so the block above was the mix, not the form',
          saveable3.length > 0 && saveable3.some((b: any) => !b.disabled),
          `${saveable3.filter((b: any) => !b.disabled).length}/${saveable3.length} enabled`);
      }
    }
    await (act as any)(async () => { root3.unmount(); });
  }

  // ── REQUEST 3: the per-band ARPU override, driven through the real input ───
  //
  // A FRESH MOUNT, because the blocks above deliberately leave the card in a
  // poked-at state. Every assertion below is a TRANSITION: the rendered value,
  // the styling and the blend are read before and after each act, so a check
  // cannot pass on a static render that happened to look right.
  {
    const captured: any[] = [];
    const props4 = { ...whatIfProps(), setMarketEvents: (v: any) => { captured.push(v); } };
    const c4 = document.createElement('div');
    host.appendChild(c4);
    const root4 = createRoot(c4);
    await (act as any)(async () => { root4.render(withProvider(React.createElement(M, props4))); });

    const promoTab4 = [...c4.querySelectorAll('button')].find(b => norm(b.textContent || '') === 'Promotion') as any;
    check('R3: the Promotion card is reachable', !!promoTab4);
    if (promoTab4) {
      await (act as any)(async () => { promoTab4.click(); });
      const boxes4 = [...c4.querySelectorAll('input[type=checkbox]')] as any[];
      const mixBox4 = boxes4.find(b =>
        /mix/i.test(b.closest('label')?.textContent || b.parentElement?.textContent || ''));
      check('R3: the mix arm toggle is present', !!mixBox4);
      if (mixBox4) {
        await (act as any)(async () => { mixBox4.click(); });

        const bandInputs = () =>
          [...c4.querySelectorAll('[data-testid^="promo-band-arpu-override-"]')] as any[];
        const text4 = () => c4.textContent || '';
        const blendNow = () => {
          const m = text4().match(/blended ARPU:?\s*(-?[\d.]+)/i);
          return m ? Number(m[1]) : null;
        };
        const setNum4 = async (el: any, v: string) => {
          await (act as any)(async () => {
            nativeSetter.call(el, v);
            el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
            el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
          });
        };

        const inputs = bandInputs();
        const bandCount = inputs.length;
        // COUNT PINNED, and cross-checked against a DIFFERENT selector — a
        // band-input sweep that silently matched nothing would otherwise pass
        // every check below vacuously.
        check('R3: every mix member renders a per-band ARPU input',
          bandCount > 0 && bandCount === c4.querySelectorAll('[data-testid^="promo-mix-lock-"]').length,
          `${bandCount} inputs vs ${c4.querySelectorAll('[data-testid^="promo-mix-lock-"]').length} padlocks`);

        if (bandCount > 0) {
          const first = () => bandInputs()[0];

          // ── STATE 1: UNSET. Derived shown as a placeholder, source NAMED. ──
          check('R3 unset: the input is empty, not pre-filled with the derived figure',
            first().value === '', `value "${first().value}" — a filled box would read as a stated rate`);
          const ph = first().getAttribute('placeholder');
          check('R3 unset: the derived figure is shown as the placeholder',
            !!ph && /\d/.test(ph), `placeholder "${ph}"`);
          // FINDING A: the source is named, and named CORRECTLY. The retired
          // wording would have claimed a trailing 3-month average, which is a
          // different figure (promoCohortAvgArpu, the mix-OFF fallback).
          const title0 = first().getAttribute('title') || '';
          check('R3 unset: the default NAMES its real basis (revenue ÷ volume)',
            /revenue\s*÷\s*volume/i.test(title0), `title "${title0}"`);
          check('R3 unset: and does NOT claim a trailing 3-month average',
            !/3-month|three-month|trailing/i.test(title0),
            'Finding A — that wording describes promoCohortAvgArpu, not this figure');

          const derivedBlend = blendNow();
          check('R3: a blend is rendered before any override', derivedBlend !== null, `${derivedBlend}`);

          // ── TRANSITION: type an override → styling flips AND blend moves ──
          const derivedFirst = Number(ph);
          const stated = derivedFirst + 25;
          await setNum4(first(), String(stated));
          check('R3 stated: the typed rate is the rendered value',
            Number(first().value) === stated, `${first().value}`);
          // NOT /border-\[#e60000\]/ — the base class carries
          // `focus:border-[#e60000]` in BOTH states, so that pattern matched
          // always and this check passed vacuously on its first run. The
          // background tint appears ONLY in the overridden branch.
          check('R3 stated: the styling flips to edited-vs-default',
            /bg-\[#e60000\]\/5/.test(first().className) && !/text-slate-400/.test(first().className),
            `class "${first().className}"`);
          const statedBlend = blendNow();
          check('R3 stated: and the LIVE BLEND moves — the card reads the stated rate',
            statedBlend !== null && derivedBlend !== null && Math.abs(statedBlend - derivedBlend) > 1e-6,
            `${derivedBlend} -> ${statedBlend}`);

          // ── TRANSITION: clear → derived returns, styling reverts ──────────
          await setNum4(first(), '');
          check('R3 clear: the box empties back to unset',
            first().value === '', `"${first().value}"`);
          check('R3 clear: the styling reverts to default',
            !/bg-\[#e60000\]\/5/.test(first().className) && /text-slate-400/.test(first().className),
            `class "${first().className}"`);
          check('R3 clear: and the blend returns to the DERIVED figure — derived-today',
            near(blendNow() as number, derivedBlend as number, 1e-9),
            `${blendNow()} vs ${derivedBlend}`);

          // ── STATED ZERO IS NOT UNSET. The decisive presence check. ────────
          await setNum4(first(), '0');
          check('R3 zero: a stated 0 styles as EDITED, not as unset',
            /bg-\[#e60000\]\/5/.test(first().className),
            'truthiness instead of presence would collapse stated-zero into unset');
          const zeroBlend = blendNow();
          check('R3 zero: a stated 0 moves the blend — it is a real rate, not absence',
            zeroBlend !== null && derivedBlend !== null && zeroBlend < derivedBlend,
            `${derivedBlend} -> ${zeroBlend}`);

          // ── NEGATIVE IS VERBATIM. No sign transform anywhere. ─────────────
          await setNum4(first(), '-4.25');
          check('R3 negative: the value is carried VERBATIM, sign intact',
            Number(first().value) === -4.25, `${first().value} — a clamp would read 4.25 or 0`);
          const negBlend = blendNow();
          check('R3 negative: and it pulls the blend BELOW the stated-zero blend',
            negBlend !== null && zeroBlend !== null && negBlend < zeroBlend,
            `${zeroBlend} -> ${negBlend}`);

          // ── SAVE THROUGH THE REAL WRITER ──────────────────────────────────
          //
          // The typed rate must reach the stored event AND its exported row.
          // Driven by clicking the card's own Add control, then passing the
          // captured event through marketEventExportRow — the REAL export
          // writer, not a copy of its shape.
          await setNum4(first(), '12.75');
          const dateInput = c4.querySelector('input[type=month]') as any;
          const volInput = [...c4.querySelectorAll('input[type=number]')]
            .find((i: any) => /volume/i.test(i.closest('div')?.textContent || '')) as any;
          if (dateInput) await setNum4(dateInput, '2026-09');
          if (volInput) await setNum4(volInput, '500');

          // BEFORE the click: adding resets the draft and re-renders the rows,
          // so a name read afterwards is read off the wrong state.
          const bandName = String(bandInputs()[0]?.getAttribute('data-testid') || '')
            .replace('promo-band-arpu-override-', '');
          check('R3 save: the band under test is named', bandName !== '', `"${bandName}"`);

          const addBtn = [...c4.querySelectorAll('button')]
            .find(b => /^Add/i.test(norm(b.textContent || ''))) as any;
          check('R3 save: an Add control is present and enabled', !!addBtn && !addBtn.disabled,
            addBtn ? `disabled=${addBtn.disabled}` : 'no Add control');
          if (addBtn && !addBtn.disabled) {
            await (act as any)(async () => { addBtn.click(); });
            const written = captured.length ? captured[captured.length - 1] : [];
            const evt = written.find((e: any) => e.isPromotion);
            check('R3 save: the click produced a promotion event', !!evt, `${written.length} events`);
            if (evt) {
              check('R3 save: the saved event carries the stated map',
                !!evt.promoBandArpuOverride, JSON.stringify(evt.promoBandArpuOverride));
              check('R3 save: and the map holds the rate that was TYPED',
                evt.promoBandArpuOverride && near(evt.promoBandArpuOverride[bandName], 12.75, 1e-9),
                `${JSON.stringify(evt.promoBandArpuOverride)} for band "${bandName}"`);
              // ONLY the band that was typed — the other members were left
              // unset and absence per band is the carrier.
              check('R3 save: bands left unset are ABSENT from the map, not zero-filled',
                evt.promoBandArpuOverride && Object.keys(evt.promoBandArpuOverride).length === 1,
                `${Object.keys(evt.promoBandArpuOverride || {}).length} keys for ${bandCount} bands`);

              // THE REAL EXPORT WRITER.
              const row = fc.marketEventExportRow(evt);
              check('R3 export: the real writer emits the override column',
                'Promo_Band_ARPU_Override_JSON' in row);
              check('R3 export: carrying the typed rate through JSON',
                near(JSON.parse(String(row.Promo_Band_ARPU_Override_JSON))[bandName], 12.75, 1e-9),
                String(row.Promo_Band_ARPU_Override_JSON));

              // AND BACK. The reader is the shared one the carrier session pinned.
              const back = fc.readStoredEventModifiers(row);
              check('R3 round trip: the shared reader restores the stated rate',
                back.promoBandArpuOverride && near(back.promoBandArpuOverride[bandName], 12.75, 1e-9),
                JSON.stringify(back.promoBandArpuOverride));
            }
          }
        }
      }
    }
    await (act as any)(async () => { root4.unmount(); });

    // STALE-KEY FILTER (Finding E), at the function the write path calls.
    // Unit-level on purpose: the harness has no tariff axis available, so the
    // axis switch that creates a stale key is not drivable through this mount.
    // The expectation is written out by hand rather than computed with the
    // function under test.
    const wi: any = await import('../src/components/WhatIfTab');
    const tiers = [{ tier: 'A', baseArpu: 10 }, { tier: 'B', baseArpu: 20 }];
    const withStale = wi.promoStatedRatesForMembers(tiers, { A: 5, GONE: 99 });
    check('R3 stale keys: a band that is no longer a member is NOT persisted',
      withStale && withStale.A === 5 && withStale.GONE === undefined
        && Object.keys(withStale).length === 1,
      JSON.stringify(withStale));
    check('R3 stale keys: a map of ONLY stale bands is absence, not {}',
      wi.promoStatedRatesForMembers(tiers, { GONE: 99 }) === undefined,
      String(wi.promoStatedRatesForMembers(tiers, { GONE: 99 })));
    check('R3 effective rate: a stated 0 beats the derived figure (presence, not truthiness)',
      wi.promoEffectiveArpuMap(tiers, { A: 0 }).A === 0,
      String(wi.promoEffectiveArpuMap(tiers, { A: 0 }).A));
    check('R3 effective rate: an unset band keeps its derived figure',
      wi.promoEffectiveArpuMap(tiers, { A: 0 }).B === 20);

    // ORPHAN PREDICATE — one definition, exercised directly for the cases the
    // mount cannot reach, with expectations written by hand.
    check('R3 orphan: share for a non-member is orphaned',
      wi.promoOrphanedBands(['A', 'B'], { A: 50, B: 30, GONE: 20 }).join(',') === 'GONE');
    check('R3 orphan: a non-member carrying ZERO share is NOT orphaned',
      wi.promoOrphanedBands(['A', 'B'], { A: 100, GONE: 0 }).length === 0,
      'zero share contributes nothing to the blend, so it blocks nothing');
    check('R3 orphan: current members are never orphaned',
      wi.promoOrphanedBands(['A', 'B'], { A: 50, B: 50 }).length === 0);
  }

  // ── SESSION 2: EDIT-REOPEN, and the orphaned-band drop ────────────────────
  //
  // The reopen transition closes the gap session 1 named: the restore handlers
  // shipped there, but nothing MOUNTED proved a reopened event shows the stated
  // rate. Driven through the card's own edit control, never by seeding state.
  {
    const members2 = cardMembers;
    const evenMix: Record<string, number> = {};
    const even = 100 / members2.length;
    members2.forEach((m, i) => {
      evenMix[m] = i === members2.length - 1 ? 100 - even * (members2.length - 1) : even;
    });

    const STATED = 33.5;
    const savedWithOverride: any = {
      id: 'reopen-with-override', scenario: 'Inflow',
      segment: 'Corporate', product: 'All', productL2: 'All',
      channel: 'All', channelL2: 'All', tariffL1: 'All', tariffL2: 'All',
      date: '2026-09', sequence: 1, subscriberVolume: 500, customerVolume: 0,
      revenue: 5000, arpu: 10, name: '', campaignName: '', comment: '', contractLength: 12,
      isPromotion: true, promoRebanded: false,
      promoMixAxis: 'value', promoMix: evenMix,
      promoBandArpuOverride: { [members2[0]]: STATED },
    };

    const captured2: any[] = [];
    const props5 = {
      ...whatIfProps(),
      marketEvents: [savedWithOverride],
      updateMarketEvent: (id: string, e: any) => { captured2.push({ id, e }); },
    };
    const c5 = document.createElement('div');
    host.appendChild(c5);
    const root5 = createRoot(c5);
    await (act as any)(async () => { root5.render(withProvider(React.createElement(M, props5))); });

    const tab5 = [...c5.querySelectorAll('button')].find(b => norm(b.textContent || '') === 'Promotion') as any;
    check('REOPEN: the Promotion card opens with the saved promotion present', !!tab5);
    if (tab5) {
      await (act as any)(async () => { tab5.click(); });
      const edit5 = [...c5.querySelectorAll('button')]
        .find(b => /edit promotion/i.test(b.getAttribute('title') || '')) as any;
      check('REOPEN: the saved promotion exposes an edit control', !!edit5);
      if (edit5) {
        await (act as any)(async () => { edit5.click(); });

        const bandIn = (band: string) =>
          c5.querySelector(`[data-testid="promo-band-arpu-override-${band}"]`) as any;
        const seeded = bandIn(members2[0]);
        const untouched = members2.length > 1 ? bandIn(members2[1]) : null;

        check('REOPEN: the stated rate is restored into the input',
          !!seeded && Number(seeded.value) === STATED,
          seeded ? `value "${seeded.value}" expected ${STATED}` : 'input not found');
        check('REOPEN: and it is STYLED as edited, not merely populated',
          !!seeded && /bg-\[#e60000\]\/5/.test(seeded.className),
          'a restored override the user cannot distinguish from a default is half a restore');
        if (untouched) {
          check('REOPEN: a band the event did not state stays UNSET',
            untouched.value === '', `"${untouched.value}"`);
          check('REOPEN: and shows the derived figure as its placeholder, unstyled',
            !!untouched.getAttribute('placeholder')
              && !/bg-\[#e60000\]\/5/.test(untouched.className));
        }

        // CLEAR THE RESTORED OVERRIDE → derived-today returns (decision 5).
        const setNum5 = async (el: any, v: string) => {
          await (act as any)(async () => {
            nativeSetter.call(el, v);
            el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
            el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
          });
        };
        if (seeded) {
          const derivedPh = Number(seeded.getAttribute('placeholder'));
          await setNum5(seeded, '');
          check('REOPEN clear: the box returns to unset',
            bandIn(members2[0]).value === '');
          check('REOPEN clear: styling reverts and the derived figure is shown again',
            !/bg-\[#e60000\]\/5/.test(bandIn(members2[0]).className)
              && Number(bandIn(members2[0]).getAttribute('placeholder')) === derivedPh,
            'decision 5: clearing returns to the rate the data derives TODAY');

          // RE-STATE and SAVE — the update must carry the new rate through the
          // real writer, not the restored one.
          await setNum5(bandIn(members2[0]), '41.25');
          const saveBtn = [...c5.querySelectorAll('button')]
            .find(b => /^Save/i.test(norm(b.textContent || ''))) as any;
          check('REOPEN save: a Save control is present and enabled',
            !!saveBtn && !saveBtn.disabled);
          if (saveBtn && !saveBtn.disabled) {
            await (act as any)(async () => { saveBtn.click(); });
            const upd = captured2.length ? captured2[captured2.length - 1].e : null;
            check('REOPEN save: the edit writes back through the real update path', !!upd);
            if (upd) {
              check('REOPEN save: the saved map carries the RE-STATED rate, not the restored one',
                upd.promoBandArpuOverride
                  && near(upd.promoBandArpuOverride[members2[0]], 41.25, 1e-9),
                JSON.stringify(upd.promoBandArpuOverride));
              const row5 = fc.marketEventExportRow(upd);
              check('REOPEN save: and it survives the real export writer',
                near(JSON.parse(String(row5.Promo_Band_ARPU_Override_JSON))[members2[0]], 41.25, 1e-9),
                String(row5.Promo_Band_ARPU_Override_JSON));
            }
          }
        }
      }
    }
    await (act as any)(async () => { root5.unmount(); });

    // ── ORPHANED BAND: restore → named → refused → dropped → saveable ───────
    //
    // The stored mix names a band the current data does not describe. This is
    // the case Finding C identified and the one the refusal could not be lifted
    // from before this session.
    const ORPHAN = '__band_that_left_the_data__';
    const orphanMix: Record<string, number> = {};
    const share = 80 / members2.length;
    members2.forEach(m => { orphanMix[m] = share; });
    orphanMix[ORPHAN] = 20;

    const c6 = document.createElement('div');
    host.appendChild(c6);
    const root6 = createRoot(c6);
    await (act as any)(async () => {
      root6.render(withProvider(React.createElement(M, {
        ...whatIfProps(), marketEvents: [{ ...savedWithOverride, id: 'orphan-case', promoMix: orphanMix,
          promoBandArpuOverride: undefined }],
      })));
    });
    const tab6 = [...c6.querySelectorAll('button')].find(b => norm(b.textContent || '') === 'Promotion') as any;
    if (tab6) {
      await (act as any)(async () => { tab6.click(); });
      const edit6 = [...c6.querySelectorAll('button')]
        .find(b => /edit promotion/i.test(b.getAttribute('title') || '')) as any;
      check('ORPHAN: the promotion with an orphaned band can be reopened', !!edit6);
      if (edit6) {
        await (act as any)(async () => { edit6.click(); });

        const orphanRow = () => c6.querySelector(`[data-testid="promo-orphan-row-${ORPHAN}"]`);
        const refusal = () => c6.querySelector('[data-testid="promo-orphan-refusal"]');
        const dropBtn = () => c6.querySelector(`[data-testid="promo-orphan-drop-${ORPHAN}"]`) as any;

        check('ORPHAN: the orphaned band RENDERS rather than vanishing silently',
          !!orphanRow(), 'a silently dropped band changes a saved mix behind the user');
        check('ORPHAN: the row NAMES the band',
          (orphanRow()?.textContent || '').includes(ORPHAN));
        check('ORPHAN: the row offers NO ARPU input — narrowed decision 3',
          !c6.querySelector(`[data-testid="promo-band-arpu-override-${ORPHAN}"]`),
          'nothing should invite a rate for a population the data lacks');
        check('ORPHAN: the refusal is shown and NAMES the band, not a generic block',
          !!refusal() && (refusal()!.textContent || '').includes(ORPHAN),
          refusal()?.textContent || 'no refusal element');

        const saveable6 = () => [...c6.querySelectorAll('button')]
          .filter(b => /^(Add|Save)/i.test(norm(b.textContent || '')));
        check('ORPHAN: no save control is enabled while the orphan carries share',
          saveable6().length > 0 && !saveable6().some((b: any) => !b.disabled),
          `${saveable6().filter((b: any) => !b.disabled).length}/${saveable6().length} enabled`);

        // THE DROP.
        check('ORPHAN: a drop control is offered', !!dropBtn());
        if (dropBtn()) {
          await (act as any)(async () => { dropBtn().click(); });
          check('ORPHAN drop: the orphaned row is gone', !orphanRow());
          check('ORPHAN drop: and so is the refusal', !refusal());
          const sum6 = [...c6.querySelectorAll('input[type=range]')]
            .reduce((a: number, s: any) => a + Number(s.value), 0);
          check('ORPHAN drop: the remaining shares are rebalanced to the total',
            Math.abs(sum6 - 100) < 1e-3, `${sum6.toFixed(4)}`);
          check('ORPHAN drop: THE REFUSAL IS LIFTED — a save control is now enabled',
            saveable6().some((b: any) => !b.disabled),
            'this is the gap Finding C identified: a refusal with no remedy');
        }
      }
    }
    await (act as any)(async () => { root6.unmount(); });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // R7 — THE CHURN CARD, MOUNTED (commissioned 2026-08-20)
  //
  // Commissioned on data, not principle: three walk rounds produced NINE
  // defects and the pure specs caught NONE. That is not a failure of
  // spec:churn-fold or spec:amount-control — both are exhaustive over the
  // arithmetic and the transitions, and neither can reach handler ROUTING or
  // what a memo was FED. Those are properties of the mounted component.
  //
  // EXTENDED HERE rather than given its own file, per the recovery report's
  // Finding D: the mount, the provider and the card-opening already exist in
  // this harness, and two harnesses for one card drift.
  //
  // WHAT IS DRIVEN AND WHAT IS STUBBED, stated because the distinction is the
  // whole value of a mount:
  //   DRIVEN — the real WhatIfTab, the real churn panel, the real fold, the
  //            real amountControl writer, the real Add handler, and a real
  //            ForecastProvider whose store holds TWO slices with DIFFERENT
  //            numbers so a scope change has something to change TO.
  //   STUBBED — the draft dims are set through `setNewEvent`, which is exactly
  //            how the real dropdowns set them; and `addMarketEvent` (App's
  //            fifth writer) is a SPY, because the assertion that matters is
  //            that a churn add never reaches it.
  // ═════════════════════════════════════════════════════════════════════════
  {
    // ARPU IS CARRIED, AND THE TWO LEAVES DISAGREE ON IT.
    //
    // It used to be absent — the accumulator above sums the three volume
    // metrics and leaves `arpu: 0`, so every forecast in this store had an ARPU
    // of exactly zero. That was invisible while nothing asserted on ARPU, and
    // it made the pricing-scope section's first run VACUOUS: `near(0, 0)` holds
    // whatever the scoping does, so a baseline check would have passed against
    // a card reading the wrong slice. The DISTINCT-ARPU guard below is what
    // caught it, which is the whole argument for asserting that a fixture can
    // tell its own cases apart before asserting anything about them.
    //
    // Same species as the scenarioHelper session's `typeof baseArpu !== 'number'`
    // guard admitting 0 — the one value that makes everything downstream
    // trivially true.
    const mkSeries = (mult: number, arpu: number) => seriesArr.map((r: any) => ({
      ...r, inflow: r.inflow * mult, outflow: r.outflow * mult, retention: r.retention * mult,
      arpu, inflowArpu: arpu, outflowArpu: arpu, retentionArpu: arpu, baseArpu: arpu,
    }));
    const bfFor = (cohort: any, mult: number, seed: number, arpu: number) =>
      fc.calculateBaseForecast(mkSeries(mult, arpu), cohort, seed, 12, 1.0, 1.5, 3, 'Holt Linear');

    // TWO LEAVES, AND THE AGGREGATE DERIVES FROM THEM — the production shape.
    //
    // A stored FITTED forecast under an All-bearing key is IGNORED by
    // resolveFromStore by design (the retired fit-on-aggregate rule), so
    // stashing an aggregate would have resolved to null and this whole section
    // would have tested an absence. Storing LEAVES and supplying a leafMap is
    // both what App does and what makes the two slices genuinely different:
    // the All draft derives from BOTH leaves, the product-scoped draft from ONE.
    // FOUND WHILE WIRING THIS: `C.prod` is 'Product_Category', which does NOT
    // exist in this fixture — the column is 'Product_L1'. The harness has
    // therefore always fed WhatIfTab an EMPTY product tree; the promotion
    // section never depended on it and never noticed. Reported, not repaired:
    // changing C.prod would move the existing checks' inputs.
    const PROD_COL = C.prod;   // corrected at the source above
    const PRODS = [...treeOf(PROD_COL, C.prodL2).keys()]
      .filter(k => k && k !== 'All' && k !== 'undefined');
    const PRODB = PRODS[0] ?? 'All';
    const PRODC = PRODS[1] ?? PRODB;
    check('R7 mount: the fixture yields two distinct products',
      PRODB !== PRODC && PRODB !== 'All', `${PRODB} / ${PRODC}`);

    const leafCohort = (prod: string) => ({
      segment: SEG, product: prod, productL2: 'Standard', channel: 'Direct',
      channelL2: 'Direct Sales', tariffL1: 'T1', tariffL2: 'T2', scenario: 'Base Case',
    });
    const leafKey = (prod: string) =>
      fc.makeForecastKey(SEG, prod, 'Standard', 'Direct', 'Direct Sales', 'T1', 'T2');

    const storeR7 = new Map<string, any>([
      // SEEDS LARGE ENOUGH THAT THE BASE CANNOT COLLAPSE across a three-month
      // ramp. A base that rolls to zero is a legitimate absence the fold names
      // ('prev-base-zero'), but a fixture that hits it would be testing the
      // absence path while claiming to test the ramp.
      // The ARPUs are FAR APART (24 vs 6) so the wide aggregate's blend cannot
      // land near either leaf by accident — the coincidence that wrecked two
      // earlier readings of this same question.
      [leafKey(PRODB), bfFor(leafCohort(PRODB), 1, 10_000_000, 24)],
      [leafKey(PRODC), bfFor(leafCohort(PRODC), 0.25, 2_500_000, 6)],
    ]);

    // THE DRAFT'S KEYS. Unset dims default to 'All', so an unscoped draft asks
    // for the aggregate and a product-scoped one asks for a narrower aggregate.
    const keyA = fc.makeForecastKey(SEG, 'All', 'All', 'All', 'All', 'All', 'All');
    const keyB = fc.makeForecastKey(SEG, PRODB, 'All', 'All', 'All', 'All', 'All');
    const leafMapR7 = new Map<string, string[]>([
      [keyA, [leafKey(PRODB), leafKey(PRODC)]],
      [keyB, [leafKey(PRODB)]],
    ]);
    check('R7 mount: the two fixture slices are DISTINCT keys', keyA !== keyB, `${keyA} / ${keyB}`);

    let draft: any = {};
    let stored: any[] = [];
    let fifthWriterCalls = 0;
    let rerender: (() => void) | null = null;

    const Harness = () => {
      const [ev, setEv] = React.useState<any>({});
      const [evs, setEvs] = React.useState<any[]>([]);
      draft = ev; stored = evs;
      rerender = () => { setEv((d: any) => ({ ...d })); };
      (globalThis as any).__setDraft = setEv;
      (globalThis as any).__setEvents = setEvs;
      return React.createElement(M, {
        ...whatIfProps(),
        newEvent: ev,
        // STABLE, BECAUSE THE APP'S IS STABLE — and this is not cosmetic.
        //
        // This used to be `(e: any) => setEv(e)`, a fresh arrow every render.
        // App passes a raw useState setter, which React guarantees stable, so
        // every `useCallback` in WhatIfTab keyed on `setNewEvent` is built ONCE
        // in the app and was rebuilt EVERY RENDER here. That difference
        // silently disabled memoisation in the harness — and memoisation is
        // exactly the mechanism stale-closure defects live inside.
        //
        // It cost a real one: `handleEditStart`'s deps were `[setNewEvent]`
        // while it READ `marketEvents`, so the ramp-member decline never fired
        // in the app. This harness reported it working for a day, because its
        // own prop was unstable in a way the app's is not.
        //
        // RULE: a mounted harness passes props with the same STABILITY the app
        // passes them, or it is testing a component the app does not render.
        setNewEvent: setEv,
        marketEvents: evs,
        setMarketEvents: setEvs,
        // THE SPY. A churn add must never reach App's fifth writer — it emits
        // ONE event from the amount field and knows none of the churn fields.
        addMarketEvent: () => { fifthWriterCalls++; },
      });
    };

    const hostR7 = document.createElement('div');
    document.getElementById('root')!.appendChild(hostR7);
    const rootR7 = createRoot(hostR7);
    const providerR7 = (child: any) => React.createElement(ForecastProvider as any, {
      baseForecast: fc.resolveFromStore(storeR7, leafMapR7, keyA).forecast, setBaseForecast: noop,
      adjustedForecast: null, setAdjustedForecast: noop,
      forecastStore: storeR7, setForecastStore: noop,
      // THE REAL SEAM over the two-slice store, not a stub: resolveFromStore is
      // what App passes, so the panel resolves exactly as it does in the app.
      resolveForecast: (k: string) => fc.resolveFromStore(storeR7, leafMapR7, k),
      canResolve: (k: string) => leafMapR7.has(k) || storeR7.has(k),
      hasLegacyBaseline: true, updatedAt: new Date().toISOString(),
      bulkRuns: [], setBulkRuns: noop,
    }, child);
    await (act as any)(async () => { rootR7.render(providerR7(React.createElement(Harness))); });

    const q = (sel: string) => hostR7.querySelector(sel) as any;
    const qa = (sel: string) => [...hostR7.querySelectorAll(sel)] as any[];
    const setDraft = async (patch: any) => {
      await (act as any)(async () => { (globalThis as any).__setDraft((d: any) => ({ ...d, ...patch })); });
    };

    // ── (d) THE ARM ONLY EXISTS ON OUTFLOW ────────────────────────────────
    // THE SECOND forecast month: the first has no prior month inside the
    // series, which the fold correctly reports as an absence rather than a rate.
    const MONTHS_A = (fc.resolveFromStore(storeR7, leafMapR7, keyA).forecast?.months ?? []).map((m: any) => m.month);
    const DRAFT_MONTH = MONTHS_A[1] ?? MONTHS_A[0];
    check('R7 mount: the fixture yields a forecast month to draft against',
      !!DRAFT_MONTH, `${MONTHS_A.length} months`);
    await setDraft({ scenario: 'Inflow', date: DRAFT_MONTH, subscriberVolume: 0, segment: SEG });
    check('R7 mount: the churn arm is absent on an Inflow draft',
      !q('[data-testid="volume-mode-churn"]'));

    await setDraft({ scenario: 'Outflow' });
    const churnArm = q('[data-testid="volume-mode-churn"]');
    check('R7 mount: the churn arm appears on an Outflow draft', !!churnArm);
    if (!churnArm) { report(); return; }

    await (act as any)(async () => { churnArm.click(); });
    check('R7 mount (d): selecting churn renders the panel', !!q('[data-testid="churn-panel"]'));

    // ── (c) THE COMPANIONS ARE ABSENT IN CHURN MODE ───────────────────────
    const companionCount = () => hostR7.textContent?.includes('Contract Length') ? 1 : 0;
    check('R7 mount (c): Contract Length is absent from the DOM in churn mode',
      companionCount() === 0, 'the engine reads none of the companions on this path');
    check('R7 mount (c): the volume spread control is absent too',
      !hostR7.textContent?.includes('Spread over'),
      'churn replaces the spread rather than configuring it');

    // ── (a) THE BREAKDOWN FOLLOWS THE DRAFT'S DIMS ────────────────────────
    const breakdown = () => (q('[data-testid="churn-breakdown"]')?.textContent || '').trim();
    const atAll = breakdown();
    check('R7 mount (a): a breakdown renders for the All slice', atAll.length > 0, atAll);

    await setDraft({ product: PRODB });
    const atProd = breakdown();
    check('R7 mount (a): changing the PRODUCT dim CHANGES the breakdown',
      atProd.length > 0 && atProd !== atAll,
      `All: "${atAll}"  ${PRODB}: "${atProd}" — identical text is the reported defect`);

    // ── (b) ADD REACHES THE RAMP EMITTER ──────────────────────────────────
    await setDraft({ product: 'All' });
    const targetInput = q('[data-testid="churn-target"]');
    check('R7 mount: the target input is present', !!targetInput);
    if (targetInput) {
      await (act as any)(async () => {
        const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!;
        setter.call(targetInput, '2');
        targetInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      });
    }

    const addBtn = [...hostR7.querySelectorAll('button')].find(
      (b: any) => /add event/i.test(b.textContent || '')) as any;
    check('R7 mount: the Add button is reachable', !!addBtn);
    if (!addBtn) { report(); return; }

    await (act as any)(async () => { addBtn.click(); });

    check('R7 mount (b): the ramp OFF stores exactly ONE event',
      stored.length === 1, `${stored.length} stored`);
    check('R7 mount (b): App\'s FIFTH WRITER is never reached by a churn add',
      fifthWriterCalls === 0,
      `${fifthWriterCalls} calls — it emits one zero-volume event and drops the churn fields`);

    const row = stored[0] ?? {};
    check('R7 mount (b): the stored volume is NON-ZERO',
      Number(row.subscriberVolume) !== 0, `${row.subscriberVolume}`);
    check('R7 mount (b): and POSITIVE, because a reduction removes outflow',
      Number(row.subscriberVolume) > 0,
      `${row.subscriberVolume} — negative would be an INCREASE in churn`);
    check('R7 mount (b): all four churn fields reached the row',
      row.churnMode === 'churn' && row.churnTargetPct !== undefined
        && row.churnCurrentPct !== undefined && row.churnPrevBase !== undefined,
      JSON.stringify([row.churnMode, row.churnTargetPct, row.churnCurrentPct, row.churnPrevBase]));
    check('R7 mount (b): the row is an ordinary absolute Outflow event',
      row.scenario === 'Outflow' && row.amountType === 'absolute',
      'churn is a way of SAYING; the engine must not learn it exists');

    // ── (b) THE RAMP ON STORES N ──────────────────────────────────────────
    // ADD RESETS THE DRAFT — control back to Subs, churn state cleared — so the
    // panel is gone by now and the ramp must be reached through a FRESH churn
    // selection. That reset is itself worth asserting: a form that kept its
    // last statement would re-add it on the next click.
    check('R7 mount: Add resets the control, so the panel closes',
      !q('[data-testid="churn-panel"]'),
      'a churn statement must not survive its own Add');
    // Add resets the DIMS as well as the control, so the slice must be restated
    // before the ramp run — otherwise the draft asks for All|All, which this
    // fixture's leafMap does not enumerate. The block reason said exactly that,
    // which is the absence machinery working.
    // A CLEAN STORE FOR THE RAMP RUN. The first Add's event is a real churn
    // reduction and the next draft's series correctly INCLUDES it — which is
    // the feature working, and which makes two Adds interfere. Each assertion
    // starts from a known state instead.
    await (act as any)(async () => { (globalThis as any).__setEvents([]); });
    await setDraft({ scenario: 'Outflow', date: DRAFT_MONTH, segment: SEG });
    const churnArm2 = q('[data-testid="volume-mode-churn"]');
    if (churnArm2) await (act as any)(async () => { churnArm2.click(); });

    const rampBox = q('[data-testid="churn-ramp-toggle"]');
    check('R7 mount: the ramp radio is present and OFF by default',
      !!rampBox && rampBox.checked === false);
    if (rampBox) {
      await (act as any)(async () => { rampBox.click(); });
      // THE TOGGLE MUST ACTUALLY TOGGLE. Asserted rather than assumed: a
      // checkbox nested in a <label> can receive the click twice and land back
      // where it started, which would make every ramp assertion below test the
      // single-month path while appearing to test the ramp.
      check('R7 mount: clicking the ramp radio turns it ON',
        q('[data-testid="churn-ramp-toggle"]')?.checked === true,
        `checked=${q('[data-testid="churn-ramp-toggle"]')?.checked}`);
      const monthsInput = q('[data-testid="churn-months"]');
      if (monthsInput) {
        await (act as any)(async () => {
          const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!;
          setter.call(monthsInput, '3');
          monthsInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
        });
      }
      // THE GRID IS THE RAMP'S STATE MADE VISIBLE: one editable cumulative
      // figure per ramp month. If this is 1 the ramp is not really on, whatever
      // the checkbox says.
      check('R7 mount: the ramp grid shows one row per month',
        qa('[data-testid^="churn-stated-"]').length === 3,
        `${qa('[data-testid^="churn-stated-"]').length} rows, stated=` +
        qa('[data-testid^="churn-stated-"]').map((e: any) => e.value).join(','));
      const before = stored.length;
      const addBtn2 = [...hostR7.querySelectorAll('button')].find(
        (b: any) => /add event/i.test(b.textContent || '')) as any;
      if (addBtn2) await (act as any)(async () => { addBtn2.click(); });
      check('R7 mount (b): the ramp ON stores THREE events, not one',
        stored.length - before === 3,
        `${stored.length - before} added; derived column read ` +
        JSON.stringify(qa('[data-testid^="churn-derived-"]').map((e: any) => e.textContent.trim())));
      const added = stored.slice(before);
      check('R7 mount (b): the ramp rows share ONE campaign name',
        new Set(added.map((e: any) => e.campaignName)).size === 1);
      check('R7 mount (b): and carry THREE DISTINCT months',
        new Set(added.map((e: any) => e.date)).size === 3,
        added.map((e: any) => e.date).join(','));
      check('R7 mount (b): every ramp row stores a non-zero positive delta',
        added.every((e: any) => Number(e.subscriberVolume) > 0),
        added.map((e: any) => e.subscriberVolume).join(','));
    }

    // ── (d) LEAVING OUTFLOW UNMOUNTS THE PANEL ────────────────────────────
    await setDraft({ scenario: 'Inflow' });
    check('R7 mount (d): flipping to Inflow removes the churn panel',
      !q('[data-testid="churn-panel"]'));
    check('R7 mount (d): and the companions come back',
      hostR7.textContent?.includes('Contract Length') === true,
      'the hide is keyed on the derived control, so it must reverse');

    // ═══════════════════════════════════════════════════════════════════════
    // R7 SESSION 2 — THE EDIT PATH
    //
    // The diagnosis found a CORRUPTION route here, not merely an omission:
    // handleEditStart displayed abs(subscriberVolume) and handleSaveEdit
    // re-applied neg, so a churn REDUCTION reopened and saved came back as an
    // INCREASE. That route is closed structurally — the churn branch sits above
    // the neg — and this is where that is observed rather than argued.
    // ═══════════════════════════════════════════════════════════════════════
    {
      // A CLEAN, SINGLE churn event to reopen.
      await (act as any)(async () => { (globalThis as any).__setEvents([]); });
      await setDraft({ scenario: 'Outflow', date: DRAFT_MONTH, segment: SEG, product: 'All' });
      const arm = q('[data-testid="volume-mode-churn"]');
      if (arm) await (act as any)(async () => { arm.click(); });
      const tgt = q('[data-testid="churn-target"]');
      const setNum = async (el: any, v: string) => {
        await (act as any)(async () => {
          const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!;
          setter.call(el, v);
          el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
        });
      };
      // TARGETS BELOW THE SLICE'S ACTUAL RATE. The fixture's annualised churn
      // here is ~1.73%, so a 2pt or 3pt reduction FLOORS the target at zero and
      // the delta saturates at the whole outflow — correct behaviour (specced
      // in churn-fold), and useless for a check that two statements must give
      // two different deltas. 0.5 -> 1.0 keeps both inside the rate.
      if (tgt) await setNum(tgt, '0.5');
      const add = [...hostR7.querySelectorAll('button')].find((b: any) => /add event/i.test(b.textContent || '')) as any;
      if (add) await (act as any)(async () => { add.click(); });

      check('R7 edit: one churn event exists to reopen', stored.length === 1, `${stored.length}`);
      const original = stored[0];
      check('R7 edit: and it stored a POSITIVE delta before any edit',
        Number(original?.subscriberVolume) > 0, `${original?.subscriberVolume}`);

      // ── (a) REOPEN SEEDS THE PANEL ─────────────────────────────────────
      // BY TESTID, NOT BY TITLE. Both pencils' titles match /edit/i, and once
      // churn campaigns became group-editable the CAMPAIGN pencil started
      // sorting first — so a title-matched selector silently switched which
      // affordance this section was driving. The failure looked like a missing
      // Save Changes button; it was the campaign route answering instead.
      const editBtns = () => [...hostR7.querySelectorAll('[data-testid="edit-event"]')] as any[];
      const openRow = async () => {
        const b = editBtns()[0];
        if (b) await (act as any)(async () => { b.click(); });
        return !!b;
      };
      const opened = await openRow();
      check('R7 edit (a): the row exposes an edit control', opened);
      check('R7 edit (a): reopening SEEDS the churn panel',
        !!q('[data-testid="churn-panel"]'),
        'a churn row reopened as a bare volume is the corruption route\'s first step');
      check('R7 edit (a): the stored target is shown, not a default',
        Number(q('[data-testid="churn-target"]')?.value) === 0.5,
        `${q('[data-testid="churn-target"]')?.value}`);
      check('R7 edit (a): the breakdown renders against the current series',
        (q('[data-testid="churn-breakdown"]')?.textContent || '').length > 0);
      check('R7 edit (a): the ramp is OFF — a row reaching row-edit is single',
        q('[data-testid="churn-ramp-toggle"]')?.checked === false);

      // ── (b) SAVE CHANGES RE-STATES, AND THE SIGN SURVIVES ──────────────
      const tgt2 = q('[data-testid="churn-target"]');
      if (tgt2) await setNum(tgt2, '1');
      const saveBtn = [...hostR7.querySelectorAll('button')]
        .find((b: any) => /save changes/i.test(b.textContent || '')) as any;
      check('R7 edit (b): a Save Changes control is present', !!saveBtn);
      if (saveBtn) await (act as any)(async () => { saveBtn.click(); });
      // THE EDIT COMMITS THROUGH A CONFIRM MODAL whose button reads exactly
      // 'Save' for an edit — distinct from the form's 'Save Changes'. Matched
      // exactly, because both the form and the modal also carry a 'Cancel'.
      const confirmBtn = [...hostR7.querySelectorAll('button')]
        .find((b: any) => (b.textContent || '').trim() === 'Save') as any;
      check('R7 edit (b): the change routes through the confirm modal', !!confirmBtn);
      if (confirmBtn) await (act as any)(async () => { confirmBtn.click(); });

      const after = stored[0];
      check('R7 edit (b): still exactly one event after the edit',
        stored.length === 1, `${stored.length}`);
      check('R7 edit (b): THE SIGN SURVIVES — the delta is still POSITIVE',
        Number(after?.subscriberVolume) > 0,
        `${after?.subscriberVolume} — negative is the inversion the diagnosis found`);
      check('R7 edit (b): the stated target moved to the edited value',
        Number(after?.churnTargetPct) === 1, `${after?.churnTargetPct}`);
      check('R7 edit (b): the delta moved WITH it, not stale',
        Number(after?.subscriberVolume) !== Number(original?.subscriberVolume),
        `vol ${original?.subscriberVolume} -> ${after?.subscriberVolume}; ` +
        `target ${original?.churnTargetPct} -> ${after?.churnTargetPct}; ` +
        `prevBase ${original?.churnPrevBase} -> ${after?.churnPrevBase}`);
      check('R7 edit (b): and it moved by the RATIO the statement changed by',
        near(Number(after?.subscriberVolume) / Number(original?.subscriberVolume), 2, 1e-3),
        `${Number(after?.subscriberVolume) / Number(original?.subscriberVolume)} — 0.5pt to 1pt on the same base is exactly double`);
      check('R7 edit (b): current and prevBase re-snapshot together',
        after?.churnCurrentPct !== undefined && after?.churnPrevBase !== undefined,
        JSON.stringify([after?.churnCurrentPct, after?.churnPrevBase]));
      check('R7 edit (b): the row is still an ordinary absolute Outflow event',
        after?.scenario === 'Outflow' && after?.amountType === 'absolute'
          && after?.churnMode === 'churn');

      // ── (c) A RAMP MEMBER DECLINES ROW-EDIT ────────────────────────────
      // A COMMITTED SAVE CLOSES THE EDIT, so the Add control is back. Asserted,
      // because if it were not the ramp below could not be added at all and the
      // failure would read as a churn defect rather than a stuck form.
      check('R7 edit (b): a committed save returns the form to Add mode',
        !!([...hostR7.querySelectorAll('button')].find((b: any) => /add event/i.test(b.textContent || ''))),
        'the edit stayed open, so nothing below could add');
      await (act as any)(async () => { (globalThis as any).__setEvents([]); });
      await setDraft({ scenario: 'Outflow', date: DRAFT_MONTH, segment: SEG, product: 'All' });
      const arm2 = q('[data-testid="volume-mode-churn"]');
      if (arm2) await (act as any)(async () => { arm2.click(); });
      const ramp2 = q('[data-testid="churn-ramp-toggle"]');
      if (ramp2) await (act as any)(async () => { ramp2.click(); });
      const add2 = [...hostR7.querySelectorAll('button')].find((b: any) => /add event/i.test(b.textContent || '')) as any;
      if (add2) await (act as any)(async () => { add2.click(); });
      check('R7 edit (c): a three-month ramp exists', stored.length === 3, `${stored.length}`);

      await openRow();
      check('R7 edit (c): a ramp MEMBER declines row-edit',
        !!q('[data-testid="edit-decline-reason"]'),
        'a cumulative target edited alone desyncs the member from its siblings');
      check('R7 edit (c): and the panel does NOT open for it',
        !q('[data-testid="churn-panel"]'));
      check('R7 edit (c): the refusal is a stated REASON, not a dead click',
        (q('[data-testid="edit-decline-reason"]')?.textContent || '').length > 20);

      // ── (d) A PLAIN VOLUME EVENT STILL EDITS — the regression guard ─────
      await (act as any)(async () => {
        (globalThis as any).__setEvents([{
          id: 'plain-1', scenario: 'Inflow', segment: SEG, product: 'All', productL2: 'All',
          channel: 'All', channelL2: 'All', tariffL1: 'All', tariffL2: 'All',
          date: DRAFT_MONTH, subscriberVolume: 500, customerVolume: 0, revenue: 0, arpu: 0,
          name: 'plain', campaignName: '', comment: '', contractLength: 24, sequence: 1,
          amountType: 'absolute', percentageBasis: 'baseline', retentionLinked: true,
        }]);
      });
      await openRow();
      check('R7 edit (d): a PLAIN volume event still opens for edit',
        !q('[data-testid="edit-decline-reason"]'),
        'the churn bar must not catch ordinary rows');
      check('R7 edit (d): and does NOT open the churn panel',
        !q('[data-testid="churn-panel"]'));

      // ── (e) ADD IS DISABLED WHEN THE DRAFT HAS NO BASELINE ──────────────
      //
      // WALKED DEFECT, 2026-08-21. The churn panel showed the seam's reason
      // and the Add button stayed ENABLED; the handler's `if (churnBlockReason)
      // return` swallowed the click. A live button that discards a click reads
      // as a bug however clearly the form explains itself elsewhere — the
      // design principle this codebase applies to outputs, pointed at a
      // control.
      //
      // THE SLICE IS DELIBERATELY UNRESOLVABLE: PRODC exists in the store as a
      // LEAF, but no leafMap entry enumerates the product-scoped aggregate
      // above it, so resolveForecast returns null WITH a reason — the same
      // shape a never-enumerated slice has in the app.
      // LEAVE EDIT MODE FIRST. Sections (c) and (d) opened rows, and the Add
      // button does not render while a row is being edited — the card shows
      // Save Changes / Cancel instead. Asserting on Add without closing the
      // edit would have looked like a missing button and been a missing step.
      const cancelBtn = [...qa('button')]
        .find((b: any) => (b.textContent || '').trim() === 'Cancel');
      if (cancelBtn) await (act as any)(async () => {
        cancelBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      });
      await (act as any)(async () => { (globalThis as any).__setEvents([]); });
      await setDraft({ scenario: 'Outflow', date: DRAFT_MONTH, segment: SEG,
        product: PRODC, subscriberVolume: 0 });
      const armE = q('[data-testid="volume-mode-churn"]');
      if (armE) await (act as any)(async () => {
        armE.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      });

      const addBtnE = [...qa('button')]
        .find((b: any) => (b.textContent || '').trim().startsWith('Add Event'));
      const blockMsg = q('[data-testid="churn-add-block-reason"]');

      check('R7 walk (e): the unresolvable slice produces a stated reason',
        !!blockMsg && (blockMsg.textContent || '').length > 20,
        `"${blockMsg?.textContent ?? '(absent)'}"`);
      check('R7 walk (e): the Add button EXISTS and is DISABLED',
        !!addBtnE && addBtnE.disabled === true,
        addBtnE ? `disabled=${addBtnE.disabled}` : '(button not found)');

      // THE REASON BESIDE THE BUTTON IS THE SAME SENTENCE THE PANEL SHOWS.
      // Two different sentences for one state is how a user learns to distrust
      // both of them.
      const panelMsg = q('[data-testid="churn-block-reason"]');
      check('R7 walk (e): the button-side reason matches the panel-side reason',
        !!panelMsg && !!blockMsg
          && (panelMsg.textContent || '').trim() === (blockMsg.textContent || '').trim(),
        `panel "${panelMsg?.textContent}" vs button "${blockMsg?.textContent}"`);

      // A CLICK ON THE DISABLED CONTROL CHANGES NOTHING — counted, not assumed.
      // The spy is App's fifth writer; `stored` is the local event list. Both
      // are read, because "nothing happened" has two places to fail.
      const writerBefore = fifthWriterCalls, storedBefore = stored.length;
      if (addBtnE) await (act as any)(async () => {
        addBtnE.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      });
      check('R7 walk (e): clicking the disabled Add reaches no writer',
        fifthWriterCalls === writerBefore,
        `${writerBefore} -> ${fifthWriterCalls}`);
      check('R7 walk (e): and adds no event row',
        stored.length === storedBefore,
        `${storedBefore} -> ${stored.length}`);

      // ── (f) THE TOOLTIP NAMES THE CAMPAIGN, NOT THE METRIC ──────────────
      //
      // WALKED DEFECT, 2026-08-21. A campaign's member rows carry
      // `campaignName` and an EMPTY `name`, so the tooltip fell through to
      // `e.scenario` and every month of a three-month ramp read "Outflow".
      //
      // THE NEGATIVE HALF IS THE LOAD-BEARING ONE: asserting the campaign name
      // appears would pass while "Outflow" ALSO appeared beside it, which is
      // the state being fixed.
      const CAMPAIGN = 'Q3 Retention Push';
      await (act as any)(async () => {
        (globalThis as any).__setEvents([{
          id: 'tip-1', scenario: 'Outflow', segment: SEG, product: 'All', productL2: 'All',
          channel: 'All', channelL2: 'All', tariffL1: 'All', tariffL2: 'All',
          date: DRAFT_MONTH, subscriberVolume: 120, customerVolume: 0, revenue: 0, arpu: 0,
          name: '', campaignName: CAMPAIGN, comment: '', contractLength: 24, sequence: 1,
          amountType: 'absolute', percentageBasis: 'baseline', retentionLinked: true,
          churnMode: 'churn',
        }]);
      });

      // The tooltip is a render function on the chart, not mounted markup, so
      // it is checked at SOURCE — stated plainly rather than implied, per the
      // standing rule about what is and is not machine-checked.
      const tabSrc = (await import('node:fs')).readFileSync('src/components/WhatIfTab.tsx', 'utf8');
      check('R7 walk (f): the tooltip prefers campaignName over the kind label',
        tabSrc.includes('{e.name || e.campaignName || e.scenario}'),
        'a member row with an empty name fell through to e.scenario and read "Outflow"');
      check('R7 walk (f): and the bare kind-label fallback is GONE',
        !tabSrc.includes('{e.name || e.scenario}'),
        'the old expression surviving anywhere would leave the defect on that surface');

      // ══ CHART GRID — THE TWO-ROW CONTROL (Jon, 2026-09-01) ═══════════════
      //
      // Driven on the real card. The arithmetic is spec:scenario-arpu's job;
      // what only a mount can answer is whether the CONTROL behaves — whether
      // the scenario row multi-selects, whether the measure row single-selects,
      // whether the last scenario can be turned off, and whether a measure
      // switch re-keys the lines rather than leaving them on stale columns.
      {
        const measureRow = q('[data-testid="grid-measure-row"]');
        const scenarioRow = q('[data-testid="grid-scenario-row"]');
        check('grid: the measure row renders', !!measureRow);
        check('grid: the scenario row renders', !!scenarioRow);

        const mBtn = (mz: string) => q(`[data-testid="measure-${mz}"]`);
        check('grid: all three measures are offered',
          !!mBtn('volume') && !!mBtn('revenue') && !!mBtn('arpu'));
        // The ROW testids are `grid-*` precisely so this prefix selector cannot
        // also match the container — it did on the first run, and a selector
        // that quietly matches one more element than intended is how a count
        // check stops meaning what it says.
        check('grid: exactly FOUR scenarios are offered — the blend is NOT a fifth',
          [...qa('[data-testid^="scenario-"]')].length === 4,
          `${[...qa('[data-testid^="scenario-"]')].map((e: any) => e.getAttribute('data-testid')).join(',')}`);

        // SINGLE-SELECT: pressing one measure un-presses the others.
        const pressed = () => (['volume', 'revenue', 'arpu'] as const)
          .filter(mz => mBtn(mz)?.getAttribute('aria-pressed') === 'true');
        check('grid: exactly one measure is pressed at rest', pressed().length === 1, pressed().join(','));
        check('grid: volume is the default measure', pressed()[0] === 'volume', pressed().join(','));
        await (act as any)(async () => {
          mBtn('revenue').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
        });
        check('grid: choosing Revenue selects it', pressed()[0] === 'revenue', pressed().join(','));
        check('grid: and it is STILL exactly one — single-select, not additive',
          pressed().length === 1, pressed().join(','));

        // RE-KEY: the rendered chart must be reading the Revenue columns now.
        // Read from the DOM rather than from state, so a control that moves a
        // flag without moving the chart cannot pass.
        const lineKeys = () => [...qa('.recharts-line')]
          .map((el: any) => el.getAttribute('name') || '')
          .filter(Boolean);
        await (act as any)(async () => {
          mBtn('arpu').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
        });
        check('grid: switching to ARPU leaves exactly one measure pressed',
          pressed().length === 1 && pressed()[0] === 'arpu', pressed().join(','));
        await (act as any)(async () => {
          mBtn('volume').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
        });
        check('grid: and switching back to Volume restores it',
          pressed()[0] === 'volume', pressed().join(','));
        void lineKeys;

        // AT LEAST ONE SCENARIO STAYS ON. Turn them all off and the last refuses.
        const scenBox = (sn: string) =>
          q(`[data-testid="scenario-${sn}"]`)?.querySelector('input[type="checkbox"]');
        const onCount = () => (['Inflow', 'Outflow', 'Retention', 'Base'] as const)
          .filter(sn => scenBox(sn)?.checked).length;
        const before = onCount();
        check('grid: at least one scenario is on to begin with', before >= 1, `${before}`);
        for (const sn of ['Inflow', 'Outflow', 'Retention', 'Base'] as const) {
          const box = scenBox(sn);
          if (box && box.checked) {
            await (act as any)(async () => {
              box.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
            });
          }
        }
        check('grid: the LAST scenario cannot be turned off — never an empty chart',
          onCount() === 1, `${onCount()} still selected`);

        // THE BASE CAPTION states the lag for the new measures too.
        const captions = [...qa('span')].map((e: any) => (e.textContent || '').trim());
        check('grid: the Base caption names the T+1 lag for Revenue and ARPU',
          captions.some((c: string) => /Base Revenue and Base ARPU carry the same one-month lag/.test(c)),
          'the flow measures do not carry it, and the caption must say so');
      }

      // ══ W6a — THE SELECTION SURVIVES EVERY RECOMPUTE ═════════════════════
      //
      // Walked 2026-09-01: with a scenario selected, adding a pricing event
      // left the chart with nothing plotted. The click-path spec above could
      // never have caught it — the empty was reached through a per-tab DEFAULT
      // that named the retired blend, not through a click.
      //
      // THE DIRECT REPRODUCTION IS THE TAB SWITCH. Adding a pricing event takes
      // you to the Pricing tab, whose default selection was ['ARPU']; with ARPU
      // no longer a scenario, that filtered to nothing.
      {
        const pressedScenarios = () =>
          (['Inflow', 'Outflow', 'Retention', 'Base'] as const)
            .filter(sn => (q(`[data-testid="scenario-${sn}"]`)
              ?.querySelector('input[type="checkbox"]') as any)?.checked);
        const chartDrawn = () => !!q('.recharts-wrapper') || [...qa('svg')].length > 0;
        // BY TESTID, NOT BY LABEL. The measure row's "Volume" button has the
        // same text as the Volume TAB, so a text selector drives whichever
        // comes first in the DOM — it drove the measure, left the card on the
        // Pricing tab, and the churn section three blocks later crashed on an
        // empty event list. The collision is real in the product, so the fix
        // is a testid on the tabs rather than a cleverer selector here.
        const goTab = async (tab: string) => {
          const b = q(`[data-testid="whatif-tab-${tab}"]`);
          if (b) await (act as any)(async () => {
            b.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
          });
        };

        // EVERY TAB DEFAULT NAMES AT LEAST ONE SCENARIO — checked at SOURCE.
        //
        // This is the half of the fix that is load-bearing. W6a was a default
        // naming ['ARPU'] after ARPU stopped being a scenario, and the runtime
        // check below cannot see that any more: the derivation's fallback
        // rescues it, so a bad default is invisible at runtime by design. The
        // source check is what keeps the defaults honest, and trap 120 plants
        // exactly the historical defect against it.
        const tabSrcW = (await import('node:fs'))
          .readFileSync('src/components/WhatIfTab.tsx', 'utf8');
        const defaultsBlock = tabSrcW.slice(
          tabSrcW.indexOf('const TAB_DEFAULT_KPIS'),
          tabSrcW.indexOf('const TAB_DEFAULT_MEASURE'));
        check('W6a: the defaults block was found', defaultsBlock.length > 40);
        for (const tab of ['volume', 'promotion', 'value', 'pricing']) {
          const line = defaultsBlock.split('\n').find(l => l.trim().startsWith(tab + ':')) ?? '';
          check(`W6a: the ${tab} default names at least one SCENARIO`,
            /'(Inflow|Outflow|Retention|Base)'/.test(line), line.trim() || '(not found)');
          check(`W6a: and the ${tab} default names no retired value`,
            !/'ARPU'/.test(line), line.trim());
        }

        // EVERY TAB derives a non-empty scenario set. This is W6a itself.
        for (const tab of ['Volume', 'Value', 'Pricing', 'Promotion']) {
          await goTab(tab.toLowerCase());
          check(`W6a: the ${tab} tab derives a NON-EMPTY scenario selection`,
            pressedScenarios().length > 0,
            `${pressedScenarios().length} selected on ${tab}`);
          check(`W6a: and the ${tab} tab draws a chart rather than a blank`,
            chartDrawn(), tab);
        }
        await goTab('volume');

        // SELECT INFLOW ONLY, then put the card through every recompute.
        //
        // Inflow is turned ON FIRST. The preceding block left a single scenario
        // selected and it is not necessarily this one; turning the others off
        // without turning Inflow on would hit the last-one-stays rule and leave
        // whichever the previous block happened to end on. Asserted below, so a
        // wrong starting state fails loudly rather than shifting what the rest
        // of this block is testing.
        const scenBox2 = (sn: string) =>
          q(`[data-testid="scenario-${sn}"]`)?.querySelector('input[type="checkbox"]');
        const inBox = scenBox2('Inflow');
        if (inBox && !inBox.checked) await (act as any)(async () => {
          inBox.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
        });
        for (const sn of ['Outflow', 'Retention', 'Base'] as const) {
          const box = scenBox2(sn);
          if (box && box.checked) await (act as any)(async () => {
            box.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
          });
        }
        check('W6a: Inflow alone is selected to begin with',
          pressedScenarios().length === 1 && pressedScenarios()[0] === 'Inflow',
          pressedScenarios().join(','));
        const prior = pressedScenarios().slice();

        const stillInflow = (what: string) => {
          check(`W6a: the selection survives ${what}`,
            pressedScenarios().length === prior.length
              && pressedScenarios().every((x, i) => x === prior[i]),
            `${pressedScenarios().join(',') || '(EMPTY)'}`);
          check(`W6a: and it is never zero after ${what}`,
            pressedScenarios().length > 0, `${pressedScenarios().length}`);
        };

        // (1) A MARKET ADD through the real button.
        await setDraft({ scenario: 'Inflow', date: DRAFT_MONTH, segment: SEG,
          product: 'All', subscriberVolume: 250 });
        const addBtnW = [...qa('button')].find((b: any) => /add event/i.test(b.textContent || '')) as any;
        if (addBtnW) await (act as any)(async () => {
          addBtnW.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
        });
        stillInflow('a market add');

        // (2) A REMOVE — the event list emptying is its own recompute.
        await (act as any)(async () => { (globalThis as any).__setEvents([]); });
        stillInflow('an event remove');

        // (3) A MEASURE SWITCH.
        await (act as any)(async () => {
          q('[data-testid="measure-revenue"]')
            .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
        });
        stillInflow('a measure switch');
        await (act as any)(async () => {
          q('[data-testid="measure-volume"]')
            .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
        });

        // (4) A TAB ROUND TRIP — leave to Pricing and come back. This is the
        // walked sequence: the selection must be waiting where it was left.
        await goTab('pricing');
        check('W6a: the Pricing tab is non-empty on arrival',
          pressedScenarios().length > 0, `${pressedScenarios().length}`);
        await goTab('volume');
        stillInflow('a tab round trip');
      }


      // ══ D5-REVISED: CHURN CAMPAIGNS GROUP-EDIT ═══════════════════════════
      //
      // Built as a 20-point target over three months so the stored trajectory
      // is 6.67 / 13.33 / 20 — figures chosen because they are NOT round, so a
      // seeding that silently re-derived a linear ramp from the target alone
      // would still land on them, while one that read the wrong field would
      // not. The FIELDS are asserted, never the derived deltas.
      await (act as any)(async () => { (globalThis as any).__setEvents([]); });
      await setDraft({ scenario: 'Outflow', date: DRAFT_MONTH, segment: SEG, product: 'All' });
      const armG = q('[data-testid="volume-mode-churn"]');
      if (armG) await (act as any)(async () => { armG.click(); });
      const rampG = q('[data-testid="churn-ramp-toggle"]');
      if (rampG) await (act as any)(async () => { rampG.click(); });
      const tgtG = q('[data-testid="churn-target"]');
      if (tgtG) await setNum(tgtG, '20');
      const addG = [...qa('button')].find((b: any) => /add event/i.test(b.textContent || '')) as any;
      if (addG) await (act as any)(async () => { addG.click(); });

      check('R7 group: a three-month churn campaign exists', stored.length === 3, `${stored.length}`);
      const beforeRows = stored.map((e: any) => ({ ...e }));
      const CAMP = beforeRows[0]?.campaignName;
      check('R7 group: its rows share one campaignName',
        !!CAMP && beforeRows.every((e: any) => e.campaignName === CAMP), `${CAMP}`);
      // THE STORED STATEMENT, hand-written. 20 over three months, cumulative.
      check('R7 group: the stored trajectory is the CUMULATIVE statement',
        beforeRows.length === 3
          && near(beforeRows[0].churnTargetPct, 20 / 3, 1e-6)
          && near(beforeRows[1].churnTargetPct, 40 / 3, 1e-6)
          && near(beforeRows[2].churnTargetPct, 20, 1e-6),
        beforeRows.map((e: any) => e.churnTargetPct).join(' / '));
      // D4 STANDS: storage is signed verbatim, POSITIVE for a reduction.
      check('R7 group: every stored delta is POSITIVE — D4 signed verbatim',
        beforeRows.every((e: any) => Number(e.subscriberVolume) > 0),
        beforeRows.map((e: any) => e.subscriberVolume).join(' / '));

      // ── (g) THE MEMBER PENCIL DECLINES, and says the same sentence ──────
      await openRow();
      const declineEl = q('[data-testid="edit-decline-reason"]');
      check('R7 group (g): a ramp MEMBER still declines row-edit', !!declineEl);
      check('R7 group (g): and the panel does NOT open for it',
        !q('[data-testid="churn-panel"]'));
      // ONE SENTENCE, ONE SOURCE. Compared against the i18n value rather than
      // against a second rendered copy, because under D5-revised the campaign
      // chip carries NO decline reason any more — churn campaigns are editable,
      // so there is no chip sentence left to compare with. Asserting equality
      // against an element that no longer exists would be a vacuous check.
      check('R7 group (g): the decline is the shared sentence, verbatim',
        (declineEl?.textContent || '').trim() === EN_MEMBER_NO_EDIT,
        `"${declineEl?.textContent}"`);
      check('R7 group (g): and it points at the CAMPAIGN route',
        /campaign/i.test(declineEl?.textContent || ''),
        'the reason must name a door that exists');

      // ── (h) THE GROUP AFFORDANCE RENDERS, AND SEEDS THE STATEMENT ───────
      const campBtn = q('[data-testid="edit-campaign"]');
      check('R7 group (h): the campaign group-edit affordance RENDERS for churn',
        !!campBtn, 'D5-revised — the anyChurn bar at :512 is gone');
      if (campBtn) await (act as any)(async () => { campBtn.click(); });

      check('R7 group (h): reopening opens the CHURN panel, not a volume spread',
        !!q('[data-testid="churn-panel"]'));
      check('R7 group (h): the ramp is ON and the month count is seeded',
        q('[data-testid="churn-ramp-toggle"]')?.checked === true
          && Number(q('[data-testid="churn-months"]')?.value) === 3,
        `ramp=${q('[data-testid="churn-ramp-toggle"]')?.checked} months=${q('[data-testid="churn-months"]')?.value}`);
      check('R7 group (h): the headline target seeds to the FINAL cumulative figure',
        Number(q('[data-testid="churn-target"]')?.value) === 20,
        `${q('[data-testid="churn-target"]')?.value}`);
      // THE TRAJECTORY, from the stored fields — and ROUNDED for display, which
      // is the copy fix: the raw 6.666666666666667 is a float artefact shown as
      // a figure the user typed.
      check('R7 group (h): the trajectory seeds 6.67 / 13.33 / 20 from storage',
        Number(q('[data-testid="churn-stated-0"]')?.value) === 6.67
          && Number(q('[data-testid="churn-stated-1"]')?.value) === 13.33
          && Number(q('[data-testid="churn-stated-2"]')?.value) === 20,
        [0, 1, 2].map(i => q(`[data-testid="churn-stated-${i}"]`)?.value).join(' / '));

      // ── (i) SAVE RE-STATES WITH ALL MEMBERS EXCLUDED, ATOMICALLY ────────
      //
      // THE ROUND-TRIP IDENTITY IS THE EXCLUSION TEST. Reopening and saving an
      // UNCHANGED statement must reproduce the stored figures exactly: the fold
      // re-runs against a series with every member removed, which is the same
      // series the campaign was first stated against. If even one member were
      // left in, its reduction would read as the current rate and churnCurrentPct
      // would come back LOWER. Literal equality, never near(x, 0).
      const saveG = [...qa('button')].find((b: any) => /save campaign/i.test(b.textContent || '')) as any;
      check('R7 group (i): a Save Campaign control is present', !!saveG);
      if (saveG) await (act as any)(async () => { saveG.click(); });
      const confirmG = [...qa('button')].find((b: any) => (b.textContent || '').trim() === 'Save') as any;
      if (confirmG) await (act as any)(async () => { confirmG.click(); });

      const afterRows = stored.map((e: any) => ({ ...e }))
        .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));
      check('R7 group (i): ATOMIC — exactly three rows, never old and new together',
        stored.length === 3, `${stored.length}`);
      check('R7 group (i): no member row survived the replacement',
        afterRows.every((e: any) => !beforeRows.some((o: any) => o.id === e.id)),
        'a surviving old id means the replacement was partial');
      check('R7 group (i): every row is still one campaign, still churn',
        afterRows.every((e: any) => e.campaignName === CAMP && e.churnMode === 'churn'));

      check('R7 group (i): the members were EXCLUDED — currentPct is unmoved',
        afterRows.length === 3 && beforeRows.every((o: any, i: number) =>
          near(Number(afterRows[i].churnCurrentPct), Number(o.churnCurrentPct), 1e-9)),
        beforeRows.map((o: any, i: number) => `${o.churnCurrentPct} -> ${afterRows[i]?.churnCurrentPct}`).join('  |  '));
      check('R7 group (i): and prevBase is unmoved, month for month',
        afterRows.length === 3 && beforeRows.every((o: any, i: number) =>
          near(Number(afterRows[i].churnPrevBase), Number(o.churnPrevBase), 1e-9)),
        beforeRows.map((o: any, i: number) => `${o.churnPrevBase} -> ${afterRows[i]?.churnPrevBase}`).join('  |  '));
      check('R7 group (i): so the deltas reproduce exactly, and stay POSITIVE',
        afterRows.length === 3 && beforeRows.every((o: any, i: number) =>
          near(Number(afterRows[i].subscriberVolume), Number(o.subscriberVolume), 1e-9))
          && afterRows.every((e: any) => Number(e.subscriberVolume) > 0),
        beforeRows.map((o: any, i: number) => `${o.subscriberVolume} -> ${afterRows[i]?.subscriberVolume}`).join('  |  '));

      // ── (j) THE DELTA DISPLAY SHOWS DIRECTION OF EFFECT ─────────────────
      //
      // Storage stays positive (asserted above, D4). The Δ column negates at
      // ONE named site, so a stored +449.16-family figure renders with a minus.
      // The literal is derived from the row itself rather than typed, because
      // the delta depends on the fixture's rate — but the SIGN and the
      // MAGNITUDE-MATCH are the claim, and both are exact.
      const storedDelta = Number(afterRows[0].subscriberVolume);
      const deltaCells = [...qa('td')].map((td: any) => (td.textContent || '').trim());
      // MATCHED ON THE CLAIM, NOT ON THE FORMATTING. The first version looked
      // for a thousands-separated integer and failed against a cell reading
      // "-18044.52" — the harness's formatNumber is toFixed(2). Pinning the
      // rendered STRING would tie this spec to one number format; what the
      // decision says is that the SIGN flips and the MAGNITUDE does not.
      const signedCells = deltaCells
        .filter((c: string) => /^[-−+][0-9.,]+$/.test(c))
        .map((c: string) => ({
          neg: /^[-−]/.test(c),
          mag: Math.abs(Number(c.replace(/−/g, '-').replace(/,/g, ''))),
        }));
      const deltaCell = signedCells.find(x => Math.abs(x.mag - storedDelta) < 0.005);
      check('R7 group (j): the Δ column carries a cell of the delta MAGNITUDE',
        !!deltaCell,
        `stored ${storedDelta} — cells ${JSON.stringify(deltaCells.filter((c: string) => /[0-9]/.test(c)).slice(0, 12))}`);
      check('R7 group (j): and it renders NEGATIVE — direction of effect',
        !!deltaCell && deltaCell.neg === true,
        `a stored +${storedDelta.toFixed(2)} shown positive reads as MORE churn, not less`);
      check('R7 group (j): while STORAGE stays POSITIVE — D4, the two layers apart',
        Number(afterRows[0].subscriberVolume) > 0,
        'the negation must live on the display layer only');
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PRICING BASELINE SCOPE — all four figures, driven on the real path.
    //
    // WHY THIS EXISTS. Two sessions argued this question from source readings
    // and both got it wrong: one by comparing two quantities that were not the
    // same NAMED quantity, one by proposing a mechanism the code cannot
    // produce. The settled decision (Jon, 2026-08-17) says the pricing
    // baseline is "the blend of THE EVENT'S OWN DIMENSIONS at its month", and
    // the weighting volumes come from the same row. This DRIVES the card and
    // reads what the engine actually produced, so the question stops being
    // arguable.
    //
    // THE CONFIGURATION IS THE WHOLE POINT: a WIDE cohort loaded in Step 1 and
    // a NARROW draft. When the loaded cohort equals the draft's scope every
    // scoping bug is invisible — which is exactly why the walks did not see it.
    //
    // EXPECTATIONS COME FROM resolveForecast, NOT FROM THE CARD. The narrow
    // slice's own forecast is what "event-scoped" MEANS, and it is reached by a
    // different route than the card's — so this measures rather than
    // reimplements, and cannot pass by agreeing with itself.
    // ═══════════════════════════════════════════════════════════════════════
    {
      const priceProvider = (loadedKey: string, child: any) =>
        React.createElement(ForecastProvider as any, {
          baseForecast: fc.resolveFromStore(storeR7, leafMapR7, loadedKey).forecast,
          setBaseForecast: noop,
          adjustedForecast: null, setAdjustedForecast: noop,
          forecastStore: storeR7, setForecastStore: noop,
          resolveForecast: (k: string) => fc.resolveFromStore(storeR7, leafMapR7, k),
          canResolve: (k: string) => leafMapR7.has(k) || storeR7.has(k),
          hasLegacyBaseline: true, updatedAt: new Date().toISOString(),
          bulkRuns: [], setBulkRuns: noop,
        }, child);

      const clickEl = async (el: any) => {
        await (act as any)(async () => {
          el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
        });
      };

      /** Drive one configuration end to end and return what the ENGINE built. */
      const drivePricing = async (loadedKey: string) => {
        let captured: any = null;
        const host = document.createElement('div');
        document.getElementById('root')!.appendChild(host);
        const rootP = createRoot(host);
        const H = () => {
          const [pe, setPe] = React.useState<any>({});
          (globalThis as any).__setP = setPe;
          return React.createElement(M, {
            ...whatIfProps(),
            newPricingEvent: pe,
            setNewPricingEvent: (e: any) => setPe(e),
            pricingEvents: [],
            addPricingEvent: (e: any) => { captured = e; },
          });
        };
        await (act as any)(async () => { rootP.render(priceProvider(loadedKey, React.createElement(H))); });

        // THE REAL TAB CLICK. The pricing card lives behind activeTab, which is
        // internal state — reaching it any other way would be testing a render
        // the user cannot actually get to.
        const tabBtn = [...host.querySelectorAll('button')]
          .find((b: any) => (b.textContent || '').trim() === 'Pricing');
        if (tabBtn) await clickEl(tabBtn);

        // A PLAIN PERCENTAGE EVENT over target 'cohorts', scope 'both', so
        // pricedVol is inflow+retention and totalVol adds base — all three
        // volume terms exercised, and none of dilution's extra state involved.
        await (act as any)(async () => {
          (globalThis as any).__setP((d: any) => ({
            ...d, segment: SEG, product: PRODB, productL2: 'All',
            channelL1: 'All', channelL2: 'All', tariffL1: 'All', tariffL2: 'All',
            month: DRAFT_MONTH, amount: 10, inputMode: 'percentage',
            target: 'cohorts', cohortScope: 'both', duration: 'one-off',
          }));
        });

        // The PREVIEW's rendered baseline, read as TEXT — the figure a user
        // actually sees, not the state behind it.
        const previewText = [...host.querySelectorAll('p')]
          .map((p: any) => (p.textContent || '').trim())
          .find((s: string) => s.startsWith('Baseline ARPU')) ?? '';

        const addBtn = [...host.querySelectorAll('button')]
          .find((b: any) => (b.textContent || '').trim() === 'Add Pricing Event');
        if (addBtn) await clickEl(addBtn);

        return { captured, previewText, hasAdd: !!addBtn, hasTab: !!tabBtn };
      };

      // WHAT EVENT-SCOPED MEANS, derived independently of the card.
      const monthsOf = (k: string) =>
        (fc.resolveFromStore(storeR7, leafMapR7, k).forecast?.months ?? []);
      const idxOf = (k: string) => monthsOf(k).findIndex((m: any) => m.month === DRAFT_MONTH);
      const arpuOf = (k: string) => monthsOf(k)[idxOf(k)]?.arpu?.mean ?? NaN;
      const flowsOf = (k: string) => {
        const mm = monthsOf(k)[idxOf(k)];
        return mm ? (mm.inflow.mean + mm.retention.mean) : NaN;
      };

      const A_ARPU = arpuOf(keyA), B_ARPU = arpuOf(keyB);
      const A_FLOWS = flowsOf(keyA), B_FLOWS = flowsOf(keyB);

      // THE FIXTURE MUST BE ABLE TO TELL THE TWO APART. Without this the whole
      // section could pass while proving nothing — the vacuous-result trap.
      check('pricing scope: the wide and narrow slices have DISTINCT ARPU',
        Number.isFinite(A_ARPU) && Number.isFinite(B_ARPU) && Math.abs(A_ARPU - B_ARPU) > 0.01,
        `wide ${A_ARPU} vs narrow ${B_ARPU}`);
      check('pricing scope: the wide and narrow slices have DISTINCT flows',
        Number.isFinite(A_FLOWS) && Number.isFinite(B_FLOWS) && Math.abs(A_FLOWS - B_FLOWS) > 1,
        `wide ${A_FLOWS} vs narrow ${B_FLOWS}`);

      // ── CONFIGURATION 1: WIDE loaded, NARROW draft ──────────────────────
      const wide = await drivePricing(keyA);
      check('pricing scope: the Pricing tab is reachable by click', wide.hasTab);
      check('pricing scope: the Add button is present', wide.hasAdd);
      check('pricing scope: a row was built by the real handler', !!wide.captured);

      const w: any = wide.captured ?? {};

      // ── CONFIGURATION 2: NARROW loaded (C = S) ──────────────────────────
      const narrow = await drivePricing(keyB);
      const n: any = narrow.captured ?? {};

      console.log('\n  PRICING BASELINE SCOPE — measured on the real path');
      console.log(`    draft slice        : ${SEG} / ${PRODB}   month ${DRAFT_MONTH}`);
      console.log(`    narrow slice OWN   : arpu ${Number(B_ARPU).toFixed(4)}   flows ${Number(B_FLOWS).toFixed(2)}`);
      console.log(`    wide  cohort OWN   : arpu ${Number(A_ARPU).toFixed(4)}   flows ${Number(A_FLOWS).toFixed(2)}`);
      console.log(`    WIDE   loaded -> baseArpu ${w.originalBaseArpu}  pricedVol ${w.pricedVol}  totalVol ${w.totalVol}`);
      console.log(`    WIDE   loaded -> preview "${wide.previewText}"`);
      console.log(`    NARROW loaded -> baseArpu ${n.originalBaseArpu}  pricedVol ${n.pricedVol}  totalVol ${n.totalVol}`);
      console.log(`    NARROW loaded -> preview "${narrow.previewText}"\n`);

      // ── THE ASSERTIONS ──────────────────────────────────────────────────
      //
      // THE SETTLED DECISION, TESTED DIRECTLY. The baseline is the blend of the
      // EVENT'S OWN dimensions, so it must equal the narrow slice's own ARPU
      // whatever cohort happens to be loaded. This assertion INVERTS the
      // constraint the previous brief carried (leave the ARPU alone and pin it
      // unchanged); that premise was withdrawn, and the settled 2026-08-17
      // decision names this surface as event-scoped.
      check('pricing scope: baseline ARPU is the EVENT SLICE, not the loaded cohort',
        near(Number(w.originalBaseArpu), Number(B_ARPU), 5e-3),
        `stored ${w.originalBaseArpu} vs slice ${B_ARPU} (loaded cohort is ${A_ARPU})`);

      check('pricing scope: pricedVol is the EVENT SLICE flows',
        near(Number(w.pricedVol), Number(B_FLOWS), 5e-3),
        `stored ${w.pricedVol} vs slice ${B_FLOWS} (loaded cohort is ${A_FLOWS})`);

      // totalVol adds the slice's BASE to the same flows, so it must exceed
      // pricedVol and stay below the WIDE cohort's flows-plus-base. Stated as a
      // band rather than a literal because the base is a roll-forward the card
      // does not expose; the two literals above are the discriminating ones.
      check('pricing scope: totalVol adds the slice base to the same flows',
        Number(w.totalVol) > Number(w.pricedVol),
        `totalVol ${w.totalVol}, pricedVol ${w.pricedVol}`);

      // THE PREVIEW AND THE ROW ARE ONE QUANTITY (decision 3, 2026-08-17):
      // "Preview and the saved row then agree BY CONSTRUCTION." Read from the
      // rendered TEXT, so a divergence between what is shown and what is stored
      // cannot hide behind shared state.
      check('pricing scope: the PREVIEW shows the same baseline the row stored',
        wide.previewText.includes(Number(w.originalBaseArpu).toFixed(2)),
        `preview "${wide.previewText}" vs stored ${w.originalBaseArpu}`);

      // INVARIANCE. Loading the narrow slice must change nothing, because the
      // draft already asked for that slice. This is the check that catches the
      // defect from the other side.
      check('pricing scope: C = S is INVARIANT — baseline unchanged',
        near(Number(w.originalBaseArpu), Number(n.originalBaseArpu), 5e-3),
        `wide-loaded ${w.originalBaseArpu} vs narrow-loaded ${n.originalBaseArpu}`);
      check('pricing scope: C = S is INVARIANT — pricedVol unchanged',
        near(Number(w.pricedVol), Number(n.pricedVol), 5e-3),
        `wide-loaded ${w.pricedVol} vs narrow-loaded ${n.pricedVol}`);
      check('pricing scope: C = S is INVARIANT — totalVol unchanged',
        near(Number(w.totalVol), Number(n.totalVol), 5e-3),
        `wide-loaded ${w.totalVol} vs narrow-loaded ${n.totalVol}`);

      // ── ONE DEFINITION, EXACTLY TWO CALLERS ─────────────────────────────
      //
      // The churn panel and the pricing series feed. The count is pinned at
      // EXACTLY two rather than "at least two" because the failure this guards
      // is a THIRD site appearing — a card resolving its own slice locally,
      // which is how the two implementations that agree today become the two
      // that disagree tomorrow. A >= test would pass through exactly that.
      //
      // COMMENTS ARE STRIPPED FIRST. A prose mention of the helper's name in a
      // comment would inflate the count, and this file's own history contains a
      // trap that matched an explanatory comment instead of the code it
      // described.
      const srcRaw = (await import('node:fs')).readFileSync('src/components/WhatIfTab.tsx', 'utf8');
      const src = srcRaw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      const callers = (src.match(/resolveEventScopeForecast\s*\(/g) ?? []).length;
      check('pricing scope: the shared helper has EXACTLY two callers',
        callers === 2, `found ${callers}`);
      check('pricing scope: and it is IMPORTED, not redefined locally',
        /import\s*\{[^}]*resolveEventScopeForecast/.test(src)
          && !/function\s+resolveEventScopeForecast/.test(src),
        'a local redefinition would satisfy the count while forking the definition');
    }

    void rerender;
  }
  report();
}

function report() {
  console.log(`\nmix-card spec: ${pass}/${pass + fails.length} passed`);
  fails.forEach(f => console.log('  FAIL  ' + f));
  if (!fails.length) console.log('  every check green');
  // UNCONDITIONAL, matching every other mounted spec in this directory. JSDOM's
  // timers and the React root keep the event loop alive after a green run, so a
  // report() that only exits on failure hangs forever on success — and a spec
  // that hangs on success is indistinguishable from one that hangs on a defect.
  // This cost a 10-minute timeout and an empty output file before it was found.
  process.exit(fails.length ? 1 : 0);
}

main().catch(e => { console.error('mix-card spec CRASHED —', e); process.exit(1); });
