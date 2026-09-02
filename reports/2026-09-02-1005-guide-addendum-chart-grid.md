# User guide — the chart grid addendum (English only)

## FOR ADVISOR

```
Generated: 2026-09-02 10:05 +0100 (UTC 2026-09-02 09:05)
Certifies: 3c0dcb2 (report filled one commit later)
Repo: committed 3c0dcb2, pushed (origin in sync)
SKELETON FIRST. BASE: HEAD e1c0ed9 vs 2343's 42c55ac — one, REPORT-ONLY; no
  source drift.
THE BRIEF HAS THE LINE STYLES INVERTED, and the guide documents what is built:
  BASELINE IS SOLID, ADJUSTED IS DASHED (strokeDasharray="5 5" on the adjusted
  line only). The on-screen key agrees — a solid swatch for "Baseline (Step 1)"
  and a dashed one for "Adjusted (+ Events)". Verified in source, not memory.
ITEM 7's SWEEP FOUND NOTHING TO CORRECT, and that is the finding: the guide
  never documented the Step-2 chart AT ALL. Zero occurrences of "KPI",
  "Outflow (Ref)" or a blended-line description. The one "blended" hit is
  about a PROMOTION's own mix and is still true. So this work is purely
  additive, not a correction pass.
TRANSLATED TAIL SHA-IDENTICAL: 3949eb15… before and after, asserted at entry
  AND exit of both edit scripts. Not one translated sentence touched.
SIX NEW SUBSECTIONS in Step 2 and three glossary entries; en glossary 50 -> 53.
BASE DOMINANCE STATED PLAINLY as built, with no promise of a fix, and the
  workaround named (Only, or deselect Base).
THE HONEST NOTE IS IN: the Events summary delta and the Pricing card's
  Baseline ARPU still read the blended figure, recorded as pending decisions.
RENDER-VERIFIED: six languages, 8 sections each, no console errors.
NO GATE RUN — documentation only, no source file touched. Last gated state
  remains 42c55ac (guard-traps 117/117, mount 235/235).
```

---

## Base check

`HEAD` **`e1c0ed9`**; the 2343 report's Repo line names **`42c55ac`**. One commit
apart, `--stat` confirms **report-only**, and
`git diff --stat 42c55ac..HEAD -- src/ scripts/ test-data/` is **empty**, so the
STOP condition did not fire.

## The translated tail — SHA before and after

```
BEFORE:  3949eb152b1349afc29af44b33c4cd493d94d380   301,169 chars
AFTER:   3949eb152b1349afc29af44b33c4cd493d94d380   301,169 chars
```

Asserted at **entry and exit of both edit scripts**, so a stray edit fails the
script rather than reaching the file. The five translated blocks are byte for
byte as they were.

## Corrections to existing prose (old claim → truth)

### The sweep found nothing, and that is worth stating

Item 7 asked for a sweep of the existing English for prose describing the
five-button chart, the blended ARPU line, or the Outflow reference line. **There
is none.**

| Searched for | Occurrences in the English block |
|---|---|
| `KPI` | **0** |
| `ARPU Outflow` / `Outflow (Ref)` | **0** |
| a blended-ARPU-line description | **0** |
| `blended` | 1 — and it is not this |

**The guide never documented the Step-2 chart at all.** Its Step 2 section
covered the four cards in detail — creating events, targeting aggregates, the
spread, campaigns, each card in turn — and said nothing about the control above
them. So there was no stale claim to correct: the work is **additive**, and the
report's corrections list is empty by fact rather than by omission.

**The one `blended` hit is sound and was left alone.** It reads *"a retention
promotion can shift the retained volume between value bands, which changes its
blended ARPU even when the headline volume is unchanged"* — that is a
*promotion's own* blended ARPU across value bands, not the chart's retired
line. Different quantity, same word; still true.

**One near-miss checked and cleared.** The phrase *"all five components"*
survives in Step 3, describing the accuracy table. That is IBRO plus ARPU — five
**MAPE components**, not five chart buttons — and Step 3 is unchanged, so it
stays.

### One correction to the brief, not to the guide

The brief specifies *"baseline dashed and adjusted solid, as today"*. **It is the
other way round**, and the guide documents what is built:

```tsx
<Line dataKey={measureKey(kpi, activeMeasure, 'Baseline')} strokeWidth={2} … />   // no dasharray → SOLID
<Line dataKey={measureKey(kpi, activeMeasure, 'Adjusted')} strokeWidth={2}
      strokeDasharray="5 5" … />                                                   // DASHED
```

The on-screen key agrees: a **solid** swatch beside *Baseline (Step 1)* and a
**dashed** one beside *Adjusted (+ Events)*. Had I followed the brief the guide
would have taught the reader to misread every chart in the app.

## Strings quoted, with keys

Every user-visible phrase in the new prose was read from
`src/locales/en/translation.json` at `e1c0ed9`.

| Guide text | Key |
|---|---|
| Measure | `whatif_measure` |
| Volume / Revenue / ARPU *(the measure row)* | `whatif_measure_volume` / `_revenue` / `_arpu` |
| Baseline (Step 1) | `whatif_baseline_step_1` |
| Adjusted (+ Events) | `whatif_adjusted_events` |
| Only | `whatif_only` |
| Export | `whatif_export` |
| Volume / Value / Pricing / Promotion *(the tabs)* | `whatif_volume` / `whatif_value` / `whatif_pricing` / `whatif_promotion` |
| "Base reflects Inflow / Outflow from the prior month — an event in month T first appears in Base in T+1" | `whatif_base_reflects_inflow_outflow_from_the_prior_m` |
| "Base Revenue and Base ARPU carry the same one-month lag; the flow measures do not." | `whatif_base_lag_applies_to_revenue_and_arpu` |

The extended Base caption is quoted **verbatim and in full**, both halves, as
item 3 requires.

**The scenario names are not locale keys.** Inflow / Outflow / Retention / Base
render as metric names throughout the app; they are quoted as they appear.

## Section map for review

All additions sit inside `#step2-en`, between *The four cards* and *Creating an
event* — the chart sits above the cards on screen, so it is described before the
cards that feed it.

| § | Heading | Covers |
|---|---|---|
| 1 | **Reading the chart** | the measure row (single-select, and why); the scenario pills (any combination, never none, with the *Only* button); the last-pill note; baseline **solid** vs adjusted **dashed** with the on-screen key; the per-tab defaults table; that each tab remembers its own selection and events do not disturb it |
| 2 | **Service revenue, and why the three measures agree** | revenue as the numerator of ARPU at every level; any two measures give the third; aggregate revenue is Σ leaves and aggregate ARPU is Σrevenue ÷ Σvolume, never an average |
| 3 | **The Base measures and their one-month lag** | the caption quoted verbatim; flows describe this month while Base describes a stock shaped by the last; **Base dominates the Revenue axis** as built, with *Only* / deselect named as the way to read the flows |
| 4 | **What each scenario's ARPU means** | the four populations in plain terms, including that a high Outflow ARPU is a different problem from a high Outflow; Step 3's Value view shows the same four against actuals, from the same bands |
| 5 | **What is no longer on the chart** | the blended line and the Outflow reference line are gone, and why; **the honest note** that the Events summary delta and the Pricing card's Baseline ARPU still read the blended figure, pending decision |
| 6 | **Exporting the chart** | sixteen columns appended after the existing ones; nothing renamed, moved or removed; *Export Session* unchanged and saved sessions import as before |
| 7 | **Glossary** | *Measure*, *Per-scenario ARPU* (one entry covering all four), *Service revenue*. English glossary 50 → 53 |

**Verification run after the edits:** the English block holds 8 sections with
`<section>`, `<div>` and `<aside>` balanced (8/8, 62/62, 25/25), and the picker
was driven through all six languages — 8 sections each, no console errors, and
the translated glossary counts unchanged at 50 / 50 / 50 / 51 / 49.

## Gate

**No gate was run, and no source file changed** — the commit is one HTML
document and this report.

```
guard-traps:             NOT RUN
specs:                   NOT RUN
lint (tsc --noEmit):     NOT RUN — nothing it could check changed
build:                   NOT RUN
render check (browser):  PASS — six languages, no console errors
```

**This report certifies no test state.** The last gated state remains
**`42c55ac`** — guard-traps 117/117, sixteen specs, mounted mix-card 235/235,
lint and build clean.

## Limits of this check

**The five translated blocks now lag the English by this addendum.** They are
byte-identical and describe a chart that no longer exists in that form. That is
the accepted cost of the English-only rule, and the diff of this commit's
English block is the follow-up session's work list — the same shape as the 1924
round.

**The Base-dominance claim is qualitative.** I state that Base is typically an
order of magnitude larger than the flows on Revenue, which follows from Base
being a stock and the flows a month's movement, and matches the engine fixture
(Base revenue ~120,000 against Inflow ~12,000). I did not measure it on Jon's
data, and the guide does not quote a ratio.

**No screenshots.** The guide has never carried them and this session did not
add the convention, so a reader matching prose to screen is doing it by
description.

**The claim that Step 2 and Step 3 agree month for month is about the
baseline.** Both read the same forecast bands, which is verifiable in source
(`ForecastVsActualsTab` takes `bm.inflowArpu?.mean` and computes actuals as
Σrevenue ÷ Σvolume). Step 2's *adjusted* line has no Step 3 counterpart, and the
guide says so rather than implying a comparison that does not exist.
