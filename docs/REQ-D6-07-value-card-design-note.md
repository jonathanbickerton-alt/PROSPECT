# REQ-D6-07 — the Value card leads with the cohort ARPU (design note)

Decisions: EXPECTED.md "REQ-D6-07". Figures are measured on the trimmed
fixture, cohort Corporate|All, 2026-09-16 — not estimates.

## The card

1. LEAD PAIR where the two blend boxes are now: the cohort's fitted ARPU and
   the ARPU delivered with this draft, at the month the preview reads, named
   with month and cohort. Source: the existing yieldPreview (WhatIfTab:3804),
   so no new engine call. Inflow reads draft month + 1, Retention the draft month.
2. DEMOTED, collapsed "how this is computed": Baseline blended / New blended
   (equal-weight), the ratio and today's caption. The comparator is unchanged;
   only its prominence is.
3. TARGET BOX reads "Target cohort ARPU at <month>". Reachable is the band's
   ends put through the seam: measured 5.50 – 27.61 at 2026-11, against the blend band
   7.94 – 39.81 (two seam calls, 29 ms).
4. UNREACHABLE shows the typed number, never clamped, naming the binding tier
   in cohort terms: "the highest this cohort reaches at <month> is 27.61, set
   by High Value".

## The solve

Bisect the BLEND target; each step is solveForTarget then the seam, compared
against the typed cohort figure.
- MEASURED: one engine call 8.9 ms (8.4–10.1, 10 calls, 12,432 rows); 20 steps
  0.18 s; the real solve converged in 10 steps / 72 ms.
- TOLERANCE: the chart ARPU columns are rounded to 2dp at source
  (WhatIfTab:1331, 1338), so 0.01 is the finest achievable through them —
  accept 0.01, or read the unrounded adjustedMonths. The closed form
  (target × equal-weight ÷ fitted) landed 0.0039 out, so it is the right first
  guess, then bracketed and bisected.
- WHEN: Enter, blur and Apply — never per keystroke (0.18 s), which is also
  D4-02's commit rule.

## The summary cell, and what is untouched

- ADJUSTS becomes the persisting cohort effect, "Inflow ARPU +52.1%": the ratio
  is blend ÷ equal-weight, computable from the event alone, so the row builder
  needs no engine call (it takes only the three event lists).
- The per-month pair is a NEW input for the tooltip — the row builder has no
  forecast, so it must be opt-in from a caller that has one.
- UNTOUCHED: Yield_Events keeps Tariff_Mix_JSON, Tariff_Base_ARPU_JSON and the
  override column; the forecast sheet keeps Blended ARPU (Baseline/Uplifted);
  so are the basis toggle, padlocks, wall, exactly-determined and Apply's write.

## Keys needed, six locales

whatif_value_lead_fitted / _delivered / _at, whatif_value_how_computed,
whatif_value_target_cohort / _reachable_cohort / _unreachable_cohort, whatif_summary_yield_ratio.

## Questions for Jon (underdetermined by decisions 1–5)

1. TOLERANCE: 0.01 through the rounded column, or adjustedMonths at 0.001?
2. THE SOLVE'S MONTH: the lead pair names its month (Inflow: draft + 1) — does the Target box solve there, or at the draft month for both carriers?
3. THE SUMMARY RATIO is the event's own effect; where a rival yield event wins that month the cell says nothing. Carry the rival marker the preview has?
4. REACHABLE IN COHORT TERMS costs two extra seam calls per render (29 ms measured) — or compute the band only when a target is typed?
5. ROLL-FORWARD drafts persist while the lead pair names one month. Should they read "from <month> onward"?
