# ARPU target on the Value card; the other two stale reads trapped

## FOR ADVISOR

Generated: 2026-09-04 10:30 +0100 (UTC 2026-09-04 09:30)
Certifies: 3773ce1
Repo: committed 3773ce1, pushed (origin in sync)
BASE: d586ffa - diff EMPTY. STOP did not fire. NO new decision.
ITEM 1 - THE BRIEF'S TWO TRAPS CANNOT EXIST, and that is measured. Planted
  BEFORE writing either in: effectiveTierArpuMap alone 37/37 MISSED;
  draftTierArpuOverride alone 37/37 MISSED; BOTH 35/37 CAUGHT - the map is
  DERIVED from the override, so either dep alone rebuilds the callback with
  a fresh copy of the other. ONE trap (142), not two that can never fire:
    FAIL (e) the saved event carries the OVERRIDE the user stated [null]
    FAIL (e) the EFFECTIVE rate is the stated one [5.856829372359942 -
      stale map, so the engine reads the derived rate]
ITEM 2 - ONE COMPONENT, TWO CALL SITES: MixTargetPanel at WhatIfTab 7013
  (promo) and 7539 (value). Promotion moved FIRST and TWO older specs
  caught the move: mix-card 234/235 (lifted without its collapsed-range
  message) and mix-refusal-copy, whose premise was that WhatIfTab is the
  SOLE consumer of refusal outcomes. Both fixed, nothing weakened; the
  .detail guard now covers the new file. Keys NONE; target DRAFT-ONLY.
ITEM 3 - 53/53. Reachable [5.86, 41.99], typed 23.93, achieved BY HAND
  23.928177 (gap is 2dp display rounding, so the bar is <0.005). Trap 143
  FAIL: a HELD tier is untouched by Apply, to the penny [33.33025985671146
  vs 33.333333333333336] - ~0.003, which a tolerance check would pass.
COUNTS/GATE (serial): traps 137 -> 139, no dup ids; trap-anchors 150/150;
  panel in TARGETS. guard-traps 139/139, no MISSED/INCONCLUSIVE; 58/58
  specs; tsc --noEmit clean; build clean.

## Base check

`git diff --stat d586ffa..HEAD -- src/ scripts/ test-data/ package.json` EMPTY.
HEAD at entry was `4233066`, which is 1857's report and touches no source. The
STOP did not fire.

## The governing entry

`test-data/EXPECTED.md`:
`#### CARD PARITY — SEVEN DECISIONS (Jon, 2026-09-03; recorded here 2026-09-03)`.
Decision 7 — one slider component before the second padlock — governs Item 2's
component question, and is applied a second time here. No new decision.

## Item 1 — the other two stale reads

Block (e) added to `spec:value-padlock`: type an override on an unlocked tier,
save through the card's own handler, and assert the saved event carries both
the **stated** override (`tariffBaseArpuOverride`) and the **effective** rate
the engine will read (`tariffBaseArpu`) — plus a negative check that no other
tier picked the override up, since a map that set every tier to it would
satisfy the first two and be badly wrong.

### The two traps the brief asked for do not exist, and that is a measurement

Planted by hand, as the rule requires, **before** either was written into the
registry:

| planted | result |
|---|---|
| drop `effectiveTierArpuMap` from the dep array | **37/37 — MISSED** |
| drop `draftTierArpuOverride` from the dep array | **37/37 — MISSED** |
| drop **both** | **35/37 — CAUGHT** |

The two reads **cover each other**. `effectiveTierArpuMap` is derived from
`draftTierArpuOverride`, so typing an override changes both; whichever one is
still listed is enough to rebuild the callback with a fresh copy of the other.
Neither omission is a defect on its own.

So this is ONE registry trap where the brief asked for two, and the reason is a
measurement rather than a judgement. Had I written the two entries the brief
named without planting them first, the registry would carry two traps that can
never go red — which is the exact failure the plant-by-hand rule exists to
prevent, and it would have looked like coverage.

**Trap 142** drops both, and its FAIL lines are:

```
value-padlock spec: 35/37 passed
  FAIL  (e) the saved event carries the OVERRIDE the user stated  [null]
  FAIL  (e) and the EFFECTIVE rate the engine reads is the stated one
        [5.856829372359942 — stale map, so the engine reads the derived rate]
```

The second line is the one that matters: the engine would read the derived
`5.86` while the card displayed the stated `42.5`.

**This does not mean the 1857 fix was half wrong.** Listing the full read-set is
still correct — an exhaustive dependency array does not stop being right because
one of its entries is currently redundant. What has changed is that the
redundancy is now recorded, so a later reader who deletes one "because nothing
fails" will find this entry rather than discovering it in production.

## Item 2 — the ARPU target on the Value card

### One component, two call sites

`src/components/MixTargetPanel.tsx`, rendered at `WhatIfTab.tsx:7013`
(Promotion) and `WhatIfTab.tsx:7539` (Value). **Two call sites, one component.**

This is decision 7 applied a second time, and the reasoning is the same one that
produced `MixSliderRow`: the Promotion arm already had a target block, the Value
card was about to get one, and an inline second copy would have made two copies
of the **unreachable-target rule** — the rule this project is most careful about,
because showing an unreachable target rather than clamping it is settled, and a
divergent copy could quietly undo it on one card.

The panel **computes nothing**. `outcome` and `range` arrive already solved by
`solveForTarget` and `achievableTargetRange`, so it cannot become a second
implementation of the arithmetic; it decides only what to draw.

### The Promotion arm moved FIRST, and the move was caught being wrong

Moved before the Value card was wired, exactly as 1626 did for the slider, so
`spec:mix-card` could prove the move behaviour-neutral. It did not, first time:

```
mix-card spec: 234/235 passed
  FAIL  transition: and the card SAYS the range collapsed rather than just
        going dead  [a collapsed range must state its cause, not merely disable]
```

The collapsed-range message lived **inside** the Promotion target block, and I
had lifted the block without it. That is the check earning its place — the one
red was precisely the thing removed.

It also resolved an asymmetry rather than just restoring the status quo. 1857
had added a *separate* collapsed-range message to the Value card, sited after
the rows; the message is a property of the RANGE, so it now lives in the panel
and both cards get the same one from the same place. The standalone Value copy
is retired, and its testid `yield-mix-range-collapsed` is unchanged, so no check
moved with it.

After the fix: **235/235, with no check edited** and `mix-card-spec.tsx`
untouched.

### A SECOND spec caught the same move, from a different angle

`spec:mix-refusal-copy` went red four checks deep, and its own header said why:
it had verified on 2026-09-02 that **`WhatIfTab.tsx` is the sole component
consuming these outcomes**. Moving the target block made that false.

The copy was never broken — it had moved — but the spec was right to fail,
because its job is to know WHERE the refusal branch lives. A spec that encodes
an architectural premise is supposed to fail when the architecture changes; that
is the difference between a check and a restatement of the code.

It was pointed at the panel rather than loosened, and **strengthened in the
direction the move actually created risk**:

- the four CARD checks now read `MixTargetPanel.tsx`, which both cards render
  through, so one read covers both;
- a new check asserts there are **exactly two** `<MixTargetPanel` call sites —
  a shared component is only shared if both cards call it, and one card quietly
  keeping an inline copy is the drift the move exists to prevent;
- the `.detail`-stays-diagnostic guard now covers `MixTargetPanel.tsx`. That is
  the half that matters: a fresh component handling refusal outcomes is exactly
  where someone who did not know the rule would render a diagnostic string into
  six locales.

`spec:mix-refusal-copy` is **70/70**, up from 68 checks.

### No new locale keys

All nine keys the panel uses already existed — `whatif_mix_target_arpu`,
`_placeholder`, `_apply`, `whatif_mix_reachable_range`,
`whatif_mix_target_unreachable`, `whatif_mix_bound_above`, `_below`,
`whatif_mix_target_blocked_other`, `whatif_mix_range_collapsed`. Expected none;
found none.

### Testids, parameterised by card

`<card>-mix-target`, `<card>-mix-target-apply`, `<card>-mix-target-range`, plus
`<card>-mix-target-blocked` and `<card>-mix-range-collapsed`. The Promotion arm
had none of these before — it was driven by text — so the move gives it testids
it did not have.

### The target is DRAFT-ONLY

It is a way of *reaching* a mix, not a property of the event: what persists is
the mix it produced, which is what the engine reads. The Promotion arm behaves
the same way, so matching it is parity, not a decision. This is **asserted**
rather than assumed — (f) checks the saved event carries no target-shaped field
— so persisting it later would be a deliberate change rather than a silent one.

## Item 3 — mounted checks

`spec:value-padlock` is **53/53**.

### Reachable, with the blend computed by hand

```
target: reachable interval [5.86, 41.99], typed 23.93, achieved by hand 23.928177
```

The blend is recomputed from the per-tier rates the card is **showing** and
compared with the number the **user typed** — not with anything the solver
reported back, which would be the solver checking itself.

The 0.0018 gap is rounding, not solver error: the rates are read from the
rendered placeholder, which is `formatNumber`'d to two decimals. Demanding exact
equality would be testing this spec's arithmetic against the display rather than
testing the solver, so the bar is `< 0.005` — still tight enough to catch trap
143, whose drift is ~0.003.

### Unreachable is SHOWN, never clamped

Apply disables, the message renders, **the shares are untouched**, and the typed
value is left exactly as typed.

### A held tier is untouched by Apply

Apply is the one operation that rewrites the mix wholesale, so it is where a
padlock is most likely to be lost. With a tier held, Apply still hits the target
and the held share is unchanged **to the penny**, with the padlock still
engaged.

**Trap 143** — passing an empty lock set to `solveForTarget`:

```
value-padlock spec: 52/53 passed
  FAIL  (f) a HELD tier is untouched by Apply, to the penny
        [33.33025985671146 vs 33.333333333333336 — Apply ignored the lock set]
```

The drift is ~0.003. A tolerance-based check would have passed it; comparing to
the penny is what makes this catchable, and the empty lock set still produces a
perfectly reachable answer — it just reaches it by spending a share its owner
locked.

## Counts

Traps **137 → 139** (ids 142 and 143). No duplicate ids across the whole file. `MixTargetPanel.tsx` is registered in the harness
`TARGETS`, which is the snapshot **and restore** set — the omission that crashed
guard-traps in 1857.

`spec:trap-anchors` **150/150 (139 traps, 146 anchors)**; both new anchors
verified unique before the traps were trusted.

## Limits of this check

- **The by-hand blend uses DISPLAYED rates**, rounded to two decimals, so it
  agrees with the target to <0.005 rather than exactly. Stated above; it is a
  property of the check, not of the card.
- **One reachable target, at the interval's midpoint.** Nothing exercises a
  target at the bound itself, which is where an off-by-epsilon would live.
- **`MixTargetPanel` has no trap of its own.** Both new traps mutate
  `WhatIfTab.tsx`; the panel's own render rules — Apply's disabled guard, the
  blocked branch's choice of message — would not redden anything if changed.
- **The Promotion arm's new testids are unexercised.** `spec:mix-card` still
  drives that card by text; nothing yet reads `promo-mix-target`.
- **`updateYieldEvent` is a noop in the harness**, so the draft-only check
  covers the ADD disposition only.
- **The redundancy in Item 1 is recorded, not resolved.** Both dependencies are
  retained as correct; no check would fail if a later reader deleted one.

## Gate

```
guard-traps:  139/139 caught, no MISSED, no INCONCLUSIVE
full suite:   58/58 spec scripts green
trap-anchors: 150/150 (139 traps, 146 anchors)
lint:         tsc --noEmit clean
build:        clean

Run SERIALLY throughout, per 1857: guard-traps mutates real source files, so
nothing else runs beside it. The suite was run TWICE — the first run found
spec:mix-refusal-copy red, and the second was after that fix, because a repair
is itself an untested change and only the figure measured after it is honest.
```
