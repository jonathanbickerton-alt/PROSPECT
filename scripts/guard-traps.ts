/**
 * GUARD TRAPS — do the spec's source guards still bite?
 *
 *   npm run guard-traps
 *
 * A different species from `npm run traps`. Those drive the real component and
 * assert on rendered DOM: does the APP behave. These plant a defect in the
 * source and assert the SPEC goes red: does the TEST still bite.
 *
 * The distinction earns its keep. A source-regex guard degrades silently — it
 * keeps passing while the defect returns in a spelling the regex does not
 * match. That is worse than no guard, because it reads as coverage. Only a
 * planted violation can tell the two apart.
 *
 * Why these guards are on the source at all: `challengerGroups` is a closure
 * inside ForecastVsActualsTab and cannot be driven headlessly, and the
 * row-survival assertions in derived-interaction-spec replicate the rule rather
 * than measuring the component's. Reinstating the defect left every one of them
 * green — the measure-don't-reimplement trap, inside the spec written to close
 * that very defect. Hence a source guard, and hence this harness over it.
 *
 * THE DEFECT: a derived aggregate has no incumbent model, so `provenanceModel()`
 * returns null for it by design. An earlier fix handled that with
 * `if (!chosenModel) return null`, which dropped 5/5 challenger rows at the
 * default grouping and 40/40 at product+channel — the list was empty. Traps 1-4
 * are four spellings of that same drop. Traps 2-4 all passed the original guard,
 * which pinned trap 1's exact sentence; that is why the guard is now structural.
 * Trap 5 is the row that survives but lies: mix stubbed to null renders a model
 * name the cohort does not have. Not-dropped is not the same as honest.
 */
import * as fs from 'fs';
import { spawnSync } from 'child_process';

const FILE = 'src/components/ForecastVsActualsTab.tsx';
const FVA_TAB = FILE;
const ENGINE = 'src/utils/forecasting.ts';
const WHATIF = 'src/components/WhatIfTab.tsx';
const SPEC = 'scripts/derived-interaction-spec.ts';
const NULLSPEC = 'scripts/null-render-spec.tsx';
const UNSCORED = 'scripts/unscored-row-spec.tsx';
const LEAFGRAIN = 'scripts/leaf-grain-spec.ts';
const RETIRE = 'scripts/aggregate-retire-spec.ts';
const IMPORTSEAM = 'scripts/import-seam-spec.ts';
const GENMISSING = 'scripts/generate-missing-spec.ts';
const CHARTSCOPE = 'scripts/chart-scope-spec.ts';
const COVCOPY = 'scripts/coverage-copy-spec.ts';
const WALKFIX = 'scripts/walk-fixes-spec.ts';
const PANEL = 'scripts/step1-panel-spec.tsx';
const STEP3 = 'scripts/step3-transition-spec.tsx';
const BULKDONE = 'scripts/bulk-completion-spec.tsx';
const NAVSPEC = 'scripts/nav-target-spec.ts';
const SFT = 'src/components/StandardForecastTab.tsx';
const STEP1SEL = 'scripts/step1-selection-spec.tsx';
const BASESEED = 'scripts/base-seed-spec.ts';
const STEP2UNLOCK = 'scripts/step2-unlock-spec.tsx';
const MODAL = 'src/components/BulkGenerateModal.tsx';
const APP = 'src/App.tsx';
const VIEWFILTER = 'src/utils/viewFilter.ts';

/** Every file any trap mutates, snapshotted before anything is planted. */
const TARGETS = [FILE, ENGINE, WHATIF, APP, SFT, MODAL, VIEWFILTER];
const originals = new Map<string, string>(TARGETS.map(f => [f, fs.readFileSync(f, 'utf8')]));

const orig = originals.get(FILE)!;
const nl = orig.includes('\r\n') ? '\r\n' : '\n';

/** The line the row body builds its mix on — every trap plants relative to it. */
const ANCHOR = "        const derivedMix = incumbentSrc.kind === 'derived'";
const MIX_BLOCK = ANCHOR + nl +
  "          ? { leafCount: incumbentSrc.leafCount, models: incumbentSrc.models }" + nl +
  "          : null;";

type Trap = { id: string; why: string; file?: string; spec?: string; mutate: (s: string) => string };

const TRAPS: Trap[] = [
  { id: '1 original spelling', why: 'the sentence the old guard pinned',
    mutate: s => s.replace(ANCHOR, '        if (!chosenModel) return null;' + nl + ANCHOR) },
  { id: '2 empty-string compare', why: 'EVADED the old guard',
    mutate: s => s.replace(ANCHOR, "        if (chosenModel === '') return null;" + nl + ANCHOR) },
  { id: '3 braced body', why: 'EVADED the old guard',
    mutate: s => s.replace(ANCHOR, '        if (!chosenModel) {' + nl + '          return null;' + nl + '        }' + nl + ANCHOR) },
  { id: '4 tests derivedness directly', why: 'EVADED the old guard',
    mutate: s => s.replace(ANCHOR, "        if (incumbentSrc.kind === 'derived') return null;" + nl + ANCHOR) },
  { id: '5 mix stubbed to null', why: 'row survives but renders a model it does not have',
    mutate: s => s.replace(MIX_BLOCK, '        const derivedMix = null;') },
  // Trap 6 mutates the ENGINE, not the tab: it restores the roll-up
  // duplication by collecting each leaf's roll-up variants in an array instead
  // of a Set. With a dimension unmapped the three variants collapse to one key,
  // so the leaf lands in the same roll-up three times and every derived
  // aggregate above it is 3x overstated.
  { id: '6 roll-up duplication restored', why: 'unmapped dimension inflates every aggregate 3x',
    file: ENGINE,
    mutate: s => s
      .replace('    const rollUps = new Set<string>();', '    const rollUps: string[] = [];')
      .replace('      rollUps.add(makeForecastKey(s, p[0], p[1], c[0], c[1], t[0], t[1]));',
               '      rollUps.push(makeForecastKey(s, p[0], p[1], c[0], c[1], t[0], t[1]));') },
  // Trap 7 puts a hook back BELOW the conditional return - the shape that
  // blanked the app. It cannot be caught by a mount-with-null spec: a first
  // render with null skips the hook consistently. Only the TRANSITION
  // forecast -> null renders fewer hooks than the render before it, so this
  // trap is what proves the transition cases are doing real work.
  { id: '7 hook below the conditional return', why: 'React throws on the forecast -> null transition',
    file: WHATIF, spec: NULLSPEC,
    // BELOW the guard, which is the unsafe position. Planting it above would
    // reproduce the SAFE shape and the trap would report MISSED for the one
    // reason that means nothing — the first version of this trap did exactly
    // that, and the miss was the trap's fault, not the spec's.
    mutate: s => s.replace('  // Main layout',
      '  const __trap7 = useMemo(() => 1, []);' + nl + '  void __trap7;' + nl + nl + '  // Main layout') },
  // Trap 8 collapses the two meanings of null back into one, which is the
  // state the app shipped in: a user with thousands of generated forecasts
  // told none existed, and sent to the fit-on-aggregate path Phase 3 removes.
  // The branches are only worth having if their collapse is detectable.
  { id: '8 the two null meanings collapsed into one', why: 'a generated session is told nothing was generated',
    file: WHATIF, spec: NULLSPEC,
    mutate: s => s.replace('    if (!nothingGenerated) {', '    if (false) {') },
  // Trap 9, RESTORED against the rendered surface. The withdrawn version aimed
  // at chartData, which turned out to be dead code no user ever saw - so it
  // could not have killed anything. This mutates multiChartData, which IS
  // rendered: dropping `!selectedCohortRow` lets a SELECTED cohort with no
  // forecast fall back to the loaded aggregate, so a forecast line appears
  // beside an unscored table row. That is the disagreement, reinstated where it
  // would actually be visible.
  { id: '9 the table/chart disagreement reinstated', why: 'table blank, chart drawing, same cohort',
    file: FVA_TAB, spec: UNSCORED,
    mutate: s => s.replace('      } else if (baseForecast && !selectedCohortRow &&',
                           '      } else if (baseForecast &&') },
  // Trap 10 removes the OTHER half of the same guard: the scope check. Without
  // it an aggregate is drawn against filter-scoped actuals, which is the
  // +99.9%-variance defect the comment beside the guard records. A gate removed
  // this half and every spec stayed green - the guard was correct and
  // unverified, which is the state this trap exists to make impossible.
  { id: '10 the Case B scope guard removed', why: 'aggregate drawn against filter-scoped actuals',
    file: FVA_TAB, spec: UNSCORED,
    mutate: s => s.replace(
      '      } else if (baseForecast && !selectedCohortRow &&' + nl +
      '                 (!activeFilter || cohortMatchesFilter(baseForecast.cohort, activeFilter))) {',
      '      } else if (baseForecast && !selectedCohortRow) {') },
  // Trap 11 is TWO mutations on purpose, and the pairing is the point: no
  // natural input produces a NaN component score, so weakening the filter
  // alone would change nothing and the trap would report a false green. The
  // injection is the SCENARIO; the weakened filter is the DEFECT. Together
  // they reproduce a NaN overallScore, which renders as a score because every
  // downstream test is `!== null`.
  { id: '11 a NaN score laundered into a number', why: 'NaN !== null, so it survives a null-only filter',
    file: FVA_TAB, spec: LEAFGRAIN,
    mutate: s => s
      .replace('    const baseArpuScore      = baseArpuDetail?.score      ?? null;',
               '    const baseArpuScore      = NaN as any;')
      .replace('      .filter((v): v is number => v !== null && Number.isFinite(v));',
               '      .filter((v): v is number => v !== null);') },
  // Trap 12 is trap 11's sibling, one level down: inject a NaN component and
  // remove only the RENDER-boundary guard, leaving the aggregate filter intact.
  // The mean stays finite, so trap 11 would not catch this - but the KPI cell
  // renders the string "NaN" in a coloured badge. Guarding the average and
  // leaving the cells is a half-closed hole, and a gate found it while checking
  // the aggregate fix.
  { id: '12 a NaN component rendered as a score cell', why: 'scoreLabel(NaN) is the string "NaN"',
    file: FVA_TAB, spec: LEAFGRAIN,
    mutate: s => s
      .replace('    const baseArpuScore      = baseArpuDetail?.score      ?? null;',
               '    const baseArpuScore      = NaN as any;')
      .replace("  if (score === null || !Number.isFinite(score)) return '—';",
               "  if (score === null) return '—';") },
  // Traps 13 and 14 are the two halves of the retirement rule's SCOPE, and
  // they fail in opposite directions. 13 restores store-first for All-keys, so
  // a stale fit-on-aggregate wins over derivation again. 14 broadens the rule
  // by dropping the All-bearing test, so it swallows every LEAF fit - a rule
  // that looks correct on the case it was written for and destroys the store.
  { id: '13 store-first restored for All-keys', why: 'a stale fit-on-aggregate wins over derivation',
    // Retargeted to ENGINE when the seam moved out of App into the pure
    // resolveFromStore. The move was caught by spec:retire's own anchor check,
    // which went red rather than passing over a window that no longer existed.
    file: ENGINE, spec: RETIRE,
    mutate: s => s.replace('  if (stored && !isRetiredAggregateFit(key, stored)) return { forecast: stored, reason: null };',
                           '  if (stored) return { forecast: stored, reason: null };') },
  { id: '14 the retirement rule broadened past its scope', why: 'it retires leaf fits too',
    file: ENGINE, spec: RETIRE,
    mutate: s => s.replace("  return key.split('|').some(part => part === 'All');",
                           '  return true;') },
  // Trap 15 is the one that matters most, because its defect SHIPPED. The
  // retirement rule was correct and specced, and session import read the store
  // raw anyway - so opening an old file showed the stale total until a filter
  // change laundered it. This reverts the import site to that raw read.
  { id: '15 session import bypasses the seam again', why: 'an opened session shows the stale aggregate on Step 1',
    file: APP, spec: IMPORTSEAM,
    mutate: s => {
      const start = s.indexOf('            const bf = rawBf');
      const end = s.indexOf('              : null;', start);
      if (start === -1 || end === -1) return s; // unchanged -> reported as MISSED, correctly
      return s.slice(0, start) + '            const bf = rawBf;' + s.slice(end + '              : null;'.length);
    } },
  // Trap 16 reinstates ONE All-bearing write - the mirror control's whole
  // point. acceptPreviewForecast loses its decline and can once again store a
  // fit under an aggregate key. This is the residual risk Session G recorded
  // OPEN and Session H closed, so the trap is what proves it stays closed.
  { id: '16 an All-bearing write reinstated at the accept path', why: 'a fit-on-aggregate can be stored again',
    file: APP, spec: GENMISSING,
    mutate: s => {
      const anchor = "    if (isAllBearing(fKey)) {";
      const start = s.indexOf(anchor);
      if (start === -1) return s;
      const end = s.indexOf('    }', s.indexOf('return;', start)) + '    }'.length;
      return s.slice(0, start) + s.slice(end);
    } },
  // Trap 17 is the OTHER direction, and it is the one that matters more.
  // Instead of removing the guard it LAUNDERS the provenance: the write is
  // allowed but re-stamped `accepted`, which satisfies any rule phrased as
  // "no fitted All-bearing writes" while making the defect permanent - the
  // retirement rule only retires `fitted`, so nothing catches it on the way
  // back out. A guard that this passes is worse than no guard.
  { id: '17 the All-bearing write laundered as accepted', why: 'it evades the retirement rule permanently',
    file: APP, spec: GENMISSING,
    mutate: s => s.replace(
      "    if (isAllBearing(fKey)) {" + nl + "      setError(t('accept_not_available_for_aggregates'));" + nl + '      return;',
      "    if (isAllBearing(fKey)) {" + nl + "      finalBf.provenance = { kind: 'accepted', modelUsed: 'Holt Linear' } as any;") },
  // Trap 18 covers the SECOND accept site. Traps 16 and 17 mutate
  // acceptPreviewForecast only; the gate pointed out that
  // acceptAllChallengerModels' decline had no mutation-tested guard, just a
  // static regex. Two sites with the same rule need two traps, or one of them
  // is protected by a check nobody has watched fail.
  { id: '18 the second accept site loses its decline', why: 'acceptAllChallengerModels can store a fit-on-aggregate',
    file: APP, spec: GENMISSING,
    mutate: s => {
      const anchor = '        if (isAllBearing(fKeyAll)) {';
      const start = s.indexOf(anchor);
      if (start === -1) return s;
      const end = s.indexOf('        }', s.indexOf('return;', start)) + '        }'.length;
      return s.slice(0, start) + s.slice(end);
    } },
  // Trap 19: the scoped run reports the standard tallies again, which are
  // structurally zero for it. The bulk drawer then renders a run that fitted
  // every requested leaf as a run that did nothing.
  { id: '19 a scoped run reports zero work done', why: 'the BulkRunRecord misreports every Step 1 generation',
    file: APP, spec: GENMISSING,
    mutate: s => s.replace('      generated: options?.restrictToLeafKeys ? ibroGenerated : generated,',
                           '      generated,') },
  // Trap 20: the Step 1 history is drawn wider than the forecast beside it
  // again. Measured on the fixture, the narrow filter covers 168 rows and the
  // wide one 1,344 - so the chart shows two lines from populations 8x apart
  // and labels them Historical and Mean.
  { id: '20 the Step 1 chart history widens past its forecast', why: 'history and forecast drawn from different populations',
    file: SFT, spec: CHARTSCOPE,
    mutate: s => s.replace("      if (wiProductL2Col && productL2Value", "      if (false && productL2Value") },
  // Trap 21: the completion heading goes back to reporting the RUN. It is the
  // difference between 'the job finished' and 'your book is covered', and only
  // one of those is what the reader came to learn.
  { id: '21 the completion modal over-claims again', why: 'a run with gaps reads as full coverage',
    file: MODAL, spec: COVCOPY,
    mutate: s => s.replace('            {uncovered > 0', '            {false') },
  // Trap 22: the grain comes off the cohort-months label. The number is
  // unchanged and the word is wrong, which is the shape that survives review.
  { id: '22 the cohort-months label loses its grain', why: '240 cohort-months reads as a 240-month period',
    file: FVA_TAB, spec: COVCOPY,
    mutate: s => s.replace("t('actuals_cohort_months_compared', { n: summaryMape.monthsWithActuals })",
                           'summaryMape.monthsWithActuals') },
  // Trap 23: `missing` goes back to meaning has-no-forecast. The button then
  // offers a generate for a leaf that cannot be fitted, produces nothing, and
  // offers it again - the loop Jon's walk stopped on.
  { id: '23 missing counts unfittable leaves again', why: 'the button invites a generate that can never complete',
    file: ENGINE, spec: WALKFIX,
    mutate: s => s.replace(
      "  const unfittable = absent.filter(k => knownUnfittable.has(k));" + nl +
      "  const missing = absent.filter(k => !knownUnfittable.has(k));",
      "  const unfittable: string[] = [];" + nl + "  const missing = absent;") },
  // Trap 24: blocked collapses into covered. Both have zero generatable
  // leaves; one says the scope is complete and the other says it cannot be.
  { id: '24 the blocked state collapses into covered', why: 'a scope with unfittable leaves claims full coverage',
    file: APP, spec: WALKFIX,
    mutate: s => s.replace('    if (unfittable.length > 0) {', '    if (false) {') },
  // Trap 25: the run ends without showing anything. The user story stops at a
  // placeholder and the user is left to guess whether it worked.
  { id: '25 generation ends on a placeholder', why: 'the derived forecast is never rendered',
    file: APP, spec: WALKFIX,
    mutate: s => {
      // Anchored INSIDE showResolvedAggregate. The first version replaced the
      // bare line, which matches handleStep2FilterChange earlier in the file -
      // so it mutated the wrong site and reported MISSED for a reason that said
      // nothing about the guard. Same fault as trap 7's first version.
      const i = s.indexOf('const showResolvedAggregate = useCallback');
      if (i === -1) return s;
      const j = s.indexOf('    setBaseForecast(forecast);', i);
      if (j === -1) return s;
      return s.slice(0, j) + '    void forecast;' + s.slice(j + '    setBaseForecast(forecast);'.length);
    } },
  // Trap 26: the error banner outlives its subject again.
  { id: '26 the error banner survives a selection change', why: 'it describes a cohort the user has left',
    file: APP, spec: WALKFIX,
    // Anchored on the effect BODY, not on an exact run of lines: the first
    // version broke the moment setNotice was added between them, and correctly
    // reported INCONCLUSIVE rather than a false catch.
    mutate: s => {
      const i = s.indexOf(`    setError('');${nl}    setNotice('');`);
      if (i === -1) return s;
      const j = s.indexOf('    setStdGenerateResult(null);', i);
      if (j === -1) return s;
      return s.slice(0, i) + '    /* cleared nothing */' + s.slice(j + '    setStdGenerateResult(null);'.length);
    } },
  // Trap 27: the finally goes back to the call site, where a new caller can
  // miss it. This one has already happened once.
  { id: '27 the generating flag is unprotected again', why: 'a throw disables Generate Missing permanently',
    file: APP, spec: WALKFIX,
    mutate: s => s.replace('    } finally {' + nl +
      '      // Unconditional. Every exit - return, throw, or a rejection from the' + nl +
      '      // worker pool - clears the flag, so no caller has to remember to.' + nl +
      '      setIsGeneratingMissing(false);' + nl + '    }',
      '    }') },
  // TRAP 28 RETIRED — the write it planted no longer exists.
  //
  // It reverted showResolvedAggregate to not populating forecastData. The
  // panel now DERIVES from the store, so that function writes no panel state
  // at all and the defect cannot be expressed there. Trap 34 replaces it with
  // the cut that IS still expressible: severing the derivation.
  //
  // Recorded rather than deleted, because a trap vanishing from a numbered
  // list looks the same as a trap someone quietly dropped.

  // Trap 29: the aggregation predicate stops asking whether the dimension is
  // MAPPED. Every dimension defaults to 'All (Aggregated)', so an unmapped one
  // makes a genuine leaf look aggregated - and a fitted leaf then reads
  // 'covered' and cannot be regenerated.
  { id: '29 the state machine swallows leaf selections again', why: 'a fitted leaf becomes un-regenerable',
    file: APP, spec: WALKFIX,
    mutate: s => s
      .replace('    (!!wiSegmentCol  && segmentValue === ', '    ((true) && segmentValue === ')
      .replace('    (!!wiProductCol  && productValue === ', '    ((true) && productValue === ')
      .replace('    (!!wiChannelCol  && channelValue === ', '    ((true) && channelValue === ')
      .replace('    (!!wiTariffL1Col && tariffValue  === ', '    ((true) && tariffValue  === ') },
  // Trap 30: the invitation argues with the explanation again. "Ready to
  // forecast" under a notice saying nothing can be shown reads as though
  // nothing had been tried.
  { id: '30 the placeholder contradicts the notice above it', why: 'an invitation sits under an explanation of why it cannot work',
    file: SFT, spec: PANEL,
    // Re-anchored: the condition widened to cover the covered/blocked/never
    // states as well as a notice, so the old exact-text anchor stopped
    // matching. INCONCLUSIVE rather than a false catch, as designed.
    mutate: s => s.replace("              ) : (notice || aggregateState.kind === 'covered'",
                           '              ) : (false') },
  // TRAP 31 RETIRED — same reason as 28.
  //
  // It removed the Base branch's forecastData clear. With the panel derived,
  // a null band yields no rows and there is nothing to clear, so the stale
  // panel it guarded against is structurally impossible rather than merely
  // guarded. spec:step1-panel asserts that property directly.

  // Trap 32: the shared scope helper is replaced by a near-copy that trims
  // only one side - the exact drift the first version of this code had.
  { id: '32 the scope test becomes a near-copy again', why: 'a private scope predicate drifts from the shared one',
    file: APP, spec: WALKFIX,
    // Re-anchored: the scope test became a predicate passed to the shared row
    // builder, so the old inline-continue form no longer exists. The harness
    // reported INCONCLUSIVE rather than a false catch, which is what that
    // state is for.
    mutate: s => s.replace('        && rowInScope(row, scopeCols, scopeFilter, ALL_DIMS),',
                           '        && true,') },
  // Trap 33 replants Session J's EXACT defect - the app resolves the derived
  // forecast and never gets it to the panel - and points it at the MOUNTED
  // spec. Trap 28 plants the same defect but is caught by a structural
  // source check; a verification pass showed that with trap 28's mutation
  // planted, every mounted assertion in step1-panel stayed GREEN, because the
  // spec built its own rows and passed them in as a prop.
  //
  // That is the difference this trap exists to hold: 'the panel renders when
  // given rows' and 'the app gives it rows' are different claims, and only the
  // second is what the walk failed on twice.
  { id: '33 the app resolves a forecast the panel never receives', why: 'the placeholder persists after a successful run - Session J, exactly',
    file: ENGINE, spec: PANEL,
    mutate: s => s.replace('  const stamped = [...histRows, ...fcRows];',
                           '  const stamped: Record<string, unknown>[] = [];') },
  // Trap 34 severs the STORE DERIVATION: the panel stops asking the seam what
  // exists for the current selection. This is walk C-17 exactly - a restored
  // session whose forecasts are in the store and nowhere on Step 1. It is a
  // different cut from trap 33: 33 breaks the row BUILDING, this breaks the
  // RESOLVING, and only the second reproduces the restore defect.
  { id: '34 the panel stops deriving from the store', why: 'a restored session shows no forecast on Step 1',
    file: ENGINE, spec: PANEL,
    mutate: s => s.replace('  const { forecast } = resolve(key);' + nl + '  if (!forecast) return [];',
                           '  return [];') },
  // Trap 35: a consumer is left reading the old written state. This is the
  // shape the gate found by hand - the window-offset effect kept reading
  // forecastData after everything else moved, so it silently stopped firing
  // for aggregate and restored views. Nothing failed, because the diff shrank
  // the effect's reach without touching a line of it.
  { id: '35 a panel consumer left on the old written state', why: 'the chart stops centring on the transition for derived views',
    file: APP, spec: WALKFIX,
    mutate: s => s.replace("    if (stdPanelRows.length > 0 && activeView === 'standard') {",
                           "    if (forecastData.length > 0 && activeView === 'standard') {") },
  // Trap 36 is the F1 tripwire's own guard. It severs the tab-switch effect's
  // resolve, which is the transition the four navigation sequences exist to
  // watch - Actuals Review then gates on a null context forecast and shows the
  // never-generated message with forecasts sitting in the store.
  { id: '36 the tab-switch effect stops resolving for Step 3', why: 'Actuals Review shows never-generated with a populated store',
    // Retargeted to the extracted function so the MOUNTED sequences kill it,
    // not merely a structural source check.
    file: VIEWFILTER, spec: STEP3,
    mutate: s => s.replace("  if (view === 'vsactuals') return { owns: true, forecast: resolve(filterToKey(step3Filter)).forecast };",
                           "  if (view === 'vsactuals') return { owns: true, forecast: null };") },
  // Trap 37: the filter/key conversion drifts. The spec drives the production
  // helpers, so breaking the round trip breaks the sequences - which is the
  // point of extracting them rather than transcribing them into the spec.
  { id: '37 the ViewFilter round trip drifts', why: 'a restored cohort resolves to a key nothing matches',
    file: VIEWFILTER, spec: STEP3,
    mutate: s => s.replace("    product: { l1: c.product === 'All' ? null : c.product,",
                           '    product: { l1: null,') },
  // Trap 38: an eighth forecastData writer appears. The panel derives, so a
  // convenience write would do nothing visible and pass unnoticed.
  { id: '38 an unclassified forecastData writer appears', why: 'the writer list stops being counted',
    file: APP, spec: WALKFIX,
    mutate: s => s.replace('  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {',
      '  const __trap38 = () => { setForecastData([]); };' + nl +
      '  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {') },
  // Trap 39 REPLANTS Session G's severance: the scoped run finishes and raises
  // nothing, so the coverage statement, the grain-named counters, the named
  // skipped leaves and G's own retirement notice all become unreachable from
  // Step 1 again. This is the defect the walk found, in one line.
  // Trap 39 REPLACED 2026-08-08. It used to replant Session G's severance
  // against `setBulkCompletedRun`, which no longer exists: the pivot removed
  // the open-at-COMPLETE path entirely, so the old mutation had no target and
  // would have gone [MISSED] for want of a thing to break rather than for want
  // of a check. What replaces it guards the decision that superseded it.
  //
  // SKIP STRAIGHT TO THE RUN: Step 1's button generates on click, as it did
  // before the pivot, instead of opening the confirm. The user gets no sight of
  // the settings and no chance to decline — which is the whole of what the
  // pivot bought.
  { id: '39 Step 1 generates on click, without confirmation',
    why: 'a 74-leaf run starts before the user has seen a single setting',
    file: APP, spec: BULKDONE,
    // Anchored on the call's OPENING, not the whole statement. The full line
    // carries the scope label, which changed once already this session and took
    // the anchor with it — an [INCONCLUSIVE] trap protects nothing, and it fails
    // quietly in the direction of looking fine.
    mutate: s => s.replace(
      '      setPendingScopedRun({ aggKey,',
      '      void generateAllMissingForecasts({ restrictToLeafKeys: new Set(missing) }); const _planted = ({ aggKey,') },
  // Trap 42: the reset-on-open is made conditional on there being no leftover
  // summary — which is exactly the shape of the defect the pivot was built
  // over, where a finished run's phase and numbers outlived the close and the
  // next open rendered stale results with no settings step.
  { id: '42 a finished run survives the close and reopens as results',
    why: 'the next open shows the last run\'s numbers instead of a confirm',
    file: MODAL, spec: BULKDONE,
    mutate: s => s.replace('    if (!isOpen) return;',
                           '    if (!isOpen || summary) return;') },
  // Trap 43: the confirm panel is fed the Step 1 sidebar values again, so it
  // displays numbers the run will not apply. This one shipped for real and was
  // invisible because the auto-per-cohort defaults hide both figures.
  // Trap 44: the Overall door's missing set goes back to has-no-forecast over
  // the whole cohort cross-product — aggregates included, four scenario rows per
  // key. Measured on the edge fixture with every fittable leaf already fitted,
  // that offered 144 where the truth is 0: 36 keys x 4 scenarios, 34 of the keys
  // All-bearing. Every one failed on every run and nothing recorded them, so the
  // count never moved. Session J's no-exit loop, on the surface J never touched.
  // Trap 45: KEEP-LAST, replanted inside the function the pairing spec drives.
  // The helper stops resolving the selection it was handed and reuses whatever
  // key it resolved first — which is precisely what Step 1 did before
  // 2026-08-09, and precisely why its chart drew a Corporate history of ~17.3
  // beside a 33.69 forecast belonging to one Mobile Voice / Direct leaf.
  //
  // Planted HERE rather than in App's effect on purpose: a trap that severed
  // the effect would be caught by the wiring half only, and the claim worth
  // guarding is the one the mounted pairing assertion makes — that both halves
  // of the chart describe the same population.
  { id: '45 Step 1 keeps the last forecast while its selection moves',
    why: 'the ARPU chart draws one scope history beside another scope forecast',
    file: VIEWFILTER, spec: STEP1SEL,
    mutate: s => s.replace(
      '  const key = filterToKey(selection);',
      '  const key = (forecastForStep1Selection as any).__last ?? filterToKey(selection);'
      + nl + '  (forecastForStep1Selection as any).__last = key;') },
  // Trap 46: the RETURN door reopens. Coming back to Step 1 stops re-resolving,
  // so a forecast Step 2 or Step 3 assigned for its own filter stays on screen
  // beside Step 1's history — the two-population defect through the second door
  // the gate found after the first fix looked complete.
  { id: '46 returning to Step 1 stops re-resolving',
    why: 'Step 2 assigns a forecast and Step 1 keeps showing it under its own dropdowns',
    file: VIEWFILTER, spec: STEP1SEL,
    // Aimed at the SENTINEL, after a first version aimed at a `returning` flag
    // stayed green — the flag turned out to be dead code, and the trap is what
    // proved it. Leaving Step 1 now records the key instead of AWAY, so a
    // return with an unchanged selection looks like standing still.
    mutate: s => s.replace(
      "  if (view !== 'standard') return { resolve: false, next: STEP1_AWAY };",
      "  if (view !== 'standard') return { resolve: false, next: key };") },
  // Trap 47: the Step 2 unlock goes back on transient state — the store is
  // ignored and the gate reads only the legacy savedForecasts map. That is the
  // walk finding exactly: 72 leaves generated by a scoped run, nothing written
  // to the legacy store, Step 2 locked with a full book of forecasts.
  { id: '47 the Step 2 unlock stops deriving from the store',
    why: 'a bulk-generated book leaves Step 2 locked, with no save action to unlock it',
    file: ENGINE, spec: STEP2UNLOCK,
    mutate: s => s.replace(
      '  for (const [key, bf] of store as Map<string, any>) {',
      '  for (const [key, bf] of new Map<string, any>()) {') },
  // Trap 48: the PARTIAL SUM returns. deriveAggregate stops tracking whether
  // every contributing leaf is present-and-seeded, so an aggregate missing one
  // leaf's opening stock reports a known seed and the chart rolls it forward —
  // under-seeded in exact proportion to how many leaves fall short.
  { id: '48 the aggregate seed goes back to a partial sum',
    why: 'an opening balance missing a leaf is passed off as the aggregate stock',
    file: ENGINE, spec: BASESEED,
    mutate: s => s.replace('      if (!lf.seedBaseKnown) seedBaseKnown = false;',
                           '      void lf;') },
  // Trap 49: the chart stops declining, so an unknown stock is rolled forward
  // from zero again — the seedless integral, a line from the origin climbing at
  // inflow-minus-outflow and reading as a forecast.
  { id: '49 the Base chart draws from an unknown opening stock',
    why: 'the seedless integral returns: origin start, net-adds slope',
    file: FVA_TAB, spec: BASESEED,
    mutate: s => s.replace(
      '      if (!canShowBaseForecast({ seedBaseKnown: fcSeedKnown })) return null;',
      '      if (false) return null;') },
  // Trap 50: the SCORER stops declining, so a Base KPI is computed from a
  // fabricated zero-seeded stock and exported. Worse than trap 49's chart line
  // because the number leaves the screen.
  { id: '50 the Base SCORE is computed from an unknown opening stock',
    why: 'baseScore and overallScore are scored off a fabricated stock, and exported',
    file: FVA_TAB, spec: BASESEED,
    mutate: s => s.replace(
      '      if (!canShowBaseForecast(derivedForRow)) return null;',
      '      if (false) return null;') },
  { id: '44 the Overall door counts aggregates as missing again',
    why: 'a fully-fitted book is offered 144 generations that can never succeed',
    file: APP, spec: PANEL,
    mutate: s => s.replace(
      '    () => allCohorts.filter(c => c.forecastType === \'Standard Forecast\'',
      '    () => allCohorts.filter(c => !c.hasForecast && c.forecastType === \'Standard Forecast\' && true') },
  { id: '43 the confirm panel displays settings the run will not use',
    why: 'it shows the sidebar z-score while the run applies the generator\'s',
    file: APP, spec: BULKDONE,
    mutate: s => s.replace('          preHorizonUncertainty: genPreHorizonUncertainty,',
                           '          preHorizonUncertainty,') },
  // Trap 40: the leaf-grain marker is dropped, so a scoped run's counts are
  // labelled 'chart series' and its uncovered total double-counts - failed and
  // skipped are the SAME leaves on that path. The spec found this in the fix
  // itself before it shipped.
  { id: '40 the scoped run loses its grain', why: 'leaves counted as chart series and uncovered double-counted',
    file: MODAL, spec: BULKDONE,
    mutate: s => s.replace("  const uncovered = grain === 'leaves' ? skipped.length : skipped.length + failed;",
                           '  const uncovered = skipped.length + failed;') },
  // Trap 41: the nav label and its target diverge again.
  { id: '41 the nav label stops naming its destination', why: 'the item says Standard Forecast and goes to Overall',
    file: APP, spec: NAVSPEC,
    mutate: s => s.replace("              {t('nav_overall_forecast')}", "              {t('standard_forecast')}") },
];

const specFails = (spec: string = SPEC): boolean =>
  spawnSync('npx', ['tsx', spec], { encoding: 'utf8', shell: process.platform === 'win32' }).status !== 0;

const results: { id: string; state: string; detail: string }[] = [];

try {
  // POSITIVE CONTROL. If the spec is already red, every trap below "catches"
  // vacuously and this harness reports a perfect score while proving nothing.
  if (specFails() || specFails(NULLSPEC) || specFails(UNSCORED) || specFails(LEAFGRAIN) || specFails(RETIRE) || specFails(IMPORTSEAM) || specFails(GENMISSING) || specFails(CHARTSCOPE) || specFails(COVCOPY) || specFails(WALKFIX) || specFails(PANEL) || specFails(STEP3) || specFails(BULKDONE) || specFails(NAVSPEC) || specFails(STEP1SEL) || specFails(STEP2UNLOCK) || specFails(BASESEED)) {
    console.log('\nGUARD TRAPS\n' + '='.repeat(72));
    console.log('[INCONCLUSIVE] control. The spec is RED on the unmutated tree.');
    console.log('               Every trap would catch vacuously. Fix the spec first.');
    process.exit(1);
  }

  for (const t of TRAPS) {
    const target = t.file ?? FILE;
    const base = originals.get(target)!;
    const mutated = t.mutate(base);
    if (mutated === base) {
      // The anchor moved. Silently planting nothing would report a clean catch
      // for a trap that never ran.
      results.push({ id: t.id, state: 'INCONCLUSIVE', detail: 'anchor did not match — nothing was planted' });
      continue;
    }
    fs.writeFileSync(target, mutated);
    results.push(specFails(t.spec)
      ? { id: t.id, state: 'CAUGHT', detail: t.why }
      : { id: t.id, state: 'MISSED', detail: 'planted and the spec stayed GREEN — ' + t.why });
    fs.writeFileSync(target, base);   // one trap at a time, never compounded
  }
} finally {
  // Unconditional. This harness mutates tracked source; dying mid-run without
  // restoring leaves a corrupted tree that looks like a hand edit.
  for (const [f, s] of originals) fs.writeFileSync(f, s);
}

console.log('\nGUARD TRAPS\n' + '='.repeat(72));
for (const r of results) console.log(`[${r.state.padEnd(12)}] ${r.id}${r.detail ? '  —  ' + r.detail : ''}`);
console.log('='.repeat(72));
const caught = results.filter(r => r.state === 'CAUGHT').length;
const bad = results.filter(r => r.state !== 'CAUGHT');
console.log(`${caught}/${results.length} caught`);
if (bad.length) console.log('A MISSED or INCONCLUSIVE trap means the guard does not protect what it claims to.');
process.exit(bad.length ? 1 : 0);
