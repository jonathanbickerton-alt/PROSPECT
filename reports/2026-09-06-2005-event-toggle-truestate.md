# REQ-D6-01 true-state: every consumer of the three event arrays

Generated: 2026-09-06 20:08 +0100 (UTC 2026-09-06 19:08)
Certifies: cb09643 (the state inventoried; NOTHING BUILT)
Repo: committed 48c168a, pushed (origin in sync) - report only
BASE: cb09643 - diff EMPTY. READ-ONLY: no source changed, no gate run.
  REFERENCES in src/: market 93, yield 39, pricing 38, mostly types and dep
  arrays. BEHAVIOURAL: 12 APPLY, ~14 DISPLAY/COUNT, 2 GROUPING, 9 PERSISTENCE,
  ~20 MUTATION.
THE PREDICATE IS MANDATORY AT 12 SITES: EIGHT in What-If (WhatIfTab 1132,
  1317, 1389, 1458, 1525, 1598, 1682, 1711), FOUR in Compare (scenarioHelper
  213, 342, 389, 453). appliedEventIds and zeroCoverageEventIds need NO
  separate treatment - both come from applyEventsToMonth, so 1132 reaches the
  KPI caption alone.
COLUMNS: Enabled APPENDS LAST on all three sheets (trap 119); absent =
  ENABLED, by the Retention_Linked precedent. NO shared base interface exists
  - one field declared three times, or a new base.
SURFACES: FIVE row renderers, only ONE shared - EventsSummaryTable, used by
  What-If AND Compare off one buildEventsSummaryRows. The four card tables are
  FOUR INLINE copies: a row toggle is four insertions.
COMPARE: the list reaches computeScenarioForFilter WHOLE and as RAW SHEET
  ROWS; nothing calls marketEventFromRow. There IS one site, named in the code
  - the worker's parseSheet, 'THE SHARED PARSE BOUNDARY' - but dropping there
  hides it from Compare's own panel; the engine is 4 edits. Step 3 and Overall
  Forecast read NONE.
TEN QUESTIONS FOR JON, unanswered - chiefly: does a disabled event still
  EXPORT? If not, disable+save is SILENT DELETION.

## Base check

`git diff --stat cb09643..HEAD -- src/ scripts/ test-data/ package.json` EMPTY.
HEAD at entry was `c186f0d`, the 2252 report commit. The STOP did not fire.

**Last gated commit: `cb09643`** — guard-traps 161/161, suite 59/59, anchors
172/172, i18n-parity 194/194.

**READ-ONLY. No source file was changed.** The only commits are this report's
skeleton and the report itself.

## Item 1 — every consumer

References per array, per file, in `src/`:

| file | market | yield | pricing |
|---|---|---|---|
| `components/WhatIfTab.tsx` | 70 | 23 | 22 |
| `App.tsx` | 5 | 4 | 4 |
| `utils/forecasting.ts` | 4 | 4 | 4 |
| `utils/viewFilter.ts` | 4 | 3 | 3 |
| `utils/scenarioHelper.ts` | 3 | 2 | 2 |
| `workers/scenarioParser.worker.ts` | 3 | 3 | 3 |
| `components/ScenarioCompareTab.tsx` | 2 | — | — |
| `components/ForecastSummaryBar.tsx` | 1 | — | — |
| `types/forecast.ts` | 1 | — | — |

Most are type declarations, props, destructures and dependency arrays. What
matters is the **behavioural** sites, classified below.

### (A) APPLY — the predicate is mandatory. **12 sites**

These decide whether an event moves a number. A disabled event that reaches any
of them still changes the forecast.

| # | site | array | what it does |
|---|---|---|---|
| 1 | `WhatIfTab.tsx:1132` | market | the main pass — `applicable` feeds `applyEventsToMonth`; also produces `appliedEventIds` / `zeroCoverageEventIds` |
| 2 | `WhatIfTab.tsx:1317` | yield | `applicableInflowYield` — the synthetic inflow yield pool |
| 3 | `WhatIfTab.tsx:1389` | market | the Inflow event pools (`p_eventPools`) |
| 4 | `WhatIfTab.tsx:1458` | market | the `promoRebanded` Retention pool |
| 5 | `WhatIfTab.tsx:1525` | yield | `applicableRetentionYield` |
| 6 | `WhatIfTab.tsx:1598` | pricing | the blended pricing pass |
| 7 | `WhatIfTab.tsx:1682` | market | `scenarioPools` — the per-scenario ARPU pools |
| 8 | `WhatIfTab.tsx:1711` | pricing | `pricingFor` — the per-scenario pricing |
| 9 | `scenarioHelper.ts:213` | market | Compare's apply |
| 10 | `scenarioHelper.ts:342` | yield | Compare's yield pool |
| 11 | `scenarioHelper.ts:389` | market | Compare's inflow pools |
| 12 | `scenarioHelper.ts:453` | pricing | Compare's pricing |

That is **8 in the What-If engine and 4 in Compare's second engine**. The
table is the count; the heading follows it, not the other way round — my first
draft of this heading said eleven while the table listed twelve.

**`appliedEventIds` and `zeroCoverageEventIds` need no separate treatment.**
Both are produced by `applyEventsToMonth` from the array site 1 hands it, so a
predicate at site 1 propagates to the KPI caption automatically
(`WhatIfTab.tsx:4481`-region memo reads `m.appliedEventIds`).

### (B) DISPLAY / COUNT — a decision is needed, the predicate may not be. **14 rows**

Rows, not sites: several cover two or three adjacent line numbers (a table's
empty state, its rows and its footer are one decision, not three).

| site | array | what it does |
|---|---|---|
| `WhatIfTab.tsx:2476` | all three | `buildEventsSummaryRows` — the events summary |
| `WhatIfTab.tsx:2884` | market | chart tooltip, this month |
| `WhatIfTab.tsx:2889` | yield | chart tooltip |
| `WhatIfTab.tsx:2893` | pricing | chart tooltip |
| `WhatIfTab.tsx:2799` | yield | the tier list the mix controls offer |
| `WhatIfTab.tsx:4481` | market | `retentionWarnings` — the over-outflow warning |
| `WhatIfTab.tsx:4905` | market | the chart's month markers |
| `WhatIfTab.tsx:5963/5968` | market | the Volume table's rows and empty state |
| `WhatIfTab.tsx:6308` | market | the "clear all" footer's visibility |
| `WhatIfTab.tsx:6911/6916/7073` | pricing | the Pricing table |
| `WhatIfTab.tsx:7855/7858` | market | the Promotion table |
| `WhatIfTab.tsx:8330/8335/8456` | yield | the Value table |
| `ForecastSummaryBar.tsx:26` | market | the "N events" badge |
| `ScenarioCompareTab.tsx:431` | market | whether the events panel renders at all |

### (C) GROUPING — **2 sites**

`WhatIfTab.tsx:3672` (`!isPromotion`) and `:3679` (`isPromotion`) both call
`groupByCampaign`. A campaign whose rows are all disabled is a question the
grouping does not currently ask.

### (D) PERSISTENCE — **9 sites, and none takes the predicate**

Export must write the flag; import must read it. Nothing here filters.

| site | what |
|---|---|
| `App.tsx:532` | `marketEventExportRow` per row, sorted by `bySequence` |
| `App.tsx:608` | `yieldEventExportRow` |
| `App.tsx:619` | `pricingEventExportRow` |
| `App.tsx:667-669` | the Metadata counts — three `.length` reads |
| `App.tsx:1047` | the session restore's `marketEvents: restoredEvents` |
| `forecasting.ts:1013-1015` | the three `…FromRow` mappers in the session parse |
| `forecasting.ts:1070` / `:1206` + `:1100` / `:1329` | the three readers (`pricingEventFromRow`, `marketEventFromRow` + `readStoredEventModifiers`, `yieldEventFromRow`) |

### (E) MUTATION — **no predicate.** ~20 sites

Add, edit, save-campaign, delete, clear, `nextSequence`, the pending-change
preview pair (`:3982`/`:3983`), the churn exclusion set (`:3163`, `:3193-3195`)
and the pricing self-exclusion (`:2989`). These build the next array; they do
not read a flag.

### Not consumers at all

**Step 3 (`ForecastVsActualsTab`) reads no event array**, and neither does the
Overall Forecast — the grep over `src/` returns them nowhere. Worth stating
because a reader would reasonably expect Step 3 to.

## Item 2 — the carriers

### Fields today

| carrier | type | shared optional field would sit… |
|---|---|---|
| `MarketEvent` | `types/forecast.ts` + `forecasting.ts` | beside `retentionLinked` / `amountType`, the existing behaviour flags |
| `YieldEvent` | `types/forecast.ts` | beside `rollForward` |
| `PricingEvent` | `types/forecast.ts` | beside `duration` |

There is **no shared base interface** for the three. A single `enabled?:
boolean` must be declared three times, or a shared `interface EventToggle`
introduced and extended — a decision, not a fact.

### The export sheets and where an `Enabled` column goes

**Appended last, on all three** — the rule trap 119 protects (a reader keys by
name; a human diffing two exports reads column order; inserting shifts
everything after it).

| sheet | current last columns | `Enabled` position |
|---|---|---|
| `Market_Events` | … `Promo_Mix_Locked`, `Arpu_Override`, `Promo_Band_ARPU_Override_JSON`, `Churn_*`, `Promo_Dilution_Current_Pct`, `Promo_Dilution_Target_Pct` | append |
| `Yield_Events` | … `Tariff_Mix_Locked`, `Tariff_Base_ARPU_Override_JSON`, `Comment` | append |
| `Pricing_Events` | … `Dilution_*`, `Priced_Vol`, `Total_Vol`, `Comment` | append |

**Old-workbook behaviour, per the `Amount_Type` precedent.** That reader is
`row.Amount_Type === 'percentage' ? 'percentage' : 'absolute'` — the absent
column takes the pre-existing behaviour. For `Enabled` the equivalent is
**`row.Enabled === 'No' ? false : true`**: an absent column means *enabled*,
which is what every existing save means. The `Retention_Linked` reader
(`=== 'No' ? false : true`) is the exact shape already in the file.

## Item 3 — the surfaces

**Five row renderers, four of them independent:**

| surface | implementation |
|---|---|
| events summary | **`EventsSummaryTable.tsx`** — ONE shared component, used by What-If **and** Compare, fed by the one `buildEventsSummaryRows` |
| Volume table | inline in `WhatIfTab.tsx:5968` |
| Value (yield) table | inline at `:8335` |
| Pricing table | inline at `:6916` |
| Promotion table | inline at `:7858` |

So the summary is shared and **the four card tables are four separate inline
implementations**. A toggle control in a row means four insertions, or a fifth
shared component.

**The campaign headers**: two byte-identical pills (`:6107` Volume, `:7839`
Promotion), already recorded as duplication in the 2252 report.

## Item 4 — Compare

**A session file's event list reaches `computeScenarioForFilter` whole**, and
as **raw sheet rows** — not typed events. `scenarioHelper.ts` reads
`e.Segment`, `e.Start_Month`, `e.Amount_Type` directly; nothing in Compare's
path calls `marketEventFromRow`.

**There IS one site**, and the code already names it as such —
`scenarioParser.worker.ts:42`, `parseSheet`:

> *"THE SHARED PARSE BOUNDARY. Every Compare consumer reads its rows from here
> — the chart series, the filter populate and the per-file events panels — so
> the placeholder skip belongs at this one point rather than in each of them."*

A disabled event dropped there disappears from Compare's engine, its dimension
filter (`viewFilter.ts`), its per-file events panel and its `length > 0` gate,
in one edit. The precedent for doing exactly that at this point already exists
(the placeholder skip).

**But dropping at the parser is a choice with a consequence**: Compare's
per-file panel would then be unable to *show* a disabled event at all. Dropping
in the engine instead means four edits (`scenarioHelper.ts:213/342/389/453`)
and leaves the panel free to list it greyed. That is Item 5's question, not a
finding.

## Item 5 — questions for Jon, listed not answered

1. **Does a disabled event count in "N events"?** Three counters disagree today
   by construction: the `ForecastSummaryBar` badge (`marketEvents.length`), the
   KPI caption (`appliedEventIds`, which already excludes out-of-scope events),
   and the Metadata sheet's three `.length` rows.
2. **Does a disabled promotion's row stay in both tables** (Volume and
   Promotion), greyed, or leave the Volume table?
3. **Does toggling reset the applied caption's memo?** The caption is derived
   from `appliedEventIds`, so it follows automatically *if* the predicate is at
   apply site 1 — but the memo's dependency array is the read-set, and a flag
   read elsewhere would need declaring (the D3-04 shape, paid for three times).
4. **Is a disabled event still exported?** If not, disabling then saving is
   silent deletion. If yes, an old app version opening that file applies it.
5. **Can a whole campaign be toggled**, or only rows? `groupByCampaign` has no
   notion of it, and the percentage bar already refuses group edit.
6. **Does a disabled event still show in the chart tooltip and the month
   markers** — three tooltip sites and one marker site.
7. **Does `retentionWarnings` warn about a disabled event?** It reads the raw
   array today.
8. **Compare: drop at the parser (one site, invisible) or the engine (four
   sites, listable-but-greyed)?**
9. **Does a disabled event still block anything** — e.g. the pricing
   self-exclusion, the churn exclusion set, `nextSequence`?
10. **Is the flag `enabled` or `disabled`?** The file's absence-carrier
    convention favours *absent means the old behaviour*, which points at
    `enabled?: boolean` defaulting true — but every other behaviour flag here
    is named for its positive state (`rollForward`, `retentionLinked`,
    `isPromotion`).

## Limits of this check

- **Counts are of references, not of semantics.** The per-file table counts
  every occurrence including types and dependency arrays; the classification
  into A–E is mine, from reading each site, and a site could be miscategorised
  without any check catching it.
- **Nothing was driven.** This is a source inventory. No mount, no fixture, no
  measurement of behaviour — so "site 1 propagates to the caption" is read from
  the code, not observed.
- **`scripts/` was not inventoried per the brief's Item 1 wording.** The specs
  construct their own event arrays; they consume the *functions*, not the app's
  arrays, so a predicate does not reach them — but a spec asserting counts will
  need updating and none of that is enumerated here.
- **The two engines were compared for site count, not for equivalence.**
  Whether Compare's four filters correspond one-to-one with What-If's eight is
  not established.
- **No decision was taken.** Item 5 is a question list; nothing in it is
  answered, and the flag's name, default and export behaviour are all open.
