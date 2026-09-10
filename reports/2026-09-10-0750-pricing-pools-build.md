# A Pricing event carves a pool — built, measured, REVERTED

```
FOR ADVISOR
Generated: 2026-09-10 07:50 +0100 (UTC 2026-09-10 06:50)
Certifies: 8d0106f (docs only)
Repo: reverted clean at 18f82d2 for src/; docs 8d0106f pushed

BASE 18f82d2 + 3 (reports/ ONLY). PREMISES 0705 A / 0725 EXACT.
RECORDED FIRST 8d0106f — both D5-14 resolutions, in full, before code.
BUILT THEN REVERTED. The pool model is SOUND FOR INFLOW and CATEGORY-
  MISMATCHED FOR RETENTION — Alessandro's case. Cohorts only / One-Off
  at T+1, with the build in place:
    cohortScope INFLOW     14.51 -> 14.57  (14138 -> 14194)  WORKS
    cohortScope RETENTION  14.51 -> 14.51  (14138 -> 14138)  NOTHING
  Instrumented: the pool IS carved and IS delivered (delivered=1,
  evIdx=[2]); its SIZE is erased — retention flow 2956/mth against a base
  stock of 974, so p_basePool = max(0, newBAdj - eventTotal) clamps to 0.
  Base grows by INFLOW (newBBase = p_bBase + prevIn - prevOut); RETENTION
  IS NOT A BASE INFLOW — a CATEGORY ERROR, not a sizing bug.
  The engine already has the retention shape — yield path :1687 clamps to
  p_basePool and blends into baseARPU — but that is re-anchored monthly
  (Option A) so it would not persist either. What a retention price change
  carves, out of which stock, and how it persists, IS A DECISION.
BUILT, IN SCRATCHPAD, UNCOMMITTED: contractLength on PricingEvent;
  Contract_Length_Months appended LAST after Tariff_Scope; reader absent
  -> 24; carve at site 6 (push 3 -> 4); pricesPools false. COMPARE
  ALREADY HAS 2 PUSHES — that count is 2 -> 3, not the brief's 1 -> 2.
GATE suite 61/61 on the reverted tree; ZERO code drift from base.
```

## 1. What was built

All of it compiled and `tsc` was clean at every step. It is preserved in the
scratchpad and **not committed**.

- **`PricingEvent.contractLength`** (`types/forecast.ts`), optional, documented
  as "absent means 24 as a stated rule".
- **`Contract_Length_Months`**, appended **LAST** on the pricing row — after
  `Tariff_Scope`, as D5-14 directs. Written as a **number**, not the `''`
  absence carrier, because absence here has a stated meaning and writing the
  resolved figure keeps the sheet self-describing.
- **The reader**, `Number(r.Contract_Length_Months) || 24`, with the rule stated
  at the site.
- **The carve at site 6**, `carveCohortPool(volume, arpu, scen)`, pushing the
  same pool shape a re-banded promotion uses — `contractLength` from the event,
  `eventMonthIdx: idx` so the existing lag delivers at T+1.
  **`p_eventPools.push(` went 3 → 4 in `WhatIfTab.tsx`**, as briefed.
- **`pricesPools: false`** unconditionally at `:1887`, with the reasoning
  recorded: every target now prices each subscriber exactly once.

**One count in the brief is wrong and I am not absorbing it.** `scenarioHelper`
already has **two** `p_eventPools.push(` sites — the yield-ratio pool (`:423`)
and the market-event pool (`:458`) — so Compare's count would be **2 → 3**, not
the brief's 1 → 2. Compare was not reached.

## 2. Why it was reverted

**The decision's pool model is sound for Inflow and category-mismatched for
Retention.** Measured with the build in place, Cohorts only / One-Off, dilution
25 → 20 at month 3, read at T+1:

| `cohortScope` | Base ARPU | Base revenue | |
|---|---|---|---|
| **inflow** | 14.51 → **14.57** | 14 138 → **14 194** | works |
| **retention** | 14.51 → 14.51 | 14 138 → 14 138 | **nothing** |

**Instrumented at the carve and at the lag** (debug removed; the tree is
reverted):

```
CARVE 2026-09 idx=2 scen=retention vol=2956 arpu=14.5802
BASE  2026-09 idx=2 pools=1 delivered=0 evIdx=[2]
BASE  2026-10 idx=3 pools=1 delivered=1 evIdx=[2]
```

**The pool is carved and it is delivered.** What fails is its size. On this
cohort the retention flow is **2 956 a month against a base stock of 974**, and
`p_basePool = Math.max(0, newBAdj - eventTotal)` (`:1644`) clamps to zero; the
base scenario's own volume stays 974 and the pool contributes nothing.

**That is not a sizing bug to patch.** Base grows by **inflow** —
`newBBase = p_bBase + p_prevBBaseIn - p_prevBBaseOut`, the T+1 lag — and
retention is a *separate scenario*, not a base inflow. Carving the retention
flow into a base pool asks the stock to contain subscribers that, in this
engine's accounting, never entered it. Inflow works precisely because inflow
*does* join base at T+1.

**The engine already has the right shape for a retention rate change**, and it
is not a pool. `WhatIfTab.tsx:1687`, the retention-yield path:

```ts
const retentionVol = Math.min(m.uplifted.retention, p_basePool);
...
baseARPU = (nonRetainedVol * baseARPU + retentionVol * yieldArpu) / p_basePool;
```

It **clamps to the base pool** and blends into `baseARPU`. But `baseARPU` is
re-anchored to the baseline every month (`:1650`, Option A), so that shape moves
Base in the event month and does not persist either — which is the same wall
D5-14 was written to get past.

**So the open question is sharper than "implement D5-14":** what volume should a
retention-target pricing event carve, out of which stock, and by what mechanism
does it persist when the engine's retention-rate path is deliberately
non-accumulating? That is a decision, and the brief reserved decisions of this
kind, so nothing was shipped.

## 3. Why the whole build was reverted, not half of it

The field, column and reader are sound and would have gated. I reverted them
anyway: shipping the column and the carve while the **reported case** — a
Retention dilution — still moves Base by nothing would be a capability that
looks applied and is not. CLAUDE.md's stability rule is explicit that no
capability change may be half-applied, and the brief's own fallback splits the
work at *Compare and the card control*, not at "the half that works".

**The build is preserved in the scratchpad** (`WhatIfTab.ABANDONED-BUILD.tsx`
and the two others) so a second session can restore it against whatever is
decided about the retention half, rather than retyping it.

**This was a deliberate discard, and the only uncommitted work in the tree was
my own build** — `git status` showed exactly three modified `src/` files and
the docs were already committed at `8d0106f`. The session's hard rule about
scratchpad restores exists to stop an accidental destruction of uncommitted
work; here the discard was the intent, and the work was copied out first.

## 4. Gate

| check | result |
|---|---|
| `npm run suite` (on the reverted tree) | **61/61 green** |
| `git diff 18f82d2..HEAD -- src/ scripts/` | **empty — zero code drift** |

No guard-traps: no trap was added and no tracked source changed on the tree that
now stands. Trap ids 199+ are unused and `next free trap id` is unchanged.

## Limits

- **Items 2 and 3 of the brief were not reached** — no mounted spec, no traps,
  no Compare, no card control, no i18n. The measurements here are engine runs on
  the 19:30 save's SOHO / Mobile Voice cohort, not mounted assertions.
- **The Inflow figure is one month.** Base returns to baseline at T+2 in the
  One-Off case rather than decaying over 24 months, and I did not establish
  whether that is the churn pass, the `p_basePool` clamp, or the carve — the
  retention finding overtook it. It is not evidence the decay term works.
- **The Base-only differential was not run**, because the build it would have
  compared against is reverted.
- **Alessandro's own case is 95 → 0**, measured here at 25 → 20 for continuity
  with 0705/0725. The mechanism is rate-independent; the failure is about which
  stock the pool joins, not how large the rate is.
- **`pricesPools: false` was made unconditional** in the reverted build. If the
  retention half changes shape, that line should be re-derived from the new
  decision rather than carried over.
