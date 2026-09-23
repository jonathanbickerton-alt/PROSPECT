# REQ-D7-01 — Actuals Review: like-for-like coverage and the accuracy month — decisions recorded, inventory

## FOR ADVISOR

```
Generated: 2026-09-23 20:06 +0100 (UTC 2026-09-23 19:06)
Certifies: a497ff5 (src read; no src/scripts/spec change)
Repo: PENDING
Decisions commit: 9a169c5 (REQ-D7-01 1-3, committed alone before reading)
BASE NOT CLEAN: docs v3-3-18 deleted + v3-3-19 untracked (Jon's, left as is).
Fixture 2026-09-23-1839.xlsx ABSENT; no .xlsx is committed. Used the local
TariffHierarchy files (540 leaves; Corporate-Direct = 60), leaves fitted.
MEASURED 2026-03 Inflow: All/All chart actual 299,034 vs forecast 33,136;
covered leaves' actual 33,048. Corporate/Direct 33,048 vs 33,136.
Corporate row (Group-by Segment): actual 58,284 vs 33,136, dev 75.9%,
Inflow score 0.0; overall 38.3 (not 0). 6 months scored (Jan-Jun 2026).
FINDING 1: the forecast side is right on every surface - resolveForecast
derives over exactly the covered leaves. The ACTUALS side is not restricted.
FINDING 2: both restrictions already exist and are bypassed: chart
synActualsMap runs only when the seam returns null (FVA:2295); the table's
effectiveActualMap covers nothing, as its one "forecast" is the row's own
aggregate (FVA:717,795). resolveFromStore returns .leaves; Step 3 reads 0.
FINDING 3: the KPI cards are ALREADY like-for-like: per-leaf MAPE averaged
(2.7% Inflow here), pinned must-not-resolve (derive-aggregate GUARD 3).
FINDING 4: Base seed is the COVERED seed (289,211), not All's (2,600,863);
the step is the actual Base line (2,685,136). Recorded premise differs.
FINDING 5: the badge reads a global Step 2 wrote; any Step 3 filter change
clears it and nothing refills it (App:1918, WhatIfTab mounted only :4732).
COST: TWO sessions. Questions for Jon: 9, numbered in section 3.
full suite:  76/76 green
```

## 0. Base

Quoted before anything else:

- `git status --short` — **not empty**:
  ```
   D docs/PROSPECT-development-history-and-working-agreement-v3-3-18.md
  ?? docs/PROSPECT-development-history-and-working-agreement-v3-3-19.md
  ```
  These are uncommitted working-tree changes, not commits. I did not make them
  and left them untouched, unstaged and uncommitted. The brief expected
  `docs/` commits; this is a docs version swap that was never committed. No
  `src/` or `scripts/` file is involved, so it cannot affect a read-only
  inventory, and I proceeded rather than resolve it for you.
- `git diff a497ff5 HEAD --stat -- src` — empty.
- `git diff a497ff5 HEAD --stat -- scripts` —
  `scripts/guard-traps-ledger.json | 1438 +++++++++++++++-------------------`
  (the ledger only; from the a497ff5 FULL release gate).

HEAD and origin/main were both `f6b2fe4`. Skeleton `f447df6` first; decisions
`9a169c5`, committed alone and pushed before any file was read.

**The fixture.** `test-data/Walks/2026-09-23-1839.xlsx` is **absent** (the path is
gitignored, `.gitignore:43`). **No `.xlsx` fixture is committed**:
`git ls-files test-data` lists only `EXPECTED.md` and
`SCENARIO_PLANNING_BACKLOG.md` (`.gitignore:15` ignores `/test-data/*.xlsx`).
The two local Walks saves (01 and 02 Sep) hold 72 forecast cohorts across
every segment, so they do not match the session.

The nearest local fixture is
`VBU_IBRO_Synthetic_ForecastTest_TariffHierarchy_Jan2023_Jun2026.xlsx` (90,720
rows, 2023-01..2026-06, **540 leaves, 108 per segment, 60 of them
Corporate·Direct**), which is exactly the session's shape. Its forecasts were
built engine-direct, as described in section 1(b).

## 1. Inventory

### (a) What each surface builds, and over which leaf set

All in `src/components/ForecastVsActualsTab.tsx` (FVA) unless named.

**The chart** (`multiChartData`, FVA:2090-2486)

- *Forecast.* `specificForecast = cohortSpecificForecast ?? filterForecast`
  (FVA:2118).
  - With no row selected, the filter forecast is
    `resolveForecast(<view key>).forecast` (FVA:2116). This is the Step 2 seam
    (`App.tsx:1559-1569` → `resolveFromStore`, `forecasting.ts:4314`), which
    derives over **exactly the stored leaves under the key**.
  - With a row selected, it is the same seam at the row key (FVA:2106).
  - Only when the seam returns null does a **Step 3 copy** run. It scans the
    store (`forecastStore.entries()`, FVA:2172), dedupes, then calls
    `deriveAggregate` (FVA:2242) plus a hand-rolled ARPU weighting
    (FVA:2200-2290). That is a second aggregator, reached only on a seam miss.
- *Actual.* `getActBucket` (FVA:2370) reads `synActualsMap ?? actualsAggrMap`.
  - `actualsAggrMap` (FVA:1622-1728) filters rows by the **view** (`rowInScope`
    on `activeFilter`, FVA:1670), so at All/All that is **every row**.
  - `synActualsMap` (FVA:2294-2334) is restricted to the leaves the matched
    forecasts cover, the like-for-like set. But it returns null whenever
    `specificForecast` is set (FVA:2295), i.e. **whenever the seam answered**.
  - So on the seam path, which is the normal path, the actuals are the view's
    every leaf.
- *Base seed.* `fcSeedBase = specificForecast.seedBaseVolume` (FVA:2139), then
  the recursion in `fcBaseMap` (FVA:2336). For a derived forecast,
  `deriveAggregate` sums the **covered** leaves' seeds (measured in (b)). The
  Base actual comes from the same unrestricted bucket as the flows.

**The four KPI cards** (`summaryMape`, FVA:2546-2615, and the four ARPU cards
beside them)

- *Forecast.* It iterates `forecastStore.values()` (FVA:2572), keeping each
  **stored leaf** whose cohort is in the view (`cohortInScope`, FVA:2573). This
  deliberately bypasses the seam: `derive-aggregate-spec.ts:426,451` (GUARD 3)
  pins that summaryMape must not resolve, because it averages per-leaf MAPEs.
- *Actual.* `computeForecastMape` (FVA:220-392) filters rows to **that leaf's
  own cohort** (`rowInScope(row, …, bf.cohort)`, FVA:254).
- **So the cards are already like-for-like**, leaf by leaf, and then averaged
  unweighted (`avg`, FVA:2594-2597).
- *Base.* Each leaf's own seed (FVA:314).

**The cohort table** (`buildCohortAccuracy`, FVA:603-1507, via `cohortAccuracy`
FVA:2016; the Challenger tab calls it again at FVA:2622)

- *Actual.* It merges every leaf in `cohortActualsMap` (FVA:1730, unfiltered, one
  entry per leaf) into its Group-by key (FVA:620-640). The Corporate row is
  therefore all 108 Corporate leaves.
- *Forecast.* `resolveForecast(<row key>).forecast` (FVA:698), the seam. It is
  the only tier, so `matchingBfs = [thatOneForecast]` (FVA:717). Bands then come
  from `deriveAggregate(matchingBfs, …)` (FVA:911).
- *The restriction that exists and does nothing.*
  - `effectiveActualMap` (FVA:786-832) keeps an actuals leaf only if some
    `matchingBfs` cohort covers it (FVA:795).
  - The only member is the **row's own derived aggregate**, whose cohort is the
    row's scope (e.g. Corporate/All/All/All/All/All/All, measured). So every
    Corporate leaf is "covered", and the restriction is vacuous.
  - It stopped working when the multi-candidate tier was deleted (the Tier 2
    comment, FVA:700-716).
- *Base.* `cohortBaseBandMap` (FVA:938-968) seeds from the derived aggregate,
  i.e. the covered leaves. The actual Base comes from the vacuous
  `effectiveActualMap` (FVA:875-882).

**Second aggregators in Step 3:**

- The chart's seam-miss branch (FVA:2166-2297).
- summaryMape's store scan (FVA:2572, pinned intentional).
- Two `deriveAggregate` calls (FVA:911, FVA:2242), both over seam-selected or
  scan-selected leaves.

The table uses the seam's output, then re-derives from the one resolved
forecast (FVA:911). That is an identity derivation, not a second leaf sum.

**Dead memo:** `accuracy` (FVA:2506-2533) has no reader. `\baccuracy\b` occurs
18 times in the file: the definition plus comment and JSX text; none reads it.

### (b) Measured, engine-direct, 2026-03

Script: `scratchpad/s92-measure.tsx` (read-only, stdout only).

**How the forecasts were built.**

- The 60 Corporate·Direct leaves were fitted on the Dec2025 file
  (2023-01..2025-12): Holt Linear, horizon 12 (2026-01..2026-12), seed = the
  leaf's latest Base reading. 60 of 60 fitted.
- The series are a harness build (IBRO sums, revenue/subs ARPU), **not** the app
  worker's builder. So the forecast digits are indicative; the actual sums are
  exact.
- The roll-up index was built from the Jun2026 data, as App builds
  `populatedCohorts` (`App.tsx:1529`).
- The seam is `resolveFromStore` itself. The table figures come from the
  exported `buildCohortAccuracy`, fed a `cohortActualsMap` transcribed from the
  component's memo (FVA:1730-1802).

| where | actual Inflow | forecast Inflow | note |
|---|---|---|---|
| All/All chart | **299,034** (every row) | **33,136** | resolve → derived, 60 leaves |
| All/All, covered leaves only | 33,048 | 33,136 | the like-for-like pair |
| Corporate/Direct chart | 33,048 | 33,136 | already aligned: view = coverage |
| Corporate row, Group-by Segment | **58,284** (all 108 Corporate leaves) | **33,136** | dev +75.9%, month score 0.0 |

- **Corporate row score:** Inflow score **0.0**, overall score **38.3** (so not
  0 overall), scored over **2026-01..2026-06**.
- **The other four segments** show the em dash (`noForecast`).
- **KPI cards at All/All:**

  | card | MAPE |
  |---|---|
  | Inflow | 2.7% |
  | Outflow | 1.1% |
  | Retention | 3.2% |
  | Base | 1.0% |

  These are over 60 forecasts, `monthsWithActuals` 360 (60 × 6).

**Base at All/All.**

| quantity | value |
|---|---|
| Forecast seed | 289,211 (`seedBaseKnown` true) |
| Actual Base 2025-12, every row | 2,600,863 |
| Actual Base 2025-12, covered leaves | 289,211 |
| Actual Base 2026-03, every row | 2,685,136 |
| Actual Base 2026-03, covered leaves | 296,883 |

**The forecast Base continues from the COVERED seed, not the All seed.** The step
a reader sees is the unrestricted actual Base line (~2.6-2.7M) above a
covered-leaf forecast (~0.29M). The recorded text says the reverse; see
question 3.

### (c) The "Using Adjusted Forecast" badge

- **What it reads.** `usingAdjusted = !!adjustedForecast` (FVA:1614), rendered at
  FVA:2989-2991. The global is written by WhatIfTab's effect
  (`WhatIfTab.tsx:6222-6232`) whenever it has a `baseForecast` and a non-empty
  `adjustedMonths`. That holds whenever the engine ran: `computeAdjustedForecast`
  empties only without a base (`WhatIfTab.tsx:1409`). **Events applying is not
  the condition.**
- **Why the two views differ.**
  - WhatIfTab is mounted only on Step 2 (`App.tsx:4732`).
  - A Step 3 filter change sets `adjustedForecast` to null (`App.tsx:1918`).
  - Switching tabs refreshes `baseForecast` but not `adjustedForecast`
    (`App.tsx:1920-1929`).
- **So** All/All shows the badge because Step 2 last wrote it and Step 3's filter
  had not changed. Choosing Corporate/Direct on Step 3 cleared it, and nothing
  on Step 3 can refill it.
- **A second consequence (hazard).** Until a Step 3 filter change, Step 3 carries
  an adjusted forecast built for **Step 2's** view. The Adjusted scoring toggle
  (`adjustedMeanMap`, FVA:1998-2010) would score Step 3's view against it.
- NOT MEASURED in a mount; established by reading the four sites above.

### (d) The Step 2 Delta-month selector

- **Component:** none. It is an inline native `<select>` in WhatIfTab
  (`WhatIfTab.tsx:6694-6711`, `data-testid="delta-month-select"`), under the
  `whatif_delta_month` label.
- **State:** `selectedDeltaMonth`, `useState('')` (`:2623`). The month read is
  **derived**: the choice while it is offered, else the last option
  (`:6270-6272`). No effect writes state, so a remount resets it.
- **Month list:** `adjustedMonths` minus `monthsCarryingActuals(...)`
  (`:6248-6258`; helper `forecasting.ts:5319`). That is forecast months
  **without** actuals, chronological.
- **What a Step 3 twin reuses:**
  - `monthsCarryingActuals` (its doc comment names it as not Step 3's question
    today, `forecasting.ts:5310-5317`);
  - the derived-default pattern;
  - `monthLabel`;
  - the native-select markup as a pattern.
- **What it cannot reuse:**
  - the markup itself, which is not a component;
  - its option list: Step 3 wants the **opposite** set, months carrying
    **both**;
  - `adjustedMonths`: Step 3 has no engine run of its own (see (c)). Its
    forecast months come from the resolved forecast's `months`.
- **Mounted pin:** only `view-apply-mounted-spec.tsx` reads the testid (3
  occurrences).

### (e) Which months are scored today

- **Cohort table:** `forecastMonths` = the resolved forecast's months ∩ months
  present in `effectiveActualMap` (FVA:842-845). That is **every overlap month**
  (6 in (b)). Each component averages its per-month scores (FVA:1310-1360).
  - Bias uses the same months.
  - Trend needs at least 6 deviations and compares the last 3 against the
    prior 3 (FVA:1155 and FVA:1389).
- **KPI cards:** each leaf's MAPE over **every** forecast month with actuals
  (`withActuals`, FVA:364), then averaged across leaves. The "{n} cohort-months
  compared" line sums across leaves (FVA:2609; pinned by `coverage-copy-spec`).
- **"The latest month carrying both" is derivable.** Take
  `monthsCarryingActuals(data, [wiDateCol], wiValueCol)` ∩ the resolved
  forecast's months, and use the max. No new predicate is needed.
- **To score one month:**
  - Table: filter `forecastMonths` to `[m]`, one parameter on
    `buildCohortAccuracy`.
  - Cards: filter `withActuals` to `[m]`, one parameter on
    `computeForecastMape`.
  - Everything downstream already averages whatever months it is given.
  - Trend then has 1 point and reads "insufficient" unless it keeps its own
    window (question 4).

### (f) Where the covered-leaf set comes from

**Without a new predicate:** `resolveFromStore` already returns it. `leaves` is
the exact list of stored leaf forecasts a derived forecast is summed from
(`forecasting.ts:4332-4358`, and exposed by `App.tsx:1559-1569`).

- For a **stored** forecast `leaves` is `[]`, and the covered set is the key
  itself, a leaf.
- Each `bf.cohort` gives the 7-part leaf key that `cohortActualsMap` is keyed
  by.
- **Step 3 reads `.leaves` 0 times.** All 4 of its `resolveForecast(` calls take
  `.forecast` only (FVA:698, 2106, 2116, 2707). `buildCohortAccuracy`'s
  `resolveForecast` parameter type omits `leaves` (FVA:616).

**Existing Step 3 copies of the question**, each a rebuild of what `.leaves`
already says:

- `synActualsMap`'s coverage test (FVA:2306-2318);
- `effectiveActualMap`'s coverage test (FVA:795).

`eventScopeMatchesView` (`forecasting.ts:724`) answers whether an **event** is
scoped over a **view**. It is not a leaf-coverage question and should not be
bent into one. `cohortInScope` / `rowInScope` (`cohortScope.ts:121,146`) are the
shared scope predicates. A covered set built from `.leaves` needs only an
exact-key `Set.has`.

### (g) Cost

**TWO sessions.**

**Session 1 — like-for-like on the chart and the table, and the coverage line.**

- *Scope:*
  - One helper turns a seam result into its covered leaf-key set (`.leaves`,
    or the stored key).
  - The chart's actual bucket restricts to that set on the seam path, i.e.
    `synActualsMap`'s filter driven by `.leaves` for every `specificForecast`.
    This covers the selected-row state too.
  - `effectiveActualMap` restricts to that set.
  - Base actual follows the flows.
  - The coverage line on the chart and the table ("forecast covers 60 of 540
    cohorts").
  - The cards need only the coverage line if question 1 keeps them.
  - The chart's seam-miss second aggregator (FVA:2166-2297) and the dead
    `accuracy` memo are candidates for removal, but only if you want that in
    this session.
- *Never-shed:*
  - At All/All in 2026-03 the chart's actual Inflow is the covered 33,048
    against 33,136, not 299,034.
  - The Corporate row scores 33,048 against 33,136, not 58,284.
  - Both come from `.leaves`, with no new predicate and no second aggregator.
- *Shed candidate:* the coverage line's per-row form in the table.

**Session 2 — the accuracy month.**

- *Scope:*
  - A Step 3 month select (the derived-default pattern), options = months
    carrying both.
  - Default the latest such month.
  - `buildCohortAccuracy` and `computeForecastMape` take the month.
  - The chart is untouched.
- *Never-shed:* the cards and the table score exactly the chosen month, and the
  default is the latest month carrying both.
- *Shed candidate:* none. It is one select and two parameters.

**Pins that move and specs expected red** (not run against a build; expected
from reading):

| session | spec / pin | why |
|---|---|---|
| 1 | `unscored-row-spec` (Case B pair) / guard-traps 9, 10 | they pin the chart's fallback guard beside the path being changed |
| 1 | `leaf-grain-spec` :166-212, `trigger-sets-spec` | they call `buildCohortAccuracy`. Rows with partial coverage change score; NOT MEASURED which on their fixtures |
| 1 | `regression-traps.tsx` (trap A: `actualsAggrMap` / `computeForecastMape` tariff scoping) | only if the edit touches those predicates |
| 1 | `derive-aggregate-spec` GUARD 3 (:451) | **only if question 1 = the aggregate's MAPE** |
| 1 | `step3-transition-spec`, `base-seed-spec` | they read the chart's Base; the Base actual moves |
| 1 | `trap-anchors` | 7 traps anchor in FVA (`file: FILE`, guard-traps.ts:46); any on an edited line ages out |
| 1, 2 | `i18n-parity` / `i18n-scan` | new keys: the coverage line, the month label |
| 2 | `coverage-copy-spec` :48-62 | pins `monthsWithActuals` as a cohort-months sum; it becomes a leaf count for one month |
| 2 | `edge-fixture-spec`, `derive-aggregate-spec` (they call `computeForecastMape`) | only if its signature changes positionally |
| 2 | Trend cells in any mounted spec | 1 month → "insufficient", per question 4 |

## 2. What the three decisions settle

- **(A) is buildable without a new predicate.** The seam already reports its own
  covered leaves.
- **The forecast side needs no change on any surface.**
- **The cards already meet (A) leaf by leaf.**
- **The selector reuses** `monthsCarryingActuals` and the Delta-month default
  pattern.

## 3. Questions for Jon

1. **The KPI cards.** They are already like-for-like: each stored leaf's actuals
   against that leaf's forecast, MAPEs averaged unweighted (2.7% Inflow at
   All/All here). That rule is pinned (`derive-aggregate-spec` GUARD 3: "scoring
   one derived aggregate is a different quantity, not a better one"). Should the
   cards **keep** the per-leaf average and gain only the coverage line? Or should
   they **become** the aggregate's MAPE, covered actuals against the derived
   forecast, which lifts GUARD 3?
2. **The coverage line's count.** At a view or row, is the denominator the
   leaves with actuals under it? For example "60 of 540" at All/All, "60 of 108"
   on the Corporate row, and "60 of 60" at Corporate/Direct. And should the line
   show at all when coverage is complete (Corporate/Direct), or only when it is
   partial?
3. **Base.** The recorded finding says Base continues from the All seed.
   Measured, the forecast Base starts from the **covered** leaves' seed (289,211
   against All's 2,600,863). The visible step is the **actual** Base line, which
   covers every leaf. Is the finding to be corrected in EXPECTED.md? And should
   the actual Base be restricted to the covered leaves exactly as the flows are,
   with no separate rule?
4. **Trend under the accuracy month.** Trend compares the last 3 months'
   deviation with the prior 3 and needs at least 6. With one month scored it
   would read "insufficient" on every row. Should Trend keep its own window (all
   overlap months up to the chosen month), or follow the chosen month?
   Separately: should Bias be the chosen month's sign only?
5. **The default month's scope.** Is "the latest month carrying both actuals and
   forecast" per view (the covered leaves' months) or dataset-wide? They differ
   when the view's leaves lack a month the rest of the file has.
6. **The KPI cards' "{n} cohort-months compared".** Scoring one month, n becomes
   the number of leaves scored in that month (60). Should the label change to
   say that, or is the month named elsewhere enough?
7. **The badge and the Adjusted scoring toggle.** Both read the global adjusted
   forecast Step 3 inherits from Step 2's view. Any Step 3 filter change clears
   it, and nothing on Step 3 recomputes it. Is making Step 3 compute its own
   adjusted forecast for its view (or hide both when the adjusted forecast is
   not for its view) in REQ-D7-01's scope, or a separate item?
8. **The AutoML Challenger tab.** It calls the same table builder
   (FVA:2622-2624). Its "action required" set is `avgMape > 5%` over rows scored
   against unrestricted actuals. Does (A) apply there too, which moves which
   cohorts are flagged, and does the accuracy month?
9. **The seam-miss chart branch.** FVA:2166-2297 is a second aggregator (store
   scan + `deriveAggregate` + its own ARPU weighting), reached only when
   `resolveForecast` returns null. Delete it in session 1 (a miss then charts
   actuals only, as the table already shows an em dash), or leave it for a
   separate item?

## 4. Gate

- `npm run suite`: **76/76 green** (to `scratchpad/suite-1855.txt`).
- `npx tsc --noEmit`: clean (exit 0, no output).
- `git status --short` after the report: this report, plus the two docs entries that were already there at base (section 0). `EXPECTED.md` is not listed because it was committed alone in 9a169c5. No src, scripts or spec file was touched.

## Limits

- The forecasts were fitted by a harness series builder, not the app worker, on
  a local fixture standing in for the absent walk file. The forecast digits are
  indicative; the actual sums and the coverage relationships are exact.
- The table figures used a `cohortActualsMap` transcribed from the component's
  memo, because that memo is not exported.
- The badge analysis (c) is by reading; it was not mounted.
- "Expected red" in (g) is from reading, not a build.
