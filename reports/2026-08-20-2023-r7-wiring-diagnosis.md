# R7 — the churn card's wiring: scope, add, edit, companions

## FOR ADVISOR

```
Generated: 2026-08-20 20:23 +0100 (UTC 2026-08-20 19:23)
Verified against: a7e3b5c
Repo: committed 734786a, pushed (origin in sync)
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before any check ran.
READ-ONLY DIAGNOSIS — no source changed.
BASE: HEAD a7e3b5c vs the card-state report's b85ea0e — one, REPORT-ONLY.
(B) IS ONE LINE, SELF-INFLICTED. The churn Add branch is DEAD CODE:
  handleAddMarketEvent:2409 returns early when `!spreadEnabled`, and the churn
  arm FORCE-CLEARS it. Every churn Add falls to App's addMarketEvent — the
  documented "FIFTH WRITER" — emitting ONE event from the cleared amount
  (hence 0), no churn fields. One flag doing two jobs: clear-flag AND gate.
(A) IS A MISUSE OF A DOCUMENTED BOUNDARY: computeAdjustedForecast uses the view
  dims for EVENT MATCHING ONLY — its own comment says so — and the base series
  is the LOADED COHORT's. The recorded 8.2% divergence sits behind exactly
  this. Hence ~293k at every slice.
(A) HAS A CLEAN FIX, NO NEW MACHINERY: ForecastContext exposes
  resolveForecast(key) — "THE seam" — so the panel resolves the DRAFT'S key
  and feeds that; its `reason` gives the absence when a slice has none.
ADJACENT EXPOSURE, REPORTED NOT FIXED: the PRICING card's stored weighting
  volumes read Base off the same cohort-scoped series (volumesFromSeries).
(C) EDIT RESTORES EVERYTHING EXCEPT CHURN — and the comment three lines above
  the gap documents this exact lesson, learned once for percentage.
(D) THE ENGINE READS ONLY subscriberVolume. customerVolume and revenue are
  stored, displayed, and INERT on an outflow event.
(5) NO CUSTOMER SERIES EXISTS. wiCustomerCol is auto-mapped at upload and read
  by NOTHING; no forecast type carries customers. The ratio is not derivable.
MOUNT NOW JUSTIFIED ON DATA — see Decisions.
```

---

## Base check

`HEAD` **`a7e3b5c`**; the card-state report's Repo line names **`b85ea0e`**. One
commit apart, `--stat` confirms **report-only**. Established drift pattern,
flagged and proceeded. Read-only throughout: no source file was modified.

## 1. The series feed (A — scoping)

The card builds the panel's series at `WhatIfTab.tsx:2236`:

```ts
const churnScopeSeries = useMemo(() => {
  ...
  return computeAdjustedForecast({
    baseForecast, marketEvents, yieldEvents, pricingEvents,
    viewSegment: newEvent.segment ?? 'All',
    viewProduct: { l1: dimOrNull(newEvent.product), ... },
    ...
  }).chartData;
}, [isChurnDraft, newEvent.date, newEvent.segment, ...]);
```

**It passes the draft's dims, and the memo is keyed on them.** So the intent is
right and the wiring looks right — which is why this survived a source reading.

**The dims do not do what the call assumes.** `computeAdjustedForecast`
(`:692`) says so in its own words at `:700`:

> *Use the local view filter for **event matching** so the chart reflects the
> currently selected view scope — not the cohort from Step 1.*

The view dims decide **which events apply**. The **base series** comes from
`baseForecast.months` — the **loaded cohort's** forecast, unchanged by any dim
passed here. That is the recorded `cohortScope`-vs-view-state boundary, the one
with a measured **8.2% divergence** behind it.

So the panel's denominator is the loaded cohort's base — **~293k at All/All/All,
whatever the form says** — and changing Segment/Product/Channel re-runs the memo,
re-matches the events, and returns the same base. Exactly the walk's report.

### The fix shape, against existing machinery

**`ForecastContext` already exposes the reader this needs**, and its own comment
names it "**THE seam**":

```ts
resolveForecast: (key: string) => { forecast: BaseForecast | null; reason: SkipReason | null };
```

> *Every reader goes through this rather than reading `forecastStore` directly.
> A bare `forecastStore.get` answers "is it stored", which stopped being the
> question the moment aggregates became derivable — and answering the wrong
> question is how a cohort came to show a previous cohort's forecast.*

`useForecast()` is already destructured in this component (`:1350`), so the fix is
to build the draft's cohort key with the shared `makeForecastKey`, call
`resolveForecast`, and pass **that** forecast into `computeAdjustedForecast` in
place of the loaded one.

**Nothing makes it unreachable, and no approximation is needed** — so the R5
stop-condition does not fire. Two properties come free: aggregates are derived
rather than required to be stored, and `reason` supplies a **named absence** when
a slice genuinely has no forecast, which the panel's absence machinery already
knows how to render.

### An adjacent exposure, reported not fixed

`volumesFromSeries` (`:2298`) reads `'Base (Adjusted)'` off the same
`eventScopeSeriesFor` series, and the **pricing** draft uses it at `:2352` to
compute the weighting volumes it **stores on the row**. On the reading above,
those volumes are cohort-scoped rather than event-scoped.

Stated as an exposure, not a finding: I did not measure a pricing row, and the
pricing session may have intended the cohort scope. It is the same species as
(A) and belongs on the same list.

## 2. The add path (B — one event, zero volume)

`handleAddMarketEvent` (`WhatIfTab.tsx:2406`):

```ts
2407  if (!newEvent.date || newEvent.subscriberVolume === undefined) return;
2409  if (!spreadEnabled || newEvent.scenario === 'ARPU') { addMarketEvent(); return; }
...
2426  if (isChurnDraft) { ...the fold, the N events, the churn fields... }
```

**The churn branch at `:2426` is dead code.** Line `:2409` returns first, and it
returns *always* for churn — because **the churn arm force-clears
`spreadEnabled`**, which the R7 build did deliberately and correctly (churn
replaces the spread with its own ramp control).

**One flag is doing two jobs.** `spreadEnabled` is both *"the user wants a
multi-month spread"* and *"route to the N-events emitter"*. The R7 build set it
for the first meaning without noticing it controlled the second — and App's
`addMarketEvent` documents that routing in its own comment (`App.tsx:229`):

> *THE FIFTH WRITER. This is the DEFAULT add path — WhatIfTab's
> handleAddMarketEvent routes here whenever month-spreading is off, which it is
> unless the user turns it on.*

That single line accounts for **all three** parts of observation B:

| symptom | cause |
|---|---|
| ONE event, not N | the fifth writer emits one event; the ramp emitter is never reached |
| `subscriberVolume` 0 | it reads `newEvent.subscriberVolume`, which the churn arm **cleared to 0** |
| no churn statement stored | the fifth writer predates churn and writes none of the four fields |

**The fold and the carrier are exonerated**, as the brief says: both are proven
by their specs, and neither is on this path at all. The break is exactly
between them.

**A latent sign hazard on the same path**, worth recording: `addMarketEvent`
applies `neg = v => (isOutflow && !isPct) ? -Math.abs(v) : v` (`App.tsx:221`).
A churn row is Outflow and not percentage, so **if a non-zero churn delta ever
reached this writer it would be forced negative** — inverting a reduction into an
increase. Today the volume is 0 so nothing is visible, and trap 98 guards the
*workbook reader*, not this writer.

## 3. The edit path (C — nothing reconstructed)

`handleEditStart` (`:2547`) restores scenario, dims, date, volumes, `arpuOverride`,
name, campaign, comment, contract length, `amountType`, `percentageBasis` and
`retentionLinked` — and **none of the four churn fields**. It also never touches
`storedAmountControl` or any churn draft state, so the control stays on Subs and
the panel does not open.

**The file already documents this exact lesson, three lines above the gap:**

> *Restoring these is not optional. Without them, opening a percentage event for
> edit and saving would rewrite it as absolute, and the amount would change
> meaning from 10 per cent to 10 subscribers.*

Churn is the third mode and inherits the requirement verbatim; it simply was not
extended.

**There is a corruption path here, not merely an omission.** Edit displays
`abs(subscriberVolume)` and the save re-applies the `neg` convention. A churn
**reduction** is stored positive; reopened and saved through the ordinary edit
path it would come back **negative** — the event silently inverted.

**Seeding churn correctly requires**, in order: the control set to `'churn'`
through the **one writer** (`nextAmountControlState`, so exclusivity holds); the
draft fields from the stored row (`churnTargetPct`, and the row's own
`churnCurrentPct`/`churnPrevBase` for display); and the **ramp flag inferred from
the campaign's shape** — one row means the radio is off, N rows sharing a
`campaignName` means on, with the months count from the group's span.

**What the walk's event actually hit**: it stored **one** row, so the `:512`
campaign group-edit bar never came near it — a single churn event is
individually editable, and the bar is for ramps. The bar is correct and
untested-in-anger; the walk could not have exercised it, because the ramp never
produced N rows.

## 4. The companions (D)

**What the engine does with them: nothing.** `applyEventsToMonth`'s absolute pass
(`forecasting.ts:3040-3063`) reads **`e.sharedVolume`** — derived from
`subscriberVolume` — for Inflow, Outflow and Retention, and `arpuDelta` for ARPU.
`customerVolume` and `revenue` are **never read**.

| field | add writes (today, via the fifth writer) | engine apply | row displays |
|---|---|---|---|
| Customer Volume | `neg(typed value)` | **nothing** | yes, in the list |
| Revenue | `neg(typed or derived)` | **nothing** | yes |
| ARPU | `neg(typed or trailing-average auto-fill)` | nothing on an Outflow event | yes |
| Contract Length | typed, default 24 | the promo/at-risk pool logic only | yes |

So on a churn row all four are **stored and shown but inert** — with the caveat
that the churn branch (once reachable) writes zeros for the first three and
carries `contractLength` from the draft.

Facts only, as briefed: whether they hide, dash, or stay editable is Jon's call.

## 5. The customer ratio

**No customer series exists anywhere in the data path.** `wiCustomerCol` has
exactly **two** references in the codebase:

```
App.tsx:133   const [wiCustomerCol, setWiCustomerCol] = useState('');
App.tsx:1336  if (!wiCustomerCol) setWiCustomerCol(match(['customer', 'cust', 'account']) || '');
```

It is auto-mapped at upload and **read by nothing**. `BaseForecast` and
`BaseForecastMonth` carry **no customer field at all** — zero mentions in
`types/forecast.ts`. Nothing fits, aggregates, stores or serves a customer
volume per cohort-month.

**So subscribers-per-customer for the event's slice is not derivable today**, and
a derived-editable Customer Volume field is not buildable without new pipeline
work: carrying the mapped column through fitting and aggregation into the
forecast, which is a piece of work in its own right.

This is the same species as the recorded fixture note *"`Avg_Unit_Price_GBP`
populated in 4 of 7, read by nothing (DQ guard)"* — a mapped column that reaches
nothing. **DQ owns that class**, and this belongs on its list.

## 6. Classification, fixes, and the mount

### Classification

| | verdict | evidence |
|---|---|---|
| **A** scoping | **NEVER-WORKED** — a misuse of a documented boundary | `computeAdjustedForecast`'s own comment scopes the dims to event matching; the base has always come from the loaded cohort |
| **B** add | **INTRODUCED by `da92622`** — self-inflicted, within one commit | the churn arm's `setSpreadEnabled(false)` and the `:2409` routing gate were both correct in isolation |
| **C** edit | **NEVER-WORKED** — restore was never extended | the percentage lesson at the same site was not carried to the third mode |

### Fixes, smallest first

**Session 1 — make the feature do anything (A + B).**
**(B)** move the churn branch **above** the `:2409` gate, so it is reached before
the spread routing decides anything; the branch itself is already written and
already emits N events with the fold's deltas and the four fields. **(A)** resolve
the draft's cohort key through `resolveForecast` and pass that forecast into the
series memo. Both are small, both are in the same file, and until both land the
capability produces nothing usable.

**Session 2 — make it survivable (C + the companions).**
Extend `handleEditStart` to seed churn through the one writer, and settle what
the four companion fields do on a churn row. C carries the sign-corruption path,
so it should not sit unfixed for long once churn rows can actually be created.

**Not in either:** the pricing-card exposure (§1) and the customer series (§5).
Both are their own pieces of work and both have homes — the first beside the
path-unification backlog, the second with DQ.

### The mount is now justified, on data

**Three walk rounds, and every defect has landed in the same gap.** Both prior
reports' Limits sections named it in advance: the card is source-read and never
mounted.

- Round 1 (card state): five observations, all transitions.
- Round 2 (this one): four, all wiring.
- **Nine walk-found defects; zero found by the specs.**

The pure specs are not failing at their job — `spec:churn-fold` (53) and
`spec:amount-control` (91) are exhaustive over the arithmetic and the
transitions, and neither can reach *handler routing* or *what a memo was fed*.
Those are properties of the mounted component.

**All four of this round's defects are cheaply mount-catchable**: render the
card, select churn, click Add and count the events in the store (B); change a dim
and assert the breakdown text changes (A); add then reopen and assert the panel
is seeded (C); read what the row stores (D). The `mix-card` spec is the existing
precedent for a mounted card harness in this codebase, so the pattern is not new
work either.

## Decisions for Jon

1. **Do sessions 1 and 2 run separately, or as one?** A and B together are small;
   C plus the companion decisions is a second body of work with a design question
   inside it. My recommendation is two, with A+B first because nothing about the
   feature is usable until they land.
2. **Is the mounted harness commissioned now?** The argument is no longer
   theoretical — nine defects, all in the unmounted gap, none reachable by the
   pure specs. It would ride session 1 naturally, since (B) is one assertion.
3. **The four companions (§4): hide, dash, or leave editable on a churn row?**
   Facts are above; the call is a product one. Note that Customer Volume as a
   *derived* field is **not buildable** — see 4.
4. **The customer series (§5): commission it, or hide the field?** No customer
   data reaches any forecast today. Building it is pipeline work; hiding the
   field costs nothing and can be revisited.
5. **The pricing-card exposure (§1): measure it?** One read of a stored pricing
   row against its slice would settle whether it is a real divergence or an
   intended scope. Cheap, and it decides whether it needs a fix at all.

## Limits of this diagnosis

**Nothing was mounted or run.** Every claim is a source reading with symbols and
line numbers. That is sufficient for (B), which is a control-flow fact — an early
return before a branch — and for (5), which is an absence of references. It is
strong but not conclusive for (A), where I read what the dims are used for rather
than measuring a rendered figure; the walk's ~293k against a slice of ~80–95k is
the corroborating measurement, and it is Jon's, not mine.

**The pricing-card exposure is inferred, not measured.** It follows from the same
reading as (A), and I did not open a saved pricing row to confirm it.

**I did not re-derive the fold or the carrier**, per the brief — both are proven
by their specs and neither sits on the broken path.

**The `abs`/`neg` corruption path in edit (§3) is reasoned, not observed.** It
follows from `handleEditStart` displaying `abs(...)` and the save path applying
`neg(...)`, but no churn row has been round-tripped through edit, because until
(B) is fixed no churn row with a non-zero volume can be created at all.
