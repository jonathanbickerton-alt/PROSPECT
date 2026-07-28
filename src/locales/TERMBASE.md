# PROSPECT Termbase

Governs the locale values in this directory. Extracted from the multilingual
user guide: **where a term appears in the guide, the app must use the guide's
translation**, so the interface and the documentation agree. A term that
renders one way in the guide and another way in the UI is a defect in both.

**Status:** the rules, categories and term inventory below are settled and in
force. The per-locale translation columns are populated **only where a value
has been confirmed from the guide** — everything else is marked `— from guide`
and must be filled from the guide before phase 2 (locale commissioning)
begins. Do not invent a value to fill a gap; an invented translation is the
exact drift this file exists to prevent.

Phase 1 (extraction and wiring) uses English values throughout, so no gap here
blocks it.

---

## 1. Never translate

These stay English in every locale, including inside translated sentences.

**IBRO components** — `Inflow`, `Base`, `Retention`, `Outflow`
**Metric** — `ARPU`
**Scenario type** — `IBRO`, `IBRO Scenario`, `IBRO Type`
**Product name** — `PROSPECT`
**Model names** — `Simple Exponential Smoothing`, `Holt Linear`,
`Damped Trend`, `Holt-Winters`, `AutoML`

Tight labels built directly on an IBRO component or ARPU also stay English,
because they name a field rather than describe one:

`Inflow Identifier`, `Outflow Identifier`, `Base Identifier`,
`Retention Identifier`, `ARPU Column`, `ARPU Uplift %`, `Inflow Uplift %`,
`Retention Uplift %`, `Inflow Lag (Months)`, `Retention Lag (Months)`,
`Pricing Events — ARPU Override`

---

## 2. The three compound categories

A string containing a never-translate term is **not** automatically exempt.
Which of the three it falls into decides its treatment.

### (a) Sentences that mention a domain term → **translate; term stays English**

The sentence is prose. Only the term is vocabulary. Leaving these English
strands whole help paragraphs untranslated.

> `Holt-Winters requires at least 24 months of data`
> → *Holt-Winters erfordert mindestens 24 Monate an Daten*

> `Go to the Home page and upload an IBRO Excel file to begin forecasting.`
> → term `IBRO` stays; the rest translates.

> `Base reflects Inflow / Outflow from the prior month — an event in month T
> first appears in Base in T+1`
> → `Base`, `Inflow`, `Outflow` stay; the sentence around them translates.

### (b) Modifier + domain term → **translate the modifier, keep the domain noun**

Confirmed precedent from the guide:

| English | de | es | fr | it |
|---|---|---|---|---|
| Blended ARPU | gemischter ARPU | ARPU combinado | ARPU mixte | ARPU medio |

So `Baseline ARPU` → *ARPU de référence*, **not** wholly English.

Members of this category in the app: `Baseline ARPU`, `Blended ARPU`,
`New Blended ARPU`, `Baseline Blended ARPU`, `Promo blended ARPU`,
`Historical ARPU`, `Forecast ARPU`, `Adjusted ARPU`, `Base ARPU`,
`Mean (Base)`, `Acquisition (Inflow)`, `Base Only`, `Base (Adj)`,
`Base (Baseline)`, `Cohorts + Base`, `Value (ARPU)`, `Seed Base`,
`Inflow (Adj)`, `Outflow (Adj)`, `Retention (Adj)`,
`Base Volume Delta (end of period)`, `ARPU Delta (end of period)`

### (c) Formulae and symbols → **verbatim, identical in all six**

Confirmed: the guide keeps this byte-identical across every locale.

```
Base[t] = Base[t-1] + Inflow[t-1] − Outflow[t-1]
```

Also verbatim: `ARPU Δ`, `Base Δ`, `Inflow Δ`, `Outflow Δ`, `Retention Δ`,
`ARPU (+/−)`, `Var %`, `Dev%`

---

## 3. Feature names — translated

The product's own feature names are translated, matching the guide.

| English | de | es | fr | it | pt |
|---|---|---|---|---|---|
| Baseline Forecast | — from guide | — from guide | — from guide | — from guide | — from guide |
| Market Events | — from guide | — from guide | — from guide | — from guide | — from guide |
| Actuals Review | — from guide | — from guide | — from guide | — from guide | — from guide |
| Scenario Compare | — from guide | — from guide | — from guide | — from guide | — from guide |
| Standard Forecast | — from guide | — from guide | — from guide | — from guide | — from guide |
| Overall Forecast View | — from guide | — from guide | — from guide | — from guide | — from guide |
| Custom Promotion | — from guide | — from guide | — from guide | — from guide | — from guide |
| Data Mapping & Segmentation | — from guide | — from guide | — from guide | — from guide | — from guide |
| AutoML Challenger Evaluation | — from guide (`AutoML` stays) | — | — | — | — |
| Model Advisor | — from guide | — from guide | — from guide | — from guide | — from guide |
| Confidence Advisor | — from guide | — from guide | — from guide | — from guide | — from guide |

---

## 4. Core vocabulary — translated

`Baseline`, `Forecast`, `Forecasted`, `Historical`, `Actual`, `Actuals`,
`Adjusted`, `Scenario`, `Campaign`, `Promotion`, `Pricing`, `Cohort`,
`Volume`, `Value`, `Month`, `Period`, `Horizon`, `Model`, `Session`

---

## 5. Dimensions — translated

Per the business ruling, dimension names are translated even though they mirror
uploaded spreadsheet column headers.

`Segment`, `Customer Segment`, `Product`, `Channel`, `Tariff`, `Cohort`,
`Product L1`, `Product L2`, `Channel L1`, `Channel L2`, `Tariff L1`,
`Tariff L2`, `All Segments`, `All Products`, `All Channels`,
`All (Aggregated)`

> **Watch:** the `L1`/`L2` suffixes are level markers, not words. Keep them as
> `L1`/`L2` in every locale; translate only the dimension noun.

---

## 6. Event mechanics — translated

`Contract Length`, `Duration`, `Distribution`, `Even`, `Custom %`,
`Campaign Name`, `Event Name`, `Ramp`, `Decay`, `Mix %`,
`Distribute mix across`, `Tariffs in scope`, `Target`, `Amount`,
`Active Market Events`, `Events this month`, `Exclude Market Events`,
`Include Market Events`, `Adjusted vs Baseline`

---

## 7. Forecast operations — translated

`Generate Forecast`, `Run Forecast`, `Re-apply to selected`,
`Apply Recommended Model`, `Apply Recommended Settings`,
`Ignore Recommendation`, `Accept Model`, `Keep Current`, `Already optimal`,
`Model applied`, `Bulk Generation Complete`, `Manage Bulk Generations`,
`Import Actuals`, `Remove Actuals`, `Export Session`, `Export to Excel`,
`Generating Forecasts…`

---

## 8. Score and confidence labels — translated

`Score`, `Overall Score`, `Component score`, `Average`, `Variance`,
`In Band`, `Band`, `Optimistic`, `Pessimistic`, `Window Size`,
`Fitted Model Parameters`, `In-sample MSE`, `Confidence Band Width`,
`Confidence Horizon (Months)`, `Pre-Horizon z-score`,
`Post-Horizon Band Multiplier`, `Pre-Horizon Uncertainty (%)`,
`Action Required`, `Best Model Applied`, `All Models Performing Well`

> `z-score` and `MSE` are statistical notation — keep as-is inside the
> translated label, as with the IBRO components.

---

## 9. Placeholder hints — translated, including the abbreviation

The `e.g.` abbreviation itself changes per locale.

| en | de | es | fr | it | pt |
|---|---|---|---|---|---|
| e.g. | z. B. | p. ej. | p. ex. | per es. | p. ex. |

Applies to: `e.g. Summer Promo 2026`, `e.g. CPI Rise Jan 2026`,
`e.g. Q3 Promo Mix`, `e.g. one-time fleet update`,
`e.g. Quarterly pricing review, updated confidence settings…`

> Example content inside the hint (`Summer Promo 2026`) is illustrative and
> should be localised to read naturally, not transliterated.

---

## 10. Layout risk list

German and French run roughly 20–30% longer than English; Italian and
Portuguese somewhat less. These elements are width-constrained and must be
re-checked visually in **de** and **fr** before any locale ships.

| Element | Risk |
|---|---|
| Step indicator labels (`Baseline Forecast`, `Market Events`, `Actuals Review`) | Three across a fixed-width bar; wrapping breaks alignment |
| Table column headers in Actuals Review | Sticky headers with narrow columns |
| Score band labels | Sit inside coloured pills of fixed width |
| Primary action buttons (`Apply Recommended Model`, `Apply Recommended Settings`) | Already long in English |
| Dropdown option text (`All (Aggregated)`, `All Segments`) | Constrained by the control width |
| Modal titles | `Data Mapping & Segmentation`, `Bulk Generation Complete` |
| Filter chips | Sized to content, wrap awkwardly at small widths |
| `Distribute mix across` / `Tariffs in scope` | Inline labels beside controls |

---

## 11. Using this file

**During extraction (phase 1):** cross-check each string against the sections
above. A string matching a termbase entry gets a key so phase 2 picks up the
guide's value. A string that has no entry but plausibly belongs in the guide is
flagged rather than keyed silently — the guide may need extending so the two do
not drift.

**During commissioning (phase 2):** the termbase value wins over a translator's
preference. Where the guide and the app disagree, that is a bug to reconcile,
not a style choice.

Translator context notes for strings that cannot be disambiguated from the
English alone — `View`, `Use`, `Record`, `Clear`, `Done` and similar — live in
`_context.json` in this directory, keyed identically to `translation.json`.
