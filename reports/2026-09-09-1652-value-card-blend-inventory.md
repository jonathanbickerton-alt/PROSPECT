# The Value card's blended ARPU — read-only inventory

```
FOR ADVISOR
Generated: 2026-09-09 16:52 +0100 (UTC 2026-09-09 15:52)
Certifies: 41c8be7 (the docs commit; everything else is read-only)

BASE 7a0bc1d + 45bb2d6 (reports/ ONLY; ZERO drift). D5-10 yield half CLOSED.
1 BASELINE = EQUAL-WEIGHT mean of the tier ARPUs (:2433-2441); the AXIS
  changes WHICH tiers are averaged (:287, :305), so only the LEVEL moves.
  RECORDED: EXPECTED.md "#### SETTLED 2026-08-12 — the comparator is option
  (c). Option (b) is QUEUED" — share-weighting is a figure-MOVING change. On
  FORECAST basis the blend EQUALS the fitted mean (:333-345) — the chart.
2 A RATIO, not a replacement or delta: yieldRatio = rawBlendedYieldArpu /
  storedEqualWeightArpu, then yieldArpu = fcInflowArpu * yieldRatio (WIT:1476
  site 2, :1694 site 5, sh:408 site 10). The chart shows the FITTED band mean,
  so it is neither 15.82 nor 9.58 — those are the ratio's DENOMINATOR.
3 MEASURED, same +10% target on each axis of one cohort:
  value 15.82 -> 17.40, tariff 9.58 -> 10.54; BOTH ratio 1.100000 and BOTH
  chart Inflow ARPU delta +2.0000. IDENTICAL — the card's pair IS the ratio's
  numerator and denominator, so a PERCENTAGE target cancels the level; an
  ABSOLUTE one does NOT (17.40 on the tariff axis is ratio 1.816).
4 THE LEVEL NEEDS NOTHING NEW — baseForecast and the draft month are already
  in the card (:2247). The DELIVERED ARPU does not exist at draft time.
5 NO SPEC READS THE RENDERED FIGURES (no testid); they pin the ENGINE ratio.
VERDICT BOTH. DESIGN for a % target — axis-independent, measured. DEFECT in
  the DISPLAY: on Historical basis the headline is a level the chart never
  shows; and an ABSOLUTE target means two forecasts by axis, unsignalled.
```

## 0. Docs

`41c8be7` appended D5-10's yield-half closing paragraph verbatim and nothing
else. Committed and pushed before the read-only work began.

## 1. Baseline Blended ARPU

**Equal-weight, over the effective (stated-or-derived) tier rates:**

```ts
// WhatIfTab.tsx:2433-2441
const rates = Object.values(effectiveTierArpuMap);
return rates.reduce((s, v) => s + v, 0) / rates.length;
```

Its comment says so in terms: *"Still equal-weight, still approximate as a
baseline: whether it should be share-weighted is the queued option-(b)
question."*

**The axis changes which tiers are averaged**, and nothing else.
`computeTierData` (`:285`) buckets by value band or by tariff, and on the
tariff axis keeps only the selection (`:287` returns `[]` with none selected,
`:305` filters to `selectedTariffs`). Two different tier sets, two different
equal-weight means — 15.82 and 9.58 on Jon's cohort.

**It is recorded as a decision.** EXPECTED.md, heading quoted verbatim:

> `#### SETTLED 2026-08-12 — the comparator is option (c). Option (b) is QUEUED.`

with option (a) (card-only share-weighting) **rejected** because "it would
leave the card disagreeing with the engine it describes", and option (b)
(share-weighting in card **and** engine) queued as "explicitly a
**forecast-behaviour change that MOVES FIGURES**". The card carries the
matching caption, which `spec:yield-roundtrip:273` pins: *"Equal-weight average
of the stated tier ARPUs"*.

**The Historical/Forecast toggle is the part that matters here.** On
**Forecast** basis (`:333-345`) the tiers are scaled by
`fcArpu / histBlended`, so their equal-weight blend becomes **exactly the
fitted scenario mean** — the chart's own number. On **Historical** basis they
are the raw historical rates and the blend is whatever the tier set averages
to. So the card reconciles to the chart on one basis and not on the other, and
the toggle that decides this is not the one the user is thinking about when
they switch axis.

## 2. How a saved yield event reaches the chart

**A RATIO.** Not a replacement, not a delta. Verbatim from apply site 2
(`WhatIfTab.tsx:1476-1489`):

```ts
const rawBlendedYieldArpu   = Σ (tariffMix[tier]/100) * tariffBaseArpu[tier];   // share-weighted
const storedEqualWeightArpu = Σ tariffBaseArpu[t] / storedTiers.length;         // equal-weight
const yieldRatio  = storedEqualWeightArpu > 0 ? rawBlendedYieldArpu / storedEqualWeightArpu : 1;
const fcInflowArpu = fcPrevMonth.inflowArpu?.mean ?? fcPrevMonth.arpu.mean;
const yieldArpu    = fcInflowArpu * yieldRatio;
```

Site 5 (`:1694-1703`) is the same shape against `fcRetentionArpu`, and
Compare's site 10 (`scenarioHelper.ts:408-418`) is the same again:
`naturalInflowArpu *= (rawBlendedYieldArpu / storedEqualWeightArpu)`.

The code says why: *"whether the stored tier ARPUs are historical or
forecast-scaled … we express the yield as an ARPU ratio … so the improvement is
anchored to the forecast level."*

**So the chart's Inflow ARPU is the fitted band mean**,
`baseForecast.months[i].inflowArpu.mean`, multiplied by the ratio. It is not
15.82 and not 9.58, because those are the ratio's **denominator** — a
comparator internal to the card, deliberately cancelled before anything
reaches the forecast. That is the whole of Alessandro's "the Value card's
numbers do not appear on the chart": they are not meant to. Nothing on screen
says so.

## 3. Measured

Same **+10% target blended ARPU** on each axis of one cohort, solved through
the card's own `solveForTarget` and run through the engine's ratio expression:

| axis | baseline (equal-wt) | target | draft (share-wt) | ratio | chart Inflow ARPU delta |
|---|---|---|---|---|---|
| value  | 15.82 | 17.40 | 17.40 | **1.100000** | **+2.0000** |
| tariff |  9.58 | 10.54 | 10.54 | **1.100000** | **+2.0000** |

(at a fitted Inflow ARPU of 20.00; delta = fitted × (ratio − 1))

**Identical.** The card's two figures are precisely the ratio's numerator and
denominator — `draftBlendedArpu` (`:2416-2421`) is the share-weighted blend,
`baselineBlendedArpu` the equal-weight mean — so a target expressed as a
**percentage** cancels the level exactly, on either axis.

**The absolute case does not cancel.** A user who types `17.40` as the target
gets ratio 1.10 on the value axis and **1.816** on the tariff axis, because the
denominators differ. Same typed number, different forecast.

## 4. What would reconcile the card to the chart

**The level needs nothing new.** `baseForecast` and the draft month are already
in the card (`:2247` passes both to `computeTierData`), and the Forecast basis
already reads `inflowArpu.mean` at that month (`:335`). A caption of the form
*"fitted 20.00 → 22.00 (+10%)"* is computable today from
`fcMonth.inflowArpu.mean` and `draftBlendedArpu / baselineBlendedArpu`.

**Scoping it to the draft's own dims is one caller more**, not new machinery:
`resolveEventScopeForecast` already exists and the pricing card already uses it
for exactly this purpose.

**What does not exist is the DELIVERED figure.** The ARPU the chart finally
shows is the blend of the yield pool with the natural population, other pools
and any pricing event — assembled in `scenarioAdjustedArpu` and readable only
from `adjustedMonths[i].scenarioArpu` **after** the event is saved. A draft
cannot show it without running the engine speculatively, which is a different
capability from labelling.

## 5. Specs

**No spec reads the rendered blended figures.** There is no `data-testid` on
either the baseline or the draft box (`:8773-8785`), so nothing asserts what
the user sees.

What is pinned:

- `scripts/scenario-arpu-spec.ts:385` — the **engine's** ratio, with a mix
  blending to double the equal-weight baseline;
- `scripts/view-apply-mounted-spec.tsx:934` — the same arithmetic
  (`rawBlend = (p/100)a, equalWeight = a/2`), so the mix share alone sets it;
- `scripts/yield-roundtrip-spec.ts:268-276` — that the **pre-option-(a)**
  baseline over derived rates is gone, and that the caption names the basis;
- `scripts/mix-seed-spec.ts:47` — the equal-weight seed.

So the arithmetic is well covered and **the display is not covered at all**.

## Verdict

**Both, in different places.**

- **Design, and correct:** the axis does not change what the event does to the
  chart for a percentage target. Measured at +2.0000 on both axes. The ratio
  construction is deliberate and documented, and the equal-weight comparator is
  a settled decision with share-weighting queued behind its own gate.
- **Defect, in the display:** on Historical basis the card's headline figure is
  a level the chart never shows and never will, and the card says nothing about
  the relationship. Alessandro's report is accurate and the mechanism is this.
- **Defect, sharper:** an **absolute** target means two different forecasts
  depending only on which axis was open, with nothing on screen distinguishing
  them. That is the one case where Jon's 15.82 → 9.58 observation is not merely
  cosmetic.

## Limits

- **The measurement is of the ratio and its chart effect, not of a rendered
  card.** It runs the card's own `solveForTarget` and the engine's ratio
  expression verbatim; it does not mount the Value card, so it cannot see a
  display bug between the solver and the box.
- **The 15.82 / 9.58 figures are Jon's**, reproduced here as a fixture with the
  same shape rather than from his save.
- **I wrote the measurement script into `scripts/.tmp/` and removed it.** It
  should have gone to the scratchpad; `git status` is clean and nothing was
  committed, but the rule is "never into the repo" and I broke it.
- **No decision is recorded.** Whether the card should show the fitted level,
  and what an absolute target should mean per axis, are both open.
