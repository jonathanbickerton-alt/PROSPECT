# Aggregate-view event impact + ARPU companion semantics (UAT-D2-03, D2-02)

## FOR ADVISOR

```
Generated: 2026-09-02 14:56 +0100 (UTC 2026-09-02 13:56)
Certifies: a4550bf
Repo: committed a4550bf, pushed (origin in sync)
BASE: HEAD e7e20c9 vs 1332's de947ad — one, REPORT-ONLY; no source drift.
PART A IS A MEASURED STOP-CONDITION: UAT-D2-03 IS NOT REPRODUCIBLE, no fix.
  On the real fixture, real column mapping, no test seam, a leaf-scoped +10%
  Inflow event moves ALL and the LEAF by the SAME 698.10 — coverage 0.271410
  x basis 25,721.10 = the leaf's own +10%. Absolute moves ALL too (+1,000.00
  both); adjusted basis the same. Bottom-up is HOLDING here.
THE WALK'S OWN CORROBORATION IS WEAKER THAN IT LOOKS: impactSummary's
  eventCount is marketEvents.length — the raw array, not what the engine
  applied. "1 event applied" renders identically at every view, including
  one where nothing applied. Not the cause; not changed; worth knowing.
A REAL LATENT ASYMMETRY, RECORDED NOT FIXED: eventProRataShare has a fallback
  for "no leaf under the target"; eventCoverage has none, so it returns 0 at
  an aggregate while the leaf shows full effect — the walked shape EXACTLY,
  when triggered. Unreached on this data; adding the fallback is Jon's call.
TO SETTLE IT: the walk's saved session, the stored event's seven scope
  fields, and whether ALL had a saved or derived forecast. Not more reading.
PART B ESTABLISHED AND FIXED (display only). Engine treats the companion as
  a RATE: % and absolute events adding the SAME 100 subs give BYTE-IDENTICAL
  ARPU (20.0000/20.0500/20.0400). Stored row carries a rate. fmtDelta keyed
  off isPercentage — which describes the VOLUME — so 25 rendered "+25.0%".
  One rate-only formatter for one cell; the three volume cells untouched.
GATE: guard-traps 122/122 (was 121) · 52 specs 0 failed · lint and build clean.
```

---

## Base check

`HEAD` **`e7e20c9`**; the 1332 report's Repo line names **`de947ad`**. One commit
apart and **report-only** (`reports/2026-09-02-1332-doc-v338.md`, its own fill),
with `git diff --stat de947ad..HEAD -- src/ scripts/ test-data/ package.json`
**empty**. No pricing-per-scenario report has landed, so `de947ad` is the base.

## Part A — UAT-D2-03, the aggregate shows no delta

### VERDICT FIRST: NOT REPRODUCIBLE. No fix made.

Driven against the real fixture with the real column mapping and no test seam,
**a leaf-scoped +10% Inflow event moves the aggregate by exactly the amount it
moves the leaf.** The two views reconcile to the penny:

```
monthly inflow   ALL = 25,721.10   LEAF = 6,980.95   ratio = 0.271410

% +10 on Corporate / Mobile Voice / Direct
  ALL view    baseΔ  698.10   applied=1   coverage 0.271410  basis 25,721.10
  LEAF view   baseΔ  698.10   applied=1   coverage 1.000000  basis  6,980.95

% +10, basis = ADJUSTED
  ALL view    baseΔ  698.10   LEAF view   baseΔ  698.10

ABSOLUTE 1,000 on the same scope
  ALL view    baseΔ 1000.00   LEAF view   baseΔ 1000.00
```

`0.271410 × 25,721.10 = 6,980.95`, so `+10%` lands as **the same 698.10 at both
levels**. That is bottom-up holding, not failing.

**This is a measured stop-condition, not a refusal to look.** The brief allowed
two outcomes — a defect to fix, or a decision to report. Neither is what the
measurements support, and fixing a mechanism I cannot demonstrate would be the
mirror image of trap 120's first aim: a change nothing can observe.

### The four measurements the brief asked for

| # | Question | Answer |
|---|---|---|
| 1 | The same event as a **SUBS** amount — does ALL move? | **Yes**, +1,000.00 at both views |
| 2 | The % event with **Percentage of Adjusted** — does ALL move? | **Yes**, +698.10 at both views |
| 3 | What `eventProRataShare` returns at the All view | **1** — the event's whole target lies inside the view, so the view takes all of it |
| 4 | What the KPI cards read at All | `chartData`'s last row: `Base (Adjusted) − Base (Baseline)`. The **event count is `marketEvents.length`** — see below |

**On (3):** 1 is the correct answer and not a bug. `eventProRataShare` is
`metric(view ∩ target) / metric(target)`; at the All view the target is wholly
inside the view, so the share is 1. Percentage events never use it — they use
`eventCoverage`, `metric(view ∩ target) / metric(view)`, which returned
**0.271410**. The two functions answer different questions and both answered
theirs correctly.

**On (4), one real observation that survives the non-reproduction.** The card's
`eventCount` is `marketEvents.length` — the raw array, **not** the events the
engine applied at this view:

```ts
const impactSummary = useMemo(() => {
  …
  return { baseDelta, arpuDelta, eventCount: marketEvents.length };
}, [chartData, marketEvents.length]);
```

So *"1 event applied"* renders identically at every view, including one where
the engine applied nothing. It is a caption that cannot disagree with itself,
which means the walk's *"1 event applied at both"* is **not** evidence the event
reached the aggregate. Whatever produced the walked zero, that caption would
have read the same. It is not the cause and I have not changed it — but it is
the reason the walk's own corroboration is weaker than it looks.

### Three hypotheses tested and killed

Each reproduced or failed to reproduce on measurement, not on reading.

**1. A scope/leaf mismatch — REPRODUCES THE SYMPTOM EXACTLY, but not on this
data.** Constructed by hand, leaves whose `product` carries an L1 the event's
`product` does not name:

```
coverage(event, ALL  view) = 0     share(event, ALL view) = 1
coverage(event, LEAF view) = 1

ALL view  (% 10)     baseΔ    0.00      ← the walked +0.00
LEAF view (% 10)     baseΔ   30.00      ← full effect, the walked shape
ALL view  (abs 30)   baseΔ   30.00      ← absolute still moves ALL
```

That is the walk, including the detail that absolute events would still work.
**But on the real fixture the event matches 15 leaves carrying 293,200 of
1,080,286 inflow, and coverage is 0.271410, not 0.** The mechanism exists; this
data does not trigger it.

**It is nonetheless a genuine latent asymmetry, and worth recording.**
`eventProRataShare` has an explicit fallback for "no populated leaf under the
event's target" — it returns 1 rather than discarding the event. `eventCoverage`
has fallbacks only for "nothing under the **view**" and "the view is zero on this
metric". When leaves exist under the view but none under the target, it returns
`0/inView = 0` with no fallback, and the module's own promise —

> Reconciliation holds by construction: each leaf takes the same percentage of
> its own value, and those sum to that percentage of the aggregate.

— fails silently to zero at the aggregate while the leaf shows full effect. Two
functions documented as siblings, one guarded against a case and one not.
**Not changed**: it is unreached on this data, and a fallback that changes what a
percentage event does at an aggregate is a semantics decision, not a repair.

**2. An aggregate with no known opening base stock.** Would explain a Base card
reading exactly 0.00 while the flows moved. Measured:

```
seed KNOWN 10000        Base 11800 -> 11830   baseΔ 30.00
seed UNKNOWN            Base  1800 ->  1830   baseΔ 30.00
seed UNKNOWN but 10000  Base 11800 -> 11830   baseΔ 30.00
```

Base is reconstructed from the flows regardless; the delta survives. Killed.

**3. The event filtered out at the All view.** The applicability filter is
maximally permissive there — every clause short-circuits on `vseg === 'All'` /
`!vprodL1` / `!vchanL1`. The engine reported `applied=1` at the All view in every
run above. Killed.

### What would settle it

The walk's session state, not more code reading. Three things would discriminate
between the surviving possibilities in one step: **the saved session file**, the
**event row as stored** (its seven scope fields verbatim), and whether the ALL
view had a **saved aggregate forecast or a derived one**. If the stored event
carries scope values no leaf matches — a tariff selection, or an L2 chosen while
the view was narrower — hypothesis 1 becomes the answer and the `eventCoverage`
fallback becomes the fix. Without that file I would be choosing which story to
believe.

## Part B — UAT-D2-02, the ARPU companion on a % event

### The engine is right, the stored row is right, the display was wrong

Measured **before** anything was changed, on two events that add the **same** 100
subscribers with the **same** stated companion of 25:

```
% 10  + companion 25   inflow 1000 -> 1100   ARPU 20.0000 / 20.0500 / 20.0400
abs 100 + companion 25 inflow 1000 -> 1100   ARPU 20.0000 / 20.0500 / 20.0400
% 10, no companion     inflow 1000 -> 1100   ARPU 20.0000 / 20.0000 / 20.0000
```

**Byte-identical.** A percent reading could not coincide with the absolute case:
100 new subscribers at a rate of 25 blended into ~10,000 at 20 gives +0.05, which
is what both produce. Read as a percentage, +25% of 20 would be 25.00 — three
orders of magnitude away. The no-companion control moves nothing, so the +0.05
is attributable to the companion and not to the added volume.

| Question | Answer |
|---|---|
| What the ENGINE does with 25 on a % event | Treats it as a **rate**; identical to the absolute case |
| What the row's formatter does, and where | `fmtDelta`, `WhatIfTab.tsx:5302`, applied to the ARPU Δ cell |
| What a stored row carries | `arpuOverride: 25`, `arpu: 25` — a **rate**, correct |

**So stored rows are correct and only the display was wrong.**

### The mechanism, in one line

```ts
const fmtDelta = (v: number) => isPercentage
  ? (v > 0 ? '+' : '') + v.toFixed(1) + '%'
  : (v > 0 ? '+' : '') + formatNumber(v);
```

`isPercentage` describes **`subscriberVolume`**. It is right for the three volume
cells — a 10% row must not print "+10" as if it were ten people — and wrong for
the ARPU cell, which is money per subscriber in either mode. One formatter, four
cells, two different units.

### The fix, and why it is in scope

A rate-only `fmtArpu` for that one cell. **Pure formatter**: no stored value, no
engine input, no comparison operand, and the three volume cells keep `fmtDelta`
untouched. The two rows now display alike because the engine says they **are**
alike.

**No semantics moved.** The companion gaining its own absolute/% mode is Jon's
decision and a separate build; this spec deliberately does not pin the mode, only
that today the companion is a rate in both modes and the row must say so.

`spec:arpu-companion` — 19 checks: the fixture discriminates (both events add the
same 1,100 inflow; the companion differs from the cohort ARPU), the engine reads
a rate in both modes with a no-companion control, `eventArpuDelta` returns 25 on
both and still dashes an unstated companion, and the row uses the rate formatter
while the three volume cells still use the percentage-aware one.

## Traps

**121 → 122.** Planted by hand and confirmed red before being trusted.

```
WITH 125 PLANTED (the ARPU cell pointed back at fmtDelta):
  arpu-companion spec: 17 passed, 2 FAILED
    FAIL  ROW: the ARPU cell uses it
    FAIL  ROW: and no longer uses the volume formatter
  restored -> 19 passed, 0 failed
```

**Aimed at the CELL, not at `fmtArpu`'s body.** Deleting the helper is a compile
error that anything would catch; silently calling the neighbouring formatter is
the mistake that actually happened and the one nothing else would notice.

**Part A's trap was not written.** The brief specifies "bypass pro-rata for %
events → literal red", conditional on finding a defect. There is no fix, so
there is nothing to guard, and a trap planted against correct behaviour would
assert that today's arithmetic is the only possible arithmetic — which is what
the pending `eventCoverage` question is about.

The positive control now covers `spec:arpu-companion`.

## Gate

```
guard-traps:          122/122 caught, 0 missed, 0 inconclusive   (was 121)
full suite:           52 specs, 0 failed
  new this session:   arpu-companion 19
  mix-card (mounted) 235   i18n-parity 194   pricing-roundtrip 117
  amount-control 91   event-roundtrip 86   walk-fixes 82   derive 75
  pct 72   compare-events-panel 71   mix-refusal-copy 68   scope 61
  churn-fold 56   yield-roundtrip 56   forecast-type-split 54
  step1-panel 54   interaction 46   compare-window 45   generate-missing 44
  events-summary 43   month-format 42   bulk-completion 40
  compare-render 40   cards 36   import-seam 36   nullrender 35
  coverage-copy 35   chart-scope 33   base-seed 31   provenance 29
  step2-unlock 26   retire 25   compare-filter 24   step1-selection 24
  active-cohort 23   prorata 21   skip 20   deletions 19   unscored 19
  challenger 18   mix 17   leafgrain 17   step3-transition 17
  scenario-pricing 16   edge 15   restore-base 15   triggers 14
  nav-target 13   i18n-scan (--check) exit 0
  mix-constraint / override-arpu / scenario-arpu: every check green
lint (tsc --noEmit):  clean
build:                clean (6.18s)
```

**Trap COUNT: 121 → 122**, id 125. The harness restored every file it mutated —
`fmtDelta(arpuDelta)` residue in `WhatIfTab.tsx` is **0**.

## Limits of this check

**Part A is a non-reproduction, which is weaker evidence than a diagnosis.** I
showed the engine reconciles under the conditions I could construct: the real
fixture, the real column mapping, the event scope as the brief describes it,
absolute and both percentage bases, tariff columns mapped and unmapped. I did not
reproduce Jon's session. A defect that needs a particular saved state is not
disproved by a fixture that lacks it.

**The walked figures were never matched.** +881.45 is the right order of
magnitude for +10% of a leaf's monthly inflow — my probe's equivalent is 698.10
on a different slice — but I never reproduced 881.45 itself, so I cannot say the
walked leaf figure and mine come from the same arithmetic.

**Part B's fix is unverified in a browser.** It is asserted at source and by the
engine measurements; nothing rendered the events table in this session. The
symptom is a string in one cell, and the spec pins the identifier that produces
it, but a screenshot would be better evidence than a regex.

**The `eventCoverage` asymmetry is recorded, not resolved.** It is a real gap
between two functions documented as a pair, it reproduces the walked symptom
exactly when triggered, and it is unreached on this data. Whether the fallback
should exist is a decision about what a percentage event means at an aggregate
when its target matches no leaf — Jon's, not mine.

**`impactSummary.eventCount` is unchanged.** It counts all events regardless of
view, so the "N events applied" caption cannot report a view-scoped truth. Not
touched because it is not the reported defect and changing what that caption
counts is a product decision.
