# Delta-month selector and a Revenue card — read-only inventory

```
FOR ADVISOR
Generated: 2026-09-09 09:39 +0100 (UTC 2026-09-09 08:39)
Certifies: de66add (read-only; nothing committed but this report)

BASE de66add + 55ff125 (reports/ ONLY; ZERO drift in gated paths). Proceeded.
1 END OF PERIOD = LAST FORECAST MONTH, never the chart window: Base :4501,
  ARPU :4554/5, same month (one .map :1269). Horizon FIXED 24 (App:162, NO
  setter); the 6/12/18/24 buttons :4907 drive ONLY the <Brush> :5053.
2 BOTH DELTAS ARE ALREADY PER-MONTH LOOKUPS: Base = two 2dp columns :1844-45;
  ARPU = unrounded scenarioArpu[k].arpu :4557 vs band mean :4558 (e5f1e79).
3 REVENUE EXISTS PER MONTH PER SCENARIO, both halves (perScenarioColumns
  :940-969, 2dp); adjusted unrounded = scenarioArpu[k].revenue, BASELINE not.
4 NO "HAS ACTUALS" FACT ANYWHERE: actuals APPEND INTO `data` App:411, the only
  test is the modal's non-blank non-zero App:366-381, Step 3 rebuilds it
  (FvA:786/:845), WhatIfTab NEVER reads them. Inside the horizon; no prefix.
5 Base = STOCK at M and LAGGED (:1278 uses M-1 flows; pools :1827). Inflow/
  Outflow/Retention = FLOWS in M. Revenue = rate x that row's own volume.
6 "(end of period)" is BAKED INTO BOTH TITLES (en:288/290), not its own key.
  6 locales, 874 keys each; both titles + caption + selector label are new.
7 windowSize/Offset :1999-2000, measureByTab :1955 are local useState. NO
  EXPORT CARRIES A DELTA (App:195 deleted them); the export writes every month.
SELECTOR NEEDS: a forecast-month list (none; event month is free-typed :5385);
  an actuals predicate in Step 2; a stock/flow caption; 2 reworded titles.
REVENUE CARD NEEDS: an unrounded baseline-revenue source, or subtract-after-
  round knowingly; a fourth slot (grid-cols-3 :4844); four rows or one total.
```

## 1. What "end of period" is today

**The last month of the forecast horizon.** Not the chart window, and not
anything configurable.

| card | index expression | file:line |
|---|---|---|
| Base Volume Delta | `const last = chartData[chartData.length - 1];`<br>`const baseDelta = last['Base (Adjusted)'] - last['Base (Baseline)'];` | `WhatIfTab.tsx:4501-4502` |
| ARPU Delta (×4) | `const lastAdj = adjustedMonths[adjustedMonths.length - 1];`<br>`const lastFc: any = baseForecast?.months?.[adjustedMonths.length - 1];` | `WhatIfTab.tsx:4554-4555` |

**The two expressions name the same month**, and structurally rather than by
coincidence: `chartData` is `const rows = computed.map((m, idx) => …)`
(`WhatIfTab.tsx:1269`) over the `adjustedMonths` array itself, which is pushed
once per forecast month (`:1111` `baseForecast.months.forEach`, `:1186`
`computed.push`). So all three arrays are the same length and index-aligned —
the claim the ARPU comment already makes at `:4536-4537`.

**The horizon is fixed at 24 months and has no control**:

```
src/App.tsx:162   const [stdForecastLength] = useState(24);
```

No setter is destructured, and no component reads the name (`grep` over
`src/components/` returns nothing). It reaches `calculateBaseForecast` as
`forecastMonths` (`App.tsx:3133`, `forecasting.ts:2453`).

**The 6/12/18/24M buttons are not a horizon and the cards do not read them.**
They are at `WhatIfTab.tsx:4907-4915`, they call `setWindowSize`, and
`windowSize` (declared `:1999`, default 12) has exactly one other reader: the
Recharts `<Brush>`'s `endIndex` at `:5053`. The `<Brush>` scrolls the rendered
x-range over the full `data={chartData}` (`:5021`); it does not slice the
array. So the cards are already horizon-scoped while the chart beside them is
window-scoped — a user reading "end of period" on a 6M window is being shown
month 24.

## 2. Where each displayed delta comes from

**Both are per-month values already; neither is a special end-of-period
computation.** The card picks the last index, and any other index would work.

**Base Volume Delta** is a subtraction of two `chartData` columns:

```
src/components/WhatIfTab.tsx:1844   'Base (Baseline)': +newBBase.toFixed(2),
src/components/WhatIfTab.tsx:1845   'Base (Adjusted)': +newBAdj.toFixed(2),
```

So `baseDelta at month M` = `chartData[M]['Base (Adjusted)'] -
chartData[M]['Base (Baseline)']` — a **lookup**. Note both sides are rounded to
2dp at source. That is harmless here (a subscriber stock is thousands, the
rounding is a hundredth) and it is *not* the shape `e5f1e79` fixed.

**The four ARPU deltas** deliberately do **not** read the columns, for exactly
that reason. `RAW_SOURCE` (`:4548-4553`) maps each scenario to its two
unrounded sources:

```
adjusted  adjustedMonths[i].scenarioArpu[scenKey].arpu     (:4557)
baseline  baseForecast.months[i][bandKey].mean            (:4558)
```

with `known` guarding both for finiteness and a `null` rendering an em dash
(`:4559-4561`, card at `:4870`). `arpuDelta at month M` is therefore also a
**lookup** at index M, and it keeps subtract-then-round.

Per-month fields that exist on the month record (`types/forecast.ts:547-625`):
`baseline{inflow,retention,outflow,arpu}`, `uplifted{…}`, `scenarioArpu`,
`appliedEventIds`, `zeroCoverageEventIds`, `appliedArpuIds`,
`arpuCandidateIds`, `preFloor`, `derivations`, `flooredMetrics`.

**There is no base-volume field on the month record.** Base is a derived stock
and lives only in the two `chartData` columns; the unrounded `newBBase` /
`newBAdj` are loop locals (`:1278-1279`).

## 3. Revenue

**Adjusted and baseline revenue already exist per month per scenario, both
halves, all four scenarios** — sixteen columns written by `perScenarioColumns`
(`WhatIfTab.tsx:940-969`, called `:1869`):

```
:958  out[`${label} ARPU (Baseline)`]    = +bArpu.toFixed(2)
:959  out[`${label} Revenue (Baseline)`] = +(bArpu * baseVol).toFixed(2)
:961  out[`${label} ARPU (Adjusted)`]    = +adj.arpu.toFixed(2)
:963  out[`${label} Revenue (Adjusted)`] = +adj.revenue.toFixed(2)
```

The adjusted side has an unrounded source on the month record:
`ScenarioArpuResult` carries `revenue: number | null` beside `arpu` and
`volume` (`src/utils/scenarioArpu.ts:81-89`). The chart's Revenue measure reads
these columns through `measureKey` (`:157-160`), which is why the measure plots
four scenarios.

**So: four per-scenario revenue deltas at month M are a LOOKUP** if the 2dp
columns are acceptable — `{S} Revenue (Adjusted)` minus `{S} Revenue
(Baseline)`.

**They are NEW ARITHMETIC if unrounded is required**, because the baseline half
has no stored source. `Revenue (Baseline)` is computed inside
`perScenarioColumns` as `bArpu × baseVol`, where `baseVol` is `m.baseline.*`
for the three flows (on the record) but **`baselineBase` for Base — the loop
local `newBBase`, which is not persisted anywhere**.

A "Base revenue delta at month M" is the worst-placed of the five: it needs the
unrounded baseline Base stock, and today only its 2dp column survives the loop.

Whether it should exist at all is a product question this report does not
answer: a revenue delta on a **stock** scenario is `stock × rate`, and its
month-to-month movement mixes a volume change with a price change.

## 4. Actuals

**There is no first-class "this month has actuals" fact anywhere in the app.**

Actuals are imported in Step 3 and **appended into the same `data` array as
history**:

```
src/App.tsx:411   setData(prev => [...prev, ...toAppend]);
```

There is no `isActual` flag and no separate store. The only definition of
"month has actuals" in the codebase is the import modal's *already loaded*
test:

```
src/App.tsx:366-381
  a month is "already loaded" when the current dataset contains at least one
  row for that month where the actual value column is populated
  (non-blank, non-zero)
```

Step 3 rebuilds the fact for itself as `cohortActualsMap` → `effectiveActualMap`
(`ForecastVsActualsTab.tsx:786-832`), and scores over the intersection:

```
ForecastVsActualsTab.tsx:845
  const forecastMonths = allFcMonths.filter(m => effectiveActualMap.has(m));
```

**The What-If step does not read actuals at all.** `grep -n "actual"` over
`WhatIfTab.tsx` returns only the adverb "actually" and one comment at `:2911`
that mentions Step 3 scoring. Nothing in Step 2 can currently tell a month with
actuals from one without.

**Actuals sit INSIDE the forecast range by design.** That intersection at
`:845` is the whole point of Step 3 — the forecast is scored against months
that have since happened, and those are forecast months. In practice they
accumulate from the horizon's start, so they occupy a prefix — but **nothing
enforces prefix-ness or contiguity**: `handleImportActualsConfirm`
(`App.tsx:400-418`) appends whatever months the user ticked in
`ImportActualsModal`, which lists the file's months newest-first
(`App.tsx:383-389`). A file covering only month 7 would leave 1–6 without
actuals and 7 with.

So "forecast months only, excluding months carrying actuals" is a **set
difference over a set that has to be built**, and the exclusion cannot be
assumed to be a suffix of the horizon.

## 5. The lag — what a caption may honestly say

```
src/components/WhatIfTab.tsx:1278
  const newBBase = Math.max(0, p_bBase + p_prevBBaseIn - p_prevBBaseOut);
:1279
  const newBAdj  = Math.max(0, p_bAdj  + p_prevBAdjIn  - p_prevBAdjOut);
```

The stock at month M is the stock at M−1 plus **M−1's** inflow minus **M−1's**
outflow. So:

| displayed quantity | what it is at month M |
|---|---|
| Base Volume Delta | **stock at M**, and lagged — an event in M moves it in **M+1** |
| Inflow / Outflow / Retention ARPU | **rate on M's own flow** — flow-in-M |
| Base ARPU | **rate on the stock at M**, and lagged twice over: pools reach it only once delivered, `p_eventPools.filter(p => p.eventMonthIdx < idx)` (`:1827`) |
| any Revenue column | rate × **that row's own** volume (`:959`, `:963`), so Base revenue inherits the stock lag and the flows do not |

A caption for the Base card must therefore say *stock at the end of month M*,
and the ARPU card's Base row is the only one of its four that is not a flow.
The same distinction is already written down at `:4098-4101`.

## 6. i18n

**"(end of period)" is not a key.** It is baked into each title:

```
en/translation.json:288  "whatif_base_volume_delta_end_of_period":
                         "Base Volume Delta (end of period)"
en/translation.json:290  "whatif_arpu_delta_end_of_period":
                         "ARPU Delta (end of period)"
:289                     "whatif_adjusted_vs_baseline": "Adjusted vs Baseline"
```

Six locales — `en de es fr it pt` — **874 keys each**, measured. Both titles are
translated in all six (`de` *"Base-Volumendelta (Periodenende)"*, `it` *"Delta
del volume Base (fine periodo)"*, …).

Consequences for a selector: **both title keys must change** (the parenthesis
is inside the translated string, so a month cannot be interpolated into them
without new keys), and a caption key, a selector label key and a Revenue card
title key would all be new — five to seven new keys × six locales. The window
buttons show the interpolation pattern already available:
`"whatif_window_months": "{{n}}M"` (`:860`); `whatif_measure_revenue` =
*"Revenue"* (`:843`) already exists and is what a Revenue card should reuse for
the measure word.

## 7. State, and what a selector would disturb

**View state, all component-local `useState` in `WhatIfTab`:**

```
:1999  const [windowSize, setWindowSize]   = useState(12);
:2000  const [windowOffset, setWindowOffset] = useState(0);
:1955  const [measureByTab, setMeasureByTab] = useState<Record<string, MeasureName>>({});
:1951  const [kpisByTab, setKpisByTab]     = useState<Record<string, KpiName[]>>({});
```

`activeMeasure` is derived from `measureByTab` at `:2029`. Measure and KPI
selection are **per tab** by an explicit decision recorded in the comments at
`:1945-1954`. A selected delta month would sit beside these as ordinary view
state; whether it is per-tab or global is a decision, not a constraint — the
cards are rendered once, above the tabs, so global is the simpler reading.

**Nothing exports an end-of-period figure.**

- The What-If export button writes `chartData` whole — **every month, every
  column** (`:4918`, `downloadExcel(chartData, 'market_events_adjusted.xlsx')`).
- The workbook's `Metadata` sheet carries `Forecast_Period_Start` /
  `Forecast_Period_End` (`App.tsx:664-665`) and `Forecast_Length_Months`
  (`:676`, `:498`) — period **bounds**, not deltas.
- The three delta figures that once existed at app level were deleted:
  `App.tsx:195` — *"whatIfDelta / whatIfRevenueDelta / whatIfMissingMonths
  deleted 2026-07-31"*.

So a month selector changes what two cards display and nothing else. **No
export becomes ambiguous.**

## What a month selector needs that does not exist yet

1. **A list of selectable forecast months.** None exists. The only month input
   in the step is a free `<input type="month">` for an event's date
   (`:5385-5389`) — unconstrained, not a list of horizon months. The list is
   one `chartData.map(r => r.month)` away, but it is new.
2. **An actuals predicate reachable from Step 2.** Does not exist (§4). Either
   the month record gains a `hasActuals` field at forecast time, or Step 2 is
   handed the same map Step 3 builds. Both are new; the second couples two
   steps that currently share nothing but `data`.
3. **Two reworded title keys plus a caption**, in six locales (§6), because the
   parenthesis is inside the translated title.
4. **A stock-vs-flow caption**, since at any month other than the last the
   difference between "stock at M" and "flow in M" is what a reader will get
   wrong (§5). At end of period nobody asks; at month 3 they will.
5. **Default and out-of-range behaviour**: what the cards show before a month
   is picked, and what happens when the selected month later acquires actuals.
6. **Spec and trap movement**: `impact-base-delta` is read by
   `event-toggle-spec.tsx:407` and `view-apply-mounted-spec.tsx:256`, and the
   four `impact-arpu-delta-{k}` testids by `view-apply-mounted-spec.tsx:258-268`
   and trap **134** (`guard-traps.ts:2146-2151`). All of those assume the last
   month; a selector makes them assume a default.

## What a Revenue card needs that does not exist yet

1. **A decision on rounded vs unrounded.** The four per-scenario revenue
   deltas are a lookup off the 2dp columns, or new arithmetic against
   unrounded sources. The adjusted side is on the record
   (`scenarioArpu[k].revenue`); **the baseline side is not** — it is
   `bArpu × baseVol` computed in the loop (`:959`), and for Base the volume is
   the local `newBBase` (`:1278`). Reading the columns reintroduces exactly the
   subtract-after-round shape `e5f1e79` removed for ARPU, at a magnitude where
   it matters less; not reading them means persisting one or two new fields.
2. **A fourth card slot.** The impact row is `grid-cols-3` (`:4844`) and
   currently holds Base Volume, ARPU ×4 and Events in effect.
3. **A shape decision**: one blended revenue delta or four per-scenario ones.
   The ARPU card's own comment (`:4515-4519`) is the precedent — the blend was
   removed because it had three denominators under one name. Revenue is a sum,
   not a ratio, so it does not carry that defect; whether four rows or one
   total is more useful is a product question.
4. **New locale keys** for the title (six locales), reusing
   `whatif_measure_revenue` for the word itself.

## Limits

- **Read-only, and nothing was run.** No suite, no guard-traps, no mount. Every
  claim above is from reading source at `de66add`; line numbers were re-read in
  this session and will drift on the next edit to `WhatIfTab.tsx`.
- **The engine was traced, not exercised.** The lag in §5 is read off
  `:1278-1279` and the pool filter at `:1827`; it is not a measurement of a
  rendered chart.
- **No decision is recorded.** The REQ number, the selector's scope, the
  Revenue card's shape and the rounding question are all open, and this session
  logged none of them.
