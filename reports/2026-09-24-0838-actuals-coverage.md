# REQ-D7-01 session 1 — like-for-like coverage on the Step 3 chart and cohort table; the coverage line; the seam-miss aggregator deleted

## FOR ADVISOR

```
Generated: 2026-09-24 10:11 +0100 (UTC 2026-09-24 09:11)
Certifies: caec3ce4a3918b2488169664e93a9a2f23ae06ce
Repo: committed caec3ce, pushed (origin in sync)
Decisions 378f0c4 (correction + clauses 4-12, alone). Skeleton 000efc0.
BASE NOT CLEAN (as 1855): docs v3-3-18 D, v3-3-19 ??, yours, left untouched.
NEVER-SHED MET, measured on screen, All/All 2026-03: chart Inflow actual
33,048 (covered) vs forecast 33,136 - was 299,034. Base actual 296,883
(covered) vs 298,891. Corporate row: 33,048 vs 33,136, dev -0.27%, month
score 93.7; Inflow score 0.0 -> 84.7, overall 38.3 -> 87.2.
ONE helper coveredLeafKeys (forecasting.ts, defs 1, 3 calls in FVA): the
seam's own leaves (or its stored key), matched against the actuals' keys.
DEVIATION: a fit stored under a BROADER key covers the leaves under it
(shared cohortInScope, no new predicate). In the app every stored key is a
leaf, so this is equality; two harnesses store coarse fits and need it.
Seam-miss branch + dead accuracy memo DELETED: deriveAggregate in FVA 2->1;
resolveForecast( stays 4. Coverage line (1 key, 6 locales): "60 of 540",
row "60 of 108"; none at Corporate/Direct (60 of 60).
Challenger flagged set: [Corporate] at 38.3 -> [] at 87.2 (clause 11).
spec:actuals-coverage NEW 39/39. Traps 276-279 seen RED by hand, restored.
Re-aims seen red: unscored-row, leaf-grain, base-seed, regression-traps,
challenger-render (harness seams lacked leaves). GUARD 3 green.
Nothing was shed.
guard-traps targeted 32/32 CAUGHT, rotation 20, NOT RUN 242 (line in
section 5), last FULL run 8079186 2026-09-17T10:58Z
full suite:  77/77 green
```

## 0. Base

Quoted before any change:

- `git status --short`, **not empty**, the same two entries as at 1855:
  ```
   D docs/PROSPECT-development-history-and-working-agreement-v3-3-18.md
  ?? docs/PROSPECT-development-history-and-working-agreement-v3-3-19.md
  ```
  They are yours and uncommitted. I left them untouched and excluded from every
  commit (each commit names its paths). No `src/` or `scripts/` file is
  involved.
- `git diff a497ff5 HEAD --stat -- src`: empty.
- `git diff a497ff5 HEAD --stat -- scripts`:
  `scripts/guard-traps-ledger.json | 1438 ++++++++++++++-----------` (the
  ledger only).

HEAD and origin/main were both `02a201d`. The skeleton `000efc0` was the first
repo action.

## 1. Item 0: record

Committed alone as `378f0c4` and pushed before any code:

- The premise correction, inserted under REQ-D7-01's finding paragraph (the
  original text is kept; the correction follows it).
- Clauses 4 to 12, appended verbatim.

## 2. Item 1: the build

### The helper: `coveredLeafKeys(seam, key, actualKeys)`, `src/utils/forecasting.ts`

Defined once, next to `resolveFromStore`. It returns the keys of `actualKeys`
(the 7-part keys Step 3's actuals are held under) that the forecast is the sum
of:

- **derived:** the seam's `leaves`;
- **stored:** its own key;
- **no forecast:** nothing.

**Deviation from the brief, stated.** The brief says "the key itself for a
stored forecast". That is what this does wherever the key is a leaf, which is
every stored key the app's seam will serve, because `resolveFromStore` retires
fitted forecasts under All-bearing keys.

Two harnesses (`regression-traps`, `challenger-render`) store coarse fits under
keys like `Corporate|Mobile Voice|All|Direct|All|RED S|All`, spanning 1 to 5
leaves (measured on their fixture). With a literal key match, those fits cover
no actuals key at all. So a fit held under a broader key is treated as covering
the actuals keys under it, read with the existing shared `cohortInScope`, which
for a leaf key is plain equality. There is no new predicate, and the app's
behaviour is identical either way.

The alternative was rebuilding both harnesses' stores at leaf grain. Traps A,
B and C and the challenger stage-2 route are built on those stores.

### The chart (`ForecastVsActualsTab.tsx`)

- **`chartSeam`**, a memo holding the one seam answer **whole** (`key` and
  `result`), for the selected row's key or else the view's. The two
  `resolveForecast(` calls it holds replace the two the chart made before, so
  the FVA count stays **4**.
- **`synActualsMap`** is now built for **every** `specificForecast`, the seam
  path and the selected row included. It is restricted to
  `coveredLeafKeys(...)`. Empty stays empty: the old `size > 0 ? amap : null`
  fallback to the unrestricted bucket is gone.
- **`getActBucket`** reads the restricted buckets whenever they exist. A
  selected row with no forecast still charts its own actuals.
- **Base actual** comes from the same bucket (clause 6), with no separate rule.
- **The seam-miss branch is deleted** (clause 12). That branch was the store
  scan, `dedupeContainedForecasts`, a second `deriveAggregate` and its own ARPU
  weighting. Its only-reader helpers (`dedupeContainedForecasts`,
  `scopeContains`) went with it.
  - `deriveAggregate(` calls in FVA go **2 → 1**; the one left is the table's
    identity derivation.
  - `forecastStore.entries()` in FVA goes **1 → 0**.
- **The dead `accuracy` memo is deleted** (clause 12).

### The table (`buildCohortAccuracy`)

- The `resolveForecast` parameter type gains `leaves?`.
- The seam answer is kept whole (`seamEarly`). `coveredEarly =
  coveredLeafKeys(seamEarly, key, cohortActualsMap.keys())`.
- `effectiveActualMap` keeps a leaf iff `coveredEarly.has(key)`. This replaces
  the `cohortInScope` test against `matchingBfs`, whose one member was the row's
  own aggregate, so everything passed. The fallback to the whole row's
  `monthMap` when nothing is covered is gone.
- `CohortAccuracyRow` gains `coverage: { covered, total }`, where total is the
  leaves with actuals merged into the row. It is set on scored rows only; an
  unscored row keeps its em dash and nothing else.
- The Challenger calls the same builder, so it follows (A) with no code of its
  own (clause 11).

### The coverage line (clause 5)

- **Key:** `actuals_coverage_line`, in all six locales; **947 → 948 per
  locale**. Parity stays 203/203 and the allowlist is unchanged, because no
  translation equals English.

  | locale | text |
  |---|---|
  | en | Forecast covers {{covered}} of {{total}} cohorts |
  | de | Prognose deckt {{covered}} von {{total}} Kohorten ab |
  | es | La previsión cubre {{covered}} de {{total}} cohortes |
  | fr | La prévision couvre {{covered}} cohortes sur {{total}} |
  | it | La previsione copre {{covered}} di {{total}} coorti |
  | pt | A previsão cobre {{covered}} de {{total}} coortes |

- **Chart:** under the chart tabs (`actuals-coverage-line`).
  - The total counts the leaves with actuals under the view, using the shared
    `cohortInScope`.
  - "Covered" counts the covered leaves with actuals, so covered ≤ total.
  - While a row is selected it shows that row's coverage.
- **Table row:** under the row label (`cohort-coverage-<key>`).
- **Shown only when covered < total.**
- **The KPI cards are unchanged** this session (clause 4: GUARD 3 stands, and
  their line changes with the accuracy month in session 2).

The Challenger row button gained a testid (`challenger-group-<key>`) for case
(e). It has no visible change.

## 3. Mounted: `scripts/actuals-coverage-mounted-spec.tsx`, NEW, 39/39

**The fixture** is shaped as 1855's:

- 60 Corporate·Direct leaves fitted on the Dec2025 file (Holt Linear, 12
  months).
- The Jun2026 file as actuals (540 leaves).
- The real seam, `resolveFromStore`.

The fixtures are the local gitignored TariffHierarchy files. Every expected
figure is summed from the fixture's rows in the spec.

**(a) All/All, 2026-03**

| | actual | forecast |
|---|---|---|
| Inflow | **33,048** (covered; every leaf would read 299,034) | 33,136 |
| Base | **296,883** (covered; every leaf 2,685,136) | 298,891 |

**(b) Group-by Segment**

- The engine's own `buildCohortAccuracy` puts the Corporate row's 2026-03 Inflow
  at **actual 33,048, forecast 33,136, dev −0.27%, month score 93.7**.
- The row scores **Inflow 84.7** (the rendered cell equals the engine's label)
  and **overall 87.2**. At a497ff5 they were Inflow 0.0 and overall 38.3.
- SOHO, SME, Large Enterprise and MNC each show the em dash and no coverage
  line.

**(c) The coverage line**

- All/All reads "Forecast covers 60 of 540 cohorts".
- The Corporate row reads "… 60 of 108 …".
- **Corporate/Direct: no line** (60 of 60), and its chart compares the same
  33,048.

**(d) A seam miss**

- The case the deleted branch served is a selected row whose scope has no
  forecast while the view has one. With the SOHO row selected under All/All,
  the actuals are drawn (positive control), no forecast series has geometry,
  there is no coverage line and nothing crashes.
- A SOHO **view** mounts without a crash and draws no forecast. A view-level
  miss has no loaded forecast and therefore no months to chart. That was true
  at a497ff5 too, so the spec does not claim actuals there.

**(e) The Challenger flagged set**

- **Before**, at a497ff5 (the 1855 engine measurement, taken before any edit):
  **[Corporate]**, overall 38.3, below the threshold of 85.
- **After**, on screen: **[]**. Corporate scores 87.2.

**Structure (6 pins):**

- `coveredLeafKeys` is defined once, in `forecasting.ts`, with 3 FVA calls.
- `deriveAggregate(` appears once in FVA.
- `resolveForecast(` appears 4 times.
- The `accuracy` memo is gone.
- The chart has no store scan: `forecastStore.entries()` 0, `.values()` 1
  (summaryMape's pinned one).

One new first-row dereference (`tds[0].`) was guarded with `?.`, so survival
stays at 104 across 26 files and no baseline moved.

## 4. Re-aims and traps

### Re-aims, each seen RED first

Run on the built tree before any spec was touched:

```
unscored-row spec: 9 passed, 2 failed
  FAIL the ACCURACY table is on screen with cohort rows  [0 non-month rows]
  FAIL an UNSCORED row is on screen  [0 rows with four em-dash score cells]
leaf-grain spec: 11 passed, 3 failed
  FAIL SCORED rows exist at leaf grain — the declared gap is closed  [0 scored, 2 unscored of 2]
  FAIL CONTROL: the two runs differ — so scoring depends on the store, not the fixture
  FAIL DIAGNOSIS: a plain 7-part store scores leaf-grain rows just as well  [5-part store scored 0, 7-part-only scored 0]
base-seed spec: 30 passed, 1 failed
  FAIL WIRING: the aggregate seed is all-or-absent at the chart too  [one unseeded leaf no longer stops the aggregate line]
regression-traps: positive control failed: Corporate rows, which DO have forecasts, are not scoring either
challenger-render spec: 4 passed, 7 failed
  FAIL the challenger list is not empty  [no rows at all - every assertion below would pass over an empty set]
  (+ 6 more downstream of the empty list)
```

**The cause, in four of the five:** each spec's hand-written seam answered
"derived" without the `leaves` that App's seam (`resolveFromStore`) returns. The
covered set was therefore the aggregate key alone, and every row went
unscored.

- **unscored-row, challenger-render, regression-traps:** their derive branch
  now returns `leaves`, as App's does.
- **leaf-grain:** both of its resolvers are now `resolveFromStore` itself.
  - This also retires its 5-part fits as the app does, and its diagnosis still
    holds: 72 scored / 74 both ways.
- **base-seed:** it pinned
  `fcSeedKnown = matchFcs.length > 0 && matchFcs.every(...)`, a line inside the
  deleted branch. It is re-aimed to "the chart takes known-ness from the seam's
  answer only" (`fcSeedKnown = specificForecast.seedBaseKnown;` and no
  `matchFcs`). The seam's all-or-absent derivation is pinned by base-seed's
  DERIVE checks.
- **After the re-aims:**

  | spec | result |
  |---|---|
  | unscored-row | 19/19 |
  | leaf-grain | 17/17 |
  | base-seed | 31/31 |
  | regression-traps | 3 pass, 0 fail, 0 inconclusive |
  | challenger-render | 18/18 |

**The brief's list, against what happened:**

- **Did not go red:** `trigger-sets` 14/14 and `step3-transition` 17/17, so
  neither was re-aimed.
- **trap-anchors did not go red:** none of the 7 FVA-anchored traps' anchors
  sat on an edited line. It reads 292/292 (274 traps, 287 anchors) with 276-279
  registered.
- **Traps 9 and 10** (Case B) are unchanged and caught in the gate (section 5).
- **i18n-parity:** 203/203, with the new key named above.
- **GUARD 3** (`derive-aggregate` 75/75) stays green, as clause 4 requires.

### Traps 276–279, seen red by hand

Each: md5 before, backup, plant, `spec:actuals-coverage`, restore FROM THE
BACKUP, md5 after. FVA before and after is `d3fe60a60b6835d11f408b8f9125ce89`
for all four (restored identical).

| trap | planted md5 | tally | first red line |
|---|---|---|---|
| 276 the chart ignores `.leaves` | `71945a9908990e1142d3ec013b218836` | 37/39 | `(a) All/All 2026-03: the chart's actual Inflow is the COVERED sum (33048), not every leaf (299034)  [{"actual":299034,"forecast":33136}]` |
| 277 the table covers with the row's own aggregate | `c90d5fde39ad759c65d86ce5602a0616` | 36/39 | `(b) the engine scores the Corporate row's 2026-03 Inflow on the COVERED actual (33048), not all Corporate  [58284]` (and (e): Corporate back at 38.25, flagged) |
| 278 the line shows at full coverage | `44a1794449783953974f38ee0c29ba83` | 38/39 | `(c) Corporate/Direct: NO coverage line — 60 of 60 is complete  [Forecast covers 60 of 60 cohorts]` |
| 279 Base unrestricted | `f26af8e3da974ee39f698cdae4fb4ecc` | 38/39 | `(a) the Base actual is the COVERED Base (296883), not every leaf's (2685136) — clause 6` |

No green plant. All four are registered in `scripts/guard-traps.ts`, with
`ACTUALSCOV` added to `CONTROL_SPEC_MAP` alongside 276.

## 5. Gate

Run serially on the tree committed as `caec3ce`.

| check | result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean (exit 0) |
| `npm run build` | built |
| `spec:actuals-coverage` | 39 passed, 0 failed (new) |
| `spec:trap-anchors` | 292 passed, 0 failed (274 traps, 287 anchors) |
| `spec:i18n-parity` | 203 passed, 0 failed; 948 keys in each of en de es fr it pt (was 947); new key `actuals_coverage_line` |
| `spec:i18n-scan` | PASS |
| `spec:survival` | 27 passed, 0 failed; FIRST-ROW DEREFERENCES 104 across 26 files |
| `derive-aggregate` (GUARD 3) | 75 passed, 0 failed |
| `npm run suite` | **77/77 green** (76 + the new spec) |
| `npm run guard-traps -- --targeted` | **32/32 CAUGHT**, to a file |

The certification line, verbatim:

```
guard-traps targeted 32/32 CAUGHT (ids 9 10 11 12 48 49 50 275 276 277 278 279), rotation 20 (ids 1 2 3 4 5 6 7 8 13 14 15 16 17 18 19 20 21 22 23 24), NOT RUN 242, last FULL run 8079186 2026-09-17T10:58:18.253Z
```

Traps 276-279 and the Case B traps 9 and 10 each CAUGHT. All 23 harness TARGETS were backed up to `scratchpad/pre-gt60/` and md5'd before the run, and are identical after it. The ledger is committed WITH this report; the build commit `caec3ce` excludes it (and excludes the two uncommitted docs entries from section 0).

| count | measured |
|---|---|
| `coveredLeafKeys` definitions | 1 (3 calls in FVA) |
| `deriveAggregate(` calls in FVA | 1 (was 2) |
| `resolveForecast(` calls in FVA | 4 |
| last columns Market / Yield / Pricing | 6 / 4 / 4 (writers untouched; `forecasting.ts` gained the helper and one import only) |
| computeAdjustedForecast | 6 |
| eventScopeSeriesFor callers | 5 |
| solveForCohortTarget definitions | 1 |
| buildPromoEvents | 5 |
| resetYieldDraft() calls | 2 |
| handleDeleteCampaign callers | 3 |
| setPendingChange staging sites | 7 |
| campaignToggleState / handleSetEventEnabled / initiativeGroups / handleSetInitiative / handleDeleteInitiative definitions | 1 each |
| carryInitiative sites | 3 |
| writes of `{ initiative }` | 3 |
| initiativeKey definitions / layout / table reads | 1 / 2 / 2 |

## What was shed

Nothing. The table row's coverage line, the shed candidate, was built.

## Limits

- **Fixtures.** The fixtures are local and gitignored (as are all of this
  repo's `.xlsx`). The leaf fits come from a harness series builder, not the app
  worker, so the forecast digits are indicative; the actual sums and the
  restriction are exact.
- **The stored-broader-key cover** (section 2) is reachable only in the two
  harnesses. The app's seam never serves such a fit.
- **The no-filter fallback.** With no `activeFilter`, the chart falls back to the
  loaded `baseForecast` (Case B) and its actuals stay scoped by that forecast's
  cohort, as before. There is no seam answer to read leaves from there, and
  App always sets a Step 3 filter. Unchanged, not restricted.
- **The Challenger's own chart** (model comparison) still reads the row's full
  `monthMap`. Only its flagged set and scores follow (A) this session.
- **Absent product or channel columns.** On data with no product or channel
  column, `cohortActualsMap` writes `'—'` where a forecast key writes the
  value. That grain was not exercised.
