# Section B — two findings diagnosed, one fix withheld

## FOR ADVISOR

```
Generated: 2026-08-08 16:24 +0100 (UTC 2026-08-08 15:24)
Verified against: HEAD 27cce36, branch main, tree CLEAN. NO CODE CHANGED.
F1 PREMISE PARTLY CONTRADICTED — the modal IS reachable and B-11's entry still exists:
  top nav "Standard Forecast" -> activeView 'overall' -> OverallForecastTab:157
  Generate Missing -> openBulkPrompt -> the modal. Gated on missing > 0.
F1 REAL: re-apply/overwrite is NOT in the modal. It is in ManageBulkDrawer, opened
  unconditionally from Step 1's "Manage" button. That capability is NOT lost.
F1 REAL: the POST-GENERATION prompt is severed for AGGREGATE selections. Session G
  (7578038) added the early return; before it (67eca3b) the path fell through to
  setTriggerBulkCheck. Leaf generates still trigger it. Introduced-in-effect by G.
F1 REAL: on a fully covered book (missing = 0) the coverage statement and
  bulk_complete_retired are unreachable — the C-19 shape, now with a second door shut.
F1 UX: the nav item labelled "Standard Forecast" targets 'overall'; Step 1 targets
  'standard'. Plausibly why the door was not found. Label/target mismatch.
F2 DOES NOT REPRODUCE on any shipped fixture at the named scope. MNC|Fixed Connectivity:
  TariffHierarchy ARPU 17.5-18.3, ProductL2_Full 14.2 — neither is Jon's 28-42.
  The prime suspect is ABSENT: zero-revenue volume share 0.0% on both, 0 of 27 leaves.
  Edge fixture boundary is CONTINUOUS: 13.600 history -> 13.6024 first forecast.
MOUNTED CHECK PASS: a fitted leaf offers Generate ENABLED (spec:step1-panel 38/38).
  So the blocked re-run Jon hit was the aggregate design split, not a leaf defect.
SUBSIDIARY: the advisor backtests analyzeAndRecommendModel against the SELECTION'S
  SUMMED HISTORY, never fits, never stores — advisory-only and consistent with Phase 3.
  The COPY is not: "achieved fitted error" reads as though the aggregate was fitted.
Decisions needed: F1 which door to restore; F2 needs Jon's fixture + which ARPU view
State: HOLD. No gate run — nothing was fixed. Walk stands at section B.
```

---

## Provenance

HEAD `27cce36`, branch `main`, tree clean. **No product code, spec, or EXPECTED.md
lead was changed.** Both findings resolved to diagnoses; one premise is partly
contradicted and the other does not reproduce, so under "fix only where
mechanisms are demonstrated" neither earns a fix this session. No gate was run,
because there is nothing to gate — saying so rather than running an empty one.

## Finding 1 — the modal, enumerated

### Every site that can open it

`grep -rn "setShowBulkGeneratePrompt|showBulkGeneratePrompt|openBulkPrompt" src/`
over all of `src/` returns two openers:

| site | route | reachable? |
|---|---|---|
| `App.tsx:4559` `onGenerateMissing={() => openBulkPrompt(null)}` | → `OverallForecastTab:157` button | **YES**, when `missingCohorts.length > 0` |
| `App.tsx:4204` `setShowBulkGeneratePrompt(true)` in the `triggerBulkCheck` effect | ← `setTriggerBulkCheck` at 2689 / 2756 | **only for LEAF generates** — see below |

### B-11's entry still exists

Section B of `reports/2026-08-07-1805-session-i-phase-3-close.md` step 11 says
"run **bulk generation** from Overall Forecast". That entry is present:
`OverallForecastTab.tsx:157`, `onClick={onGenerateMissing}`, rendered under
`activeView === 'overall'`, which the top nav reaches at `App.tsx:4274`.

**So the premise "no path on screen opens BulkGenerateModal" is contradicted for
a book with missing cohorts.** What is true is narrower and more interesting.

### What IS severed — the post-generation prompt, for aggregate selections only

`generateStandardForecast` begins at `App.tsx:2088`. Its aggregate branch
(`if (stdAggregatesMappedDim)`) **returns** around 2180. `setTriggerBulkCheck`
sits at **2689** and **2756** — after the return. An aggregate generate therefore
never raises the post-generation prompt. A leaf generate still does.

**Git evidence.** `git log -S "anyAggregated" -- src/App.tsx` first appears in
**`7578038`** (Session G's work commit, "Retire fit-on-aggregate"), refined by
`633a967` (H) and `0922d43` (K). At `67eca3b` (pre-G) there is no `anyAggregated`
and the aggregate path falls through to `setTriggerBulkCheck` (then at 2397/2464).

**Classification: introduced-in-effect by Session G.** G's decline was
deliberate and stated; the loss of the post-generation prompt was a side effect
and is stated nowhere in G's report. Nothing suggests it was intended.

### What is NOT lost — re-apply/overwrite

The brief expected re-apply to live in the modal. It does not. `onReApply` is
handed to **`ManageBulkDrawer`** (`App.tsx:4650` → `ManageBulkDrawer.tsx:171`),
whose door is Step 1's **"Manage"** button (`StandardForecastTab.tsx:510`),
rendered unconditionally in the sidebar header.

**So "a covered scope currently cannot be re-fitted with new settings through any
door" is contradicted** — the drawer is that door, and it is always open. Worth
confirming on screen, since Jon's report says otherwise and I am reading code.

### What IS unreachable on a covered book

The coverage statement and `bulk_complete_retired` render only inside
`BulkCompletePanel`, reached only via `handleConfirm`. The modal's only standing
door is gated on `missingCohorts.length > 0` and `openBulkPrompt` additionally
requires `missingStandardCohorts.length > 0`. **On a fully covered book both
statements are unreachable** — the C-19 shape, now with the post-generation door
shut as well.

### A UX finding that likely explains the report

`App.tsx:4274` renders a nav button labelled **`t('standard_forecast')`** whose
`onClick` is **`setActiveView('overall')`**. Step 1 is reached from the step
indicator (`setActiveView('standard')`). A user looking for bulk generation under
a nav item called "Standard Forecast" is in the right place; a user looking for
Step 1 under it is not. The label and the target disagree.

### Decision needed

The mechanism is demonstrated but the intent is not mine to choose:

1. **Restore the post-generation prompt for aggregate generates** — the scoped
   run knows what it generated and what it skipped, so it could raise the same
   panel. This restores the coverage statement to the path Jon actually uses.
2. **Give the coverage statement a door that does not depend on missing > 0** —
   which is C-19's DQ-phase orientation line, already recorded and queued.
3. **Fix the nav label/target mismatch** — independent of both, and cheap.

I have not chosen, because (1) and (2) overlap and picking one changes what the
DQ phase inherits.

## Finding 2 — does not reproduce; the suspect is absent

### Both sides reconstructed

**(a) Displayed history** — `arpuChartData` sums revenue and volume over rows
matching the seven-dimension filter, metrics **pooled** (no metric filter), per
month: Σrev / Σvol.

**(b) Derived forecast mean** — `deriveAggregate`'s `arpuOf`
(`forecasting.ts:1301`) blends per month:
`parts = ms.map(m => ({ arpu: pick(m)?.mean ?? 0, volume: vol(m) }))`, then
`aggregateArpu(parts)`. **`?? 0` is the structural version of the suspect**: a
leaf month with no ARPU band contributes zero ARPU carrying its full volume.

### Measured — the boundary is continuous

Edge fixture, `SOHO|Mobile Voice|All|All|All|All|All`, 10 leaves:

```
last historical 2026-06 : ARPU 13.600
first forecast  2026-07 : ARPU 13.6024
month-0 volume carried by ARPU-zero leaves: 0.0%
```

No discontinuity, and the suspect is not present.

### Measured — Jon's actual scope, on the fixtures that could express it

`MNC | Fixed Connectivity`, channels/tariffs All, 27 leaves each:

| fixture | last 3 months' ARPU | zero-revenue volume share | leaves with zero revenue |
|---|---|---|---|
| TariffHierarchy Jun2026 | 17.85 / 18.32 / 17.53 | **0.0%** | **0 of 27** |
| ProductL2_Full Jun2026 | 14.23 / 14.17 / 14.22 | **0.0%** | **0 of 27** |

**Neither matches Jon's observed history of 28–42**, and the prime suspect —
volume in the denominator with zero revenue in the numerator — **does not exist
in either fixture at that scope**.

`ProductL2_Full` is confirmed 100% zero **price** in a 3,999-row sample, which is
the documented tell; but its **revenue** is populated, so Σrev/Σvol is unaffected.
Zero price does not imply zero revenue here.

### Why I am not fixing it

The mechanism is not demonstrated, and two candidate explanations remain open
that change the fix entirely:

1. **A fixture I do not have.** His 28–42 range matches nothing local.
2. **A different chart view.** The blended `arpu.mean` is what I reconstructed. A
   per-scenario ARPU view (`inflowArpu` / `outflowArpu` / `retentionArpu` /
   `baseArpu`) is a different series with a different blend, and an oscillating
   28–42 history is more consistent with a per-scenario series than a blended one.

**Two asks, both cheap:** which fixture was loaded (row count from step zero), and
whether the chart was on the blended ARPU view or a per-scenario one.

**On the DQ overlap:** the `rev || (arpu * val)` zero-revenue fabrication is
queued to the DQ phase. It is *not* implicated by anything measured here — no
zero-revenue volume exists in these fixtures at this scope — so **the fix belongs
in DQ if it belongs anywhere**, and nothing should be half-done here. If Jon's
fixture does carry zero-revenue rows, that strengthens the DQ item rather than
creating a second one.

## Mounted check — PASS

`spec:step1-panel` (38/38) includes, mounted against the real tab:

- `LEAF: the generate button is present for a leaf selection`
- `LEAF: and it is ENABLED — a fitted leaf can be regenerated`

**So Session K's defect-2 contract holds.** The blocked re-run Jon hit was the
aggregate design split — a covered aggregate scope offers nothing to generate —
**not a leaf defect.**

## Subsidiary — the Model Advisor on an aggregate

`modelRecommendation` (`StandardForecastTab.tsx:279`) calls
`analyzeAndRecommendModel(cleanedActualValues, actualValuesDetail.calStartMonth)`.
`cleanedActualValues` is the **historical actuals series for the current
selection** — for an aggregate, the summed history of that scope. It **never
fits a stored model and never writes to the store**.

**That is consistent with Phase 3.** Phase 3 removed *fitting a model to an
aggregate and serving it as a forecast*. Backtesting candidate models against a
summed history to advise which model to use is a different act, and it is the
only sensible basis for advice on that selection.

**The copy is the problem.** "Holt Linear achieved fitted error 1.7% by
historical backtesting" reads as though the aggregate was fitted — the precise
confusion Phase 3 exists to prevent. Recommend the advisory says what it
backtested against and that no aggregate model is fitted or stored. Recorded, not
changed: it is copy, and it belongs with the Session I copy batch's successor
rather than in a diagnosis session.

## Figures — re-measured, not quoted

```
PINNED ARPU MAPEs: 13.8845 / 13.4315 / 14.3888 / 13.0192   spread 1.3696pp
[diagnosis] 5-part store: 72 scored / 74;  7-part only: 72 scored / 74
generate-missing spec: 38 passed, 0 failed   (74 leaves, 72 fit, 2 unfittable)
```

## Where the walk stands

**Section B, held.** Nothing merged, nothing moved. Sections A and C stand as
last verified (Session M); D and E stand as written in the Session I report.

**On resuming section B**, capture at step zero: the fixture's row count, and
whether the ARPU chart is on the blended or a per-scenario view. Those two inputs
close Finding 2 either way.
