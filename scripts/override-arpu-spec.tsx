/**
 * ALESSANDRO'S EDITABLE ARPU — the Volume card's percentage mode, driven.
 *
 *   npm run spec:override-arpu
 *
 * The settled semantic (EXPECTED.md, "SETTLED: the override is a RATE") is that
 * the editable value pins the per-subscriber ARPU for the subscribers the event
 * moves, absolute, at full magnitude, pre-populated from the TARGET cohort's
 * trailing 3-month average — never the viewing filter's cohort.
 *
 * WHAT THIS FILE IS CAREFUL ABOUT:
 *
 *  - THE THREE STATES ARE DISTINCT ON SCREEN, not merely in the model. Unset,
 *    stated, and stated-as-zero must look different to a user; a spec that only
 *    read component state would pass while all three rendered identically.
 *  - CLEARED IS UNSET, NOT ZERO. `Number('')` is 0, so the transition
 *    edit -> clear -> re-edit is where a carrier silently collapses. That is a
 *    TRANSITION and cannot be reached by mounting in any one of those states.
 *  - PRE-POPULATION IS A DEFAULT AND SAYS SO. A pre-filled box that does not
 *    state its source reads as a value somebody chose.
 *  - IT PINS COUNTS, so a selector matching nothing cannot pass as a clean run.
 *
 * The round trip itself is NOT re-tested here — spec:event-roundtrip drives it
 * through a real workbook, including behaviourally against the fixture. This
 * file is the card.
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

function report() {
  console.log(`\noverride-arpu spec: ${pass}/${pass + fails.length} passed`);
  fails.forEach(f => console.log('  FAIL  ' + f));
  if (!fails.length) console.log('  every check green');
  // Unconditional — JSDOM keeps the loop alive after a green run, and a spec
  // that hangs on success is indistinguishable from one that hangs on a defect.
  process.exit(fails.length ? 1 : 0);
}

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
    check('fixture present', false, `missing ${FIX}`);
    report(); return;
  }
  const wb = XLSX.read(fs.readFileSync(FIX), { cellDates: true });
  const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

  const C = { date: 'Month', seg: 'Customer_Segment', prod: 'Product_Category',
    prodL2: 'Product_L2_Value_Tier', chan: 'Channel_Level_1', chanL2: 'Channel_Level_2',
    metric: 'IBRO_Scenario_Type', val: 'Subscriber_Volume', rev: 'Monthly_Revenue_GBP' };
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

  // THE TRAILING AVERAGE IS A PROP, and its value is what the box must
  // pre-populate from. Pinned to a distinctive number so a box showing it
  // cannot be confused with a coincidence.
  const TRAILING = 23.45;

  const captured: any = { events: null };
  const whatIfProps = () => ({
    data: rows.slice(0, 4000),
    wiDateCol: C.date, wiSegmentCol: C.seg, wiProductCol: C.prod, wiProductL2Col: C.prodL2,
    wiChannelCol: C.chan, wiChannelL2Col: C.chanL2, wiMetricCol: C.metric,
    wiInflowVal: 'Inflow', wiRetentionVal: 'Retention',
    wiValueCol: C.val, wiRevenueCol: C.rev, wiArpuCol: '',
    productTree: treeOf(C.prod, C.prodL2), channelTree: treeOf(C.chan, C.chanL2),
    tariffTree: new Map<string, string[]>(),
    selectedTariffs: [], setSelectedTariffs: noop,
    cohortAvgArpu: TRAILING,
    marketEvents: [],
    setMarketEvents: (e: any) => { captured.events = e; },
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
  const acc = new Map<number, any>();
  for (const [k, bucket] of map) {
    if (String(k).split('|')[0] !== 'Corporate') continue;
    for (const row of bucket as any[]) {
      const tms = row._parsedDate.getTime();
      if (!acc.has(tms)) acc.set(tms, { _parsedDate: row._parsedDate, inflow: 0, outflow: 0, retention: 0,
        arpu: 0, inflowArpu: 0, outflowArpu: 0, retentionArpu: 0, baseArpu: 0 });
      const e = acc.get(tms)!, m = String(row[C.metric]), v = Number(row[C.val]) || 0;
      if (m === 'Inflow') e.inflow += v; else if (m === 'Outflow') e.outflow += v;
      else if (m === 'Retention') e.retention += v;
      // REVENUE TOO, and this is load-bearing rather than tidiness. Built
      // without it, every ARPU on the series is 0, so the baseline ARPU the
      // engine falls back to is 0 — which makes "no override" and "an override
      // stated as zero" genuinely identical and the differential below
      // degenerate. A fixture missing the quantity under test makes the test
      // look like it works.
      e._rev = (e._rev ?? 0) + (Number(row[C.rev]) || 0);
      e._subs = (e._subs ?? 0) + v;
    }
  }
  for (const e of acc.values()) {
    const a = e._subs > 0 ? e._rev / e._subs : 0;
    e.arpu = a; e.baseArpu = a; e.inflowArpu = a; e.outflowArpu = a; e.retentionArpu = a;
  }
  const seriesArr = [...acc.values()].sort((a, b) => a._parsedDate - b._parsedDate);
  const baseForecast = fc.calculateBaseForecast(seriesArr,
    { segment: 'Corporate', product: 'All', productL2: 'All', channel: 'All', channelL2: 'All',
      tariffL1: 'All', tariffL2: 'All', scenario: 'Base Case' },
    10000, 12, 1.0, 1.5, 3, 'Holt Linear');

  const withProvider = (child: any) => React.createElement(ForecastProvider as any, {
    baseForecast, setBaseForecast: noop,
    adjustedForecast: null, setAdjustedForecast: noop,
    forecastStore: new Map(), setForecastStore: noop,
    hasLegacyBaseline: !!baseForecast, updatedAt: new Date().toISOString(),
    bulkRuns: [], setBulkRuns: noop,
  }, child);

  const M: any = (await import('../src/components/WhatIfTab')).WhatIfTab;

  // THE DRAFT LIVES IN THE PARENT. `newEvent` / `setNewEvent` are PROPS — App
  // owns that state and WhatIfTab is controlled. A harness passing a frozen {}
  // and a noop setter renders a card whose mode toggle cannot move, which is
  // exactly what the first run of this spec measured: the percentage box was
  // reported missing because the card never left absolute mode. Owning the
  // state here is what makes this the real path rather than a lookalike.
  const Harness = () => {
    const [newEvent, setNewEvent] = (React as any).useState({});
    captured.draft = newEvent;
    return React.createElement(M, { ...whatIfProps(), newEvent, setNewEvent });
  };

  const host = document.getElementById('root')!;
  host.replaceChildren();
  const container = document.createElement('div');
  host.appendChild(container);
  const root = createRoot(container);
  await (act as any)(async () => { root.render(withProvider(React.createElement(Harness))); });

  const norm = (s: string) => (s || '').replace(/»/g, '').trim();
  const byText = (txt: string) =>
    [...container.querySelectorAll('button')].find(b => norm(b.textContent || '') === txt) as any;
  const box = () => container.querySelector('[data-testid="pct-arpu-override"]') as any;
  const bodyText = () => container.textContent || '';

  // ── The box exists ONLY in percentage mode, which is the whole premise ────
  const volumeTab = byText('Volume');
  check('mount: the Volume card is reachable', !!volumeTab);
  if (volumeTab) await (act as any)(async () => { volumeTab.click(); });

  check('ABSOLUTE mode: the override box is absent — that mode already has an editable ARPU',
    !box(), 'the override exists for the mode where the rate was hidden');

  const pctBtn = byText('%') ?? byText('Percentage') ?? byText('percentage');
  const modeButtons = [...container.querySelectorAll('button')]
    .filter(b => /^%$|percent/i.test(norm(b.textContent || '')));
  check('mount: a percentage-mode control is present', modeButtons.length >= 1,
    `${modeButtons.length} candidates`);
  if (!modeButtons.length) { report(); return; }
  await (act as any)(async () => { (pctBtn ?? modeButtons[0]).click(); });

  check('PERCENTAGE mode: the override box appears', !!box());
  if (!box()) { report(); return; }

  // ── STATE 1: unset. Pre-populated as a PLACEHOLDER and labelled as default ──
  check('UNSET: the box is empty, so nothing has been stated', box().value === '',
    `value="${box().value}"`);
  check('UNSET: it is pre-populated from the trailing average as a PLACEHOLDER',
    box().getAttribute('placeholder') === TRAILING.toFixed(2),
    `placeholder="${box().getAttribute('placeholder')}"`);
  check('SETTINGS TRUTH: the surface says WHERE the default came from',
    /trailing 3-month average/i.test(bodyText()) && bodyText().includes(TRAILING.toFixed(2)),
    'a pre-filled box that does not name its source reads as a chosen value');
  check('UNSET: and it is not yet claimed as the user\'s',
    !/Your rate/i.test(bodyText()));

  const nativeSetter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!;
  const type = async (el: any, v: string) => {
    await (act as any)(async () => {
      nativeSetter.call(el, v);
      el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
  };

  // ── TRANSITION: unset -> stated ──────────────────────────────────────────
  await type(box(), '31.5');
  check('EDIT: the stated value is held', box().value === '31.5', `"${box().value}"`);
  check('EDIT: and is claimed as the user\'s, visibly distinct from the default',
    /Your rate/i.test(bodyText()) && !/trailing 3-month average/i.test(bodyText()),
    'edited and default must not read the same');
  const editedClass = box().className;
  check('EDIT: the box itself is styled differently once overridden',
    /e60000/.test(editedClass), editedClass.slice(0, 60));

  // ── TRANSITION: stated -> CLEARED. The carrier's whole point. ────────────
  await type(box(), '');
  check('CLEAR: clearing returns to UNSET, not to a stated zero',
    box().value === '' && /trailing 3-month average/i.test(bodyText()),
    `value="${box().value}" — Number('') is 0, so this is where the carrier collapses`);
  check('CLEAR: and the value is no longer claimed as the user\'s',
    !/Your rate/i.test(bodyText()));

  // ── TRANSITION: cleared -> stated as ZERO. Distinct from both. ───────────
  await type(box(), '0');
  check('ZERO: a stated zero is HELD as a value, not treated as cleared',
    box().value === '0', `"${box().value}"`);
  check('ZERO: and reads as the user\'s rate — a free acquisition, not an unset box',
    /Your rate/i.test(bodyText()),
    'if zero read as unset, a free acquisition would silently become the cohort average');

  // ── NEGATIVE is a deliberate affordance, not an input error ──────────────
  await type(box(), '-4.25');
  check('NEGATIVE: the input accepts a below-zero rate',
    box().value === '-4.25', `"${box().value}"`);
  check('NEGATIVE: and it reads as a stated rate, not as an unset box',
    /Your rate/i.test(bodyText()));
  check('NEGATIVE: the input carries no min attribute that would block it',
    box().getAttribute('min') === null, `min="${box().getAttribute('min')}"`);

  // ── The revert affordance returns to the default ─────────────────────────
  const revert = byText('Use the default');
  check('REVERT: an explicit way back to the default is offered', !!revert);
  if (revert) {
    await (act as any)(async () => { revert.click(); });
    check('REVERT: it returns the box to UNSET', box().value === '' && /trailing 3-month average/i.test(bodyText()),
      `value="${box().value}"`);
  }

  // ── The three states rendered distinct copy, counted ─────────────────────
  const seen = new Set<string>();
  for (const v of ['', '31.5', '0']) {
    await type(box(), v);
    seen.add(/Your rate/i.test(bodyText()) ? `stated:${box().value}` : 'unset');
  }
  check('THREE STATES: unset, stated and stated-zero are all distinguishable on screen',
    seen.size === 3, [...seen].join(' | '));

  await (act as any)(async () => { root.unmount(); });

  // ── THE OVERRIDE MUST CHANGE THE FORECAST, not merely survive and display ──
  //
  // Guard-trap 60 found this gap: everything above passes while the derivation
  // ignores the stated rate entirely. A field that round-trips perfectly and is
  // read nowhere is not a feature, and the checks that prove it round-trips are
  // exactly the ones that would not notice.
  //
  // DIFFERENTIAL, so nothing here depends on my predicting the engine's
  // arithmetic: two runs identical but for the override must disagree, and a
  // run whose override equals the auto-fill must agree.
  {
    const { computeAdjustedForecast, eventArpuDelta } = await import('../src/components/WhatIfTab')
      .then(async m => ({ computeAdjustedForecast: (m as any).computeAdjustedForecast,
                          eventArpuDelta: (await import('../src/utils/forecasting')).eventArpuDelta }));

    const baseEvent: any = {
      id: 'ovr-1', sequence: 1, scenario: 'Inflow',
      segment: 'Corporate', product: 'All', productL2: 'All',
      channel: 'All', channelL2: 'All', tariffL1: 'All', tariffL2: 'All',
      date: baseForecast?.months?.[1]?.month ?? '2026-07',
      subscriberVolume: 10, customerVolume: 0, revenue: 0, arpu: 0,
      name: '', campaignName: '', comment: '', contractLength: 24,
      amountType: 'percentage', percentageBasis: 'baseline', retentionLinked: true,
    };

    const runWith = (arpuOverride: number | undefined) => computeAdjustedForecast({
      baseForecast,
      marketEvents: [{ ...baseEvent, arpuOverride }],
      yieldEvents: [], pricingEvents: [],
      viewSegment: 'Corporate',
      viewProduct: { l1: null, l2: null }, viewChannel: { l1: null, l2: null },
      viewTariff: { l1: null, l2: null },
      data: rows.slice(0, 4000),
      wiSegmentCol: C.seg, wiProductCol: C.prod, wiProductL2Col: C.prodL2,
      wiChannelCol: C.chan, wiChannelL2Col: C.chanL2,
      wiTariffL1Col: 'tariff_tier_l1', wiTariffL2Col: 'tariff_tier_l2', wiValueCol: C.val,
      wiMetricCol: C.metric, wiInflowVal: 'Inflow', wiOutflowVal: 'Outflow', wiRetentionVal: 'Retention',
    } as any);

    // `uplifted`, which is what AdjustedForecastMonth actually calls the
    // post-event values. The first draft read `adjusted.arpu`, got a series of
    // undefined, and every differential below silently could not fail — a
    // finite-value check on both sides means "no difference" and "no numbers"
    // are indistinguishable. Hence the finiteness assertion under it.
    const arpuSeries = (r: any) => (r?.adjustedMonths ?? []).map((m: any) => m?.uplifted?.arpu);

    const unset = arpuSeries(runWith(undefined));
    const stated = arpuSeries(runWith(99));
    const zero = arpuSeries(runWith(0));
    const negative = arpuSeries(runWith(-4.25));

    // ANTI-VACUITY: lengths matching proves nothing if the values are undefined.
    const finiteCount = unset.filter((v: any) => Number.isFinite(v)).length;
    const nonZero = unset.filter((v: any) => Number.isFinite(v) && Math.abs(v) > 1e-9).length;
    check('DERIVATION: the engine produced a comparable ARPU series of REAL NUMBERS',
      unset.length > 0 && unset.length === stated.length && finiteCount === unset.length,
      `${finiteCount}/${unset.length} finite — a series of undefined makes every differential below unfalsifiable`);
    check('DERIVATION: and the baseline ARPU is NON-ZERO, so a stated zero is distinguishable',
      nonZero > 0, `${nonZero}/${unset.length} non-zero — an all-zero baseline makes unset and stated-zero identical`);

    const differs = (a: any[], b: any[]) =>
      a.some((v, i) => Number.isFinite(v) && Number.isFinite(b[i]) && Math.abs(v - b[i]) > 1e-9);

    check('DERIVATION: a stated rate CHANGES the adjusted ARPU',
      differs(unset, stated),
      'the override round-trips and displays; this is the check that it is read');
    check('DERIVATION: a stated ZERO also changes it — never silently the auto-fill',
      differs(unset, zero),
      'a free acquisition must not fall through the truthiness chain to last month blended ARPU');
    check('DERIVATION: stated 99 and stated 0 are not the same forecast',
      differs(stated, zero));

    // A NEGATIVE RATE MUST NOT BE CLAMPED. The derivation read Math.abs() until
    // 2026-08-12, which made -4.25 and +4.25 the same forecast while the events
    // table showed the sign — the two disagreeing about one number.
    const positive = arpuSeries(runWith(4.25));
    check('NEGATIVE: a below-zero rate changes the forecast',
      differs(unset, negative));
    check('NEGATIVE: and is NOT the same forecast as its positive twin',
      differs(negative, positive),
      'Math.abs() here would make these identical — that was the defect');
    check('NEGATIVE: the events table shows the sign, agreeing with the derivation',
      eventArpuDelta({ ...baseEvent, arpuOverride: -4.25 }) === -4.25,
      'the table and the engine must not disagree about one number');

    // The table's ARPU column — the "states which it used" half of the rule.
    check('NO SILENT SUBSTITUTION: a percentage row with a stated rate shows it',
      eventArpuDelta({ ...baseEvent, arpuOverride: 99 }) === 99);
    check('NO SILENT SUBSTITUTION: a stated ZERO shows as 0, not as a dash',
      eventArpuDelta({ ...baseEvent, arpuOverride: 0 }) === 0,
      'zero is the value most likely to be mistaken for absence');
    check('UNCHANGED: a percentage row with NO stated rate still dashes',
      eventArpuDelta({ ...baseEvent, arpuOverride: undefined }) === null,
      'the auto-filled rate was never the user\'s to attribute');
  }

  // ── WIRING: EVERY writer carries the override, counted not assumed ───────
  //
  // The stage-2 gate found a FIFTH construction site — App.tsx's addMarketEvent,
  // the DEFAULT add path — that built its rate inline and never carried
  // arpuOverride. Everything above passed while an ordinary Add click discarded
  // what the user typed, because this spec drives a hand-built event and the
  // harness's addMarketEvent prop is a noop, so the real path is unreachable
  // from here. A source check is the honest instrument for that, and
  // guard-trap 61 is what keeps it from degrading into decoration.
  {
    const app = fs.readFileSync('src/App.tsx', 'utf8');
    const tab = fs.readFileSync('src/components/WhatIfTab.tsx', 'utf8');
    const calls = (app + tab).match(/draftEventRate\(/g) ?? [];
    check('WIRING: FIVE sites build a draft rate, and all go through the one helper',
      calls.length === 5, `${calls.length} call sites — four was a guess, five is the code`);
    check('WIRING: the App-side addMarketEvent persists arpuOverride',
      /arpuOverride:\s+newEvent\.arpuOverride/.test(app),
      'the default Add path dropped it once already');
    const persists = ((app + tab).match(/arpuOverride:\s+newEvent\.arpuOverride/g) ?? []).length;
    check('WIRING: every construction site persists it, not merely most',
      persists === 5, `${persists}/5 — a field on four writers of five is the promo-field defect again`);
    check('WIRING: NO sign convention is applied to the override anywhere',
      !/arpuOverride === undefined \? undefined : (?:neg|abs)\(/.test(app + tab)
        && !/Math\.abs\(e\.arpuOverride\)/.test(tab),
      'the Outflow neg()/abs() pair is for QUANTITIES; a rate stated absolutely keeps its sign');
    check('WIRING: no site special-cases percentages back to a bare zero rate',
      !/isPct\w*\s*\?\s*\{\s*arpu:\s*0/.test(app + tab),
      'the inline `isPct ? { arpu: 0 } : ...` zeroed a stated rate on save');
  }

  report();
}

main().catch(e => { console.error('override-arpu spec CRASHED —', e); process.exit(1); });
