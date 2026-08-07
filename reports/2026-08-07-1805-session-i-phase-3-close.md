# Session I — Phase 3 close

## FOR ADVISOR

```
Generated: 2026-08-07 18:05 +0100 (UTC 2026-08-07 17:05)
Certifies: 18f6622 (merge of session-i-coverage-copy-chartscope at 1edce1e) — MERGED
Finding: timestamp convention amended — command-sourced, offset pinned; clock label is malformed
Finding: the 21:34 on the Session H report was fabricated; the real time was ~13:56
Finding: Step 1 ARPU history now filters on all seven dimensions — 1,344 rows to 168
Finding: measured gap closed — ARPU 11.99 vs 4.89, 145% apart, one chart, two lines
Finding: the VOLUME series needed nothing — it derives from the fit's own output
Finding: the metric axis is pooled ON PURPOSE — blended ARPU needs a blended denominator
Finding: completion modal is now a coverage statement, not a run-status claim
Finding: two counters, two populations — chart series vs forecast leaves, grains now stated
Finding: cohort-months grain check RAN — it sums across forecasts, the rename is correct
Finding: that string had never had an i18n key at all — hardcoded English, both sites
Finding: I broke the traps harness with the subtitle; it then passed while measuring nothing
Finding: a flagged metric mismatch was correct behaviour judged against the wrong comparator
Finding: broadAggrSnapshotMap untouched — no consuming memo was opened
Queued: mapped-dimension source of truth to the DQ phase, retirement-rule fix as rider
Decisions needed: none
State: MERGED. Phase 3 complete. Jon's walk follows below.
```

---

## 0. The timestamp amendment, and the diagnostic behind it

`date` on this machine reports **`Fri Aug 7 16:48:39 GMTST 2026`** — offset `+0100`,
UTC `15:48`, at the moment the diagnostic was run.

The Session H report is headed **21:34**. It was written at about **13:56**. No
timezone accounts for a 7h38m gap, so the figure was **composed from context
rather than read from the clock**. The conclusions in that report were sound,
which is what makes it worth a rule rather than an apology: a plausible number in
a header is not checkable by the person reading it, and the header is the part
that outlives the transcript.

It is the same species as the fabricated module paths that moved regression-guard
from Haiku to Sonnet — precision failing where reasoning held — and the same
answer applies: not "be more careful", but "read it from the thing that knows".

**The clock also needed pinning, and the diagnostic is why we know.** The zone
label `GMTST` is not a real abbreviation. The offset is sound; the label is
malformed, so a bare local stamp is ambiguous to a later reader. The convention
now carries the offset and UTC, from one command so the parts cannot disagree:

```bash
date +"%Y-%m-%d %H:%M %z (UTC $(date -u +'%Y-%m-%d %H:%M'))"
```

Recorded in CLAUDE.md. This report is the first written under it.

## 1. The completion modal

**A coverage statement, not a success claim.** "Bulk generation complete" was
true of the run and misleading about the book — it read as *everything is
forecast* while leaves were missing. The heading now reads the uncovered count.
The run finishing and the book being covered are different facts, and only one is
what the user came to learn.

**Two counters, two populations, grains now stated.** `generated` counts **chart
series** (the 5-part Step 1 cohorts); `skipped` counts **forecast leaves** (the
7-part keys every aggregate is summed from). They were stacked as though they
were two views of one number, so "31,852 generated / 2 skipped" invited a
subtraction that means nothing. Both name their grain now, both skip wordings
come from `SKIP_REASON_KEY`, and the named leaves survive.

Session G's retired-aggregate notice survives too — pinned by a spec check,
because a rewrite is exactly when a previous session's user-facing statement gets
quietly dropped.

## 2. The copy batch, with the check the design pass declined to assert

The design pass proposed renaming `{n} months compared` to cohort-months and
**explicitly flagged that it had not confirmed the grain** — "a five-minute check
at build time, and I am flagging it rather than asserting it."

**The check ran.** `summaryMape.monthsWithActuals` is
`perForecast.reduce((s, m) => s + m.monthsWithActuals, 0)` — a sum **across
matching forecasts**. Forty cohorts over six months reads 240. Cohort-months is
correct. Independently confirmed in the gate by driving the real
`computeForecastMape` on two leaf forecasts: 12 cohort-months against 6 distinct
calendar months.

It also turned out the string **had no i18n key at all** — hardcoded English at
both KPI card sites, never translated in any locale. The copy change and the
keying were one job, as the design pass predicted.

Plus the MAPE "Lower is better" subtitle and `(not mapped)` →
`(not available in this view)`.

## 3. The chart, which is what Jon walks

`arpuChartData` rebuilt its historical series from raw rows on a
segment + product + channel filter. The forecast beside it was fitted on all
seven dimensions.

| | rows | ARPU |
|---|---|---|
| old historical scope | 1,344 | 11.99 |
| forecast fit scope (now also the historical scope) | 168 | 4.89 |

**8× the population, 145% apart, drawn on one axis as Historical and Mean.** The
design pass measured a different leaf at 15× / 107%; same family, worse ratio
here.

The fix copies the fit's semantics rather than tightening them — L2 filters apply
only when a value is set, tariff L2 nests inside tariff L1 — because filtering
*more* strictly here would recreate the disagreement from the other side.

**The volume series needed nothing, and the reason is structural rather than
lucky.** `stdChartData` derives from `forecastData`, which is the output of the
fit's own seven-dimension chain, so its history cannot disagree with its forecast
about scope. Only the ARPU view rebuilt from raw data, and only it could drift.
The spec asserts the volume series grows no filter of its own **and** that the fit
still filters on all seven — because that second fact is what keeps it safe.

## 4. broadAggrSnapshotMap

**Untouched, correctly.** This session's only edits to `ForecastVsActualsTab` are
at lines 3107–3146 (the KPI cards). Its three consuming memos (1929, 2007, 2460,
2600) were not opened, so the standing delete-in-passing decision does not fire.

## 5. Queued to the DQ phase

**A mapped-dimension source of truth, with the retirement-rule fix as its rider.**

Three sites now decide what an `'All'` in a cohort key *means*, and they disagree,
because none can see which dimensions the user mapped: `isRetiredAggregateFit`
(misfires on every genuine leaf when a dimension is unmapped), the legacy
pre-option-C import (`'All'` there means "column absent"), and the mirror control
(which had to be restated from "no All-bearing writes" to "no writes All-bearing
in a *mapped* dimension").

The DQ phase needs that set anyway for its "How your data was read" line — the
line whose absence has invalidated two of Jon's walks. Making it the source of
truth costs nothing extra there and removes three private answers. Fixing
`isRetiredAggregateFit` alone would add a fourth, which is how there came to be
three.

## 6. The two gate findings

**Mine.** Inserting the "Lower is better" subtitle between the MAPE heading and
its value broke `regression-traps`' card scraper, which read `ps[1]` by index. It
then scraped the same static caption from every card, so the filtered and cleared
states compared textually identical and trap B **passed while measuring
nothing** — the vacuous-pass shape, inside the harness built to catch it. The
scraper now finds the value by content. An index into sibling paragraphs encodes
the layout, and the layout is not what the trap is about. Restored to 3/3 with
real discrimination: 2.7% filtered vs 2.5% cleared.

**Not mine, and not a defect.** The gate flagged that `arpuChartData` never
filters by scenario/metric while `processedData` does, reading it as the same
population mismatch on an eighth axis. Reasonable flag, wrong conclusion:
`processedData` is the **volume** series' scope — it filters to one metric because
it is fitting that metric's volume. The chart's ARPU line plots the **blended**
`arpu`, which the fit builds as `totalRev / totalSubs` summed across all four
metrics. A blended figure needs a blended denominator; filtering the history by
metric would introduce the mismatch, not remove it. The gate's own measurement
confirms it — the DOM matched the unfiltered computation 42/42. Now pinned in
`spec:chart-scope` so it is not "fixed" later.

## 7. Gate

- **ui-consistency** — one real finding: folding the counts into interpolated
  strings to give them a grain dropped the `<strong>` every numeric row uses. The
  grain was the point; the emphasis did not have to be the price. Numbers are bold
  and outside the string again, grain nouns inside it, with a singular form for
  the leaf row. The spec pins **both halves together**, because checking only for
  `<strong>` would pass if someone restored the emphasis by reverting the grain.
- **qa-tester** — mounted the real component and read the rendered Historical
  column; confirmed the aggregate case is unchanged (gap 0.00), the deps recompute,
  and all four modal states including the catch path. Found the harness break.
- **regression-guard** — 21 checklist items, **SAFE FOR USER TESTING**. Verified
  the filter semantics match on all three named criteria, confirmed the traps
  harness genuinely discriminates rather than accepting its pass, and checked the
  DQ queue entry against all three sites it names.
- 21 spec suites green (`chart-scope` 29/29, `coverage-copy` 34/34), `guard-traps`
  22/22 with traps 20–22 caught, `traps` 3/3, typecheck 0, build clean, i18n
  parity 0 missing, scoped no-AI confirmed, `.env` untracked.

**Not exercised:** no browser walk — that is what follows. The tariff dimension
could not be isolated as the sole changed variable in the deps test, because this
fixture ties tariff 1:1 to every other combination; confidence there rests on the
source-level deps check plus the structurally identical Product L2 guard behaving
correctly live.

---

# Jon's Phase 3 walk

**Screenshot-gated step zero. Do not proceed past it without pasting the two
screenshots — the last two walks were invalidated at exactly this point, and both
times the cause was a fixture that was not the one we thought.**

## Step zero — establish what you are looking at

1. Hard-reload the app (Ctrl+Shift+R). Confirm the build is fresh.
2. Load **`VBU_IBRO_EdgeCases_ShortHistory_PerScenarioARPU_Jan2023_Jun2026.xlsx`**.
3. Map all seven dimensions: Segment, Product L1, Product L2, Channel L1,
   Channel L2, Tariff L1, Tariff L2.
4. **Expected row count: 74 leaf cohorts.** If you see anything else, stop and
   say so — the rest of this walk is void.
5. **PASTE TWO SCREENSHOTS before continuing:** (a) the filename as the app shows
   it, (b) the mapping screen with all seven dimensions assigned.

## A — the four button states (Step 1)

6. Select a **fully specified leaf** (every dimension set, no "All"). The generate
   button should read its normal label. **Expect:** unchanged behaviour.
7. Set **Segment = All (Aggregated)**, leave the rest specific. **Expect:** the
   button now names a count — "Generate N missing cohort forecasts" — with a hint
   line below giving the total in scope.
8. Click it. **Expect:** it generates only the missing leaves, and afterwards a
   result panel appears naming any leaf it could not fit. On this fixture two
   leaves have two months of history each and **should be named, not just
   counted**.
9. Click generate again on the same selection. **Expect:** the button is now
   disabled and reads "All cohorts in scope already forecast".
10. Choose an aggregate combination that does not exist in the data. **Expect:**
    disabled, reading "No cohorts in your data match this selection" — a
    **different** message from step 9. If those two read the same, that is the
    defect this design was built to prevent.

## B — the coverage modal

11. Reload, load the same fixture, and run **bulk generation** from Overall
    Forecast.
12. **Expect on completion:** the heading is a **coverage statement**, not
    "generation complete". With the two unfittable leaves present it should say
    cohorts still have no forecast.
13. **Check the counters name their grain** — one should say *chart series*, the
    other *forecast leaves*. They count different things and must not invite
    subtraction.
14. **Check the skipped leaves are named**, with a reason beside each.
15. **Check Session G's retired-aggregate notice is still present** in the panel.

## C — the retired-aggregate notice on your own saved session

16. Load **your saved session file from 07 Aug 10:26** — the one with the manual
    aggregate at `Corporate | Fixed Connectivity | All | All`.
17. **Expect: Step 1 shows the DERIVED numbers immediately, on first render** —
    not after you touch a filter. This is the fix that mattered most in Session G.
18. The aggregate's totals **will differ from what that session showed when you
    saved it**: inflow **−2.06%**, retention **−2.77%**, ARPU **+2.20%**. That is
    expected and correct — nothing was re-forecast, only the arithmetic joining
    the 27 leaves changed.
19. **Expect the coverage/retirement notice** telling you those totals are now
    summed from leaves.

## D — the Step 1 chart, history and forecast from one population

20. Select a **fully specified leaf** with Product L2 **and** tariff set.
21. Generate, then switch the Step 1 chart to the **Value (ARPU)** view.
22. **Expect: the Historical line and the forecast Mean line are now at a
    comparable level.** Before this session the history was drawn from roughly
    8× the rows and sat far above the forecast — around 12 against 5 on the
    measured leaf.
23. **Change only the tariff selection.** Expect the Historical line to move —
    it should recompute, not sit stale. *(This is the one thing the gate could
    not isolate on this fixture, so your eyes are the check here.)*
24. Switch to the **Volume** view. Expect it unchanged from before — it was
    already correct and this session did not touch it.

## E — copy

25. On Actuals Review, check the MAPE cards read **"Lower is better"** under the
    title and **"N cohort-months compared"** below the value.
26. Where a dimension is unavailable, the checkbox list should read
    **"(not available in this view)"**, not "(not mapped)".

**Report per step: pass, fail, or "did not reach". A step you could not reach is
information, not a gap — say so rather than skipping it.**
