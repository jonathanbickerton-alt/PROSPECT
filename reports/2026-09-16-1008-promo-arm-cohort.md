# REQ-D6-07 clause 12 — the Promotion arm in cohort units: STOPPED after Item 1

## FOR ADVISOR

```
Generated: 2026-09-16 11:11 +0100 (UTC 2026-09-16 10:11)
Certifies: 362f927 (clause 12 recorded; no src/scripts change)
Repo: committed 362f927, pushed (origin in sync)
STOPPED after Item 1, on the brief's own condition: the preview seam
cannot carry a promotion draft. eventScopeSeriesFor has a yield-draft
slot and no market-draft slot; it forwards the tab's SAVED marketEvents.
Measured: delivered = fitted for any mix (13.8708 -> 13.8708, both mixes).
With the promotion spliced into the engine, the mechanism works: Inflow
ARPU at the PROMOTION's own month 13.8808 -> 16.5569 (3,000 subs),
-> 14.1925 (300 subs: shrinks), -> 15.5853 (dilution -20%).
Monotone: 5 blends across the band give 12.6230 ... 17.9561, strictly up.
FINDING: clause 7's read month is WRONG for promotions. The engine reads
a promotion's Inflow pool at its OWN month (:2224); at T+1 Inflow ARPU
is flat (13.8708 at every mix/volume) and the pool shows in BASE ARPU
(13.9710 / 13.8809 / 13.9347).
Retention promo, own month: Retention ARPU 13.8808 -> 17.6543.
DECISION FOR JON: which ARPU and month the promo lead names for an Inflow
promotion - Inflow at its own month, or Base at T+1. Reserved; not taken.
Build needs: a market-draft splice in the seam (engine sites stay 6).
Nothing built; the gate was not run (no gated file changed); ledger
untouched.
```

## 0. Base

`git status --short` — empty. `git diff 3510cc9 HEAD --stat -- src scripts` —
empty. (HEAD at the check was `89c8c8e`, the skeleton; the two commits after
`3510cc9` are this report's skeleton and the 0706 report.) Both are still
empty at close: this session changed no file under `src/` or `scripts/`.

## 1. Item 0 — clause 12 recorded

Appended verbatim under REQ-D6-07 and committed alone as `362f927`, before any
measurement.

## 2. Item 1 — measure first

Harness: `scratchpad/d612-promo.tsx`, read-only. It drives
`computeAdjustedForecast` directly on the trimmed fixture's Corporate|All, the
way the 0647 inventory harness did, with the promotion rows built by the card's
own exported `buildPromoEvents`. Tiers Low Value 5.8783 / Medium Value 12.2633 /
High Value 39.809. "Tilted to the top tier" = 10 / 20 / 70. Draft month
2026-10. All figures are UNROUNDED: `scenarioArpu.*.arpu` against the forecast's
`*Arpu.mean`.

### 1.1 The mechanism

How a promotion with a Value-mix arm reaches the cohort's ARPU, as the source
has it today (the brief's line numbers were "as recorded" and have moved):

- **The blended rate is baked in at build.** `buildPromoEvents` (:634) computes
  `blendTierMixOrNull(p.draftMix, tierArpu)` (:686) over the same effective-rate
  map the card blends (the card's own memo is :3088). That becomes the row's
  `arpu`, and `revenue = vol x arpu`.
- **Dilution is applied once, at build** (90e2162): `applyPricing` multiplies
  the blend by `1 + amount/100`, where a dilution's amount is the converted
  `dilutionAmountPct` (0% -> 20% gives -20.0000, measured). The engine never
  sees the mix or the dilution separately — only the resulting `arpu`.
- **The pools.** An Inflow promotion (apply site 3, :1814) becomes an event pool
  pushed at T+1 with `arpu = revenue / volume`, so it enters BASE the month after.
  A Retention promotion with an arm is `promoRebanded` (:690) and becomes its own
  pool in its OWN month (apply site 4, :1884).
- **The scenario ARPU.** `scenarioPools(scen)` (:2221) reads promotions whose
  `e.date === m.month` — the event's own month — into that scenario's ARPU,
  volume-weighted against the natural volume. That is what makes the effect
  shrink with volume.

**What the preview seam honours for a PROMOTION draft: none of it.**
`eventScopeSeriesFor(draft, excludeId, yieldDraft, excludeYieldId)` splices a
YIELD draft into the run and passes `marketEvents` through untouched. There is no
parameter through which a promotion draft could reach the engine. For a saved
promotion the seam honours everything above, because the engine does.

**Which month is read.** A Retention promotion moves Retention ARPU in its own
month, which agrees with clause 7. An Inflow promotion does **not** follow clause
7: its Inflow ARPU moves in its OWN month, and at T+1 the effect has left Inflow
ARPU and appears in Base ARPU. Clause 7 was written for yield events, which do
reach the NEXT month's inflow pool. Applied to promotions as written, it would
read a figure that never moves.

### 1.2 Six figures

**The seam as it is.** With no promotion-draft slot, the run is the same whatever
the mix:

| mix | Inflow ARPU @2026-11 | Base ARPU @2026-11 |
|---|---|---|
| even | 13.8708 -> 13.8708 | 13.8708 -> 13.8708 |
| tilted | 13.8708 -> 13.8708 | 13.8708 -> 13.8708 |

**That is the brief's STOP condition** — "the seam does NOT reflect the
promotion's mix at all (delivered = fitted with any mix)". The session stopped
after Item 1.

**The mechanism the build would need, measured.** The same promotion spliced
into `marketEvents`, which is what a market-draft slot in the seam would run:

| case (Inflow, tilted) | built arpu | Inflow ARPU @2026-10 (own month) | Inflow @2026-11 | Base @2026-11 |
|---|---|---|---|---|
| 3,000 subs | 30.9068 | 13.8808 -> **16.5569** | 13.8708 -> 13.8708 | 13.8708 -> 13.9710 |
| 300 subs | 30.9068 | 13.8808 -> **14.1925** | 13.8708 -> 13.8708 | 13.8708 -> 13.8809 |
| 3,000 subs, dilution -20% | 24.7254 | 13.8808 -> **15.5853** | 13.8708 -> 13.8708 | 13.8708 -> 13.9347 |

The six figures the brief asked for, at the month the effect actually lands:
fitted **13.8808**, delivered **16.5569** (3,000), **14.1925** (300), **15.5853**
(-20%). The effect shrinks about nine-fold with a tenth of the volume (+2.68 -> +0.31),
and the dilution lowers it. Everything behaves as clause 12 describes — at the
promotion's own month.

A Retention promotion, 3,000 subs tilted, at its own month 2026-10: Retention
ARPU 13.8808 -> **17.6543**; Base unchanged that month.

### 1.3 Monotonicity

Five blends across the band (`achievableTargetRange`, unlocked, 5.8783 -
39.8090), each solved to shares with `solveForTarget`, 3,000 subs, Inflow:

| blend | Inflow ARPU @2026-10 | Base ARPU @2026-11 |
|---|---|---|
| 5.8783 | 12.6230 | 13.8238 |
| 14.3610 | 13.9563 | 13.8737 |
| 22.8436 | 15.2896 | 13.9236 |
| 31.3263 | 16.6228 | 13.9735 |
| 39.8090 | 17.9561 | 14.0234 |

**Strictly increasing at both readings**, and close to linear (about +1.33 per
step on Inflow, +0.05 on Base). The bisection's assumption holds. At T+1, Inflow
ARPU is constant at 13.8708 for all five: monotone only in the trivial sense, and
useless as a solve target.

## 3. Item 2 — build

**Not started.** The brief made Item 2 conditional on 1.2 and 1.3 passing; 1.2
triggered the STOP.

What the build would need, stated so the next brief can plan against it:

1. **A market-draft slot in the seam** — `marketDraft?: MarketEvent[]` and
   `excludeMarketIds?`, spliced into `marketEvents` exactly as `yieldDraft` is
   spliced into `yieldEvents`. `computeAdjustedForecast` stays at 6 sites. The
   promotion `deliver` would be the seam's fifth caller, and it must build its
   rows through `buildPromoEvents`: a second row builder in the preview would be
   a second definition of what a promotion is.
2. **The read month (Jon's decision, below).** It decides which `rawArpuByMonth`
   key and which scenario the promotion `deliver` reads.
3. **A campaign is several rows.** A spread or ramp promotion emits one row per
   month, each carrying a fraction of the volume. A single "read month" names ONE
   of those rows' effect. Measured here with a one-month shape only; a
   multi-month shape was not measured.
4. `solveForCohortTarget` can be reused unchanged: its `deliver(blend)` is
   injected, and the promotion's delivered ARPU is monotone in the blend.

## 4. Gate

**Not run.** Nothing under `src/` or `scripts/` changed (diff against BASE
empty), so the suite, guard-traps, trap-anchors, i18n, survival, tsc, lint and
build would all certify the tree `3510cc9` already certified. The guard-traps
ledger was not rewritten, so there is no ledger to commit. The exact counts are
therefore unchanged from the 0706 report: `computeAdjustedForecast` 6,
`eventScopeSeriesFor` callers 4, `solveForCohortTarget` definitions 1.

## Where it STOPPED

After Item 1, on the brief's STOP condition in 1.2. Item 0 is committed. Item 2
(the build, its mounted cases (a)-(e), the re-aims and traps 252-254) was not
started.

**Decision needed from Jon (reserved, not taken):** for an **Inflow** promotion,
what should the lead's "{ibro} ARPU at {month}" read?

- **(A) Inflow ARPU at the promotion's own month.** This is where the effect
  lands and it moves as clause 12 describes (13.8808 -> 16.5569). It breaks
  clause 7's "the month after the draft's" for promotions only, so the two cards
  would name different months for the same scenario.
- **(B) Base ARPU at T+1.** Consistent with where the pool enters the standing
  cohort, but the effect is diluted into the whole base (13.8708 -> 13.9710) and
  the label would have to say "Base", not "{ibro}".

Clause 7 as written (Inflow at T+1) is not an option: measured flat.

## Limits

- **Harness figures, not mounted-card figures.** Like the 0647 inventory, the
  harness gives every scenario the same blended-ARPU history, so fitted Inflow,
  Retention and Base coincide (13.8808 at 2026-10, 13.8708 at 2026-11). On real
  data they differ. The mechanism and the directions carry over; the literals do
  not.
- **One-month shape, absolute volume, one cohort.** Not measured: spread/ramp
  campaigns, percentage amounts, a narrower slice, locks on the promotion mix.
- **The seam's no-slot finding is structural**, read from its signature and its
  `marketEvents` pass-through. The "as-is" rows show the consequence (identical
  figures for any mix); they do not exercise a parameter that does not exist.
- The harness lives in the scratchpad (`d612-promo.tsx`; output in
  `d612-out2.txt`) and is not committed.
