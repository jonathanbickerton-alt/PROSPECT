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

/** Every file any trap mutates, snapshotted before anything is planted. */
const TARGETS = [FILE, ENGINE, WHATIF];
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
];

const specFails = (spec: string = SPEC): boolean =>
  spawnSync('npx', ['tsx', spec], { encoding: 'utf8', shell: process.platform === 'win32' }).status !== 0;

const results: { id: string; state: string; detail: string }[] = [];

try {
  // POSITIVE CONTROL. If the spec is already red, every trap below "catches"
  // vacuously and this harness reports a perfect score while proving nothing.
  if (specFails() || specFails(NULLSPEC) || specFails(UNSCORED) || specFails(LEAFGRAIN)) {
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
