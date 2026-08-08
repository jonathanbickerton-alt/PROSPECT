# Session K — the panel gate

## FOR ADVISOR

```
Generated: 2026-08-08 10:40 +0100 (UTC 2026-08-08 09:40)
Certifies: d4a7f8a (merge of session-k-panel-gate at 5385ace) — MERGED
Finding: step 8 INTRODUCED BY J — the panel gates on forecastData, J set only baseForecast
Finding: surface-not-store at PANEL level — a correct value in a component that never renders
Finding: J's spec asserted on state below the gate, so it passed while the screen was wrong
Finding: spec:step1-panel now MOUNTS the real tab; gates are inside the assertion
Finding: step 9's blocked state confirmed PASSING on screen by Jon — defect 1 closed
Finding: defect 2 DESIGN GAP — the predicate ignored whether a dimension was MAPPED
Finding: a genuine leaf fell into the aggregate machine and became un-regenerable
Finding: fourth site of the marker-meaning distinction; also two copies, now one memo
Finding: gate found a notice sitting over the PREVIOUS selection's chart — worse than step 8
Finding: gate found the placeholder inviting a generate under an explanation it cannot work
Finding: gate found my hand-rolled scope test had already drifted from shared rowInScope
Finding: stage 3 MOUNTED walk steps 8, 9, 10 before certifying; its step-10 check is folded in
Decisions needed: none
State: MERGED. Walk resumes at section A step 8 — third attempt at this section.
```

---

## 1. Step 8 — introduced by Session J, and the spec was the reason it survived

`StandardForecastTab` renders the entire result panel behind
`forecastData.length > 0 && !emptyCohortSelection`. **`forecastData` is a
different piece of state from `baseForecast`**, written only by the manual leaf
paths. Session J's aggregate path set `baseForecast` and returned, so the panel
never mounted and "Ready to forecast" stayed on screen after 72 successful fits.

**Why it got through a gate that was working.** J's spec asserted that
`showResolvedAggregate` calls `setBaseForecast` with a derived forecast. That
assertion was **true**. The screen was still wrong.

This is surface-not-store one level up from where this codebase had met it
before. The earlier instances were a wrong value inside a component that
rendered. This was a correct value in a component that **does not render** — and
no spec asserting on state, or mounting the subtree below the gate, can tell the
difference.

**The rule, now recorded: a spec for "the user sees X" must mount from above
every gate between the state and X, so the gates are inside the assertion rather
than assumed open.** `spec:step1-panel` mounts the real tab and asserts the
placeholder is gone, the panel is present, and the chart has geometry — with a
positive control proving the placeholder is reachable, since "no placeholder"
would otherwise pass for a component that failed to render at all.

`showResolvedAggregate` now populates `forecastData` in the manual path's row
shape, because `stdChartData` and the preview table both read that shape.

**One limitation stated rather than papered over:** `BaseForecastMonth` carries
inflow, outflow and retention bands but no Base *volume* band, so a derived
aggregate cannot produce a Base series. Selecting Base on an aggregate says so
instead of plotting one of the other three under a Base label.

## 2. The state machine's scope — design gap

Every Step 1 dimension defaults to `'All (Aggregated)'`, and the predicate asked
only whether any dimension sat at that value. **An unmapped dimension at its
default therefore made every selection look aggregated** — so a genuine leaf fell
into the aggregate state machine, where a fully-fitted scope reads `covered` and
disables the button. A leaf whose forecast already existed became
un-regenerable, which is not what those four states were designed for.

The predicate now requires the dimension to be **mapped**. An `'All'` in a
dimension this dataset does not have is not an aggregate.

**Fourth site of the same marker-meaning distinction**, after the legacy import,
the retirement rule and the mirror control — which is the argument for the single
mapped-dimension source of truth already queued to the DQ phase, rather than a
fifth private answer.

It was also **two copies** of that predicate — one in the button's state machine,
one in the generate handler — two things that must agree about what the button
offers and what the click does. Now one memo, read by both.

**Reconciliation still pending:** Jon's leaf-selection screenshot has not
arrived. The mechanism above is established from the source and is a real defect
regardless; if the screenshot shows a selection with every dimension explicitly
set, that is a *different* path and would be a further finding.

## 3. Three more, all found by the gate rather than by review

- **A notice over someone else's numbers.** The Base-scenario branch returned
  with only a notice, leaving the previous selection's chart and table rendered
  beneath it — the panel gate reads `forecastData` and knows nothing about the
  notice. One cohort's numbers under a sentence about another: a worse version of
  the defect this session opened on. The branch now clears the panel first. My
  spec had tested the notice only with an *empty* panel, so the one combination
  that mattered was unguarded.
- **The placeholder argued with the notice.** "Ready to forecast" directly
  beneath an explanation of why nothing can be shown reads as though nothing had
  been tried. The invitation now stands down; the control matters more than the
  assertion, since checking only for the placeholder's absence would pass for a
  placeholder deleted outright.
- **A parallel implementation I wrote.** The historical scope test was a
  hand-rolled copy of `rowInScope` from `cohortScope.ts` — which
  `ForecastVsActualsTab` already calls for exactly this job — and it had **already
  drifted on its first read**, trimming the row side but not the scope side. A
  near-copy of a shared predicate is this codebase's most repeated failure and
  does not become safe for being short.

## 4. Gate

- **ui-consistency** — verified zero JSX changed in the first commit; raised the
  placeholder/notice contradiction as a reserved judgement call, which produced
  the fix above.
- **qa-tester** — found the stale panel and the parallel implementation; verified
  the `yyyy-MM` date shape parses and sorts correctly in `stdChartData`, and that
  the predicate change routes the newly-leaf case to a path that is safe for it.
  It also disclosed running guard-traps concurrently and leaving a mutated file,
  which it reverted; I verified the tree independently afterwards.
- **regression-guard** — **SAFE FOR USER TESTING**, and it did the thing this
  gate existed to do: **mounted walk steps 8, 9 and 10 against the real component
  tree**, naming every gate between state and pixel, rather than reading JSX. It
  found step 10 had no mounted coverage in my spec and wrote its own; that check
  is now folded into the shipped spec so it runs every time.
- 23 spec suites green (`step1-panel` 24/24 mounted, `walk-fixes` 68/68),
  `guard-traps` 32/32 with traps 28–32 caught, `traps` 3/3, typecheck 0, build
  clean, i18n parity clean, scoped no-AI confirmed, `.env` untracked.

**No figure from any earlier walk moves.** `spec:derive`'s pinned ARPU MAPEs and
`spec:leafgrain`'s 72-of-74 re-ran identical; 74/72/2 stands.

## 5. The walk resumes at section A step 8

Third attempt at this section. What changed since the last text:

- **Step 8** — after generating, the **result panel now mounts and the chart
  draws**. This was verified by mounting the real component, not by reading code.
  If "Ready to forecast" still appears, stop — the fix did not take.
- **Step 9** — unchanged, and you confirmed it passing: disabled, reading the
  reason.
- **Step 10** — unchanged, and now covered by a mounted check: disabled, with
  text that **differs** from step 9's.
- **New** — selecting an **individual cohort** (all dimensions set) must leave the
  Generate Forecast button **enabled**, including when that cohort already has a
  forecast. That is the defect-2 fix, and it is the step your screenshot will
  settle.
- **New** — with the **Base** scenario selected on an aggregate, expect a grey
  notice explaining that a summed aggregate has no Base volume series, and an
  **empty** panel beneath it — not a leftover chart from a previous selection.

Sections B, C, D and E were unaffected by Session J and are unaffected by this
one; they stand as written in the Session I report.
