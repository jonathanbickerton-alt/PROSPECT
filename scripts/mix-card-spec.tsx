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
    date: 'Month', seg: 'Customer_Segment', prod: 'Product_Category',
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
