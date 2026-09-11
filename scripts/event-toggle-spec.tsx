/**
 * REQ-D6-01 — PER-EVENT ON/OFF, DRIVEN AND PINNED.
 *
 *   npm run spec:event-toggle
 *
 * WHAT THIS ASSERTS, in the order it matters:
 *
 *  1. THE PREDICATE IS THE ONLY DEFINITION OF "OFF". Twelve apply sites call
 *     it; nothing outside `isEventOn` and the switch's own writer reads
 *     `.enabled`. Both are structural, because a thirteenth site testing the
 *     field directly would be a second definition that could drift — the shape
 *     `eventScopeMatchesView` was extracted to prevent, and the shape that cost
 *     three sessions when the re-banded pool carried its own copy.
 *  2. THE ARITHMETIC MOVES BY EXACTLY THE EVENT'S OWN CONTRIBUTION, mounted,
 *     and comes back to the penny when the event is turned on again. A toggle
 *     that merely changes a number is not evidence; a toggle that RESTORES the
 *     original is.
 *  3. ABSENT MEANS ON, at the reader and through a real xlsx round trip.
 *
 * ITS OWN MOUNT. `view-apply-mounted` is 168 checks long and its fixture is
 * shared by twelve blocks; a thirteenth would make every future change to it a
 * change to this one too.
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
/**
 * D5-09C. A Worker stub, so ScenarioCompareTab can be MOUNTED.
 *
 * The tab constructs `new Worker(new URL(...), {type:'module'})` in an effect
 * and receives its parsed sessions only through that worker's `onmessage`.
 * jsdom has no Worker, so the component could not be mounted at all and no
 * spec ever had. This stub records the instance; the test then delivers a
 * session by calling `onmessage` exactly as the real worker would — the
 * component's own code path, not a hand-set state.
 */
const workers: any[] = [];
g.Worker = class {
  onmessage: ((e: any) => void) | null = null;
  constructor() { workers.push(this); }
  postMessage() {}
  terminate() {}
};
g.IS_REACT_ACT_ENVIRONMENT = true;
for (const p of ['offsetWidth', 'clientWidth'] as const) Object.defineProperty(dom.window.HTMLElement.prototype, p, { configurable: true, value: 900 });
for (const p of ['offsetHeight', 'clientHeight'] as const) Object.defineProperty(dom.window.HTMLElement.prototype, p, { configurable: true, value: 400 });

import * as fs from 'fs';
import * as XLSX from 'xlsx';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

const MONTHS = ['2026-01', '2026-02', '2026-03'];

async function main() {
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const i18n = (await import('../src/i18n')).default;
  await (i18n as any).init?.();
  const fc: any = await import('../src/utils/forecasting');
  const { ForecastProvider } = await import('../src/context/ForecastContext');
  const M: any = (await import('../src/components/WhatIfTab')).WhatIfTab;

  // ══ 1. THE PREDICATE ITSELF ═══════════════════════════════════════════
  check('predicate: absent means ON', fc.isEventOn({}) === true);
  check('predicate: only an explicit false turns it off',
    fc.isEventOn({ enabled: false }) === false && fc.isEventOn({ enabled: true }) === true);
  check('predicate: undefined enabled is ON, not off',
    fc.isEventOn({ enabled: undefined }) === true,
    'a nullish check that treated undefined as off would disable every old event');
  // THE RAW-SHEET SHAPE. Compare's engine never calls marketEventFromRow, so
  // its rows carry the sheet column. One predicate, both shapes.
  check('predicate: a raw sheet row with Enabled No is OFF',
    fc.isEventOn({ Enabled: 'No' }) === false);
  check('predicate: a raw sheet row with Enabled Yes, or none, is ON',
    fc.isEventOn({ Enabled: 'Yes' }) === true && fc.isEventOn({ Enabled: '' }) === true
      && fc.isEventOn({ Enabled: undefined }) === true);

  // ══ 2. THE STRUCTURAL PINS ════════════════════════════════════════════
  const wi = fs.readFileSync('src/components/WhatIfTab.tsx', 'utf8');
  const sh = fs.readFileSync('src/utils/scenarioHelper.ts', 'utf8');
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  const eng = fs.readFileSync('src/utils/forecasting.ts', 'utf8');

  // TWELVE APPLY SITES, counted by their own marker rather than by counting
  // isEventOn calls — the display sites call it too, and a count that could
  // not tell them apart would go green if an apply site were converted into
  // a display one.
  const applyMarkers = (src: string) =>
    (src.match(/REQ-D6-01, apply site/gi) ?? []).length;
  const wiApply = applyMarkers(wi), shApply = applyMarkers(sh);
  check('pin: EXACTLY 8 apply sites in the What-If engine', wiApply === 8, String(wiApply));
  check('pin: EXACTLY 4 apply sites in Compare\'s engine', shApply === 4, String(shApply));
  check('pin: TWELVE in total — the number the true-state inventory found',
    wiApply + shApply === 12, String(wiApply + shApply));

  // ── D5-10: TARIFF_SCOPE_SITES, exact both ways ──────────────────────────
  //
  // Counted by MARKER TEXT, not by counting `tariffScopeFor(` calls, for the
  // reason the twelve apply sites are counted that way: a call moved into a
  // helper would still be one call and no longer one SITE, and a site that
  // quietly loses its call would still leave the helper's call behind.
  //
  // NINE, not the brief's eight: App's `addMarketEvent` is a ninth emitter,
  // and it is the one this codebase already calls THE FIFTH WRITER — reached
  // whenever month-spreading is off, which is unless the user turns it on.
  // Nothing funnels these: `setMarketEvents` has eleven callers, two of them
  // RESTORE paths that must never recompute a scope the sheet already holds.
  const scopeSites = (src: string) =>
    (src.match(/D5-10, tariff scope site/g) ?? []).length;
  const witSites = scopeSites(wi), appSites = scopeSites(app);
  check('D5-10 pin: EXACTLY 9 tariff-scope sites in WhatIfTab',
    witSites === 9, String(witSites));
  check('D5-10 pin: EXACTLY 1 in App (the fifth writer)',
    appSites === 1, String(appSites));
  check('D5-10 pin: TEN in total — the 1217 sweep plus the Value card',
    witSites + appSites === 10, String(witSites + appSites));
  // THE RESTORE PATHS MUST NOT BE AMONG THEM. A restored event's scope is in
  // the sheet; recomputing it from the current selection would rewrite what
  // the author saved, which is decision 9's opposite.
  check('D5-10: no tariff-scope site sits in a restore path',
    !/backfillSequences\(restoredEvents\)[\s\S]{0,400}D5-10, tariff scope site/.test(app),
    'App restore must not call tariffScopeFor');

  // ── D5-10: the rule itself ──────────────────────────────────────────────
  const FULL3 = ['RED L', 'RED M', 'RED S'];
  check('D5-10: a strict subset at All is recorded, SORTED',
    JSON.stringify(fc.tariffScopeFor('All', ['RED M', 'RED L'], FULL3))
      === JSON.stringify(['RED L', 'RED M']),
    JSON.stringify(fc.tariffScopeFor('All', ['RED M', 'RED L'], FULL3)));
  check('D5-10: selecting EVERY tariff is not a narrowing — no scope',
    fc.tariffScopeFor('All', FULL3, FULL3) === undefined,
    String(fc.tariffScopeFor('All', FULL3, FULL3)));
  check('D5-10: an event aimed at ONE tariff needs no scope',
    fc.tariffScopeFor('RED M', ['RED M', 'RED L'], FULL3) === undefined,
    String(fc.tariffScopeFor('RED M', ['RED M', 'RED L'], FULL3)));
  check('D5-10: an empty selection records nothing',
    fc.tariffScopeFor('All', [], FULL3) === undefined, 'empty selection');

  // THE MEMBERSHIP, and the direction that matters: an unnarrowed VIEW still
  // sees a scoped event (coverage decides how much); a specific view does not.
  check('D5-10: no scope admits every view (every pre-D5-10 save)',
    fc.tariffScopeAdmits(undefined, 'RED S') && fc.tariffScopeAdmits([], 'RED S'),
    'absent and empty both mean all tariffs');
  check('D5-10: a scoped event is admitted at view All',
    fc.tariffScopeAdmits(['RED L', 'RED M'], null)
      && fc.tariffScopeAdmits(['RED L', 'RED M'], 'All'),
    'All still sees it — coverage weights it');
  check('D5-10: admitted at an IN-scope tariff, refused at an out-of-scope one',
    fc.tariffScopeAdmits(['RED L', 'RED M'], 'RED M')
      && !fc.tariffScopeAdmits(['RED L', 'RED M'], 'RED S'),
    'RED M yes, RED S no — the finding, in one line');

  // THE PREDICATE ITSELF, through the shared function the engines call.
  const scopedEvent = { segment: 'All', product: 'All', channelL1: 'All',
                        tariffL1: 'All', tariffScope: ['RED L', 'RED M'] };
  const viewAt = (t: string | null) => ({ segment: 'All', productL1: null, productL2: null,
    channelL1: null, channelL2: null, tariffL1: t, tariffL2: null });
  check('D5-10: eventScopeMatchesView refuses the out-of-scope tariff',
    fc.eventScopeMatchesView(scopedEvent as any, viewAt('RED S') as any) === false,
    'RED S must not match');
  check('D5-10: and still matches in scope and at All',
    fc.eventScopeMatchesView(scopedEvent as any, viewAt('RED M') as any)
      && fc.eventScopeMatchesView(scopedEvent as any, viewAt(null) as any),
    'RED M and All both match');
  const unscoped = { ...scopedEvent, tariffScope: undefined };
  check('D5-10: an UNSCOPED event is unchanged in every direction',
    fc.eventScopeMatchesView(unscoped as any, viewAt('RED S') as any)
      && fc.eventScopeMatchesView(unscoped as any, viewAt(null) as any),
    'absent means all tariffs, as before D5-10');

  // ROUND TRIP, and the row that predates the column.
  const rtRow = fc.marketEventExportRow({
    id: 'ts1', sequence: 1, scenario: 'Retention', date: MONTHS[0], segment: 'All',
    product: 'All', channel: 'All', subscriberVolume: 100, customerVolume: 0,
    revenue: 0, arpu: 10, name: '', tariffScope: ['RED L', 'RED M'],
  } as any);
  check('D5-10: the column carries JSON', rtRow.Tariff_Scope === '["RED L","RED M"]',
    String(rtRow.Tariff_Scope));
  check('D5-10: and reads back identical',
    JSON.stringify(fc.marketEventFromRow(rtRow as any).tariffScope)
      === JSON.stringify(['RED L', 'RED M']),
    JSON.stringify(fc.marketEventFromRow(rtRow as any).tariffScope));
  const preD510Row = { ...rtRow }; delete (preD510Row as any).Tariff_Scope;
  check('D5-10: a row WITHOUT the column loads with NO scope',
    fc.marketEventFromRow(preD510Row as any).tariffScope === undefined,
    String(fc.marketEventFromRow(preD510Row as any).tariffScope));
  check('D5-10: an event with no scope writes an EMPTY cell, never []',
    fc.marketEventExportRow({ ...rtRow, tariffScope: undefined, id: 'x' } as any)
      .Tariff_Scope === undefined
      || fc.marketEventExportRow({
           id: 'ts2', sequence: 1, scenario: 'Retention', date: MONTHS[0], segment: 'All',
           product: 'All', channel: 'All', subscriberVolume: 1, customerVolume: 0,
           revenue: 0, arpu: 1, name: '',
         } as any).Tariff_Scope === '',
    'absence must not round-trip as "targets no tariff"');


  // THE WEIGHTING, which the predicate alone does not exercise. Trap 183
  // removes leafWithinScope's branch and every check above stayed GREEN — a
  // trap nothing can catch is not a guard, so the discriminating case is
  // here: at RED M a scoped event takes its share of the IN-SCOPE population,
  // not of the whole book.
  const tLeaves = [
    { segment: 'All', product: 'All', channel: 'All', tariffL1: 'RED M', volume: 100, hasMetricData: true },
    { segment: 'All', product: 'All', channel: 'All', tariffL1: 'RED L', volume: 300, hasMetricData: true },
    { segment: 'All', product: 'All', channel: 'All', tariffL1: 'RED S', volume: 600, hasMetricData: true },
  ];
  const evScoped = { segment: 'All', product: 'All', channel: 'All',
                     tariffL1: 'All', tariffScope: ['RED L', 'RED M'] };
  const evAll = { segment: 'All', product: 'All', channel: 'All', tariffL1: 'All' };
  const atM = { segment: 'All', product: 'All', channel: 'All', tariffL1: 'RED M' };
  const shScoped = fc.eventProRataShare(evScoped as any, atM as any, tLeaves as any);
  const shAll = fc.eventProRataShare(evAll as any, atM as any, tLeaves as any);
  // THE FIXTURE DISCRIMINATES, asserted before either figure is trusted.
  check('D5-10: the scoped and unscoped shares DIFFER on this fixture',
    shScoped !== null && shAll !== null && Math.abs((shScoped as number) - (shAll as number)) > 0.01,
    'scoped ' + shScoped + ' vs unscoped ' + shAll);
  check('D5-10: eventProRataShare weights over the IN-SCOPE leaves only',
    Math.abs((shScoped as number) - 100 / 400) < 1e-9,
    'expected 0.25 (100 of RED M + RED L), got ' + shScoped);
  check('D5-10: an unscoped event still weights over the whole book',
    Math.abs((shAll as number) - 100 / 1000) < 1e-9,
    'expected 0.10 (100 of all three), got ' + shAll);

  // ── D5-10 yield half: a scoped YIELD event ──────────────────────────────
  //
  // The Value card has no Tariff control, so `tariffScopeFor` is called with
  // 'All' at its one construction site. These checks are on the carrier, the
  // round trip and both engines' yield sites; the mounted add path is named
  // in the report's Limits.
  const yScoped = { segment: 'All', product: 'All', channelL1: 'All',
                    channelL2: 'All', tariffScope: ['RED L', 'RED M'] };
  check('D5-10 yield: the predicate refuses an out-of-scope tariff',
    fc.eventScopeMatchesView(yScoped as any, viewAt('RED S') as any) === false,
    'RED S must not match a scoped yield event');
  check('D5-10 yield: and still matches in scope and at All',
    fc.eventScopeMatchesView(yScoped as any, viewAt('RED M') as any)
      && fc.eventScopeMatchesView(yScoped as any, viewAt(null) as any),
    'RED M and All both match');

  // THE ROUND TRIP through the YIELD sheet specifically — its own writer and
  // its own reader, neither of which the market round trip exercises.
  const yRow = fc.yieldEventExportRow({
    id: 'y-ts', ibro: 'Inflow', segment: 'All', product: 'All',
    channelL1: 'All', channelL2: 'All', month: MONTHS[0], rollForward: false,
    tariffMix: {}, tariffBaseArpu: {}, tariffScope: ['RED L', 'RED M'],
  } as any);
  check('D5-10 yield: the yield sheet carries the JSON column',
    yRow.Tariff_Scope === '["RED L","RED M"]', String(yRow.Tariff_Scope));
  check('D5-10 yield: and the yield reader reads it back identical',
    JSON.stringify(fc.yieldEventFromRow(yRow as any).tariffScope)
      === JSON.stringify(['RED L', 'RED M']),
    JSON.stringify(fc.yieldEventFromRow(yRow as any).tariffScope));
  const yLegacy = { ...yRow }; delete (yLegacy as any).Tariff_Scope;
  check('D5-10 yield: a yield row without the column loads with NO scope',
    fc.yieldEventFromRow(yLegacy as any).tariffScope === undefined,
    String(fc.yieldEventFromRow(yLegacy as any).tariffScope));

  // COMPARE'S YIELD SITE (apply site 10). A scoped yield event must not reach
  // an out-of-scope tariff there either.
  const cmpYield = (scope: string) => ({
    baselineRows: [
      { Segment: 'All', Product: 'All', Product_L2: 'All', Channel: 'All', Channel_L2: 'All',
        Tariff_L1: 'RED M', Tariff_L2: 'All', Month: MONTHS[0], Seed_Base_Volume: 1000,
        Inflow_Mean: 200, Outflow_Mean: 10, Retention_Mean: 100, ARPU_Mean: 10 },
      { Segment: 'All', Product: 'All', Product_L2: 'All', Channel: 'All', Channel_L2: 'All',
        Tariff_L1: 'RED S', Tariff_L2: 'All', Month: MONTHS[0], Seed_Base_Volume: 1000,
        Inflow_Mean: 200, Outflow_Mean: 10, Retention_Mean: 100, ARPU_Mean: 10 },
      // A SECOND MONTH: Compare's yield path applies from the PREVIOUS month
      // (site 10 tests ye.Month === prevMonthKey), so an event in the first
      // month never fires and scoped/unscoped agree at 10 vs 10.
      { Segment: 'All', Product: 'All', Product_L2: 'All', Channel: 'All', Channel_L2: 'All',
        Tariff_L1: 'RED M', Tariff_L2: 'All', Month: MONTHS[1], Seed_Base_Volume: 1000,
        Inflow_Mean: 200, Outflow_Mean: 10, Retention_Mean: 100, ARPU_Mean: 10 },
      { Segment: 'All', Product: 'All', Product_L2: 'All', Channel: 'All', Channel_L2: 'All',
        Tariff_L1: 'RED S', Tariff_L2: 'All', Month: MONTHS[1], Seed_Base_Volume: 1000,
        Inflow_Mean: 200, Outflow_Mean: 10, Retention_Mean: 100, ARPU_Mean: 10 },
    ],
    marketEvents: [], pricingEvents: [],
    yieldEvents: [{ ID: 'y1', IBRO: 'Inflow', Segment: 'All', Product: 'All',
      Channel_L1: 'All', Channel_L2: 'All', Month: MONTHS[0], Enabled: 'Yes',
      // A TARIFF-AXIS mix that actually moves the rate: RED M is worth more
      // than RED S, and the mix puts everything on RED M. With an empty mix
      // the ratio is 1 and scoped/unscoped agree, which cannot catch a trap.
      Mix_Axis: 'tariff',
      Tariff_Mix_JSON: '{"RED M":100,"RED S":0}',
      Tariff_Base_ARPU_JSON: '{"RED M":40,"RED S":10}',
      Tariff_Scope: scope }],
  });
  const shYield = await import('../src/utils/scenarioHelper');
  const yArpuAt = (sess: any, tar: string | null) => {
    const out = shYield.computeScenarioForFilter(sess, 'All', { l1: null, l2: null },
      { l1: null, l2: null }, { l1: tar, l2: null });
    return out.length > 1 ? Number(out[1]?.adjustedArpu) : null;
  };
  const yBaseS = yArpuAt(cmpYield('["RED L","RED M"]'), 'RED S');
  const yOpenS = yArpuAt(cmpYield(''), 'RED S');
  check('D5-10 yield: Compare reads a number at RED S (not a vacuous NaN)',
    Number.isFinite(yBaseS as number) && Number.isFinite(yOpenS as number),
    'scoped ' + yBaseS + ' unscoped ' + yOpenS);
  check('D5-10 yield: the fixture DISCRIMINATES scoped from unscoped at RED S',
    Math.abs((yOpenS as number) - (yBaseS as number)) > 0.001,
    'scoped ' + yBaseS + ' vs unscoped ' + yOpenS);

  // ── D5-10 second half: the SCOPE cell, and Compare ──────────────────────
  const scopedRows = fc.buildEventsSummaryRows({
    marketEvents: [{ id: 'sc1', scenario: 'Retention', date: MONTHS[0], segment: 'All',
      product: 'All', productL2: 'All', channel: 'All', channelL2: 'All',
      tariffL1: 'All', tariffL2: 'All', subscriberVolume: 10, customerVolume: 0,
      revenue: 0, arpu: 1, name: 'scoped', tariffScope: ['RED L', 'RED M'] }],
    yieldEvents: [], pricingEvents: [],
  } as any, ((k: string) => k) as any);
  const plainRows = fc.buildEventsSummaryRows({
    marketEvents: [{ id: 'sc2', scenario: 'Retention', date: MONTHS[0], segment: 'All',
      product: 'All', productL2: 'All', channel: 'All', channelL2: 'All',
      tariffL1: 'All', tariffL2: 'All', subscriberVolume: 10, customerVolume: 0,
      revenue: 0, arpu: 1, name: 'plain' }],
    yieldEvents: [], pricingEvents: [],
  } as any, ((k: string) => k) as any);
  check('D5-10: the SCOPE cell APPENDS the list when the event carries one',
    scopedRows[0]?.scope.endsWith('(RED L, RED M)'), scopedRows[0]?.scope);
  check('D5-10: and is untouched when it does not',
    !plainRows[0]?.scope.includes('('), plainRows[0]?.scope);
  // THE CELLS DIFFER — the fixture discriminates before either is trusted.
  check('D5-10: the scoped and unscoped SCOPE cells differ',
    scopedRows[0]?.scope !== plainRows[0]?.scope,
    scopedRows[0]?.scope + ' vs ' + plainRows[0]?.scope);

  // COMPARE'S ENGINE, through the same column. A scoped event must not apply
  const shMod = await import('../src/utils/scenarioHelper');
  // at an out-of-scope tariff there either — its readers now parse the column
  // and leafWithinScope already carried the branch.
  const cmpSession = (scope: string) => ({
    baselineRows: [
      { Segment: 'All', Product: 'All', Product_L2: 'All', Channel: 'All', Channel_L2: 'All',
        Tariff_L1: 'RED M', Tariff_L2: 'All', Month: MONTHS[0], Seed_Base_Volume: 1000,
        Inflow_Mean: 100, Outflow_Mean: 10, Retention_Mean: 200, ARPU_Mean: 10 },
      { Segment: 'All', Product: 'All', Product_L2: 'All', Channel: 'All', Channel_L2: 'All',
        Tariff_L1: 'RED L', Tariff_L2: 'All', Month: MONTHS[0], Seed_Base_Volume: 1000,
        Inflow_Mean: 100, Outflow_Mean: 10, Retention_Mean: 400, ARPU_Mean: 10 },
      { Segment: 'All', Product: 'All', Product_L2: 'All', Channel: 'All', Channel_L2: 'All',
        Tariff_L1: 'RED S', Tariff_L2: 'All', Month: MONTHS[0], Seed_Base_Volume: 1000,
        Inflow_Mean: 100, Outflow_Mean: 10, Retention_Mean: 600, ARPU_Mean: 10 },
    ],
    marketEvents: [{ ID: 'c1', Scenario: 'Retention', Date: MONTHS[0], Segment: 'All',
      Product: 'All', Product_L2: 'All', Channel: 'All', Channel_L2: 'All',
      Tariff_L1: 'All', Tariff_L2: 'All', Subscriber_Volume: 500, Enabled: 'Yes',
      Tariff_Scope: scope }],
    yieldEvents: [], pricingEvents: [],
  });
  const retAt = (sess: any, tar: string | null) => {
    const out = shMod.computeScenarioForFilter(sess, 'All', { l1: null, l2: null },
      { l1: null, l2: null }, { l1: tar, l2: null });
    return out.length ? Number(out[0]?.adjustedRetention) : null;
  };
  const scopedS = retAt(cmpSession('["RED L","RED M"]'), 'RED S');
  const openS   = retAt(cmpSession(''), 'RED S');
  check('D5-10 Compare: the fixture discriminates at RED S',
    scopedS !== null && openS !== null && Math.abs((openS as number) - (scopedS as number)) > 1,
    'scoped ' + scopedS + ' vs unscoped ' + openS);
  check('D5-10 Compare: a scoped event applies NOTHING at an out-of-scope view',
    Math.abs((scopedS as number) - 600) < 1e-6,
    'RED S adjustedRetention should equal baseline 600, got ' + scopedS);
  check('D5-10 Compare: an UNSCOPED event still reaches RED S',
    (openS as number) > 600.5, 'got ' + openS);
  // AND THE WEIGHTING, which the match sites alone do not exercise. Trap 185
  // removes scopeOf's field and every check above stayed GREEN: the event is
  // still refused at RED S by the match, but its SHARE at RED M is taken over
  // the whole book instead of over the in-scope leaves. The quiet half again.
  const scopedM = retAt(cmpSession('["RED L","RED M"]'), 'RED M');
  const openM   = retAt(cmpSession(''), 'RED M');
  check('D5-10 Compare: the fixture discriminates at RED M too',
    scopedM !== null && openM !== null && Math.abs((scopedM as number) - (openM as number)) > 1,
    'scoped ' + scopedM + ' vs unscoped ' + openM);
  check('D5-10 Compare: the share is taken over the IN-SCOPE leaves only',
    Math.abs((scopedM as number) - (200 + 500 * (200 / 600))) < 0.5,
    'expected 200 + 500 x 200/600, got ' + scopedM);
  // THE DISPLAY SITES ARE PINNED SEPARATELY, and that separation is the point:
  // they are decision 7, not decision 1, and moving one into the other class
  // must be a visible change rather than a silent one.
  const displayMarkers = (wi.match(/REQ-D6-01 DISPLAY/g) ?? []).length;
  check('pin: EXACTLY 6 display sites, counted apart from the twelve',
    displayMarkers === 6, String(displayMarkers));

  // NOTHING OUTSIDE THE PREDICATE READS `.enabled` FOR A DECISION.
  const readers = (src: string, file: string) =>
    src.split('\n').map((l, i) => ({ l, n: i + 1 }))
      .filter(x => /\.enabled\b/.test(x.l) && !/^\s*(\*|\/\/)/.test(x.l))
      .map(x => `${file}:${x.n}`);
  const engReaders = readers(eng, 'forecasting.ts');
  const wiReaders = readers(wi, 'WhatIfTab.tsx');
  const shReaders = readers(sh, 'scenarioHelper.ts');
  // THE PIN GUARDS ONE DEFINITION OF "OFF", NOT THE WORD `.enabled`.
  //
  // Two classes of read exist and only one is dangerous:
  //
  //   AN EVENT CARRIER's `.enabled` — a second answer to "is this event on",
  //   which is what drifted for three sessions when the re-banded pool kept
  //   its own copy of a scope rule. Still pinned at the sites below.
  //
  //   A DERIVED ROW's `.enabled` — EventSummaryRow's field, which the builder
  //   already set FROM isEventOn. Reading it is reading a decision that has
  //   been made once, not making a second one. EventsSummaryTable.tsx has
  //   done this four times since REQ-D6-01 and was never in this pin's scope.
  //
  // RAISED 2026-09-08 for D5-09, deliberately, both sites named:
  //   forecasting.ts 4 -> 5: the predicate, the three export writers, and
  //     `effectStatusOf`'s `row.enabled` (a derived row).
  //   WhatIfTab.tsx  0 -> 1: the card caption's `summaryRows.filter(r =>
  //     r.enabled)` (a derived row).
  // Exact both ways, as before — a sixth or a second is a failure.
  check('pin: `.enabled` in forecasting.ts = predicate + 3 writers + effectStatusOf',
    engReaders.length === 5, engReaders.join(' '));
  check('pin: WhatIfTab reads `.enabled` ONCE, on a derived summary row',
    wiReaders.length === 1, wiReaders.join(' ')
    + ' — a second definition of "off" is how the pool predicate drifted for three sessions');
  check('pin: nor in Compare\'s', shReaders.length === 0, shReaders.join(' '));

  // THE SUMMARY BADGE COUNTS EVENTS THAT ARE ON (decision 6).
  //
  // PINNED STRUCTURALLY, and deliberately so: the badge is one expression in
  // ForecastSummaryBar, and mounting a whole second component to read one
  // integer would cost more than it proves. The three counters on that bar are
  // MEANT to differ - events held, events applied, events with no coverage -
  // so the thing worth guarding is that this one passes through the predicate
  // at all, which is exactly what a reader of the line can check.
  const bar = fs.readFileSync('src/components/ForecastSummaryBar.tsx', 'utf8');
  const countLine = bar.split('\n').find(l => /const eventCount\s*=/.test(l)) ?? '';
  check('badge: the event count is taken through isEventOn',
    /\.filter\(\s*isEventOn\s*\)/.test(countLine), countLine.trim()
    + ' - counting every event held would report a number the forecast does not use');

  // FOUR INSERTIONS OF THE ONE COMPONENT, and no fifth renderer.
  //
  // Counted by marker rather than by counting <EventOnOffSwitch> tags, because
  // the campaign control is an EventOnOffSwitch too and a tag count could not
  // tell a fifth card table from a second campaign pill.
  const cardMarks = (wi.match(/REQ-D6-01 CARD SWITCH (\d) of 4/g) ?? []);
  check('pin: the switch is inserted in EXACTLY 4 card tables (header + row each)',
    cardMarks.length === 8, cardMarks.length + ' markers');
  check('pin: they are tables 1..4, each appearing twice',
    JSON.stringify(cardMarks.map(m => m.slice(-6, -5)).sort())
      === JSON.stringify(['1', '1', '2', '2', '3', '3', '4', '4']),
    cardMarks.join(' '));
  check('pin: the campaign switch is the SAME edit twice, not two designs',
    (wi.match(/REQ-D6-01 CAMPAIGN SWITCH (\d) of 2/g) ?? []).length === 4);

  // EVERY WRITE GOES THROUGH THE ONE HANDLER. Five invocations: the four card
  // tables, and the campaign handler's per-row loop. A sixth would be a second
  // way to set the same field - the defect this whole arc is shaped against.
  const handlerCalls = (wi.match(/handleSetEventEnabled\(\{/g) ?? []).length;
  check('pin: EXACTLY 5 invocations of handleSetEventEnabled',
    handlerCalls === 5, String(handlerCalls)
    + ' - four card tables plus the campaign loop; the summary passes it by'
    + ' reference, which is why this counts invocations and not mentions');
  check('pin: the summary table is still handed the SAME handler',
    /onSetEnabled=\{handleSetEventEnabled\}/.test(wi));

  // ONE GREYING CLASS. Five renderers show an off row; a literal repeated five
  // times is five chances to drift.
  const srcFiles = ['src/components/WhatIfTab.tsx', 'src/components/EventsSummaryTable.tsx',
                    'src/components/EventOnOffSwitch.tsx'];
  const literal = srcFiles.filter(f => /'opacity-45'/.test(fs.readFileSync(f, 'utf8')));
  check('pin: `opacity-45` is written ONCE, as OFF_ROW',
    literal.length === 1 && literal[0].endsWith('EventOnOffSwitch.tsx'),
    literal.join(' '));

  // ══ 3. PERSISTENCE ════════════════════════════════════════════════════
  const mkt = fc.marketEventExportRow({
    id: 'm1', sequence: 1, scenario: 'Inflow', date: MONTHS[0], segment: 'All',
    product: 'All', channel: 'All', subscriberVolume: 100, customerVolume: 0,
    revenue: 0, arpu: 10, name: '', enabled: false,
  } as any);
  const mktOn = fc.marketEventExportRow({
    id: 'm2', sequence: 2, scenario: 'Inflow', date: MONTHS[0], segment: 'All',
    product: 'All', channel: 'All', subscriberVolume: 100, customerVolume: 0,
    revenue: 0, arpu: 10, name: '',
  } as any);
  check('export: an OFF event writes Enabled No', mkt.Enabled === 'No', String(mkt.Enabled));
  check('export: an event with no flag writes Enabled Yes',
    mktOn.Enabled === 'Yes', String(mktOn.Enabled));

  // THE COLUMN IS APPENDED, on all three sheets. Trap 119's rule: a reader
  // keys by name, but a human diffing two exports reads column ORDER.
  //
  // RE-AIMED at D5-10, 2026-09-09. `Enabled` was pinned as the LAST column
  // and is now second-to-last, because D5-10 appended `Tariff_Scope` after
  // it. That is the append-only rule working, not breaking: nothing was
  // inserted and nothing moved. The pin now names BOTH positions, so a future
  // column appended between them still goes red.
  const lastKey = (o: Record<string, unknown>) => Object.keys(o)[Object.keys(o).length - 1];
  const penultKey = (o: Record<string, unknown>) => Object.keys(o)[Object.keys(o).length - 2];
  const antepenult = (o: Record<string, unknown>) => Object.keys(o)[Object.keys(o).length - 3];
  // RE-AIMED AGAIN at REQ-D6-03, 2026-09-10, and ONLY on Market_Events: the
  // row gained `Hold` AFTER `Tariff_Scope`, so the three trailing columns are
  // now Enabled / Tariff_Scope / Hold. Seen RED before the re-aim, both lines:
  //   FAIL  export: Enabled is the LAST REQ-D6-01 column on Market_Events  [Tariff_Scope]
  //   FAIL  export: Tariff_Scope is LAST on Market_Events (D5-10)  [Hold]
  //
  // THREE positions, on the Pricing_Events pattern below — RE-AIMED, NOT
  // LOOSENED. Dropping to "Hold is last" would pass a build that reordered
  // the two columns before it; naming all three keeps a column appended
  // between ANY of them red, which is what makes append-only a rule.
  //
  // Yield_Events is deliberately untouched and still ends at Tariff_Scope:
  // decision 5 puts Hold on Market_Events alone, and the pin below proves it
  // did not leak.
  //
  // RE-AIMED A THIRD TIME at REQ-D6-05, 2026-09-11 (clause 7): `Mode` is
  // appended AFTER `Hold`, so Market_Events now ends Enabled / Tariff_Scope /
  // Hold / Mode. Seen RED before the re-aim, all three lines, on the build that
  // added the writer's Mode column and before this block was touched:
  //   FAIL  export: Enabled is third-from-last on Market_Events (REQ-D6-03)  [Tariff_Scope]
  //   FAIL  export: Tariff_Scope is second-to-last on Market_Events (REQ-D6-03)  [Hold]
  //   FAIL  export: Hold is LAST on Market_Events (REQ-D6-03)  [Mode]
  // FOUR positions, not "Mode is last" — the same not-loosened rule as above.
  const fourthFromEnd = (o: Record<string, unknown>) => Object.keys(o)[Object.keys(o).length - 4];
  check('export: Enabled is fourth-from-last on Market_Events (REQ-D6-05)',
    fourthFromEnd(mkt) === 'Enabled', fourthFromEnd(mkt));
  check('export: Tariff_Scope is third-from-last on Market_Events (REQ-D6-05)',
    antepenult(mkt) === 'Tariff_Scope', antepenult(mkt));
  check('export: Hold is second-to-last on Market_Events (REQ-D6-05)',
    penultKey(mkt) === 'Hold', penultKey(mkt));
  check('export: Mode is LAST on Market_Events (REQ-D6-05)',
    lastKey(mkt) === 'Mode', lastKey(mkt));
  const yr = fc.yieldEventExportRow({ id: 'y1', ibro: 'Inflow', segment: 'All', product: 'All',
    channelL1: 'All', channelL2: 'All', month: MONTHS[0], rollForward: false,
    tariffMix: {}, tariffBaseArpu: {}, enabled: false } as any);
  check('export: and on Yield_Events', penultKey(yr) === 'Enabled', penultKey(yr));
  check('export: Tariff_Scope is LAST on Yield_Events (D5-10)',
    lastKey(yr) === 'Tariff_Scope', lastKey(yr));
  const pr = fc.pricingEventExportRow({ id: 'p1', segment: 'All', product: 'All', productL2: 'All',
    channelL1: 'All', channelL2: 'All', month: MONTHS[0], inputMode: 'percentage',
    amount: 5, target: 'cohorts', cohortScope: 'both', duration: 'one-off',
    originalBaseArpu: 20, enabled: false } as any);
  // RE-AIMED AGAIN at D5-14, 2026-09-10, and ONLY on this sheet: the pricing
  // row gained `Contract_Length_Months` AFTER `Tariff_Scope`, so the three
  // trailing columns are now Enabled / Tariff_Scope / Contract_Length_Months.
  // Market_Events and Yield_Events are untouched and still end at Tariff_Scope.
  //
  // The pin names ALL THREE positions rather than just the last, for the same
  // reason it named two at D5-10: a column appended between any of them still
  // goes red, which is what makes append-only a rule rather than a hope.
  const antepenultKey = (o: Record<string, unknown>) =>
    Object.keys(o)[Object.keys(o).length - 3];
  check('export: Enabled is third-from-last on Pricing_Events (D5-14)',
    antepenultKey(pr) === 'Enabled', antepenultKey(pr));
  check('export: Tariff_Scope is second-to-last on Pricing_Events (D5-14)',
    penultKey(pr) === 'Tariff_Scope', penultKey(pr));
  check('export: Contract_Length_Months is LAST on Pricing_Events (D5-14)',
    lastKey(pr) === 'Contract_Length_Months', lastKey(pr));

  /** Through a REAL workbook, not an object handed straight back. */
  const throughXlsx = (rows: Record<string, unknown>[]) => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'S');
    const back = XLSX.read(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' });
    return XLSX.utils.sheet_to_json(back.Sheets['S']) as any[];
  };
  const backOff: any = fc.marketEventFromRow(throughXlsx([mkt])[0], 'session');
  const backOn: any = fc.marketEventFromRow(throughXlsx([mktOn])[0], 'session');
  check('round trip: an OFF event reloads OFF', backOff.enabled === false, String(backOff.enabled));
  check('round trip: an ON event reloads ON', backOn.enabled === true, String(backOn.enabled));

  // AN OLD WORKBOOK. Every save written before this column loads with
  // everything applying, which is what it meant.
  const legacy = throughXlsx([{ ...mkt, Enabled: '' }])[0];
  const legacyBack: any = fc.marketEventFromRow(legacy, 'session');
  check('round trip: a workbook with NO Enabled column loads ON',
    legacyBack.enabled === true, String(legacyBack.enabled)
    + ' — false here would silently disable every event in every existing save');
  check('round trip: the same on the workbook route',
    (fc.marketEventFromRow(legacy, 'workbook') as any).enabled === true);
  const yBack: any = fc.yieldEventFromRow(throughXlsx([yr])[0]);
  const pBack: any = fc.pricingEventFromRow(throughXlsx([pr])[0]);
  check('round trip: the yield carrier keeps its OFF', yBack.enabled === false, String(yBack.enabled));
  check('round trip: the pricing carrier keeps its OFF', pBack.enabled === false, String(pBack.enabled));

  // EVERYTHING ELSE SURVIVES. `enabled` joins the read-set; nothing else moves.
  const readSet = (e: any) => ({
    scenario: e.scenario, date: e.date, amountType: e.amountType,
    subscriberVolume: e.subscriberVolume, revenue: e.revenue, arpu: e.arpu,
    segment: e.segment, product: e.product, channel: e.channel,
    retentionLinked: e.retentionLinked, contractLength: e.contractLength,
  });
  check('round trip: the rest of the row is untouched by the new column',
    JSON.stringify(readSet(backOff)) === JSON.stringify(readSet(backOn)),
    'only `enabled` may differ between the two');

  // ══ 3b. COMPARE'S ENGINE, DRIVEN ══════════════════════════════════════
  //
  // NOT a second mount — Compare's engine is one pure function over RAW SHEET
  // ROWS, and raw rows are the whole reason the predicate accepts two shapes.
  // A block that only proved the typed shape would leave Compare's four sites
  // asserted by nothing but a grep.
  const { computeScenarioForFilter } = await import('../src/utils/scenarioHelper');
  const baselineRows = MONTHS.map(m => ({
    Cohort_Key: 'c1', Segment: 'Corporate', Product: 'Mobile Voice', Product_L2: 'All',
    Channel: 'All', Channel_L2: 'All', Month: m, Inflow_Mean: 300, Outflow_Mean: 0,
    Retention_Mean: 100, ARPU_Mean: 20, Seed_Base_Volume: 10000,
    Last_Historical_Inflow: 200, Last_Historical_Outflow: 0,
  }));
  const rawEvent: Record<string, unknown> = {
    ID: 'ce1', Name: 'ce1', Scenario: 'Inflow', Start_Month: MONTHS[0],
    Segment: 'Corporate', Product: 'Mobile Voice', Product_L2: 'All',
    Channel: 'All', Channel_L2: 'All', Subscriber_Volume: 1000, ARPU: 0,
    Amount_Type: 'absolute',
  };
  const runCompare = (ev: Record<string, unknown> | null) =>
    computeScenarioForFilter(
      { baselineRows, marketEvents: ev ? [ev] : [], yieldEvents: [], pricingEvents: [] },
      'Corporate', { l1: null, l2: null }, { l1: null, l2: null });
  const cmpOn = runCompare(rawEvent);
  const cmpOff = runCompare({ ...rawEvent, Enabled: 'No' });
  const cmpNone = runCompare(null);
  // NaN IS NOT A READING. The first draft of this block reached for a field
  // that does not exist, got NaN on all three runs, and the "it moves" check
  // PASSED - because NaN !== NaN. A vacuous pass is the failure mode this
  // project has hit before (the ratio check that passed at arpu 0), so the
  // reader refuses rather than returning a number nothing can be concluded from.
  const firstInflow = (rows: any[]) => {
    const v = Number(rows?.[0]?.adjustedInflow);
    if (!Number.isFinite(v)) throw new Error(
      'Compare fixture produced no adjustedInflow - the shape moved: '
      + JSON.stringify(rows?.[0] ?? rows).slice(0, 200));
    return v;
  };
  console.log('  compare  ON inflow ' + firstInflow(cmpOn)
    + '  |  OFF ' + firstInflow(cmpOff) + '  |  no event ' + firstInflow(cmpNone));
  check('Compare: the raw-row event moves the month when ON',
    firstInflow(cmpOn) !== firstInflow(cmpNone),
    firstInflow(cmpOn) + ' vs ' + firstInflow(cmpNone)
    + ' - if these are equal the fixture is not exercising the engine at all');
  check('Compare: Enabled No is IGNORED BY THE ENGINE, not by the parser',
    firstInflow(cmpOff) === firstInflow(cmpNone),
    firstInflow(cmpOff) + ' vs ' + firstInflow(cmpNone));

  // ══ 4. MOUNTED ════════════════════════════════════════════════════════
  const noop = () => {};
  const band = (m: number) => ({ mean: m, optimistic: m * 1.1, pessimistic: m * 0.9 });
  const mkLeaf = (product: string, inflow: number) => ({
    cohort: { segment: 'Corporate', product, productL2: 'All', channel: 'All',
              channelL2: 'All', tariffL1: 'All', tariffL2: 'All', scenario: 'Standard Forecast' },
    seedBaseVolume: 10000, seedBaseKnown: true,
    historicalMonths: ['2025-10', '2025-11', '2025-12'],
    lastHistoricalInflow: inflow, lastHistoricalOutflow: 0,
    provenance: 'fitted' as const,
    months: MONTHS.map(month => ({
      month, inflow: band(inflow), outflow: band(0), retention: band(100), arpu: band(20),
      inflowArpu: band(22), outflowArpu: band(18), retentionArpu: band(21), baseArpu: band(20),
    })),
  });
  const A = mkLeaf('Mobile Voice', 200);
  const B = mkLeaf('Broadband', 800);
  const keyA = fc.makeForecastKey('Corporate', 'Mobile Voice', 'All', 'All', 'All', 'All', 'All');
  const keyB = fc.makeForecastKey('Corporate', 'Broadband', 'All', 'All', 'All', 'All', 'All');
  const store = new Map<string, any>([[keyA, A], [keyB, B]]);
  const leafMap = fc.buildRollUpIndex([keyA, keyB]).leafMap;
  const resolveForecast = (k: string) => fc.resolveFromStore(store, leafMap, k);

  const C = { date: 'Month', seg: 'Segment', prod: 'Product', prodL2: 'ProductL2',
              chan: 'Channel', chanL2: 'ChannelL2', metric: 'Metric', val: 'Volume' };
  const data = ['Mobile Voice', 'Broadband'].flatMap(p => MONTHS.map(m => ({
    [C.date]: m, [C.seg]: 'Corporate', [C.prod]: p, [C.prodL2]: 'All',
    [C.chan]: 'All', [C.chanL2]: 'All', [C.metric]: 'Inflow',
    [C.val]: p === 'Mobile Voice' ? 300 : 700,
  })));

  const EVENT = {
    id: 'e-abs', sequence: 1, scenario: 'Inflow', date: MONTHS[0],
    amountType: 'absolute', subscriberVolume: 1000, arpu: 0, revenue: 0,
    customerVolume: 0, segment: 'Corporate', product: 'Mobile Voice', productL2: 'All',
    channel: 'All', channelL2: 'All', tariffL1: 'All', tariffL2: 'All',
    name: 'abs', retentionLinked: false,
  } as any;

  const mount = async (marketEvents: any[], opts: any = {}) => {
    const host = document.getElementById('root')!;
    host.replaceChildren();
    const container = document.createElement('div');
    host.appendChild(container);
    const root = createRoot(container);
    const Harness = () => {
      const [newEvent, setNewEvent] = (React as any).useState({});
      // REAL STATE, not noop setters. The earlier block only needed to mount
      // three fixed arrays; a switch is a WRITE, and a harness whose setters
      // discard the write can only prove that a click does not crash.
      // `updateById` here is App's, verbatim in behaviour: a FUNCTIONAL
      // setState patching by id, which is what makes the campaign's N writes
      // in one tick land on each other rather than the last one winning.
      const [me, setMe] = (React as any).useState(marketEvents);
      const [ye, setYe] = (React as any).useState(opts.yieldEvents ?? []);
      const [pe, setPe] = (React as any).useState(opts.pricingEvents ?? []);
      const upd = (setter: any) => (id: string, patch: any) =>
        setter((prev: any[]) => prev.map(x => (x.id === id ? { ...x, ...patch } : x)));
      return React.createElement(M, {
        data, wiDateCol: C.date, wiSegmentCol: C.seg, wiProductCol: C.prod,
        wiProductL2Col: C.prodL2, wiChannelCol: C.chan, wiChannelL2Col: C.chanL2,
        wiMetricCol: C.metric, wiInflowVal: 'Inflow', wiOutflowVal: 'Outflow',
        wiRetentionVal: 'Retention', wiValueCol: C.val, wiRevenueCol: '', wiArpuCol: '',
        productTree: new Map([['Mobile Voice', ['All']], ['Broadband', ['All']]]),
        channelTree: new Map(),
        // D5-10: opt-in, so every existing mount keeps an empty tariff world.
        tariffTree: opts.tariffTree ?? new Map(),
        wiTariffL1Col: opts.wiTariffL1Col ?? '',
        selectedTariffs: opts.selectedTariffs ?? [],
        setSelectedTariffs: noop, cohortAvgArpu: 20,
        marketEvents: me, setMarketEvents: setMe, addMarketEvent: noop,
        removeMarketEvent: noop, updateMarketEvent: upd(setMe),
        yieldEvents: ye, newYieldEvent: {}, setNewYieldEvent: noop, addYieldEvent: noop,
        removeYieldEvent: noop, clearAllYieldEvents: noop, updateYieldEvent: upd(setYe),
        pricingEvents: pe, newPricingEvent: {}, setNewPricingEvent: noop,
        addPricingEvent: noop, removePricingEvent: noop, clearAllPricingEvents: noop,
        updatePricingEvent: upd(setPe),
        downloadExcel: noop, formatNumber: (v: any) => Number(v).toFixed(2),
        setActiveView: noop, missingMonths: [], newEvent, setNewEvent,
      });
    };
    await (act as any)(async () => {
      root.render(React.createElement(ForecastProvider as any, {
        baseForecast: resolveForecast(keyA).forecast, setBaseForecast: noop,
        adjustedForecast: null, setAdjustedForecast: noop,
        forecastStore: store, setForecastStore: noop,
        resolveForecast, canResolve: () => true,
        hasLegacyBaseline: true, updatedAt: new Date().toISOString(),
        bulkRuns: [], setBulkRuns: noop,
      }, React.createElement(Harness)));
    });
    const q = (id: string) => container.querySelector('[data-testid="' + id + '"]') as any;
    const num = (el: any) => el ? Number(String(el.textContent).replace(/[+,\s]/g, '')) : NaN;
    const handle = {
      q,
      baseDelta: () => num(q('impact-base-delta')),
      count: () => (q('impact-event-count') ? String(q('impact-event-count').textContent).trim() : null),
      /** The switch for one event, wherever it is currently rendered. */
      sw: (id: string) => q('event-on-' + id),
      /** Every switch for that id - the promotion has TWO. */
      allSw: (id: string) => Array.from(
        container.querySelectorAll('[data-testid="event-on-' + id + '"]')) as any[],
      row: (id: string) => q('events-summary-row-' + id),
      click: async (el: any) => { await (act as any)(async () => {
        el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      }); },
      tab: async (name: string) => { await (act as any)(async () => {
        q('whatif-tab-' + name).dispatchEvent(
          new dom.window.MouseEvent('click', { bubbles: true }));
      }); },
      close: async () => { await (act as any)(async () => { root.unmount(); }); },
      container,
    };
    return handle;
  };
  /** The old three-field snapshot, for the blocks written against it. */
  const snapshot = async (marketEvents: any[]) => {
    const h = await mount(marketEvents);
    const out = { baseDelta: h.baseDelta(), count: h.count(), container: h.container };
    await h.close();
    return out;
  };

  const on = await snapshot([EVENT]);
  const off = await snapshot([{ ...EVENT, enabled: false }]);
  const backAgain = await snapshot([{ ...EVENT, enabled: true }]);
  console.log('');
  console.log('  toggle  ON base delta ' + on.baseDelta + ' count ' + on.count
    + '   |  OFF ' + off.baseDelta + ' count ' + off.count
    + '   |  ON again ' + backAgain.baseDelta);

  check('mounted: the event moves the base delta when ON',
    on.baseDelta === 1000, String(on.baseDelta));
  check('mounted: turning it OFF removes exactly its contribution',
    off.baseDelta === 0, String(off.baseDelta)
    + ' — 1000 means the predicate is not reaching the apply site');
  check('mounted: and the applied count drops to zero',
    off.count === '0', String(off.count));
  check('mounted: turning it back ON restores the figure TO THE PENNY',
    backAgain.baseDelta === on.baseDelta,
    backAgain.baseDelta + ' vs ' + on.baseDelta
    + ' — a toggle that changes a number is not evidence; one that restores it is');

  // ══ 5. THE CARD TABLES, DRIVEN FROM EACH TAB ══════════════════════════
  //
  // The block above proved the ENGINE honours `enabled`. This one proves the
  // CONTROL reaches it: the switch is clicked in the DOM, on the card whose
  // tab is open, and the arithmetic is read afterwards. A switch that renders
  // correctly and writes nowhere would pass every check written so far.
  const YEV = {
    id: 'y-1', ibro: 'Inflow', segment: 'Corporate', product: 'Mobile Voice',
    productL2: 'All', channelL1: 'All', channelL2: 'All', month: MONTHS[0],
    rollForward: false, name: 'yv',
    tariffMix: { A: 100 }, tariffBaseArpu: { A: 30 },
  } as any;
  const PEV = {
    id: 'p-1', segment: 'Corporate', product: 'Mobile Voice', productL2: 'All',
    channelL1: 'All', channelL2: 'All', month: MONTHS[0], name: 'pv',
    inputMode: 'absolute', amount: 5, target: 'cohorts', cohortScope: 'both',
    duration: 'ongoing', originalBaseArpu: 20,
  } as any;
  const PROMO = (n: number) => ({
    ...EVENT, id: 'pr-' + n, sequence: 10 + n, name: 'promo' + n,
    isPromotion: true, campaignName: 'Spring', subscriberVolume: 100 * n,
  });

  const h = await mount([EVENT, PROMO(1), PROMO(2)],
    { yieldEvents: [YEV], pricingEvents: [PEV] });
  // THE SUMMARY IS COLLAPSED BY DEFAULT, so its rows are not in the DOM at all.
  // Opening it is part of the fixture, not part of what is being proved - a
  // "the summary row greys" check run against a closed panel reads false for
  // the wrong reason and would have been a green-looking bug either way.
  await h.click(h.q('events-summary-toggle'));

  /** The switch on the CARD, not the one on the summary table above it. */
  const cardSwitch = (id: string) => {
    const all = h.allSw(id);
    return all.length > 1 ? all[all.length - 1] : all[0];
  };
  const rowOf = (el: any) => el && el.closest('tr');
  /**
   * THE INSTRUMENT HAS TO MATCH THE EVENT.
   *
   * `impact-base-delta` is a SUBSCRIBER VOLUME figure. A yield or pricing
   * event moves ARPU and no volume at all, so measuring one with the other
   * reads "nothing happened" for a switch that worked perfectly - which is
   * exactly what the first run of this block reported. Reading both means
   * every kind of event is measured by something it can actually move.
   */
  const measure = () => h.baseDelta() + ' | '
    + String(h.q('impact-arpu-scenarios')?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const greyed = (el: any) => !!el && /opacity-45/.test(el.className || '');

  const tabs: [string, string][] = [
    ['volume', EVENT.id], ['value', YEV.id],
    ['pricing', PEV.id], ['promotion', 'pr-1'],
  ];
  console.log('');
  for (const [tab, id] of tabs) {
    await h.tab(tab);
    const sw = cardSwitch(id);
    check(`mounted ${tab}: the card table renders a switch for its row`,
      !!sw, 'no [data-testid="event-on-' + id + '"] on the ' + tab + ' card');
    if (!sw) continue;
    const before = measure();
    await h.click(sw);
    const after = measure();
    const cardGrey = greyed(rowOf(cardSwitch(id)));
    const sumGrey = greyed(h.row(id));
    console.log('  ' + tab.padEnd(10) + ' ' + before + '  ->  ' + after
      + '   card/summary greyed ' + cardGrey + '/' + sumGrey);
    check(`mounted ${tab}: switching the row off changes the forecast`,
      after !== before, before + ' -> ' + after
      + ' - a switch that renders and writes nowhere passes every static check');
    check(`mounted ${tab}: the card row greys`, cardGrey);
    check(`mounted ${tab}: and so does the summary row - ONE state, two views`,
      sumGrey);
    // BACK ON, to the penny, before the next tab is measured.
    await h.click(cardSwitch(id));
    check(`mounted ${tab}: switching it back on restores the figure exactly`,
      measure() === before, measure() + ' vs ' + before);
  }

  // A PROMOTION IS IN TWO TABLES. Switched off from the Promotion card, the
  // Volume card's copy of the same row must show off too - they are two views
  // of one `enabled`, and the failure this guards against is two states.
  await h.tab('promotion');
  await h.click(cardSwitch('pr-1'));
  await h.tab('volume');
  const volCopy = cardSwitch('pr-1');
  check('mounted: a promotion switched off on the Promotion card reads off on Volume',
    !!volCopy && volCopy.getAttribute('aria-checked') === 'false',
    String(volCopy && volCopy.getAttribute('aria-checked'))
    + ' - two switches over one field, not two fields');
  check('mounted: and the Volume row is greyed there too', greyed(rowOf(volCopy)));
  await h.click(cardSwitch('pr-1'));

  // THE CAMPAIGN SWITCH. One control, one write per row, and MIXED is real.
  await h.tab('promotion');
  const camp = () => h.sw('campaign-Spring');
  check('mounted: ONE campaign switch for the two-row campaign, not one per row',
    h.allSw('campaign-Spring').length === 1,
    h.allSw('campaign-Spring').length + ' controls');
  const deltaAllOn = h.baseDelta();
  check('mounted: the campaign reads ON while both its rows are on',
    camp() && camp().getAttribute('aria-checked') === 'true',
    String(camp() && camp().getAttribute('aria-checked')));
  await h.click(camp());
  const deltaAllOff = h.baseDelta();
  const promoRowsOff = ['pr-1', 'pr-2'].every(
    id => cardSwitch(id) && cardSwitch(id).getAttribute('aria-checked') === 'false');
  check('mounted: switching the campaign off switches EVERY row off',
    promoRowsOff, 'one write per row through the same handler; a non-functional'
    + ' setState would have let all but the last write vanish');
  check('mounted: and the forecast drops both rows\' contribution',
    deltaAllOff === deltaAllOn - 300, deltaAllOn + ' -> ' + deltaAllOff
    + ' (expected -300: promo1 100 + promo2 200)');
  // ONE ROW BACK ON -> MIXED. Not "off", and not "on": a campaign with one row
  // each way is neither, and drawing it as off invites a click that silently
  // turns the survivor off too.
  await h.click(cardSwitch('pr-1'));
  console.log('  campaign   ' + deltaAllOn + ' -> off ' + deltaAllOff
    + ' -> one back on ' + h.baseDelta()
    + '   pill aria-checked ' + (camp() && camp().getAttribute('aria-checked')));
  check('mounted: one row back on makes the campaign INDETERMINATE',
    camp() && camp().getAttribute('aria-checked') === 'mixed',
    String(camp() && camp().getAttribute('aria-checked')));
  // AND A CLICK ON MIXED TURNS IT ON, never off - off is the destructive
  // reading of an ambiguous state.
  await h.click(camp());
  check('mounted: clicking a MIXED campaign turns it fully on, not fully off',
    h.baseDelta() === deltaAllOn, h.baseDelta() + ' vs ' + deltaAllOn);
  await h.close();

  // ══ 6. D5-07 — THE EVENT MARKER, ON ALL THREE MEASURES ════════════════
  //
  // Alessandro, UAT 2026-09-07: the vertical dotted marker appeared on the
  // Volume measure only. The list was always right — it already excluded off
  // events and already keyed on the event's own month — but it rendered into
  // a <ReferenceLine> hard-coded to yAxisId="left", while MEASURE_AXIS puts
  // revenue and arpu on 'right'. Both axes are always mounted, so the marker
  // bound to a real axis carrying no series and had nothing to draw against.
  //
  // MEASURED ON THE MARKER ITSELF, not on the series. A series moving is what
  // the user could already see on Revenue and ARPU while the marker was
  // missing — reading the line would have reported success for the exact
  // defect being fixed. `.recharts-reference-line` is the element that was
  // absent, so it is the element the check reads.
  const mk = await mount([
    { ...EVENT, id: 'mk-on', date: MONTHS[1], name: 'markOn' },
    { ...EVENT, id: 'mk-off', date: MONTHS[2], name: 'markOff', enabled: false },
  ]);
  // The measure row sits in the chart panel; nothing here is collapsed, but
  // the assertion is worthless if the control is absent, so prove it first.
  check('D5-07: the measure row is mounted', !!mk.q('grid-measure-row'));

  const markers = () => (mk.container
    .querySelectorAll('.recharts-reference-line') as any).length as number;

  // THE LABEL TEXT IS NOT READABLE IN JSDOM and is deliberately not the
  // instrument. Recharts nests the label in a CartesianLabel inside the same
  // Layer, but it needs a laid-out viewBox to paint; jsdom gives it none, so
  // `textContent` is '' even when the line itself renders. Measured, not
  // assumed — the first draft of this block read labels and got [] on all
  // three measures while the count was already correct.
  //
  // The COUNT ROUND TRIP is the stronger instrument anyway: it is read off
  // the marker element, and it MOVES with event state, so it cannot pass on a
  // chart that never painted.
  console.log('');
  for (const measure of ['volume', 'revenue', 'arpu'] as const) {
    const btn = mk.q('measure-' + measure);
    check(`D5-07 ${measure}: the measure control exists`, !!btn);
    if (!btn) continue;
    await mk.click(btn);

    const withOneOff = markers();
    // Turn the OFF event ON: the marker count must RISE. This is the
    // presence half — a count that never moves is the same observation as a
    // chart that never rendered, and only the round trip separates them.
    await mk.click(mk.sw('mk-off'));
    const bothOn = markers();
    // And back, to the same number it started at.
    await mk.click(mk.sw('mk-off'));
    const backToOne = markers();

    console.log('  marker  ' + measure.padEnd(8)
      + ' one-off ' + withOneOff + '  both-on ' + bothOn
      + '  back ' + backToOne);

    check(`D5-07 ${measure}: exactly ONE marker while one event is OFF`,
      withOneOff === 1, String(withOneOff)
      + ' — 0 on revenue/arpu was the defect; 0 on volume would mean the'
      + ' chart did not paint and the whole block is vacuous');
    check(`D5-07 ${measure}: switching the OFF event ON adds its marker`,
      bothOn === 2, String(bothOn)
      + ' — the count must MOVE, or it is not measuring the marker');
    check(`D5-07 ${measure}: switching it back OFF removes it again`,
      backToOne === 1, String(backToOne));
  }
  await mk.close();

  // ══ 6b. D5-09 — THE EFFECT COLUMN, AND THE CARD'S TWO NUMBERS ═════════
  //
  // Four statuses, driven mounted. THE INSTRUMENT IS THE LABEL ELEMENT —
  // `event-effect-<id>` and its `data-effect` — not the row count: every row
  // is present under every status, so counting rows would pass on a column
  // that labelled all four identically.
  //
  // The fixture supplies one of each: an event that applies on the volume
  // path, one that matches the cohort and lands on nothing, one switched off,
  // and a yield event that moves ARPU and is in neither id set.
  const OUT_OF_COHORT = { segment: 'Corporate', product: 'Broadband' };
  const eff = await mount([
    { ...EVENT, id: 'e-vol', name: 'vol' },
    // Targets a product the loaded cohort does not hold, so it matches the
    // cohort's segment and covers none of it -> zeroCoverageEventIds.
    { ...EVENT, id: 'e-zero', name: 'zero', ...OUT_OF_COHORT, subscriberVolume: 500 },
    { ...EVENT, id: 'e-off', name: 'off', enabled: false },
  ], { yieldEvents: [{ ...YEV, id: 'e-arpu', name: 'arpu' }] });
  await eff.click(eff.q('events-summary-toggle'));

  const effectOf = (id: string) => {
    const el = eff.q('event-effect-' + id);
    return el ? el.getAttribute('data-effect') : null;
  };
  const effectText = (id: string) => {
    const el = eff.q('event-effect-' + id);
    return el ? String(el.textContent).trim() : null;
  };

  console.log('');
  console.log('  effect  vol=' + effectOf('e-vol') + ' zero=' + effectOf('e-zero')
    + ' off=' + effectOf('e-off') + ' arpu=' + effectOf('e-arpu'));
  console.log('  labels  ' + JSON.stringify(
    ['e-vol', 'e-zero', 'e-off', 'e-arpu'].map(effectText)));

  check('D5-09: the EFFECT column renders at all',
    !!eff.q('event-effect-e-vol'),
    'no [data-testid="event-effect-*"] — the column is absent and every check'
    + ' below would be vacuous');
  check('D5-09: an applied volume event reads Volume',
    effectOf('e-vol') === 'volume', String(effectOf('e-vol')));
  check('D5-09: a cohort-matched, zero-coverage event reads No coverage',
    effectOf('e-zero') === 'no-coverage', String(effectOf('e-zero')));
  check('D5-09: a switched-off event reads Off, whatever the unions say',
    effectOf('e-off') === 'off', String(effectOf('e-off')));
  check('D5-09: an on yield event reads ARPU',
    effectOf('e-arpu') === 'arpu', String(effectOf('e-arpu')));

  // THE LABELS ARE KEYED, not literals. Asserting the rendered text catches a
  // hard-coded English string that data-effect alone would not.
  check('D5-09: the four labels are the keyed strings',
    effectText('e-vol') === 'Volume' && effectText('e-zero') === 'No coverage'
      && effectText('e-off') === 'Off' && effectText('e-arpu') === 'ARPU',
    JSON.stringify(['e-vol', 'e-zero', 'e-off', 'e-arpu'].map(effectText)));

  // THE CARD'S TWO NUMBERS. SUPERSEDED AT D5-12, 2026-09-09: the number is
  // now the UNION of the volume and ARPU sets, not the volume path alone —
  // D5-09 (i) counted volume only, so a yield event moving the chart read 0.
  // The pins are re-aimed at the new decision and made STRONGER while they
  // move: the caption is asserted as its whole rendered string rather than by
  // `includes('3')`, which a caption containing any 3 would have satisfied.
  //
  // The two still DIFFER on this fixture and are still meant to: 2 in effect
  // (the applied volume event and the ARPU one) against 3 switched on (the
  // zero-coverage event is on and reaching nothing).
  const cardNum = eff.q('impact-event-count');
  const cardCap = eff.q('impact-event-caption');
  console.log('  card    number ' + (cardNum && cardNum.textContent)
    + '  caption ' + JSON.stringify(cardCap && String(cardCap.textContent).trim()));
  check('D5-12: the card number is the UNION of the volume and ARPU sets',
    cardNum && String(cardNum.textContent).trim() === '2',
    String(cardNum && cardNum.textContent)
    + ' — 1 under D5-09 (i), which counted the volume path alone');
  check('D5-12: the caption names all three counts, as rendered',
    cardCap && String(cardCap.textContent).trim()
      === '1 moving volume · 1 moving ARPU · 3 switched on',
    JSON.stringify(cardCap && String(cardCap.textContent).trim())
    + ' — 3 on (volume, zero-coverage, yield); the OFF one must not count');

  // FLIP THE OFF EVENT ON: its label must MOVE. A status that never changes is
  // indistinguishable from a hard-coded cell.
  await eff.click(eff.sw('e-off'));
  console.log('  flipped off -> ' + effectOf('e-off'));
  check('D5-09: switching the off event on moves its label off "off"',
    effectOf('e-off') !== 'off' && effectOf('e-off') !== null,
    String(effectOf('e-off'))
    + ' — the column must react to the switch, or it is a static cell');
  await eff.close();

  // ══ 6c. D5-09B — ARPU MEASURED, AND SUPERSEDED ════════════════════════
  //
  // Session A inferred ARPU from the carrier: a row that was on and in neither
  // union was called ARPU if its `pass` was yield or pricing — a statement
  // about what KIND of thing it is, dressed as a statement about what it did.
  // The engine now records the winners and the candidates, so these are
  // observations. Same instrument as 6b: the label element, never a row count.
  const arpuCase = async (
    label: string,
    market: any[],
    opts: any,
  ) => {
    const h2 = await mount(market, opts);
    await h2.click(h2.q('events-summary-toggle'));
    const read = (id: string) => {
      const el = h2.q('event-effect-' + id);
      return el ? el.getAttribute('data-effect') : null;
    };
    return { h2, read, label };
  };

  console.log('');

  // (a) one yield event, on and matched -> ARPU (measured, not inferred)
  {
    const { h2, read } = await arpuCase('a', [EVENT],
      { yieldEvents: [{ ...YEV, id: 'y-a' }] });
    console.log('  (a) single yield          -> ' + read('y-a'));
    check('D5-09B(a): a matched yield event reads ARPU',
      read('y-a') === 'arpu', String(read('y-a')));
    await h2.close();
  }

  // (b) SUPERSEDED IS "CANDIDATE SOMEWHERE, WINNER NOWHERE" — and getting
  //     this fixture right is the finding.
  //
  //     The obvious construction — an early roll-forward event and a later one
  //     — does NOT supersede. Measured: the early event WINS the first month
  //     it qualifies in (the later one's month has not arrived yet) and only
  //     loses afterwards, so it moved ARPU and correctly reads `arpu`. Rule 3
  //     sits above rule 4 precisely so a winner-anywhere is never called
  //     superseded.
  //
  //     A genuine supersede needs two candidates in the SAME month, where one
  //     can never win: equal months sort equal, the sort is stable (ES2019),
  //     so the first in the array wins every time and the second never does.
  {
    const { h2, read } = await arpuCase('b', [EVENT], { yieldEvents: [
      { ...YEV, id: 'y-wins',  month: MONTHS[0], rollForward: false },
      { ...YEV, id: 'y-loses', month: MONTHS[0], rollForward: false },
    ] });
    console.log('  (b) two yield, same month -> wins=' + read('y-wins')
      + ' loses=' + read('y-loses'));
    check('D5-09B(b): the winning yield event reads ARPU',
      read('y-wins') === 'arpu', String(read('y-wins')));
    check('D5-09B(b): the one that never wins reads Superseded',
      read('y-loses') === 'superseded', String(read('y-loses'))
      + ' — it matched and reached the sort, so "no coverage" would name the'
      + ' wrong reason and "arpu" would claim an effect it never had');
    await h2.close();
  }

  // (c) a pricing event on -> ARPU. Pricing applies EVERY match, so it can
  //     never be superseded; this also pins that asymmetry.
  {
    const { h2, read } = await arpuCase('c', [EVENT],
      { pricingEvents: [{ ...PEV, id: 'p-c' }] });
    console.log('  (c) pricing               -> ' + read('p-c'));
    check('D5-09B(c): an applied pricing event reads ARPU',
      read('p-c') === 'arpu', String(read('p-c')));
    await h2.close();
  }

  // (d) a yield event whose scope matches nothing -> No coverage, NOT ARPU.
  //     Under session A's carrier inference this read ARPU purely because it
  //     was a yield row. That is the regression this case pins.
  {
    const { h2, read } = await arpuCase('d', [EVENT], { yieldEvents: [
      { ...YEV, id: 'y-nomatch', segment: 'SOHO', product: 'Fixed Connectivity' },
    ] });
    console.log('  (d) yield, scope matches 0-> ' + read('y-nomatch'));
    check('D5-09B(d): an unmatched yield event reads No coverage, not ARPU',
      read('y-nomatch') === 'no-coverage', String(read('y-nomatch'))
      + ' — "arpu" here would be the carrier inference session B removed');
    await h2.close();
  }

  // (e) a pass-0 (market) event in no union -> No coverage. Rule 4 is gone, so
  //     nothing consults `pass` any more.
  {
    const { h2, read } = await arpuCase('e', [
      EVENT,
      { ...EVENT, id: 'm-nomatch', name: 'nomatch',
        segment: 'SOHO', product: 'Fixed Connectivity' },
    ], {});
    console.log('  (e) market, no union      -> ' + read('m-nomatch'));
    check('D5-09B(e): a market event in no union reads No coverage',
      read('m-nomatch') === 'no-coverage', String(read('m-nomatch')));
    await h2.close();
  }

  // (f) THE CARD COUNTS THE ARPU CARRIERS TOO, since D5-12. Under D5-09B this
  //     read "the card is untouched by all of this" — its number was the
  //     volume-path count and the ARPU work was forbidden to move it. That is
  //     exactly what produced the UAT report, so the pin is re-aimed: with one
  //     market, one yield and one pricing event all applying, the number is 3.
  {
    const { h2 } = await arpuCase('f', [EVENT],
      { yieldEvents: [{ ...YEV, id: 'y-f' }], pricingEvents: [{ ...PEV, id: 'p-f' }] });
    const n = h2.q('impact-event-count');
    const cap = h2.q('impact-event-caption');
    console.log('  (f) card number/caption   -> ' + (n && n.textContent)
      + ' / ' + JSON.stringify(cap && String(cap.textContent).trim()));
    check('D5-12(f): the card number counts the ARPU carriers too',
      n && String(n.textContent).trim() === '3', String(n && n.textContent)
      + ' — 1 under D5-09B, with the yield and pricing events invisible');
    check('D5-12(f): and the caption splits them, as rendered',
      cap && String(cap.textContent).trim()
        === '1 moving volume · 2 moving ARPU · 3 switched on',
      JSON.stringify(cap && String(cap.textContent).trim())
      + ' — 1 market on the volume path, yield + pricing on the ARPU one');
    await h2.close();
  }

  // ══ 6d. D5-09C — THE EFFECT COLUMN IN SCENARIO COMPARE ════════════════
  //
  // Session A held this because the two id derivations disagreed: the engine
  // built `ID ?? Name`, the readers `ID ?? random`. Option 1 replaced both
  // with `eventRowId`, so the join is now total for any row carrying either
  // token — and case (b) below is the whole point: the SAME rows with the ID
  // column removed must label identically, because Name now carries the join.
  const CompareTab = (await import('../src/components/ScenarioCompareTab')).ScenarioCompareTab;

  /** One raw file, in the sheet shapes Compare's worker delivers. */
  const compareFile = (withId: boolean) => {
    const id = (v: string) => (withId ? { ID: v } : {});
    return {
      fileName: 'f1.xlsx',
      baselineRows: MONTHS.map(mo => ({
        Cohort_Key: 'c1', Segment: 'Corporate', Product: 'Mobile Voice',
        Product_L2: 'All', Channel: 'All', Channel_L2: 'All', Month: mo,
        Inflow_Mean: 300, Outflow_Mean: 0, Retention_Mean: 100, ARPU_Mean: 20,
        Seed_Base_Volume: 10000, Last_Historical_Inflow: 200,
        Last_Historical_Outflow: 0,
      })),
      marketEvents: [
        { ...id('c-vol'), Name: 'c-vol', Scenario: 'Inflow', Start_Month: MONTHS[0],
          Segment: 'Corporate', Product: 'Mobile Voice', Product_L2: 'All',
          Channel: 'All', Channel_L2: 'All', Subscriber_Volume: 1000,
          ARPU: 0, Amount_Type: 'absolute' },
        // Targets a product this file's baseline does not hold -> zero coverage.
        { ...id('c-zero'), Name: 'c-zero', Scenario: 'Inflow', Start_Month: MONTHS[0],
          Segment: 'Corporate', Product: 'Broadband', Product_L2: 'All',
          Channel: 'All', Channel_L2: 'All', Subscriber_Volume: 500,
          ARPU: 0, Amount_Type: 'absolute' },
        { ...id('c-off'), Name: 'c-off', Scenario: 'Inflow', Start_Month: MONTHS[0],
          Segment: 'Corporate', Product: 'Mobile Voice', Product_L2: 'All',
          Channel: 'All', Channel_L2: 'All', Subscriber_Volume: 100,
          ARPU: 0, Amount_Type: 'absolute', Enabled: 'No' },
      ],
      yieldEvents: [
        { ...id('c-yin'), Name: 'c-yin', IBRO: 'Inflow', Month: MONTHS[0],
          Segment: 'Corporate', Product: 'Mobile Voice', Channel_L1: 'All',
          Channel_L2: 'All', Roll_Forward: 'Yes',
          Tariff_Mix_JSON: '{"A":100}', Tariff_Base_Arpu_JSON: '{"A":30}' },
        // RETENTION yield — a kind this engine never applies.
        { ...id('c-yret'), Name: 'c-yret', IBRO: 'Retention', Month: MONTHS[0],
          Segment: 'Corporate', Product: 'Mobile Voice', Channel_L1: 'All',
          Channel_L2: 'All', Roll_Forward: 'Yes',
          Tariff_Mix_JSON: '{"A":100}', Tariff_Base_Arpu_JSON: '{"A":30}' },
      ],
      pricingEvents: [],
    };
  };

  const mountCompare = async (file: any) => {
    const host = document.getElementById('root')!;
    host.replaceChildren();
    const container = document.createElement('div');
    host.appendChild(container);
    const root = createRoot(container);
    workers.length = 0;
    await (act as any)(async () => {
      root.render(React.createElement(CompareTab as any, {}));
    });
    // Deliver the file the way the real worker does.
    await (act as any)(async () => { workers[0]?.onmessage?.({ data: [file] }); });
    const q = (id: string) => container.querySelector('[data-testid="' + id + '"]') as any;
    // The per-file panel is collapsed by default.
    const toggle = q('compare-events-f1.xlsx-toggle');
    if (toggle) await (act as any)(async () => {
      toggle.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });
    const eff = (rid: string) => {
      const el = container.querySelector('[data-testid="event-effect-' + rid + '"]') as any;
      return el ? el.getAttribute('data-effect') : null;
    };
    const close = async () => { await (act as any)(async () => { root.unmount(); }); };
    return { eff, q, close, container };
  };

  console.log('');
  // (a) WITH an ID column
  {
    const c = await mountCompare(compareFile(true));
    const got = ['c-vol', 'c-zero', 'c-off', 'c-yin'].map(c.eff);
    console.log('  compare(ID)     ' + JSON.stringify(got)
      + '  retention=' + c.eff('c-yret'));
    check('D5-09C(a): Compare renders the EFFECT column at all',
      !!c.q('compare-events-f1.xlsx-toggle') && got.some(v => v !== null),
      JSON.stringify(got) + ' — all null means no column and every check below'
      + ' would be vacuous');
    check('D5-09C(a): applied volume / zero coverage / off / inflow yield',
      JSON.stringify(got) === JSON.stringify(['volume', 'no-coverage', 'off', 'arpu']),
      JSON.stringify(got));
    check('D5-09C(a): a RETENTION yield reads Not applied here, not No coverage',
      c.eff('c-yret') === 'not-applied-here', String(c.eff('c-yret'))
      + ' — Compare has one IBRO test; blaming the user\'s scoping would be wrong');
    await c.close();
  }

  // (b) THE SAME ROWS WITH NO ID COLUMN. Identical labels, because the join
  //     now keys on Name. This is the case that held session A.
  {
    const c = await mountCompare(compareFile(false));
    const got = ['c-vol', 'c-zero', 'c-off', 'c-yin'].map(c.eff);
    console.log('  compare(no ID)  ' + JSON.stringify(got)
      + '  retention=' + c.eff('c-yret'));
    check('D5-09C(b): with NO ID column the labels are IDENTICAL',
      JSON.stringify(got) === JSON.stringify(['volume', 'no-coverage', 'off', 'arpu']),
      JSON.stringify(got) + ' — before eventRowId the readers minted random ids'
      + ' and every row here read "no coverage"');
    check('D5-09C(b): and the retention yield still reads Not applied here',
      c.eff('c-yret') === 'not-applied-here', String(c.eff('c-yret')));
    await c.close();
  }

  // (c) The SAME retention-yield event in WHAT-IF reads ARPU, because What-If
  //     does apply it. The label is a fact about the engine, not the event.
  {
    const w = await mount([EVENT], { yieldEvents: [
      { ...YEV, id: 'y-ret', ibro: 'Retention', month: MONTHS[0], rollForward: true },
    ] });
    await w.click(w.q('events-summary-toggle'));
    const el = w.q('event-effect-y-ret');
    const got = el ? el.getAttribute('data-effect') : null;
    console.log('  what-if retention -> ' + got);
    check('D5-09C(c): the same retention yield reads ARPU in What-If',
      got === 'arpu', String(got)
      + ' — What-If applies retention yield at site 5, so "not applied here"'
      + ' would be false there');
    await w.close();
  }

  // ══ 7. D5-08 — "SHOW ALL" ON THE EVENTS SUMMARY PANEL ═════════════════
  //
  // Jon, UAT 2026-09-07: ten events, capped panel, internal scrollbar, no way
  // to see every row at once.
  //
  // THE INSTRUMENT IS THE CAP AND THE CONTROL'S STATE, NOT THE ROW COUNT.
  // Every row is in the DOM either way — the cap hides them by height, so
  // counting <tr> would report success under any cap at all, including the
  // broken one. What changes is the container's class and aria-expanded.
  // IMPORTED FROM THE COMPONENT, never restated here. A spec that hard-codes
  // 9 would keep passing after the product moved its threshold, which is the
  // parallel-constant failure this codebase names as its recurring one.
  const { SHOW_ALL_THRESHOLD } = await import('../src/components/EventsSummaryTable');
  const CAP = 'max-h-[320px]';
  const capped = (c: any) =>
    ((c.querySelector('[data-testid="events-summary-scroll"]') as any)
      ?.className ?? '').includes(CAP);

  // ── Above the threshold: the control appears and removes the cap ────────
  const many = Array.from({ length: SHOW_ALL_THRESHOLD + 1 }, (_, i) => ({
    ...EVENT, id: 'sa-' + i, sequence: 100 + i, name: 'sa' + i,
    date: MONTHS[i % MONTHS.length],
  }));
  const big = await mount(many);
  await big.click(big.q('events-summary-toggle'));   // the panel starts collapsed
  const btn = () => big.q('events-summary-show-all');

  console.log('');
  console.log('  show-all  rows ' + many.length
    + '  control ' + !!btn()
    + '  capped ' + capped(big.container));

  check('D5-08: above the threshold the control renders',
    !!btn(), String(many.length) + ' rows > threshold '
    + SHOW_ALL_THRESHOLD + ' — absent means the panel offers no way out');
  check('D5-08: it names the scroll container it governs',
    btn() && btn().getAttribute('aria-controls') === 'events-summary-scroll',
    String(btn() && btn().getAttribute('aria-controls')));
  check('D5-08: default is the CAPPED view',
    capped(big.container) && btn().getAttribute('aria-expanded') === 'false',
    'capped=' + capped(big.container)
    + ' aria-expanded=' + (btn() && btn().getAttribute('aria-expanded')));

  await big.click(btn());
  const afterShowAll = capped(big.container);
  check('D5-08: clicking it REMOVES the cap',
    !afterShowAll, 'still capped — the control renders but governs nothing,'
    + ' which is the shape a trap must be able to catch');
  check('D5-08: and reports itself expanded',
    btn().getAttribute('aria-expanded') === 'true',
    String(btn().getAttribute('aria-expanded')));

  await big.click(btn());
  check('D5-08: clicking again puts the cap BACK',
    capped(big.container), 'the round trip, not a one-way switch');
  check('D5-08: and reports itself collapsed again',
    btn().getAttribute('aria-expanded') === 'false',
    String(btn().getAttribute('aria-expanded')));

  // THE COLLAPSE CHEVRON IS SEPARATE AND UNCHANGED (the decision says so).
  // Toggling height must not collapse the panel, and the two controls must
  // not share aria-expanded.
  check('D5-08: the collapse control is still its own, still open',
    big.q('events-summary-toggle')
      && big.q('events-summary-toggle').getAttribute('aria-expanded') === 'true');
  await big.close();

  // ── Below the threshold: no control at all ──────────────────────────────
  const few = many.slice(0, SHOW_ALL_THRESHOLD - 1);
  const small = await mount(few);
  await small.click(small.q('events-summary-toggle'));
  console.log('  show-all  rows ' + few.length
    + '   control ' + !!small.q('events-summary-show-all')
    + '   capped ' + capped(small.container));
  check('D5-08: below the threshold the control is ABSENT',
    !small.q('events-summary-show-all'), String(few.length)
    + ' rows — a panel that already fits gets no control it does not need');
  check('D5-08: and the table still renders (the check is not vacuous)',
    !!small.q('events-summary-scroll'));
  await small.close();

  // THE MARKER'S MONTH IS T, UNLAGGED — pinned structurally, and the report
  // says so rather than implying it was read from the DOM. The rendered line
  // carries no month in jsdom (see above), so what is asserted is that the
  // ReferenceLine's x is bound to the event's own date key and to nothing
  // derived from it. A lag introduced here would be a change to this line.
  check('D5-07: the marker x is the event month T, unlagged and per-measure',
    /<ReferenceLine[\s\S]{0,400}?x=\{date\}[\s\S]{0,200}?yAxisId=\{MEASURE_AXIS\[activeMeasure\]\}/
      .test(wi),
    'x must be the `seen` key (the event\'s own e.date) and the axis must'
    + ' follow the measure — a hard-coded axis is the D5-07 defect');


  // ── D5-10(6): the CONTROL'S LABEL, read from the rendered DOM ───────────
  //
  // Trap 187 makes the helper always return plain "All" and every check above
  // stayed GREEN — the label is a rendering, and only a rendering can see it.
  const TARIFF_WORLD = new Map([['RED M', ['All']], ['RED L', ['All']], ['RED S', ['All']]]);
  const labelled = await mount([], { tariffTree: TARIFF_WORLD, selectedTariffs: ['RED M', 'RED L'], wiTariffL1Col: 'Tariff_L1' });
  const openTree = await mount([], { tariffTree: TARIFF_WORLD, selectedTariffs: ['RED M', 'RED L', 'RED S'], wiTariffL1Col: 'Tariff_L1' });
  const allText = (c: any) => (c.textContent ?? '');
  check('D5-10: a STRICT subset labels the control with the keyed string',
    allText(labelled.container).includes('whatif_tariff_all_in_scope')
      || allText(labelled.container).includes('All in scope'),
    'expected the in-scope label somewhere in the card');
  check('D5-10: selecting EVERY tariff does not label it',
    !allText(openTree.container).includes('All in scope')
      && !allText(openTree.container).includes('whatif_tariff_all_in_scope'),
    'a full selection is not a narrowing, so the control says plain All');
  console.log('');
  console.log(`event-toggle spec: ${pass} passed, ${fails.length} failed`);
  fails.forEach(f => console.log('  FAIL  ' + f));
  process.exit(fails.length ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
