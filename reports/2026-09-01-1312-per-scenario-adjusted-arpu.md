# Per-scenario adjusted ARPU — the engine (chart-grid 1 of 2)

UAT findings D1-01 / D1-02.

## FOR ADVISOR

```
Generated: 2026-09-01 13:12 +0100 (UTC 2026-09-01 12:12)
Certifies: __HASH__
Repo: __REPO__
SKELETON FIRST. BASE: HEAD 5c4347c vs 1219's 8d00543 — one, REPORT-ONLY; no
  source drift since 4a1d110.
ITEM 0 MEASURED, GAP MATERIAL: on a two-leaf fixture driving the REAL
  deriveAggregate the flows-only blend reads 14.2168 where the honest all-four
  Srev/Svol is 11.3261 — +25.52%; a hand re-blend lands on 14.2168 EXACTLY,
  confirming the mechanism. NOT CORRECTED — it feeds the settled pricing
  baseline, so correcting it is its own decision.
THE PER-SCENARIO AGGREGATES ARE ALREADY CLEAN, same run: the three flows match
  their own-volume expectation exactly and baseArpu 10.6522 is the DERIVED
  running base — the argument for building beside the blend, not on it.
I CORRECT MY OWN 1219 REPORT: the yield filter is BY DESIGN — YieldEvent.ibro
  is 'Inflow' | 'Retention' and BOTH have branches (:977, :1146), not one.
BUILT: src/utils/scenarioArpu.ts, pure — four quantities ALONGSIDE the blend.
  The engine block runs AFTER pass F and only READS, so the blended column is
  untouched BY CONSTRUCTION. Two yield ratios HOISTED, not recomputed.
  spec:scenario-arpu NEW, 47 checks, no mount; its fixture is asserted to
  DISCRIMINATE first and its blend matches none of the four.
THE GATE CAUGHT A REGRESSION I INTRODUCED — trap 77 (pre-existing) went MISSED
  because its spec's evidence was `>= 4` call sites, not `=== 4`. My block
  legitimately added two, so one deletion still cleared the floor. That `>=` was
  ALREADY against this codebase's rule; re-aimed to === 6; 113/113 after.
Traps 110 -> 113. GATE: 113/113, fourteen specs, mount 195/195, lint+build.
```

---

## Base check

`HEAD` **`5c4347c`**; the 1219 report's Repo line names **`8d00543`**. One commit
apart, `--stat` confirms **report-only**. `git diff --stat 4a1d110..HEAD -- src/
scripts/ test-data/` is **empty**, so neither STOP condition fired.

## The decisions, recorded

Written to `EXPECTED.md` **before any code**, dated **Jon, 2026-09-01**, as three
blocks: the chart-grid decisions (service revenue as the ARPU numerator, the
two-row control, Base's three measures and its labelled T+1 lag, the blended
ARPU retired *from the chart display* with `ARPU (Adjusted)` unchanged, the
"all scenarios" definition fixed in advance, Step 2 only, export additive, yield
on non-Retention unextended); the three-denominators finding; and the
per-scenario engine rules.

**The pricing baseline is explicitly preserved in the record**, not merely in
the code: *"this decision retires a line from a chart, not a quantity from the
engine"*, with `7b456a1` named.

## 0. The measurement, before building

A two-leaf fixture driving the **real** `deriveAggregate`. L1 is base-heavy and
cheap on base; L2 is flow-heavy and rich on it — chosen so the two blends cannot
coincide.

```
leaf L1  blended ARPU 10.5108   flows 300    base 9000
leaf L2  blended ARPU 14.7727   flows 2000   base 200

(A) deriveAggregate's aggregate 'arpu'  : 14.2168
(C) hand-computed flows-only re-blend   : 14.2168   <- confirms (A)'s mechanism
(B) honest all-four Srevenue/Svolume    : 11.3261

GAP (A) vs (B) : +2.8907  =  +25.52%
```

**The gap is material, not academic.** The true-state report flagged that this
needed measuring before anything was built on it; twenty-five per cent is an
answer that changes how the finding should be read.

**(C) matching (A) to four decimals is the load-bearing part.** It confirms the
mechanism is exactly what the source reading claimed — leaf blends re-weighted
by `inflow + outflow + retention` — rather than some third thing that happens to
differ from (B).

**Not corrected, deliberately.** The aggregate blend feeds the settled pricing
baseline (`7b456a1`, gated 2026-08-21). Correcting it moves stored figures on a
surface that is four days old, and that is its own dated decision. Recorded in
`EXPECTED.md` under its own heading so the next reader meets it as a known
state rather than discovering it again.

### The per-scenario aggregates are already clean

Measured in the same run:

```
inflowArpu     produced 13.8      expected 13.8000   MATCH
outflowArpu    produced 9.3333    expected 9.3333    MATCH
retentionArpu  produced 16.7647   expected 16.7647   MATCH
baseArpu       produced 10.6522   = (10x9000 + 40x200) / 9200
```

Each matches its **own-volume** expectation exactly, and `baseArpu` matches the
**derived running base** rather than the seed or any flow. This is the whole
argument for building the new measures beside the blend rather than on top of
it: each per-scenario quantity has exactly one denominator by construction, so
the split above cannot propagate into them.

### The yield filter — design, and a correction to my own report

**By design.** `YieldEvent.ibro` is typed `'Inflow' | 'Retention'`
(`forecasting.ts:779`, and the import reader at `:1235` defaults to `'Inflow'`).
There are exactly two members and **both have branches**: the Inflow yield pool
at `WhatIfTab.tsx:977` and the Retention blend at `:1146`. Together they cover
the type.

**The 1219 true-state report was wrong on this point.** It found the Retention
filter, read it as admitting only Retention, and reported yield on the other
three scenarios as "not well-defined". It saw one of two branches. There is no
gap, nothing is unreachable, and the decision recorded today — *"existing
behaviour, not extended here"* — is a decision to leave something correct alone
rather than to defer something broken.

## 1. The engine

### The module

`src/utils/scenarioArpu.ts`, pure — numbers in, numbers out, no React, no store,
no mount. It exports `scenarioAdjustedArpu` (one scenario, one month) and
`aggregateScenarioArpu` (Σrevenue ÷ Σvolume over leaves).

The order inside it is the engine's own order and is documented as load-bearing:

```
natural = baselineArpu x (yieldRatio ?? 1)
blended = (natural x naturalVol + S pool.vol x pool.arpu) / totalVol
priced  = pricing deltas applied, in order
```

Reorder these and a percentage price rise starts compounding against a pre-yield
figure.

**Absence is a reason, never the blend.** `band-absent` (a pre-schema forecast
carrying no band) and `no-volume` (a rate over nothing) are distinct, and
band-absence outranks no-volume so the cause named is the right one.
Substituting the blended figure would make *"the inflow ARPU is 24.10"* and
*"we do not know the inflow ARPU"* render identically — the two-meanings-of-null
defect at a fifth site.

### The wiring, and why the pin holds by construction

The block sits **after pass F**, below `m.uplifted.arpu = pricingARPU`. Every
line that produces the blended figure is untouched; the block only reads values
the engine has already settled. **The pricing card's feed is preserved by the
shape of the change, not by care taken while changing it** — there is no edit to
be careless about.

Two additions were made above it, and only two: `m_inflowYieldRatio` and
`m_retentionYieldRatio` are declared at the top of the month loop and assigned
one line each inside the existing yield branches. **Hoisted rather than
recomputed** — two implementations of one ratio is the shape this codebase has
removed five times, and a hoist cannot drift.

### Per kind, as recorded

| Kind | Effect | Site |
|---|---|---|
| **Market** | The pool's own rate (`revenue / subscriberVolume`) enters **the event's own scenario** and no other; natural volume is the scenario's uplifted volume minus the pooled part. | `poolsFor` |
| **Yield** | The hoisted ratio multiplies the natural ARPU — Inflow and Retention only, the existing filter unchanged. | `m_*YieldRatio` |
| **Pricing** | Mapped by `target` / `cohortScope` onto the scenarios those fields **already name**. `base-only` reaches base alone; outflow is reached by nothing. | `pricingFor` |
| **Churn** | Outflow **volume** only. Outflow is rate-inert: no pricing target names it and yield does not carry it. | — |
| **Dilution** | A retention-scoped pricing event, so it falls out of the pricing rule with no special case. | `pricingFor` |

`pricesPools` carries the engine's own distinction — a `base-only` event prices
the standing base and leaves event pools at their own fixed rates — as a **flag
read from `target`** rather than a second derivation.

**Base weights by the adjusted running base stock** (`newBAdj` less the pooled
part), mirroring the baseline's own-volume rule, and is floored at zero as the
baseline recursion is.

## Specs

**`spec:scenario-arpu`, new, 47 checks, pure.** No mount: the engine is an
exported function over plain arguments, so the measure UAT asked for is
asserted against hand-written literals directly. The mount is for the control
row and belongs to session 2.

**The fixture is asserted to discriminate before anything is asserted on it** —
all four scenario ARPUs distinct and non-zero, the three flow volumes distinct
and non-zero, and **the blend (20) deliberately matching none of the four**. A
block that read the wrong quantity therefore cannot pass. This arc has already
lost a session to a fixture whose ARPU was zero everywhere.

The invariants, all green:

- **No events → each per-scenario ARPU IS its baseline band**, tested by exact
  equality rather than `near()`. The Option-A anchor property, per scenario.
- **Aggregate = Σrevenue ÷ Σvolume**, with the two candidate answers asserted
  to differ first (mean-of-rates 20 vs weighted 12), then
  `aggregate ARPU × aggregate volume === Σ(leaf ARPU × leaf volume)` to the
  penny — the never-averaged rule made checkable. An absent leaf contributes
  **nothing**, not a zero rate.
- **Isolation, each asserted as a positive and a negative.** A market event on
  Inflow moves inflow ARPU *toward the pool rate* and moves no other; a
  dilution moves retention by exactly −10% and nothing else; a base-only
  pricing event moves base by exactly +10% and nothing else; a churn ramp moves
  outflow **volume** while outflow **ARPU** stays identical.
- **The pin, by literal.** `ARPU (Baseline)` and `ARPU (Adjusted)` are asserted
  `=== 20` in both months — hand-computed from the fixture, not copied from a
  run — plus the layer proof that the blend equals none of the four
  per-scenario figures.

## Traps

**110 → 113.** Three added; `scripts/scenario-arpu-spec.ts` registered as a
positive control and `src/utils/scenarioArpu.ts` added to `TARGETS` so a trap
planted there is snapshotted and restored.

- **114** feeds the blended figure into a per-scenario slot. Caught by the
  no-event identity — and only because the fixture's blend matches none of the
  four, which is why that assertion runs first.
- **115** weights base ARPU by inflow instead of the adjusted base stock.
- **116** alters the blended column's formula. **The pricing pin goes red while
  every per-scenario check stays green** — that pairing is the layer proof, and
  only a trap leaving one half green can demonstrate it.

### Trap 115 is caught by a different check than the brief predicted

The brief expected the aggregate-equals-leaf-sum literal to catch it. It does
not: that check exercises `aggregateScenarioArpu` over hand-built leaves and
never touches the engine's weighting choice. What catches 115 is the **base
volume** assertion — *"base volume IS the adjusted base stock, not a flow"* —
because revenue is ARPU × volume and the mutation makes the volume a flow.

Recorded because a trap and the check that catches it not being the predicted
pair is worth knowing: the prediction was about the right property and the wrong
assertion.

## The gate caught a regression I introduced — trap 77 MISSED

**The first guard-traps run reported 112/113**, and the one that did not catch
was **trap 77**, which predates this session: *"the pricing apply path stops
filtering by scope"*.

### What happened

Trap 77 deletes this line from the pricing apply pass:

```ts
if (!eventScopeMatchesView(pe, viewScopeForMatch)) return false;
```

and expects `spec:pricing-roundtrip` to go red. The spec's evidence was a
**call-site count**:

```ts
(tab.split('eventScopeMatchesView(').length - 1) >= 4
```

**`>= 4`, not `=== 4`.** With four sites, deleting one gave 3 and the check
failed — so the trap caught, and had caught for as long as the count sat
exactly on the floor.

My per-scenario block added **two** more call sites (`poolsFor` and
`pricingFor`, both filtering through the same shared predicate, which is the
right thing for them to do). The count became 6. Trap 77 deleted one, leaving
**5 — still `>= 4`** — so the spec stayed green and the trap was **MISSED**.

### Why it is worth a section

**The `>=` was already against this codebase's own recorded rule** — *exact
counts, never `>=`* — and it had been latent since the check was written. It
took an unrelated addition to make it bite, and what it protects is not small:
trap 77 guards the scope filter whose absence is the `scenarioHelper`
divergence reproduced on the side that gets it right.

**A floor cannot tell you a site was removed once anything else has been
added.** That is the whole content of the rule, and this is the first time the
project has seen it fail rather than merely asserted it.

Re-aimed to **`=== 6`**, with the six sites named in the comment: the pricing
apply pass, three carriers in the tooltip, and the two new ones. **Re-aimed, not
relaxed** — and the re-run confirms **113/113**, trap 77 back to CAUGHT.

### One more anchor is now non-unique, and is left alone

Trap 77's own anchor string appears **twice** in `WhatIfTab.tsx` since my block
added a second copy (lines 1230 and 1311). `String.replace` takes the first, and
the original is first, so the trap still mutates the intended site. **It is
correct today and fragile tomorrow**: if a later edit moves the per-scenario
block above the apply pass, the trap would silently mutate the wrong line.

Not changed here — it is a pre-existing trap outside this brief's scope, and
changing a trap's anchor while its own spec is being repaired in the same
session would make the repair harder to read. **Recorded as a known fragility**
for whoever touches trap 77 next.

### A second count anchor moved, and was re-aimed the same way

`spec:events-summary` pins the number of month-sorts in `WhatIfTab.tsx` at 3;
`pricingFor` legitimately adds a fourth, because a percentage price delta
compounds and the order it lands in changes the answer. Re-aimed to **4** with
all four sites named. That one behaved exactly as a count anchor should: it went
red the moment the code moved, which is what told me about it.

## Gate

```
scenario-arpu (new):     47/47 passed
guard-traps:             113/113 caught, 0 missed, 0 inconclusive   (was 110)
mix-card (mounted):      195/195 passed (unchanged)
full suite:              fourteen specs, 0 failed
  scenario-arpu 47 (NEW)   churn-fold 56   amount-control 91
  event-roundtrip 86   events-summary 43   compare-render 40
  compare-events-panel 71   compare-window 45   compare-filter 24
  yield-roundtrip 56   scenario-pricing 16   active-cohort 23
  import-seam 36   pricing-roundtrip 117
lint (tsc --noEmit):     clean
build:                   clean (11.17s)
```

## Where things stand

**The engine half is done.** Four per-scenario adjusted ARPU and revenue
quantities are carried on every adjusted month, alongside an untouched blend.

**Session 2 is the chart**: `chartData` columns, the two-row control, locale
strings in six languages, and the export. None of it was started here — the
brief forbade adding columns "while you're there", and none were added.

**Open:** the three-denominator correction (its own decision); DQ; Compare and
Overall Forecast as separate scopes.

## Limits of this check

**Pure, not mounted.** The arithmetic is driven directly through
`computeAdjustedForecast`; nothing renders. Whether a chart *displays* these
figures correctly is session 2's question and is not evidenced here.

**One fixture shape.** Two months, one cohort, no aggregation through
`deriveAggregate` in the engine path — the aggregate rule is exercised on
`aggregateScenarioArpu` directly. A multi-leaf run through the real aggregation
with per-scenario adjusted figures is not driven.

**Yield is asserted through the hoist, not through a yield event.** The
isolation specs cover market, pricing, dilution and churn. A yield event's
effect on per-scenario ARPU is wired and typechecked but has no spec of its own;
it was not in the brief's invariant list and I did not add one beyond scope.

**The 25.52% gap is one fixture, constructed to diverge.** It proves the split
is material *when leaves disagree sharply on base weight*. It is not an estimate
of the error on Jon's real data, and should not be quoted as one.
