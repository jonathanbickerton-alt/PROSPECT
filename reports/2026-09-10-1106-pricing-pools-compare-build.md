# D5-15 and Compare's pools

```
FOR ADVISOR
Generated: 2026-09-10 11:06 +0100 (UTC 2026-09-10 10:06)
Certifies: c11151e
Repo: committed c11151e, pushed (origin in sync)

BASE d94434b + 3 (reports/ ONLY). PREMISES 0854/0958 EXACT. FIRST d52a471.
1 D5-15 FIXED — What-If's two lines verbatim; the dead Number(Duration)
  window deleted. 19:30 save, 25->20 at 2026-09, adjustedArpu delta:
    BEFORE one-off   +.0554 +.0557 +.0562 +.0565 ... +.0561  never stopped
    BEFORE recurring +.0554  .0000  .0000  .0000 ...  .0000  stopped at once
    AFTER  one-off   +.0554 +.0615 +.0577 +.0538 ... +.0352  (tail = POOL)
    AFTER  recurring +.0554 +.1175 +.1763 +.2312 ... +.4724  accumulating
2 COMPARE CARVES, push 2 -> 3: retention capped at min(vol, newBAdj),
  deltaOf anchored to Compare's BLENDED baseline (no base band), decaying
  by Contract_Length_Months (absent -> 24), T+1, via the same applyDelta.
  PARITY, blended ARPU delta T+1..T+12: What-If .1200 -> .0600, Compare
  .0615 -> .0287; 12 rows, SIGN MISMATCHES 0, MAX |diff| .0585, PINNED 0.08.
3 SPEC scenario-pricing 22 -> 35, D5-15 isolated on a BASE-ONLY target.
4 TRAPS 199/200/201 RED BY HAND, 1 site, md5 227cc0e5; 200 planted GREEN
  first and earned a behavioural discriminator.
5 HELD: card control, mounted re-runs, 4 of 8 traps — a frozen-rate
  regression still passes the suite.
6 GATE serial: suite 61/61, guard-traps 197/197 CAUGHT (0 M/I/C), evt 154,
  mounted 208, pricing 150, yield 76, arpu 84, anchors 209 (197 traps),
  survival 27, i18n 200, ai-hold 13, compare-filter 24. PINS identical.
```

## 1. D5-15 — the duration inversion, fixed

`scenarioHelper.ts` now carries What-If's two lines verbatim:

```ts
if (e.Duration === 'one-off') return currMs === startMs;
return currMs >= startMs;
```

The dead `Number(e.Duration) || 1` window is deleted — `Duration` is a
two-value enum, so that `Number()` was always `NaN` and the window never
described what the user chose — along with the `addMonths` import it was the
only user of.

**Measured on the 19:30 save**, SOHO / Mobile Voice, retention 25 → 20 at
2026-09, `adjustedArpu` delta against a no-event control:

| | 2026-09 | 2026-10 | 2026-11 | 2026-12 | 2027-01 | 2027-06 |
|---|---|---|---|---|---|---|
| **before**, `one-off` | +0.0554 | +0.0557 | +0.0562 | +0.0565 | +0.0562 | +0.0561 |
| **before**, `recurring` | +0.0554 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| **after**, `one-off` | +0.0554 | +0.0615 | +0.0577 | +0.0538 | +0.0503 | +0.0352 |
| **after**, `recurring` | +0.0554 | +0.1175 | +0.1763 | +0.2312 | +0.2816 | +0.4724 |

**Read the "after, one-off" row carefully.** It is not the pricing pass still
applying — that stops after the event month. It is **the pool from D5-14**,
delivered at T+1 and decaying under `contractLength`. The spec separates the
two by testing the duration rule on a **base-only** target, which carves no
pool; on a cohorts target the later months are the carve and nothing else.

Recurring now accumulates, because a Recurring event carves a pool in every
month it applies — matching What-If.

## 2. Compare's carve, and parity

`p_eventPools.push(` in `scenarioHelper.ts` is **2 → 3**. The carve mirrors
What-If's: retention **capped** at `min(volume, newBAdj)` and adding no
subscribers, inflow uncapped, `deltaOf` stored rather than a frozen rate,
`contractLength` from `Contract_Length_Months` with **absent → 24** by the same
stated rule, and Base seeing a pool only once the lag has delivered it.

**The anchor differs deliberately.** Compare has no base band, so its pool
anchors to `m.baseline.arpu`, its blended baseline. Both engines evaluate the
delta through the **same exported `applyDelta`** — one arithmetic, two anchors.

**Parity, measured on the same save and event** (blended ARPU delta):

| | T+1 | T+3 | T+6 | T+9 | T+12 |
|---|---|---|---|---|---|
| What-If | 0.1200 | 0.1100 | 0.0800 | 0.0700 | 0.0600 |
| Compare | 0.0615 | 0.0538 | 0.0430 | 0.0352 | 0.0287 |
| diff | 0.0585 | 0.0562 | 0.0370 | 0.0348 | 0.0313 |

**12 rows, 0 sign mismatches, max |diff| 0.0585.** Pinned as the literal
**`PARITY_TOLERANCE = 0.08`** — above the measured maximum with headroom, and
well below the ~0.12 the effect itself is, so a carve that stopped working on
one side still goes red. Never "to the penny", exactly as the amended decision
requires, and the 0958 report gives the structural reason.

## 3. Spec

`scripts/scenario-pricing-spec.ts`, **22 → 35**. Its own four-month fixture,
asserted to span the months before anything is read from it.

- **D5-15**, on a **base-only** target so the duration rule is isolated from the
  pool: one-off moves its own month and neither of the two after; recurring
  moves its own month and both after; neither reaches back before the event
  month; the dead window is gone and the test is What-If's two lines.
- **D5-14 structural**: the carve exists, push count is 3, retention is capped,
  the pool carries `deltaOf`, `applyDelta` is imported not copied, Base sees a
  pool only after the lag, absent `Contract_Length_Months` is 24.
- **D5-14 behavioural**: a **one-off cohorts** event still moves the month after
  it — the only check that can tell a carve from no carve.
- **Parity**: the tolerance is a pinned literal, and Compare's carve moves the
  blend in the same direction.

## 4. Traps

Ids from `next free trap id`, which read **199** before and **202** after.

| id | the defect it plants | seen red |
|---|---|---|
| 199 | D5-15 reverted — the durations invert again | 1 site, 22/34 |
| 200 | Compare stops carving the pricing pool | 1 site, 34/35 |
| 201 | Compare's retention carve loses its cap | 1 site, 33/34 |

Each planted **by hand**, run, seen red, restored **from the scratchpad backup**
with `scenarioHelper.ts` at md5 `227cc0e5c617b96778cdf717ca068d05` before each
plant and after each restore.

**200 planted GREEN the first time**, and that is worth recording. My D5-14
checks were **structural** — they read source text, which a runtime mutation
leaves intact — and the one behavioural check I had asserted only *direction*,
which the unpooled path satisfies too. The trap demanded a real discriminator
and got one: a **one-off** cohorts event must still move the month **after** it,
because the pricing pass has stopped by then and only the pool can carry it.
A trap nothing can catch is not a guard.

## 5. Gate

Run **serially**; guard-traps to a file in the scratchpad, one instance.

| check | result |
|---|---|
| suite | **61/61 green** |
| guard-traps | **197/197 CAUGHT** — 0 MISSED, 0 INCONCLUSIVE, 0 CRASHED |
| scenario-pricing | **35/35** (22 before) |
| event-toggle | 154/154 |
| view-apply-mounted | 208/208 |
| pricing-roundtrip | 150/150 |
| yield-roundtrip | 76/76 |
| scenario-arpu | 84/84 |
| trap-anchors | 209/209 — **197 traps**, 204 anchors |
| survival | 27/27 |
| i18n-parity | 200/200 |
| ai-hold | 13/13 |
| compare-filter | 24/24 |
| tsc / lint / build | clean |

**Pins all identical:** apply 12 (8 + 4), display 6, `.enabled` 5 + 1 + 0,
TARIFF_SCOPE_SITES 10 (9 + 1), `computeAdjustedForecast` sites 6,
`eventScopeSeriesFor` callers 3. `p_eventPools.push(` is 4 in WhatIfTab
(unchanged) and **2 → 3** in scenarioHelper.

**No pin was re-aimed and no anchor aged out** — 197/197 caught and
`trap-anchors` green, so nothing this session disturbed an existing trap.

**`compare-filter` is run and reported although the brief did not name it**:
it is the other spec that drives `computeScenarioForFilter`, and changing that
file is exactly the kind of edit that should be shown not to have moved it.

`src/utils/scenarioHelper.ts` was `227cc0e5c617b96778cdf717ca068d05` before
guard-traps and the same after.

## Limits

- **Items 3 and 4 were not reached** — no Contract Length control on the card,
  no locale keys, and none of the mounted re-runs 0854 left open (cl 3 gone by
  T+4, Recurring accumulating, 95 → 0, Inflow joining with volume, Cohorts+Base
  priced once, the two differentials, no-event → baseline). Per the brief's
  fallback, 1 and 2 are gated and committed and these are the next session.
- **Four of the eight briefed traps are unwritten** — contractLength ignored,
  the frozen rate, Cohorts+Base twice, and reader default ≠ 24. So a regression
  to a frozen rate would still pass the suite, as it would have before.
- **The card still always writes 24**: `contractLength` reaches an event only
  through a restored sheet or a spec.
- **Parity is measured on one cohort, one event, one duration.** The tolerance
  is pinned from that; a wider sweep could move it, and the pin is a literal so
  it will go red rather than drift if it does.
- **The two engines still differ structurally** — Compare has one blended ARPU
  and no base band. That stays on the after-UAT list, and it is why parity is a
  tolerance rather than an identity.
