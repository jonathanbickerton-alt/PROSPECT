/**
 * THE SEAM IS THE ONLY DOOR — verified over the full set of call sites.
 *
 *   npm run spec:import-seam
 *
 * The retirement rule made `resolveForecast` SELECTIVE: it now refuses things a
 * raw `store.get(key)` would return. That instantly converted every other raw
 * store read into a divergence. Session import was one — it took the Is_Active
 * row straight to `setBaseForecast`, so opening a session whose active forecast
 * was a fit-on-aggregate showed the stale total on Step 1 until a filter change
 * quietly replaced it. Worse than showing it permanently: the number that
 * appears first is the one people write down.
 *
 * Fixing that one site is not the same as the claim "the seam is the only
 * door". This spec makes the claim checkable over the WHOLE set, the way the
 * 541-key enumeration made "no further" checkable: every `setBaseForecast` call
 * site in App.tsx must be either seam-routed or explicitly accounted for by
 * name, and a NEW unaccounted one fails this spec rather than passing silently.
 *
 * WHAT THIS SPEC DOES NOT DO, stated rather than implied: it does not mount
 * Step 1. `StandardForecastTab` takes ~40 props and the import path is a
 * closure inside App that reads a File, so neither can be driven headlessly
 * here. It measures the VALUE the import boundary produces, using the real
 * `resolveFromStore` and `buildRestoredLeafIndex`, and guards the WIRING
 * structurally. Trap 15 is what proves the structural half bites — without it
 * this spec would pass against a source that had reverted to the raw read,
 * which is exactly how trap 13 caught the same gap one commit ago.
 */
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import {
  buildCohortDataMap, buildRollUpIndex, buildRestoredLeafIndex, resolveFromStore,
  calculateBaseForecast, makeForecastKey,
} from '../src/utils/forecasting';
import type { BaseForecast } from '../src/types/forecast';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

// ── PART 1: the full enumeration of setBaseForecast call sites ────────────
// Each site is classified once, here, with its reason. A site that appears in
// App.tsx and not in this table fails the spec.
{
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  const lines = app.split('\n');
  const sites: { line: number; text: string }[] = [];
  lines.forEach((l, i) => {
    if (/(?<!const )\bsetBaseForecast\s*\(/.test(l) && !/setBaseForecast:/.test(l)) {
      sites.push({ line: i + 1, text: l.trim() });
    }
  });

  check('ENUMERATION: setBaseForecast call sites were found at all',
    sites.length > 0, 'the matcher found nothing — it is broken, not the code');

  /** Every accepted shape, with why it is safe. Order does not matter. */
  const ACCOUNTED: { why: string; test: (t: string) => boolean }[] = [
    { why: 'seam-routed: the argument is a resolveForecast/resolveFromStore result',
      test: t => /resolveForecast\(|resolveFromStore\(/.test(t) },
    { why: 'seam-routed via a local named `forecast` destructured from the seam',
      test: t => /^setBaseForecast\(forecast\);$/.test(t) },
    { why: 'seam-routed: import path resolves before setting (bf from resolveFromStore)',
      test: t => /^setBaseForecast\(bf\);$/.test(t) },
    { why: 'freshly fitted in generateStandardForecast, behind the anyAggregated decline',
      test: t => /^setBaseForecast\(bf\);$/.test(t) },
    { why: 'freshly accepted challenger — provenance is `accepted`, which the rule never retires',
      test: t => /^setBaseForecast\((finalBf|lastBf)\);$/.test(t) },
    { why: 'legacy pre-option-C import — CLEARED, see the comment at the site',
      test: t => /^setBaseForecast\(restoredBf\);$/.test(t) },
  ];

  const unaccounted = sites.filter(s => !ACCOUNTED.some(a => a.test(s.text)));
  check('ENUMERATION: every setBaseForecast call site is accounted for',
    unaccounted.length === 0,
    unaccounted.map(s => `App.tsx:${s.line} ${s.text}`).join(' ; ') || 'n/a');

  // The count is pinned so that ADDING a site is a deliberate act. A new call
  // site that happens to match an accepted shape would otherwise slip in
  // unreviewed — matching a shape is not the same as having been thought about.
  const EXPECTED_SITES = 11;
  check(`ENUMERATION: the call-site count is still ${EXPECTED_SITES}`,
    sites.length === EXPECTED_SITES,
    `found ${sites.length} — if this is intentional, classify the new site and update the count`);

  // The two import sites specifically, since they are the ones this fix moved.
  const importWindow = app.slice(app.indexOf('Use Is_Active cohort as the active forecast'),
                                 app.indexOf('Use Is_Active cohort as the active forecast') + 1600);
  check('WIRING: the Is_Active import site was located', importWindow.length > 100);
  const code = importWindow.replace(/\/\/[^\n]*/g, '');
  check('WIRING: the Is_Active import routes through resolveFromStore',
    code.includes('resolveFromStore('),
    'the import path reads the store raw again — the divergence is back');
  check('WIRING: and it builds its leaf index from the RESTORED store',
    code.includes('buildRestoredLeafIndex('),
    'resolving against the wrong index, or against uncommitted state');
  // Tightened after writing trap 15: the first version of this check tested
  // `/const bf = rawBf/`, which the reverted spelling `const bf = rawBf;`
  // satisfies perfectly. It would have passed against the exact defect it names.
  check('WIRING: the raw stored row is not what reaches setBaseForecast',
    !/const bf = rawBf\s*;/.test(code) && !/setBaseForecast\(rawBf\)/.test(code),
    'rawBf is assigned straight through — the seam is bypassed again');
}

// ── PART 2: what the boundary actually produces, on real fitted data ──────
const FIX = 'test-data/VBU_IBRO_EdgeCases_ShortHistory_PerScenarioARPU_Jan2023_Jun2026.xlsx';
const C = { date: 'Month', metric: 'IBRO_Scenario_Type', value: 'Subscriber_Volume',
  seg: 'Customer_Segment', prod: 'Product_L1', prodL2: 'Product_L2_Value_Tier',
  chan: 'Channel_Level_1', chanL2: 'Channel_Level_2',
  t1: 'tariff_tier_l1', t2: 'tariff_tier_l2', rev: 'Monthly_Revenue_GBP' };
const v = (r: any, k: string) => String(r[k] ?? '').trim();
const wb = XLSX.read(fs.readFileSync(FIX), { type: 'buffer', cellDates: true });
const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
const month = (r: any) => String(v(r, C.date)).slice(0, 7);

function fitScope(pred: (r: any) => boolean, cohort: any): BaseForecast | null {
  const sel = rows.filter(pred);
  if (!sel.length) return null;
  const acc = new Map<number, any>();
  for (const r of sel) {
    const d = new Date(month(r) + '-01'); if (isNaN(d.getTime())) continue;
    const t = d.getTime();
    if (!acc.has(t)) acc.set(t, { _parsedDate: d, inflow: 0, outflow: 0, retention: 0,
      arpu: 0, inflowArpu: 0, outflowArpu: 0, retentionArpu: 0, baseArpu: 0, _rev: 0, _vol: 0 });
    const e = acc.get(t)!, m = v(r, C.metric), val = Number(r[C.value]) || 0;
    if (m === 'Inflow') e.inflow += val; else if (m === 'Outflow') e.outflow += val;
    else if (m === 'Retention') e.retention += val;
    e._rev += Number(r[C.rev]) || 0; e._vol += val;
  }
  for (const e of acc.values()) {
    e.arpu = e._vol > 0 ? e._rev / e._vol : 0;
    e.inflowArpu = e.arpu; e.outflowArpu = e.arpu; e.retentionArpu = e.arpu; e.baseArpu = e.arpu;
  }
  const series = [...acc.values()].sort((a, b) => a._parsedDate - b._parsedDate);
  if (series.length < 8) return null;
  return calculateBaseForecast(series.slice(0, Math.max(4, series.length - 6)), cohort,
    1000, 12, 1.0, 1.5, 3, 'Holt Linear');
}

const dm = buildCohortDataMap(rows, C.date, C.seg, C.prod, C.prodL2, C.chan, C.chanL2, C.t1, C.t2);
const enumerated = [...dm.keys()];

// A restored store exactly as session import builds one: leaf fits, plus one
// fit-on-aggregate carrying the Is_Active flag — Jon's real artefact in shape.
const restored = new Map<string, BaseForecast>();
for (const k of enumerated) {
  const [seg, prod, prodL2, chan, chanL2, t1, t2] = k.split('|');
  const bf = fitScope(r => v(r, C.seg) === seg && v(r, C.prod) === prod && v(r, C.prodL2) === prodL2
    && v(r, C.chan) === chan && v(r, C.chanL2) === chanL2 && v(r, C.t1) === t1 && v(r, C.t2) === t2,
    { segment: seg, product: prod, productL2: prodL2, channel: chan, channelL2: chanL2,
      tariffL1: t1, tariffL2: t2, scenario: 'Base Case' });
  if (bf) restored.set(k, bf);
}
const seg0 = enumerated[0].split('|')[0];
const ACTIVE_KEY = makeForecastKey(seg0, 'All', 'All', 'All', 'All', 'All', 'All');
const staleFit = fitScope(r => v(r, C.seg) === seg0,
  { segment: seg0, product: 'All', productL2: 'All', channel: 'All', channelL2: 'All',
    tariffL1: 'All', tariffL2: 'All', scenario: 'Base Case' });
check('PREMISE: the Is_Active row is a fit-on-aggregate', !!staleFit && staleFit.provenance.kind === 'fitted');
if (staleFit) restored.set(ACTIVE_KEY, staleFit);

// The index the import builds. All-bearing keys must be excluded: the stale fit
// is still in the store, and enrolling it as a leaf would count its volume a
// second time on top of the leaves it was fitted from.
const idx = buildRestoredLeafIndex(restored.keys());
{
  const asLeafByMistake = buildRollUpIndex([...restored.keys()]).leafMap;
  check('INDEX: the retired aggregate is not enrolled as a leaf of itself',
    (idx.get(ACTIVE_KEY) ?? []).every(k => k !== ACTIVE_KEY),
    'the stale fit is a member of its own leaf set — double counting');
  check('INDEX: excluding All-bearing keys actually changes the index',
    JSON.stringify([...(idx.get(ACTIVE_KEY) ?? [])].sort())
      !== JSON.stringify([...(asLeafByMistake.get(ACTIVE_KEY) ?? [])].sort()),
    'positive control: if these agree, the exclusion is doing nothing and this check is vacuous');
}

// THE BOUNDARY. This is the value the import hands to setBaseForecast, computed
// by the same functions the source calls.
{
  const { forecast, reason } = resolveFromStore(restored, idx, ACTIVE_KEY);
  check('BOUNDARY: the import resolves to something, not null',
    !!forecast, `reason=${reason}`);
  check('BOUNDARY: it is NOT the stale stored object',
    !!forecast && forecast !== restored.get(ACTIVE_KEY),
    'the raw fit-on-aggregate is what reaches the screen');
  check('BOUNDARY: it is DERIVED',
    !!forecast && (forecast.provenance as any).kind === 'derived',
    forecast ? (forecast.provenance as any).kind : 'null');
  check('BOUNDARY: derived from more than one leaf',
    !!forecast && (forecast.provenance as any).leafCount > 1,
    forecast ? String((forecast.provenance as any).leafCount) : 'n/a');

  // And the numbers genuinely differ — otherwise every check above could pass
  // on a build where the two happened to coincide, proving nothing.
  const tot = (b: BaseForecast) => b.months.reduce((s, m) => s + (m.inflow?.mean ?? 0), 0);
  const stale = restored.get(ACTIVE_KEY)!;
  check('BOUNDARY: the derived total actually DIFFERS from the stale one',
    !!forecast && Math.abs(tot(forecast) - tot(stale)) > 1e-6,
    `derived=${forecast ? tot(forecast).toFixed(2) : 'n/a'} stale=${tot(stale).toFixed(2)} — if equal, this spec cannot detect the defect it exists for`);

  // A leaf key must still come back as its own stored fit, unchanged, through
  // the same call — the scope guard, at the import boundary this time.
  const leafKey = enumerated.find(k => restored.has(k))!;
  const leafRes = resolveFromStore(restored, idx, leafKey);
  check('BOUNDARY SCOPE: a leaf still returns its own stored fit',
    leafRes.forecast === restored.get(leafKey),
    'the import boundary is retiring leaves too');
}

console.log(`import-seam spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
