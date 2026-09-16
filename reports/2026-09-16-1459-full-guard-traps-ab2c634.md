# Release gate — FULL guard-traps on ab2c634

## FOR ADVISOR

```
Generated: 2026-09-16 16:41 +0100 (UTC 2026-09-16 15:41)
Certifies: ab2c634
Repo: src ab2c634; report+ledger committed REPORT_LEDGER_HASH, pushed (origin in sync)
255/255 caught
full suite:  75/75 green
```

## Base

Quoted before the run:

- `git status --short` — empty.
- `git diff ab2c634 HEAD --stat -- src` — empty.
- `git diff ab2c634 HEAD --stat -- scripts` —
  `scripts/guard-traps-ledger.json | 132 +++++++++++++++++++++-------------------`,
  one file, the ledger only. No STOP.

HEAD when the run started was `6693bd6`, this report's skeleton. Its `src` is
byte-identical to `ab2c634` by the empty diff above, so the ledger's
`lastFullRun.hash` reads `6693bd6` for a run of `ab2c634`'s source.

## The run

`npm run guard-traps`, no flag (FULL), output to
`scratchpad/gate-full-ab2c634.out`. Wall time 2,126 s (control 291 s, trap runs
1,832 s).

**The certification line, verbatim:** `255/255 caught`

**N = 255**, equal to the 255 traps registered (a count of `{ id: '` entries in
`scripts/guard-traps.ts`, and the harness's own `traps_total=255`). That is one
more than the 1313 gate's 254: trap 260 was added in the 1432 build. Ids run to
260 because 249 was retired in 1019.

**MISSED / INCONCLUSIVE / CRASHED: none.** All 255 per-trap lines read
`[CAUGHT      ]`.

## TARGETS md5, before and after

The harness's `TARGETS` array, resolved to paths from its own source (23 files),
each backed up to `scratchpad/pre-full-ab2c634/` before the run. No restore was
needed.

| file | before | after | |
|---|---|---|---|
| `src/components/ForecastVsActualsTab.tsx` | `46728c43` | `46728c43` | identical |
| `src/utils/forecasting.ts` | `3c34d144` | `3c34d144` | identical |
| `src/components/WhatIfTab.tsx` | `ede11d14` | `ede11d14` | identical |
| `src/App.tsx` | `9f08f5af` | `9f08f5af` | identical |
| `src/utils/ingest.ts` | `cef5fdcd` | `cef5fdcd` | identical |
| `src/components/StandardForecastTab.tsx` | `470863ab` | `470863ab` | identical |
| `src/components/BulkGenerateModal.tsx` | `7e06edd8` | `7e06edd8` | identical |
| `src/utils/viewFilter.ts` | `88a7a72c` | `88a7a72c` | identical |
| `src/utils/mixConstraint.ts` | `f7f32f18` | `f7f32f18` | identical |
| `src/utils/scenarioHelper.ts` | `227cc0e5` | `227cc0e5` | identical |
| `src/components/ScenarioCompareTab.tsx` | `33c05b65` | `33c05b65` | identical |
| `src/utils/sheetGuards.ts` | `8bafd58e` | `8bafd58e` | identical |
| `src/utils/churnFold.ts` | `dd245b60` | `dd245b60` | identical |
| `src/utils/amountControl.ts` | `a3fe2964` | `a3fe2964` | identical |
| `src/utils/scenarioArpu.ts` | `b1b12cdc` | `b1b12cdc` | identical |
| `src/locales/de/translation.json` | `b8330a7f` | `b8330a7f` | identical |
| `src/components/MixSliderRow.tsx` | `f2716720` | `f2716720` | identical |
| `src/components/MixTargetPanel.tsx` | `c4b41fb7` | `c4b41fb7` | identical |
| `src/components/ForecastSummaryBar.tsx` | `d86b939c` | `d86b939c` | identical |
| `package.json` | `32661800` | `32661800` | identical |
| `.env.example` | `d4e782a7` | `d4e782a7` | identical |
| `src/components/EventsSummaryTable.tsx` | `e4607e87` | `e4607e87` | identical |
| `src/locales/en/translation.json` | `749de677` | `749de677` | identical |

(Full 32-character sums in `scratchpad/pre-full-ab2c634/md5-before.txt` and
`md5-after.txt`; the eight-character prefixes above are cut from them.)

## The suite

`npm run suite`, run after guard-traps: **75/75 green**.

## Touched

Nothing but the record. The run rewrote `scripts/guard-traps-ledger.json`, and
that is the only file changed in the working tree. It is committed with this
report. No file under `src/` changed, and no spec or harness file changed.

## Limits

- The Repo line cannot contain the hash of the commit that adds this file. As in
  1313, the report+ledger commit's hash is written into the Repo line by a
  one-line follow-up commit that touches only that line.
