# Scenario Compare — the brush window clamps, resets, and says which blank it is

## FOR ADVISOR

```
Generated: 2026-08-20 06:56 +0100 (UTC 2026-08-20 05:56)
Certifies: 5e91b73 (this report filled one commit later)
Repo: committed 5e91b73, pushed (origin in sync)
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before the base check.
BASE: HEAD 657e168 vs the brief's dc4c9c9 — one commit, REPORT-ONLY.
SHIPPED: windowBounds — ONE derivation, BOTH ends clamped, and start > end is
  no longer representable as an output. Was two inline JSX props that
  disagreed: endIndex clamped, startIndex not, for as long as both existed.
THE OLD FORM VIOLATES 273 OF 378 COMBINATIONS — measured, and folded into the
  spec as a permanent NEGATIVE CONTROL because everything passed first run.
  The reported shape gives {start:40, end:23}: the blank chart in two numbers.
RESET TRIGGER IS DATA LENGTH, NOT FILTER IDENTITY — deliberately the weaker
  one: an offset valid for one 24-month series is valid for any other.
CLAMP MAKES A STALE OFFSET SAFE; THE RESET MAKES IT PREDICTABLE — without it
  every new filter lands on the final month. A quirk nobody reports: trap 92.
EMPTY STATE NOW HAS THREE SENTENCES, not two: nothing plotted; a selection the
  BASELINE CANNOT COVER (events real, forecast rows absent); ordinary no-data.
  Reuses collectEventScopeDims, so message and dropdown cannot disagree.
THE SPECIFIC MESSAGE IS NOT A CATCH-ALL: a value in BOTH vocabularies, or in
  NEITHER, keeps the ordinary sentence. Jon's Mobile Voice is in both.
computeScenarioForFilter UNTOUCHED and ASSERTED SO — the diagnosis exonerated
  it by measurement; changing it would be fixing what is not broken.
ScenarioCompareTab ADDED TO guard-traps TARGETS — a trap planted in a file
  outside TARGETS could not have been restored.
GATE GREEN: guard-traps 90/90, twelve specs, lint and build clean.
```

---

## Base check

`HEAD` **`657e168`**; the brief names **`dc4c9c9`**. One commit apart,
**report-only** (the Repo-line correction on the diagnosis). Established drift
pattern, flagged and proceeded. Working tree clean at start, `origin` in sync.

## 1. The window, one derivation

`windowBounds(offset, size, dataLength)` in `viewFilter.ts`, returning
`{ start, end, empty }`.

**It was two inline JSX props, and they disagreed for as long as both existed:**

```jsx
startIndex={windowOffset}                                                    // unclamped
endIndex={windowSize === 'all' ? chartData.length - 1
                               : Math.min(chartData.length - 1, …)}          // clamped
```

That asymmetry is the whole defect. A `windowOffset` left over from a longer
dataset gives `start > end`, which Recharts renders as **axes with no lines** —
on both views, and immune to the time-range buttons, because those set the size
and leave the offset alone.

**The postcondition is the design, not a nicety.** For any inputs — negative
offset, offset past the end, zero or negative size, zero-length data, `NaN` —
the result is either `empty` or satisfies `0 <= start <= end <= length-1`.
**`start > end` is not representable as an output.**

Two decisions inside it worth naming:

- **No data is a *stated* empty**, not a window over nothing. Returning
  `{start: 0, end: -1}` would have reintroduced `start > end` by a second route,
  so `empty` is a flag the caller must read rather than a value to compare.
- **A stale offset clamps to the last valid index**, not to zero. The honest
  reading of an offset past the end is "the furthest window that exists" — and
  the reset below then supplies the predictable behaviour, so the clamp does not
  have to guess at intent.

**Why a function rather than tighter JSX.** Inline props cannot be driven by a
spec, so the disagreement between these two expressions was unreachable by
anything except reading them side by side — which is how it survived. One
derivation, one place to clamp, one thing to test.

## 2. The reset

```ts
useEffect(() => { setWindowOffset(0); }, [chartData.length]);
```

**The trigger is the data length, and the weaker trigger is the correct one.**
An offset valid for a 24-month series is valid for *any* 24-month series, so
resetting on filter identity would throw away a window the user deliberately set
whenever they switched between two equally-long selections — a real cost for no
invariant gained. Length is exactly the condition under which an offset can stop
being meaningful, and nothing more.

**The clamp and the reset do different jobs, and both are needed.** The clamp
makes a stale offset **safe**: no blank chart, ever. The reset makes it
**predictable**: without it, a clamped stale offset pins every newly-filtered
view to its final month — which reads as a quirk rather than a bug, gets
reported by nobody, and is therefore exactly the kind of thing that needs a
guard rather than a memory. Trap 92 plants precisely that.

## 3. The empty state, sharpened

The message had two cases; it now has **three**:

| condition | sentence |
|---|---|
| no file checked to plot | check at least one scenario below |
| **selection uncovered by the baseline** | **the events exist; the loaded baseline forecasts do not cover their scope** |
| anything else empty | no data for the selected filters |

`selectionUncoveredByBaseline(selection, sessions)` returns true when a selected
value **is offered by the events vocabulary and absent from the baseline rows**.

**It reuses `collectEventScopeDims`** — the same function that populates the
dropdown. That matters more than it looks: a second derivation of "what counts
as an events value" would be a vocabulary about a vocabulary, and the first thing
to drift out of step with the options the user was actually offered.

**The new message is deliberately not a catch-all**, and three checks hold that
line. A value in **both** vocabularies keeps the ordinary sentence — which is
Jon's Mobile Voice case, since the diagnosis measured **zero** uncovered values
across all four real saves. A value in **neither** also keeps the ordinary
sentence, because the specific message *claims the events exist* and must not be
said when they do not. And wildcards (`'All'`, null) can never be uncovered,
since reporting them would show a narrow explanation for a selection nobody
narrowed.

**One value is enough to trigger it.** If the product is event-only the
selection cannot render whatever the segment and channel do.

## 4. The spec and the traps

`spec:compare-window` — **45 checks**.

**It passed 41/41 on the first run, which is the shape a vacuous spec has**, so
the postcondition sweep was pointed at a verbatim replica of the shipped
expressions. Measured:

```
OLD code: 273/378 combinations violate the postcondition
reported shape: {"start":40,"end":23}   ← start > end: axes, no lines
```

That replica is now a **permanent negative control** in the file, pinned to the
exact count. If the sweep ever stops seeing 273 violations, the sweep itself has
stopped meaning anything and says so.

**The degenerate cases are the point.** An ordinary window passes under the old
broken code too, so a fixture list of sensible inputs would have proved nothing
about the defect being fixed. The checks that carry weight are offset-past-end,
offset-exactly-at-length (the `<` vs `<=` slip), zero-length data, and the
nonsense inputs.

**Trap 91** removes the start clamp — the exact asymmetry that shipped.
**Trap 92** removes the reset, which does *not* blank anything: the clamp keeps
the window valid and the view merely lands on the last month. A symptom nobody
would report is the strongest argument for a guard.

**`ScenarioCompareTab.tsx` was not in guard-traps' `TARGETS`.** Trap 92 plants
there, and a trap in a file outside `TARGETS` cannot be restored after the run —
the same gap the active-cohort session found on `scenarioHelper.ts`. Added.

## 5. What was deliberately not touched

**`computeScenarioForFilter`'s matching.** The 2026-08-20 diagnosis exonerated it
by measurement against four real saves — 360 matching rows and 24 months of
finite data exactly where the symptom was reported. The spec now **asserts it is
unchanged**, naming the three predicate lines and the empty-match bail, so a
future session cannot quietly "fix" a function that was measured correct.

Two items are **inherited rather than resolved**, as recorded in EXPECTED.md:
the populate/render **vocabulary contract** goes to DQ, whose single-source-of-truth
work already owns this species of problem; the **Compare/What-If matcher split**
is a recorded divergence feeding path unification, not a defect to fix in
isolation.

## Gate

```
compare-window:          45 passed, 0 failed   (new)
guard-traps:             90/90 caught, 0 missed, 0 inconclusive
compare-events-panel:    53 passed, 0 failed
events-summary:          38 passed, 0 failed
compare-filter:          24 passed, 0 failed
fromrow-equivalence:     49 passed, 0 failed
yield-roundtrip:         56 passed, 0 failed
event-roundtrip:         72 passed, 0 failed
scenario-pricing:        16 passed, 0 failed
active-cohort:           23 passed, 0 failed
import-seam:             36 passed, 0 failed
pricing-roundtrip:      116 passed, 0 failed
mix-card (mounted):      99/99 passed
lint (tsc --noEmit):     clean
build:                   clean (11.22s)
```

## Where things stand

**The silent blank is closed at the mechanism**, and the empty state now
distinguishes its causes instead of showing one sentence for two situations.

**Open:** whether this was in fact Jon's blank — see the limit below; DQ, which
EXPECTED.md records as next-no-exceptions and which now also inherits the
vocabulary contract; `spec:fromrow-equivalence` due for retirement; the yield
pass's private scope filter in `scenarioHelper`; `yieldArpuMode` not restored on
reopen.

## Limits of this check

**Nothing is mounted, and this remains the binding limit.** `windowBounds` and
`selectionUncoveredByBaseline` are driven directly and exhaustively; that
Recharts *renders* `{start: 23, end: 23}` as a visible one-month window, and that
the `useEffect` fires when `chartData.length` changes, are **source-read and
reasoned**, not observed.

**Therefore this fixes a proven defect, not a proven diagnosis.** The unclamped
index and the never-reset offset are real and are now closed. Whether they are
what Jon saw is still the open question the diagnosis posed, and the confirming
observation it asked for has not been made. If the blank recurs after this lands,
the next candidate is a render-time throw and the browser console is the
evidence needed.

**The uncovered-selection fixture is constructed, necessarily.** All four real
saves carry zero uncovered values, so no real file can exercise the new message —
which is also why the checks pin that the *covered* cases keep the ordinary one.
