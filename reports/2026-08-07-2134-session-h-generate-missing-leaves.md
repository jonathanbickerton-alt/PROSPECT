# Session H — generate the missing leaves

## FOR ADVISOR

```
Generated: 2026-08-07 21:34
Certifies: a39a6d0 (merge of session-h-generate-missing-leaves at a8af683) — MERGED
Finding: an aggregate selection now fits its missing leaves; nothing written under an All key
Finding: it SCOPES the existing generator — no second leaf-fitting path
Finding: button carries the count; covered and never-enumerated kept distinct, both disabled
Finding: mirror control closed Session G's OPEN item — both accept sites now decline
Finding: "zero All-bearing writes" was FALSE as stated — unmapped dimensions make leaves All-bearing
Finding: corrected invariant — no write All-bearing in a MAPPED dimension
Finding: trap 17 holds the DIRECTION — prevent the write, never re-stamp accepted
Finding: BLOCKER found by gate, fixed — scoped runs reported zero work done, always
Finding: skipped leaves now surfaced BY NAME on Step 1; the result is no longer discarded
Finding: 74 leaves, 72 fit, 2 skipped — confirmed independently by spec:edge, not self-reported
Finding: two spec defects caught by their own anti-vacuity controls before the gate
Open (not fixed): the retirement rule misfires on unmapped dimensions, survives by accident
Decision needed: none
State: MERGED. Session I next — modal, copy batch, chart scope fix.
```

---

## What merged

An aggregate selection on Step 1 no longer declines. It enumerates the leaves
underneath via the roll-up index, fits the ones that are missing, and lets
derivation cover the total. Nothing is written under the All-bearing key — the
aggregate is summed at read time, every time.

Session G's decline was honest but useless. The user's intent — "a forecast
covering this scope" — is satisfiable; it just is not satisfied by fitting the
total. Already-fitted leaves are left alone: regenerating them would overwrite
work the user has, and reusing them is the entire point of deriving.

It **scopes the existing generator** (`restrictToLeafKeys`) rather than adding a
second leaf-fitting path. A parallel implementation would be two things that must
agree about seeding, one-off flags, short-history skipping and model choice, and
the ones this codebase has had did not stay agreeing.

**The button carries the count before the click**, and the two zero-missing
states stay apart: *all N cohorts already forecast* and *no cohorts in your data
match this selection* both generate nothing and mean opposite things.
`missingLeavesForKey` returns `enumerated` precisely so they cannot be collapsed
into `missing.length === 0`.

## The mirror control, and the correction it forced

It was specified as **zero All-bearing writes across every path**. That is false,
and finding out why was the most useful thing in the session.

When a dimension is not mapped — no tariff columns in the upload — every genuine
leaf key ends `|All|All`. Those are real fitted leaves. A literal zero-All rule
would refuse the entire dataset.

The honest invariant: **no write under a key that is All-bearing in a dimension
that is actually MAPPED.** An `All` in an unmapped dimension is a leaf; an `All`
in a mapped dimension is an aggregate. Same marker, different meaning, decided by
how the key was built — the third time this distinction has mattered, after the
legacy-import site and the retirement rule itself.

Both accept sites gained the decline, closing Session G's OPEN residual risk.
**The direction is load-bearing and trap 17 exists to hold it:** prevent the
write, never re-stamp it `accepted`. Laundering would satisfy any rule phrased as
"no fitted All-bearing writes" while making the defect *permanent* — the
retirement rule only retires `fitted`, so nothing would catch it on the way back
out. A guard that passes trap 17 is worse than no guard.

## The blocker the gate found

**Every Step 1 generation reported that it had done nothing.**

`generated`, `failed`, `empty` and `generatedIds` are incremented only in the
worker's standard-cohort loop. A scoped leaf run sends an empty standard list by
construction, so those counters are structurally zero however many leaves it
fits. The `BulkRunRecord` said `generated: 0, failed: 0, cohortIds: []`; the bulk
drawer rendered a successful run as one that did nothing; the export misreported
`Cohorts_Generated`; and no leaf could be attributed to the run that produced it.

The worker now tallies typed leaves **separately** rather than folding them into
the existing counters. Folding would have been fewer lines and would have changed
what every existing bulk run reports — a figure users have already seen, which
nothing in this change earns the right to move.

The call site no longer discards the result. Step 1 has no progress panel and the
app has no toast, so a `void` call left the user with no account of what
happened — and the leaves that could not be fitted are exactly the ones worth
saying out loud. **They are rendered by name.** "2 skipped" gives a number; the
names say which parts of the book are not covered.

## Three defects caught before the gate, by controls rather than by reading

- A spec invented a `series.length < 8` skip threshold and asserted 2 leaves
  would skip. **Zero did.** The app's rule is `calculateBaseForecast` returning
  null, named by `classifySkip` — the spec had been measuring its author's guess
  about the app rather than the app.
- The aggregate under test was one segment's roll-up, and the two unfittable
  leaves sit under *different* segments, so the skip checks covered neither.
- A trap insertion landed outside the `TRAPS` array (a `rindex` matching the
  wrong bracket) — caught by typecheck, not by the harness reporting a clean run.

The first two passed a plausible reading of the brief. Neither would have failed
had the control only asserted "some leaves were skipped" without pinning counts.

Measured, and confirmed independently by `spec:edge` rather than self-reported:
**74 leaves, 72 fit, 2 skipped**, both with two months of history, both named,
classified `insufficient-history` by the app's own classifier.

## Open, recorded, not fixed

**The retirement rule misfires on unmapped dimensions.** `isRetiredAggregateFit`
is pure key-plus-provenance and has no idea which dimensions were mapped, so on
an unmapped-dimension dataset it classifies *every genuine leaf fit* as retired.
Measured: it returns true for them.

They survive by an accident worth knowing: `buildRollUpIndex` maps a leaf key to
a list containing itself, the leaf read inside derivation is ungated, and
`deriveAggregate` of a single leaf returns that leaf unchanged. So the refused
store hit is handed straight back, provenance and model name intact.

**The load-bearing part is the single-leaf identity, and it is not obviously
permanent.** If that ever stops being an identity — a re-derived confidence band
would do it — every forecast on every unmapped-dimension dataset changes at once,
silently. `spec:generate-missing` pins the identity so it cannot be removed by
someone who does not know it is holding this up.

Left open deliberately: the fix is to give the rule the mapped-dimension set,
which reaches into how forecasts are keyed and belongs to its own pass, not to a
session whose scope is generation.

## Gate

- **ui-consistency** — one real finding, fixed: the Step 1 hint used
  `text-slate-500 mt-2` where the file's other `[11px]` helper strings use
  `text-slate-400 mt-1.5`. Disabled-button styling matched its sibling exactly.
  The manual singular/plural keys were checked against codebase practice and
  conform — this codebase does not use i18next pluralization anywhere.
- **qa-tester** — found the counter blocker. On re-run: confirmed a normal bulk
  run is provably unchanged, the scoped run now reports correctly, `ibroFailed`
  and `skipped` cover the same population with no third state, and
  `savedForecasts` is still merged rather than overwritten. Flagged three
  non-blocking items, all closed rather than carried.
- **regression-guard** — 24 discrete findings, 0 N/A, **SAFE FOR USER TESTING**.
  Verified the unmapped-dimension accident chain step by step in source rather
  than accepting the spec's description of it, and confirmed 74/72/2 through a
  different harness. No figure from any earlier walk moves: `spec:derive`'s pinned
  ARPU MAPEs and `spec:leafgrain`'s 72-of-74 re-run identical.
- `spec:generate-missing` 38/38, `guard-traps` 19/19 (16–19 all caught), `traps`
  3/3, all 19 other specs green, typecheck 0, build clean, i18n clean, scoped
  no-AI confirmed, `.env` untracked.

**Not exercised, stated rather than implied:** no browser walk of the four button
states — they were verified by driving `missingLeavesForKey` against real fixture
data and by reading the render, not by clicking. The full 80k-cohort bulk run was
not re-run; the no-op claim for normal bulk runs rests on every new branch being
gated on an option that is `undefined` for those callers.

## State

**MERGED** as `a39a6d0`. Branch `session-h-generate-missing-leaves` at `a8af683`.

Session I next, per the approved design: the completion modal as a coverage
statement, the copy batch, and item 5 extended — whether the VOLUME chart's
historical series carries the same seg+prod+chan-only filter as `arpuChartData`.
