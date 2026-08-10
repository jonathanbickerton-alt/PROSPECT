/**
 * THE THREE THINGS JON'S WALK FOUND AT SECTION A, AND THE FOURTH IT BLOCKED ON.
 *
 *   npm run spec:walk-fixes
 *
 * ── 1. "Generate 1 missing" forever ───────────────────────────────────────
 *
 * `missing` meant has-no-forecast. One leaf in the edge fixture has two months
 * of history and cannot be fitted, so it never acquired a forecast, so it was
 * counted as missing on every render. The button invited a generate, the
 * generate produced nothing, the count did not move, and the loop had no exit.
 *
 * `missing` now means fittable-and-not-fitted. A leaf a run has PROVED
 * unfittable leaves the count and gets its own statement. Unfittability is only
 * knowable by trying, so the known-unfittable set starts empty and grows from
 * run results — a leaf is generatable until something demonstrates otherwise.
 *
 * The state machine, which is the part worth pinning:
 *
 *   N fittable-missing > 0            -> 'generate', count N
 *   0 fittable-missing, unfittable > 0 -> 'blocked', named, NOT an invitation
 *   0 and 0                            -> 'covered'
 *   no leaves at all                   -> 'never'
 *
 * 'blocked' and 'covered' both have zero generatable leaves and mean opposite
 * things. So do 'covered' and 'never'. Three distinct zero states, and
 * collapsing any pair is the defect.
 *
 * ── 2. The forecast must be VISIBLE when generation finishes ──────────────
 *
 * The user story ends with a forecast on screen, not a placeholder. After a
 * scoped run the aggregate is resolved through the seam and set as the base
 * forecast, with no further interaction.
 *
 * ── 3. The error banner outlived its subject ─────────────────────────────
 *
 * "Not enough valid data points" was raised for one cohort and never cleared,
 * so it followed the user across selections onto unrelated screens. Cleared on
 * selection change.
 *
 * ── 4. Generate Missing permanently disabled ─────────────────────────────
 *
 * Independent of 1 and 3, and the mechanism is the one this codebase keeps
 * meeting: `isGeneratingMissing` was cleared in a `finally` at the bulk modal's
 * call site, not inside the function. Session H added a second caller that does
 * not go through the modal, so a throw on that path left the flag set and the
 * button disabled forever. The wrapper's own comment predicted this symptom
 * exactly. The `finally` now lives inside the function.
 */
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import {
  buildCohortDataMap, buildRollUpIndex, missingLeavesForKey, resolveFromStore,
  calculateBaseForecast, makeForecastKey,
} from '../src/utils/forecasting';
import type { BaseForecast } from '../src/types/forecast';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

const FIX = 'test-data/VBU_IBRO_EdgeCases_ShortHistory_PerScenarioARPU_Jan2023_Jun2026.xlsx';
const C = { date: 'Month', metric: 'IBRO_Scenario_Type', value: 'Subscriber_Volume',
  seg: 'Customer_Segment', prod: 'Product_L1', prodL2: 'Product_L2_Value_Tier',
  chan: 'Channel_Level_1', chanL2: 'Channel_Level_2',
  t1: 'tariff_tier_l1', t2: 'tariff_tier_l2', rev: 'Monthly_Revenue_GBP' };
const v = (r: any, k: string) => String(r[k] ?? '').trim();
const wb = XLSX.read(fs.readFileSync(FIX), { type: 'buffer', cellDates: true });
const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
const month = (r: any) => String(v(r, C.date)).slice(0, 7);

function seriesFor(k: string) {
  const [seg, prod, prodL2, chan, chanL2, t1, t2] = k.split('|');
  const sel = rows.filter(r => v(r, C.seg) === seg && v(r, C.prod) === prod && v(r, C.prodL2) === prodL2
    && v(r, C.chan) === chan && v(r, C.chanL2) === chanL2 && v(r, C.t1) === t1 && v(r, C.t2) === t2);
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
  return [...acc.values()].sort((a, b) => a._parsedDate - b._parsedDate);
}
function fitLeafKey(k: string): BaseForecast | null {
  const [seg, prod, prodL2, chan, chanL2, t1, t2] = k.split('|');
  return calculateBaseForecast(seriesFor(k),
    { segment: seg, product: prod, productL2: prodL2, channel: chan, channelL2: chanL2,
      tariffL1: t1, tariffL2: t2, scenario: 'Base Case' } as any,
    1000, 12, 1.0, 1.5, 3, 'Holt Linear');
}

const dm = buildCohortDataMap(rows, C.date, C.seg, C.prod, C.prodL2, C.chan, C.chanL2, C.t1, C.t2);
const { leafMap } = buildRollUpIndex([...dm.keys()]);
const AGG = makeForecastKey('All', 'All', 'All', 'All', 'All', 'All', 'All');

/** The App's state machine, as a pure function of what the engine reports. */
type Kind = 'generate' | 'blocked' | 'covered' | 'never';
function stateOf(store: Map<string, BaseForecast>, unfittable: ReadonlySet<string>): {
  kind: Kind; missing: number; unfittable: number;
} {
  const r = missingLeavesForKey(AGG, leafMap, store, unfittable);
  if (!r.enumerated) return { kind: 'never', missing: 0, unfittable: 0 };
  if (r.missing.length > 0) return { kind: 'generate', missing: r.missing.length, unfittable: r.unfittable.length };
  if (r.unfittable.length > 0) return { kind: 'blocked', missing: 0, unfittable: r.unfittable.length };
  return { kind: 'covered', missing: 0, unfittable: 0 };
}

// ── THE LOOP JON HIT, reproduced then closed ──────────────────────────────
{
  const store = new Map<string, BaseForecast>();
  let unfittable = new Set<string>();

  const first = stateOf(store, unfittable);
  check('COLD: every leaf is generatable before anything has been tried',
    first.kind === 'generate' && first.missing === 74,
    `${first.kind}/${first.missing}`);
  check('COLD: nothing is known-unfittable yet — it is only knowable by trying',
    first.unfittable === 0);

  // Run 1: fit what can be fitted; record what could not.
  const r1 = missingLeavesForKey(AGG, leafMap, store, unfittable);
  const skipped: string[] = [];
  for (const k of r1.missing) {
    const bf = fitLeafKey(k);
    if (bf) store.set(k, bf); else skipped.push(k);
  }
  check('RUN 1: 72 fitted, 2 could not be', store.size === 72 && skipped.length === 2,
    `${store.size} fitted, ${skipped.length} skipped`);

  // THE OLD BEHAVIOUR, still measurable: without the known-unfittable set the
  // state stays 'generate' with the same count, forever. This is the check that
  // proves the fix is doing something rather than the fixture being kind.
  const withoutMemory = stateOf(store, new Set());
  check('WITHOUT THE FIX: the button still invites a generate that does nothing',
    withoutMemory.kind === 'generate' && withoutMemory.missing === 2,
    `${withoutMemory.kind}/${withoutMemory.missing} — if this is not 'generate' the defect no longer reproduces and these checks prove nothing`);

  unfittable = new Set(skipped);
  const second = stateOf(store, unfittable);
  check('AFTER RUN 1: the state is BLOCKED, not generate',
    second.kind === 'blocked', second.kind);
  check('AFTER RUN 1: and it names how many are unfittable',
    second.unfittable === 2, String(second.unfittable));
  check('AFTER RUN 1: nothing is offered for generation',
    second.missing === 0, String(second.missing));

  // Idempotence: clicking again cannot re-enter the loop.
  const third = stateOf(store, unfittable);
  check('STABLE: the state does not oscillate on a second look',
    third.kind === 'blocked' && third.missing === 0);
}

// ── THE THREE ZERO STATES ARE DISTINCT ────────────────────────────────────
{
  const full = new Map<string, BaseForecast>();
  const skipped: string[] = [];
  for (const k of leafMap.get(AGG)!) {
    const bf = fitLeafKey(k);
    if (bf) full.set(k, bf); else skipped.push(k);
  }
  const blocked = stateOf(full, new Set(skipped));
  check('ZERO STATES: unfittable present -> blocked', blocked.kind === 'blocked');

  // 'covered' needs a scope with no unfittable leaves in it. Take one segment
  // whose leaves all fit.
  const segs = [...new Set([...dm.keys()].map(k => k.split('|')[0]))];
  const cleanSeg = segs.find(sg => {
    const key = makeForecastKey(sg, 'All', 'All', 'All', 'All', 'All', 'All');
    return (leafMap.get(key) ?? []).every(k => !skipped.includes(k));
  });
  check('ZERO STATES PREMISE: a fully-fittable scope exists to test covered with',
    !!cleanSeg, 'every segment contains an unfittable leaf — covered is untestable here');
  if (cleanSeg) {
    const key = makeForecastKey(cleanSeg, 'All', 'All', 'All', 'All', 'All', 'All');
    const r = missingLeavesForKey(key, leafMap, full, new Set(skipped));
    check('ZERO STATES: all fitted, none unfittable -> covered',
      r.enumerated && r.missing.length === 0 && r.unfittable.length === 0);
  }
  const never = missingLeavesForKey(
    makeForecastKey('No Such Segment', 'All', 'All', 'All', 'All', 'All', 'All'),
    leafMap, full, new Set(skipped));
  check('ZERO STATES: no leaves at all -> never', !never.enumerated);
  check('ZERO STATES: never is distinguishable from covered by `enumerated` alone',
    never.enumerated === false,
    'both report zero missing — only `enumerated` separates them');
}

// ── THE STATE MACHINE IN THE APP, not just in this file ───────────────────
// `stateOf` above is a TRANSCRIPTION of App's memo — it cannot be driven
// headlessly, so mutating App.tsx leaves every check above green. Trap 24
// proved exactly that by collapsing the blocked branch and going unnoticed.
// Same fault trap 13 found in the retire spec, and the same answer: guard the
// wiring structurally, so the trap has something to kill.
{
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  const start = app.indexOf('const stdAggregateState = useMemo');
  check('MACHINE ANCHOR: stdAggregateState was found', start !== -1,
    'renamed — this guard is blind, fix it before trusting the checks above');
  const body = start === -1 ? ''
    : app.slice(start, app.indexOf('populatedCohorts, forecastStore, unfittableLeaves]', start));
  const code = body.replace(/\/\/[^\n]*/g, '');

  check('MACHINE: the memo is given the known-unfittable set',
    /missingLeavesForKey\([\s\S]{0,200}unfittableLeaves/.test(code),
    'it cannot tell a generatable leaf from one that will never fit');
  check('MACHINE: a blocked state exists',
    /kind: 'blocked'/.test(code),
    'the two zero states are collapsed — a blocked scope will claim full coverage');
  check('MACHINE: blocked is decided BEFORE covered',
    code.indexOf("kind: 'blocked'") < code.indexOf("kind: 'covered'"),
    'covered wins first, so blocked is unreachable');
  check('MACHINE: the blocked branch is reachable — it is not gated on a constant',
    /if \(unfittable\.length > 0\)/.test(code),
    'the branch is present but dead');
  check('MACHINE: all four states are produced',
    ["'generate'", "'blocked'", "'covered'", "'never'"].every(k => code.includes(`kind: ${k}`)),
    'a state was dropped');
  // The button must actually honour blocked, or the memo is correct and unread.
  const tab = fs.readFileSync('src/components/StandardForecastTab.tsx', 'utf8');
  check('MACHINE: the button is disabled in the blocked state',
    /disabled=\{[\s\S]{0,200}=== 'blocked'/.test(tab),
    'a blocked scope still offers a generate that would do nothing');
  check('MACHINE: and says why, rather than reusing the covered wording',
    /standard_scope_blocked/.test(tab),
    'blocked renders as covered — the collapse moved to the label');
}

// ── THE FORECAST IS VISIBLE WHEN THE RUN ENDS ─────────────────────────────
{
  const store = new Map<string, BaseForecast>();
  for (const k of leafMap.get(AGG)!) { const bf = fitLeafKey(k); if (bf) store.set(k, bf); }
  const { forecast } = resolveFromStore(store, leafMap, AGG);
  check('VISIBLE: the aggregate resolves immediately after its leaves are fitted',
    !!forecast, 'the run ends with nothing to show');
  check('VISIBLE: and it is derived, with real months on it',
    !!forecast && (forecast.provenance as any).kind === 'derived' && forecast.months.length > 0,
    forecast ? `${(forecast.provenance as any).kind}/${forecast.months.length}` : 'null');

  // Wiring: the App must actually do this, not merely be able to.
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  // ANCHORED TO THE CONFIRMED RUN, not to the button. The scoped run moved out
  // of the Step 1 branch and into the modal's onConfirm on 2026-08-08: the
  // button now opens a confirm panel, and the run starts when the user accepts.
  // Everything below is unchanged in substance — the same call, the same
  // hand-off, the same unfittable bookkeeping — so these were re-anchored
  // rather than relaxed. They went RED at the move, which is the point of
  // pinning a site: a check that searched the whole file instead would have
  // stayed green and told nobody the run had changed hands.
  const start = app.indexOf('restrictToLeafKeys: new Set(pendingScopedRun.leafKeys)');
  const after = app.slice(start, start + 2200).replace(/\/\/[^\n]*/g, '');
  check('VISIBLE WIRING: the confirmed scoped run is reachable at its new site',
    start !== -1, 'the scoped run is gone — every check below it is blind');
  // The run HANDS OFF rather than resolving inline, because the store it just
  // wrote has not committed when the .then fires. The first version read it by
  // passing an identity updater to setForecastStore — a state setter used as a
  // getter, which the mirror control correctly counted as a store write.
  check('VISIBLE WIRING: the scoped run hands the aggregate to the render effect',
    // The key is carried on the pending run now rather than closed over by the
    // branch, because the confirm happens after the click and the selection
    // could have moved. Same hand-off, sourced from the run being confirmed.
    /setPendingAggregateKey\(pendingScopedRun\.aggKey\)/.test(after),
    'the run finishes without asking for anything to be shown');
  check('VISIBLE WIRING: and does NOT abuse the store setter to read state',
    !/setForecastStore\(/.test(after),
    'a reader that looks like a writer is one refactor from being one');
  check('VISIBLE WIRING: the skipped leaves are recorded as known-unfittable',
    /setUnfittableLeaves\(/.test(after), 'the loop can re-enter on the next render');

  const res = app.indexOf('const showResolvedAggregate = useCallback');
  check('VISIBLE WIRING: the resolver exists', res !== -1, 'renamed — this guard is blind');
  const rbody = res === -1 ? '' : app.slice(res, app.indexOf('}, [resolveForecast]);', res));
  check('VISIBLE WIRING: it resolves through the seam',
    /resolveForecast\(key\)/.test(rbody), 'it reads the store directly');
  check('VISIBLE WIRING: and sets it as the base forecast',
    /setBaseForecast\(forecast\)/.test(rbody), 'it resolves and then discards the result');
  const eff = app.indexOf('if (!pendingAggregateKey) return;');
  check('VISIBLE WIRING: an effect drives it after the store commits',
    eff !== -1 && /showResolvedAggregate\(pendingAggregateKey\)/.test(app.slice(eff, eff + 1400)),
    'nothing calls the resolver');

  // Found by the gate: generation runs in a worker pool, so a user can start a
  // Step 1 generate and switch tabs before it lands. Without this gate the
  // effect calls setBaseForecast with Step 1's aggregate while they are looking
  // at Step 2 or 3, replacing the cohort under them.
  const effBody = eff === -1 ? '' : app.slice(eff, eff + 1400);
  check('VISIBLE WIRING: it only fires while the user is still on Step 1',
    /activeView !== 'standard'/.test(effBody),
    'a Step 1 result can overwrite what the user is looking at on Step 2 or 3');
  check('VISIBLE WIRING: and discards the pending key rather than holding it',
    /activeView !== 'standard'\) \{ setPendingAggregateKey\(null\); return; \}/.test(effBody),
    'the result would resurrect on return, from a selection the user has left');
  check('VISIBLE WIRING: activeView is in the dependency array',
    /\[pendingAggregateKey, forecastStore, showResolvedAggregate, activeView\]/.test(app),
    'the gate is read but the effect will not re-run when it changes');
}

// ── THE BANNER DOES NOT OUTLIVE ITS SUBJECT ───────────────────────────────
{
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  const i = app.indexOf("Transient generation feedback is cleared when the SELECTION changes");
  check('BANNER ANCHOR: the clearing effect was found', i !== -1,
    'removed or renamed — this guard is blind');
  const eff = i === -1 ? '' : app.slice(i, app.indexOf('}, [', i) + 220);
  check('BANNER: the effect clears the error', /setError\(''\)/.test(eff));
  check('BANNER: and the stale result panel with it', /setStdGenerateResult\(null\)/.test(eff));
  for (const d of ['segmentValue', 'productValue', 'productL2Value', 'channelValue',
                   'channelL2Value', 'tariffValue', 'tariffL2Value']) {
    check(`BANNER: ${d} change clears it`, eff.includes(d),
      'a selection dimension the banner can survive');
  }
  // It must NOT be keyed on anything that changes during a generate, or it
  // would wipe the message the generate just raised.
  check('BANNER: not keyed on the store or the result itself',
    !/forecastStore|stdGenerateResult\b(?!\s*\()/.test(eff.slice(eff.indexOf('}, ['))),
    'the effect would erase the error the generate just set');
}

// ── THE PANEL GATE, which swallowed the last fix ─────────────────────────
// Jon's second walk: 72 leaves generated, "Ready to forecast" still on screen.
// StandardForecastTab renders the whole result panel behind
// `forecastData.length > 0`, and the aggregate path set only `baseForecast`.
// The store was right and the surface was never reached.
//
// spec:step1-panel is what actually proves the panel mounts - it renders the
// real component so the gate is INSIDE the assertion. These are the wiring
// half: the App must populate the state that gate reads.
{
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  const res = app.indexOf('const showResolvedAggregate = useCallback');
  const body = res === -1 ? '' : app.slice(res, app.indexOf('stdSelectionFilter, t]);', res));
  check('PANEL: the resolver populates forecastData, not only baseForecast',
    /setForecastData\(/.test(body),
    'the panel gate stays shut and the placeholder persists - the exact walk failure');
  check('PANEL: it still sets baseForecast too',
    /setBaseForecast\(forecast\)/.test(body), 'the context lost its forecast');
  check('PANEL: the historical scope uses the SHARED predicate, not a copy',
    /rowInScope\(row, scopeCols, scopeFilter, ALL_DIMS\)/.test(body),
    'a private scope test has grown back - it drifted from the shared one last time');
  // The rows moved into buildAggregateForecastRows when the mounted spec
  // needed to drive production code rather than a copy. This check went RED
  // rather than passing over a body that no longer built them - which is what
  // the anchor is for.
  const engine = fs.readFileSync('src/utils/forecasting.ts', 'utf8');
  const bi = engine.indexOf('export function buildAggregateForecastRows');
  check('PANEL ANCHOR: the row builder was found', bi !== -1,
    'renamed - this guard is blind, fix it');
  const bbody = bi === -1 ? '' : engine.slice(bi, engine.indexOf('export function missingLeavesForKey', bi));
  check('PANEL: the rows carry the Type field the chart splits on',
    /Type: 'Historical'/.test(bbody) && /Type: 'Forecast'/.test(bbody),
    'stdChartData cannot tell history from forecast');
  // The call moved from showResolvedAggregate to the stdPanelRows memo when
  // the panel stopped being written and started being derived. This check went
  // RED rather than passing over a body that no longer calls it.
  const memoStart = app.indexOf('const stdPanelRows = useMemo');
  check('PANEL ANCHOR: the panel resolver was found', memoStart !== -1,
    'renamed - this guard is blind');
  const memoBody = memoStart === -1 ? '' : app.slice(memoStart, app.indexOf('postHorizonExpansionRate]);', memoStart));
  // EVERY consumer of the panel rows must read the DERIVED ones. The
  // window-offset effect was left reading the old `forecastData` state, so it
  // silently stopped firing for aggregate and restored views - the chart drew
  // but no longer centred on the history/forecast transition. Nothing failed,
  // because the diff shrank the effect's reach without touching a line of it.
  // Found by the gate; this is the check that would have found it.
  {
    // Comments mentioning the old state are prose, not consumers; and the
    // bulk path has its own unrelated local of the same name.
    const isComment = (l: string) => /^\s*(\/\/|\*|\/\*)/.test(l);
    const readers = app.split(String.fromCharCode(10)).map((l, k) => ({ l, i: k + 1 }))
      .filter(x => x.l.includes('forecastData') && !isComment(x.l)
        && !/setForecastData|forecastData:|forecastData=\{|const forecastData/.test(x.l));
    // Only the compare-mode branch and the memo's own dep may still read the
    // raw state. Anything else is a consumer that missed the switch.
    const stray = readers.filter(x => !/compareCategories\.length > 0/.test(x.l)
      && !/^\s*\}, \[compareCategories, forecastData,/.test(x.l));
    check('PANEL: no consumer still reads the raw written state',
      stray.length === 0,
      stray.map(x => `App.tsx:${x.i} ${x.l.trim().slice(0, 70)}`).join(' ; ') || 'n/a');
    check('PANEL: the window-offset effect reads the derived rows',
      /if \(stdPanelRows\.length > 0 && activeView === 'standard'\)/.test(app),
      'the chart no longer centres on the transition for derived views');
  }

  check('PANEL: the panel derives through the shared resolver, not inline rows',
    /buildPanelRowsFromStore\(/.test(memoBody),
    'the row building grew back inside a closure, out of the mounted spec reach');
  check('PANEL: and it asks the SEAM what exists for the selection',
    /resolveForecast/.test(memoBody),
    'the panel reads something other than the store - a restored session goes blank again');
  // A stored forecast carries no Base VOLUME band, so the Base scenario cannot
  // be plotted from the panel. Saying so beats plotting a different band under
  // its name — the substance this has always checked.
  //
  // RE-PINNED 2026-08-10 (Unit B). The notice used to be one flat claim that a
  // summed aggregate HAS no Base series. That stopped being true when the seed
  // became explicit: Base is reconstructed from an opening stock plus flows, so
  // an all-seeded aggregate can produce one and Step 3 draws it. The notice is
  // now two branches off the shared predicate, so this pins BOTH — the check
  // went red at the change rather than passing over it, which is the point of
  // pinning a string.
  check('PANEL: the Base scenario is declined rather than substituted',
    /standard_base_panel_has_no_band/.test(body)
      && /standard_base_no_opening_stock/.test(body),
    'a Base selection would plot inflow, outflow or retention under a Base label');

  const tab = fs.readFileSync('src/components/StandardForecastTab.tsx', 'utf8');
  check('PANEL: the gate this is feeding is still the one we think',
    /forecastData\.length > 0 && !emptyCohortSelection/.test(tab),
    'the panel gate changed - re-read what opens it before trusting these checks');
}

// ── THE forecastData WRITER ENUMERATION ───────────────────────────────────
// Session L made the panel DERIVE, so `forecastData` should now matter only in
// compare mode. It does not follow that the writes went away: there are still
// seven, and four of them no longer reach the panel at all. They are harmless
// today and they are exactly the shape that stops being harmless — a future
// convenience write would join a list nobody is counting.
//
// Pinned by SITE and by COUNT, the same shape as the setBaseForecast
// enumeration: an eighth site fails here rather than passing silently. The four
// dead writes are NOT deleted by this spec; removing them is a behaviour change
// to compare-mode entry/exit and to onSelectCohort, backlogged separately.
{
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  const lines = app.split(String.fromCharCode(10));
  const isComment = (l: string) => /^\s*(\/\/|\*|\/\*)/.test(l);
  const sites: { line: number; text: string }[] = [];
  lines.forEach((l, i) => {
    if (l.includes('setForecastData(') && !isComment(l)
        && !/const \[forecastData/.test(l)) sites.push({ line: i + 1, text: l.trim() });
  });
  check('WRITERS: setForecastData sites were found at all', sites.length > 0,
    'the matcher is broken, not the code');

  const fnOf = (line: number): string => {
    for (let i = line - 1; i >= 0; i--) {
      const m = lines[i].match(/^  const ([A-Za-z0-9_]+)\s*=\s*(useCallback|async|\(|function)/);
      if (m) return m[1];
    }
    return '<top-level>';
  };

  /** One row per enclosing function, with a reason true of it. */
  const WRITERS: Record<string, { count: number; why: string }> = {
    handleFileUpload: { count: 1,
      why: 'clears on a new upload - legitimate, and the only write that is not a panel feed' },
    onSelectCohort: { count: 1,
      why: 'DEAD for the panel: writes savedForecasts rows, which stdPanelRows never reads outside compare mode' },
    generateStandardForecast: { count: 5,
      why: '3 compare-mode branches (the permitted writers) + the legacy multi-combo branch and the single-cohort manual generate, both DEAD for the panel since it derives' },
  };

  const byFn = new Map<string, number>();
  for (const st of sites) byFn.set(fnOf(st.line), (byFn.get(fnOf(st.line)) ?? 0) + 1);

  const unaccounted = sites.filter(st => !(fnOf(st.line) in WRITERS));
  check('WRITERS: every setForecastData site is accounted for BY SITE',
    unaccounted.length === 0,
    unaccounted.map(st => `App.tsx:${st.line} in ${fnOf(st.line)}`).join(' ; ') || 'n/a');

  const EXPECTED_WRITERS = 7;
  check(`WRITERS: the site count is still ${EXPECTED_WRITERS}`,
    sites.length === EXPECTED_WRITERS,
    `found ${sites.length} - classify the new site before changing this number`);

  for (const [fn, spec] of Object.entries(WRITERS)) {
    check(`WRITERS: ${fn} still has exactly ${spec.count} site(s)`,
      (byFn.get(fn) ?? 0) === spec.count,
      `found ${byFn.get(fn) ?? 0} - reason on file: ${spec.why}`);
  }

  // The claim that makes four of them dead. If the panel ever stops deriving,
  // this enumeration's reasons become false and the count is the least of it.
  check('WRITERS: the panel still reads forecastData ONLY in compare mode',
    /if \(compareCategories\.length > 0\) return forecastData;/.test(app),
    'the panel reads written state again - every "DEAD" reason above is now wrong');
}

// ── THE MACHINE'S SCOPE: aggregates only, and only MAPPED ones ────────────
// Every Step 1 dimension defaults to 'All (Aggregated)', so an UNMAPPED
// dimension left at its default made every selection look aggregated - and a
// genuine leaf then fell into the aggregate state machine, where a fitted
// scope reads `covered` and disables the button. A leaf whose forecast exists
// became un-regenerable.
{
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  const i = app.indexOf('const stdAggregatesMappedDim = useMemo');
  check('SCOPE ANCHOR: the predicate was found', i !== -1,
    'renamed - this guard is blind');
  const body = i === -1 ? '' : app.slice(i, app.indexOf('channelValue, tariffValue]);', i));
  for (const [dim, col] of [['segment', 'wiSegmentCol'], ['product', 'wiProductCol'],
                            ['channel', 'wiChannelCol'], ['tariff', 'wiTariffL1Col']] as const) {
    check(`SCOPE: the ${dim} test requires the column to be MAPPED`,
      new RegExp(`!!${col}\\s*&&`).test(body),
      'an unmapped dimension at its default still reads as an aggregate');
  }
  // ONE predicate, not two. It was two copies - one in the button's state
  // machine, one in the generate handler - which must agree about what the
  // button offers and what the click does.
  const copies = (app.match(/=== 'All \(Aggregated\)' \|\|/g) ?? []).length;
  check('SCOPE: there is a single aggregation predicate, not a copy per caller',
    copies <= 3,
    `found ${copies} chained All-checks - the button and the handler can disagree`);
  check('SCOPE: the state machine reads it', /if \(!stdAggregatesMappedDim\)/.test(app),
    'the machine has its own notion of aggregated again');
  check('SCOPE: and so does the generate handler', /if \(stdAggregatesMappedDim\) \{/.test(app),
    'the handler has its own notion of aggregated again');
}

// ── A COVERAGE STATEMENT IS NOT AN ERROR ─────────────────────────────────
// Raised by the gate. Session I made the completion modal a coverage statement
// rather than a success claim; routing "the remaining cohorts have too little
// history" through a red error banner one screen away would contradict that.
// Red says something went wrong. These messages report what was built.
{
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  const tab = fs.readFileSync('src/components/StandardForecastTab.tsx', 'utf8');

  for (const key of ['standard_scope_blocked_by_unfittable', 'standard_all_leaves_present',
                     'standard_selection_never_enumerated']) {
    const i = app.indexOf(key);
    check(`NOTICE: ${key} is a notice, not an error`, i !== -1
      && /setNotice\(/.test(app.slice(Math.max(0, i - 260), i)),
      'a coverage statement is being reported as a failure');
  }
  // The genuine failures must STAY on the error surface, or this has traded one
  // miscategorisation for another.
  // Anchored on the CODE form. The first version searched for the message text
  // and found it in a comment above, so it was testing prose rather than a call
  // site — and reported a failure that was entirely its own.
  const realFailures = (app.match(/setError\('Not enough valid data points/g) ?? []).length;
  check('NOTICE: real failures are still errors', realFailures === 2,
    `found ${realFailures} — everything became a notice, which is the same defect facing the other way`);

  check('NOTICE: the tab renders the notice on its own non-red surface',
    /\{notice && <div className="mb-6 bg-slate-50/.test(tab),
    'the notice has no surface, or reuses the red one');
  check('NOTICE: and the error banner is still red',
    /\{error && <div className="mb-6 bg-red-50/.test(tab),
    'the error surface lost its distinctness');
  check('NOTICE: the notice is cleared on selection change with the error',
    /setNotice\(''\)/.test(app),
    'a coverage statement can now outlive its scope — the defect this session fixed');
}

// ── THE FLAG CANNOT STAY STUCK ────────────────────────────────────────────
{
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  const start = app.indexOf('setIsGeneratingMissing(true);');
  const end = app.indexOf('}, [allCohorts, missingStandardCohorts', start);
  const body = app.slice(start, end);
  check('FLAG: the clear is inside the function, in a finally',
    /\}\s*finally\s*\{[\s\S]{0,400}setIsGeneratingMissing\(false\);/.test(body),
    'a throw still leaves Generate Missing disabled forever');
  // Anti-vacuity: there must be exactly one clear inside the function, and it
  // must be the one in the finally — a stray unconditional clear before a
  // throw point would pass a naive search while fixing nothing.
  const clears = (body.match(/setIsGeneratingMissing\(false\)/g) ?? []).length;
  check('FLAG: exactly one clear inside the function', clears === 1, `found ${clears}`);
  check('FLAG: the Step 1 caller does not need its own protection',
    !/finally[\s\S]{0,120}setIsGeneratingMissing/.test(
      app.slice(app.indexOf('generateAllMissingForecasts({ restrictToLeafKeys'),
                app.indexOf('generateAllMissingForecasts({ restrictToLeafKeys') + 1400)),
    'the caller is compensating for the function again');
}

console.log(`walk-fixes spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
