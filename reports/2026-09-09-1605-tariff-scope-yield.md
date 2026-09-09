# D5-10 yield half — the Value card's events carry the tariff scope

```
FOR ADVISOR
Generated: 2026-09-09 16:05 +0100 (UTC 2026-09-09 15:05)
Certifies: 7a0bc1d (the tree every figure below was measured on)
Repo: committed 7a0bc1d, pushed (origin in sync)

BASE 360a591 + 1aaeaa1 (reports/ ONLY; ZERO drift). DOCS FIRST at e9628b0:
  REQ-D6-02 CLOSED on Jon's walk; D5-10's yield reading (1) recorded.
1 ONE YIELD EMITTER: WhatIfTab :2990, the card's ONE construction site serving
  BOTH add and edit ("verified 1/1/1"); App:968 is the RESTORE, untouched. So
  SITES 9 -> 10, not 9 + N. YIELD SCOPES: What-If :1450 (site 2), :1672 (site
  5), :3145 (tooltip), Compare :378 (site 10) — all four carry the field via
  the EXISTING helpers. SCOPE CELL fc:1184 already passed it — confirmed.
2 PIN 9 -> 10 exact both ways. Pins identical: 12 apply / 6 display / 5+1.
3 SPEC event-toggle 146 -> 153: predicate, the YIELD SHEET's own round trip,
  Compare's yield site. Its fixture was wrong TWICE; the check said so both.
4 TRAPS 190, 191 RED by hand (md5 22b087715c / 0a1df9ecef, 1 site each); 191
  STAYED GREEN TWICE first. RE-ANCHORED 186, aged out by my own renumbering.
5 GATE: guard-traps 187/187 CAUGHT (185+2), 0 MISSED/INCONC/CRASHED; suite
  61/61, event-toggle 153/153, view-apply 189/189, anchors 199/199, survival
  104/26 + 27/27, i18n 200/200 (877x6, no key moved), ai-hold 13/13, tsc 0,
  lint and build clean. Next free id 192. Diff 5 files, +135/-17.
NOT DONE: the REAL Value add path was not driven — the Add button has no
  testid and is gated on tier data. Pinned by marker text and by trap 190.
```

## 0. Docs first

`e9628b0` appended two things: REQ-D6-02's closing paragraph verbatim as
supplied, and D5-10's dated yield decision — **reading (1)**, the apply-to
reading, so a value-axis mix and a tariff-axis mix are scoped identically;
`tariffScopeFor` on every yield emitter with the draft treated as `'All'`
because the card has no Tariff control; absent still means all tariffs.

## 1. Diagnose

**One emitter, and the codebase already says so.** `WhatIfTab.tsx:2990` builds
the `YieldEvent` and its own comment reads *"THE ONE CONSTRUCTION SITE —
verified 1/1/1 at `dae586d` and pinned by `spec:yield-roundtrip`"*. Both
dispositions follow it: `updateYieldEvent(editingYieldId, patch)` on edit,
`addYieldEvent(event)` on add — one builder, two exits.

That is why the count moves **9 → 10** rather than 9 + N: the Value card is
the only carrier whose emitters genuinely funnel.

**No emitter is a restore path.** `setYieldEvents` has four callers:
`App:968` (`yieldRaw.map(yieldEventFromRow)` — the restore, which must not
recompute), `App:1262` `addYieldEvent`, `:1269` remove, `:1273` clear.

**The yield scope objects, all four hand-built:**

| engine | site | what |
|---|---|---|
| What-If | `:1450` | apply site 2 — the inflow yield winner |
| What-If | `:1672` | apply site 5 — the retention yield winner |
| What-If | `:3145` | the chart tooltip's display list |
| Compare | `:378` | apply site 10 |

Every one already called `eventScopeMatchesView` with a plain object, so each
could carry `tariffScope` without changing a signature. The five hand-built
scopes named in report 1232 were **market and pricing**; these four are the
yield ones, and they were the sites the first half deliberately left alone
because a yield event could not then carry a scope.

**The SCOPE cell needed nothing.** `forecasting.ts:1184` — the yield caller of
`scopeOf` — already passes `e.tariffScope`, from the display half. Confirmed
by reading, not assumed.

## 2. Build

One call at the one construction site:

```ts
// D5-10, tariff scope site 10 of 10 — VALUE (yield), add AND edit.
tariffScope: tariffScopeFor('All', selectedTariffs, [...fullTariffTree.keys()]),
```

`'All'` is passed literally because the Value card has no Tariff control: there
is no draft value to read, and `'All'` is what its absence means.

The four scope objects gained `tariffScope: ye.tariffScope` (What-If) and
`tariffScope: tariffScopeFromRow(ye.Tariff_Scope)` (Compare) — the same one
reader and the same one `tariffScopeAdmits` the other three carriers use.

**All ten markers renumbered** from "of 9" to "of 10", and the pin moved with
them: WhatIfTab **9**, App **1**, ten in total, exact both ways.

## 3. Spec

`spec:event-toggle` **146 → 153**: the predicate refusing an out-of-scope
tariff for a yield-shaped scope object and still matching in scope and at All;
the **yield sheet's** round trip through `yieldEventExportRow` /
`yieldEventFromRow` — its own writer and its own reader, which the market round
trip does not exercise — and a yield row without the column loading with no
scope; and Compare's yield site.

**The Compare fixture was wrong twice, and the discrimination check said so
both times.** First an empty mix gave a ratio of 1, so scoped and unscoped both
read `10`. Then a tariff-axis mix still read `10 vs 10`, because Compare's
yield path applies from the **previous** month (site 10 tests
`ye.Month === prevMonthKey`), so an event in the first month never fires. With
a second month in the fixture the rate moves to `11.008…` and the two cases
part.

## 4. Traps

**190** the Value emitter skips `tariffScopeFor` — the pin must go red; **191**
Compare's yield site drops the column. Both planted by hand, one site each,
restored and verified:

| trap | pre-plant md5 | observed |
|---|---|---|
| 190 | `22b087715c` | `FAIL … EXACTLY 9 sites in WhatIfTab [8]`, `FAIL … TEN in total [9]` |
| 191 | `0a1df9ecef` | `FAIL … the fixture DISCRIMINATES … [scoped 11.008 vs unscoped 11.008]` |

**191 stayed green twice before its fixture could see it**, for the two
reasons above. That is the third time in this arc that planting a trap has
found a fixture that could not fail — the check exists because the trap
demanded it, not the other way round.

**Trap 186 was re-anchored**, having aged out on my own renumbering of the
markers from 9 to 10. `spec:trap-anchors` caught it in the same session that
aged it, as it has now done five times across this arc.

**The ids are 190 and 191, and they were burnt.** The registry comment from
the REQ-D6-02 session records two removed traps under those numbers; the
anchors spec prints `next free trap id` as max + 1 over ids that exist, so the
numbers came back round. The comment still stands where it was, so a reader
who greps for 190 finds both the burnt note and the live trap. Worth tidying
when the registry is next touched for its own sake.

## 5. Gate

Serial, guard-traps to a FILE, one instance.

```
guard-traps        187/187 CAUGHT   0 MISSED / 0 INCONCLUSIVE / 0 CRASHED
                   185 + 2; 186, 190, 191 all CAUGHT; TARGETS restored
suite              61/61 green
event-toggle       153/153  (146 -> 153)
view-apply-mounted 189/189
spec:trap-anchors  199/199  (187 traps, 194 anchors); next free id 192
spec:survival      104 dereferences across 26 files; 27/27 checks
spec:i18n-parity   200/200; 877 keys per locale — no key moved
spec:ai-hold       13/13
tsc 0              lint clean        build clean
```

Diff: **5 files, 135 insertions, 17 deletions** — one emitter, four scope
objects, the pin, the spec and two traps. No locale file, no export schema
change beyond the column the yield sheet already carried.

## Limits

- **The real Value add path was NOT driven.** The brief asked for a mounted
  save through the card; the Add button has no testid and is gated on
  `yieldTierData.length > 0 && newYieldEvent.month`, which needs mix tier data
  to resolve in the fixture. What is proven is the carrier, the predicate, the
  yield-sheet round trip and both engines' yield sites — **not** that a click
  on the Value card's Add reaches `tariffScopeFor`. The site is pinned by
  marker text and by trap 190, which is what stands in for the click.
- **The mounted ARPU-at-view-S assertion is not there either**, for the same
  reason: it needed the saved event the add path would have produced. Compare's
  side is asserted through its real engine; What-If's yield sites are asserted
  through the shared predicate rather than through a rendered card.
- **Ids 190/191 are reused numbers.** The registry's burnt-trap comment from
  the REQ-D6-02 session still names them, so a grep for either finds both the
  note and the live trap. Harmless today, tidy when the registry is next
  touched.
- **No walk.** Nothing rendered was looked at this session.
