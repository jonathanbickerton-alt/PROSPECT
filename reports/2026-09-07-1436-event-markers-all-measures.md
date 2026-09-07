# Event month markers on all three measures (D5-07)

```
FOR ADVISOR
Generated: 2026-09-07 14:36 +0100 (UTC 2026-09-07 13:36)
Certifies: 45a437a (the tree every figure below was measured on)
Repo: committed 45a437a, pushed (origin in sync)

BASE 050c285 + b608308 (reports/ only; ZERO drift in src/ scripts/ test-data/
  package.json). Proceeded — the extra commit is last session's own report.
D5-07 recorded in EXPECTED.md BEFORE code, at 58f136b.
CAUSE: the marker's <ReferenceLine> hard-coded yAxisId="left" while the series
  render on MEASURE_AXIS[activeMeasure] = {volume:left, revenue:right,
  arpu:right}, so on Revenue and ARPU it bound to a mounted axis carrying no
  series and had no domain to draw against. A one-axis binding — the list was
  always right about WHICH events and WHICH month.
FILES: src/components/WhatIfTab.tsx (1 site), scripts/event-toggle-spec.tsx,
  scripts/guard-traps.ts, test-data/EXPECTED.md. No new string; no locale key.
DISPLAY-SITE PIN: 6 before, 6 after. No new isEventOn call, no .enabled read
  (0 in WhatIfTab). The marker list is still computed once.
MARKER MONTH: T on all three measures, unlagged — x={date}, the `seen` key,
  which is the event's own e.date. Pinned structurally; see Limits for why not
  in the DOM.
MOUNTED (1 ON + 1 OFF): volume 1-2-1, revenue 1-2-1, arpu 1-2-1.
TRAPS 174 (Revenue) / 175 (ARPU), each seen RED by hand, one site hit each,
  each leaving the other two measures green; both restored to f112f7093c.
suite 61/61  guard-traps 171/171  event-toggle 79/79  view-apply 168/168
trap-anchors 183/183  survival 27/27  i18n-parity 194/194  tsc 0  build clean
```

## Item 1 — diagnosis, read-only, before any edit

The brief made this a stop condition, so it is stated first and exactly.

`WhatIfTab.tsx` computes the marker list in one IIFE beside the chart. That
list was **never the defect**: it already skipped off events through the single
`isEventOn` call tagged `REQ-D6-01 DISPLAY 4 of 6`, and already keyed on the
event's own `e.date`. What it rendered into was:

```jsx
<ReferenceLine x={date} yAxisId="left" … />
```

— a **hard-coded axis id**. Immediately below it, the series render on:

```jsx
const axis = MEASURE_AXIS[activeMeasure];   // {volume:'left', revenue:'right', arpu:'right'}
```

Both `<YAxis yAxisId="left">` and `<YAxis yAxisId="right">` are always mounted,
unconditionally. So on Revenue and ARPU the marker was not bound to a missing
axis — it was bound to a **real axis that carried no series**, and therefore
had no domain to draw against. Volume is the only measure whose axis the marker
was ever wired to, which is exactly the symptom Alessandro reported: the marker
present on one measure, absent on the other two, while the adjusted series on
both visibly moved.

**This is the permitted cause** — the markers wired to one measure's render
only — so the build proceeded. It is not a data, filter, scope or lag defect,
and no other branch, prop or component drops the marker.

## Item 2 — the fix

One binding, in the one place:

```diff
-                        key={`ref-${date}`}
+                        key={`ref-${date}-${activeMeasure}`}
                         x={date}
-                        yAxisId="left"
+                        yAxisId={MEASURE_AXIS[activeMeasure]}
```

The key gains the measure so a measure switch cannot leave a marker reconciled
against its previous axis — the same reasoning the series' own
`key={`${kpi}-${activeMeasure}`}` already carries, three lines below.

**The display-site pin holds: 6 before, 6 after.** No second `isEventOn` call
and no read of `.enabled` were added — `grep -c '\.enabled\b'` on
`WhatIfTab.tsx` is **0**, unchanged. The list is still computed once and the
off-event test still happens in exactly one place; only where the result was
drawn changed.

**No new user-visible string**, so no locale key and no `+1` anywhere:
`i18n-parity` stays **194/194**.

## Item 3 — the spec

Added to `spec:event-toggle`, which is where the markers' off-event rule
already lived (structurally, as part of the six-display-site pin). Mounted with
one ON event at `2026-02` and one OFF event at `2026-03`, driven on each of the
three measures through the real `measure-<name>` control.

```
  marker  volume   one-off 1  both-on 2  back 1
  marker  revenue  one-off 1  both-on 2  back 1
  marker  arpu     one-off 1  both-on 2  back 1
```

**The instrument is the marker element, not the series** — `.recharts-reference-line`,
the element that was actually absent. Reading the line would have reported
success for the exact defect being fixed, since the series moved on Revenue and
ARPU throughout.

**A measurement error of mine, caught by going red.** The first draft read the
marker's *label text* to name which event it belonged to, and got `[]` on all
three measures while the count was already correct. Recharts nests the label in
a `CartesianLabel` inside the same `Layer`, but it needs a laid-out viewBox to
paint and jsdom gives it none — so `textContent` is empty even when the line
renders. The label is not the instrument, and the spec now says so at the site.

**The count round trip replaced it, and is stronger.** `1 → 2 → 1` per measure:
one marker while an event is off, two when it is switched on, one again when it
is switched back. A count that never moves is the same observation as a chart
that never painted — this is qa-tester's standard 9, and only the round trip
separates them.

## Item 4 — the traps

Ids from the `next free trap id` line `spec:trap-anchors` prints: **174** and
**175** (it read `next free trap id: 174` before, `176` after).

One per newly-covered measure, not one for both. The defect was per-measure —
a fixed axis killed Revenue and ARPU while leaving Volume perfect — so a single
trap naming both could be satisfied by either one surviving. Each re-creates
the original defect for exactly one measure, binding that measure's marker back
to `'left'`.

| trap | FAIL lines |
|---|---|
| 174 Revenue | `D5-07 revenue: exactly ONE marker while one event is OFF [0]`, `…switching the OFF event ON adds its marker [0]`, `…switching it back OFF removes it again [0]` |
| 175 ARPU | the same three, on `arpu` |

Both also trip the structural pin `D5-07: the marker x is the event month T,
unlagged and per-measure`.

**Planted by hand against a pre-plant md5, and the first attempt was wrong.**
A `sed` on the `yAxisId` line alone matched **two** sites — the marker *and*
the series below it — which is a broader mutation than the trap makes. That
plant was restored unread and redone with the trap's own two-line anchor
(`yAxisId` followed by the `stroke` line), which hits one site. Both runs
confirm `sites_hit=1`, and each trap leaves the other two measures at `1→2→1`,
which is the evidence that the traps are per-measure rather than global. Both
restored to `f112f7093c`, verified.

## Gate

```
tsc                0
build              clean
i18n-parity        194/194
survival           27/27  (104 across 26 files — unchanged)
trap-anchors       183/183  (171 traps, 178 anchors, ids unique by number)
view-apply-mounted 168/168
event-toggle       79/79
guard-traps        171/171 caught (0 MISSED, 0 INCONCLUSIVE, 0 CRASHED)
full suite         61/61 green (no spec added — the block joined event-toggle)
```

## Limits

- **The marker's month is pinned structurally, not read from the DOM.** The
  rendered line carries no month text in jsdom (see Item 3), so what is
  asserted is that `x` is bound to the `seen` key — the event's own `e.date` —
  and that the axis follows the measure. A lag introduced there would be a
  change to that line and the pin would catch it, but no DOM check confirms the
  marker sits at `2026-02` rather than `2026-03`.
- **Volume was already correct and has no trap of its own.** It is covered by
  the mounted round trip, which fails if Volume regresses, but no planted
  mutation was written for it because none of this session's change could break
  it in isolation.
- **`python` was not invoked** (CLAUDE.md, Efficiency rules). The by-hand plants
  used bash with `md5sum` and `perl -0pi`.
