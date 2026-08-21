# Pricing baseline scope — the settled decision was never true, and now is

## FOR ADVISOR

```
Generated: 2026-08-21 10:50 +0100 (UTC 2026-08-21 09:50)
Certifies: 7b456a1 (this report filled one commit later)
Repo: committed 7b456a1, pushed (origin in sync)
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before the base check.
BASE: HEAD e54286f vs 0906's 8b7bdc1 — one commit, REPORT-ONLY.
ITEM 1: the settled decision (Jon, 2026-08-17) names THIS surface. Decision 1
  says originalBaseArpu is "the blend of the event's own dimensions"; decision
  3 says Preview computes against the same. Both read one symbol off one row.
  FORK RESOLVED: the ARPU was a DEFECT of the same class as the volumes.
ITEM 2 MEASURED IT INSTEAD OF ARGUING IT — wide cohort loaded, narrow draft,
  real tab click, real Add button:
     WIDE loaded    baseArpu 20.40  pricedVol 32,760.06  totalVol 12,536,313.96
     NARROW loaded  baseArpu 24.00  pricedVol 26,208.05  totalVol 10,029,051.17
     draft slice    baseArpu 24.00  pricedVol 26,208.05
  All four followed whatever Step 1 held. After the fix both rows read 24.00 /
  26,208.05 / 10,029,051.17 — the slice's, and invariant.
THE MOUNT'S FIRST RUN WAS VACUOUS AND ITS OWN GUARD SAID SO: the fixture never
  populated arpu, so every forecast had arpu EXACTLY 0 and near(0,0) holds
  whatever the scoping does. Fixed to 24 vs 6; ZERO existing expectations
  re-baselined, which says no prior assertion had ever touched ARPU.
THE FIX: one exported helper, EXACTLY TWO CALLERS, count pinned (not >=).
NEW STATE, STATED NOT SILENT: a slice no forecast covers now carries the seam's
  own reason to Preview and to a disabled Add; the handler guards to match.
mix-card 151 -> 165. Traps 108, 109 — 109 moves NO figure, only the count.
GATE: guard-traps 107/107, fourteen specs, lint and build clean.
```

---

## Base check

`HEAD` **`e54286f`**; the 0906 report's Repo line names **`8b7bdc1`**. One commit
apart, `--stat` confirms **report-only** (its own Repo-line fill). Within the
brief's stated expectation, flagged and proceeded.

## 1. What the settled decision covers — a named quantity per surface

The brief asked which symbol the decision names and whether it is the same
surface as the Preview's `baseArpu` and the stored row's Baseline ARPU column.

**(a) The symbol is `originalBaseArpu`**, written at
`WhatIfTab.tsx:handleAddPricingEvent`:

```ts
const eventScopeSeries = eventScopeSeriesFor(newPricingEvent, editingPricingId);
const matchRow = eventScopeSeries.find(r => r.month === newPricingEvent.month);
const originalBaseArpu = matchRow ? matchRow['ARPU (Adjusted)'] : 0;
```

**(b) It is the same surface as the Preview's.** The Preview reads
`matchRow['ARPU (Adjusted)']` off `previewScopeSeries`, and `previewScopeSeries`
is `eventScopeSeriesFor(newPricingEvent, …)` — the **same helper**, memoised on
the draft's dims. Two symbols, one named quantity, by construction and by
decision 3's own words: *"Preview and the saved row then agree by
construction."*

The save-path comment makes the tie explicit for the volumes too: *"THE
WEIGHTING VOLUMES, FROM THE SAME INVOCATION AND THE SAME ROW as the baseline
above."* All four figures are columns of one row.

**(c) The three surfaces, as named quantities:**

| Surface | Symbol | Named quantity |
|---|---|---|
| Preview Impact | `baseArpu` (local) | the event slice's pre-event blended ARPU at its month |
| Saved row | `pe.originalBaseArpu` | the same, snapshotted at save |
| Chart | `chartData` row's `ARPU (Adjusted)` | the **loaded cohort's**, under the view filter |

**The chart is a genuinely different quantity and is correct as it stands** — it
draws the loaded cohort, which is what a chart of the loaded cohort should show.
Only the first two are the decision's subject. That distinction is the whole
reason the brief's "same NAMED quantity" rule comes first: the previous two
sessions failed on exactly this point, one of them by matching a cohort's
retention against a slice's inflow-plus-retention and reading 1.8% as agreement.

**The fork therefore resolves to proceed.** The 2026-08-17 decision already
names the Preview/row baseline as event-scoped. It was not event-scoped. That is
a defect of the same class as the volumes — indeed of the same *row*.

## 2. The mounted measurement

Extended `spec:mix-card` rather than adding a harness, per Finding D. The block
drives the **real** path: the real `WhatIfTab`, a real `ForecastProvider` over
the two-leaf store with `resolveFromStore` as the seam, a **real click** on the
Pricing tab (the card is behind internal `activeTab` state, so no other route
reaches what a user reaches), the real draft dims through `setNewPricingEvent`,
and a **real click** on Add Pricing Event with `addPricingEvent` spying the row
the handler built.

**Expectations come from `resolveForecast`, not from the card.** The narrow
slice's own forecast is what "event-scoped" *means*, and it is reached by a
different route than the card's — so this measures rather than reimplements.

### Before the fix

```
draft slice        : Corporate / Mobile Voice   month 2026-08
narrow slice OWN   : arpu 24.0000   flows 26,208.05
wide  cohort OWN   : arpu 20.4000   flows 32,760.06

WIDE   loaded -> baseArpu 20.40  pricedVol 32,760.06  totalVol 12,536,313.96
NARROW loaded -> baseArpu 24.00  pricedVol 26,208.05  totalVol 10,029,051.17
```

**All four figures follow the loaded cohort, to the penny.** Loading the slice
changes every one of them. That is the definition of a scoping bug, and it is
also why no walk ever caught it: with the slice loaded, C = S and the wrong feed
returns the right answer.

### After the fix

```
WIDE   loaded -> baseArpu 24.00  pricedVol 26,208.05  totalVol 10,029,051.17
NARROW loaded -> baseArpu 24.00  pricedVol 26,208.05  totalVol 10,029,051.17
```

Identical, and equal to the draft slice's own. The Preview's rendered text reads
`Baseline ARPU 24.00` in both — checked as **text**, so a divergence between
what is shown and what is stored cannot hide behind shared state.

### The first run was vacuous, and the fixture guard is what said so

The ARPU came back as **0.0000 for both slices**. The harness's accumulator sums
the three volume metrics and leaves `arpu: 0`, so every forecast in the store had
an ARPU of exactly zero — and `near(0, 0)` holds however the scoping behaves. A
baseline assertion would have passed against a card reading entirely the wrong
slice.

What caught it was the check written **before** any of the substantive ones:
*"the wide and narrow slices have DISTINCT ARPU"*. This is the same species as
the `scenarioHelper` session's guard admitting `0` because *0 is a number* — the
one value that makes everything downstream trivially true. Fixture corrected to
**24 vs 6**, far enough apart that the aggregate's blend (20.40) cannot land near
either leaf by accident.

**Count guard, as the brief requires: 151 → 165.** Fourteen new checks. **Zero
existing expectations re-baselined** by changing the fixture's ARPU from 0 to
24/6 — which is itself the finding: not one assertion in the harness had ever
touched ARPU, the same shape as the `C.prod` column that named a field absent
from its own fixture.

## 3. The fix

**One exported helper, `resolveEventScopeForecast`, in `forecasting.ts`.** It
takes normalised dims and the `resolveForecast` seam and returns the seam's
result unchanged — forecast or null **with a reason**.

It takes a normalised shape rather than a raw draft because the carriers
disagree on one field name: a `MarketEvent` draft calls it `channel`, a
`PricingEvent` draft `channelL1`. Each caller does that one-line mapping at its
own site, where the field name is visible.

**Exactly two callers**, and the change at the second is the fix:

```ts
const resolution = resolveEventScopeForecast({ …draft dims… }, resolveForecast);
if (!resolution.forecast) return { series: null, reason: resolution.reason ?? null };
return { series: computeAdjustedForecast({
  baseForecast: resolution.forecast, …
}).chartData, reason: null };
```

`baseForecast` is **no longer read** in `eventScopeSeriesFor` and is therefore no
longer a dependency — the hook read-set rule applied in the direction that
usually gets missed, removing a stale dep rather than adding a missing one.
`resolveForecast` replaces it.

**No second series was forked.** The brief forbade it and the structure argues
the same way: two series for one draft is the shape this arc has removed four
times, and it would have put the ARPU and the weights of a single preview panel
on different footings.

### The new absence, stated rather than silent

While the card read the loaded cohort there was always a series, because
something is always loaded. Resolving the draft's own slice creates a state that
did not previously exist: a never-enumerated slice resolves to **null**.

The seam's own reason now reaches the user **verbatim** in three places — the
Preview panel, the message beside a **disabled** Add button, and the handler's
matching guard. Writing a zero into `originalBaseArpu` for an unresolvable slice
would be the two-meanings-of-null defect persisted to disk: a row saying "the
ARPU was nothing" where the truth is "we could not say".

The Preview distinguishes **two absences with two sentences** — "no month chosen
yet" and "no forecast covers this slice" — with the scope reason first, because
it is the one the user cannot resolve by finishing the form.

`whatif_pricing_block_no_forecast` added in **six locales**.

## 4. Compat

**No stored row is rewritten and no legacy-display machinery exists.** The
save-time-record semantic stands: rows keep the figures they were saved with.
The display's existing branches are untouched — the row still reads
`pe.originalBaseArpu` and still weights through `pricingAdjustedBlend`.

The consequence, stated plainly because it is visible to a user: a pre-fix row
and a post-fix row for the same slice will show different volumes with nothing
on screen explaining why. Recorded in EXPECTED.md; pre-fix pricing events exist
only in Jon's test saves.

## 5. The traps

**Two, and they catch different things.**

**108** feeds the loaded cohort back — precisely the code as it stood this
morning. The volume and ARPU literals go red together, because they are one row.

**Its invariance half stays GREEN under the trap, deliberately.** With the slice
loaded, C = S and the wrong feed gives the right answer. That is why the
WIDE-loaded configuration is the load-bearing one, and why an invariance check
alone would never have protected this.

**109** forks the helper into a third, card-local call site. **No figure moves**
when it is planted — the behaviour is identical at the moment of the fork. Only
the exactly-two-callers pin can see it, which is the point: it guards the shape
that produces a divergence later, not one that produces a wrong number now. The
pin is `=== 2`, never `>=`, and it strips comments before counting, because this
file's own history contains a trap that matched an explanatory comment instead
of the code it described.

## Gate

```
mix-card (mounted):      165/165 passed   (was 151)
guard-traps:             107/107 caught, 0 missed, 0 inconclusive
full suite:              fourteen specs, 0 failed
  churn-fold 53   amount-control 91   event-roundtrip 86   events-summary 43
  compare-render 40   compare-events-panel 71   compare-window 45
  compare-filter 24   yield-roundtrip 56   scenario-pricing 16
  active-cohort 23   import-seam 36   pricing-roundtrip 117 (was 116)
lint (tsc --noEmit):     clean
build:                   clean (11.02s)
```

## Where things stand

**The pricing card's four baseline figures now mean what the settled decision
has said they mean since 2026-08-17.** The gap between the recorded decision and
the code lasted four days and survived two sessions of source reading.

**Open:** DQ, still next per EXPECTED.md; the customer pipeline (decision 4);
the `:512` campaign bar unexercised in anger; the held tail on the churn ramp,
awaiting Alessandro; the yield pass's private scope filter in `scenarioHelper`.

## Limits of this check

**The mount is jsdom.** It proves state, handlers, conditional rendering and the
figures the handler builds under real props. It does not prove layout, real
event ordering, or CSS.

**One draft shape.** A plain percentage event over `target: 'cohorts'`,
`cohortScope: 'both'` — which exercises all three volume terms, but not the
dilution path, not `target: 'base'`, and not the edit path's `excludeId`. The
fix is upstream of all of those (they read the same series), but they are not
individually exercised here.

**The new absence path is not driven.** The reason-carrying branch is asserted by
construction and by tsc, not by a mounted render against an unresolvable slice;
the fixture's `leafMap` would need a slice deliberately left out. The churn
panel's identical branch was driven in an earlier session.

**No real save was round-tripped.** The store is constructed. A pricing row
written by this build, exported, re-imported and reopened has not been exercised
end to end.
