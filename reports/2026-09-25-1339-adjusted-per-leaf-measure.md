# REQ-D7-04 — adjusted scoring per leaf: measure first

## FOR ADVISOR

```
Generated: 2026-09-25 14:50 +0100 (UTC 2026-09-25 13:50)
Certifies: 379c48b (src read)
Repo: committed d65bddc, pushed (origin in sync)
Decisions (clauses 1-4) d65bddc alone. Skeleton 1dfa568. Base clean.
full suite:  80/80 green; tsc exit 0. READ-ONLY: no src/scripts edits.
Fixture: the 1855-shaped one (test-data/Walks/2026-09-23-1839.xlsx absent)
BAND: 2-10 s -> clause 3 says on demand when the toggle is switched on,
  with a computing state. Not a STOP.
Corporate/Direct: 60 per-leaf runs 3.26 s (median 55.9 ms, 48.0-66.4)
All/All (same 60 leaves): 3.09 s (median 49.9 ms, 48.1-72.5)
Every run resolves a STORED leaf fit: 60/60 stored, 0 derived
Row scans dominate: the same 60 runs with data=[] take 0.01 s (~99.7%)
FINDING: those scans are scope-independent (pro-rata leaf weights, 3 per
  run) - hoisted once, 60 runs would be ~0.06 s: the <2 s band (s.2)
Cards: computeForecastMape gets ONE view map for EVERY leaf (FVA:2571)
Table: cohortAdjMeanMap applies it only to a 5-part key match (FVA:1225)
Challenger never scores Adjusted: it passes undefined (FVA:2610)
Build: ONE session. Pins: step3-one-bar (g)/(i)/(X):526, trap 287
Decision for Jon: build per clause 3 (on demand) or hoist the scans
  first and build as-is (<2 s) - reserved, not taken here
Hold: the toggle stays as at 542a5cb (clause 4).
```

READ-ONLY session: only test-data/EXPECTED.md (ITEM 0) and this report
change. The measurement ran from a scratchpad script
(`scratchpad/s170-measure.tsx`), never under scripts/.

## 1. Base (quoted at session start)

- Skeleton `1dfa568` first (committed and pushed); then:
- `git status --short`: empty.
- `git diff 379c48b HEAD --stat -- src`: empty.
- `git diff 379c48b HEAD --stat -- scripts`: `scripts/guard-traps-ledger.json` only.

ITEM 0 — clauses 1-4 under "REQ-D7-04 — ADJUSTED SCORING PER LEAF (Jon,
2026-09-25)" in test-data/EXPECTED.md, committed ALONE as `d65bddc` and pushed.

## 2. (a) The measurement — engine-direct

**Which session.** `test-data/Walks/2026-09-23-1839.xlsx` is **not present**
(Walks holds two 01/02 Sep saves only), so this is the **1855-shaped fixture**:
the 60 Corporate·Direct leaves fitted on history to 2025-12, actuals over 540
leaves to 2026-06 (90,720 rows) — the same store and rows spec:step3-one-bar
and spec:one-view mount. The events are the enabled Corporate/Direct Inflow
market event those specs use (1000 subscribers at the first forecast month);
the seam matches and pro-rates it itself.

**Method.** The view's seam answer, then `coveredLeafKeys(seam, viewKey,
actualKeys)` → 60 leaves; for EACH, one `eventScopeSeries` run with the
leaf's 7-part scope as the draft and the event arrays as given, the full
actuals rows as `data` — exactly what FVA's `viewRun` passes. A warm-up pass
(not reported) first; `performance.now()` around each run.

| scope | covered | 60 runs in series | per run: median / min / max |
|---|---|---|---|
| Corporate/Direct, one event | 60 | **3.26 s** | 55.9 / 48.0 / 66.4 ms |
| All/All, one event | 60 (the same) | **3.09 s** | 49.9 / 48.1 / 72.5 ms |
| Corporate/Direct, no events | 60 | 3.03 s | 49.5 / 47.9 / 68.3 ms |
| Corporate/Direct, one event, `data = []` | 60 | **0.01 s** | 0.1 / 0.1 / 0.2 ms |
| one VIEW run, Corporate/Direct (for scale) | — | 0.29 s for 5 | 58.1 / 57.2 / 60.2 ms |

- **Stored fits.** The instrumented resolver saw 60 asks, **60 STORED hits, 0
  derived** — each per-leaf run resolves the leaf's own stored fit.
- Every run returned 60 `adjustedMonths`; the event moved Inflow in all 60 (its
  pro-rata share reaches every leaf under Corporate/Direct).
- **What dominates: the row scans.** With `data = []` the same 60 runs take
  0.01 s, so ~99.7% of the 3.26 s is `computeAdjustedForecast`'s pro-rata leaf
  weighting: `buildLeaves` runs over every actuals row once per metric —
  **three full scans of 90,720 rows per run** (WhatIfTab.tsx:1460-1483, called at 1488-1490), whatever
  the scope. The event count barely matters (no events: 3.03 s).
- **FINDING — those scans are scope-independent.** The weights are built from
  ALL rows for every run; the 60 runs rebuild the identical three lists. Built
  once, the 60 runs would cost about one run's scans plus 60 × 0.1 ms ≈ 0.06 s —
  the **< 2 s band**. The engine already takes `proRataLeavesOverride`, but as
  ONE list for all three metrics (WhatIfTab.tsx:1485-1486), while the scans build
  one per metric; so hoisting needs a per-metric override — an engine change,
  not a drop-in. Not done: this session is read-only, and which band to build to
  is Jon's (section 6).

## 3. (b) Where per-leaf means would feed

Today `AdjustedMeanMap` is **month → means** (FVA:593), built from the VIEW's
run (FVA:2103-2115, `viewRun.adjustedMonths[].uplifted`). Per leaf, it becomes
**leaf key → month → means**. The read sites:

| site | today | the shape change |
|---|---|---|
| **The cards** — `summaryMape` (FVA:2531-2597) calls `computeForecastMape(bf, …, adjustedMeanMap, …)` for EVERY matching leaf forecast (FVA:2571) | the SAME view map for all 60 leaves — **this is the 12231.5% mismatch**: each leaf's actuals scored against the whole view's means | pass `perLeaf.get(key(bf))`. `computeForecastMape` itself (FVA:238, read at FVA:362-369) already takes ONE month map, so its signature need not change |
| **The table** — `buildCohortAccuracy(…, adjustedMeanMap, …)` (FVA:617, called FVA:2146) → `cohortAdjMeanMap` (FVA:1188-1236) | substitutes the view means only where a row's forecast's **5-part** key equals the loaded forecast's (FVA:1225 — tariffs ignored); every other leaf keeps baseline volumes; ARPU is a view-level ratio applied to all (FVA:1200-1206, 1234) | per matching leaf, its own adjusted means (volumes summed, ARPU weighted as the baseline branch already weights) — the loadedKey / ratio logic goes |
| the per-scenario ARPU bands (FVA:1245-1269) | shifted by that same view-level blended ratio | follow the per-leaf blend |

**`computeForecastMape` reads the same map** — yes, the one `adjustedMeanMap`
feeds both the cards (via each call) and the table (via
`buildCohortAccuracy`). Note: it adjusts only inflow/outflow/retention and the
BLENDED arpu (FVA:366-369); the four per-scenario ARPU cards read
`bm.inflowArpu` etc. unadjusted (FVA:371-374), so they do not move with the
toggle today, per leaf or otherwise.

## 4. (c) The Challenger

**It does not score Adjusted.** `challengerCohortAccuracy` calls
`buildCohortAccuracy(…, resolveForecast, undefined, accuracyMonth || undefined)`
— the map argument is `undefined` (FVA:2610). Unaffected by a per-leaf build.

## 5. (d) Cost of the per-leaf build

**ONE session** (as expected). Never-shed: with the toggle on, each covered
leaf is scored against its OWN adjusted means (the seam run for its scope), in
the cards and the table — the mirror of Baseline — computed on demand with a
computing state (per the measured band), memoised on view + the three arrays.

Every pin expected to move:

- `src/components/ForecastVsActualsTab.tsx`: the `AdjustedMeanMap` type (593);
  `buildCohortAccuracy`'s `cohortAdjMeanMap` (1188-1236) and the ARPU bands
  (1245-1269); `viewRun` (2079-2096) → the per-leaf runs (FVA's one
  `eventScopeSeries({` text site stays one, inside a loop — the "seam callers 6"
  pin holds); `adjustedMeanMap` (2103-2115); `summaryMape`'s call (2571); the
  toggle handler + a computing state (new key, six locales).
- **Specs expected red**: step3-one-bar (g) and (i) — they pin the card to the
  engine figure for the VIEW's means (`cardFor(meansOf(ref.adjustedMonths))`,
  step3-one-bar:412-433) and must move to the per-leaf mirror; step3-one-bar
  (X) at :526 (`adjustedMeanMap reads the view run`); accuracy-month (X) at :356
  only if the argument text `resolveForecast, adjustedMeanMap, accuracyMonth ||
  undefined)` changes. derive-aggregate (:535) and edge-fixture (:134) pass
  `undefined` and are unaffected while `computeForecastMape`'s signature stays.
- **Traps**: 287 anchors on `for (const am of viewRun.adjustedMonths) {` (the
  line the per-leaf build replaces) → re-point; 290 (the util's
  `adjustedMonths`) survives.

## 6. (e) The band — and the decision it leaves

**The measurement falls in the 2–10 s band** (3.26 s at Corporate/Direct, 3.09 s
at All/All). Clause 3 therefore says: built, **computed on demand when the
toggle is switched on, with a computing state**. It is not the > 10 s STOP;
option B does not come back.

**Decision for Jon (reserved, not taken):** the band is set by three
scope-independent row scans per run. Hoisting them (a per-metric
`proRataLeavesOverride`, computed once per data) would put the same 60 runs
at ≈ 0.06 s — the < 2 s band, "built as-is, memoised". Either:
(a) build per clause 3 as measured (on demand + computing state); or
(b) hoist the scans first (an engine change, pinned by its own spec), then
build as-is with no computing state.

## 7. Gate

| check | result |
|---|---|
| `npm run suite` | **80/80 green** |
| tsc | exit 0 |
| `git status --short` before the report commit | ` M reports/2026-09-25-1339-adjusted-per-leaf-measure.md` — the report only |

`Repo:` names `d65bddc`, the last commit that changed repo state (the
decisions); this report is committed and pushed after it, and nothing else.
The suite does not write the guard-traps ledger, so no ledger commit.
