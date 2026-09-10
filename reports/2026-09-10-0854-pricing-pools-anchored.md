# The pool carries an anchored delta

```
FOR ADVISOR
Generated: 2026-09-10 08:54 +0100 (UTC 2026-09-10 07:54)
Certifies: __PENDING__
Repo: __PENDING__

BASE a1084e4 + 5288da1 (reports/ ONLY). PREMISES 0725/0750/0810 EXACT.
RECORDED FIRST 795db52 — the anchored-delta decision, in full.
1 ONE EVALUATION SITE: poolRate() beside baseARPU, anchored to
  baseForecast.months[idx].baseArpu.mean — the BASE BAND, not the blend.
  Through scenarioArpu's OWN applyDelta, now exported (:99). Pool gained
  optional deltaOf; promotion/market pools have none and take p.arpu
  untouched; all THREE readers go through it. PUSH WhatIfTab 3 -> 4,
  scenarioHelper UNCHANGED at 2 (Compare held). PINS apply 12, display 6,
  .enabled 5+1+0, TARIFF_SCOPE 10, engine 6, seriesFor 3 — all identical.
  RE-AIMED not loosened: the Pricing_Events last-column pin now names all
  THREE trailing columns; Market_ and Yield_Events untouched.
2 SIGN TABLE T+1..T+21, retention 25->20 One-Off cl=24, app path:
  POSITIVE 21, ZERO 0, NEGATIVE 0. +0.482% at T+1 (brief ~+0.5%),
  decaying to +0.128% at T+21. Base VOLUME unchanged every month.
  ANCHOR CORRECTED MID-BUILD: the blended baseline gave +0.069% and 17
  rounding zeros; the base band gives +0.482%. pricing 137 -> 150.
3 TRAPS NOT WRITTEN; Compare and the card control held — and COMPARE NOW
  DISAGREES with What-If on such an event until its session lands.
4 GATE serial: suite 61/61, guard-traps 194/194 CAUGHT (0 M/I/C, no trap
  disturbed), evt-toggle 154, mounted 208, pricing 150, yield 76, anchors
  206, survival 27, i18n 200, ai-hold 13, applied 19, arpu 84, all clean.
```

## 1. Build

**One evaluation site, named.** `poolRate(p)` sits immediately beside
`baseARPU` in the month loop and is the only place `deltaOf` is read:

```ts
const poolAnchor = baseForecast.months[idx]?.baseArpu?.mean ?? m.baseline.arpu;
const poolRate = (p: EventPool): number =>
  p.deltaOf
    ? applyDelta(poolAnchor, { ...p.deltaOf, pricesPools: false })
    : p.arpu;
```

**`applyDelta` is the pricing pass's own function**, exported at
`scenarioArpu.ts:99` for this. The pool and the pass cannot disagree about what
a delta does, because there is one of them.

**The pool shape gained an optional `deltaOf`.** A promotion states an absolute
price, so its pool has none and takes `p.arpu` untouched — the byte-identical
path the decision requires. All **three** readers of a pool's rate now go
through `poolRate`: the blended-ARPU sum, the base-only branch, and the base
scenario's `delivered.map`.

**The anchor was corrected mid-build, and it mattered by a factor of six.** My
first version anchored to `m.baseline.arpu` — the *blended* baseline, 13.75 —
which lands a +6.67 % dilution at 14.66 against a base band of 14.51, i.e.
**+1.0 %**. Measured: +0.069 % at T+1, with 17 of 21 months reading +0.0000
because the true effect sat under 2dp. The pool sits *in* the base band, so the
band is what its delta must move. Anchored to `baseArpu.mean`, T+1 reads
**+0.482 %** — the brief's own expected ≈ +0.5 % (slice 6.7 % × 6.67 %).

**Counts.** `p_eventPools.push(` is **3 → 4** in `WhatIfTab.tsx`.
`scenarioHelper.ts` is **unchanged at 2** — Compare is held, and the brief's
"2 → 3" is what a second session will do.

**Pins, all identical:** apply 12 (8 + 4), display 6, `.enabled` 5 + 1 + 0,
TARIFF_SCOPE_SITES 10 (9 + 1), `computeAdjustedForecast` sites 6,
`eventScopeSeriesFor` callers 3.

**One pin re-aimed, and only on one sheet.** The Pricing_Events last-column pin
went red because `Contract_Length_Months` is appended after `Tariff_Scope` — the
append-only rule working. It now names **all three** trailing columns rather
than just the last, so a column inserted between any of them still goes red.
Market_Events and Yield_Events are untouched and still end at `Tariff_Scope`.
`event-toggle` 153 → **154**.

## 2. The sign table

Retention, Cohorts only, 25 → 20, One-Off at 2026-09, `contractLength` 24,
measured **through the app restore path** on the 19:30 cohort. The fixture is
asserted first: retention 2 956 **<** stock 41 203, so the cap is exercised
rather than trivially satisfied.

| | Base ARPU b → a | Δ | % | Base volume |
|---|---|---|---|---|
| T+1 | 14.51 → 14.58 | +0.0700 | **+0.482 %** | 41 520 unchanged |
| T+2 | 14.63 → 14.69 | +0.0600 | +0.410 % | unchanged |
| T+4 | 14.79 → 14.84 | +0.0500 | +0.338 % | unchanged |
| T+7 | 14.72 → 14.76 | +0.0400 | +0.272 % | unchanged |
| T+17 | 15.56 → 15.58 | +0.0200 | +0.129 % | unchanged |
| T+21 | 15.58 → 15.60 | +0.0200 | +0.128 % | unchanged |

**Signs over T+1..T+21: positive 21, zero 0, NEGATIVE 0.** The sign never flips
— which is the whole point of the decision, and the thing 0810 measured going
wrong. The magnitude decays as the pool's size decays under `contractLength`,
which is the intended profile.

**Base volume is unchanged in every month**: the retention cap holds and no
subscribers are added.

Instrumented during diagnosis (probe removed, tree restored from the pre-probe
backup): the pool persists with size 2 790 → 1 886 over T+1..T+7 while its rate
tracks the baseline upward, 14.658 → 15.001. A frozen pool would have held one
number while the baseline rose past it.

## 3. Spec

`scripts/pricing-roundtrip-spec.ts`, **137 → 150**:

- `Contract_Length_Months` is the **last** column; `Tariff_Scope` second-to-last;
  the months are written as a **number**, not the `''` absence carrier.
- **Round trip** through a real workbook — writer → xlsx → reader.
- **Absent → 24** as a stated rule, and a **blank cell → 24** too, because
  absence here is not a stated zero.
- The pool carries `deltaOf`; there is **one** `poolRate`; it anchors to the
  base band; it uses the exported `applyDelta`; and **no reader is left on
  `p.arpu`** (`p.size * p.arpu` no longer appears).
- The retention carve is capped and inflow is not.
- `pricesPools: false`, so no subscriber is priced twice.

## 4. Gate

Run **serially**; guard-traps to a file in the scratchpad, one instance.

| check | result |
|---|---|
| suite | **61/61 green** |
| guard-traps | **194/194 CAUGHT** — 0 MISSED, 0 INCONCLUSIVE, 0 CRASHED |
| event-toggle | **154/154** (153 before — the re-aimed pin adds one) |
| view-apply-mounted | 208/208 |
| pricing-roundtrip | **150/150** (137 before) |
| yield-roundtrip | 76/76 |
| trap-anchors | 206/206 — 194 traps, 201 anchors |
| survival | 27/27 |
| i18n-parity | 200/200 |
| ai-hold | 13/13 |
| applied-count | 19/19 |
| scenario-arpu | 84/84 |
| tsc / lint / build | clean |

**No existing trap was disturbed** by exporting `applyDelta` or by the pool's
new field — 194/194 still caught, and `trap-anchors` is green, so no anchor
aged out on this session's edits.

**`scenario-arpu` is run and reported although the brief did not name it**: it
is the spec that owns `applyDelta`, and exporting a function is exactly the
kind of change that should be shown not to have moved it.

## Limits

- **Traps were not written.** The brief asked for seven (ids from 199); none
  exist, and `next free trap id` is unchanged. Held with Compare and the card
  control, per the brief's own fallback.
- **Compare is untouched** — `scenarioHelper` still has 2 pool pushes and its
  Base does not move at T+1. **What-If and Compare therefore disagree** about a
  cohort-target pricing event until that session lands, and a saved file will
  read differently on the two tabs. That is a real, temporary divergence and it
  is the first thing the next session should close.
- **No card control and no locale key**, so `contractLength` can only reach an
  event through a restored sheet or a spec — the card always writes 24 today.
- **The spec is structural plus round-trip, not mounted.** The sign table is an
  engine run through the restore path, not a mounted assertion; nothing in the
  suite would catch a sign flip if the anchor regressed. The trap the brief
  named for exactly that ("the pool reverts to a frozen rate") is one of the
  seven not written.
- **Only the retention path is measured across the horizon.** Inflow,
  Cohorts + Base, Base-only differential, 95 → 0, and `cl=3` were not re-run
  after the anchor correction.
