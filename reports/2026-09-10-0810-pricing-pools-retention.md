# The retention carve — built, measured, and one consequence to decide

```
FOR ADVISOR
Generated: 2026-09-10 08:10 +0100 (UTC 2026-09-10 07:10)
Certifies: a1084e4 (docs only)
Repo: reverted clean at 8d0106f for src/; docs a1084e4 pushed

BASE 8d0106f + 2 (reports/ ONLY). Brief arrived TRUNCATED, then in full.
0 REPRODUCED THROUGH THE APP RESTORE PATH: SOHO/Mobile Voice 2026-09 =
  Base 41.20K, Retention 2.96K — Jon's app figures exactly. CAUSE OF
  0750 NAMED: my harness read `Seed_Base_Known === 'Yes'`, the sheet
  stores the BOOLEAN true, so a 40,203 seed was discarded on all 10
  leaves and the stock read 974 — 42x too small. restoreSeedKnown
  (:2524) accepts true. The 0750 "category error" is WITHDRAWN, and
  recorded as withdrawn in D5-14.
1 BUILT the capped, replacing retention carve — min(retentionVol,
  p_basePool), the :1687 clamp. Push 3 -> 4 in WhatIfTab. MEASURED via
  the app path, cl=24, Cohorts only, 25 -> 20, One-Off at 2026-09:
    2026-10  14.51 -> 14.52  (+0.0100)   T+1, as intended
    2026-11  14.63 -> 14.63  (+0.0000)
    2027-02  14.90 -> 14.88  (-0.0200)   NEGATIVE
    2028-06  15.58 -> 15.56  (-0.0200)   NEGATIVE
  Base VOLUME unchanged every month (41203 -> 41203): the cap holds, no
  subscribers added. cl=3 -> gone by T+3. No event -> adjusted =
  baseline exactly. The 0750 T+2 item was the 974 stock; decay works.
STOP — AN IMPROVEMENT BECOMES A DRAG. The pool carries a FIXED nominal
  rate (14.58) while baseline Base ARPU rises to 15.58, so a dilution
  IMPROVEMENT lowers Base revenue for most of the horizon. Faithful to
  "carries the priced rate"; almost certainly not intended. The yield
  path solved this with a RATIO anchored to the fitted level (1652).
  FIXED RATE or RATIO is a DECISION. NOTHING SHIPPED; build preserved.
```

## 0. The harness, retired — with the cause named

**Reproduced through the app's own restore path**, using `restoreSeedKnown`,
`makeForecastKey`, `buildRollUpIndex` and `resolveFromStore`:

| month | Base (Baseline) | Retention (Baseline) |
|---|---|---|
| 2026-08 | 40.88K | 2.94K |
| **2026-09** | **41.20K** | **2.96K** |
| 2026-10 | 41.52K | 2.97K |

**Jon's app reading exactly.** Seed sum across the 10 SOHO / Mobile Voice
leaves is **40 203**, and the resolved aggregate carries it (`seedBaseVolume
40203, known=true`).

**The cause of the 0750 error, precisely.** My hand-derived harness wrote:

```ts
seedBaseKnown: f.Seed_Base_Known === 'Yes'      // WRONG
```

The sheet stores the **boolean `true`** on all 1 728 rows, so that read `false`
for every leaf, the 40 203 seed was discarded, Base started at zero and
accumulated inflow only — **974 instead of 41 203, forty-two times too small.**
The app's own reader is `restoreSeedKnown` (`forecasting.ts:2524-2530`), which
accepts `true`, `'true'` and falls back to `storedSeedKnown`.

**The "category error" concluded in 0750 is withdrawn** and recorded as
withdrawn in D5-14. Retention is not mis-modelled; the pool clamp fired because
the stock was wrong. The hand-derived aggregate is retired.

## 1. What was built, and what it does

The 0750 build restored from the scratchpad (three files, debug stripped),
plus the retention carve changed to the capped, replacing shape:

```ts
const sized = scen === 'retention' ? Math.min(volume, p_basePool) : volume;
```

`p_eventPools.push(` is **3 → 4** in `WhatIfTab.tsx`, as briefed.
`scenarioHelper` is untouched (still 2; Compare not reached).

**Measured through the app path**, Cohorts only, Retention, 25 → 20,
One-Off at 2026-09, `contractLength` 24:

| month | Base ARPU b → a | Base revenue | Base volume |
|---|---|---|---|
| 2026-09 | 14.43 → 14.43 | 594 553 → 594 553 | 41 203 → 41 203 |
| **2026-10 (T+1)** | 14.51 → **14.52** (+0.0100) | 602 659 → **602 841** | 41 520 → 41 520 |
| 2026-11 | 14.63 → 14.63 (+0.0000) | 612 119 → 611 987 | unchanged |
| 2027-02 | 14.90 → **14.88** (−0.0200) | 637 644 → 636 966 | unchanged |
| 2028-06 | 15.58 → **15.56** (−0.0200) | 732 165 → 731 417 | unchanged |

**Three of the brief's assertions hold:**

- **Base volume is unchanged in every month** — the cap works and no subscribers
  are added, which is the decision's central requirement.
- **`contractLength` decays it.** With `cl=3` the effect is gone by 2026-12
  (T+3) and every later month is back to baseline exactly.
- **No event → adjusted = baseline** in every month, to the penny (Option A).

**And the 0750 Limits item is answered:** the Inflow One-Off pool returning to
baseline at T+2 was the **974 stock**, not the churn pass, the clamp or the
carve. On the real stock the decay behaves.

## The consequence to decide

**A dilution improvement makes Base revenue WORSE over most of the horizon.**

The pool carries a **fixed nominal rate** — 14.58, the repriced blend at
2026-09 — while the baseline Base ARPU **rises** from 14.51 to 15.58 across the
24 months. A slice frozen at 14.58 is above baseline at T+1 and below it from
T+2 onward, so the sign flips and stays flipped.

That is **faithful to the decision as written** ("carries the priced rate") and
is exactly how a promotion's pool behaves. It is almost certainly not what
Alessandro is asking for: he wants a retention price improvement to *improve*
the forecast, not to improve it for one month and then drag it for twenty-two.

**The engine already solved this problem once, the other way.** The yield path
expresses a rate change as a **ratio applied to the fitted level**, and the 1652
inventory recorded why in the code's own words: *"we express the yield as an
ARPU ratio … so the improvement is anchored to the forecast level."* A ratio
tracks the baseline; a nominal rate does not.

**So: fixed nominal rate, or ratio anchored to the moving baseline?** That is a
decision, it changes every figure this feature produces, and the brief's own
instruction is *"never ship the retention half unmeasured"*. It is measured, and
this is what the measurement says. **Nothing was shipped.**

## Gate

| check | result |
|---|---|
| `npm run suite` (reverted tree) | **61/61 green** |
| `git diff 8d0106f..HEAD -- src/ scripts/` | **empty — zero code drift** |

No guard-traps: nothing was added and no tracked source changed on the tree that
stands. Trap ids 199+ unused.

## Limits

- **The brief arrived truncated** (no `END OF BRIEF`, cut mid-item-1) and I
  stopped and said so; the full text then arrived mid-turn and I continued from
  item 0. The skeleton committed at `8443faa` names the truncation.
- **Items 2–4 were not reached** — no mounted spec, no traps, no Compare, no
  card control, no i18n, no guard-traps. The measurements are engine runs
  through the restore path, which is what the brief asked for at step 0 but is
  not the mounted assertion step 2 asks for.
- **The Base-only differential was not run**, and Cohorts + Base was not
  re-measured on the corrected stock. Both wait on the rate decision, because
  it changes what they would be compared against.
- **`readProvenance` is a local closure in App.tsx**, not exported, so the
  harness substitutes a plain fitted provenance. It plays no part in the seed or
  the base roll; stated rather than passed off as the app's.
- **The build is preserved** in the scratchpad (`build3/`), debug-free and
  `tsc`-clean, so the next session restores rather than retypes it.
