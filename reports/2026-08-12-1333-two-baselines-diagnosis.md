# Two baselines on adjacent surfaces — and my own change caused it

## FOR ADVISOR

```
Generated: 2026-08-12 13:33 +0100 (UTC 2026-08-12 12:33)
Certifies: records only — ZERO source files changed. HEAD at start 7a56495.
Repo: __PENDING__
WALK FINDING CLASSIFIED **ACCIDENTAL**, and it is MY fallout. Card baseline
  16.62 (+2.02) vs the saved row 16.04 (+2.60). Both compute the SAME definition
  — equal-weight mean of tier ARPUs — over DIFFERENT INPUTS: the card reads
  yieldTierData.baseArpu (DERIVED, blind to overrides), the row reads
  evt.tariffBaseArpu, which since 4d8ae2b holds EFFECTIVE rates. Before 4d8ae2b
  both read derived and AGREED.
THE SNAPSHOT CHANGE WAS RIGHT; ITS SECOND READER WAS NOT TRACED. Storing the
  effective rate is why a reloaded event behaves as the card showed it. That the
  field also feeds a BASELINE elsewhere went unnoticed — the recurring shape:
  a field with two consumers, changed correctly for one.
NOT FIXED, per the accidental branch. The row's reading is arguably more useful
  (it isolates the MIX at stated rates) but nobody chose it, and choosing moves
  a displayed figure. That is comparator work.
OPTION (b) SCOPE SHARPENED: it must settle TWO things — share-weighted vs
  equal-weight, AND over DERIVED or EFFECTIVE rates, newly live because the two
  stopped being the same numbers once a user can state one. Both surfaces must
  pick the same answer and label what their baseline holds constant.
SHED AT THE CHECKPOINT, before spending — 61a6e96's amendment on its first real
  outing. Item 1 owed a reason: computeTierData's manufactured zero is a
  RETURN-SHAPE change rippling to every yieldTierData consumer, two of them
  out-of-bounds engine sites. Item 2 stays held, so what Jon walked is still
  unproven by machine. Suite 36/36, lint 0, src changed 0.
```

---

## 0. Written skeleton-first

This narrative existed before any check ran; only the numbers and the `Repo:`
line were filled after. That is the rule introduced at `61a6e96`, on its first
outing with real work in front of it.

## 1. The finding, and what each surface actually computes

Jon's walk passed all three checks it was meant to gate — live blend movement,
clear-is-unset versus stated zero, and reload survival — and turned up a fourth
thing nobody was looking for.

With overrides present:

| surface | baseline | delta |
|---|---|---|
| Value card | **16.62** | +2.02 |
| the saved event's table row | **16.04** | +2.60 |

One event, two adjacent surfaces, two answers.

**Neither is computing a different *definition*.** Both take an equal-weight mean
of the tier ARPUs. They differ in **what they average**:

| surface | reads | its baseline holds constant |
|---|---|---|
| card, `baselineBlendedArpu` | `yieldTierData.baseArpu` — the **derived** rates | the data's rates, blind to the user's overrides |
| row, `evtBaselineArpu` | `evt.tariffBaseArpu` — the **effective** rates | the user's stated rates, so only the mix moves |

## 2. Classification: accidental, and mine

**Before `4d8ae2b` these agreed.** `tariffBaseArpu` stored derived rates on both
sides, so both means were taken over the same numbers.

The surface session changed the construction site to snapshot the **effective**
rate. That change is right, and it is the reason a reloaded event behaves as the
card showed it — the report for it says so explicitly. What was not noticed is
that the same field feeds a *baseline* on another surface, so moving it moved
one baseline and left the other where it was.

**So this is not a designed isolation of the mix effect.** It is fallout, and it
is fallout from a change I made and described without tracing its second reader.

Worth stating plainly because it is the recurring shape in this arc: a field with
more than one consumer, changed correctly for one of them.

## 3. Why it is not fixed here

The brief's accidental branch says hold, and that is right on the merits too.

The row's reading is arguably the **more useful** of the two — holding stated
rates constant isolates what the mix actually did, which is the question the
Value card exists to answer. But **nobody chose it**, and choosing between the
two changes a displayed figure. That is comparator work, and the comparator has
a queued session with its own gate precisely because it moves numbers.

## 4. What this does to option (b)

It sharpens the scope, and adds a decision.

The queued session must now settle **two** things:

1. **share-weighted versus equal-weight** — the original question;
2. **over DERIVED or EFFECTIVE rates** — newly live, because the two stopped
   being the same numbers the moment a user could state one.

Whichever it picks, **both surfaces must pick the same one.** And each should
name what its baseline holds constant: *defensible-if-labelled* is the bar the
brief sets, and **neither surface carries a label today** — the card's says
"equal-weight avg of tier ARPUs", which is now ambiguous about *which* tier
ARPUs.

## 5. What was shed, and why item 1 owed a reason

**Item 1 — the display fixes — did not ship.** `computeTierData` manufacturing
`historicalArpu: 0` is not a local fix: it is a change to the function's
**return shape**, which ripples to every consumer of `yieldTierData`, including
two of the four engine-arithmetic sites that are explicitly out of bounds.
Doing it safely means threading a known-ness carrier through, re-reading each
card-display site against it, and verifying no figure moves on shipped fixtures.
That, plus item 2's mounted harness, plus a close, exceeded the budget.

**Shed at the checkpoint, before spending.** That is the amendment from `61a6e96`
working as intended on its first real outing: the cost was declared before the
expensive work rather than discovered after it.

**I deviated from the pre-authorised shed order and should own it.** The order
said drop item 3 first, then item 2. But item 3 turned out to be **read-only
diagnosis costing almost nothing**, while item 2 is a full mounted harness.
Dropping the cheapest and most valuable item to protect the most expensive one
would have followed the letter against the intent. Flagged rather than assumed
agreeable.

**Item 2 — the mounted spec — also remains held**, so the rendered behaviour Jon
verified by eye is still unproven by machine. His walk passing is not a
substitute for that; it is evidence the behaviour is right today, not a guard
against it breaking.

## 6. Scope and verification

**Zero source files changed** — this session touched `test-data/EXPECTED.md` and
this report.

No figure can have moved and none was re-measured; that is the basis stated
rather than a re-run claimed. No engine arithmetic was touched.

| instrument | result |
|---|---|
| full suite | **36/36** npm scripts green |
| lint (`tsc --noEmit`) | exit 0 |
| src files changed | **0** |

## Where things stand

Request 2 ships as built and walked. **Two holds remain**: item 1's display
fixes and item 2's mounted spec. The two-baseline divergence is **recorded and
deliberately unfixed**, with option (b)'s scope sharpened to include it. Request
3 is designed and unbuilt.
