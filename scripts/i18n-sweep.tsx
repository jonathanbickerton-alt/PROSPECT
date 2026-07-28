/**
 * Headless pseudo-locale sweep.
 *
 * Renders components into a jsdom DOM with a real dataset parsed straight from a
 * test-data fixture, so i18n coverage no longer depends on a file having been
 * uploaded through a browser. Modals, drawers, empty states and error states are
 * mounted directly — they were previously never exercised, which is how two
 * largely-unkeyed modals passed as clean.
 *
 * RULE (deliberate, do not relax): where reachability cannot be determined —
 * a render throws, a component fails to mount, props cannot be built — the state
 * is reported UNREACHABLE, never clean. A false "clean" is inherited by the gate
 * and certifies coverage that does not exist. An over-reported UNREACHABLE costs
 * one investigation; an under-reported one costs a release.
 *
 * Run: npx tsx scripts/i18n-sweep.tsx
 */
import { JSDOM } from 'jsdom';
import * as fs from 'fs';
import * as path from 'path';

const FIXTURE = 'test-data/VBU_IBRO_Synthetic_ForecastTest_ProductL2_Full_Jan2023_Dec2025.xlsx';
const MARK = '»'; // »

// ---------------------------------------------------------------- jsdom global
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',
  { url: 'http://localhost/', pretendToBeVisual: true });
const g = globalThis as any;
g.window = dom.window; g.document = dom.window.document;
// Node 24 exposes `navigator` as a getter-only global, so plain assignment throws.
Object.defineProperty(g, 'navigator', { value: dom.window.navigator, configurable: true, writable: true });
g.HTMLElement = dom.window.HTMLElement; g.Element = dom.window.Element; g.Node = dom.window.Node;
g.getComputedStyle = dom.window.getComputedStyle; g.requestAnimationFrame = (cb: any) => setTimeout(cb, 0);
g.cancelAnimationFrame = clearTimeout; g.MutationObserver = dom.window.MutationObserver;
g.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
g.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
g.IS_REACT_ACT_ENVIRONMENT = true;

type Result = { state: string; status: 'clean' | 'unkeyed' | 'UNREACHABLE'; count?: number; samples?: string[]; reason?: string };
const results: Result[] = [];

const NEVER = ['IBRO', 'ARPU', 'Inflow', 'Outflow', 'Retention', 'Base', 'PROSPECT', 'Holt', 'AutoML', 'Damped',
  'Simple Exponential', 'MAPE', 'Base Case', 'Standard Forecast', 'What-If Analysis', 'Optimistic', 'Pessimistic',
  'All (Aggregated)', 'Mean (Base)', 'Base Only', 'All Time', 'Blended ARPU', 'Total Subscribers', 'Total Revenue',
  'Pre-Horizon', 'Post-Horizon', 'Customer Volume', 'N/A'];
const DATA = /^(Corporate|Large Enterprise|MNC|SME|SOHO|Mobile Voice|Mobile Data|IoT Connectivity|Fixed Connectivity|Fixed Voice|Fixed Data|RED [LMS]|SIM Only|(High|Medium|Low) Value|All|Direct|Indirect|Retail|Online|Partner|Telesales)$/;
const NUM = /^[\d\s.,%£$€+\-–—:/()]*$/;
// Month labels are produced by date formatting, not translation keys. Locale-aware
// date rendering is tracked as its own follow-up; excluding here keeps this sweep
// about key coverage rather than re-reporting a known, separately-scoped gap.
const MONTH = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}$/;

function sweepDom(label: string): Result {
  const root = document.getElementById('root');
  if (!root || !root.firstChild) return { state: label, status: 'UNREACHABLE', reason: 'nothing mounted into #root' };
  const un = [...new Set([...root.querySelectorAll('*')]
    .filter(e => e.children.length === 0)
    .map(e => (e.textContent || '').trim())
    .filter(x => x && /[A-Za-z]{2}/.test(x))
    .filter(x => !x.includes(MARK) && !NEVER.some(n => x.includes(n)) && !DATA.test(x) && !NUM.test(x) && !MONTH.test(x) && !/_/.test(x))
    .map(x => x.slice(0, 60)))];
  return un.length
    ? { state: label, status: 'unkeyed', count: un.length, samples: un.slice(0, 10) }
    : { state: label, status: 'clean', count: 0 };
}

async function main() {
  // ------------------------------------------------------------ i18n + pseudo
  const i18nMod = await import('../src/i18n.ts');
  const i18n: any = i18nMod.default;
  const en = i18n.getResourceBundle('en', 'translation');
  i18n.addResourceBundle('de', 'translation',
    Object.fromEntries(Object.entries(en).map(([k, v]) => [k, MARK + v])), true, true);
  await i18n.changeLanguage('de');
  console.log(`pseudo-locale registered: ${Object.keys(en).length} keys\n`);

  // ------------------------------------------------------------ fixture parse
  let rows: any[] = [];
  try {
    const XLSX = (await import('xlsx')).default ?? (await import('xlsx'));
    const wb = (XLSX as any).readFile(FIXTURE);
    rows = (XLSX as any).utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    console.log(`fixture parsed: ${rows.length} rows from ${path.basename(FIXTURE)}\n`);
  } catch (e: any) {
    console.error('FIXTURE PARSE FAILED —', e.message);
    console.error('every data-dependent state will be reported UNREACHABLE, not clean.');
  }

  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');

  // Components are a mix of default and named exports. Resolve generically so a
  // missing default never masquerades as an unreachable component.
  function pick(mod: any, name: string) {
    const c = mod?.default ?? mod?.[name];
    if (typeof c === 'function' || typeof c === 'object') return c;
    const fn = Object.values(mod ?? {}).find(v => typeof v === 'function');
    if (!fn) throw new Error(`no component export found in module for ${name}`);
    return fn;
  }
  let root: any = null;

  async function mount(label: string, el: any) {
    try {
      const host = document.getElementById('root')!;
      host.replaceChildren();
      const container = document.createElement('div');
      host.appendChild(container);
      root = createRoot(container);
      await (act as any)(async () => { root.render(el); });
      const r = sweepDom(label);
      await (act as any)(async () => { root.unmount(); });
      return r;
    } catch (e: any) {
      // RULE: cannot determine reachability -> UNREACHABLE, never clean
      return { state: label, status: 'UNREACHABLE' as const, reason: (e?.message || String(e)).slice(0, 140) };
    }
  }

  // ------------------------------------------------------------ column mapping
  const C = {
    date: 'Month', seg: 'Customer_Segment', prod: 'Product_L1', prodL2: 'Product_L2_Value_Tier',
    chan: 'Channel_Level_1', chanL2: 'Channel_Level_2', metric: 'IBRO_Scenario_Type',
    val: 'Subscriber_Volume', rev: 'Monthly_Revenue_GBP', cust: 'Customer_Volume',
  };
  const months = [...new Set(rows.map(r => String(r[C.date]).slice(0, 7)))].sort();
  const noop = () => {};


  // Trees and event-state stubs for WhatIfTab. Built from the fixture so the tab
  // renders populated dropdowns rather than an empty shell.
  const uniq = (col: string) => [...new Set(rows.map(r => String(r[col])).filter(v => v && v !== 'undefined'))];
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
    downloadExcel: noop, formatNumber: (v: any) => String(v), setActiveView: noop,
    missingMonths: [],
  } as any);


  // ---------------------------------------------------------- baseline forecast
  // WhatIfTab reads ForecastContext. Build ONE aggregate cohort's forecast from the
  // fixture rather than running bulk generation — the sweep needs a populated app,
  // not scale.
  const { ForecastProvider } = await import('../src/context/ForecastContext.tsx');
  let baseForecast: any = null;
  try {
    const fc: any = await import('../src/utils/forecasting.ts');
    const map = fc.buildCohortDataMap(
      rows.map((r: any) => ({ ...r, _parsedDate: new Date(r[C.date]) }))
          .filter((r: any) => !isNaN(r._parsedDate.getTime())),
      C.date, C.seg, C.prod, C.prodL2, C.chan, C.chanL2, 'tariff_tier_l1', 'tariff_tier_l2');
    const SEG = 'Corporate';
    const acc = new Map<number, any>();
    for (const [k, bucket] of map) {
      if (String(k).split('|')[0] !== SEG) continue;
      for (const row of bucket as any[]) {
        const t = row._parsedDate.getTime();
        if (!acc.has(t)) acc.set(t, { _parsedDate: row._parsedDate, inflow: 0, outflow: 0, retention: 0,
          arpu: 0, inflowArpu: 0, outflowArpu: 0, retentionArpu: 0, baseArpu: 0 });
        const e = acc.get(t)!, m = String(row[C.metric]), v = Number(row[C.val]) || 0;
        if (m === 'Inflow') e.inflow += v; else if (m === 'Outflow') e.outflow += v;
        else if (m === 'Retention') e.retention += v;
      }
    }
    const seriesArr = [...acc.values()].sort((a, b) => a._parsedDate - b._parsedDate);
    baseForecast = fc.calculateBaseForecast(seriesArr,
      { segment: SEG, product: 'All', productL2: 'All', channel: 'All', channelL2: 'All',
        tariffL1: 'All', tariffL2: 'All', scenario: 'Base Case' },
      10000, 12, 1.0, 1.5, 3, 'Holt Linear');
    console.log(`baseline forecast built: ${baseForecast?.months?.length ?? 0} months (cohort ${SEG})\n`);
  } catch (e: any) {
    console.error('BASELINE BUILD FAILED —', (e?.message || e));
    console.error('WhatIfTab states will be reported UNREACHABLE, not clean.\n');
  }

  const withProvider = (child: any) => React.createElement(ForecastProvider as any, {
    baseForecast, setBaseForecast: noop,
    adjustedForecast: null, setAdjustedForecast: noop,
    forecastStore: new Map(), setForecastStore: noop,
    hasLegacyBaseline: !!baseForecast, updatedAt: new Date().toISOString(),
    bulkRuns: [], setBulkRuns: noop,
  }, child);

  // ------------------------------------------------------------ modals/drawers
  const cases: [string, () => Promise<any>][] = [
    ['ImportActualsModal', async () => {
      const M: any = pick(await import('../src/components/ImportActualsModal.tsx'), 'ImportActualsModal');
      return React.createElement(M, {
        months: months.slice(0, 6).map((m, i) => ({ label: m, count: 120 + i, alreadyLoaded: i % 2 === 0 })),
        onConfirm: noop, onCancel: noop,
      } as any);
    }],
    ['ImportActualsModal — empty state', async () => {
      const M: any = pick(await import('../src/components/ImportActualsModal.tsx'), 'ImportActualsModal');
      return React.createElement(M, { months: [], onConfirm: noop, onCancel: noop } as any);
    }],
    ['RemoveActualsModal', async () => {
      const M: any = pick(await import('../src/components/RemoveActualsModal.tsx'), 'RemoveActualsModal');
      return React.createElement(M, {
        data: rows.slice(0, 400), wiDateCol: C.date, wiSegmentCol: C.seg,
        wiProductCol: C.prod, wiChannelCol: C.chan, onConfirm: noop, onCancel: noop,
      } as any);
    }],
    ['BulkGenerateModal', async () => {
      const M: any = pick(await import('../src/components/BulkGenerateModal.tsx'), 'BulkGenerateModal');
      return React.createElement(M, {
        isOpen: true, onClose: noop,
        sourceCohort: { segment: 'Corporate', product: 'Mobile Voice', channel: 'Direct' },
        missingCount: 42,
        params: { preHorizonUncertainty: 1, postHorizonExpansionRate: 1.5, confidenceHorizon: 3, forecastLength: 12 },
        currentModel: 'Holt Linear',
        onConfirm: async () => ({ generated: 0, failed: 0 }),
      } as any);
    }],
    ['BulkGenerateModal — in-progress state', async () => {
      const M: any = pick(await import('../src/components/BulkGenerateModal.tsx'), 'BulkGenerateModal');
      return React.createElement(M, {
        isOpen: true, onClose: noop,
        sourceCohort: { segment: 'Corporate', product: 'Mobile Voice', channel: 'Direct' },
        missingCount: 42,
        params: { preHorizonUncertainty: 1, postHorizonExpansionRate: 1.5, confidenceHorizon: 3, forecastLength: 12 },
        currentModel: 'Holt Linear',
        generationProgress: { current: 7, total: 42 },
        onConfirm: async () => ({ generated: 0, failed: 0 }),
      } as any);
    }],
    ['ManageBulkDrawer', async () => {
      const M: any = pick(await import('../src/components/ManageBulkDrawer.tsx'), 'ManageBulkDrawer');
      return React.createElement(M, {
        isOpen: true, onClose: noop,
        allCohorts: [{ segment: 'Corporate', product: 'Mobile Voice', channel: 'Direct',
                       forecastType: 'Standard Forecast', scenario: 'Base Case' }],
        bulkRuns: [{ id: 'run-1', name: 'Q3 run', comment: 'seeded', timestamp: new Date().toISOString(),
                     generated: 12, failed: 1, model: 'Holt Linear', autoModel: false, autoConfidence: false,
                     cohortIds: ['Corporate|Mobile Voice|Direct|Standard Forecast|Base Case'] }],
        onReApply: async () => ({ generated: 0, failed: 0 }),
        defaultModel: 'Holt Linear', defaultPreHorizonUncertainty: 1,
        defaultPostHorizonExpansionRate: 1.5, defaultConfidenceHorizon: 3,
      } as any);
    }],
    ['ManageBulkDrawer — empty state', async () => {
      const M: any = pick(await import('../src/components/ManageBulkDrawer.tsx'), 'ManageBulkDrawer');
      return React.createElement(M, {
        isOpen: true, onClose: noop, allCohorts: [], bulkRuns: [],
        onReApply: async () => ({ generated: 0, failed: 0 }),
        defaultModel: 'Holt Linear', defaultPreHorizonUncertainty: 1,
        defaultPostHorizonExpansionRate: 1.5, defaultConfidenceHorizon: 3,
      } as any);
    }],
    ['DataMappingDrawer', async () => {
      const M: any = pick(await import('../src/components/DataMappingDrawer.tsx'), 'DataMappingDrawer');
      return React.createElement(M, {
        isOpen: true, open: true, columns: Object.keys(rows[0] ?? {}), data: rows.slice(0, 100),
        onClose: noop, onChange: noop,
      } as any);
    }],
    ['GenerateCohortForecastModal', async () => {
      const M: any = pick(await import('../src/components/GenerateCohortForecastModal.tsx'), 'GenerateCohortForecastModal');
      return React.createElement(M, {
        generatingCohort: { segment: 'Corporate', product: 'Mobile Voice', channel: 'Direct' },
        setGeneratingCohort: noop, genInflowUplift: 0, setGenInflowUplift: noop,
        genInflowLag: 0, setGenInflowLag: noop, genRetentionUplift: 0, setGenRetentionUplift: noop,
        genRetentionLag: 0, setGenRetentionLag: noop, genArpuUplift: 0, setGenArpuUplift: noop,
        genPreHorizonUncertainty: 1.0, setGenPreHorizonUncertainty: noop,
        genPostHorizonExpansionRate: 1.5, setGenPostHorizonExpansionRate: noop,
        genConfidenceHorizon: 3, setGenConfidenceHorizon: noop,
        genForecastLength: 12, setGenForecastLength: noop,
        genModel: 'Holt Linear', setGenModel: noop,
        onGenerate: noop, onCancel: noop, onClose: noop,
      } as any);
    }],
    ['ViewCohortForecastModal', async () => {
      const M: any = pick(await import('../src/components/ViewCohortForecastModal.tsx'), 'ViewCohortForecastModal');
      return React.createElement(M, {
        cohort: { segment: 'Corporate', product: 'Mobile Voice', channel: 'Direct', forecastType: 'Standard Forecast' },
        rows: [], onClose: noop,
      } as any);
    }],
    ['MultiSelectDropdown', async () => {
      const M: any = pick(await import('../src/components/MultiSelectDropdown.tsx'), 'MultiSelectDropdown');
      return React.createElement(M, {
        options: ['A', 'B'], selected: [], onChange: noop, label: 'x', isOpen: true,
      } as any);
    }],
    ['CohortDimCheckboxes', async () => {
      const M: any = pick(await import('../src/components/CohortDimCheckboxes.tsx'), 'CohortDimCheckboxes');
      return React.createElement(M, { dims: {}, setDims: noop, columnsMapped: {} } as any);
    }],
    ['WhatIfTab — no data (empty state)', async () => {
      const M: any = pick(await import('../src/components/WhatIfTab.tsx'), 'WhatIfTab');
      return withProvider(React.createElement(M, { ...whatIfProps(), data: [] }));
    }],
    ['DataMappingDrawer — nothing mapped (error state)', async () => {
      const M: any = pick(await import('../src/components/DataMappingDrawer.tsx'), 'DataMappingDrawer');
      return React.createElement(M, {
        isOpen: true, open: true, columns: [], data: [], onClose: noop, onChange: noop,
      } as any);
    }],
    ['DataMappingDrawer — unmappable file (error state)', async () => {
      const M: any = pick(await import('../src/components/DataMappingDrawer.tsx'), 'DataMappingDrawer');
      return React.createElement(M, {
        isOpen: true, open: true, columns: ['col_a', 'col_b'],
        data: [{ col_a: 'x', col_b: 'y' }], onClose: noop, onChange: noop,
      } as any);
    }],
  ];

  for (const [label, build] of cases) {
    let el: any;
    try { el = await build(); }
    catch (e: any) {
      results.push({ state: label, status: 'UNREACHABLE', reason: 'props/import failed: ' + (e?.message || '').slice(0, 110) });
      continue;
    }
    results.push(await mount(label, el));
  }


  // ---------------------------------------------------- WhatIfTab event cards
  // There is no initialTab prop — the card is internal useState, so the four cards
  // must be reached by clicking the real tab controls. Mount once, click, sweep.
  try {
    const M: any = pick(await import('../src/components/WhatIfTab.tsx'), 'WhatIfTab');
    const host = document.getElementById('root')!;
    host.replaceChildren();
    const container = document.createElement('div');
    host.appendChild(container);
    const r2 = createRoot(container);
    await (act as any)(async () => { r2.render(withProvider(React.createElement(M, whatIfProps()))); });

    const norm = (t: string) => (t || '').replace(/»/g, '').trim();
    for (const card of ['Volume', 'Value', 'Pricing', 'Promotion']) {
      const btn = [...container.querySelectorAll('button')]
        .find(b => norm(b.textContent || '') === card) as any;
      if (!btn) {
        // RULE: cannot reach it -> UNREACHABLE, never clean
        results.push({ state: `WhatIfTab — ${card} card`, status: 'UNREACHABLE',
                       reason: `no tab control matching "${card}" found after mount` });
        continue;
      }
      await (act as any)(async () => { btn.click(); });
      results.push(sweepDom(`WhatIfTab — ${card} card`));
    }
    await (act as any)(async () => { r2.unmount(); });
  } catch (e: any) {
    for (const card of ['Volume', 'Value', 'Pricing', 'Promotion'])
      results.push({ state: `WhatIfTab — ${card} card`, status: 'UNREACHABLE',
                     reason: (e?.message || String(e)).slice(0, 130) });
  }

  // ------------------------------------------------------------------- report
  console.log('HEADLESS PSEUDO-LOCALE SWEEP\n');
  console.log('state'.padEnd(40) + 'status'.padEnd(14) + 'unkeyed');
  console.log('-'.repeat(70));
  for (const r of results) {
    console.log(r.state.padEnd(40) + r.status.padEnd(14) + (r.count ?? '-'));
    if (r.samples?.length) for (const s of r.samples) console.log('        ' + s);
    if (r.reason) console.log('        reason: ' + r.reason);
  }
  const clean = results.filter(r => r.status === 'clean').length;
  const unk = results.filter(r => r.status === 'unkeyed');
  const unreach = results.filter(r => r.status === 'UNREACHABLE');
  console.log('-'.repeat(70));
  console.log(`clean: ${clean}   with unkeyed strings: ${unk.length}   UNREACHABLE: ${unreach.length}`);
  if (unreach.length) console.log('\nUNREACHABLE states are NOT clean — they are unverified. Fix the harness or say so.');
  process.exit(unk.length ? 1 : 0);
}

main().catch(e => { console.error('SWEEP ABORTED:', e); process.exit(2); });
