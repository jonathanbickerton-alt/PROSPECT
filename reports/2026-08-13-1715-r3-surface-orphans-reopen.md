# R3 surface, session 2 — orphaned bands, the drop action, and the reopen transition

## FOR ADVISOR

```
Generated: 2026-08-13 17:15 +0100 (UTC 2026-08-13 16:15)
Certifies: __PENDING__
Repo: __PENDING__
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before the base check.
BASE: HEAD cb1320f vs the brief's 4531acf — one commit, REPORT-ONLY (--stat:
  only reports/). The established predecessor-Repo-fill drift; flagged, proceeded.
THE REFUSAL WITH NO REMEDY IS CLOSED (Finding C, option 2). An orphaned band now
  RENDERS named, says why it blocks, and offers a drop that rebalances.
NO ARPU INPUT ON AN ORPHAN ROW, per narrowed decision 3: nothing invites the
  user to invent a rate for a population the data does not describe.
THE DROP USES rebalance, NOT seedMixPreserving — the latter normalises across
  every member and would rewrite a held share (trap 54's shape). Every-member-
  padlocked is deliberate: orphan goes, mix loads short, amber says so, rather
  than the card overriding a padlock the user set. Caught while writing.
SESSION 1'S NAMED GAP IS CLOSED: edit-reopen is MOUNTED — restored rate shows
  STYLED, clear returns derived-today, re-save carries the NEW rate.
ORPHAN PREDICATE tests share > 0, not presence: a zero-share foreign key
  contributes nothing to the blend, so naming it would report a non-problem.
HARNESS DEFECT FOUND AND FIXED — guard-traps sampled its newline from ONE file
  and applied it across EIGHT. WhatIfTab flipped CRLF->LF mid-session and every
  MULTI-LINE anchor died at once (63/67). Trap 57 reported PLANTED because the
  cheap half of a two-part mutation matched while the half carrying the defect
  no-oped — a harness failure in a guard failure's clothes. Now 67/67. See §6.
mix-card 99/99 (was 73/73), traps 68+69 added, 5 i18n keys x 6 locales, lint and
  build clean. NEXT: nothing outstanding in the R3 arc.
```

---

## Base check

`git rev-parse --short HEAD` → **`cb1320f`**; the brief names `4531acf`. One
commit apart, and `git log --stat` confirms it touches only
`reports/2026-08-13-1644-r3-surface-input.md` — the predecessor's own Repo-line
fill. This is now the established pattern rather than a surprise, and the brief
anticipated it; flagged and proceeded per its instruction.

## What shipped

### 1. One orphan definition

`promoOrphanedBands(members, draftMix)` — exported, and read by the refusal
copy, the orphan rows and the drop action alike.

**One definition because disagreement here has a specific bad shape.** If the
refusal and the rows computed orphans separately, the card could refuse a save
while displaying nothing to fix — which is precisely the state this session
exists to remove. A hand-rolled twin would reintroduce it silently.

**The test is `share > 0`, not mere presence.** `blendedArpu` skips members with
zero share, so a foreign key carrying nothing blocks nothing; naming it would be
the card reporting a problem the user does not have. The spec pins that case
directly.

### 2. The orphaned row renders, marked

An orphaned band appears as an amber row naming the band, showing the share it
still holds, and stating that it no longer appears in the current data.

**It renders rather than being dropped on restore.** Silently discarding it
would change a saved promotion's mix behind the user's back, and the standing
principle is that data problems are communicated, never quietly handled. The
saved event is the user's; the card does not get to edit it on load.

**No ARPU input on that row**, per the narrowed decision 3. The typed-override
lift is for bands the data describes. Offering a rate box for a population the
data lacks would invite the user to invent a figure, and the remedy on offer —
drop the band — states something true instead.

**The refusal names its cause.** When orphans are why the save is blocked, the
copy lists them. A generic blocked state was the whole defect.

### 3. The drop action, and the padlock it does not touch

The drop removes the band's share and then lets the **existing engine**
conserve the total.

**`rebalance`, not `seedMixPreserving`** — and this was the one real design
decision in the session. `rebalance` builds its view over the *members*, so the
orphan key is already invisible to it; re-asserting a free member's **own**
current share makes it redistribute the shortfall proportionally across the
other free members while the padlocks hold. `seedMixPreserving` normalises
across every member and would happily rewrite a held share — trap 54's shape,
which is a defect this codebase has already paid for once.

The first draft of this handler used `seedMixPreserving`. It was caught by
reading `rebalance`'s contract rather than by a trap, which is the cheaper end
of the same lesson.

**Every member padlocked is handled explicitly:** the orphan still goes, the mix
loads short, and the amber sum indicator says so. Read tolerates, write
enforces. Silently overriding a padlock to reach 100 would be the card deciding
something the user reserved.

**The stale draft-ARPU key is cleaned at the drop.** The write path already
filters stale keys out of the saved event, so this is not about persistence: a
dropped band's stated rate left in the draft would *resurrect* if the mix axis
round-trips and the name reappears. Dropping is the user saying the band is not
part of this promotion; its rate should not outlive it.

Five new keys in all six locales.

### 4. The edit-reopen transition — session 1's named gap, closed

Session 1 shipped both restore handlers but proved them only by source and
round-trip; it recorded that no *mount* showed a reopened event displaying its
stated rate. That is now driven through the card's own edit control:

restore an event carrying a stated rate → the input shows it **and is styled as
edited** → an untouched band stays unset with its derived placeholder, unstyled
→ clear the restored override → derived-today returns (decision 5) → re-state →
Save → the update carries the **new** rate, not the restored one, through the
real `marketEventExportRow`.

The styling assertion matters as much as the value: a restored override the user
cannot distinguish from a default is half a restore.

### 5. Guard-traps 68 and 69

**68 — the reopen forgets the stated rate.** Deferred from session 1 and now
planted: the saved event still carries the map, the export still writes it, only
the reopen forgets — which on screen is indistinguishable from the user never
having typed one. It targets the **event** handler specifically rather than the
campaign one; the two seed from different rows, and a trap either could satisfy
would be the ambiguous-anchor failure trap 64 hit in session 1.

**69 — the orphan predicate stops finding orphans.** The save still refuses,
because the blend is genuinely null, but nothing renders to say why and nothing
offers a remedy: exactly the pre-session state. The trap proves the rows and the
naming refusal are load-bearing rather than decorative.

Both mutation anchors were verified unique before planting, per session 1's
lesson — the count was checked rather than assumed.

### 6. THE HARNESS DEFECT — four traps broke on line endings

The first full run came back **63/67**: traps 56, 60 and 64 **INCONCLUSIVE**
("anchor did not match"), and trap 57 **MISSED**. Both new traps were caught.

**The cause is not in the product.** `WhatIfTab.tsx` measured `'\r\n'` earlier in
this session and `CRLF count: 0` by the time the traps ran — the editing tooling
rewrote it to LF, and git's conversion happens on checkout, not in the working
copy. Meanwhile guard-traps computed its newline **once, globally**:

```ts
const orig = originals.get(FILE)!;
const nl = orig.includes('\r\n') ? '\r\n' : '\n';
```

One file's line endings, applied to anchors targeting **eight** files. Every
**multi-line** anchor into WhatIfTab stopped matching at the same moment; every
single-line anchor was unaffected. That is exactly the observed set, and it is
why trap 64 — re-aimed and green last session — regressed without anyone
touching it.

**Trap 57 is the one worth keeping.** Its mutation is two `.replace()` calls, and
the first inserts a single-line marker constant:

```
'  const __trapAutoLock = 1; void __trapAutoLock;' + nl + …
```

That matched. The content changed, `mutated !== base` held, and the harness
recorded the trap as successfully **planted** — while the second, multi-line
replace, the one carrying the actual auto-lock defect, silently did nothing. So
the run reported MISSED: *the guard does not protect what it claims to*, when in
truth the defect was never planted.

**A multi-part mutation whose cheap part succeeds will report PLANTED while the
part that matters does nothing** — disguising a harness failure as a guard
failure, and pointing the next session at the wrong file. The `mutated !== base`
check is a good guard against a *total* no-op and no guard at all against a
*partial* one.

**Fixed at the root rather than by re-aiming three anchors.** Anchors are built
in LF and every target is normalised to LF before matching; the **pristine**
snapshot is what gets restored, so no file's real line endings are altered by a
run. Line endings are not a property these anchors are trying to pin, so they are
normalised away rather than tracked. Re-run: **67/67**, no MISSED, no
INCONCLUSIVE.

This is the second consecutive session in which guard-traps caught an
**instrument** rather than a defect, and the second in which the thing it caught
would have silently degraded every future run.

## Gate

```
mix-card spec (mounted):  99/99 passed        (was 73/73 — 26 new checks)
event-roundtrip spec:     69 passed, 0 failed
yield-roundtrip spec:     35 passed, 0 failed
mix-constraint spec:      74/74 passed        (engine untouched, both sessions)
override-arpu spec:       37/37 passed
guard-traps:              67/67 caught        (63/67 first run — see §6)
lint (tsc --noEmit):      clean
build:                    clean, 8.77s
i18n:                     5 new keys x 6 locales, all present, non-empty,
                          translated, {{band}} interpolation intact
```

## Where things stand

**The R3 arc closes here.** The carrier round-trips, the input states a rate, the
engine blends from it, the saved event carries it, a reopen restores it visibly,
and the one refusal that had no user-reachable remedy now has one that does not
require inventing data.

**`mixConstraint` was never touched across either surface session** — the whole
capability is which map reaches `perMemberArpus`, plus one call into `rebalance`
that the card already made elsewhere.

**Still open beyond the arc**, unchanged by this session:
`spec:yield-roundtrip`'s `toRow` is still a copy (Finding 2 of the R2 diagnosis,
yield half), and `yieldArpuMode` is still not restored on reopen (Finding 1),
which awaits Jon's three discriminating answers.

## Limits of this check

The orphan case is constructed by mounting a saved promotion whose stored mix
names a band absent from the fixture's tiers — the real restore path, but a
synthetic band name. An orphan arising from a genuine cohort-filter change is
the same code path and is not separately exercised. The stale-key filter remains
proven at the function rather than through a UI axis switch, because the harness
still has no tariff axis available; that limit is inherited from session 1 and
is unchanged.
