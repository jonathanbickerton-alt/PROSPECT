# Scenario Compare — the chart keeps a floor, says when it cannot draw, and stops inventing events

## FOR ADVISOR

```
Generated: 2026-08-20 09:22 +0100 (UTC 2026-08-20 08:22)
Certifies: __PENDING__
Repo: __PENDING__
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before the base check.
BASE: HEAD 76a68ee vs the diagnosis Repo line 135bc62 — one commit, --stat
  confirms REPORT-ONLY (one line: that report's own Repo fill).
FIX 1, THE FLOOR: the chart card takes min-h-[320px], so the sole flex-1 among
  shrink-0 siblings can no longer reach zero. The column then overflows into
  the existing overflow-auto — a SCROLLBAR, which is a stated condition.
  CAUGHT WHILE WRITING IT: min-h-0 and min-h-[320px] on ONE element leaves the
  winner to CSS source order, not attribute order. One class now, and pinned.
FIX 2, THE PLACEHOLDER SKIP, at the shared boundary: isPlaceholderSheet tests
  the sheet's SHAPE (one row, only Note populated), never the message text —
  matching eight English strings would break on the first rewording. The
  worker consults it, and App's NINE inline twins collapsed into it. Zero
  `?.Note` remain anywhere. A placeholder yields an EMPTY array: absence.
FIX 3, THE FOURTH STATE: chartDrawability(dataLength, measuredPx) + a
  ResizeObserver on the plotting area. Undrawable now renders a NAMED
  condition. Unmeasured is DRAWABLE on purpose — a fault on first paint would
  be a false alarm on every mount.
PREVENTION AND DETECTION ARE SEPARATE, deliberately: the floor stops the
  collapse, the predicate reports it if the floor is ever defeated by a
  shorter viewport, a zoom, or the next sibling added to that column.
THE PHANTOM NEGATIVE CONTROL IS THE LOAD-BEARING CHECK: unguarded, the same
  fixture DOES produce two phantom rows and the literal string "undefined".
  Without it the four regression checks could pass on a clean fixture.
NOTHING EXONERATED WAS TOUCHED — computeScenarioForFilter, windowBounds and
  the worker's matching are asserted unchanged.
__GATE_PENDING__
```

---

## Base check

`HEAD` **`76a68ee`**; the diagnosis's Repo line names **`135bc62`**. One commit
apart, and `git diff --stat 135bc62..HEAD` confirms it is **report-only** — a
single line, that report's own Repo fill. Established drift pattern, flagged and
proceeded. Working tree clean at start, `origin` in sync.

## 1. The render fix

`min-h-[320px]` on the chart card (`ScenarioCompareTab.tsx:516`), exactly the
symbol §6a names. The card is the **sole `flex-1` among `shrink-0` siblings** in
a height-capped column, and `min-h-0` let it reach zero — at which point the SVG
has no height and the region shows nothing at all: no lines, no axis, no message
and no scrollbar. With the floor, the column overflows into the root's existing
`overflow-auto`, so the user gets a **scrollbar** — an absence replaced by a
stated condition.

**A defect caught while writing the fix.** My first version left `min-h-0` in
place and appended `min-h-[320px]` to the same element. Both emit `min-height`,
so the winner is decided by **CSS source order, not attribute order** — a fix
whose behaviour depends on how Tailwind happens to order its output. There is one
class now, and a check pins that the pair never returns.

**Nothing adjacent was touched.** `computeScenarioForFilter`, `windowBounds` and
the worker's matching were all exonerated by measurement in the diagnosis — six
file-count states, every one structurally identical and wholly finite. The spec
asserts each is unchanged, so a later session cannot quietly "fix" them.

## 2. The placeholder skip, at the shared boundary

`isPlaceholderSheet(rows)` and `rowsOrEmpty(rows)` in a new
**`src/utils/sheetGuards.ts`**.

**Why its own module rather than `forecasting.ts`.** The worker must consult this
before any row reaches a `fromRow` seam, and the worker's bundle deliberately
imports only `xlsx` — pulling `forecasting.ts` and `date-fns` into a second
333 kB chunk was measured and refused on 2026-08-19. A dependency-free predicate
costs the worker nothing.

**The test is the sheet's shape, not the Note's words.** A placeholder is a
single row whose only populated column is `Note`. Matching the message text would
tie every consumer to eight English strings and break on the first rewording or
translation; the shape cannot collide with real data, because every event sheet
writes an `ID`. A blank trailing cell — which the sheet reader can surface as
`__EMPTY: ''` — is filtered out, so it cannot defeat the test.

**Both consumers inherit it, and the twins are gone.** The worker's `parseSheet`
returns `rowsOrEmpty(...)`, so the chart series, the filter populate and the
events panels all inherit the skip at one point. App's **nine** inline
`!rows[0]?.Note` twins collapsed into the shared predicate; **zero** inline
`?.Note` remain anywhere in the codebase. The spec pins the count at exactly
nine, because a tenth or a missing ninth is a consumer going its own way — which
is precisely how the gap arose.

**Why the boundary and not the seam.** `marketEventFromRow` converts *a row*;
"this sheet is a placeholder" is a property of *the sheet*. Putting the test
inside the seam would ask a row-level function a sheet-level question, and the
next consumer to read a sheet without going through that seam would miss it
again.

**A skipped placeholder contributes an empty array** — absence, not an error and
not a phantom.

## 3. The stated failure

`chartDrawability(dataLength, measuredPx, minPx = 120)` returning
`'no-data' | 'too-short' | 'drawable'`, plus a `ResizeObserver` on the plotting
area and a named message when the region is too short.

**Prevention and detection are different jobs**, and this arc has already paid
once for conflating them — on the brush, where the clamp made a stale offset safe
and only the reset made it predictable. The floor stops the collapse; the
predicate **reports** it if the floor is ever defeated by a shorter viewport, a
browser zoom, or the next sibling somebody adds to that column. A failure that
cannot be seen is the one that survives.

**Unmeasured is drawable, deliberately.** Before the observer first fires there is
no measurement, and reporting a fault there would flash the condition on every
mount. The spec asserts that case explicitly, and asserts that `NaN` is treated
the same way.

**The threshold belongs to `drawable`, not to `too-short`.** At exactly
`MIN_DRAWABLE_CHART_PX` the chart draws — otherwise a floor set to the threshold
would report a fault about itself.

**The fourth state is an addition, never a replacement.** The three existing
messages keep their jobs, and the spec pins all four as reachable. This one is
distinct in kind: the other three describe an empty *result*, this one describes
an undrawable *region* — the data is fine and there is no room to show it.

## 4. The specs

**`spec:compare-render` — 39 checks, new.**

The **count transition** is driven, not assumed: `chartData` is built through the
real merge at 1, 2, 3 and 4 files, and the three-file shape — the one that broke
on screen — is asserted coherent beside the two-file shape that did not. Each
count asserts every plotted key present, every value finite, an identical key set
across all 24 months, and that **each file contributes its own distinguishable
series** — identical values across files would let one stand in for another and
the block would prove nothing.

Two checks name the transition itself: three files carry exactly seven more keys
than two, and **adding a third file never removes a key from the first two**.

The **floor is a source-level pin and says so in its own check name.** A CSS
`min-height` is not observable from Node; the check reads the class off the
component and is declared as an anchor rather than dressed up as a measurement.

**`spec:compare-events-panel` — 53 → 71.** The placeholder predicate over its
shape cases, and the **1349-shaped regression case**: two Note sheets plus one
real pricing event must produce a one-row panel with no `"undefined"` anywhere,
no phantom Volume row, no phantom Value row and no unnamed rows.

**The negative control is the load-bearing check.** Run *unguarded*, the same
fixture produces **two** rows and the literal string `"undefined"` — the exact
text Jon saw. Without it, the four regression checks could pass on a fixture that
never had phantoms in it, which is the vacuity this arc has now caught three
times.

## 5. The traps

**93** puts the chart card back on `min-h-0` — the exact mechanism the diagnosis
proved. **94** makes `isPlaceholderSheet` stop recognising Note rows at its one
definition, so every consumer loses the skip at once and the phantoms return.
**95** severs the named condition from the state that triggers it: the predicate
still computes `'too-short'` and nothing renders for it — the silent blank
restored.

**`src/utils/sheetGuards.ts` was added to guard-traps' `TARGETS`.** Trap 94
plants there, and a trap in a file outside `TARGETS` cannot be restored after the
run — the same gap found on `scenarioHelper.ts` and again on
`ScenarioCompareTab.tsx`.

## Gate

```
compare-render:          39 passed, 0 failed   (new)
compare-events-panel:    71 passed, 0 failed   (was 53)
guard-traps:             __/__ PENDING
full suite:              __/__ PENDING
lint (tsc --noEmit):     __PENDING__
build:                   __PENDING__
```

## Where things stand

**Both walk blockers are closed** — the chart cannot silently collapse, and the
panels no longer invent events out of placeholder sheets. The principle's third
application this arc is in place with it.

**Open:** DQ, which EXPECTED.md records as next-no-exceptions;
`spec:fromrow-equivalence` due for retirement; the yield pass's private scope
filter in `scenarioHelper`; `yieldArpuMode` not restored on reopen; the
populate/render vocabulary contract, recorded as DQ inheritance.

## Limits of this check

**Nothing is mounted, and one fix depends on that.** `chartDrawability`,
`isPlaceholderSheet`, `rowsOrEmpty` and the count-transition data are driven
directly and exhaustively. That the `min-h-[320px]` class **produces** a 320px
floor in a browser, that the `ResizeObserver` fires, and that the named condition
**appears** over the plotting area are all **source-read**, not observed. The
floor's check says so in its own name rather than in a footnote.

**The 320px figure is a judgement, not a measurement.** The diagnosis computed
the collapse threshold from estimated component heights, and that estimate has
not been replaced by a devtools reading — the observation asked for in that
report has not come back. 320px is comfortably above the 120px drawability floor
and below the smallest chart area the arithmetic showed at any tested viewport,
but it is chosen rather than derived.

**The phantom fix is proved on constructed rows shaped like the real saves**, not
by re-reading Jon's 1349 and 1351. Those were read directly in the diagnosis one
commit earlier, and the fixture reproduces exactly the shape recorded there.
