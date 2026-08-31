# User guide — English section updated to 4a1d110 capability

## FOR ADVISOR

```
Generated: 2026-08-31 18:47 +0100 (UTC 2026-08-31 17:47)
Certifies: __HASH__
Repo: __REPO__
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before the base check.
BASE: HEAD a543bfb vs 1827's 29d7abd — one commit, REPORT-ONLY. No source drift.
THE GUIDE IS NOW A TRACKED ARTEFACT at docs/PROSPECT_UserGuide_Multilingual.html,
  copied in byte-identical first, then edited in place.
ENGLISH ONLY, PROVED NOT ASSERTED: the de/es/fr/it/pt tail is SHA1-identical to
  the supplied file (e99d73b…), asserted inside every edit script.
FOUR CORRECTIONS to existing prose, all code-verified — see the table below.
  The largest: "ramp and decay" describes a control that does not exist. The
  app has a SPREAD that divides a stated total across months. Decay has no
  control at all; the word survives only in code comments.
ALSO CORRECTED: "Outflow events are entered as negative by default" — the app
  FORCES the sign (-Math.abs), so what you type is a size, not a direction.
NOTHING FROM THE DQ ROADMAP APPEARS. No mapping panel, no import ambers.
ADDED: Step 2 restructured on the four tabs; churn mode in full; the pricing
  card in full; yield; dilution; editable ARPU; the events summary; a NEW
  §6 Scenario Compare; §7 expanded; §9 generation-complete modal; 12 glossary
  entries. TOC renumbered to 8 sections.
RENDER-VERIFIED in the browser: 8 en sections, TOC 1–8, no console errors, the
  language script scopes to the visible .doc so a 7-section German is fine.
NO GATE RUN — documentation only, no source file touched. tsc NOT run either;
  nothing it could check changed. Last gated state remains 4a1d110.
FOR JON'S REVIEW: the section-by-section map below is the walk order.
```

---

## Base check

`HEAD` **`a543bfb`**; the latest report on main (`2026-08-21-1827-doc-v335.md`)
names **`29d7abd`**. One commit apart, `--stat` confirms **report-only** (its own
Repo-line fill). **No source drift**, so the brief's STOP condition did not
fire.

**Note on the date.** The clock reads **2026-08-31**, ten days after the
previous session; the filename follows the command output, not the arc's dates.

## How the English-only rule was enforced

The guide is one file holding six `<div class="doc" data-lang="…">` blocks. The
English block runs from `data-lang="en"` to the start of `data-lang="de"`; every
edit was made inside that window and nowhere else.

**Proved rather than asserted.** The translated tail — everything from
`<div class="doc" data-lang="de"` onward — was fingerprinted before the first
edit and re-checked after each one:

```
ORIGINAL translated tail sha1: e99d73bce1136b9a36becce0edfdb333e81da62e  (170,975 chars)
FINAL    translated tail sha1: e99d73bce1136b9a36becce0edfdb333e81da62e  (170,975 chars)
```

Each edit script carries that comparison as an **assertion**, so a stray edit
would have failed the script rather than reaching the file. Not one translated
sentence was touched, aligned, or reflowed.

**The picker will show stale translations, and that does not break.** The
language script queries `doc.querySelectorAll('section')` and `.toc a` **within
the visible `.doc` only**, so an eight-section English document beside a
seven-section German one is fine — each is spied independently. Confirmed in the
browser: German still holds 7 sections and stays hidden. The five translated
sections now describe an older app; that is accepted and is the follow-up
session's work.

## Corrections to existing prose (old claim → code truth)

| # | Old claim | Code truth | Where |
|---|---|---|---|
| 1 | *"Set the magnitude, the start month, and the **ramp and decay** profile."* + a whole **"Ramp and decay"** subsection describing impact that builds then fades. | There is **no ramp control and no decay control**. The control is `whatif_spread_volume_over_multiple_months` — *"Spread volume over multiple months"* — with *"Spread duration (months)"* and a distribution of **Even** or **Custom %** that must sum to 100. It **divides a stated total across months**; it does not build an impact up or let it fade. `grep -rin decay src/` returns only code comments and one Promotion-card hint. | Step 2 |
| 2 | *"Outflow events … are **entered as negative values by default**."* | The app **forces** the sign: `neg = v => isOutflow ? -Math.abs(v) : v`. Typing `500` and typing `-500` both store −500. The field is labelled *Subscriber Volume (+/−)*, so the old sentence reads as advice about what to type when it is really a normalisation you cannot override. Churn rows are exempt (they store a positive reduction). | Step 2 |
| 3 | Glossary **Decay**: *"The rate at which a Market Event's impact reduces over time after it has been applied."* | No such concept exists in the app. **Entry removed.** | Glossary |
| 4 | Glossary **Ramp**: *"The rate at which a Market Event's impact builds up over time after it begins."* | "Ramp" **is** live vocabulary, but only on the churn statement — *"Ramp the reduction over multiple months"*. For volume it is a spread. **Entry rewritten** to carry both senses and point at the distinction. | Glossary |

A fifth line was **left alone deliberately**: *"Choose the event type and the
IBRO component it targets"* became *"Choose the tab … and within it the
component it targets"*, which is a restructure rather than a correction — the
old sentence was not false, it described a UI that no longer exists.

## App strings quoted, verified verbatim

Every user-visible phrase in quotation marks was read from
`src/locales/en/translation.json` at `a543bfb`, not from memory.

| Guide text | Key |
|---|---|
| Spread volume over multiple months | `whatif_spread_volume_over_multiple_months` |
| Spread duration (months) | `whatif_spread_duration_months` |
| Even / Custom % | `whatif_even` / `whatif_custom_pct` |
| Subscriber Volume (+/−) | `whatif_subscriber_volume` |
| Current churn (annualised) | `whatif_churn_current` |
| month's outflow ÷ prior-month base × 12 | `whatif_churn_breakdown` |
| Reduce by (points) | `whatif_churn_target` |
| Ramp the reduction over multiple months | `whatif_churn_ramp` |
| Over (months) | `whatif_churn_months` |
| Churn reduction *(default campaign name)* | `whatif_churn_default_campaign` |
| "This month is one step of a churn ramp … Edit the campaign instead." | `whatif_churn_member_no_edit` |
| Edit campaign "…" (N events) | `whatif_edit_campaign_event` |
| Direct / Dilution | `whatif_pricing_mode_direct` / `whatif_pricing_mode_dilution` |
| Cohorts Only / Cohorts + Base / Base Only | `whatif_cohorts_only` / `whatif_cohorts_base` / `whatif_base_only` |
| One-Off / Recurring | `whatif_one_off` / `whatif_recurring` |
| Applies to start month only, then reverts | `whatif_applies_to_start_month_only_then_reverts` |
| Applies from start month through all subsequent months | `whatif_applies_from_start_month_through_all_subseque` |
| Preview Impact / Baseline ARPU | `whatif_preview_impact` / `whatif_baseline_arpu` |
| "No baseline forecast covers this event's slice …" | `whatif_pricing_block_no_forecast` |
| "Combines multiplicatively with any other pricing event in scope." | `whatif_dilution_compounding_note` |
| "Retention volume is assumed unchanged — this moves retained revenue only." | `whatif_dilution_volume_note` |
| "Yield Events are applied first; Pricing Events layer on top." | `whatif_apply_a_price_rise_discount_or_promotion_to_a` |
| Roll forward to all subsequent months / Roll Fwd | `whatif_roll_forward_to_all_subsequent_months` / `whatif_roll_fwd` |
| Load Session File (Max 4) | `compare_load_session_file_max_4` |
| Populate Filters From | `compare_populate_filters_from` |
| Show Baseline (Dotted) | `compare_show_baseline_dotted` |
| Plot on chart / Remove session | `compare_plot_on_chart` / `compare_remove_session` |
| "Check at least one scenario below to display data." | `compare_check_at_least_one_scenario_below_to_display` |
| "No data for selected filters." | `compare_no_data_for_selected_filters` |
| "There is not enough room here to draw the chart. …" | `compare_chart_too_short` |
| "These events are scoped to a segment, product or channel …" | `compare_events_scope_not_in_baseline` |
| Export Session / Export to Excel | `common_export_session` / `common_export_to_excel` |
| Import Save / Import Actuals | `import_save` / `common_import_actuals` |
| "Generation complete — every cohort in scope now has a forecast." | `bulk_complete_full_coverage` |
| "…could not be fitted. Aggregates above them are summed without these:" | `bulk_complete_leaves_uncovered` |
| "Stored aggregate forecasts from an earlier session are no longer used…" | `bulk_complete_retired` |
| too few months to fit a model | `skip_reason_insufficient_history` |

**Two labels are hardcoded, not localised**, and are quoted as they render:
the amount toggle's **Subs** and **%** (`WhatIfTab.tsx`, literal strings beside
`whatif_churn_mode`), and Compare's window sizes **All Time / 6M / 12M / 18M /
24M** (`ScenarioCompareTab.tsx`). Worth knowing before the translation session:
they will not translate, because there is nothing to translate them from.

## Section-by-section changed/added map

Walk order for review. **A** = added, **C** = changed, **—** = untouched.

| § | Section | State | What to check |
|---|---|---|---|
| 1 | How PROSPECT works | — | Unchanged. Still accurate. |
| 2 | Getting started | — | Unchanged. **No DQ content added**, per the brief. |
| 3 | Step 1 — Baseline Forecast | **A** | New *"When generation finishes"*: full-coverage message; declined leaves and *too few months to fit a model*; two notes — aggregates summed without declined leaves, and older stored aggregates superseded by leaf sums. |
| 4 | Step 2 — Market Events | **C** | Rewritten. See breakdown below. |
| 5 | Step 3 — Actuals Review | — | Unchanged. Still accurate. |
| 6 | **Scenario Compare** | **A** | Entirely new section. |
| 7 | Saving your work | **C** | One sentence → three subsections. |
| 8 | Glossary | **C** | 12 entries added, 1 removed, 1 rewritten. 50 entries total. |

### §4 Step 2, in detail

| Subsection | State | Note |
|---|---|---|
| The four cards | **A** | Table of Volume / Value / Pricing / Promotion with what each states and when it applies; note that order is by **kind**, not creation order. |
| Creating an event | **C** | Step 2 now says "choose the tab"; the ramp/decay step is corrected to magnitude + start month. |
| Targeting an aggregate | — | Unchanged. |
| How events affect IBRO | **C** | Outflow bullet corrected; new note *"You type a size; the app decides the sign"*. |
| Spreading a volume over several months | **C** | Replaces *"Ramp and decay"* entirely. Includes the note that a spread **divides** a total rather than repeating it — the misreading the old text invited. |
| Campaigns and multiple events | **C** | Adds the campaign chip as the group-edit route, and that the tooltip shows the campaign name. |
| **The Volume card** | **A** | Subs / % / Churn tri-state, and why Churn is Outflow-only. |
| **Churn mode** (5 sub-parts) | **A** | The annualised readout and its formula; absence-with-a-reason; points reduction; single month vs ramp; the editable cumulative trajectory (6.67 / 13.33 / 20 prefill, 1/3/6 stays 1/3/6); what gets created and the default campaign name; **edit routes** — member declines with the real string, campaign reopens the *statement*, save replaces all months atomically; the **Δ column shows direction of effect** while storage keeps the opposite sign. |
| **The Value card — yield** | **A** | What it does, the tariff-mix mechanism, why a rate is not divided across cohorts, roll-forward, and its place **before** pricing. |
| **The Pricing card** | **A** | Direct vs Dilution; the three targets and why the choice matters; One-Off vs Recurring; Preview Impact **describing the event's own slice**; the no-baseline state with its disabled Add; the row as a **save-time record**; overlapping pricing events **compound** (10% + 10% = 21%). |
| **Retention dilution** | **A** | Revenue-only, user-stated, where it appears. |
| Mix changes | — | Unchanged. |
| **Editable ARPU** | **A** | Brief; includes that a stated zero is honoured as a statement. |
| **The events summary** | **A** | Brief; one table across all three carriers, and it is what the export writes. |
| The Custom Promotion card | **C** | Only the ramp/decay sentence changed, to point at the spread control. |

## The translated sections

**Untouched, byte for byte, and proved.** They now lag the English on: the four
tabs, churn mode, the pricing card, Scenario Compare, the expanded save section,
the generation-complete modal, and 12 glossary terms — plus they still carry the
**ramp-and-decay** text and the **negative-by-default** claim, both of which are
wrong in every language.

That is the accepted cost of not translating an unreviewed English. The
follow-up session inherits a clean scope: the diff of this commit's English
block **is** the work list.

## Gate

**No gate was run, and no source file changed** — the commit is one HTML
document and this report.

```
guard-traps:             NOT RUN
specs:                   NOT RUN
lint (tsc --noEmit):     NOT RUN — nothing it could check changed
build:                   NOT RUN
render check (browser):  PASS — 8 en sections, TOC 1-8, no console errors
```

**This report certifies no test state.** The last gated state remains
**`4a1d110`** — guard-traps 110/110, fourteen specs, mounted mix-card 195/195,
lint and build clean.

## Limits of this check

**The guide was verified against code, not against the running app.** Every
claim was checked against `src/` and the en locale at `a543bfb`, and the page
itself was rendered to confirm it displays — but I did not walk the app to watch
each described behaviour happen. Jon's review is the reconciliation step.

**Two behaviours are described from the code's own record rather than
re-measured here.** Pricing compounding (10% + 10% → 21%) is asserted by
`spec:scenario-pricing`, which measures 104.04 against a flat 104.00; the
pipeline order is asserted by the Pricing card's own on-screen sentence. Both
are strong evidence and neither was re-run this session.

**The Compare window's reset behaviour is described from `windowBounds`**, which
clamps a stale offset rather than exposing a reset control. The guide says the
window "is corrected rather than left pointing past the end" — accurate to the
function, but there is no button labelled Reset and the guide does not claim
one.

**Screenshots were not embedded.** The guide has never carried them and this
session did not add the convention.
