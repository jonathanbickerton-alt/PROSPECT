# R5 walk — four observations on the Pricing card, diagnosed

## FOR ADVISOR

```
Generated: 2026-08-17 12:16 +0100 (UTC 2026-08-17 11:16)
Verified against: 42f6625, branch main, tree clean (bar this report).
Repo: no source changed (read-only); this report committed ded1564, pushed
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before any check ran.
OBS 4 AND OBS 2 ARE ONE DEFECT, AND IT IS MINE (R5, b3795f3). Both read
  `newPricingEvent.amount`, which DILUTION MODE NEVER SETS — one writer only,
  the Direct-mode input (:4431), not rendered in dilution. So the Add button
  (:4581) blocks every clean dilution form and Preview (:4533) prints +0.0%.
THE NAME CORRELATION IS COINCIDENCE. Name is NOT a term in the disabled
  condition — there are exactly TWO: !month, and amount === undefined. Jon's
  successful add had a LEFTOVER Direct amount from before the mode switch.
OBS 1 IS A REAL DEFECT, DISPLAY-ONLY. The row (:4626) applies the FULL
  percentage to `originalBaseArpu`, a BLENDED figure, with no volume weighting;
  the apply path (:1200) does weight. Apply path CORRECT, row not.
OBS 1b: `originalBaseArpu` is snapshotted VIEW-scoped, not event-scoped
  (:2046) — the baseline shown depends on the filter set at save time.
OBS 3 EXPLAINED, NOT A DEFECT — pending one look. The chart is the ONE apply
  path, `pe.month <= m.month` (:1184), forecast months only (:778); a recurring
  2026-08 event cannot move 2026-07. Discriminator: the first X-axis label.
CROSS-CHECK THAT TIES 1 AND 3: the chart and the list row WILL disagree for a
  retention-scoped event, and the chart is the right one.
FIX SHAPE: one session for Obs 1+2+4 (all the pricing card's own display and
  gating); Obs 3 needs no code unless Jon's look says otherwise.
DECISIONS: 4 listed at close — chiefly whether the row shows the priced pool
  or the weighted blend, since that choice sets what Preview Impact shows too.
```

---

## Base check

`git rev-parse --short HEAD` → **`42f6625`**; the brief names `7e57a25`. One
commit apart, report-only (the R4 Repo-line fill) — the established pattern.
Tree clean bar this report. **Read-only: nothing changed, no gate run.**

---

## Observation 1 — the baseline/adjusted ARPU columns

**Verdict: DEFECT, display-only. The apply path is correct; the row is not.**

The pricing list row computes its two ARPU columns itself
([WhatIfTab.tsx:4626](src/components/WhatIfTab.tsx:4626)):

```js
const baseArpu = pe.originalBaseArpu;
const adjustedArpu = pe.inputMode === 'percentage'
  ? Math.max(0, baseArpu * (1 + amt / 100))
  : Math.max(0, baseArpu + amt);
```

**What those columns display is a BLENDED figure, not the priced pool.**
`originalBaseArpu` is snapshotted at save from
`chartData[month]['ARPU (Adjusted)']` ([:2046](src/components/WhatIfTab.tsx:2046))
— the whole month's blended ARPU for the current view. The row then multiplies
that blended figure by the full ratio.

**The apply path does not do this.** It volume-weights
([:1200](src/components/WhatIfTab.tsx:1200)):

```js
pricingARPU = (pricedVol * pricedARPU + (totalVol - pricedVol) * pricingARPU) / totalVol
```

with `pricedVol` selected by `cohortScope`. So for Jon's event — Cohorts Only,
Retention — the engine moves only the retention share of the blend, while the
row shows the full +6.67% (24.72 → 26.37 is exactly ×1.0667).

**So this is the second branch of the brief's question, not the first:** not a
labelling gap around a priced-pool figure, but a blended figure that skipped
the weighting, in a **display-only computation in the render** — not in the
apply path. Every pricing event whose scope is narrower than "everything"
overstates in this column, which is pre-existing; R5 makes it systematic
because a dilution event is retention-scoped by construction.

### 1b — a second-order problem in the same snapshot

`originalBaseArpu` comes from `chartData`, which is filtered by the **view**
(`viewSegment`/`viewProduct`/`viewChannel`/`viewTariff`), not by the event's own
dimensions. An event scoped to Corporate takes its baseline from whatever the
user's view filter happened to be at save time. The type comment calls it
"pre-event blended ARPU" and is accurate; nothing says *whose* blend.

### Which pool is 24.72?

**Not derivable read-only, and I will not guess.** It is by construction the
`ARPU (Adjusted)` of the **view-scoped** series at the event's month, after the
market and yield passes and before this pricing event. Establishing the number
for the edge fixture requires running the forecast pipeline; this session ran
nothing. What *can* be said without running anything: 26.37 / 24.72 = 1.0667
exactly, which confirms the full unweighted ratio was applied.

### Smallest-scope fix

Two candidates, and the choice is Jon's because they say different things:

1. **Show the weighted blend** — make the row read the same volume-weighted
   result the engine produces. Truthful about the month's ARPU, and matches the
   chart. Needs the event's priced/total volumes at that month, which the row
   does not currently have.
2. **Show the priced pool and label it so** — keep ×ratio, relabel the columns
   to say they describe the affected cohort, not the blend. Cheaper, and
   arguably more useful for judging the event itself, but then the row and the
   chart legitimately differ and the copy must say why.

**Not chosen here.** Note that whichever is picked also settles Observation 2,
because Preview Impact has the same ambiguity.

---

## Observation 2 — Preview Impact reads a field dilution never fills

**Verdict: DEFECT, and the same root cause as Observation 4. Mine, from R5.**

[WhatIfTab.tsx:4533](src/components/WhatIfTab.tsx:4533):

```js
const amt = newPricingEvent.amount ?? 0;
const mode = newPricingEvent.inputMode ?? 'percentage';
const adjusted = mode === 'percentage' ? baseArpu * (1 + amt / 100) : baseArpu + amt;
```

**`newPricingEvent.amount` is written at exactly one site in the whole
component** — the Direct-mode amount input,
[:4431](src/components/WhatIfTab.tsx:4431) — and that input **is not rendered in
dilution mode** (it sits in the `Direct` branch of the mode conditional). The
Dilution mode button sets `pricingMode`, `inputMode` and `cohortScope` and
never touches `amount`. The dilution inputs write only
`dilutionCurrentPct`/`dilutionTargetPct`.

So in dilution mode `amount` is `undefined`, `?? 0` makes it `0`, and the panel
computes `baseArpu × 1` — **Baseline 24.72 / Adjusted 24.72 / +0.0%**, exactly
what Jon saw, while the live line beside it correctly said +6.67% because that
line calls `dilutionAmountPct` directly.

**The computed dilution amount never reaches the draft at all.** It is computed
inside `handleAddPricingEvent` at save time
([:2064](src/components/WhatIfTab.tsx:2064)) and written onto the built event —
never back onto `newPricingEvent`.

### What Preview Impact SHOULD read in dilution mode

`dilutionAmountPct(newPricingEvent.dilutionCurrentPct,
newPricingEvent.dilutionTargetPct)` — the same shared function the live line and
the save handler already use. Then the two panels agree **by construction**
rather than by coincidence, which is the same argument that made
`promoEffectiveArpuMap` one definition in R3.

**Note the deeper agreement problem**, which is Observation 1 again: Preview
Impact also applies the percentage to the whole `baseArpu` with no weighting.
Fixing only the `amt` source would make Preview Impact agree with the *list row*
and both still disagree with the *chart*. Three surfaces, one of them right.

---

## Observation 3 — the chart gap

**Verdict: EXPLAINED, pending one look from Jon. No defect found in this path.**

The chart's adjusted series is `chartData`, produced by
`computeAdjustedForecast` ([:664](src/components/WhatIfTab.tsx:664)) — the **one
real apply path**, the same function the whole tab runs on. Its pricing pass
uses the predicate ([:1184](src/components/WhatIfTab.tsx:1184)):

```js
if (pe.duration === 'one-off') return pe.month === m.month;
return pe.month <= m.month;
```

**A recurring event cannot apply before its start month.** `'2026-08' <=
'2026-07'` is false. There is no second pricing path behind the chart — it is
the same one, so this is verified rather than assumed.

The series spans **forecast months only**: `baseForecast.months.forEach`
([:778](src/components/WhatIfTab.tsx:778)), with no historical rows prepended.

### The discriminator, for one look

**Read the first label on the chart's X axis.**

- **If it reads `2026-08`** — the forecast window starts at the event's month.
  The gap therefore begins *at* the start of the window because that is the
  event month, and the behaviour is correct. Nothing to fix.
- **If it reads `2026-07` and the two lines already differ there** — the
  divergence is **not** from this pricing event, which cannot touch July. Look
  for another event at or before July: a market event, or a yield event with
  `rollForward` (which applies from its month onward and could start earlier).

### A cross-check that ties this to Observation 1

For a retention-scoped event, the chart's gap at and after August should be
**smaller** than the +6.67% the list row prints, because the chart weights by
volume and the row does not. **If the chart's gap looks like the full 6.67%,
that is a new finding** and worth reporting — it would mean the weighting is not
biting where I read that it does.

---

## Observation 4 — the Add button, disabled with no reason given

**Verdict: DEFECT, mine, from R5 (`b3795f3`). Two layers, no feedback in either.**

### Every term, in order

**The button** ([:4581](src/components/WhatIfTab.tsx:4581)) — exactly **two**:

| # | Term | Blocks when | User-visible feedback |
|---|---|---|---|
| 1 | `!newPricingEvent.month` | no month chosen | **none** |
| 2 | `newPricingEvent.amount === undefined` | **every clean dilution form** | **none** |

**The handler** ([:2030](src/components/WhatIfTab.tsx:2030)), three further
silent `return`s that would still fire if the button were simply enabled:

| # | Term | Blocks when | Feedback |
|---|---|---|---|
| 3 | `isDilution && dilutionPct === null` | either figure absent or outside [0,100) | **none** |
| 4 | `!isDilution && amount === undefined` | Direct with no amount | **none** |
| 5 | `!newPricingEvent.month` | no month | **none** |

**Feedback exists for none of the five.** That is the defect the design
principle names: the action is refused and the refusal says nothing.

### Term 2 is the one Jon hit

`newPricingEvent.amount` has **one writer**, the Direct-mode input
([:4431](src/components/WhatIfTab.tsx:4431)), not rendered in dilution mode. So
a form filled out entirely in Dilution mode leaves `amount` undefined and the
button is disabled **however valid the dilution figures are** — including while
the live line beside it renders a correct +6.67%.

**The Event Name does NOT gate the add.** It is not a term in either layer; the
field simply writes `newPricingEvent.name`
([:4559](src/components/WhatIfTab.tsx:4559)). Jon's correlation is coincidence.

**The real discriminator is a leftover Direct amount.** Switching Direct →
Dilution does not clear `amount`, so a form that had a Direct figure typed
before the switch keeps it and the button enables; a form filled purely in
Dilution mode never does. That fits "one worked, two did not" without the name
having anything to do with it.

### Does any term differ between modes?

Term 2 is **mode-blind and should not be** — that is the bug. Terms 3 and 4 are
the only mode-aware ones, and they are in the handler, which is unreachable
while term 2 holds the button shut.

### Smallest-scope fix

Make the button's condition mode-aware, reusing the guard the handler already
has rather than writing a third rule — and **name the blocking reason**. A
disabled control with a message beside it is the principle satisfied; simply
enabling the button is not, because terms 1 and 3 would then fail silently in
the handler instead.

---

## Grouping

**One session: Observations 1, 2 and 4.** All three are the pricing card's own
display and gating, all three touch the same draft state and the same
question — *what number does this card show, and against what basis*. Fixing 2
without 1 would move Preview Impact into agreement with a row that is itself
wrong.

**Observation 3 needs no code** unless Jon's one look says the divergence starts
before the event month, in which case it becomes a separate diagnosis about
which event caused it.

## Decisions needed from Jon

1. **Observation 1 — which figure do the row's columns mean?** The
   volume-weighted blend (matches the chart, truthful about the month) or the
   priced pool with relabelled columns (cheaper, arguably more useful, but then
   row and chart differ by design and the copy must say so). **This choice also
   settles what Preview Impact shows**, so it is one decision, not two.
2. **Observation 1b — should `originalBaseArpu` be event-scoped rather than
   view-scoped?** It currently depends on the filter set at save time.
3. **Observation 3 — the first X-axis label**, per §3. One look discriminates.
4. **Observation 4 — confirm the fix is feedback, not just enablement**, so the
   other four silent terms get a reason too rather than only term 2 being made
   mode-aware.

## Limits of this check

Read-only: no source changed, nothing run, no gate, nothing mounted.
`Verified against:` names the commit rather than certifying it. Every claim is
source-read at `42f6625` with symbols and line numbers cited. **No figure from
the edge fixture was recomputed** — 24.72 and 26.37 are Jon's observations, and
the only arithmetic performed here is 26.37/24.72 = 1.0667, which needs no
fixture. Observation 3's verdict is conditional on a screen detail this session
cannot see, and §3 states exactly what to look at rather than assuming it.
