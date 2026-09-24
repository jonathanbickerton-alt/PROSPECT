# REQ-D7-01 session 2 — the accuracy month on Step 3

## FOR ADVISOR

```
Generated: 2026-09-24 12:18 +0100 (UTC 2026-09-24 11:18)
Certifies: f30f67fd2c04f8d5b8ff249cd08702030ee1f49f
Repo: committed f30f67f, pushed (origin in sync)
Clause 13 alone: 8b61c03. Skeleton 69d3bef. BASE NOT CLEAN (as 0838):
docs v3-3-18 D, v3-3-19 ??, yours, untouched and never staged.
NEVER-SHED MET: cards + table score EXACTLY the chosen month; default = the
latest month with BOTH for the VIEW (2026-06; 2026-05 when the view's
leaves stop at May while the file runs to June).
ONE select (accuracy-month-select, 1 testid site), Delta-month pattern:
state '' = latest, derived, no effect. Options = view forecast months n
monthsCarryingActuals n covered leaves' months. No new predicate.
buildCohortAccuracy + computeForecastMape: ONE appended param each. ONE
filter, two windows: scores/Bias/MAPE = the month; Trend = up to it.
2026-03 Corporate: 33,048 vs 33,136, dev -0.27%, score 93.67 = Inflow.
Cards: Inflow MAPE 0.6% (60-leaf average); "60 cohorts compared, Mar 2026".
Trend: 2026-06 worsening (6 pts); 2026-03 insufficient (3 pts).
Bias flip: NOT on Inflow (Under all 6 months); Inflow ARPU flips - Over
2026-05, Under 2026-01/06. Challenger at Product L1: 03 [] -> 06 [Corporate
Mobile Data, Corporate Mobile Voice]; at Segment [] both (95.6 / 87.2).
spec:accuracy-month NEW 32/32. Traps 280-282 RED by hand, restored.
Re-aims seen red: actuals-coverage (b)(e)(X), coverage-copy, trap 22.
Keys: +2 -1 -> 949 per locale. Nothing was shed.
guard-traps targeted 37/37 CAUGHT, rotation 20, NOT RUN 240 (line in s.5)
full suite:  78/78 green
```

## 0. Base

Quoted before any change:

- `git status --short` is **not empty**. It shows the same two entries as at
  1855 and 0838:
  ```
   D docs/PROSPECT-development-history-and-working-agreement-v3-3-18.md
  ?? docs/PROSPECT-development-history-and-working-agreement-v3-3-19.md
  ```
  These are yours and uncommitted. I left them untouched, and every commit
  names its paths.
- `git diff caec3ce HEAD --stat -- src`: empty.
- `git diff caec3ce HEAD --stat -- scripts`:
  `scripts/guard-traps-ledger.json | 224 +++++++++++++-----------` (the ledger
  only).

HEAD and origin/main were both `79ea281`. The skeleton `69d3bef` was the first
repo action.

## 1. Item 0 — record

Clause 13 was appended verbatim, committed alone as `8b61c03` and pushed
before any code.

## 2. Item 1 — the build (`ForecastVsActualsTab.tsx`)

### The months and the choice

- **`viewSeam`**, a memo holding the VIEW's seam answer whole.
  - `chartSeam` now returns it whenever no row is selected, so the chart's view
    call moved here rather than being added.
  - `resolveForecast(` in FVA stays **4**.
- **`accuracyMonthOptions`** is the view forecast's months, intersected with:
  - `monthsCarryingActuals(data, [wiDateCol], wiValueCol)`, the helper Step 2's
    Delta month reads;
  - the months the view's **covered** leaves hold actuals for, via
    `coveredLeafKeys` (its 4th call) and `cohortActualsMap`.

  They are chronological. This is per VIEW (clause 8), and uses Set
  intersections only, with no new predicate.
- **The choice** is `selectedAccuracyMonth` (`''` = not chosen). The month read
  is the choice while it is offered, else the latest. This is the Delta-month
  derived-default pattern: no effect writes it, so a remount resets it and a
  view change re-defaults it.
- **The select** is a native `<select>` (`id="accuracy-month"`,
  `data-testid="accuracy-month-select"`, one site at FVA:3026) above the KPI
  cards. Options are labelled with `monthLabel`, and the label is the new key
  `actuals_accuracy_month`.

### ONE parameter each, ONE filter

- `computeForecastMape(..., wiTariffL2Col, accuracyMonth?)`
  - The parameter is appended, so no positional move. `edge-fixture` and
    `derive-aggregate` stay green without a re-aim.
  - Each comparison row now carries its month. `withActuals` keeps the chosen
    month only.
  - `summaryMape` passes the month, and its averaging is unchanged.
- `buildCohortAccuracy(..., adjustedMeanMap?, accuracyMonth?)`, also appended.
  Beside `forecastMonths` there are now two windows:
  - `scoredMonths`: the chosen month only. The two score-detail loops, both
    Bias loops and MAPE read it.
  - `trendMonths`: every overlap month up to and including the chosen month.
    Both Trend loops read it.
  - Averaging downstream is unchanged, and so is `forecastMonths` for the Base
    actual map and the adjusted-mean map.
- **The Challenger** calls the same builder with the month (clause 11).
- **The chart** does not read the month (clause 2; pinned by the spec).

### The cards' line (clause 9)

Both card sites read `actuals_cohorts_compared_month`: "{{n}} cohorts
compared, {{month}}". With one month scored, the per-forecast sum counts
cohorts. The old key, `actuals_cohort_months_compared`, is retired from all six
locales; nothing in `src` reads it.

**Keys:** 948 + 2 − 1 = **949** per locale (en de es fr it pt, each measured).
Parity stays 203/203, and the allowlist is unchanged because no value equals
English.

| locale | `actuals_accuracy_month` | `actuals_cohorts_compared_month` |
|---|---|---|
| en | Accuracy month | {{n}} cohorts compared, {{month}} |
| de | Genauigkeitsmonat | {{n}} Kohorten verglichen, {{month}} |
| es | Mes de precisión | {{n}} cohortes comparadas, {{month}} |
| fr | Mois de précision | {{n}} cohortes comparées, {{month}} |
| it | Mese di accuratezza | {{n}} coorti confrontate, {{month}} |
| pt | Mês de precisão | {{n}} coortes comparadas, {{month}} |

## 3. Mounted — `scripts/accuracy-month-mounted-spec.tsx`, NEW, 32/32

This is a sibling of `spec:actuals-coverage` (39 + these would pass 60). It uses
the same 1855-shaped fixture (60 Corporate·Direct leaves fitted to 2025-12,
actuals over 540 leaves to 2026-06) and the real seam. Expected figures are the
engine's own answers (`buildCohortAccuracy` / `computeForecastMape` with the
month) or the fixture's rows.

- **(f)** The options are exactly `2026-01 … 2026-06`, and the default is
  **2026-06**.
- **(g)** Choose 2026-03.
  - **Engine:** the Corporate row scores ONE month, **actual 33,048 against
    33,136, dev −0.27%, month score 93.67**, and its Inflow score IS that
    93.67.
  - **On screen:** the Corporate Inflow cell reads 94.
  - **Cards:** the Inflow MAPE card reads **0.6%**, the per-leaf average for
    2026-03 over 60 leaves (0.60%). Its line reads **"60 cohorts compared,
    Mar 2026"**.
- **(h)** Trend keeps its up-to window.
  - On 2026-06 the Corporate Inflow Trend is **worsening** (Jan–Jun, 6 points)
    and the cell shows an arrow.
  - On 2026-03 it is **insufficient** (Jan–Mar, 3 points) and no arrow shows.
- **(i)** Bias follows the month. This was found, not assumed.
  - Corporate **Inflow never flips**: Under in all six months. Outflow is Over
    in all six; Retention and Base are Under in all six.
  - **Inflow ARPU flips**: Under Jan–Apr and Jun, **Over in 2026-05**. On
    screen the cell reads "93↑ Over" on 2026-05 and "84↓ Under" on 2026-01.
  - So the shed candidate was not needed: a flip exists.
- **(j)** Per view.
  - Every Corporate·Direct row for 2026-06 is withheld. The file still carries
    2026-06 through the other 480 leaves.
  - The options stop at **2026-05**, and the default is **2026-05**, not the
    file's 2026-06.
- **(k)** The Challenger follows the month.
  - At Group-by Segment the Corporate row clears 85 in both months (95.6 on
    2026-03, 87.2 on 2026-06), so the list is empty either way.
  - Grouped by Product L1, reached as a user does via "Review all cohorts
    anyway" → Product L1 → reset to threshold, the flagged set is **[]** on
    2026-03 and **[Corporate·Mobile Data, Corporate·Mobile Voice]** on 2026-06.
    The engine gives exactly the same sets. Their 2026-06 overalls are 80.3
    and 83.7.
- **Structure, 6 pins:**
  - one testid site;
  - `scoredMonths` and `trendMonths` each defined once;
  - 4 score/Bias loops plus MAPE on `scoredMonths`, 2 Trend loops on
    `trendMonths`;
  - both builder calls and the card MAPE pass the month;
  - the default is derived;
  - the chart memo never reads the month.

One new first-row dereference was guarded with `?.`, so survival stays at 104
across 26 files.

## 4. Re-aims and traps

### Re-aims, each seen RED first

```
actuals-coverage spec: 37 passed, 2 failed
  FAIL  (b) the rendered Corporate Inflow score IS the engine's (same label)  [76↓ Under↘ vs 85]
  FAIL  (X) the chart, its coverage count and the table all read it (3 calls)  [4]
coverage-copy spec: 27 passed, 8 failed
  FAIL GRAIN: the label says cohort-months, matching that sum  [label and grain disagree]
  FAIL GRAIN: both KPI card sites are keyed  [found 0]
  FAIL LOCALE en..pt: all new keys present  [actuals_cohort_months_compared]   (6 lines)
trap-anchors spec: 291 passed, 1 failed  (274 traps, 287 anchors)
  FAIL  trap 22 the cohort-months label loses its grain: anchor 1 still matches ForecastVsActualsTab.tsx  [ZERO — the anchor has aged out; the trap plants nothing]
```

- **actuals-coverage (b) and (e).** The rendered cell and the Challenger now
  follow the default month (2026-06). They are compared with the engine at that
  month, where the Corporate Inflow score is 76 and overall 87.2. (b)'s 2026-03
  detail still reads the all-months engine.
- **actuals-coverage (X).** The helper's calls go 3 → 4; the months memo is the
  4th reader. This is my own pin from 0838.
- **coverage-copy :48-67.** The grain pin now reads "the label says cohorts and
  names the month". The two-site count is on the new key. The key lists move
  the old key to DEAD and the two new keys to NEW.
- **Trap 22** is re-anchored on the new expression. It still strips the words
  off the number.
- **Not red, so not re-aimed:** `edge-fixture` 15/15, `derive-aggregate` 75/75
  (GUARD 3 included), and every other Step 3 spec: unscored-row, leaf-grain,
  trigger-sets, step3-transition, base-seed, regression-traps (3/0/0),
  challenger-render, deletions, nav-target, derived-interaction, cohort-scope.
- **After:** actuals-coverage 39/39, coverage-copy 35/35, trap-anchors 295/295
  (277 traps, 290 anchors).

### Traps 280–282, seen red by hand

For each trap: record the md5, back the file up, plant, run
`spec:accuracy-month`, then restore FROM THE BACKUP. FVA's md5 was
`289596dc38f528b296df1f78d1265660` before and after all three, so each was
restored identical.

**280: the default is the file's latest, not the view's.**
- Planted md5 `6ad93443d0ed4587120aeb95ae3b82f7`; spec 30/32.
- First red line: `(j) the view's months stop at 2026-05  [2026-01,2026-02,2026-03,2026-04,2026-05,2026-06]`

**281: the table scores every overlap month.**
- Planted md5 `50a2ee8d840b4ce480c2ffd7a72883c8`; spec 25/30.
- First red line: `(g) ENGINE: the Corporate row scores exactly ONE month on 2026-03  [2026-01,...,2026-06]`
- Also red: the Inflow score reads 84.68 against the month's 87.95, (i) and (k).

**282: Trend follows the chosen month alone.**
- Planted md5 `219398ab2a39ad5c78d248b338667601`; spec 30/32.
- First red line: `(h) ENGINE: on 2026-06 Trend has its 6 points (Jan-Jun) — not "insufficient"  [insufficient]`
- The screen shows `76↓ Under` with no arrow.

All three are registered in `scripts/guard-traps.ts`, and `ACCMONTH` joins
`CONTROL_SPEC_MAP` with trap 280.

## 5. Gate

Run serially on the tree committed as `f30f67f`.

| check | result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean (exit 0) |
| `npm run build` | built |
| `spec:accuracy-month` | 32 passed, 0 failed (new) |
| `spec:actuals-coverage` | 39 passed, 0 failed |
| `spec:trap-anchors` | 295 passed, 0 failed (277 traps, 290 anchors) |
| `spec:i18n-parity` | 203 passed, 0 failed; 949 keys in each of en de es fr it pt (was 948); new: `actuals_accuracy_month`, `actuals_cohorts_compared_month`; retired: `actuals_cohort_months_compared` |
| `spec:i18n-scan` | PASS |
| `spec:survival` | 27 passed, 0 failed; FIRST-ROW DEREFERENCES 104 across 26 files |
| `npm run suite` | **78/78 green** (77 + the new spec) |
| `npm run guard-traps -- --targeted` | **37/37 CAUGHT**, to a file |

The certification line, verbatim:

```
guard-traps targeted 37/37 CAUGHT (ids 9 10 11 12 21 22 48 49 50 275 276 277 278 279 280 281 282), rotation 20 (ids 25 26 27 29 30 32 33 34 35 36 37 38 39 40 41 42 43 44 45 46), NOT RUN 240, last FULL run 8079186 2026-09-17T10:58:18.253Z
```

Traps 280-282 and the re-anchored 22 each CAUGHT. All 23 harness TARGETS were backed up to `scratchpad/pre-gt61/` and md5'd before the run and are identical after it. The ledger is committed WITH this report; the build commit `f30f67f` excludes it and the two uncommitted docs entries.

| count | measured |
|---|---|
| `accuracy-month-select` testid sites | 1 in src (FVA:3026); the spec reads it at :196 and pins the count at :346-347 |
| `coveredLeafKeys` definitions | 1 (FVA calls 3 -> 4: the months memo) |
| `deriveAggregate(` in FVA | 1 |
| `resolveForecast(` in FVA | 4 (the view call moved into `viewSeam`) |
| last columns Market / Yield / Pricing | 6 / 4 / 4 (`forecasting.ts` untouched this session) |
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

Nothing. The shed candidate (i) was not needed, because a flip exists
(Inflow ARPU, 2026-05 against 2026-01/06).

## Limits

- The fixtures are local and gitignored. The leaf fits come from a harness
  series builder, so their forecast digits are indicative; the scores and
  months are the engine's own answers.
- **Months with no view.** With no `activeFilter`, there is no view seam, so no
  options and no select. The cards and table then score every overlap month, as
  before. App always sets a Step 3 filter.
- A selected row does not change the month list. The month is per view
  (clause 8), not per row.
- The Challenger's model-comparison chart still reads the full row (carried
  from session 1).
