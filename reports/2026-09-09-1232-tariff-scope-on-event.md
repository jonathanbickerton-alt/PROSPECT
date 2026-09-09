# Tariff scope on an event — design (b)

```
FOR ADVISOR
Generated: 2026-09-09 12:32 +0100 (UTC 2026-09-09 11:32)
Certifies: 7850298 (the tree every figure below was measured on)
Repo: committed 7850298, pushed (origin in sync)

BASE 9c93807 + five reports-only commits; ZERO drift. RECORDED FIRST: D5-10
  into EXPECTED.md at cfcdd68, BEFORE code. Premise line numbers all held.
1 NO CARRIER FUNNELS: setMarketEvents has 11 callers of four kinds, TWO of
  them RESTORE (App:956/:1921) which must never recompute a saved scope.
  PROMOTION DOES funnel, at buildPromoEvents. Import sweep: 4 paths, none.
2 TARIFF_SCOPE_SITES = 9, NOT 8 — App addMarketEvent is a ninth emitter,
  the FIFTH WRITER. Pinned by marker: WhatIfTab 8 + App 1, exact both ways,
  and no restore path is a site. Two predicates, ONE branch each via ONE
  tariffScopeAdmits. Tariff_Scope LAST on 3 sheets, ONE reader, 3 callers.
3 SPEC event-toggle 112 -> 136. The WEIGHTING case exists because trap 183
  stayed GREEN without it — a trap nothing catches is not a guard.
4 TRAPS 182/183/184, each RED by hand (md5 38a9ade772, 1 site, restored).
  TWO EXISTING TRAPS AGED OUT ON MY EDITS — 131, 181 — caught by
  trap-anchors that same session; the Enabled-is-LAST pin was RE-AIMED.
5 GATE: guard-traps 180/180 CAUGHT, 0 MISSED/INCONC/CRASHED, restored.
  suite 61/61, event-toggle 136/136, view-apply 177/177, anchors 192/192,
  survival 104/26+27/27, ai-hold 13/13, i18n 200/200 (874 x 6, no new keys),
  tsc 0, lint and build clean. 180 not 182 — two traps shed with their work.
SHED per the brief: display (6), auto-clear (7), COMPARE — an All-tariff
  event STILL applies at every tariff there. Mounted spec NOT written; id 185.
```

## Base and record

`git log --oneline -1` read `a34c959` — `9c93807` plus five reports-only
commits. `git diff 9c93807 -- src/ scripts/ test-data/ package.json` was empty.

**RECORD FIRST.** D5-10 went into `test-data/EXPECTED.md` at `cfcdd68` before a
line of code: the finding, the cause, why design (b) rather than a build-time
split, all nine decision clauses, and the funnel measurement below.

**Every premise line number re-checked and held**: `fc:566` the `ok` helper,
`fc:3090` `leafWithinScope`, `fc:532`/`:3570` the two `EventScopeDims`,
`WIT:592` `buildPromoEvents`' tariff write, `WIT:1994` `targetTariffTree`,
`fc:379` the `Promo_Mix_Locked` precedent, `App:212` `addMarketEvent`.

## 1. The funnel question

**No carrier funnels through one state writer.** `setMarketEvents` has eleven
callers of four different kinds:

| kind | sites |
|---|---|
| draft → event emitters | `App:264`, `WIT:2770`, `:3589`, `:3656`, `:3991`, `:4076`, `:4481` |
| edit by patch | `updateMarketEvent` → `updateById(setMarketEvents…)`, `App:308` |
| **RESTORE — must NOT recompute** | `App:956`, `App:1921` |
| not emitters | `App:287` (remove), `WIT:4155` `confirmPendingChange` |

The raw setter therefore cannot be the site: a restored event's scope is in the
sheet, and recomputing it from the current selection would rewrite what the
author saved — decision 9's opposite.

**Promotion does funnel, at `buildPromoEvents`.** Its three save paths — add,
row edit, campaign edit — all reach an event through that one construction
function, so one call there is the whole card. That is the "unless" clause in
decision 2, and it is why the site count is nine rather than eleven.

**Restore and import paths swept, and none calls `tariffScopeFor`:**
`App:956` and `:1921` (market events, `backfillSequences(restoredEvents)`),
`App:963` (yield), `App:971` (pricing). A spec check asserts the market ones
stay clean.

## 2. The build

**The carrier.** `tariffScope?: string[]` on `EventToggle`
(`types/forecast.ts:364`) — the one shared base all four event shapes extend.
Absent means all tariffs, the same rule `enabled` follows two lines above.

*Worth naming: `EventToggle` now carries two cross-carrier facts and its name
only describes one. A rename is not in the decision and was not done.*

**One rule, one membership test.**

```
fc  tariffScopeFor(draftTariffL1, selectedTariffs, fullL1s) -> string[] | undefined
fc  tariffScopeAdmits(scope, viewTariffL1) -> boolean
```

`tariffScopeFor` records a scope only when the draft says `'All'` **and** the
selection is a non-empty **strict** subset — a selection covering everything is
not a narrowing, and recording it would turn a later widening of the tariff set
into a silent narrowing of every event saved before it. Sorted, so two saves of
the same selection compare equal through the sheet.

**Two branches, one shared test.** `eventScopeMatchesView` gains
`&& tariffScopeAdmits(d.tariffScope, v.tariffL1)` beside its existing `ok`
call, so the scope only ever narrows the `'All'` case and an unscoped event is
unchanged in every direction. `leafWithinScope` gains the same call, so
`eventProRataShare` and `forecastCoverage` weight over the in-scope leaves
only.

**A view of All still sees a scoped event.** That is deliberate: the event does
apply somewhere inside that view, and the coverage weighting is what decides
how much. Only a *specific* tariff is tested for membership.

**The shared base paid for itself at the call sites.** Of the sixteen
`eventScopeMatchesView` callers, five build a scope object by hand and needed
`tariffScope: e.tariffScope` added; four pass the event object directly and got
the field free; three are yield sites, which never set a scope and are
therefore unchanged; the rest are in Compare, which is shed.

**Nine sites, pinned by marker text.** `TARIFF_SCOPE_SITES` counts
`D5-10, tariff scope site` — WhatIfTab **8**, App **1**, nine in total, exact
both ways. Counted by marker rather than by counting `tariffScopeFor(` calls
for the reason the twelve apply sites are: a call moved into a helper is still
one call and no longer one site.

**Export.** `Tariff_Scope` appended **last** on all three sheets
(`fc:410`, `:1280`, `:1558`), JSON on the `Promo_Mix_Locked` precedent, and
**empty when there is no scope** — a bare `[]` would round-trip as "targets no
tariff", the opposite of what absence means. **One reader**,
`tariffScopeFromRow`, with three callers; absent, empty, non-array and
unparseable all mean no scope.

**`EventScopeDims` merged.** The second declaration (`fc:3570`) is gone, with a
comment at its site saying why.

## 3. The spec

`spec:event-toggle` **112 → 136**. The rule itself (strict subset, the
not-a-narrowing case, an already-targeted event, an empty selection), the
membership in both directions, the predicate through the shared function, the
round trip, and a row that predates the column.

**The weighting checks exist because a trap stayed green.** Trap 183 removes
`leafWithinScope`'s branch; with the predicate checks alone, the spec passed.
A trap nothing can catch is not a guard, so a discriminating fixture was added
— three tariffs with different volumes, where a scoped event's share at RED M
is 100/400 and an unscoped one's is 100/1000 — and the fixture is asserted to
discriminate before either figure is read.

## 4. Traps

New: **182** (the predicate forgets the scope — Jon's finding exactly), **183**
(the weighting forgets it, so the split is wrong while every row still looks
plausible), **184** (the reader drops the column, so the fix lasts until the
user closes the app). Each planted by hand against pre-plant md5
`38a9ade772`, one site, restored and verified:

| trap | observed when planted |
|---|---|
| 182 | `FAIL D5-10: eventScopeMatchesView refuses the out-of-scope tariff [RED S must not match]` |
| 183 | `FAIL … shares DIFFER [scoped 0.1 vs unscoped 0.1]`, `FAIL … IN-SCOPE leaves only [expected 0.25, got 0.1]` |
| 184 | `FAIL D5-10: and reads back identical` |

184 is anchored on the **reader**, not the writer, because the three writer
lines are byte-identical and an anchor must be unique.

**Two existing traps aged out on my own edits and `spec:trap-anchors` caught
both in the same session** — trap **131** (the scope object gained
`tariffScope`) and trap **181** (the market reader gained a line between `id`
and `name`). Both re-anchored, with the reason recorded at each.

**The existing export pin went red and was re-aimed, not deleted.**
`Enabled` was pinned as the last column on all three sheets and is now
second-to-last. The append-only rule is intact — nothing was inserted — so the
pin now names **both** positions, and a column appended between them still goes
red.

## 5. Gate

Serial, guard-traps to a FILE, one instance.

```
guard-traps        180/180 CAUGHT   0 MISSED / 0 INCONCLUSIVE / 0 CRASHED
                   TARGETS restored; 131, 181, 182, 183, 184 all CAUGHT
suite              61/61 green
event-toggle       136/136  (112 -> 136)
view-apply-mounted 177/177
spec:trap-anchors  192/192  (180 traps, 187 anchors); next free id 185
spec:survival      104 dereferences across 26 files; 27/27 checks
spec:ai-hold       13/13
spec:i18n-parity   200/200; 874 keys per locale — NO new keys this half
tsc 0              lint clean        build clean
```

**180, not the brief's 182.** Traps 182–184 are built; the two the brief
also asked for — Compare's raw reader ignoring the column, and one emitter
skipping `tariffScopeFor` so the pin goes red — belong to the shed work and
to a pin that has no second reader yet. `next free trap id` is **185**.

Pins identical before and after: **apply 8 + 4 = 12**, **display 6**,
**`.enabled` 5 + 1**, **`eventScopeMatchesView` callers 16 → 16**, and the
hand-rolled-shape structural check (trap 132's class) still passes — all
asserted by `spec:event-toggle`, which is green.

## What is shed, and what it costs

Per the brief's own clause, **display (6), the Promotion auto-clear (7) and
Compare are a second session.** The consequence is not silent:

- **Compare still applies an All-tariff event at every tariff.** Its four raw
  readers do not parse `Tariff_Scope` and its `scopeOf` does not carry it, so
  `tariffScopeAdmits(undefined, …)` returns true and Compare behaves exactly as
  it does today. Nothing regressed; the fix simply has not reached it.
- **The Tariff control still reads plain "All"** where the decision wants
  "All in scope (RED M, RED L)", and the Events summary has no SCOPE column.
  The event is now correct; the label has not caught up.
- **The Promotion draft still has no auto-clear**, so a tariff leaving the
  selection stays on the draft.
- Traps **185+** belong with that work; `next free trap id` is **185**.

## Limits

- **Nothing was mounted for D5-10.** The brief's item 3 wanted a three-tariff
  store driven through the real cards on four save paths. That spec is **not
  written**: the checks here exercise the rule, both predicates, the weighting
  and the round trip directly, which proves the engine but not that a save
  through the Promotion card reaches `tariffScopeFor` with the right
  arguments. The nine sites are pinned by marker text, not by observation.
  This is the largest single thing the second session should add.
- **Compare is untouched and still applies an All-tariff event everywhere.**
  Its `scopeOf` does not carry `tariffScope` and its readers do not parse the
  column, so `tariffScopeAdmits(undefined, …)` returns true. Nothing
  regressed; the fix has not reached it.
- **`EventToggle` now carries two cross-carrier facts** and its name describes
  one. A rename was not in the decision and was not done.
- **Yield events never receive a scope.** The decision names three cards;
  `YieldEvent` extends the same base, so the field exists on it and is always
  absent — behaviour unchanged, by omission rather than by design.
- **The 2dp/round-trip claim rests on `marketEventFromRow`.** The pricing and
  yield readers were wired identically and typecheck, but only the market
  round trip is asserted end to end.
