# Pricing card residuals — event-scoped baseline, names, tooltip scope

## FOR ADVISOR

```
Generated: 2026-08-17 13:40 +0100 (UTC 2026-08-17 12:40)
Certifies: c4e1f48 (body written PRE-commit; only these 2 lines added after)
Repo: committed c4e1f48, pushed (origin in sync)
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before the base check.
BASE: HEAD 220c83e vs the brief's 8f3b34e — one commit, REPORT-ONLY.
OBS 1b'S STATED CAUSE WAS WRONG — corrected in EXPECTED.md while building.
  chartData is scoped to the LOADED COHORT, NOT the view bar (a measured 8.2%
  defect is on record behind that), so the baseline never depended on the filter
  set at save time. The real defect is narrower: an event scoped INSIDE the
  cohort took the cohort's blend. Fix stands; its recorded reason did not.
ITEM 1 STOP DID NOT FIRE — computeAdjustedForecast's view scope is four plain
  arguments, so it runs for the event's dims with no mounted state.
SHIPPED: event-scoped baseline (excluding the event being EDITED — the old one
  got that wrong every time); Name columns on pricing + yield; a shared
  eventScopeMatchesView used by the tooltip AND the pricing filter; Ref line.
COMPAT HELD: no saved event is rewritten; carriers unchanged.
LIST AUDIT: Volume and Promotion already carry a Campaign column — their
  carrier's identity field. Pricing and Yield had NEITHER and gained Name.
NEW INCONSISTENCY I INTRODUCED AND DID NOT HIDE, DECISION NEEDED: Preview
  Impact stays cohort-scoped while the saved row is now event-scoped, so for a
  narrow event the two baselines differ. Cost, not oversight — three options §6.
TWO MORE OF MY EXPECTATIONS WERE WRONG AND THE RUN CORRECTED BOTH (1 chartData
  site not 0; 3 Name headers not 2). Recorded, not quietly amended.
pricing-roundtrip 94/94 (was 78), guard-traps 75/75, events-summary 37/37,
  mix-card 99/99, event 69/69, yield 35/35, lint and build clean.
```

---

## Base check

`git rev-parse --short HEAD` → **`220c83e`**; the brief names `8f3b34e`. One
commit apart, report-only. Flagged, proceeded.

## Decisions recorded

Two, in `test-data/EXPECTED.md`, before any code — plus a **correction to one of
them** made during the build, below.

## Item 1's stop condition — checked first, did not fire

`computeAdjustedForecast` is an exported pure function whose view scope is four
plain arguments (`viewSegment`, `viewProduct`, `viewChannel`, `viewTariff`). It
can be asked about **any** slice with no mounted view state, so the event-slice
blend is directly available at save time. Nothing was approximated.

## The correction — Obs 1b's stated cause was wrong

The diagnosis recorded that `originalBaseArpu` was **view-scoped**, so "the
baseline shown depends on the filter set at save time". **It does not.**

`chartData` comes from `computeAdjustedForecast` called with **`cohortScope`**,
derived from `baseForecast.cohort` — the **loaded cohort**. The component
carries a long comment explaining why view state must never drive it, with a
measurement: a +10,000 Inflow event read 18,461 scoped to the loaded cohort and
8,683 with the view bar narrowed — **an 8.2% divergence over the horizon**,
exported under the loaded cohort's label. That was a real defect and the current
design is its fix.

So the baseline was **stable across view changes**, and two identically-scoped
events always agreed. The real defect is narrower: **an event scoped inside the
loaded cohort took the cohort's blend rather than its own slice's.**

The fix is unchanged — event-scoped is still right — but I have corrected the
recorded reason in `EXPECTED.md` rather than shipping a fix justified by a false
premise. A correct change resting on a wrong explanation is how the *next*
decision goes astray.

## What shipped

### 1. The event-scoped baseline

At save, the snapshot now runs the same pipeline against the **event's own
dims** (`dimOrNull` maps `'All'`/absent to `null`, the shape the pipeline
expects).

**The event being edited is excluded** from the `pricingEvents` handed in. The
old version could not do this — `chartData` always contains every saved event —
so **every edit measured the event against a blend that already included it**.
That is a second, quieter defect fixed in passing, and it was not in the
diagnosis.

**Compat held exactly as decided:** no stored value is rewritten, the semantics
change for new saves only, and `Pricing_Mode` / `Dilution_*` / `Original_Base_ARPU`
carriers are untouched, so a pre-change workbook round-trips identically.

### 2. Names on the cards' own lists — the class audit

| List | Identity column before | After |
|---|---|---|
| Volume | **Campaign** (`whatif_campaign`) | unchanged |
| Promotion | **Campaign** (`whatif_campaign`) | unchanged |
| Pricing | **none** | **Name added** |
| Value / Yield | **none** | **Name added** |

Volume and Promotion already carry their carrier's identity field —
`MarketEvent.campaignName`, which is the grouping key for both cards. They do
not gain a second column. Pricing and Yield carried neither, so an event was
identifiable in the R4 summary table and anonymous on the card that owns it.

Both reuse `whatif_summary_col_name` and the per-kind fallbacks the summary
table already defines — one vocabulary across all three surfaces, not a second.
The fallback is **flagged by presence**, not inferred from the rendered string,
so a user who literally types "Unnamed pricing event" still reads as named.

Empty-state `colSpan`s were updated on both tables; the Volume table's three
`colSpan` sites were deliberately left alone.

### 3. The tooltip, scope-filtered through a shared predicate

`eventScopeMatchesView(dims, view)` — one definition, and **the pricing apply
filter now calls it too**, replacing seven inline comparisons. That call site is
what proves the predicate behaves identically to the arithmetic it replaced;
without it the tooltip would be a second implementation, which is exactly the
`scenarioHelper` mistake.

**The rule for partial application: a view broader than the event STILL lists
it**, because the event genuinely moves part of what is on screen. Hiding
anything that does not apply wholly would hide precisely the events whose
partial effect is hardest to account for. Asserted, so it is a decision rather
than an accident.

The tooltip filters against **`cohortScope`**, matching what the chart is
actually scoped to.

**Market and yield apply-filters still hand-roll their comparisons.** Their
carriers have different dimension sets and different field names (`e.channel`
vs `e.channelL1`), so converting them is a larger change than this session's
scope; the tooltip normalises each carrier's dims at the call instead. Recorded
rather than left implicit.

### 4. The Outflow Ref line

Was 1.5px, `3 6` dash — close enough to Baseline (solid 2px) and Adjusted
(`5 5` 2px) to be mistaken for a series, which is exactly what happened on a
gated walk. Now 1px, `1 7`, 55% opacity: unmistakably an annotation.

**Default visibility unchanged**, as instructed — whether it should show by
default is a product call and was not taken.

## 5. Guard-traps 76 and 77

- **76** reverts the snapshot to the cohort-scoped series. The number stays
  plausible — a real ARPU for a real slice, just not the event's — which is why
  a trap is needed rather than a reader.
- **77** removes the scope filter from the pricing apply path: every pricing
  event applies to every slice. That is the `scenarioHelper` divergence
  reproduced on the side that currently gets it right, and it proves the shared
  predicate is load-bearing rather than decorative.

## 6. AN INCONSISTENCY I INTRODUCED — decision needed

**Preview Impact is still cohort-scoped; the saved row is now event-scoped.**

For an event narrower than the loaded cohort, the baseline previewed before
saving and the baseline shown in the row afterwards will now **differ**. Before
this session they agreed — both were wrong in the same way.

I did not change Preview because the cost is real: Preview recomputes on every
keystroke, and `computeAdjustedForecast` over the event's slice is a full
pipeline run. Doing it unmeasured, inside a render, would be the kind of change
this programme keeps paying for.

**Three options, none taken:**

1. **Memoise an event-scoped preview series** keyed on the draft's dims + month.
   Correct and consistent; costs a memo and a re-run whenever the dims change.
2. **Leave Preview cohort-scoped and label both** — "effect on the current view"
   vs "effect on this event's slice". Cheap, honest, two different questions
   answered plainly.
3. **Leave as-is.** Rejected as a default: it is precisely the silent
   disagreement between surfaces this arc has spent four sessions removing.

This is flagged rather than resolved because it is a cost/meaning trade-off, not
a defect with one right answer.

## 7. Two more expectations of mine, corrected by the run

- I asserted the save handler's `chartData.find(...)` string would be **gone**.
  It is not — **Preview Impact still uses it, legitimately**. Re-aimed to a
  count of **1** with the survivor named.
- I asserted **2** `whatif_summary_col_name` headers. There are **3**: the R4
  summary table's own is the third, and reusing its key across all three is the
  whole point.

Both were wrong expectations against correct code, both corrected with the
reason recorded in the spec. That is now four such corrections across this arc;
they are cheap when the run catches them and expensive when a number is quietly
adjusted to make a check pass.

## Gate

```
pricing-roundtrip spec:  94 passed, 0 failed   (was 78 — 16 new checks)
events-summary spec:     37 passed, 0 failed
mix-card spec (mounted): 99/99 passed          (untouched — no regression)
event-roundtrip spec:    69 passed, 0 failed
yield-roundtrip spec:    35 passed, 0 failed
guard-traps:             75/75 caught          (76 and 77 caught first run)
lint (tsc --noEmit):     clean
build:                   clean, 10.04s
```

## Where things stand

**All four items landed**; nothing was shed. Item 1's stop condition was checked
first and did not fire.

**Open:**

- **Preview Impact's scope** (§6) — decision needed.
- The **market and yield apply-filters** still hand-roll scope comparisons.
- `scenarioHelper` still ignores `target`/`cohortScope` entirely — unchanged,
  and now diverging further from a What-If side that keeps getting more correct.
- `spec:yield-roundtrip`'s `toRow` is still a copy; `yieldArpuMode` still not
  restored on reopen; R5's compounding limit still unmeasured.

## Limits of this check

**Nothing here is mounted.** The pricing card still has no mounted harness, so
the Name cells, the tooltip's filtered list and the Ref line's new treatment are
**source-read**; the predicate, the snapshot wiring and the label reuse are
machine-checked at the function and source level.

**The event-scoped baseline's VALUE is not measured against a fixture.** The
spec pins that the pipeline is invoked with the event's dims and that the edited
event is excluded — it does not assert a numeric baseline for a constructed
event, which would need the forecast pipeline in the spec. Two differently-scoped
events producing *different* baselines is therefore pinned structurally
(different inputs to the same function) rather than numerically. Guard-trap 76
is what makes that pin bite.
