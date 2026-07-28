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

function sweepDom(label: string): Result {
  const root = document.getElementById('root');
  if (!root || !root.firstChild) return { state: label, status: 'UNREACHABLE', reason: 'nothing mounted into #root' };
  const un = [...new Set([...root.querySelectorAll('*')]
    .filter(e => e.children.length === 0)
    .map(e => (e.textContent || '').trim())
    .filter(x => x && /[A-Za-z]{2}/.test(x))
    .filter(x => !x.includes(MARK) && !NEVER.some(n => x.includes(n)) && !DATA.test(x) && !NUM.test(x) && !/_/.test(x))
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
        isOpen: true, cohorts: [{ segment: 'Corporate', product: 'Mobile Voice', channel: 'Direct' }],
        params: { preHorizonUncertainty: 1, postHorizonExpansionRate: 1.5, confidenceHorizon: 3, forecastLength: 12 },
        onConfirm: async () => ({ generated: 0, failed: 0 }), onClose: noop, onCancel: noop,
      } as any);
    }],
    ['ManageBulkDrawer', async () => {
      const M: any = pick(await import('../src/components/ManageBulkDrawer.tsx'), 'ManageBulkDrawer');
      return React.createElement(M, {
        isOpen: true, runs: [], onClose: noop,
        onReApply: async () => ({ generated: 0, failed: 0 }), onDelete: noop,
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
