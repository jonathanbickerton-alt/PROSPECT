# PROSPECT — Expected Behaviour & Known-Good Reference

This file is the source of truth for the qa-tester, debugger and
regression-guard agents. It captures known-good cohort values and the
correct expected behaviour for every previously-fixed issue, so the agents
can assert against concrete facts rather than vague impressions.

> **Maintenance note:** Values marked `(confirm)` should be verified against
> the current synthetic data file before relying on them. Update this file
> whenever a new bug is fixed so the regression checklist stays complete.
>
> **When a measurement supersedes a hypothesis, correct the LEAD — do not
> append the correction underneath it.** Readers, human and agent, stop at the
> first assertion. Worked example: §16b's share-scaled subsection opened by
> stating the path was "still reachable, for a narrower case", and reported the
> measurement showing it never fires thirty lines further down. A
> regression-guard run then reported the path as live-but-narrow — it read
> top-down and stopped at the assertion. The agent was not careless; the
> ground-truth file misled it. Rewrite the heading and opening paragraph, and
> label the superseded hypothesis as superseded where it is still worth keeping.

---

## 1. Test data

- **Primary file:** `test-data/VBU_IBRO_Synthetic_ForecastTest_ProductL2_Full_Jan2023_Jun2026.xlsx`
  (42-month file; a Dec 2025 variant also exists but does not cover the full actuals range)
- **Historical data range:** Jan 2023 – Dec 2025
- **Actuals range:** through **June 2026** — nothing should plot beyond this
  for any actuals series

### The trimmed fixture — use this for routine agent runs

`test-data/VBU_IBRO_Trimmed_TariffHierarchy_Jan2023_Jun2026.xlsx`

**Not in git** — `.gitignore` excludes `/test-data/*.xlsx`, so no fixture is
tracked and this one follows that convention. Regenerate it from the full
tariff file with:

```
npm run build:trimmed-fixture
```

The generator (`scripts/build-trimmed-fixture.mjs`) IS tracked, and prints the
preservation table below on every run, so the fixture is reproducible and its
guarantees are re-asserted rather than trusted.

CLAUDE.md instructs routine agent runs to use a trimmed fixture and reserve
the full file for pre-merge validation. Until 2026-07-30 no trimmed file
existed — all four fixtures were 5–8 MB — so that instruction could not be
followed literally. This one closes that gap.

**12,432 rows (13.7% of 90,720), 74 leaves (of 540), 2.4 MB (of 8.3 MB).**

Built by selecting whole **leaf cohorts** and keeping every row of each —
never by sampling rows or months, which would break the time series and the
8-point minimum in `calculateBaseForecast`. It preserves:

| Property | Status |
|---|---|
| Section 4's reference cohort (Corporate · IoT Connectivity · Indirect) | **byte-exact** vs the full file — 2,016 rows, all 12 leaves |
| All 5 segments | yes, ≥2 leaves each |
| Tariff L1 values | 5 of 5 |
| Tariff L1\|L2 pairs | 10 of 10 |
| Months | 42 of 42 |
| The `RED ULTD` edge case | preserved: Large Enterprise and MNC still have **zero** rows under Mobile Voice / Direct while selling the tariff elsewhere |
| Corporate · Mobile Voice · Direct tariff canary rows | all 5 tariffs |
| Column schema and date format | identical (18 columns, `"2023-01"` strings) |

**What it does NOT preserve — read before measuring anything with it.**
The segment mix is deliberately unrepresentative: Corporate holds 35 of 74
leaves (47%) against 108 of 540 (20%) in the full file, because the reference
cohort and the tariff canaries are both Corporate. **Any rate expressed as a
fraction of all rows will therefore differ.** The section 16b coverage
measurement returns 57.9% here against 79.6% on the full fixture — the
structure reproduces exactly (0% fully generated, substantial with one segment
generated) but the magnitude does not. Re-derive any prevalence figure on the
full file; use this one for behavioural checks, not for rates.
- **Forecast horizon:** through Dec 2027 (24 months from forecast start)
- Almost every PROSPECT bug is data-dependent. Agents MUST load this file
  before testing — code-only reasoning will not reproduce most issues.

---

## 2. Dimension structure

**Customer Segment:** Corporate, Large Enterprise, MNC, SME, SOHO (+ `All`)

**Product L1:** Mobile Data, Fixed Connectivity, IoT Connectivity,
Mobile Voice (+ `All`)

**Product L2 (newly added):** High Value, Medium Value, Low Value (+ `All`)
— hierarchical child of Product L1

**Channel L1:** Direct, Indirect (+ `All`)

**Channel L2:** sub-channels of Channel L1 (+ `All`) — 9 confirmed values:
- Under **Direct** (5): `Field / Regional Sales`, `Inside Sales`,
  `Call Centre / Tele-sales`, `Strategic / Global Accounts`, `Digital Direct`
- Under **Indirect** (4): `Partner / Reseller`, `Distributor`,
  `Alliance / Strategic Partner`, `Wholesale / Agent`
- No `All` row exists in the raw data — `All` is a UI/key placeholder only

**Tariff L1 (Phase 2a):** RED S, RED M, RED L, RED XL, RED ULTD (+ `All`) —
5 confirmed values in the synthetic tariff file. **Cardinality is data-driven —
never hardcoded**; real data may hold 10–15 tariffs.

**Tariff L2 (Phase 2a):** SIM-only, With handset (+ `All`) — 2 confirmed values.
Hierarchical child of Tariff L1, mirroring Product L1/L2 and Channel L1/L2.

- **Tariff test file:** `test-data/VBU_IBRO_Synthetic_ForecastTest_TariffHierarchy_Jan2023_Jun2026.xlsx`
  (fact sheet `Fact_IBRO`, 90,720 rows; QC sheets `QC_TariffL1_Distribution`,
  `QC_TariffL2_Distribution`, `QC_Tariff_ARPU` give expected distributions).
- **Tariff columns:** `tariff_tier_l1` / `tariff_tier_l2` (note: NOT `Tariff_L1`).
  This file also uses `Product_L2_Value_Tier` and `Channel_Level_1/2`.
- **Cohort key (Phase 2a):** now 7-part —
  `Segment|ProductL1|ProductL2|ChannelL1|ChannelL2|TariffL1|TariffL2`. Tariff is
  APPENDED; old 5-part saves normalise to `All` on import. Absent tariff column ⇒
  `All` everywhere ⇒ keys are 7-part with `All|All` and behaviour is unchanged.
- Tariff appears as a 4th hierarchical dropdown in the Viewing bar, Step 1
  (Standard Forecast), Step 2 (What-If) and Scenario Compare, and as Tariff L1/L2
  checkboxes in the Historical Accuracy Group-by row — all shown ONLY when a
  tariff column is mapped.
- **Tariff cohorts must forecast and score exactly like Product/Channel cohorts.**
  A tariff-level cohort (e.g. Corporate · RED L · SIM-only) runs the full
  parse → key → forecast → MAPE/score → export path identically. Its ARPU sits in
  the correct product band and its MAPE/accuracy scores populate for tariff
  groupings just as they do for Product/Channel — never blank or zero purely
  because tariff is the grouping dimension.

**Hierarchy rules:**
- Selecting a Product L1 includes all its Product L2 children
- Selecting a Product L2 narrows to that specific sub-category
- Same logic for Channel L1 / Channel L2, and Tariff L1 / Tariff L2
- Cohort store key format is the 7-part appended key (see §2 above), e.g.
  `Segment|ProductL1|ProductL2|ChannelL1|ChannelL2|TariffL1|TariffL2` with `All`
  where a level is not specified — confirmed in `src/App.tsx:1373` (`makeForecastKey`)

---

## 3. Known ARPU levels by Product L1

ARPU clusters by product type. **Absolute levels are fixture-specific — the
invariants below are not.** Read both parts before asserting anything.

**CORRECTED 2026-07-30.** This section previously gave a single set of bands
(IoT ~3.3–3.4, Mobile Voice ~9.6–9.7, Mobile Data ~13.7–13.9, Fixed
~17.2–17.5, blended ~12.2–12.5) with no fixture attribution. Measured against
every fixture in `test-data/`, **only the IoT figure matches anything** — the
other four match no file present. They are stale, presumably from a data file
no longer in the repo. An agent checking Mobile Voice against ~9.6–9.7 would
have read 8.21 on the primary fixture and reported a regression that is not one.

### Measured values — volume-weighted rev/subs, all rows

| Product L1 | ProductL2 (both) | Tariff (both) | Trimmed |
|---|---|---|---|
| IoT Connectivity | **3.38** | **3.88** | 5.99 |
| Mobile Voice | **8.21** | **9.33** | 12.96 |
| Mobile Data | **11.60** | **13.45** | 34.87 |
| Fixed Connectivity | **14.44** | **15.81** | 38.33 |
| Blended (All) | **10.42** | **11.73** | 19.30 |

The Dec 2025 and Jun 2026 variants of each family agree to within 0.02, so one
column covers both. Restricting to `Base` rows changes nothing beyond the second
decimal — the blended and Base-only figures are the same to within 0.03.

### Invariants — these DO hold on every fixture, including the trimmed one

1. **Strict ordering:** `IoT Connectivity < Mobile Voice < Mobile Data <
   Fixed Connectivity`. IoT is always the lowest-ARPU product, Fixed always the
   highest.
2. **Blended (All) sits between Mobile Voice and Mobile Data.**
3. Every product ARPU is finite and strictly positive.

**Assert the invariants, not the absolute levels**, unless you have first
confirmed which fixture is loaded. A cohort key mismatch or an aggregation
pulling the wrong slice breaks the ordering, which is what makes it the useful
check.

### The trimmed fixture is NOT valid for absolute ARPU checks

Its product ARPUs are 1.5×–2.6× the full file's, because it holds 74 of 540
leaves and the surviving product/tariff mix is not representative. The
invariants above still hold on it; the levels do not. Use the full file for any
absolute ARPU assertion. (The *reference cohort* in section 4 is exempt — its
leaves were preserved whole, so its ARPU is byte-exact.)

---

## 4. Known-good reference cohort

**Corporate · IoT Connectivity · Indirect** (the cohort used throughout
debugging). 2,016 rows on every fixture in `test-data/`.

**CORRECTED 2026-07-30.** This section previously gave one unattributed set of
approximations while section 1 names four fixtures. Those figures correspond to
**ProductL2 Dec 2025**, with the flows as means over the last six months and
Base and ARPU as end-of-window levels — a basis that was never stated. Measured
on the tariff fixture the same cohort reads 3,696 and 34,927, so a session
working there would have seen a mismatch against ground truth and could
reasonably have concluded the app was wrong. Every value below is now measured,
and states which fixture and which basis it belongs to.

### Measured actuals — each value states its fixture and basis

Flows are given as **mean over the last 6 months / value at the last month**.
Base and ARPU are stocks, so only the last-month level is meaningful.

| Fixture | Last month | Inflow | Outflow | Retention | Base | ARPU |
|---|---|---|---|---|---|---|
| ProductL2 Dec 2025 | 2025-12 | 3,483 / 3,711 | 3,198 / 3,260 | 2,428 / 2,584 | **31,596** | **3.397** |
| ProductL2 Jun 2026 | 2026-06 | 3,699 / 3,758 | 3,388 / 3,470 | 2,583 / 2,627 | **33,460** | **3.445** |
| Tariff Dec 2025 | 2025-12 | 3,400 / 3,628 | 3,077 / 3,169 | 2,328 / 2,498 | **32,734** | **3.601** |
| Tariff Jun 2026 | 2026-06 | 3,665 / 3,696 | 3,300 / 3,384 | 2,513 / 2,520 | **34,927** | **3.488** |
| Trimmed Jun 2026 | 2026-06 | 3,665 / 3,696 | 3,300 / 3,384 | 2,513 / 2,520 | **34,927** | **3.488** |

The historic approximations (~3,450 / ~3,165 / ~2,390 / ~31,640 / ~3.3–3.4) are
the **ProductL2 Dec 2025** row. They are retained here only so a future session
recognises where they came from — do not assert against them without loading
that file.

**The trimmed fixture reproduces the tariff fixture exactly** for this cohort.
All 12 of its leaves were preserved whole, so the values are byte-identical, not
approximately equal. This is the one place the trimmed file can be used for
absolute assertions (contrast section 3, where it cannot).

### Invariants — these hold on any fixture

1. Every IBRO component scores **85+**; this cohort is stable and well-forecast.
2. **ARPU MAPE is near zero** and ARPU is never 0. A zero ARPU is always a
   defect — historically a cohort key mismatch or a grouping that lost the
   volume weighting.
3. No component shows a red or orange score.
4. Forecast tracks actual within a few percent on every series (<5% on the
   flows, <2% on Base, <1% on ARPU).

Assert these regardless of fixture. Assert the table's numbers only after
confirming which file is loaded.

---

## 5. Forecasting engine — expected behaviour

- Three models: **Holt Linear**, **Damped Trend**, **Holt-Winters** (true
  triple exponential smoothing with seasonality)
- Per-series grid search optimises α/β (Holt Linear), α/β/φ (Damped Trend),
  α/β/γ (Holt-Winters) — parameters differ per cohort
- Holt-Winters requires ≥24 data points; below that it falls back to Holt
  Linear with an amber UI warning (`seasonalFallback: true`)
- Confidence bands are derived from in-sample residual standard deviation,
  not a cosmetic proportional cone
- The What-If / Market Events engine uses the model stored in
  ForecastContext for that cohort — **never** a hardcoded Holt-Winters path
- Gap detection fires an amber warning on any cohort with missing months,
  on both the Baseline tab and the Market Events tab

### ARPU boundary correction
- On forecast generation, the ARPU forecast is anchored to the last
  historical ARPU actual via an offset correction
- Console log to confirm: `[ARPU boundary] lastActual=… rawFittedFirst=…
  offset=… correctionApplied=true`
- The first forecast ARPU value should equal the last actual ARPU value
- If the ARPU forecast jumps away from the last actual at the boundary, the
  correction has not been applied — likely because forecasts in the store
  predate the fix and need regenerating

---

## 6. Base — expected behaviour

- **Base actuals are read DIRECTLY from the uploaded file.** They are never
  derived from Inflow/Outflow for the actuals series.
- Base actuals must NOT extend beyond the last actual month (June 2026)
- Base derivation (`Base[t] = Base[t-1] + Inflow[t-1] - Outflow[t-1]`)
  happens ONLY in the forecast path, with the one-period lag
- If Base actuals appear in months beyond June 2026, the derivation is
  wrongly running on the actuals series — a regression

---

## 7. MAPE & accuracy scoring — expected behaviour

### MAPE cards
- Populate for every valid filter state without a row click being required
- `All` filters aggregate across all matching cohorts
- A specific cohort filter scopes to that cohort
- ARPU MAPE must be **non-zero** for:
  - Segment-only grouping
  - Segment + Channel L1 grouping
  - (these were both previously broken — high-priority regression checks)
- Actuals and forecast must be filtered at the SAME aggregation level —
  mismatched levels were the root cause of nonsensical scores

### Accuracy scoring model (Historical Accuracy by Cohort)
- **Primary driver:** absolute % deviation from the mean forecast, symmetric
  (over and under treated identically)
- **Secondary:** confidence band position — outside-band applies a small
  penalty (−5 if primary ≥65, −10 if primary <65) as an attention flag
- Approx primary scale: 0–1% dev → 95–100; 1–3% → 85–95; 3–5% → 75–85;
  5–10% → 60–75; 10–20% → 40–60; >20% → toward 0
- **Any actual within the confidence band should score 80+**
- Colour bands: 85–100 green, 70–84 amber, 50–69 orange, 0–49 red
- Directional labels: **Over** / **Under** / **—** (symmetric, colour-coded)
- Five components scored independently; Overall = mean of the five
- Per-cell tooltip shows month-by-month inputs (actual, mean, deviation %,
  in-band, monthly score) — these MUST match the monthly variance table
- Market Events toggle: Exclude (Baseline) vs Include (Adjusted); Adjusted
  always exists and equals Baseline when a cohort has no events

### Sanity check
A cohort whose monthly variance table shows all months in-band with
variances under ~2% should score **80+** on that component. A score of
36–65 for such a cohort is a bug (this was a real, repeatedly-hit issue).

---

## 8. Filters & navigation — expected behaviour

- Changing any filter NEVER triggers a re-forecast — filters are view-only
- Stored forecasts are never modified, cleared or overwritten by filtering
- Global filter bar and in-page COMPARING chips stay in sync
- Filters default to `All` on entering a step where that behaviour is set
- Clicking a cohort row in the accuracy table highlights it and scopes the
  chart ONLY — it must not change the filter bar or filter the table
- The accuracy table always shows all cohorts; it is never filtered by a
  row click or by the global filter

---

## 9. Session export / import — expected behaviour

- Export includes every data point: actuals, baseline forecasts, market
  events, adjusted forecasts, bulk generation history, model acceptance log,
  metadata — now including Product L2 and Channel L2
- Default filename: `PROSPECT Forecast Save — DD MMM YYYY HH:mm.xlsx`
- Import validates the file is a PROSPECT save, restores full state, and
  returns the user to the step they were on at export
- Cohort keys in the export include L2 and round-trip correctly on import

---

## 10. Remove Actuals — expected behaviour

- Period range + optional dimension filters select which actuals to remove
- Preview shows affected cohort-months before confirming
- Confirming removes matching rows from ForecastContext and recalculates all
  MAPE, scores and chart data reactively
- Removing all actuals shows a clear empty state, not silent zeros

---

## 11. Market Events — Campaign Workspace (Phase 1: P1/P2/P3)

Turns Market Events from create-only into a managed, named, multi-campaign
workspace. Applies to the What-If / Market Events tab (`WhatIfTab.tsx`).

### Data model
- The runtime `MarketEvent` (`src/utils/forecasting.ts`) carries a
  `campaignName: string` field (empty string = uncategorised). This is the
  single naming/grouping concept — the legacy `Event Name` input has been
  removed from the volume/market-events form (Pricing and Yield forms keep
  their own Event Name fields).
- Sign convention is unchanged and must round-trip: Outflow
  `subscriberVolume` (and customer/revenue/arpu) are stored **negated**;
  Retention is stored **positive**. Any edit path shows absolute values and
  re-applies `neg()` (= `-Math.abs`) only for Outflow on save.

### P1 — Edit existing market events
- Each table row has a Pencil (Edit) button. Clicking it loads that event
  into the form, shows an amber "Editing event" banner, and swaps the Add
  button for Save Changes / Cancel.
- Save patches the existing event in place via `updateMarketEvent(id, patch)`
  — it must NOT create a duplicate. Cancel resets the form and exits edit mode.
- The row being edited gets an amber ring highlight.

### P2 — Campaign grouping
- Form has a Campaign Name input. Table has a Campaign column (first column)
  showing a red-tinted badge for named campaigns, `—` for uncategorised.
- Table sorts by campaign name, then date.

### P3 — Multiple concurrent campaigns
- No practical limit on campaigns or events per month.
- Chart ReferenceLines are deduplicated per month; multiple campaigns in the
  same month join their labels with ` / `.
- Campaigns stay distinguishable in the table via the badge column.

### Campaign group edit (P1 completion)
- When a campaign is a homogeneous volume spread (all rows share
  scenario + segment + product/L2 + channel/L2 + contractLength, not a
  multi-month ARPU group, span 1–24 months), its badge becomes a button that
  reopens the spread form for the whole campaign.
- The spread is **reverse-engineered** from the stored rows: total volume =
  sum of abs values; duration = first→last calendar month span; per-month %
  = each row's share of the total (residual added to month 1); distribution
  detected as "Even" when every month is within 1 of the mean, else "Custom %".
- Save Campaign removes ALL rows whose `campaignName` matches the campaign
  captured at edit start, then appends the regenerated rows. A rename during
  edit must not orphan or duplicate rows (removal keys off the original name).
- Heterogeneous / multi-month-ARPU / >24-month campaigns are NOT group-
  editable: the badge is inert (dimmed, `cursor-not-allowed`, reason in
  tooltip) and rows stay individually editable.

### Export / import
- `Campaign_Name` round-trips through all paths: full session export/import,
  light forecast export, and data-file import.
- Legacy fallback on import: `campaignName = Campaign_Name || Name || ''`, so
  old saves (and old spreads that shared a `Name`) group correctly as campaigns.
- Light export now also carries `Name`, `Product_L2`, `Channel_L2`,
  `Contract_Length_Months` so a light export → data-file import round-trip
  does not silently drop those fields.

---

## 12. Tariff Scenarios (Phase 2b: P7 targeting + selection control + mix axis)

Uses tariff (from Phase 2a) for scenario work. All tariff scenario UI is shown
ONLY when a tariff column is mapped; tariff-free files are unchanged.

### P7 — Tariff targeting for events (volume + pricing)
- Tariff is an ADDITIONAL dropdown that COMPOSES with Product/Channel — it does
  not replace them. Leave Product and Channel as `All` and pick a tariff to target
  "all RED L customers regardless of product/channel".
- Volume market events and pricing events both carry optional `tariffL1/tariffL2`
  and expose a Tariff dropdown; a targeted event's impact flows into the adjusted
  forecast (matcher already compares event tariff vs the view).
- The targeting dropdown offers ONLY the user's selected tariffs (see below).
- Events table shows a Tariff column when a tariff column is mapped.
- `Tariff_L1/L2` round-trip through Market_Events (full + light export/import,
  data-file import) and Pricing_Events export/import, and Scenario Compare.

### Tariff selection / scoping control
- "Tariffs in scope" control on the What-If tab (`MultiSelectDropdown.tsx`):
  **none selected by default**; the user is prompted to select. A single
  compact trigger opens a searchable popover (search box + native
  `accent-[#e60000]` checkbox list + Select all / Clear) — this replaced an
  earlier chip-toggle row for aesthetic consistency with the rest of the app.
- Deselected tariffs are excluded from BOTH the tariff mix axis buckets
  (`yieldTierData`) AND the P7 targeting dropdowns (`targetTariffTree`).
  Deselecting a tariff already used in a draft event/mix clears it from that
  draft rather than silently keeping a stale hidden selection.
- Mix percentages always re-sum to exactly 100% after a deselection changes
  the bucket set — `draftMix` re-seeds to equal weights whenever the tariff
  axis's tier list changes (same mechanism as the Value axis).
- Selection persists in export (`Tariff_Selection` sheet + a `Selected_Tariffs`
  metadata count) and restores on import (optional sheet — old saves unaffected).
- **This selection constrains the MIX/scenario layer only.** Bulk model/confidence
  generation still enumerates ALL data-present tariffs — `allCohorts`,
  `generateAllMissingForecasts`, the worker split, `missingCount`, and the
  bulk-prompt trigger must NOT reference `selectedTariffs`. Phase 2a/bulk-gen
  cohort completeness stays intact (see item 19).

### P6/P5 — Mix dimension selector
- The yield mix control is a dimension selector: **Value axis** (Product L2
  tiers — data-driven, not hardcoded; 3 in the synthetic file: Low/Medium/High
  Value) or **Tariff axis** (one bucket per SELECTED tariff, dynamic count —
  up to 5 in the synthetic file: RED S/M/L/XL/ULTD).
- Percentages validate to 100% on whichever axis is active (reuses draftMix +
  slider auto-rebalance) — including immediately after a tariff is
  deselected while the Tariff axis is active. NO tariff×value matrix is
  created — draftMix is always a single flat `Record<string, number>` over
  one axis at a time, never a cross-product of both.
- Conditional default axis: prefer Value; fall back to Tariff only when Value has
  no usable buckets (null/All) AND tariffs are selected; else empty state. Manual
  axis toggles are respected (only auto-switches away from an unusable axis).
- The apply-pass is axis-agnostic (mix expressed as a ratio vs equal-weight
  baseline, anchored to forecast ARPU) — the value path is byte-identical to
  before. `mixAxis` round-trips in Yield_Events export/import.
- Naming: the existing YieldEvent fields `tariffMix`/`tariffBaseArpu`/
  `Tariff_Mix_JSON` are the VALUE mix (legacy naming); the `mixAxis` discriminator
  distinguishes value vs tariff — do not assume the field name means tariff.

---

## 13. Scenario Refinements (Phase 3: P4 auto-populate ARPU + P8 simplify diagnostics)

P10 (exclude one-off historical events) is a separate research spike, not part
of this phase — no build, no regression items here.

### P4 — Auto-populate ARPU for volume-only market events
Refinement of the existing cohort-average ARPU logic (WhatIfTab's Pass 2 Inflow-
pool fallback already avoided a hard dilution to zero, but silently, and used
the forecast's own blended ARPU rather than a historical average). Deterministic
— a trailing 3-month volume-weighted actuals average — **no AI framing**.

- Only applies to **Inflow** and **Retention** scenario events — the two that
  create an ARPU-bearing subscriber pool. Outflow and ARPU-scenario events are
  unaffected; an explicit non-zero ARPU the user typed always wins.
- The event form's ARPU field shows the computed average as a **placeholder**
  and an inline hint stating explicitly what will be used if left blank (the
  "default is visible to the user" acceptance criterion).
- If the user submits without overwriting it, the placeholder is **baked into
  the stored event exactly as if typed** — same value in the events table, the
  ARPU Δ column, chart tooltips, and export/import. No separate "live vs
  frozen" behaviour; downstream code never needs to know it was auto-populated.
- Applied at every event-construction site: single add (`addMarketEvent`), the
  volume spread builder, campaign group-edit save (both single and spread
  branches), and single-event edit-save — a missed site would silently produce
  an inconsistent result depending on which path created the event.
- Does **not** touch `calculateBaseForecast`, the ARPU boundary correction, or
  `computeWhatIfData`'s own (separate, differently-defined) "All Aggregated"
  fallback — confined entirely to event-construction time. ARPU MAPE/scoring
  math for existing cohorts must be byte-identical before and after.
- **Known, deliberate inconsistency (not a bug):** `computeWhatIfData`'s legacy
  cross-cohort fallback still uses its own trailing-average definition rather
  than the new shared helper — left untouched to avoid regression risk in the
  "All Aggregated" view; a candidate for a future unification, not this phase.

### P8 — Simplify technical model visualisations
Hides the Fitted Model Parameters table ("the pyramid" — α/β/φ/γ/MSE/σ per
series) behind a toggle, default collapsed, so the Step 1 business view stays
uncluttered. Nothing is removed — the table is one click away.

- Local component state in `StandardForecastTab.tsx`
  (`showTechnicalDetails`, default `false`) — not lifted to App/Context, since
  nothing outside the component consumes it.
- Toggle uses the app's existing rotating-chevron open/close idiom (same as
  `HierarchicalDropdown` / `MultiSelectDropdown`), not a new interaction pattern.
- **Explicitly OUT of scope, must remain always-visible regardless of the
  toggle:** the Holt-Winters seasonal-fallback warning (§5) and the
  missing-months gap warning (checklist item 11) — hiding either would be a
  real regression, not a simplification.
- **Explicitly OUT of scope, confirmed with the business:** Model Advisor and
  Confidence Advisor panels stay always-visible and untouched this phase (they
  carry a one-click "Apply Recommended" action, a different risk profile from
  a static parameter table).

---

## 14. Custom Promotion Card (Phase 4)

A fourth Market Events card for the *combined* case: one promotion, anchored on
a mandatory volume movement (Acquisition/Inflow or Retention), optionally
carrying an independent value-mix arm and/or pricing arm — checkboxes, not
radio buttons; both, either, or neither may be active. Composes existing
mechanics; does not reimplement them.

- **Volume is mandatory and cannot be deselected.** User picks Acquisition
  (Inflow) or Retention as the target; a promo affecting both is two cards
  sharing a campaign name (Phase 1 grouping).
- **Reuse, not reimplementation:** Phase 2b tariff targeting + selection
  control (same `HierarchicalDropdown`/`selectedTariffs` scoping), existing
  ramp/decay (the same percentage-distribution spread mechanism as Volume
  events), existing IBRO node mechanics (Inflow lag, Retention dual-impact,
  unchanged), the value-mix control (`computeTierData` — extracted from
  `yieldTierData` into a shared function so the Value tab and the Promotion
  Card's mix arm derive tier ARPU identically, sum(Revenue)/sum(Volume), never
  a name-matched ARPU column), and Phase 3 P4's cohort-weighted trailing-ARPU
  fallback (`computeCohortTrailingArpu`/`resolveEventArpuRevenue`) when the mix
  arm isn't used.
- **Scoping contract — promo volume only, standing base never re-mixed:**
  - *Acquisition + mix:* the promo's volume is genuinely new incremental
    subscribers — it becomes its own `EventPool` (same mechanism as any Inflow
    volume market event) at the mix-blended ARPU. Existing base pool and its
    ARPU are completely unaffected; total Base stock **grows** by the promo
    volume.
  - *Retention + mix:* the promo's volume represents **existing** subscribers
    being re-contracted onto new terms — it does **not** add to Base stock.
    A new engine path (`promoRebanded` on `MarketEvent`) carves this volume out
    of the standing base pool into its own isolated pool at the mix-blended
    ARPU, in the same month as the event (no T-1 lag, unlike Inflow). A plain
    Retention promo with *neither* arm active leaves `promoRebanded` unset and
    behaves exactly like an ordinary Retention event (existing base-pool/
    `applicableRetentionYield` mechanism, untouched).
  - **Acceptance check:** identical volume + identical mix inputs must produce
    *different* outcomes for Acquisition vs Retention — Base stock grows for
    Acquisition and stays flat for Retention, and the resulting blended ARPU
    differs (verified against real tariff-file tier ARPUs: Acquisition
    10.6717 vs Retention 10.7888 on the same 50,000-base / 5,000-promo / Low10-
    Med20-High70 mix inputs). If they ever come out identical, the two
    semantics have been conflated — this is the single highest-risk regression
    for this feature. **Scope assumption:** those two ARPU figures assume a
    *leaf-targeted* promo, where the leaf receives the full 5,000 promo volume.
    Under an **aggregate-targeted** promo the leaf receives only its pro-rata
    volume share (see §16), so the blend inputs differ and these exact numbers
    do not apply. The Acquisition-vs-Retention *distinguishability* still must
    hold at either scope — that is the actual invariant being checked.
  - **Pricing arm:** a promo price (% or absolute) layered on top of whichever
    base ARPU was chosen (mix blend, or the P4 cohort-average fallback) —
    computed once at event-creation time and baked into the stored event's
    `arpu`/`revenue`, exactly like every other event-construction path. Never
    shifts base ARPU; for Inflow this needs zero new pool-creation logic (the
    existing revenue÷volume pool-ARPU derivation already reads the pre-baked
    value); for Retention it flows through the same new `promoRebanded` pool.
- **In-UI guidance:** a fixed line under the tab switcher explains when to use
  Promotion (combined scenario anchored on a volume movement) vs the three
  single-dimension cards (e.g. a pure base-wide price rise with no volume
  assumption).
- Promo-created events are plain `MarketEvent` rows (`isPromotion: true` is a
  display-only marker for the Promotion tab's own event list) — they also
  appear in the Volume tab's existing table, unchanged.
- **Edit parity with the other three cards:** the Promotion tab's own table
  has the same campaign-badge-as-group-edit-trigger and per-row edit button as
  the Volume tab. Editing restores the mix arm's percentages and axis
  (`promoMix`/`promoMixAxis`) and the pricing arm's mode/amount
  (`promoPricingMode`/`promoPricingAmount`) — fields stored purely for
  edit-restoration; the engine never reads them, only the already-resolved
  `arpu`/`revenue`. Add, Save Edit, and Save Campaign all route through one
  shared builder (`buildPromoEvents`) so the mix-blend/pricing-delta/
  cohort-average resolution logic exists in exactly one place.
- **Campaign-name isolation between cards (fixed after qa-tester flagged it):**
  campaign names may deliberately be reused across cards (Phase 1's own
  design — e.g. one real-world campaign = an Inflow promo + a Retention promo
  sharing a name), so grouping is scoped by card rather than by forbidding
  reuse. `campaignGroups` (Volume tab) and `promoCampaignGroups` (Promotion
  Card) are two independent memos built by a shared `groupByCampaign` helper,
  each pre-filtered to only their own card's rows (`!e.isPromotion` /
  `e.isPromotion`). The two cards' Save Campaign handlers filter their replace
  set the same way (`e.campaignName !== X || e.isPromotion` and the mirror
  image), so a Volume campaign and a Promotion campaign sharing a name are
  structurally two different groups — editing/saving one can never see, and
  so can never overwrite, the other's rows, however similar the name.
- Round-trips through full session export/import: `Is_Promotion` and
  `Promo_Rebanded` columns added to the `Market_Events` sheet (the lighter
  "Download Forecast" / Import-Actuals round-trip was already partial before
  this phase — it never carried Yield/Pricing events either — and is
  unaffected, not extended, by this change).
- Does **not** touch `calculateBaseForecast`, `computeWhatIfData`, or any
  existing Inflow/Outflow/ARPU event-pool logic; the only new engine code is
  the additive `promoRebanded` Retention-pool block, inserted before the
  existing pool-sum-consistency step so it composes with (rather than
  bypasses) the pre-existing churn/contract-length machinery.

---

## 15. One-Off Historical Event Exclusion (P10)

Lets a planner flag an exceptional historical month (e.g. a one-time bulk
subscriber load-in) so Holt-Winters doesn't learn it as a recurring seasonal
pattern. Two stages, the second gated on the first passing review.

### Stage 1 — the substitution heuristic (proven in isolation first)
`substituteOneOffValue(y, flaggedIdx)` in `src/utils/forecasting.ts` derives
the flagged month's fitting-time replacement from the **same calendar slot in
adjacent cycles, scaled by observed trend** — the midpoint of the prior- and
next-year same-slot values when both exist; growth-rate extrapolation from
the two most recent same-slot values when only one side does. Never naive
neighbour interpolation, which would understate a flagged peak-season month.

Proven against a genuinely seasonal real cohort (MNC | Mobile Voice | Indirect,
Inflow, seasonality strength 0.689) before any wiring: injecting a synthetic
+3,200 one-off spike into a flat month distorted the fit severely (seasonal
index at that slot +18.6%, mse 286→1.76M, σ 0.0033→0.2055, trend sign
flipped). Flagging the month and substituting recovered the fit within 0.24%
RMSE on seasonal indices and 0.96% on the 6-month forecast vs. the
pre-injection baseline.

### Stage 2 — wired in, storage, form, export
- **Single injection point for `calculateBaseForecast`:** a new optional
  trailing `flaggedMonths?: ReadonlySet<string>` parameter. The substitution
  (`applyOneOffFlags`, all 8 IBRO fields independently) is applied once,
  immediately after `sorted` is built, before any fitting happens — every one
  of `calculateBaseForecast`'s callers (6 in `App.tsx` — manual generation,
  aggregate-scope generation, AutoML challenger preview and re-run, worker's
  own IBRO path — plus the bulk-generation worker) gets the cleaned series
  automatically. Omitting the parameter is byte-identical to before P10.
- **`analyzeAndRecommendModel`/`analyzeAndRecommendConfidence`** don't share a
  code path with `calculateBaseForecast`, so they're wired separately at their
  3 call sites (`StandardForecastTab.tsx`'s `actualValuesDetail`, and both the
  Standard-cohort and IBRO paths in `forecasting.worker.ts`) via
  `applyOneOffFlagsToSeries` — but call the identical `substituteOneOffValue`
  logic, never a re-implementation. Recommendation and actual fit always see
  the same cleaned series for a flagged cohort.
  - **Known, deliberate scope limit (not a bug):** the *legacy* single-metric
    `calculateHoltWinters` path (the worker's "Standard cohorts" loop, a
    parallel/older bulk-gen output format) is left unwired — its own
    `analyzeAndRecommendModel`/`Confidence` calls are correspondingly also
    left unwired, so that path stays internally self-consistent. Same
    precedent as `computeWhatIfData`'s untouched legacy ARPU fallback (§13).
- **Storage:** `oneOffMonths: Record<cohortKey, {month, reason}[]>` in
  `App.tsx`, keyed by the same 7-part `makeForecastKey` format as
  `forecastStore` (no scenario component — a flag applies to all 4 IBRO
  series for that cohort/month, since a real one-off plausibly touches more
  than one metric; substituting an already-normal series for that month is a
  safe near-no-op).
- **Form:** a small, collapsed-by-default section in `StandardForecastTab.tsx`
  near the Generate Forecast button (sized like the Pricing Event form, not a
  new tab). Month picker is scoped to the *selected cohort's own* history
  (via `actualValuesDetail.monthKeys`), optional reason text, an already-set
  list of flags with a remove control. Nothing renders beyond a single
  collapsed toggle line for a cohort with no flags.
  - **The most recent historical month is deliberately excluded from the
    flaggable list.** That month is the forecast's boundary anchor (the ARPU
    boundary correction, §5, pins forecast month 0 to the last actual) and the
    Base-derivation seed (`lastHistoricalInflow`/`Outflow`). Substituting it
    would make the actual→forecast join disagree with the real last actual
    shown on the chart. A one-off is by nature a *past* anomaly, so the latest
    month isn't a sensible target — excluding it keeps the boundary-correction
    guarantee intact for every flag.
- **Empty-cohort advisor state:** when the current filter combination has zero
  rows (`emptyCohortSelection`), the Model and Confidence advisors render
  faded and disabled (an "Unavailable" pill, greyed non-clickable Apply
  buttons, an on-hover tooltip explaining no data exists), and the forecast
  area shows a "No data for this selection" empty state instead of a stale
  forecast. This keeps the advisor's visual footprint consistent rather than
  silently vanishing — see the standalone fix that shipped alongside P10.
- **Transparency display:** picking a month shows both the real file value
  and what the model will use, computed live via the same
  `substituteOneOffValue` the engine calls — e.g. "File value: 6,200 · Model
  will use: 3,100 (trend and seasonal-consistent)" — so the mechanism is
  never a black box, and an implausible substituted value is a visible signal
  the heuristic misfired for that cohort.
- **Confidence-band notation:** the form states plainly that flagging both
  cleans the seasonal fit *and* tightens the confidence bands for that
  cohort — the band narrowing is an expected, transparent consequence, not a
  separate surprise.
  - **Caveat (cohort-dependent, not a defect):** `analyzeAndRecommendConfidence`
    picks the *minimum* backtest MAPE across all four candidate models
    (SES/HL/DT/HW). For aggregate/L1 cohorts where Holt Linear's trend fit
    already dominates and Holt-Winters never wins the backtest, a one-off
    spike inflates HW's error but not the winning HL error, so the
    *discretised profile* may not visibly change even though the HW sigma and
    the actual forecast do recover when flagged. The narrowing is clearest on
    genuinely seasonal leaf cohorts. This is pre-existing recommender design
    (unchanged by P10 — it correctly receives the cleaned series either way);
    a demo should pick a seasonal cohort to show the effect.
- **Displayed/exported/Actuals-Review values are untouched** — only the
  number the optimiser sees changes. Gap detection reads only `_parsedDate`
  (never touched by the substitution), so it is unaffected regardless of
  flags.
- **Export/import:** new `One_Off_Months` sheet (Segment/Product/Product_L2/
  Channel_L1/Channel_L2/Tariff_L1/Tariff_L2/Month/Reason columns), restored
  via `makeForecastKey` reconstruction — same precedent as `Yield_Events`/
  `Pricing_Events`.
- Does **not** touch `computeWhatIfData` or any Market/Yield/Pricing/Promotion
  event logic; `calculateBaseForecast`'s core math is unchanged for any
  cohort with no flags (confirmed via the same end-to-end entry point used
  for the Stage 1 proof: 11.4% distortion without a flag, 0.3% recovery with
  one, on identical injected data).

---

## 16. Aggregate-targeted market events — pro-rata distribution

Before this fix, an event whose target carried `'All'` on any dimension was
treated as a **wildcard**: it applied at full magnitude to the aggregate *and*
independently to every constituent leg. A Corporate · All · All event of
+10,000 subscribers measured at **+80,000** across the eight legs — an
over-application of exactly `(legs − 1) × volume`.

The rule now enforced: **an event belongs to its target scope as a whole.**
Each cohort inside the scope receives only its volume share; the shares sum to
exactly 1, so the event is applied once in total. One shared helper,
`eventProRataShare` in `src/utils/forecasting.ts`, is the single implementation
of that rule.


### Header-slot rule — an in-page bar may only MIRROR global scope

**An in-page bar in the header slot may only mirror global scope, never own
local state, and hides when it has nothing to say.**

Users reported "two filter bars I can't tell apart" on Market Events. The cause
was not that the white bar resembled the dark global one — it was that it was
**identical to Step 3's in-page bar**: same container classes
(`bg-white border border-slate-200 rounded-xl px-4 py-3`), same slot under the
page header, same `text-[10px] font-bold uppercase tracking-wider text-slate-400`
label. Step 3's bar describes cohort scope. Users read the app's grammar
correctly; Step 2 broke it.

| Step | In-page bar | Conforms |
|---|---|---|
| 1 (`StandardForecastTab`) | none | Exempt — its controls ARE authoritative, there is no global bar to mirror |
| 3 (`ForecastVsActualsTab`) | yes | **Yes** — pure mirror; chips display the dark bar's dimensions and write back via `onCohortFilterChange`, and the whole bar is hidden behind `hasActiveFilterDims` |
| 2 (`WhatIfTab`) | **deleted 2026-08-01** | Was the only violation — it owned local state the dark bar had no equivalent for |

Step 2's bar also used filter vocabulary ("IBRO Scenario") for what the chart
calls KPIs eighty pixels below, and carried an italic "chart focus only" hint.
**Microcopy defending a control against being misread is a sign the control is
in the wrong place**, not a sign the copy needs work.

Do not reintroduce a bar in that slot for a display-only control. Put the
control next to what it affects.

#### What was deleted with it

`viewScenario` had exactly one consumer — an effect that wrote `selectedKpis`.
It was a remote control for the KPI pills further down the same screen, and its
reset arm did not work: the effect was guarded on `!== 'All'`, so choosing All
or clicking Reset left the chart on one series while the dropdown claimed
otherwise. Both are gone. The single-gesture isolate capability it genuinely
provided is now an "Only" affordance on each KPI pill.

#### KPI selection is per tab

Two wrong behaviours in succession, both fixed 2026-08-01. Re-defaulting on
every tab change silently discarded a hand-picked selection. Defaulting only
once per tab then let the Value tab's ARPU-only choice follow the user back to
Volume — **found by the measurement, not by reading the code.** Each tab now
remembers what it was left on and gets its default the first time it is opened.

**The KPI pills are the single authority for what the chart displays.** Measured
by driving the component: after every interaction — toggle, Only, tab round trip
— the selected pills equal the series the chart draws, identified by stroke
colour. A positive control asserts the chart is drawing something first, because
an empty set on both sides would otherwise read as agreement.

### OPEN PRODUCT QUESTION — the scoped preview

The in-page bar once carried four cohort dimensions letting a user narrow the
adjusted-forecast preview to a sub-cohort without changing global scope. Removed
because its output was written to global `adjustedForecast` paired with the
LOADED cohort's identity, mislabelling the export and mis-scoring Step 3.

The underlying need is plausible: *"I've loaded Corporate/All/All, added an
event, and want to see how it lands on one tariff without regenerating."*

**Not built, and not a UI decision.** A safe version must:
1. never write `adjustedForecast` — it needs its own derived value;
2. present differently enough that it cannot be mistaken for the thing that gets
   exported (an overlay or annotation, not a replaced line);
3. not reintroduce a control in the header slot, per the rule above.

Recorded as an open product question. Do not fold it into a UI change.

### Bulk edit is delete-and-rebuild, not an update loop — SETTLED 2026-08-01

On the Volume and Promotion cards, **individual** edit patches by id and keeps
the row's identity. **Bulk (campaign) edit does not**: `handleSaveCampaign`
filters every row of the campaign out of the array and appends freshly-built
replacements with new `Math.random()` ids.

```ts
setMarketEvents([...marketEvents.filter(e => e.campaignName !== editingCampaign || e.isPromotion), ...newEvents]);
```

**This interacts with the percentage-events design and needs deciding before it
lands.** If events apply in creation order, and adjusted-targeting events depend
on the result of earlier ones, then a bulk edit that deletes and re-appends a
campaign **silently moves those rows to the end of the array** — changing which
events precede them, and so changing their result, without the user editing
anything about ordering.

Nothing observable depends on it today, because order is only positional in the
array and current event types do not read each other's output.

**Resolution: an explicit `sequence` field on `MarketEvent`, and both bulk
rebuild sites restore the slots their replaced rows held rather than appending.**

One correction to the reasoning above, because it is the interesting part. This
entry expected percentage events to make array order *computationally*
observable — "adjusted-targeting events depend on the result of earlier ones".
They do not. Percentage events are flat and non-compounding by decision: each
resolves against a single basis and none can observe another's output, so the
maths is order-independent by construction.

What was actually at risk was never the arithmetic. It was that a bulk edit
silently moved rows to the end of the table, so the user's own ordering — the
thing they arranged and read — was rearranged by an edit that had nothing to do
with ordering. `sequence` exists for display stability and edit-slot retention.

The distinction matters because the wrong reason argues for a strict processing
order in the engine, and that is exactly the over-engineering to avoid. See the
two-phase comment in `computeAdjustedForecast`.

### Value and Pricing cards: individual edit only, deliberately

Added 2026-07-31. Bulk edit was NOT added: `YieldEvent` and `PricingEvent`
carry no `campaignName`, and a ramp is a single row on these cards
(`rollForward`, `duration: 'recurring'`) rather than the multi-row spread that
makes a campaign meaningful on Volume and Promotion. There is no grouping to
edit in bulk, and inventing a grouping key to satisfy the word "bulk" in a
request would be a data-model decision disguised as a UI fix. Open, pending a
decision on what a grouping key would mean for a rate override.

**There are TWO event-application paths, not three. Corrected 2026-07-31.**
`computeWhatIfData` was deleted as unreachable — see the dead-subsystem entry.
Any statement elsewhere that there are three is stale and should be corrected
at its lead, not annotated below.

| Path | Function | Location |
|---|---|---|
| A | `computeAdjustedForecast` (Pass 1/2/3) | `src/components/WhatIfTab.tsx` |
| B | `computeScenarioForFilter` (leaf case) | `src/utils/scenarioHelper.ts` |

Both still consume `eventProRataShare`, and they still return DIFFERENT output
shapes for the same idea — nested `uplifted.*` versus flat `adjusted*`. Two
paths is less coupling surface than three; it is not none.

Path C's *aggregate* case already summed leaf rows and applied the event once,
and is deliberately untouched — with view scope equal to event target the share
is 1, so it needs no special-casing.

**Rate events are excluded, by design.** ARPU-scenario, Yield and Pricing
events are rates, not quantities: a volume-weighted average of
`(leafArpu + Δ)` already equals `(aggregateArpu + Δ)`. Pro-rating them would
under-apply the rate change. **CORRECTED 2026-08-01:** this list previously
attributed one of the comments to `forecasting.ts` and referred to a "path C"
that no longer exists. `grep "RATE event" src/utils/forecasting.ts` returns
nothing. The rate matchers are:

| Site | What |
|---|---|
| `scenarioHelper.ts` | ARPU (Path B), Pricing |
| `WhatIfTab.tsx` | ARPU Pass 1, Yield Pass 2, Pricing Pass 3, Retention-yield Pass 2 |

Do not "fix" them into the volume path. **None of them constructs a `leaves`
array**, so no change to pro-rata leaf weighting can route a rate event through
it — asserted by `npm run spec:prorata`, not left to inspection.

Volume, revenue and customerVolume are split by the **same** share. Splitting
one without the others reconciles volume while silently corrupting blended
ARPU. Zero-volume leaves fall through to `distributeProRata`'s even-split
fallback rather than dropping the event.

**Measured, against the real pre-fix code (commit `0d5cd13`), not a stand-in:**

| Path | Before (agg / leaves) | Over-application | After (agg / leaves) | Drift |
|---|---|---|---|---|
| A | +10,000 / +80,000 | 70,000 (8 legs) | +10,000 / +10,000.01 | 0.01 |
| B | +10,000 / +40,000 | 30,000 (4 legs) | +10,000 / +10,000 | 0 |
| C | +10,000 / +40,000 | 30,000 (4 legs) | +10,000 / +10,000 | 0 |

Leaf-targeted events are unaffected on all three paths (+10,000 → +10,000).

### The four Market Events cards share one targeting layout — 2026-08-02

Volume, Value, Pricing and Promotion describe the same concepts and had
drifted into four names, two grid ladders and two vertical alignments.

**Established first which differences were real**, because most of them were
not what the labels suggested:

| Concept | Was | Now | Verdict |
|---|---|---|---|
| Stream | `Scenario` / `IBRO Type` / `Volume Target` | `IBRO Type` | Drift. Promotion literally writes `MarketEvent.scenario` (`buildPromoEvents`) |
| Month | `Month` / `Activity Month` / `Start Month` | `Month`, or `Start Month` where one event persists | **Real**, but not on the card boundary — see below |
| Product L2 on Pricing | two flat selects | folded into the hierarchical dropdown | Drift. Pricing was inconsistent with its own Channel and Tariff |
| Product L2 / Tariff on Value | absent | absent | **Real.** `YieldEvent` has neither field |
| Pricing `Cohort Type` | a peer-sounding name | `Applies to`, still nested under Target | **Real** concept, wrong name |

**The month split is not where the labels put it.** Volume's spread emits N
separate point events, each with its own date. Pricing persists ONE event via
`duration: recurring` — but `YieldEvent.rollForward` does exactly the same
thing on Value. So Value's month is a start month too, when rollForward is on,
and `Activity Month` was the least accurate of the three labels. Value's label
now follows `rollForward` rather than the card.

**Where consistency would have made a card worse**, and was therefore not
applied: Value must not gain Product L2 or Tariff targeting, because Product L2
is the axis being *redistributed* and filtering to one tier before
redistributing across tiers is incoherent. Pricing's `Applies to` must stay
nested under Target, because it is meaningless when Target is base-only and
promoting it would create a control that vanishes because of a control further
down the form.

**Four implementations that agree by convention, not a shared component.** The
draft state shapes are closer than expected — Volume and Promotion are
field-identical, Pricing and Value are field-identical to each other, and the
two families differ on two key names (`channel`/`channelL1`, `date`/`month`).
An adapter would have been trivial. The blocker was which controls RENDER: a
shared component would need props for `showStream` plus its option list
(4/2/2/none), `showTariff`, `showProductL2` and `monthLabel` — a switchboard,
not an abstraction. Enforcement lives in `npm run spec:cards` instead.

#### Band 1 holds six controls, and Month stays in it

The ladder is `md:grid-cols-3 xl:grid-cols-6`, deliberately skipping `lg`. At
`lg` six controls are two clean rows of three; six columns at `lg` (1024px)
would put a `type="month"` input near 140px, which is tight for the native
picker. Known residual: five controls give a 3+2 rag at `md`/`lg`. Pre-existing,
not introduced.

**Moving Month down beside Campaign Name was considered and rejected.** The
history table places Campaign and Month adjacent, so the pairing has a
precedent — but it is the wrong kind. The table *identifies* an event that
already exists; the form *determines* one. Reading order and authoring order
are different arguments.

The deciding fact is that **Month is required and gates the Add button
silently** on both add paths. Putting the one field whose absence stops the
form into the section that reads as optional metadata is the worst available
place for it.

#### OPEN DEFECT: Month fails silently

`if (!newEvent.date || newEvent.subscriberVolume === undefined) return;` at
`WhatIfTab.tsx` (volume add) and `App.tsx` (the App-level add). No message, no
disabled state, no focus move — the Add button simply does nothing.

Recorded 2026-08-02 while deciding the layout above, and deliberately NOT fixed
there: it is a usability defect in its own right, it affects the absolute path
as much as the percentage one, and folding it into a presentational change
would have hidden it in that diff. Its own branch.

### A gap that narrows under correction is not converging on truth — 2026-08-03

Investigating the `promoRebanded` divergence, a **21.7% Base gap** was reported
between `computeAdjustedForecast` and `computeScenarioForFilter` for identical
inputs with no promotion involved. It looked like a second, larger divergence
sitting behind the promo one, and it held up the decision on the promo fix.

**It was a harness artefact. There is no Base divergence.**

`computeScenarioForFilter` de-duplicates the seed on `Cohort_Key` (the
`cohortCache` block in `scenarioHelper.ts`) because baseline rows repeat the
cohort metadata once per month. The harness built `Cohort_Key` including the
tariff tier, so five tiers became five distinct cohorts and Path B summed five
seeds where Path A had one.

**The dangerous part is what happened next.** The first correction divided
`Seed_Base_Volume` by the tier count — but divided `Last_Historical_Inflow` and
`Last_Historical_Outflow` for Path B only, while Path A kept the undivided
values. The gap fell from 78% to 21.7% and the remaining figure was reported as
though it meant something.

**A gap narrowing under successive corrections is not evidence of converging on
truth.** Each correction made the number more plausible, and more plausible is
exactly what lets a wrong number survive review: 78% invites suspicion, 21.7%
reads like a real finding worth chasing. Nothing in the trend indicated the
remaining error, because the trend was produced by fixing some inputs and not
others.

What settled it was not a further correction but a different KIND of evidence —
running Path B against a real exported session and checking its Base against
the file's own seed columns:

```
seed 1274 + lastIn 136 - lastOut 114 = 1296
Path B month-1 baselineBase          = 1296   exact
```

That export carries 24 rows per cohort, so a naive per-row sum would give
30,576 — twenty-four times the correct 1,274. The de-duplication is doing real
work; the harness was the only thing bypassing it.

**Three consecutive measurements of the same quantity were wrong**, each
internally consistent. Where that happens, stop correcting the harness and
change the class of evidence.

### generateStandardForecast fits a model to an aggregated series — DEFECT

Bottom-up is settled: **leaves are fitted, aggregates are derived by
summation.** `generateStandardForecast` does not do that. For an `All`-bearing
cohort it treats `All` as "skip the filter":

```js
let allIBRO = data
if (wiSegmentCol && segKey  !== 'All') allIBRO = allIBRO.filter(...);
if (wiProductCol && prodKey !== 'All') allIBRO = allIBRO.filter(...);
if (wiChannelCol && chanKey !== 'All') allIBRO = allIBRO.filter(...);
```

…then sums the surviving raw rows by month and fits one model to that summed
series.

**This is a defect against the bottom-up decision, not an alternative method
with its own merits.** It is a second implementation of the thing bottom-up
replaced, and it is currently the ONLY way an aggregate cohort acquires a typed
forecast — the bulk path cannot produce one at all (see the entry below). So
every aggregate a user has is fit-on-aggregate, reachable only where someone
happened to click Generate in Step 1.

**When derivation lands, `generateStandardForecast` is rewired to it.** Two
implementations of one concept is this codebase's recurring failure mode and
the reason for `applyEventsToMonth`, `cohortScope`, `resolvedEventVolume` and
`eventProRataShare`. Hand-generated aggregates get regenerated under derivation
and their values will move; that is expected, not a question to resolve.

### Bottom-up is half-implemented: aggregates never get a typed forecast — 2026-08-04

**Reported defect:** market events appeared to have no effect on the Market
Events chart, at the targeted cohort and at aggregate level, on the Volume card
and the Promotion card.

**Cause.** No forecast exists for any aggregate cohort, so `baseForecast` is
absent and events have nothing to apply to.

Three facts in `forecasting.worker.ts`, together:

1. The typed-forecast loop iterates `ibroCohorts`, which is enumerated from data
   rows — **leaves only**. There is no aggregate in the list.
2. It looks its data up with `cohortDataMap.get(fKey)`, an exact hit. The O(N)
   fallback that once served `All`-bearing keys was **removed deliberately**;
   the comment naming the case it served survives above the line that replaced
   it: *"aggregate ('All') keys that have no single map entry (e.g.
   Corporate|Mobile Voice|All|All|All spans multiple channel buckets)"*.
3. **Nothing builds or derives a typed aggregate anywhere.**
   `aggregateForecastBands` and `aggregateArpu` are exported and have **zero**
   call sites — every hit in `src/` is prose in a comment. The worker does sum
   leaves for aggregates, but emits chart-series rows and `continue`s; it never
   constructs a `BaseForecast`. And the four filter handlers use a bare
   `forecastStore.get(key)` with nothing between lookup and assignment, so
   there is no read-time derivation either.

So bottom-up changed how aggregates are produced **for the Standard Forecast
chart only**, and the typed path was never completed to match.

**DISPROVEN, recorded because it was reported as the cause:** that the cohort
was skipped by a "fewer than four data points" guard in `calculateBaseForecast`.
It was not. That guard exists but is not what excludes aggregates — they never
reach it. Do not reinstate this explanation.

#### The run counters describe the other loop

`generated++`, `failed++` and `empty++` all sit in the chart-series loop, before
its `continue`. The typed loop's only guard is `if (bf)`, with **no counter on
either arm**. A bulk run reporting `31,860 generated, 0 failed, 0 empty`
produced 541 typed forecasts, and the counters say nothing about that path.

**A zero failure count is not evidence of success for a path that is not
counted.** Check which loop a counter lives in before reading it as coverage.

### `scaledBandFlow` is a pure fallback — it gets DELETED, not fixed — 2026-08-04

A consequence of the entry above, recorded before the fix is built so that the
fix does not quietly preserve it.

**What it is.** One call site, `ForecastVsActualsTab.tsx:1267`:

```js
const directBand = flowBandMaps?.[kpi]?.get(month);
// Fallback to share-scaled band from baseForecast when no direct matchingBfs band.
const fallbackBm = directBand ? null : baseForecast.months.find(m => m.month === month);
const baseBand   = directBand ?? (fallbackBm ? scaledBandFlow(fallbackBm, kpi) : null);
```

`flowBandMaps` is summed from `matchingBfs` — the row's OWN resolved forecasts.
When that resolves, `directBand` wins and `scaledBandFlow` is never reached. Its
firing condition is exactly **"this row's cohort has no forecast of its own"**,
which since bottom-up landed is every aggregate cohort.

**What it does in that case.** Scales the LOADED cohort's bands by a ratio of
two unrelated cohorts' totals. The comment at `:714` already describes the
result: a number, never a blank, and the number moves with whoever's filter is
active — SOHO · RED S read 60/75/61/74 with a tariff filter set and 0/0/0/0
with it cleared. That is the recorded fabricated-accuracy defect, and this
function is its mechanism.

**It goes when derivation lands, and the navigation-order dependence goes with
it.** No condition attached.

#### The deletion is NOT conditional on the actuals-only cohort set being empty

I first framed it that way and it was wrong. If a cohort has actuals and no
forecast anywhere, scaling an unrelated cohort's bands is **the same
fabrication in a smaller case**. The correct output for a row with no forecast
is a blank, not a borrowed number. So the function goes regardless of how many
rows still fall through.

The actuals-only question — cohorts present in `cohortActualsMap` and absent
from forecast enumeration — is worth answering, but it answers **how many rows
render blank**, which is an empty-state and copy question. It is a build
consideration for the deletion, not a gate on it.

Generally: "the fallback is wrong, but removing it leaves gaps" is an argument
about what to show in the gaps. It is never an argument for keeping a
fabrication.

### The three seed fields are AS-OF-A-DATE reads — measured 2026-08-04

Q4 for the aggregate-derivation build: do `seedBaseVolume`,
`lastHistoricalInflow` and `lastHistoricalOutflow` sum meaningfully across
leaves?

**Answer: yes on all present data, and all three carry the SAME condition.**

**The hypothesis I started with was wrong.** I expected the two flows to sum
cleanly and the stock to be the binding constraint. Stock versus flow is not the
distinction that matters here. All three are read *at a date computed per leaf*,
and they are exact under summation precisely when that date is the same on every
leaf. They fail together or not at all.

#### Where each leaf value comes from

`seedBaseVolume` is **not derived inside `calculateBaseForecast`** — it is
parameter 3, supplied by the caller, six call sites. In the worker (the only
path that builds leaf forecasts in bulk) it is computed from `allIBRO`, the
leaf's own rows: filter to the Base metric, sum within a timestamp, take the
value at `Math.max(...baseReadings.keys())`.

`lastHistoricalInflow` / `lastHistoricalOutflow` are
`sorted[sorted.length - 1].inflow / .outflow`, where `sorted` is `ibroArr` —
and `ibroArr` is **filtered** to months where `inflow > 0 || outflow > 0 ||
retention > 0`.

#### Double-counting: no

`buildCohortDataMap` places each source row in exactly one bucket, keyed by that
row's literal dimension values. Leaf keys therefore **partition** the data, and
summing leaves cannot double-count. The one way that could break is a source row
carrying the literal string `All` in a dimension, which would make a key both a
leaf and a roll-up. **Measured: zero such rows** in either fixture, across all
seven dimensions.

#### Gaps: three ways, none of which fire on present data

1. **Across leaves.** The max-timestamp is per leaf. Leaves ending in different
   months make the sum add a June stock to a May stock — a wrong number that
   nothing in the summation can detect.
2. **Within a leaf.** The seed date comes from *unfiltered* Base rows; the flow
   date from *filtered* flow rows. A leaf whose final month has a Base reading
   but all-zero flows reads its seed at T and its flows at T−1, while its
   `months` array starts at T (from `sorted`'s last date). Same field set, two
   epochs.
3. **Month-array alignment — the one that actually constrains the build.** Each
   leaf's `months` begin at `addMonths(lastDate, 1)`. Leaves that end at
   different months produce arrays misaligned by index *and* by label. This
   constrains derivation more than the seeds do.

#### Measurement, both fixtures, 2026-08-04

| | trimmed | full tariff-hierarchy |
|---|---|---|
| leaves | 74 | 540 |
| leaves whose last Base month is 2026-06 | 74 | 540 |
| leaves whose last non-empty flow month is 2026-06 | 74 | 540 |
| leaves where the two dates disagree | 0 | 0 |
| rows with a literal `All` in any dimension | 0 | 0 |
| Σ per-leaf seeds vs true one-month total | 2,754,259 vs 2,754,259 — **0.0** | (trimmed: 292,846 vs 292,846 — **0.0**) |

**And that is also the limit of the measurement.** Both fixtures are perfectly
rectangular: every leaf carries every month. They therefore **cannot exercise**
any of the three gaps. A cohort that launches mid-history or stops before the
end is the case that breaks this, and no fixture contains one. Do not read the
0.0 as evidence the risk is absent — read it as evidence the fixtures cannot
see it.

#### The seed IS read from actuals, and the grain matches — by construction

Base actuals are read from file and never derived, so the question is whether
the leaf grain of that read matches the leaf grain of the forecast. It does, and
not by coincidence: the worker (`:487`) and both bulk sites in `App.tsx`
(`:2208`, `:2397`) build `baseReadings` by iterating **`allIBRO`**, which *is*
`cohortDataMap.get(fKey)` — the same array the forecast is fitted from. One
array, one key, one grain.

Two caveats.

*It sums within the leaf-month*, so it collapses any dimension NOT in the 7-part
key — `Accounting_View`, `Refresh_Frequency`, `Simulation_Type`. Measured on the
full fixture: 90,720 rows ÷ 540 leaves ÷ 42 months ÷ 4 metrics = exactly 1.0, so
no collapsing occurs on present data and the sum is a pass-through. On a file
where those vary it collapses them — correct for the leaf, but silent.

*One site does not read from actuals at all.* `runChallengerForecast`,
`App.tsx:2723-2725`:

```js
const existingBf = forecastStore.get(makeForecastKey(...cohort));
return existingBf?.seedBaseVolume ?? baseForecast?.seedBaseVolume ?? 0;
```

The fallback is **the currently loaded cohort's seed** — a different cohort's
stock. It fires exactly when the store misses, which since bottom-up landed
means exactly for aggregates. Same shape as `scaledBandFlow`: borrow an
unrelated cohort's number rather than decline to answer. Second known instance;
recorded here, not fixed.

#### The constraint to build against

Summation is safe today and silently wrong on the first ragged cohort. So the
derivation must not inherit a leaf's notion of "last historical month":

- **key on the month LABEL, never the array index**;
- **compute the aggregate's own last historical month** and read every leaf's
  seed and last flows at that month, rather than summing whatever each leaf
  happened to end on;
- decide explicitly what a leaf that has no row at that month contributes.

**RESOLVED:** 541 = 540 leaves + the one hand-generated aggregate. It
reconciles. But see Q4b below — the totals reconciling does NOT establish that
the fitted set equals the populated set; 540 is the count that was fitted.

### Q4b — enumerated ≠ fitted, and only write-time can see the difference — 2026-08-04

Does the leaf set with forecasts equal the leaf set with data?

**Enumeration** (`App.tsx:3488`) is `data.forEach` over every row, collecting
every distinct 7-part tuple. **No metric filter, no volume filter, no
month-count filter.** "Enumerated" means "appears in the file at all".

**Fitting** drops a leaf later and elsewhere: `ibroArr` keeps only months where
`inflow > 0 || outflow > 0 || retention > 0`, and `calculateBaseForecast`
returns null below four surviving months (`forecasting.ts:895`; the
`fitAndBuildBands` null at `:733` is the same threshold, so it adds no distinct
case). The worker then does `if (bf) newTypedForecasts.push(...)` — **no counter
on either arm**, already recorded.

**Measured 2026-08-04.** Full fixture: 540 enumerated, 540 fittable, **0
missing**. Trimmed: 74 / 74 / **0**. Missing-leaf contribution 0.0000% of the
aggregate Base stock on both.

**And, as with Q4a, the fixtures cannot exercise it.** Surviving-month counts
are min/median/max = 42/42/42 on both files. Perfectly rectangular. The set is
empty on the data available; that is not a statement about data in general.

#### The shape that produces a non-empty set

A leaf with a **large Base stock and near-zero flows** — a stable legacy cohort
that neither acquires nor churns. It passes enumeration (it has rows), fails
fitting (fewer than four months with a positive flow), contributes **0** to a
summed aggregate, and contributes its **full stock** to that aggregate's
actuals.

That presents as **forecast bias, not as a coverage gap** — a persistent
under-forecast against actuals with no error, no empty state, and no counter.
It is the harder failure to spot, and nothing currently would.

#### WITHDRAWN: this is NOT asymmetric between write-time and read-time

I claimed read-time derivation could not state its own coverage, because it
sees only `forecastStore` and a skipped leaf is indistinguishable from a leaf
that does not exist. **That was wrong, and Q5 disproves it.**

The enumeration comes from the data, and the data is on the read side.
`populatedCohortKeys` (`App.tsx:3241`) is a **component-level memo** that calls
`buildCohortDataMap(data, …)` on every render where `data` changes, and it is
in scope at the `forecastStore.get` seam. Comparing leaves-in-scope against
leaves-with-a-forecast states coverage at the seam, at read time, using a
structure that is already built.

What survives is much weaker and is not a coverage claim: read time can say
**which** in-scope leaves have no forecast, but not **why** — never enumerated,
enumerated and fitted to null, or generated and later evicted. Write time knows
which. That is a diagnostic distinction, not a coverage one.

**Do not use this entry as an argument for write-time.** It was mine, it was
wrong, and it is recorded here so the withdrawn version is not re-derived.

#### The missing counter is a PREREQUISITE for both, not a discriminator

The cause of the gap is independent of the choice. A skipped leaf vanishes
because `if (bf)` has **no counter on either arm** — the same missing-counter
finding already recorded above. Have the worker record the skipped set, and
read-time derivation can consult it just as write-time can.

That work is required whichever option is chosen. It must not be counted on
either side of the ledger.

#### The constraint, stated rather than routed around

Can derivation produce a correct aggregate as-is? On present data **yes** — both
Q4a and Q4b measure empty. As a design, **no, unconditionally**: it produces an
aggregate whose coverage it cannot state. Cheap to fix at write time; not
available at read time.

Do not read "0 missing on both fixtures" as closing this. Read it as: the
failure mode is unexercised, undetected, and silent by construction.

### PATTERN: borrow an unrelated cohort's number rather than decline — 3 sites — 2026-08-04

One concept, implemented three times independently, each time as a local
convenience. Enumerated in full **before any of them is fixed**, because fixing
them one at a time is what produced three of them.

The shape: an exact lookup for this cohort misses → take another cohort's value
and scale or use it → **always return a number, never a blank**. Every instance
fires exactly when the store misses, which since bottom-up landed means **for
every aggregate**.

**1. `scaledBandFlow` — `ForecastVsActualsTab.tsx:1267`.** Scales the loaded
cohort's bands by a ratio of two unrelated cohorts' totals. Cause of the
recorded SOHO · RED S fabricated-accuracy defect. Already recorded above as a
deletion.

**2. `runChallengerForecast` — `App.tsx:2723-2725`.**
`existingBf?.seedBaseVolume ?? baseForecast?.seedBaseVolume ?? 0` — falls back
to the **currently loaded cohort's stock** as the seed for a different cohort's
forecast.

**3. The challenger comparison — `ForecastVsActualsTab.tsx:2958-2975`.**
`const cohortFcExact = forecastStore.get(cohortFcKey) ?? null;` then
`cohortFc = cohortFcExact ?? baseForecast`, with the loaded forecast scaled by
"the cohort's average inflow share over matched actuals months" — which is
`computeAvgShare` by another name. The comment calls it Issue 9.

#### And instance 3 is not a fallback — it is the only path

`cohortFcKey` is a hand-rolled **5-part** `.join('|')` of
`seg|prod|prodL2|chan|chanL2`. `forecastStore` is keyed by `makeForecastKey`
(`App.tsx:1405-1413`), which **always emits 7 parts** — every branch of the
template appends `tariffL1 || 'All'` and `tariffL2 || 'All'`.

A 5-part string carries 4 pipes; a 7-part key carries 6. **They can never be
equal.** So `cohortFcExact` is always `null`, `chosenModel` always comes from
`baseForecast`, and the share-scaling branch runs unconditionally — for leaves
as well as aggregates.

Established by reading arity, not by running it. The arity argument is
conclusive on its own, but confirm at runtime before acting on it.

**Enumeration status: three found, searched by the fallback shape
(`?? baseForecast`, `?? baseForecast?.`, `: baseForecast.`) across `src`.** A
fourth may exist under a different spelling — a store miss handled by scaling
some other cohort need not mention `baseForecast` by name.

### Q5 — the aggregate helpers, and reachability at the seam — 2026-08-04

**What the two exported helpers expect.** Neither takes a store, a scope, or a
cohort. They are pure functions over already-extracted arrays, so they say
nothing about reachability — that question is entirely about the seam.

`aggregateForecastBands(leafBands: AggBand[][])` — one band array per leaf.
Sums means; combines half-widths **in quadrature**
(`halfWidth = sqrt(Σ(opt−mean)²)`), which assumes leaf errors are
**independent**. They are not — leaves in one segment share demand shocks — so
the aggregate band is narrower than the truth. Deliberate or not, it is an
assumption, not an identity.

`aggregateArpu(parts: {arpu, volume}[])` — volume-weighted, correct by
construction, returns 0 on zero volume. No issues.

#### `aggregateForecastBands` already embodies the Q4a failure mode

It indexes leaves by **array position** `t`, takes `horizon = max(lengths)`,
and does `if (!b) continue`. That is exactly what the Q4a constraint says not to
do: **key on the month label, never the index.** A leaf whose months start a
month later contributes its month-1 value to the aggregate's month 0, and a
leaf with a shorter array silently contributes **nothing** to the tail rather
than erroring.

On the present rectangular fixtures this is invisible. **This function cannot be
used as-is** for derivation; it needs a label-keyed signature.

#### Reachability at the `forecastStore.get` seam — by `populatedCohortKeys`

The seam is the four handlers at `App.tsx:1547-1578`. In scope there:

- **`forecastStore`** — `useState<Map<string, BaseForecast>>` at `:1210`. A
  plain Map; its keys enumerate.
- **`data`** — `useState<any[]>` at `:119`. The raw rows.
- **`populatedCohortKeys`** — `useMemo` at `:3241`. Runs
  `buildCohortDataMap(data, …)` and expands **each leaf into its 2×3×3×3 = 54
  roll-up keys**. Component scope, initialised before any handler fires.

**NOT in scope: `cohortDataMap` itself.** It is a local `const` inside the
bulk-generation callback (`:3456`) and a parameter of
`computeCohortForecastData` (`:3301`). It never reaches the seam directly — only
through `populatedCohortKeys`, which wraps it.

**NOT relevant: `cohortScope`.** `rowInScope` / `cohortInScope` are predicates
over a row or a cohort against a scope. They answer "is this in scope", not
"what leaves compose this aggregate". They are not the enumeration.

**So: read-time derivation CAN state its own coverage.** One gap —
`populatedCohortKeys` is a flat `Set` of expanded keys and **discards leaf
identity**, so it answers "does this key have data", not "which leaves compose
it". Derivation needs aggregate-key → constituent-leaf-keys, which is the same
loop over the same `dm.keys()` in the same memo. Cheap, but it does not exist
yet.

### Q6 — cost, measured — 2026-08-04

**The key population, measured on the full fixture:**

| | count |
|---|---|
| leaves | 540 |
| `populatedCohortKeys` (leaves + every roll-up) | **7,964** |
| aggregate-only keys, i.e. what would need deriving | **7,424** |
| vs the 541 keys stored today | **14.7×** |

**Write-time.** The export is ~102 MB at 541 keys ≈ **193 KB per key**. Storing
every aggregate is 7,964 × 193 KB ≈ **1.5 GB** of export, with the in-memory
store the same order. That is not a tuning problem.

**Invalidation.** Regenerating **one** leaf invalidates every aggregate
containing it — its own 54-key roll-up expansion. Write-time must recompute 54
aggregates per leaf regeneration or serve stale ones, and nothing today tracks
that dependency. Read-time has no invalidation problem: it derives from
whatever is in the store at the moment it is asked.

**Read-time.** Derive only the key being viewed. Worst case is the grand total:
540 leaves × 42 months × 9 band series ≈ 204k float operations per filter
change. Sub-frame.

Both figures are stated so the trade is visible. **The decision is not mine.**

### SETTLED: aggregates are derived at READ time — 2026-08-04

Decided by the user 2026-08-04 after Q1–Q6. Bottom-up remains settled; this
settles *when* the summation happens.

**Aggregate `BaseForecast`s are derived on demand at the `forecastStore.get`
seam.** They are never stored, never exported, never invalidated.

#### Why write-time was rejected — REJECTED, do not re-propose

| | measured |
|---|---|
| key inflation | 540 leaves → 7,964 populated keys → **14.7×** the 541 stored today |
| export size | 102 MB ÷ 541 ≈ 193 KB/key → **~1.5 GB** |
| invalidation | **54 roll-ups per leaf regenerated**, and nothing tracks the dependency |
| enumeration | re-inherits proportionality to the enumeration — the same coupling the populate-only filter was introduced to break |

Read-time costs, for contrast: worst case 540 leaves × 42 months × 9 band series
≈ 204k float operations per filter change. Sub-frame. No staleness, because it
derives from whatever is in the store at the moment it is asked.

#### Read-time's obligations — these are part of the decision, not caveats

1. **Coverage must be stated.** Via an aggregate-key → leaf-keys map — the
   `populatedCohortKeys` loop (`App.tsx:3241`) **keeping leaf identity** instead
   of flattening to a Set of expanded keys. Without it the derivation cannot say
   which in-scope leaves it summed.
2. **`aggregateForecastBands` is NOT usable as-is.** It indexes leaves by array
   position with `horizon = max(lengths)` and `if (!b) continue`. Alignment must
   be **by month key**, never by array position — see the Q4a constraint. A leaf
   offset by one month currently contributes its month-1 to the aggregate's
   month-0, silently.
3. **The quadrature assumption is recorded as a known limitation, not kept
   silently.** Combining half-widths as `sqrt(Σ(opt−mean)²)` assumes leaf errors
   are **independent**. They are not — leaves in a segment share demand shocks —
   so the derived band is narrower than the truth. It ships as an explicit,
   documented limitation of the bands.

### Export provenance — option C, decided 2026-08-04

`Model_Used` **stays an enum** and is **empty for derived rows**. Two new
columns: **`Provenance`** (`fitted` | `derived`) and **`Leaf_Count`**.

The importer (`App.tsx:826` and its three siblings at `:804`, `:876`, `:1053`)
**learns the discriminant**. A file with no `Provenance` column defaults to
`fitted` — correct, since everything in a pre-change export was fitted.

**Every `?? 'Holt Linear'` default on `modelUsed` is enumerated and REMOVED as
part of the type change.** Each one is a silent-relabelling site: with
`Model_Used` empty for a derived row, the default would quietly present a
derived aggregate as a Holt Linear fit. Each is replaced by handling the derived
arm explicitly. Known sites: `App.tsx:472`, `:2643`, `:2765`, `:2892`;
`ForecastVsActualsTab.tsx:2960`, `:4354`. **Enumerate again at build time — this
list was gathered by grep and greps miss.**

### DEFECT (live): the challenger comparison has never used a cohort's own forecast — 2026-08-04

Instance 3 of the borrow-an-unrelated-cohort pattern, recorded above. Live, in
Step 3 → **AutoML Challenger Analysis**.

`ForecastVsActualsTab.tsx:2952-2958` builds a **5-part** lookup key
(`seg|prod|prodL2|chan|chanL2`) — **omitting tariff entirely** — and queries
`forecastStore`, which `makeForecastKey` (`App.tsx:1405-1413`) always writes with
**7 parts**. Pre-tariff code never updated when the tariff dimension landed,
which is also why it is a hand-rolled join rather than a call to
`makeForecastKey`.

**Runtime evidence, 2026-08-04.** Real app, full Dec2025 fixture (77,760 rows),
real bulk run (*"Generate 31852 Forecasts"* — matches the recorded 31,856
enumeration). Instrumented store inspection at the memo:

```
storeSize:    541          ← the same 541 seen in the export
storeArities: [7]          ← all 541 keys, no exceptions
```

**541 of 541 keys are 7-part. The lookup key has 4 pipes; every store key has
6.** The exact-match arm queries a store containing no key it could ever match.

**Consequence:** `cohortFcExact` is always null, so `chosenModel` always comes
from the loaded cohort and the share-scaling branch runs **unconditionally** —
for leaves as well as aggregates. Every model recommendation that tab has made
since the tariff dimension landed rests on a scaled comparison against a
different cohort's forecast.

**OBSERVED 2026-08-04 — the arm never fires.** Actuals loaded by hand (654
months compared), AutoML Challenger tab, "Review All Cohorts Anyway" to bypass
the score threshold:

```
hits:         0
misses:       10          <- every row
sampleKeys:   "SME|All|All|All|All"            (4 pipes)
              "MNC|All|All|All|All"
              "Large Enterprise|All|All|All|All"
storeSize:    541
storeArities: [7]         <- every store key (6 pipes)
```

**Ten rows, ten misses, zero hits.** The diagnosis is now observed, not only
argued from arity. Note the sample keys are also all AGGREGATE shapes
(`SEG|All|All|All|All`) at the default grouping, so even a corrected 7-part key
would miss until derivation lands - the fix needs both.

The observation below is retained for the record of how it was reached.

**Previously not observed:** `hits: 0, misses: 0, rowsSeen: 0` — the
map body never executed because the actuals import did not register (MAPE cards
stayed at "0 months compared"; the tab rendered "All Models Performing Well").
**CORRECTED 2026-08-04 — this attribution was half wrong.** Two causes were
present and I named only one, then named it as the whole explanation.

*Real:* the programmatic `DataTransfer` + `change` dispatch genuinely did not
drive the actuals import; the user loaded the file by hand. The
React-controlled-input blocker occurrence is genuine and the count stands at
**four**. What was wrong was the causal claim, not the occurrence.

*The actual cause of `rowsSeen: 0`:* the **>=85 score threshold**. The challenger
memo only maps rows scoring below 85, and none did. Even with actuals fully
loaded the map body did not run until "Review All Cohorts Anyway"
(`challengerShowAll`) bypassed the threshold.

**The lesson is the attribution, not the blocker.** A known, recently-recorded
failure mode is the cheapest explanation available, which is exactly why
reaching for it first is dangerous — it fits without being checked. Two causes
were in play; naming the familiar one closed the question early. **The
defect does not depend on it**; the store-arity evidence is sufficient for the
diagnosis and the arity argument is conclusive on its own.

#### Accepted-challenger forecasts in the store — checked 2026-08-04

Asked because any adopted model would have been adopted on a share-scaled
comparison. **Count: 0** in the session built at `f0f9bfd` — the tab offered no
rows to accept ("All Models Performing Well", zero cohorts below 85), so
acceptance was never reachable.

**Two structural findings that matter more than the count:**

- **The store carries no marker.** Both acceptance paths (`App.tsx:2630`,
  `:2757`) write a plain `BaseForecast` via `setForecastStore(...).set(fKey, bf)`,
  indistinguishable from a bulk-generated one. **A store cannot be interrogated
  for this after the fact.**
- **The audit log's grain is too coarse to name them.** `modelAcceptanceLog` is
  the only record, and its `cohortKey` is **3-part** (`seg|prod|chan`) — no
  productL2, channelL2 or tariff. Even a non-empty log could not identify which
  7-part cohorts to regenerate. `cohortGenLog` is capped at `.slice(0, 10)`, so
  it is not a census either.

So "flag them for regeneration" is **not currently implementable** for any
pre-existing session. Recorded as the constraint. Nothing touched.

### DEFECT: `buildCohortAccuracy` sums bands LINEARLY — 2026-08-04

Found by the dependency-mapper pass before the derivation build. Recorded as a
**defect against the settled decision that aggregate bands are combined
statistically**, not as a style divergence between two acceptable methods.

`flowBandMaps` (`ForecastVsActualsTab.tsx:926-948`) builds an aggregate band by
adding the leaf bounds directly - `iO += m.inflow.optimistic` at `:939`. That is
**linear summation of the bound**, which assumes every leaf hits its optimistic
edge in the same month. `aggregateForecastBands` combines in quadrature for
exactly that reason.

It is month-label-keyed, so it does NOT carry the Q4a array-index bug. The
defect is the combination rule only.

The same file re-sums the three seed fields inline at `:953-955`, `:991`,
`:2121-2123`, `:2182`, `:2228-2230`, `:2481-2483`, `:2533`, `:2596-2598` -
seven further hand-written copies of one concept. All retire into
`deriveAggregate`.

#### CONSEQUENCE, recorded BEFORE the build: accuracy scores will move

Band position is an input to the accuracy score. Scoring currently reads
linearly-summed bands, which are too wide, so **actuals that should have counted
as outside the cone have been scoring as inside it**. When scoring adopts
quadrature the bands narrow and those rows lose points.

**This movement is expected and correct. It is the new baseline, not a
regression.** A spec case pins the new values on the fixture; the gate compares
against those, and a gate agent reporting "accuracy scores changed" for these
rows is reporting the fix working.

Second time scores have moved for a correct reason - see "Accuracy scores will
move - this is not a regression" above. Same rule, new cause.

### Challenger acceptance becomes interrogable at the type change - 2026-08-04

Traced to the recorded constraint that the store carries no marker
distinguishing an accepted-challenger forecast from a bulk-generated one, and
that `modelAcceptanceLog`'s 3-part `cohortKey` is too coarse to name them.

**Acceptance writes provenance identifying itself as accepted** - the model, the
date, and what it replaced - at both write paths (`App.tsx:2630`, `:2757`).
Cheap now, because the provenance union is being introduced anyway; impossible
retroactively, because nothing in a stored `BaseForecast` records it.

**Pre-existing sessions stay unflaggable.** That constraint is recorded above
and stands; this closes it going forward only.

### APPROVED BUILD PLAN — aggregate derivation, 4 phases — 2026-08-04

Approved by the user 2026-08-04. **Nothing built in the session that produced
it.** The unit is `resolveForecast(key)`, and every reader goes through it:
store hit -> the stored fit verbatim; miss on an aggregate key -> `deriveAggregate`
over the leaves in scope; miss on a leaf key -> `null` with a reason.

| Phase | Content | Control |
|---|---|---|
| **0** | Worker counters + skip reporting. `if (bf)` gains an else recording `{fKey, reason}`; new `skipped` field; `generated`/`failed`/`empty` untouched. Standalone. | existing counter semantics byte-identical |
| **1** | The type change. `provenance` discriminant (`fitted` / `derived` / `accepted`); top-level `modelUsed` and `fittedParams` removed; the defaults re-enumerated **by the removal test**, not by grep; export option C; importer discriminant at `:826`, `:808`, `:842`, `:880`, `:1057`. | leaf behaviour byte-identical; provably aggregate-free (nothing produces `derived` yet) |
| **2** | `deriveAggregate` + month-key alignment + `resolveForecast`; every reader routed; `flowBandMaps` and its 7 sibling seed sums retired; `scaledBandFlow` deleted; instances 2 and 3 fixed via `makeForecastKey`; `populatedCohortKeys` keeps leaf identity; `.has()` becomes resolvable. | leaf behaviour byte-identical (1-leaf passthrough makes this hold **by construction**) **plus** the pinned new aggregate scoring baseline. Coverage annotates; it never gates derivation. |
| **3** | Both fit-on-aggregate removals (`~:2401` and the `:2436` companion write) + Generate-on-All behaviour. | the leaf sum, **not** the old path numbers — they differ by construction, and that is the settled decision becoming visible |

**Mutation-tested spec cases.** Phase 0: skipped leaf named with its fKey;
reason distinguishes insufficient-history from never-enumerated. Phase 1:
derived row round-trips without acquiring `Holt Linear`; a file with no
`Provenance` column imports as fitted. Phase 2: month-key alignment; ragged
leaves; **1-leaf passthrough** (object identity AND rounding); coverage
counting; **zero-contributing leaves derive to `null`, never a zero-valued
forecast**; quadrature not linear; leaf miss returns null with a reason, never a
borrowed number. Phase 3: excluded leaves named in the completion message; an
all-unforecastable selection reports that and derives nothing.

**Generate-on-All reports coverage, not a success count** — "68 of 74 leaves in
scope now forecast; 6 excluded for insufficient history: [named]", not "68
forecasts generated".

**Declared gap:** on both fixtures (42/42/42 rectangular) the excluded-leaf
message is **unreachable**. qa-tester declares it unexercised. That is a
declared gap, not a pass.

#### SEQUENCING AMENDMENT — the ARPU anomaly gates Phase 2

**The ARPU-MAPE anomaly must be established engine-versus-display BEFORE Phase 2
pins its scoring baseline.** If the ARPU path is defective, pinning the baseline
would make the gate **defend the bug** — the spec case would lock in the wrong
numbers and every future run would confirm them.

Phases 0 and 1 are unaffected and may proceed first.

The general shape worth carrying: **a pinned baseline is only as good as the
path that produced it.** Pinning is what makes a number authoritative, so
anything unexplained upstream of it has to be closed first, not noted alongside.

#### The two settled calls

**`summaryMape` comment, verbatim at the site:**

> summaryMape averages per-leaf MAPEs. It is NOT the MAPE of the derived
> aggregate — those are different quantities and must not be unified. See
> EXPECTED.md.

**The reason enum is ONE shared vocabulary**, defined once and used by both
Phase 0 skip-list and Phase 2 null-reason. Internal codes —
`never-enumerated` | `insufficient-history` — rendered through **i18n keys**.
**No hardcoded reason strings.** Two vocabularies for one concept is the pattern
this codebase has now recorded three separate instances of.

### OPEN DEFECT: four ARPU MAPEs identical at 11.4% — 2026-08-04

Reported by the user from the running app. **Observed only. Not diagnosed.**

Step 3, Corporate segment, Jun2026 actuals loaded, 654 months compared:

| card | value |
|---|---|
| Inflow ARPU MAPE | **11.4%** |
| Outflow ARPU MAPE | **11.4%** |
| Retention ARPU MAPE | **11.4%** |
| Base ARPU MAPE | **11.4%** |

The four volume MAPEs beside them are distinct and plausible — 3.2 / 1.1 / 3.7 /
1.0 — so whatever this is sits on the **ARPU path specifically**.

Four independently-fitted series agreeing to one decimal place is not
coincidence. **Signature of one series being read four times, or of one shared
denominator.** That is a hypothesis about the shape, not a diagnosis.

**Nothing traced. No cause established. Do not record one until it is.** Treat
as the previous defect was treated: establish engine versus display first,
reproduce, and do not fix until the cause is established.

**This gates Phase 2** — see the sequencing amendment above.

### COPY FIX (queued): "654 months compared" — 2026-08-04

The count sums **cohort-months**, not months. Against a 42-month history it
reads as a time span, and 654 is not one. Separate from the ARPU defect above
and not a prerequisite for anything; queued as copy.

### The V-shaped dip on Outflow is correct — measured 2026-08-04

A linked Retention event makes Outflow (Adjusted) dip for one month and return,
rather than stepping down and staying. Measured against Base over a 12-month
horizon, retention +15,000 at 2025-10:

| month | Outflow Δ | Base Δ |
|---|---|---|
| 2025-09 | 0 | 0 |
| **2025-10** | **−12,806** | 0 |
| 2025-11 onward | 0 | **+12,806**, held to horizon end |

Outflow is a flow and the event moves it in its own month only; Base is a stock
and steps at T+1, permanently. Both correct, and consistent with the chart's own
T+1 caption. **Not a defect.**

The −12,806 rather than −15,000 is the zero floor: the event exceeded that
month's outflow. See the entry below.

### Retention floors on outflow but splits on retention — 2026-08-04

**Corrected at the lead.** An earlier version of this claimed a pro-rata
reconciliation break, with a worked table showing an aggregate delivering 900
while its leaves delivered 550. **That table was constructed, not measured** —
the leaf shares were hand-set to 0.5 each, an even split the engine never
produces. Under real pro-rata the small leaf would not have floored. **The
reconciliation claim does not stand and is withdrawn.**

What remains, and is unmeasured: the two quantities genuinely differ.

- **Distribution weight** — `eventProRataShare(…, leavesByMetric[e.scenario])`,
  so a Retention event splits by each leaf's **retention** volume.
- **What floors** — `Math.max(0, outflow)` in `applyEventsToMonth`, i.e.
  **outflow**.

A leaf with high retention and low outflow could therefore floor even under a
correct split. Whether that occurs on real data is **not measured**, and should
not be asserted until it is.

Separately and also unfixed: a retention event larger than available outflow
delivers less than requested, silently.

### Establish an artefact's provenance before reading a number from it — 2026-08-04

The 22 April session export has now produced a wrong instrument **twice, from
two different directions**:

1. Comparing its `Adjusted_Forecasts` against today's engine, which measured 194
   commits of deliberate change and read as path divergence.
2. Inspecting its `Baseline_Forecasts` as "a real store", which showed 0 fully-
   aggregate keys and a 55.8% filter-miss ratio — and was about to be reported as
   a reason to change the fix. Current `allCohorts` explicitly enumerates
   aggregate combinations, and a user screenshot showed `Corporate|All|All|All`
   hitting the store, so the current build does not behave that way at all.

Both times the file was chosen because it was real, and "real" was treated as
sufficient. It is not.

**The rule: establish an artefact's commit or date against current HEAD BEFORE
reading a number from it.** One command — `git log --oneline <date>..HEAD | wc -l`
— and if the answer is not close to zero, the artefact describes a different
system.

**A version-skewed artefact is not a weaker source of evidence. It is a
different system.** That distinction matters because "weaker" invites
discounting the number and using it anyway, with a caveat. There is no discount
that makes April's store answer a question about today's store; the two differ
in kind, not in confidence.

The second occurrence also hid a category error worth naming: **a store is a
runtime artefact, not a file.** Being unable to export from the browser did not
mean a current store was unobtainable — the generation path can be invoked
directly over the current test data at the current commit. "I cannot get a real
store" was false; "I cannot get an exported file" was true, and they were
conflated.

### An exported session measures the engine that wrote it — 2026-08-03

Driving both paths from a real exported `.xlsx` was the right instinct: it
removes the hand-built input, which was the source of the error above. But the
export used was dated **22 April 2026, and 194 commits have landed since** —
including bottom-up aggregation, the pro-rata distribution fix and the
tariff-grain correction.

Its `Adjusted_Forecasts` sheet therefore holds what the **April engine**
computed. Comparing today's `computeScenarioForFilter` against it measures four
months of deliberate change, not a divergence between paths. The observed
differences — 13 of 96 values, worst a Retention figure of 616.85 against
129.85, a factor of 4.75 with the shape of the pre-pro-rata over-application —
are consistent with version skew and attributable to nothing else.

**Removing the input variable introduced a version variable in its place.** A
stored artefact carries the semantics of the code that produced it, so an
export is a valid cross-path input only if it came from the build under test.

To settle whether the two paths agree on flows and ARPU, the export has to be
generated from the current build: load the fixture, generate a baseline,
export, then run both paths on that file. **Not yet done.**

**Unaffected: the promo measurement.** Market Events 25.1800 against Scenario
Compare 25.0000 for a Retention promotion with a value-mix arm, with the
control — the same event without the promo flags — giving 25.0000 on both
paths. That comparison never read Base or the seed, so none of the above
touches it. The `promoRebanded` gap is real, reachable and silent, and is NOT
sitting behind a larger Base problem.

### Scanner blind spot: object literals are advisory, not enforced — 2026-08-02

`scan-i18n` buckets user-facing strings held in object literals as
"8 object-literal (REVIEW)". **That bucket does not fail the build.** The
scanner cannot follow the value from the literal to the JSX that renders it, so
it reports rather than blocks.

Found by gate stage 1, not by the scanner: `EventChangeConfirmModal` held six
strings — every modal title and body line — in TITLES and BLURBS objects. They
were neither keyed nor in `I18N_PHASE2`, because that list was built from the
MUST-KEY buckets only. The scanner read PASS over them. **A deferral list built
from the failing buckets inherits the blind spot of whatever does not fail.**

They are now declared. The bucket is still advisory, and deliberately so: 60
further object-literal items sit in App.tsx (38), ForecastVsActualsTab (12),
ForecastSummaryBar (4), WhatIfTab (4) and ManageBulkDrawer (2). Making the
bucket fail would block the build on debt that predates this work; it belongs
with i18n phase 2.

**Until then, treat a green scanner as covering the MUST-KEY buckets only.**
When adding user-facing copy inside an object literal, add it to
`I18N_PHASE2` by hand — nothing will remind you.

### Band 1 wraps, and that is the intended trade — not a defect

`auto-fit` fits as many tracks as the container allows and moves the surplus
to a second row. So a card wraps when its controls exceed the available
tracks, and the wrap point depends on how many controls that card carries.

**Measured wrap thresholds** (`scripts/layout-probe`, real component, long
selection applied — the card is ~973px at `max-w-5xl`):

| controls in the grid | stays on one row above |
|---|---|
| 4 | 780px |
| 5 | 970px |
| 6 | 1150px |

Volume with Tariff inactive is 5 controls and sits on one row at 973px — with
about 3px to spare, so it is genuinely marginal. Activate Tariff and it is 6
controls, below the 1150px threshold, and Month moves to a second row alone.
The same happens on resize at any control count.

#### The cards are not identical in wrap point, and cannot be

They carry different numbers of controls, and only Volume has the three-band
split at all:

| card | grids | labelled cells |
|---|---|---|
| Volume | 3 (targeting / effect / details) | 6 + 3 + 4 |
| Pricing | 1 | 6 |
| Promotion | 1 | 10 |
| Value | 1 | its own shape |

That is why the observed behaviour differs per card: Volume shows Month alone
on a second row when Tariff is active; Promotion, whose single grid holds ten
cells, shows Month alongside Acquisition Volume and Contract Length; Pricing
fits its six on one row. All three are the same rule producing different
results from different inputs.

**What `spec:cards` asserts, and therefore what consistency means here:** one
grid ladder, one vertical alignment, one name per concept, and the agreed
ordering of shared targeting controls. It does **not** assert identical wrap
points, and it should not — that would be asserting the cards carry identical
controls, which they do not.

#### Why the wrap is the better outcome

Forcing one row needs one of two things, and both are worse:

- **Narrower tracks.** This is exactly what produced the original defect. Six
  equal `minmax(0, 1fr)` tracks gave 139px each and controls overflowed into
  their neighbours. A clipped control that silently hides its own text is
  worse than a control on the next line.
- **A wider card.** `max-w-5xl` is a deliberate reading-width constraint
  shared with the rest of the app; widening this one card to fit a row would
  trade a global convention for a local layout preference.

A clean wrap costs vertical space and nothing else. Treat it as expected
behaviour in any layout check, not as a finding.

### CORRECTED 2026-08-02: the month input was never starved

The entry below diagnosed the clipping as a native month input starved of its
155px intrinsic minimum. **That was wrong.** It was built on three hand-written
repros of `HierarchicalDropdown`, each internally consistent and each measuring
markup I had retyped rather than the component itself.

Measured against the real component, mounted (`scripts/layout-probe`):

| | measured |
|---|---|
| Channel trigger, long selection | **236.7px** in a 172.2px cell |
| Overflow past its own cell | **70.5px** |
| Overlap onto the Month cell | **54.5px** |
| Month input | 172.2px — **not starved** |

**The real mechanism.** The trigger sat inside `<div className=relative>`, a
flex item, whose `min-width` defaults to `auto` — so it would not shrink below
its content. `w-full` on the button resolves against that box, making the
constraint circular so it never binds. The trigger therefore sized itself to
the selected label and painted over its neighbour. Adding `min-w-0` to that one
wrapper takes the overflow from 70.5px to 0; removing it again reproduces
70.5px exactly.

The 155px figure and the shadow-DOM clipping note below are both accurate. They
were simply not the cause. The intrinsic-minimum entry is kept because the
scrollWidth finding is worth having; treat its DIAGNOSIS as superseded.

**Why a static floor is now a valid assertion.** It was not before: a
dropdown's width followed its selected value, which is user data with no upper
bound, so no constant could be correct. With truncation guaranteed the variable
is removed rather than bounded, and the only remaining fixed minimum is the
month input's.

### A native month input clips silently — and "uniformly wrong is uniform"

Every card rendered `ugust 2026` instead of `August 2026`. Band 1 was six equal
`minmax(0, 1fr)` tracks; at the real container width (≈912px inner, after
`max-w-5xl` and two levels of padding) that is **139px** per track. A native
`<input type="month">` has an intrinsic minimum of **155px** at this font size
and padding. Forced to `w-full` in a 139px track, it clipped its own text.

| container | track | month needs | short by |
|---|---|---|---|
| 1200 | 187 | 155 | fits |
| 1050 | 162 | 155 | fits |
| **912 (real)** | **139** | 155 | **−16** |
| 860 | 130 | 155 | −25 |

#### Why no check could have caught it geometrically

**`scrollWidth === clientWidth` on a clipped month input.** Measured at 187,
162, 155, 139 and 130px: equal at every one. The native control clips inside
its shadow DOM and reports no overflow. Nothing you can ask the element will
tell you its text is cut.

The only detection is **comparing intrinsic minimum width against allocated
width** — which requires knowing the intrinsic minimums, which requires
measuring them once and recording them. `spec:cards` now does exactly that.

#### Uniformly wrong is uniform

`spec:cards` asserted that all four cards used one identical grid ladder. They
did. It passed while every card was visibly broken, because the ladder was
uniformly **wrong**.

**Consistency is not correctness, and a spec that only checks consistency will
certify a uniform defect.** The assertion now checks the property that matters:
the track floor must clear the widest control's intrinsic minimum. Boundary-
tested at 155 (passes), 154 (fails) and 139 (fails).

#### The fix, and the two companions

`repeat(auto-fit, minmax(170px, 1fr))` replaces a three-breakpoint ladder with
one declaration. Content-sized, wraps naturally, and no fixed column count that
is wrong at some width. Verified across 15 combinations — five container widths
× three control counts, covering all four cards' shapes: **no starved track and
no spill in any of them**, narrowest month track 197px against 155px needed.

The hierarchical dropdown carried `min-w-[100px]` and no `min-w-0` on its root,
so it could not shrink and spilled 6–14px past its cell at narrow widths. It
now truncates. The DARK variant keeps an explicit cap: it lives in the top
filter bar, a flex toolbar with no column to size against.

#### Known consequence: band 3 cells stretch when Revenue and ARPU hide

`auto-fit` collapses empty tracks, so when percentage mode hides two of band
3's four cells the survivors stretch — 216px to 448px at the real width. Band 1
stays pixel-identical and band 3's top does not move, so the step-5 containment
property (nothing outside band 2 REFLOWS) still holds; but the cells resize,
which they did not under the fixed grid.

`auto-fill` would keep them stable by preserving empty tracks — at the cost of
the trailing empty track that `auto-fit` was chosen to remove. The two cannot
both be had from one declaration. **Open: which matters more.** Band 1's shape
is static per deployment (Tariff depends on column mapping); band 3's changes
at runtime on a toggle, which is the more visible of the two.

### Every read of `subscriberVolume`, audited — 2026-08-02

Three defects of one shape had been found one at a time (the Outflow Δ column,
the Inflow ARPU pool, then the pool again in the second path). Finding a fourth
the same way would have been a process failure, so every read was enumerated
and classified instead: **67 sites**, across both application paths and the
display layer.

The rule that decides each one: **does this site treat the field as a count?**
If yes, a percentage event — which stores a PERCENT there — makes it wrong.

#### Fixed, because they were reachable

| Site | What went wrong |
|---|---|
| `scenarioHelper` base pool | The `else` branch adds `Subscriber_Volume` raw to `p_basePool`. It is reached whenever an event carries no ARPU of its own — which is **every** percentage event, since the add path zeroes ARPU for them. It put the percent into the base pool. |
| `retentionWarnings` | Compared `subscriberVolume × share` against forecast outflow. For a percentage event that compares ~10 against thousands, so the warning could never fire — a **false negative**, the worse direction for a warning. |
| The warning text | Printed the stored figure through `formatNumber`, rendering "10" as a subscriber count for a 10% event. |

#### Unsafe but unreachable — recorded, not fixed

`WhatIfTab`'s **`promoRebanded` pool** still sizes from `e.subscriberVolume *
eventShare(e)` with no `amountType` guard.

It cannot be hit today: that pool is built only for events with
`promoRebanded`, which is set exclusively by `buildPromoEvents`, and
`buildPromoEvents` never sets `amountType` — percentage is a Volume-tab
capability by rule. There is no path by which a percentage event acquires
`promoRebanded`.

Left as-is deliberately rather than defensively patched, so that it fails
loudly if percentage-on-promo is ever attempted without doing the engine work
first. **It is step 2 of the order recorded in the promo-card entry below,**
and a silent guard here would remove exactly the signal that order depends on.
A one-line change to `resolvedEventVolume` closes it whenever that work starts.

#### Safe, and why

- **`sharedVolume` at both application sites** — passed to `applyEventsToMonth`,
  which ignores it entirely for percentage events (phase 1 returns early). Safe
  by construction, not by coincidence.
- **`percentAmount`** — reads the field *as* a percent. Correct.
- **`revenue ÷ subscriberVolume`** ARPU derivation — guarded by
  `Math.abs(e.revenue) > 0`, and percentage events carry revenue 0. **This is
  the same accidental protection the pool relied on**; it holds only while
  nothing bakes revenue onto a percentage event.
- **Campaign spread reconstruction** (`Math.abs(e.subscriberVolume)` summed) —
  gated behind `group.editable`, and `groupByCampaign` bars any campaign
  containing a percentage row. Safe by rule.
- **Table delta columns** — render through a percent-aware formatter.
- **Form state, export, import, validation** — store and round-trip the field
  without interpreting it.

#### The lesson, since this is the third instance

**Adding a second meaning to an existing field makes every existing reader a
candidate defect.** `amountType` changed what `subscriberVolume` means, and the
engine was taught the new meaning while sixty-odd other readers were not. None
of them broke loudly; two were invisible because an unrelated value happened to
be zero.

When a field gains a mode, enumerate its readers **at that moment** and classify
every one. Finding them individually afterwards, by symptom, is what happened
here and it took three rounds.

### The ARPU pool read a percentage event's percent as a headcount — 2026-08-02

Pass 2 sizes each event's ARPU pool from the volume the view received:
`size: e.subscriberVolume * eventShare(e)`, with no `amountType` guard. For a
percentage event `subscriberVolume` holds the PERCENT, so a +10% event that
added 755.6 subscribers built a pool of **10**. Both paths had it —
`WhatIfTab` and `scenarioHelper` — and neither had `derivations` available to
do better.

**Measured, on the fixture:** blended ARPU 25.00 where the correct figure was
25.13; the wrong value matched a pool of size 10 exactly. Path B: 25.000614
against a correct 25.046397, within 1.1e-6 of the raw-percent case. After the
fix both match the correct figure, Path B to full precision.

**It did not bite through the UI, and that is the uncomfortable part.** The add
path forces `arpu: 0, revenue: 0` on percentage events, so their pool derives
the baseline ARPU, which is the base pool's ARPU, so a wrong SIZE moves a blend
of identical rates by nothing. Verified: with ARPU 0 the defect is invisible.

**That protection was a side effect, not a rule.** Nothing declared it, nothing
tested it, and the first caller to bake a real ARPU onto a percentage event —
a promo mix arm, precisely the feature under discussion — would have removed it
silently. `resolvedEventVolume` now makes it explicit, shared by both paths so
this cannot become a fourth implementation of "what volume did this event
contribute".

The class of defect is the one already recorded above for the Outflow Δ column:
**a derived value computed independently of the engine drifts exactly where the
engine was taught a case the derivation was not.** Second instance in two days.
When percentage support was added, every site that reads `subscriberVolume` as
a count became a candidate; two were found by reading, both by looking for the
pattern rather than the symptom.

### Percentage on the Promotion card — declined, and the reason is the
### resolution model, not the interaction count — 2026-08-02

The original exclusion cited interaction complexity: an optional mix arm plus
an optional pricing arm plus a percentage volume basis multiplies the cases.
That was the wrong reason, and the user has said so. The blocker is structural.

**Percentage events defer resolution.** The actual delta is computed per view,
per month, inside `applyEventsToMonth`, and everything upstream is deliberately
left unresolved — which is why percentage rows dash ARPU and revenue.

**`buildPromoEvents` resolves eagerly.** It bakes a concrete volume, ARPU and
revenue once at creation. Three downstream mechanisms depend on that being a
real, scale-bound number: the Inflow pool's `revenue ÷ volume` ARPU derivation,
the `promoRebanded` Retention pool, and campaign-edit spread reconstruction.

A percentage anchor cannot supply what eager resolution needs. That is not a
form problem and no amount of form design fixes it.

**Order, if it is ever taken up:**

1. Settle the pool question. *(Done 2026-08-02, above — it was a real defect.)*
2. Teach the pool code to consume `applyEventsToMonth`'s derivations in BOTH
   paths, verified byte-identical for absolute cases first. *(Done for the
   Inflow pool; `promoRebanded` still reads `e.subscriberVolume` directly.)*
3. Then the form — and only then, with the volume % and the price % visually
   and lexically separated well beyond a shared "%" glyph.

#### Pre-existing drift: `computeScenarioForFilter` has no `promoRebanded`

`WhatIfTab`'s adjusted-forecast engine carves an isolated re-banded ARPU pool
for a Retention promo carrying a mix and/or pricing arm. **`scenarioHelper` has
no equivalent block at all.** Retention-promo re-banding therefore happens in
one of the two event-application paths and not the other, today, for absolute
events.

Found 2026-08-02 while scoping percentage-on-promo. It predates that work and
is not caused by it. Recorded rather than fixed: it is a behavioural difference
between the two paths that needs a decision about which is correct, not a
mechanical alignment.

### Percentage events: the display bug only the browser could find — 2026-08-01

The table computed Outflow Δ for a Retention event as `-subscriberVolume`,
unconditionally. An UNLINKED retention event does not touch outflow, so the
table advertised a movement the engine would never make.

Every unit measurement passed. The engine was right — `applyEventsToMonth`
skips the outflow coupling when `retentionLinked === false`, and that is
mutation-tested. The table was right about linked events, which is every event
that existed before this feature. **The two were only wrong together, on
screen.** No harness compared them, because comparing a rendered table cell
against an engine field is not a comparison either one invites.

Found by creating a percentage Retention event through the UI with the link set
to No, and reading the row. That was the first percentage event in this feature
not constructed in a harness.

The lesson is narrower than "test in a browser". It is: **a derived display
value computed independently of the engine is a second implementation of the
rule**, and it drifts exactly where the two disagree about a case only one of
them was taught. Prefer reading the engine’s own output; where the table must
derive, make the derivation depend on the same flag the engine reads.

#### The other three the form had to get right

- **Sign.** Absolute Outflow volumes are stored negative; percentage amounts
  are not, because a percentage applies in its natural direction. `neg()`
  excludes percentages, or +10% outflow would store as −10%.
- **ARPU auto-fill.** `resolveEventArpuRevenue` is skipped for percentages. Its
  trailing average is a per-subscriber figure that means nothing here, and
  storing one would put a misleading number behind a deliberately dashed column.
- **Spread.** Hidden for percentages rather than guarded: spreading 10% over
  three months is ambiguous between 10% total and 10% each, and no answer was
  settled. Switching to percentage also clears a spread already toggled on,
  which would otherwise persist invisibly and still apply on Add.

### Percentage events: the traps in the surrounding work — 2026-08-01

Three places where the obvious implementation is quietly wrong, and one
pre-existing gap left open deliberately.

**The ARPU Δ dash cannot key off `arpu !== 0`.** `resolveEventArpuRevenue`
auto-fills the cohort trailing average whenever ARPU is left blank on an Inflow
or Retention event, so a percentage row normally arrives carrying a non-zero
`arpu`. The rule lives in `eventArpuDelta` and keys off `amountType`. It was
extracted from the JSX for a reason: while it was inline, the spec could only
restate it, and a mutation reverting the table to the naive rule passed every
assertion. **A test that restates a rule tests the restatement.**

**A confirmation's "after" must be the state that will exist.** The mechanism is
structural: the pending change carries the exact array to be committed, the
preview is computed from that array, and confirming commits that same array.
There is no second derivation to drift. The first version of the summary read a
single month — the last — and so reported "no change" for any event dated
earlier, which is most events. Flows are now totalled across the horizon and
Base, being a stock, is read at the final month.

**Percentage rows are barred from campaign group edit by rule.** Group edit
reverse-engineers a ramp by summing `Math.abs(subscriberVolume)`, meaningless
for a row storing a percent. An `amountType` clause was also added to the
homogeneity test and then removed: it sat behind the blanket rule, so it could
never change an outcome, and deleting it left every assertion green. **An
unreachable guard reads as protection while providing none** — prefer one rule
that fires to two where only the first can.

The intra-campaign **date** sort is untouched. It feeds those month offsets and
answers a different question from the table's display order.

**Provenance comes from the engine.** `applyEventsToMonth` records basis,
percent, coverage and delta as it uses them. A view-side re-derivation would
look entirely plausible while drifting from the calculation it claims to
explain.

#### Still open: import site 2 drops the promo fields

`App.tsx` has TWO independent import routines — session restore and the
actuals-workbook path. The workbook path has never restored `isPromotion`,
`promoRebanded`, `promoMixAxis`, `promoMix`, `promoPricingMode` or
`promoPricingAmount`.

Every percentage field was added to **both**, and a mutation test confirms a
field removed from either side fails. The promo gap predates this work and was
left alone rather than folded in, so the scope decision stays with the reader.
It is worth closing: it is the same shape of bug, sitting in adjacent code.

### Percentage events: coverage, not share — 2026-08-01

Absolute and percentage events need **different** scoping arithmetic, and the
two functions are one character apart in intent and easy to swap by accident:

| | formula | used by |
|---|---|---|
| `eventProRataShare` | metric(view ∩ target) / metric(**target**) | absolute |
| `eventCoverage` | metric(view ∩ target) / metric(**view**) | percentage |

An absolute event carries a fixed quantity that must be **split** between the
cohorts under its target. A percentage carries no quantity — it scales whatever
it lands on — so splitting it would shrink it wrongly. What it needs instead is
how much of what it landed on it is entitled to touch.

Concretely: event targets All, view is one cohort. Coverage is 1, so +10% means
+10% of that cohort. The share would be well under 1 and would understate it.
Reverse the containment — event targets one tariff, view is the whole cohort —
and coverage is that tariff's fraction, so +10% of that tariff lands as the
right absolute number at the aggregate.

**Measured:** each of 5 tariff leaves took exactly 10% of its own inflow
(RED L 369.4, RED M 212.8, RED S 19.0, RED ULTD 22.6, RED XL 208.7) and the
leaves summed to 832.500000 against an aggregate effect of 832.500000 — exact.

**Known characteristic, not a defect.** `buildLeaves` applies no date filter, so
leaf weights are all-time totals and coverage is an all-time ratio applied to
one month. On the measured case that is 0.442442 against the month's own
0.443724, 0.128 pp apart. `eventProRataShare` has always behaved this way for
absolute events; the two are consistent with each other, which matters more.

#### The `sequence` field is not load-bearing for the maths

Worth stating plainly because the natural assumption is the opposite, and the
design note that motivated this feature made it (see the bulk-edit entry).

Percentage events are flat: each resolves against a basis frozen before any of
them ran, so none can observe another's output. Two +10% events give +20%, not
+21% — **verified, and verified to be distinguishable**, since 1200 and 1210 are
different numbers. Reversing the array changes nothing, and neither does moving
an absolute event between two percentages.

So there is no processing order to get right, and adding one would create the
coupling it appears to guard against. `sequence` exists for display stability
and edit-slot retention. If percentages are ever made to compound, this stops
being true and sequence becomes load-bearing for the numbers — a much larger
change than it looks.

#### Why two phases

`adjusted` basis has to mean something stable. Resolved inside the original
single mutating pass, "the adjusted value" would have meant whatever the running
total happened to be when that event's turn came — making the result depend on
array position, which the user neither controls nor sees. Absolutes apply, the
result is snapshotted, then every percentage resolves against baseline or that
snapshot. **Verified:** an absolute event placed before or after a percentage
event gives the identical answer, and the two bases give different answers
(13157.5 vs 13557.5) so the check is not vacuous.

#### One spec assertion had to change, and why that was legitimate

`spec:prorata` asserted `forecasting.ts carries no RATE-event matcher`. True when
written — EXPECTED.md claimed it did and grep found none. It stopped being true
hours later, when both paths were refactored to delegate to
`applyEventsToMonth` and the ARPU branch moved into `forecasting.ts`.

The old assertion was about **where** rate handling lived, which is not the
property worth protecting. It now asserts the durable one: wherever it lives, a
rate is added directly and never scaled by a share or coverage, and the
percentage phase never assigns to `arpu`. Both mutation-tested.

The general point: when a structural assertion fails because of a deliberate
refactor, check whether it was asserting the invariant or merely its current
address. Deleting it loses the invariant; leaving it forces the code to keep an
arrangement nobody chose.

### Pro-rata leaf weights are PER METRIC — fixed 2026-08-01

Leaf weights used to ignore which metric an event moved.
`scenarioHelper.ts` weighted every event by `Inflow_Mean` unconditionally;
`WhatIfTab.tsx` summed the value column over every row for a leaf with no
filter on the metric column. So an Outflow or Retention event was distributed
across leaves in proportion to their INFLOW mix.

**Totals always reconciled**, which is why this survived the original pro-rata
work: the aggregate equalled the sum of its leaves throughout. The error was
entirely *within* the cohort.

Measured before the fix, `Corporate · Mobile Voice · Direct`, June 2026, a 10%
Retention event over five tariff leaves: RED L +4.3 subscribers, RED XL −3.4,
±2% per leaf. After: every leaf takes exactly its own share of the metric being
moved, verified through the real `eventProRataShare` rather than a
reimplementation.

**Blast radius, measured across the trimmed fixture:** 82 leaf-shares compared
(28 cohorts × Outflow and Retention, every tariffL1 leaf including single-leaf
cohorts), 34 moved (41.5%), 48 unmoved, 4 of 28 cohorts affected. The unmoved
population is the one whose metric mix already matched its weighting source.

**State which "before" the movement is measured against.** The two paths did not
share a prior behaviour, so there is no single number:

| Prior baseline | Path | Largest single-leaf change |
|---|---|---|
| Blend of all metrics | A, `WhatIfTab` | **2.39 pp** |
| `Inflow_Mean` only | B, `scenarioHelper` | 2.34 pp |

Both peak on the same leaf and scenario (`SOHO · Mobile Voice · Direct · RED L`,
Retention), and the moved/affected counts are identical either way. A gate pass
re-derived this and reported 2.17 pp against a narrower enumeration — cohorts
with ≥2 leaves only (51 comparisons), Inflow-only baseline. That is not a
contradiction; it is a third denominator. Quote the baseline and the enumeration
with the figure, or the next re-derivation will read as a disagreement again.

#### The zero case needed a new signal, not a new rule

`distributeProRata` fell back to an even split whenever the leaf total was zero,
so an event targeted at a cohort with no history was never silently discarded.
Under Inflow-only weighting that branch almost never fired. Under metric-specific
weighting it fires often — and it must do **two opposite things**:

| Case | Correct result |
|---|---|
| Established cohort that churned nobody this month | **zero** for every leaf |
| Brand-new product with no outflow history at all | **even split**, so the event is not discarded |

A bare volume of 0 cannot tell them apart, so `ProRataLeaf` gained
`hasMetricData`, set from row PRESENCE rather than value. Omitting it preserves
the pre-2026-08-01 behaviour: `eventProRataShare` passes `undefined` unless some
leaf actually carries the flag, because mapping an absent flag to `true` would
make every un-updated caller take the zero branch — the exact inverse of the
intent, and a mistake made and caught during implementation.

Guarded by `npm run spec:prorata`, which mutation-tests both directions and
asserts structurally that no pro-rata call site touches a rate metric.

### Accuracy scores will move — this is not a regression

**CORRECTED 2026-08-01. This entry named the wrong path, and it is the second
time this section has misled with different content** (it previously listed
three event-application paths when `computeWhatIfData` had been deleted). A
reader sizing pro-rata work from the old text would have targeted
`scenarioHelper.ts` and found no effect on accuracy at all.

**PATH A feeds `useAdjustedScoring`, not Path B.** Verified:
`ForecastVsActualsTab.tsx` contains **zero** references to `scenarioHelper` or
`computeScenarioForFilter`. It reads `adjustedForecast.adjustedMonths[].uplifted.*`
from context, and the only writers of `adjustedForecast` are
`WhatIfTab.tsx:2064` — the output of `computeAdjustedForecast`, Path A — and
`App.tsx:1034` on session import.

So Path A's wildcard
defect was corrupting MAPE for any leaf cohort in scope of an aggregate-targeted
event. Correcting it **moves leaf accuracy scores**, and the *direction depends
on whether the actuals contain the event*:

- Actuals do **not** contain the event (hypothetical/planned scenario) —
  scores **improve**, because the leaf was being inflated by the full event
  volume when it should carry only its share. Measured on a Corporate · All ·
  All +10,000 backtest: all four leaf cohorts improved, IoT 14.02% → 5.22%
  MAPE. The aggregate was unchanged at 5.25% (it was always correct).
- Actuals **do** contain the event (it really happened) — scores move the other
  way, toward worse stated accuracy, which is the honest correction.

Sum of leaf uplift moved 680,424 → 650,424, i.e. exactly the aggregate's
+10,000 rather than 4× it. A score shift on this path after a change to event
distribution should be checked against this rule before being logged as a
regression.

**Saved sessions:** events stored in sessions created before this fix reload
with corrected — smaller — leaf magnitudes. The stored event is unchanged; only
its distribution is. This is accepted and expected.

---

## 16b. Known coverage gaps — cannot be measured on the current fixtures

These are not passing checks. They are checks that **cannot be run** with the
fixtures in `test-data/`, recorded so a future fixture is built to reach them
rather than the gap being rediscovered.

### Product L2 combined with Tariff — UNMEASURABLE, inferred only

`actualsAggrMap` and `computeForecastMape` both filter actuals to a forecast's
cohort. Their predicates guard segment, product L1/L2, channel L1/L2 and (since
2026-07-29) tariff L1/L2. Whether the **L2 and tariff guards compose correctly**
has never been measured, because the synthetic fixtures are collinear: under
`Corporate · Mobile Voice · Direct`, each tariff maps to exactly one
`Product_L2_Value_Tier` / `Channel_Level_2` pair, so no test case exists where
L2 and tariff vary independently. Correctness there is **inferred** from the
guards being structurally identical and independently applied — not verified.

**What a future fixture needs:** at least one Segment/Product-L1/Channel-L1
cohort where two different `Product_L2_Value_Tier` values each appear under two
or more different `tariff_tier_l1` values. Then assert that filtering to
(L2 = X, tariff = Y) reads actuals for that intersection only, and that the
Base actual matches the Base forecast's grain.

### Accuracy-table denominator depends on the active filter — MEASURED, OPEN, BRANCH PARKED

**Correction history — read before citing any figure in this entry.**

| Date | Recorded blast radius | Status |
|---|---|---|
| 2026-07-28 | 20 of 25 rows | **WRONG** — artefact of a harness seeding only 5 Corporate siblings |
| 2026-07-29 | 2 of 25 rows | **WRONG** — artefact of a harness generating only the Mobile Voice / Direct slice |
| 2026-07-30 | ~99% of rows in a typical session | **WRONG** — assumed `matchingBfs` required an exact key match; it does not |
| 2026-07-30 | 0% fully generated → ~80% with one of five segments generated | current |

**Both prior reproductions were harness artefacts.** Neither the 20-row nor the
2-row figure describes app behaviour. Both arose from a `forecastStore`
populated along one narrow slice; each time, the shortfall in the harness was
read as a defect in the app. A third estimate was wrong for an unrelated
reason — it modelled the lookup as exact-match when the real resolution falls
back to a partial match. **Do not cite any figure in this table above the last
row, and treat a new extreme figure as a harness result until proven otherwise.**

#### The driver is segment-level forecast coverage

`matchingBfs` ([ForecastVsActualsTab.tsx:629](../src/components/ForecastVsActualsTab.tsx))
resolves a grouped accuracy row against 7-part leaf keys in two tiers:

1. **Exact.** Build a key carrying the row's value in each *grouped* slot and
   `'All'` in every other slot. One `forecastStore.get()`.
2. **Partial match, then sum.** On a miss, scan the whole store keeping every
   entry where the **segment** matches and each **grouped** dimension matches.
   Non-grouped dimensions are unconstrained. Survivors are deduplicated
   (productL2-specific preferred over aggregate; channel-aggregate preferred
   when channel is not grouped) and summed by `flowBandMaps`.

The share-scaled fallback fires **only when tier 2 returns empty**. Segment is
the only dimension never relaxed, so in practice the fallback fires exactly for
rows whose **segment has no forecast at all**.

Measured against the real predicate over all 27 legal groupings (5,763
enumerated rows, tariff fixture):

| Coverage scenario | Rows on the fallback |
|---|---|
| One of five segments generated (108 of 540 leaves) | **4,587 of 5,763 — 79.6%** |
| Bulk-generated everything | **0 of 5,763 — 0.0%** |

The rate is flat at ~79–80% at *every* grouping, coarse or fine, because it is
simply the fraction of segments with no forecast. **Grouping granularity is
irrelevant. Structural data gaps are irrelevant** — at coarse groupings every
combination is populated, and at fine ones tier 2 still matches within a covered
segment.

#### A completed bulk run leaves zero fallback — verified 2026-07-30

Scenario (b) is not optimistic. `allCohorts` ([App.tsx:3370](../src/App.tsx))
enumerates the **full hierarchy**, not a coarse grain: `['All', …segments]` ×
product `{All|All, L1|All, L1|L2}` × the same for channel and tariff, keyed by
`makeForecastKey(...)` — the identical 7-part format `matchingBfs` parses. It is
filtered by `cohortHasData`, which is backed by `populatedCohortKeys`
([App.tsx:3481](../src/App.tsx)) — a set that, for each populated leaf, inserts
**every hierarchical ancestor including the leaf itself**. A completed bulk run
therefore writes a forecast for all 540 populated leaves *and* every populated
aggregate above them.

**The defect exists only in the partially-generated window**, and closing that
window shrinks the affected population directly.

#### The most visible way to close that window did not close it — fixed 2026-07-30

Until this was fixed, **"Generate Missing" on the Overall Forecast tab did not
write `forecastStore` at all.** `OverallForecastTab.tsx` ran its own generation
loop straight into `savedForecasts` (5-part cohort ids, `fKey|type|scenario`),
never calling `generateAllMissingForecasts`, never writing the 7-part keys
`matchingBfs` reads, and never recording a `bulkRuns` entry. Confirmed by
`grep -c "setForecastStore" src/components/OverallForecastTab.tsx` → **0**.

The two stores have different key shapes, so nothing type-errored and the button
reported success.

**Consequence for the coverage picture above: a user could run "Generate
Missing" to completion, see it succeed, and still sit at ~80% fallback**, because
none of what it generated was visible to the accuracy table. Any historic report
of a high fallback rate from a user who had "generated everything" is consistent
with this and is not evidence against the denominator analysis.

Its missing-filter had also drifted (no `forecastType` guard, counting What-If
cohorts), and the tab's status filter had a fifth variant with no `cohortHasData`
guard — so selecting status "missing" listed the ~10x-inflated cross-product
while the button beside it counted only populated cohorts. All five now consume
one `missingStandardCohorts` memo in `App.tsx`.

#### What is actually wrong

The Historical Accuracy table shows **every** cohort (`cohortActualsMap` is
deliberately unfiltered by `activeFilter`), but its share denominator is not.
`broadAggrSnapshotMap` only takes its own broad path when `hasL2` is true, and
`hasL2` tests `productL2`/`channelL2` only, never tariff. A tariff-specific,
L2-`All` cohort therefore falls through to `aggrSnapshotMap` — a direct
projection of the `activeFilter`-scoped `actualsAggrMap`.

#### Reproduction — SUPERSEDED, retained as a worked example of the artefact

**This reproduction does not survive a correctly populated store.** At the
Segment+Tariff L1 grouping with all 540 populated leaves seeded, fallback is
**zero** — including both rows below. They failed only because that harness
built forecasts along the Mobile Voice / Direct slice alone, so no forecast
existed for those segments anywhere; given any forecast for their segment
carrying that tariff, tier 2 matches. The figures are kept because the
*mechanism* they expose is real and is what a fix must address.

Tariff fixture, 5 segments x 5 tariffs under Mobile Voice / Direct, accuracy
table grouped by Tariff L1, loaded cohort Corporate · RED S:

| Row | Viewing bar on RED S | Tariff filter cleared |
|---|---|---|
| `Large Enterprise · RED ULTD` | **86 / 94 / 89 / 95** | **0 / 0 / 0 / 0** |
| `MNC · RED ULTD` | **78 / 96 / 80 / 92** | **0 / 0 / 0 / 0** |
| the other 23 rows | score normally | **identical** |

**25 of 25 rows score non-zero. 2 are filter-dependent.**

#### Why those two — the mechanism (established 2026-07-30)

`Large Enterprise · RED ULTD` and `MNC · RED ULTD` are the **only two of the 25
pairs with zero rows of data under Mobile Voice / Direct** — verified by direct
count: 0 rows each, against 168–336 for every scoring sibling. Both segments do
sell RED ULTD (840 and 2,352 rows respectively), just never through that
product/channel combination. Fixture collinearity, not a code defect.

With no data there can be no forecast, so `forecastStore` can never hold a leaf
for `seg|Mobile Voice|All|Direct|All|RED ULTD|All`. `matchingBfs` is therefore
empty, and these two rows are **the only ones forced onto the share-scaled
fallback** (`scaledBandFlow` / `computeAvgShare`). The other 23 take the direct
`flowBandMaps` / `cohortBaseBandMap` path and **never touch `aggrMap` at all** —
which is exactly why `Corporate`, `SME` and `SOHO · RED ULTD` score identically
in both filter states.

Instrumented, `Large Enterprise · RED ULTD`, `computeAvgShare('inflow')`:

| Filter state | share | result |
|---|---|---|
| Filtered to RED S | **7.507** | mean lands near LE's scale → 86/94/89/95 |
| Tariff cleared | **0.169** | mean ≈ 32.9 vs actual 1,435 → 4,264% dev → 0/0/0/0 |

A ~44× swing driven purely by the denominator widening from one tariff to five.

#### BOTH states are wrong — the filtered score is not the correct one

86/94/89/95 is not a passing result that the cleared state breaks. That share is
**Large Enterprise's cross-product actual divided by Corporate's
`activeFilter`-scoped total** — a ratio of two unrelated segments with no
principled reason to sit near 1 — multiplied by **Corporate's own forecast** to
fabricate a band for a Large Enterprise row. It is a coincidence of scale. Do
not treat the filtered figures as a target to restore.

#### TRAP — do not fix by clamping

Do **not** cap deviation, floor `primary`, or add a magnitude threshold in
`calcComponentDetail`. That hides the defect while leaving the nonsensical
comparison intact. The fix is the per-row, per-L1-ancestry denominator described
below — comparing one segment's actual against another's filter-scoped total is
wrong whatever score falls out of it.

#### Why the earlier figures were wrong — read this before trusting a re-run

The previous entry cited `SOHO · RED S` scoring 66/80/67/90 filtered and
0/0/0/0 cleared, and a fix attempt that took **20 of 25 rows to zero**. Both
came from a harness that seeded `forecastStore` with **only the five Corporate
tariff siblings**. Every unseeded cohort therefore had no forecast of its own
and fell to `scaledBandFlow`, which scales the LOADED forecast's bands by a
share — a SOHO row scaled from a Corporate forecast collapses to zero whatever
the denominator is. Seed every cohort and all 25 score normally.

Two consequences a future session must not inherit:

1. **The reasoning built on those figures is void.** It was argued that the
   flat-map and per-cohort attempts "failed criterion 3 identically, which
   points away from the denominator toward `scaledBandFlow`". That argument
   rested on the same artefact that produced the failures.
2. **Attempt A had never had a fair test — it has now, and it fails.** The
   reverted unconditional flat-map change was judged against the under-seeded
   harness. Re-tested correctly on 2026-07-30, it fails on merit. See below.

   **There is no attempt B to re-test.** An earlier version of this entry said
   "both attempts were judged against the under-seeded harness", listing a
   per-cohort `Map<cohortL1Key, Map<month, AggrSnapshot>>` alongside the
   flat-map change. **That was wrong.** `Map<string, Map<string, AggrSnapshot>>`
   and `cohortL1Key` appear in **no commit on any branch** — verified with
   `git log --all -S`. It is an **unbuilt design sketch**, recorded in this file
   and never written as code, so it was never judged against any harness, fair
   or otherwise. Do not describe it as shelved, reverted, or previously tried.
   Implementing it is new work.

#### FIXED 2026-07-30 — rows with no forecast render UNSCORED

The fix is not a better denominator. A row on the share-scaled fallback has **no
forecast behind it at all** — that is definitionally what puts it there — so
there is nothing to score and any computed number is fabricated. Such rows now
short-circuit in `buildCohortAccuracy` the moment `matchingBfs` comes back
empty, returning every score, bias, trend and detail as `null`.

`scoreLabel(null)` and `scoreBg(null)` already rendered a grey em-dash for
exactly this state, and `BiasVal`/`TrendVal` are both nullable. **No new UI was
needed — the fallback simply never reached the honest rendering.**

Measured, partially-seeded window, tariff fixture (trimmed):

| | main | after |
|---|---|---|
| 8 no-forecast rows, filter set | `60/75/61/74` etc, orange/amber pills, "Under" | unscored, no bias, no trend |
| 8 no-forecast rows, filter cleared | `0/0/0/0`, rose pills, "Over" | unscored, identical to filtered |
| 5 forecast-backed rows | — | **byte-identical**, both filter states |
| Fully seeded (all 13 rows) | — | **byte-identical — nothing reaches the fallback** |
| Determinism (measured twice) | — | identical |

Two things this exposed that a code reading would not have:

1. **The rows initially vanished instead of rendering unscored.** A pre-existing
   `.filter(row => row.overallScore !== null || row.avgMape !== null)` at the end
   of `buildCohortAccuracy` drops anything unscored. It now also retains
   `row.noForecast`. Replacing a fabricated score with an *absent row* would have
   been a different kind of dishonesty, and the row-count check caught it —
   `partSet` fell from 13 rows to 5.
2. **Criterion 3 passed vacuously twice.** First because `isZero` never matched
   the rendered `0↑ Over` text; then because the 8 rows were missing entirely, so
   there was nothing to test. Both times the criterion read PASS. See
   qa-tester evidence standard 10.

`noForecast` rows carry `null` MAPE, which also keeps them out of the AutoML
Challenger's `avgMape > 5%` threshold — a cohort with no forecast has nothing for
a challenger model to beat.

#### The share-scaled fallback is RETAINED but APPEARS DEAD — measured, not deleted

**Read the measurement below before describing this path as live.** It was
initially expected to survive for a narrower case than the one just fixed — a
row that HAS a forecast, for a month that forecast does not cover. **That
hypothesis was superseded by measurement on 2026-07-30 and is recorded here only
so it is not re-derived.** A regression-guard run afterwards still summarised the
path as "surviving for its intended narrow case"; that is the superseded
hypothesis, not the measured result.

The call site is `ForecastVsActualsTab.tsx:1260`:

```ts
const baseBand = directBand ?? (fallbackBm ? scaledBandFlow(fallbackBm, kpi) : null);
```

`directBand` would be undefined if `flowBandMaps[kpi]` had no entry for a month —
the case actuals-past-the-forecast-horizon would produce. `avgShare*` is also
read by the derived-base-band path at `:873-874`.

**Measured 2026-07-30 — it never fires. 0 of 4,416 band lookups.**

| Condition | Band lookups | Share-scaled | Rows affected |
|---|---|---|---|
| Fully seeded, 12-month horizon | 1,656 | **0 (0.0%)** | 0 |
| Partially seeded (1 of 5 segments) | 504 | **0** | 0 |
| Realistic coverage (~50% of cohorts) | 1,152 | **0** | 0 |
| All three repeated at a 2-month horizon | 1,104 | **0** | 0 |

The second sweep exists because the first looked like it might be vacuous: a
12-month horizon against a 6-month actuals window cannot produce
actuals-beyond-horizon. Forcing the horizon to 2 months should have triggered it
and did not — instead the lookup COUNT fell (1,656 → 552 fully seeded), which is
the structural answer:

**the comparison iterates `allFcMonths`, derived from `matchingBfs` itself.** So
when `matchingBfs` is non-empty every iterated month is by construction covered
by `flowBandMaps`, `directBand` is always defined, and `scaledBandFlow` is
unreachable. Shortening the horizon shrinks the compared window rather than
exposing uncovered months.

**So `scaledBandFlow` / `computeAvgShare` now appear to be dead code** — reachable
only through the empty-`matchingBfs` branch that this change short-circuits.
They were NOT deleted: `avgShare*` is also read by the derived-base-band path at
`:873-874`, whose reachability was not separately established, and deleting a
path on the strength of a measurement that returned zero everywhere is exactly
the inference qa-tester standard 10 warns about. **Removal needs a
dependency-mapper pass, not a confident deletion.** Open, but sized: not
fabricating at scale, and probably not fabricating at all.

#### The defect exists ONLY in the partially-generated window

Re-confirmed by the re-test below: **fully seeded, attempt A changes 0 rows.**
With every cohort forecast, `matchingBfs` resolves for every row — tier 1 exact
or tier 2 partial-match-and-sum — so nothing reaches the share-scaled fallback
and no denominator is consulted. There is nothing there to fix.

Any fix therefore only ever acts on rows whose segment has no forecast. Measure
every candidate in BOTH conditions; a fully-seeded measurement alone will report
any change as a no-op and any fix as harmless.

#### RE-TEST 2026-07-30 — attempt A FAILS on merit; attempt B does not exist

Run on `fix-accuracy-denominator-retest` off main at `018269b`, trimmed
fixture, `forecastStore` seeded per evidence standard 7, both filter states,
whole measurement repeated in-session for determinism.

**Attempt B was never implemented.** `Map<string, Map<string, AggrSnapshot>>`
and `cohortL1Key` appear in **no commit on any branch** — searched with
`git log --all -S`. The text above describing it as "judged against the
under-seeded harness" was wrong: it was a design sketch recorded in this file,
never code, so it was never run at all. Building it is a new implementation,
not a re-test.

**Attempt A — remove the `hasL2` early return so the L1-only re-aggregation
runs unconditionally:**

| Criterion | Fully seeded (41 cohorts) | Partially seeded (1 segment of 5, 15 cohorts) |
|---|---|---|
| C1 identical filter set/cleared | PASS (0 of 13) | **PASS** (0 of 13, against **8 of 13 on main**) |
| C2 Corporate·RED canaries unchanged | PASS (0 of 5 moved) | PASS (0 of 5 moved) |
| C3 no non-zero → zero | PASS (0) | **FAIL — 8 rows** |
| Determinism (measured twice) | PASS identical | PASS identical |
| Rows changed vs main | **0 — no-op** | 8 |

**Attempt A fails.** It achieves filter-independence by **degeneracy**: the
same 8 rows that scored differently between filter states on main now score
`0/0/0/0` in *both*. Main's tariff-cleared state already zeroed them; attempt A
makes the filtered state match the broken one rather than fixing either.
`SOHO · RED S` goes 60/75/61/74 → 0/0/0/0; `SOHO · RED XL` 37/43/37/55 → 0.

The original revert commit `aa925ea` said exactly this. **Its reasoning rested
on the under-seeded harness and was void; its conclusion was nonetheless
correct.** The figure was never 20 of 25 — it is 8 of 13 here — but the failure
mode is real and reproduces on a correctly seeded store.

**Fully seeded, attempt A changes nothing at all (0 rows).** Consistent with
the coverage analysis above: with every cohort forecast, `matchingBfs` always
resolves and nothing reaches the denominator fallback. The defect and any fix
for it are both confined to the partially-generated window.

**Criterion 3 is what caught this, and it nearly did not.** The first
comparison scored `isZero` with `/^0\/0\/0\/0$/` against cells that actually
render `0↑ Over/0↑ Over/...`. The regex never matched, so every `isZero()`
returned false and C3 reported PASS in both directions — attempt A looked like
it cleared all four criteria. Any future harness must parse the leading number
out of each component cell, and must confirm the defect REPRODUCES on main
before crediting a fix with removing it.

#### BRANCH PARKED DELIBERATELY — 2026-07-30

`fix-accuracy-denominator-scoping` is parked at main-equivalent code (both
attempts reverted). **It was not abandoned because either attempt failed on
merit — neither has ever been run against a correctly-seeded harness.** Nothing
in the record below should be read as evidence against either design.

It is parked because the bulk-generate work (offering the missing-forecast
prompt as a standing action rather than only after a manual generation) shrinks
the partially-generated window that is this defect's *entire* blast radius.
Doing that first makes the denominator fix land on a smaller affected
population. Resume by re-running both attempts against **two** stores: fully
seeded, and partially seeded at one segment of five — the realistic condition,
and the one neither attempt has been tested against.

#### Acceptance criteria for a fix — all three together

1. Every cohort scores identically with the tariff filter set and cleared.
2. The five `Corporate · RED *` canary rows are unchanged from main.
3. No cohort that scores non-zero on main scores zero after the fix.

The third exists because criterion 1 alone is satisfiable by degeneracy —
making every cohort equally unscoreable.

#### Extending `hasL2` to tariff is still the wrong fix

It would only change which cohorts reach the already-correct branch. The defect
is the existence of a filter-scoped fallback, not which cohorts reach it.


### `row.arpuScore` — OPEN, and a TRAP for whoever repairs it

`ForecastVsActualsTab.tsx:4380` (the cohort-table tooltip, `kind: 'overall'`)
renders:

```tsx
['Base', row.baseScore], ['ARPU', row.arpuScore],
```

**`arpuScore` appears exactly once in the entire file — at that render site.**
It is absent from the `CohortAccuracyRow` type, never assigned, and therefore
`undefined` at runtime, rendering `—`. The type carries only the four
per-scenario scores (`inflowArpuScore`, `outflowArpuScore`,
`retentionArpuScore`, `baseArpuScore`); the comment at the type definition
records that these "replace single blended arpu score".

#### Do not repair it by pairing blended ARPU with a single scenario's volume

The blended `arpu` (`arpuRevSum / arpuSubVol`) is computed across **all four**
IBRO scenarios. **Its only valid matching volume is `arpuSubVol`** — the total
across those same four. Pairing it with `inflow`, `outflow`, `retention` or
`base` volume produces a plausible, wrong number that nothing will flag.

This matters beyond the tooltip. Every current render site pairs ARPU with the
volume of the **same** scenario, so the hazard is latent rather than live — but
it goes live the moment a blended figure appears next to per-scenario data.
Verified 2026-07-30: no site currently displays a blended ARPU beside a single
scenario's volume.

**Why the warning lives here:** this line sits directly beside the tooltip code
that the deferred ARPU/revenue tooltip phase would touch. A session widening
`TooltipPayload` to carry paired volume will read this line, assume `arpuScore`
is real, and "fix" it — which is exactly when the mismatch becomes shipped
behaviour.

### `broadAggrSnapshotMap` excludes tariff DELIBERATELY — do not "fix" it

A dependency-mapper pass correctly observed that this map filters segment,
product L1 and channel L1 only, and that **no comment claimed the tariff
omission was intentional** — so it looked like drift from the tariff dimension
landing, the same class as `summaryMape`'s missing `tarMatch`. It is not.
Closing the documentation gap here, without changing behaviour:

**Adding `tariffL1` would break the map's purpose.** It is the BROAD share
denominator. Its own comment already warns that scoping it to all seven cohort
fields makes it as narrow as `actualsAggrMap`'s cohort branch, collapsing every
share toward 1 and destroying the band-scaling it exists to perform. Tariff is
**collinear with product and channel** in this data, so including tariffL1
narrows the denominator toward the loaded cohort itself — which is precisely
that failure, not a fix for drift.

**And it is doubly not worth changing:** the share-scaled path this denominator
feeds is apparently unreachable (0 of 4,416 band lookups — see the share-scaled
subsection above), so even a correct change here would move nothing.

Converted to the shared predicate at `L1_ONLY` on 2026-07-31 and measured
byte-identical across five rendered states. The `ScopeDims` argument exists
largely for this site: a predicate that always compared seven fields could not
serve it.

### `computeWhatIfData` is UNREACHABLE — the scoping "defect" is not shipped behaviour

**CORRECTED 2026-07-31. Read this before acting on any figure that follows.**
An earlier version of this entry recorded the What-If scoping gap as an OPEN
DEFECT affecting 98.9% of bulk-generated What-If cohorts, listed requirements
before conversion, and asked for a decision. **The user authorised a widening on
that framing.** The premise was wrong, and the acceptance criterion — a
before/after across the collapse groups — was unsatisfiable, because there is no
"before": nothing produces those forecasts.

#### The reachability facts

`computeWhatIfData` has **three call sites and no reachable caller**:

| Call site | Enclosing function | Reachable |
|---|---|---|
| `App.tsx:2868` | `generateWhatIfForecast` | **No** — that function has zero references in `src/` or `scripts/`. Declared, never called. |
| `App.tsx:2938` | `generateWhatIfForecast` | **No** — same function |
| `App.tsx:3421` | `computeCohortForecastData`'s What-If branch | **No** — see below |

For the third: `allCohorts` contains exactly **one** `cohorts.push`
(`App.tsx:3304`), and `forecastType: 'Standard Forecast'` (`:3313`) is the ONLY
`forecastType:` assignment anywhere in the codebase. `missingStandardCohorts`
filters to Standard Forecast explicitly. `generateCohortForecast` receives its
cohort from `GenerateCohortForecastModal`, whose rows come from `allCohorts`.
**No cohort object with `forecastType: 'What-If Analysis'` is ever constructed**,
so that branch and the `savedForecasts` What-If key writes at `:2883`, `:2969`
and `:3551` cannot execute.

There is also no `wiProductL2Value` / `wiChannelL2Value` / `wiTariffValue` state
anywhere — 0 occurrences. The What-If path never had L2 or tariff selection to
drop in the first place.

#### What the 98.9% figure actually measured

A **synthetic enumeration** over `populatedCohortKeys` — every hierarchical
ancestor of every populated leaf, classified as pooled when any of productL2 /
channelL2 / tariffL1 / tariffL2 is non-`All`. It describes what WOULD happen if
that branch ran. It is not a count of anything the app produces.

The measurement was sound; the label was not. "98.9% of bulk-generated What-If
cohorts" implies such cohorts exist. **They do not.**

#### Do not widen `WhatIfConfig`

It would change zero numbers. The field-dropping at `App.tsx:3421` is real as
code and wrong as code, but it is dead, and widening a config for a function
nobody calls buys nothing. The three call sites belong to the dead-code pass
recorded below, not to a behavioural change.

#### Why this entry misled

The field-dropping was measured precisely and its blast radius sized to four
significant figures without anyone asking whether the branch runs — the same
error as the `exportToExcel` entry below, made again after the rule drawn from
it ("establish reachability BEFORE characterising severity") was already written
into this file. Precision about a mechanism reads as confidence about its
importance. It is not.

### Dead subsystems — three found, each mistaken for live. The pattern, not the instances

**The cost is not the dead code. It is that dead code reads as live.** Two
failure modes, and both have now happened here:

1. **Someone extends it and ships nothing.** `varianceEngine.ts` was flagged
   during the ARPU/revenue mapping as a plausible foothold for a revenue view —
   it would have been extended, and rendered nothing.
2. **Someone characterises its bugs as user-facing.** `exportToExcel`'s 9-part
   key misparse was escalated as a live data-integrity defect on main.
   `computeWhatIfData`'s field-dropping was sized to 98.9%, written into this
   file as an OPEN DEFECT, and a widening was authorised on that basis.

| Subsystem | Found while | Mistaken for | Removed |
|---|---|---|---|
| `varianceEngine.ts` + `ChallengerModels.tsx` | mapping the ARPU/revenue toggle | a live foothold to build on | 2026-07-31 |
| `exportToExcel` | mapping the predicate unification | a live data-integrity defect | 2026-07-31 |
| `computeWhatIfData` + `generateWhatIfForecast` + `WhatIfConfig` | mapping the WhatIfConfig widening | a live scoping defect, 98.9% sized | 2026-07-31 |

**All three were found incidentally, while mapping something else.** None was
found by looking for dead code. That is the signal: the codebase had no way to
surface unreachable subsystems, so they were only ever discovered by walking
into them — at which point the natural reading is that they matter.

#### What makes them read as live

- A prop named for the dead function (`exportToExcel={openExportModal}`), which
  looks like a call site and is not.
- A branch on a discriminator no producer ever emits
  (`cohort.forecastType.startsWith('What-If Analysis')` where the only
  `forecastType:` assignment in the codebase is `'Standard Forecast'`).
- A component that imports a real utility and is itself never imported.
- Precise, internally-correct logic. All three had real bugs. Correct-looking
  detail invites analysis of the mechanism and discourages the prior question.

#### The check that would have caught all three, in one command each

```
grep -rn "<identifier>" src/
```

If the only hits are a declaration, a comment and a same-named prop, it is dead.
That check costs seconds and was skipped three times, twice AFTER the rule drawn
from the first case was written into this file. **Establish reachability before
characterising severity** — and treat "I have measured this precisely" as a
reason to check reachability, not a substitute for it.

#### A dead subsystem leaves a tail — the first sweep missed three

Removing `generateWhatIfForecast` orphaned `whatIfDelta`,
`whatIfRevenueDelta` and `whatIfMissingMonths`: their only setters lived inside
it, so all three sat at their initial values. The first removal pass did not
catch them; the qa-tester gate did.

They were already dead on main — the function was never called — so this was
pre-existing, not introduced. That is the point: **removing a dead subsystem
does not automatically remove what fed it or what it fed.** After deleting one,
grep for the state it wrote and the props it filled, or the tail survives and
still reads as live.

#### A fourth: `MarketEventType`, dead by decoy rather than by orphaning

`src/types/forecast.ts:276` declares
`export type MarketEventType = 'Inflow' | 'Retention' | 'Outflow'`. It has
exactly one reference in `src/` — its own declaration. Verified by grep during
the percentage-events mapping pass, 2026-08-01.

This one is a different failure mode from the three above, and the more
dangerous one. Those were dead because their callers went away. This has been
dead since it was written, and it survives because it is **plausible**: it has
the obvious name for the event type, it sits in the file called `types`, and it
is exported. The real record is the `MarketEvent` interface in
`src/utils/forecasting.ts:4` — a utils file, which is not where anyone looks
first.

So the reachability rule needs a second half. **A symbol can be unreachable and
still cost you, by being the thing a reader finds before the live one.** Grep
for references before extending a type you found by name; a zero-reference
export is not a base to build on, it is a decoy. Left in place deliberately
pending removal, recorded here so the next reader who reaches for it by name
has been warned.

**The tail was removed too, 2026-07-31.** `WhatIfTab`'s `missingMonths` prop and
its gap-warning block are gone. It was not a working capability being deleted —
it was a **duplicate stub of a feature that already works elsewhere**. Gap
detection is live via `calculateBaseForecast`, which computes `missingMonths`
onto the `BaseForecast`, surfaced by StandardForecastTab's amber warning
(checklist item 11). WhatIfTab's copy had no supplier and never fired. Four
`whatif_*` translation keys orphaned by the removal were dropped from all six
locales.

That correction matters: "leave it, deleting a UI capability is a product
decision" was the wrong read. The capability was never in that block — it was in
the live path all along, and the block only made it look like Market Events had
its own gap detection.
#### Retained deliberately

`getUniqueCombos` survives the What-If removal: it is also called by the live
aggregated Standard Forecast path (`App.tsx:2022`). Deleting a helper because
one of its callers died is the mirror-image error.


### Dead code — `exportToExcel` was dead, and was mistaken for a live defect

**DELETED 2026-07-31** (`App.tsx`, ~146 lines). It was declared, never invoked,
never exported. The live export is `exportSession` — the 7-sheet save-point
reached via `openExportModal`.

Its key parser assumed the old 4/5-part format:

```ts
const channel      = parts.length >= 5 ? (parts[2] || 'All') : 'All';
const forecastType = parts.length >= 5 ? parts[3] : parts[2];
const scenario     = parts.length >= 5 ? parts[4] : parts[3];
```

Against the 9-part keys the app has written since Product L2 and tariff landed
(`makeForecastKey`'s 7 parts + `|type|scenario`), that reads **productL2 as the
channel, channel as the forecast type, and channelL2 as the scenario**.
Reproduced: 3 of 4 real key shapes misparsed; only the legacy 5-part What-If key
(`App.tsx:3094`) parsed correctly.

**`exportSession` is unaffected** and always was: it reads `BaseForecast` objects
from `forecastStore` and takes values off `bf.cohort.*`, never parsing a
`savedForecasts` key positionally (`grep -c "parts\["` over it returns 0).
Verified at deletion by building unminified before and after and comparing the
emitted `exportSession` — byte-identical, 13,309 chars, same SHA.

A prop named `exportToExcel` whose value was `openExportModal` was renamed to
`onOpenExportModal`. That name is what made the dead function read as wired.

#### The rule: establish reachability BEFORE characterising severity

This was reported up as "a live, user-visible data-integrity defect on main". It
was not: the logic was verified and the reachability was not. The misparse is
real; nothing can invoke it.

**This is the exact inverse of the `varianceEngine.ts` miss below, and the same
underlying error** — reasoning about a code path's behaviour without first
establishing whether anything reaches it. There it caused a dead calculator to
be treated as a foothold worth building on; here it caused dead code to be
escalated as a shipped defect and to displace planned work.

Before calling anything a defect, a regression, or a priority: grep for call
sites, confirm the identifier is not merely a prop name or a comment, and check
whether a replacement already superseded it. `grep -n <name>` returning only a
declaration, a comment and a prop label is the signature of dead code.

### Dead code — `varianceEngine.ts` / `ChallengerModels.tsx` are NOT live

`src/utils/varianceEngine.ts:78` and `src/components/ChallengerModels.tsx:112`
contain a revenue/ARPU variance calculator. **It is dead.** `ChallengerModels`
is never imported anywhere in `src/`; the live "AutoML Challenger" UI is inline
inside `ForecastVsActualsTab.tsx` on entirely different state
(`challengerDims`, `selectedChallengerGroup`).

Recorded because it is a plausible-looking foothold: anyone building a revenue
view would reasonably find it first and extend it, producing a fifth parallel
ARPU/revenue implementation that renders nothing. Do not build on it.

The live actuals-side revenue accumulators are in `ForecastVsActualsTab.tsx`
(`inflowRev`/`inflowSubVol` and siblings), and the arpu↔revenue resolver for
Market Event definitions is `resolveEventArpuRevenue` in `src/utils/forecasting.ts`
— a different domain, not reusable for chart series.

### The two-store relationship — TWO findings now, wants a mapper pass not a third point fix

`forecastStore` (7-part `makeForecastKey`) and `savedForecasts` (5-part cohort
id, `fKey|forecastType|scenario`) hold the same concept under different key
shapes. Nothing type-errors when they disagree, because both keys are
legitimate strings. Three defects have now come out of that relationship:

| # | Finding | Status |
|---|---|---|
| 1 | Generate Missing wrote only `savedForecasts`, so nothing it produced reached `matchingBfs` | **FIXED** (`ec3c79a`) |
| 2 | Deletes remove the `savedForecasts` entry without pruning `forecastStore` | **OPEN** — below |
| 3 | Compare-mode branches write **key shapes no consumer reads** | **OPEN** — below |

#### 3. Compare-mode write-only orphans — 2026-07-31

The three `segmentMode`/`productMode`/`channelMode === 'compare'` branches of
`generateStandardForecast` (`App.tsx`) call `setSavedForecasts` only — never
`forecastStore`, never `setBaseForecast`. They write keys shaped
`${cat}|${prodKey}|Standard Forecast|${scenario}` (4 fields) and
`${segKey}|${prodKey}|${cat}|Standard Forecast|${scenario}` (5 fields).

**No consumer reads those shapes.** Every reader of `savedForecasts` keys off a
`cohortId` sourced from `allCohorts`, which is always the canonical 9-field
`makeForecastKey(...)|type|scenario`. So those entries are permanently invisible
to `hasForecast`, to the missing-cohort count and to the cohort-forecast viewer.

**Benign today**, and deliberately not fixed: the compare branches produce
comparison chart series rather than cohort forecasts, they never claim to have
generated a cohort, and what renders on screen comes from `setForecastData`, not
from these entries. They also correctly do not fire the bulk-generate trigger,
since nothing was generated to follow up on.

#### Why this now wants a dependency-mapper pass over the relationship itself

Findings 2 and 3 point at the same unexamined area from opposite directions —
**writes that land in a shape nobody reads, and deletes that prune one store but
not the other.** Each was found incidentally while doing something else, which
is the signal that the relationship has never been mapped as a whole.

A third point fix would close one more instance and leave the class open. What
is wanted is a map of every writer and every reader of both stores, which key
shape each uses, and which of the two is authoritative for each question —
then a decision about whether both stores should exist at all. Do not fold that
into an unrelated branch.

### savedForecasts / forecastStore divergence on delete — OPEN, needs its own pass

**Same class as the "Generate Missing" defect fixed in `ec3c79a`, but a
different instance. Fixing that one did not fix this one.**

The project keeps two stores holding the same concept under **different key
shapes**: `forecastStore` on the 7-part `makeForecastKey`, and `savedForecasts`
on the 5-part cohort id (`fKey|forecastType|scenario`). Nothing type-errors when
they disagree, because both keys are legitimate strings.

The generate-side divergence is closed — every generation path now writes both.
**The delete side is not.** In `OverallForecastTab`, both "Clear All"
(`setSavedForecasts({})`) and the per-row delete remove the entry from
`savedForecasts` **without pruning the corresponding `forecastStore` entry**.
The typed forecast survives, so:

- the cohort still reads `hasForecast: true` via `forecastStore.has(fKey)` in
  `allCohorts`, so it never reappears in `missingStandardCohorts` and bulk
  generation will not regenerate it;
- `matchingBfs` keeps resolving it, so the accuracy table scores against a
  forecast the user believes they deleted.

**Pre-existing and untouched by `ec3c79a`** — that diff changed only the
generate side. Recorded here rather than left as a gate observation because
gate findings expire with the conversation and this one has a real user-visible
consequence: a delete that does not delete.

**Needs its own pass, starting with a dependency-mapper run** over every writer
of both stores — there are nine `setForecastStore` call sites in `App.tsx`
alone, and the question of which deletes should prune which store is a design
decision, not a mechanical sweep. Do not fold it into an unrelated branch.

### broadAggrSnapshotMap `hasL2` gate — related, unmeasured detail

`broadAggrSnapshotMap` is the L1-only share denominator for
`buildCohortAccuracy`. Its `hasL2` gate tests only `productL2`/`channelL2`, never
tariff, so a cohort that is tariff-specific but L2-`All` bypasses the broad path
and receives `aggrSnapshotMap` instead — which is a direct projection of
`actualsAggrMap`, and therefore became **tariff-narrow** when the tariff guard
was added. The denominator for such a cohort was accidentally broad before that
fix and is narrow after it.

Whether that shifts share ratios (and so accuracy scores) for cohorts *other
than* the filtered one is **unmeasured**: reproducing it needs `forecastStore`
populated with several sibling tariff cohorts so the accuracy table renders
other-cohort rows. The single-forecast harness used to verify the tariff fix
cannot reach it.

**What a future check needs:** populate `forecastStore` with every tariff
sibling under one Segment/Product/Channel, filter the Viewing bar to one tariff,
and confirm the accuracy-table scores for the *other* tariff rows are unchanged
versus a run with no tariff filter.

---

## 17. Regression checklist (the short version)

Every item below was a real bug or a confirmed Phase 1/2 behaviour. Confirm all
after any change:

1. ARPU MAPE non-zero for Segment-only and Segment+Channel groupings
2. Base actuals read from file, not derived, not beyond June 2026
3. ARPU boundary correction applied on generation (check console log)
4. What-If engine uses selected model, not hardcoded Holt-Winters
5. In-band actuals score 80+; scoring is mean-proximity-primary, symmetric
6. Tooltip inputs match the monthly variance table. **The table rendering at
   all is now also covered by a static check** — `npx tsx scripts/scan-i18n.ts
   --check` fails the build if a `t()` result is used as a property accessor.
   The i18n extraction once turned ``row[`${prefix}_actual`]`` into
   `row[t('actuals_actual', { p0: prefix })]`, the key slug collided with the
   display header `t('actuals_actual')` = `"Actual"`, and the filter matched
   nothing — so the whole table silently rendered empty, in English, for every
   cohort and scenario. A checklist item alone did not catch that; the eye
   slides over a section that is simply absent. Run the static check as well as
   this item.
7. Filters never re-forecast; actuals and forecast filtered at same level
8. Cohort row click scopes chart only; never filters table or filter bar
9. Hierarchical Product L1/L2 and Channel L1/L2 filter correctly
10. Export/import round-trips full state including L2 fields and campaignName
11. Gap detection warning appears for cohorts with missing months
12. All three models generate without error with per-cohort parameters
13. Market event per-row edit patches in place (no duplicate) with correct
    Outflow/Retention sign round-trip
14. Campaign group edit reverse-engineers the spread and replaces (not
    duplicates) the campaign's rows; rename during edit is orphan-safe
15. Tariff-level ARPU and MAPE populate for tariff groupings: with Tariff L1/L2
    Group-by enabled, ARPU MAPE is non-zero and accuracy scores populate (in-band
    cohorts 80+) at tariff level, mirroring Product/Channel. With tariff off (no
    column mapped) all existing scores are byte-identical to pre-tariff.
16. Tariff selection control: none selected by default; searchable multi-select
    dropdown with Select all / Clear; deselecting a tariff removes it from BOTH
    the tariff mix buckets and the targeting dropdowns (and clears it from any
    draft event/mix already using it); remaining mix percentages re-sum to
    exactly 100%; selection round-trips via the `Tariff_Selection` sheet.
16b. Tariff selection constrains scenario/mix ONLY — bulk generation still
    enumerates all data-present tariffs; `selectedTariffs` never appears in
    allCohorts / generateAllMissingForecasts / worker / missingCount / the
    bulk-prompt trigger.
17. Mix dimension selector: Value axis unchanged (value path byte-identical),
    one bucket per Product L2 tier (data-driven, 3 in the synthetic file);
    Tariff axis renders one bucket per selected tariff (dynamic, up to 5 in the
    synthetic file); percentages total 100% on the active axis at all times,
    including right after a deselection; no tariff×value matrix. mixAxis
    round-trips in export.
18. Tariff-targeted volume/pricing events compose with Product/Channel (P/C left
    All), flow into the adjusted forecast, and round-trip export/import + Compare.
19. Bulk generation enumerates only cohorts that have data. Tariff is collinear
    with product/channel in the synthetic data (each combo sells one tariff), so
    the full cross-product is ~10× the real leaves. The bulk target set, the modal
    `missingCount`, the bulk-prompt trigger, and OverallForecastTab's "Generate
    Missing" all filter by `cohortHasData` (the union of each populated leaf's
    hierarchical parents). Expected on the tariff file: 78,336 → 31,856 standard
    cohorts (7,964 dimension keys × 4 scenarios); 0 data-bearing cohorts dropped;
    every data-spanning `All`-aggregate kept (resolved via the worker O(N)
    fallback). Tariff-free file: no-op (4,896 → 4,896). Worker counts 0-row
    cohorts as `empty` (silent), 1-row as `failed` (insufficient-data warning).
20. Volume-only Inflow/Retention market events with ARPU left blank auto-populate
    from the cohort's trailing 3-month volume-weighted average, visibly (form
    placeholder + inline hint) and consistently (same value stored, shown, and
    exported) across every event-construction path. An explicit non-zero ARPU is
    never overridden. Outflow/ARPU-scenario events are unaffected. ARPU MAPE,
    the boundary correction, and the known-good reference cohort (§4) are
    byte-identical to before this change — the fix is confined to event
    construction and never touches `calculateBaseForecast`.
21. Fitted Model Parameters is collapsed by default on Step 1 and reveals via a
    "Show technical details" toggle; the Holt-Winters seasonal-fallback warning
    (§5) and the missing-months gap warning (item 11) remain always-visible
    regardless of the toggle's state — neither is affected by collapsing it.
22. Custom Promotion Card: Volume section always present, cannot be deselected;
    Value-mix and Pricing are independent checkboxes (both/either/neither valid,
    never mutually exclusive). Promo scopes to a tariff via the Phase 2b
    selection control; ramp/decay and IBRO node mechanics behave as they do for
    existing Volume events.
23. A promo's mix skew never alters the base cohort's own mix or ARPU:
    standing base mix and base ARPU are byte-identical before and after any
    promo — Acquisition or Retention, with or without arms. Mix skew and
    promo pricing apply to the promo's own volume only, never the standing
    base. A plain Retention promo with neither arm active behaves exactly
    like an ordinary Retention event.
24. Acquisition-with-mix and Retention-with-mix produce distinguishably
    different ARPU outcomes on identical volume/mix inputs (Base stock grows
    for Acquisition, stays flat for Retention) — if ever identical, the two
    semantics have been conflated.
25. Promotion Card events persist through full session export/import
    (`Is_Promotion`/`Promo_Rebanded`/`Promo_Mix_Axis`/`Promo_Mix_JSON`/
    `Promo_Pricing_Mode`/`Promo_Pricing_Amount` columns on the `Market_Events`
    sheet). `calculateBaseForecast` and `computeWhatIfData` remain
    byte-identical to before this phase.
26. Promotion Card individual-event edit and campaign group edit work the same
    way as the Volume tab's: editing restores volume/dims/date/contract length
    AND the mix arm's percentages/axis and the pricing arm's mode/amount;
    saving a campaign edit replaces (never duplicates) that campaign's rows;
    a non-homogeneous or >24-month-span campaign is correctly marked
    non-editable via `promoCampaignGroups`' gating (mirrors `campaignGroups`),
    same as Volume events.
27. A Volume-tab campaign and a Promotion-tab campaign sharing the exact same
    campaign name never conflict: editing/saving one never removes, edits, or
    strips promo metadata from the other's rows (`campaignGroups` and
    `promoCampaignGroups` are pre-filtered by `isPromotion`, and each Save
    Campaign handler's replace filter only removes its own card's matching
    rows). Deliberate name-sharing across cards (e.g. a real-world campaign
    represented as one Inflow promo + one Retention promo, per Phase 1's
    design) continues to work exactly as intended.
28. Flagging a one-off historical month recovers a distorted seasonal fit:
    injecting a synthetic spike into a flat month of a genuinely seasonal
    cohort measurably distorts the forecast (double-digit % shift on the next
    month's mean); flagging that month and letting the substitution apply
    recovers a fit within ~1% of the pre-injection baseline. An unflagged
    cohort's forecast is byte-identical to before P10 (the `flaggedMonths`
    parameter defaults to none).
29. One-off flags apply consistently everywhere a cohort's historical series
    is read: manual generation, bulk generation, the AutoML challenger
    preview, and the Model/Confidence Advisor recommendations all reflect the
    same flagged months for a given cohort — the recommendation never
    disagrees with what the actual fit does.
30. The one-off form's displayed "Model will use" value always matches what
    `substituteOneOffValue` actually returns for that cohort/month (it's the
    same live call, not a separate computation) — and the real file value
    shown in tables, exports, and Actuals Review is never altered by
    flagging.
31. One-off flags persist through full session export/import (`One_Off_Months`
    sheet); an unflagged cohort's gap detection, `calculateBaseForecast`
    core math, and MAPE/accuracy scoring are byte-identical to before P10.

32. An aggregate with a market event applied reconciles **exactly** to the sum
    of its adjusted leaves — drift 0. Apply one volume event at an aggregate
    target (e.g. Corporate · All · All, +10,000 Inflow), then sum the adjusted
    forecast across every constituent leg: the total uplift must equal the
    event volume, not `legs × volume`. Must hold on **both surviving paths**
    — `computeAdjustedForecast` (`src/components/WhatIfTab.tsx`) and
    `computeScenarioForFilter` (`src/utils/scenarioHelper.ts`). They are two
    implementations of the same concept and have drifted before.
    (`computeWhatIfData` was a third until 2026-07-31, when it was deleted as
    unreachable. Do not trace it; it no longer exists.) Leaf-targeted events must be unaffected, and ARPU-scenario/Yield/
    Pricing events must **not** be pro-rated (see §16).

33. **AI capability — hard gate.** main is under an AI-approval hold, so
    every branch must stay AI-free: no AI/LLM SDK dependencies in
    `package.json`, no AI/LLM imports, model API calls or API-key patterns
    in `src/`, and `.env` not tracked by git (only `.env.example`).

    **Scope, which must be stated whenever this is reported:** the check
    verifies the *working tree*, and therefore what is actually built and
    deployed. That is the right scope for the hold and should stay. It does
    **not** cover repository history or remote branches. The
    `ai-capability` branch on origin, and the AI capability reachable in
    main's history, are a deliberate preservation pending approval — not a
    leak, and not a regression. Removing them would mean rewriting history,
    which is out of bounds.

    Report it as "main's working tree and build output are AI-free" with the
    scope named. Never shorten it to "no AI capability present": that claim
    is broader than the evidence supports, and the gap is exactly where a
    false assurance would hide.

**Verdict rule:** "SAFE FOR USER TESTING" only if all pass. Otherwise list
the failures and the cohort/filter combination that exposed each.
