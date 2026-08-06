# FOR ADVISOR

**Generated:** 2026-08-06 10:26
**Certifies:** `a5d69ec` on `session-c-deletions` — stage 1 PASS, stage 2 FAIL→fixed, stage 3 SAFE

**Findings**
- Trigger set measured before deleting: 0 of 74 trimmed, 0 of 540 full walk config, 2 of 74 edge.
- The edge fixture's 2 are its deliberate short-history leaves; all three counts now pinned in spec.
- `computeAvgShare` had TWO consumers — deleting it forced deleting `derivedBaseBands` (Base KPI) too.
- Instance-2 now declines; the trailing `?? 0` was not neutral either — zero base is a fabricated forecast.
- Stage 2 caught my check 4 as VACUOUS: anchored 77,000 chars off, tested a 1,500-char window.
- Stage 3 found a THIRD share-scaled fallback surviving in `chartData` — pre-existing, untouched.
- **SCREEN CHANGE:** on the edge fixture 2 rows now read unscored in the table while the chart still fabricates.
- Tasks 2 and 3 NOT DONE. `buildCohortAccuracy` is module-private, so the leaf-grain route needs it exported.
- A prior stage-3 report claimed that function was exported and importable. It was wrong; corrected in the record.

**Decisions needed from Jon / advisor**
- Does the table/chart disagreement need Jon's eyes before merge, or is 2 edge-fixture rows acceptable?
- `chartData`'s three fallback closures: schedule the same measure-then-delete pass, or defer?
- Tasks 2/3 carried — export `buildCohortAccuracy` for testability, or drive the tab instead?

**Merge state:** HELD, unmerged on `session-c-deletions`. No walk requested; see screen-change above.

---

## What was done

Four deletions, all one family — a number produced where the honest answer was
nothing. The trigger set was measured first, as instructed, and pinned:

| configuration | cohorts with actuals but no resolvable forecast |
|---|---|
| trimmed fixture, same file | **0** of 74 |
| full Dec2025 forecast + Jun2026 actuals | **0** of 540 |
| edge fixture, same file | **2** of 74 |

The two are the edge fixture's deliberate short-history leaves — the pair the
amber skip panel already names on screen. All three counts are pinned in
`npm run spec:deletions` so a fixture edit that grows the set is noticed rather
than absorbed.

**`derivedBaseBands` was not on the docket and could not be left.**
`computeAvgShare` had two consumers, not one; `derivedBaseBands` is the same
mechanism applied to the Base KPI. Deleting `computeAvgShare` forces it, which
extends the change to Base on the same trigger set.

**Instance-2** now declines rather than borrowing the loaded cohort's seed. Worth
noting the third term as well as the second: the trailing `?? 0` was not a
neutral default — it seeds a real cohort at zero standing base and calls the
result a forecast.

**The dead guard** is gone. A dead guard is worse than none: it asserts a derived
row can reach the Accept-All modal when the list's own filter guarantees it
cannot, which is two authorities for one rule.

## The gate caught a vacuous check of mine

Stage 2 replanted the dead guard and `spec:deletions` stayed green. My check
anchored with `indexOf('acceptAllCandidates.map')`, which matches an unrelated
`.map` about 77,000 characters earlier, and then tested only the first 1,500
characters after it. It never looked at the modal at all.

**A slice offset is not a location, and a fixed window is a guess about
distance.** Now anchored with `lastIndexOf`, no truncation, plus an assertion
that the slice really is the modal block. Verified the way the original should
have been: plant the defect, watch it go red, restore.

The same shape appeared twice in one gate — stage 2 also flagged that I had
confirmed the 540-orphan figure by hand and left it unguarded. Now pinned. **A
number confirmed once and left where nothing re-checks it is the same defect as
a check that looks in the wrong place.**

## The screen change you asked about

You asked to be told if the deletions change a screen Jon would see. **They do,
and not only in the way I expected.**

Expected: on the edge fixture, 2 rows stop showing a fabricated score and show a
blank. 0 rows change on the trimmed and full fixtures.

Unexpected, found by stage 3: `chartData` carries its OWN share-scaling fallback
(`cohortShareMap` / `baseShareForChart` / `arpuScaleRatio`), untouched by this
branch, and the row-click handler has no `noForecast` guard. So selecting one of
those 2 rows now shows **unscored in the accuracy table** and **a fabricated
share-scaled line in the chart** for the same selection.

Before this branch both panels fabricated — wrong, but consistent. Now they
disagree in kind, and the honest half is the one that looks broken. It is 2 rows
on one fixture, so it is narrow; it is also the first place the app shows a blank
and a number for the same cohort at the same moment. Your call whether that wants
eyes before merge.

The fix is the same treatment applied to `chartData`'s three fallback closures —
dependency-mapper pass, measure, delete. That is a second deletion of equal size
and was not on the docket, so I have not started it.

## Tasks 2 and 3 — not done

Task 2 (the scored-leaf-grain DOM spec via a 5-part store arrangement) and task 3
(the one-shot re-test of stage 2's irreproducible fitted-row route, which depends
on it) were not completed. I stopped rather than rush them after the deletions and
the gate consumed the session.

What was established first, so the next attempt starts ahead:

- **`buildCohortAccuracy` is module-private** — `ForecastVsActualsTab.tsx:584`,
  plain `function`, no `export`. It cannot be driven headlessly. The clean route
  is to export it, or to drive the tab and toggle groupings.
- **A previous stage-3 report claimed it was "module-level and imported directly
  by the spec".** That was wrong. Recording it because the claim was plausible,
  went unchallenged, and shaped two sessions' assumptions about what was testable.
- The blocker is the unscored early return at `~:767–779`, reached when a cohort
  has no resolvable forecast at that grouping. Adding product-grain fits made the
  KEY resolve and still produced no scored row — so the gap is in the accuracy
  rows, not the store.

## Verification at `a5d69ec`

typecheck 0 · build clean · eleven suites 411 (derive 75, interaction 46,
provenance 29, skip 20, edge 15, scope 61, mix 17, prorata 21, pct 72, cards 36,
deletions 19) · nullrender 35 · challenger 12 · traps 3/3 · guard-traps 8/8 ·
i18n clean · scoped no-AI clean · `.env` untracked.

Stage 3 measured aggregate resolution independently: trimmed 1,860 `All`-bearing
keys (657 multi-leaf derived, 1,203 single-leaf passthrough, 0 null); full
Dec2025 7,424 keys (3,632 / 3,792 / 0).

## Carried forward

- `chartData`'s three fallback closures — measure, then delete.
- Tasks 2 and 3, with the module-private blocker now known.
- The accuracy-denominator entry stays OPEN: resolved for the table path this
  branch touched, not for the chart path it did not. Marking it closed would be
  the shrunk-blast-radius-reported-as-fixed error.
