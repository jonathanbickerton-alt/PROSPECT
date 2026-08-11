# The constrained mix engine — session 1 of 2, pure functions only

## FOR ADVISOR

```
Generated: 2026-08-11 20:59 +0100 (UTC 2026-08-11 19:59)
Certifies: b0dd116, branch main, tree CLEAN.
Repo: committed b0dd116, pushed (origin in sync)
DECISION NEEDED — the brief ENDS MID-SENTENCE at "shares sum to the fixed total,
  ENFORCED AT WRITE —". Built to the stated substance; it does NOT conflict.
DECISION NEEDED — AUTO-LOCK: the brief calls it settled, EXPECTED.md records it
  PENDING with Alessandro under a do-not-build guard. Reported, not resolved. The
  engine is NEUTRAL (locks are an INPUT, never an output); session 2 cannot be.
BUILT: src/utils/mixConstraint.ts — achievableTargetRange, rebalance,
  solveForTarget, blendedArpu. Pure, total, wired to NOTHING (zero importers).
INVARIANT as instructed, and NOT new — seedMixPreserving already normalises to
  100. The engine adds the read/write split: writes never EMIT a non-conforming
  vector, reads DESCRIBE one, since a restored promoMix may legitimately not sum
  to 100 and refusing it blanks the amber indicator saying so. MY reading of "at
  write" — the confirming sentence is the truncated one.
THREE BANDS EXACTLY DETERMINED, checked against the CLOSED FORM, not the function
  under test. >2 free is underdetermined and a rule was CHOSEN; V2's tariff axis
  is entirely that branch, inheriting a choice rather than a derivation.
THREE DEFECTS FOUND BY SPEC AND TRAPS, none visible by reading: conserve clamped
  and returned ok on a mix summing to 1e12; the residual was absorbed by the LAST
  member, padlocked or not; a check passed on a mix that conformed while blending
  23.88 against a target of 20. Trap 53 also found a dead branch in my own fix.
GATE: qa-tester PASS, regression-guard SAFE. Stage 1 SKIPPED AND DECLARED — no
  rendered surface changed, so it would pass vacuously. 33/33 specs, guard-traps
  53/53, traps 3/3, lint+build clean. UNMOVED 74/72/2 and the four MAPEs.
```

---

## 0. What was asked, and what was held

**HEAD at session start `723b72f`**, tree clean, origin in sync, `a2bba18`
confirmed an ancestor by `git merge-base --is-ancestor`.

Session 1 of 2: **the engine only**. No UI, and none was written. The single
edit to a component file adds the word `export` to an existing function.

## 1. Two things the brief could not settle

### 1a. The brief ends mid-sentence

The last line reads, verbatim:

> `INVARIANT DECISION (advisor-recommended; HOLD and present if it conflicts with the settled card semantics): shares sum to the fixed total, ENFORCED AT WRITE —`

and stops. I built to the stated substance rather than blocking, because the
substance is complete enough to implement and the HOLD condition is not met:
**it does not conflict with the settled card semantics.** It barely even adds to
them — `seedMixPreserving` ([WhatIfTab.tsx:446](../src/components/WhatIfTab.tsx))
already normalises to 100 and has its last member absorb the float residual, so
the decision ratifies existing practice.

**What I had to decide myself, and would rather you confirmed.** "Enforced at
write" admits two readings:

| reading | consequence |
|---|---|
| writes never **emit** a non-conforming vector | reads still describe one |
| reads also **reject** a non-conforming vector | a legacy mix becomes unreadable |

I took the first. A restored `promoMix` can legitimately fail to sum to 100 — a
legacy save, or a preserved mix whose tier list changed shape — which is exactly
why the card carries an amber sum indicator at
[WhatIfTab.tsx:4368](../src/components/WhatIfTab.tsx). **A read that refused to
describe a non-conforming mix would blank the one display that tells the user
their mix needs attention.** If the missing tail says otherwise it is a small,
contained change; the split is enforced in one helper.

### 1b. Auto-lock — the brief and the record disagree

The brief lists "moving a slider auto-locks it, click releases" among the settled
semantics. [EXPECTED.md](../test-data/EXPECTED.md) says the opposite:

> One detail remains PENDING and only one: whether moving a slider auto-locks
> it. That is our addition, not Alessandro's, and it is with him. The
> do-not-build guard applies to that detail alone.

Since the brief instructed me to read that record and not re-derive it, the
conflict is itself the thing to report — per the reserved-decisions rule, a
conflict between an instruction and a reserved decision is not a licence to
resolve it.

**It cost this session nothing**, because auto-lock is an interaction policy and
this is the engine. `rebalance` takes the lock set as an **input and never
returns one**. The moved member is held *for that operation* — arithmetically it
must be, you cannot rebalance around a value you are also rebalancing — and that
is a different thing from a padlock persisting to the next interaction. The spec
asserts the outcome object carries no lock field, which is what makes the guard
enforced rather than merely intended.

**It will not cost session 2 nothing.** The card is where the question becomes
unavoidable.

## 2. The engine

`src/utils/mixConstraint.ts`. Names adjusted from the brief where the compiler
required it, meanings unchanged.

### The range is a two-line derivation

Locked members contribute a fixed amount; the unlocked ones divide a fixed free
budget. `Σ share·arpu` over the simplex `{s ≥ 0, Σs = budget}` is linear, so it
takes its extremes at the vertices — all the budget on the cheapest free member,
or all on the dearest. Everything between is reachable, nothing outside is.

With no locks this collapses to `[min arpu, max arpu]`, which is the sanity check
to reach for and is pinned as one.

### Three bands are exactly determined — proved, not asserted

With three members and one locked, two free shares face two equations, so there
is one answer and nothing to recommend between. The spec checks every answer
against the closed form `sA = (needed − budget·aB) / (aA − aB)` rather than
against another call to the function under test.

### Above two free members, a rule was CHOSEN

The system is underdetermined there. The engine interpolates the current free
shares toward the vertex the target heads for. It is deterministic, continuous
in the target (**measured**: a 0.001 retype moves no share more than 0.05), holds
every share at or above zero, and degenerates to the unique answer at two free
members.

**The value axis never reaches this branch. V2's tariff axis is entirely this
branch.** Recorded in EXPECTED.md so the V2 design pass knows it is inheriting a
choice rather than a derivation.

### Absence

`blendedArpu` returns `null`, never a diluting zero, when a member **carrying
share** has no known ARPU. A member at zero share needs no ARPU — it contributes
nothing whatever its ARPU turns out to be — and refusing there would be absence
theatre. That distinction is pinned both ways.

## 3. Three defects, none of them visible by reading

Each was in code that read as obviously correct.

**1. `conserve` clamped instead of refusing.** `if (last < 0) last = 0` looks
like a safety check and is its inverse: it keeps one member non-negative by
abandoning conservation everywhere else. Input `{Low: 1e12}` on a collapsed range
returned **ok with a mix summing to a trillion**. Found by the hostile-input
sweep, not by inspection.

**2. The residual was absorbed by the LAST member, padlocked or not.** So the
repair that restores the total could silently overwrite a share the user had
explicitly held. This is the more instructive of the two: it is *invariant
enforcement breaking a different invariant*, and a check that only asked "does it
sum to 100" would have passed it. The absorber is now required to be unlocked,
and where nothing is unlocked the engine refuses rather than picking one.

**3. A spec check passed on a result that was conforming and wrong.** Guard-trap
53 found this. With the free-share rescale removed, `conserve`'s absorber still
repairs the total, so the mix came back conforming — and blending to **23.88
against a target of 20**. The check asserted conformance and nothing else.

That third one is the vacuous-result trap in a new coat, and it is now folded
into the qa-tester definition: *a check whose assertion does not mention the
thing the function is FOR*.

### Trap 53 also found a dead branch in my own fix

Its first aiming MISSED — not because the spec was weak but because **no caller
can reach the branch it targeted**. Both write paths bound their non-absorber
members below 100 by construction, so `conserve`'s negative-residual early return
was unreachable. A defensive branch no input can drive is a check that runs
never, so it was folded into a single validated exit that the null-absorber case
does reach: same protection for a future third caller, one live path instead of
one live and one dead.

This is the same shape as guard-trap 46 in an earlier session, which revealed a
dead flag in a fix. Traps keep finding this particular thing, which is an
argument for planting them on fixes rather than only on the code being fixed.

## 4. A compiler constraint that changed the API surface

The outcome types discriminate on a **string** `kind: 'ok' | 'blocked'`, not a
boolean `ok`. That is not style. This repo's `tsconfig.json` sets no `strict`
flag, so `strictNullChecks` is off, and **TypeScript does not narrow a union by
a boolean literal discriminant under it**. The first draft used `ok: true |
false` and every read of `.reason` was a type error, in the module and the spec
alike.

Measured rather than assumed: a two-line probe compiled under this exact
tsconfig showed the boolean form failing and the string form narrowing cleanly.
Meanings are unchanged, which is what the brief permitted.

## 5. Not collapsed, deliberately

`autoBalanceMix` is now **exported** so the spec pins `rebalance` against the
real shipped function on 400 no-lock cases rather than against a copy of it. A
reference copy in a spec is how two implementations drift while both look
verified.

It is **not** yet delegated to `rebalance`, and `blendTierMix` is **not** folded
into `blendedArpu`. Both are behaviour changes on live controls and belong with
the card. The spec pins their agreement meanwhile, so a drift is a red run rather
than a discovery.

## 6. Gate

| stage | verdict |
|---|---|
| ui-consistency | **SKIPPED, declared** — see below |
| qa-tester | PASS |
| regression-guard | **SAFE FOR USER TESTING** |

**Stage 1 was skipped deliberately and is declared rather than quietly dropped.**
This session changed no rendered surface; the only component edit adds `export`
to an existing function. ui-consistency checks new UI against established
patterns, so with no new UI it would have passed without examining anything —
a vacuous pass standing in for a check. Its lint and build arm was run directly.

**Stage 2 verified independently rather than re-running my spec** — it hand-rolled
the closed form on different band names and values and got the same answer, and
characterised exactly where `blendedArpu` and `blendTierMix` diverge. It found
the min-boundary check asserted only that the solve *resolved*, with no check on
what it produced. Closed; the spec went 71 → 72.

**Stage 3 disclosed a concurrency mistake of its own**, and correctly. It ran the
full `spec:*` batch alongside `guard-traps`, which mutates tracked files in
place; `generate-missing` and `import-seam` came back red and were green on
isolated re-run. It declared `npm run traps` skipped rather than assuming it.

I re-ran both specs myself in isolation (**44/44** and **36/36**) and ran
**`traps` 3/3**, so nothing rests on the agent's re-runs or on a declared skip.

### The rule that let it happen has been amended

The existing rule said *"the prohibition is on a SECOND instance, not on
backgrounding"* — it named the second-guard-traps-instance case and left the
general one to be inferred. The agent read it literally and was not wrong to.
Both definitions now say: **nothing else may read the tree while guard-traps
runs** — not a spec, not a batch loop, not lint, not build. The failure is the
rule's, not the reader's.

## 7. Measurements

```
mix-constraint spec        72/72
full suite                 33/33 npm scripts green
guard-traps                53/53 caught, no MISSED, no INCONCLUSIVE
traps                      3/3
lint (tsc --noEmit)        exit 0
build (vite)               succeeded
edge fixture               74 leaves, 72 fit, 2 skipped (both insufficient-history, named)
PINNED ARPU MAPEs          13.8845 / 13.4315 / 14.3888 / 13.0192   spread 1.3696pp
```

All re-measured on this tree. No earlier figure moved.

§33 with the scope named: **main's working tree and build output are AI-free**
(package.json, `src/`, `.env`). History and remote branches are out of scope; the
preserved `ai-capability` branch is expected and deliberate. `.env` is neither
tracked nor staged.

## 8. Readiness for session 2 — the card

**The engine is done and unwired.** Four things should shape the UI session:

1. **Auto-lock must be settled first.** It is the one place the engine
   deliberately declines to have an opinion, and the card cannot.
2. **`promoMix` still has no schema and no enforced invariant.** The round trip
   preserves shares verbatim, including shares that do not sum to 100. The engine
   repairs on write; nothing repairs on read, by design. Decide where the card
   surfaces that — the amber indicator exists and is the obvious answer.
3. **Two collapses are queued and neither is done**: `autoBalanceMix` →
   `rebalance`, and `blendTierMix` → `blendedArpu`. Both are behaviour changes on
   live controls. Doing them in the card session is right; doing them silently is
   not, since `blendTierMix`'s `?? 0` is a real behaviour difference for a member
   with an unknown ARPU.
4. **No save carries promotion events yet**, so the first one that does is still
   the behavioural fixture this family lacks — unchanged from the prerequisite
   session, and now more valuable, because a mix with locks and a target is
   exactly the state worth capturing.

## Where things stand

DQ retains its full inheritance and remains before UAT. The walk remains closed.
Session 2 was not started, as scoped.
