# REQ-D7-02 — Step 3 scope: one viewing bar; the Adjusted badge and toggle — decision recorded, inventory

## FOR ADVISOR

```
Generated: 2026-09-24 12:59 +0100 (UTC 2026-09-24 11:59)
Certifies: f30f67f (src read; no src/scripts/spec change)
Repo: PENDING
Decision commit: 5f5c87f (REQ-D7-02 1-2, committed alone before reading).
BASE: the v3.3.19 docs commit is NOT in HEAD - still uncommitted (v3-3-18
D, v3-3-19 ??), left untouched. src empty, scripts the ledger only.
FINDING 1: the COMPARING bar holds NO scope of its own. Its x chips call
onCohortFilterChange = App's handleStep3FilterChange (App:4813-4814), the
viewing bar's own setter. Step 3 has ONE scope state (step3Filter) already.
FINDING 2: it renders when ANY dim is set (FVA:2851-2857,2958), so it SHOWS
at Corporate/Direct and HIDES at All/All. Screenshots: NOT MEASURED here.
FINDING 3: added in the initial commit f52b21d; conditional form 432837d.
Unreported: no report or doc names it. No spec or trap pins it (0 files).
FINDING 4: three OTHER Step 3 writers move the viewing bar: row click
(FVA:3547) - can WIDEN it (Group-by Segment at Corporate/Direct writes
Corporate/All) - row deselect (:3565) and Drilled-into Clear (:3112),
which both reset it to All/All (:3112 also drops tariff).
FINDING 5: the badge = !!adjustedForecast (FVA:1613), a global written by
Step 2 only while mounted (WhatIf:6222-6228, App:4732) for ITS view, with
or without events; any Step 3 scope write clears it (App:1918); session
load rebuilds it keyed to the file's FIRST stored forecast (App:1068-1097).
FINDING 6: Step 3 receives no events (0 refs), so a per-view adjusted
forecast needs them passed in; viewSeam can only answer "was Step 2's for
this view" by key equality - no new predicate.
COST: ONE session (option A) or TWO (option B). Questions: 7, section 3.
full suite:  78/78 green
```

## 0. Base

Quoted before anything else:

- `git status --short` — **not empty**:
  ```
   D docs/PROSPECT-development-history-and-working-agreement-v3-3-18.md
  ?? docs/PROSPECT-development-history-and-working-agreement-v3-3-19.md
  ```
  The brief expected the v3.3.19 docs commit to be in HEAD. It is not: HEAD is
  `c7ed288` (the 1049 report) and `git log` holds no docs commit since. The swap
  is still uncommitted working-tree state. I left it untouched, unstaged and
  uncommitted, and proceeded because this session writes no src or scripts.
- `git diff f30f67f HEAD --stat -- src` — empty.
- `git diff f30f67f HEAD --stat -- scripts` —
  `scripts/guard-traps-ledger.json | 226 +++++++++++++-----------` (the ledger
  only).

Skeleton `17b5a68` came first; the decision was committed alone as `5f5c87f`
and pushed before any file was read.

## 1. Inventory

All in `src/components/ForecastVsActualsTab.tsx` (FVA) unless named.

### (a) The COMPARING bar

**Component:** there is none. It is an inline block in FVA:2954-2990 (the
"Active filter bar"), inside the Forecast vs Actuals sub-view.

- **Testids:** none. It is identifiable only by its keys: `actuals_comparing`
  (the "Comparing" label, :2960) and
  `actuals_actuals_filtered_to_match_forecast_scope_like` (the italic note,
  :2988).
- **Chips:** they come from `activeDims` (:2851-2856): Segment, Product,
  Channel, and Tariff when `activeFilter.tariff` exists.
  - A chip is *active* when its dimension is narrowed: segment ≠ 'All', or the
    product, channel or tariff L1 is set.

**History (`git log -S`).**

- The "COMPARING chips" block is in the **initial commit `f52b21d`**
  (2026-03-30).
- Its current conditional form (`hasActiveFilterDims`) arrived in **`432837d`**
  (2026-06-18, "Remove AI capability from main ahead of prod deployment…").
- The keys were extracted in `771f26f` (i18n phase 1, 2026-07-28).
- **No report or doc describes it:** `grep` over `reports/` and `docs/` finds
  nothing. **Unreported.**

**When it renders:** `{hasActiveFilterDims && (…)}` (:2958), where
`hasActiveFilterDims = activeDims.some(d => d.active)` (:2857).

- It **shows whenever any dimension is narrowed**, so it shows at
  Corporate/Direct.
- It **hides at All/All**, where every chip is inactive.
- The whole tab also returns an empty "No forecast loaded" screen when there is
  no `baseForecast` (:2817).

**The 23 Sep screenshots.** By the code, a Corporate/Direct view with a forecast
shows the bar and All/All does not. I have not seen the screenshots, so why they
show none at Corporate/Direct is **NOT MEASURED**. It would fit a view with no
forecast loaded (:2817), or screenshots taken at All/All. It would not fit
Corporate/Direct with a forecast.

**What the × chips write.** A chip click builds `{ ...activeFilter, <dim>: All }`
and calls `onCohortFilterChange(next)` (:2966-2974). App wires that prop to
**`handleStep3FilterChange`** (`App.tsx:4813-4814`), which is **the viewing
bar's own `onChange`** on Step 3 (`App.tsx:4581`). It:

- sets `step3Filter`;
- resolves and sets `baseForecast`;
- clears `adjustedForecast` (`App.tsx:1910-1919`).

**So the chips narrow nothing separately:** they clear a dimension of the one
viewing-bar state.

**Every reader of that state.** `activeFilter` is `step3Filter` (46 references
in FVA). Its readers are:

- `actualsAggrMap` (:1648-1672);
- `summaryMape`, the cards (:2437ff);
- `viewSeam`, which feeds the chart (through `chartSeam`), the month options
  and the coverage line;
- the Case B fallback guard in the chart;
- the "no actuals for this combination" notice (:2993-3008);
- `activeDims` itself.

**Two readers do not follow the viewing bar:**

- The **cohort table** and the **Challenger** read `cohortActualsMap`
  (unfiltered), grouped by their own Group-by checkboxes. Scope comes into the
  table only through the resolved forecast per row.
- The **Adjusted flag** is cleared by any write to the state
  (`App.tsx:1918`).

**There is no Step-3-only scope state.**

### (b) Removing it

- **What Step 3 reads afterwards:** exactly what it reads now, `activeFilter` =
  `step3Filter`, set by the viewing bar. Removing the bar removes one set of
  per-dimension clear buttons over that same state.
- **What goes dead:** `activeDims`, `hasActiveFilterDims` and the `ActiveDim`
  type (:2847-2857). `productDisplayStr` (:2841) stays: the no-actuals notice
  reads it (:3003-3004). The two keys `actuals_comparing` and
  `actuals_actuals_filtered_to_match_forecast_scope_like` become unread in
  `src`, to be retired from six locales, as `actuals_cohort_months_compared`
  was in 1049.
- **No reader keeps a Step-3-only scope**, so nothing else goes dead.
- **Specs that pin it: none.** `grep` over `scripts/` finds no reference to
  `actuals_comparing`, `hasActiveFilterDims`, `activeDims`, "COMPARING" or the
  note key. No guard-trap anchors on it, and no spec passes
  `onCohortFilterChange`. **Nothing goes red on removal.** A new absence pin
  would be the only guard.

**Decision 1 also reaches three other Step 3 writers of the same state** (see
question 1):

- **Row click** (:3538-3560) writes the viewing bar to the clicked row's
  dimensions only, taken from the table's own Group-by. It replaces the view
  rather than narrowing within it: at Corporate/Direct under Group-by Segment,
  clicking the Corporate row writes **Corporate/All/All**, widening the view.
- **Row deselect** (:3563-3565) writes All/All.
- **The "Drilled into" Clear** (:3108-3113) writes All/All **without a `tariff`
  key**.

**All three clear the Adjusted flag** (they go through
`handleStep3FilterChange`).

### (c) The badge and the toggle

**What they read.**

- The badge is `usingAdjusted = !!adjustedForecast` (FVA:1613, rendered at
  :2884).
- The toggle is `useAdjustedScoring` (:1522, set at :3439). It builds
  `adjustedMeanMap` from `adjustedForecast.adjustedMonths` (:1997), which the
  table and the cards score against.

**Who writes the global** (`App.tsx:1270`, context):

1. **Step 2 only, while mounted.** WhatIfTab's effect writes
   `{ base: baseForecast, marketEvents, adjustedMonths }` whenever it has a
   `baseForecast` and a non-empty `adjustedMonths` (`WhatIfTab.tsx:6217-6229`).
   - `adjustedMonths` is empty only without a base
     (`WhatIfTab.tsx:1409`), so this happens **with or without events**. It is
     implicitly keyed to **Step 2's view**, because `base` is Step 2's
     forecast.
   - WhatIfTab renders only on Step 2 (`App.tsx:4732`), so nothing on Step 3
     can write it.
2. **Session load** (`App.tsx:1063-1112`) rebuilds it from the file's
   Adjusted_Forecasts sheet. `base` is a `bfRef` rebuilt from **the FIRST typed
   stored forecast in the file** (`typedRows[0]`, `App.tsx:1068-1070`), not the
   view the adjusted forecast was computed for.
3. **Cleared** on any Step 2 or Step 3 scope write (`App.tsx:1906`, `:1918`)
   and on a Step 1 selection (`:2194`). A tab switch does **not** clear it: the
   switch effect sets `baseForecast` only (`App.tsx:1920-1929`).

**Why All/All shows it and Corporate/Direct does not** (by reading; the 18:39
session itself is NOT MEASURED):

- Step 2 at All/All wrote the global. The user moved to Step 3, whose filter was
  still All/All, so the badge showed.
- Choosing Corporate/Direct on Step 3 cleared it (`App.tsx:1918`), and nothing
  on Step 3 can refill it.
- **The badge therefore tracks "Step 2 last wrote and Step 3's scope has not
  moved since"**, not whether events adjust the view on screen.
- **Hazard:** the same global drives the Adjusted toggle, which then scores
  Step 3's view against Step 2's view's adjusted means.

**What a per-view answer needs.** `viewSeam` (FVA) holds Step 3's view key and
its seam answer. There are two readings of decision 2:

- **(A) "Was the adjusted forecast built for THIS view?"** `viewSeam` can
  answer this with **no new predicate**: key equality,
  `makeForecastKey(adjustedForecast.base.cohort…) === viewSeam.key`.
  - Object identity would not work: `resolveForecast` derives a fresh object on
    every call, so `===` fails for aggregates.
  - The badge and toggle would show only when Step 2's last adjusted forecast is
    for Step 3's exact view, and be hidden otherwise.
  - Cost: small. There is no engine change, and `computeAdjustedForecast` stays
    at 6.
  - The session-load key has to be fixed too (`typedRows[0]` names the wrong
    cohort; question 5).
- **(B) "The adjusted forecast for THIS view,"** computed on Step 3 whatever
  Step 2 last showed. `viewSeam` cannot answer this.
  - Step 3 would run `computeAdjustedForecast` itself: a **7th** engine site,
    fed its own view's forecast and the event arrays.
  - FVA receives **no events today** (0 references to `marketEvents`,
    `yieldEvents` or `pricingEvents`; App passes none, `App.tsx:4786-4815`), so
    they would have to reach it by prop or context.

### (d) Cost

**Decision 1 (remove the bar)**

- Small: one block, three dead declarations, two keys retired in six locales.
  **Nothing re-aims**; one absence pin is added.
- If question 1 also removes or changes the row-click writers, that adds the
  row-click, deselect and Clear paths plus their mounted cases. The table's
  selected-row chart state (`chartSeam`'s row branch) is unaffected, because it
  reads the row, not the filter.

**Decision 2**

- **Option A:** one key-equality gate over the badge and the toggle, plus the
  session-load key. A mounted case for each of: Step 2 at All/All → Step 3
  All/All (shown), then Corporate/Direct (hidden); session load at a view.
- **Option B:** a 7th engine site on Step 3, events passed to FVA,
  `adjustedMeanMap` built from Step 3's own run, and the badge gated on that run.
  The `computeAdjustedForecast` pin moves 6 → 7.

**Sessions:**

- **ONE** covers decision 1 plus option A.
- **TWO** if option B: decision 1 and the gate first, then Step 3's own adjusted
  run.

**Never-shed:**

- Session 1: the COMPARING bar is gone, Step 3's scope is only the viewing bar,
  and the badge and toggle never show for a view other than the one on screen.
- Session 2 (option B only): the badge and toggle show the adjusted forecast OF
  the view on screen.

**Pins that move:**

- **Decision 1:** none existing.
- **Option A:** none existing. `accuracy-month`'s structure pin names
  `adjustedMeanMap` in the builder call, so it moves only if that argument
  changes.
- **Option B:** every `computeAdjustedForecast` count (6 → 7) in the reports'
  exact-count tables and specs. The `accuracy-month` builder-call pin moves if
  `adjustedMeanMap` changes source.

**Specs expected red:** none on removal. Under option B, any spec asserting 6
engine sites. Under either option, the new mounted cases start red by
construction.

## 2. What the decision settles

- **Step 3 already has one scope state.** Decision 1 removes a second set of
  controls over it, not a second scope. That is cheap and pins nothing.
- **Decision 2's reading is the real choice** (question 3). It decides between a
  gate (one session) and a Step 3 engine run (two).

## 3. Questions for Jon

1. **Row click, deselect and "Drilled into" Clear** also move the viewing bar
   from Step 3. Row click replaces the view with the row's dimensions and can
   widen it (Corporate/Direct → Corporate/All under Group-by Segment). Deselect
   and Clear reset it to All/All; Clear also drops tariff. Under decision 1
   ("nothing on Step 3 narrows or clears it separately"), should a row click
   still move the viewing bar at all? Or should it only select the row, with the
   chart and table showing the row and the viewing bar left alone?
2. **If row click keeps moving the bar:** should deselect and Clear return to
   the view the user had before the click, rather than All/All? And should row
   click narrow WITHIN the current view instead of replacing it?
3. **Decision 2's meaning.**
   - **(A)** Show the badge and toggle only when the adjusted forecast was built
     for exactly the view on screen, and hide them otherwise: one session, no
     engine change.
   - **(B)** Step 3 computes the adjusted forecast for its own view, so the
     badge and toggle always describe it: two sessions, a 7th engine site,
     events passed to Step 3.
4. **The badge with no events.** Step 2 writes an "adjusted" forecast even with
   zero events, or with none touching the view, so the badge reads "Using
   Adjusted Forecast" over numbers identical to the baseline. Should the badge
   require at least one enabled event that applies to the view?
5. **Session load.** A restored adjusted forecast is keyed to the file's first
   stored forecast, not the view it was computed for. Under (A) it would then
   show at the wrong view or none. Should the export record the view's key, and
   the load use it? Or should a loaded session simply start with no adjusted
   forecast until Step 2 is visited?
6. **The toggle when the view is not covered.** Under (A), should the toggle be
   hidden with the badge, or shown disabled with a reason ("no adjusted forecast
   for this view — open Step 2 at this view")?
7. **The retired keys.** Removing the bar leaves `actuals_comparing` and
   `actuals_actuals_filtered_to_match_forecast_scope_like` unread. Should they
   be retired from all six locales in the same session, as
   `actuals_cohort_months_compared` was?

## 4. Gate

- `npm run suite`: **78/78 green**.
- `npx tsc --noEmit`: clean (exit 0, no output).
- `git status --short` after the report: this report, plus the two docs entries already present at base (section 0). `EXPECTED.md` does not appear because it was committed alone in `5f5c87f`. No src, scripts or spec file was touched.

## Limits

- Read-only. Everything above is by reading, with file:line references; no
  mount was run.
- The 23 Sep screenshots and the 18:39 session were not available. Where the
  brief asks why they show what they show, the answer is the code's rule, marked
  NOT MEASURED.
