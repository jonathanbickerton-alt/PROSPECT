# The delta-month selector lists months chronologically

```
FOR ADVISOR
Generated: 2026-09-09 15:31 +0100 (UTC 2026-09-09 14:31)
Certifies: 360a591 (the tree every figure below was measured on)
Repo: committed 360a591, pushed (origin in sync)
BASE 0e67708 + 0d4af5d (reports/ ONLY; ZERO drift). RECORDED FIRST 7cc0e6b.
CODE `.reverse()` gone, default `[0]` -> `[len-1]`; SPEC descending ->
  ascending, default BY MONTH KEY. Diff 2 files, +32/-14.
RED BY HAND (9aef9fd42b): `[0]` gives "2026-02 vs latest 2026-03"; the old
  positional check passed BOTH ways — which is why key-based mattered.
TRAPS none re-aimed (188 index, 189 actuals filter); 185, next 190. THE ORDER
  IS PINNED BY THE SPEC AND BY NO TRAP, the count being held fixed.
GATE guard-traps 185/185 CAUGHT, 0 MISSED/INCONC/CRASHED; suite 61/61, view-
  apply 189/189, event-toggle 146/146, anchors 197/197, survival 104/26+27/27,
  i18n 200/200 (877x6), ai-hold 13/13, tsc 0, lint and build clean.
```

## Recorded first

`7cc0e6b` appended one dated paragraph to REQ-D6-02 and nothing else: the
selector lists months **chronologically, earliest at the top**; decision 1 was
recorded as "most-recent first" and built latest-first, and Jon meant
nearest-first. It also records that **the default is unchanged** — still the
last forecast month, which after the reversal is the last option rather than
the first, so the default is expressed as a month key and not as a position.

## The change

**Three lines in `WhatIfTab.tsx`.**

```
-      .filter(mo => !withActuals.has(mo))
-      .reverse();
+      .filter(mo => !withActuals.has(mo));

-    : (deltaMonthOptions[0] ?? '');
+    : (deltaMonthOptions[deltaMonthOptions.length - 1] ?? '');
```

plus the doc comment above the memo, which said "MOST RECENT FIRST" and now
says what the code does. `adjustedMonths` is already in month order, so the fix
is the **absence** of a `.reverse()` rather than a sort — nothing new decides
the order.

**The default is the reason this touches code at all.** Reversing the list
without moving the default would have silently defaulted to the **earliest**
month: a different figure on every screen, and one that would have read as a
data change rather than a sort.

## The spec

**Three assertions in `view-apply-mounted-spec.tsx`**, the spec that reads the
rendered cards:

1. `options are MOST RECENT FIRST` → `options are CHRONOLOGICAL, earliest
   first`, with the comparison flipped from `>=` to `<=`.
2. `the default is the LAST offered month` → **`the default is the LAST
   forecast month, by key`**, comparing against `latestOffered` — the maximum
   month key — instead of `opts[0]`.
3. `last`/`earlier`, which drive the month-switching check, now come from
   `latestOffered`/`earliestOffered` rather than from the ends of the array.

**Why (2) matters, and it is the point of the brief's instruction.** `opts[0]`
passed **both before and after** the reversal: it compared the default against
whatever happened to be first. It could not have seen the default silently
becoming the earliest month, which is the one way this change could have gone
wrong invisibly.

**Seen red by hand.** Planting `deltaMonthOptions[0]` as the default against
pre-plant md5 `9aef9fd42b`, one site, restored and verified:

```
FAIL REQ-D6-02: the default is the LAST forecast month, by key
     [value 2026-02 vs latest 2026-03]
FAIL REQ-D6-02: the default card reads the LAST month's delta  [card 0 vs engine 20]
FAIL REQ-D6-02: a remount resets the selector to the default   [value 2026-02]
FAIL REQ-D6-02: the Revenue Base cell is subtract-then-round   [cell +0.00 vs +400.00]
```

Four checks, not one — the default reaches the cards, so getting it wrong
moves every figure on the strip.

## Traps

**None needed re-aiming, and the brief asked me to check 188 specifically.**

- **188** anchors on `const mi = found >= 0 ? found : adjustedMonths.length - 1;`
  — the index resolution, which this change does not touch.
- **189** anchors on `.filter(mo => !withActuals.has(mo))`, which survives the
  deleted `.reverse()` on the following line.

`spec:trap-anchors` reports **197/197** with all 185 anchors present and
unique, so neither anchor aged out. Trap count unchanged at **185**.

**The order itself is pinned by the spec, not by a trap.** The brief held the
trap count fixed, so a mutation that re-reverses the list would be caught by
the ascending assertion and by nothing in `guard-traps`. Worth an id when the
count is next allowed to move.

## Gate

Serial, guard-traps to a FILE, one instance.

```
guard-traps        185/185 CAUGHT   0 MISSED / 0 INCONCLUSIVE / 0 CRASHED
                   188 and 189 both CAUGHT under the new order
suite              61/61 green
view-apply-mounted 189/189
event-toggle       146/146
spec:trap-anchors  197/197  (185 traps, 192 anchors); next free id 190
spec:survival      104 dereferences across 26 files; 27/27 checks
spec:i18n-parity   200/200; 877 keys per locale — no key moved
spec:ai-hold       13/13
tsc 0              lint clean        build clean
```

Diff: **2 files, 32 insertions, 14 deletions** — `WhatIfTab.tsx` and the
mounted spec. No locale file, no export, no engine field.

## Limits

- **No walk.** The order is asserted in jsdom against month keys; nobody has
  looked at the rendered dropdown.
- **The order is pinned by the spec and by no trap**, because the brief held
  the trap count fixed. A mutation that re-reverses the list fails the
  ascending assertion and nothing in `guard-traps`.
- **The four-card strip is still unexamined at a narrow viewport**, as the
  1430 report said.
