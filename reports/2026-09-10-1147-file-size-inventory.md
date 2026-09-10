# The 50MB limit — where it lives, and what the machine actually does

```
FOR ADVISOR
Generated: 2026-09-10 11:47 +0100 (UTC 2026-09-10 10:47)
Certifies: 5d8894e (read-only — no Repo line)

BASE CLAUSE UNSATISFIABLE: the ramp-then-hold report (0705) is READ-ONLY and
  says so. HEAD is 29 commits past its 5422285, NOT reports-only; HEAD used.
1 ONE ENFORCEMENT SITE, App.tsx:1853, on the INPUT DROP only. Import Save
  (:689) and Import Actuals (:316) have NO size check at all. All three parse
  on the MAIN THREAD, SheetJS 0.18.5; the only worker is Compare's.
2 MEASURED, input shape (18 cols, 708-722 B/row), caps 2GB and 4GB:
     25MB   37,000 rows   1.5s   167MB heap   387MB rss
     50MB   74,000 rows   3.1s   255MB heap   642MB rss
    100MB  148,000 rows   6.5s   555MB heap  1147MB rss
    150MB  222,000 rows  10.1s   779MB heap  1628MB rss
    200MB  296,000 rows  13.4s   959MB heap  2023MB rss
  NEITHER CAP FAILED AT ANY SIZE — no failure row rather than a guessed one.
  LINEAR ~65ms/MB. The constraint is the FROZEN MAIN THREAD, not memory.
3 TWO SHEETS = 98.8% of the 19:30 save: Actuals 59.0% (748 B/row, scales
  with INPUT ROWS); Baseline_Forecasts 39.8% (3,543 B/row = 4.7x, LEAVES x
  MONTHS) — a 90MB export is leaf-driven, not input-driven.
4 DETECTION IS CHEAP: bookSheets 4ms vs 766ms full parse (192x);
  sheets:['Metadata'] gives PROSPECT_Version in 1ms. Save = 11 sheets, three
  _Events; input = ONE (Fact_IBRO), neither marker. Route on names first.
RULE: 100MB (6.5s, 555MB heap, ~148k rows) on ALL THREE paths; 150MB only
  behind a worker. Rests on row 3. Node != browser: 5 gaps named in the body.
```

## 1. Where the limit is enforced

**One site, one path.** `App.tsx:1853`:

```ts
if (file.size > 50 * 1024 * 1024) {
  setError('File size exceeds 50MB limit.');
  return;
}
```

That is `handleFileUpload` — the **input drop** only.

| path | site | size check | parser |
|---|---|---|---|
| input drop | `handleFileUpload`, `:1849` | **yes**, `:1853` | main thread, `:1888` |
| **Import Save** | `handleImportSaveFile`, `:689` | **NONE** | main thread, `:698` |
| **Import Actuals** | `handleImportActualsFile`, `:316` | **NONE** | main thread, `:325` |
| Compare | `ScenarioCompareTab:54` | n/a | **worker**, `scenarioParser.worker.ts:31` |

**The two Import paths have no limit at all** — a 500MB file dropped there is
read straight into `FileReader` and `XLSX.read`. That is a bigger gap than the
50MB number being a guess.

**Every upload path parses on the main thread**, SheetJS **0.18.5**
(`^0.18.5`, installed 0.18.5), identical options
`XLSX.read(buffer, { type: 'array', cellDates: true })`. The one worker in the
codebase belongs to Compare and reads only four named sheets
(`sheets: ['Baseline_Forecasts', 'Market_Events', 'Yield_Events',
'Pricing_Events']`), deliberately skipping Actuals. **No upload path uses it.**

## 2. Measured

Synthetic `.xlsx` of the input's real shape — the same 18 columns as
`Fact_IBRO` / `Actuals`, with realistic value kinds. Calibrated at
**708–722 bytes/row**, against the real save's Actuals at ~748 B/row, so the
shape is representative rather than invented.

Parsed by `node --max-old-space-size=<cap> parse.cjs`, using **App.tsx's own
options verbatim** and a `Uint8Array` (what `readAsArrayBuffer` hands the
browser), followed by `sheet_to_json` — which every consumer calls next, and
without which the cost would be understated.

| file | rows | wall (2GB) | wall (4GB) | peak heap | RSS |
|---|---|---|---|---|---|
| 24.88 MB | 37,000 | **1.52 s** | 1.50 s | 167 MB | 387 MB |
| 49.95 MB | 74,000 | **3.06 s** | 3.04 s | 255 MB | 642 MB |
| 100.96 MB | 148,000 | **6.47 s** | 6.32 s | 555 MB | 1 147 MB |
| 152.44 MB | 222,000 | **10.13 s** | 10.17 s | 779 MB | 1 628 MB |
| 203.92 MB | 296,000 | **13.41 s** | 13.02 s | 959 MB | 2 023 MB |

**Neither cap failed at any size.** The brief asked for the size at which each
fails; on this evidence there isn't one below 200 MB. The two caps are within
noise of each other, which is itself the finding: **the heap ceiling is not
what is being hit.**

Time is **linear at ~65 ms/MB**; peak heap ~4.8 MB per MB of file. **RSS is
~10× the file size** and reaches 2 023 MB at 200 MB — above the 2 GB old-space
cap, which it survives because that cap governs the JS heap, not RSS.

### Node is not the browser, and this is what that leaves unmeasured

- **A browser tab's budget is smaller and not ours to set.** Desktop Chrome is
  broadly comparable; a low-memory laptop or any mobile browser is not. The
  4 GB column here says nothing about a device that never had 4 GB.
- **`FileReader` holds the whole file before `XLSX.read` sees it**, so the
  browser peak is the file *plus* the parse, and an allocation can fail before
  parsing begins. This harness reads with `fs.readFileSync` and measures only
  the parse side.
- **The main thread is blocked for the whole wall time.** 3 s at 50 MB and
  13 s at 200 MB are a frozen tab, no spinner, no cancel — and that is the same
  in Node and the browser, so it is the one number that transfers cleanly.
- **The rest of the app is not in this measurement** — React's tree, the
  forecast store, any already-loaded cohort. Real peak is higher than the table.
- **No cross-browser check.** One engine, one machine, one Node version.

## 3. What dominates a session export

The 19:30 save is **14.51 MB**, not 90 MB, so the shares below are that save's;
the *scaling* is what carries to a larger one.

| sheet | rows | cols | re-encoded | share |
|---|---|---|---|---|
| **Actuals** | 12,112 | 18 | 8.64 MB | **59.0 %** |
| **Baseline_Forecasts** | 1,728 | 53 | 5.84 MB | **39.8 %** |
| Market_Events | 12 | 39 | 0.03 MB | 0.2 % |
| Adjusted_Forecasts | 24 | 16 | 0.03 MB | 0.2 % |
| Bulk_Generation_History | 1 | 12 | 0.02 MB | 0.1 % |
| the other six | — | — | 0.09 MB | 0.6 % |

**Two sheets are 98.8 % of the file.** They scale on different axes:

- **Actuals scales with INPUT ROWS** — it is the uploaded fact table echoed
  back. ~748 bytes/row.
- **Baseline_Forecasts scales with LEAVES × MONTHS** — 1,728 rows is exactly
  72 cohorts × 24 months, at 53 columns and **~3,543 bytes/row**.

**A Baseline_Forecasts row costs 4.7× an Actuals row**, so leaves × months is
the dangerous axis. This save has 72 leaves; a deployment with 5,000 leaves
over 24 months would put 120,000 rows on that sheet — **~425 MB from
Baseline_Forecasts alone**, dwarfing Actuals. A 90 MB export is far more likely
to be leaf-driven than input-driven.

*Caveat on method:* each sheet was re-encoded alone into its own workbook and
measured. That is not its exact share of the zipped original (shared strings
and zip overhead differ), which is why the per-sheet sum is 14.65 MB against a
14.51 MB file. The shares are sound to a percentage point; they are not a
byte-exact decomposition.

## 4. Detection

**SheetJS gives sheet names without bodies, and it is nearly free:**

| read | save (14.51 MB) | input (2.43 MB) |
|---|---|---|
| `{ bookSheets: true }` | **4 ms** | 25 ms |
| `{ sheets: ['Metadata'] }` | **1 ms** | 19 ms |
| full parse | 766 ms | 498 ms |

`bookSheets` is **192× faster** than a full parse on the save.

**What a save carries that an input never does:**

| | PROSPECT save | input |
|---|---|---|
| sheets | **11** | **1** (`Fact_IBRO`) |
| `_Events` sheets | `Market_Events`, `Yield_Events`, `Pricing_Events` | none |
| `Metadata` → `PROSPECT_Version` | **`1.0.0`** | absent |

**What the drop handler would need**, in order, before reading any body:

1. `XLSX.read(buf, { bookSheets: true })` — ~4 ms.
2. If `SheetNames` contains `Metadata` **or** anything matching `/_Events$/`,
   this is a save. Confirm cheaply with `{ sheets: ['Metadata'] }` and
   `PROSPECT_Version` (~1 ms) — two independent markers, so a hand-edited
   workbook that happens to have a `Metadata` sheet is not misrouted.
3. Route to the Import Save path, **or** refuse with a keyed message
   (six locales) saying this is a saved session and naming the right control.
   Today it falls through to the input parser and fails later, obscurely.

## Recommendation

**Raise the limit to 100 MB, and apply it to all three upload paths.**

- **The number rests on row 3 of the measured table**: 100.96 MB / 148,000 rows
  parses in **6.5 s** with **555 MB peak heap** and 1.15 GB RSS. That is double
  today's allowance, still under a ten-second freeze, and under a gigabyte of
  heap on a measurement that already excludes the rest of the app.
- **Express it in megabytes, not rows.** `file.size` is available before any
  parse; a row count is not, and rows-per-MB varies with column count (an
  18-column input is ~708 B/row, a 53-column Baseline_Forecasts row ~3,543 B).
- **The gap that matters more than the number**: Import Save and Import Actuals
  have *no* check. Whatever limit is chosen, those two paths need it.
- **150 MB or beyond only behind a worker.** 10 s of blocked main thread is not
  a limit problem, it is an architecture one, and the pattern already exists in
  `scenarioParser.worker.ts`.
- **Memory is not the binding constraint** on this evidence — neither a 2 GB
  nor a 4 GB cap failed at 200 MB. If the limit is being set for safety rather
  than for responsiveness, it is being set against the wrong quantity.

## Limits

- **Node is not the browser**, in the five specific ways listed under item 2.
  The one figure that transfers cleanly is the blocked-main-thread wall time.
- **No failure point was found.** The brief asked at what size each cap fails;
  neither did, up to 200 MB, so the table has no failure row rather than a
  guessed one. A larger sweep would be needed to find one.
- **The synthetic file is one sheet of uniform rows.** Real inputs have ragged
  strings and more distinct values, which changes shared-string behaviour; the
  708–722 B/row calibration against the real 748 B/row is the check on that,
  not a proof.
- **Item 3's per-sheet sizes are re-encodes, not a zip decomposition**, as
  stated there; the sum overshoots the real file by 0.14 MB.
- **The 90 MB export in the question was not measured** — no such file exists
  here. The shares are from the 14.51 MB save and the scaling argument is
  arithmetic from its per-row costs.
- **Nothing was run against a browser, and no UI was exercised.** This is a
  read-only inventory: no suite, no guard-traps, no background tasks, and no
  command was abandoned.
