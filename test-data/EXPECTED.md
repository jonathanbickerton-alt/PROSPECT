# PROSPECT — Expected Behaviour & Known-Good Reference

This file is the source of truth for the qa-tester, debugger and
regression-guard agents. It captures known-good cohort values and the
correct expected behaviour for every previously-fixed issue, so the agents
can assert against concrete facts rather than vague impressions.

> **Maintenance note:** Values marked `(confirm)` should be verified against
> the current synthetic data file before relying on them. Update this file
> whenever a new bug is fixed so the regression checklist stays complete.

---

## 1. Test data

- **Primary file:** `test-data/VBU_IBRO_Synthetic_ForecastTest_ProductL2_Full_Jan2023_Jun2026.xlsx`
  (42-month file; a Dec 2025 variant also exists but does not cover the full actuals range)
- **Historical data range:** Jan 2023 – Dec 2025
- **Actuals range:** through **June 2026** — nothing should plot beyond this
  for any actuals series
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
- Same logic for Channel L1 / Channel L2
- Cohort store key format includes L2 placeholders, e.g.
  `Segment|ProductL1|ProductL2|ChannelL1|ChannelL2` with `All` where a
  level is not specified — confirmed in `src/App.tsx:1342-1348` (`makeForecastKey`)

---

## 3. Known ARPU levels by Product L1

ARPU clusters by product type. These are the approximate stable levels seen
across cohorts and are the anchor for ARPU correctness checks:

| Product L1         | Approx ARPU | Notes |
|--------------------|-------------|-------|
| IoT Connectivity   | ~3.3–3.4    | Lowest ARPU product (blended rev/subs across all 4 IBRO types) |
| Mobile Voice       | ~9.6–9.7    | |
| Mobile Data        | ~13.7–13.9  | |
| Fixed Connectivity | ~17.2–17.5  | Highest ARPU product |
| Blended (All)      | ~12.2–12.5  | |

If an ARPU forecast or actual for a cohort falls far outside its product
band, something is wrong — likely a cohort key mismatch or an aggregation
error pulling the wrong slice.

---

## 4. Known-good reference cohort

**Corporate · IoT Connectivity · Indirect** (the cohort used throughout
debugging). Approximate values for the comparison window:

| Series    | Actual (approx) | Forecast (approx) | Expected MAPE |
|-----------|-----------------|-------------------|---------------|
| Inflow    | ~3,450          | ~3,520            | low, <5%      |
| Outflow   | ~3,165          | ~3,130            | low, <5%      |
| Retention | ~2,390          | ~2,430            | low, <5%      |
| Base      | ~31,640         | ~31,740           | low, <2%      |
| ARPU      | ~3.3–3.4        | ~3.3–3.4          | very low, <1% |

This cohort is stable and well-forecast. Every IBRO component should score
**85+** and the ARPU MAPE should be near zero. If ARPU shows 0, or any
component shows a red/orange score for this cohort, a regression has
occurred.

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
- "Tariffs in scope" control on the What-If tab: **none selected by default**;
  the user is prompted to select. Multi-select toggle chips + Select all / Clear.
- Deselected tariffs are excluded from the tariff mix axis AND the targeting
  dropdowns. Selection persists in export (`Tariff_Selection` sheet).
- **This selection constrains the MIX/scenario layer only.** Bulk model/confidence
  generation still enumerates ALL data-present tariffs — `allCohorts`,
  `generateAllMissingForecasts`, the worker split, and `missingCount` must NOT
  reference `selectedTariffs`. Phase 2a cohort completeness stays intact.

### P6/P5 — Mix dimension selector
- The yield mix control is a dimension selector: **Value axis** (Product L2 tiers)
  or **Tariff axis** (one bucket per SELECTED tariff, dynamic count).
- Percentages validate to 100% on whichever axis is active (reuses draftMix +
  slider auto-rebalance). NO tariff×value matrix is created.
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

## 13. Regression checklist (the short version)

Every item below was a real bug or a confirmed Phase 1/2 behaviour. Confirm all
after any change:

1. ARPU MAPE non-zero for Segment-only and Segment+Channel groupings
2. Base actuals read from file, not derived, not beyond June 2026
3. ARPU boundary correction applied on generation (check console log)
4. What-If engine uses selected model, not hardcoded Holt-Winters
5. In-band actuals score 80+; scoring is mean-proximity-primary, symmetric
6. Tooltip inputs match the monthly variance table
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
16. Tariff selection constrains scenario/mix ONLY — bulk generation still
    enumerates all data-present tariffs; `selectedTariffs` never appears in
    allCohorts / generateAllMissingForecasts / worker / missingCount.
17. Mix dimension selector: Value axis unchanged (value path byte-identical);
    Tariff axis renders one bucket per selected tariff; percentages total 100% on
    the active axis; no tariff×value matrix. mixAxis round-trips in export.
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

**Verdict rule:** "SAFE FOR USER TESTING" only if all pass. Otherwise list
the failures and the cohort/filter combination that exposed each.
