# FOR ADVISOR

**Generated:** 2026-08-06 11:33
**Certifies:** none — `803d4cb` is ungated. Merge withheld: a finding needs your decision.

**Findings**
- The surface spec is in and green: table shows the gap, chart renders, actuals still drawn.
- DECLARED GAP: the forecast line's ABSENCE is NOT asserted. Two attempts, both vacuous, both caught.
- Recharts puts no dataKey in the group class — every one reads `recharts-layer recharts-line`.
- Counting curves with geometry gives 4 of 16 both with the fix AND with the disagreement replanted.
- Trap 9 found it: it replanted the disagreement and the spec stayed green. Trap right, spec wrong.
- Trap 9 WITHDRAWN with its reason — nothing left for it to kill once the assertion went.
- So the chart half of "both panels" is unproven at the surface; the fix is in, the guard against reversal is not.
- Two harness errors also caught: fitting over the whole file gave "0 months compared"; the row selector matched the variance table.
- The handler question is answered by what did work: nothing downstream assumed a forecast — no fix needed.

**Decisions needed from Jon / advisor**
- Add a stable `className`/`name` to the forecast `Line` so the series is assertable? (my recommendation)
- Or accept the gap, gate and merge on the measurement alone — the deletion itself is measured and pinned.
- Either way: do you want the gate run now, or after the assertion is closed?

**Merge state:** UNMERGED, UNGATED on `session-d-chartdata` at `803d4cb`. Tasks 2/3 not started.

---

## What the spec proves, and what it does not

`npm run spec:unscored` mounts the real `ForecastVsActualsTab`, groups to full
grain, finds a genuinely unscored row and selects it. The store deliberately
omits two cohorts, so the population under test is controlled rather than
dependent on which leaves happen to fail to fit.

**Proven:** the accuracy table shows the gap for that row; the chart renders; the
actuals are still drawn.

**Not proven:** that the forecast line is absent — which is the half this branch
changed.

## Why I am not shipping it as green

Two attempts at that assertion, both vacuous:

1. **Select the series by class.** Recharts does not put the dataKey in the group
   class; every one reads `recharts-layer recharts-line`. The selector matched
   nothing, so "no baseline curve has geometry" passed for free.
2. **Count curves carrying path geometry.** Measured **4 of 16 with the fix, and
   4 of 16 with the disagreement replanted.** It does not discriminate.

**Trap 9 is what caught it.** I added it exactly as you asked — reinstate the
disagreement, watch the spec die — and it reported MISSED. The trap was right and
my spec was wrong. That is the trap doing its job, and it is the second time this
week a planted violation has caught an assertion of mine that looked fine.

I have withdrawn trap 9 with its reason written in, because once the assertion
became a declared gap there was nothing left for the trap to kill, and a trap that
cannot fail for the right reason is the thing that file exists to prevent. They
should be restored together.

I could have left the class-based assertion in place: it is green, it reads well,
and nothing would have flagged it. That is precisely why it had to go.

## The handler question, answered

You asked the spec to settle whether `noForecast` needs anything further through
the handler. It does: **nothing more is needed.** The mounted flow selects an
unscored row end to end — no crash, no blocked selection, actuals still drawn, and
the accuracy table already treats the state as first-class. Nothing downstream
assumed a forecast. No speculative fix made.

## Two harness errors, also caught

Worth recording because both would have produced a confidently green spec about
nothing:

- Fitting every leaf over the **whole** file produced forecasts starting after the
  last actual month: "0 months compared", an empty screen rather than an unscored
  row. Fixed by fitting on a truncated history so the months overlap.
- The row selector matched `tbody tr` generally and picked up the **variance
  table's** month rows, reporting zero unscored rows. A selector that matches the
  wrong table is indistinguishable from a missing feature.

## Why the merge is withheld

Your step 3 pre-authorised the merge "on a clean gate with no finding needing a
decision". The declared gap is a finding needing a decision, so I have not run the
gate or merged.

The deletion itself is not in doubt — it is measured, pinned by `spec:triggers`,
and the code is gone. What is missing is a check that would catch its reversal,
which is a different thing from the change being wrong.

**My recommendation:** give the forecast `Line` a stable `className` or `name` in
the component, assert on that, and restore trap 9 alongside. It is a small change
to production code in service of testability — the same trade as exporting
`buildRollUpIndex` — and it converts the last unguarded half of this branch into
something a planted violation can kill.

## Carried forward

- The series-level assertion and trap 9, together.
- The full three-stage gate, then the merge.
- **The family-closed declaration remains withheld** — still ungated, and now also
  with one half of the change unguarded. When it is made it should say: three
  fallbacks in the table, three in the chart, one borrowed seed, and the scan —
  all gone.
- Tasks 2 and 3, unstarted: export `buildCohortAccuracy`, the scored-leaf-grain
  DOM spec, the `~:767` early return, and the stage-2 route re-test.
