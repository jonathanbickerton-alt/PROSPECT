# FOR ADVISOR

**Generated:** 2026-08-06 18:30
**Certifies:** `67eca3b` — Session F merged to main, `--no-ff`, verified ON main after merge

**Findings**
- Both pieces done, gated, merged. Stage 1 PASS, stage 2 PASS, stage 3 SAFE.
- The NaN gap needed closing at TWO levels, not one — stage 2 found the second while checking the first.
- `scoreVals` guards the mean; `scoreLabel`/`scoreBg` guard the cell, where `NaN.toFixed(0)` is the string "NaN".
- Traps 11 and 12 cover the two levels; both are deliberately two mutations, because no natural input makes a NaN.
- `chartData` deleted, ~395 lines, after the divergence check ran FIRST.
- The live copy is the stricter one: `!selectedCohortRow` vs the dead copy's `!cohortMonthMap` — a real difference, safe direction.
- The NaN entry is closed: now proven by execution, not inspection. Stage 3 measured 1,080 fields, 0 non-finite.
- REPORTED NOT DELETED: `broadAggrSnapshotMap`'s value is read by nothing since Session C removed `aggrMap`.
- Stage 3 declined to certify stage 2's 11,286-field figure it could not reproduce, and measured its own instead.

**Decisions needed from Jon / advisor**
- `broadAggrSnapshotMap`: delete in a follow-up, or leave? It means editing three memo dependency arrays.
- Nothing else. Phase 3 awaits your design-pass kickoff.

**Merge state:** MERGED and pushed at `67eca3b`. Session F closed; the close-out branch is done.

---

## The NaN gap, closed at two levels

`scoreVals` now requires `Number.isFinite` alongside the null check. `NaN !==
null`, so one NaN component survived the old filter and poisoned the mean — and
a NaN `overallScore` renders as a *score*, because every downstream test is
`!== null`.

**Stage 2 found the second half while checking the first.** The eight component
scores reach `scoreLabel`/`scoreBg` unfiltered, and `NaN.toFixed(0)` is the
string `"NaN"`, handed to a coloured badge as though it were a measurement. Both
helpers now treat non-finite as absent, routing that cell down the same em-dash
path as any other missing score — no new state, no new UI.

Guarding the average and leaving the cells would have been a half-closed hole,
which is worse than an open one because it reads as closed.

**Traps 11 and 12** cover the two levels. Both are deliberately two mutations,
and the pairing is the point: no natural input produces a NaN, so weakening a
guard alone would change nothing and the trap would report a false green. The
injection is the scenario; the weakened guard is the defect. 12/12.

The entry recording this as *inspected-and-plausible, not proven by execution*
is closed — it is now proven by execution.

## `chartData` deleted, divergence checked first

~395 lines nothing read. The check ran before the deletion because a dead copy
can still tell you something about the live one: 266 logic lines against
`multiChartData`'s 355, 174 with exact twins, and every non-cosmetic difference
running the same way — **the live copy's guard is stricter**. It requires
`baseForecast` and keys off `selectedCohortRow`, where the dead copy keyed off
that row's `monthMap` and would have drawn an aggregate for a selected row whose
`monthMap` was empty. Stage 2 confirmed that is a real behavioural difference in
the safe direction, so the live copy needs nothing from the dead one.

## The diagnostic rule

Never print test output through a bare `JSON.stringify` where a NaN can occur.
`JSON.stringify(NaN)` is `"null"`, so a row of NaN scores prints as a tidy list
of nulls and reads as "absent, handled". It laundered a NaN twice in one
session, and the direction is what makes it dangerous: **it makes a corrupt
value look like a clean absence** — the way round that stops you looking
further. Recorded in `qa-tester.md`.

## Two things the gates did well, worth naming

**Stage 2 refused to report the expected result.** Asked to confirm the spec
stays green with only the NaN injection, it reported that it does *not* — one
component-level assertion still failed — rather than writing down what the
prompt implied. That refusal is what surfaced the render-boundary gap.

**Stage 3 declined to certify a number it could not reproduce.** It could not
reach stage 2's 11,286-field population (the trimmed and full fixtures produce
no scored rows in its harness — their forecast horizon has no overlapping
actuals), said so plainly, and measured its own 1,080 fields with 0 non-finite
instead. Corroborating the conclusion while declining the figure is exactly the
distinction the claim-is-not-evidence rule asks for.

## Reported, not deleted

`broadAggrSnapshotMap` appears only in its declaration and three dependency
arrays; its value has been read by nothing since Session C removed `aggrMap`
from `buildCohortAccuracy`. Stage 2 verified it by reading all three consuming
memo bodies. `aggrSnapshotMap` is different — still read, one hop removed, as
`broadAggrSnapshotMap`'s fallback return.

Not deleted here because removing it means editing memo dependency arrays, which
can alter invalidation behaviour, and that is not a change to make at the end of
a long branch. Your call whether it is worth a follow-up.

## Where the programme stands

The share-scaled fabrication family is closed and its defence is in place. The
NaN class is closed at both levels. The dead memo is gone. Sessions C through F
have removed every reachable path that produced a number where the honest answer
was nothing, and each removal is held by a planted violation rather than by a
comment.

Phase 3 is next and takes a fresh design-pass kickoff from you — the last
behavioural phase, ending with Jon's eyes.
