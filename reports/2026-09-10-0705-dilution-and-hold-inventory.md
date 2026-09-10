# Dilution into Base, and what "ramp then hold" would need

```
FOR ADVISOR
Generated: 2026-09-10 07:05 +0100 (UTC 2026-09-10 06:05)
Certifies: 5422285 (read-only — no Repo line)

BASE 5422285 + 4f5e518 (reports/ ONLY). No suite, no guard-traps.
A MECHANISM, one line: WhatIfTab:1649 `let baseARPU = m.baseline.arpu` —
  RE-ANCHORED every month, never accumulated, and a Pricing event makes NO
  POOL. Pools persist; a re-blended rate does not. MEASURED 25 -> 20 (=
  +6.6667%, 0.80/0.75) at month 3 — Base ARPU delta at months 3/4/5/8:
    Cohorts only  One-Off    0.00 / 0.00 / 0.00 / 0.00   NEVER
    Cohorts only  Recurring  0.00 / 0.00 / 0.00 / 0.00   NEVER
    Cohorts+Base  One-Off   +0.96 / 0.00 / 0.00 / 0.00   event month only
    Cohorts+Base  Recurring +0.96 /+0.97 /+0.98 /+0.99   every month
  Retention ARPU moves 8.80 -> 9.39 in all four. ALESSANDRO'S CASE IS
  "COHORTS ONLY": Base CANNOT move — site 8 touchesBase :1865.
  VERDICT BY DESIGN, not a pool-rule breach: the rule governs POOLS (site 4
  :1590, Base reads delivered ones :1931) and pricing makes none. But NO
  EXPECTED.md heading records it — deliberate yet unwritten.
B "HOLD" HAS TWO READINGS, measured 12 months (Base volume delta, scoped):
  (a) same % each month on each month's baseline: +435 -> +4978; (b) the
  ramp's FINAL LEVEL held absolute: +442 -> +4862 — they cross in Dec and
  part by 2.4%. NEITHER EXISTS: the spread emits ONE ROW PER MONTH, then
  stops. Churn reads as (b), a volume promo as (a) — one flag across
  carriers is the wrong shape. ALREADY OPEN AND IT NAMES HIM — R7 decision
  3: "The HELD TAIL is open pending Alessandro". NOTHING pins the tail.
```

## Part A — the Dilution observation

### A1. The factor, Target and Duration

**The factor** — `forecasting.ts:439-457`, one exported function both cards call:

```
ratio = (1 - target/100) / (1 - current/100)      dilutionAmountPct = (ratio - 1) x 100
```

25 % → 20 % is **0.80 / 0.75 = +6.6667 %**, not +5 %. Out-of-range figures
return `null`, never a substituted 1.0, "because a ratio of 1.0 is a real
answer (current == target) and must not double as 'you typed nonsense'".

**Duration**, at both sites, is the same two lines:

- site 6, `WhatIfTab.tsx:1751-1752` — `one-off` ⇒ `pe.month === m.month`;
  otherwise `pe.month <= m.month`.
- site 8, `:1864` — the same test, inverted as a rejection.

So **One-Off touches exactly one month; Recurring re-applies from its month
onward.** Neither carries anything forward on its own; Recurring simply
re-applies the same rate to each later month's own figures.

**Target**, at site 6 (`:1762-1795`):

| target | what it prices |
|---|---|
| `cohorts` | inflow and/or retention volume only; base and unselected cohorts untouched |
| `base-only` | the base pool component only; event pools keep their own rates |
| `cohorts+base` | the whole blend when `cohortScope === 'both'`, else cohorts + base by volume |

and at site 8 (`:1865-1866`) the decisive line for this observation:

```ts
const touchesBase = pe.target === 'base-only' || pe.target === 'cohorts+base';
if (scen === 'base') return touchesBase;
```

**A `cohorts` target is filtered out of the `base` scenario entirely.** That is
one line, and it is the whole of Alessandro's report.

### A2. Where the retained rate goes

**A Pricing event never creates a pool.** Site 6 computes a local `pricingARPU`
and assigns `m.uplifted.arpu` (`:1797-1799`); it never touches
`p_eventPools`. Site 8 returns a `ScenarioPricing` descriptor consumed by
`scenarioAdjustedArpu` for that month only.

**And Base ARPU is re-anchored every month.** `WhatIfTab.tsx:1645-1649`, in the
engine's own words:

```ts
// Base pool ARPU = this month's forecast blended ARPU. Reading it fresh each
// month (rather than accumulating) guarantees adjusted = baseline when no
// events are applied (Option A). Events shift it from this anchor.
let baseARPU = m.baseline.arpu;
```

So there is no channel by which a month-3 pricing effect can survive into
month 4: no pool holds it, and the anchor is re-read.

**The pool rule itself is implemented and is about pools** (`:1925-1937`):

```ts
// BASE SEES A POOL ONLY ONCE THE T+1 LAG HAS DELIVERED IT
// (Jon, 2026-09-03). At month T that is pools whose EVENT month is
// T-1 or earlier, never T.
base: (() => {
  const delivered = p_eventPools.filter(p => p.eventMonthIdx < idx);
```

`p_eventPools` persists across months and decays by contract length, so a pool
*does* carry its rate into Base at T+1 and onward. Pricing simply never enters
that list.

### A3. Measured

Real engine (`computeAdjustedForecast`) on a real fitted baseline — the
SOHO / Mobile Voice cohort of the 09 Sep 19:30 save, through `deriveAggregate`.
Event at month 3 (2026-09), Retention scope, dilution 25 → 20.

| config | Base ARPU 2026-09 | 10 | 11 | 2027-02 | Base revenue |
|---|---|---|---|---|---|
| Cohorts only / One-Off | 14.43 → 14.43 | +0.00 | +0.00 | +0.00 | unchanged throughout |
| Cohorts only / Recurring | 14.43 → 14.43 | +0.00 | +0.00 | +0.00 | unchanged throughout |
| Cohorts+Base / One-Off | 14.43 → **15.39** | +0.00 | +0.00 | +0.00 | 9 487 → 10 119, then unchanged |
| Cohorts+Base / Recurring | 14.43 → **15.39** | **+0.97** | **+0.98** | **+0.99** | 9 487 → 10 119 … 33 683 → 35 929 |

Retention ARPU moves **8.80 → 9.39** in the event month in all four, and in
every month for the two Recurring cases. **The effect is real and visible — on
the Retention line, which is the line the event names.**

### A4. Promotion dilution

**Different mechanism, and it does persist.** `buildPromoEvents:633` applies the
dilution **once at build** to the event's own `arpu`; site 4 (`:1590-1640`) then
carves a re-banded Retention promotion into `p_eventPools` at that rate, and
Base picks it up once the lag delivers it.

That is pinned green today in `view-apply-mounted-spec.tsx:2113-2145`:

- `lag: BASE is untouched at T — the lag has not delivered it`
- `lag: BASE carries it at T+1`
- `rebanded: the pool moves BASE ARPU at the LEAF` / `at ALL too` / `at the
  intermediate Corporate/All view`

**A gap in my own measurement, flagged rather than glossed.** My ad-hoc
re-banded promotion (2 000 subs, All/All, month 3) was applied on the volume
path — `appliedEventIds` carries it and retention rose 2 956 → 3 241 — but Base
ARPU did not move in any later month, which means no pool was carved on that
fixture. Site 4 is not gated by `idx > 0` (it sits after that branch closes), so
there is no structural reason for it. **I could not isolate why, and I am not
claiming the pool rule is broken**: the assertions above are green in the suite.
It is worth a follow-up in its own right.

### A5. Verdict per configuration

| configuration | verdict |
|---|---|
| **Cohorts only, One-Off or Recurring** | **BY DESIGN.** Site 8's `touchesBase` filter (`:1865-1866`) excludes a `cohorts` target from the `base` scenario. The effect lands on Retention, which is what "Cohorts" means. |
| **Cohorts + Base, One-Off** | **BY DESIGN.** `duration: one-off` means exactly one month (`:1751`); months after it are untouched because that is what the control says. |
| **Cohorts + Base, Recurring** | **WORKS** — Base moves every month from the event onward. |
| **against the pool rule** | **NOT a breach.** The rule governs `p_eventPools` and its T+1 delivery; a Pricing event creates no pool, and `baseARPU` is re-anchored each month by an explicit, commented design choice (Option A). |

**No EXPECTED.md heading states the pricing/Base relationship directly**, so the
"by design" claims above rest on the code's own recorded reasoning
(`:1645-1649`, `:1865-1866`, `:1925-1930`) rather than on a settled decision.
That is itself worth knowing: **the behaviour is deliberate but unrecorded**,
and Alessandro's report is the second time this session's programme has found a
correct engine with nothing on screen explaining it.

## Part B — "ramp then hold"

### B6. The Volume card's spread

**Available for percentage promotions too** — the spread is a row generator, not
an amount mode. `buildPromoEvents:636-640` builds `pcts`, and `:661` maps each
to its own month via `addMonths(baseDate, i)`. For a percentage promotion the
per-cent itself is divided across the ramp; the code says so at `:686-687`:

> *"For a percentage promotion this holds the PER CENT, spread across the ramp
> exactly as a percentage volume event's is."*

**Where it stops: at the last row.** N ramp months produce N `MarketEvent` rows
and nothing else. The month after the last row has **no event**, so the adjusted
line returns to the baseline's own trajectory — there is no tail, no decay and
no hold. `buildEventsSummaryRows` states the carrier-level reason:

> *"MarketEvent has no duration or roll-forward concept — one row is one month."*

### B7. Churn

`#### R7 — CHURN-TARGETED OUTFLOW: SIX DECISIONS (Jon, 2026-08-20)`, decision 3
verbatim:

> **3. The per-month figures are CUMULATIVE stated reductions, in POINTS of
> annualised churn** — prefilled linear to the target and editable per month, so
> 1/3/6 stays 1/3/6 rather than being renormalised. **A single month is a ramp
> of length 1**: one mode, no one-off/recurring fork. The HELD TAIL is open
> pending Alessandro — whether the last stated reduction simply persists, or
> more fold months can be added. There is no cliff either way.

**The request is the open question, and the entry names him.** Cumulative is
pinned (`churn-fold-spec.ts:149`, `:240`, `:244` — "the last month always equals
the target"), and decision 1 records that churn is "a WAY OF SAYING, not an
engine behaviour": per-month deltas are precomputed at save.

### B8. The 2026-09 promotion-duration decision

The text sits under `#### CARD PARITY — SEVEN DECISIONS (Jon, 2026-09-03;
recorded here 2026-09-03)` — **not a 2026-09-05 entry**; the passage itself says
"measured 2026-09-04". Verbatim:

> **THE DURATION HALF IS NOT BUILT, and the reason is structural — measured
> 2026-09-04, recorded for Jon to decide.** A promotion's price change is
> **baked into the event's own `arpu` at build time**; `promoPricingMode` and
> `promoPricingAmount` have **zero engine consumers** … A One-Off / Recurring
> control on the promotion's pricing arm would be a stored mode **nothing
> reads** — the `yieldArpuMode` failure R5 decision 3 exists to prevent, in its
> other direction.

### B9. What a hold would need, and the two readings

**Nothing to read it exists on any carrier.** A `MarketEvent` has no duration
field at all; `PricingEvent.duration` exists but is read at exactly two sites
(6 and 8), and a promotion never reaches the pricing pass. A hold therefore
needs **a new stored field plus a reader at every apply site**:

| carrier | what it would need | sites that must read it |
|---|---|---|
| Volume / Promotion | an end month, or a `holdFrom` flag — an end month is the honest one, because "forever" over a 24-month horizon is a different claim | apply sites 1, 3, 4 + Compare's equivalents; a new export column and its reader |
| Churn | nothing new *if* the answer is "the last reduction persists" — the fold already knows the target | `churnFold` + Compare's fold |

**The two readings, measured over 12 months** (Base volume delta, both events
scoped to the cohort so the pro-rata share is 1):

| month | (a) same % every month | (b) ramp's final level held |
|---|---|---|
| 2026-08 | +435 | +442 |
| 2026-09 | +874 | +884 |
| 2026-12 | +2 211 | +2 210 |
| 2027-03 | +3 582 | +3 536 |
| 2027-06 | **+4 978** | **+4 862** |

**Both accumulate into Base** — each month's inflow lands in the stock at T+1 —
but (a)'s monthly addition **grows with the baseline** while (b)'s is fixed at
the ramp-end level. They cross in 2026-12 and diverge from there: **2.4 % apart
at 12 months** on this cohort, and wider on any steeper baseline.

**They are different claims, not different implementations.** (a) says "10 % of
whatever happens"; (b) says "the 442 extra subscribers we reached, every month".
For churn, (b) is the natural reading — a *rate* held at its target. For a
volume promotion, (a) is. **That asymmetry is the decision**, and it is why one
flag across all carriers would be the wrong shape.

### B10. What would go red under a hold

| pin | where | why it moves |
|---|---|---|
| trap **96** | `guard-traps.ts:1200` — *"the churn fold rolls on the unadjusted outflow"*, "every ramp longer than one month drifts from the stated rate" | a held tail extends the ramp's reach |
| trap **107** | `:1683` — a churn ramp member can be row-edited | a hold adds months the ramp did not state |
| trap **102** | `:1254` — the churn add falls behind the spread gate | the gate would gain a case |
| `churn-fold-spec` | `:149`, `:240`, `:244` — cumulative prefill, "the last month always equals the target" | "last month" stops being the last |
| `view-apply-mounted` | the lag and re-banded pool block, `:2082-2145` | a held promotion keeps feeding pools |
| `amount-control-spec`, `survival-spec` | spread/ramp readers | new field in the read-set |

**Nothing pins "the month after the last ramp row is untouched"** — the current
end-of-ramp behaviour is a consequence of one-row-per-month, not an assertion.
A hold would not break a check that says so, because there isn't one.

## Limits

- **The trimmed fixture could not be used.** It carries **only `Fact_IBRO`** —
  raw actuals, no `Baseline_Forecasts` — and there is no exported forecast
  generator, so a read-only session cannot fit a baseline from it. Every
  measurement here runs the real engine on the **09 Sep 19:30 save's** real
  fitted baseline for SOHO / Mobile Voice instead. That is a deviation from the
  brief and the figures are that cohort's, not the trimmed file's.
- **A4 is not fully measured.** My own re-banded promotion did not carve a pool
  and I could not isolate why; the T+1 persistence claim rests on the code and
  on green assertions in `view-apply-mounted-spec`, not on a measurement I made
  today. Flagged in A4 rather than smoothed over.
- **Market events were excluded** from every run so the pricing and volume paths
  could be read without other pools moving the same columns.
- **The B9 table is Base VOLUME.** ARPU and revenue follow from it but were not
  tabulated; the two readings differ in volume first.
- **No verdict is a decision.** A5 calls three configurations "by design" on the
  code's own recorded reasoning, because no EXPECTED.md heading covers the
  pricing/Base relationship. If Jon wants "by design" to mean "settled", that
  entry does not yet exist.
