# PROSPECT — Scenario Planning Connect: Delivery Backlog

Source: Scenario Planning Connect workshop (Alessandro Russo, Marcel Wiegand,
+ strategic input). This file is the working backlog for Claude Code. Work it
phase by phase, in order. Each phase is built on its own branch and only
merged to main once the agent gate passes.

---

## Guiding principle (from the session)

> "It's not a forecasting tool. It's a simulation tool. Let's get the
> simulation 100% correct before expanding into forecasting analytics."

Simulation fidelity is the priority. Keep changes focused on making scenario
planning richer and more usable. Do not expand forecasting-analytics
sophistication as part of this work.

---

## Branch strategy (READ FIRST)

**One branch per phase. Never straight onto main. Merge only after the agent
gate passes and you have reviewed.**

- Each phase branches off the current main.
- Build the whole phase on its branch.
- Run the agent gate (below) on the branch.
- Merge to main only when regression-guard returns SAFE FOR USER TESTING.
- The next phase branches off the newly-updated main, inheriting prior work.
- main stays continuously deployable throughout.

**Serial dependency:** the tariff-mix phase depends on the tariff-dimension
phase. Do NOT cut the mix branch until the dimension branch has merged to
main, or you will be building on a main without tariffs.

**AI constraint:** main is under the AI-approval hold. Every branch here must
stay AI-free. None of these items are AI features; regression-guard must
confirm "no AI capability present" before each merge.

**Branches, in merge order:**
1. `campaign-workspace`      (Phase 1 — P1, P2, P3)
2. `tariff-dimension`        (Phase 2a — tariff as a full forecast dimension)
3. `tariff-scenarios`        (Phase 2b — tariff targeting + mix selector)
4. `scenario-refinements`    (Phase 3 — P4, P8, P10)

---

## The agent gate (run on every phase)

**Before building** (once per phase, before any code):
- `dependency-mapper` — map everything the phase touches; separate "safe to
  change" from "shared, must not break". Review its output before building.

**After building** (in this order):
- `ui-consistency` — new UI matches established patterns.
- `qa-tester` — full end-to-end test against `test-data/EXPECTED.md`.
- `regression-guard` — full checklist + "no AI present" + SAFE verdict.

If anything fails: `debugger` to root-cause, fix, then re-run the gate.

**Keep `test-data/EXPECTED.md` updated** as each phase lands — new dimensions,
new behaviours, new expected values. The agents are only as good as that file.

---

## Validation status

Phase 1 (P1-P3) and Phase 2 (tariff) are confirmed ready to build — the design
decisions are resolved (see notes per item). Phase 3 items P4/P8 are small and
clear; **P10 is a research spike, not a committed build.**

The requirements pack was compiled by Copilot from the session. Before starting
Phase 3, do a light confirmation pass with Alessandro and Marcel that the items
still match intent. Phases 1 and 2 are safe to start now.

---

# PHASE 1 — Editable Campaign Workspace
**Branch:** `campaign-workspace` (off main)
**Items:** P1, P2, P3 — tightly coupled, build together.
**Independent of the tariff work.**

Turns Market Events from create-only into a managed, named, multi-campaign
workspace.

### P1 — Edit existing market events
**What the user wants:** refine a previously created event without recreating
the whole scenario.
**Acceptance criteria:**
- Existing events are visible in a list/table.
- User can select an event and reopen its full assumptions (volume
  distributions, percentages, IBRO targeting).
- Edits save back into the scenario and the adjusted forecast recalculates
  immediately.

### P2 — Event-centric scenario management
**What the user wants:** manage events grouped by campaign name, not as a flat
list of lines.
**Design decision (RESOLVED — updated in delivery):** consolidated on **campaign
name as the single grouping identifier**. The separate "event name" concept was
removed — the old Event Name input is gone from the volume/market-events form,
and campaign name is now both the display label and the group-edit handle.
Individual-line editing and campaign-level (group) editing both work. (Pricing
and Yield event forms keep their own Event Name field; only the volume
market-events flow changed.)
**Acceptance criteria:**
- Events can be grouped and identified by campaign name (the sole grouping key).
- User can navigate from a campaign summary to its underlying assumptions — the
  campaign badge reopens the spread form; individual rows remain editable.
- Multiple campaigns are manageable without losing track of which is which.

### P3 — Multiple concurrent campaigns
**What the user wants:** many simultaneous campaigns in the same period
("there will be 10, 20, whatever").
**Acceptance criteria:**
- Multiple campaigns can exist for the same month.
- Campaigns stay distinguishable in tables and charts.
- No practical single-campaign limit.
- **Naming is crucial** — enforce clear, unique, sensible campaign names.

**Phase 1 dependency notes for the dependency-mapper:** editing events touches
ForecastContext (event storage), the market events table, the adjusted-forecast
recalculation path, the Actuals Review "Include Market Events" toggle, and
session export/import. Confirm edits merge rather than duplicate, and that the
adjusted forecast recalculates for the edited cohort only.

---

# PHASE 2a — Tariff as a Full Forecast Dimension
**Branch:** `tariff-dimension` (off main, AFTER Phase 1 merges)
**Confirmed:** tariff IS present in historical actuals, so it is a full forecast
dimension (parse → key → forecast → score → export), exactly like Product L2.

### Structure (confirmed)
- **Tariff L1:** RED S, RED M, RED L, RED XL, RED ULTD (synthetic; real data
  cardinality unknown — must be data-driven, not hardcoded).
- **Tariff L2:** With Handset, SIM Only.
- Hierarchical, mirroring Product L1/L2 and Channel L1/L2 exactly.

### Build (mirror the Product L2 pattern)
- Parse Tariff L1/L2 from the data; types updated; **read cardinality from the
  data, never assume the number of tariff values.**
- Extend cohort store keys to include tariff L1/L2 with `All` placeholders.
- Add Tariff to the hierarchical dropdown tree (4th dimension) — same component,
  same L1-includes-children / L2-narrows logic.
- Add Tariff L1/L2 to the Historical Accuracy GROUP BY (same hierarchy rules).
- Thread tariff through the forecast engine, MAPE/scoring, export/import.
- **Auto-balancer awareness:** the auto-model-selection and auto-confidence
  features now in main must correctly handle tariff-level cohorts. Flag to the
  dependency-mapper explicitly.

### Acceptance criteria
- Tariff behaves identically to Product/Channel across all three steps.
- Forecasts and accuracy scores work at tariff level.
- Real-data cardinality is handled gracefully (no hardcoded 5).
- All previously-fixed issues still hold (ARPU scoring, Base-from-file, etc.).

---

# PHASE 2b — Tariff Scenarios: Targeting + Mix
**Branch:** `tariff-scenarios` (off main, AFTER Phase 2a merges)
**Items:** P6, P7, P5 (combined), plus the tariff selection control.

### P7 — Tariff targeting for price rises / events (RESOLVED)
**Design decision:** tariff does NOT replace product/channel. It is an
additional dropdown that composes with them. User leaves Product and Channel as
`All` and selects a specific tariff to target a price rise at, e.g. "all RED L
customers regardless of product/channel".
**Acceptance criteria:**
- Tariff is selectable as a scenario dimension alongside product/channel.
- A price rise / event can be scoped to a tariff with product/channel left All.
- Impacts flow through to the adjusted forecast correctly.

### Tariff selection / scoping control (NEW — protects against unknown data)
**What the user wants:** with 10-15 possible tariffs in real data, the UI must
not render them all by default.
**Design decision (RESOLVED):**
- **None selected by default.** User is prompted to select the tariffs they
  care about.
- Menu has **select-all and multi-select** capability.
- Deselected tariffs are excluded from the mix control AND the auto-balancer.
- Selection is per-scenario and persists in export.
**Acceptance criteria:**
- Nothing renders until the user selects tariffs.
- Multi-select and select-all both work.
- Mix and auto-balancing consider only selected tariffs.
- When tariffs are deselected, remaining mix percentages still total 100%.

### P6 + P5 — Tariff mix + combined volume/pricing (RESOLVED)
**Design decision:** value mix and tariff mix are **separate, independent
axes** — NOT a cross-product matrix. Value buckets (Low/Med/High) and tariff
buckets correlate organically in the business (RED S/M ≈ Low value); the planner
understands this and does not want to specify a tariff×value matrix.
**Mix control becomes a dimension selector with dynamic buckets:**
- Select axis: **Value** (3 fixed buckets: Low/Med/High) or **Tariff**
  (N buckets = the tariff values the user has selected).
- Distribute the mix across whichever axis's buckets are shown.
- Both mix types continue to exist; user picks per scenario.
- Combined scenario (P5) = volume assumption + a mix/pricing assumption applied
  together; outputs reflect combined impact.
**Acceptance criteria:**
- Dimension selector switches the mix control between value and tariff axes.
- Tariff axis renders one bucket per SELECTED tariff (dynamic count).
- Percentages validate to 100% on whichever axis is active.
- Volume and pricing/mix assumptions can coexist in one scenario.
- No tariff×value matrix is created.

**Open UX detail (non-blocking):** default state of the tariff mix selector when
a scenario opens — confirm with Alessandro, or resolve with `ux-design`.

---

# PHASE 3 — Refinements & Spike
**Branch:** `scenario-refinements` (off main, after Phase 2b merges)
**Confirm P4/P8/P10 with Alessandro/Marcel before starting.**

### P4 — Auto-populate ARPU for volume-only scenarios
Refinement of existing cohort-average ARPU logic. If revenue/ARPU is omitted
from a volume scenario, use the cohort average as a transparent placeholder so
ARPU is not artificially diluted. Keep deterministic (no AI framing).
**Acceptance:** volume-only scenarios stay valid; ARPU not diluted; default is
visible to the user.

### P8 — Simplify technical model visualisations
Hide/collapse the fitted-model pyramid and similar technical diagnostics so the
UI stays business-focused. Keep them available behind a toggle, not removed.
Aligns with the "simulation tool, keep it simple" steer.
**Acceptance:** technical diagnostics hidden by default; retrievable if needed;
business workflow uncluttered.

### P10 — Exclude one-off historical events (BUILD COMPLETE — pre-merge gate pending)
**Spike branch:** `spike-oneoff-events` (investigation only, no code shipped).
**Build branch:** `oneoff-events` (off main, after this spike).

**Problem:** a one-time anomalous historical month (e.g. a VW fleet update
that added a large block of subscribers in a single month) gets learned by
Holt-Winters as if it recurs every year — it distorts the fitted seasonal
indices, the level/trend, and the confidence-band width, biasing every future
forecast for that cohort.

**Root-cause finding:** in `src/utils/forecasting.ts`, `initHWTriple` seeds the
seasonal index array from the first 12 observations; `fitHWTripleParams`/
`hwTripleResiduals` then reinforce whichever calendar slot the anomaly falls
in on every subsequent occurrence — there's no way for the recursion to tell
"this month is always big" from "this month had a one-off event." The same
anomalous residual also inflates `sigma` (confidence-band width) and, via
`analyzeAndRecommendConfidence`'s independent detrended-SD calculation, biases
the auto-confidence system toward an unnecessarily wide "Cautious" profile.

**Options assessed — recommendation: Option B.**
- *Exclude entirely* (drop the point): breaks the array's calendar-slot
  alignment (`(calStartMonth + i) % 12` is position-based, not date-based) —
  needs reindexing downstream, an easy-to-get-wrong second fix layered on the
  first.
- *Down-weight* (partial-strength update): not a real third option in this
  specific recursive-smoothing formulation — a fractional weight collapses
  exactly to Option B at weight 0, and to today's behaviour at weight 1. No
  existing weighting primitive to hang it off; new machinery for a case
  Option B already covers.
- **Replace with a trend/seasonal-consistent value, for fitting purposes
  only (Option B — chosen).** Same-calendar-slot-in-adjacent-cycles, scaled
  by observed trend — not naive interpolation between neighbouring months,
  which would understate a flagged peak-season month by anchoring to its
  lower-value neighbours. Neutralises the anomaly's effect on level, trend,
  seasonal index, and confidence bands, without touching array length or
  calendar alignment. Displayed/exported/actuals-review values are untouched
  — only the number the optimiser sees changes.

**Architecture finding — single injection point:** `buildCohortDataMap` is
the one shared aggregation function every consumer (`calculateBaseForecast`,
`analyzeAndRecommendModel`, `analyzeAndRecommendConfidence` — called
independently from both the bulk-generation worker and the manual-generation
path in `StandardForecastTab.tsx`) derives its historical series from. The
substitution must be applied exactly once, immediately downstream of
`buildCohortDataMap`, so all four consumers see the cleaned series
automatically. Implementing it separately per call site is the exact
"must-apply-everywhere" drift risk this project has repeatedly hit
(`scenarioHelper.ts`'s divergence from `WhatIfTab.tsx`'s Pass 1/2/3 being the
precedent).

**Interaction check:**
- Gap detection (`missingMonths`) checks calendar-month *presence* in the
  data, never values — unaffected by Option B since the flagged row is never
  removed, only its fitting-time value substituted. (A point in favour of B
  over "exclude": excluding would risk double-counting the same month as
  both a deliberate flag and a data gap.)
- Auto model selection and auto-confidence must read the *same* cleaned
  series the fit uses (falls out for free from the `buildCohortDataMap`
  injection point) — otherwise the recommendation and the fit would disagree
  about what the data looks like.
- Accuracy scoring (`calculateForecastVsActualsVariance`) compares
  forecast-horizon months against actuals, not the historical training
  window — no direct interaction with a flag on a past month. Indirect
  effect: forecast means/bands will shift once a one-off is flagged, so
  MAPE/in-band scores for affected cohorts should be spot-checked, but no new
  handling is needed there.

**Build sequencing — Stage 1 gated Stage 2 — both complete.**
1. **Stage 1 (DONE):** `substituteOneOffValue` implemented in isolation and
   proven numerically against a real seasonal cohort (MNC | Mobile Voice |
   Indirect, seasonality strength 0.689) — a synthetic spike distorted the
   fit severely (seasonal index +18.6%, mse 286→1.76M), flagging + substitution
   recovered it within 0.24%/0.96% of the pre-injection baseline. See
   `EXPECTED.md` §15 for the full numbers.
2. **Stage 2 (DONE) — architecture correction from the original plan:**
   `buildCohortDataMap` turned out NOT to be the right injection point — it
   only buckets raw rows by cohort; the actual monthly-IBRO aggregation is
   duplicated inline at 6+ sites in `App.tsx` plus the worker. Rather than
   touch every duplicated aggregation block, the substitution was wired
   into `calculateBaseForecast` itself (a new optional trailing
   `flaggedMonths` parameter, applied once internally) — every one of its
   callers benefits with zero duplication, since they all already converge
   on this one function. `analyzeAndRecommendModel`/`analyzeAndRecommendConfidence`
   don't share that code path, so they're wired at their own 3 call sites via
   a second shared helper (`applyOneOffFlagsToSeries`) — still exactly one
   implementation of the substitution logic, just two entry points into it.
   - Storage: `oneOffMonths` cohort-keyed state map in `App.tsx` (same
     precedent as `forecastStore`).
   - `One_Off_Months` export sheet + import branch (same precedent as
     `Yield_Events`/`Pricing_Events`).
   - Small collapsed-by-default form in `StandardForecastTab.tsx` near
     Generate Forecast (sized like the Pricing Event form) — month picker
     scoped to the selected cohort's own history, optional reason, a
     transparency line ("File value: X · Model will use: Y") computed live
     from the same substitution function, and notation that flagging both
     cleans the fit and tightens confidence bands.
   - Known, deliberate scope limit: the legacy single-metric
     `calculateHoltWinters` bulk-gen path (and its own recommendation calls)
     is left unwired, for the same reason `computeWhatIfData`'s legacy ARPU
     fallback was left alone in Phase 3 — avoiding regression risk in a path
     already superseded by the IBRO-combined `calculateBaseForecast` path.

**Acceptance criteria — all met, see `EXPECTED.md` §15 and checklist items 28-31:**
- A flagged one-off month's fitting-time value is derived from the same
  calendar slot in adjacent cycles, scaled by observed trend — never a naive
  neighbour-average.
- The substitution logic is implemented exactly once (`substituteOneOffValue`,
  wrapped by `applyOneOffFlags`/`applyOneOffFlagsToSeries`); manual
  generation, bulk generation, auto model selection, and auto-confidence all
  reflect a flagged one-off consistently.
- Displayed, exported, and actuals-review values are byte-identical to the
  source file regardless of flagging — only the optimiser's input changes.
- Gap detection, `calculateBaseForecast`'s core math, and existing
  MAPE/accuracy scoring are unaffected for any cohort with no flags.
- Flags persist through full session export/import.

---

# PHASE 4 — Custom Promotion Card
**Branch:** `custom-promotion-card` (off main, AFTER Phase 3 merges)
**Depends on:** Phase 2b (tariff targeting + selection control) — merged.
**Nothing depends on this. Run BEFORE the P10 spike.**

A fourth Market Events card for combined promotion scenarios. Not a superset of
the other three — it is specifically the *combined* case: one promotion,
anchored on a volume movement, optionally carrying a value-mix arm and/or a
pricing arm. Supersedes and expands P5 from the original requirements pack.

### What the user wants
Plan a promotion on a specific tariff with an ambition to acquire or retain a
volume of subscribers, optionally on a particular mix and/or price promotion.

### Structure
- **Volume — mandatory, always present, cannot be deselected.** The user selects
  the volume target: **Acquisition (Inflow)** or **Retention** — one per promo.
  A campaign impacting both = two promo cards sharing a campaign name (Phase 1
  grouping handles this).
- **Value mix — optional, independent checkbox. Available for BOTH volume
  targets.**
- **Pricing — optional, independent checkbox.**
- Value and pricing are **and/or — use CHECKBOXES, NOT radio buttons.** Both may
  be active together; either may be used alone; neither is also valid (volume
  only).

### Scoping rules (the core behavioural contract)
Everything inside the promo card scopes to the promo volume only — never the
standing base.

- **Mix skew — acquisition:** describes the composition of the incoming volume.
  Who you bring in. Does not re-mix the existing base.
- **Mix skew — retention:** describes the terms the retained volume is
  re-contracted on, which may differ from those subscribers' previous terms
  (tariff up or down, product mix change — e.g. more data connections, fewer
  voice). **Retained subscribers can therefore change ARPU band.** The retained
  volume's blended ARPU must reflect its NEW composition, not its previous one.
  This is a band-shift calculation, distinct from the acquisition case where
  blending handles incoming volume. The untouched base is not re-mixed.
- **Pricing arm:** applies to the promo volume only — a promo price for the
  acquired or retained subscribers, applied via cohort-weighted ARPU blending.
  It never shifts base ARPU. Base-wide price rises remain the job of the
  existing pricing card.

### Reuse (do not reimplement)
- **Tariff targeting + tariff selection control** — exactly as built in Phase 2b.
  Promo scopes to a tariff, composing with Product/Channel left as `All`.
- **IBRO event mechanics** — Inflow lag (volume appears in Inflow at T, Base at
  T+1) and Retention dual-impact (+retention / −outflow) as they exist today.
- **Ramp / decay** — core capability on any volume requirement. Promo volume
  ramps; it does not land as a step.
- **Cohort-weighted ARPU blending** — for promo-priced and re-mixed volume.
- **Value-mix control** (Low / Medium / High axis).

### Guidance / notation (required)
Volume is mandatory here but optional elsewhere, so users need to know when to
reach for this card. Add in-UI notation explaining: use the Custom Promotion
card for combined scenarios anchored on a volume movement; use the individual
cards for single-dimension events (e.g. a pure base-wide price rise with no
volume assumption).

### Acceptance criteria
- Volume section always present and cannot be deselected; user selects
  Acquisition or Retention as the target.
- Value-mix and pricing are independent checkboxes — both, either, or neither.
- Mix arm is available for both Acquisition and Retention, with the correct
  distinct semantics for each.
- Acquisition-with-mix and Retention-with-mix produce **distinguishably
  different ARPU outcomes on the same inputs** — if identical, the two semantics
  have been conflated.
- Mix skew and promo pricing apply to the promo volume only; the standing base
  mix and base ARPU are untouched in all cases.
- Promo scopes to a tariff via the Phase 2b selection control.
- Volume ramps/decays per existing capability; IBRO node mechanics (Inflow lag,
  Retention dual-impact) behave as they do for existing events.
- In-UI guidance explains when to use this card vs the other three.
- Adjusted forecast reflects the combined impact correctly.
- Promo persists correctly through session export/import.
- Existing three cards behave exactly as before.


---

# P11 — Strategic guardrail (not a task)
Keep the programme focused on simulation fidelity over forecasting analytics.
Use this as a scope check when tempted to add model sophistication: if an idea
serves simulation richness, it fits; if it serves forecasting-analytics depth,
it is out of scope for this programme.

---

## Working order summary

1. `campaign-workspace` → gate → merge (P1, P2, P3)
2. `tariff-dimension` → gate → merge (tariff as forecast dimension)
3. `tariff-scenarios` → gate → merge (targeting, selection control, mix)
4. Confirm P4/P8/P10 with the business
5. `scenario-refinements` → gate → merge (P4, P8; P10 spike separately)









Update `test-data/EXPECTED.md` after every merge.
