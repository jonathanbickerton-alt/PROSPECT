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
    const mkSeries = (mult: number) => seriesArr.map((r: any) => ({
      ...r, inflow: r.inflow * mult, outflow: r.outflow * mult, retention: r.retention * mult,
    }));
    const bfFor = (cohort: any, mult: number, seed: number) =>
      fc.calculateBaseForecast(mkSeries(mult), cohort, seed, 12, 1.0, 1.5, 3, 'Holt Linear');

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
    const PROD_COL = 'Product_L1';
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
      [leafKey(PRODB), bfFor(leafCohort(PRODB), 1, 10_000_000)],
      [leafKey(PRODC), bfFor(leafCohort(PRODC), 0.25, 2_500_000)],
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
        setNewEvent: (e: any) => setEv(e),
        marketEvents: evs,
        setMarketEvents: (e: any) => setEvs(e),
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
