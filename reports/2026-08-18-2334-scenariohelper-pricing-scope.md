# Scenario Compare — teaching its pricing pass target and cohortScope

## FOR ADVISOR

```
Generated: 2026-08-18 23:34 +0100 (UTC 2026-08-18 22:34)
Certifies: __PENDING__
Repo: __PENDING__
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before the base check.
BASE: HEAD 25705a5 vs the brief's 9c31227 — one commit, REPORT-ONLY.
HOUSEKEEPING NOT DONE — v3.3.2 IS ABSENT everywhere (docs/ holds only v3-3-1;
  nothing under Downloads or Desktop). Flagged and continued per the brief.
ITEM 3'S STOP DID NOT FIRE: the pass holds the SAME three volumes the What-If
  side weights over. Only the SHAPE is adapted at the call; nothing forked.
SHIPPED: scope through eventScopeMatchesView, weighting through
  pricedVolumesFor + applyPricingToBlend. Scenario Compare and What-If now
  agree about what a pricing event prices.
A SECOND DEFECT FOUND WHILE READING: the retired filter OMITTED Product_L2, so
  a one-tier event applied across every tier. Closed and asserted directly.
FIRST REAL MEASUREMENT OF R5's COMPOUNDING QUESTION on a real pass: two +10%
  retention events give 104.04, not 104.00 — it COMPOUNDS. Pinned as found.
base-only KEEPS the unweighted application, deliberately — it prices a pool
  this pass does not model, and a weight belonging to neither is the defect.
THIS PATH HAD NO GATE AT ALL until now, which is how it diverged unnoticed.
  scenarioHelper is now in guard-traps' TARGETS, so its traps can restore.
MY OWN GUARD LET A ZERO THROUGH — a 0 baseline made four ratio checks vacuous
  (near(0,0) is true for any multiplier). Caught by the run, tightened. §6.
YIELD PASS: same shape of gap, report-only (§5). Jon decides separately.
scenario-pricing 16/16 (new), guard-traps 83/83, active-cohort 23/23,
  pricing 116/116, mix-card 99/99, import-seam 36/36, lint and build clean.
```

---

## Base check

`git rev-parse --short HEAD` → **`25705a5`**; the brief names `9c31227`. One
commit apart, report-only. Flagged, proceeded.

## Housekeeping — v3.3.2 is absent

`docs/` contains **only** `PROSPECT-development-history-and-working-agreement-v3-3-1.md`,
and a search of `~/Downloads` and `~/Desktop` for `v3-3-2` / `v3.3.2` returns
nothing. **The commit the brief asks for cannot be made**, and v3-3-1 was
therefore not removed — deleting the old file while the new one does not exist
would leave the repo with no working agreement at all.

Flagged and continued, as instructed. (v3.3.1 arrived mid-session last time, in
a stray `Doc/` folder; nothing similar is present now.)

## The pass's materials, established before writing anything

Per the brief, read-only first.

**Volumes at the apply point.** The pricing pass runs after the base-stock and
pool passes, and holds:

- `m.uplifted.inflow`, `m.uplifted.retention` — the month's adjusted flows;
- `newBAdj` — the adjusted base pool;
- `blendedArpu` → `finalArpu` — the blend it starts from.

**These are the same three quantities `WhatIfTab` weights over**
(`m.uplifted.inflow`, `m.uplifted.retention`, `newBAdj`). So the shared
`pricedVolumesFor` needs only a **thin shape adaptation at the call** —
`{ inflow, retention, base }` — and no arithmetic is forked. **Item 3's stop
does not fire.**

**What the raw rows carry.** The pass reads *sheet* column names, not event
fields: `e.Segment`, `e.Product`, `e.Product_L2`, `e.Channel_L1`, `e.Channel_L2`,
`e.Tariff_L1`, `e.Tariff_L2`, `e.Target`, `e.Cohort_Scope`, `e.Input_Mode`,
`e.Amount`, `e.Duration` — carrying literal `'All'` for unset dimensions, exactly
as the 1406 diagnosis's event dump showed. The shared predicate treats a literal
`'All'` as a wildcard, verified over all 46,656 combinations, so those rows pass
through it unchanged.

## What shipped

### 1. Scope, through the shared predicate

The six inline comparisons are gone; `eventScopeMatchesView` decides, with the
raw column names mapped at the call.

**A second defect surfaced in doing it: the retired filter omitted `Product_L2`
entirely.** It compared segment, product, both channels and both tariffs — and
never the value tier. So an event scoped to *High Value* applied across *every*
tier in Scenario Compare. That was not in the R4 finding, which looked at
`target`/`cohortScope`; it was found by reading the filter line by line before
replacing it. The shared predicate closes it, and the spec asserts it directly
rather than leaving it implied by "we use the shared one now".

### 2. Weighting, through the shared functions

`pricedVolumesFor` selects what the event actually prices;
`applyPricingToBlend` weights it back into the month's blend. The same two
functions the What-If side calls.

**`base-only` keeps the unweighted application, deliberately.** That target
prices the base pool against the event pools inside it — a decomposition this
pass does not model — so `pricedVolumesFor` returns null and the code applies
the ratio directly rather than inventing a weight. A weight belonging to neither
population is the defect being fixed, and shipping one here would have been that
defect in a new coat.

### 3. No dilution branch

A dilution event arrives as an ordinary percentage event with the amount
precomputed at save. The spec asserts the pass contains **no** `Pricing_Mode` or
`pricingMode` reference — the same assertion shape the What-If apply loop
carries.

### 4. The spec — a path that had never been gated

`spec:scenario-pricing`, 16 checks, driving the **real** `computeScenarioForFilter`
over a constructed two-leaf session with round numbers, so every expectation is
a hand-computed literal.

| case | expectation |
|---|---|
| (a) prices everything | `A × 1.1` — `pricedVol === totalVol` is an identity |
| (b) retention-scoped | **`A × 1.02`**, and asserted **not** `A × 1.1` |
| (c) out of scope | unchanged; plus a **Product_L2** case |
| (d) dilution-born | `A × 1.0133…`, and asserted not `A × 1.0667` |
| (e) two events | measured — see below |

The cross-path agreement figure is **written out from the formula**, not obtained
by running `WhatIfTab`: two implementations agreeing because one was used to
score the other would prove nothing.

### 5. R5's compounding limit — measured at last

Case (e) pins the pass's **actual** combination behaviour rather than a preferred
one. Two retention-scoped +10% events on a baseline of 100:

```
measured: 104.040000    (compound 104.04;  flat would be 104.00)
```

**They compound.** The pass applies events in sequence against the running
`finalArpu`, so the second weights against the first's result. Recorded as
found, unchanged, with a check that the compound and flat figures actually
differ so the pin is not vacuous.

R5's compounding question has been carried as an unmeasured limit for four
sessions, because the What-If pass is unreachable without a mount. **This is its
first real measurement on a real pass** — and it agrees with what the What-If
pass was read to do, which is worth something even though it is a different
implementation.

## 5. The yield pass — report only, no fix

`scenarioHelper`'s yield filter has **the same shape of gap**:

```js
const segOk = ye.Segment === 'All' || vseg === 'All' || ye.Segment === vseg;
const prodOk = ye.Product === 'All' || !vprodL1 || ye.Product === vprodL1;
const ch1Ok = ye.Channel_L1 === 'All' || !vchanL1 || ye.Channel_L1 === vchanL1;
const ch2Ok = ye.Channel_L2 === 'All' || !vchanL2 || ye.Channel_L2 === vchanL2;
```

Four hand-rolled comparisons — **no `productL2`, no tariff dimensions**. That is
consistent with `YieldEvent`'s own shape (it carries neither), so unlike the
pricing case it is not obviously wrong; a yield event genuinely has no L2 or
tariff scope to honour. The gap is that the comparison is **private** rather than
shared, so it will drift the way the pricing one did.

Not touched — the brief scoped this to report-only, and widening would have put
an ungated second change in the same commit. **Jon decides its fate separately.**

## 6. My own guard let a zero through

The spec's first run reported `16 passed, 4 failed` with a baseline ARPU of
**0** — my fixture used `Arpu_Mean` where the pass reads `ARPU_Mean`.

The failure that matters is not the typo. My guard was
`if (typeof baseArpu !== 'number')` — and **0 is a number**, so the run
continued and four ratio checks passed *vacuously*: `near(0, 0)` is true for
every multiplier. Three of the four "passes" were meaningless.

Tightened to `!(baseArpu > 0)`, testing the property the checks actually depend
on. Recorded because it is the same species as the vacuous-check findings
elsewhere in this arc: a guard that admits the one value which makes everything
downstream trivially true.

## 7. Guard-traps 84 and 85, and a gap in the harness itself

- **84** disables the scope filter — every pricing event applies to every
  scenario. The shipped divergence, reproduced.
- **85** drops the weighting — the full ratio hits the whole blend. An
  out-of-scope event still does nothing, so the scope check stays green while
  the weighted check goes red: the two traps separate the two halves.

**`scenarioHelper.ts` was not in guard-traps' `TARGETS`.** It is now. Without
that it is not snapshotted, so a trap planted in it could not be restored and
would have left the file mutated — a stranded-mutation hazard the harness's own
`finally` block exists to prevent. The file had never been trapped before, which
is why nobody had noticed.

**This path had no gate at all until this session** — no spec, no trap, no
coverage — which is precisely how it diverged from the What-If side and stayed
diverged through the whole R4/R5 arc.

## Gate

```
scenario-pricing spec:   16 passed, 0 failed   (new; first gate on this path)
active-cohort spec:      23 passed, 0 failed
pricing-roundtrip spec:  116 passed, 0 failed
events-summary spec:     37 passed, 0 failed
mix-card spec (mounted): 99/99 passed
event-roundtrip spec:    69 passed, 0 failed
yield-roundtrip spec:    35 passed, 0 failed
import-seam spec:        36 passed, 0 failed
guard-traps:             83/83 caught          (84 and 85 caught first run)
lint (tsc --noEmit):     clean
build:                   clean, 10.04s
```

## Where things stand

**Scenario Compare and What-If now agree about what a pricing event prices.**
The R4 finding is closed for pricing.

**Numbers in Scenario Compare will move** for every pricing event narrower than
the scenario's scope, and for every dilution event. That is the correction
working, and it is recorded in EXPECTED.md so a later reader meets it as
intended rather than as a regression.

**Still open:** full path unification (the durable cure — this was the targeted
correction); the yield pass's private filter (§5); `spec:yield-roundtrip`'s
`toRow` is still a copy; `yieldArpuMode` still not restored on reopen.

## Limits of this check

**The cross-path agreement is pinned by construction, not by running both.**
Case (a) asserts the figure the shared weighting must give when
`pricedVol === totalVol`; it does not execute `WhatIfTab` and compare. Both
paths now call the same two functions, which is the stronger guarantee, but no
check runs them side by side on one input.

**The compounding measurement is of `scenarioHelper`'s pass**, not
`WhatIfTab`'s. They were read to behave the same way and now share the weighting
function, but the What-If pass remains unreachable without a mount, so its
compounding is still inferred rather than measured.

**The fixture is synthetic and minimal** — two leaves, one month, round numbers
chosen so expectations are exact. It exercises the arithmetic and the scope
rules, not the full pipeline's behaviour on real data.
