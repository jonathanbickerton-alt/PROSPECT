# Working agreement v3.2 — verification against current main

## FOR ADVISOR

```
Generated: 2026-08-12 22:01 +0100 (UTC 2026-08-12 21:01)
Verified against: c6efd74, branch main, tree CLEAN (bar this report).
Repo: committed 0324e47, pushed (origin in sync)
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before any check ran.
CONTRADICTED, and it is the document's headline — **REQUEST 3 WAS NEVER
  BUILT.** Section 5 narrates it as shipped and section 6 calls the arc CLOSED
  with main at "the Request 3 close". promoBandArpuOverride returns ZERO files
  in src/, and fa578ae's subject is "Hold Request 3 a FOURTH time" — the doc
  read a hold as a ship. Sections 3, 5 and 6 need correcting.
CONTRADICTED — 62b3c66 and 5710300 DO NOT EXIST. The one-baseline fix is
  6e9adff; 5710300 has no referent. Both were bases named by briefs written
  against an assumed future state — three R3 briefs running.
CONTRADICTED — baselineBlendedArpuFor DOES NOT EXIST. Option (a) shipped as a
  shared effectiveTierArpuMap with the mean inlined at each reader, not an
  extracted function. The DECISION is right and shipped, the SYMBOL invented.
VERIFIED — every other named hash is an ancestor with a consistent subject
  (6667464, 03a08fe, a50cca9, 4d8ae2b); every other named symbol exists
  (mixConstraint's four, blendTierMixOrNull, readStoredRateMap,
  effectiveTierArpu, tariffBaseArpuOverride); traps 61/63/64/65 present with
  intact subjects; three writer pins in spec:yield-roundtrip; all three rule
  placements read as described.
NOT-CHECKABLE: Jon's walks are testimony — the claim that R1, R2 and the
  one-baseline check passed on screen is recorded, not verified here.
FRESH GATE: suite 36/36, guard-traps 63/63, lint 0, 74/72/2, MAPEs
  13.8845/13.4315/14.3888/13.0192 — re-measured, none quoted.
```

---

## Instruments

`git cat-file -e` + `git merge-base --is-ancestor` + `git log -1 --format=%s`
per hash; `grep -r` over `src/` per symbol; `grep -o "id: 'N …'"` over
`scripts/guard-traps.ts` per trap; `grep -c` over `CLAUDE.md` and both skills
per placement; `npm run lint`, the full `spec:*`/`traps` batch, `npm run
guard-traps` (one instance, backgrounded, waited for), `spec:derive`,
`spec:edge`.

## 1. Hashes

| hash | claim | result |
|---|---|---|
| `6667464` | R1, Volume-% rate field | **VERIFIED** — ancestor; *"Make the percentage event's ARPU editable, and carry it everywhere"* |
| `03a08fe` | the negative rider | **VERIFIED** — ancestor; *"Keep the sign on a negative ARPU override, and re-aim two traps"* |
| `a50cca9` | R2 persistence, inert carrier | **VERIFIED** — ancestor; *"Carry a per-tier Base ARPU override through the yield round trip"* |
| `4d8ae2b` | R2 surface | **VERIFIED** — ancestor; *"Make the per-tier Base ARPU editable on the Value card"* |
| `62b3c66` | one-baseline fix | **CONTRADICTED** — does not exist. The fix is **`6e9adff`** |
| `5710300` | base of the R3 session | **CONTRADICTED** — does not exist |
| "the Request 3 close" | R3 shipped | **CONTRADICTED in substance** — `fa578ae` exists but is *"Hold Request 3 a fourth time"* |

## 2. Symbols

| symbol | result |
|---|---|
| `achievableTargetRange`, `rebalance`, `solveForTarget`, `blendedArpu` | **VERIFIED** — `src/utils/mixConstraint.ts` |
| `blendTierMixOrNull` | **VERIFIED** — `src/utils/forecasting.ts` |
| `readStoredRateMap` | **VERIFIED** — `src/utils/forecasting.ts` |
| `effectiveTierArpu` | **VERIFIED** — `src/components/WhatIfTab.tsx` |
| `tariffBaseArpuOverride` | **VERIFIED** — `src/App.tsx` and the type |
| `baselineBlendedArpuFor` | **CONTRADICTED** — zero files |
| `promoBandArpuOverride` | **CONTRADICTED** — zero files (R3 unbuilt) |

## 3. Rule placements

**VERIFIED, all three.** `CLAUDE.md` carries *"EVERY SESSION PRODUCES A
REPORT"*; the report-writing skill's trigger reads *"TRIGGER UNCONDITIONALLY"*;
the session-close skill carries the FIRST-ACTION skeleton rule. The v3.2 §2
description of the report rule and close ritual matches what is on disk.

One wording note, not a contradiction: §2 gives the four refinements as
*state-changing → +findings-producing → +budget clause → +skeleton-before-gate*.
The repo records them as *state-changing → +findings-producing → +trivial-check
exception → +carry-forward test*, with the budget clause and skeleton-first as
**separate close-ritual amendments** rather than steps in the trigger's own
history. Both narratives are true about the same week; the repo's is the one
`CLAUDE.md` states.

## 4. Pins and traps

| trap | result |
|---|---|
| 61 | **VERIFIED** — *"the default Add path drops the override"* |
| 63 | **VERIFIED** — *"the yield override import hand-rolled beside the shared reader"* |
| 64 | **VERIFIED** — *"clearing the tier override stores zero instead of unsetting"* |
| 65 | **VERIFIED** — *"a second baseline hand-rolled over the derived rates"* |

`spec:yield-roundtrip` carries **three** `PIN:` assertions (construction site,
`addYieldEvent` callers, import route), matching §3's carrier-conventions claim
that writer/import sites are pinned by count with traps proving the pins bite.

## 5. Fresh gate

| instrument | result |
|---|---|
| full suite | **36/36** npm scripts green |
| guard-traps | **63/63** caught, no MISSED, no INCONCLUSIVE |
| lint (`tsc --noEmit`) | exit 0 |
| edge fixture | 74 leaves, 72 fit, 2 skipped |
| PINNED ARPU MAPEs | 13.8845 / 13.4315 / 14.3888 / 13.0192 |

All re-measured this session. No earlier figure moved.

## 6. Corrections for the advisor

**1 — the material one. Request 3 is NOT built and the arc is NOT closed.**
Three places need correcting:

- **§5**, which narrates R3 as shipped;
- **§6**, "the Alessandro cards arc is CLOSED" and "main at the Request 3
  close" — main is at a *hold*;
- **§3**'s editable-ARPU bullet, which lists R3 among "all shipped and walked".

The safe replacement: *R1 and R2 shipped and walked; **R3 is designed, recorded
and unbuilt**, held four consecutive sessions on budget.* Its decision 3 — an
override **resolving** absence and lifting the save refusal — remains the
genuinely new ground in the arc, and is the reason it should not be quietly
dropped.

**2 — hashes.** Replace `62b3c66` with `6e9adff`. Delete `5710300`; it has no
referent. Both were bases named by briefs written against an assumed future
state, which is worth noticing as a pattern: three R3 briefs in a row named a
commit that would only exist if R3 had been built.

**3 — `baselineBlendedArpuFor`.** The decision is right and shipped; the symbol
is invented. Correct to: *option (a) shipped as a single shared
`effectiveTierArpuMap`, read by the card's baseline, the yield column and the
snapshot, with an agreement pin and trap 65.* The point that matters — one
object rather than three matching formulas — survives the correction and is
worth keeping in the wording.

**4 — a residual §7 backlog line to re-check when R3 does land.** §7 lists the
non-conforming-mix fixture variant and the "(+/−)" caption clause as cards-arc
residuals. Both stand; neither depends on R3.

## Limits of this check

Hash, symbol, trap and placement claims were checked mechanically. **Jon's walk
results are testimony and are not repo-checkable** — the document's claim that
R1, R2 and the one-baseline check passed on screen is recorded as such, not
verified here. §1's roadmap, usage economics and the off-repo generator remain
NOT-CHECKABLE by construction.

This session changed no source. `Verified against:` names the commit rather than
certifying one, per the read-only convention.
