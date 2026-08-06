# FOR ADVISOR

**Generated:** 2026-08-06 10:52
**Certifies:** `6726d4c` — Session C merged to main, `--no-ff`, verified ON main after merge

**Findings**
- Merged without a walk, as decided; the screen change is measured, pinned, and 2 rows on one fixture.
- Certified `a5d69ec`; merged tip `7bb47c8` added records only, no code. Stated, not glossed.
- Full check set green on main: 411 suite cases, nullrender 35, challenger 12, traps 3/3, guard-traps 8/8.
- The transient state is now named in EXPECTED.md: table honest, chart still fabricating, same 2 rows.
- That entry says to strike it when the chart branch lands — it is an intermediate state, not a verdict.
- The accuracy-denominator entry stays OPEN for the chart path, exactly as stage 3 judged it.
- `.env` untracked; scoped no-AI clean.

**Decisions needed from Jon / advisor**
- None for this boundary. Boundary 2 (the chartData pass) is authorised and not started.

**Merge state:** MERGED and pushed. Boundary 1 complete. Boundary 2 not started — budget, see below.

---

## The merge

`--no-ff` merge of `session-c-deletions` into `main` at **`6726d4c`**, from branch
tip `7bb47c8`. No conflicts.

Certified commit was `a5d69ec`; the tip carried one further commit of records and
the session report, no code. Recorded explicitly for the same reason as the
Session B merge: "certified X, merged Y" is the shape of the
verification-before-the-last-edit mistake even when the delta is documentation,
and the post-merge verification is what actually covers it.

### Verified on main, after the merge

typecheck 0 · build clean · eleven suites 411 (derive 75, interaction 46,
provenance 29, skip 20, edge 15, scope 61, mix 17, prorata 21, pct 72, cards 36,
deletions 19) · nullrender 35 · challenger 12 · traps 3/3 · guard-traps 8/8 ·
i18n clean · `.env` untracked, only `.env.example` in `git ls-files`.

## The transient state, named

Recorded in EXPECTED.md under its own heading rather than left as a footnote:

**The accuracy table is honest and the chart still fabricates, for the same 2
edge-fixture rows.** Selecting one shows UNSCORED in the table and a share-scaled
line in the chart, at the same moment, for the same cohort.

Merged knowingly. The entry says plainly that this is a known intermediate state
between two deletions — not a regression, not a disagreement about what is true —
and that it should be struck when the chart branch lands. The point of naming it
is that whoever meets it next finds it described rather than discovers it and has
to work out which half to believe.

The accuracy-denominator entry stays OPEN for the chart path, exactly as stage 3
judged it: resolved for the table path Session C touched, not for the chart path
it did not.

## Boundary 2 — authorised, not started

The `chartData` pass is a full branch of its own: dependency-mapper over the three
fallback closures (`cohortShareMap`, `baseShareForChart`, `arpuScaleRatio`),
trigger set measured and pinned on all three fixtures, deletion, the `noForecast`
guard the row-click handler lacks, and a three-stage gate. Tasks 2 and 3 ride with
or follow it.

I have not started it. This session has already carried the four deletions, a full
three-stage gate, a stage-2 failure and its fix, and this merge; starting a second
deletion of comparable size on what is left would produce exactly the rushed work
the last report declined to produce for tasks 2 and 3.

Everything it needs is recorded: the three closure names, the fire condition
(`specificFcMonthMap` null and a row selected), the missing `noForecast` guard on
the row click, the stale comment at `chartData` claiming the two panels cannot
disagree, and the dead `aggrMap` parameter left on `buildCohortAccuracy`.

**When that branch lands it ends the share-scaled fabrication family**, and the
record should say so in those words — three fallbacks in the table, three in the
chart, one borrowed seed, all gone.

## Carried forward

- Boundary 2: the `chartData` pass, as its own branch.
- Tasks 2 and 3, split at discretion: export `buildCohortAccuracy` (pure move, the
  same seam move as `buildRollUpIndex`), the scored-leaf-grain DOM spec on a
  5-part arrangement, the unscored early return at `~:767` that yields no row even
  when the key resolves, and the one-shot re-test of stage 2's fitted-row route —
  retracted by name as an agent-report error if it stays irreproducible, alongside
  the already-corrected false claim that `buildCohortAccuracy` was exported.
