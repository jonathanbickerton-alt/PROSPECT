# FOR ADVISOR

**Generated:** 2026-08-07 10:08
**Certifies:** none — design pass, report only. No code changed. Off main at `e3ee2f0`.

**Findings**
- Two fit-on-aggregate paths confirmed, both in `generateStandardForecast`; path B's stated purpose is already obsolete.
- Stale stored aggregates DO shadow derivation forever — a store hit wins at the seam. Recommend provenance-aware invalidation.
- **Item 5 inverts the assumption: the ARPU mismatch is WORSE for leaves, not fixed by removing the aggregate path.**
- Measured: for a leaf, the historical line is drawn from a population 15× larger than the fit. ARPU 8.67 vs 4.18, a 107% gap.
- For an aggregate at seg+prod+chan the two scopes coincide EXACTLY (gap 0.00) — the aggregate case is the only one that agrees.
- So removing fit-on-aggregate removes the one selection where Step 1's chart is self-consistent. That needs a decision.
- The 2-vs-144 split is two counters over different populations at different grains: leaves-with-reason vs cohort×scenario.
- "N months compared" is hardcoded English at `:3110`/`:3130`, unkeyed — an i18n gap as well as a wording one.
- `broadAggrSnapshotMap`: Phase 3 opens none of its three memos, so it stays recorded.

**Decisions needed from Jon / advisor**
- Item 5: fix the Step 1 chart scope in this phase, or ship the removal knowing the leaf chart is 15×-scope mismatched?
- Retirement mechanism for stale aggregates: provenance-aware (my recommendation) vs purge-on-load vs purge-at-generation?
- Sequencing: I propose THREE build sessions, not two — the census disagrees with the two-session assumption. Reasons below.

**Merge state:** N/A — nothing built. Awaiting approval of this design.

---

## 1. The two fit-on-aggregate paths

Both live in `generateStandardForecast` (`src/App.tsx`). Line numbers below are current
(`e3ee2f0`); they shifted from the ones in the kickoff when Session F removed ~395 lines.

### Path A — the primary aggregate fit (`:2548` fit, `:2562` store write)

When the Step 1 selection has any dimension at "All (Aggregated)", the IBRO series is
summed across that scope and **one forecast is fitted to the sum**, then written to
`forecastStore` under an All-bearing key.

**What it serves:** the Step 1 chart, `baseForecast` for Steps 2 and 3, and the
`savedForecasts`/`cohortGenLog` audit entries.

**Callers:** the Step 1 Generate button only. `generateStandardForecast` has one call site.

### Path B — the companion All-write (`:2639` cohort, `:2653` store write)

When a **channel-specific** forecast is generated, a *second* forecast is fitted with
`channel: 'All', channelL2: 'All'` and written under that key.

**What it serves** — quoting its own comment at `:2569`: *"so that dims.product=true cohort
rows in the Historical Accuracy table can find an exact-match key for drill-down charts."*

**That purpose is already obsolete.** `resolveForecast` derives exactly that key from the
leaves in scope. Path B is writing a fitted aggregate to satisfy a lookup that the seam now
answers by derivation — it is the same defect the last four sessions removed elsewhere,
still being *written* rather than merely read.

### The shadowing problem, and the recommended mechanism

`resolveForecast` is store-first. A stored fitted aggregate under `Corporate|All|All|All|…`
is a **store hit**, so it wins over derivation permanently. Stale manual fits from real
sessions would shadow the derived answer forever, and nothing on screen would say so.

Three candidate mechanisms:

| mechanism | what it does | what happens to a restored old session |
|---|---|---|
| **Purge-on-load** | drop All-bearing fitted entries when a save file is imported | old session opens with those aggregates **missing**, then derived on read — correct numbers, but the store silently shrinks and the change is invisible |
| **Purge-at-generation** | drop them when the user next generates | stale values persist and are *used* until the user happens to generate — the window is unbounded |
| **Provenance-aware (recommended)** | `resolveForecast` ignores a store entry whose key is All-bearing AND whose provenance is `fitted`, treating it as a miss | old session opens, those keys derive, and the entry stays in the store as a record rather than an authority |

**Recommendation: provenance-aware**, for three reasons. It is a *read-time* rule, so it
cannot be defeated by an import path anyone forgets to route through a purge. It needs no
migration and no destructive write to a user's saved file. And it is expressible as one
condition at the seam, which is where every reader already goes — the same argument that
made `resolveForecast` the seam in the first place.

The cost is that the store keeps entries it will never return, which is exactly the
`broadAggrSnapshotMap` shape of dead weight. Worth naming now rather than discovering later.

**What the user sees either way:** a restored old session's aggregate numbers **change** —
from a fitted-on-aggregate value to a derived sum of leaves. That is the correction, but it
is still a change to numbers someone may have quoted. It should be stated on screen, per the
standing data-issues principle. Draft copy in §3.

## 2. Generate on an All-selection

**Proposed behaviour.** An All-bearing selection stops fitting the aggregate and instead
enumerates the leaves in scope via `populatedCohorts.leafMap`, fits **only the missing
ones**, and lets derivation cover the aggregate from there. A fully-specified leaf selection
keeps manual generation exactly as it is.

**Button copy by state:**

| state | button reads |
|---|---|
| leaf selection, no forecast | `Generate Forecast` *(unchanged)* |
| leaf selection, has forecast | `Regenerate Forecast` *(unchanged)* |
| All-selection, some leaves missing | `Generate 47 Missing Leaves` |
| All-selection, all leaves present | `All 108 Leaves Generated` *(disabled)* |
| All-selection, no leaves enumerated | `No Cohorts In This Selection` *(disabled)* |

Naming the count on the button is the point: it is the difference between "this does
something" and "this does something to 47 cohorts", and it is the same number the completion
modal will report.

**The Step 1 keep-last-generation wrinkle is EXPLICITLY UNTOUCHED.** `StandardForecastTab`
renders `forecastData`, a `useState` written only by manual generation and cleared by no
filter change — so Step 1 keeps showing the last thing generated regardless of the current
filter. That is recorded as a coherence wrinkle and it is *not* in this phase. Two reasons:
it is orthogonal to fit-on-aggregate, and touching it changes what Jon sees on a screen he is
about to walk. Recorded, not fixed.

## 3. The completion message as a coverage statement

### The 2-vs-144 split, resolved

Two counters over different populations at different grains:

- **`skipped`** (`forecasting.worker.ts:547`) — the TYPED path. One entry per **leaf** that
  produced no `BaseForecast`, each carrying a `SkipReason`. This is the number that means
  something: a skipped leaf is missing from every aggregate summed above it.
- **`failed` / `empty`** (`:292`, `:317`) — the CHART-SERIES path. Counted per **(cohort ×
  scenario)** combination for the legacy `newForecasts` array. Four scenarios per cohort, so
  it is roughly 4× the cohort count and answers a different question.

**Proposal: retire the chart-series counter from the modal.** Not from the worker — the
legacy chart path still consumes `newForecasts` — but it should stop being *reported* beside
a leaf count, because two numbers with different denominators presented as one vocabulary is
how "2 skipped" and "144 failed" ended up on the same screen. If it is kept, its label must
state its grain: `144 of 576 cohort-scenario series`.

### Draft copy (all keyed, all six locales)

```
bulk_complete_headline        "Generation complete"
bulk_complete_coverage        "{{fitted}} of {{total}} leaf cohorts now have a forecast."
bulk_complete_all             "Every leaf cohort in scope now has a forecast."
bulk_complete_gap             "{{skipped}} could not be fitted and are named below.
                               Any aggregate above them is summed without their
                               contribution."
bulk_complete_aggregates      "Aggregates are not generated — they are summed from
                               these leaves when you view them."
bulk_complete_retired         "{{n}} stored aggregate forecast{{s}} from an earlier
                               session are no longer used; those totals are now summed
                               from their leaves and may differ."
```

The headline stops over-claiming: it states coverage (`fitted of total`), not success.
`bulk_complete_gap` keeps the named list already in place at `BulkGenerateModal.tsx:423`,
which is the half of this that is already right. `bulk_complete_retired` is the on-screen
statement of §1's provenance rule — the data-issues principle applied to a change we are
making rather than one we found.

## 4. The copy batch, verbatim

| where | now | proposed |
|---|---|---|
| `ForecastVsActualsTab.tsx:3110`, `:3130` | `{n} months compared` — **hardcoded English, no i18n key** | `actuals_cohort_months_compared`: `"{{n}} cohort-months compared"` |
| MAPE labels (`actuals_mape`) | `MAPE:` | add subtitle `actuals_mape_lower_is_better`: `"MAPE — lower is better"` |
| `cohortdims_not_mapped` | `(not mapped)` | `(not available in this view)` |

Two notes. The months-compared string is an **i18n gap as well as a wording one** — it never
had a key, so it has never been translated in any locale; the copy change and the keying are
one job. And I have **not** verified that the figure is cohort-months rather than months:
`summaryMape.monthsWithActuals` counts rows in `comparisonRows`, whose grain I did not
confirm. The rename is only correct if it is; that is a five-minute check at build time and I
am flagging it rather than asserting it.

## 5. The Step 1 ARPU cliff — measured, and it inverts the premise

**The mismatch is structural, persists for leaf fits, and is WORSE there.**

`StandardForecastTab`'s historical ARPU series (`arpuChartData`, `:348-380`) filters on
**segment, product and channel only**. It never applies Product L2, Channel L2 or tariff. The
fit applies all seven.

Measured on `SOHO | Mobile Voice | Low Value | Direct | Field / Regional Sales | RED S |
SIM-only` (full Dec2025 fixture):

| | rows | ARPU |
|---|---|---|
| Historical line scope (seg+prod+chan) | 2,160 | **8.67** |
| Forecast fit scope (all 7 parts) | 144 | **4.18** |

**The drawn history comes from a population 15× larger than the forecast beside it, and the
ARPU differs by 107%.**

And the contrast that matters for this phase: **for an aggregate selection at seg+prod+chan
the two scopes coincide exactly — gap 0.00.**

So the assumption behind item 5 is inverted. Removing fit-on-aggregate does not fix the ARPU
cliff; it **removes the only selection where Step 1's chart is self-consistent**, leaving
every remaining case mismatched by up to 15× in scope. After this phase, every Step 1 chart a
user can produce will draw a history from a wider population than its forecast.

**This needs your decision, and I recommend fixing it inside this phase.** The fix is
contained — extend `arpuChartData`'s filter to the same seven dimensions the fit uses — but
it changes a number on a screen Jon walks, and it was not on the docket. The alternative is
shipping a phase whose stated purpose is removing fit-on-aggregate while making the remaining
chart *less* trustworthy than before.

## 6. `broadAggrSnapshotMap`

Its three consumers are `cohortAccuracy`, `multiChartData` and `challengerCohortAccuracy`.
Phase 3's edits land in `App.tsx`'s generate paths, `BulkGenerateModal`, the locale files and
two render strings — **none of which opens those memos.** It stays recorded, per the standing
rule that its removal means editing dependency arrays.

## 7. Specs, mutations, gates and the walk

### Spec cases with expected values

| spec | assertion | expected | killed by |
|---|---|---|---|
| `spec:aggregate-retire` | a stored `fitted` forecast under an All-bearing key is not returned by the seam | resolves to `derived`, not the stored object | restore store-first for All-keys → returns `fitted` |
| `spec:aggregate-retire` | a stored `fitted` forecast under a LEAF key IS returned | store hit, `provenance.kind === 'fitted'` | broaden the rule to all keys → leaf resolves derived |
| `spec:generate-scope` | All-selection enumerates leaves, fits only missing | edge fixture: 74 enumerated, 72 present → **2 fitted**, 0 aggregates written | remove the missing-filter → 74 fitted |
| `spec:generate-scope` | no All-bearing key is written to the store by any generate path | 0 All-bearing writes | reinstate path A or B → ≥1 |
| `spec:generate-scope` | leaf selection still fits exactly one forecast | 1 written, key = the 7-part leaf | route leaves through the leaf-enumerator → still 1, but via the wrong path (assert the call, not the count) |
| `spec:completion-copy` | the modal reports `fitted of total`, never a bare success | coverage line present, headline carries no "successfully" | revert the headline → assertion fails |
| `spec:completion-copy` | skipped leaves are named with their reason | 2 named, each with a `SKIP_REASON_KEY` string | drop the list → count-only |

Every absence assertion is paired with a positive control using the same selector, per the
standing rule. The `0 All-bearing writes` case in particular needs its mirror — a test that
proves the counter would see a write if one happened — or it passes on any build that writes
nothing at all.

### What each gate stage checks

- **Stage 1** — the modal's new copy conforms to the established amber/green convention; no
  hardcoded strings; the six locales carry every new key; build and lint clean.
- **Stage 2** — re-derives the leaf/aggregate counts independently; plants each mutation
  above and reports which assertions go red; confirms a restored old session's numbers change
  in the direction claimed and not further.
- **Stage 3** — the full EXPECTED.md checklist; the `All`-bearing resolution population with
  composition; that Sessions C–F work still holds; scoped no-AI; and specifically whether
  this phase's removal changes any figure Jon saw in an earlier walk.

### Walk items for Jon, surface-first

1. **Step 1, All-selection.** Button reads `Generate N Missing Leaves` with a real N. Press
   it. Completion modal states coverage, names any skips, and says aggregates are summed not
   generated.
2. **Step 1, leaf selection.** Button reads `Generate Forecast`; behaviour unchanged.
3. **Restored old session.** Open a save file containing a manually-generated aggregate. The
   aggregate's numbers differ from before, and the modal or an on-screen line says why.
4. **Step 3 copy.** "cohort-months compared", "MAPE — lower is better", and Tariff reading
   "(not available in this view)".

## Sequencing — I disagree with the two-session assumption

**Proposed: three build sessions, not two.**

1. **Session G — the removal and the retirement rule.** Paths A and B out, provenance-aware
   invalidation in, `spec:aggregate-retire`. This is the piece with a migration-shaped
   consequence (restored sessions change numbers) and it deserves a gate of its own.
2. **Session H — generate-the-missing-leaves.** The enumeration, the button states,
   `spec:generate-scope`. It depends on G being settled: the button's count is meaningless
   until aggregates stop being written.
3. **Session I — the modal, the copy batch, and item 5 if you approve it.**

The census disagrees with folding G and H together for one reason: the retirement rule is a
**read-time semantic change affecting every existing saved session**, and the generate rework
is a **write-time behavioural change**. Gating them together means a stage-3 failure cannot
be attributed to either without unpicking both — and on this branch lineage, four of the last
six sessions turned on exactly that kind of attribution.

Item 5, if approved, belongs in session I with the copy, because it changes a chart Jon
walks and should land in the same session as the other things he will be looking at.
