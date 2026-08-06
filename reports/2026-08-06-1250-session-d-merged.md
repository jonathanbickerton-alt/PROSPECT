# FOR ADVISOR

**Generated:** 2026-08-06 12:50
**Certifies:** `52843af` — Session D merged to main, `--no-ff`, verified ON main after merge

**Findings**
- Gap closed before merging: the `cohortMatchesFilter` half now has a scenario, a positive control, and trap 10.
- The scenario had to be built twice — the first filtered to a product that resolved its own forecast, so the guard was never reached.
- Traps 9 and 10 both confirmed killing, by me and independently by stage 3. 10/10.
- Stage 1 PASS, stage 2 PASS, stage 3 SAFE — no finding classified as introduced by the branch.
- Merged with zero user-visible change; the 2 edge-fixture rows changed at the Session C merge.
- FAMILY CLOSED, in the reworded form: every REACHABLE fabrication gone — four live, three dead-code.
- Stage 3 held the line on the distinction: the chart path is moot, not fixed, and said so unprompted.
- `chartData`'s ~460 dead lines remain, queued behind tasks 2/3 with the divergence check first.

**Decisions needed from Jon / advisor**
- None. Boundary complete.

**Merge state:** MERGED and pushed at `52843af`. Tasks 2 and 3 next, fresh session.

---

## The gap, closed before the merge

The `cohortMatchesFilter` half of Case B's guard was correct and unverified — a
gate removed it and every spec stayed green. It now has a scenario and a trap.

**The scenario had to be built twice, and the first failure was instructive.** I
first filtered to a *different product*, which simply resolved its own forecast
and drew it correctly — the fallback never ran, so the guard was never consulted
and my assertion failed for a reason that had nothing to do with what it was
testing. The filter has to resolve to **nothing** for the fallback to be reached
at all; the deliberately omitted cohorts give exactly that scope.

The pair uses the same one-selector-one-geometry discipline as the series pair: a
forecast whose scope **matches** an unresolvable filter IS drawn — Case B doing
its job, and the positive control proving the selector matches and geometry is
detectable — while one scoped **elsewhere** is NOT. Without that control the
negative half would pass in any configuration that never draws a forecast at all,
which is precisely how the earlier version of this spec fooled me.

**Trap 10** removes the scope check and is confirmed killing. With trap 9, both
halves of the guard are now covered by planted violations, and the comment beside
the guard names which trap covers which half rather than recording that one is
uncovered.

## The gate

**Stage 1 PASS** — classNames collide with no CSS, no orphaned imports, i18n and
build clean, unscored-row presentation untouched.

**Stage 2 PASS** — confirmed the `chartData` dead-code finding with its own rename
test, independently reproduced the candidate-scan measurement, and checked the new
selector matched 4 elements rather than 0 before trusting the absence assertion.

**Stage 3 SAFE**, and it earned particular credit: it planted traps 9 and 10
itself rather than trusting `guard-traps`' report, reported exactly which
assertions went red, and **held the line on the distinction I most wanted held** —
that removing an unreachable mechanism is dead-code cleanup, not a behavioural
fix, and that the accuracy-denominator entry's chart path is *moot* rather than
*resolved*. It said so without being asked to.

Also measured on main after the merge: typecheck 0, build clean, twelve suites
425, nullrender 35, challenger 12, unscored 19, traps 3/3, guard-traps 10/10,
i18n clean, `.env` untracked.

## The declaration, in the reworded form

**Every REACHABLE fabrication is gone — three fallbacks in the table, the borrowed
seed, and the candidate scan; the chart-side three lived in dead code no user ever
saw, deleted regardless.**

Recorded with the family laid out as one pattern with five faces — *produce a
number where the honest answer is nothing* — and each marked reachable or not.

The reworded version is stronger than the one first drafted, and worth saying why:
"three in the chart" would have implied six live defects removed. There were four.
The honest count is the one that survives someone checking it, and on this
programme someone always does.

Its permanent defence: `spec:triggers` pins the population that reaches the
deleted paths; `spec:unscored` asserts the surface with every absence paired to a
positive control; traps 9 and 10 replant the two defects; and the
no-hand-rolled-summation guard stops the aggregate arithmetic being reimplemented.

## Carried forward

- **Tasks 2 and 3**, fresh session: export `buildCohortAccuracy` (pure move), the
  scored-leaf-grain DOM spec on the 5-part arrangement, the `~:767` unscored early
  return, and the stage-2 route re-test with retraction by name if irreproducible.
- **`chartData`'s ~460 dead lines**, queued behind those, opening with the
  divergence check against `multiChartData` — which copy drifted from which may
  matter to the live one.
