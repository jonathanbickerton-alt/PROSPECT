# Docs session — REQ-D8-01 BigQuery data-source decisions recorded; minimum-history thresholds read

## FOR ADVISOR

```
Generated: 2026-11-06 13:17 +0000 (UTC 2026-11-06 13:17)
Certifies: the commit adding this report + test-data/EXPECTED.md (s.4)
Repo: committed in that commit, pushed (origin in sync)
full suite:  81/81 green. guard-traps not run (docs-only session).
Recorded: REQ-D8-01, 23 clauses verbatim, test-data/EXPECTED.md:10766
Step 0: tree clean bar this report; diff 92f9b0f -- src scripts EMPTY
Step 0: no REQ-D8 match; EXPECTED.md is test-data/EXPECTED.md (no root file)
Cites checked: EXPECTED.md:1629 read-time SETTLED, :1637 write-time REJECTED
NOT VERIFIED: clause 5's 23 Sep 18:39 save is not in test-data
THRESHOLDS (Item 2), all counted in MONTHS WITH DATA, not months in range:
(a) HW seasonal path needs >= 24 points (forecasting.ts:2583, :2639);
    below it, HW fits Holt Linear (trend only) and flags seasonalFallback
(b) SES, Holt Linear, Damped Trend, HW: none fits below 4 (:2613)
(c) below 4 no model fits (:2893): forecast null; message depends on path
"months with data" = months where inflow, outflow or retention is non-zero
  (App:2905, worker:503); gap months are listed, not filled
FINDING: Step 1's typed fit at App:2928 has no else - a null is silent
FINDING: the 4-month refusal (App:2795) is hard-coded English; its key
  error_not_enough_valid_data_points_to_generate_a_fo is unused
FINDING: auto-model also uses 4/6/12/24 bands (forecasting.ts:5046-5230)
Decisions for Jon: none new; clauses 9, 22 OPEN and 23 TBC as recorded
State: main; docs-only; nothing held.
```

No file under `src/` or `scripts/` changed. Python was not invoked. The
measurements below are reads of the source at HEAD `3fe520a`, whose `src` and
`scripts` are identical to `92f9b0f` (Step 0's diff was empty).

## 1. Step 0

- `git status`: on `main`, up to date with `origin/main`. The only entry was
  this session's own report skeleton (`?? reports/2026-11-06-1305-bigquery-decisions-recorded.md`),
  written first per CLAUDE.md. It is not committed separately, because the
  brief asks for EXPECTED.md and the report in one commit with nothing else.
- `git log -1 --format=%H`: `3fe520aca9b1d7d41a92f0b6239e80d265a22c6b`.
- `git diff 92f9b0f -- src scripts`: **empty** (0 lines).
- `grep -n "REQ-D8" EXPECTED.md`: there is no `EXPECTED.md` at the repo root
  (`No such file or directory`). The file is `test-data/EXPECTED.md`, and
  `grep -n "REQ-D8" test-data/EXPECTED.md` matched **nothing**. REQ-D8-01 is
  the number used, as briefed.

## 2. Item 1 — recorded

Appended to `test-data/EXPECTED.md` at line 10766 under "REQ-D8-01 —
BIGQUERY DATA SOURCE AND SAVES (Jon, 2026-11-06)": 23 numbered clauses,
wording verbatim (re-wrapped to the file's width). Every `s.N` reference
names the inventory report
`reports/2026-11-05-0830-bigquery-data-contract.md` inline, and a one-line
preamble says what `s.N` means.

**Cross-references checked against the repo**, before the append moved
nothing above them:
- `EXPECTED.md:1629` is "### SETTLED: aggregates are derived at READ time —
  2026-08-04"; `:1637` is "#### Why write-time was rejected — REJECTED, do not
  re-propose". Clause 15 cites both correctly.
- `s.1 rows 6–7`, `s.2`, `s.3`, `s.4`, `s.4.11`, `s.5` and `s.8` all exist in
  the inventory report with the content each clause relies on.

**Not verified:** clause 5's figures come from "the 23 Sep 2026 18:39 save",
which is not in `test-data/`. `test-data/Walks/` holds only the 01 Sep 2337
and 02 Sep 1633 saves. The figures are recorded as Jon stated them. They are
consistent in shape with the inventory's measurement of the 02 Sep save
(Actuals 9.04 MB of 15.2 MB at 12,112 rows, uncompressed).

## 3. Item 2 — minimum-history thresholds (figures for the report only)

**Grep used** (over `src/utils/*.ts` and `src/workers/forecasting.worker.ts`):
`MIN_[A-Z_]*(MONTH|HIST|POINT|SEASON|LEN)[A-Z_]*|(length|\.length|months|n|count|points|histLen|historyLength)\s*(<|<=|>=|>)\s*[0-9]+|insufficient|seasonalFallback|minHistory|minPoints|2 \* ?season|seasonLength|period \* 2|< ?24\b|< ?12\b`,
then `SEASONAL_MIN_POINTS`, the callers of `calculateBaseForecast(` and
`calculateHoltWinters(`, and the locale strings matching
`insufficient|at least|fewer than|history`. EXPECTED.md clause 3 is unchanged.

### What is counted
The series handed to the fitter is **one point per month that has data**, not
per month in range.
- **Forecast generation** (`calculateBaseForecast`: Step 1 at App:2740 and
  App:2928, bulk in forecasting.worker.ts:541, Challenger at App:3042, 3188 and
  3333): a month is kept only if its summed inflow, outflow **or** retention is
  non-zero (`.filter(e => e.inflow > 0 || e.outflow > 0 || e.retention > 0)`,
  App:2905, 2719, 3038, 3170; worker:503). A month with only Base rows, or with
  all three flows at zero, does not count.
- Gaps between months are recorded in `missingMonths` (forecasting.ts:2897-2909)
  but **not filled**, so a 30-month range with 20 months of data is 20 points.
- One-off-flagged months are substituted in place, not removed
  (`applyOneOffFlags` forecasting.ts:2410), so they still count.
- **The legacy Step 1 single-metric path** (`calculateHoltWinters`
  forecasting.ts:2682, called from App:2359-2624 and App:2792) counts distinct
  dates that have a row of the chosen metric, zero values included
  (App:2778-2790).

### (a) Holt-Winters falls back from the seasonal model below 24 points
- `const SEASONAL_MIN_POINTS = 24;` at forecasting.ts:2583. In
  `fitAndBuildBands`, `if (values.length < SEASONAL_MIN_POINTS)` (:2639) fits
  Holt's linear trend (`optimiseHW`, trend only) and returns
  `seasonalFallback: true` (:2646). From 24 points up, it runs the
  triple-exponential seasonal fit (:2650).
- The flag is per series (inflow, outflow, retention, ARPU); any one sets it
  on the forecast (forecasting.ts:3021-3025).
- **User-facing** (StandardForecastTab:1356-1362, amber): "**Holt-Winters
  requires at least 24 months of data** (two full seasonal cycles). One or
  more series for this cohort had fewer data points and fell back to Holt
  Linear automatically. The fitted parameters below reflect the Holt Linear
  model used for those series." (keys
  `baseline_holt_winters_requires_at_least_24_months_of_d`,
  `baseline_two_full_seasonal_cycles_one_or_more_series_f`).
- **A second use of 24**, for aggregates: forecasting.worker.ts:23 duplicates
  the constant as `SEASONAL_MIN_POINTS_WORKER = 24`. When more than half of an
  aggregate's leaves have fewer than 24 months (worker:312, :328), Step 1
  shows, at StandardForecastTab:1341-1352: "**Seasonality may be understated
  for this aggregate.** {n} of {total} constituent cohorts ({pct}%) have fewer
  than 24 months of history, so they cannot fit a seasonal pattern. …" Only
  the bold sentence is a key; the rest is hard-coded English.

### (b) SES, Holt Linear and Damped Trend fit from 4 points
`fitAndBuildBands` starts `if (values.length < 4) return null;`
(forecasting.ts:2613). That single gate applies to **all four** models: SES,
Damped Trend, Holt Linear and Holt-Winters, which reaches its fallback only at
4 or more. None of SES, Holt Linear or Damped Trend has a higher minimum of its
own. The legacy wrapper `fitHoltWinters` repeats the gate (`y.length < 4`,
forecasting.ts:2466). So the figure is **4 points** for every model.

### (c) Below 4 points nothing fits — and what the app shows
`calculateBaseForecast` returns null when the series has fewer than 4 months
(`if (sorted.length < 4) return null;` forecasting.ts:2893), or when any of the
three flow fits returns null (:2925). What the user sees depends on the path:

| Path | Shown | Text |
|---|---|---|
| Step 1, legacy single-metric series (App:2794-2796) | error banner | "Not enough valid data points to generate a forecast (need at least 4)." — **hard-coded English**. The locale key `error_not_enough_valid_data_points_to_generate_a_fo` ("… (need at least 4 months of data).") exists in six locales but **nothing uses it** |
| Step 1, earlier guard on raw rows (App:2314-2316) | error banner | "Not enough valid data points to generate a forecast." (hard-coded; counts filtered rows, < 2) |
| Step 1, typed `calculateBaseForecast` (App:2928-2939) | **nothing** — `if (bf) {…}` has no `else` | — |
| Bulk / aggregate generation (worker:541-566) | the leaf is skipped with reason `insufficient-history` (`classifySkip` forecasting.ts:2857) | skip reason `skip_reason_insufficient_history` "too few months to fit a model" (types/forecast.ts:173); results `standard_generate_result_skipped` "{{count}} could not be forecast — too little history. They are not included in the total:" (StandardForecastTab:1100); scope `standard_scope_blocked` "{{count}} cohorts have too little history to forecast" (:1075) and `standard_scope_blocked_by_unfittable` "The {{count}} remaining cohorts in this scope have too little history to forecast. The aggregate is summed from the rest." (App:2237); bulk drawer `bulkdrawer_skipped_insufficient_data` "skipped — insufficient data" (ManageBulkDrawer:444) |
| Bulk dialog, before the run (BulkGenerateModal:382) | caption | "… Combinations with fewer than 4 data points cannot be forecast and will also be skipped." |
| Seam on a view whose leaves all failed (forecasting.ts:4405) | the viewing bar's no-forecast reason | reason `insufficient-history` (rendered as above) |

### Also deciding on history length (recommendation, not fitting)
- **Auto-model** `analyzeAndRecommendModel` (forecasting.ts:5039):
  - fewer than 4 → SES, "Extremely limited history (fewer than 4 observations)…" (:5046-5049);
  - fewer than 6 → SES, "Short history of {{len}} months detected…" (:5191-5193);
  - seasonality is only tested from 12 points (:5118);
  - seasonal and 12–23 → Holt Linear, "…history is too brief for a full 24-month Holt-Winters cycle…" (:5195-5201);
  - seasonal and 24 or more → Holt-Winters (:5196-5199);
  - backtesting may override from 6 points, but never to HW below 24 (:5222-5229).
- **Auto-confidence** `analyzeAndRecommendConfidence` (forecasting.ts:5280)
  bands its advice at fewer than 4, fewer than 6, 6–11, and 12 or more
  (:5286, :5366-5398).
- These choose a model or a band width; they never refuse.

**For clause 3's later design:** the warning threshold is **24 months with
data** (seasonal) and the refusal threshold is **4 months with data** (any
model), where "with data" means a non-zero inflow, outflow or retention that
month.

## 4. Gate and repo

| Check | Result |
|---|---|
| `npm run suite` (to a file) | **81/81 green** — "81/81 green", exit 0 |
| guard-traps | not run — docs-only session, as briefed |

**Certifies / Repo.** The report cannot contain the hash of the commit that
adds it. That commit adds exactly `test-data/EXPECTED.md` and this report, and
is pushed; its hash is the one the advisor block's `Certifies:` line refers to.
