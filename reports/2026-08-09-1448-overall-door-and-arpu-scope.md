# B-11 re-run — one definition of missing, and an ARPU chart showing two populations

## FOR ADVISOR

```
Generated: 2026-08-09 14:48 +0100 (UTC 2026-08-09 13:48)
Certifies: working tree on main, base abe1211. NOT YET COMMITTED at write time.
PART 1 REPRODUCED FROM SOURCE, then fixed. Edge fixture post-fit: 144 offered and
  146 reported uncovered, both screenshotted. 144 = 36 keys x 4 SCENARIO ROWS;
  of the 36, 34 AGGREGATES (whose whole leaf population is the 2 short leaves)
  and those same 2 leaves, which 146 then double-counts.
CLASSIFIED as expected: pre-existing definition (ec3c79a, 2026-07-30) on a
  surface J never touched — a51ec8e lists App.tsx and StandardForecastTab.tsx,
  not OverallForecastTab.tsx. J's no-exit loop where J's fix never reached.
FIX: the door is now missingLeavesForKey at the ROOT scope — Step 1's own
  function, so the two cannot drift. Aggregates cannot appear. Counts read a
  leaf-grain Set, never the row array (4 rows/key = the 36->144 step). Both doors
  are scoped leaf runs: one grain, no cross-grain sum. Post-fit: BLOCKED naming 2.
PART 1b: ALL144 was three concatenated nodes under an uppercase class, now one
  grain-naming key; decline contextual; 3 more hardcoded strings moved to t().
PART 2 MECHANISM DEMONSTRATED, NOT FIXED — HELD, reserved decision. History
  17.05-17.83 (follows dropdowns); the chart's forecast half is 33.69 = the
  keep-last leaf Corporate|Mobile Voice|High Value|Direct|Call Centre|RED XL.
  (a) CONFIRMED, (b) EXCLUDED: the selection's OWN forecast is 17.38 vs a last
  actual of 17.34 — continuous. Step 1 has no handleStep1FilterChange; Steps 2
  and 3 both re-resolve through the seam. Only fix changes keep-last. 3 options.
RE-MEASURED: 74/72/2; MAPEs 13.8845/13.4315/14.3888/13.0192. Unmoved.
GATE all three PASS / SAFE FOR USER TESTING; stage 3 declared 2 evidence gaps.
Decisions needed: Part 2 keep-last — three options at the end of this report.
State: B holds at 11; the finish is a fresh run through both corrected doors.
```

---

## Part 1 — verified from source, then fixed

### What feeds the Overall door

`OverallForecastTab` received `missingCohorts={missingStandardCohorts}`, defined as:

```ts
allCohorts.filter(c => !c.hasForecast && c.forecastType === 'Standard Forecast' && cohortHasData(c))
```

`allCohorts` is the full cross-product — `segments` is seeded `['All', …]` and each
product/channel/tariff combo list is seeded `{l1:'All', l2:'All'}` — and every
7-part key emits **four** rows, one per scenario, all sharing one `hasForecast`.

So the door's population is **has-no-forecast at series grain, aggregates
included**, which is not the settled definition of missing.

### Measured, not inferred

A probe mirroring that enumeration against the edge fixture, with all 72 fittable
leaves fitted:

```
TOTAL populated cohort entries (keys x 4 scenarios): 7736
MISSING entries (what the door offers):              144
  distinct keys behind them:                          36   (x4 = 144)
  of those keys, All-BEARING (aggregates):            34
  of those keys, LEAF:                                 2
COMPLETION ARITHMETIC: failed 144 + skipped 2 -> uncovered 146
```

**Both screenshotted numbers reproduced exactly.** The 34 aggregates are those
whose entire leaf population is the two short leaves — e.g.
`All|Fixed Connectivity|All|Direct|Call Centre / Tele-sales|RED ULTD|SIM-only` —
so `canResolve` was false for them and no run could ever change that.

`canResolve` itself is honest: it returns true for any aggregate with at least
one fitted leaf, which is why only these 34 appeared. The defect is not that the
door ignores derivation; it is that a population defined as *has-no-forecast*
inevitably contains keys that are never meant to have one.

And `146` sums 144 series-grain entries with 2 leaves — the 2 already inside the
144 — into one word, "cohorts".

### Classification, with commits

| commit | date | what |
|---|---|---|
| `ec3c79a` | 2026-07-30 | canonicalised `missingStandardCohorts` — has-no-forecast, cross-product |
| `a51ec8e` | 2026-08-07 | Session J: `missingLeavesForKey`, fittable-and-not-fitted |

`missingLeavesForKey` has exactly two call sites, both Step 1 (`App.tsx:1674`
and `2137`). `git show --stat a51ec8e` does not list `OverallForecastTab.tsx`.

**Pre-existing definition on a surface J did not touch** — J's no-exit loop
reappearing where J's fix never reached, not a regression of it.

### The fix

- The door's state is now `missingLeavesForKey` **at the root key** — Step 1's
  own function, same call, widest scope. Not a parallel definition, so the two
  cannot drift apart again.
- **Aggregates cannot appear**: the function enumerates leaves.
- **Counts read `missingFittableLeafKeys` (a Set)**, never the row array. The row
  array survives only so the Overall table can mark rows, and carries four rows
  per key — reading its length is precisely the 36 → 144 step.
- **Both doors are scoped leaf runs**, so one grain, and the completion panel
  cannot sum across two.
- **Four states**: post-fit the door renders *blocked, naming the 2 unfittables*.
- **Derivation is coverage**: "N aggregate views derive from their leaves".
  Nothing may call it "could not be forecast".

## Part 1b — copy

`ALL144` was three nodes — `t('bulk_settings_to_be_applied_to_all')`, then
`{missingCount}`, then a hardcoded `" remaining"` — inside an element with
`uppercase tracking-wide`. Now one interpolated key that also names the grain.

Three intents, each stating its effect: bulk-generate the offered set (primary);
keep/generate only the current selection (**signposted, not duplicated** — it is
Step 1's own button, and a second control would be a second way to do one
thing); exit doing nothing. The decline is contextual — **"Keep just this
forecast"** after a generate, where the work is already saved and "Skip for now"
implied it might not be, and **"Cancel"** from the Step 1 and Overall doors,
where nothing has been made yet. The post-generation entry leads with the
forecast being saved rather than with the offer.

Three further hardcoded strings moved to `t()`, all mis-grained as well:
the model option, the progress line, and the "N combinations" subtitle.

## Part 2 — mechanism demonstrated, and HELD

### The two halves

`arpuChartData` (`StandardForecastTab.tsx:353`) builds its history from raw rows
matched against the **seven dropdown values**. Its forecast half is
`baseForecast.months`, verbatim.

`handleStep2FilterChange` and `handleStep3FilterChange` both re-resolve
`baseForecast` through the seam on every filter change. **There is no
`handleStep1FilterChange`** — grep returns nothing. Step 1's dropdowns move; its
forecast does not.

### Measured

```
history half, Segment=Corporate others All      17.05 - 17.83  (last actual 17.34)
the selection's OWN derived forecast            17.38          continuous
what the chart actually shows                   33.69
  = Corporate|Mobile Voice|High Value|Direct|Call Centre / Tele-sales|RED XL|SIM-only
```

**Hypothesis (a) confirmed**: one chart, two populations — history follows the
selection, the forecast half is the keep-last manual generate. The leaf is a
Corporate · Mobile Voice · Direct leaf, exactly as the GENERATED panel reported,
and 33.69 sits in the observed 33–36 band.

**Hypothesis (b) excluded**: it is not a different aggregate's blend. The correct
forecast for that selection is 17.38 against a last actual of 17.34 — there is no
discontinuity to explain. The defect is that the chart is not showing it.

**The MNC | Fixed Connectivity sighting is consistent and not proven.** History
28–42 with a forecast near 24.5 could not be reproduced from the store at that
scope — which is what this mechanism predicts, since under it the forecast half
was never that scope's forecast. Closing it still needs Jon's fixture.

### Why nothing was changed — reserved decision

The only fix is to make a Step 1 selection change re-resolve `baseForecast`
through the seam, as Steps 2 and 3 do. **That is a change to the Step 1
keep-last behaviour, which the Phase 3 design pass left untouched deliberately.**
Held, per the brief.

**Options, for Jon:**

1. **Step 1 resolves like Steps 2 and 3.** Selection change re-resolves through
   the seam; a miss shows nothing rather than the previous cohort's numbers.
   Consistent with the other two steps and removes a whole class of
   stale-forecast defect. Cost: a user who generates a leaf and then widens the
   dropdowns loses the leaf from view — which is the keep-last behaviour someone
   valued enough to leave alone.
2. **Keep keep-last, make the chart honest.** The forecast half keeps rendering
   `baseForecast`, but the chart states whose forecast it is when that differs
   from the selection — and the history half is drawn for *that* key, so both
   halves are one population. Preserves the workflow; costs a label and makes the
   chart's subject explicit rather than assumed.
3. **Keep keep-last, drop the forecast half when it disagrees.** If
   `baseForecast`'s key is not the selection's key, render history only. Safest
   and least informative; no wrong line is ever drawn.

My recommendation is **(1)**, because the mismatch is not confined to this chart —
anything reading `baseForecast` on Step 1 inherits it — and Steps 2 and 3 already
prove the pattern. But this is exactly the reserved decision, so nothing was done.

## Gate

| stage | verdict |
|---|---|
| ui-consistency | PASS after one fix (below) |
| qa-tester | PASS — consumers enumerated, counts independently verified |
| regression-guard | **SAFE FOR USER TESTING**, two gaps declared |

26 specs green (`step1-panel` 53, `generate-missing` 44, `bulk-completion` 40,
`walk-fixes` 82); guard-traps **42/42** including new trap 44; `traps` 3/3; lint
and build clean; i18n parity 0 missing. §33 with scope named: **main's working
tree and build output are AI-free**; history and remote branches out of scope,
the preserved `ai-capability` branch expected.

### Figures — re-measured, not quoted

```
PINNED ARPU MAPEs: 13.8845 / 13.4315 / 14.3888 / 13.0192   spread 1.3696pp
generate-missing spec: 44 passed   (74 leaves, 72 fit, 2 unfittable)
Overall door post-fit: 0 missing, 2 unfittable  (was 144 offered, 146 reported)
```

### The one ui-consistency fix, and why it took checking

It reported the Overall button's `disabled:bg-slate-400` as diverging from the
project's `disabled:opacity-40`. My diff never touched that line, and `faa202c`
had *deliberately* set it, aligned to ManageBulkDrawer, at the ui-consistency
gate's own request. So the first answer looked like "recorded decision, reject".

Measured instead: ManageBulkDrawer no longer uses it, and the repo is 14
`opacity-40` to 1 `slate-400` — this button being the 1. **The alignment target
moved; the button did not regress.** Changed, because this diff rewrites when it
is disabled (three states of four now, rather than one edge case), with the
history recorded beside it.

### Declared gaps, from stage 3

- **No live click through `<App/>`'s own Generate Missing button.** The door is
  mounted at component level in all four states, and the App-side wiring is
  verified by source-pattern checks. Both halves exist; neither covers the other,
  and the spec says so.
- **Part 2's numbers were not re-measured by stage 3**, only re-confirmed
  structurally (both implicated files are zero-diff). The live figures in this
  report are mine, from the probe.

## Recorded, not fixed

- Five locale keys are orphaned by the copy rewrite (`bulk_skip_for_now`,
  `bulk_don_t`, `bulk_doesn_t`, `bulk_have_a_forecast_yet`,
  `bulk_settings_to_be_applied_to_all`). Harmless dead entries; removal is a
  deletion and the brief said additive.
- `EXPECTED.md` cites `App.tsx:1373` for `makeForecastKey`; it is 1505, and was
  already 1505 at `abe1211`. Pre-existing citation drift.
- The generator's unrestricted `targets` branch is now unreachable — every caller
  passes `restrictToLeafKeys` or `cohortIds`. Left in place but **relabelled**:
  its old comment called it the shared canonical path, which would send the next
  reader to the wrong place. This repo has three recorded cases of dead code
  being read as live.

## Folded back into the agent definitions

**The guard-traps rule was amended rather than restated.** It said "never in the
background"; two consecutive gates backgrounded it anyway, because the run
exceeds the 120s foreground timeout and the harness moves it there. Both ran a
single instance and waited — they were right, and the rule was wrong. A rule that
forbids the only workable way to run something gets ignored, and an ignored rule
stops protecting the part that matters. It now prohibits **a second instance**,
which was always the real hazard, and explicitly permits backgrounding one.

## Where the walk stands

**Section B holds at step 11, pending merge.** The finish is a fresh run through
**both** corrected doors:

1. Load the edge fixture; note filename and row count.
2. **Overall Forecast, before any generation.** The door should offer the
   fittable leaves by count and grain — "Generate 74 missing leaves", not "144
   combinations".
3. **Generate, and confirm at the settings step** (confirm-first is unchanged).
   Watch the completion panel: counts name their grain, and uncovered equals the
   number of named skipped leaves — not twice it, and never "146 cohorts".
4. **Return to Overall Forecast.** The door must now read **blocked, naming 2
   unfittable leaves**, and be disabled. If it offers anything, Part 1 has
   regressed.
5. **Read the aggregate caption** — "N aggregate views derive from their leaves".
   Nothing anywhere should say aggregates could not be forecast.
6. **Check the modal copy**: no `ALL144`; the decline reads "Cancel" from this
   door and "Keep just this forecast" when reached after a single generate; the
   single-cohort route is signposted, not duplicated.
7. **Step 1, Segment=Corporate, others All, Value (ARPU), blended.** Expect the
   mismatch to be **still present** — Part 2 is held, not fixed. Confirming it
   still reproduces on screen is useful; the decision above is what unblocks it.

Sections A and C stand as last verified (Session M); D and E as written in the
Session I report.
