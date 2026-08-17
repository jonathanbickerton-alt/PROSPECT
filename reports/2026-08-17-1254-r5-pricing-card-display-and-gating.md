# R5 — the Pricing card's display and gating

## FOR ADVISOR

```
Generated: 2026-08-17 12:54 +0100 (UTC 2026-08-17 11:54)
Certifies: 8f3b34e (body written PRE-commit; only these 2 lines added after)
Repo: committed 8f3b34e, pushed (origin in sync)
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before the base check.
BASE: HEAD 80489fc vs the brief's ded1564 — one commit, REPORT-ONLY.
ITEM 2 DID NOT FIRE — chartData already carries Inflow/Retention/Base
  (Adjusted), the exact three the apply path weights over. Nothing approximated.
ONE WEIGHTING DEFINITION: applyPricingToBlend, EXTRACTED from the apply path,
  which now calls it at BOTH its sites; the row and Preview Impact call it too
  via pricingAdjustedBlend. Three surfaces, one arithmetic.
ONE GATING PREDICATE: pricingDraftBlockReason returns an i18n KEY or null, read
  by the button AND the handler. The mode-blind term is gone; five terms are one.
THE REASON IS RENDERED beside the disabled button. Enabling instead would have
  moved the silence into the handler, which decision 2 rejects.
ABSENCE IS STATED: base-only prices a pool the display cannot decompose, so it
  renders an em-dash with a reason rather than an unweighted figure.
originalBaseArpu IS NOT DISPLAY-DEAD — the row's BASELINE column still reads it
  (:4709). Kept, not retired; Obs 1b (view-scoped snapshot) STILL OPEN.
STALE DIRECT AMOUNT now cleared at the mode switch — the mechanism behind the
  walk's phantom "the one with a name worked".
A SPEC CHECK OF MINE FAILED ON CORRECT CODE — a 600-char window, real gap 823.
  Re-aimed to the button's own handler; recorded, not quietly widened.
pricing-roundtrip 78/78 (was 47), guard-traps 73/73, events-summary 37/37,
  mix-card 99/99, event 69/69, yield 35/35, lint + build clean, i18n verified.
NOT MOUNTED: the card still has no mounted harness — function + wiring pins.
```

---

## Base check

`git rev-parse --short HEAD` → **`80489fc`**; the brief names `ded1564`. One
commit apart, report-only (the diagnosis's own Repo-line fill). Flagged,
proceeded.

## Decisions recorded

Two, in `test-data/EXPECTED.md`, before any code: the row and Preview Impact
show the **volume-weighted blend** — three surfaces, one definition; and the
gating fix is **feedback, not enablement**.

## Item 2 first — the volume source, established before anything was built

The brief made this a stop condition, so it was the first thing checked.

**It does not fire.** The apply path weights over `m.uplifted.inflow`,
`m.uplifted.retention` and `newBAdj`
([WhatIfTab.tsx:1194-1198](src/components/WhatIfTab.tsx:1194)), and the chart
row it writes carries exactly those three:

```
'Inflow (Adjusted)':    m.uplifted.inflow
'Retention (Adjusted)': m.uplifted.retention
'Base (Adjusted)':      newBAdj
```

So `chartData[month]` — the series the display **already reads** for its
baseline — carries the truthful volumes. `monthVolumes(month)` reads them and
nothing is approximated.

**One loss, stated:** chart rows are rounded to 2dp on the way in, so the
weighting runs on 2dp volumes. That moves a displayed ARPU by far less than a
penny, and a second unrounded series to avoid it would be a worse trade.

## What shipped

### 1. One weighting definition

`applyPricingToBlend(pricedVol, pricedArpu, totalVol, blendArpu)` — **extracted
from the apply path**, which now calls it at both of its sites, byte-identical
(the degenerate guard `totalVol > 0 && pricedVol > 0` became an early return of
the untouched blend, which is what the old `if` did).

`pricedVolumesFor(event, volumes)` makes the same `target`/`cohortScope`
selection the apply path makes, and `pricingAdjustedBlend` composes the three
steps in the apply path's order.

**Why extraction rather than a correct second implementation.** The engine was
already right; only the displays were wrong. Two correct implementations would
have been two things to keep correct — and the row proves a display will not
stay correct on its own, because it already drifted. Now a single edit to the
weighting moves all three surfaces together, which is exactly what guard-trap
74 demonstrates.

### 2. Preview Impact

Sources its amount from `dilutionAmountPct(draft figures)` in dilution mode —
the same shared function the live line and the save handler use — then feeds
`pricingAdjustedBlend`. The +0.0%-beside-+6.67% contradiction is gone, and the
two panels now agree **by construction** rather than by coincidence.

An incomplete dilution pair renders the same "enter both figures" line the
control area shows, rather than computing against a zero.

### 3. Absence, where the figure cannot be stated

`base-only` events price the **base pool against the event pools inside it** —
a decomposition the display does not hold and cannot rebuild from month
volumes. `pricedVolumesFor` returns `null` for that target, `pricingAdjustedBlend`
propagates it, and both surfaces render an em-dash with a reason.

Substituting the unweighted figure there would have reintroduced the very
defect being fixed, in a new place, which is the trap the brief's item 2
warned about arriving through a different door.

### 4. The gating — one predicate, and it speaks

`pricingDraftBlockReason(draft)` returns an **i18n key naming the reason**, or
`null`. Read by the button's disabled state, by the message beside it, and by
the handler's guard.

The diagnosis found five terms across two layers that disagreed: the button's
`amount === undefined` was **mode-blind**, so a valid dilution form could never
reach a handler that would have accepted it. There is now one rule, and it is
mode-aware — dilution validity is `dilutionAmountPct` non-null; Direct validity
is `amount` defined; month always.

**Incomplete and out-of-range are different sentences** — "you have not
finished" and "that cannot be" are different situations for the user, and
collapsing them would be the same class of loss as collapsing unset into zero.

**The handler keeps no second copy**; it calls the predicate. The spec pins the
call-site count at two.

### 5. The stale Direct amount

Cleared at the Direct → Dilution switch, per the R3 stale-draft-key precedent: a
figure that belongs to the other mode should not outlive it.

This is the mechanism behind the walk's phantom correlation — a leftover amount
was silently deciding which forms could be added, which is why "the one with a
name worked" looked like a pattern. Removing it removes the confusion as well
as the defect.

### 6. `originalBaseArpu` — NOT display-dead

The brief asked whether the view-scoped snapshot is still load-bearing. **It is.**

`WhatIfTab.tsx:4709` — the row's **Baseline ARPU** column reads it, and that is
still the right figure: the blend *before this event*, which the current series
cannot supply because it already includes the event. Other readers:
`App.tsx:1335` (blank-draft init), `forecasting.ts:741`/`:778` (export/import).

**Kept, not retired, and not repurposed.** Observation 1b — that the snapshot is
taken at the *view* scope rather than the event's — is **still open** and
unchanged by this session. It is a separate decision about what the baseline
should be scoped to, and quietly changing it while fixing the adjusted column
would have been two changes wearing one commit.

### 7. Guard-traps 74 and 75

- **74** drops the weighting inside the shared function. Before the extraction
  no single edit could have been caught on both the engine and the display;
  now one is.
- **75** makes the block predicate always-addable — the button gates nothing and
  the reason renders nothing, so a draft reaches a silently-returning handler.
  That is the pre-fix behaviour with an enabled button, which is precisely the
  shape decision 2 rejects.

Both anchors verified unique before planting.

## A check of mine that failed on correct code

The stale-amount assertion first used a 600-character window between
`pricingMode: 'dilution',` and `amount: undefined`. The real gap is **823** —
the intervening comment explains why the clear exists — so the check went red
against code that was right.

Re-aimed to slice the **mode button's own handler** and assert on that. A
character distance was never the property being asserted; it was a proxy that
happened to work when I wrote it. Recorded rather than quietly widened to 900,
because a proxy nobody noticed is the kind of check that later fails to fire.

## Gate

```
pricing-roundtrip spec:  78 passed, 0 failed   (was 47 — 31 new checks)
events-summary spec:     37 passed, 0 failed
mix-card spec (mounted): 99/99 passed          (untouched — no regression)
event-roundtrip spec:    69 passed, 0 failed
yield-roundtrip spec:    35 passed, 0 failed
guard-traps:             73/73 caught          (74 and 75 caught first run)
lint (tsc --noEmit):     clean
build:                   clean, 6.29s
i18n:                    5 keys x 6 locales, present, non-empty, all six
                         genuinely translated (no cognate collisions here)
```

## Where things stand

**Observations 1, 2 and 4 of the walk are closed.** The row, Preview Impact and
the chart now read one weighting; the Add button gates on one mode-aware
predicate and says why when it refuses.

**Still open, and named rather than implied:**

- **Observation 1b** — `originalBaseArpu` is view-scoped, not event-scoped.
- **Observation 3** — awaiting Jon's one look at the first X-axis label.
- the **scenarioHelper scope divergence** (R4 §5) — Scenario Compare still
  ignores `target` and `cohortScope` entirely, so it will disagree with the
  now-correct What-If display for every scoped event. **This session widens the
  gap in the sense that the What-If side is now right**, which makes the
  divergence easier to see rather than harder.
- `spec:yield-roundtrip`'s `toRow` is still a copy; `yieldArpuMode` is still not
  restored on reopen; R5's compounding limit is still unmeasured.

## Limits of this check

**The pricing card is still not mounted.** Everything asserted here is at the
function level plus source-wiring pins: that the apply path calls the shared
weighting at both sites, that the display calls the composed helper at two, that
the button and handler share one predicate, that the reason element exists. **No
check renders the card**, so "the amber line appears under the button" is
source-read, not observed. Joining the pricing form to `mix-card-spec` remains
the outstanding way to close that, and was not attempted here.

Agreement between the apply path and the display is pinned **structurally** —
they call the same function — rather than by running both and comparing outputs,
which would need the mount. The i18n copy is checked for existence, not quality.
