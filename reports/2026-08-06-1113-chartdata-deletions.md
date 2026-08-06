# FOR ADVISOR

**Generated:** 2026-08-06 11:13
**Certifies:** none — code complete at `95f45ba`, NOT gated. Do not merge on this report.

**Findings**
- Measured both trigger sets: 4 tier-1 misses total, tier-2 candidate scan fired on ZERO of them.
- So the scan borrowed nothing reachable → deleted in this branch, per your rule 5.
- Both panels now resolve in ONE tier; they can no longer disagree about whether a cohort has a forecast.
- Record corrected at the lead: pinned 0/0/2 is the CHART's set. Session C's scope stands, description was wrong.
- Fused branch split: Case A deleted, Case B retained with its +99.9% comment.
- Second entry point collapsed — no weaker-guarded twin left to drift.
- `aggrMap` off `buildCohortAccuracy` with both positional call sites.
- Transient-state entry STRUCK per its own instruction.
- An over-wide cut swept up `cohortBaseActualMap`; typecheck caught it, restored with a note.
- I wrote an anti-vacuity check with a hardcoded `true` and caught it before commit. Now it can fail.

**Decisions needed from Jon / advisor**
- The family-closed declaration is NOT yet made — it should follow the gate, not this report. Confirm.
- Surface spec (disagreement as killed mutation) and the full gate are outstanding — next session.

**Merge state:** UNMERGED, ungated on `session-d-chartdata` at `95f45ba`. Tasks 2/3 not started.

---

## What the measurement decided

`npm run spec:triggers` (14 cases, new) measures both panels' trigger sets across
three fixtures × four groupings, and prints them side by side:

| fixture | grouping | chart trigger (tier-1 miss) | tier-2 hits | table trigger |
|---|---|---|---|---|
| trimmed | all four | 0 | 0 | 0 |
| edge | segment only | 0 | 0 | 0 |
| edge | product | 1 | **0** | 1 |
| edge | product+channel | 1 | **0** | 1 |
| edge | full grain | 2 | **0** | 2 |
| full Dec2025 | all four | 0 | 0 | 0 |

4 tier-1 misses in total, all on the edge fixture's deliberate short-history
leaves. **The candidate scan fired on zero of them** — it borrowed nothing that
was reachable — so per your rule 5 it goes in this branch rather than being
reported and stopped on.

The anti-vacuity check matters here: "the scan never fires" is only meaningful if
something reached it, so the spec asserts the tier-1 miss population is non-empty.
I wrote that check as a hardcoded `true` first and caught it before commit — a
check that cannot fail is not a check, which is the whole subject of this branch.

## The correction, made first

The pinned 0/0/2 is `resolveForecast` returning null — **tier one only**, which is
the chart's predicate. The table resolved in two tiers, so its trigger set was a
subset. Corrected at the lead of the Session C entry and in `spec:deletions`' own
description.

**Session C's shipped scope stands**: the sets coincide in fact, because nothing
can match a leaf that failed to fit. The description was wrong, not the number.
Worth keeping the distinction even though it changed nothing — two predicates that
agree on the current fixtures are not one predicate, and a figure labelled with
the wrong one invites exactly the assumption that nearly carried it into this
deletion.

## What was deleted, and what was deliberately kept

- **The three closures** — `cohortShareMap`, `baseShareForChart`, `arpuScaleRatio`.
- **Case A** — a selected cohort with no forecast, drawn as the loaded aggregate
  scaled by that cohort's historical share.
- **Case B RETAINED**, with its comment. No selection, aggregate unscaled; its
  guard is a deliberate earlier fix and deleting the branch wholesale would have
  reopened +99.9% nonsense variances. The dependency-mapper catching this fusion
  is what stopped a clean-looking deletion from being a regression.
- **The second entry point collapsed.** The model-switch overlay scaled by the
  same shares under a weaker guard. With the shares gone there is nothing to scale
  by and one branch draws a forecast, so no twin is left to drift out of step.
- **The candidate scan** — different mechanism, same family by definition.
- **`aggrMap`** off `buildCohortAccuracy`, both positional call sites in the same
  change. A dead parameter on a positional signature is a live hazard.

An over-wide cut swept up `cohortBaseActualMap`, which is unrelated to
share-scaling. Typecheck caught it; restored with a note saying why it was there.

## Not done — and why I am not doing it now

- **The surface spec**: selecting an unscored row shows the gap in BOTH panels,
  actuals still drawn, with the disagreement case as the killed mutation. This is
  a jsdom mount plus a mutation harness; it is the proof that the change works,
  and it deserves better than the end of a long session.
- **The full three-stage gate.**
- **`noForecast` as a first-class state through the handler.** The no-fabrication
  half is done — a selected unscored row now draws no forecast series and keeps
  its actuals. Whether the handler itself needs anything further is a question the
  surface spec should answer rather than a change made speculatively.
- **Tasks 2 and 3.**

## The family-closed declaration — withheld deliberately

Everything matching the family's definition is now gone from the code: three
fallbacks in the table, three in the chart, one borrowed seed, and the candidate
scan. On the measurement, the scan borrowed nothing, so the declaration scopes
itself honestly rather than needing a caveat.

**But it is not made in the record yet**, because the change is ungated. Declaring
a family closed on an ungated tree would be the same shape as certifying a commit
and merging a later one. It belongs in the record when the gate passes — in those
words, as you asked: *three fallbacks in the table, three in the chart, one
borrowed seed, and the scan — all gone.*

## Carried forward

- The surface spec, the full gate, then the family-closed declaration.
- Tasks 2 and 3: export `buildCohortAccuracy` (still module-private, still the
  blocker for a scored-leaf-grain spec), the DOM spec on the 5-part arrangement,
  the `~:767` unscored early return, and the one-shot re-test of stage 2's
  fitted-row route.
