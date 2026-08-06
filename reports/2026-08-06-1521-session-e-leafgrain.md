# FOR ADVISOR

**Generated:** 2026-08-06 15:21
**Certifies:** `2531585` — Session E merged to main, `--no-ff`, verified ON main after merge

**Findings**
- All four tasks done. Stage 1 PASS, stage 2 PASS, stage 3 SAFE, merged clean.
- `buildCohortAccuracy` exported — pure move. Being module-private is what cost two sessions.
- The `~:767` early return is NOT a blocker: 72 of 74 leaf-grain rows score; the 2 that don't are the unfitted leaves.
- The key-shape theory is dead: a plain 7-part store scores identically, so the 5-part arrangement was unnecessary.
- Every leaf-grain score lands below 85, so the challenger threshold would not have filtered them either.
- The real blocker was `spec:challenger`'s own 12-fit cap — a test property, declared for two sessions as a product one.
- Stage 2's fitted-row route REPRODUCES. Recorded, not retracted; stage 2 was right and my harness was wrong.
- `spec:challenger`'s declared gap is closed with the assertions it stood in for (12 → 18 cases).
- Two harness errors caught mid-investigation, both producing NaN scores that looked exactly like product defects.
- OPEN, pre-existing: `scoreVals` filters `v !== null`, so a NaN would render as a score. Inspected, not proven.

**Decisions needed from Jon / advisor**
- The NaN gap: worth a guard (`Number.isFinite`) and a trap, or leave recorded as inspected-and-plausible?
- `chartData`'s ~460 dead lines remain queued, opening with the divergence check. Schedule, or leave?

**Merge state:** MERGED and pushed at `2531585`. Session E closed.

---

## What was done

**1. `buildCohortAccuracy` exported** — pure move, no logic change; stage 1 confirmed the diff is the keyword and a docstring.

**2+3. The investigation, which overturned its own premise twice.**
`npm run spec:leafgrain` drives the function directly. At full grain on the edge
fixture: **72 of 74 rows score.** The 2 that don't are the deliberately unfitted
leaves, which take the `~:767` early return correctly and are flagged
`noForecast`. The early return was doing its job throughout.

Then the fallback theory died too. A plain 7-part store scores **identically** to
one with 5-part keys added — 72/74 both ways, because derivation already resolves
the grouped key. The "5-part store arrangement" the docket asked for turned out
unnecessary rather than load-bearing, and the control that proved it is kept in
the spec.

And the third candidate: every scored row lands **below 85** (min 47.8, max 83.6),
so the challenger threshold would not have filtered them either.

**So none of the three things blamed explains anything.** The blocker was
`spec:challenger`'s own **12-fit cap** — twelve fits against actuals covering 74
cohorts. A property of the test, declared for two sessions as a property of the
product and restated in three reports.

**4. Stage 2's route reproduces**, so it is **recorded, not retracted.** With the
cap removed, toggling Product L1 produces a fitted row showing a model name
rather than a leaf mix; selecting it shows the error-ranked legend and the chart
with no derived banner. Stage 2 was right; my inability to reproduce it was my
harness. `spec:challenger` grew 12 → 18 cases, and stage 2 confirmed the restored
block is not decorative by forcing `derivedMix` truthy and watching it go red.

## Two harness errors, both looking like product defects

- `fitLeaf` left `arpu` at 0 for every month, so fitted ARPU bands were zero and
  all four ARPU components scored **NaN**, poisoning `overallScore` on 72 of 74
  rows.
- Fixing that wasn't enough: `calculateBaseForecast` fits the four **per-scenario**
  ARPU series independently, and those were undefined too.

`JSON.stringify` prints `NaN` as `null`, which nearly hid it a third time — the
diagnostic output read as a tidy list of nulls.

## The gate

Stage 1 PASS. Stage 2 PASS — re-derived every claim independently and planted the
`derivedMix` mutation. Stage 3 SAFE — measured 1,860 of 1,860 `All`-bearing keys
resolving (657 multi-leaf derived, 1,203 single-leaf passthrough, 0 null), and
**caught its own substring-match bug** mid-check (`.includes('All')`
false-positiving) and corrected it before reporting. It also could not reproduce
stage 2's exact mutation mechanism and said so, confirming the outcome by an
A/B of the spec file against main instead.

Verified on main after the merge: typecheck 0, build clean, thirteen suites 440,
nullrender 35, challenger 18, unscored 19, traps 3/3, guard-traps 10/10, i18n
clean, `.env` untracked.

## One open item, pre-existing

`scoreVals` filters on `v !== null`, so a `NaN` would pass through and render as
a score. Every division in the scoring path guards its denominator on inspection,
and no `NaN` appeared in any suite run — but that is **inspected-and-plausible,
not proven by execution**, which is how both gates classified it. Untouched by
this branch. A one-line `Number.isFinite` filter plus a trap would close it.

## Carried forward

- The NaN gap, if you want it closed.
- `chartData`'s ~460 dead lines, opening with the divergence check against
  `multiChartData` — which copy drifted from which may matter to the live one.
