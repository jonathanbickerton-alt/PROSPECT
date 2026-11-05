# Read-only inventory — data ingest and persistence contract for a BigQuery backend

## FOR ADVISOR

```
Generated: 2026-11-05 08:39 +0000 (UTC 2026-11-05 08:39)
Certifies: 92f9b0f3f12cb10926f0fcc9010bbc2a327c6043 (inventory, src read)
Repo: committed 1161de6, pushed (origin in sync); this report follows alone
ENTRY/EXIT POINTS (8) - the app makes NO network calls and uses no storage:
IN  Upload Data drop  HomeTab:82 > handleFileUpload App:1876 > setData :1973
IN  same drop, session file sniffed > applyImportSaveWorkbook App:1947
IN  Import Save  HomeTab:109 > handleImportSaveFile App:1114 > App:713
IN  Import Actuals HomeTab:130 + FVA:3000 > App:322 > append App:424
IN  Compare (max 4) ScenarioCompare:392 > FileReader :98 > parser worker
OUT Export Session FVA:3014 + Overall:166 > exportSession App:441, 12 sheets
OUT Results export downloadExcel App:3399 <- Step 1 and Step 2 buttons
NONE fetch, localStorage, CSV, chart image; server.ts = /api/health only
FINDING: a save carries the DATA (Actuals sheet) + FITTED forecasts; no refit
FINDING: a restore needs no data file; it does NOT restore column mapping
FINDING: blank dimension read 4 ways: 'All', 'Unknown', '' (by reader, s.2)
FINDING: empty cell = ABSENT key today; BQ NULL/'' must map to absent (s.8)
FINDING: columns = keys of row 0 only; Applied_Flow_Rate_% dropped today
FINDING: yyyy-MM parsed as UTC, formatted local - shifts a month west of UTC
FINDING: no file control has a data-testid; status lines do (ingest-*)
FINDING: Compare bypasses runIngest: literal 200MB warns, never refuses
FINDING: re-importing a loaded actuals month appends duplicate rows
Seam: rows handed onward at App:1973 / App:343 / App:713 (s.8)
Decisions for Jon: none required by this inventory (s.9 lists open questions)
State: main, read-only; nothing held.
```

**Scope and limits.** Read-only. Every `file:line` is at the inventory commit
`92f9b0f`; the skeleton commit `1161de6` sits on top and changes only this
report, so the lines hold at HEAD too. Nothing under `src/` or `scripts/`
changed, no gate ran, no python was invoked. Measurements were taken with a
scratchpad Node script (`scratchpad/s190-inventory.mjs`) that reads with the
app's own SheetJS options. Fixture measurements are **working-copy**
measurements (the `.xlsx` files are untracked, `.gitignore:15`).

---

## 1. Every entry and exit point

**Grep patterns used** (over `src/**/*.ts(x)`):
- `XLSX\.(read|readFile|write|writeFile|utils\.(sheet_to_json|json_to_sheet|book_new|book_append_sheet|aoa_to_sheet|sheet_to_csv))`
- `new FileReader|readAsArrayBuffer|readAsText|readAsBinaryString|readAsDataURL|type="file"|type='file'|new Blob|createObjectURL|revokeObjectURL|\.download ?=|download=|runIngest\(|isSessionWorkbook\(|applyImportSaveWorkbook\(|new Worker|fetch\(|\.arrayBuffer\(\)|navigator\.clipboard|window\.open|toDataURL|html2canvas|saveAs\(|localStorage|sessionStorage|indexedDB`
- `runIngest|MAX_UPLOAD_BYTES|readWorkbook`, `downloadExcel`, `\.csv|text/csv|sheet_to_csv|toBlob|toPng`, `https?://`

**Results.** There is no `fetch`, no `Blob`, no `createObjectURL`, no download
anchor, no `localStorage`/`sessionStorage`/`indexedDB`, and no CSV or chart
export. Every write goes through `XLSX.writeFile` (SheetJS builds the download
itself). The only server code is `server.ts` (tracked, 55 lines): an optional
Express wrapper with `/api/health` and static serving — no data endpoints.

**No file control carries a `data-testid`.** The three ingest status lines do:
`ingest-routed` (App:4484), `ingest-notice` (App:4492), `ingest-loaded`
(App:4500).

| # | Direction | UI control (label key) | Trigger | Handler (file:line) | Read path |
|---|---|---|---|---|---|
| 1 | READ | Upload Data drop zone, `<input type="file" accept=".xlsx, .xls, .csv">` HomeTab:82 (`upload_data`, `drag_and_drop`, `up_to_max_mb`) | file chosen/dropped | `handleFileUpload` App:1876 → `runIngest` App:1912 → `readWorkbook` App:691 (`FileReader` App:692, `readAsArrayBuffer` App:698, `XLSX.read(…, {type:'array', cellDates:true})` App:694) → `sheet_to_json` per sheet App:1953 → `setColumns` App:1972, `setData` App:1973 | all sheets parsed; the data sheet is the one named `actuals` (case-insensitive) else sheet [0] |
| 2 | READ | same drop, when the file is a saved session | `isSessionWorkbook(wb.SheetNames)` App:1940 (true when BOTH `Metadata` and `Market_Events` exist, utils/ingest.ts:107) | routes to `applyImportSaveWorkbook(wb)` App:1947; line `app_routed_to_import_save` | as #3 |
| 3 | READ | Import Save button, `<input type="file" accept=".xlsx">` HomeTab:109 (`import_save`, caption `or_restore_session`) | file chosen | `handleImportSaveFile` App:1114 → `runIngest` App:1120 → `readWorkbook` → `applyImportSaveWorkbook` App:713 | 12 named sheets, see §4 |
| 4 | READ | Import Actuals, `<input type="file" accept=".xlsx, .xls">` at HomeTab:130 (`import_actuals`) and FVA:3000 (`common_import_actuals`) | file chosen | `handleImportActualsFile` App:322 → `runIngest` App:331 → `sheet_to_json(sheet [0])` App:343 → month picker (`setImportActualsState` App:403, `ImportActualsModal`) → `handleImportActualsConfirm` App:412 → `setData(prev => [...prev, ...toAppend])` App:424 | sheet [0] only |
| 5 | READ | Scenario Compare, `<input type="file" multiple accept=".xlsx">` ScenarioCompareTab:392 (`compare_load_session_file_max_4`) | files chosen | `handleFiles` ScenarioCompareTab:78 → `FileReader` :98 / `readAsArrayBuffer` :102 → `postMessage` to `workers/scenarioParser.worker.ts` → `XLSX.read(buffer, {type:'array', cellDates:false, sheets:[4 names]})` worker:31 | 4 sheets, see §5 |
| 6 | WRITE | Export Session (`common_export_session`) FVA:3014; Export to Excel (`common_export_to_excel`) OverallForecastTab:166 | button → `openExportModal` App:679 → `ExportFilenameModal` App:35/4942 (default name `app_prospect_forecast_save`; strips `\/:*?"<>\|`) | `exportSession(fileName)` App:441 → 12 × `book_append_sheet` → `XLSX.writeFile(wb, fileName + '.xlsx')` App:671 | — |
| 7 | WRITE | Step 1 Export to Excel (`common_export_to_excel`) StandardForecastTab:1204 → `standard_forecast.xlsx`; Step 2 Export (`whatif_export`) WhatIfTab:6727 → `market_events_adjusted.xlsx` | button | `downloadExcel(dataset, filename, metadata?)` App:3399: Date cells → `yyyy-MM`; sheet `Results` (+ `Parameters` if metadata) → `XLSX.writeFile` App:3422 | — |
| — | in-memory | bulk generation | — | `new Worker('./workers/forecasting.worker.ts')` App:4185 — compute only, no I/O boundary | — |

Downloads other than the session save: only #7 — the Step 1 forecast table
and the Step 2 adjusted chart data. Neither is read back by the app.

---

## 2. Baseline ingest contract (path #1)

### How a row is produced
`readWorkbook` App:691 → `XLSX.read(arrayBuffer, { type: 'array', cellDates: true })`
→ `XLSX.utils.sheet_to_json(sheet)` with **no options**. Consequences the
backend must reproduce:
- headers come from the sheet's first row, verbatim (no trimming, no case change);
- an **empty cell produces no key** — the property is ABSENT, never `null` or `''`;
- text cells are JS strings; numeric cells are JS numbers; Excel date-typed cells are JS `Date`s (`cellDates: true`); booleans are booleans.

**Hand-off:** App:1972-1973 `setColumns(Object.keys(jsonData[0]))`;
`setData(jsonData)`. Type: `useState<any[]>` (App:124) — effectively
`Array<Record<string, string | number | boolean | Date>>`. Downstream,
`buildCohortDataMap` (utils/forecasting.ts:4555) groups rows by the 7-part key
and adds `_parsedDate: Date` (type `PreAggRow`). If the file also has a
`Market_Events` sheet, its rows are read as events (App:1987-1995,
`marketEventFromRow(r, 'workbook')`).

**`columns` is the keys of ROW 0 only** (App:1971). In all three fixtures row 0
is a `Base` row with no `Applied_Flow_Rate_%`, so that column is missing from
`columns` (and from every mapping dropdown) today — measured.

### The column-mapping step
1. **Auto-detect** (effect App:1344-1383) on data load: each role takes the
   FIRST column, in `columns` order, whose name (lower-cased, non-alphanumerics
   stripped) contains a pattern, trying patterns in order. Only empty roles are
   filled.
2. **Metric identifiers** (effect App:1385-1393): from the distinct values of
   the metric column, substring match `inflow`, `outflow`, `base`, `retention`.
3. **Manual override**: Data Mapping drawer (`DataMappingDrawer`, opened from
   Step 1, button `common_data_mapping_and_segmentation`, StandardForecastTab:531;
   rows at DataMappingDrawer.tsx:176-218). **Tariff L1/L2 have no drawer
   control** — auto-detect only.
4. The mapping is **not saved** in a session (§4).

### Column table — what the baseline load reads (by role)

| Role (state) | Fixture header | Auto-detect patterns, in order | Req? | Type expected | Reader rule (file:line) |
|---|---|---|---|---|---|
| Date (`wiDateCol`) | `Month` | date, time, period, month; else column 0 | **required** | `"yyyy-MM"` string (all fixtures, measured); any `Date` or `new Date()`-parsable string is accepted | `new Date(v)`, row dropped if invalid (forecasting.ts:4568); months keyed `format(d,'yyyy-MM')` |
| Metric (`wiMetricCol`) | `IBRO_Scenario_Type` | ibro, scenario, type, metric, dimension, kpi, indicator; else column 1 | **required** | text; values `Inflow`, `Outflow`, `Retention`, `Base` | compared with `String(v)`; identifiers by substring (App:1388-1391) |
| Volume (`wiValueCol`) | `Subscriber_Volume` | subscriber, volume, subs, value, measure, amount, total; else column 2 | **required** | number | `Number(v) \|\| 0` (e.g. forecasting.ts:3557); "carries actuals" means not absent/null/'' and `Number(v) !== 0` (forecasting.ts:5490) |
| Revenue (`wiRevenueCol`) | `Monthly_Revenue_GBP` | revenue, gbp, monthly | optional | number | ARPU = revenue ÷ volume |
| ARPU (`wiArpuCol`) | — (none matches) | arpu, average revenue, revenue per | optional | number | used when revenue is unmapped |
| Segment (`wiSegmentCol`) | `Customer_Segment` | segment, category, region | optional | text | see blank rules below |
| Product L1 (`wiProductCol`) | `Product_L1` | product_l1, product level 1, productlevel1, product, item, sku | optional | text | " |
| Product L2 (`wiProductL2Col`) | `Product_L2_Value_Tier` | product_l2, product level 2, productlevel2, product_sub, productsub | optional | text | " |
| Channel L1 (`wiChannelCol`) | `Channel_Level_1` | channel_l1, channel level 1, channellevel1, channel, source, platform | optional | text | " |
| Channel L2 (`wiChannelL2Col`) | `Channel_Level_2` | channel_l2, channel level 2, channellevel2, channel_sub, channelsub | optional | text | " |
| Tariff L1 (`wiTariffL1Col`) | `tariff_tier_l1` | tariff_tier_l1, tariff tier l1, tariff_l1, tariff level 1, tarifflevel1 | optional | text | " |
| Tariff L2 (`wiTariffL2Col`) | `tariff_tier_l2` | tariff_tier_l2, tariff tier l2, tariff_l2, tariff level 2, tarifflevel2 | optional | text | " |

**Order matters for auto-detect.** `Subscriber_Volume` beats
`Avg_Subscribers_per_Customer` only because it comes first;
`Monthly_Revenue_GBP` beats `Annualised_Revenue_GBP` the same way.
**Not read by any live code:** `Customer_Volume`,
`Avg_Subscribers_per_Customer`, `Avg_Unit_Price_GBP`, `Annualised_Revenue_GBP`,
`Accounting_View`, `Refresh_Frequency`, `Simulation_Type`,
`Applied_Flow_Rate_%`. They are carried in `data` and written to the save's
Actuals sheet, but nothing reads them. (`wiCustomerCol` auto-detects to
`Customer_Segment` via the `customer` pattern, but it has no reader. The legacy
`dateCol`/`targetCol`/`segmentCol`/`productCol`/`channelCol` set has no live
reader either; `dataTypeCol` feeds only the dead `vsActualsData` memo at
App:3559, which nothing reads.) Apart from the auto-detect patterns, no
fixture header is hard-coded in live code; the hits at App:3568 and
App:3646-3669 are inside that dead memo.

### How 'All', blank and null are read — by reader (the same cell means different things)

| Reader (file:line) | Segment / Product L1 / Channel L1 | L2s and tariffs | null / absent |
|---|---|---|---|
| `buildCohortDataMap` forecasting.ts:4570-4576 (the store / seam key) | `String(v \|\| 'All').trim()`: blank → **'All'** | `String(v \|\| '').trim() \|\| 'All'`: blank or whitespace → **'All'** | → 'All' |
| Step 3 actuals map, FVA:1766-1772 | `\|\| 'Unknown'`: blank → **'Unknown'** | `\|\| 'All'` | → 'Unknown' / 'All' |
| Pro-rata weights `buildProRataLeaves` forecasting.ts:3547-3553 | `String(v ?? 'All').trim()`: '' stays **''** | same | → 'All' |
| Filter trees App:1765-1819 | `\|\| ''` then trim (blank values skipped) | same | → '' |
| Step 1 chart StandardForecastTab:372-386 | `?? ''` | same | → '' |
| Remove Actuals RemoveActualsModal.tsx:52-119 | `\|\| ''` | — | → '' |

**'All' is the app's wildcard**, not a value: `cohortInScope` treats `'All'`
as "unconstrained". A data row whose dimension literally holds `'All'` would be
read as an aggregate. No fixture row contains `'All'` or `''` in any column
(measured).

**Fixture row counts (measured today, sheet `Fact_IBRO`, 19 columns):**
trimmed `VBU_IBRO_Trimmed_TariffHierarchy_Jan2023_Jun2026` = **12,432** rows;
edge `VBU_IBRO_EdgeCases_ShortHistory_PerScenarioARPU_Jan2023_Jun2026` =
**12,112**; full TariffHierarchy Jun2026 = 90,720. All have 42 months
(2023-01 … 2026-06), 5 segments, 4 Product L1, 3 Product L2, 2 Channel L1,
9 Channel L2, 5 Tariff L1, 2 Tariff L2, and metric values Base / Inflow /
Outflow / Retention. `Applied_Flow_Rate_%` is absent on every Base row
(3,108 trimmed, 3,028 edge).

**Fixture header order (all three):** `Month, Customer_Segment, Product_L1,
Product_L2_Value_Tier, tariff_tier_l1, tariff_tier_l2, IBRO_Scenario_Type,
Channel_Level_1, Channel_Level_2, Subscriber_Volume, Customer_Volume,
Avg_Subscribers_per_Customer, Avg_Unit_Price_GBP, Monthly_Revenue_GBP,
Annualised_Revenue_GBP, Accounting_View, Refresh_Frequency, Simulation_Type,
Applied_Flow_Rate_%`.

**Date hazard (reasoned, not measured here).** `"yyyy-MM"` strings are read by
`new Date(v)`, which ECMAScript parses as **UTC midnight**, and are then
formatted with `date-fns format(…, 'yyyy-MM')` in **local** time. West of UTC,
`"2023-01"` becomes 2022-12-31 local, i.e. `"2022-12"`. It could not be measured
here: node on this machine ignores `TZ` (every zone reported offset 0).

---

## 3. Actuals ingest contract (path #4)

- **Same schema as the baseline.** Selected rows are appended to the SAME `data`
  array (App:424) and read through the SAME mapped columns. No remapping
  happens at import, so the actuals headers must equal the baseline's mapped
  headers. `columns` gains any new headers (App:426-429).
- **Sheet:** always sheet [0] (App:342). There is no name lookup, unlike the
  baseline path.
- **Date column:** `wiDateCol` if the file has it, else the first header
  matching date / time / period / month, else header 0 (App:348-357). Rows
  whose date is absent or invalid are skipped.
- **Value column:** `wiValueCol` if present, else the first of
  `Subscriber_Volume`, `Subscriber Volume`, `Value`, `value`, `Volume` (App:380-381).
- **Month picker:** `ImportActualsModal`. Months already carrying actuals are
  flagged and start unticked (ImportActualsModal.tsx:20), but the user can tick
  them, and the confirm step (App:412-430) **does not dedupe**, so the month's
  rows are appended twice (found by reading the code; not exercised).
- **"Already loaded" rule:** `monthsCarryingActuals(data, [wiDateCol, dateCol], valueCol)`
  (App:392, forecasting.ts:5466): a month counts when some row has a valid date
  and a value that is not absent, null, '' or 0. A zero means "no actual".
  The same helper feeds Step 3's accuracy months (FVA:2134) and Step 2's delta
  month (WhatIfTab:6176).
- **Matching to the cohort:** there is no matching step at import. Step 3
  groups all `data` rows by 7-part key (FVA:1754-1772, with the 'Unknown' rule
  above).
- **REQ-D7-01 coverage:** `coveredLeafKeys(seam, key, actualKeys)`
  (forecasting.ts:4483) keeps an actuals leaf only if its key exactly equals
  one of the forecast's leaf keys, or falls in scope of one (`cohortInScope`).
  The chart, the coverage line and the accuracy table use covered leaves only.
  **So actuals rows must carry dimension strings identical (after trim) to the
  baseline rows the forecasts were fitted from.** A differently-spelt segment
  is uncovered and silently unscored.
- **Accuracy months** (FVA:2131-2140) are the view forecast's months that carry
  actuals AND are held by a covered leaf.

---

## 4. The session save, sheet by sheet

**Writer:** `exportSession` App:441-675 (one workbook, 12 sheets, in this
order). **Reader:** `applyImportSaveWorkbook` App:713-1104. **Placeholder
rule** (every optional sheet): a sheet that would be empty is written as one
row `{ Note: '<sentence>' }`, and `isPlaceholderSheet` (sheetGuards.ts:37)
reads exactly that shape back as "no rows". **Required sheets**
(App:736-747): Actuals, Baseline_Forecasts, Market_Events,
Adjusted_Forecasts, Bulk_Generation_History, Model_Acceptance_Log, Metadata —
plus a non-empty Metadata `PROSPECT_Version` (App:752). Absent columns default
as stated per sheet. "Added" dates are each column's first appearance in git
history (`git log -S"<col>:" --reverse` over App.tsx and forecasting.ts);
`2026-03-30` is the repository's initial commit, i.e. original.

### 4.1 `Actuals` (App:446-465) — the whole `data` array
The columns are whatever the uploaded file had, in row order. The mapped date
column is rewritten as `yyyy-MM` text; strings are cut at 32,000 characters.
Placeholder: `No actuals data loaded`. **Reader** App:766-770: if not a
placeholder, `setData(rows)` and `setColumns(keys of row 0)`. The mapping is
not saved: it is re-derived by auto-detect, and only for roles still empty in
the browser session (so a mapping left from an earlier file in the same tab
persists).

### 4.2 `Baseline_Forecasts` (App:467-535) — one row per cohort × forecast month, every forecast in the store
Reader App:775-990 (new format: `Source === 'ForecastStore'`; the legacy
`Typed BaseForecast` and Cohort_Key-only formats are also read).

| # | Column | Type / values | Reader default when absent | Added |
|---|---|---|---|---|
| 1 | Cohort_Key | 7-part key `seg\|prodL1\|prodL2\|chanL1\|chanL2\|tarL1\|tarL2` | row skipped if blank; the store key is rebuilt from the dims | original |
| 2 | Is_Active | `Yes`/`No` | not active | 2026-06-18 |
| 3 | Source | `ForecastStore` | selects the reader branch | original |
| 4-10 | Segment, Product, Product_L2, Channel, Channel_L2, Tariff_L1, Tariff_L2 | text; `All` = unconstrained | `'All'` | original; Tariff 2026-07-06 |
| 11 | Scenario | text (`Base Case` …) | `'Standard Forecast'` | original |
| 12 | Model_Used | model name; '' for derived | '' → `Holt Linear` (App:1438) | original |
| 13 | Provenance | `fitted` / `derived` / `accepted` | '' → `fitted` | 2026-08-04 |
| 14 | Leaf_Count | number; '' unless derived | 0 | 2026-08-04 |
| 15 | Seed_Base_Volume | number | 0 | original |
| 16 | Seed_Base_Known | boolean | falls back to "is Seed_Base_Volume a finite number" | 2026-08-10 |
| 17 | Historical_Months | `"yyyy-MM, yyyy-MM, …"` | [] (only yyyy-MM tokens kept) | original |
| 18-19 | Last_Historical_Inflow / _Outflow | number | 0 | original |
| 20 | Seasonal_Fallback | `Yes`/`No` | No | 2026-06-18 |
| 21 | Fitted_Params_JSON | JSON or '' | none (ignored for derived) | 2026-06-18 |
| 22-25 | Pre_Horizon_Uncertainty_Pct, Post_Horizon_Expansion_Rate_Pct, Confidence_Horizon_Months, Forecast_Length_Months | number | **write-only** (not read) | original |
| 26-27 | Bulk_Run_Name, Bulk_Run_Comment | text | write-only | original |
| 28 | Generated_At | `dd MMM yyyy HH:mm` or '' | feeds the generation log only | original |
| 29 | Month | `yyyy-MM` | `String(undefined)` | original |
| 30-41 | {Inflow, Outflow, Retention, ARPU}_{Mean, Optimistic, Pessimistic} | number (ARPU bounds may be '') | 0 | original |
| 42-53 | {InflowARPU, OutflowARPU, RetentionARPU, BaseARPU}_{Mean, Optimistic, Pessimistic} | number or '' | band omitted if Mean is '' or null | 2026-06-18 |

The reader also reads `Replaced_Model` and `Accepted_At` (App:1442-1443),
**which no writer emits**: an `accepted` forecast reloads with
`replacedModel = modelUsed` and `acceptedAt = ''`.

### 4.3 `Market_Events` (writer `marketEventExportRow` forecasting.ts:373, sorted by Sequence; reader `marketEventFromRow(r,'session')` forecasting.ts:1758 + `readStoredEventModifiers` forecasting.ts:1623; placeholder `No market events defined`)

| Column (in order) | Type / allowed | Default when absent | Added |
|---|---|---|---|
| ID | text | `ID ?? Name`, else a random id (`eventRowId` forecasting.ts:1243) | original |
| Sequence | int | backfilled in sheet order | 2026-08-01 |
| Name | text | '' | original |
| Campaign_Name | text | `Campaign_Name \|\| Name \|\| ''` | 2026-07-03 |
| Scenario | `Inflow`/`Outflow`/`Retention`/`ARPU` | **none** (passed through) | original |
| Segment, Product | text | **none** (passed through) | original |
| Product_L2, Channel_L2 | text | 'All' | 2026-06-18 |
| Channel | text | **none** | original |
| Tariff_L1, Tariff_L2 | text | 'All' | 2026-07-06 |
| Start_Month | `yyyy-MM` | '' | original |
| Subscriber_Volume, Customer_Volume, Revenue, ARPU | number (signed) | 0 | original |
| Contract_Length_Months | int | 24 | original |
| Comment | text | '' | original |
| Amount_Type | `absolute`/`percentage` | absolute | 2026-08-01 |
| Percentage_Basis | `baseline`/`adjusted`/'' | baseline | 2026-08-01 |
| Retention_Linked | `Yes`/`No` | Yes | 2026-08-01 |
| Is_Promotion, Promo_Rebanded | `Yes`/`No` | No | 2026-07-10 |
| Promo_Mix_Axis | `value`/`tariff`/'' | absent | 2026-07-10 |
| Promo_Mix_JSON | JSON object or '' | absent | 2026-07-10 |
| Promo_Pricing_Mode | `percentage`/`absolute`/`dilution`/'' | absent | 2026-07-10 |
| Promo_Pricing_Amount | number or '' | absent | 2026-07-10 |
| Promo_Dilution_Current_Pct, Promo_Dilution_Target_Pct | number or '' | absent | 2026-09-04 |
| Promo_Mix_Locked | JSON array or '' | no locks | 2026-09-03 |
| Arpu_Override | number or '' ('' ≠ 0) | absent | 2026-08-12 |
| Promo_Band_ARPU_Override_JSON | JSON map or '' | absent | 2026-08-13 |
| Churn_Mode | `churn`/'' | absent | 2026-08-20 |
| Churn_Target_Pct, Churn_Current_Pct, Churn_Prev_Base | number or '' | absent | 2026-08-20 |
| Enabled | `Yes`/`No` | on | 2026-09-06 |
| Tariff_Scope | JSON string array or '' | all tariffs | 2026-09-09 |
| Hold | `Yes`/`No` | No | 2026-09-10 |
| Mode | `Ramp`/`Spread` | Ramp if Hold=Yes else Spread (`modeFromRow` forecasting.ts:1605) | 2026-09-11 |
| Tariff_ARPU_Basis | `Forecast`/`Historical`/'' (only with a promo mix) | Historical | 2026-09-16 |
| Initiative | text or '' | none | 2026-09-16 |

### 4.4 `Adjusted_Forecasts` (writer `adjustedForecastSheetRows` forecasting.ts:4432; placeholder `No market events applied — adjusted forecast not available`)
Step 2's run for the view it last ran, or the rows a loaded session carried in
(verbatim), else the placeholder. Columns: `Segment, Product, Product_L2,
Channel, Channel_L2, Scenario, Month, Inflow_Baseline, Inflow_Adjusted,
Outflow_Baseline, Outflow_Adjusted, Retention_Baseline, Retention_Adjusted,
ARPU_Baseline, ARPU_Adjusted, Applied_Event_IDs` (`'; '`-joined). **No tariff
columns.** Reader App:1049-1050 keeps the rows verbatim (`carriedAdjustedRows`)
and never interprets them. No other reader exists (Compare does not read this
sheet).

### 4.5 `Bulk_Generation_History` (App:559-577; reader App:1059-1076)
`Run_ID` (random id if absent), `Run_Name` (''), `Comment` (''), `Timestamp`
(`dd MMM yyyy HH:mm`), `Model` (`Holt Linear`), `Pre_Horizon_Uncertainty_Pct`
(0), `Post_Horizon_Expansion_Rate_Pct` (0), `Confidence_Horizon_Months` (3),
`Forecast_Length_Months` (24), `Cohorts_Generated` (0), `Cohorts_Failed` (0),
`Cohort_IDs` (`'; '`-joined keys, cut at 32,000 characters). All original.

### 4.6 `Model_Acceptance_Log` (App:580-591; reader App:1080-1089)
`Cohort_Key`, `Previous_Model`, `Accepted_Model`, `Switchover_Month`
('' → null), `Date_of_Switch` (`dd MMM yyyy HH:mm`). All '' when absent. Original.

### 4.7 `Yield_Events` (writer `yieldEventExportRow` forecasting.ts:1844; reader `yieldEventFromRow` forecasting.ts:1907; optional sheet, read only if present)
`ID` (eventRowId), `Name` (''), `IBRO` (`Inflow`/`Retention`; default Inflow),
`Segment`, `Product`, `Channel_L1`, `Channel_L2` ('All'), `Month` (''),
`Roll_Forward` (`Yes`/`No`), `Mix_Axis` (`value`/`tariff`; 2026-07-07),
`Tariff_Mix_JSON` and `Tariff_Base_ARPU_JSON` ({} on parse error),
`Tariff_Mix_Locked` (2026-09-03), `Tariff_Base_ARPU_Override_JSON` ('' =
absent; 2026-08-12), `Comment`, `Enabled` (2026-09-06), `Tariff_Scope`
(2026-09-09), `Tariff_ARPU_Basis` (`Forecast`/`Historical`; default Historical;
2026-09-16), `Initiative` (2026-09-16). The sheet itself dates from 2026-06-18.

### 4.8 `Pricing_Events` (writer `pricingEventExportRow` forecasting.ts:1482; reader `pricingEventFromRow` forecasting.ts:1551; optional)
`ID`, `Name`, `Segment`/`Product`/`Product_L2`/`Channel_L1`/`Channel_L2`/
`Tariff_L1`/`Tariff_L2` ('All'), `Month` (''), `Input_Mode`
(`percentage`/`absolute`; default percentage), `Amount` (0), `Target`
(`cohorts`/`cohorts+base`/`base-only`; default cohorts), `Cohort_Scope`
(`inflow`/`retention`/`both`; default both), `Duration` (`one-off`/`recurring`;
default one-off), `Original_Base_ARPU` (0), `Pricing_Mode` (`dilution`/'';
2026-07-10), `Dilution_Current_Pct`/`Dilution_Target_Pct` ('' = absent;
2026-08-17), `Priced_Vol`/`Total_Vol` ('' = absent; 2026-08-18), `Comment`,
`Enabled`, `Tariff_Scope`, `Contract_Length_Months` (`\|\| 24`), `Initiative`.

### 4.9 `One_Off_Months` (App:614-632; reader App:1020-1036; optional; sheet since 2026-07-24)
`Segment, Product, Product_L2, Channel_L1, Channel_L2, Tariff_L1, Tariff_L2`
('All'), `Month` (''), `Reason` ('').

### 4.10 `Tariff_Selection` (App:635-638; reader App:1038-1045; optional; since 2026-07-07)
`Tariff_L1` (one row per selected tariff); `{Note}` rows and blanks are dropped.

### 4.11 `Metadata` (App:640-669) — `Field` / `Value` rows, in this order

| Field | Value | Read on load? |
|---|---|---|
| Export_Timestamp | `dd MMM yyyy HH:mm` | yes — success banner (App:760) |
| PROSPECT_Version | `1.0.0` | **required**, non-empty (App:752) |
| Active_Step | `home`/`standard`/`whatif`/`overall`/`vsactuals` | yes; anything else → `home` (App:1095) |
| View | 7-part key (`viewMetaRow` viewFilter.ts:467; added 2026-09-25) | yes; absent / malformed → All/All (viewFilter.ts:473) |
| Active_Cohort_Segment … _Tariff_L2 (7 rows; omitted when nothing is active; 2026-08-18) | text, `All` kept | yes (`readActiveCohortMeta` forecasting.ts:596); absent → falls back to the Is_Active row, else the first stored forecast |
| Forecast_Period_Start / _End | `yyyy-MM` | write-only |
| Baseline_Cohorts, Market_Events, Yield_Events, Pricing_Events, Selected_Tariffs, Bulk_Runs, Model_Switches | counts | write-only |
| Pre_Horizon_Uncertainty_Pct, Post_Horizon_Expansion_Rate_Pct, Confidence_Horizon_Months, Forecast_Length_Months | numbers | **write-only** — a restore does not restore these settings |

### 4.12 Answers
**(a) What Import Save needs.** The seven required sheet names; a Metadata
sheet with a non-empty `PROSPECT_Version`; and non-placeholder `Actuals` and
`Baseline_Forecasts` rows for anything useful to appear. The four optional
sheets are read only when present.

**(b) Does the save carry the fitted forecasts?** **Yes.** Every forecast in
the store, every month, all four flows and the four per-scenario ARPU bands,
plus provenance, model, fitted parameters (JSON), seed and historical months.
A restore rebuilds the forecasts without re-running a model. It also carries
the events, the last adjusted run (carried verbatim), bulk history, the model
log, one-offs, tariffs and metadata.

**(c) Does a restore need the original data file first?** **No.** The
`Actuals` sheet carries the whole `data` array — 12,112 rows in the save below,
the edge fixture's count — and the restore sets `data` from it. What it does
not carry is the column mapping or the Metadata settings above.

**Sizes — the most recent save in test-data:** `test-data/Walks/PROSPECT
Forecast Save — 02 Sep 2026 1633.xlsx`, 15,209,738 bytes, md5
`114daed2bfe429a5426bf7c68d39af42`. SheetJS writes it **uncompressed**
(`Stored`, 0% in `unzip -lv`), so the bytes below are as written:

| Sheet | Data rows | Bytes (sheet XML) | Columns |
|---|---|---|---|
| Actuals | 12,112 | 9,044,195 | 19 |
| Baseline_Forecasts | 1,728 (72 cohorts × 24 months) | 6,114,454 | 53 |
| Market_Events | 1 | 2,925 | 34 |
| Adjusted_Forecasts | 24 | 15,278 | 16 |
| Bulk_Generation_History | 1 | 7,192 | 12 |
| Model_Acceptance_Log | placeholder | 552 | 1 |
| Yield_Events | placeholder | 529 | 1 |
| Pricing_Events | placeholder | 531 | 1 |
| One_Off_Months | placeholder | 531 | 1 |
| Tariff_Selection | placeholder | 525 | 1 |
| Metadata | 23 | 2,697 | 2 |

This file predates nine Market_Events columns (Promo_Dilution_Current_Pct …
Initiative) and the Metadata `View` row, so the column ORDER in this report is
the current writer's, not that file's. Actuals plus Baseline_Forecasts are
99.8% of the sheet bytes (15,158,649 of 15,189,409).

---

## 5. Scenario Compare

**Reads** (worker:31-50, `cellDates: false`, sheets restricted to these four):
`Baseline_Forecasts`, `Market_Events`, `Yield_Events`, `Pricing_Events`.
A missing sheet or a placeholder gives `[]` (`rowsOrEmpty`). It derives
segments, products and channels from Baseline_Forecasts. **It does not read**
Actuals, Metadata, Adjusted_Forecasts, One_Off_Months, Tariff_Selection, Bulk
history or the model log.

**Shared with Import Save:** `isPlaceholderSheet`/`rowsOrEmpty`
(sheetGuards.ts); for the per-file events panel, `buildPerFileEventPanels`
(forecasting.ts:1459) uses the same `marketEventFromRow(r, 'session')`,
`yieldEventFromRow` and `pricingEventFromRow`; plus `tariffScopeFromRow`,
`isEventOn` and `eventRowId`.

**Its own:** the worker's parse (not `readWorkbook`, no `runIngest`), and the
chart engine `computeScenarioForFilter` (scenarioHelper.ts), which reads RAW
sheet columns directly. From Baseline_Forecasts: Segment, Product, Product_L2,
Channel, Channel_L2, Tariff_L1, Tariff_L2, Month, Inflow_Mean, Outflow_Mean,
Retention_Mean, ARPU_Mean, Seed_Base_Volume, Last_Historical_Inflow/_Outflow,
Cohort_Key. From the event sheets: ID/Name, Start_Month/Date/Month, Scenario,
Subscriber_Volume, Amount_Type, Percentage_Basis, Retention_Linked,
Contract_Length_Months, Tariff_Scope, Enabled; IBRO, Roll_Forward and the
channel columns for yield; Input_Mode, Amount, Target, Cohort_Scope and
Duration for pricing.

**A "pick up to four saved sessions" source must supply, per session:** a
stable label (today `fileName`, which is also the session's key in Compare's
state), and the four row arrays above with the same column names and the same
value types as the save writes. Placeholders may come as `[]`. Nothing else is
read.

---

## 6. File-specific behaviour

| Behaviour | Where | Locale keys (en) |
|---|---|---|
| Size limit `MAX_UPLOAD_BYTES = 200*1024*1024` | utils/ingest.ts:32; used by paths 1, 3, 4 through `runIngest` (ingest.ts:167) | refusal `app_file_too_large`: "{{p0}} is {{p1}} MB. The limit is {{p2}} MB." |
| Pre-parse notice (shown, then two `requestAnimationFrame`s before the parse) | ingest.ts:70, 125-131 (`nextPaint`), 167; `ingest-notice` App:4492 | `app_reading_notice`: "Reading {{p0}} ({{p1}} MB) — large files usually take under 15 seconds; the page will not respond until it finishes." |
| Parse-time line (measured `read` wall time) | ingest.ts:85; `ingest-loaded` App:4500 (path 1 only) | `app_loaded_rows`: "Loaded {{p0}} rows in {{p1}} s" |
| Session routing on the drop | ingest.ts:107; App:1940-1948; `ingest-routed` App:4484 | `app_routed_to_import_save`: "This is a saved PROSPECT session — opening it with Import Save." |
| Drop-zone captions | HomeTab:78-104 | `upload_data` "Upload Data"; `drag_and_drop` "Drag and drop or click to upload Excel File"; `processing` "Processing..."; `up_to_max_mb` "Up to {{p0}}MB (.xlsx, .xls, .csv)" (p0 = `MAX_UPLOAD_MB`); `or_restore_session` "Or restore a previous session:"; `import_save` "Import Save"; `import_actuals` / `common_import_actuals` "Import Actuals" |
| Import Save validation | App:736-757 | `app_import_missing_sheets` "Not a recognised PROSPECT save file — missing sheets: {{sheets}}."; `app_import_missing_version` "… missing PROSPECT_Version in Metadata." |
| Compare's own limits (no `runIngest`) | ScenarioCompareTab:82-93 | literal 4-file cap (alert, hard-coded English); **literal** 200MB total that only WARNS (hard-coded English); `compare_load_session_file_max_4`, `compare_processing`, `compare_upload_multiple_session_files_to_compare_thei` |
| Hard-coded English errors | App:338, 376, 406, 1919, 1999 | e.g. "Error reading file. Please ensure it is a valid .xlsx or .xls file."; "Could not detect any valid dates in the file." |
| Export | App:35-75, 4942-4947 | `common_export_session`, `common_export_to_excel`, `app_prospect_forecast_save` "PROSPECT Forecast Save — {{p0}}", `app_full_save_point_7_sheets_including_actuals_fo` (says 7 sheets; the writer writes 12) |

---

## 7. Tests and fixtures by entry point

No spec mounts App (ingest-spec's header says why). Every spec that needs data
reads the fixture itself (`XLSX.read(fs.readFileSync(path))`) and hands the
rows to engines or mounted tabs, so specs bypass the entry points.

| Entry point | Specs | Fixture(s) | Needs a stubbed source if the entry became HTTP? |
|---|---|---|---|
| Baseline rows (path 1), consumed downstream | aggregate-retire, base-seed, chart-scope, deletions, derive-aggregate, derived-interaction, edge-fixture, generate-missing, leaf-grain, trigger-sets, walk-fixes, bulk-completion, null-render, step1-panel, step1-selection, step2-unlock, step3-transition, unscored-row (edge); arpu-basis, campaign-delete, challenger-render, churn-hold, d5-05-held, hold, initiatives, mix-card, override-arpu, promo-cohort-target, promo-hold, regression-traps, spread-ramp-promo, spread-ramp-volume, value-cohort-target, value-padlock (trimmed); accuracy-month, actuals-coverage, one-view, prorata-hoist, step3-one-bar (full TariffHierarchy Dec2025 + Jun2026); i18n-sweep (ProductL2_Full Dec2025) | the local `.xlsx` files | **No** — they never touch the entry point. They need the same ROW SHAPE (§8); if the backend's rows differ, these specs stop representing production |
| The ingest orchestrator (paths 1, 3, 4) | ingest-spec (drives `runIngest` with a stub reader; the sniff), size-copy-spec (`MAX_UPLOAD_*`, the three handlers' captions) | none | **Yes** — `runIngest`'s `read` and the size rule are file-shaped; both specs move with them |
| Import Save (path 3) | import-seam-spec (structural, on `applyImportSaveWorkbook`/`handleImportSaveFile`), restore-banner-spec, restore-base-spec, active-cohort-spec, one-view (b) (Metadata `View` through a real .xlsx round trip) | in-memory workbooks; import-seam also reads the edge fixture | **Yes** — they pin the workbook-shaped restore |
| Export ↔ restore round trips | event-roundtrip (`PROSPECT_Save_PromoMix_Behavioural.xlsx`, from `scripts/build-promo-mix-fixture.mjs`), yield-roundtrip, event-toggle, arpu-basis, initiatives, step3-one-bar (j) — each `json_to_sheet → XLSX.write → XLSX.read → sheet_to_json`; pricing-roundtrip, lock-roundtrip, hold-shape, events-summary and others drive the row writers/readers in memory | as listed | **Yes** for those calling `XLSX.write`/`read`: they certify the .xlsx serialisation, which a BigQuery store would replace |
| Import Actuals (path 4) | no spec drives `handleImportActualsFile` or `ImportActualsModal` (only i18n-sweep renders it); `monthsCarryingActuals` is driven by accuracy-month and view-apply | — | the picker is unexercised today |
| Compare (path 5) | compare-events-panel (the worker's parse pool, structural), step3-one-bar (f), compare-filter, compare-render, compare-window, scenario-pricing (drive `computeScenarioForFilter` with in-memory rows) | none | **Yes** for compare-events-panel (it pins the worker's sheet list) |
| Fixture builders | `scripts/build-trimmed-fixture.mjs` (edge + full → trimmed), `scripts/build-promo-mix-fixture.mjs` | — | — |

`scripts/guard-traps.ts` also plants into these paths (traps 213-216 and the
`View`-cell traps 292-293).

---

## 8. The seam — recommendation only, not built

**Baseline — at App:1961-1973.** Everything downstream reads `data` and
`columns`. The narrowest byte-identical point is the statement pair
`setColumns(Object.keys(jsonData[0])); setData(jsonData)` (with
`setLoadedLine` and the optional Market_Events read beside it): a rows source
hands in `jsonData` instead of `sheetsData[actualsName]`. (`setWorkbookSheets`,
`setActualsSheet` and `setForecastsSheet` feed only the dead `vsActualsData`
memo and need not be supplied.)

**Actuals — at App:343.** Replace the one `sheet_to_json(wb.Sheets[sheetName])`
with the source's rows. The date and value detection, the month picker, the
"already loaded" rule and the append (App:344-429) are then unchanged. Since
the backend reads one fixed table, a refresh of that table may make Import
Actuals redundant: newer months simply arrive with the baseline rows.

**Session restore — at App:713.** `applyImportSaveWorkbook(wb)` uses only
`wb.SheetNames` and 13 calls of `XLSX.utils.sheet_to_json(wb.Sheets[name])`.
The narrowest seam is a `Record<sheetName, Row[]>` argument read through one
accessor in those 13 places, and `isSessionWorkbook` needs names only. The
writer has the mirror point: the 12 row arrays built at App:446-668 before
each `json_to_sheet`. Compare (§5) needs four of those arrays per session.

**What must match exactly for byte-identical behaviour:**
- **Headers:** the same names, case and spelling, and for the baseline the
  same column ORDER (auto-detect takes the first match; `columns` comes from
  row 0's keys).
- **Types:** numbers as JS numbers; text as strings (readers `trim` some
  fields, not all); booleans as booleans (`Seed_Base_Known`); JSON columns as
  JSON **strings**; dates as `"yyyy-MM"` **text** (the app does `new Date()` on
  it; a `Date` object, an ISO timestamp or `yyyy-MM-dd` all parse but take the
  §2 time-zone path differently).
- **Empty:** a missing value must be an **ABSENT KEY** on the row, which is
  what `sheet_to_json` produces. `''` is NOT equivalent: `?? 'All'` keeps `''`,
  and the save's absence carriers rely on it. `null` behaves like absent under
  `??`/`||`, but appears in `Object.keys` (so `columns`) and fails `!== null`
  guards differently. The one exception is the session sheets, where the
  writer's `''` cells round-trip as `''` (measured: `Leaf_Count`), so those
  `''` must be kept.
- **'All':** only ever the wildcard. A data row must never carry `'All'` (it
  would read as an aggregate), and the session sheets' `'All'` must be kept
  verbatim.
- **Dimension strings:** identical between the baseline rows and any actuals
  rows (coverage is exact-string, §3), and identical to those stored in a
  session's forecast keys, or a restored forecast covers nothing.
- **Placeholders:** either the `{ Note }` single-row shape or `[]` (both are
  handled), but the seven required sheets must exist by name.

---

## 9. Open questions surfaced (not decisions this inventory takes)

1. Should a BigQuery-backed session persist the **column mapping** and the
   **Metadata settings** that the Excel save writes but never reads (§4.11)?
2. The four blank rules (§2) disagree today — a blank Segment is 'All' in the
   store and 'Unknown' on Step 3. A backend that normalises NULLs must pick
   one, or this divergence becomes behaviour.
3. `columns` from row 0 only (§2) silently drops a column whose first cell is
   empty — today `Applied_Flow_Rate_%`.
4. Import Actuals can append a month twice (§3).
5. The export dialog's copy says "7 sheets"; the writer writes 12.
6. `Replaced_Model` / `Accepted_At` are read but never written (§4.2).

---

`Repo:` names `1161de6`, this session's skeleton commit (the report file
alone). This filled report is committed alone and pushed after it; no other
file changed this session, and `git status --short` before that commit showed
only this report.
