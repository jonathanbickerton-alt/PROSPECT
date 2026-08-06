# FOR ADVISOR

**Generated:** 2026-08-06 11:01
**Certifies:** none — mapping only, no source changed, nothing to gate

**Findings**
- STOPPED BEFORE DELETING: the two panels' trigger sets diverge, which you asked to hear about first.
- Table resolves in TWO tiers — `resolveForecast`, then a candidate scan over `forecastStore`.
- Chart resolves in ONE — `resolveForecast` only. So the table's trigger set is a SUBSET of the chart's.
- My 0/0/2 figure measured the resolveForecast-null set — that is the CHART's set, not the table's.
- So 0/0/2 cannot be assumed to carry over, and the deletion's blast radius is not yet known.
- `multiChartData` is NOT a fourth/fifth/sixth fallback — its branch is guarded by `!selectedCohortRow`.
- The `else if (aggregateFallbackOk)` fuses Case A (delete) with Case B (RETAIN) — a prior +99.9% fix.
- A second, weaker-guarded entry point exists at :2475 (`specificFcMonthMap` only, no `aggregateFallbackOk`).
- Row click at :4005–4034 confirmed to have no `noForecast` guard.
- `aggrMap` on `buildCohortAccuracy` confirmed dead; two positional call sites, :2016 and :3028.

**Decisions needed from Jon / advisor**
- Blocking a `noForecast` row from being selected conflicts with speccing "selecting an unscored row". Which?
- For a selected unscored row, should the chart draw nothing, or the unscaled aggregate?
- Do you want the table's second-tier candidate scan measured too, or deleted as part of this family?

**Merge state:** Branch `session-d-chartdata` created off main, NO commits. Nothing to merge.

---

## Why I stopped

You asked for the trigger set measured and pinned on all three fixtures before
deleting, "expecting 0/0/2 to match the table's set; any divergence between the
two panels' trigger sets is a finding, report it before proceeding."

There is a divergence, and it is structural rather than incidental.

Both panels build the same 7-part key from the row's dimensions. Then:

- **Accuracy table**, `ForecastVsActualsTab.tsx:674-678`:
  `cohortSrcEarly = resolveForecast(key).forecast`, and **if that misses, a
  second-tier candidate scan** over `forecastStore` using a shared scope
  predicate. Its trigger is `!matchingBfs.length` — i.e. both tiers missed.
- **Chart**, `:2054`: `cohortSpecificForecast = resolveForecast(key).forecast`,
  then `specificForecast = cohortSpecificForecast ?? filterForecast`. There is
  **no candidate scan**. Its trigger is `!specificForecast`.

The table's trigger set is therefore a **subset** of the chart's. A cohort where
`resolveForecast` misses but the candidate scan finds something is scored
honestly in the table and fabricated in the chart.

**And it means my own 0/0/2 figure is the chart's set, not the table's.** I
measured "cohorts with actuals but no resolvable forecast", which is exactly
`resolveForecast` returning null — tier one. I pinned it in `spec:deletions` as
the Session C trigger set and described it as the table's. For the two edge-fixture
leaves the two sets coincide (nothing can match a leaf that failed to fit, so the
candidate scan finds nothing either), so the Session C numbers stand and the
deletion that shipped was correctly scoped. But the *general* claim that the two
panels share a trigger set is not established, and I was about to carry 0/0/2
across on that assumption.

Proceeding would have meant deleting on an unverified equivalence, so I stopped.

## The map (step 1), with three corrections to my assumptions

**`multiChartData` is not three more fallbacks.** I expected a duplicate set. It
has its own `specificFcMonthMap` but its fallback branch (`:2851-2868`) is
guarded by `!selectedCohortRow` and reads `baseForecast` unscaled — it never had
the borrow pattern for a selected cohort. Nothing to delete there. Worth knowing
before someone goes hunting.

**The `else if (aggregateFallbackOk)` at `:2452` fuses two cases**, and only one
should go:

- **Case A — delete.** A cohort row is selected and no forecast resolves for it;
  the loaded aggregate is scaled by that cohort's historical share and drawn as
  the cohort's line.
- **Case B — RETAIN.** No cohort row is selected; all three closures are `null`
  by construction (each requires `cohortMonthMap`), so `share` is `1` and the
  aggregate is drawn unscaled. This is a deliberate prior fix — the comment at
  `:2412-2418` records that removing it produced nonsense variances of +99.9%.

Deleting the branch wholesale would reopen that. They have to be split first.

**A second entry point at `:2475`** guards only on `specificFcMonthMap`, not on
`aggregateFallbackOk`. Today it cannot diverge, because the three closures
self-guard on `cohortMonthMap` and fall to `?? 1`. But it is real coupling: the
moment any of the three could return non-null without `cohortMonthMap`, that
becomes a weaker-guarded second route into scaling.

Also confirmed: the row click at `:4005-4034` has no `noForecast` guard, and
`aggrMap` is dead on `buildCohortAccuracy` with two positional call sites
(`:2016`, `:3028`) that must change in the same commit or the arguments shift
silently.

## The two questions I cannot answer for you

**1. The row-click guard conflicts with the spec you asked for.** You asked for
the handler to gain the `noForecast` guard it lacks, and for the spec to assert
that "selecting an unscored row shows the gap in BOTH panels". If the guard
blocks selection, the specced scenario is unreachable. Either the guard means
something narrower than blocking selection, or the spec's scenario changes.

**2. What should the chart draw for a selected unscored row?** Nothing —
matching the table's blank — or the unscaled aggregate, as Case B does when no
row is selected? "Both halves truthful" reads as the former, but it is a
behaviour decision and the dependency-mapper flagged it as one too.

## Carried forward

- Steps 2–5 of this docket, once the divergence question is settled: measure the
  chart's trigger set properly, split Case A from Case B, delete, guard, strike
  the transient-state entry, spec at the surface with the disagreement case as the
  killed mutation.
- Tasks 2 and 3, unchanged: export `buildCohortAccuracy`, the scored-leaf-grain
  DOM spec, the `~:767` unscored-early-return investigation, and the one-shot
  re-test of stage 2's fitted-row route.
- **Open question raised by this finding:** the table's second-tier candidate scan
  is itself a partial-match fallback. It is not share-scaling, so it is not
  strictly in this family, but it answers "no forecast for this cohort" with a
  forecast fitted to a different scope. Whether it belongs in the same clean-up is
  worth deciding while the family is open.
