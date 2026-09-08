# Event status inventory — what the app can already say about a summary row

```
FOR ADVISOR
Generated: 2026-09-08 09:15 +0100 (UTC 2026-09-08 08:15)
Certifies: 164740e (read-only; nothing measured against a changed tree)

BASE e4fd63f + 164740e (reports/ only, ZERO drift). READ-ONLY, no gate, no
  Repo line. Refs = WhatIfTab.tsx unless named; fc = forecasting.ts.
(a) OFF: EventSummaryRow.enabled <- isEventOn fc:951/966/981. On the row
  already, both callers, nothing to thread.
(b) ON volume-applied: appliedEventIds :1200 <- fc:3313. THE SET NEVER
  ESCAPES: local const in impactSummary :4538-9, only .size leaves.
(c) ON yield/ARPU only: NO ID SET EXISTS. Site 2 :1323 sorts, takes [0], one
  winner a month, records nothing. New arithmetic, not threading.
(d) ON zero-coverage: zeroCoverageEventIds :1201 <- fc:3312. REACTS TO THE
  COHORT, NOT THE VIEWING BAR: :2907 passes cohortScope = cohort.* :2871-6.
(e) A FOURTH STATE EXISTS, ALREADY WORDED: matched-but-empty vs never-matched,
  :6381-9, two keyed strings. Barred campaigns / self-exclusion / the chart
  window are not row states — see below.
COMPARE computes both sets (scenarioHelper.ts:283-4) then DROPS them: the
  flat row shape omits them, the component never gets them. It has (a).
KPI number impactSummary.eventCount :4803; caption :4805 key
  whatif_events_applied_to_adjusted_path, or the add-events key at 0.
"N ON" NEEDS NO NEW isEventOn CALL: summaryRows :2530, same scope, rows
  carry `enabled`. filter(r => r.enabled).length. Pins unmoved.
GAP: the applied SET not its size; a yield/pricing set that does not exist;
  a prop for both; a Compare decision. Only the yield set is arithmetic.
```

## The five states

### (a) OFF — available, already on the row

`EventSummaryRow.enabled` (`forecasting.ts:902`), set by `isEventOn(e)` in all
three builder loops of `buildEventsSummaryRows` — `forecasting.ts:951` (market),
`:966` (yield), `:981` (pricing).

**Availability: complete.** It is not a prop that would need threading — it *is*
the row, and `EventsSummaryTable` already reads it twice (`:109`-area switch and
the `OFF_ROW` greying). Compare gets it too, because `buildPerFileEventPanels`
(`forecasting.ts:1020`) builds its rows through the same builder.

**Display sites touched: none of the six.** The builder is not one of the
`REQ-D6-01 DISPLAY` sites; it is a separate, fourth consumer of `isEventOn`
alongside the twelve apply sites and the six display sites.

### (b) ON, applied on the volume path — computed, then discarded

`appliedEventIds` is attached per month at `WhatIfTab.tsx:1200`, from
`applied.appliedIds`, which `applyEventsToMonth` fills at `forecasting.ts:3313`
(pushed for every event that is not `coversNothing`).

**Availability: the size only.** The union across months is built as a *local*
`const appliedHere = new Set<string>()` inside the `impactSummary` memo
(`WhatIfTab.tsx:4538-4539`), and the memo returns `eventCount: appliedHere.size`
(`:4540`). The set itself is unreachable outside that closure. Nothing else in
the component holds it.

So (b) is derivable — `adjustedMonths` is in scope at the render site — but not
*available*: a Status column would either re-derive the union from
`adjustedMonths` at the render site, or `impactSummary` would return the set
beside its size.

**Display sites touched: none.** Apply site 1 produces these ids as a
by-product; the six display sites are decision 7 and are separate.

### (c) ON, applied on the yield/ARPU path only — no set exists

**This is the one state the code cannot currently express.**

Apply site 2 (`WhatIfTab.tsx:1323`) filters `yieldEvents` through `isEventOn`
and `eventScopeMatchesView`, sorts by month descending, and takes `[0]` — **a
single winner per month**, applied without recording an id. There is no
`appliedYieldIds`, no equivalent for pricing, and no field on the month record
for one: `grep` over the per-month object literal returns exactly two id fields,
`appliedEventIds` (`:1200`) and `zeroCoverageEventIds` (`:1201`).

`applyEventsToMonth` is structurally volume-only in this respect — it is handed
the market-path `applicable` list and nothing else, so `appliedIds` can never
contain a yield or pricing id by construction.

**Consequence for the walk figures.** This is why `chip 10 / caption 4 / five
on` reconcile rather than conflict, and why a fifth ON event that moves ARPU
shows in neither the caption nor any set: the app currently has no way to say
"this event applied, on the yield path". Answering (c) is new code, not
threading.

### (d) ON, zero coverage — available, and scoped to the COHORT not the view

`zeroCoverageEventIds` at `WhatIfTab.tsx:1201`, from `zeroCoverageIds`
(`forecasting.ts:3300`, pushed at `:3312`). The test is `coversNothing`
(`:3307-3308`): `isPct(e) ? (e.coverage ?? 1) === 0 : (e.viewShare ?? 1) === 0`.

**It reacts to the loaded cohort, not the viewing bar.** `computeAdjustedForecast`
is called (`WhatIfTab.tsx:2907-2910`) with `viewSegment: cohortScope.seg`,
`viewProduct: cohortScope.prod`, and so on — and `cohortScope`
(`:2871-2876`) is built from `baseForecast?.cohort.*`, the **loaded cohort's own
dimensions**. The viewing bar's `viewSegment` / `viewProduct` come into the
component separately (`:965`) and are not what this memo is given. So changing
the viewing bar does not move `zeroCoverageEventIds`; loading a different cohort
does.

The engine's own comment (`forecasting.ts:3216-3225`) states why the two sets
are kept apart, and it is the sentence a Status column would be built on:
*"'Did this event move anything here' is appliedIds; 'is this event irrelevant
to this view, or relevant and empty' is the difference between this list and
absence from both."*

**Availability:** on `adjustedMonths`, in scope at the render site, not a prop.

### (e) A fourth state the code already distinguishes — and already words

The Volume card's row expander (`WhatIfTab.tsx:6381-6389`) already separates
**matched-but-empty** from **never-matched**, and has keyed copy for both:

```
const coversNothingHere = adjustedMonths
  .some(m => (m.zeroCoverageEventIds ?? []).includes(event.id));
…
{coversNothingHere ? t('whatif_event_no_coverage_in_view')
                   : t('whatif_event_not_in_current_view')}
```

That is a three-way answer already implemented once — applied / in scope but
empty / not in this view — with the strings written. A Status column would be
re-expressing an existing distinction, not inventing one.

**Three candidates the brief named that are NOT row states:**

- **Campaign rows barred** — `groupByCampaign` (`WhatIfTab.tsx:656`) returns
  `{ rows, editable, reason }`. That is *group editability* (D5-05's percentage
  bar), a different axis from whether an event applies. A barred campaign's rows
  apply normally.
- **Pricing self-exclusion** — `excludeId` in `eventScopeSeriesFor`. It answers
  "is this event me" while measuring a draft, and exists only during editing.
  Not a property of a rendered row.
- **Outside the window** — **not a state at all.** `windowOffset` (`:1959`) is
  read only by the chart `Brush` (`:4963-4964`). `adjustedMonths` does not
  depend on it, so no id set narrows when the user brushes the chart.

## Compare — the implication is sharper than it looks

Compare's engine **does** compute both sets: `scenarioHelper.ts:283-284` attach
`appliedEventIds` and `zeroCoverageEventIds` to each month record. But the file
says plainly at `:276-282` that they are dropped:

> *"preFloor, flooredMetrics and appliedEventIds are NOT read by anything in
> this path. computeScenarioForFilter returns a flat row shape that drops them,
> and its only caller (ScenarioCompareTab) has no breach UI."*

`ScenarioCompareTab` has no `adjustedMonths`, no `appliedEventIds`, no
`zeroCoverageEventIds` — `grep` returns zero hits for all three. Its rows come
from `buildPerFileEventPanels(parsedSessions, t)` (`:132-133`), built off parsed
sheet rows.

**So Compare has (a) and nothing else.** A Status column added to the shared
component would render correctly in the What-If panel and be blank — or, worse,
silently wrong — in Compare's per-file panels, unless either the flat row shape
is widened to carry the sets, or the column is made opt-in the way `D5-08`'s
`showAllToggle` and `REQ-D6-01`'s `onSetEnabled` already are. That precedent is
the cheap answer, and it is already twice-used in this component.

## The KPI card

| | expression | file:line |
|---|---|---|
| number | `impactSummary.eventCount` → `appliedHere.size` | `WhatIfTab.tsx:4803`; built `:4538-4540` |
| caption | `whatif_events_applied_to_adjusted_path`, or `whatif_add_events_below_to_adjust_the_forecast` when the count is 0 | `WhatIfTab.tsx:4805` |

**Is "N on" available beside "N applied" without a new `isEventOn` call? Yes.**

`summaryRows` is defined at `WhatIfTab.tsx:2530`, in the same component scope
and well above the KPI block at `:4800`. Every row already carries `enabled`,
set by the builder's own `isEventOn` (`forecasting.ts:951/966/981`). So
`summaryRows.filter(r => r.enabled).length` reads an already-computed field and
adds no thirteenth call to the predicate — the REQ-D6-01 pins would not move.

Note it counts **all three carriers**, which is the right denominator for "on"
and deliberately not the same population as `eventCount` (volume path only).

## What a Status column would need that does not exist yet

1. **The applied SET, not its size.** Available only as `appliedHere.size`
   today (`:4540`). Either return the set from `impactSummary` or re-derive the
   union from `adjustedMonths` at the render site.
2. **A yield/pricing applied set — this does not exist in any form.** State (c)
   is new engine work: site 2 picks one winner per month and records nothing,
   and `applyEventsToMonth` never sees a yield event.
3. **A prop to thread them.** `EventsSummaryTable` currently receives `rows, t,
   open, onToggle, title, testIdPrefix, dense, onSetEnabled, showAllToggle`.
   Nothing applied- or coverage-related reaches it.
4. **A decision for Compare** — widen the flat row shape, or make the column
   opt-in as `onSetEnabled` and `showAllToggle` already are.

Points 1, 3 and 4 are threading and a decision. **Point 2 is the only one that
needs new arithmetic**, and it is the state Jon's walk actually surfaced.

## Limits

- **Nothing was run.** No suite, no guard-traps, no mount; every line above is
  read from source at `164740e`. The walk figures quoted for context come from
  the 2127 report, not from this session.
- **`isPct`/`coverage` semantics were not traced further.** I report that
  `coversNothing` tests `coverage`/`viewShare` at `forecasting.ts:3307-3308`;
  I did not follow how those two are populated per event kind.
- **I did not verify the six display sites are still six** — that pin was
  measured at `8c0cb71` and no source has changed since.
