# Chart grid — control, columns, export (chart-grid 2 of 2)

UAT findings D1-01 / D1-02.

## FOR ADVISOR

```
Generated: 2026-09-01 14:03 +0100 (UTC 2026-09-01 13:03)
Certifies: d63175b (report filled one commit later)
Repo: committed d63175b, pushed (origin in sync)
SKELETON FIRST. BASE: HEAD 7c650e2 vs 1312's 006a15f — one, REPORT-ONLY.
ITEM 0a SWEPT: 13 floor-comparisons across the specs; only TWO are the trap-77
  class (source-site counts used as existence evidence) and both are re-aimed
  exactly — amount-control >= 2 -> === 5, cards >= 3 -> === 5. The other eleven
  are runtime non-emptiness, render counts, string lengths or filter
  predicates, each listed with why it stays. ONE MISLABELLED CHECK FOUND, not
  fixed: derive-aggregate says "not a single model" while asserting >= 1.
ITEM 0b: trap 77's anchor extended downward one line, unique again (1 match).
SIXTEEN COLUMNS, additive and PROVED so — the original thirteen keys asserted
  FIRST and IN ORDER, the row at exactly 29 keys; presence would miss a reorder.
ARPU Outflow (Ref): LINE retired, COLUMN KEPT — the export writes chartData
  wholesale, so dropping the key would remove an export column (item 5 forbids).
THE CONTROL: measure row single-select (aria-pressed asserted exactly one),
  scenario row multi-select, the LAST scenario cannot be turned off; Base
  caption extended and the blended line gone from the display.
ITEM 5's READERS ARE STRUCTURALLY UNAFFECTED: chartData appears ZERO times in
  App.tsx, so it cannot reach Import Save or Compare; an old pre-build save
  also re-read clean through the real seams.
BOTH ENGINE-SESSION GAPS CLOSED: yield isolation and a TWO-LEAF store driving
  the real aggregation. ITEM 6: Overall Forecast has no chart seam to share.
mix-card 195 -> 208, scenario-arpu 47 -> 84, traps 113 -> 116.
GATE: 116/116, sixteen specs, mount 208/208, lint and build clean.
```

---

## Base check

`HEAD` **`7c650e2`**; the 1312 report's Repo line names **`006a15f`**. One commit
apart, `--stat` confirms **report-only**.

## 0. Hygiene

### (a) The `>=` sweep — thirteen found, two re-aimed

Every floor comparison in `scripts/` was listed. **The trap-77 class is
specific**: a count of *source-code sites* used as evidence that a site exists.
A floor stops discriminating the moment anything else is added, which is exactly
how trap 77 was missed yesterday.

**Re-aimed (2):**

| Spec | Was | Now | Sites |
|---|---|---|---|
| `amount-control-spec.ts:250` | `clearChurnDraft();` **≥ 2** | **=== 5** | the amount-control writer's branch, the churn add emitter, the churn edit-save, the campaign churn save, the campaign reset |
| `cards-spec.ts:78` | `shrink-0` **≥ 3** | **=== 5** | the dropdown's icon and label guards |

Both carry a comment naming the sites and the trap-77 reason, so the next reader
knows why the number is exact.

**Left, with reasons (11):**

- `derive-aggregate:140` and `derived-interaction:285` count **runtime model
  keys** from a fixture, not source sites. Non-emptiness of produced data.
- `challenger-render:277` counts **rendered SVG surfaces** — "a chart drew".
- `mix-card:836` is the *good* pattern: a non-vacuity guard (`length > 0`)
  immediately before the property it protects.
- `mix-card:1226 / 1292 / 1346` are **string-length** checks — "a reason was
  rendered and is substantive", not counts.
- `step1-panel` ×3 are **filter predicates** inside a selector, not assertions.
- `scan-i18n:273` is a heuristic inside a scanner, not a spec.

**One mislabelled check found and NOT fixed.** `derive-aggregate-spec.ts:140`
reads *"the model histogram is populated, not a single model"* while asserting
`Object.keys(models).length >= 1` — which **exactly one model satisfies**. The
label claims more than the assertion tests. Left alone because correcting it
means deciding what the fixture's model count should be, which is that spec's
business and not this brief's. Recorded so it is not discovered a third time.

### (b) Trap 77's anchor

The bare filter line has appeared **twice** in `WhatIfTab.tsx` since the engine
session — the pricing apply pass and the per-scenario block, which filters
through the same shared predicate as it should.

**Extended upward, not moved.** The anchor now includes the following line,
which is unique to the apply pass:

```
if (!eventScopeMatchesView(pe, viewScopeForMatch)) return false;
if (pe.duration === 'one-off') return pe.month === m.month;
```

Verified: **1 match**. No code moved.

## 1. The sixteen columns

Four scenarios × {ARPU, Revenue} × {Baseline, Adjusted}, built in one named
helper, `perScenarioColumns`, so the chart, the table and the export read one
definition and cannot drift on which volume a revenue was multiplied by.

- **Baseline ARPU** is the forecast month's own band — not the blend.
- **Adjusted ARPU** is the engine's per-scenario quantity from session 1.
- **Revenue** is that scenario's ARPU × **that scenario's** volume in the same
  row; base against the running base stock. The result's own `volume` is read
  back out rather than re-derived, so `ARPU × volume = revenue` holds by
  construction rather than by agreement.
- **Absence reaches the column as `null`** — never the blend, never `0`. A zero
  would read as "these subscribers are worth nothing", a different claim from
  "we cannot say".

**Additive, and proved to the letter.** The spec asserts the original thirteen
keys are the **first thirteen in order**, that every new column comes after
them, and that the row has **exactly 29 keys**. A presence check would pass a
reorder; a key-order literal will not.

### `ARPU Outflow (Ref)` — line retired, column kept

The brief said retire the line and remove the column *unless something reads
it*. The chart was its only reader — **but the chart export writes `chartData`
wholesale**, so removing the key would remove an existing export column, which
item 5 forbids. **The column stays; only the line is retired**, and the source
comment says why. Stated rather than silently chosen.

## 2. The control

**Measure row** (`Volume / Revenue / ARPU`), single-select, `aria-pressed`
carried so the state is readable from the DOM rather than inferred. **Scenario
row** (`Inflow / Outflow / Retention / Base`), multi-select, and **the last one
cannot be turned off** — deselecting it would produce an empty chart whose cause
is a control state rather than the data, the one blank this card must not show.

**The axis follows the measure, not the scenario.** Volume is a count; revenue
and ARPU are money. Lines are keyed `${scenario}-${measure}` so a measure switch
re-mounts them and cannot leave a line reading its old column against the new
unit.

**The blended ARPU line is retired from the display**, as recorded. It is not a
fifth scenario button. The `ARPU (Baseline)` / `ARPU (Adjusted)` **columns are
untouched** — the pricing card's feed is exactly as it was.

**The Base caption is extended**: *"Base Revenue and Base ARPU carry the same
one-month lag; the flow measures do not."* The lag was already true of Base
volume and unremarked; a Revenue measure makes it something a reader can act on.

## 3. Locale

Five new keys, **six values each, all present**:

| Key | en | de | es | fr | it | pt |
|---|---|---|---|---|---|---|
| `whatif_measure` | Measure | Kennzahl | Medida | Mesure | Misura | Medida |
| `whatif_measure_volume` | Volume | Volumen | Volumen | Volume | Volume | Volume |
| `whatif_measure_revenue` | Revenue | Umsatz | Ingresos | Revenu | Ricavi | Receita |
| `whatif_measure_arpu` | ARPU | ARPU | ARPU | ARPU | ARPU | ARPU |
| `whatif_base_lag_applies_to_revenue_and_arpu` | *(sentence)* | ✓ | ✓ | ✓ | ✓ | ✓ |

**Two keys repeat a value across languages, and that is correct rather than
lazy.** `ARPU` is the industry acronym in all six; `Volume` is the word in
English, French, Italian and Portuguese, and `Volumen` in German and Spanish.
Neither is English left untranslated — which matters, because this codebase has
50 keys that genuinely are, and conflating the two would hide them.

**No scenario names were minted.** Inflow / Outflow / Retention / Base are
already the app's vocabulary and render as metric names throughout; adding
translated duplicates would have created a second key for a string the app
already has.

**No currency symbol was invented.** The Revenue axis uses the card's existing
`formatNumber`; picking a symbol is a product decision and none was taken.

## 4. Table and summary

**The Step-2 table reads `chartData` and therefore gains the columns
automatically.** It renders the original thirteen explicitly by name, so the new
sixteen are carried in the data without being rendered as extra table columns —
**present in the row, not shown in the table**. That is the conservative
outcome: no table layout changed, and the columns are available to the export
and to session 3 if a table view is wanted. Stated, as the brief asks, rather
than left to be discovered.

**The events summary's ARPU delta stays on the blended columns**, unchanged and
untouched, pending the decision on what the blend may still feed.

## 5. Export — additive, both readers

**The sixteen land in the chart export only.** `downloadExcel(chartData, …)`
writes the row wholesale, and because the new keys are spread last, they append
after `hasEvent`. The key-order assertion in §1 is the proof.

**Import Save and Scenario Compare are structurally unaffected, not merely
untested.** `chartData` appears **zero times in `App.tsx`**: the session export
builds `Adjusted_Forecasts` from its own writer with its own column names
(`Inflow Volume (Baseline)` and friends), and Compare reads that workbook
through `computeScenarioForFilter`. The chart export is a separate, ad-hoc file.

**Evidence, not inference:**

```
OLD-FILE ROUND TRIP (18 Aug 2026 save, real seams)
  market   placeholder=true   parsed 0  failed 0
  yield    placeholder=true   parsed 0  failed 0
  pricing  placeholder=false  parsed 1  failed 0
  baseline 1728 rows, 53 columns
  carries any of the sixteen new columns? false   (expected false)
  OLD FILE READS CLEAN
```

plus `spec:import-seam` (36) and `spec:pricing-roundtrip` (117) green, both of
which exercise the save readers.

## 6. Scope check — Overall Forecast

**It has no chart seam to share.** `OverallForecastTab` takes cohorts and filter
props and renders a cohort table; it imports neither `computeAdjustedForecast`
nor `chartData`, and contains no Recharts `<Line>` or `dataKey` at all. There is
nothing for the grid to extend into and nothing to keep in step. No change made
either way, as the brief specifies.

## Specs

**mix-card 195 → 208** (thirteen new, mounted): both rows render, three
measures offered, **exactly four scenarios** (the blend is not a fifth),
single-select asserted as *exactly one pressed* before and after switching,
re-key across all three measures and back, the last scenario refusing to turn
off, and the Base caption text.

**scenario-arpu 47 → 84** (thirty-seven new, pure): the sixteen columns by
hand-written literal, the key-order and 29-key assertions, absence reaching the
column as `null` while the blended columns keep their figures, **yield
isolation** for Inflow and Retention, and a **two-leaf store** driving
`deriveAggregate` and then the engine — closing both gaps the engine session
declared in its own limits.

**Count guard.** No existing expectation was re-baselined by the new fixtures;
the two count anchors that moved (`amount-control`, `cards`) moved because this
session deliberately re-aimed them, and both were verified green afterwards.

### One selector defect, mine, caught by its own count

The scenario-count check first read **5**. `[data-testid^="scenario-"]` was
matching the container `scenario-row` as well as the four pills. Fixed at
source — the rows are now `grid-measure-row` and `grid-scenario-row`, so the
pill prefix is unambiguous — rather than by narrowing the selector, because a
prefix collision would recur. It is worth noting that a **count** check caught
it; a presence check would have been perfectly happy.

## Traps

**113 → 116.**

- **117** plots the blended column under a scenario button — the exact confusion
  the grid removes. Caught by the per-scenario literals, and only because the
  fixture's blend matches none of the four.
- **118** multiplies a scenario's ARPU by another scenario's volume. Caught by
  the revenue literals, and only because the four baseline revenues are asserted
  **distinct** first.
- **119** drops an existing `chartData` key. Caught by the **key-order** literal
  — a presence check on the sixteen would have stayed green, since all sixteen
  would still be there.

## Gate

```
mix-card (mounted):      208/208 passed   (was 195)
scenario-arpu:           84/84 passed   (was 47)
guard-traps:             116/116 caught, 0 missed, 0 inconclusive   (was 113)
full suite:              sixteen specs, 0 failed
  scenario-arpu 84 (was 47)   churn-fold 56   amount-control 91
  cards 36   event-roundtrip 86   events-summary 43   compare-render 40
  compare-events-panel 71   compare-window 45   compare-filter 24
  yield-roundtrip 56   scenario-pricing 16   active-cohort 23
  import-seam 36   pricing-roundtrip 117   derive-aggregate 75
lint (tsc --noEmit):     clean
build:                   clean (6.26s)
```

## Where things stand

**The chart grid is built end to end** — engine (session 1) and control,
columns, locale and export (this one). UAT's D1-01 and D1-02 have a surface.

**Open:** the three-denominator correction (its own decision); the events
summary delta (pending); the guide (queued behind the walk); DQ; Compare's
engine and Overall Forecast as separate scopes.

## Limits of this check

**No session export was produced from this build.** Producing one needs the
running app, so item 5's "a file from this build" half is evidenced
*structurally* — `chartData` is not read by any save writer — rather than by a
round-tripped new file. The old-file half was driven for real. A walk that
exports and re-imports is what would close it.

**The chart is asserted through the DOM and the data, not visually.** The mount
checks control state and re-keying; it does not confirm that a Revenue line is
legible against a Volume-scaled axis, or that four scenarios × two halves is
readable at eight lines. That is a walk question.

**The table shows the original columns only.** The sixteen are in the row and in
the export but not rendered as table columns. If UAT expects to read revenue in
the table, that is session 3 and not a defect in this one.

**`whatif_measure_arpu` is identical in six locales** by intent. If a reviewer
wants ARPU expanded per language, that is a copy decision, not a gap.
