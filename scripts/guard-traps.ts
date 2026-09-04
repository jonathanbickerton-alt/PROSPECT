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
import os from 'os';
import path from 'path';

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
const RESTOREBASE = 'scripts/restore-base-spec.ts';
const EVTROUND = 'scripts/event-roundtrip-spec.ts';
const STEP2UNLOCK = 'scripts/step2-unlock-spec.tsx';
const MODAL = 'src/components/BulkGenerateModal.tsx';
const APP = 'src/App.tsx';
const VIEWFILTER = 'src/utils/viewFilter.ts';
const MIXSPEC = 'scripts/mix-constraint-spec.ts';
const MIXENGINE = 'src/utils/mixConstraint.ts';
const MIXCARD = 'scripts/mix-card-spec.tsx';
const OVERRIDESPEC = 'scripts/override-arpu-spec.tsx';
const YIELDROUND = 'scripts/yield-roundtrip-spec.ts';
const PRICEROUND = 'scripts/pricing-roundtrip-spec.ts';
const SUMMARYSPEC = 'scripts/events-summary-spec.ts';
const ACTIVECOHORT = 'scripts/active-cohort-spec.ts';
const SCENHELPER = 'src/utils/scenarioHelper.ts';
const SCENPRICE = 'scripts/scenario-pricing-spec.ts';
const CMPFILTER = 'scripts/compare-filter-spec.ts';
const CMPPANEL = 'scripts/compare-events-panel-spec.ts';
const CMPWINDOW = 'scripts/compare-window-spec.ts';
const CMPRENDER = 'scripts/compare-render-spec.ts';
const CHURNFOLD = 'scripts/churn-fold-spec.ts';
const CHURNENGINE = 'src/utils/churnFold.ts';
const SCENARPU = 'scripts/scenario-arpu-spec.ts';
const AMTCTRL = 'scripts/amount-control-spec.ts';
const AMTENGINE = 'src/utils/amountControl.ts';
const SHEETGUARD = 'src/utils/sheetGuards.ts';
const I18NPARITY = 'scripts/i18n-parity-spec.ts';
const I18NSCAN = 'scripts/scan-i18n.ts';
const FTSPLIT = 'scripts/forecast-type-split-spec.ts';
const ARPUCOMP = 'scripts/arpu-companion-spec.ts';
const APPLIEDCOUNT = 'scripts/applied-count-spec.ts';
const AGGRECON = 'scripts/aggregate-reconciliation-spec.ts';
const VIEWAPPLY = 'scripts/view-apply-mounted-spec.tsx';
const LOCKRT = 'scripts/lock-roundtrip-spec.ts';
const TRAPANCHORS = 'scripts/trap-anchors-spec.ts';
const VALUEPAD = 'scripts/value-padlock-mounted-spec.tsx';
const SLIDERROW = 'src/components/MixSliderRow.tsx';
const TARGETPANEL = 'src/components/MixTargetPanel.tsx';
const DEBUNDLE = 'src/locales/de/translation.json';

/** Every file any trap mutates, snapshotted before anything is planted. */
const APP_COMPARE = 'src/components/ScenarioCompareTab.tsx';
const SCENARPUENGINE = 'src/utils/scenarioArpu.ts';
const TARGETS = [FILE, ENGINE, WHATIF, APP, SFT, MODAL, VIEWFILTER, MIXENGINE, SCENHELPER, APP_COMPARE, SHEETGUARD, CHURNENGINE, AMTENGINE, SCENARPUENGINE, DEBUNDLE, SLIDERROW, TARGETPANEL];
const originals = new Map<string, string>(TARGETS.map(f => [f, fs.readFileSync(f, 'utf8')]));

const orig = originals.get(FILE)!;

/**
 * ANCHORS ARE BUILT IN LF, AND EVERY TARGET IS NORMALISED TO LF BEFORE MATCHING.
 *
 * This was `orig.includes('\r\n') ? '\r\n' : '\n'` — ONE file's line endings,
 * applied to anchors that target EIGHT files. On 2026-08-13 the editing tooling
 * rewrote WhatIfTab.tsx from CRLF to LF while the file `nl` was sampled from
 * stayed CRLF, and every MULTI-LINE anchor into WhatIfTab stopped matching at
 * once: traps 56, 60 and 64 reported INCONCLUSIVE, and 57 reported MISSED.
 *
 * 57 is the instructive one. Its mutation is two `.replace()` calls, and the
 * FIRST inserts a marker constant on a single line — so it matched, the content
 * changed, `mutated !== base` held, and the trap was recorded as successfully
 * planted. Only the second, multi-line replace carried the actual defect, and it
 * silently no-oped. **A multi-part mutation whose cheap part succeeds will
 * report PLANTED while the part that matters does nothing**, which is a MISSED
 * that looks like a guard failure rather than a harness failure.
 *
 * Line endings are not a property these anchors are trying to pin, so they are
 * normalised away rather than tracked. Restore still writes the PRISTINE
 * snapshot, so no file's real line endings are changed by a run.
 */
const nl = '\n';
const toLF = (s: string) => s.replace(/\r\n/g, '\n');
void orig;

/** The line the row body builds its mix on — every trap plants relative to it. */
const ANCHOR = "        const derivedMix = incumbentSrc.kind === 'derived'";
const MIX_BLOCK = ANCHOR + nl +
  "          ? { leafCount: incumbentSrc.leafCount, models: incumbentSrc.models }" + nl +
  "          : null;";

/**
 * ANCHORS GO STALE, and the harness is right to call that INCONCLUSIVE rather
 * than CAUGHT. Traps 60 and 61 both reported it on 2026-08-12: the negative-ARPU
 * rider rewrote the exact lines they pinned — removing a `Math.abs` and a
 * `neg()` wrapper — so nothing was planted and neither trap tested anything.
 *
 * The lesson is not "write looser anchors". A loose anchor plants a mutation
 * somewhere other than intended and reports a catch it did not earn. It is:
 * a change that rewrites a line under a trap must re-aim the trap in the same
 * commit, and INCONCLUSIVE is the signal that it did not.
 */
/**
 * A TRAP. `global` declares the GLOBAL-MUTATION CLASS (Jon, 2026-09-04,
 * decision 2): the trap mutates EVERY occurrence of its anchor, and the number
 * is how many it expects to find.
 *
 * Such a trap is exempt from `spec:trap-anchors`' uniqueness check - not
 * because uniqueness is inconvenient for it, but because it is the wrong
 * question: the trap does not choose between occurrences, it takes all of
 * them. What replaces the check is the COUNT, asserted exact in both
 * directions, so a third occurrence and a drop to one both fail.
 */
type Trap = { id: string; why: string; file?: string; spec?: string; global?: number; mutate: (s: string) => string };

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
    // RE-ANCHORED 2026-09-02: the return grew `leaves: []` when resolveFromStore
    // began carrying the leaves it had already built, and this anchor still
    // named the three-field shape. It planted NOTHING and reported INCONCLUSIVE
    // — which is the whole reason that state exists rather than a silent pass:
    // the trap had stopped guarding the retirement rule and said so.
    file: ENGINE, spec: RETIRE,
    mutate: s => s.replace('  if (stored && !isRetiredAggregateFit(key, stored)) return { forecast: stored, reason: null, leaves: [] };',
                           '  if (stored) return { forecast: stored, reason: null, leaves: [] };') },
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
    // RE-AIMED 2026-08-18. The active-cohort work restructured this site: `bf`
    // is now `recordedBf ?? (rawBf ? resolveFromStore(...) : null)`, so the old
    // `const bf = rawBf` anchor stopped matching and the trap reported
    // INCONCLUSIVE — correctly, and that is the signal it exists to give.
    // Collapsing the whole expression to the raw stored forecast still
    // reproduces the shipped defect: BOTH the recorded and the fallback paths
    // bypass the seam.
    mutate: s => {
      const start = s.indexOf('            const bf = recordedBf');
      const end = s.indexOf('.forecast : null);', start);
      if (start === -1 || end === -1) return s; // unchanged -> reported as MISSED, correctly
      return s.slice(0, start) + '            const bf = rawBf;' + s.slice(end + '.forecast : null);'.length);
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
  // GLOBAL-MUTATION CLASS, 2026-09-04. The anchor occurs TWICE - the volume
  // KPI row and the ARPU KPI row, byte-identical for 26 lines - and the
  // catching spec asserts `occurrences === 2`, so its subject is the PAIR.
  // A unique anchor would span 18 lines including a comment block and would
  // pin the trap to one row the assertion is not about. Measured 2026-09-04:
  // planting at either site alone reddens the same check.
  { id: '22 the cohort-months label loses its grain', why: '240 cohort-months reads as a 240-month period',
    file: FVA_TAB, spec: COVCOPY, global: 2,
    mutate: s => s.split("t('actuals_cohort_months_compared', { n: summaryMape.monthsWithActuals })")
                  .join('summaryMape.monthsWithActuals') },
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
    // ANCHOR EXTENDED 2026-09-04. `if (unfittable.length > 0) {` occurs TWICE
    // in App.tsx - the leaf-scope reader at 1606 and the book reader at 1653 -
    // and replace() took the first. That happened to be the intended one, but
    // by ordering rather than by anything the trap said. Measured: planting at
    // 1606 reddens spec:walk-fixes; planting at 1653 leaves it 82/82, so the
    // second site's blocked branch is NOT covered by any spec - recorded as a
    // finding, not fixed here. The return line disambiguates: only the leaf
    // reader's lacks `keys`.
    mutate: s => s.replace(
      '    if (unfittable.length > 0) {' + nl +
      "      return { kind: 'blocked' as const, missing: 0, total: leaves.length," + nl +
      '               unfittable: unfittable.length };',
      '    if (false) {' + nl +
      "      return { kind: 'blocked' as const, missing: 0, total: leaves.length," + nl +
      '               unfittable: unfittable.length };') },
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
      // EXTENDED UPWARD 2026-09-04, deliberately not downward. The two-line
      // body start occurs TWICE in App.tsx - the selection effect at 1698 and
      // generateStandardForecast at 2128 - so `indexOf` found the intended one
      // by ordering alone. Adding the `useEffect(() => {` line above makes it
      // unique at 1697 while leaving the span between setNotice and the
      // terminator free, which is the exact property the note above records:
      // pinning that span is what broke the first version.
      const head = `  useEffect(() => {${nl}    setError('');${nl}    setNotice('');`;
      const at = s.indexOf(head);
      if (at === -1) return s;
      const i = at + `  useEffect(() => {${nl}`.length;
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
  // Trap 51: the restore drops the saved Historical_Months again. THE ONLY
  // BEHAVIOURAL trap in the seed family — traps 48/49/50 plant conditions no
  // shipped data reaches, but this one reproduces the exact artefact Jon saw on
  // his own save. Empty months make deriveAggregate's asOf null, so no leaf
  // passes the as-of gate: before seed-or-decline that summed the seed to 0 and
  // drew the seedless integral; after it, the aggregate declines. Same cause,
  // both symptoms.
  { id: '51 a restored session drops its saved historical months',
    why: 'asOf goes null, no leaf passes the gate, and a fully-seeded save loses its Base',
    file: APP, spec: RESTOREBASE,
    // ANCHOR EXTENDED 2026-09-04. The line occurs THREE times in App.tsx
    // (774, 893, 1028 - the three import sites), and replace() took the first.
    // MEASURED: all three redden spec:restore-base identically, because its
    // checks are about the SET of sites ('all three sites use the shared
    // parser'), so no one of them is more intended than another. Pinned to 774
    // - where it already planted, so nothing about what is caught changes - by
    // the following line, whose double space before `?? 0` the other two lack.
    mutate: s => s.replace(
      '                historicalMonths:      parseStoredMonths(first.Historical_Months),' + nl +
      '                lastHistoricalInflow:  Number(first.Last_Historical_Inflow  ?? 0),',
      '                historicalMonths:      [],' + nl +
      '                lastHistoricalInflow:  Number(first.Last_Historical_Inflow  ?? 0),') },
  // Trap 52: a promo field is dropped from the shared reader, so it stops
  // round-tripping — the prerequisite defect for the mix-mode build, in one
  // line. promoMix is the field chosen because it is the structured one: a
  // half-read mix is the failure that would corrupt a constrained allocation
  // rather than merely blank it.
  { id: '52 a promotion field stops round-tripping',
    why: 'a saved promotion reloads without its mix — the mix-mode prerequisite breaks',
    file: ENGINE, spec: EVTROUND,
    mutate: s => s.replace('    promoMix,', '    promoMix: undefined,') },
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
  // ── Traps 53-55: the constrained mix engine. All three plant a defect that
  //    was ACTUALLY IN THE FIRST DRAFT of mixConstraint.ts and was found by the
  //    spec rather than by reading, which is the only evidence worth having
  //    that these checks do work.
  //
  // 53, RE-AIMED. It first targeted conserve()'s negative-residual early return
  // and MISSED — not because the spec is weak but because no caller can reach
  // that branch, which is why the branch is gone. Re-aimed at the live
  // enforcement point: solveForTarget rescales the free shares to the free
  // budget, and that rescale is the whole reason a non-conforming restored mix
  // comes back conforming. Drop it and the read-tolerant design silently
  // becomes a write-tolerant one.
  { id: '53 the free-share rescale dropped', why: 'a non-conforming restored mix is written back non-conforming',
    file: MIXENGINE, spec: MIXSPEC,
    mutate: s => s.replace('      ? (view.shares[m] / freeSumNow) * freeBudget', '      ? view.shares[m]') },
  // 54 makes the collapsed branch REPAIR a non-conforming mix instead of
  // refusing it, by handing the residual to the last member. Every member is
  // padlocked in that branch, so the repair silently overwrites a share the
  // user explicitly held — the invariant restored at the cost of the lock.
  { id: '54 collapsed branch repairs over a padlock', why: 'a held slider is silently rewritten to fix the total',
    file: MIXENGINE, spec: MIXSPEC,
    mutate: s => s.replace('      const held = conserve(view.members, { ...view.shares }, null);',
                           '      const held = conserve(view.members, { ...view.shares }, view.members[view.members.length - 1]);') },
  // 55 restores the diluting zero. `?? 0` for an unknown ARPU is the exact
  // shape the seed-or-decline work spent five sessions removing elsewhere: it
  // does not read as missing, it reads as a real and very cheap member, and it
  // drags the achievable range down so a target that cannot be met is accepted.
  { id: '55 diluting zero for an unknown member ARPU', why: 'an unknown ARPU reads as a real, very cheap one',
    file: MIXENGINE, spec: MIXSPEC,
    // Single-line anchor deliberately: the two-line form joined with `nl`
    // could not match, because `nl` is read from a CRLF repo file while this
    // module is LF. A multi-line anchor here is a trap that reports
    // INCONCLUSIVE for a line-ending reason and protects nothing.
    mutate: s => s.replace('    if (a === null) return null;', '    if (a === null) continue;') },
  // ── Traps 56-58: the CARD's wiring to the engine. Session 2. Each severs one
  //    of the three things Jon's walk gates by eye, so a silent regression in
  //    any of them is a red run rather than something noticed months later.
  //
  // 56 is the one the brief names: a hand-rolled rebalance put back in place of
  // the engine call. It ignores the lock set — which is precisely what a
  // re-implementation would forget, because the shipped autoBalanceMix never
  // had locks to forget.
  { id: '56 card re-implements rebalance and drops the locks', why: 'a padlocked share moves anyway',
    file: WHATIF, spec: MIXCARD,
    mutate: s => s.replace(
      '      const out = rebalance(promoMembers, prev, promoMixLocked, changedTier, newValue);' + nl +
      "      return out.kind === 'ok' ? out.shares : prev;",
      '      return autoBalanceMix(prev, changedTier, newValue);') },
  // 57 reintroduces auto-lock, the thing settled OFF on 2026-08-11. A spec that
  // only checked "the mix rebalanced" would stay green through this; the
  // negative assertion is what catches it.
  { id: '57 auto-lock reintroduced', why: 'moving a slider silently holds it — settled OFF',
    file: WHATIF, spec: MIXCARD,
    mutate: s => s.replace(
      '  const handlePromoLockToggle = useCallback((tier: string) => {',
      '  const __trapAutoLock = 1; void __trapAutoLock;' + nl +
      '  const handlePromoLockToggle = useCallback((tier: string) => {')
      .replace(
      '    setPromoDraftMix(prev => {' + nl +
      '      const out = rebalance(promoMembers, prev, promoMixLocked, changedTier, newValue);',
      '    setPromoMixLocked(prev => prev.includes(changedTier) ? prev : [...prev, changedTier]);' + nl +
      '    setPromoDraftMix(prev => {' + nl +
      '      const out = rebalance(promoMembers, prev, promoMixLocked, changedTier, newValue);') },
  // 58 removes the write-side guard. The card would then happily save a mix that
  // does not total 100 — the invariant enforced everywhere except the one moment
  // it reaches a file.
  { id: '58 write-side enforcement removed', why: 'a non-conforming mix can be saved',
    file: WHATIF, spec: MIXCARD,
    mutate: s => s.replace(
      'const promoMixBlocksSave = promoMixEnabled && promoTierData.length > 0 &&',
      'const promoMixBlocksSave = false && promoMixEnabled && promoTierData.length > 0 &&') },
  // ── Traps 59-60: Alessandro's editable ARPU. Both plant the SAME defect at
  //    the two places it can occur — the field failing to survive a save, and
  //    the field surviving but being ignored where it is meant to apply. A
  //    round trip that carries a value nothing reads is not a round trip.
  //
  // 59 is the one the brief names: the override dropped from the shared reader.
  { id: '59 the ARPU override dropped from the reader', why: 'a stated rate does not survive a reload',
    file: ENGINE, spec: EVTROUND,
    mutate: s => s.replace('    arpuOverride: readOptionalNumber(row.Arpu_Override),', '') },
  // 60 keeps the field and severs its EFFECT: the per-view derivation stops
  // preferring it, so a stated rate round-trips perfectly and changes nothing.
  // Zero is where it bites first — the truthiness chain below the override
  // silently converts a free acquisition into last month's blended ARPU.
  { id: '60 the derivation stops preferring the stated rate', why: 'the override survives but is ignored',
    file: WHATIF, spec: OVERRIDESPEC,
    mutate: s => s.replace(
      '              e.arpuOverride !== undefined' + nl +
      '                ? e.arpuOverride                    // the user said so, sign and all' + nl +
      '                : e.subscriberVolume > 0',
      '              e.subscriberVolume > 0') },
  // 61 removes the override from App's addMarketEvent — the DEFAULT add path,
  // and the site the stage-2 gate found uncovered. Nothing drove it: this spec's
  // harness passes a noop addMarketEvent, so the wiring check is a source check,
  // and this trap is what proves the source check still bites.
  { id: '61 the default Add path drops the override', why: 'an ordinary Add click discards the stated rate',
    file: APP, spec: OVERRIDESPEC,
    mutate: s => s.replace(
      '      arpuOverride:     newEvent.arpuOverride,' + nl,
      '') },
  // 62 restores the sign clamp. `Math.abs` here reads as defensive tidying and
  // is a lie about what the user said: a negative ARPU override is a deliberate
  // affordance (an acquisition credit, Jon 2026-08-12), the value is ABSOLUTE,
  // and a minus means below zero rather than a reduction from the default. The
  // clamp also made the events table and the forecast engine disagree about one
  // number, since eventArpuDelta never had it.
  { id: '62 the negative ARPU override clamped by sign', why: 'a stated -4.25 becomes +4.25 in the forecast',
    file: WHATIF, spec: OVERRIDESPEC,
    mutate: s => s.replace(
      '                ? e.arpuOverride                    // the user said so, sign and all',
      '                ? Math.abs(e.arpuOverride)') },
  // 63 severs the yield override's single import route by hand-rolling a parse
  // beside the shared reader. It round-trips at a glance and drops every
  // absence rule with it: JSON.parse defaults a blank to {}, a stated 0 and an
  // unset bucket collapse, and a corrupted entry becomes a number. This is the
  // promo-field shape — one route quietly diverging — planted on the route the
  // enumeration says is the only one.
  //
  // RE-AIMED 2026-08-19. This was planted in APP, which was the only import
  // route until yieldEventFromRow was extracted; the anchor then matched
  // nothing and the trap reported INCONCLUSIVE rather than passing quietly.
  // That is the harness working as designed — an anchor that goes stale must
  // announce it — and the fix is to follow the code, not to relax the anchor.
  { id: '63 the yield override import hand-rolled beside the shared reader', why: 'absence rules drop on the only import route',
    file: ENGINE, spec: YIELDROUND,
    mutate: s => s.replace(
      '  const tariffBaseArpuOverride = readStoredRateMap(r.Tariff_Base_ARPU_Override_JSON);',
      '  let tariffBaseArpuOverride: any = {};' + nl +
      "  try { tariffBaseArpuOverride = JSON.parse(String(r.Tariff_Base_ARPU_Override_JSON ?? '{}')); } catch {}") },
  // 64 severs the input from the carrier: clearing the box stores a zero
  // instead of deleting the key. It looks like a simplification and collapses
  // the two states the whole carrier exists to separate — a band the user
  // priced at nothing, and a band they said nothing about. Number('') is 0, so
  // this is the shape the mistake actually takes.
  { id: '64 clearing the tier override stores zero instead of unsetting', why: 'unset and stated-zero collapse on the Value card',
    file: WHATIF, spec: YIELDROUND,
    mutate: s => s.replace(
      "                                  if (raw === '') delete next[tier];" + nl +
      '                                  else next[tier] = Number(raw);',
      '                                  next[tier] = Number(raw);') },
  // 65 re-creates the two-baseline divergence by hand-rolling a second baseline
  // over the DERIVED rates, which is exactly what the card did before option
  // (a). It reads as a harmless local computation and silently puts the card
  // back into disagreement with the event row and the applied forecast — one
  // event, two baselines, two deltas. The defect was found by a walk rather
  // than by any instrument, which is why it now has one.
  { id: '65 a second baseline hand-rolled over the derived rates', why: 'card and forecast disagree again about one baseline',
    file: WHATIF, spec: YIELDROUND,
    mutate: s => s.replace(
      '    const rates = Object.values(effectiveTierArpuMap);',
      '    const rates = yieldTierData.map(t => t.baseArpu);') },
  // 66 drops R3's per-band map from the shared reader. Planted where the
  // heuristic is weakest: the carrier is INERT — nothing produces one yet — so
  // no rendered surface and no behavioural fixture can miss it. The round trip
  // through the REAL writer is the only thing standing between this field and
  // the promo-field defect repeating on a third carrier.
  { id: '66 the R3 per-band override dropped from the shared reader', why: 'a stated band rate would not survive a reload',
    file: ENGINE, spec: EVTROUND,
    mutate: s => s.replace(
      '    promoBandArpuOverride: readStoredRateMap(row.Promo_Band_ARPU_Override_JSON),',
      '') },
  // 67 makes the DERIVED rate always win in R3's one effective-rate definition
  // — the override is still stored, still exported, still restored on reopen,
  // and simply never read. That is the nastiest shape this capability can fail
  // in, because every carrier-level check stays green: the map round-trips
  // perfectly and the number the user typed just never reaches the blend or the
  // saved event. Only a MOUNTED transition catches it, which is why the trap
  // points at the mix-card spec rather than a round-trip one.
  { id: '67 the stated band rate stops beating the derived one', why: 'R3 overrides round-trip perfectly and are silently ignored',
    file: WHATIF, spec: MIXCARD,
    mutate: s => s.replace(
      '    m[t.tier] = stated !== undefined ? stated : t.baseArpu;',
      '    m[t.tier] = t.baseArpu;') },
  // 68 drops the draft seed from the single-event edit-restore handler. DEFERRED
  // FROM SESSION 1, which shipped both restore handlers with no mounted proof
  // that a reopened event shows its stated rate — the gap that report named. The
  // saved event still carries the map and the export still writes it; only the
  // reopen forgets, which looks exactly like "the user never typed one".
  //
  // Note it targets the EVENT handler specifically, not the campaign one: the
  // two seed from different rows and a trap that either could satisfy would be
  // the ambiguous-anchor failure trap 64 hit in session 1.
  { id: '68 the reopen forgets the stated band rate', why: 'a saved override silently reverts to derived when reopened',
    file: WHATIF, spec: MIXCARD,
    mutate: s => s.replace(
      '    setDraftPromoBandArpu({ ...(event.promoBandArpuOverride ?? {}) });',
      '') },
  // 69 makes the orphan predicate always empty. The save still refuses — the
  // blend is genuinely null — but nothing renders to say why and nothing offers
  // a remedy, which is EXACTLY the state before this session: a refusal the
  // user cannot act on. The trap proves the orphan rows and the naming refusal
  // are load-bearing rather than decorative.
  { id: '69 the orphan predicate stops finding orphans', why: 'the save refuses again with nothing on screen to fix',
    file: WHATIF, spec: MIXCARD,
    mutate: s => s.replace(
      '    .filter(k => !members.includes(k))',
      '    .filter(() => false)') },
  // 70 drops the MODE restore from the pricing edit-reopen. This is the
  // yieldArpuMode shape, TRAPPED this time rather than diagnosed after the
  // fact: the event still carries the mode and both stated figures, the export
  // still writes them, and only the REOPEN forgets — so a dilution event comes
  // back as a plain percentage event, showing an ARPU delta the user never
  // typed while the two numbers they DID type sit on the event, unshown.
  { id: '70 the pricing reopen forgets the dilution mode', why: 'a dilution event reopens as a plain percentage event',
    file: WHATIF, spec: PRICEROUND,
    mutate: s => s.replace(
      '      pricingMode: ev.pricingMode,',
      '') },
  // 71 drops one (1 - …) term from the retained-revenue ratio. The mode still
  // exists, still round-trips and still renders; only the NUMBER is wrong. The
  // spec pins 25→20 = +6.6667 as a hand-written literal rather than recomputing
  // it with the function under test, which is what makes this catchable.
  { id: '71 the retained-revenue ratio loses a term', why: 'dilution translates to the wrong ARPU percentage',
    file: ENGINE, spec: PRICEROUND,
    mutate: s => s.replace(
      '  return (1 - targetPct / 100) / (1 - currentPct / 100);',
      '  return (1 - targetPct / 100) / (currentPct / 100);') },
  // 72 drops a whole CARRIER from the combined projection. The yield card keeps
  // working and its own list keeps rendering, so nothing on the cards looks
  // wrong — the combined view simply stops being combined, which is the one
  // thing only the table can be wrong about. Planted where the heuristic is
  // weakest: a missing row type is invisible unless something counts kinds.
  { id: '72 a carrier vanishes from the events summary', why: 'the combined view silently stops being combined',
    file: ENGINE, spec: SUMMARYSPEC,
    mutate: s => s.replace(
      '  for (const e of src.yieldEvents ?? []) {',
      '  for (const e of [] as YieldEventLike[]) {') },
  // 73 sorts the combined set by MONTH across kinds. This is the subtle one and
  // the reason the ordering check asserts a sequence rather than a set: a
  // month-sorted table looks like a timeline, reads like a timeline, and is a
  // lie — a pricing event in January still applies after a yield event in June.
  // The decisive spec check is that an EARLIER-month yield row still sorts
  // BELOW later-month market rows, which only pipeline order satisfies.
  { id: '73 the events summary sorts chronologically across kinds', why: 'a plausible-looking timeline that is not the application order',
    file: ENGINE, spec: SUMMARYSPEC,
    mutate: s => s.replace(
      '  return rows.sort((a, b) => a.pass - b.pass || a.month.localeCompare(b.month));',
      '  return rows.sort((a, b) => a.month.localeCompare(b.month));') },
  // 74 drops the WEIGHTING inside the shared function, so the full ratio hits
  // the whole blend — reinstating exactly the defect Jon's walk found, but now
  // in the one place both the apply path AND the display read. That is the
  // point of having extracted it: before, the engine was right and only the
  // display was wrong, and no single edit could have been caught in both.
  { id: '74 the pricing weighting drops out of the shared function', why: 'a scoped event reads as its full ratio against the whole book',
    file: ENGINE, spec: PRICEROUND,
    mutate: s => s.replace(
      '  return (pricedVol * pricedArpu + (totalVol - pricedVol) * blendArpu) / totalVol;',
      '  return pricedArpu;') },
  // 75 makes the block-reason predicate always addable. The button then gates
  // NOTHING and the reason line renders NOTHING, so an incomplete draft reaches
  // a handler that returns silently — which is the pre-fix behaviour with an
  // enabled button, i.e. the shape the decision explicitly rejected.
  { id: '75 the pricing block reason stops finding reasons', why: 'the refusal goes silent again, one layer further down',
    file: ENGINE, spec: PRICEROUND,
    mutate: s => s.replace(
      "  if (!draft.month) return 'whatif_pricing_block_no_month';",
      '  return null;') },
  // 76 reverts the baseline snapshot to the COHORT-scoped series. The number
  // still looks plausible — it is a real ARPU for a real slice, just not the
  // event's — which is why this needs a trap rather than a reader: an event
  // scoped inside the loaded cohort silently takes the cohort's blend as its
  // baseline, and nothing on screen says which slice the figure describes.
  { id: '76 the pricing baseline reverts to the cohort-scoped series', why: 'a narrow event is measured against the wrong slice',
    file: WHATIF, spec: PRICEROUND,
    mutate: s => s.replace(
      '    const matchRow = eventScopeSeries.find((r: any) => r.month === newPricingEvent.month);',
      '    const matchRow = chartData.find(r => r.month === newPricingEvent.month);') },
  // 77 makes the pricing apply filter ignore scope entirely — every pricing
  // event applies to every slice. This is the scenarioHelper divergence
  // reproduced on the side that currently gets it right, and it is the check
  // that the shared predicate is load-bearing rather than decorative.
  { id: '77 the pricing apply path stops filtering by scope', why: 'every pricing event applies to every slice',
    file: WHATIF, spec: PRICEROUND,
    // THE ANCHOR IS EXTENDED UPWARD, not moved, because the bare filter line
    // now appears TWICE in WhatIfTab.tsx: once here in the apply pass and once
    // in the per-scenario ARPU block, which filters through the same shared
    // predicate as it should. `String.replace` takes the first occurrence, so
    // this trap still hit the right site — but only by file order, and a later
    // edit that moved the per-scenario block upward would have silently
    // retargeted it. The preceding comment line is unique to the apply pass.
    mutate: s => s.replace(
      '          if (!eventScopeMatchesView(pe, viewScopeForMatch)) return false;' + nl +
      '          if (pe.duration === \'one-off\') return pe.month === m.month;',
      '          if (pe.duration === \'one-off\') return pe.month === m.month;') },
  // 78 reverts PREVIEW's baseline to the cohort-scoped series while the saved
  // row stays event-scoped — reinstating the disagreement the previous session
  // introduced knowingly and this one closed. Both figures remain plausible
  // ARPUs for real slices, so nothing looks broken; they simply describe
  // different populations, and only a check that they come from ONE invocation
  // can tell.
  { id: '78 Preview reverts to the cohort-scoped baseline', why: 'the previewed figure and the saved row describe different slices',
    file: WHATIF, spec: PRICEROUND,
    mutate: s => s.replace(
      '                        const matchRow = previewScopeSeries?.find((r: any) => r.month === newPricingEvent.month);',
      '                        const matchRow = chartData.find(r => r.month === newPricingEvent.month);') },
  // 79 puts the typed dilution figures into the memo key, so every keystroke
  // re-runs the pipeline. Nothing renders differently — the numbers are right,
  // the card just does a full slice computation per character. A correctness
  // check cannot see this; the key's contents are the only place it shows.
  { id: '79 the preview memo re-runs on every keystroke', why: 'a pipeline run per character, invisible to a correctness check',
    file: WHATIF, spec: PRICEROUND,
    mutate: s => s.replace(
      "    [newPricingEvent.month, newPricingEvent.segment, newPricingEvent.product,",
      "    [newPricingEvent.dilutionCurrentPct, newPricingEvent.dilutionTargetPct,"
      + nl + "     newPricingEvent.month, newPricingEvent.segment, newPricingEvent.product,") },
  // 80 writes the saved volumes from the COHORT series while the baseline stays
  // event-sliced — the mixed-axes defect reintroduced at source, and at the
  // exact moment the fix is written. The stored numbers stay plausible (real
  // volumes for a real slice), so only a check that both come from the SAME
  // series can tell. That is why the assertion is about provenance rather than
  // about the values.
  { id: '80 saved volumes taken from the cohort series, not the event slice', why: 'baseline and weights describe different slices inside one save',
    file: WHATIF, spec: PRICEROUND,
    mutate: s => s.replace(
      '          volumesFromSeries(eventScopeSeries, newPricingEvent.month) ?? { inflow: 0, retention: 0, base: 0 },',
      '          volumesFromSeries(chartData, newPricingEvent.month) ?? { inflow: 0, retention: 0, base: 0 },') },
  // 81 drops the COMPAT branch, so an event saved before this change computes
  // against stored-undefined instead of falling back to the cohort series. Every
  // pre-change event in every existing save file would silently lose its
  // adjusted figure — the population least able to notice, because nobody
  // re-checks events they saved weeks ago.
  { id: '81 the compat branch for field-less events is dropped', why: 'every pre-change saved event loses its adjusted figure',
    file: WHATIF, spec: PRICEROUND,
    mutate: s => s.replace(
      '                            : pricingAdjustedBlend(pe, baseArpu, monthVolumes(pe.month));',
      '                            : null;') },
  // 82 drops the recorded-active-cohort read, so restore ALWAYS falls through
  // to the first stored cohort — the pre-fix behaviour, restored. Nothing
  // errors and a forecast still loads; it is simply the wrong one, and every
  // event scoped elsewhere then looks broken. That is exactly how this arrived
  // as three separate-looking observations on a walk.
  { id: '82 restore stops reading the recorded active cohort', why: 'restore lands on an arbitrary first leaf again',
    file: APP, spec: ACTIVECOHORT,
    mutate: s => s.replace(
      '            const recordedActive = readActiveCohortMeta(getMetaValue);',
      '            const recordedActive = null;') },
  // 83 drops the announcement, so the fallback fires in silence. The app is
  // still WRONG in the same way as before, but now says nothing about it —
  // which is the half of the fix that turns a mystery back into a mystery.
  { id: '83 the fallback stops announcing itself', why: 'an arbitrary cohort is restored in silence',
    file: APP, spec: ACTIVECOHORT,
    mutate: s => s.replace(
      '            if (bf && !recordedBf) setRestoreFellBack(true);',
      '') },
  // 84 disables Scenario Compare's scope filter, so every pricing event applies
  // to every scenario — the shipped divergence, reproduced. Nothing errors and
  // every number stays plausible; events simply reach slices they do not
  // describe. This path had NO gate at all until this session, which is how it
  // diverged from the What-If side unnoticed for the whole arc.
  { id: '84 Scenario Compare stops filtering pricing events by scope', why: 'every pricing event applies to every scenario',
    file: SCENHELPER, spec: SCENPRICE,
    mutate: s => s.replace(
      '      if (!eventScopeMatchesView({',
      '      if (false && !eventScopeMatchesView({') },
  // 85 drops the cohort weighting, so the full ratio hits the whole blend --
  // the exact defect the R4 finding named. An out-of-scope event still does
  // nothing, so the scope check stays green while the WEIGHTED check goes red:
  // the two traps separate the two halves of the correction.
  { id: '85 Scenario Compare stops weighting by target and cohortScope', why: 'a retention-scoped event moves the whole book again',
    file: SCENHELPER, spec: SCENPRICE,
    mutate: s => s.replace(
      '      finalArpu = pools',
      '      finalArpu = priced; void pools; const _unused = pools') },
  // 86 drops the PRICING carrier from Scenario Compare's filter populate — the
  // shipped defect, exactly as Jon met it: the list still populates, still
  // looks complete, and simply omits every scope value that lives only on a
  // pricing event. Nothing errors, so only a check that names a
  // pricing-exclusive value can tell. The three carriers are declared as data
  // precisely so dropping one is a single visible line.
  { id: '86 the Compare filter stops reading pricing events', why: 'a pricing-only scope value cannot be selected',
    file: VIEWFILTER, spec: CMPFILTER,
    mutate: s => s.replace(
      "  { key: 'pricingEvents', segment: 'Segment', product: 'Product', productL2: 'Product_L2',",
      "  { key: 'marketEvents', segment: 'Segment', product: 'Product', productL2: 'Product_L2',") },
  // 87 drops the modifier spread from inside marketEventFromRow. Every promo
  // and override field vanishes from a parsed event, and `isPromotion` — which
  // the sheet stores as the STRING 'Yes'/'No' — stops being converted at all.
  // The extraction's whole safety argument is that the spread rides along with
  // the move, so this is the trap that proves it does.
  //
  // Anchored on TWO adjacent lines, not on the spread alone: the spread's text
  // also appears in the yield reader's neighbourhood and in the spec's oracle,
  // and a one-line anchor with more than one owner is how trap 64 came to
  // report a catch it had not earned.
  { id: '87 marketEventFromRow stops spreading the modifiers', why: 'promo fields and isPromotion vanish from every parsed event',
    // RE-HOMED 2026-08-20. spec:fromrow-equivalence retires here, its own
    // header's condition met. spec:compare-events-panel drives
    // buildPerFileEventPanels -> marketEventFromRow and asserts isPromotion
    // routing BOTH ways, so dropping the spread makes isPromotion undefined,
    // both market events take the Volume card, and those checks go red.
    // The 1136 true-state report PREDICTED this from source; the run proves it.
    file: ENGINE, spec: CMPPANEL,
    mutate: s => s.replace(
      "    ...(source === 'workbook' ? marketFieldsFromWorkbookRow(r) : marketFieldsFromSessionRow(r))," + nl +
      '    ...readStoredEventModifiers(r),',
      "    ...(source === 'workbook' ? marketFieldsFromWorkbookRow(r) : marketFieldsFromSessionRow(r)),") },
  // 88 points the yield reader at a column that does not exist. It still
  // returns a well-formed YieldEvent — with an EMPTY mix, which renders as a
  // card with no tiers rather than as an error, and is exactly the kind of
  // silent degradation a round trip exists to catch.
  //
  // THIS TRAP IS THE PROOF THE PROMOTION BIT. Before spec:yield-roundtrip was
  // promoted it drove its own COPY of the writer and, on the reading side,
  // only readStoredRateMap — one field of thirteen, and no reader at all. A
  // broken reader was invisible to it. If this catches, the spec is genuinely
  // driving the real reader now rather than a copy of it.
  { id: '88 yieldEventFromRow reads the wrong mix column', why: 'every yield event loads with an empty tariff mix',
    file: ENGINE, spec: YIELDROUND,
    mutate: s => s.replace(
      "  try { tariffMix = JSON.parse(String(r.Tariff_Mix_JSON ?? '{}')); } catch {}",
      "  try { tariffMix = JSON.parse(String(r.Tariff_Mix_Json ?? '{}')); } catch {}") },
  // 89 points every file's panel at the MERGED event list instead of its own.
  // Each panel then shows every event from every loaded file — which looks
  // busy and plausible rather than broken, and defeats the one thing Scenario
  // Compare exists to do. The per-file build lives in buildPerFileEventPanels
  // precisely so this trap has something to hit: while the composition sat in
  // a component memo, the spec mirrored it and nothing here could reach it.
  { id: '89 the per-file panels read the merged event list', why: 'every panel shows every file\'s events',
    file: ENGINE, spec: CMPPANEL,
    mutate: s => s.replace(
      "      marketEvents:  (s.marketEvents  ?? []).map(r => marketEventFromRow(r, 'session')),",
      "      marketEvents:  (sessions.flatMap(x => x.marketEvents ?? [])).map(r => marketEventFromRow(r, 'session')),") },
  // 90 drops the YIELD carrier from the per-file parse. The panel still
  // renders, still lists market and pricing rows, and simply omits an entire
  // card's worth of events — the same silent-omission shape as the Compare
  // filter defect, one surface along. Only a check naming a yield-exclusive
  // value can tell, which is why every fixture event is carrier-unique.
  { id: '90 the per-file parse drops the yield carrier', why: 'a whole card\'s events vanish from every panel',
    file: ENGINE, spec: CMPPANEL,
    mutate: s => s.replace(
      '      yieldEvents:   (s.yieldEvents   ?? []).map(yieldEventFromRow),',
      '      yieldEvents:   [],') },
  // 91 removes the START clamp — the exact asymmetry that shipped. endIndex
  // stays clamped, startIndex does not, and a stale offset then produces
  // start > end: a chart with axes and NO LINES, on both views, immune to the
  // time-range buttons. The data is untouched and correct throughout, which is
  // what made the original so hard to place: the 2026-08-20 diagnosis measured
  // 360 matching rows and 24 months of finite values behind a blank screen.
  { id: '91 the brush start index loses its clamp', why: 'a stale offset gives start > end — axes, no lines, intact data',
    file: VIEWFILTER, spec: CMPWINDOW,
    mutate: s => s.replace(
      '  const start = Math.min(Math.max(0, Math.floor(offset) || 0), last);',
      '  const start = Math.floor(offset) || 0;') },
  // 92 drops the reset. The clamp still keeps the window VALID, so nothing
  // breaks and nothing blanks — the view simply lands on the final month of
  // every new series, which reads as a quirk rather than a defect. That is
  // precisely why it needs a guard: a symptom nobody reports is a symptom
  // nobody fixes.
  { id: '92 the brush offset survives a data-length change', why: 'every filter change lands the view on the last month',
    file: APP_COMPARE, spec: CMPWINDOW,
    mutate: s => s.replace(
      '  useEffect(() => { setWindowOffset(0); }, [chartData.length]);',
      '  useEffect(() => { /* reset removed */ }, [chartData.length]);') },
  // 93 puts the chart card back on min-h-0 — the exact 2026-08-20 mechanism.
  // The card is the SOLE flex-1 among shrink-0 siblings in a height-capped
  // column, so min-h-0 lets it reach ZERO and the region then shows nothing at
  // all: no lines, no axis, no message, no scrollbar. A third loaded file was
  // enough to cross it.
  //
  // THE ANCHOR IS SOURCE-LEVEL BECAUSE THE PROPERTY IS. A CSS min-height
  // cannot be measured from Node, so the spec pins the class and this trap
  // removes it. Declared rather than dressed up as a measurement.
  { id: '93 the chart card loses its minimum height', why: 'the region can collapse to zero and show nothing at all',
    file: APP_COMPARE, spec: CMPRENDER,
    mutate: s => s.replace(
      'shadow-sm flex flex-col min-h-[320px]"',
      'shadow-sm flex flex-col min-h-0"') },
  // 94 drops the placeholder guard at its one definition. Every consumer
  // inherits the loss at once, which is the point of putting it there: the
  // phantom market event returns with scenario=undefined, and the panel
  // renders the literal string "undefined" to the user again.
  { id: '94 the placeholder sheet guard stops recognising Note rows', why: 'phantom events return and the panel prints "undefined"',
    file: SHEETGUARD, spec: CMPPANEL,
    mutate: s => s.replace(
      "  return keys.length === 1 && keys[0] === 'Note';",
      '  return false;') },
  // 95 severs the named condition from the state that triggers it. The
  // predicate still computes 'too-short' and nothing is rendered for it — the
  // silent blank restored, which is the whole failure this arc closed.
  { id: '95 the undrawable chart region stops saying so', why: 'a chart that cannot draw goes back to showing nothing',
    file: APP_COMPARE, spec: CMPRENDER,
    mutate: s => s.replace(
      "                  {drawability === 'too-short' && (",
      '                  {false && (') },
  // 96 makes the fold read a STATIC previous base — the naive implementation,
  // and the one that produces plausible numbers. It rolls forward on the
  // SERIES outflow instead of the ADJUSTED one, so month 2 onwards no longer
  // reflects what month 1's event actually did to the base.
  //
  // Month 1 is UNAFFECTED by this mutation, which is exactly why the spec's
  // discriminating case is month 2: a fixture that stopped at one month would
  // stay green under a fold that is wrong for every longer ramp.
  { id: '96 the churn fold rolls on the unadjusted outflow', why: 'every ramp longer than one month drifts from the stated rate',
    file: CHURNENGINE, spec: CHURNFOLD,
    mutate: s => s.replace(
      '    base = Math.max(0, base + (m.inflow ?? 0) - (seriesOutflow - delta));',
      '    base = Math.max(0, base + (m.inflow ?? 0) - seriesOutflow);') },
  // 97 drops the churn clause from the campaign group-edit rule. The group
  // becomes editable and its reverse-engineering — summing |subscriberVolume|
  // — SUCCEEDS on churn rows, producing a total that is not a churn statement
  // and a re-spread that would not reproduce the stated rates.
  // 97 RETIRED 2026-08-21 by D5-revised. It planted the removal of the
  // `anyChurn` group-edit bar — which is now the WANTED behaviour, so the trap
  // was asserting the opposite of the decision. Retired rather than re-aimed:
  // the property it guarded (a churn campaign never reaching the summed-volume
  // spread path) is now guarded by spec:churn-fold's re-aimed BAR checks and
  // by trap 112 below, which plants the members being left in the re-state.
  { id: '98 the workbook route forces churn deltas negative', why: 'a stated churn reduction is imported as an increase',
    file: ENGINE, spec: EVTROUND,
    mutate: s => s.replace(
      '  const neg = (v: number) => (isOut && !isChurn) ? -Math.abs(v) : v;',
      '  const neg = (v: number) => isOut ? -Math.abs(v) : v;') },
  // 99 removes the scenario reset — the walk's defect (c). Leaving Outflow no
  // longer defaults the control or discards the churn draft, so a target
  // stated against an Outflow rate survives onto an Inflow event.
  { id: '99 leaving Outflow no longer resets the amount control', why: 'a churn draft outlives the mode it was stated in',
    file: AMTENGINE, spec: AMTCTRL,
    mutate: s => s.replace(
      "    if (prev === 'churn' && !churnAvailableFor(action.scenario)) {",
      '    if (false) {') },
  // 100 lets the invalid combination back into the DERIVED value — the walk's
  // defect (a). A stored 'churn' then reports as churn on an Inflow draft, and
  // the panel renders where it has no meaning. This is the exclusivity itself:
  // the state stops being unrepresentable and becomes merely unlikely.
  { id: '100 the derived control reports churn off Outflow', why: 'the churn panel renders on a non-Outflow draft',
    file: AMTENGINE, spec: AMTCTRL,
    mutate: s => s.replace(
      "  if (stored === 'churn' && !churnAvailableFor(scenario)) return 'subs';",
      '  return stored;') },
  // 101 re-derives the breakdown instead of reading the fold's own output. It
  // still prints a plausible line — that is the danger — but the figure above
  // it and the inputs beneath it are then computed in two places, which is the
  // shape that lets a displayed number stop explaining the number beside it.
  { id: '101 the churn breakdown re-derives its inputs', why: 'the figure and its stated inputs can disagree',
    file: WHATIF, spec: AMTCTRL,
    mutate: s => s.replace(
      'outflow: Math.round(churnFold[0].targetOutflow + churnFold[0].delta).toLocaleString(),',
      'outflow: Math.round(Number(churnScopeSeries?.[0]?.[String.fromCharCode(79) + "utflow (Adjusted)"]) || 0).toLocaleString(),') },
  // 102 puts the churn branch back BELOW the spread gate — the exact shape the
  // 2026-08-20 wiring diagnosis found. Churn force-clears spreadEnabled, so the
  // gate always fires and every churn Add falls through to App's fifth writer:
  // ONE event, built from the amount field churn had just zeroed, carrying none
  // of the four churn fields.
  //
  // Only a MOUNT can see this. The pure specs cover the fold's arithmetic and
  // the control's transitions exhaustively, and neither can reach routing.
  { id: '102 the churn add falls behind the spread gate', why: 'every churn Add emits one zero-volume event with no churn fields',
    file: WHATIF, spec: MIXCARD,
    // ANCHOR EXTENDED 2026-09-04. `if (isChurnDraft) {` occurs THREE times in
    // WhatIfTab (3159 the ADD path, 3559, 3782), and replace() took the first.
    // That was the intended one - the trap's name says ADD - but by ordering,
    // not by anything the trap stated. The `usable` line disambiguates: only
    // the add path filters on `delta !== 0`.
    mutate: s => s.replace(
      '    if (isChurnDraft) {' + nl +
      '      if (churnBlockReason) return;' + nl +
      '      const usable = churnFold.filter(m => !m.absence && m.delta !== 0);',
      '    if (false && isChurnDraft) {' + nl +
      '      if (churnBlockReason) return;' + nl +
      '      const usable = churnFold.filter(m => !m.absence && m.delta !== 0);') },

  // ---------------------------------------------------------------------
  // 144 - the OVERALL door's blocked branch, which nothing watched.
  //
  // The Step 1 door's copy has been trapped since trap 24. This is the SAME
  // decision at the widest scope, and MEASURED 2026-09-04 it was guarded by
  // nothing at all: gating it to a constant left the entire suite green,
  // because spec:walk-fixes sliced App.tsx from `stdAggregateState` and that
  // slice ends 40 lines above this branch.
  //
  // A blocked book reporting itself covered is the original lie relocated to
  // the one view that shows everything.
  { id: '144 the OVERALL door collapses blocked into covered',
    why: 'a book whose remaining leaves cannot be fitted would claim full coverage',
    file: APP, spec: WALKFIX,
    mutate: s => s.replace(
      '    if (unfittable.length > 0) {' + nl +
      "      return { kind: 'blocked' as const, missing: 0, total: leaves.length," + nl +
      '               unfittable: unfittable.length, keys: [] as string[] };',
      '    if (false) {' + nl +
      "      return { kind: 'blocked' as const, missing: 0, total: leaves.length," + nl +
      '               unfittable: unfittable.length, keys: [] as string[] };') },
  // 103 feeds the LOADED COHORT's forecast back into the churn series, undoing
  // the scope fix. The panel then reads the same base whatever the draft's dims
  // say — the walk's ~293k at every slice — and the breakdown stops moving when
  // the product changes.
  { id: '103 the churn panel reads the loaded cohort again', why: 'the breakdown shows the same base at every slice',
    file: WHATIF, spec: MIXCARD,
    mutate: s => s.replace(
      '    const scoped = churnScopeResolution?.forecast ?? null;',
      '    const scoped = baseForecast;') },
  // 104 stops the companion hide keying on the derived control, so the fields
  // render in churn mode again. They are inert there — applyEventsToMonth reads
  // subscriberVolume alone on this path — and Revenue would double-count the
  // money the base x ARPU recursion already carries. An editable field the
  // engine ignores is the silent-handling defect as an INPUT.
  { id: '104 the churn companions stop hiding', why: 'inert, double-counting fields become editable on a churn row',
    file: WHATIF, spec: MIXCARD,
    mutate: s => s.replace(
      '            {!isChurnDraft && (' + nl + '            <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))]',
      '            {true && (' + nl + '            <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))]') },
  // 105 drops the edit seeding, so a churn row reopens as a bare volume: no
  // panel, no stated target, and the amount box showing a delta that means
  // nothing without its statement. That is the first step of the corruption
  // route — the second being a save that negates it.
  { id: '105 a churn row reopens without its statement', why: 'the panel does not seed and the row becomes a bare volume',
    file: WHATIF, spec: MIXCARD,
    mutate: s => s.replace(
      "      setStoredAmountControl('churn');" + nl + '      setChurnTargetPct(event.churnTargetPct ?? 0);',
      '      setChurnTargetPct(event.churnTargetPct ?? 0);') },
  // 106 routes a churn Save Changes through the ORDINARY save path, which
  // applies neg to an Outflow amount. A stated REDUCTION is stored positive, so
  // it returns NEGATIVE — the event silently inverted into its opposite. This
  // is the exact corruption the 2026-08-20 diagnosis predicted from source, and
  // the branch's POSITION above the neg is what closes it.
  { id: '106 the churn edit-save falls through to the negating path', why: 'a reopened churn reduction is saved as an increase',
    file: WHATIF, spec: MIXCARD,
    mutate: s => s.replace(
      '    if (isChurnDraft) {' + nl + '      if (churnBlockReason) return;' + nl + '      const m = churnFold.find(x => !x.absence);',
      '    if (false) {' + nl + '      if (churnBlockReason) return;' + nl + '      const m = churnFold.find(x => !x.absence);') },
  // 107 lets a ramp MEMBER be row-edited. Its cumulative target is meaningless
  // alone — month 2 of a 1/3/6 ramp states six points against a base the first
  // two months already moved — so editing it desyncs the member from its
  // siblings and the ramp stops describing the rate it was stated as.
  { id: '107 a churn ramp member can be row-edited', why: 'one member desyncs and the ramp stops meaning its stated rate',
    file: WHATIF, spec: MIXCARD,
    mutate: s => s.replace(
      '      if (siblings.length > 1) {',
      '      if (false) {') },
  // 108 feeds the LOADED COHORT back into the pricing series, which is exactly
  // what the code did before this session. Both weighting volumes and the
  // baseline ARPU then belong to whatever cohort Step 1 happens to hold, and
  // the mount MEASURED that: 20.40 / 32,760.06 for the wide cohort where the
  // draft's own slice was 24.00 / 26,208.05.
  //
  // THE INVARIANCE CHECK STAYS GREEN UNDER THIS TRAP, deliberately: with the
  // slice loaded, C = S and the wrong feed gives the right answer. That is what
  // makes the mount's WIDE-loaded configuration the load-bearing one, and why
  // an invariance check alone would not have protected this.
  { id: '108 the pricing series is fed the loaded cohort, not the draft slice',
    why: 'baseline ARPU and both weighting volumes revert to whatever Step 1 loaded',
    file: WHATIF, spec: MIXCARD,
    mutate: s => s.replace(
      '    if (!resolution.forecast) return { series: null, reason: resolution.reason ?? null };' + nl +
      '    return { series: computeAdjustedForecast({' + nl +
      '    baseForecast: resolution.forecast, marketEvents, yieldEvents,',
      '    if (!resolution.forecast) return { series: null, reason: resolution.reason ?? null };' + nl +
      '    return { series: computeAdjustedForecast({' + nl +
      '    baseForecast, marketEvents, yieldEvents,') },
  // 109 forks the shared helper into a card-local copy. The count is what
  // catches it: the behaviour is IDENTICAL the moment it is planted, so no
  // figure moves and only the exactly-two-callers pin can see it. That is the
  // point — this trap guards against the shape that produces a divergence
  // later, not one that produces a wrong number now.
  { id: '109 the scope helper is forked into a third, card-local call site',
    why: 'a third resolution site is how two implementations that agree today diverge tomorrow',
    file: WHATIF, spec: MIXCARD,
    mutate: s => s.replace(
      '  const pricingScopeReason = useMemo((): string | null => {',
      '  const _forkedScope = () => resolveEventScopeForecast({ segment: newPricingEvent.segment }, resolveForecast);' + nl +
      '  void _forkedScope;' + nl +
      '  const pricingScopeReason = useMemo((): string | null => {') },
  // 110 re-enables the churn Add on a draft the handler will refuse. The
  // handler's own guard still fires, so NOTHING BREAKS and no wrong figure is
  // produced — the click is simply swallowed. That is the walked defect
  // exactly, and the reason this trap targets the BUTTON rather than the
  // handler: the failure is that the surface does not communicate, not that
  // the logic is wrong.
  { id: '110 the churn Add is enabled on a draft the handler will refuse',
    why: 'a live button that silently discards a click reads as a bug, whatever the form prints elsewhere',
    file: WHATIF, spec: MIXCARD,
    mutate: s => s.replace(
      'disabled={!newEvent.date || newEvent.subscriberVolume === undefined || churnBlockReason !== null}',
      'disabled={!newEvent.date || newEvent.subscriberVolume === undefined}') },
  // 111 restores the stale dependency array on handleEditStart — the exact
  // defect found this session. The callback reads `marketEvents` but would be
  // memoised on `[setNewEvent]` alone, and App's setNewEvent is a raw useState
  // setter, so the closure captures an EMPTY event list for the component's
  // lifetime and the ramp-member decline never fires.
  //
  // THE MOUNT CAN ONLY SEE THIS BECAUSE ITS PROPS ARE NOW STABLE. While the
  // harness passed an inline arrow, the dependency changed every render, the
  // callback was rebuilt every render, and this trap would have MISSED.
  { id: '111 handleEditStart is memoised without the events it reads',
    why: 'the ramp-member decline becomes structurally unreachable and the pencil opens a partial statement',
    file: WHATIF, spec: MIXCARD,
    mutate: s => s.replace(
      '  }, [setNewEvent, marketEvents, t]);',
      '  }, [setNewEvent]);') },
  // 112 puts the campaign's own member rows back into the series the re-state
  // folds against. The campaign then re-states against its own effect: the
  // churn it already removed reads as the current rate, so currentPct and
  // prevBase both move and the deltas do not reproduce.
  { id: '112 the churn re-state sees the campaign rows it is replacing',
    why: 'a campaign re-stated against its own effect derives a trajectory nobody stated',
    file: WHATIF, spec: MIXCARD,
    mutate: s => s.replace(
      '      marketEvents: churnExcludedIds.size > 0' + nl +
      '        ? marketEvents.filter(e => !churnExcludedIds.has(e.id))' + nl +
      '        : marketEvents,',
      '      marketEvents,') },
  // 113 moves the sign flip from the DISPLAY site to the STORAGE path. The Δ
  // column still reads correctly — so the display literal stays GREEN — while
  // D4's signed-verbatim pins go red. That pairing is the point: it is what
  // distinguishes "the figure looks right" from "the fix is on the right
  // layer", and only a trap that leaves one half green can prove it.
  { id: '113 the churn sign is flipped on the storage path, not the display',
    why: 'the Δ column still reads right while every stored row carries an inverted delta',
    file: WHATIF, spec: MIXCARD,
    mutate: s => s.replace(
      '        subscriberVolume: m.delta,' + nl +
      '        customerVolume:  0,' + nl +
      '        revenue:         0,' + nl +
      '        arpu:            0,' + nl +
      '        name:            \'\',' + nl +
      '        campaignName:    editingCampaign,',
      '        subscriberVolume: -m.delta,' + nl +
      '        customerVolume:  0,' + nl +
      '        revenue:         0,' + nl +
      '        arpu:            0,' + nl +
      '        name:            \'\',' + nl +
      '        campaignName:    editingCampaign,') },
  // 114 feeds the BLENDED figure into a per-scenario slot. The no-event
  // identity is what catches it: with no events each per-scenario ARPU must BE
  // its own baseline band, and the fixture's blend (20) matches none of the
  // four — which is why the fixture asserts that before asserting anything
  // else. A fixture whose blend happened to equal a scenario's ARPU would let
  // this through.
  { id: '114 a per-scenario ARPU is fed the blended figure',
    why: 'the blend has a different denominator, so the scenario reads a rate that is not its own',
    file: WHATIF, spec: SCENARPU,
    mutate: s => s.replace(
      '          baselineArpu: fcM?.inflowArpu?.mean,',
      '          baselineArpu: fcM?.arpu?.mean,') },
  // 115 weights base ARPU by INFLOW instead of the adjusted base stock. The
  // aggregate-equals-leaf-sum literal is not what catches this one — the base
  // VOLUME assertion is, because revenue is ARPU x volume and the volume is now
  // a flow. Recorded because the trap and the check that catches it are not the
  // pair the brief predicted, and the difference is worth knowing.
  { id: '115 base ARPU is weighted by inflow, not the adjusted base stock',
    why: 'it answers what the newly-acquired are worth, not what the installed base is worth',
    file: WHATIF, spec: SCENARPU,
    // RE-ANCHORED 2026-09-03. The base term's natural volume was
    // `newBAdj - p_eventPools.reduce(...)`; it now subtracts only the pools the
    // T+1 lag has DELIVERED, so the old anchor named a line that no longer
    // exists. It planted nothing and reported INCONCLUSIVE — the state that
    // exists so a trap cannot go green by failing to fire. Trap 13's lesson,
    // and the second time this file has paid for it.
    mutate: s => s.replace(
      '            naturalVolume: Math.max(0, newBAdj - delivered.reduce((t, p) => t + p.size, 0)),',
      '            naturalVolume: m.uplifted.inflow,') },
  // 116 touches the BLENDED column's formula. The pricing pin goes red while
  // every per-scenario check stays GREEN — that pairing is the layer proof, and
  // only a trap that leaves one half green can demonstrate it.
  { id: '116 the blended ARPU column formula is altered',
    why: 'chartData ARPU (Adjusted) is the pricing card stored originalBaseArpu feed',
    file: WHATIF, spec: SCENARPU,
    mutate: s => s.replace(
      '      pricingARPU = Math.max(0, pricingARPU);' + nl + nl + '      m.uplifted.arpu = pricingARPU;',
      '      pricingARPU = Math.max(0, pricingARPU * 1.01);' + nl + nl + '      m.uplifted.arpu = pricingARPU;') },
  // 117 plots the BLENDED column under a scenario button — the exact confusion
  // the grid removes. The per-scenario literals catch it because the fixture's
  // blend (20) matches none of the four scenario ARPUs, which that spec asserts
  // before it asserts anything else.
  { id: '117 a scenario line is fed the blended column',
    why: 'the grid exists because the blend is not any scenario, and drawing it as one restores the defect',
    file: WHATIF, spec: SCENARPU,
    mutate: s => s.replace(
      "    out[`${label} ARPU (Baseline)`] = bArpu === null ? null : +bArpu.toFixed(2);",
      "    out[`${label} ARPU (Baseline)`] = fcM?.arpu?.mean ?? null;") },
  // 118 multiplies a scenario's ARPU by the WRONG scenario's volume. Revenue is
  // ARPU x THAT scenario's volume, and the four baseline revenues are asserted
  // DISTINCT for exactly this reason — a fixture where two collided would let
  // this through.
  { id: '118 revenue is ARPU times another scenario\'s volume',
    why: 'revenue must be that scenario\'s rate over that scenario\'s population, or it belongs to neither',
    file: WHATIF, spec: SCENARPU,
    mutate: s => s.replace(
      "    out[`${label} Revenue (Baseline)`] = bArpu === null ? null : +(bArpu * baseVol).toFixed(2);",
      "    out[`${label} Revenue (Baseline)`] = bArpu === null ? null : +(bArpu * m.baseline.inflow).toFixed(2);") },
  // 119 drops an EXISTING chart column. The chart export writes chartData
  // wholesale, so the row's key order IS the export's column order and removing
  // one is a removed export column — which the additive-only rule forbids. The
  // key-order literal catches it; a presence check would not, because the
  // sixteen new columns would still all be there.
  { id: '119 an existing chartData column is dropped from the export',
    why: 'the chart export writes chartData wholesale, so a dropped key is a removed export column',
    file: WHATIF, spec: SCENARPU,
    mutate: s => s.replace(
      "        'ARPU Outflow (Ref)':   +(baseForecast.months[idx]?.outflowArpu?.mean ?? m.baseline.arpu).toFixed(2),",
      '') },
  // 120 restores W6a's actual defect: a per-tab default naming the retired
  // blend. This is the load-bearing half of the fix.
  //
  // ITS FIRST AIM WAS VACUOUS AND THE HARNESS SAID SO. It removed the
  // DERIVATION's fallback instead, and MISSED — because with the defaults
  // corrected, `picked` is never empty and the fallback it removed was never
  // reached. A trap that plants something nothing can observe is not a weaker
  // trap, it is not a trap; the "what would this actually redden?" test was
  // owed before the run and was not paid.
  //
  // Caught by the SOURCE-level defaults check, which exists precisely because
  // the runtime check cannot see a bad default any more — the fallback rescues
  // it. The click-path spec stays GREEN throughout, which is the layer proof
  // the brief asked for: the toggle handler was never the invariant.
  { id: '120 a per-tab default names the retired blend again',
    why: 'the scenario row cannot represent it, so the selection derives to nothing — W6a exactly',
    file: WHATIF, spec: MIXCARD,
    mutate: s => s.replace(
      "  pricing:   ['Inflow', 'Outflow', 'Retention', 'Base'],",
      "  pricing:   ['ARPU'],") },

  // ---------------------------------------------------------------------
  // 121 / 122 — the LOCALE PARITY class (Jon, 2026-09-02). German and
  // Italian are the core UAT languages, so a string rendering English in a
  // German session is UAT-blocking rather than cosmetic.
  //
  // These two are planted on DIFFERENT SURFACES on purpose, because the
  // class has two shapes and only one of them is visible to a bundle scan:
  //
  //   121 — a locale VALUE reverts to its English string. Visible in the
  //         bundle, which is the shape the parity check reads.
  //   122 — a label goes back to a hardcoded LITERAL, so it never reaches a
  //         bundle at all. It renders English in all six languages while a
  //         value-comparing check reports perfectly clean. That is the
  //         shape that hid Subs / % and the Compare window sizes until this
  //         session, and it is why the spec pins a literal count as well as
  //         comparing values.
  //
  // 121 also moves the (key, locale) pair count off its pin, so it reddens
  // twice by two independent routes. That is deliberate: an allowlist is
  // exactly the structure where the cheap way to silence a failure is to
  // widen the exemption, and an exact count makes widening it a visible edit.
  { id: '121 a German string reverts to its English value',
    why: 'de is a core UAT language — an English string in a German session is a defect, not a cosmetic gap',
    file: DEBUNDLE, spec: I18NPARITY,
    mutate: s => s.replace('"whatif_export": "Exportieren"', '"whatif_export": "Export"') },

  { id: '122 a keyed label goes back to a hardcoded literal',
    why: 'a literal never reaches the bundles, so it renders English in all six while a value check stays green',
    file: WHATIF, spec: I18NPARITY,
    mutate: s => s.replace(
      "{mode === 'absolute' ? t('whatif_amount_unit_subs') : t('whatif_amount_unit_pct')}",
      "{mode === 'absolute' ? 'Subs' : '%'}") },

  // ---------------------------------------------------------------------
  // 123 — RE-AIMED FROM THE BRIEF, and the re-aiming is the finding.
  //
  // The 1242 brief asked for "one mixConstraint reason back to a bare
  // English literal". That trap cannot exist: all seventeen ARE bare English
  // literals and are supposed to be. They are `detail` strings on blocked
  // outcomes, diagnostic only, and the card renders its own keyed copy by
  // branching on `reason` — verified 2026-09-02, zero `.detail` reads in the
  // only component that consumes them. The 1028 report called them
  // "genuinely user-facing" and it was wrong; this brief inherited that.
  //
  // So the trap is aimed at the invariant that MAKES them safe rather than
  // at their Englishness. Rendering one turns a diagnostic into user-facing
  // English in six locales, and that is the defect worth a trap.
  { id: '123 a mixConstraint diagnostic is rendered to the user',
    why: 'the seventeen are excluded from must-key ONLY because nothing renders them; rendering one makes them a gap',
    file: WHATIF, spec: I18NSCAN,
    // RE-ANCHORED 2026-09-03: autoBalanceMix gained a `locked` parameter when
    // the Value card started passing its padlocks, so the hard-coded [] this
    // anchor named no longer exists. It planted nothing and reported
    // INCONCLUSIVE — the THIRD anchor to age out in three days (13, 115, 123),
    // every one on code a session was actively changing.
    mutate: s => s.replace(
      "const outcome = rebalance(members, seeded, locked, changedTier, newValue);",
      "const outcome = rebalance(members, seeded, locked, changedTier, newValue);\n" +
      "      if (outcome.kind === 'blocked') console.warn(outcome.detail);") },

  // ---------------------------------------------------------------------
  // 124 — THE LAYER PROOF for TERMBASE §11. Translating the forecastType
  // IDENTIFIER must break the old-save round trip while every label check
  // stays green, because the two are different strings doing different jobs.
  //
  // §11 records that this failure is SILENT: cohort ids written under one
  // locale simply stop matching those written under another, with no error
  // anywhere. Nothing at runtime would report it, which is exactly why it
  // needs a trap rather than a comment.
  { id: '124 the forecastType identifier is translated',
    why: 'a translated cohort-key segment silently stops matching every previously saved session',
    file: APP, spec: FTSPLIT,
    // ANCHOR EXTENDED 2026-09-04. The string occurred twice in App.tsx: the
    // real assignment at 3721 and a PROSE MENTION of it at 3795, inside the
    // comment recording why the What-If branch was deleted. replace() took the
    // first, which was the right one - but only because the code happens to
    // precede the comment about it. Adding the `scenario: scen,` line pins it
    // to the assignment, and a comment can no longer decide where a trap
    // plants by being moved above the code it describes.
    mutate: s => s.replace(
      "                forecastType: 'Standard Forecast'," + nl +
      '                scenario: scen,',
      "                forecastType: 'Standardprognose'," + nl +
      '                scenario: scen,') },

  // ---------------------------------------------------------------------
  // 125 — UAT-D2-02. The ARPU companion is money per subscriber; the row's
  // `fmtDelta` keys off `isPercentage`, which describes subscriberVolume.
  // Pointing the ARPU cell back at it restores the defect exactly: a stated
  // 25 renders "+25.0%" on a percentage row and "+25.00" on an absolute one,
  // for a companion the ENGINE treats identically in both — measured, two
  // events adding the same 100 subscribers give byte-identical ARPU series.
  //
  // Aimed at the CELL rather than at fmtArpu's body on purpose. Deleting the
  // helper is a compile error and would be caught by anything; silently
  // calling the neighbouring formatter is the mistake that actually happened
  // and the one nothing else would notice.
  { id: '125 the ARPU cell formats a rate with the volume formatter',
    why: 'a rate is not a percentage — the companion means the same thing in both volume modes',
    file: WHATIF, spec: ARPUCOMP,
    mutate: s => s.replace(
      "{arpuDelta !== null ? fmtArpu(arpuDelta) : '—'}",
      "{arpuDelta !== null ? fmtDelta(arpuDelta) : '—'}") },

  // ---------------------------------------------------------------------
  // 126 — the "N events applied" caption back to counting the raw array
  // (Jon, 2026-09-02: it counts what was applied AT THIS VIEW).
  //
  // The reason this earns a trap rather than a comment is what the old count
  // DID during UAT-D2-03: a leaf-scoped event showed "1 event applied" at an
  // aggregate whose Base delta was +0.00, and the caption was read as
  // corroboration that the event had reached the aggregate. It corroborated
  // nothing — it would have printed 1 at a view the engine never touched. A
  // caption that cannot be wrong cannot be evidence, and this one was quoted
  // as evidence in a walk.
  { id: '126 the applied-events caption counts the store, not the view',
    why: 'a count identical at every view cannot disagree with the deltas beside it, so it reads as corroboration when it is not',
    file: WHATIF, spec: APPLIEDCOUNT,
    mutate: s => s.replace(
      "eventCount: appliedHere.size",
      "eventCount: marketEvents.length") },

  // ---------------------------------------------------------------------
  // 127 — a percentage event weighted by HISTORY again (UAT-D2-03).
  //
  // eventCoverage weights leaves by summed history; the value it scales is a
  // fitted forecast. The two denominators agree in every synthetic fixture
  // anyone would write, which is why this survived a session that measured it
  // head-on and was only caught on a real save: at 02 Sep's walk file a +10%
  // event moved the aggregate 41.20 where its own leaf moved 48.28.
  //
  // The trap removes the forecast-weighted preference and keeps the fallback,
  // which is the shape the mistake would actually take — someone "simplifying"
  // the ?? away. Deleting forecastCoverage outright is a compile error that
  // anything would catch.
  { id: '127 a percentage event is weighted by history, not the forecast',
    why: 'the aggregate then moves by less than its own leaf, and bottom-up stops holding',
    file: WHATIF, spec: AGGRECON,
    mutate: s => s.replace(
      "            ? (forecastCoverage(e, metricOf(e), month.month, viewLeafForecasts)\n" +
      "               ?? eventCoverage(e, viewScope, leavesFor(e)))",
      "            ? eventCoverage(e, viewScope, leavesFor(e))") },

  // ---------------------------------------------------------------------
  // 128 — the apply path takes back its own copy of the scope rule.
  //
  // This is UAT-D2-03 itself. The market-event apply filter carried an inline
  // reimplementation of eventScopeMatchesView, and the copy tested the view
  // side with `!vprodL1` — so only `null` counted as All. cohortScope maps
  // `cohort.product ?? null`, and `??` converts only nullish, so a cohort whose
  // product is the STRING 'All' stayed 'All', which is truthy. A leaf-scoped
  // event was therefore WITHHELD from every view broad enough to contain it,
  // while the tooltip — which already called the shared predicate — listed it.
  // Jon walked into a card reading +0.00 and "0 events applied" beside a
  // tooltip naming both events.
  //
  // The trap restores the copy verbatim. It is caught by the MOUNTED spec and
  // by nothing else, which is the point: three sessions handed the engine the
  // event directly and the engine was right every time. A filter in front of
  // the engine is invisible to every check that starts at the engine.
  { id: '128 the apply path re-hand-rolls the view scope rule',
    why: 'null-as-All only, so a cohort dim of string \"All\" withholds a leaf-scoped event from every broader view',
    file: WHATIF, spec: VIEWAPPLY,
    mutate: s => s.replace(
      "        && eventScopeMatchesView(\n" +
      "          { segment: e.segment, product: e.product, productL2: e.productL2,",
      "        && (e.product === 'All' || !vprodL1 || e.product === vprodL1)\n" +
      "        && eventScopeMatchesView(\n" +
      "          { segment: e.segment, product: e.product, productL2: e.productL2,") },

  // ---------------------------------------------------------------------
  // 129 — a zero-coverage event counted as applied again.
  //
  // An event that passes the scope predicate but whose coverage at the view
  // is 0 moves nothing there. Recording it in appliedEventIds made the KPI
  // caption say \"1 event applied\" beside a Base delta of +0.00 — a caption
  // asserting an effect the number next to it denied, which is the same
  // failure trap 126 was written for, one layer further in.
  //
  // The trap keeps the zeroCoverageIds record and restores only the
  // unconditional push, so exactly ONE thing is wrong: the count. That is
  // deliberate — a trap that breaks three surfaces at once cannot tell you
  // which of them the spec is actually pinning.
  { id: '129 a zero-coverage event is counted as applied',
    why: 'the caption then asserts an effect the delta beside it denies',
    file: ENGINE, spec: VIEWAPPLY,
    mutate: s => s.replace(
      "    if (coversNothing(e)) { zeroCoverageIds.push(e.id); return; }",
      "    if (coversNothing(e)) { zeroCoverageIds.push(e.id); }") },

  // ---------------------------------------------------------------------
  // 130 — eventProRataShare answers the two questions with one number again.
  //
  // The empty-target branch used to return 1 whether the leaf set was EMPTY
  // (no denominator — cannot answer) or merely held nothing inside the
  // event's target (a measured zero). An absolute event aimed at a slice the
  // view does not contain therefore applied at FULL magnitude, while the
  // percentage path returned 0 for the same event — the two weighting
  // functions disagreeing about the same ghost.
  //
  // The trap restores the all-or-nothing return AHEAD of the null branch, so
  // the null case never runs and both worlds answer 1 again. Caught only by
  // the mounted spec, which is the fixture this change had to bring with it:
  // 0857 measured the blast radius across all 55 specs as ZERO, meaning
  // nothing that existed would have caught it going in wrong.
  { id: '130 eventProRataShare conflates cannot-answer with measured zero',
    why: 'an absolute event applies in full to a view holding none of its target',
    file: ENGINE, spec: VIEWAPPLY,
    mutate: s => s.replace(
      // The bare `if (leaves.length === 0) {` appears three times in this
      // file; the NO DENOMINATOR comment is what makes the anchor unique. An
      // anchor that relies on being the first match plants somewhere else the
      // day a line is added above it — trap 13's lesson.
      "  if (leaves.length === 0) {\n    // NO DENOMINATOR.",
      "  if (targetIdx.length === 0) { return leafWithinScope(event, cohort) || leafWithinScope(cohort, event) ? 1 : 0; }\n" +
      "  if (leaves.length === 0) {\n    // NO DENOMINATOR.") },

  // ---------------------------------------------------------------------
  // 131 — the re-banded Retention pool hand-rolls the scope rule again.
  //
  // D3-02. The pool that isolates a promotion's re-banded ARPU filtered with
  // its own copy of the rule carrying `!vprodL1`, so only null counted as All
  // while cohortScope hands the engine the STRING. The pool was never carved
  // at any view broad enough to contain the promotion, and the promotion's
  // ARPU fell silently back into the standing base.
  //
  // Same mechanism as trap 128, a different surface: there the event's VOLUME
  // went missing at the aggregate, here its ARPU does. Measured before the
  // fix: arpuDelta 0.94 at the leaf, 0.00 at All and at Corporate/All.
  { id: '131 the re-banded pool re-hand-rolls the view scope rule',
    why: "a promotion's re-banded ARPU vanishes at every view broad enough to contain it",
    file: WHATIF, spec: VIEWAPPLY,
    mutate: s => s.replace(
      "          eventScopeMatchesView(\n            { segment: e.segment, product: e.product, productL2: e.productL2,\n              channelL1: e.channel, channelL2: e.channelL2,\n              tariffL1: e.tariffL1, tariffL2: e.tariffL2 },\n            viewScopeForMatch),",
      "          (e.product === \'All\' || !vprodL1 || e.product === vprodL1),") },

  // ---------------------------------------------------------------------
  // 132 — a FRESH hand-rolled comparison anywhere in the tab.
  //
  // The caller pin counts sites that DO call the shared predicate and is
  // silent about one that never does — which is exactly how four copies
  // survived inside a file whose pin was green. This trap plants a copy that
  // calls nothing, so ONLY the structural check can catch it.
  { id: '132 a fresh hand-rolled view comparison is added',
    why: 'a caller count cannot see a non-caller — the structural check is what closes that',
    file: WHATIF, spec: PRICEROUND,
    mutate: s => s.replace(
      "    const vtarL2 = viewTariff.l2;",
      "    const vtarL2 = viewTariff.l2;\n    const strayOk = (d: string) => d === \'All\' || !vprodL1 || d === vprodL1;\n    void strayOk;") },

  // ---------------------------------------------------------------------
  // 133 — the pricing card takes its baseline from the BLEND again (Q3).
  //
  // Jon, 2026-09-02: the Baseline ARPU is the per-scenario figure for the
  // subscribers the event applies to. Reading the blended column instead
  // gives a plausible number for the wrong population — the whole reason the
  // per-scenario quantities were built beside the blend rather than on top of
  // it. Caught twice over: the exactly-two-callers pin AND the structural
  // check that no caller reads the blended column.
  { id: '133 the pricing baseline reads the blended column again',
    why: 'a plausible rate for the wrong population — the blend is not the priced cohort',
    file: WHATIF, spec: PRICEROUND,
    mutate: s => s.replace(
      "    const originalBaseArpu = perScenarioBase ?? 0;",
      "    const originalBaseArpu = matchRow ? (matchRow['ARPU (Adjusted)'] as number) : 0;") },

  // ---------------------------------------------------------------------
  // 134 — the ARPU Delta card shows the blend again instead of four (Q4).
  //
  // The blended figure has no UI consumer after Q4. Restoring it here removes
  // the four per-scenario testids the card now renders, which is what the
  // mounted spec reads.
  { id: '134 the ARPU Delta card renders one blended figure again',
    why: 'four per-scenario deltas each have one denominator; the blend has three under one name',
    file: WHATIF, spec: VIEWAPPLY,
    mutate: s => s.replace(
      "                      data-testid={`impact-arpu-delta-${kpi.toLowerCase()}`}",
      "                      data-testid={`impact-arpu-RETIRED-${kpi.toLowerCase()}`}") },

  // ---------------------------------------------------------------------
  // 135 — the per-scenario pools take back the retired sizing.
  //
  // Jon, 2026-09-03: a pool feeds the ARPU of the scenario whose cohort it
  // describes. The construction that fed those terms before sized a pool from
  // `Math.abs(e.subscriberVolume)` — no view share, and no percentage
  // resolution. For a percentage event that field HOLDS THE PERCENT, so a
  // +10% event became a pool of ten subscribers at the stated rate: a
  // fabricated population, priced.
  //
  // Measured at the leaf on the mounted card, both figures by hand: the
  // resolved pool gives an Inflow ARPU delta of 1.18, the retired sizing 0.59.
  // Absolute events agree, which is why nothing caught this for as long as
  // the fixtures held only absolute events.
  { id: '135 the per-scenario pools size from the stored volume again',
    why: "a percentage event's pool becomes its PERCENT read as a subscriber count",
    file: WHATIF, spec: VIEWAPPLY,
    mutate: s => s.replace(
      "            volume: Math.max(0, resolvedEventVolume(\n              e,\n              e.subscriberVolume * eventShare(e),\n              m.derivations,\n              scen === 'Retention' ? 'retention' : 'inflow',\n            )),",
      "            volume: Math.abs(Number(e.subscriberVolume) || 0),") },

  // ---------------------------------------------------------------------
  // 136 — Base sees a pool in its own month again.
  //
  // Base must see a pool ONLY once the T+1 lag has delivered it. The
  // re-banded Retention pool is pushed in its event month, so without the
  // filter Base moves in the month a promotion is STATED rather than the
  // month its subscribers reach the stock. Measured: base 0 at T and 0.94 at
  // T+1; without the filter it is non-zero at T.
  { id: '136 Base counts a pool in the month it was stated',
    why: 'the stock moves before the subscribers reach it — the lag is the whole point',
    file: WHATIF, spec: VIEWAPPLY,
    mutate: s => s.replace(
      "          const delivered = p_eventPools.filter(p => p.eventMonthIdx < idx);",
      "          const delivered = p_eventPools;") },

  // ---------------------------------------------------------------------
  // 136 — the Value card stops passing its padlocks.
  //
  // Jon, 2026-09-03: a lock is the user's, and only the user unlocks it. A
  // hard-coded [] here unlocks every padlock silently — the sliders still
  // move, the totals still reach 100, and nothing else looks wrong. It is
  // caught by a SOURCE check, which is the weaker kind and is labelled as
  // such: the mounted coverage that would drive the padlock through the DOM
  // does not exist yet and is recorded as the remaining piece.
  { id: '138 the Value card drops its lock set',
    why: "a hard-coded [] unlocks every padlock the user set, silently",
    file: WHATIF, spec: LOCKRT,
    mutate: s => s.replace(
      "    setDraftMix(prev => autoBalanceMix(prev, changedTier, newValue, yieldMixLocked));",
      "    setDraftMix(prev => autoBalanceMix(prev, changedTier, newValue));") },

  // ---------------------------------------------------------------------
  // 137 — the export drops the lock column.
  //
  // Persistence IS the decision, so losing the column is losing it. The trap
  // reddens eight checks, and one of them is arithmetic rather than
  // structural: with the column gone the restored mix rebalances a held share
  // from 30 to 22.5. That is what makes the round trip a check on the
  // BEHAVIOUR rather than on the presence of a field.
  { id: '139 the lock column is dropped from the export',
    why: 'a lock that does not survive the save has been unlocked by the tool',
    file: ENGINE, spec: LOCKRT,
    mutate: s => s.replace(
      "    Promo_Mix_Locked: e.mixLocked && e.mixLocked.length ? JSON.stringify(e.mixLocked) : '',",
      "    Promo_Mix_Locked_DROPPED: '',") },

  // ---------------------------------------------------------------------
  // 140 — the two reasons collapse into one.
  //
  // A slider is immovable EITHER because the user held it OR because the
  // constraints leave it a single value. The padlock must reflect only the
  // first. Collapsing them makes the control claim a hold the user never set,
  // which is the specific thing `held` and `immovable` are separate props to
  // prevent. Shed in 1626, so until now the distinction was carried by a
  // comment and a prop shape and by nothing that would fail.
  { id: '140 the padlock claims a hold the user never set',
    why: 'a collapsed range is not a padlock, and must not draw itself as one',
    file: SLIDERROW, spec: VALUEPAD,
    mutate: s => s.replace(
      '        aria-pressed={held}',
      '        aria-pressed={held || immovable}') },

  // ---------------------------------------------------------------------
  // 141 — the save drops the user's padlocks through a stale closure.
  //
  // THIS IS A DEFECT THIS SPEC ACTUALLY FOUND, not a hypothetical. The
  // construction site reads `mixLocked: yieldMixLocked.length ? [...] :
  // undefined` and is correct; the callback simply did not list
  // `yieldMixLocked` among its dependencies, so it closed over the empty set
  // the card opened with. Every source-level check of the construction site
  // passed the whole time the saved event was coming out empty, which is why
  // the trap is pointed at a MOUNTED spec: only clicking the padlock and then
  // clicking save can tell the two apart.
  { id: '141 the yield save reads a stale lock set',
    why: 'a dependency array narrower than its read-set silently saves old state',
    file: WHATIF, spec: VALUEPAD,
    mutate: s => s.replace(
      '  }, [newYieldEvent, draftMix, mixAxis, yieldTierData, yieldMixLocked, effectiveTierArpuMap,',
      '  }, [newYieldEvent, draftMix, mixAxis, yieldTierData, effectiveTierArpuMap,') },

  // ---------------------------------------------------------------------
  // 142 — the OTHER two reads of the same save, which are only observable
  // TOGETHER.
  //
  // MEASURED, not assumed. Dropping `effectiveTierArpuMap` alone leaves the
  // spec GREEN; dropping `draftTierArpuOverride` alone leaves it GREEN. The
  // two cover each other: the map is DERIVED from the override, so typing an
  // override changes both, and whichever one is still listed is enough to
  // rebuild the callback with a fresh copy of the other. Only dropping BOTH
  // is a defect a test can see - the engine then reads the derived rate
  // instead of the figure the user typed.
  //
  // So this is ONE trap where a brief asked for two, and the reason is a
  // measurement rather than a judgement. Two traps were planted by hand
  // first, and both were MISSED; a registry entry for either would have been
  // a trap that can never go red.
  { id: '142 the yield save reads a stale ARPU override',
    why: 'the engine would read the derived rate while the card showed the stated one',
    file: WHATIF, spec: VALUEPAD,
    mutate: s => s.replace(
      '  }, [newYieldEvent, draftMix, mixAxis, yieldTierData, yieldMixLocked, effectiveTierArpuMap,' + nl +
      '      draftTierArpuOverride, addYieldEvent, editingYieldId, updateYieldEvent, setNewYieldEvent]);',
      '  }, [newYieldEvent, draftMix, mixAxis, yieldTierData, yieldMixLocked, addYieldEvent, editingYieldId, updateYieldEvent, setNewYieldEvent]);') },

  // ---------------------------------------------------------------------
  // 143 — Apply rewrites a share the user is holding.
  //
  // Apply is the one operation that rewrites the mix wholesale, so it is
  // where a padlock is most likely to be lost. The solver holds locked
  // members at their shares; passing an EMPTY lock set still produces a
  // perfectly reachable answer that hits the target - it just hits it by
  // moving a tier the user said not to move.
  //
  // THE DRIFT IS TINY, which is the point: the held share goes from
  // 33.333333333333336 to 33.33025985671146. A check written to a tolerance
  // would pass this; the spec compares to the penny, exactly.
  { id: '143 Apply moves a tier the user is holding',
    why: 'a target may not be reached by spending a share its owner locked',
    file: WHATIF, spec: VALUEPAD,
    mutate: s => s.replace(
      '      : solveForTarget(yieldMembers, draftMix, yieldMixLocked, effectiveTierArpuMap, yieldTargetParsed),',
      '      : solveForTarget(yieldMembers, draftMix, [], effectiveTierArpuMap, yieldTargetParsed),') },
];

/**
 * ANCHOR DUMP — the registry, made inspectable for `spec:trap-anchors`.
 *
 * A mutation trap is coupled to the source text of the line it guards, so its
 * anchor rots whenever that line is edited. THREE aged out in three days (13,
 * 115, 123), each caught only as an INCONCLUSIVE at gate time — which is late,
 * and only distinguishable from a pass because INCONCLUSIVE is its own state.
 *
 * The anchors live inside `mutate` closures rather than as fields, so they are
 * recovered by instrumenting `String.prototype.replace` and `indexOf` while
 * each `mutate` runs against its own pristine file.
 *
 * ONLY AN UNPOSITIONED SEARCH IS AN ANCHOR. `indexOf(x, start)` is a TERMINATOR
 * located relative to something already found — trap 18 looks for
 * `.forecast : null);` after its start, and that occurs 175 times in App.tsx
 * quite legitimately. Demanding global uniqueness of a relative terminator
 * would be the check being wrong, not the trap.
 *
 * OPT-IN, and deliberately so: the normal path below is untouched, so this
 * cannot silently stop the gate from running.
 */
if (process.env.TRAP_ANCHORS === '1') {
  const out: { id: string; file: string; anchors: string[]; global?: number }[] = [];
  const realReplace = String.prototype.replace;
  const realIndexOf = String.prototype.indexOf;
  const realSplit = String.prototype.split;
  for (const t of TRAPS) {
    const file = t.file ?? FILE;
    const captured: string[] = [];
    (String.prototype as any).replace = function (this: string, a: any, b: any) {
      if (typeof a === 'string') captured.push(a);
      return (realReplace as any).call(this, a, b);
    };
    // GLOBAL-MUTATION TRAPS SPLICE WITH `split`/`join`, so the anchor lives in
    // a split() argument. Without this the class would report 'no anchor
    // recovered', which trap-anchors correctly treats as a finding - a silent
    // exemption would be worse, but a visible false one is still noise.
    (String.prototype as any).split = function (this: string, a: any, lim?: any) {
      if (typeof a === 'string' && a.length > 8) captured.push(a);
      return (realSplit as any).call(this, a, lim);
    };
    (String.prototype as any).indexOf = function (this: string, a: any, from?: any) {
      if (typeof a === 'string' && a.length > 8 && from === undefined) captured.push(a);
      return (realIndexOf as any).call(this, a, from);
    };
    try { t.mutate(toLF(originals.get(file) ?? '')); } catch { /* no anchors -> a finding */ }
    (String.prototype as any).replace = realReplace;
    (String.prototype as any).indexOf = realIndexOf;
    (String.prototype as any).split = realSplit;
    out.push({ id: t.id, file, anchors: captured, global: t.global });
  }
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

/**
 * THE VERDICT ON A SPEC RUN — three states, not two (Jon, 2026-09-04,
 * decision 1; see EXPECTED.md "GATE HYGIENE - THREE DECISIONS").
 *
 * This used to return a boolean read off the exit code, which made a CRASH and
 * a FAILED ASSERTION the same event. They are not:
 *
 *   'failed'   the spec ran and at least one check reported FAIL. The mutation
 *              was noticed BY NAME. This is the only thing that may count as
 *              CAUGHT.
 *   'crashed'  the spec exited non-zero with NO FAIL line - it died rather than
 *              asserting. The mutation landed and nothing judged it.
 *   'green'    the spec passed.
 *
 * Trap 102 printed [CAUGHT] in every gate run for as long as it existed, while
 * spec:mix-card was dereferencing a row the mutation had removed. A gate cannot
 * certify what it cannot distinguish.
 */
type SpecVerdict = 'green' | 'failed' | 'crashed';

// A line that STARTS with FAIL, in either stream. No ``: specs print
// 'FAIL', 'FAILED' and 'FAILURE', and every one of them is an assertion
// reporting - the word boundary would reject two thirds of that for nothing.
const FAIL_LINE = /^\s*FAIL/m;

const specVerdict = (spec: string = SPEC): SpecVerdict => {
  // scan-i18n only enforces under --check; without it the scanner prints its
  // inventory and exits 0, which is precisely how seventeen must-key strings
  // sat tolerated. Passing the flag here is what makes trap 123 mean anything.
  const args = spec === I18NSCAN ? ['tsx', spec, '--check'] : ['tsx', spec];
  const r = spawnSync('npx', args, { encoding: 'utf8', shell: process.platform === 'win32' });
  if (r.status === 0) return 'green';
  // BOTH STREAMS. Specs print their FAIL lines to stdout; a spec that dies
  // prints a stack to stderr. Reading only one would misclassify whichever
  // stream a future spec chooses.
  const out = `${r.stdout ?? ''}${nl}${r.stderr ?? ''}`;
  return FAIL_LINE.test(out) ? 'failed' : 'crashed';
};

/** Red in ANY way. The positive control cares only that a spec is not green. */
const specFails = (spec: string = SPEC): boolean => specVerdict(spec) !== 'green';

const results: { id: string; state: string; detail: string }[] = [];

try {
  // ── THE CLASSIFIER IS ITSELF CONTROLLED ─────────────────────────────────
  // A CRASHED/CAUGHT distinction that silently degraded to "everything is
  // CAUGHT" would restore the exact defect it was built to end, and would do
  // so invisibly - every trap would still report CAUGHT and the gate would
  // still be green. So the two classifications are exercised against specs
  // written to produce them, on every run, before any trap is planted.
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-control-'));
    // Written OUTSIDE the repo: a control fixture in scripts/ would be
    // untracked clutter, and would be picked up by the suite runner.
    const crasher = path.join(dir, 'crasher.ts');
    const failer = path.join(dir, 'failer.ts');
    fs.writeFileSync(crasher, 'throw new Error("deliberate");' + nl);
    fs.writeFileSync(failer,
      'console.log("  FAIL  deliberate");' + nl + 'process.exit(1);' + nl);
    const vc = specVerdict(crasher), vf = specVerdict(failer);
    fs.rmSync(dir, { recursive: true, force: true });
    if (vc !== 'crashed' || vf !== 'failed') {
      console.log(nl + 'GUARD TRAPS' + nl + '='.repeat(72));
      console.log('[INCONCLUSIVE] control. The CRASHED/CAUGHT classifier is broken:');
      console.log(`               a throwing spec read '${vc}' (want 'crashed'),`);
      console.log(`               a FAIL-printing spec read '${vf}' (want 'failed').`);
      console.log('               Every trap would be misreported. Fix this first.');
      process.exit(1);
    }
  }

  // POSITIVE CONTROL. If the spec is already red, every trap below "catches"
  // vacuously and this harness reports a perfect score while proving nothing.
  if (specFails() || specFails(NULLSPEC) || specFails(UNSCORED) || specFails(LEAFGRAIN) || specFails(RETIRE) || specFails(IMPORTSEAM) || specFails(GENMISSING) || specFails(CHARTSCOPE) || specFails(COVCOPY) || specFails(WALKFIX) || specFails(PANEL) || specFails(STEP3) || specFails(BULKDONE) || specFails(NAVSPEC) || specFails(STEP1SEL) || specFails(STEP2UNLOCK) || specFails(BASESEED) || specFails(RESTOREBASE) || specFails(EVTROUND) || specFails(MIXSPEC) || specFails(MIXCARD) || specFails(OVERRIDESPEC) || specFails(YIELDROUND) || specFails(PRICEROUND) || specFails(SUMMARYSPEC) || specFails(ACTIVECOHORT) || specFails(SCENPRICE) || specFails(CMPFILTER) || specFails(CMPPANEL) || specFails(CMPWINDOW) || specFails(CMPRENDER) || specFails(CHURNFOLD) || specFails(AMTCTRL) || specFails(SCENARPU) || specFails(I18NPARITY) || specFails(FTSPLIT) || specFails(ARPUCOMP) || specFails(APPLIEDCOUNT) || specFails(AGGRECON) || specFails(VIEWAPPLY) || specFails(LOCKRT) || specFails(TRAPANCHORS) || specFails(VALUEPAD)) {
    console.log('\nGUARD TRAPS\n' + '='.repeat(72));
    console.log('[INCONCLUSIVE] control. The spec is RED on the unmutated tree.');
    console.log('               Every trap would catch vacuously. Fix the spec first.');
    process.exit(1);
  }

  for (const t of TRAPS) {
    const target = t.file ?? FILE;
    // A TRAP ON AN UNREGISTERED FILE IS A SETUP ERROR, AND MUST SAY SO.
    // TARGETS is what gets snapshotted and, at the end, RESTORED — so a trap
    // whose file is missing from it would also have no restore path. Before
    // this guard the symptom was `Cannot read properties of undefined
    // (reading 'replace')` from toLF, twenty lines away from the cause.
    if (!originals.has(target)) {
      console.error(`trap ${t.id}: ${target} is not in TARGETS, so it is neither`
        + ' snapshotted nor restored. Add it to TARGETS.');
      process.exit(1);
    }
    const pristine = originals.get(target)!;
    // Matched in LF so an anchor cannot miss on line endings alone; the pristine
    // snapshot is what gets restored, so the file's real endings are untouched.
    const base = toLF(pristine);
    const mutated = t.mutate(base);
    if (mutated === base) {
      // The anchor moved. Silently planting nothing would report a clean catch
      // for a trap that never ran.
      results.push({ id: t.id, state: 'INCONCLUSIVE', detail: 'anchor did not match — nothing was planted' });
      continue;
    }
    fs.writeFileSync(target, mutated);
    // THREE OUTCOMES, NOT TWO. A spec that dies is not a spec that caught
    // something: the mutation landed and nothing named it.
    const v = specVerdict(t.spec);
    results.push(
      v === 'failed'
        ? { id: t.id, state: 'CAUGHT', detail: t.why }
        : v === 'crashed'
          ? { id: t.id, state: 'CRASHED',
              detail: `${t.spec} exited non-zero with NO FAIL line — the mutation landed and nothing asserted it` }
          : { id: t.id, state: 'MISSED', detail: 'planted and the spec stayed GREEN — ' + t.why });
    fs.writeFileSync(target, pristine);   // one trap at a time, never compounded
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
if (bad.length) {
  console.log('A MISSED, INCONCLUSIVE or CRASHED trap means the guard does not protect what it claims to.');
  // Each state names a DIFFERENT repair, so the summary says which.
  const crashed = results.filter(r => r.state === 'CRASHED');
  if (crashed.length) {
    console.log(`${crashed.length} CRASHED — the mutation landed and the spec DIED instead of asserting.`);
    console.log('  The repair is an assertion in the spec, not a new anchor in the registry:');
    for (const c of crashed) console.log(`    ${c.id}`);
  }
}
process.exit(bad.length ? 1 : 0);
