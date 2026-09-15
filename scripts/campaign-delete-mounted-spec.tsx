/**
 * REQ-D6-06 — CAMPAIGN-LEVEL DELETE, THROUGH THE APP.
 *
 *   npm run spec:campaign-delete
 *
 * The real WhatIfTab over the TWO-LEAF STORE harness (spread-ramp-volume's,
 * copied rather than re-invented — its host records every emitted row, which a
 * delete needs to count). Campaigns are built in Jon's fill-in order. Cases
 * (a)–(i) are the brief's, preceded by the 1.2 caller pin and the 1.4 predicate
 * pin.
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
const ALLV = { l1: null, l2: null } as any;
const near = (a: number, b: number, eps = 1e-6) =>
  Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
/** Relative difference in per cent — the unit the 0.5% tolerance is stated in. */
const pctDiff = (a: number, b: number) => Math.abs(a - b) / Math.max(1e-12, Math.abs(b)) * 100;

function report() {
  console.log(`\ncampaign-delete spec: ${pass} passed, ${fails.length} failed`);
  fails.forEach(f => console.log('  FAIL  ' + f));
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
    console.log(`\ncampaign-delete spec: UNREACHABLE — fixture missing at ${FIX}`);
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
  const HORIZON = 24;

  // ── A RESOLVABLE STORE, because the churn panel needs one ────────────────
  //
  // The volume mount could pass an empty store: the spread never asks the
  // context anything. The churn fold does — it derives the scoped series and
  // reads `canShowBaseForecast(churnScopeResolution?.forecast)` for
  // `seedBaseKnown`, and an unresolvable scope makes EVERY month absent, the
  // fold emit nothing, and the Add button do nothing at all.
  //
  // The first draft of this file passed `canResolve: () => false` and the run
  // reported 0 rows emitted — not a defect in the feature, a harness that had
  // nothing to fold. The shape below is `spec:mix-card`'s R7 section verbatim
  // in intent: LEAVES in the store plus a leafMap, because a stored fit under
  // an All-bearing key is ignored by design (the retired fit-on-aggregate
  // rule), so stashing an aggregate would resolve to null and this file would
  // be testing an absence while claiming to test a ramp.
  const mkSeries = (mult: number, arpu: number) => seriesArr.map((r: any) => ({
    ...r, inflow: r.inflow * mult, outflow: r.outflow * mult, retention: r.retention * mult,
    arpu, inflowArpu: arpu, outflowArpu: arpu, retentionArpu: arpu, baseArpu: arpu,
  }));
  const leafCohort = (prod: string) => ({
    segment: SEG, product: prod, productL2: 'Standard', channel: 'Direct',
    channelL2: 'Direct Sales', tariffL1: 'T1', tariffL2: 'T2', scenario: 'Base Case',
  });
  const leafKey = (prod: string) =>
    fc.makeForecastKey(SEG, prod, 'Standard', 'Direct', 'Direct Sales', 'T1', 'T2');
  const PRODS = [...treeOf(C.prod, C.prodL2).keys()]
    .filter(k => k && k !== 'All' && k !== 'undefined');
  const PRODB = PRODS[0] ?? 'All';
  const PRODC = PRODS[1] ?? PRODB;
  // SEEDS LARGE ENOUGH THAT THE BASE CANNOT COLLAPSE over 24 months. A base
  // that rolls to zero is a legitimate absence the fold names, and a fixture
  // that hit it would be exercising the absence path.
  const store = new Map<string, any>([
    [leafKey(PRODB), fc.calculateBaseForecast(mkSeries(1, 24), leafCohort(PRODB),
      800_000, HORIZON, 1.0, 1.5, 3, 'Holt Linear')],
    [leafKey(PRODC), fc.calculateBaseForecast(mkSeries(0.25, 6), leafCohort(PRODC),
      200_000, HORIZON, 1.0, 1.5, 3, 'Holt Linear')],
  ]);
  const keyAll = fc.makeForecastKey(SEG, 'All', 'All', 'All', 'All', 'All', 'All');
  const leafMap = new Map<string, string[]>([
    [keyAll, [leafKey(PRODB), leafKey(PRODC)]],
  ]);
  const baseForecast = fc.resolveFromStore(store, leafMap, keyAll).forecast;
  check('harness: the All-scope forecast RESOLVES', !!baseForecast,
    'an unresolvable scope makes every fold month absent and emits nothing');
  if (!baseForecast) { report(); return; }

  const MONTHS: string[] = baseForecast.months.map((m: any) => m.month);
  check('harness: the base forecast spans 24 months', MONTHS.length === HORIZON, `${MONTHS.length}`);
  if (MONTHS.length !== HORIZON) { report(); return; }

  let captured: any[] = [];
  let draftSetter: ((d: any) => void) | null = null;
  /** The host's current draft, read back — (f) asserts it is cleared. */
  let draftNow: any = null;

  const Host: React.FC<any> = ({ Card, props }) => {
    const [newEvent, setNewEvent] = (React as any).useState({
      scenario: 'Outflow', segment: SEG, product: 'All', productL2: 'All',
      channel: 'All', channelL2: 'All', tariffL1: 'All', tariffL2: 'All',
      date: MONTHS[0], subscriberVolume: 0, customerVolume: 0, revenue: 0, arpu: 0,
      name: '', campaignName: '', comment: '', contractLength: 24,
    });
    const [marketEvents, setMarketEvents] = (React as any).useState([]);
    draftSetter = setNewEvent;
    draftNow = newEvent;
    captured = marketEvents;
    return React.createElement(Card, {
      ...props, newEvent, setNewEvent, marketEvents, setMarketEvents,
      addMarketEvent: () => setMarketEvents((e: any[]) => [...e, { ...newEvent, id: 'single' }]),
    });
  };

  const whatIfProps = () => ({
    data: rows.slice(0, 4000),
    wiDateCol: C.date, wiSegmentCol: C.seg, wiProductCol: C.prod, wiProductL2Col: C.prodL2,
    wiChannelCol: C.chan, wiChannelL2Col: C.chanL2, wiMetricCol: C.metric,
    wiInflowVal: 'Inflow', wiRetentionVal: 'Retention', wiOutflowVal: 'Outflow',
    wiValueCol: C.val, wiRevenueCol: C.rev, wiArpuCol: '',
    productTree: treeOf(C.prod, C.prodL2), channelTree: treeOf(C.chan, C.chanL2),
    tariffTree: new Map<string, string[]>(),
    selectedTariffs: [], setSelectedTariffs: noop,
    cohortAvgArpu: 11.6,
    removeMarketEvent: noop, updateMarketEvent: noop,
    yieldEvents: [], newYieldEvent: {}, setNewYieldEvent: noop, addYieldEvent: noop,
    removeYieldEvent: noop, clearAllYieldEvents: noop,
    pricingEvents: [], newPricingEvent: {}, setNewPricingEvent: noop, addPricingEvent: noop,
    removePricingEvent: noop, clearAllPricingEvents: noop,
    downloadExcel: noop, formatNumber: (v: any) => Number(v).toFixed(2), setActiveView: noop,
    missingMonths: [],
  } as any);

  const withProvider = (child: any) => React.createElement(ForecastProvider as any, {
    baseForecast, setBaseForecast: noop,
    adjustedForecast: null, setAdjustedForecast: noop,
    forecastStore: store, setForecastStore: noop,
    // THE REAL SEAM over the two-leaf store, not a stub — what App passes.
    resolveForecast: (k: string) => fc.resolveFromStore(store, leafMap, k),
    canResolve: (k: string) => leafMap.has(k) || store.has(k),
    hasLegacyBaseline: !!baseForecast, updatedAt: new Date().toISOString(),
    bulkRuns: [], setBulkRuns: noop,
  }, child);

  const M: any = (await import('../src/components/WhatIfTab')).WhatIfTab;
  const host = document.getElementById('root')!;
  let container: any, root: any;

  const mount = async () => {
    host.replaceChildren();
    container = document.createElement('div');
    host.appendChild(container);
    root = createRoot(container);
    await (act as any)(async () => {
      root.render(withProvider(React.createElement(Host, { Card: M, props: whatIfProps() })));
    });
  };

  const byTestId = (id: string) => container.querySelector(`[data-testid="${id}"]`) as any;
  const allTestId = (id: string) => [...container.querySelectorAll(`[data-testid^="${id}"]`)] as any[];
  const norm = (s: string) => (s || '').replace(/»/g, '').trim();
  const click = async (el: any) => { await (act as any)(async () => { el.click(); }); };
  /** Type into a controlled React input, the way the user does. */
  const type = async (el: any, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(
      dom.window.HTMLInputElement.prototype, 'value')!.set!;
    await (act as any)(async () => {
      setter.call(el, value);
      el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
  };

  // ══════════════════════════════════════════════════════════════════════════
  // REQ-D6-05 — THE VOLUME CARD, DRIVEN.
  //
  // FILL-IN ORDER, AND IT IS STATED AT EACH CASE: mode → amount → duration →
  // values → Hold LAST. The order is not decoration. The promotion card shipped
  // a stale-closure defect that only Jon's order exposed (promo-hold-mounted
  // records it); a harness that fills a form in a different order from a
  // person can pass what the card fails.
  //
  // THE SCENARIO AND START MONTH ARE SET ON THE DRAFT, not clicked, exactly as
  // hold-mounted and churn-hold-mounted do: they are not what this build
  // changed, and the start month must be MONTHS[0] for the horizon to be 24.
  //
  // EVERY EXPECTED ROW LIST IS A HAND-WRITTEN LITERAL, never read back off the
  // card and compared with itself.
  // ══════════════════════════════════════════════════════════════════════════
  const setDraft = async (patch: any) => {
    await (act as any)(async () => { draftSetter!((d: any) => ({ ...d, ...patch })); });
  };
  const btnByText = (txt: string) =>
    [...container.querySelectorAll('button')].find((b: any) => norm(b.textContent || '') === txt) as any;
  const pillFor = (name: string, n: number) => {
    const title = i18n.t('whatif_edit_campaign_event', { p0: name, p1: n, p2: n === 1 ? '' : 's' });
    return [...container.querySelectorAll('button')].find((b: any) => b.getAttribute('title') === title) as any;
  };
  const vols = () => captured.map((e: any) => Math.abs(e.subscriberVolume));
  const freshInflow = async (campaignName: string) => {
    await setDraft({ scenario: 'Inflow', segment: SEG, amountType: 'absolute', percentageBasis: 'baseline',
      subscriberVolume: 0, date: MONTHS[0], campaignName });
  };
  // ══════════════════════════════════════════════════════════════════════════
  // REQ-D6-06 — CAMPAIGN-LEVEL DELETE, DRIVEN.
  //
  // FILL-IN ORDER for every campaign built: mode → amount → duration → values →
  // Hold LAST, then Add. The scenario, segment and start month are set on the
  // draft, as spread-ramp-volume does. Every expected count and every dialog
  // string is a HAND-WRITTEN literal. Every click and every type below is
  // GUARDED: a missing element records a FAIL instead of throwing, so a red
  // spec reports its lines rather than dying before them (the 1206 lesson).
  // ══════════════════════════════════════════════════════════════════════════
  const tap = async (el: any) => { if (el) await click(el); };
  const fill = async (el: any, v: string) => { if (el) await type(el, v); };
  const countOf = (name: string) => captured.filter((e: any) => e.campaignName === name).length;
  const binFor = (testid: string, name: string) => [...container.querySelectorAll(`[data-testid="${testid}"]`)]
    .find((b: any) => b.getAttribute('data-campaign') === name) as any;
  const dialogTitle = () => norm(byTestId('event-change-title')?.textContent || '');
  const nameInput = () => [...container.querySelectorAll('input')]
    .find((i: any) => i.getAttribute('placeholder') === i18n.t('whatif_e_g_summer_promo_2026')) as any;

  /** One Volume campaign, in fill-in order, on the CURRENT mount. */
  const buildVolume = async (name: string, mode: 'spread' | 'ramp', amount: string, duration: string, hold: boolean, startIdx: number) => {
    await setDraft({ scenario: 'Inflow', segment: SEG, amountType: 'absolute', percentageBasis: 'baseline',
      subscriberVolume: 0, date: MONTHS[startIdx], campaignName: name });
    await tap(byTestId(`volume-mode-${mode}`));                 // 1. mode
    await fill(byTestId('volume-amount'), amount);              // 2. amount
    await fill(byTestId('volume-duration'), duration);          // 3. duration
    if (mode === 'spread') await tap(byTestId('volume-dist-even')); // 4. values — Even
    const box = byTestId('volume-hold-toggle');                 // 5. Hold LAST
    if (box && box.checked !== hold) await tap(box);
    await tap(byTestId('volume-add'));
  };
  /** One Promotion campaign, in fill-in order, on the CURRENT mount. */
  const buildPromo = async (name: string, amount: string, duration: string) => {
    await tap(btnByText(i18n.t('whatif_promotion')));
    await fill(byTestId('promo-month'), MONTHS[0]);
    await fill(nameInput(), name);
    await tap(byTestId('promo-mode-ramp'));                     // 1. mode
    await fill(byTestId('promo-volume-amount'), amount);        // 2. amount
    await fill(byTestId('promo-duration'), duration);           // 3. duration
    const box = byTestId('promo-hold-toggle');                  // 5. Hold LAST, left off
    if (box?.checked) await tap(box);
    await tap(byTestId('promo-add'));
  };

  // ── 1.2 PIN — ONE function; its callers EXACT both ways ────────────────────
  //
  // N = 3: the Volume table pill, the Promotion table pill, the summary panel.
  // "Both ways": no fewer callers (a bin not wired to it) and no more, AND the
  // staging of a campaign change appears in exactly one place — so a caller that
  // builds its own `kind: 'campaign'` change beside the function is red too.
  {
    const src = fs.readFileSync('src/components/WhatIfTab.tsx', 'utf8');
    const N = 3;
    const callers = src.split('handleDeleteCampaign(').length - 1;
    check(`PIN: handleDeleteCampaign has EXACTLY ${N} callers — Volume pill, Promotion pill, summary panel`,
      callers === N, String(callers));
    check('PIN: it is defined exactly once',
      src.split('const handleDeleteCampaign = useCallback(').length - 1 === 1);
    check("PIN: a campaign change is staged in ONE place — `kind: 'campaign'` occurs once",
      src.split("kind: 'campaign'").length - 1 === 1, String(src.split("kind: 'campaign'").length - 1));
    const binBlock = (tid: string) => {
      const i = src.indexOf(`data-testid="${tid}"`);
      return i < 0 ? '' : src.slice(i, src.indexOf('</button>', i));
    };
    check('PIN: the Volume bin calls it with the pill group\'s rows',
      binBlock('volume-campaign-delete').includes('handleDeleteCampaign(campaignLabel, group.rows)'));
    check('PIN: the Promotion bin calls it with the pill group\'s rows',
      binBlock('promo-campaign-delete').includes('handleDeleteCampaign(campaignLabel, group.rows)'));
    const sumI = src.indexOf('onDeleteCampaign={');
    check('PIN: the summary panel\'s handler calls it',
      sumI > 0 && src.slice(sumI, sumI + 900).includes('handleDeleteCampaign(name, group.rows)'));
    const table = fs.readFileSync('src/components/EventsSummaryTable.tsx', 'utf8');
    check('PIN: the shared summary table never deletes for itself',
      !table.includes('handleDeleteCampaign') && !table.includes('setMarketEvents'));
    const preds = src.split('isCampaignStepMember(').length - 1;
    check('1.4 PIN: ONE member predicate — defined once, read by the edit bar and both row bins (4 occurrences)',
      src.split('export function isCampaignStepMember(').length - 1 === 1 && preds === 4, String(preds));
  }

  // ── (d) (b) (a) (g) (e) — the Volume table ─────────────────────────────────
  const B2 = 'B2 test', NS = 'Neighbour spread', NR = 'Neighbour ramp';
  {
    await mount();
    await buildVolume(B2, 'ramp', '3000', '3', true, 2);
    await buildVolume(NS, 'spread', '3000', '3', false, 0);
    await buildVolume(NR, 'ramp', '2000', '2', false, 0);
    check('setup: the held campaign is 22 rows (3 ramp + held to the horizon, from month 3)',
      countOf(B2) === 22, String(countOf(B2)));
    check('setup: the Spread neighbour is 3 rows', countOf(NS) === 3, String(countOf(NS)));
    check('setup: the Ramp neighbour is 2 rows', countOf(NR) === 2, String(countOf(NR)));
    const total0 = captured.length;

    // (d) DECISION 3 — a held member and a ramp member: per-row bin disabled, reason as text.
    const heldMember = captured.filter((e: any) => e.campaignName === B2)[5];
    const rampMember = captured.filter((e: any) => e.campaignName === NR)[1];
    for (const [tag, ev] of [['held', heldMember], ['ramp', rampMember]] as const) {
      const bin = byTestId(`volume-row-delete-${ev?.id}`);
      const reason = norm(byTestId(`volume-row-delete-reason-${ev?.id}`)?.textContent || '');
      check(`(d) the ${tag} member's per-row bin is rendered`, !!bin);
      check(`(d) DECISION 3: the ${tag} member's per-row bin is disabled`, bin?.disabled === true, String(bin?.disabled));
      check(`(d) and aria-disabled`, bin?.getAttribute('aria-disabled') === 'true', String(bin?.getAttribute('aria-disabled')));
      check(`(d) the ${tag} member's reason is TEXT in the DOM: "Delete the whole campaign with its bin"`,
        reason === 'Delete the whole campaign with its bin', reason || 'absent');
      await tap(bin);
      check(`(d) a click on the ${tag} member's bin opens no dialog and removes nothing`,
        !byTestId('event-change-title') && captured.length === total0, `${captured.length}`);
    }

    // (b) Cancel → nothing changes.
    check('(b) the Volume table renders a campaign bin for each of the three campaigns',
      !!binFor('volume-campaign-delete', B2) && !!binFor('volume-campaign-delete', NS) && !!binFor('volume-campaign-delete', NR));
    check('(b) ONE bin per campaign — on its first row only',
      allTestId('volume-campaign-delete').length === 3, String(allTestId('volume-campaign-delete').length));
    await tap(binFor('volume-campaign-delete', B2));
    check('(b) DECISION 2: the dialog names the campaign and its 22',
      dialogTitle() === "Delete 'B2 test' — all 22 events?", dialogTitle() || 'no dialog');
    check('(b) nothing is deleted while the dialog is open', countOf(B2) === 22, String(countOf(B2)));
    check('(b) the Cancel is keyed: "Cancel"', norm(byTestId('event-change-cancel')?.textContent || '') === 'Cancel');
    await tap(byTestId('event-change-cancel'));
    check('(b) Cancel closes the dialog', !byTestId('event-change-title'));
    check('(b) Cancel changes nothing — 22 / 3 / 2',
      countOf(B2) === 22 && countOf(NS) === 3 && countOf(NR) === 2, `${countOf(B2)} / ${countOf(NS)} / ${countOf(NR)}`);

    // (a) Confirm → the whole campaign goes, the neighbours stay.
    await tap(binFor('volume-campaign-delete', B2));
    check('(a) the dialog names it', dialogTitle() === "Delete 'B2 test' — all 22 events?", dialogTitle() || 'no dialog');
    check('(a) the confirm is keyed: "Delete campaign"',
      norm(byTestId('event-change-confirm')?.textContent || '') === 'Delete campaign',
      norm(byTestId('event-change-confirm')?.textContent || ''));
    await tap(byTestId('event-change-confirm'));
    check('(a) ZERO rows of the campaign remain', countOf(B2) === 0, String(countOf(B2)));
    check('(a) the neighbours are untouched — Spread 3, Ramp 2',
      countOf(NS) === 3 && countOf(NR) === 2, `${countOf(NS)} / ${countOf(NR)}`);
    check('(a) 27 rows became 5', total0 === 27 && captured.length === 5, `${total0} → ${captured.length}`);
    check('(a) its bin is gone', !binFor('volume-campaign-delete', B2));

    // (g) ROUND TRIP after (a), through the REAL writer and reader.
    const sheet = captured.map((e: any) => fc.marketEventExportRow(e));
    check('(g) the export has NO rows of the deleted campaign',
      !sheet.some((r: any) => r.Campaign_Name === B2), String(sheet.filter((r: any) => r.Campaign_Name === B2).length));
    const back = sheet.map((r: any) => fc.marketEventFromRow(r, 'session'));
    check('(g) and reads back as the neighbours alone — 3 + 2 = 5',
      back.length === 5 && back.filter((e: any) => e.campaignName === NS).length === 3
        && back.filter((e: any) => e.campaignName === NR).length === 2, String(back.length));

    // (e) DECISION 3 — a SPREAD member keeps its per-row bin, and it deletes ONE row.
    const spreadMember = captured.filter((e: any) => e.campaignName === NS)[1];
    const sbin = byTestId(`volume-row-delete-${spreadMember?.id}`);
    check("(e) DECISION 3: a Spread member's per-row bin is ENABLED",
      !!sbin && sbin.disabled === false && sbin.getAttribute('aria-disabled') === 'false',
      `${!!sbin} ${sbin?.disabled} ${sbin?.getAttribute('aria-disabled')}`);
    check('(e) and carries no barred reason', !byTestId(`volume-row-delete-reason-${spreadMember?.id}`));
    await tap(sbin);
    check('(e) it asks first — the single-event dialog', dialogTitle() === 'Delete this event?', dialogTitle() || 'no dialog');
    await tap(byTestId('event-change-confirm'));
    check('(e) exactly ONE row went — Spread 3 → 2, Ramp still 2',
      countOf(NS) === 2 && countOf(NR) === 2, `${countOf(NS)} / ${countOf(NR)}`);
    check('(e) and it was that row', !!spreadMember && !captured.some((e: any) => e.id === spreadMember.id));
  }

  // ── (f) delete while the campaign's editor is open ─────────────────────────
  {
    await mount();
    const ED = 'Edit me', KEEP = 'Keep me';
    await buildVolume(ED, 'ramp', '3000', '3', false, 0);
    await buildVolume(KEEP, 'spread', '3000', '3', false, 0);
    const pill = pillFor(ED, 3);
    check('(f) the campaign pill is there to open its editor', !!pill);
    await tap(pill);
    const saveCampaign = () => btnByText(i18n.t('whatif_save_campaign'));
    check('(f) the campaign editor is OPEN — "Save campaign" is offered', !!saveCampaign());
    check('(f) and the draft holds the campaign', draftNow?.campaignName === ED, String(draftNow?.campaignName));
    check('(f) and the form shows its duration, 3', byTestId('volume-duration')?.value === '3', String(byTestId('volume-duration')?.value));
    await tap(binFor('volume-campaign-delete', ED));
    check('(f) the dialog names it', dialogTitle() === "Delete 'Edit me' — all 3 events?", dialogTitle() || 'no dialog');
    await tap(byTestId('event-change-confirm'));
    check('(f) the campaign is gone, the other kept', countOf(ED) === 0 && countOf(KEEP) === 3, `${countOf(ED)} / ${countOf(KEEP)}`);
    check('(f) 1.2: the editor is CLOSED — no "Save campaign" left pointing at nothing', !saveCampaign());
    check('(f) 1.2: the draft is cleared — no campaign name', (draftNow?.campaignName ?? '') === '', String(draftNow?.campaignName));
    check('(f) 1.2: the form is a fresh one again — duration 1', byTestId('volume-duration')?.value === '1',
      String(byTestId('volume-duration')?.value));
  }

  // ── (c) a promotion campaign, deleted from the Promotion pill ──────────────
  {
    await mount();
    const PC = 'P camp', PO = 'P other';
    await buildPromo(PC, '3000', '3');
    await buildPromo(PO, '2000', '2');
    check('(c) setup: 3 and 2 promotion rows', countOf(PC) === 3 && countOf(PO) === 2, `${countOf(PC)} / ${countOf(PO)}`);
    check('(c) setup: they are promotions', captured.every((e: any) => e.isPromotion === true));
    const member = captured.filter((e: any) => e.campaignName === PC)[1];
    check("(c) DECISION 3 on this card too: a ramp member's per-row bin is disabled, reason as text",
      byTestId(`promo-row-delete-${member?.id}`)?.disabled === true
        && norm(byTestId(`promo-row-delete-reason-${member?.id}`)?.textContent || '') === 'Delete the whole campaign with its bin');
    check('(c) ONE Promotion bin per campaign', allTestId('promo-campaign-delete').length === 2,
      String(allTestId('promo-campaign-delete').length));
    await tap(binFor('promo-campaign-delete', PC));
    check('(c) the dialog names the promotion campaign and its 3',
      dialogTitle() === "Delete 'P camp' — all 3 events?", dialogTitle() || 'no dialog');
    await tap(byTestId('event-change-confirm'));
    check('(c) the promotion campaign is gone; the other stays', countOf(PC) === 0 && countOf(PO) === 2,
      `${countOf(PC)} / ${countOf(PO)}`);
  }

  // ── (h) Item 2 — delete from the Events summary panel ──────────────────────
  {
    await mount();
    const SC = 'S camp', SN = 'S neighbour';
    await buildVolume(SC, 'ramp', '3000', '3', false, 0);
    await buildVolume(SN, 'spread', '2000', '2', false, 0);
    const toggle = byTestId('events-summary-toggle');
    if (toggle && toggle.getAttribute('aria-expanded') !== 'true') await tap(toggle);
    const sumBins = allTestId('events-summary-campaign-delete-');
    check('(h) the summary panel shows ONE bin per campaign', sumBins.length === 2, String(sumBins.length));
    const lead = captured.filter((e: any) => e.campaignName === SC)[0];
    const sbin = byTestId(`events-summary-campaign-delete-${lead?.id}`);
    check("(h) the bin sits on the campaign's FIRST row", !!sbin && sbin.getAttribute('data-campaign') === SC);
    await tap(sbin);
    check('(h) the same dialog names it', dialogTitle() === "Delete 'S camp' — all 3 events?", dialogTitle() || 'no dialog');
    await tap(byTestId('event-change-confirm'));
    check('(h) deleted from the summary: 0 rows; the neighbour keeps 2', countOf(SC) === 0 && countOf(SN) === 2,
      `${countOf(SC)} / ${countOf(SN)}`);
  }

  // ── (i) DECISION 5 — Compare's panel renders no bin ────────────────────────
  {
    const { EventsSummaryTable } = await import('../src/components/EventsSummaryTable');
    const ev = (id: string, i: number) => ({
      id, sequence: i + 1, scenario: 'Inflow', date: MONTHS[i], segment: SEG, product: 'All', productL2: 'All',
      channel: 'All', channelL2: 'All', tariffL1: 'All', tariffL2: 'All', subscriberVolume: 100 * (i + 1),
      customerVolume: 0, revenue: 0, arpu: 0, campaignName: 'Cmp', mode: 'ramp',
    });
    const cmpRows = fc.buildEventsSummaryRows(
      { marketEvents: [ev('c1', 0), ev('c2', 1)], yieldEvents: [], pricingEvents: [] }, i18n.t.bind(i18n));
    host.replaceChildren();
    container = document.createElement('div');
    host.appendChild(container);
    root = createRoot(container);
    // Mounted EXACTLY as Compare mounts it: rows, t, open, toggle, title, prefix, dense — no handler.
    await (act as any)(async () => {
      root.render(React.createElement(EventsSummaryTable as any, {
        rows: cmpRows, t: i18n.t.bind(i18n), open: true, onToggle: noop,
        title: 'file.xlsx', testIdPrefix: 'compare-events-file.xlsx', dense: true,
      }));
    });
    check("(i) harness: Compare's panel renders its two rows",
      allTestId('compare-events-file.xlsx-row-').length === 2, String(allTestId('compare-events-file.xlsx-row-').length));
    const bins = container.querySelectorAll('[data-testid*="campaign-delete"]').length;
    check("(i) DECISION 5: with no handler — Compare's case — the panel renders NO bin", bins === 0, String(bins));
    const cmp = fs.readFileSync('src/components/ScenarioCompareTab.tsx', 'utf8');
    const at = cmp.indexOf('<EventsSummaryTable');
    const block = at < 0 ? '' : cmp.slice(at, cmp.indexOf('/>', at));
    check('(i) and Compare passes no onDeleteCampaign', block.length > 0 && !block.includes('onDeleteCampaign'));
  }

  report();
}

main().catch(e => { console.log('\ncampaign-delete spec: CRASHED — ' + (e?.stack || e)); process.exit(1); });
