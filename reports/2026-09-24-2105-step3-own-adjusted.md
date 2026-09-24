# REQ-D7-02 session 2 (resumed) — the seam extracted; Step 3 computes the adjusted forecast for its own view

## FOR ADVISOR

```
Generated: 2026-09-24 23:10 +0100 (UTC 2026-09-24 22:10)
Certifies: 542a5cb347c96a55b02ae5fac3750d1de5c0ddfb
Repo: committed 542a5cb, pushed (origin in sync)
Decisions (clause 11) 4d30840 alone. Skeleton 86f8d74. Base clean.
guard-traps targeted 108/108 CAUGHT, rotation 20, NOT RUN 176 (line s.8)
full suite:  79/79 green (first run 78/79: initiatives re-aim, s.5)
ITEM 1 held: Step 3 badge+toggle score THIS view's run from the SAME seam
Seam: eventScopeSeries() in src/utils/eventScopeSeries.ts; WhatIfTab wraps
Counts: seam callers 6 (5 wrapper + FVA); engine 6; step3 setter callers 1
View run memoised: median 83.5 ms per run (90,720 rows, 5 runs, suite)
Carry: loaded Adjusted rows in App state; ONE writer; actuals_clear gone
Finding: 12231.5% is per-leaf MAPE vs view means, NOT a view mismatch
Finding: that corrects session 1 (1711), which blamed Step 2's other view
Finding: util <-> WhatIfTab import cycle exists and is inert (no top-level)
Traps 287-290 new; 285 RETIRED (its claim is 288's); 286 re-pointed
Traps 108/194/197/255/284 re-pointed: moved anchors, each seen RED by hand
Decision for Jon: the per-leaf/view-means scale mismatch (section 6)
Shed: nothing. (j) the carry was built.
Hold: none. Merge state: main, pushed.
```

Written after the build was code-complete and BEFORE guard-traps, per the
skeleton rule; the gate figures were filled after build commit 542a5cb was
pushed. The initiatives re-aim (section 5) was added between the two suite runs.

## 1. Base (quoted at session start)

- `git status --short`: empty.
- `git diff --stat 8ccee41 -- src`: empty.
- `git diff --stat 8ccee41 -- scripts`: `scripts/guard-traps-ledger.json` only
  (the 1711 report's ledger commit).

Clause 11 (Option A: the seam extracted) was committed ALONE as `4d30840`
before any code, and pushed.

## 2. What was built

**Clause 11 — the seam extracted.** `eventScopeSeriesFor`'s body moved
VERBATIM (70 lines) to a module-level `eventScopeSeries(input)` in the new
`src/utils/eventScopeSeries.ts`. It returns the existing shape
`{ series, reason, arpuIdsByMonth, rawArpuByMonth }` PLUS `adjustedMonths`
(the engine run's own months; `[]` on the null path). WhatIfTab keeps
`eventScopeSeriesFor` as a thin `useCallback` wrapper that passes its closure
values through; its dependency list is unchanged. `dimOrNull` is exported
from WhatIfTab for the util. Step 3 is caller 6; `computeAdjustedForecast`
stays at 6 (the call moved into the util, it was not added).

**Clause 10 — Step 3 scores its own view.**
- Events reach FVA by prop: `marketEvents`, `yieldEvents`, `pricingEvents`
  (a stable `NO_EVENTS` default).
- `useForecast()` in FVA no longer reads `adjustedForecast`; the
  `comparisonRows` read of it and its dependency are gone.
- `showAdjusted` = any ENABLED event (`isEventOn`) of the three kinds whose
  scope `eventScopeMatchesView` the view — one predicate call. The key
  equality against Step 2's global is removed.
- `viewRun = useMemo(...)` calls `eventScopeSeries` for the view's draft
  (`excludeId: null`) only when `showAdjusted`; `adjustedMeanMap` is built
  from `viewRun.adjustedMonths[].uplifted`, guarded by
  `adjustedScoringOn && viewRun`.

**Clause 8 carry.** The load reads `Adjusted_Forecasts` into App state
`carriedAdjustedRows` (placeholder-guarded with `isPlaceholderSheet`). The
provider's setter is `setAdjustedForecastFromStep2`, which drops the carried
rows on any non-null write. The export has ONE writer:
`adjustedForecastSheetRows(adjusted, carried)` in forecasting.ts returns
Step 2's rows, else a copy of the carried rows, else null — and App appends
the placeholder note on null (the literal stays in App so i18n-scan's
agreed exclusion still covers it). `actuals_clear` is retired in all six
locales (947 -> 946) and its translator note removed from `_context.json`.

## 3. Exact counts

| count | measured |
|---|---|
| eventScopeSeriesFor callers | **6** — the 5 `eventScopeSeriesFor(` sites in WhatIfTab (3920, 3975, 4051, 4441, 4726) reach the seam THROUGH the wrapper; FVA's `eventScopeSeries({` (2072) is the sixth. The wrapper's own `eventScopeSeries({` (3888) is the delegation, not a caller: the step3-one-bar pin counts it separately as `5 + wrapper 1 + FVA 1`. |
| computeAdjustedForecast | **6** across src — WhatIfTab 1404 (definition), 3713, 4298, 5693, 5696; util 106 |
| handleStep3FilterChange callers | **1** — defined App 1853; the viewing bar's `onChange` (App 4524); the third hit is a comment |
| the rest as in 1711 | every token the 1711 table counted is **unchanged** from 8ccee41: `onCohortFilterChange` 1 (the FVA comment), `resolveForecast(` in FVA 4, coveredLeafKeys 1 def / 4 FVA, `deriveAggregate(` in FVA 1, `accuracy-month-select` 1, solveForCohortTarget 4, buildPromoEvents 10, `resetYieldDraft()` 2, handleDeleteCampaign 5, setPendingChange 10, campaignToggleState 4, carryInitiative 4, `{ initiative }` 3, initiativeKey 8, handleSetEventEnabled 11, initiativeGroups 4, handleSetInitiative 4, handleDeleteInitiative 2 (raw token counts, measured on base and now, equal pairwise). Market/Yield/Pricing sheet writers: 0 diff lines in App. |

## 4. Mounted cases (g)-(k) — `spec:step3-one-bar` 55/55

- **(g)** Step 2 writes for Corporate/Direct/Mobile Voice; Step 3 views
  Corporate/Direct with an applying event. Engine Inflow card at 2026-06:
  Corporate/Direct's own means **12231.5%**; Step 2's Mobile Voice means
  **3155.3%**; All/All's 12231.5%. The card reads **12231.5%**. The reference
  is the engine run made by a transcription of the PRE-MOVE body from
  8ccee41, not the seam's own return — so a seam that dropped
  `adjustedMonths` cannot pass by moving the answer too (trap 290 now reds
  (g) as well as (k)).
- **(h)** disabled event: badge hidden, cards read Baseline.
- **(i)** no Step 2 at all (no global): the badge still shows where an event
  applies, and the toggle scores the same view means.
- **(j)** the carry: the loaded file has 12 real Adjusted rows; a save before
  Step 2 writes those 12; after Step 2 writes, Step 2's rows; neither gives
  null and the placeholder. Structure: one sheet append; the state set by the
  load under the placeholder guard; the provider handed
  `setAdjustedForecastFromStep2`.
- **(k)** the moved seam returns the SAME series and the SAME per-month
  winners as the pre-move body (Corporate/Direct, one event);
  `adjustedMonths` is the run's own, unrounded. One view run: median
  **83.5 ms** (min 76.8, max 89.3; 5 runs, 90,720 rows) in the gated suite
  run; 59.7 ms on a standalone run earlier in the session.

**Byte-identity of the five existing callers — its limit.** Identity was
shown for the seam FUNCTION against the transcribed pre-move body at one
input. The five callers go through the unchanged wrapper with an unchanged
dependency list, and every spec that mounts them (pricing-roundtrip,
yield-roundtrip, view-apply, mix-card, promo-cohort-target) passes with its
figures unchanged. No per-caller byte diff of `series` was taken.

## 5. Re-aims — each seen RED before it was re-aimed

The seam body left WhatIfTab, so four specs that read the seam's SOURCE now
read WhatIfTab + the util (counts unchanged):

| spec | red before re-aim | after |
|---|---|---|
| pricing-roundtrip | 147/150 (engine sites 5, excluded-inside, dimOrNull) | 150/150 |
| promo-cohort-target | 38/39 (engine 5) | 39/39 |
| yield-roundtrip | 75/81 (6 fails) | 81/81 — plus its two return-literal pins now include `adjustedMonths` |
| mix-card | 229/230 (helper callers 3) | 230/230 |
| compare-events-panel | 70/71 — `isPlaceholderSheet(` 9 sites (the carry restores a guarded load site) | 8 -> 9, 71/71 |
| step3-one-bar (d)/(f) + structure | 31/37, (d) and (f) failing: FVA got no events | re-aimed to clause 10, 55/55 |
| initiatives | caught by the FIRST suite run, 139/140: `FAIL (X) computeAdjustedForecast stays 6 [5]` — a WhatIfTab-only count | WhatIfTab + util, 140/140 |

## 6. Findings

1. **12231.5% is not a view mismatch.** The cards' adjusted mode feeds
   VIEW-level means into a PER-LEAF MAPE: each leaf's actual is scored
   against the whole view's adjusted mean, a scale mismatch. It is
   pre-existing (it is what the global path did too), and it reproduces
   with Step 3's OWN run: Corporate/Direct's own means give 12231.5%. This
   **corrects the 1711 report**, which attributed the figure to Step 2's
   adjusted forecast being for another view (its trap-285 "why" says so).
   **Decision for Jon:** whether adjusted scoring should compare per-leaf
   actuals to per-leaf adjusted means (the engine has no per-leaf adjusted
   run today) or aggregate actuals to the view means. Not built; reserved.
2. **Import cycle.** `utils/eventScopeSeries.ts` imports
   `computeAdjustedForecast` and `dimOrNull` from WhatIfTab, which imports
   the util. It is inert — neither module reads the other at top level — and
   tsc, lint, build and every spec are green. Moving those two into a util
   would remove it; not done, as it would move engine code this brief did
   not name.
3. **Where the carried rows live:** App state `carriedAdjustedRows`, set only
   by the load; dropped by the only Step 2 writer; read only by
   `adjustedForecastSheetRows`, the export's single writer.

## 7. Traps

Planted by hand against the final spec, each backed up to the scratchpad,
md5'd before / planted / after, restored FROM THE BACKUP, all identical.

| trap | file | before -> planted -> after | red |
|---|---|---|---|
| 287 FVA reads Step 2's global | FVA | 3da1ea55 -> 24ec1129 -> 3da1ea55 | 52/55: `(g) toggle ON: the Inflow card is the engine's figure for THIS view's uplifted means [3155.3% vs 12231.5%]` |
| 288 badge ignores the view | FVA | 3da1ea55 -> d16df832 -> 3da1ea55 | 51/55: `(d) moved to Corporate/Direct/Mobile Data, which the event does not reach: the badge is HIDDEN` |
| 289 export drops loaded rows | forecasting.ts | 301c28ae -> 9be97eb6 -> 301c28ae | 54/55: `(j) save BEFORE Step 2: the sheet's rows are identical to the loaded ones [1 rows vs 12]` |
| 290 seam omits adjustedMonths | eventScopeSeries.ts | 4bbba699 -> 075b7f40 -> 4bbba699 | 52/55: `(k) adjustedMonths is the run's own, UNROUNDED ... [undefined]` (and (g) `[4.9% vs 12231.5%]`) |

**285 RETIRED.** It planted the removal of the key equality; clause 10
removed that equality on purpose. Its claim ("the badge shows at a view the
event does not reach") is 288's, planted on the predicate that replaced it.
Recorded in the registry; the number is not reused.

**Re-pointed** (spec:trap-anchors found their anchors aged out; each seen
RED by hand on the new anchor, restored identical):

| trap | now | before -> planted -> after | red |
|---|---|---|---|
| 286 zero applying events | FVA, `marketEvents.filter(isEventOn)` | 3da1ea55 -> 9772dc07 -> 3da1ea55 | 52/55: `(e) disabled event only: the badge is hidden` |
| 108 pricing fed the loaded cohort | WhatIfTab WRAPPER: a resolver answering with `baseForecast` (the util has no loaded cohort in scope) | d3d80b9b -> 804758f0 -> d3d80b9b | mix-card 225/230: `pricing scope: baseline ARPU is the EVENT SLICE, not the loaded cohort [stored 20.3999998779001 vs slice 24 ...]` |
| 194 draft not spliced | util, same anchor | 4bbba699 -> 6bc60caa -> 4bbba699 | yield-roundtrip 80/81: `D5-11: the yield draft is spliced into the list the engine is given` |
| 197 per-month winner dropped | util, same anchor | 4bbba699 -> fd1ccc13 -> 4bbba699 | view-apply 204/208: `D5-13: the rival line names the event and its month, FORMATTED [null]` |
| 255 market splice dropped | util, same anchor | 4bbba699 -> 77c9fc8e -> 4bbba699 | promo-cohort 28/39: `(a) an even mix on the Historical basis delivers 15.03 (engine 15.0299) [13.88]` |
| 284 row click writes the bar | FVA props now end with the event arrays | 3da1ea55 -> 4aa26030 -> 3da1ea55 | 51/55: `(b) the viewing bar was NOT written: no call reached the old setter` |

`SEAMUTIL` (`src/utils/eventScopeSeries.ts`) joined TARGETS: 23 -> 24.
spec:trap-anchors **304/304** (284 traps, 299 anchors; next free id 291).

## 8. Gate (serial)

| check | result |
|---|---|
| `npm run suite` | first run **78/79** (initiatives: a WhatIfTab-only engine count, section 5); after the re-aim **79/79 green** |
| guard-traps `-- --targeted` (to a file) | **108/108 CAUGHT**, verbatim below |
| spec:trap-anchors | 304/304 |
| spec:i18n-parity | 203/203; **946 keys** in each of en/de/es/fr/it/pt; retired key **`actuals_clear`** absent from all six |
| spec:i18n-scan | PASS |
| spec:survival | 27/27; **104** first-row dereferences across **26** files. First run was 26/28: the spec's `t[0].toFixed` in (k) was a new dereference — replaced by `Math.min(...t)`, the baseline not raised. |
| tsc | exit 0 |
| lint | exit 0 |
| build | exit 0 |

All 24 harness TARGETS were backed up to `scratchpad/pre-gt63/` and md5'd
before the run; all 24 are identical after it. The ledger is committed WITH
this report; the build commit `542a5cb` excludes it.

```
guard-traps targeted 108/108 CAUGHT (ids 9 10 11 12 21 22 48 49 50 51 56 57 58 63 64 65 67 68 69 70 71 74 75 76 77 78 79 80 81 87 88 89 90 94 102 103 104 105 106 107 108 109 110 111 112 113 120 124 132 133 192 193 194 197 245 252 253 254 255 261 262 263 264 265 266 267 268 269 270 271 272 273 274 275 276 277 278 279 280 281 282 283 284 286 287 288 289 290), rotation 20 (ids 72 73 82 83 84 85 86 91 92 93 95 96 98 99 100 101 114 115 116 117), NOT RUN 176, last FULL run 8079186 2026-09-17T10:58:18.253Z
```
