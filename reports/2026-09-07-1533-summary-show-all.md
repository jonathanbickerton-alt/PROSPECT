# Events summary: Show all / Show fewer (D5-08)

```
FOR ADVISOR
Generated: 2026-09-07 15:33 +0100 (UTC 2026-09-07 14:33)
Certifies: 8c0cb71 (the tree every figure below was measured on)
Repo: committed 8c0cb71, pushed (origin in sync)

BASE 7b43e73 + f4e8c82 (reports/ only; ZERO drift in src/ scripts/ test-data/
  package.json). The extra commit is last session's own report.
D5-08 recorded in EXPECTED.md BEFORE code, at c9e3da4.
CONTAINER: one div in EventsSummaryTable.tsx, class "overflow-y-auto
  max-h-[320px] overflow-x-auto" - the only max-h in that file.
THRESHOLD: pixel cap 320px; control appears above SHOW_ALL_THRESHOLD=9 rows,
  a documented row-count PROXY (see Limits: jsdom cannot read overflow).
STOP CONDITION DID NOT FIRE: not shared with the four card tables, which carry
  overflow-x-auto only and no height cap. The COMPONENT is shared with Compare,
  so the toggle is opt-in by prop and Compare is unchanged.
FILES: EventsSummaryTable.tsx, WhatIfTab.tsx (1 line), 6 locale files,
  event-toggle-spec.tsx, guard-traps.ts, EXPECTED.md.
REQ-D6-01 PINS UNMOVED: apply 12/12 before and after (8 WhatIfTab + 4
  scenarioHelper); display 6/6 before and after.
STRINGS: en "Show all"/"Show fewer"; de "Alle anzeigen"/"Weniger anzeigen";
  it "Mostra tutti"/"Mostra meno" (+ es, fr, pt — parity needs all six).
SPEC spec:event-toggle (89 checks).  TRAP 176, seen RED by hand, 1 site.
i18n-parity 194/194, NOT 195: it counts CHECKS not keys (keys 863-865, x6).
suite 61/61  guard-traps 172/172  event-toggle 89/89  view-apply 168/168
trap-anchors 184/184  survival 104/26 derefs, 27/27 checks  tsc 0  build clean
```

## Item 1 — diagnosis, read-only, before any edit

**The container.** One div in `EventsSummaryTable.tsx`, wrapping the table:

```jsx
<div className="overflow-y-auto max-h-[320px] overflow-x-auto">
```

It is the **only** `max-h` in that file.

**The threshold is a height, not a row count.** `max-h-[320px]` caps by pixels;
the scrollbar appears whenever content exceeds 320px. A row is ~32px
(`px-3 py-2`, `text-xs`) under a ~30px sticky header, so about nine rows fit —
which agrees with Jon seeing a scrollbar at ten.

**The stop condition did not fire.** The cap is *not* shared with the four card
tables. Those are inline in `WhatIfTab.tsx` and carry `overflow-x-auto` only —
they scroll horizontally and have **no height cap at all**. The two other
`max-h` literals in `WhatIfTab.tsx` (`:7639`, `:8330`) are the Promotion and
Value cards' *tier lists*, each with its own literal and its own `> 8`
threshold, unrelated to this table.

**But the component is shared** — `WhatIfTab.tsx:5106` and
`ScenarioCompareTab.tsx:678`, the latter once per loaded file. That is not the
stop condition (which named the card tables), but it does constrain the build:
the decision is summary-only, so the control had to be **opt-in by prop**
rather than rendered unconditionally. Otherwise a summary-panel decision would
have arrived on Compare's panels silently, through a shared render.

## Item 2 — the build

**`showAllToggle?: boolean`**, defaulting `false`. `WhatIfTab` is the only
caller that passes it; `ScenarioCompareTab` is untouched.

**`SHOW_ALL_THRESHOLD = 9`**, exported so the spec imports it instead of
restating `9` — a spec with its own copy would keep passing after the product
moved, which is this codebase's named recurring failure applied to a constant.

**The header is now a row of two independent controls.** The collapse button is
unchanged apart from `w-full` → `flex-1` so it shares the row: same testid,
same `aria-expanded`, same chevron, same handler. The decision requires the
chevron to be unchanged and separate, and a nested `<button>` would have been
invalid markup *and* would have collapsed the panel on every "Show all" click.

The new control carries `aria-expanded` (`false` capped, `true` uncapped) and
`aria-controls="events-summary-scroll"`, naming the container it governs. It
renders only while the panel is **open** — a height control on a collapsed
panel governs nothing visible and would read as a second way to expand it.

**The cap comes off** by swapping the container's class, not by mutating a
style: `showAll ? 'overflow-x-auto' : 'overflow-y-auto max-h-[320px] overflow-x-auto'`.
Horizontal scroll stays either way — it is what stops a wide table forcing the
whole page sideways.

**State is local and view-only** — `useState` in the panel, not exported, not
persisted, reset on reload, exactly as decided.

**The REQ-D6-01 pins did not move: 12 apply (8 + 4) and 6 display, before and
after.** Nothing here touches a carrier, sheet, reader, or apply/display site;
`tsc` is clean and `spec:i18n-scan` passes.

## Item 3 — the spec

Added to `spec:event-toggle`, the mounted block that already opens the summary
panel. 89 checks, was 79.

```
  show-all  rows 10  control true  capped true
  show-all  rows 8   control false   capped true
```

**The instrument is the container's cap and the control's `aria-expanded`, not
the row count** — and the brief was right to insist. Every row is in the DOM
under the cap too; the cap hides them by *height*. Counting `<tr>` would have
reported success under any cap at all, including the broken one.

Above the threshold: the control renders, names its container, defaults to
capped, removes the cap on click with `aria-expanded="true"`, and puts it back
on a second click. Below the threshold (8 rows): the control is absent, and the
table still renders — asserted, so the absence check cannot pass vacuously on
a panel that failed to mount. The collapse control is separately asserted still
open, so the two controls cannot have been wired to each other.

## Item 4 — the trap

**Trap 176**, id taken from the `next free trap id` line (`176` before, `177`
after). `EventsSummaryTable.tsx` was not in `TARGETS` and has been added, so
the file is snapshotted and restored like every other mutation target.

The mutation leaves the control **in place** and only kills the effect: the
container's class becomes the capped one unconditionally. The button still
renders, still flips `aria-expanded`. That is the shape worth trapping — it
looks correct in a screenshot and to any check that counts rows.

```
FAIL  D5-08: clicking it REMOVES the cap  [still capped — the control renders
      but governs nothing, which is the shape a trap must be able to catch]
```

Planted by hand: pre-plant md5 `1a0dc875dc` → `f5efb42a7b`, landed, **1 site
hit**, restored to `1a0dc875dc` and verified. Exactly one check went red, which
is the trap being precise rather than broad.

## On the i18n figure — 194, not the 195 the brief expected

`spec:i18n-parity` reports **194/194 both before and after** this change, and
that is correct rather than a miss. It counts **checks**, not keys: its checks
are per-locale (`every en key exists`, `no non-allowlisted key equals English`)
and per-allowlist-entry. Adding a key to all six locales adds no check.

The figure that did move is the **key count: 863 → 865 in each of the six
locales**, verified against `HEAD` per locale. Both new keys are present in all
six — parity requires that, so en/de/it alone would have failed.

Reporting it rather than making the number read 195, because a gate figure
adjusted to match an expectation is the failure this project has a standing
rule about.

## Gate

```
tsc                0
build              clean
i18n-parity        194/194   (keys 863 → 865 per locale, all six)
i18n-scan          PASS
survival           104/26 dereferences/files; 27/27 checks
trap-anchors       184/184  (172 traps, 179 anchors, ids unique by number)
view-apply-mounted 168/168
event-toggle       89/89
guard-traps        172/172 caught (0 MISSED, 0 INCONCLUSIVE, 0 CRASHED)
full suite         61/61 green (no spec added — the block joined event-toggle)
```

## Limits

- **The threshold is a row-count proxy for a pixel cap.** `max-h-[320px]` caps
  by height; the control appears above nine rows. The exact test is
  `scrollHeight > clientHeight`, and it was rejected because jsdom reports
  every element as 0×0 — an overflow-measured control could not be asserted by
  the mounted spec at all. A deterministic threshold a spec can drive was
  preferred to an exact one it cannot. **The cost:** a very narrow viewport
  could wrap cells and overflow below nine rows without the control offering
  itself.
- **Nothing was measured in a browser.** The cap's removal is asserted by the
  container's class, not by observing that the page scrolls instead of the
  panel. That last step is a walk item.
- **Compare is unchanged and untested for it.** The opt-in prop defaults false,
  so `ScenarioCompareTab` cannot show the control; no spec asserts that
  absence.
