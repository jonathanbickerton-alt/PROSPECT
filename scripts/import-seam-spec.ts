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

  // Sites are identified by their ENCLOSING FUNCTION, not by how the argument
  // is spelled. The first version of this table matched argument text and
  // accepted a site if ANY row's regex matched — so `setBaseForecast(bf)` in
  // acceptChallengerModel was silently absorbed by the row written for
  // generateStandardForecast, and two sites were accepted under the claim
  // "provenance is `accepted`, which the rule never retires" which is FALSE of
  // them. It passed, for the wrong reason, while asserting a safety property
  // that did not hold. A reason that is not bound to a specific site is not a
  // reason, it is a shape that happens to fit.
  const fnOf = (line: number): string => {
    for (let i = line - 1; i >= 0; i--) {
      const m = lines[i].match(/^  const ([A-Za-z0-9_]+)\s*=\s*(useCallback|async|\(|function)/);
      if (m) return m[1];
      if (/^  const handleFile|^  const importSession/.test(lines[i])) return 'importSession';
    }
    return '<top-level>';
  };

  // SEAM-ROUTED SITES ARE SELF-EVIDENT and are classified by their own text,
  // not by where they live: if the argument IS a seam call, the site is safe
  // wherever it sits. This also keeps the tab-restore sites (inside a useEffect,
  // which has no enclosing named const) from being lumped under whichever
  // function happens to precede them.
  const seamRouted = sites.filter(s => /resolveForecast\(|resolveFromStore\(/.test(s.text));
  check('ENUMERATION: the inline seam-routed sites are self-evidently safe',
    seamRouted.length === 2,
    `found ${seamRouted.length}, expected 2 (the two tab-restore arms)`);
  const rest = sites.filter(s => !seamRouted.includes(s));

  /** One row per SITE, keyed by enclosing function, with a reason true of it. */
  const ACCOUNTED: Record<string, { count: number; why: string; seam: boolean }> = {
    // These two destructure the seam result on the PRECEDING line, so the call
    // site's own text does not name it. The reason is verified against the
    // function body below rather than taken on trust.
    // Added by the walk fixes: after a scoped generate the aggregate is
    // resolved and shown. Seam-routed, and verified as such below.
    showResolvedAggregate: { count: 1, seam: true,
      why: 'sets the `forecast` destructured from resolveForecast(). The second site - a NULL clear - went away when the panel became derived: with nothing written there is nothing to clear' },
    handleStep2FilterChange: { count: 1, seam: true,
      why: 'sets the `forecast` destructured from resolveForecast() one line above' },
    handleStep3FilterChange: { count: 1, seam: true,
      why: 'sets the `forecast` destructured from resolveForecast() one line above' },
    handleImportSaveFile: { count: 2, seam: false,
      why: 'two sites: the Is_Active restore resolves via resolveFromStore before setting (bf); the legacy pre-option-C restore is CLEARED at the site (restoredBf)' },
    generateStandardForecast: { count: 2, seam: false,
      why: 'fresh fit; the anyAggregated decline above it makes an All-bearing cohort unreachable' },
    acceptChallengerModel: { count: 1, seam: false,
      why: 'provenance is overwritten to `accepted` at the site before storing; the rule only retires `fitted`' },
    // HONEST, WEAKER REASONS. These two store the raw calculateBaseForecast
    // output, whose provenance stays `fitted`. Nothing at the site prevents an
    // All-bearing key. Their safety rests entirely on the UI gate that stops a
    // derived selection reaching the accept controls - which is a real gate but
    // a weaker guarantee than the ones above, and it lives in a file this
    // branch does not touch. Recorded as residual risk in EXPECTED.md rather
    // than claimed away here.
    acceptPreviewForecast: { count: 1, seam: false,
      why: 'RESIDUAL RISK: provenance stays `fitted`; safety depends on the derivedMix UI gate, not on anything at this site' },
    acceptAllChallengerModels: { count: 1, seam: false,
      why: 'RESIDUAL RISK: provenance stays `fitted`; safety depends on the derivedMix UI gate, not on anything at this site' },
  };

  const byFn = new Map<string, number>();
  for (const s of rest) byFn.set(fnOf(s.line), (byFn.get(fnOf(s.line)) ?? 0) + 1);

  // The import fix specifically: the Is_Active site must resolve before setting.
  const importSites = rest.filter(s => fnOf(s.line) === 'handleImportSaveFile');
  check('ENUMERATION: both session-import sites were located', importSites.length === 2,
    `found ${importSites.length}`);

  const unaccounted = rest.filter(s => !(fnOf(s.line) in ACCOUNTED));
  check('ENUMERATION: every setBaseForecast call site is accounted for BY SITE',
    unaccounted.length === 0,
    unaccounted.map(s => `App.tsx:${s.line} in ${fnOf(s.line)}`).join(' ; ') || 'n/a');

  // Per-function counts are pinned too: a SECOND setBaseForecast appearing
  // inside an already-accounted function would otherwise inherit that
  // function's reason without anyone checking it still applies.
  for (const [fn, spec] of Object.entries(ACCOUNTED)) {
    check(`ENUMERATION: ${fn} still has exactly ${spec.count} site(s)`,
      (byFn.get(fn) ?? 0) === spec.count,
      `found ${byFn.get(fn) ?? 0} — reason on file: ${spec.why}`);
  }

  // And the claim that makes acceptChallengerModel safe is verified against the
  // source rather than asserted, because it is the one load-bearing claim in
  // the table that a source change could quietly falsify.
  // The `seam: true` rows claim a call the site's own line does not show. Verify
  // it in the body, or the claim is exactly the kind this table was rewritten
  // to stop accepting.
  for (const fn of Object.keys(ACCOUNTED).filter(f => ACCOUNTED[f].seam)) {
    const start = app.indexOf(`const ${fn} = useCallback`);
    const body = start === -1 ? '' : app.slice(start, app.indexOf('}, [resolveForecast]', start));
    check(`ENUMERATION: ${fn} really does call the seam`,
      start !== -1 && /resolveForecast\(/.test(body),
      'the reason on file claims a seam call this function does not make');
  }

  const acmStart = app.indexOf('const acceptChallengerModel = useCallback');
  const acmBody = app.slice(acmStart, app.indexOf('setBaseForecast(bf);', acmStart));
  check('ENUMERATION: acceptChallengerModel really does set provenance to `accepted`',
    acmStart !== -1 && /kind:\s*'accepted'/.test(acmBody),
    'the reason on file for this site is no longer true of it');

  // The count is pinned so that ADDING a site is a deliberate act. A new call
  // site that happens to match an accepted shape would otherwise slip in
  // unreviewed — matching a shape is not the same as having been thought about.
  const EXPECTED_SITES = 12;
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
