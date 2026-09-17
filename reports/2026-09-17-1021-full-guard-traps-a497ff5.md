# Release gate — FULL guard-traps on a497ff5

## FOR ADVISOR

```
Generated: 2026-09-17 12:04 +0100 (UTC 2026-09-17 11:04)
Certifies: a497ff5
Repo: src a497ff5; report+ledger committed PENDING, pushed (origin in sync)
270/270 caught
full suite:  76/76 green
```

## Base

Quoted before the run:

- `git status --short` — empty.
- `git diff a497ff5 HEAD --stat -- src` — empty.
- `git diff a497ff5 HEAD --stat -- scripts` —
  `scripts/guard-traps-ledger.json | 466 ++++++++++++++++++++--------------------`,
  one file, the ledger only (committed with the 0953 report in 5d1b557). No STOP.

HEAD when the run started was `8079186`, this report's skeleton. Its `src` is
byte-identical to `a497ff5` by the empty diff above, so the ledger's
`lastFullRun` reads `{"hash":"8079186","caught":270,"total":270}` for a run of
`a497ff5`'s source.

## The run

`npm run guard-traps`, no flag (FULL), output to
`scratchpad/gate-full-a497ff5.out`. Wall time 2,173 s (control 291 s, trap runs
1,879 s).

**The certification line, verbatim:** `270/270 caught`

**N = 270**, equal to the 270 traps registered: 268 `{ id: '` entries plus 2
`{ id: "` entries (270 and 271, whose names contain an apostrophe) in
`scripts/guard-traps.ts`, and the harness's own `traps_total=270`. That is 15 more
than the 1459 gate's 255: traps 261–275 were added by REQ-D6-08 sessions 1 and 2
and clauses 17 and 18.

**MISSED / INCONCLUSIVE / CRASHED: none.** All 270 per-trap lines read
`[CAUGHT      ]`; no other status appears.

## TARGETS md5, before and after

The harness's `TARGETS` array, resolved to paths from its own source (23 files),
each backed up to `scratchpad/pre-full-a497ff5/` and md5'd before the run. All 23
identical after it; no restore was needed and nothing is reported CRASHED.

| file | before | after | |
|---|---|---|---|
| `src/components/ForecastVsActualsTab.tsx` | `46728c431dc25b762eb93e89ee939aff` | `46728c431dc25b762eb93e89ee939aff` | identical |
| `src/utils/forecasting.ts` | `66a76dfcf4bcb4de399f351b773df5d4` | `66a76dfcf4bcb4de399f351b773df5d4` | identical |
| `src/components/WhatIfTab.tsx` | `68f4aaf85ed685bd7539efe6fa3b19c5` | `68f4aaf85ed685bd7539efe6fa3b19c5` | identical |
| `src/App.tsx` | `9f08f5af8edf42c51fe220d74e227379` | `9f08f5af8edf42c51fe220d74e227379` | identical |
| `src/utils/ingest.ts` | `cef5fdcda0108c4b1aa779d2b5455e2c` | `cef5fdcda0108c4b1aa779d2b5455e2c` | identical |
| `src/components/StandardForecastTab.tsx` | `470863abe5562d992af1ac6aac89063a` | `470863abe5562d992af1ac6aac89063a` | identical |
| `src/components/BulkGenerateModal.tsx` | `7e06edd885373890bedf1d2a88145128` | `7e06edd885373890bedf1d2a88145128` | identical |
| `src/utils/viewFilter.ts` | `88a7a72cb5825eeaf56b01ff19d69ca0` | `88a7a72cb5825eeaf56b01ff19d69ca0` | identical |
| `src/utils/mixConstraint.ts` | `f7f32f187575d7d96128d07372a93838` | `f7f32f187575d7d96128d07372a93838` | identical |
| `src/utils/scenarioHelper.ts` | `227cc0e5c617b96778cdf717ca068d05` | `227cc0e5c617b96778cdf717ca068d05` | identical |
| `src/components/ScenarioCompareTab.tsx` | `9156c2fb8e7b54bac511cc0516e7d340` | `9156c2fb8e7b54bac511cc0516e7d340` | identical |
| `src/utils/sheetGuards.ts` | `8bafd58e0672e68019357e580d872f42` | `8bafd58e0672e68019357e580d872f42` | identical |
| `src/utils/churnFold.ts` | `dd245b60d0e6dec1bf779f30126b52c7` | `dd245b60d0e6dec1bf779f30126b52c7` | identical |
| `src/utils/amountControl.ts` | `a3fe296417df4c0a47e7fc08b99ca135` | `a3fe296417df4c0a47e7fc08b99ca135` | identical |
| `src/utils/scenarioArpu.ts` | `b1b12cdc9f8a5319b29551f4fd67cc50` | `b1b12cdc9f8a5319b29551f4fd67cc50` | identical |
| `src/locales/de/translation.json` | `31e802ec6418d8743ef174199ec8b2fb` | `31e802ec6418d8743ef174199ec8b2fb` | identical |
| `src/components/MixSliderRow.tsx` | `f271672072b763c5222d052f873ad9b2` | `f271672072b763c5222d052f873ad9b2` | identical |
| `src/components/MixTargetPanel.tsx` | `c4b41fb7ebd3465e7adcff59c86427b6` | `c4b41fb7ebd3465e7adcff59c86427b6` | identical |
| `src/components/ForecastSummaryBar.tsx` | `d86b939c5f2f6fa80d44c9a244906ef6` | `d86b939c5f2f6fa80d44c9a244906ef6` | identical |
| `package.json` | `95feb7ec2a07287bbabd06d6c915fb64` | `95feb7ec2a07287bbabd06d6c915fb64` | identical |
| `.env.example` | `d4e782a7e4f70067d5c8e705fe304057` | `d4e782a7e4f70067d5c8e705fe304057` | identical |
| `src/components/EventsSummaryTable.tsx` | `792315c2b88355f5f5c0aedeb39a348c` | `792315c2b88355f5f5c0aedeb39a348c` | identical |
| `src/locales/en/translation.json` | `c283694f47f4915b6b66a40559068c02` | `c283694f47f4915b6b66a40559068c02` | identical |

## Suite

`npm run suite`, after the run, to `scratchpad/suite-full-a497ff5.txt`:
**76/76 green**.

## What was touched

Only `scripts/guard-traps-ledger.json`, rewritten by the run, committed with this
report. No src, spec or script change. This report's skeleton was committed as
`8079186` before the run.
