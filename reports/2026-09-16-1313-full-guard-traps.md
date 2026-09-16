# Release gate — FULL guard-traps on fdc5852

## FOR ADVISOR

```
Generated: 2026-09-16 14:55 +0100 (UTC 2026-09-16 13:55)
Certifies: fdc5852
Repo: src fdc5852; report+ledger committed 00eaf0b, pushed (origin in sync)
254/254 caught
full suite:  75/75 green
```

## Base

Quoted before the run:

- `git status --short` — empty.
- `git diff fdc5852 HEAD --stat -- src` — empty.
- `git diff fdc5852 HEAD --stat -- scripts` —
  `scripts/guard-traps-ledger.json | 984 +++++++++++++++++++++-------------------`,
  one file, the ledger only. No STOP.

HEAD when the run started was `67346b6`, this report's skeleton. Its `src` is
byte-identical to `fdc5852` by the empty diff above, so the ledger's
`lastFullRun.hash` reads `67346b6` for a run of `fdc5852`'s source.

## The run

`npm run guard-traps`, no flag (FULL), output to
`scratchpad/gate-full.out`. Wall time 2,153 s (control 300 s, trap runs
1,850 s).

**The certification line, verbatim:** `254/254 caught`

**N = 254**, which equals the 254 traps registered (a count of `{ id: '` entries
in `scripts/guard-traps.ts`; the harness's own `traps_total=254`). Ids run to
259 because 249 was retired in the 1019 build and some earlier ids were never
issued; the count, not the highest id, is the registry.

**MISSED / INCONCLUSIVE / CRASHED: none.** Every one of the 254 per-trap
lines reads `[CAUGHT      ]`.

## TARGETS md5, before and after

The harness's `TARGETS` array, resolved to paths from its own source (23 files).
Each was backed up to `scratchpad/pre-full/` before the run. No restore was
needed.

| file | before | after | |
|---|---|---|---|
| `src/components/ForecastVsActualsTab.tsx` | `46728c43` | `46728c43` | identical |
| `src/utils/forecasting.ts` | `3c34d144` | `3c34d144` | identical |
| `src/components/WhatIfTab.tsx` | `d3cc80ee` | `d3cc80ee` | identical |
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

(Full 32-character sums in `scratchpad/pre-full/md5-before.txt` and
`md5-after.txt`; the eight-character prefixes above are cut from them.)

## The suite

`npm run suite`, run after guard-traps: **75/75 green**.

## Touched

Nothing but the record. The run rewrote `scripts/guard-traps-ledger.json`, and
that is the only file changed in the working tree. It is committed with this
report, as the release-gate rule requires. No file under `src/` changed, and no
spec or harness file changed.

## Limits

- The Repo line cannot contain the hash of the commit that adds this file. The
  report+ledger commit's hash is recorded by a one-line follow-up commit, which
  touches only this file's Repo line.
