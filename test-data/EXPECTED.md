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

### RESOLVED — and the four options I offered all failed on the premise

I asked which model to show as the incumbent for a derived aggregate. **The
question was wrong.**

A challenger is only meaningful if it can be ACCEPTED. Accepting one writes a
fitted forecast into the store - and for an aggregate that is
**fit-on-aggregate**, the defect bottom-up replaced and the thing this entire
phase exists to remove. So the comparison is dead at the root, not merely
awkward to label. Every option I listed argued about the label.

**What is still real is the accuracy SCORE.** It measures a real forecast
against real actuals and does not depend on any model being nameable. Dropping
the row threw the measurement away to avoid the comparison.

#### Implemented

- Derived rows **remain**, with their real accuracy scores.
- Where the incumbent model name sat: **the mix** - leaf count plus model
  histogram, from `provenance`. The honest answer to "what model is this
  cohort using" is *several, on cohorts one level down*.
- The better-model comparison is **suppressed at source** for derived rows,
  with the reason on screen: models live on individual leaf cohorts.
- Derived rows are **never acceptance candidates** - that is the line that
  keeps a fitted aggregate out of the store.
- The chart series key is **never empty into `pt[chosenModel]`**; the
  incumbent trajectory line is simply not drawn.
- The model filter treats derived as **its own bucket**, never a member of
  any model's set.

#### The spec, and the trap it fell into first

The row-survival cases replicate the survival rule rather than driving the
component's. Reinstating `if (!chosenModel) return null` left **all of them
passing** - measure-don't-reimplement, inside the spec written to close that
exact defect. A source-level guard now asserts the drop is absent, and it is
the assertion that kills the mutation.

Three mutations shown killing: reinstating the row-drop, letting derived rows
become acceptance candidates, and removing the on-screen reason.

### BACKLOG: the leaf-grain challenger view — the feature's correct future

Sequenced **behind Alessandro's card work**. Design pass required.

Today the challenger operates at whatever grain the dimension toggles produce,
which is always an aggregate - so after this fix it shows scores and mixes and
never a comparison. That is honest but it is not the feature.

**The correct shape:** run incumbent, comparison and acceptance **per leaf**,
over the aggregate-to-leaf map the seam already builds, and **roll the results
up for display**. A leaf has one fitted model, so all three operations are
well-defined there; the aggregate row becomes a summary of its leaves'
outcomes rather than a thing with a model of its own.

**Consistent with instance 2's Session C fix** - `runChallengerForecast`
declining to run when the cohort has no forecast of its own, rather than
seeding from a stranger. Both say the same thing: a challenger belongs where a
fit belongs.

### DEFECT introduced by B2: the AutoML Challenger tab is empty at EVERY grouping

Found by Jon in the browser (check B3, "Review All Cohorts Anyway" appeared
unresponsive). **Introduced by this branch. Merge held.**

#### Cause — two of my own changes interacting

B2a fixed instance 3 so the challenger key resolves, and B2a also added:

```js
const chosenModel = provenanceModel((cohortFcExact ?? baseForecast).provenance);
if (!chosenModel) return null;   // a derived aggregate has no model
```

Before the branch the key was 5-part and could never match, so `cohortFcExact`
was always null and `chosenModel` fell back to the loaded cohort's model - a
real string. Rows survived. Now the key resolves to a DERIVED aggregate,
`provenanceModel` returns null, and every row is dropped.

**Measured, not inferred.** Full Dec2025 fixture, 540 leaf forecasts:

```
default grouping (segment only):   5 of 5   rows dropped
product + channelL1 groupings on: 40 of 40  rows dropped
```

**The tab is empty at every grouping, not just the default**, because the
challenger's dimension toggles never produce a fully-specified 7-part key -
so every key it builds is an aggregate, and every aggregate is derived.

#### Why this is NOT a mechanical fix

`chosenModel` is load-bearing, not a label: it is the chart series key
(`pt[chosenModel]`), the incumbent in the better-model comparison
(`bestModel.name !== chosenModel`), and the model filter value.

A derived aggregate genuinely has no incumbent model - you would change the
LEAVES' models, not the aggregate's. So "which model is this cohort using"
has no answer, and every way of supplying one is a product decision:

| option | cost |
|---|---|
| exclude derived rows and SAY so | the feature becomes unreachable, since no grouping yields a leaf key |
| use the dominant model from the mix | approximately true, and misleading in exactly the way the provenance union exists to prevent |
| show the mix, compare trajectories without a single incumbent | real work; changes the panel |
| revert to the old fallback | the borrow-an-unrelated-cohort pattern, already rejected three times |

**Reported, not fixed.** Picking among these is the user's call.

### Step 1's chart does not follow the filter bar — pre-existing, queued

Established while resolving Jon's A5. `StandardForecastTab` renders
`forecastData`, a `useState` written only by `generateStandardForecast` (the
manual path). It is **not** driven by `baseForecast` and therefore not by the
seam, and no filter change clears it.

So Step 1 can display a forecast for a cohort `resolveForecast` returns null
for - not because two stores disagree, but because Step 1 is the manual
GENERATION panel and never claimed to be a per-filter viewer.

**Not introduced by this branch**: the branch does not touch `forecastData`
(the single diff hit on that name is a context line). Queued as a coherence
wrinkle worth deciding on, not a B2 defect.

**Consequence for the browser checklist:** any check about a cohort resolving
to nothing belongs on Step 2 or Step 3, never Step 1. My A5 path was wrong.

### RESOLVED 2026-08-04 on `session-b2-wire-seam` — aggregates now derive

**The entry below described the open defect. It is fixed, pending merge.**

Measured at gate stage 3 by driving `resolveForecast`'s exact logic against a
real store built from the trimmed fixture (74 leaf forecasts):

```
Corporate|All|All|All|All|All|All        -> derived, 12 months, provenance=derived
Large Enterprise|All|All|All|All|All|All -> derived, 12 months, provenance=derived
MNC|All|All|All|All|All|All              -> derived, 12 months, provenance=derived
SME|All|All|All|All|All|All              -> derived, 12 months, provenance=derived
SOHO|All|All|All|All|All|All             -> derived, 12 months, provenance=derived
```

Every `All`-bearing key resolves. The defect that has been re-confirmed by
every gate since 2026-08-04 - and correctly classified pre-existing each time
- is closed by the seam.

**Not merged.** Jon walks the branch in a browser first; the merge happens on
the user's word after that. Until then this entry says fixed-pending-merge,
not fixed.

The original entry follows, unedited, because the diagnosis in it is the
reasoning the fix was built from.

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

**CORRECTED 2026-08-04: `aggregateForecastBands` is NOT dead.** It was recorded
as having zero call sites. It has **one live caller** —
`forecasting.worker.ts:342`, in the Standard-Forecast bottom-up loop. See the
instrument finding below for why the grep missed it. `aggregateArpu` IS
genuinely uncalled; that half of the record stands.

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

### NOT A DEFECT: four ARPU MAPEs identical — HARNESS ARTEFACT — corrected 2026-08-04

**The entry below was wrong and is superseded. Corrected at the lead, as
recorded, rather than amended in place further down.**

#### The cause: the fixture carries ONE unit price per leaf-month, for all
four scenarios

Measured through the app's own code — `runForecastJob` to fit from the
Dec2025 file, `computeForecastMape` to score against Jun2026, the same
pairing the running app used. Leaf
`Corporate|Mobile Voice|Low Value|Direct|Field / Regional Sales|RED L|SIM-only`,
month 2026-01, raw rows:

```
Inflow     price=6.49  vol=554   rev=3595.46
Outflow    price=6.49  vol=505   rev=3277.45
Retention  price=6.49  vol=351   rev=2277.99
Base       price=6.49  vol=5154  rev=33449.46
```

`Avg_Unit_Price_GBP` is **identical across all four scenarios**; only volume
differs. `Monthly_Revenue_GBP` is exactly price x volume (6.49 x 554 =
3595.46). So per-scenario ARPU = rev/vol = **the same price, by
construction** — 6 of 6 overlap months identical to 6 decimal places.

Four identical actuals series produce four identical fitted series (12 of 12
forecast months identical, real worker output) and therefore four identical
MAPEs: **9.548740594317** on all four, agreeing to 13 significant figures —
floating-point noise on one computation, not a coincidence between four.
Volume MAPEs on the same run were distinct (2.41 / 1.36 / 3.97 / 1.01), the
same signature the user reported.

**Four identical ARPU MAPEs are CORRECT OUTPUT on this data.** No code
defect. The engine is doing exactly what the numbers require.

#### The recorded hypothesis was half right, and the half it got right was
the less useful half

The signature was recorded as *"one series read four times, or one shared
denominator"*. It IS one series read four times — but the sharing is in the
**data**, not in the code. The hypothesis pointed at the reader; the cause
was in what was being read. A shape can be diagnostic of a mechanism and
still be silent about where the mechanism lives.

#### Why the segment-level cards showed 11.4% rather than agreeing exactly

At segment scope the four ARPUs differ slightly — 12.1744 / 12.2146 /
12.2187 / 12.1696 for Corporate, 2026-01 — because summing leaves with
different prices and different per-scenario volume mixes gives four
volume-weighted blends. **That spread is mix, not per-scenario pricing.**
About 0.3%, which displays as the same figure at one decimal place. Same
root cause, one level up.

#### A HARNESS ARTEFACT NEARLY READ AS A FINDING — name it as one

This is the second time on this branch of work. The first was the 21.7% Base
gap. The pattern: a striking number, a plausible mechanism, and an
instrument nobody had inspected.

**The generator for the synthetic source files is NOT in the repo.**
`scripts/build-trimmed-fixture.mjs` only trims an existing file; it does not
create prices. Searched `scripts/` for a generator — `ls scripts/*.mjs`
returns that one file. So the property is recorded here as an OBSERVED
property of the fixtures, and the mechanism that produced it cannot be cited
because it is not visible from this repo.

**What the next fixture must do differently:** give each IBRO scenario its
own unit price per leaf-month. Acquisition, churn, retention and installed
base do not price alike in any real book, and a fixture where they do cannot
distinguish a working per-scenario ARPU path from a broken one. **Every
per-scenario ARPU test on the current fixtures is vacuous** — it would pass
against an implementation that read `inflowArpu` four times.

**Consequence for Phase 2:** the pinned scoring baseline must not be taken
on these fixtures for ARPU. It would pin four identical numbers and the gate
would defend an untested path. The sequencing amendment that made this
anomaly gate Phase 2 is DISCHARGED as to a code defect — there is none — but
it is REPLACED by a fixture requirement: per-scenario prices before the ARPU
baseline is pinned.

#### Superseded original entry, kept for the record

### SUPERSEDED — OPEN DEFECT: four ARPU MAPEs identical at 11.4% — 2026-08-04

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

### Phase 0 — MERGED to main at `9177d9b` — 2026-08-04

Branch `phase0-skip-reporting`, three commits (`7502a6b`, `807c7c1`,
`844258a`), merged with `--no-ff`. Post-merge on main: lint clean, build
clean, `npm run traps` 3 pass / 0 fail / 0 inconclusive, and all six spec
suites green — skip 20, scope 61, mix 17, prorata 21, pct 72, cards 36, zero
failures. No conflicts.

**Still open and carried forward, not closed by this merge:** the new amber
panel and its named list are **unreachable on both fixtures**, so the UI was
never rendered — only the engineered unit spec reaches the branch. And
`never-enumerated` is unreachable from the worker call site, since
enumeration is built from rows that exist; only `insufficient-history` fires
there. The second code is reserved for Phase 2.

### Phase 0 gate: regression-guard OVERRULED on its verdict line — 2026-08-04

Branch `phase0-skip-reporting`, HEAD `807c7c1`. Stage 3 printed:

> **REGRESSIONS FOUND — DO NOT SHIP**

**Overruled.** Recorded with the evidence rather than the decision, so the
override can be judged rather than taken on trust.

#### The sole finding, in the agent's own words

Its one substantive finding was that no `All`-bearing cohort key resolves to a
typed `BaseForecast` — reproduced by looking up
`SOHO|All|All|All|All|All|All` and `All|All|All|All|All|All|All` against a
`cohortDataMap` built from the trimmed fixture, both returning `undefined`.

That is the defect already recorded above as **"Bottom-up is half-implemented:
aggregates never get a typed forecast"**. The agent said so itself:

> This is an **open, pre-existing defect, unresolved by this branch, not newly
> introduced by it.** ... this diff neither fixes nor worsens it — it is
> orthogonal, operating entirely within the leaf-only typed loop.

And in its recommendation:

> the skip-reporting feature itself is clean and safe to merge on its own merits.

**A report cannot conclude DO NOT SHIP on a finding it has itself classified as
pre-existing and orthogonal.** The verdict line contradicted the body.

#### The evidence the override rests on

| check | result |
|---|---|
| `npm run traps` | 3 pass, 0 fail, 0 inconclusive |
| `spec:skip` | 20 passed, 0 failed |
| `spec:scope` / `spec:mix` / `spec:prorata` / `spec:pct` / `spec:cards` | 61 / 17 / 21 / 72 / 36, all 0 failed |
| `npm run lint`, `npm run build` | clean |
| scoped no-AI, no secrets | confirmed, search terms named |
| working tree | clean |

And the diff itself: the only change to the loop the defect lives in is the
`else` arm that names *why* a leaf produced no forecast. It adds no aggregate
enumeration and no derivation, so it cannot move a defect about aggregates
never being enumerated.

Tracked for **Phase 2**, which exists to fix it.

#### The mis-citation, recorded because it is why the rule now names citations

The agent cited the aggregate defect as **§16b**. It is not. §16b is *"Known
coverage gaps — cannot be measured on the current fixtures"*, and it is
**out of bounds as a source for anything** by standing rule. The entry it meant
is in §16, at the line it correctly quoted alongside the wrong section number.

A pre-existing finding is only dismissible if the reader can find the record it
claims to duplicate. A wrong section number turns "already tracked" into a claim
that has to be re-verified by hand — which is most of the cost the
classification was supposed to save. Folded into `regression-guard.md` on that
basis.

### THE EDGE-CASE FIXTURE — what it newly makes reachable — 2026-08-04

`test-data/VBU_IBRO_EdgeCases_ShortHistory_PerScenarioARPU_Jan2023_Jun2026.xlsx`

Built by `npm run build:trimmed-fixture` (second output), proven by
`npm run spec:edge` — **15 cases, 0 failed**. Built FROM the trimmed set, so it
inherits every preservation rule and differs only in the two properties it
exists to introduce.

#### Property 1 — short history

| | |
|---|---|
| leaves enumerated | 74 |
| typed forecasts | 72 |
| **skipped** | **2**, both `insufficient-history` |
| MIXED aggregate | `Corporate\|Fixed Connectivity` — 1 of 4 leaves short |
| ALL-SHORT aggregate | `Large Enterprise\|Fixed Connectivity` — 1 of 1 short |

Truncated to 2 months against a fitting floor of 4. The kept months are the
EARLIEST, so these leaves also END before every other leaf — the ragged-lifetime
shape Q4a says the three seed fields cannot survive. A second thing the
rectangular fixtures cannot express, obtained for free.

#### Property 2 — per-scenario prices, and the trap inside it

Raw ARPU by scenario on a healthy leaf, 2023-01: **72.34 / 75.96 / 68.72 /
79.57**. Revenue is recomputed as price x volume, asserted internally consistent.

**A CONSTANT per-scenario factor is not enough, and the first build proved it.**
MAPE is **scale-invariant** — multiply a scenario's price by k and both the
actual and the fitted forecast scale by k, leaving |actual - forecast| / actual
unchanged. The level-only variant produced four ARPU MAPEs agreeing to five
significant figures: technically distinct, distinct only through rounding noise,
and a fixture that looked like it had fixed the vacuity while not having done so.

Each scenario therefore also carries its own **drift** — a per-month slope, so
the four price TRAJECTORIES differ in shape and not only in level. Shape is what
a forecaster gets right or wrong, so shape is what makes the MAPEs diverge:

```
factor(scenario, monthIndex) = level + drift x monthIndex
  Inflow     level=1.00  drift= 0.000     <- deliberately unchanged, so any
  Outflow    level=1.05  drift= 0.004        divergence is attributable
  Retention  level=0.95  drift=-0.003
  Base       level=1.10  drift= 0.006
```

Four ARPU MAPEs, real forecast-and-score path: **13.88 / 13.43 / 14.39 /
13.02** — a 1.37pp spread. The spec asserts distinctness **and** that the spread
exceeds 0.5pp, so the level-only trap cannot return silently.

#### What this fixture newly makes reachable

Everything below was **unreachable on the trimmed and full fixtures** and could
only be asserted against engineered unit inputs, or not at all:

- **The Phase 0 amber panel and its named skip list.** Previously the UI could
  not be rendered by any real run; declared as an open gap at the Phase 0 merge.
  **That gap is now closable.**
- **The Q4b shape** — a leaf with data and no forecast, contributing nothing to
  an aggregate summed from it while contributing its full weight to that
  aggregate's actuals. Measured as 0 on both other fixtures, so the
  understatement-as-forecast-bias failure had never been seen.
- **Phase 2's coverage counting** — an aggregate whose coverage is genuinely
  partial, so `leafCount` and `coverage` can be wrong in a detectable way.
- **Phase 2's zero-contributing-leaves case** — the all-short aggregate has NO
  fittable leaves, so derivation must return `null` rather than a zero-valued
  forecast. There was previously no data on which that could be exercised.
- **Phase 3's excluded-leaf completion message** — the "6 excluded for
  insufficient history: [named]" branch, declared unreachable in the approved
  plan.
- **Non-vacuous per-scenario ARPU assertions.** Every such test on the other
  fixtures would pass against an implementation that read `inflowArpu` four
  times. **This is the fixture Phase 2 must pin its ARPU baseline on** — see the
  corrected ARPU entry, where pinning on the old fixtures would have had the
  gate defend an untested path.

#### It does not replace the other fixtures

Routine agent runs still use the trimmed file. This one is for the branches the
trimmed file cannot reach. Both are needed; a fixture that only contains edge
cases stops being representative of anything.

## WORKING PRACTICE: every browser walk opens with the same anchor

**Standing rule, set by the user 2026-08-05, after a walk was invalidated by
fixture identity.**

Jon's B3 mini-walk produced no usable verdicts. The session was on the FULL
fixture (540 cohorts on the challenger tab, six-figure Base at Large Enterprise
- Fixed Connectivity) with **tariff unmapped**, and A4 was run on Step 1. Every
observation was real; none of them answered the question asked, because the
configuration they were taken in was not the configuration the checklist
assumed.

**The walk I issued omitted the row-count-first anchor that every prior walk
opened with, and the exact failure that anchor prevents is the one that
occurred.** That is not bad luck. The anchor is cheap, and it was dropped
because the checks felt self-evidently well-specified.

### Every walk begins with, in this order

1. **The reload ritual** - hard refresh, so no state survives from a previous
   session.
2. **The named file**, in full, including the part of the name that
   distinguishes it from its near-twins.
3. **The expected row count**, verified on screen before anything else.
4. **A mapping-step assertion** - which dimensions must show as mapped. Not
   "check the mapping looks right": name them.

A walk that does not start with all four is not a walk; it is a set of
observations about an unknown configuration.

### And the rule the B3-recheck broke

**A checklist expected value must be measured on the SURFACE the user will look
at, not on the store behind it.**

The B3-recheck was specced on the edge fixture, with expected values (5 rows;
34/4/14/6/14 leaves) measured by driving `deriveAggregate` over the edge store.
Those numbers are correct **about the store**. But `challengerGroups`
(ForecastVsActualsTab.tsx:3130-3133) gates twice on actuals -
`c.overallScore !== null`, then `if (!monthMap || !monthMap.size) return null` -
so **the challenger tab renders no row with zero months compared**, and no
actuals file exists for the edge fixture.

**The B3-recheck as issued was unrunnable.** Jon could not have produced those
five rows by any sequence of clicks. Measuring the store proved the derivation
was right and said nothing about whether the screen would render.

---

## SESSION F MERGED — `67eca3b`. The close-out branch.

**Merged to main 2026-08-06, `--no-ff`. Stage 1 PASS, stage 2 PASS, stage 3
SAFE.** Verified on main after the merge: typecheck 0, build clean, thirteen
suites 442, nullrender 35, challenger 18, unscored 19, traps 3/3, guard-traps
12/12, i18n clean, `.env` untracked.

### The NaN gap — CLOSED, at both levels

`scoreVals` now requires `Number.isFinite` alongside the null check. `NaN !==
null`, so a single NaN component survived the old filter and poisoned the mean,
and a NaN `overallScore` renders as a SCORE because every downstream test is
`!== null`.

**Stage 2 found the second half while checking the first.** The eight COMPONENT
scores reach `scoreLabel`/`scoreBg` unfiltered, and `NaN.toFixed(0)` is the
string `"NaN"` — handed to a coloured badge as though it were a measurement.
Both helpers now treat non-finite as absent, routing such a cell down the same
em-dash path as any other missing score.

**Guarding the average and leaving the cells would have been a half-closed hole,
which is worse than an open one because it reads as closed.** Traps 11 and 12
cover the two levels: 11 injects a NaN and weakens the aggregate filter; 12
injects a NaN and removes only the render guard, which trap 11 cannot catch
because the mean stays finite.

Both traps are deliberately TWO mutations. No natural input produces a NaN, so
weakening a filter alone would change nothing and the trap would report a false
green. The injection is the scenario; the weakened guard is the defect.

The entry recording this as "inspected-and-plausible, not proven by execution"
is closed. It is now proven by execution — 0 non-finite across every suite run,
and stage 3 measured 1,080 score fields independently with 0 non-finite.

### `chartData` — DELETED, after the divergence check

~395 lines nothing read. The check ran first because a dead copy can still tell
you something about the live one: 266 logic lines against `multiChartData`'s
355, 174 with exact twins, and every non-cosmetic difference running the same
way — **`multiChartData`'s fallback guard is STRICTER.** It requires
`baseForecast` and keys off `selectedCohortRow`, where the dead copy keyed off
that row's `monthMap` and would have drawn an aggregate for a selected row whose
`monthMap` was empty. Stage 2 confirmed that is a real behavioural difference,
not an equivalence, and in the safe direction. The live copy was never the one
that drifted.

### A diagnostic rule, recorded

Never print test output through a bare `JSON.stringify` where a NaN can occur.
`JSON.stringify(NaN)` is `"null"`, so a row of NaN scores prints as a tidy list
of nulls and reads as "absent, handled". It laundered a NaN twice in one
session, and the direction is what makes it dangerous: **it makes a corrupt
value look like a clean absence**, which is exactly the way round that stops you
looking further. Recorded in `qa-tester.md`.

### Reported, NOT deleted

`broadAggrSnapshotMap` now appears only in its declaration and three dependency
arrays. Its value has been read by nothing since Session C removed `aggrMap`
from `buildCohortAccuracy`; stage 2 verified this by reading all three consuming
memo bodies. `aggrSnapshotMap` is a different case — still read, one hop
removed, as `broadAggrSnapshotMap`'s fallback return.

Not deleted here: removing it means editing memo dependency arrays, which can
alter invalidation behaviour, and that is not a change to make at the end of a
long branch.

---

## SESSION E MERGED — `2531585`. The leaf-grain blocker was never what we said.

**Merged to main 2026-08-06, `--no-ff`. Stage 1 PASS, stage 2 PASS, stage 3
SAFE. One production change — an `export` keyword — and the rest is the
investigation it made possible.**

Verified on main after the merge: typecheck 0, build clean, thirteen suites 440,
nullrender 35, challenger 18, unscored 19, traps 3/3, guard-traps 10/10, i18n
clean, `.env` untracked.

### `buildCohortAccuracy` is exported

Pure move, no logic change. It was module-private, so the only way to ask what
it produces was to mount the whole tab and read the DOM — the right instrument
for a screen, the wrong one for arithmetic. **That single fact cost two
sessions**: a declared gap in `spec:challenger`, a wrong diagnosis carried
through three reports, and a stage-3 claim that the function was already
exported when it was not.

### The blocker was none of the three things blamed

`npm run spec:leafgrain` (15 cases) drives the function directly. Measured on
the edge fixture at full grain:

- **72 of 74 leaf-grain rows SCORE.** The 2 that do not are the deliberately
  unfitted leaves; they take the `~:767` early return correctly and are flagged
  `noForecast`. **The early return was doing its job the whole time.**
- **A plain 7-part store scores identically to one with 5-part keys added** —
  72/74 both ways, because derivation already resolves the grouped key. The
  "5-part store arrangement" the docket called for was unnecessary, not
  load-bearing. The control that proved it is kept in the spec.
- **Every scored row lands below 85** (min 47.8, max 83.6), so the challenger
  tab's `overallScore < 85` threshold would not have filtered them either.

**The real blocker was `spec:challenger`'s own 12-fit cap** — twelve fits
against actuals covering 74 cohorts. A property of the test, declared for two
sessions as a property of the product, and re-stated in three reports.

### Stage 2's route is REPRODUCIBLE — recorded, not retracted

With the cap removed, toggling Product L1 produces a fitted row that shows a
model name rather than a leaf mix; selecting it shows the error-ranked legend
and the chart, with no derived banner. **Stage 2 was right and my inability to
reproduce it was my harness.** That closes `spec:challenger`'s declared gap with
the assertions it was standing in for: the fitted case is now the complement of
the derived one, proving the suppression is scoped to `derivedMix` rather than
always-on. Stage 2 confirmed it is not decorative by forcing `derivedMix` truthy
and watching it go red.

### Two harness errors that looked exactly like product defects

Worth recording because both produced confident, wrong-looking output:

1. `fitLeaf` left `arpu` at 0 for every month, so the fitted ARPU bands were zero
   and all four ARPU components scored **NaN**, poisoning `overallScore` on 72 of
   74 rows.
2. Fixing that was not enough — `calculateBaseForecast` fits the four
   **per-scenario** ARPU series independently, and those were undefined too.

`JSON.stringify` prints `NaN` as `null`, which nearly hid it a third time.

### Open, pre-existing, and NOT introduced here

`scoreVals` filters on `v !== null`, so a `NaN` would pass through and render as
a score. Every division in the scoring path guards its denominator on
inspection, and no `NaN` appeared in any suite run — but that is
**inspected-and-plausible, not proven by execution**, which is how both stage 2
and stage 3 classified it. Untouched by this branch. Recorded so the next person
does not have to rediscover the distinction.

### Session C tasks 2 and 3 — CLOSED

The entry recording them as not done, and the correction recording that a prior
stage-3 report wrongly claimed the function was exported, are both now moot.

---

## THE SHARE-SCALED FABRICATION FAMILY IS CLOSED — `52843af`

**Session D merged to main 2026-08-06, `--no-ff`. Stage 1 PASS, stage 2 PASS,
stage 3 SAFE. No walk: the user-visible change on this branch is zero rows.**

**Every REACHABLE fabrication is gone — three fallbacks in the table, the
borrowed seed, and the candidate scan; the chart-side three lived in dead code
no user ever saw, deleted regardless.**

That wording is the truth and it is stronger than the version first drafted.
"Three in the chart" would have implied six live defects removed; there were
four, and the other three were unreachable. The honest count is the one that
survives someone checking it.

### What the family was

A single pattern with five faces: **produce a number where the honest answer is
nothing.**

| what | where | reachable? |
|---|---|---|
| `scaledBandFlow` | accuracy table, flow KPIs | yes |
| `computeAvgShare` + `derivedBaseBands` | accuracy table, Base KPI | yes |
| the instance-2 seed | `runChallengerForecast` | yes |
| the tier-2 candidate scan | `buildCohortAccuracy` | yes |
| `cohortShareMap` / `baseShareForChart` / `arpuScaleRatio` | `chartData` memo | **no — dead code** |

Each answered "this cohort has no forecast" with someone else's: a neighbour's
bands scaled by a share, a different cohort's standing base, or a fit made at a
different scope. A row with no forecast now renders unscored, and a chart with
no forecast draws no line.

### Its permanent defence

- **`npm run spec:triggers`** — pins the population that reaches the deleted
  paths, measured on three fixtures at four groupings. 4 tier-1 misses, 0
  candidate-scan hits. If a fixture change ever makes the scan fire again, this
  is what says so.
- **`npm run spec:unscored`** — asserts the surface: an unscored row shows the
  gap in BOTH panels with its actuals still drawn, plus Case B's two halves.
  Every absence assertion is paired with a positive control using the same
  selector and the same geometry test.
- **Traps 9 and 10** — replant the table/chart disagreement and the removed
  scope guard; both confirmed killing.
- **The no-hand-rolled-summation guard** in the derive spec, which stops the
  aggregate arithmetic being re-implemented anywhere.

### What is NOT claimed

The chart-side deletion **removed a mechanism that was never reachable.** That
is dead-code cleanup, not a behavioural fix, and stage 3 was explicit about the
distinction. The accuracy-denominator entry's chart path is **moot rather than
resolved** for the same reason.

`chartData` itself — roughly 460 dead lines — is still there. Deleting it is
queued behind tasks 2 and 3, opening with a divergence check against
`multiChartData`'s live logic, because which copy drifted from which may matter
to the live one.

---

## chartData IS DEAD CODE — and that retracts a finding I recorded as fact

**2026-08-06, proven by experiment. This corrects entries in this file and two
session reports.**

`ForecastVsActualsTab.tsx`'s `chartData` memo is **declared and never read.** The
only other occurrences of the name are comments and a DIFFERENT `chartData` - a
property on the challenger group type. Proven rather than grepped: renaming the
memo to `__unusedChartData` leaves typecheck at 0, the build clean,
`spec:unscored` 8/8 and `npm run traps` 3/3.

It is dead on **main** too, at the same three occurrences — so it was dead before
Session D touched it, not made dead by it.

### What this retracts

**Stage 3 of the Session C gate reported that selecting a trigger-population row
showed "a fabricated share-scaled line in the chart" while the accuracy table
said unscored.** I recorded that as a finding, wrote it into this file as a named
transient state, and reasoned from it across two sessions. **It cannot have been
visible.** The visible comparison chart is driven by `multiChartData` (its Lines
read `${prefix}_baseline` / `${prefix}_actual`), and the dependency map already
established that `multiChartData` never had share-scaling — its fallback is
guarded by `!selectedCohortRow`.

So:

- The "table honest, chart fabricating" transient state **did not exist on
  screen**. The entry describing it, and the strike that closed it, both rest on
  a false premise.
- The "2-row screen change" carried through the Session C merge decision and this
  branch's reasoning was, on the chart side, **no screen change at all**.
- Session D's deletion of the three closures and Case A remains correct — dead
  code that fabricated is still worth removing — but **not for the reason
  given**, and its blast radius on screen was zero, not two rows.

### How it survived

Three consecutive reviews described this code as live: a dependency-mapper pass
that traced its consumers within the memo, a stage-3 gate that inferred a user
impact from reading the branch, and my own reports repeating both. None of them
asked the prior question — *is the memo read at all* — because each was handed
the assumption by the one before.

**A consumer map that starts inside the thing being mapped cannot discover that
the thing has no consumers.** The check that would have caught it is the cheapest
one available: rename the symbol and see whether anything notices.

### Not yet decided

Whether `chartData` should now be deleted outright is a live question, not a
tidy-up: it is a ~460-line memo carrying logic duplicated in `multiChartData`,
and deleting it is a larger change than anything in this branch. Reported, not
taken.

**The family-closed declaration is withheld** and its wording needs revisiting:
"three in the chart" describes fallbacks that were unreachable, which is a
different claim from the table's three.

---

## SESSION C MERGED — `6726d4c`

**Merged to main 2026-08-06, `--no-ff`, no walk.** The screen change is measured,
pinned and narrower than eyes would add: 2 rows on one fixture.

Certified `a5d69ec`; the merged tip was `7bb47c8`, adding only these records and
the session report — no code. Stated for the same reason as last time:
"certified X, merged Y" is the shape of the verification-before-the-last-edit
mistake even when the delta is documentation, and the post-merge run is what
covers it.

Verified ON MAIN after the merge: typecheck 0, build clean, eleven suites 411,
nullrender 35, challenger 12, traps 3/3, guard-traps 8/8, i18n clean, `.env`
untracked.

### THE TRANSIENT STATE — STRUCK 2026-08-06, the chart side landed

**This entry instructed that it be struck when the chart branch landed. It has.**

The accuracy table and the chart now resolve identically — one tier,
`resolveForecast` — so they cannot disagree about whether a cohort has a
forecast. A selected row with no forecast shows the gap in both panels, with its
actuals still drawn.

The original text follows, unedited, because it is the record of a state that was
merged knowingly rather than discovered.

#### Original entry

**The accuracy table is honest and the chart still fabricates, for the same 2
edge-fixture rows.** Selecting one shows UNSCORED in the accuracy table and a
share-scaled line in the chart, at the same moment, for the same cohort.

This was merged knowingly. Before Session C both panels fabricated — wrong but
consistent; now they disagree in kind, and the honest half is the one that looks
broken. It is 2 rows on one fixture and 0 on the others.

It is named here so that whoever meets it next finds it described rather than
discovers it: this is a known intermediate state between two deletions, not a
regression and not a disagreement about what is true. The chart path is the next
branch, and this entry should be struck when it lands.

**The accuracy-denominator entry stays OPEN for the chart path**, exactly as
stage 3 judged it: resolved for the table path Session C touched, not for the
chart path it did not. Marking it closed would be the
shrunk-blast-radius-reported-as-fixed error.

---

## CORRECTION: the pinned 0/0/2 is the CHART's trigger set, not the table's

**2026-08-06, at the lead of the entry it corrects.**

The Session C entry below describes 0/0/2 as the accuracy table's trigger set.
It is not. It is `resolveForecast` returning null — **tier one only**, which is
the CHART's predicate. The accuracy table resolved in TWO tiers until Session D:
`resolveForecast`, and if that missed, a candidate scan over `forecastStore`. Its
trigger was both tiers missing, so its set was a SUBSET of the pinned one.

**Session C's shipped scope stands.** `npm run spec:triggers` measures both sets
across three fixtures and four groupings: the tier-2 scan fired on **zero** of
the tier-1 misses, so the two sets coincide in fact. The description was wrong,
not the number, and the deletion was correctly scoped.

The distinction is worth keeping even though it changed nothing here: two
predicates that agree on the current fixtures are not one predicate, and a figure
labelled with the wrong one invites exactly the assumption that nearly carried it
into the next deletion.

---

## SESSION C — the deletions, and a THIRD fallback they exposed

**2026-08-06, branch `session-c-deletions`, certified `a5d69ec`. Gate: stage 1
PASS, stage 2 FAIL then fixed, stage 3 SAFE.**

Four fallbacks deleted, all one family — a number produced where the honest
answer was nothing.

### The trigger set, measured BEFORE deleting

Cohorts with actuals but no resolvable forecast: the exact population whose rows
change from a fabricated number to a blank.

| configuration | orphans |
|---|---|
| trimmed fixture, same file | **0** of 74 |
| full Dec2025 forecast + Jun2026 actuals | **0** of 540 |
| edge fixture, same file | **2** of 74 |

The two are the edge fixture's deliberate short-history leaves — the pair the
amber skip panel already names. All three counts are pinned in
`npm run spec:deletions`, so a fixture edit that grows the set is noticed.

### What was deleted

1. **`scaledBandFlow`** — scored a cohort's flows against the LOADED cohort's
   bands scaled by an average share.
2. **`computeAvgShare`** and **`derivedBaseBands`**. The third was not on the
   list and could not be left: `computeAvgShare` had TWO consumers, and
   `derivedBaseBands` is the same mechanism applied to the Base KPI. Deleting
   one forced the other, extending the change to Base on the same trigger set.
3. **The instance-2 seed.** It read the cohort's own stored seed, then the
   LOADED cohort's, then `0`. It now declines. The trailing `?? 0` was not a
   neutral default either — it seeds a real cohort at zero standing base and
   calls the result a forecast.
4. **The always-true `!g.derivedMix` guard** in the Accept-All modal. A dead
   guard is worse than none: it asserts a derived row can reach that modal when
   the list's own filter guarantees it cannot. One authority, not two.

### A VACUOUS CHECK, caught by the gate and worth the lesson

Stage 2 replanted the dead guard and `spec:deletions` stayed green. The check
anchored with `indexOf('acceptAllCandidates.map')`, which matches an unrelated
`.map` about 77,000 characters earlier, then tested only the first 1,500
characters after it. It never looked at the modal.

**A slice offset is not a location, and a fixed window is a guess about
distance.** Now anchored with `lastIndexOf`, no truncation, plus an assertion
that the slice really is the modal block. Verified the way the original should
have been — plant the defect, watch it go red, restore.

The same shape appeared twice more in one gate: stage 2 confirmed the 540-orphan
figure by hand and flagged it as unguarded, and it is now pinned. **A number
confirmed once and left where nothing re-checks it is the same defect as a check
that looks in the wrong place.**

---

## A THIRD share-scaled fallback survives, in `chartData` — OPEN

**Found by stage 3, 2026-08-06. Pre-existing and NOT introduced by Session C —
but Session C changed what it looks like on screen.**

`ForecastVsActualsTab.tsx`'s `chartData` memo carries its own share-scaling
fallback — `cohortShareMap` / `baseShareForChart` / `arpuScaleRatio` — the same
borrow-the-loaded-cohort-and-scale pattern deleted from the accuracy table. It
fires when `specificFcMonthMap` is null and a row is selected, and the row click
handler has no `noForecast` guard, so a row with no forecast is selectable.

**The consequence, and it IS a visible change.** Before Session C, a
trigger-population row fabricated in BOTH panels — wrong, but consistent. Now the
accuracy table says UNSCORED while the chart still draws a fabricated
share-scaled line for the same selection. **The two panels disagree in kind, not
just in value.**

On the fixtures in use that is 2 rows on the edge fixture and 0 elsewhere, so it
is narrow — but it is the first place this codebase shows an honest blank and a
fabricated number for the same cohort at the same moment, and the honest half is
the one that looks broken.

The comment at `chartData` claiming "the chart and the accuracy tooltip cannot
disagree" is now false. `buildCohortAccuracy`'s `aggrMap` parameter is also dead
weight post-deletion.

**Wanted:** the same treatment — a dependency-mapper pass over `chartData`'s
three fallback closures, then measure, then delete. Not attempted here; it is a
second deletion of equal size and was not on the docket.

### Status of the accuracy-denominator entry

Stage 3's judgement, recorded as it made it: **resolved for the table path this
branch touched, NOT resolved for the chart path it did not.** The specific
mechanism the entry describes is gone from `buildCohortAccuracy`; a structurally
identical one still lives in `chartData`. Marking the entry closed would be the
shrunk-blast-radius-reported-as-fixed error.

---

## SESSION C — tasks 2 and 3 NOT DONE, carried forward

**Stated plainly rather than quietly rolled over.**

Task 2 was the scored-leaf-grain DOM spec via a 5-part store arrangement,
closing `spec:challenger`'s declared gap; task 3 was the one-shot re-test of
stage 2's irreproducible fitted-row route, which depends on task 2. Neither was
completed. What was established before stopping:

- **`buildCohortAccuracy` is module-private** (`ForecastVsActualsTab.tsx:584`,
  plain `function`, no `export`). It cannot be driven headlessly, so the clean
  route to a scored leaf-grain row is to export it or to drive the tab.
- A previous stage-3 report claimed it was "module-level and imported directly
  by the spec". **That was wrong**, and it is worth recording as a correction:
  the claim was plausible, unchallenged, and shaped two sessions' assumptions
  about what could be tested.
- The blocking path is the unscored early return at `~:767-779`, reached when a
  cohort has no resolvable forecast at the grouping in question. Adding
  product-grain fits to the store made the KEY resolve and still produced no
  scored row, so the gap is in the accuracy rows, not the store.

Carried to the next session with the deletions' follow-up above.

---

## SESSION B MERGED — `eb036c6`

**Merged to main 2026-08-05, `--no-ff`, after Jon's walk PASSED at `00a4116`.**

The branch tip merged was `35a2984`, one commit past the certified tree; it
carries only an EXPECTED.md heading correction and the session report — no code,
no scripts, no locales. Stated rather than glossed, because "certified X, merged
Y" is the shape of the verification-before-the-last-edit mistake even when the
delta is documentation. Full verification re-run ON MAIN after the merge:
typecheck 0, build clean, ten suites 392, nullrender 35, challenger 12, traps
3/3, guard-traps 8/8, i18n parity clean.

### What Jon's final walk established

**Part 1 — both looks passed.** The reason panel states the cause with no Step 1
redirect; the filter bar's corner link does the same. The two-meanings-of-null
split holds on the screen, not only in the spec.

**The mix renders on all five rows**, and it is internally consistent: every
histogram sums to its own row's 108, and the five rows sum to 540 — the whole
fitted store. The count is not decorative; it reconciles.

**Cross-grouping consistency — the check that proves the mix is real.** The
segment-grouped Holt Linear counts (71 + 75 + 78 + 78 + 72) total **374**, which
equals the leaf-grain Holt Linear bucket exactly. The same population counted
two different ways through two different code paths agrees. That is a much
stronger statement than any single screen being plausible.

**The Aggregates bucket: 5 of 5 at segment grouping**, and exclusivity proven at
deep grouping — the bucket contains every derived row and only derived rows.

**The deep-grouping screens are CORRECT BY DESIGN, not a defect.** They show
fitted rows with model recommendations rather than mixes, and that is right:
540 groups from 540 leaves proves there is exactly one tariff per 5-part
combination on this fixture, so every deep-grouped key is a single-leaf
passthrough — a fitted forecast, per the settled rule that a one-leaf
"aggregate" returns the stored object by reference rather than deriving.

### FIXTURE DEGENERACY — what this fixture cannot show

One tariff per 5-part combination means **multi-leaf derived rows below segment
level are undemonstrable on this file**. Every sub-segment grouping collapses to
single-leaf passthroughs. Derived behaviour is only observable at segment grain
and above here.

Two consequences:

1. Any future check wanting a multi-leaf derived row *below* segment level needs
   a fixture with genuine tariff variation within a 5-part combo. It does not
   exist yet.
2. **It further undermines the old `ProductL2_Full` identification.** Tariff adds
   no grain on the TariffHierarchy fixture, so cohort counts are identical with
   tariff mapped or unmapped — which is why 540 could never discriminate between
   the two files. The identification rested on "(not mapped)", already retracted
   below; this removes the last indirect support for it.

### Queued

- **Tariff wiring into the challenger tab** — `ForecastVsActualsTab.tsx:4181`
  passes neither tariff column to `CohortDimCheckboxes`, and the fallback
  `cohort` literal at `:3229` omits both tariff fields. This is a
  **prerequisite** for the backlogged leaf-grain challenger redesign: that
  redesign cannot group at leaf grain on a tariff-bearing file while the tab
  cannot see tariff at all.
- **Relabel "(not mapped)" → "(not available in this view)"** on the challenger
  tab, into the Phase 3 copy batch. The current label states a property of the
  FILE when it is a property of the VIEW, which is what made it a false fixture
  diagnostic. Relabelling is the cheap half; the wiring above is the real fix,
  and the relabel should not be taken as closing it.

---

## RETRACTED: "(not mapped)" is not a fixture tell

**Correction at the lead, 2026-08-05. The entry below used the "(not mapped)"
label as a positive identification of `ProductL2_Full`. That was wrong.**

**"(not mapped)" beside Tariff on the AutoML Challenger tab is PERMANENT, on
every file.** `ForecastVsActualsTab.tsx:4181` renders `CohortDimCheckboxes`
without passing `wiTariffL1Col` or `wiTariffL2Col` at all — the accuracy tab's
call at `:3908` does pass them. With the props `undefined`, the component takes
its disabled branch and prints the label regardless of what was loaded. Tariff
was never wired into the challenger's grouping: the fallback `cohort` literal at
`:3229` omits `tariffL1`/`tariffL2` too. Observed in a live DOM render, not only
in source: `spec:challenger` dumps `"Tariff L1(not mapped)"` from a
TariffHierarchy-backed mount.

**Consequence: the `ProductL2_Full` identification of the Part B session is
UNESTABLISHED**, not merely less well supported. The label was the only evidence
for it. Which file that session ran on is now unknown.

### The lesson, by name

**A recorded unresolved tension pointing against a diagnostic is evidence
against it, not a footnote.**

The ARPU measurement pointed the other way at the time: 16.5 observed sits near
TariffHierarchy's 16.28 and nowhere near ProductL2_Full's 14.84. That was
written down, in this file, as "unresolved and flagged rather than resolved" —
and then the diagnostic was relied on anyway, and two gate stages read past it.

Filing a contradiction as an open question does not neutralise it. If a
measurement disagrees with a conclusion, the conclusion is provisional until one
of them is explained, and anything built on it inherits that status.

### Reliable on-screen fixture tells

| pair | reliable tell |
|---|---|
| Edge (12,112) vs Trimmed (12,432) | **row count** — distinct |
| Dec2025 (77,760) vs Jun2026 (90,720) | **row count** — distinct |
| `ProductL2_Full` vs `TariffHierarchy`, same date range | **row count is identical** (77,760 / 90,720), as are months (36/42) and cohorts (540). Use the **mapping step's Tariff L1/L2 selectors**, or the **Historical Accuracy tab's** dimension checkboxes (`:3908`), which do receive the tariff columns and therefore show Tariff enabled for `TariffHierarchy` and "(not mapped)" for `ProductL2_Full`. **Never the challenger tab's.** |

Secondary independent tell for that pair: `Avg_Unit_Price_GBP` is **0.00
throughout `ProductL2_Full`** (measured across every row), so any ARPU surface
there falls back to revenue ÷ volume.

---

## Same fixture name, different file: 540 cohorts is not a fingerprint

**Q1, measured 2026-08-05. Classification: USER PATH, not introduced by the
branch.**

The same nominal "full fixture" had tariff mapped in Jon's previous walk (he
filtered Tariff RED S in B4) and unmapped in this one. Measured across every
fixture in `test-data/`:

| fixture | rows | months | cohorts | tariff columns |
|---|---|---|---|---|
| `ProductL2_Full_Jan2023_Jun2026` | 90,720 | 42 | 540 | **ABSENT** |
| `TariffHierarchy_Jan2023_Jun2026` | 90,720 | 42 | 540 | present |
| `ProductL2_Full_Jan2023_Dec2025` | 77,760 | 36 | 540 | **ABSENT** |
| `TariffHierarchy_Jan2023_Dec2025` | 77,760 | 36 | 540 | present |
| `EdgeCases_ShortHistory_Jan2023_Jun2026` | 12,112 | 42 | 74 | present |
| `Trimmed_TariffHierarchy_Jan2023_Jun2026` | 12,432 | 42 | 74 | present |

**The two 90,720-row fixtures are indistinguishable on every count a walk
checks** - same rows, same months, same 540 cohorts - and differ only in
whether the tariff columns exist. Nothing on screen after load separates them
except the very mapping state that looked like the bug.

So "(not mapped)" was **correct behaviour reporting a real property of the
file**, not a defect. `ProductL2_Full` has no tariff columns; the app said so.

**Why it cannot be the branch.** The only writers of `wiTariffL1Col` /
`wiTariffL2Col` are the auto-map effect (App.tsx:1389-1390) - there is no
manual control for them anywhere. The branch's `src/App.tsx` diff is a pure
relocation (133 insertions, 132 deletions, moving memos above their consumers),
touches no mapping state, and `CohortDimCheckboxes.tsx` - which renders
"(not mapped)" - is not in the diff at all.

**Noted in passing, not the cause here.** Column detection reads ROW ZERO only:
`const cols = Object.keys(jsonData[0])` (App.tsx:1794), and `sheet_to_json`
omits keys for blank cells, so a dimension blank in the first data row is
unmapped for the whole session. Measured: all six fixtures hide
`Applied_Flow_Rate_%` from row 0 this way. Tariff is blank in **0** rows of
every fixture, so this did not cause Jon's session - but the mechanism is real
and a file with a blank first row would trip it silently.

---

## An unmapped dimension multiplies every derived aggregate

**Q2, measured 2026-08-05 on the edge fixture. This is a real defect.**

When a dimension is unmapped, `buildCohortDataMap` writes `'All'` into those
key slots - the same `'All'` the seam reads as "aggregated over". Every leaf key
then carries `All` in the unmapped slots (measured: 72 of 72).

**That alone is harmless.** `resolveForecast` is store-first (App.tsx:1551) and
never infers aggregate-ness from the key, and `provenance` is carried on the
`BaseForecast` object rather than derived from key shape. Measured on a
tariff-unmapped store:

```
resolve("SOHO|Mobile Voice|Low Value|Direct|Field / Regional Sales|All|All")
   -> STORE HIT, provenance.kind=fitted, model=Holt Linear
resolve("SOHO|All|All|All|All|All|All")
   -> DERIVED,  provenance.kind=derived
```

Identical tariff slots; correctly distinguished. **A fitted leaf under an
All-bearing key is NOT distinguishable by key shape, and IS distinguishable by
provenance** - which is exactly why provenance is on the object.

**What is wrong is `populatedCohorts.leafMap` (App.tsx:1512-1521).** The
roll-up walk enumerates three variants per dimension -
`[['All','All'], [t1,'All'], [t1,t2]]`. When the dimension is unmapped all
three collapse to the same key, and `mine.push(dk)` runs three times for one
leaf. `resolveForecast` then hands `deriveAggregate` the same leaf repeatedly.

Measured, edge fixture, `SOHO|All|All|All|All|All|All`:

| configuration | roll-ups with duplicate leaves | leafMap entries | month[0] inflow.mean | leafCount |
|---|---|---|---|---|
| all mapped | 0 of 1934 | 14 (14 distinct) | 4,970.08 | 14 |
| tariff L1+L2 unmapped | **421 of 421** | 42 (14 distinct) | **14,910.24** | **42** |
| tariff L2 only unmapped | 667 | - | 4,970.08 | 14 |
| Product L2 unmapped | 634 | - | - | - |

**Exactly 3x overstated**, and `provenance.leafCount` reports 42 leaves where
there are 14 - so the challenger tab's mix label lies too. The general rule: an
unmapped LEVEL collapses its roll-up variants and doubles the leaves of every
roll-up at or below it; when BOTH levels of a dimension are unmapped all three
variants collapse, the factor is 3, and it reaches the top-level aggregates.

This is consistent with the six-figure Base Jon saw at Large Enterprise -
Fixed Connectivity.

### Classification: the code is pre-existing, the REACHABILITY is this branch's

`leafMap` arrived in `9ac25f6` "Session B1: the seam, built but not yet wired",
already merged to main. But B1 meant *not yet wired* literally: in main,
`resolveForecast` is defined at App.tsx:3362 and **referenced nowhere else** -
0 call sites in App, 0 in ForecastVsActualsTab. `leafMap` is built and never
read, so the duplication is unreachable.

On this branch there are 4 call sites in App and 11 references in the tab.

So this does **not** qualify as "pre-existing and the diff neither fixes nor
worsens it". The defective lines are older; the diff is what makes them live.
Under the classification rule that makes it **introduced by this branch in
effect** - a widening blast radius, the mirror image of the shrinking-radius
case the rule already warns about.

**Not fixed** - the user reserved that decision. Two things to note for whoever
takes it: deduplicating `leafMap` is a one-line change (`[...new Set(v)]` at
the read, or a `Set` at the write), and it is invisible on any fully-mapped
fixture, which is why every gate to date passed.

### Retroactive grade of Jon's B3 observations

On a tariff-unmapped full fixture at full grouping, measured over the unmapped
edge store: **fitted=72, derived=0, null=0**. Every challenger key is a real
fitted leaf, so every row has an incumbent model and a recommendation, and the
`Aggregates (no model)` bucket is empty.

**Jon's observations - 540 fitted rows, recommendations present, empty
Aggregates bucket - are the CORRECT rendering for that configuration. PASS.**
They are not evidence about the B3 fix, which is about derived rows, and a
tariff-unmapped run produces none at that grouping.

---

## Step 1's ARPU chart draws two different quantities

**Q3, measured 2026-08-05. Display-coherence finding on the fit-on-aggregate
path. Recorded for Phase 3, which removes that path. Not fixed.**

Jon saw historical ARPU ~16.5 against a flat forecast ~11.5 at Corporate -
Fixed Connectivity. The two series are built by different rules:

**Historical** (`StandardForecastTab.tsx:348-380`) is
`Sum(Monthly_Revenue_GBP) / Sum(Subscriber_Volume)` over rows matching
**segment, product and channel only** - no Product L2, no Channel L2, no
tariff, and **no filter on the scenario/metric column at all**, so Base,
Inflow, Outflow and Retention rows are summed together. Measured for
Corporate - Fixed Connectivity: **16.28** on `TariffHierarchy`, **14.84** on
`ProductL2_Full`. The scenario blend is NOT the cause of the gap - all four
scenarios sit within 0.2 of each other.

**Forecast** (`m.arpu.mean`) is the fitted *blended* ARPU
(`forecasting.ts:990-1016`), and carries a boundary correction that pins
forecast month 0 to the last value **of the series it was fitted from**.

So the chart anchors its two lines to two different constructions, and the
boundary correction - which exists to guarantee continuity - guarantees it
against the series that is not drawn. A step at the boundary is the expected
symptom whenever the constructions differ, not an anomaly.

**Unresolved, and flagged rather than resolved:** Jon's ~16.5 is close to
`TariffHierarchy`'s 16.28 and not to `ProductL2_Full`'s 14.84, which sits in
tension with the tariff-unmapped observation pointing at `ProductL2_Full`.
Also measured: `Avg_Unit_Price_GBP` is **0.00 throughout `ProductL2_Full`**, so
on that fixture ARPU can only come from revenue/volume. I did not isolate which
quantity 11.5 is - that needs the manual generation path driven headlessly, and
I did not do it.

## The mix now renders, the illustration panel does not, and the bar stops misdirecting

**2026-08-05, after the reviewer's Part B walk. Three fixes, one cause between
the first two: a design was approved and only half of it reached a surface.**

### 1. The provenance mix reaches the row

The approved B3 design put the leaf count and model histogram on the derived
row. The row rendered a fixed string (`actuals_aggregate_of_leaves`), and the
mix reached no surface at all: `incumbentLabel`'s three call sites are the
preview banner and legend (both inside `if (preview)`, unreachable without
running a challenger, which a derived row cannot do) and the Accept-All modal
(which filters `!g.derivedMix`).

**The shortfall was the implementation, not the walk.** The walk's expected
value — "each showing 108 leaves" — was the approved design; it was measured
from the store because no surface carried it, which is the surface-not-store
rule broken from inside the check written to enforce it.

The row now renders `incumbentLabel(g)`. The word "leaves" is keyed
(`actuals_leaves`) — it was English inside a template literal, which the JSX
scanner cannot see.

### 2. The illustration panel is suppressed entirely for a derived selection

Beneath a banner stating that no comparison exists, the panel drew three model
trajectories with error percentages. `models` is `.sort((a, b) => a.error -
b.error)` — an error-ranked comparison, on a cohort with no incumbent to rank
against.

**Suppressed, not de-ranked.** Two of the three curves are arithmetic
perturbations of the loaded forecast (`dampedTrend = forecast * 0.9`;
`holtWinters = act.inflow + (forecast − act.inflow) * 0.2 + sin(i) * act.inflow
* 0.05`), so the percentages are real MAPEs of fabricated series and the ranking
is an artefact of the perturbation constants — it would order the same way on
any cohort. There is nothing honest to keep. The banner stays.

**STANDING FINDING, pre-existing, out of scope here: the same synthetic
trajectories are what a FITTED leaf row is ranked on.** Suppressing the panel on
aggregates does not make it truthful on leaves. Inherited by the backlogged
leaf-grain challenger redesign with the constraint: **real fits or nothing.**

### 3. The filter bar's corner link, selection-null only

`ViewFilterBar` offered "Generate in Step 1" whenever `hasForecast` was false —
including a selection that resolves to nothing in a session full of forecasts,
where Step 1 is the manual fit-on-aggregate path and cannot give a cohort more
months of history. It now shows the cause (same `SKIP_REASON_KEY` enum as the
Step 2 panel) plus a widen-the-filter hint. The never-generated case keeps the
link unchanged. This was the last consumer of the two-meanings-of-null split.

App gates the reason on `forecastStore.size > 0 || hasLegacyBaseline` before
passing it, because `resolveForecast` reports `insufficient-history` for a key
whose leaves all failed to fit — indistinguishable from "nothing generated yet"
unless the store is consulted first.

### The specs now assert the rendered DOM

`npm run spec:challenger` mounts the real `ForecastVsActualsTab`, clicks to the
challenger tab, and reads rendered text: the leaf count and histogram appear,
the derived selection shows the banner and no `% err` legend and no chart
surface. It carries a positive control — the harness must be shown to paint a
Recharts surface somewhere — because every one of those is an assertion of
ABSENCE, and Recharts paints nothing at jsdom's width of −1, which would have
made them all pass vacuously.

The B3 block in `derived-interaction-spec` kept a tripwire and lost its claim to
cover the display, with the reason written in: it asserted provenance and source
text, stayed green throughout, and the mix rendered nowhere.

**DECLARED, NOT ASSERTED:** the fitted-leaf-unchanged case is not driven at the
DOM layer. Toggling to leaf grain did not produce a fitted row in the harness
and the cause was not chased down. The suppression is gated on
`selectedChallengerGroup.derivedMix`, so a fitted row structurally cannot take
the suppressed branch — but that is a source argument, and source arguments are
exactly what let the mix ship rendering nowhere.

## Null had two meanings and the screen only spoke one

**2026-08-05, after the A5 crash fix. Found by the reviewer's re-walk: the
crash was gone, and the message that replaced it was false.**

Selecting the null cohort rendered **"No Baseline Forecast Yet / Go to Step 1"**
in a session holding a bulk run of **7,588 forecasts**. Two things wrong with
that, and the second is worse:

1. It is untrue. Forecasts existed.
2. It directs the user to Step 1 — the manual, fit-on-aggregate path that
   Phase 3 exists to remove. The message did not merely fail to help; it
   pointed at the thing being deleted.

The filter bar said **"No forecast for this selection"** at the same moment, so
the null WAS detected. An older outer gate simply captured it first.

### Root cause is semantic, not a missing guard

Before the seam, a null `baseForecast` had exactly one meaning: nothing had been
generated yet. That gate's message was therefore always true, and the Step 1
redirect was always the right action.

The seam gave null a **second** meaning — a generation exists, but THIS
selection resolves to nothing — and the screen went on speaking the first.

**This is the third defect on this branch whose cause is a widened meaning
rather than a broken line.** `'All'` came to mean both "aggregated over" and
"dimension unmapped"; a null resolution came to mean both "never generated" and
"not for this selection". A value that gains a second meaning silently breaks
every reader that was written when it had one — and those readers do not fail
loudly, they keep answering the old question.

### The fix: distinguish the two where the empty state is chosen

`WhatIfTab` now asks `forecastStore.size === 0 && !hasBaseline`:

- **Nothing generated at all** — the original "No Baseline Forecast Yet" state,
  Go to Step 1 retained. Still correct, still reachable.
- **A generation exists, this selection does not** — the reason state: cause,
  not history, rendered through the shared `SkipReason` enum and its existing
  i18n keys, and **with no Step 1 redirect**, because Step 1 cannot give a
  cohort more months of history.

`SKIP_REASON_KEY` moved from a module-local const in `BulkGenerateModal.tsx` to
`src/types/forecast.ts` and is now imported by both consumers. Its own docstring
says it is "the ONLY place they become words"; a second copy would have been the
two-vocabularies-for-one-concept pattern this file already records three
instances of.

The reason is recomputed at render by App, on the line above `<WhatIfTab>`, from
the same `resolveForecast(filterToKey(step2Filter))` call that drives the filter
bar's `hasForecast`. The two cannot disagree, and nothing is remembered — a
remembered reason would be the stale-forecast mistake in a new place.

### Specced at the surface, transitions included

`spec:nullrender` is now 30 cases. The new ones cover: empty store and no legacy
-> never-generated state with Step 1 retained; populated store -> reason state
with no Step 1; both reason codes reaching the screen; a legacy-only session
counting as generated; and the forecast -> null TRANSITION landing on the reason
state specifically.

**The transition assertion previously accepted "an empty state".** That is
exactly why the wrong message shipped past a green spec. It now names which
state it expects. An assertion loose enough to pass on either branch cannot
distinguish them, which is the whole job.

Trap 8 collapses the two branches back into one and is confirmed killing the
spec.

### RESOLVED 2026-08-05 — the filter bar no longer offers that redirect

**This entry described the defect while it was open. It is fixed: see "The
mix now renders, the illustration panel does not, and the bar stops
misdirecting" above, item 3. Left in place because the reasoning below is what
the fix was built from — but the heading said "still open" for a while after
it was not, which a gate caught and is worth noticing: a record corrected
above without its original heading being touched reads as two live entries
disagreeing.**

#### The original entry follows, unedited

`ViewFilterBar.tsx:118-121` renders a **"Generate in Step 1"** button
unconditionally whenever `hasForecast` is false — including the
selection-resolves-null case. It is the same misdirection as the one just
removed, in the sibling component, on the same screen at the same moment.

Not changed here: the fix was scoped to the empty state. Flagged because the
panel no longer sends the user to Step 1 while the bar three inches above it
still does, and a half-applied correction reads as an inconsistency rather than
as a decision.

## A5 blanked the app — FOUND AND FIXED (hook order on the transition)

**Resolved 2026-08-05 by Jon's console stack: "Rendered fewer hooks than
expected. This may be caused by an accidental early return statement" in
`<WhatIfTab>`. The investigation below it was aimed at the wrong thing and is
kept because the reasoning it corrected is the lesson.**

### The mechanism

`WhatIfTab` had three `useMemo` calls — `segmentOptions`, `productL1Options`,
`channelL1Options` — sitting BELOW the `if (!baseForecast) return <empty/>`
guard.

- With a forecast loaded the guard is false, so all three run.
- The moment the resolution goes null the guard fires and returns before them.
- React compares hook counts between renders, sees fewer than last time, and
  throws. The tree unmounts: a blank white page.

**It never fired on a fresh mount.** A first render with null skips those hooks
consistently, so hook order is stable and nothing is wrong. It fired only on
the TRANSITION forecast -> null — which is exactly Jon's click path: load a
cohort, then switch to Large Enterprise - Fixed Connectivity.

### Why the first spec passed while the app crashed

`spec:nullrender` mounted the screen WITH null and asserted the empty state.
That is a different question from transitioning TO null, and it is the question
that cannot fail.

**A mount-with-X spec does not cover transition-to-X.** In React, transitions
are where hook-order violations live, because the violation is defined
relative to the PREVIOUS render — a mount has no previous render to differ
from. Every state a screen can REACH mid-session needs its transition driven,
not just its mount.

This sits directly beside the surface-not-store rule and is the same error one
level in: proving the producer says nothing about the consumer, and proving the
consumer's steady state says nothing about its transitions.

### The fix is structural, not a guard

The three memos moved ABOVE the guard. They depend only on props (`data`,
`wiSegmentCol`, `wiProductCol`, `wiChannelCol`) and never on `baseForecast`, so
they run unconditionally at no cost. **No hook may live below a conditional
return.** Adding a null check inside each memo would have been the guard-shaped
non-fix: the hooks would still be skipped by the early return.

`spec:nullrender` now drives the transition in BOTH directions — forecast ->
null must show the empty state without throwing, and null -> forecast must
restore the working screen. Trap 7 in `npm run guard-traps` replants a hook
below the guard and is confirmed killing it.

**Trap 7 was wrong first.** Its initial version inserted the hook ABOVE the
guard — the safe position — and reported MISSED. A trap that plants the wrong
shape indicts the spec for the trap's own error. The miss was investigated
rather than accepted, which is the only reason it is a real trap now.

### Classification: introduced-in-effect. SECOND instance of that rule.

The three hooks sit below the guard in main too — measured, 3 of them. So the
defective SHAPE predates this branch. But it could not fire there:

- main contains `setBaseForecast(null)` **zero times**.
- The filter and tab-restore paths read
  `if (bf !== undefined) setBaseForecast(bf);` — retain-on-miss, no else. A
  miss silently kept the previous cohort's forecast.

So in main `baseForecast` can never become null after the first load, the
forecast -> null transition never happens, and the violation is unreachable.
B2a replaced retain-on-miss with `setBaseForecast(resolveForecast(...).forecast)`
— 2 sites that can pass null — which is what made mid-session null possible.

**The lines are older; this branch is what makes them reachable.** Same
classification as the roll-up duplication, and the second time this rule has
decided a finding on this branch. Both were fixed here rather than filed as
pre-existing.

Worth noting what retain-on-miss was hiding: it was recorded as a display
defect (the screen changed its label and kept its numbers). It was also
load-bearing, in that it suppressed this crash by never producing the state
that triggers it. **Removing a defect can expose the ones it was masking**, and
that is not an argument for keeping it.

---

## Superseded investigation, kept for the reasoning it corrected



**2026-08-05. Investigated, not fixed. Do not merge on this entry.**

Jon's A5 selection blanked the app. Treated as introduced-by-branch as
instructed. What was established:

**The null contract holds, and the null SURFACE now has a spec.** A new
`npm run spec:nullrender` mounts the real Step 2 components — `WhatIfTab` AND
`ViewFilterBar`, the sibling that renders from the same filter change — under a
null resolution, with the real edge-fixture rows. Result: the designed empty
state (`WhatIfTab.tsx:2284`) renders, nothing throws. 8 cases, all passing.

That spec is the surface-not-store rule applied to specs themselves.
`deriveAggregate` returning null was proven at the store and re-proven at every
gate; that the SCREEN survives being handed that null had never been tested
once. It is now.

**A harness artefact was nearly reported as the defect.** The first run threw
`Cannot read properties of undefined (reading 'segment')` at
`WhatIfTab.tsx:1295` — which is a dependency array reading `newYieldEvent`, a
required PROP the harness had not supplied. A missing prop throws in a place
that looks exactly like an app bug. **Every required prop must be supplied
before a mount proves anything**, and the first version also passed `data: []`,
which makes most paths trivially safe and would have certified a screen nobody
has.

### The premise depends on which file is loaded, and Jon's was not confirmed

Measured on both candidate fixtures for
`Large Enterprise|Fixed Connectivity|All|All|All|All|All`:

| fixture | leaves enumerated | fitted | resolves to |
|---|---|---|---|
| `EdgeCases_ShortHistory` | 1 | 0 | **null**, `insufficient-history` |
| `ProductL2_Full_Jun2026` | 27 | 27 | **DERIVED**, 12 months |

Jon's Part B screenshots prove `ProductL2_Full` was loaded at least for that
part. **On that fixture the A5 filter is not a null case at all** — it is a
derived aggregate, the object whose `ArpuBand` bounds are deliberately absent,
which is the shape a band-reading chart is most likely to trip over.

So the derived case was specced too: mounted with a real 27-leaf derived
aggregate off `ProductL2_Full`, and confirmed absent ARPU bounds. It also
renders without throwing.

### Status: not reproduced

Neither the null case nor the derived case blanks the Step 2 surface under the
harness. **No fix has been made, because there is nothing yet shown to fix, and
inventing one would be a change with no failing case behind it.** Jon's console
stack is the fastest path from here.

**Declared limitation.** In the derived case Recharts logged
`width(-1) and height(-1)`, so the chart bailed before painting. "No throw" is
therefore weaker evidence for the CHART path than for the rest of the screen —
band-drawing code may not have executed. `scripts/regression-traps.tsx` solves
exactly this with a sized `ResizeObserver`; the same treatment is wanted here
before the chart path can be called clear.

---

## The Market Events chart draws no confidence bands at all

**A4, answered 2026-08-05. The third surface-not-store violation.**

Direct measurement: `src/components/WhatIfTab.tsx` contains **zero** matches for
`<Area`, `Optimistic`, `Pessimistic` or `stackId`. Step 2 renders **no
confidence band for any series** — not ARPU, not volume. Jon's screenshots
showing no cone were showing correct behaviour.

**So the A4 check was pointed at a coneless surface.** Asking for the presence
and absence of an ARPU cone on Step 2 could only ever produce "absent" twice.

### Where ARPU bands ARE user-visible

| surface | bands | follows the view filter? |
|---|---|---|
| Step 1 `StandardForecastTab` | yes (`arpuChartData`, Optimistic/Pessimistic) | **no** — renders `forecastData`, written only by manual generation |
| Step 2 `WhatIfTab` | **none at all** | n/a |
| Step 3 `ForecastVsActualsTab` | yes | yes — but requires ACTUALS |

Step 1 has the cone but is not a per-filter viewer (recorded above under the
Step 1 finding), so the aggregate-versus-leaf contrast cannot be driven there.
Step 3 follows the filter and has the bands, but needs actuals — and the edge
fixture has no companion actuals file.

**Therefore the edge fixture cannot exercise the A4 contrast on any surface.**
A4 moves to the headless spec it already has — `deriveAggregate` returning
absent ARPU bounds on a derived aggregate, pinned in the derive spec — plus a
future walk item **gated on the backlogged edge-fixture actuals companion**.
It is not a walk check today.

---

## Every walk now ends step zero with a screenshot handshake

**Protocol change, 2026-08-05, after fixture identity invalidated a walk for
the second consecutive time.**

The four-part step zero (reload, named file, row count, mapping assertion) was
in place and Part B still ran on the wrong file. Reading an anchor is not the
same as confirming it.

**Step zero now ENDS with the walker pasting screenshots of the row-count
screen and the mapping step, and waiting for confirmation, before any check
runs.** No check is graded without that handshake.

### What distinguishes the two fixtures on screen

They are identical on rows (90,720), months (42) and cohorts (540). The only
on-screen difference is tariff:

- `TariffHierarchy…` — the mapping step's **Tariff L1** and **Tariff L2**
  selectors resolve to the columns `tariff_tier_l1` and `tariff_tier_l2`, and
  the challenger tab's dimension toggles for Tariff L1/L2 are **enabled**.
- `ProductL2_Full…` — those columns **do not exist in the file**, so the
  selectors have nothing to resolve and the challenger toggles render disabled
  with the grey label **"(not mapped)"** (`CohortDimCheckboxes.tsx`, key
  `cohortdims_not_mapped`).

"(not mapped)" beside Tariff is therefore a positive identification of
`ProductL2_Full`, not a bug.

### And this is the DQ line justifying itself

The app gives a user **no persistent indication of which file is loaded**. Once
past the import screen there is nothing on screen naming the file, so two
fixtures that differ only in one dimension are indistinguishable during a
session — which is exactly how this recurred.

That is the "How your data was read" line's case, made twice by accident rather
than argument: it is not only about data quality, it is about knowing which
data you are looking at. Recorded against the DQ import phase alongside items
A–F.

## WORKING PRACTICE: data issues are told to the user, not handled silently

**Standing principle, set by the user 2026-08-04.**

**Data issues in uploaded files are communicated to the user in the interface —
never silently handled, never worked around in code.**

The user owns their data. A tool that quietly compensates for a problem in it
takes away the only chance to fix it at source, and leaves the user reading
numbers whose caveats exist only in the code. Silent compensation also hides the
problem from the next person, who then finds it as an inexplicable result rather
than as a stated limitation.

**Worked example: Phase 0's named-skip panel.** A leaf that could not be fitted
used to vanish — `if (bf)` with no else, no counter on either arm. The aggregate
built from it was understated by exactly its contribution, and presented as
forecast bias rather than as a coverage gap. The fix was not to substitute a
value, infer one, or borrow a neighbour's: it was to **name the skipped cohorts
on screen** and let the user decide what that means for their data.

That is the shape. Not "handle it well" — **say it**.

This connects to the borrow-an-unrelated-cohort pattern recorded above. Every
instance of that pattern is the same instinct: produce a number rather than
decline. The principle here is the general form of the rule those three
deletions apply.

### Two rules for any check built under this principle

1. **No check fires on a property it cannot state accurately.** A warning that
   is approximately right about your data is worse than no warning, because it
   spends the user's trust on something they then have to go and disprove.
2. **Warnings are sparing.** A panel that cries wolf on every upload trains
   users to dismiss it, and the one upload that mattered is dismissed with the
   rest. This is the regression-guard verdict-line lesson applied to the UI: a
   signal that fires on everything carries no information, and the failure is
   silent because it looks like the signal is working.

### And distinguish "the file is WRONG" from "the file is LIMITED"

Two different sentences to the user, and mixing them is how a tool starts
accusing correct data of being broken:

- **Wrong** — internally inconsistent, e.g. revenue that does not equal price x
  volume. The file contradicts itself; something upstream is at fault.
- **Limited** — internally consistent but unable to support some analysis, e.g.
  one price shared across all four IBRO scenarios, or a cohort with two months
  of history. The data is fine. What it can answer is narrower.

Wording must never imply the second is the first.

### FACTUAL CORRECTION, recorded so the premise does not recur: there is no Data Quality Service

Searched `dataQuality`, `DataQuality`, `data-quality` and `data quality`
case-insensitively across the repo excluding `node_modules`. **The only match in
the entire codebase is a comment** on the worker's `failed` counter
(`forecasting.worker.ts:100`): *"a genuine data-quality warning"*.

There is no service, no module, no directory. `src/services/` does not exist.

Data-quality surfacing today is **five independent features, none at import
time, none aggregated**: `missingMonths` (calendar gaps within one cohort),
`seasonalFallback`, `shortLeafWarnings`, Phase 0's `skipped` list, and a handful
of `alert()`/`setError` failures for unreadable or unmapped files. Four of the
five surface at FORECAST time, per cohort, on the Baseline screen.

Do not describe this as a service, and do not describe it as coverage. Naming
scattered features as a system is the same error as characterising dead code as
live protection — it makes absent checks look present.

### DQ DECISIONS — settled 2026-08-04, nothing built

Decided by the user against the inventory. **The import summary is its own gated
phase, AFTER Phase 3 and before UAT. Nothing here preempts Phases 1-3.**

#### A and C — amber warnings on a new import summary panel

**A. Revenue does not equal price x volume beyond rounding.** The "file is
WRONG" case: the file contradicts itself. The warning must state which value the
tool used, because that choice is currently invisible.

**C. Ragged month coverage across leaves.** The "file is LIMITED" case, worded
accordingly. Amber at aggregate level on the Baseline screen as well as on the
import summary, because this is the one with a live numeric consequence — it
feeds the Q4a coterminous caveat and Phase 2's partial-sum months.

#### A carries a SECOND defect in the same expression — record it now

```js
const revVal = rev || (arpu * val);
```

`forecasting.worker.ts:447`, `ForecastVsActualsTab.tsx:270`, and the two bulk
sites in `App.tsx`.

Two distinct faults live in that one line:

1. **Silent preference.** When `rev` and `arpu * val` disagree, `rev` wins and
   nothing says so. That is the silent workaround the working-practice principle
   forbids.
2. **Falsy zero.** `||` treats a genuine revenue of **0** as absent and
   substitutes `arpu * val`. A row that legitimately earned nothing is given a
   fabricated non-zero value. This is not a variant of the first fault — the
   first mis-reports a conflict, this one **invents data where the file was
   explicit**.

`??` is not automatically the fix: a truly missing revenue column should still
fall back. The distinction needed is **absent** versus **present and zero**, and
`||` cannot express it.

**Build-time requirement:** measure how often legitimate-zero revenue rows occur
before choosing the remedy. A fix whose blast radius is unmeasured is the
recorded failure mode. If the count is zero on the fixtures, say so and say that
the fixtures cannot exercise it — do not read zero as absence of risk.

#### B and D — NOT warnings. One always-present line.

The design comes from the observation that decided it: **a permanent statement
of fact reads as orientation; the same content styled as a warning reads as
noise.** A check that fires on every upload trains users to dismiss it, and B
(flat-priced books) and D (extra columns) would both fire almost always.

So they become one always-present **"How your data was read"** line on the
import summary:

- rows, months, leaves;
- extra columns combined, **named** (e.g. `Accounting_View`,
  `Refresh_Frequency`, `Simulation_Type`) — a generic message is unactionable;
- the shared-price statement, when true.

**The D-frequency unknown stops mattering.** I flagged that I had no evidence
how often extra dimensions vary in real uploads, and that the frequency decided
whether D was orientation or noise. A line that never fires has no frequency.
The unknown was dissolved by the design rather than answered — worth noticing as
a move: when a decision hinges on an unmeasured rate, changing the mechanism so
the rate is irrelevant beats measuring it.

#### F — column detection samples row zero only. QUEUED HERE 2026-08-05.

**Real mechanism, measured; queued to this phase rather than fixed where it was
found, because mapping robustness lives here.**

`App.tsx` builds the column list as `Object.keys(jsonData[0])` — the keys of the
FIRST DATA ROW. `sheet_to_json` omits keys for blank cells, so **a column that
happens to be blank in row 0 does not exist as far as the app is concerned**,
for the whole session. Auto-mapping then cannot match it, the dimension reads
"(not mapped)", and every leaf key silently carries `'All'` in that slot.

Measured across all six fixtures in `test-data/`: every one of them hides
`Applied_Flow_Rate_%` this way — 19 columns in the union of all rows, 18 in row
zero. The tariff columns are blank in 0 rows of every fixture, so this did not
cause the 2026-08-05 walk's unmapped tariff (that was fixture identity — see
"Same fixture name, different file"). The mechanism is real and unfired here,
not hypothetical.

**Wanted:** detection unions keys across a SAMPLE of rows rather than trusting
one. And this phase is exactly where the result gets reported — the
"How your data was read" line already names the extra columns it combined, so
it is the natural place to say which columns were found and which dimensions
they mapped to. A dimension the file contains but the app did not map is a data
issue the user must be told about, not one to work around silently.

Note the interaction with the unmapped-dimension defect fixed on
`session-b2-wire-seam`: silently unmapping a dimension used to inflate every
derived aggregate above it by 3x. That amplifier is gone, so this is now a
correctness-of-reporting problem rather than a correctness-of-numbers one.

#### E — dropped

Short-history leaves are already named at generation time with their exact
cohort keys. Import cannot state it as accurately: it does not know the forecast
length, nor how the four-month floor interacts with the nonzero-flow filter that
decides which months survive. Saying it earlier, twice, and less precisely
violates the rule that **no check fires on a property it cannot state
accurately**.

### Phase 1 enumeration: the removal test is ALSO incomplete — 2026-08-04

Run before building Phase 1, as the plan requires. The result changes the plan.

**Removal test.** Deleted `modelUsed` from `BaseForecast` and counted:
**18 errors, 18 distinct sites.**

```
App.tsx                 808, 880, 1057, 2423, 2762, 2766
ForecastVsActualsTab    2960, 4354
StandardForecastTab     464, 465, 1273, 1276, 1281, 1293, 1295, 1298, 1305
forecasting.ts          1064   (the construction site)
```

**Reconciliation against the recorded 12 `?? 'Holt Linear'` grep sites.** The two
lists are NOT nested. They overlap in six.

- **Both (6):** App 808, 880, 1057, 2765/2766; FvA 2960, 4354.
- **Grep only, and THREE OF THEM ARE FALSE POSITIVES (6):** App 842, 897, 1098
  read `first.Model_Used` / `r.Model` — spreadsheet columns feeding
  `cohortGenLog.modelUsed` and `BulkRunRecord.model`, **different fields that
  merely share a name**. App 472, 2643, 2892 are genuine `BaseForecast` reads
  that the compiler did not catch — see below.
- **Removal test only (12):** App 2423, 2762; all nine StandardForecastTab
  sites; forecasting.ts 1064. The grep missed every one, because none uses
  `?? 'Holt Linear'`.

So the grep list was **both incomplete and contaminated** — it missed 12 real
sites and included 3 that have nothing to do with `BaseForecast`.

#### And the removal test misses sites too — PROVEN, not inferred

App.tsx:472 is `bf.modelUsed ?? 'Holt Linear'` inside
`forecastStore.forEach((bf, storeKey) => …)`, where `forecastStore` is
`Map<string, BaseForecast>`. It did not error.

Probe: replaced it with **`bf.zzzNoSuchProp`** — a property name that exists
nowhere in the codebase — and ran `tsc`. **Zero errors.** That site is not
type-checked at all. Restored immediately.

**Why it is unchecked is UNEXPLAINED.** No index signature on `BaseForecast`, no
duplicate declaration, and the sibling sites in the same file do check. I could
not establish the cause and am not guessing at one.

#### The rule this supersedes

`qa-tester.md` says: when an approach depends on the compiler enumerating call
sites, verify the enumeration by removing the field and counting. **That is
necessary and NOT sufficient.** A removal test proves the sites it finds are
real; it cannot prove there are no others, because a site in an unchecked
position produces no error for a fabricated property either.

**The working list for Phase 1 is the UNION of removal test, grep, and manual
review — 24 sites**, and the three unchecked ones (App 472, 2643, 2892) must be
edited by hand because nothing will flag them if they are missed.

The general form, and it is the third time this shape has appeared: **an
enumeration method is evidence about what it found, never about what it did not
find.** The compiler-enumeration lesson, the scanner's bucket-8 blind spot, and
this are one lesson.

### Phase 0 gate FULLY CLOSED — visual check passed 2026-08-04

The last open item from the Phase 0 merge was that the amber panel and its named
skip list were **unreachable on both fixtures and had never been rendered**. The
edge fixture closed it.

User-run visual check on
`VBU_IBRO_EdgeCases_ShortHistory_PerScenarioARPU_Jan2023_Jun2026.xlsx`:
amber panel present, both leaves named with their reasons, counts reconciling —
**7588 + 144 = 7732**, which is the predicted 7736 minus the 4 scenario rows of
one earlier single generation.

The prediction was made before the run and matched. **Phase 0 is closed.**

### The completion modal states one fact in two vocabularies — Phase 3 work

Two lines, unlinked, on the same screen:

> 2 leaves have no forecast — too few months to fit a model
> 144 skipped — insufficient data points

**Which counter feeds which, confirmed by reading rather than assumed:**

- The **2** is `skipped`, from the TYPED loop's `else` arm — leaf grain.
- The **144** is `failed`, incremented in the **STANDARD-cohort loop** at
  `forecasting.worker.ts:292` and `:317`. `:317` is the bottom-up arm: *"No
  constituent leaf could be fitted: 0 raw rows anywhere => empty, otherwise
  genuinely insufficient data."* Cohort grain — roll-up keys x 4 scenarios.

So they are **the same defect counted at two grains**: the short leaves
themselves, and the Standard-Forecast cohorts whose every constituent leaf was
one of them. 144 = 36 roll-up keys x 4 scenarios, all descending from the
all-short aggregate.

Neither line says the other exists, and the two phrasings ("too few months to
fit a model" / "insufficient data points") describe one condition in two
wordings. A user cannot tell whether 144 includes the 2, is caused by the 2, or
is unrelated.

**Unification belongs to Phase 3's completion-message work**, where the message
becomes a coverage summary rather than a success count. One vocabulary, and the
relationship between the grains stated rather than left to be inferred.

### CORRECTED working list: 21 sites, not 24 — 2026-08-04

The earlier union of 24 was wrong. Three of the grep hits are **false positives
that must NOT be edited**, named here so nobody rediscovers and "fixes" them:

| site | what it actually reads | why it is not ours |
|---|---|---|
| `App.tsx:842` | `first.Model_Used` | a **spreadsheet column**, written into `cohortGenLog.modelUsed` |
| `App.tsx:897` | `first.Model_Used` | same column, same destination |
| `App.tsx:1098` | `r.Model` | a spreadsheet column, written into `BulkRunRecord.model` |

`cohortGenLog.modelUsed` and `BulkRunRecord.model` are **different fields that
share a name with `BaseForecast.modelUsed`**. They are unaffected by the
provenance union and must keep working exactly as they do.

**21 real sites: 18 found by the removal test, plus App 472, 2643 and 2892 which
the compiler does not see.**

### Deployment exclusions live in the Dockerfile — gitignore is not a boundary

`server.ts` was untracked to stop it shipping. That put a **deployment**
boundary in a **version-control** tool, where it did not belong and did not
work as protection.

**Verified before changing anything:** the Dockerfile builds in stage 1 and
stage 2 copies **only `/app/dist`** into `nginx:1.27-alpine`. Nothing else in
the repository can reach the production image, whatever is tracked. The
exclusion was already enforced in the right place; the gitignore entry added
nothing but a cost.

**The cost was real.** While untracked, `server.ts` existed on the author's
machine and not in a clone, so `tsc` — which had no `include` and walked the
directory — checked a different set of files per machine. A typecheck that
answers differently to different people is worse than one that checks less.

`server.ts` is now tracked, carries the constraint as a header comment, and
tsconfig has an **explicit `include`**: `src`, `scripts`, `server.ts`,
`vite.config.ts`. Coverage is now a decision rather than a side effect — it
previously swept in `dist/` build output and loose root `.cjs` scratch files.

Making it explicit immediately surfaced **3 more errors** in `scripts/` that
the implicit walk had missed. That is the point.

### INSTRUMENT FAILURE: a NUL byte made grep skip the worker, silently

`src/workers/forecasting.worker.ts` contained two literal NUL bytes, used
deliberately as a cache-key separator:

```js
const ck = `${leafIdx}\u0000${metric}`;   // was a raw 0x00 byte in the source
```

**grep treats a file containing NUL as binary and reports "Binary file matches"
instead of the matching lines — or, with `-l`/`-c` in a pipeline, contributes
nothing at all.** So every grep-based search in this project's history silently
excluded the worker.

That is how `aggregateForecastBands` came to be recorded as having zero call
sites while a live call sat at `forecasting.worker.ts:342`. The claim was not
carelessly made; the instrument lied and did not say so.

**Fixed 2026-08-04** by replacing the raw bytes with `\u0000` escapes. The
runtime string is byte-identical — only the source encoding changed. Verified:
typecheck 0, build clean, traps 3/3, all eight suites unchanged, and grep now
returns content from the file.

#### Every recorded grep-negative involving the worker, re-run

| term | worker hits | recorded finding |
|---|---|---|
| `aggregateForecastBands` | **3** | **WAS WRONG** — corrected above |
| `aggregateArpu` | 0 | stands — genuinely uncalled |
| `scaledBandFlow` | 0 | stands — single call site in FvA |
| `resolveForecast` / `deriveAggregate` / `loadForecastForFilter` | 0 | stand — none exist yet |
| `kind: 'derived'` | 0 | stands — aggregate-free control holds |
| `?? 'Holt Linear'` | 0 | stands |
| `modelUsed` / `fittedParams` / `provenanceModel` | 0 | stand — and the 27-site enumeration was compiler-driven, not grep |

**One wrong, the rest sound.**

#### STANDING RULE: a text-search negative must name the files its instrument actually covered

"No matches in `src/`" is a claim about what the tool read, not about what is
there. Tools skip things — binary detection, `.gitignore` awareness, `include`
globs, symlinks, size caps — and mostly they skip quietly.

**State the coverage with the negative.** "No matches across N files including
`X`" is falsifiable; "no matches" is not. Where a negative is load-bearing,
confirm the file you most expect to contain the thing was actually read — a
positive control on the instrument.

This is the third instrument to be caught mid-conclusion: the compiler blinded
by a missing `@types` package, the i18n scanner blind to object literals, and
now grep blind to one file. **The pattern is not that the tools are bad. It is
that a tool's silence is being read as evidence, and silence is what a broken
tool produces too.**

### The completion panel's "144 skipped" changes MEANING at the seam — Phase 3

Noted, deliberately not fixed here.

The amber line reports `failed`, incremented in the STANDARD-cohort loop
(`forecasting.worker.ts:292`, `:317`) - cohorts whose every constituent leaf
could not be fitted. Nothing about that counter changes in B2.

**What changes is whether the number still means what it says.** It is
produced at GENERATION time and describes what could not be built then. With
derivation at the seam, a cohort counted there may now RESOLVE on read - the
leaves it needed are in the store, they simply were not summed at generation
time. So the panel can report a cohort as skipped while the app then shows the
user a forecast for it.

That is not a defect introduced by B2; it is a generation-time count being
read as a coverage statement, which it never was. **It belongs to Phase 3's
completion-message work**, alongside the already-recorded finding that the
panel states one fact in two vocabularies.

Fixing it here would mean redefining a counter mid-phase, in a session whose
control is that leaf behaviour is byte-identical. Recorded instead.

### Session B1 MERGED to main at `c806370` — 2026-08-04

The seam, built but **not wired**. `resolveForecast` / `canResolve`, the
aggregate-to-leaf map in the `populatedCohortKeys` memo, and `deriveAggregate`
weighting `baseArpu` on the derived running base.

Post-merge on main: typecheck **0**, build clean, traps 3/3, all nine suites
green - derive 74, provenance 29, skip 20, edge 15, scope 61, mix 17,
prorata 21, pct 72, cards 36. Three-stage gate passed.

#### Two defects the gate found, and what each one was really about

**The running base was unfloored and unsorted**, so a leaf whose outflow
exceeded its base carried NEGATIVE weight and produced a negative `baseArpu` -
a per-subscriber revenue rate below zero. Now `Math.max(0, ...)` and sorted,
matching `bfBaseMap` exactly.

**But the defect is not the lesson.** The spec case that should have caught it
was named *"deriveAggregate and the FvA convention agree"* and asserted against
a reference computed inline **from my own unfloored formula**. It confirmed the
implementation against itself, reported agreement with a convention it never
read, and passed while the two disagreed at the first month.

**An agreement test must read the thing it claims to agree with.** A reference
you write from the same understanding that produced the implementation is not
an oracle; it is the implementation again, in different syntax. Where the
other side cannot be imported, say the check is STRUCTURAL and keep separate
properties that encode the meaning - those survive the other side being
deleted, which a comparison does not.

**GUARD 2 used a 40-line backward window** and passed a call planted inside
`canResolve`, which sits ~39 lines after `resolveForecast`. That is the exact
heuristic GUARD 1s own comment already recorded as rejected - written by me,
after writing that comment. `enclosingFunctions` is now the single shared
brace-depth tracker; no guard rolls its own enclosure logic.

Sharing it immediately exposed two gaps in the tracker: it did not recognise
hook-wrapped declarations, and could not see an arrow whose signature spans
four lines. **Both were invisible while it served one guard.** A utility used
once is a utility tested once.

### Session A MERGED to main at `d1180ad` — 2026-08-04

Branch `session-a-derive-aggregate`, `--no-ff`, no conflicts. Post-merge on
main: typecheck **0**, build clean, traps 3/3, and all **nine** spec suites
green - derive 51, provenance 29, skip 20, edge 15, scope 61, mix 17,
prorata 21, pct 72, cards 36.

(Nine, not twelve. The suite count is recorded here because it keeps being
miscounted: nine `spec:*` scripts, plus `traps`, plus `typecheck` and
`build` - which are checks, not suites.)

**Session A control held**: nothing calls `deriveAggregate`, verified by
planted violation rather than by grep alone. Worker output byte-identical.
Fitted leaf ARPU bands unchanged, with real width.

**Diff note:** `forecasting.worker.ts` shows 572 insertions / 572 deletions.
That is a one-time line-ending normalisation, not a rewrite. Every other
source file in the repo is stored LF; the worker was the exception ONLY
because its NUL bytes made git treat it as binary and store it verbatim.
Removing the NULs made it text, so it normalised like its siblings. Content
verified byte-identical after normalisation.

### APPROVED: Phase 2 design — 2026-08-04

Approved by the user with amendments. **The build sessions execute this design
mechanically, as Phase 1 executed the union.**

#### `deriveAggregate(leaves, cohort): BaseForecast | null`

- **Month-KEY aligned** means; quadrature bands (`sqrt(sum h^2)`), independence
  assumption documented at the site.
- ARPU as **summed revenue over summed volume, per month**, via `aggregateArpu`
  — which is wired in rather than reimplemented. Deleting a correct
  implementation and writing the same thing inline is how parallel
  implementations start.
- **Seed fields** at the **aggregate's own last historical month** =
  `max(month)` over the union of leaf `historicalMonths`. Each leaf read AT that
  month; a leaf with no reading there contributes **0** and is counted in
  coverage. Correct-by-construction for ragged leaves, at the cost of
  understating an early-ending leaf — which coverage states.
- **1-leaf passthrough returns the STORED OBJECT** (reference identity), not a
  one-element derivation. This is what makes leaf byte-identity hold by
  construction and closes the double-rounding hole.
- **Zero contributing leaves returns `null`**, never a zero-valued forecast.
- **Coverage annotates, never gates.**

#### AMENDMENT 1 — ONE quadrature core

The month-keyed function carries the arithmetic; the worker's index-aligned
caller becomes a **thin adapter over it**, with worker output byte-identical as
the control. Two implementations of one combination rule is the shape this
codebase has recorded three times.

**Fallback only if the adapter proves genuinely invasive:** an agreement spec
driving both on shared input, plus cross-referencing comments at each site.

#### AMENDMENT 2 — Session boundaries

Instance 3's fix **and** the `flowBandMaps` reconciliation move to **Session B**.
Instance 3's spec must assert *through* `resolveForecast` — a corrected 7-part
key still misses until derivation resolves it, so asserting the key's shape
alone would pass while the defect persists. **Session C is pure deletions.**

#### Session B may split, at the builder's discretion

Pre-authorized to become two gated sub-branches if budget demands. **Inviolable:
no session ends with typecheck red or suites failing.**

#### Sessions

| | content | control |
|---|---|---|
| **A** | `deriveAggregate`, quadrature core + worker adapter, `aggregateArpu` wired, 7 spec cases, pinned baselines, both guards planted-violation tested | no behaviour change anywhere — provable because nothing calls it; worker output byte-identical |
| **B** | `resolveForecast`, aggregate→leaf map, 12 must-route callers, `.has()` → resolvable, interaction survey, instance 3, `flowBandMaps` reconciliation | leaf byte-identity + A's pinned baselines; browser verification REQUIRED |
| **C** | `scaledBandFlow` + `computeAvgShare` deleted, instance 2 fixed | SOHO · RED S navigation-order trap, unscored-row trap |

#### Must NOT derive

`summaryMape` (`FvA:2869`, `:2884` — averages per-leaf MAPEs, a different
quantity), the export loop (`App.tsx:456` — aggregates are never stored or
exported), `forecastStore.size` (`App.tsx:701`), the challenger seed
(`App.tsx:2792` — a borrow fix, not a derivation site), and the three
`.entries()` scans (`FvA:677`, `:2176`, `:2529` — deriving inside a scan over
the store is circular).

#### Caching: NONE

Derive per call. Worst case ~204k float ops, sub-frame. The hot-path candidates
are the `.entries()` scans, which are on the must-not-derive list. **No cache
means no invalidation**, which is the entire reason read-time won.

### Phase 1 MERGED to main at `631729c` — 2026-08-04

Branch `phase1-provenance`, six commits, `--no-ff`. Post-merge on main:
typecheck **0**, build clean, traps 3/3, all **eight** suites green — provenance
30, skip 20, edge 15, scope 61, mix 17, prorata 21, pct 72, cards 36. No
conflicts.

All three gate stages found real defects: a spliced noun phrase that read "the
models in this aggregate is performing well", two unmigrated audit-log defaults,
a stale non-nullable prop type, a file-level blind spot in the spec's own guard,
and a dead i18n key.

### FAILURE MODE: an exclusion list protects sites from being EDITED, not from what they READ

Third instance of the same lesson, and the sharpest.

`App.tsx:842/897` (later `:853/:913`) were recorded as **false positives** and
excluded by name from the 27-site enumeration, with a stated reason: they write
`cohortGenLog.modelUsed` and `BulkRunRecord.model`, **different fields that
merely share a name** with `BaseForecast.modelUsed`.

**That reasoning was correct, and the conclusion drawn from it was wrong.**

The exclusion answered "should these lines be rewritten by the migration?" —
no. It did not answer "do these lines still behave correctly afterwards?" They
read `first.Model_Used`, the **same cell** the sibling `provenance` assignment
three lines above reads, and defaulted it to `'Holt Linear'`. Export option C
leaves that cell **empty for a derived row**. So one import pass could label a
cohort "Holt Linear" in the audit log while the forecast beside it correctly
said it had no model.

**The compiler could not see it.** These lines assign into a loosely-typed log
literal and never touch a typed `BaseForecast` field, so removing the field
could not flag them. Found by gate stage 2 reading the code around them.

#### The general rule

**An exclusion is a claim about EDITING, not about CORRECTNESS.** When a change
alters what a value MEANS — here, that `Model_Used` may now legitimately be
empty — every reader of that value is in scope, including the ones correctly
excluded from the edit list. Re-ask the question for excluded sites in the
reader's terms: *not "is this my field?" but "does this still hold once my
field's source can say something new?"*

And the recurring half: **an enumeration method is evidence about what it
found, never about what it did not.** Three instances now — the compiler
missing a construction site, the scanner's bucket-8 blind spot, and this. The
methods differ; the error is identical each time.

### Phase 1: authoritative enumeration and the union design — 2026-08-04

Measured on the checked foundation (`npm run typecheck` = 0). **These numbers
are authoritative in a way no earlier enumeration was.**

| removal test | sites |
|---|---|
| `modelUsed` | **27** |
| `fittedParams` | **5** — `App.tsx:478` (export), `:826` (import), `StandardForecastTab:1255`, `:1293`, `forecasting.ts:1065` (producer) |

The 27 match the recorded list exactly. Together, **32 consumer errors** when
both fields move into the union. The three grep false positives (`App` 842, 897,
1098 — spreadsheet columns feeding `cohortGenLog.modelUsed` and
`BulkRunRecord.model`) correctly do NOT appear. They stay excluded.

#### The union, designed and validated against the producer

```ts
export type Provenance =
  | { kind: 'fitted';   modelUsed: ForecastModel; fittedParams?: FittedParamsBundle }
  | { kind: 'accepted'; modelUsed: ForecastModel; fittedParams?: FittedParamsBundle;
      replacedModel: ForecastModel; acceptedAt: string }
  | { kind: 'derived';  leafCount: number;
      models: Partial<Record<ForecastModel, number>>;
      coverage: { inScope: number; withForecast: number; skipped: SkippedCohort[] } };
```

Two decisions worth keeping:

1. **The fields move INTO the union; they do not sit beside a discriminant.**
   Leaving `modelUsed` at the top level next to a `kind` field would let all 27
   sites keep compiling while reading a fiction. Moving them is what makes the
   compiler the enumerator.

2. **`provenanceModel(p): ForecastModel | null` is THE narrowing point, and it
   returns `null` rather than a default.** A default would reinstate exactly the
   fiction the union removes — the same shape as the twelve `?? 'Holt Linear'`
   sites and as the borrow-an-unrelated-cohort pattern. `null` forces each of
   the 27 to state its derived-arm behaviour rather than inherit one.

`coverage.skipped` reuses `SkippedCohort` from Phase 0 — one vocabulary, as
settled.

**Nothing is built.** The type change and producer rewrite were applied,
verified to produce exactly the 32 expected errors and no others, then
**reverted rather than left half-migrated**. Branch `phase1-provenance` exists
off `c1ef1a0` with no code changes.

### Foundation MERGED to main at `c1ef1a0` — 2026-08-04

Branch `foundation-typecheck`, six commits, merged `--no-ff`. Post-merge on
main: **typecheck 0**, build clean, traps 3/3, all seven spec suites green
(skip 20, edge 15, scope 61, mix 17, prorata 21, pct 72, cards 36). No
conflicts.

**`npm run typecheck` is green and meaningful for the first time in the
project's history.** Every enumeration that depends on the compiler — the
removal test above all — is authoritative from this commit onward and was not
before it.

### QUEUE: dead prop plumbing in StandardForecastTab — not Phase 1 scope

Found by qa-tester during the foundation gate, 2026-08-04.

`segmentMode`, `setSegmentMode`, `productMode`, `setProductMode`,
`channelMode`, `setChannelMode` are declared in `StandardForecastTabProps`
(`StandardForecastTab.tsx:63-67`) and passed down from `App.tsx`, but **never
destructured or referenced anywhere in the component body**. Grepped the whole
file: only the interface declarations match.

Consequence for the foundation branch's own work: **3 of the 7 prop-type
signatures narrowed to `DimMode` have no call site to violate.** They were
verified against nothing. That is not a defect in the narrowing — it is a
limit on what the verification established, and it is recorded so nobody
later reads those three as exercised.

Pre-existing, unrelated to the type work, and **explicitly out of Phase 1
scope**. Queued: either wire them up or delete them, but establish which by
finding out what they were meant to do — a `filter`/`compare` mode toggle that
reaches the component and is ignored suggests an abandoned feature, and
deleting it should be a decision rather than a tidy-up.

### FAILURE MODE: the compiler was absent from ALL component state, since day one

`@types/react` was never installed. React 19 ships no bundled declarations, so
`useState` was `any`, `React.FC` was `any`, and **every piece of component state
and every destructured prop in the codebase was `any`**. Vite does not
typecheck, so every build passed throughout.

**Duration: the life of the project.** This was never a regression. There was
never a point at which these types worked.

#### The signature was in generated output, unread

Under `noImplicitAny`: **TS7026 x 7,270** — *"JSX element implicitly has type
'any' because no interface 'JSX.IntrinsicElements' exists"* — and **TS7016 x
107** — *"could not find declaration file"*. Both name the cause almost
literally. Both had been generated, in this session, before the cause was found.

I summarised that output as "every TS7xxx is TS7006" **without counting by
code** — I counted by FILE and asserted a distribution by CODE. The summary was
wrong and it pointed away from the answer.

**This is the no-figure-for-a-population-you-have-not-opened rule, applied to
error lists.** An error list is a population. Summarising it by the wrong axis
is the same failure as quoting a number for rows nobody has read: the summary
sounds like a measurement and is a guess. **Count by the axis you are about to
make a claim about.**

#### CORRECTED AT THE LEAD: the "compiler silently allowed a sixth site"
#### limitation WAS this mechanism

The recorded case: `MarketEvent.sequence` was made required so the compiler
would enumerate the construction sites; it reported five and silently allowed a
sixth, the spread branch of `handleAddMarketEvent`, which shipped rows with no
slot.

**Tested 2026-08-04 with `@types/react` installed.** Omitting `sequence` from
that literal now errors:

```
src/components/WhatIfTab.tsx(1688,11): error TS2322:
  Property 'sequence' is missing in type '{ ... }' but required in type 'MarketEvent'.
```

**The site is checked. It always would have been.** `setMarketEvents` is a prop
typed `(e: MarketEvent[]) => void`, but the component is `React.FC<Props>` — and
`React.FC` was `any`, so every destructured prop was `any`, so the argument was
unchecked. Same root, one level further out.

So the limitation was never a TypeScript weakness. It was this missing package,
and it is fixed.

**A methodological note on how it was nearly mis-tested.** My first probe added
an *excess* property to that literal and saw no error — and excess-property
checks do not fire on non-fresh values, so the probe was measuring literal
freshness, not whether the site was checked. It would have produced the wrong
conclusion. **Removing a required field, not adding a spurious one, is the test
for "is this construction site checked".**

### MECHANISM FOUND: `@types/react` was never installed — 2026-08-04

**The entry below is superseded as to cause. The probes in it remain accurate;
the conclusion "unexplained" is now answered.**

#### The mechanism

**React 19 ships no bundled type declarations, and `@types/react` /
`@types/react-dom` were not in `package.json`.** So `import { useState } from
'react'` resolved to nothing, `useState` was `any`, and **every `useState`-rooted
binding in the codebase was `any`** — `forecastStore`, `baseForecast`, and every
other piece of component state.

Property access on an `any` root compiles clean, including fabricated names.
That is the whole of it.

It explains every observation, including the ones that looked contradictory:

- `forecastStore.zzzNoSuchMethod()` compiled — the binding, not the access.
- An explicit cast restored checking — the type system was never broken.
- Reordering the declaration changed nothing — **order was never the mechanism**,
  and the forward-reference hypothesis was wrong.
- Some `BaseForecast` reads DID error — those come from typed sources
  (`calculateBaseForecast`'s return, annotated literals, typed props), not from
  `useState`.
- Under `noImplicitAny`: **TS7026 x 7,270** ("no interface
  `JSX.IntrinsicElements` exists") and **TS7016 x 107** ("could not find
  declaration file"). Both are React-types-missing signatures, and both were
  sitting in the output the whole time.

**A 14-line reproduction inside the real tsconfig reproduces it** — a typed
`useState<Map<string, Thing>>` and a bogus method call, zero errors. It is not
scale, and it is not `App()`.

#### Correction to my own earlier claim

I reported that under `noImplicitAny` "every TS7xxx is TS7006". **That was
wrong.** The actual breakdown is TS7026 7,270 / TS7006 1,094 / TS7031 412 /
TS7016 107 / TS7053 20 / TS7018 18 / TS7011 4. I had counted by FILE and
asserted a distribution by CODE. The corrected figures are what point at the
cause — the claim I made would have hidden it.

#### The fix, and it is the whole fix

`npm i -D @types/react@^19 @types/react-dom@^19`. Three packages.

**Verified by the same probes at all three formerly-blind sites:**

```
src/App.tsx:472   error TS2339: Property 'zzzSite472' does not exist on type 'BaseForecast'.
src/App.tsx:2643  error TS2339: Property 'zzzSite2643' does not exist on type 'BaseForecast'.
src/App.tsx:2892  error TS2339: Property 'zzzSite2892' does not exist on type 'BaseForecast'.
```

#### AUTHORITATIVE ENUMERATION: 27 sites, superseding 21

The removal test re-run with types resolving. `_archive/` excluded as dead code.

```
src/App.tsx                     472, 808, 880, 1057, 2423, 2643, 2762, 2765, 2766, 2892
src/components/ForecastVsActualsTab.tsx   2960, 3124, 4159, 4167, 4185, 4201, 4354
src/components/StandardForecastTab.tsx    464, 465, 1273, 1276, 1281, 1293, 1295, 1298, 1305
src/utils/forecasting.ts        1064   (the construction site)
```

**The 21-site list is superseded.** Six sites it never contained are now visible
— `ForecastVsActualsTab` 3124, 4159, 4167, 4185, 4201 (the challenger preview
UI) plus `App:2765`. **The derived-arm table must be rebuilt from these 27.**

The three grep false positives (`App` 842, 897, 1098) remain excluded: they read
spreadsheet columns into `cohortGenLog.modelUsed` and `BulkRunRecord.model`, and
correctly produce no error here.

#### The fix reveals 28 latent errors — NOT fixed, NOT in scope

`npm run lint` now fails. The errors were always real; nothing could see them.

| area | count |
|---|---|
| `_archive/` (dead code) | 13 |
| `src/` (live) | 12 |
| `scripts/cards-spec.ts` | 3 |

Among the live ones, two are already-recorded open items surfacing as type
errors for the first time: `Property 'arpuScore' does not exist on type
'CohortAccuracyRow'` (`ForecastVsActualsTab:4540`) and `Property 'channel' does
not exist on type 'Cohort'` (`OverallForecastTab` x3). Also
`ConfidenceRecommendation.reasonParams` and six `Dispatch<SetStateAction<...>>`
prop mismatches.

**`npm run build` still succeeds and every spec suite still passes** — Vite does
not typecheck. So this is a lint-gate failure, not a broken app.

**Deciding what to do with the 28 is the user's call and is queued, not done.**
Nothing was edited to make them go away.

### App.tsx:472 is `any`-rooted — HYPOTHESIS FAILED, Phase 1 BLOCKED — 2026-08-04

Bounded investigation into why `bf.zzzNoSuchProp` compiles clean at
`App.tsx:472`. **The stated hypothesis was disproven. The build did not start.**

#### What IS established, by probe

1. **`forecastStore` itself is `any` at that scope.**
   `forecastStore.zzzNoSuchMethod()` inserted at `:455` -> **0 errors**. Not the
   property access; the binding.
2. **The type system is not broken.** Casting at the same site —
   `(bf as BaseForecast).zzzNoSuchProp` -> **1 error, immediately**. Checking
   works the moment the root is typed.
3. **So the unchecked surface is PER-BINDING, not per-region.** That half of the
   hypothesis holds.
4. **`:2643` and `:2892` are the same shape.** `baseForecast.zzzProbeA` and
   `.zzzProbeB` -> **0 errors**. All three compiler-blind sites are any-rooted.

#### What DISPROVES the stated mechanism

`noImplicitAny` was turned on temporarily and measured, then reverted:
**8,925 errors — and ZERO of TS7005 / TS7034 / TS7043**, the implicit-any
*variable* codes. Every TS7xxx is TS7006, an implicit-any **parameter**, almost
all React/JSX callbacks.

`forecastStore` is not an untyped local or parameter. It is
`useState<Map<string, BaseForecast>>` at `:1210`, with an explicit type
argument, and there is exactly one such binding in the file (searched; `App()`
at `:116` is the only component containing both it and `exportSession` at
`:419`).

**So an explicitly-typed `useState` binding is `any` at a forward reference from
earlier in the same function body, and I cannot say why.** The remaining
candidate is circular inference through the `App()` body, which I have NOT
demonstrated and am not asserting.

#### Why this blocks Phase 1 rather than merely annoying it

`exportSession` is where **export option C lands**. `Model_Used` (`:472`) and
`Fitted_Params_JSON` (`:478`) are both written inside the
`forecastStore.forEach` block, which this investigation has just shown is
**entirely unchecked** — every `BaseForecast` field read in the export sheet
included.

Phase 1's export work would therefore be written into a region where the
compiler validates nothing: a wrong field name, a missing arm of the provenance
union, a stale property — all compile clean. That is not a hazard to manage with
care; it is the specific tool the phase depends on being absent exactly where
the phase does its work.

**Per the standing instruction — do not build on an unexplained type hole — the
build did not start.**

#### Blast radius is larger than three sites

Three sites were found because three were looked for. The correct statement is
that **an unknown number of `BaseForecast` reads across the file are
unchecked**, and the only reliable detector found so far is inserting a
fabricated property name one binding at a time. Do not treat 21 as a complete
enumeration; treat it as the largest list produced by methods now known to be
individually incomplete.

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

### Stored fit-on-aggregate forecasts are retired at READ time — 2026-08-07

Session G removed both paths that could fit a model to an aggregate: the manual
Step 1 path (`generateStandardForecast` now declines when any dimension is
"All (Aggregated)") and the channel=`All` companion fit that bulk generation
wrote alongside each leaf. Aggregates are derived from leaves, always.

That fixes what gets WRITTEN. It does nothing about what is already written.
Every session file saved before this change carries fitted forecasts under
All-bearing keys, and `resolveForecast` is store-first — so those stale fits
would keep winning over derivation forever, silently, in exactly the sessions
whose numbers users trust most.

**The rule, in `isRetiredAggregateFit` (`src/utils/forecasting.ts`):** a stored
forecast is ignored when its provenance is `fitted` AND its key contains `All`
in any of the seven parts. `resolveForecast` and `canResolve` both gate their
store hit on it.

Three properties of the rule are deliberate and should not be "tidied":

- **It is read-time, not a migration.** No import path can bypass it, because
  the seam is the only way a forecast is read. A load-time purge would have to
  be repeated at every entry point and would be wrong at the first one missed.
- **It does not delete.** The stale entry stays in the store as a record of what
  the old session contained. It is demoted from authority to artefact. The cost
  is accepted: dead entries accumulate, and that is cheaper than a destructive
  write to a user's saved file.
- **Both halves of the condition are load-bearing.** Drop the `fitted` test and
  it retires DERIVED aggregates — that is every answer the seam produces. Drop
  the All-bearing test and it retires LEAF fits — that is every real forecast in
  the store. Either widening looks correct on the case the rule was written for.

Guarded by `npm run spec:retire` (22 checks) and guard-traps 13 and 14. The two
traps are the two widenings, one per direction; the spec's second case exists
only to be killed by trap 14, and would look like decoration to anyone reading
it without this note.

**The spec has a structural source guard, and it was added because a trap
MISSED.** `resolveForecast` is a closure inside `App` and cannot be driven
headlessly, so the spec's `resolve()` is a transcription of the seam. Trap 13
restored store-first in `App.tsx` and every behavioural check stayed green — a
correct rule that nothing calls. The guard now asserts structurally that no
store-hit return in either closure is ungated, with comments stripped first so
the docstring beside the call cannot satisfy it, and with an anti-vacuity
control asserting there is a return to guard at all.

### Test artefacts are evidence, and evidence has provenance too — 2026-08-07

Session G was held once, before any code was written, for a reason worth keeping
because the same shape will recur.

The change removes the manual path that fits models to aggregates. Verifying the
retirement rule requires a saved session that CONTAINS such a fit — and the only
thing that could produce one was the path being removed. Building first and
asking Jon for the file afterwards would have meant creating the evidence with a
build that no longer had the ability under test.

That file would still have loaded. It would still have contained aggregates. It
would have been a weaker witness than it appeared, and nothing about the artefact
itself would have said so.

**The rule this generalises to: a test artefact created against a partly-changed
build is a weaker witness than one created against the build it represents, and
the artefact does not carry that fact with it.** Provenance is the whole of this
codebase's forecasting model — a number is `fitted`, `derived`, or `accepted`,
and the seam refuses to conflate them. The same discipline applies to the inputs
of a test. Where an artefact is meant to represent a PRIOR state of the system,
it must be created against that prior state, and which build produced it must be
recorded next to it.

Two limits on this artefact were flagged at the time rather than discovered
later, which is the only reason they are not defects:

- The confirmation named the file as a literal placeholder. The real artefact
  was then located by timestamp (`PROSPECT Forecast Save — 07 Aug 2026 1026`,
  exported 10:26 that day, before any Session G change) and identified by
  content, not by name: its `Baseline_Forecasts` sheet holds 541 keys, of which
  exactly one is both `fitted` and All-bearing. Stage 2 ran against that file.
  The spec still builds a constructed equivalent, because a spec cannot depend
  on a file in someone's Downloads folder — but the branch was not graded on
  the constructed one.
- The confirmation says "two depths" and names one key
  (`Corporate|Fixed Connectivity|All|All`, whose 7-part form is
  `Corporate|Fixed Connectivity|All|All|All|All|All`). The file contains only
  that one. **RESOLVED 2026-08-07: one aggregate was generated, not two.** Jon
  confirmed directly; "two depths" was a drafting remnant of the advisor's
  template, not a description of the artefact. So the expected set was a single
  key all along, and stage 2's enumeration — 1 of 541 keys moving, 540
  unchanged — verified exactly that set rather than a subset of a larger one.
  The discrepancy is worth leaving on the record even though it resolved
  benignly: it was found by counting what the file contained instead of
  accepting what the covering note said it contained, and had it gone the other
  way, the enumeration would have been silently incomplete.

### The retirement rule misfires on unmapped dimensions — OPEN, works by accident

Found in Session H while writing the mirror control, and it changes how the
mirror control had to be stated.

**`isRetiredAggregateFit` is pure key-plus-provenance and has no idea which
dimensions were mapped.** When the upload has no tariff columns, every genuine
leaf key ends `|All|All` — those are real fitted leaves, not aggregates. The
rule classifies all of them as retired. Measured: it returns `true` for them.

Nothing is lost, and the reason is an accident rather than a design:

1. `buildRollUpIndex` maps a leaf key to a list containing **itself**;
2. the leaf read inside derivation is **not** gated by the retirement rule;
3. `deriveAggregate` of a single leaf returns that leaf **unchanged**.

So the refused store hit is handed straight back with provenance and model name
intact. Verified end to end.

**The load-bearing part is step 3, and it is not obviously permanent.** If
single-leaf derivation ever stops being an identity — a re-derived confidence
band would do it, and that is a plausible future change — then every forecast on
every unmapped-dimension dataset changes at once, silently, with no failing
test to say so. `spec:generate-missing` pins the identity for that reason.

**What it forced on the mirror control.** "Zero All-bearing writes" is FALSE as
an invariant: on an unmapped-dimension dataset it would refuse every real leaf.
The honest invariant is **no write under a key that is All-bearing in a
dimension that is actually MAPPED**. An `'All'` in an unmapped dimension is a
leaf; an `'All'` in a mapped dimension is an aggregate. Same marker, different
meaning, decided by how the key was built — which is the third time this
distinction has mattered (the legacy import site draws it too).

Left OPEN rather than fixed. The fix is to give the rule the mapped-dimension
set, which reaches into how forecasts are keyed and belongs to its own pass, not
to a session whose scope is generation. Recorded here so the accident is known
and the identity is not removed by someone who does not know it is holding this
up.

### Generate-the-missing-leaves — the two zero states are not one state

An aggregate selection on Step 1 generates the leaves under it, never a fit to
the total. Two situations produce zero leaves to generate and they mean opposite
things:

- **covered** — every leaf in scope is already fitted; the aggregate is summed
  from them and there is nothing left to do;
- **never-enumerated** — the selection does not appear in the data at all.

`missingLeavesForKey` returns `enumerated` precisely so these cannot be
collapsed into `missing.length === 0`, and the button renders them differently
(both disabled, different text). A single "generate 0" state would be wrong in
one case and misleading in the other.

Measured on the edge fixture: **74 leaves, 72 fit, 2 skipped** — both with two
months of history, classified `insufficient-history` by the app's own
`classifySkip`. They are reported **by name**: a skipped cohort the user can see
is a coverage statement, a silent one is a lie about what was produced.

Two spec defects were caught by their own anti-vacuity controls while this was
written, both worth the space:

- the spec invented a `series.length < 8` skip threshold and asserted 2 leaves
  would skip. Zero did. The app's rule is `calculateBaseForecast` returning
  null, named by `classifySkip` — the spec had been measuring its author's guess
  about the app rather than the app;
- the aggregate under test was one segment's roll-up, and the two unfittable
  leaves sit under *different* segments, so the skip checks covered neither.

Both passed a plausible reading of the brief. Neither would have failed if the
control had only asserted "some leaves were skipped" without pinning the count.

### First measured fit-on-aggregate vs derived divergence — UAT context

Keep this to hand for Alessandro and anyone else who asks why a total from an
older session moved. It is the first time the gap has been measured on a real
saved session rather than argued from the mechanism.

Session of 07 Aug 2026, key `Corporate|Fixed Connectivity|All|All|All|All|All`,
24-month horizon, derived from 27 leaves:

| metric | stored fit-on-aggregate | derived from leaves | change |
|---|---|---|---|
| inflow | 375,624.74 | 367,906.31 | **−2.06%** |
| outflow | 325,487.81 | 324,990.60 | −0.15% |
| retention | 254,602.64 | 247,553.43 | −2.77% |
| ARPU (volume-weighted) | 15.9474 | 16.2990 | **+2.20%** |

The direction is the expected one and the reason is worth being able to say in
one sentence: **fitting one curve to summed history is not the same as summing
27 individually-fitted curves, and it overstates volume because a single smooth
fit cannot reproduce the leaves' individual turning points.** ARPU moves the
other way because it is a ratio — a smaller derived volume against broadly
similar revenue raises the per-unit figure.

Two things to say plainly if asked. The old number was not a rounding artefact:
2% of a book this size is material. And the new number is not a re-forecast —
nothing was re-fitted, the leaves are the same leaves the old session already
contained. Only the arithmetic joining them changed.

### The retirement rule made two read paths diverge — CLOSED, 2026-08-07

**Closed the same session it was found.** The seam was extracted to a pure
`resolveFromStore(store, leafMap, key)` in `forecasting.ts`; `resolveForecast`
now delegates to it and session import calls it directly. One implementation,
two callers — which is what "the seam is the only door" has to mean if it is to
be more than a slogan.

Passing the store IN rather than closing over it also removed a hazard the fix
would otherwise have walked into: the import path **cannot** call App's
`resolveForecast`, because at that moment `setForecastStore` has not committed
and the closure still holds the store being replaced. A fix that looked correct
would have resolved against stale state.

**The claim is now verified over the full set, not sampled.** All 11
`setBaseForecast` call sites in App.tsx are enumerated and classified in
`spec:import-seam`: 4 seam-routed, 5 freshly fitted or accepted (a fresh fit in
`generateStandardForecast` sits behind the aggregate decline; an accepted
challenger carries provenance `accepted`, which the rule never retires), 1 the
import fix, 1 cleared by name below. The site count is pinned, so a new call
site fails the spec even if it happens to match an accepted shape — matching a
shape is not the same as having been thought about. Guard-trap 15 reverts the
import to the raw read and is confirmed killing.

Verified on the real artefact: the Is_Active key resolves to `derived` with
leafCount 27, is not the stored object, and carries the figures in the UAT table
above.

**One site is deliberately NOT routed: the legacy pre-option-C import.** Its
keys are manufactured by defaulting *absent columns* to `'All'`, and its
provenance defaults to `fitted`, so nearly every legacy forecast is All-bearing
and fitted and the rule would retire almost all of them. That would be wrong,
and the reason is a real limit on the rule's premise: **an `'All'` part means
"aggregate over this dimension" only for keys built by the current enumeration.
Where a key was built by defaulting a column that did not exist, the same marker
means "this dimension was not recorded" — and there are no leaves to derive
from, so retiring it replaces a number with no number and old files stop
loading.** The rule detects aggregation by reading a marker; the marker is not
always evidence of the thing.

**CLOSED 2026-08-07 by Session H.** Both accept sites now decline an
All-bearing key before writing, and `spec:generate-missing`'s mirror control
enumerates every store-writing site and asserts it. Guard-trap 16 removes the
decline and is confirmed killing.

The direction matters more than the fix. **Prevent the write; never re-stamp it
`accepted`.** Marking it accepted would satisfy any rule phrased as "no fitted
All-bearing writes" while making the defect *permanent*: the retirement rule
only retires `fitted`, so an `accepted` aggregate would never be caught on the
way back out. The rule's refusal to retire `accepted` is a deliberate safety net
for genuine acceptances, and laundering through it removes the net. Guard-trap
17 is that exact mutation — write allowed, provenance laundered — and it exists
because a guard which passes it is worse than no guard.

Original entry follows.

**RESIDUAL RISK, pre-existing, OPEN — the accept-challenger writers.**
`acceptPreviewForecast` and `acceptAllChallengerModels` store the raw
`calculateBaseForecast` output, whose provenance stays `fitted`, and nothing at
either site prevents an All-bearing key. Their safety rests entirely on the
`derivedMix` UI gate in `ForecastVsActualsTab` — a file this branch does not
touch — and that gate falls back to `baseForecast.provenance` when
`resolveForecast` returns null, which is what a legacy single-forecast import
produces. If exercised, they would write a fresh fit-on-aggregate.

Not introduced here and not reproduced live — the writers were traced, the
component was not driven. It is recorded rather than fixed because the fix
belongs to the accept path, not to the retirement rule.

**The reason this is written as residual risk and not as a cleared site is
itself the finding.** The first version of `spec:import-seam` accounted for
these two sites under "provenance is `accepted`, which the rule never retires".
That is false of both — `kind: 'accepted'` is set in exactly two places in
App.tsx, and neither is theirs. The spec passed anyway, because it matched call
sites by the SPELLING OF THE ARGUMENT and accepted a site if any row's pattern
fit, so a row written for one function silently absorbed sites in others. A
reason not bound to a specific site is not a reason; it is a shape that happens
to fit. The table is now keyed by enclosing function, per-function counts are
pinned so a second call cannot inherit an existing reason unexamined, and every
row claiming a call the site's own line does not show is verified against the
function body.

Original finding follows.



Found by the gate on the artefact above, and classified as introduced by the
change that exposed it rather than as pre-existing.

`resolveForecast` is not the only route from the store to the screen. Session
import (`src/App.tsx` ~:868) takes the `Is_Active` row straight into
`setBaseForecast`, with no call to the seam. Before this change that bypass was
harmless: the seam returned whatever was stored, so a raw read and a resolved
read could not disagree. The retirement rule is the first thing to make them
disagree — and it disagrees precisely for the keys the import path is most
likely to be carrying.

On Jon's artefact the two facts meet: `Is_Active` is set on
`Corporate|Fixed Connectivity|All|All|All|All|All`, which is the retired key.
Loading that session lands Step 1 on the stale fitted total and holds it until a
filter change or tab switch routes through the seam and silently replaces it.

**The general shape, which outlives this instance: making a seam selective does
not make it the only door. Every raw store read that previously agreed with the
seam by accident becomes a divergence the moment the seam starts refusing
things.** The audit that matters is not "is the rule correct" but "what else
reads the store without asking the rule". One other candidate was checked and
cleared during the gate — `acceptChallengerModel` reaches the store only behind
a `derivedMix` computed from `resolveForecast`, so it inherits the rule.

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

## BACKLOG — requested, design pass required before build

### The edge fixture needs a companion actuals file

**Recorded 2026-08-05, not built.**

`VBU_IBRO_EdgeCases_ShortHistory_PerScenarioARPU_Jan2023_Jun2026.xlsx` is the
fixture built to exercise short history and per-scenario ARPU divergence - and
no actuals file exists for it. Because the challenger tab and the accuracy
table both require a non-empty `monthMap`, **no scoring check can be run on the
one fixture built to make scoring interesting.** Every scoring check therefore
falls back to the full fixture, where the edge cases are absent.

Wanted: an actuals file from the same builder, covering the months after the
edge fixture's forecast start, so scoring checks become runnable on the fixture
that can actually exercise them.


Requests recorded here are **not scheduled and not designed**. Each needs a
design pass of its own before any branch is cut. Recorded so the request, its
open questions and its prerequisites survive in one place rather than in a
conversation.

### Editable calculated fields on % events — Alessandro Russo, 2026-08-04

**Sequenced after Phase 2.** Design pass required before build.

Three requests, one pattern: where a percentage event today *calculates* a
figure and shows it read-only, show it in an **editable box that can be
overwritten** — mirroring the pattern the absolute-volume path already uses.

| # | surface | what becomes overwritable |
|---|---|---|
| 1 | **Volume card, % mode** | calculated Service Revenue / ARPU |
| 2 | **Value card** | the same treatment |
| 3 | **Promotion, volume section** | the same treatment |

#### SETTLED: the override is a RATE

Alessandro's answer. The overwritten value pins the **per-subscriber ARPU for
the incremental (or departing) subscribers, as one absolute number**.

What follows from that, and each of these is a build constraint rather than a
restatement:

- **The percentage volume keeps resolving per view.** The override changes the
  rate, not the volume, so the per-view resolution model is untouched.
- **The rate applies at FULL MAGNITUDE to every leg**, per the settled rates
  rule - never pro-rated. A rate is not a quantity and does not split across
  the cohorts an event lands on.
- **Service Revenue becomes a DERIVED per-view display** - rate x resolved
  volume - and stops being an independent input. Two independently editable
  boxes for one relationship is how they drift apart.
- **The box pre-populates from the event's TARGET cohort's trailing 3-month
  average**, mirroring the absolute card.

**The target cohort, NOT the viewing filter's cohort.** Stated explicitly
because this is the stale-forecast class of mistake: seeding a field from
whatever the user happens to be looking at produces a number that is correct on
screen, moves when the filter moves, and describes a different population than
the event acts on. The event has a target; the pre-populated rate is the
target's.

#### SETTLED: constrained mix mode, not input-vs-target

The second question — whether an override on the Promotion card acts as an
*input* to the mix or as a *target* it must hit — is resolved, and not by
choosing between them.

**A typed target ARPU constrains the mix sliders to achievable ranges.** The
range for each slider is computed as the limits within which a valid
combination of the remaining sliders still exists.

- **Moving one slider rebalances the untouched ones deterministically.** With
  two sliders flexing, the outcome is *exactly determined* by the sum and blend
  equations — there is no choice to make and therefore no recommendation to
  offer.
- **Explicit PADLOCK toggles mark held sliders**, and unlocked sliders do the
  balancing. Alessandro's refinement, and it supersedes the touched-pinning
  rule that was recorded here first.

  Touched-pinning inferred intent from an interaction: a slider you nudged and
  regretted stayed pinned, and nothing on screen said so or offered a way back.
  A padlock is **visible and reversible** - the user states what is held rather
  than having it deduced from their history.
- **An unreachable target is flagged BEFORE interaction**, not discovered by
  dragging into a wall.
- **A collapsed range locks its slider** — when the constraints leave a single
  value, the control says so rather than offering movement that cannot happen.
- **Blank target = today's free behaviour**, plus a live blend display so the
  user can see where they are without being steered.

**Goal-seek-as-recommendation is OUT OF SCOPE.** The system constrains what is
reachable; it does not propose which reachable point to pick.

#### Design-pass notes, carried forward

- **The three-band value axis is always exactly determined.** With three bands
  and one pinned, the remaining two are fixed by the sum and blend equations.
  There is no ambiguity to design around, which makes it the easier half.
- **The multi-slider tariff axis is where the pinning rule carries its weight**,
  because more than two free variables means the rebalance has genuine
  freedom and the pinning rule is what makes it deterministic. **Candidate for
  the feature's second half**, on the grounds that the value axis can ship and
  be used while the tariff axis is still being designed.
- **The flex rule is SETTLED**: explicit padlocks hold, unlocked sliders
  balance.

  **One detail remains PENDING and only one: whether moving a slider
  auto-locks it.** That is our addition, not Alessandro's, and it is with him.
  The do-not-build guard applies to that detail alone - the padlock mechanism
  itself is agreed and can be designed against.

  It matters because it is touched-pinning returning in a smaller form: if a
  move auto-locks, intent is again inferred from an interaction, just with a
  visible padlock to undo it. That may well be right - it is the difference
  between an inference the user can see and one they cannot - but it is his
  call, not ours.

#### PREREQUISITE, promoted: the workbook-import promo-field drop

Promoted from a known gap to a **blocking prerequisite** for this work.

Override fields must **round-trip from day one**. A field a user can overwrite
and that silently fails to survive an import is worse than no field at all: the
user has stated something the tool then discards without saying so, which is
the working-practice principle inverted. Fix the promo-field drop first.

#### And the recorded boundary this work runs into

`buildPromoEvents` resolves its volume **eagerly at creation**, while
percentages resolve **per view at application time**. That mismatch is the
recorded reason percentage events were declined on the Promotion card — see
*"Percentage on the Promotion card — declined, and the reason is the resolution
model, not the interaction count"*.

Request 3 puts an editable calculated field on exactly that boundary. **It is
not a repeat of the declined request** — an overwritable box is not the same as
a percentage that resolves per view — but any design pass must say explicitly
which side of the eager/per-view line the override lands on, and what happens
when the two disagree.

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
